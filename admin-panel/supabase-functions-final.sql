-- Исправленные SQL функции для Supabase (финальная версия)
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Добавляем уникальное ограничение на email (если его нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'subscriptions_email_unique'
    AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_email_unique UNIQUE (email);
  END IF;
END $$;

-- 2. Создание функции проверки подписки
CREATE OR REPLACE FUNCTION public.verify_subscription(
  p_email TEXT,
  p_license_key TEXT,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  subscription_record RECORD;
  days_left INTEGER;
BEGIN
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
    RETURN json_build_object(
      'valid', false,
      'error', 'Ошибка сервера при проверке подписки',
      'network_error', true
    );
END;
$$;

-- 3. Функция для создания подписки (ИСПРАВЛЕНА)
CREATE OR REPLACE FUNCTION public.create_subscription(
  p_email TEXT,
  p_plan TEXT DEFAULT 'monthly',
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  new_license_key TEXT;
  new_expires_at TIMESTAMP WITH TIME ZONE;
  subscription_record RECORD;
BEGIN
  -- Проверка админ-ключа
  IF p_admin_key IS NULL OR p_admin_key != 'figma-admin-2024-secure-key' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Неверный административный ключ'
    );
  END IF;

  -- Генерация лицензионного ключа
  new_license_key := 'FIGMA-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' ||
                     UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

  -- Вычисление даты истечения
  new_expires_at := NOW() + CASE p_plan
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
      license_key = new_license_key,
      plan = p_plan,
      status = 'active',
      expires_at = new_expires_at,
      updated_at = NOW()
    WHERE email = LOWER(TRIM(p_email))
    RETURNING * INTO subscription_record;
  ELSE
    -- Создание новой подписки
    INSERT INTO public.subscriptions (
      email, license_key, plan, status, expires_at
    ) VALUES (
      LOWER(TRIM(p_email)), new_license_key, p_plan, 'active', new_expires_at
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

-- 4. Функция получения статистики подписок
CREATE OR REPLACE FUNCTION public.get_subscription_stats(
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INTEGER;
  active_count INTEGER;
  expired_count INTEGER;
  revenue_estimate NUMERIC;
BEGIN
  -- Проверка админ-ключа
  IF p_admin_key IS NULL OR p_admin_key != 'figma-admin-2024-secure-key' THEN
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

-- 6. Создание актуальных тестовых данных
DO $$
DECLARE
    test_key TEXT;
    demo_key TEXT;
BEGIN
    -- Генерируем новые ключи
    test_key := 'TEST-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-DEMO';
    demo_key := 'DEMO-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-FIGMA';

    -- Обновляем/создаем test@demo.com с актуальной датой
    INSERT INTO public.subscriptions (email, license_key, plan, status, expires_at)
    VALUES ('test@demo.com', test_key, 'monthly', 'active', NOW() + INTERVAL '30 days')
    ON CONFLICT (email) DO UPDATE SET
        license_key = EXCLUDED.license_key,
        expires_at = EXCLUDED.expires_at,
        status = 'active',
        updated_at = NOW();

    -- Обновляем/создаем demo@example.com с актуальной датой
    INSERT INTO public.subscriptions (email, license_key, plan, status, expires_at)
    VALUES ('demo@example.com', demo_key, 'yearly', 'active', NOW() + INTERVAL '365 days')
    ON CONFLICT (email) DO UPDATE SET
        license_key = EXCLUDED.license_key,
        expires_at = EXCLUDED.expires_at,
        status = 'active',
        updated_at = NOW();

    RAISE NOTICE 'Тестовые подписки обновлены:';
    RAISE NOTICE 'test@demo.com: %', test_key;
    RAISE NOTICE 'demo@example.com: %', demo_key;
END $$;

-- 7. Комментарии для функций
COMMENT ON FUNCTION public.verify_subscription IS 'Проверка действительности подписки плагина';
COMMENT ON FUNCTION public.create_subscription IS 'Создание новой подписки (требует админ-ключ)';
COMMENT ON FUNCTION public.get_subscription_stats IS 'Получение статистики подписок (требует админ-ключ)';
COMMENT ON VIEW public.subscription_info IS 'Безопасное представление информации о подписках';
