#!/usr/bin/env node
// Скрипт для тестирования подключения к Supabase и деплоя функций

const https = require('https');
const fs = require('fs');

// ОБНОВИТЕ ЭТИ ДАННЫЕ С ВАШИМИ РЕАЛЬНЫМИ ЗНАЧЕНИЯМИ
const SUPABASE_CONFIG = {
  PROJECT_URL: 'https://your-project-id.supabase.co', // Замените на ваш URL
  ANON_KEY: 'your_anon_key_here', // Замените на ваш anon key
  SERVICE_ROLE_KEY: 'your_service_role_key_here' // Замените на ваш service role key
};

// Функция для выполнения HTTP запросов
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// 1. Тест базового подключения к Supabase
async function testBasicConnection() {
  console.log('🔗 Тестируем базовое подключение к Supabase...');

  try {
    const response = await makeRequest(SUPABASE_CONFIG.PROJECT_URL + '/rest/v1/', {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
      }
    });

    if (response.status === 200) {
      console.log('✅ Подключение к Supabase успешно!');
      return true;
    } else {
      console.log(`❌ Ошибка подключения: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Ошибка сети: ${error.message}`);
    return false;
  }
}

// 2. Проверка таблиц
async function checkTables() {
  console.log('📋 Проверяем таблицы базы данных...');

  try {
    // Проверяем таблицу subscriptions
    const response = await makeRequest(SUPABASE_CONFIG.PROJECT_URL + '/rest/v1/subscriptions?select=id&limit=1', {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      console.log('✅ Таблица subscriptions найдена');
      console.log(`📊 Данные: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      console.log(`❌ Таблица subscriptions не найдена: ${response.status}`);
      console.log(`📄 Ответ: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Ошибка проверки таблиц: ${error.message}`);
    return false;
  }
}

// 3. Тест Edge Function (если задеплоена)
async function testEdgeFunction() {
  console.log('⚡ Тестируем Edge Function verify-subscription...');

  try {
    const testData = {
      email: 'test@demo.com',
      license_key: 'TEST-123456-DEMO',
      device_fingerprint: 'test-device-123'
    };

    const response = await makeRequest(SUPABASE_CONFIG.PROJECT_URL + '/functions/v1/verify-subscription', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log(`📡 Статус ответа: ${response.status}`);
    console.log(`📄 Данные: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200 || response.status === 404) {
      console.log('✅ Edge Function доступна');
      return true;
    } else {
      console.log('⚠️ Edge Function может быть не задеплоена');
      return false;
    }
  } catch (error) {
    console.log(`❌ Ошибка тестирования Edge Function: ${error.message}`);
    return false;
  }
}

// 4. Создание тестовой подписки
async function createTestSubscription() {
  console.log('🔧 Создаем тестовую подписку...');

  try {
    const testSubscription = {
      email: 'test@demo.com',
      license_key: 'TEST-' + Date.now().toString().slice(-6) + '-DEMO',
      status: 'active',
      plan: 'monthly',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const response = await makeRequest(SUPABASE_CONFIG.PROJECT_URL + '/rest/v1/subscriptions', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_CONFIG.SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(testSubscription)
    });

    if (response.status === 201) {
      console.log('✅ Тестовая подписка создана!');
      console.log(`📧 Email: ${testSubscription.email}`);
      console.log(`🔑 Ключ: ${testSubscription.license_key}`);
      console.log(`📄 Данные: ${JSON.stringify(response.data, null, 2)}`);
      return testSubscription;
    } else {
      console.log(`❌ Ошибка создания подписки: ${response.status}`);
      console.log(`📄 Ответ: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Ошибка создания тестовой подписки: ${error.message}`);
    return null;
  }
}

// 5. Деплой Edge Functions (альтернативный способ)
function generateEdgeFunctionSQL() {
  console.log('📝 Генерируем SQL для создания Edge Functions...');

  const sql = `
-- Создание Edge Function для верификации подписки
-- Выполните этот SQL в редакторе Supabase

-- 1. Включить расширения
CREATE EXTENSION IF NOT EXISTS "http" SCHEMA extensions;

-- 2. Создать функцию проверки подписки (альтернатива Edge Function)
CREATE OR REPLACE FUNCTION verify_subscription(
  p_email TEXT,
  p_license_key TEXT,
  p_device_fingerprint TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
  result JSON;
BEGIN
  -- Поиск подписки
  SELECT * INTO subscription_record
  FROM subscriptions
  WHERE email = LOWER(p_email)
    AND license_key = p_license_key;

  -- Проверка существования
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Подписка не найдена'
    );
  END IF;

  -- Проверка срока действия
  IF subscription_record.expires_at < NOW() THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Подписка истекла',
      'expired', true
    );
  END IF;

  -- Проверка статуса
  IF subscription_record.status != 'active' THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Подписка неактивна'
    );
  END IF;

  -- Проверка устройства
  IF subscription_record.device_fingerprint IS NOT NULL
     AND subscription_record.device_fingerprint != p_device_fingerprint THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Лицензия привязана к другому устройству'
    );
  END IF;

  -- Обновление fingerprint если не установлен
  IF subscription_record.device_fingerprint IS NULL THEN
    UPDATE subscriptions
    SET device_fingerprint = p_device_fingerprint,
        last_checked = NOW()
    WHERE id = subscription_record.id;
  ELSE
    UPDATE subscriptions
    SET last_checked = NOW()
    WHERE id = subscription_record.id;
  END IF;

  -- Успешный результат
  RETURN json_build_object(
    'valid', true,
    'expires', subscription_record.expires_at,
    'plan', subscription_record.plan,
    'status', subscription_record.status
  );
END;
$$;

-- 3. Настройка RLS
ALTER FUNCTION verify_subscription OWNER TO supabase_admin;
GRANT EXECUTE ON FUNCTION verify_subscription TO anon, authenticated;
`;

  fs.writeFileSync('supabase-functions.sql', sql);
  console.log('✅ SQL файл создан: supabase-functions.sql');
  console.log('📋 Выполните этот SQL в редакторе Supabase для альтернативного API');
}

// Главная функция тестирования
async function main() {
  console.log('🧪 Тестирование системы подписки Figma Plugin\n');

  // Проверяем конфигурацию
  if (SUPABASE_CONFIG.PROJECT_URL.includes('your-project-id')) {
    console.log('❌ ОШИБКА: Обновите SUPABASE_CONFIG с вашими реальными данными!');
    console.log('📝 Откройте файл test-supabase-connection.js и замените:');
    console.log('   - PROJECT_URL: ваш Supabase URL');
    console.log('   - ANON_KEY: ваш anon public key');
    console.log('   - SERVICE_ROLE_KEY: ваш service role key\n');
    return;
  }

  console.log(`🔧 Конфигурация:`);
  console.log(`   URL: ${SUPABASE_CONFIG.PROJECT_URL}`);
  console.log(`   Key: ${SUPABASE_CONFIG.ANON_KEY.substring(0, 20)}...\n`);

  // Выполняем тесты
  const basicConnection = await testBasicConnection();
  console.log('');

  if (basicConnection) {
    const tablesExist = await checkTables();
    console.log('');

    if (tablesExist) {
      const testSub = await createTestSubscription();
      console.log('');

      await testEdgeFunction();
      console.log('');

      if (testSub) {
        console.log('🎉 Система готова к работе!');
        console.log(`📧 Используйте для тестирования: ${testSub.email}`);
        console.log(`🔑 Лицензионный ключ: ${testSub.license_key}`);
      }
    } else {
      console.log('📋 Выполните SQL из файла supabase-setup.md для создания таблиц');
    }
  }

  // Генерируем альтернативный SQL
  generateEdgeFunctionSQL();

  console.log('\n✅ Тестирование завершено!');
}

// Запуск
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testBasicConnection, checkTables, createTestSubscription };
