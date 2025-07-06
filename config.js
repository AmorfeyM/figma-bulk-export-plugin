// ⚠️ ВАЖНО: Замените эти данные на ваши реальные из Supabase Dashboard
// Settings → API → Project URL и API Keys

const PLUGIN_CONFIG = {
  // Supabase настройки - ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ
  SUPABASE: {
    URL: 'https://your-project-id.supabase.co', // Замените на ваш Project URL
    ANON_KEY: 'your_anon_key_here', // Замените на ваш anon public key
    SERVICE_ROLE_KEY: 'your_service_role_key_here' // Замените на ваш service role key
  },

  // API Endpoints
  API: {
    VERIFY_SUBSCRIPTION: '/functions/v1/verify-subscription',
    // YooKassa временно отключена
    YOOKASSA_WEBHOOK: '/functions/v1/yookassa-webhook',
    CREATE_PAYMENT: '/functions/v1/create-payment'
  },

  // YooKassa настройки (ЗАГЛУШКА)
  YOOKASSA: {
    ENABLED: false, // Отключаем YooKassa пока
    SHOP_ID: 'demo_shop_id',
    SECRET_KEY: 'demo_secret_key'
  },

  // Настройки плагина
  PLUGIN: {
    VERSION: '2.1.0',
    NAME: 'Figma Bulk Export by Sections',
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 дней
    DEMO_MODE: false // Отключаем демо-режим для продакшн
  },

  // Планы подписки
  PLANS: {
    monthly: { name: 'Месячная подписка', duration: 30, price: 500, currency: 'RUB' },
    quarterly: { name: 'Квартальная подписка', duration: 90, price: 1200, currency: 'RUB' },
    yearly: { name: 'Годовая подписка', duration: 365, price: 4000, currency: 'RUB' }
  },

  // Сообщения для пользователей
  MESSAGES: {
    SUBSCRIPTION_REQUIRED: 'Для использования плагина необходима активная подписка',
    SUBSCRIPTION_EXPIRED: 'Ваша подписка истекла. Продлите подписку для продолжения работы',
    DEVICE_ALREADY_USED: 'Лицензия уже активирована на другом устройстве',
    NETWORK_ERROR: 'Ошибка сети. Плагин работает в офлайн режиме',
    INVALID_LICENSE: 'Неверный лицензионный ключ или email',
    SUCCESS_ACTIVATION: 'Подписка успешно активирована!',
    YOOKASSA_DISABLED: 'Покупка подписки временно недоступна. Обратитесь к администратору.'
  },

  // Админ-панель
  ADMIN: {
    ACCESS_KEY: 'admin-change-this-key-123', // ИЗМЕНИТЕ НА СЛОЖНЫЙ КЛЮЧ
    ALLOWED_EMAILS: ['admin@yourcompany.com'] // ДОБАВЬТЕ СВОЮ ПОЧТУ
  }
};

// Функция для получения полного URL API
function getApiUrl(endpoint) {
  return PLUGIN_CONFIG.SUPABASE.URL + PLUGIN_CONFIG.API[endpoint];
}

// Функция для получения заголовков аутентификации
function getAuthHeaders(useServiceRole = false) {
  const key = useServiceRole ?
    PLUGIN_CONFIG.SUPABASE.SERVICE_ROLE_KEY :
    PLUGIN_CONFIG.SUPABASE.ANON_KEY;

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    'apikey': key
  };
}

// Функция проверки конфигурации
function isConfigured() {
  const hasValidUrl = PLUGIN_CONFIG.SUPABASE.URL &&
                      !PLUGIN_CONFIG.SUPABASE.URL.includes('your-project-id') &&
                      PLUGIN_CONFIG.SUPABASE.URL.includes('.supabase.co');

  const hasValidAnonKey = PLUGIN_CONFIG.SUPABASE.ANON_KEY &&
                          !PLUGIN_CONFIG.SUPABASE.ANON_KEY.includes('your_anon_key') &&
                          PLUGIN_CONFIG.SUPABASE.ANON_KEY.startsWith('eyJ') &&
                          PLUGIN_CONFIG.SUPABASE.ANON_KEY.length > 100;

  const hasValidServiceKey = PLUGIN_CONFIG.SUPABASE.SERVICE_ROLE_KEY &&
                             !PLUGIN_CONFIG.SUPABASE.SERVICE_ROLE_KEY.includes('your_service_role') &&
                             PLUGIN_CONFIG.SUPABASE.SERVICE_ROLE_KEY.startsWith('eyJ') &&
                             PLUGIN_CONFIG.SUPABASE.SERVICE_ROLE_KEY.length > 100;

  return {
    isValid: hasValidUrl && hasValidAnonKey && hasValidServiceKey,
    details: {
      supabaseUrl: hasValidUrl,
      anonKey: hasValidAnonKey,
      serviceKey: hasValidServiceKey,
      yookassaEnabled: PLUGIN_CONFIG.YOOKASSA.ENABLED
    }
  };
}

// Функция тестирования подключения
async function testSupabaseConnection() {
  try {
    const response = await fetch(PLUGIN_CONFIG.SUPABASE.URL + '/rest/v1/', {
      method: 'HEAD',
      headers: getAuthHeaders()
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLUGIN_CONFIG,
    getApiUrl,
    getAuthHeaders,
    isConfigured,
    testSupabaseConnection
  };
}

// Глобальные переменные для браузера
if (typeof window !== 'undefined') {
  window.PLUGIN_CONFIG = PLUGIN_CONFIG;
  window.getApiUrl = getApiUrl;
  window.getAuthHeaders = getAuthHeaders;
  window.isConfigured = isConfigured;
  window.testSupabaseConnection = testSupabaseConnection;
}
