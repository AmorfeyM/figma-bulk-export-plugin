# Настройка Backend для системы подписки

## 1. Создание проекта Supabase

### Регистрация и создание проекта

1. **Перейдите на** https://supabase.com
2. **Зарегистрируйтесь** или войдите в аккаунт
3. **Создайте новый проект**:
   - Название: `figma-plugin-subscriptions`
   - Пароль базы данных: `your_secure_password_here`
   - Регион: `Frankfurt (eu-central-1)` (ближайший к России)

### Получение учетных данных

После создания проекта:

1. **Перейдите в** `Settings` → `API`
2. **Скопируйте**:
   - `Project URL`: `https://your-project.supabase.co`
   - `anon public key`: для frontend
   - `service_role secret`: для backend

## 2. Настройка базы данных

### Создание таблиц

Выполните SQL в редакторе Supabase:

```sql
-- Таблица подписок
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  license_key VARCHAR(255) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  plan VARCHAR(50) DEFAULT 'monthly',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_id VARCHAR(255),
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица платежей
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  payment_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(50) DEFAULT 'pending',
  provider VARCHAR(50) DEFAULT 'yookassa',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Индексы для производительности
CREATE INDEX idx_subscriptions_email ON subscriptions(email);
CREATE INDEX idx_subscriptions_license_key ON subscriptions(license_key);
CREATE INDEX idx_subscriptions_device ON subscriptions(device_fingerprint);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);
CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_payments_status ON payments(status);

-- RLS (Row Level Security)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Политики RLS для безопасности
CREATE POLICY "Public read access" ON subscriptions
  FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read payments" ON payments
  FOR SELECT USING (true);

CREATE POLICY "Service role payments access" ON payments
  FOR ALL USING (auth.role() = 'service_role');
```

### Добавление тестовых данных

```sql
-- Добавление тестовой подписки
INSERT INTO subscriptions (
  email,
  license_key,
  device_fingerprint,
  status,
  expires_at
) VALUES (
  'test@example.com',
  'TEST-FIGMA-2024-KEY1',
  'test-device-123',
  'active',
  NOW() + INTERVAL '30 days'
);
```

## 3. Создание Edge Functions

### Функция верификации подписки

Создайте файл `supabase/functions/verify-subscription/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Обработка CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, license_key, device_fingerprint, plugin_version } = await req.json()

    if (!email || !license_key) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Email и лицензионный ключ обязательны' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Поиск подписки
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('license_key', license_key)
      .single()

    if (error || !subscription) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Подписка не найдена' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Проверка срока действия
    const now = new Date()
    const expiresAt = new Date(subscription.expires_at)

    if (expiresAt < now) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Подписка истекла' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Проверка устройства (одна лицензия = одно устройство)
    if (subscription.device_fingerprint &&
        subscription.device_fingerprint !== device_fingerprint) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Лицензия привязана к другому устройству' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Обновление fingerprint и last_checked
    if (!subscription.device_fingerprint) {
      await supabase
        .from('subscriptions')
        .update({
          device_fingerprint: device_fingerprint,
          last_checked: new Date().toISOString()
        })
        .eq('id', subscription.id)
    } else {
      await supabase
        .from('subscriptions')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', subscription.id)
    }

    return new Response(
      JSON.stringify({
        valid: true,
        expires: subscription.expires_at,
        plan: subscription.plan,
        status: subscription.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Ошибка сервера' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
```

### Деплой функций

```bash
# Установка Supabase CLI
npm install -g supabase

# Логин
supabase login

# Инициализация проекта
supabase init

# Связывание с проектом
supabase link --project-ref your-project-ref

# Деплой функций
supabase functions deploy verify-subscription
```

## 4. Настройка YooKassa

### Регистрация в YooKassa

1. **Перейдите на** https://yookassa.ru/developers/
2. **Зарегистрируйтесь** как юридическое лицо или ИП
3. **Подтвердите данные** (может занять 1-3 дня)
4. **Получите доступ** к API

