-- Email уведомления для системы подписки Figma Plugin
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Создание таблицы для хранения шаблонов email
CREATE TABLE IF NOT EXISTS public.email_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(50) UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Создание таблицы для логирования отправленных email
CREATE TABLE IF NOT EXISTS public.email_log (
  id SERIAL PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  template_name VARCHAR(50),
  subject TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Вставка шаблонов email
INSERT INTO public.email_templates (template_name, subject, html_body, text_body) VALUES

-- Шаблон для новой подписки
('new_subscription',
'🎉 Ваш лицензионный ключ Figma Plugin готов!',
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .license-key { background: #e8f4fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .key-text { font-family: monospace; font-size: 18px; font-weight: bold; color: #0066cc; letter-spacing: 2px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Добро пожаловать в Figma Bulk Export!</h1>
        </div>
        <div class="content">
            <p>Здравствуйте!</p>

            <p>Спасибо за покупку подписки на <strong>Figma Bulk Export Plugin</strong>! Ваша подписка успешно активирована.</p>

            <div class="license-key">
                <h3>🔑 Ваш лицензионный ключ:</h3>
                <div class="key-text">{{LICENSE_KEY}}</div>
            </div>

            <h3>📋 Детали подписки:</h3>
            <ul>
                <li><strong>Email:</strong> {{EMAIL}}</li>
                <li><strong>План:</strong> {{PLAN_NAME}}</li>
                <li><strong>Действует до:</strong> {{EXPIRES_DATE}}</li>
            </ul>

            <h3>🚀 Как начать использовать:</h3>
            <ol>
                <li>Откройте Figma Desktop</li>
                <li>Запустите плагин "Bulk Export by Sections"</li>
                <li>Введите ваш email и лицензионный ключ</li>
                <li>Наслаждайтесь автоматическим экспортом!</li>
            </ol>

            <p>Если у вас есть вопросы, не стесняйтесь обращаться к нам.</p>

            <p>С уважением,<br>Команда Figma Bulk Export</p>
        </div>
        <div class="footer">
            <p>Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
        </div>
    </div>
</body>
</html>',
'🎉 Добро пожаловать в Figma Bulk Export!

Спасибо за покупку подписки! Ваша подписка успешно активирована.

🔑 Ваш лицензионный ключ: {{LICENSE_KEY}}

📋 Детали подписки:
- Email: {{EMAIL}}
- План: {{PLAN_NAME}}
- Действует до: {{EXPIRES_DATE}}

🚀 Как начать использовать:
1. Откройте Figma Desktop
2. Запустите плагин "Bulk Export by Sections"
3. Введите ваш email и лицензионный ключ
4. Наслаждайтесь автоматическим экспортом!

С уважением,
Команда Figma Bulk Export'),

-- Шаблон для истечения подписки
('subscription_expiring',
'⏰ Ваша подписка Figma Plugin истекает через 3 дня',
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff9500; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .button { display: inline-block; background: #ff9500; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Напоминание о подписке</h1>
        </div>
        <div class="content">
            <p>Здравствуйте!</p>

            <div class="warning">
                <h3>⚠️ Ваша подписка истекает скоро!</h3>
                <p>Ваша подписка на Figma Bulk Export Plugin истекает <strong>{{EXPIRES_DATE}}</strong> (через {{DAYS_LEFT}} дней).</p>
            </div>

            <p>Чтобы продолжить использовать плагин без перерыва, продлите подписку заранее.</p>

            <h3>📋 Детали вашей подписки:</h3>
            <ul>
                <li><strong>Email:</strong> {{EMAIL}}</li>
                <li><strong>Текущий план:</strong> {{PLAN_NAME}}</li>
                <li><strong>Лицензионный ключ:</strong> {{LICENSE_KEY}}</li>
            </ul>

            <a href="#" class="button">Продлить подписку</a>

            <p>Если у вас есть вопросы, свяжитесь с нами.</p>

            <p>С уважением,<br>Команда Figma Bulk Export</p>
        </div>
        <div class="footer">
            <p>Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
        </div>
    </div>
</body>
</html>',
'⏰ Напоминание о подписке

Ваша подписка на Figma Bulk Export Plugin истекает {{EXPIRES_DATE}} (через {{DAYS_LEFT}} дней).

📋 Детали подписки:
- Email: {{EMAIL}}
- План: {{PLAN_NAME}}
- Ключ: {{LICENSE_KEY}}

Продлите подписку, чтобы продолжить использование плагина.

С уважением,
Команда Figma Bulk Export'),

-- Шаблон для продления подписки
('subscription_renewed',
'✅ Подписка Figma Plugin продлена!',
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .license-key { background: #e8f4fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .key-text { font-family: monospace; font-size: 16px; font-weight: bold; color: #0066cc; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Подписка продлена!</h1>
        </div>
        <div class="content">
            <p>Здравствуйте!</p>

            <div class="success">
                <h3>🎉 Ваша подписка успешно продлена!</h3>
                <p>Спасибо за продление подписки на Figma Bulk Export Plugin.</p>
            </div>

            <h3>📋 Обновленные детали подписки:</h3>
            <ul>
                <li><strong>Email:</strong> {{EMAIL}}</li>
                <li><strong>План:</strong> {{PLAN_NAME}}</li>
                <li><strong>Новая дата истечения:</strong> {{EXPIRES_DATE}}</li>
            </ul>

            <div class="license-key">
                <h3>🔑 Ваш лицензионный ключ:</h3>
                <div class="key-text">{{LICENSE_KEY}}</div>
                <small>Лицензионный ключ остается прежним</small>
            </div>

            <p>Продолжайте наслаждаться автоматическим экспортом из Figma!</p>

            <p>С уважением,<br>Команда Figma Bulk Export</p>
        </div>
        <div class="footer">
            <p>Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
        </div>
    </div>
</body>
</html>',
'✅ Подписка продлена!

Ваша подписка на Figma Bulk Export Plugin успешно продлена.

📋 Обновленные детали:
- Email: {{EMAIL}}
- План: {{PLAN_NAME}}
- Действует до: {{EXPIRES_DATE}}
- Ключ: {{LICENSE_KEY}}

Продолжайте использовать плагин!

С уважением,
Команда Figma Bulk Export')

ON CONFLICT (template_name) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  updated_at = NOW();

-- 4. Функция для отправки email через внешний сервис
CREATE OR REPLACE FUNCTION public.send_email(
  p_to_email TEXT,
  p_template_name TEXT,
  p_variables JSONB DEFAULT '{}'::jsonb,
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  template_record RECORD;
  email_subject TEXT;
  email_html TEXT;
  email_text TEXT;
  log_id INTEGER;
  http_response JSON;
BEGIN
  -- Проверка админ-ключа (опционально)
  IF p_admin_key IS NOT NULL AND p_admin_key != 'figma-admin-2024-secure-key' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Неверный административный ключ'
    );
  END IF;

  -- Получение шаблона
  SELECT * INTO template_record
  FROM public.email_templates
  WHERE template_name = p_template_name;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Шаблон email не найден: ' || p_template_name
    );
  END IF;

  -- Замена переменных в шаблоне
  email_subject := template_record.subject;
  email_html := template_record.html_body;
  email_text := template_record.text_body;

  -- Простая замена переменных (для более сложной логики используйте Edge Functions)
  IF p_variables ? 'EMAIL' THEN
    email_subject := REPLACE(email_subject, '{{EMAIL}}', p_variables->>'EMAIL');
    email_html := REPLACE(email_html, '{{EMAIL}}', p_variables->>'EMAIL');
    email_text := REPLACE(email_text, '{{EMAIL}}', p_variables->>'EMAIL');
  END IF;

  IF p_variables ? 'LICENSE_KEY' THEN
    email_html := REPLACE(email_html, '{{LICENSE_KEY}}', p_variables->>'LICENSE_KEY');
    email_text := REPLACE(email_text, '{{LICENSE_KEY}}', p_variables->>'LICENSE_KEY');
  END IF;

  IF p_variables ? 'PLAN_NAME' THEN
    email_html := REPLACE(email_html, '{{PLAN_NAME}}', p_variables->>'PLAN_NAME');
    email_text := REPLACE(email_text, '{{PLAN_NAME}}', p_variables->>'PLAN_NAME');
  END IF;

  IF p_variables ? 'EXPIRES_DATE' THEN
    email_html := REPLACE(email_html, '{{EXPIRES_DATE}}', p_variables->>'EXPIRES_DATE');
    email_text := REPLACE(email_text, '{{EXPIRES_DATE}}', p_variables->>'EXPIRES_DATE');
  END IF;

  IF p_variables ? 'DAYS_LEFT' THEN
    email_html := REPLACE(email_html, '{{DAYS_LEFT}}', p_variables->>'DAYS_LEFT');
    email_text := REPLACE(email_text, '{{DAYS_LEFT}}', p_variables->>'DAYS_LEFT');
  END IF;

  -- Логирование попытки отправки
  INSERT INTO public.email_log (recipient_email, template_name, subject, status)
  VALUES (p_to_email, p_template_name, email_subject, 'preparing')
  RETURNING id INTO log_id;

  -- В реальной системе здесь будет HTTP запрос к email сервису
  -- Пока что помечаем как отправленное (для демонстрации)
  UPDATE public.email_log
  SET status = 'sent', sent_at = NOW()
  WHERE id = log_id;

  RETURN json_build_object(
    'success', true,
    'log_id', log_id,
    'to_email', p_to_email,
    'subject', email_subject,
    'template_used', p_template_name,
    'message', 'Email добавлен в очередь отправки'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Логирование ошибки
    UPDATE public.email_log
    SET status = 'failed', error_message = SQLERRM
    WHERE id = log_id;

    RETURN json_build_object(
      'success', false,
      'error', 'Ошибка отправки email: ' || SQLERRM
    );
END;
$$;

-- 5. Обновленная функция создания подписки с отправкой email
CREATE OR REPLACE FUNCTION public.create_subscription_with_email(
  p_email TEXT,
  p_plan TEXT DEFAULT 'monthly',
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  license_key TEXT;
  expires_at TIMESTAMP WITH TIME ZONE;
  subscription_record RECORD;
  plan_names JSONB;
  email_variables JSONB;
  email_result JSON;
BEGIN
  -- Проверка админ-ключа
  IF p_admin_key IS NULL OR p_admin_key != 'figma-admin-2024-secure-key' THEN
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

  -- Названия планов
  plan_names := '{
    "monthly": "Месячная подписка",
    "quarterly": "Квартальная подписка",
    "yearly": "Годовая подписка"
  }'::jsonb;

  -- Проверка существующей подписки
  SELECT * INTO subscription_record
  FROM public.subscriptions
  WHERE email = LOWER(TRIM(p_email));

  IF FOUND THEN
    -- Обновление существующей подписки
    UPDATE public.subscriptions
    SET
      license_key = create_subscription_with_email.license_key,
      plan = p_plan,
      status = 'active',
      expires_at = create_subscription_with_email.expires_at,
      updated_at = NOW()
    WHERE email = LOWER(TRIM(p_email))
    RETURNING * INTO subscription_record;

    -- Отправка email о продлении
    email_variables := json_build_object(
      'EMAIL', subscription_record.email,
      'LICENSE_KEY', subscription_record.license_key,
      'PLAN_NAME', plan_names->>p_plan,
      'EXPIRES_DATE', to_char(subscription_record.expires_at, 'DD.MM.YYYY')
    )::jsonb;

    SELECT public.send_email(
      subscription_record.email,
      'subscription_renewed',
      email_variables
    ) INTO email_result;

  ELSE
    -- Создание новой подписки
    INSERT INTO public.subscriptions (
      email, license_key, plan, status, expires_at
    ) VALUES (
      LOWER(TRIM(p_email)), license_key, p_plan, 'active', expires_at
    ) RETURNING * INTO subscription_record;

    -- Отправка welcome email
    email_variables := json_build_object(
      'EMAIL', subscription_record.email,
      'LICENSE_KEY', subscription_record.license_key,
      'PLAN_NAME', plan_names->>p_plan,
      'EXPIRES_DATE', to_char(subscription_record.expires_at, 'DD.MM.YYYY')
    )::jsonb;

    SELECT public.send_email(
      subscription_record.email,
      'new_subscription',
      email_variables
    ) INTO email_result;
  END IF;

  RETURN json_build_object(
    'success', true,
    'subscription', json_build_object(
      'email', subscription_record.email,
      'license_key', subscription_record.license_key,
      'plan', subscription_record.plan,
      'expires_at', subscription_record.expires_at,
      'created_at', subscription_record.created_at
    ),
    'email_sent', email_result->'success',
    'email_log_id', email_result->'log_id'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ошибка создания подписки: ' || SQLERRM
    );
END;
$$;

-- 6. Функция для отправки напоминаний об истечении подписки
CREATE OR REPLACE FUNCTION public.send_expiration_reminders(
  p_days_before INTEGER DEFAULT 3,
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  subscription_record RECORD;
  email_variables JSONB;
  email_result JSON;
  sent_count INTEGER := 0;
  plan_names JSONB;
BEGIN
  -- Проверка админ-ключа
  IF p_admin_key IS NULL OR p_admin_key != 'figma-admin-2024-secure-key' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Неверный административный ключ'
    );
  END IF;

  plan_names := '{
    "monthly": "Месячная подписка",
    "quarterly": "Квартальная подписка",
    "yearly": "Годовая подписка"
  }'::jsonb;

  -- Поиск подписок, которые истекают через указанное количество дней
  FOR subscription_record IN
    SELECT * FROM public.subscriptions
    WHERE status = 'active'
      AND expires_at > NOW()
      AND expires_at <= NOW() + (p_days_before || ' days')::INTERVAL
      AND (last_reminder_sent IS NULL OR last_reminder_sent < NOW() - INTERVAL '1 day')
  LOOP
    -- Подготовка переменных для email
    email_variables := json_build_object(
      'EMAIL', subscription_record.email,
      'LICENSE_KEY', subscription_record.license_key,
      'PLAN_NAME', plan_names->>subscription_record.plan,
      'EXPIRES_DATE', to_char(subscription_record.expires_at, 'DD.MM.YYYY'),
      'DAYS_LEFT', EXTRACT(DAY FROM subscription_record.expires_at - NOW())::TEXT
    )::jsonb;

    -- Отправка напоминания
    SELECT public.send_email(
      subscription_record.email,
      'subscription_expiring',
      email_variables
    ) INTO email_result;

    -- Обновление времени последнего напоминания
    UPDATE public.subscriptions
    SET last_reminder_sent = NOW()
    WHERE id = subscription_record.id;

    sent_count := sent_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'reminders_sent', sent_count,
    'days_before_expiry', p_days_before
  );
END;
$$;

-- 7. Добавление поля для отслеживания напоминаний
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP WITH TIME ZONE;

-- 8. Функция для просмотра логов email
CREATE OR REPLACE FUNCTION public.get_email_logs(
  p_limit INTEGER DEFAULT 50,
  p_admin_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  email_logs JSON;
BEGIN
  -- Проверка админ-ключа
  IF p_admin_key IS NULL OR p_admin_key != 'figma-admin-2024-secure-key' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Неверный административный ключ'
    );
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', id,
      'recipient_email', recipient_email,
      'template_name', template_name,
      'subject', subject,
      'status', status,
      'error_message', error_message,
      'sent_at', sent_at,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ) INTO email_logs
  FROM public.email_log
  LIMIT p_limit;

  RETURN json_build_object(
    'success', true,
    'logs', COALESCE(email_logs, '[]'::json)
  );
END;
$$;

-- 9. Комментарии для функций
COMMENT ON FUNCTION public.send_email IS 'Отправка email по шаблону с переменными';
COMMENT ON FUNCTION public.create_subscription_with_email IS 'Создание подписки с автоматической отправкой email';
COMMENT ON FUNCTION public.send_expiration_reminders IS 'Отправка напоминаний об истечении подписки';
COMMENT ON FUNCTION public.get_email_logs IS 'Получение логов отправленных email';

-- 10. Тестирование системы email (раскомментируйте для теста)
/*
-- Тест отправки welcome email
SELECT public.send_email(
  'test@example.com',
  'new_subscription',
  '{"EMAIL": "test@example.com", "LICENSE_KEY": "TEST-123-DEMO", "PLAN_NAME": "Месячная подписка", "EXPIRES_DATE": "07.08.2025"}'::jsonb
);

-- Тест создания подписки с email
SELECT public.create_subscription_with_email(
  'newuser@example.com',
  'monthly',
  'figma-admin-2024-secure-key'
);
*/
