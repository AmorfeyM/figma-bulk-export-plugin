// Конфигурация Figma Plugin (только для плагина)
const PLUGIN_CONFIG = {
  // Supabase настройки
  SUPABASE: {
    URL: 'https://jnxywpdrnyfmfynviggu.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpueHl3cGRybnlmbWZ5bnZpZ2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3OTMwOTMsImV4cCI6MjA2NzM2OTA5M30.QpR2a-HLDOJyrT4vJgsPvhcjseFr4pXj1U48gghExrc'
  },

  // API Endpoints
  API: {
    VERIFY_SUBSCRIPTION: '/rest/v1/rpc/verify_subscription',
    CREATE_PAYMENT: '/functions/v1/create-payment'
  },

  // Настройки плагина
  PLUGIN: {
    VERSION: '2.2.0',
    NAME: 'Figma Bulk Export by Sections',
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000 // 7 дней
  },

  // Планы подписки
  PLANS: {
    monthly: { name: 'Месячная подписка', price: 500, currency: 'RUB' },
    quarterly: { name: 'Квартальная подписка', price: 1200, currency: 'RUB' },
    yearly: { name: 'Годовая подписка', price: 4000, currency: 'RUB' }
  }
};

// Функция проверки конфигурации
function isConfigured() {
  return PLUGIN_CONFIG.SUPABASE.URL &&
         !PLUGIN_CONFIG.SUPABASE.URL.includes('your-project') &&
         PLUGIN_CONFIG.SUPABASE.URL.includes('.supabase.co');
}

// Экспорт для использования в плагине
if (typeof window !== 'undefined') {
  window.PLUGIN_CONFIG = PLUGIN_CONFIG;
  window.isConfigured = isConfigured;
}
