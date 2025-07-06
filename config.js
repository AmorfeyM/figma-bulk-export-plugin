// Конфигурация Figma Plugin для системы подписки
// Замените значения на реальные данные вашего Supabase проекта

const PLUGIN_CONFIG = {
  // Supabase настройки - ОБНОВИТЕ ДАННЫМИ ИЗ ВАШЕГО ПРОЕКТА
  SUPABASE: {
    URL: 'https://your-project-id.supabase.co', // Замените на ваш Project URL
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key_here', // Замените на ваш anon key
    SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_service_role_key_here' // Для backend
  },

  // API Endpoints
  API: {
    VERIFY_SUBSCRIPTION: '/functions/v1/verify-subscription',
    // YooKassa временно отключена
    YOOKASSA_WEBHOOK: '/functions/v1/yookassa-webhook', // ЗАГЛУШКА
    CREATE_PAYMENT: '/functions/v1/create-payment' // ЗАГЛУШКА
  },

  // YooKassa настройки (ЗАГЛУШКА - пока не используется)
  YOOKASSA: {
    ENABLED: false, // Отключаем YooKassa
    SHOP_ID: 'demo_shop_id',
    SECRET_KEY: 'demo_secret_key',
    WEBHOOK_URL: 'https://your-project.supabase.co/functions/v1/yookassa-webhook'
  },

  // Настройки плагина
  PLUGIN: {
    VERSION: '2.1.0',
    NAME: 'Figma Bulk Export by Sections',
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 дней в миллисекундах
    DEMO_MODE: true // Включаем демо-режим пока нет YooKassa
  },

  // Планы подписки
  PLANS: {
    monthly: {
      name: 'Месячная подписка',
      duration: 30,
      price: 500,
      currency: 'RUB'
    },
    quarterly: {
      name: 'Квартальная подписка',
      duration: 90,
      price: 1200,
      currency: 'RUB'
    },
    yearly: {
      name: 'Годовая подписка',
      duration: 365,
      price: 4000,
      currency: 'RUB'
    }
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
    ACCESS_KEY: 'admin-demo-key-change-this', // ИЗМЕНИТЕ НА СВОЙ КЛЮЧ
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

// ИСПРАВЛЕННАЯ функция проверки конфигурации
function isConfigured() {
  // Проверяем, что URL не содержит заглушки
  const hasValidUrl = PLUGIN_CONFIG.SUPABASE.URL &&
                      !PLUGIN_CONFIG.SUPABASE.URL.includes('your-project-id') &&
                      PLUGIN_CONFIG.SUPABASE.URL.includes('.supabase.co');

  // Проверяем, что anon key не заглушка и имеет правильный формат JWT
  const hasValidAnonKey = PLUGIN_CONFIG.SUPABASE.ANON_KEY &&
                          !PLUGIN_CONFIG.SUPABASE.ANON_KEY.includes('your_anon_key') &&
                          PLUGIN_CONFIG.SUPABASE.ANON_KEY.startsWith('eyJ') &&
                          PLUGIN_CONFIG.SUPABASE.ANON_KEY.length > 100;

  // Проверяем админ настройки
  const hasValidAdmin = PLUGIN_CONFIG.ADMIN.ACCESS_KEY &&
                        !PLUGIN_CONFIG.ADMIN.ACCESS_KEY.includes('change-this') &&
                        PLUGIN_CONFIG.ADMIN.ACCESS_KEY.length > 10;

  return {
    isValid: hasValidUrl && hasValidAnonKey && hasValidAdmin,
    details: {
      supabaseUrl: hasValidUrl,
      anonKey: hasValidAnonKey,
      adminKey: hasValidAdmin,
      yookassaEnabled: PLUGIN_CONFIG.YOOKASSA.ENABLED
    }
  };
}

// Функция для проверки подключения к Supabase
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