### Получение ключей

В личном кабинете YooKassa:

1. **Перейдите в** `Настройки` → `API`
2. **Скопируйте**:
   - `shopId`: ваш ID магазина
   - `Secret Key`: секретный ключ

### Создание webhook

1. **Настройте webhook** для получения уведомлений о платежах
2. **URL**: `https://your-project.supabase.co/functions/v1/yookassa-webhook`
3. **События**: `payment.succeeded`, `payment.canceled`

### Функция webhook для YooKassa

Создайте `supabase/functions/yookassa-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const { type, object: payment } = payload

    if (type === 'payment.succeeded') {
      const { id: paymentId, amount, metadata } = payment
      const { email, plan = 'monthly' } = metadata

      // Создание или обновление подписки
      const expiresAt = new Date()
      if (plan === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      } else if (plan === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      }

      // Генерация лицензионного ключа
      const licenseKey = `FIGMA-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`

      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          email: email.toLowerCase(),
          license_key: licenseKey,
          status: 'active',
          plan: plan,
          expires_at: expiresAt.toISOString(),
          payment_id: paymentId
        })

      if (!error) {
        // Сохранение платежа
        await supabase
          .from('payments')
          .insert({
            payment_id: paymentId,
            amount: amount.value,
            currency: amount.currency,
            status: 'succeeded',
            metadata: metadata
          })

        // Здесь можно добавить отправку email с лицензионным ключом
        console.log(`Подписка создана для ${email}, ключ: ${licenseKey}`)
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 500 })
  }
})
```

## 5. Настройка переменных окружения

В Supabase `Settings` → `Edge Functions` → `Environment Variables`:

