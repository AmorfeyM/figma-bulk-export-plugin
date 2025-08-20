# 🚀 Деплой системы подписки Figma Plugin

## Пошаговая инструкция по запуску

### 1. Подготовка проекта

```bash
# Клонирование репозитория
git clone https://github.com/AmorfeyM/figma-bulk-export-plugin.git
cd figma-bulk-export-plugin

# Переключение на ветку с подпиской
git checkout feature/subscription-system
```

### 2. Настройка Supabase

#### 2.1. Создание проекта
1. Зайдите на https://supabase.com
2. Создайте новый проект:
   - **Название**: `figma-plugin-subscriptions`
   - **Пароль БД**: создайте сложный пароль и сохраните его
   - **Регион**: `Frankfurt (eu-central-1)` (ближайший к России)

#### 2.2. Получение ключей
В настройках проекта (`Settings` → `API`):
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role secret**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 2.3. Создание базы данных
Выполните SQL из файла `supabase-setup.md` в редакторе Supabase:

```sql
-- Копируйте и выполняйте код из supabase-setup.md раздел "Создание таблиц"
```

### 3. Настройка Edge Functions

#### 3.1. Установка Supabase CLI
```bash
npm install -g supabase
```

#### 3.2. Авторизация и связывание
```bash
# Авторизация
supabase login

# Инициализация проекта
supabase init

# Связывание с проектом (Project Reference из Settings)
supabase link --project-ref your-project-reference-id
```

#### 3.3. Деплой функций
```bash
# Деплой всех функций
supabase functions deploy verify-subscription
supabase functions deploy yookassa-webhook
supabase functions deploy create-payment
```

#### 3.4. Настройка переменных окружения
В Supabase Dashboard → `Edge Functions` → `Environment Variables`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
```

### 4. Настройка YooKassa

#### 4.1. Регистрация
1. Зайдите на https://yookassa.ru/developers/
2. Зарегистрируйтесь как ИП или ООО
3. Пройдите верификацию (1-3 рабочих дня)
4. Активируйте API

#### 4.2. Получение ключей
В личном кабинете YooKassa:
- **shopId**: ID вашего магазина
- **Secret Key**: секретный ключ для API

#### 4.3. Настройка webhook
1. Перейдите в `Настройки` → `Уведомления`
2. Добавьте webhook URL: `https://your-project.supabase.co/functions/v1/yookassa-webhook`
3. Выберите события:
   - `payment.succeeded`
   - `payment.canceled`
   - `refund.succeeded`

### 5. Настройка конфигурации плагина

#### 5.1. Обновление config.js
Отредактируйте файл `config.js`:

```javascript
const PLUGIN_CONFIG = {
  SUPABASE: {
    URL: 'https://your-actual-project.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_real_anon_key',
  },
  YOOKASSA: {
    SHOP_ID: '12345678', // Ваш реальный Shop ID
    SECRET_KEY: 'live_your_real_secret_key'
  },
  ADMIN: {
    ACCESS_KEY: 'your-secure-admin-key-2024'
  }
};
```

#### 5.2. Обновление code-simple.js
Замените значения в константах:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://your-actual-project.supabase.co',
  SUPABASE_ANON_KEY: 'your_real_anon_key',
  PLUGIN_VERSION: '2.1.0'
};
```

### 6. Тестирование системы

#### 6.1. Создание тестовой подписки
Выполните в SQL редакторе Supabase:

```sql
INSERT INTO subscriptions (
  email,
  license_key,
  status,
  plan,
  expires_at
) VALUES (
  'test@yourcompany.com',
  'TEST-FIGMA-2024-DEMO',
  'active',
  'monthly',
  NOW() + INTERVAL '30 days'
);
```

#### 6.2. Тестирование API
```bash
# Тест верификации подписки
curl -X POST https://your-project.supabase.co/functions/v1/verify-subscription \
  -H "Content-Type: application/json" \
  -H "apikey: your_anon_key" \
  -d '{
    "email": "test@yourcompany.com",
    "license_key": "TEST-FIGMA-2024-DEMO",
    "device_fingerprint": "test-device-123"
  }'
```

#### 6.3. Тестирование создания платежа
```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-payment \
  -H "Content-Type: application/json" \
  -H "apikey: your_anon_key" \
  -d '{
    "email": "test@yourcompany.com",
    "plan": "monthly"
  }'
