-- Альтернативное решение: SQL функции вместо Edge Functions
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Создание функции проверки подписки
CREATE OR REPLACE FUNCTION public.verify_subscription(
  p_email TEXT,
  p_license_key TEXT,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
  result JSON;
  days_left INTEGER;
BEGIN
  -- Логирование запроса
  RAISE LOG 'Verifying subscription for email: %, license: %', p_email, p_license_key;

  -- Поиск подписки
  SELECT * INTO subscription_record
  FROM public.subscriptions
  WHERE email = LOWER(TRIM(p_email))
    AND license_key = TRIM(p_license_key);

  -- Проверка существования
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Подписка не найдена. Проверьте email и лицензионный ключ.'
    );
  END IF;

  -- Проверка статуса
  IF subscription_record.status != 'active' THEN
    RETURN json_build_object(
      'valid', false,
      'error', CASE
        WHEN subscription_record.status = 'inactive' THEN 'Подписка деактивирована'
        ELSE 'Подписка заблокирована'
      END
    );
  END IF;

  -- Проверка срока действия
  IF subscription_record.expires_at < NOW() THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Подписка истекла. Продлите подписку для продолжения работы.',
      'expired', true,
      'expires_at', subscription_record.expires_at
    );
  END IF;

  -- Проверка устройства (одна лицензия = одно устройство)
  IF subscription_record.device_fingerprint IS NOT NULL
     AND subscription_record.device_fingerprint != p_device_fingerprint THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Лицензия уже активирована на другом устройстве. Обратитесь к администратору для сброса.',
      'device_conflict', true
    );
  END IF;

  -- Вычисление дней до истечения
  days_left := EXTRACT(EPOCH FROM (subscription_record.expires_at - NOW())) / 86400;

  -- Обновление данных подписки
  UPDATE public.subscriptions
  SET
    device_fingerprint = COALESCE(subscription_record.device_fingerprint, p_device_fingerprint),
    last_checked = NOW()
  WHERE id = subscription_record.id;

  -- Успешный результат
  RETURN json_build_object(
    'valid', true,
    'expires', subscription_record.expires_at,
    'plan', subscription_record.plan,
    'status', subscription_record.status,
    'days_left', GREATEST(0, FLOOR(days_left)),
    'email', subscription_record.email,
    'device_bound', subscription_record.device_fingerprint IS NOT NULL,
    'last_checked', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in verify_subscription: %', SQLERRM;
    RETURN json_build_object(
      'valid', false,
      'error', 'Ошибка сервера при проверке подписки',
      'network_error', true
    );
END;
$$;

-- 2. Функция для создания подписки
CREATE OR REPLACE FUNCTION public.create_subscription(
  p_email TEXT,
  p_plan TEXT DEFAULT 'monthly',
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  license_key TEXT;
  expires_at TIMESTAMP WITH TIME ZONE;
  subscription_record RECORD;
BEGIN
  -- Проверка админ-ключа (простая проверка)
  IF p_admin_key IS NULL OR p_admin_key != 'admin-change-this-key-123' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Неверный административный ключ'
    );
  END IF;

  -- Генерация лицензионного ключа
  license_key := 'FIGMA-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' ||
                 UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

  -- Вычисление даты истечения
  expires_at := NOW() + CASE p_plan
    WHEN 'monthly' THEN INTERVAL '30 days'
    WHEN 'quarterly' THEN INTERVAL '90 days'
    WHEN 'yearly' THEN INTERVAL '365 days'
    ELSE INTERVAL '30 days'
  END;

  -- Проверка существующей подписки
  SELECT * INTO subscription_record
  FROM public.subscriptions
  WHERE email = LOWER(TRIM(p_email));

  IF FOUND THEN
    -- Обновление существующей подписки
    UPDATE public.subscriptions
    SET
      license_key = create_subscription.license_key,
      plan = p_plan,
      status = 'active',
      expires_at = create_subscription.expires_at,
      updated_at = NOW()
    WHERE email = LOWER(TRIM(p_email))
    RETURNING * INTO subscription_record;
  ELSE
    -- Создание новой подписки
    INSERT INTO public.subscriptions (
      email, license_key, plan, status, expires_at
    ) VALUES (
      LOWER(TRIM(p_email)), license_key, p_plan, 'active', expires_at
    ) RETURNING * INTO subscription_record;
  END IF;

  RETURN json_build_object(
    'success', true,
    'subscription', json_build_object(
      'email', subscription_record.email,
      'license_key', subscription_record.license_key,
      'plan', subscription_record.plan,
      'expires_at', subscription_record.expires_at,
      'created_at', subscription_record.created_at
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ошибка создания подписки: ' || SQLERRM
    );
END;
$$;

-- 3. Функция получения статистики подписок
CREATE OR REPLACE FUNCTION public.get_subscription_stats(
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count INTEGER;
  active_count INTEGER;
  expired_count INTEGER;
  revenue_estimate NUMERIC;
BEGIN
  -- Проверка админ-ключа
  IF p_admin_key IS NULL OR p_admin_key != 'admin-change-this-key-123' THEN
    RETURN json_build_object(
      'error', 'Неверный административный ключ'
    );
  END IF;

  -- Подсчет статистики
  SELECT COUNT(*) INTO total_count FROM public.subscriptions;

  SELECT COUNT(*) INTO active_count
  FROM public.subscriptions
  WHERE status = 'active' AND expires_at > NOW();

  SELECT COUNT(*) INTO expired_count
  FROM public.subscriptions
  WHERE expires_at <= NOW();

  -- Примерная оценка дохода (активные подписки * средняя стоимость)
  revenue_estimate := active_count * 500;

  RETURN json_build_object(
    'total_subscriptions', total_count,
    'active_subscriptions', active_count,
    'expired_subscriptions', expired_count,
    'monthly_revenue_estimate', revenue_estimate,
    'generated_at', NOW()
  );
END;
$$;

-- 4. Настройка RLS и прав доступа
ALTER FUNCTION public.verify_subscription OWNER TO supabase_admin;
ALTER FUNCTION public.create_subscription OWNER TO supabase_admin;
ALTER FUNCTION public.get_subscription_stats OWNER TO supabase_admin;

-- Права доступа для публичных пользователей
GRANT EXECUTE ON FUNCTION public.verify_subscription TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_stats TO anon, authenticated;

-- 5. Создание представления для безопасного доступа к подпискам
CREATE OR REPLACE VIEW public.subscription_info AS
SELECT
  id,
  email,
  license_key,
  plan,
  status,
  expires_at,
  created_at,
  CASE
    WHEN device_fingerprint IS NOT NULL THEN 'bound'
    ELSE 'not_bound'
  END as device_status,
  CASE
    WHEN expires_at > NOW() AND status = 'active' THEN 'active'
    WHEN expires_at <= NOW() THEN 'expired'
    ELSE 'inactive'
  END as computed_status
FROM public.subscriptions;

-- RLS для представления
ALTER VIEW public.subscription_info OWNER TO supabase_admin;
GRANT SELECT ON public.subscription_info TO anon, authenticated;

-- 6. Тестовые данные (раскомментируйте если нужно)
/*
INSERT INTO public.subscriptions (email, license_key, plan, status, expires_at) VALUES
('test@demo.com', 'TEST-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-DEMO', 'monthly', 'active', NOW() + INTERVAL '30 days'),
('demo@example.com', 'DEMO-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-FIGMA', 'yearly', 'active', NOW() + INTERVAL '365 days'),
('expired@test.com', 'OLD-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-EXPIRED', 'monthly', 'active', NOW() - INTERVAL '5 days');
*/

-- 7. Проверочные запросы
-- Тест функции проверки подписки:
-- SELECT public.verify_subscription('test@demo.com', 'TEST-XXXXXX-DEMO', 'device-123');

-- Создание тестовой подписки:
-- SELECT public.create_subscription('newuser@test.com', 'monthly', 'admin-change-this-key-123');

-- Получение статистики:
-- SELECT public.get_subscription_stats('admin-change-this-key-123');

-- Просмотр всех подписок:
-- SELECT * FROM public.subscription_info ORDER BY created_at DESC;

COMMENT ON FUNCTION public.verify_subscription IS 'Проверка действительности подписки плагина';
COMMENT ON FUNCTION public.create_subscription IS 'Создание новой подписки (требует админ-ключ)';
COMMENT ON FUNCTION public.get_subscription_stats IS 'Получение статистики подписок (требует админ-ключ)';
COMMENT ON VIEW public.subscription_info IS 'Безопасное представление информации о подписках';