```
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 6. Создание админ-панели

### Простая админ-панель для управления подписками

Создайте `admin-panel.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Админ-панель подписок</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .expired { background-color: #ffebee; }
        .active { background-color: #e8f5e8; }
        .form-group { margin: 10px 0; }
        input, select { padding: 5px; margin: 5px; }
        button { padding: 10px 15px; background: #007cba; color: white; border: none; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Админ-панель подписок Figma Plugin</h1>

    <div id="auth-section">
        <h2>Авторизация</h2>
        <div class="form-group">
            <input type="password" id="admin-key" placeholder="Админ-ключ">
            <button onclick="authenticate()">Войти</button>
        </div>
    </div>

    <div id="admin-panel" style="display: none;">
        <h2>Создать подписку вручную</h2>
        <div class="form-group">
            <input type="email" id="new-email" placeholder="Email">
            <select id="new-plan">
                <option value="monthly">Месячная</option>
                <option value="yearly">Годовая</option>
            </select>
            <button onclick="createSubscription()">Создать</button>
        </div>

        <h2>Список подписок</h2>
        <button onclick="loadSubscriptions()">Обновить</button>
        <table id="subscriptions-table">
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Лицензионный ключ</th>
                    <th>План</th>
                    <th>Статус</th>
                    <th>Истекает</th>
                    <th>Устройство</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody id="subscriptions-list"></tbody>
        </table>
    </div>

    <script>
        const SUPABASE_URL = 'https://your-project.supabase.co'
        const SUPABASE_ANON_KEY = 'your_anon_key'

        let supabase = null

        function authenticate() {
            const key = document.getElementById('admin-key').value
            if (key === 'admin123') { // Замените на реальный ключ
                document.getElementById('auth-section').style.display = 'none'
                document.getElementById('admin-panel').style.display = 'block'

                supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
                loadSubscriptions()
            } else {
                alert('Неверный ключ')
            }
        }

        async function loadSubscriptions() {
            if (!supabase) return

            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error:', error)
                return
            }

            const tbody = document.getElementById('subscriptions-list')
            tbody.innerHTML = ''

            data.forEach(sub => {
                const row = document.createElement('tr')
                const isExpired = new Date(sub.expires_at) < new Date()
                row.className = isExpired ? 'expired' : 'active'

                row.innerHTML = `
                    <td>${sub.email}</td>
                    <td>${sub.license_key}</td>
                    <td>${sub.plan}</td>
                    <td>${sub.status}</td>
                    <td>${new Date(sub.expires_at).toLocaleDateString()}</td>
                    <td>${sub.device_fingerprint || 'Не привязано'}</td>
                    <td>
                        <button onclick="extendSubscription('${sub.id}')">Продлить</button>
                        <button onclick="deactivateSubscription('${sub.id}')">Деактивировать</button>
                    </td>
                `
                tbody.appendChild(row)
            })
        }

        async function createSubscription() {
            const email = document.getElementById('new-email').value
            const plan = document.getElementById('new-plan').value

            if (!email) {
                alert('Введите email')
                return
            }

            const expiresAt = new Date()
            if (plan === 'monthly') {
                expiresAt.setMonth(expiresAt.getMonth() + 1)
            } else {
                expiresAt.setFullYear(expiresAt.getFullYear() + 1)
            }

            const licenseKey = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`

            const { error } = await supabase
                .from('subscriptions')
                .insert({
                    email: email.toLowerCase(),
                    license_key: licenseKey,
                    plan: plan,
                    status: 'active',
                    expires_at: expiresAt.toISOString()
                })

            if (error) {
                alert('Ошибка: ' + error.message)
            } else {
                alert(`Подписка создана!\nEmail: ${email}\nКлюч: ${licenseKey}`)
                loadSubscriptions()
                document.getElementById('new-email').value = ''
            }
        }

        async function extendSubscription(id) {
            const newDate = new Date()
            newDate.setMonth(newDate.getMonth() + 1)

            const { error } = await supabase
                .from('subscriptions')
                .update({ expires_at: newDate.toISOString() })
                .eq('id', id)

            if (error) {
                alert('Ошибка: ' + error.message)
            } else {
                alert('Подписка продлена на месяц')
                loadSubscriptions()
            }
        }

        async function deactivateSubscription(id) {
            if (!confirm('Деактивировать подписку?')) return

            const { error } = await supabase
                .from('subscriptions')
                .update({ status: 'inactive' })
                .eq('id', id)

            if (error) {
                alert('Ошибка: ' + error.message)
            } else {
                alert('Подписка деактивирована')
                loadSubscriptions()
            }
        }
    </script>
</body>
</html>
```

## 7. Тестирование

### Проверка базы данных

```sql
-- Проверка созданных таблиц
SELECT * FROM subscriptions;
SELECT * FROM payments;

-- Создание тестовой подписки
INSERT INTO subscriptions (email, license_key, expires_at)
VALUES ('test@example.com', 'TEST-KEY-123', NOW() + INTERVAL '30 days');
```

### Тестирование API

```bash
# Тест верификации
curl -X POST https://your-project.supabase.co/functions/v1/verify-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "license_key": "TEST-KEY-123",
    "device_fingerprint": "test-device"
  }'
```

## 8. Деплой и мониторинг

### Мониторинг функций

В Supabase Dashboard → Edge Functions → Logs

### Мониторинг базы данных

```sql
-- Статистика подписок
SELECT
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_count
FROM subscriptions
GROUP BY status;

-- Платежи за последний месяц
SELECT
  DATE(created_at) as date,
  COUNT(*) as payments,
  SUM(amount) as revenue
FROM payments
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

## 9. Безопасность

### Рекомендации

1. **Используйте HTTPS** для всех соединений
2. **Ограничьте RLS политики** для защиты данных
3. **Регулярно меняйте** API ключи
4. **Мониторьте** подозрительную активность
5. **Делайте backup** базы данных

### Переменные окружения

Никогда не храните секретные ключи в коде!

## 10. Стоимость

### Supabase

- Free tier: до 50,000 запросов в месяц
- Pro: $25/месяц за проект

### YooKassa

- Комиссия: 2.8% + фиксированная плата
- Без абонентской платы

### Итого

Для 100 пользователей в месяц: ~$50-100/месяц