```

### 7. Настройка админ-панели

#### 7.1. Размещение админ-панели
1. Загрузите `admin-panel.html` на ваш веб-сервер
2. Обновите конфигурацию в файле:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your_anon_key',
  ADMIN_KEY: 'your-secure-admin-key-2024'
}
```

#### 7.2. Доступ к админ-панели
- URL: `https://yoursite.com/admin-panel.html`
- Ключ доступа: значение из `CONFIG.ADMIN.ACCESS_KEY`

### 8. Сборка и публикация плагина

#### 8.1. Финальная проверка
1. Убедитесь, что все API endpoints работают
2. Протестируйте создание платежа и webhook
3. Проверьте офлайн режим плагина

#### 8.2. Упаковка для Figma
```bash
# Создание архива для публикации
zip -r figma-bulk-export-plugin.zip \
  manifest.json \
  code-simple.js \
  ui-final.html \
  README.md
```

#### 8.3. Публикация в Figma Community
1. Откройте Figma Desktop
2. `Plugins` → `Development` → `Import plugin from manifest`
3. Выберите `manifest.json`
4. Протестируйте плагин
5. `Plugins` → `Publishing` → `Publish plugin`

### 9. Мониторинг и поддержка

#### 9.1. Логи и мониторинг
- **Supabase**: Dashboard → Edge Functions → Logs
- **YooKassa**: Личный кабинет → Уведомления → История
- **Ошибки**: Supabase Dashboard → Logs

#### 9.2. Регулярные задачи
```sql
-- Статистика подписок (выполнять еженедельно)
SELECT
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active
FROM subscriptions
GROUP BY status;

-- Очистка старых платежей (выполнять ежемесячно)
DELETE FROM payments
WHERE created_at < NOW() - INTERVAL '6 months'
AND status = 'canceled';
```

### 10. Безопасность

#### 10.1. Рекомендации
- Регулярно меняйте API ключи
- Используйте HTTPS для всех соединений
- Ограничьте доступ к админ-панели по IP
- Делайте резервные копии базы данных

#### 10.2. Резервное копирование
```bash
# Еженедельное резервное копирование через Supabase CLI
supabase db dump --local > backup-$(date +%Y%m%d).sql
```

### 11. Устранение неполадок

#### 11.1. Частые проблемы
1. **CORS ошибки**: Проверьте заголовки в Edge Functions
2. **Webhook не работает**: Проверьте URL и SSL сертификат
3. **Платежи не создаются**: Проверьте YooKassa ключи
4. **Подписка не активируется**: Проверьте логи webhook

#### 11.2. Отладка
```javascript
// Включение режима отладки в плагине
console.log('Debug mode enabled');
// Проверить в Figma → Developer Tools → Console
```

### 12. Стоимость и масштабирование

#### 12.1. Ожидаемые расходы (100 пользователей/месяц)
- **Supabase Pro**: $25/месяц
- **YooKassa комиссия**: ~2.8% от оборота
- **Хостинг админ-панели**: $5-10/месяц
- **Итого**: $50-100/месяц

#### 12.2. Масштабирование
- До 1000 пользователей: текущая архитектура
- 1000+ пользователей: рассмотрите Supabase Enterprise
- 10000+ пользователей: кастомное решение на AWS/GCP

---

## ✅ Чеклист деплоя

- [ ] Создан проект Supabase
- [ ] Настроена база данных
- [ ] Задеплоены Edge Functions
- [ ] Настроены переменные окружения
- [ ] Зарегистрирован аккаунт YooKassa
- [ ] Настроен webhook YooKassa
- [ ] Обновлена конфигурация плагина
- [ ] Протестированы все API endpoints
- [ ] Размещена админ-панель
- [ ] Создана тестовая подписка
- [ ] Протестирован полный цикл покупки
- [ ] Настроен мониторинг
- [ ] Созданы резервные копии

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в Supabase Dashboard
2. Проверьте статус платежей в YooKassa
3. Убедитесь в корректности всех ключей API
4. Обратитесь к документации Supabase и YooKassa

### Новые шаги развертывания:

1. Выполните SQL миграцию `2025_add_subscriptions_and_logs.sql`.
2. Настройте Stripe webhook:
   - Установите endpoint: `/api/stripe/webhook`
   - При `checkout.session.completed` → вызывайте `activate_subscription(user_id, plan, 30)`
3. Добавьте переменные окружения:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
4. Убедитесь, что админ-панель развернута с HTTPS и включенными CSP заголовками.
