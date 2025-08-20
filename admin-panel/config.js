// Конфигурация Admin Panel (мульти-плагин)
const ADMIN_CONFIG = {
  // Supabase настройки
  SUPABASE: {
    URL: 'https://jnxywpdrnyfmfynviggu.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpueHl3cGRybnlmbWZ5bnZpZ2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3OTMwOTMsImV4cCI6MjA2NzM2OTA5M30.QpR2a-HLDOJyrT4vJgsPvhcjseFr4pXj1U48gghExrc',
    SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpueHl3cGRybnlmbWZ5bnZpZ2d1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTc5MzA5MywiZXhwIjoyMDY3MzY5MDkzfQ.T_kIOliOF7eD_lr9Rox-GoXMA03eY5p5n1h5pQvJA7Q'
  },

  // Админ настройки
  ADMIN: {
    ACCESS_KEY: 'figma-admin-2024-secure-key',
    ALLOWED_EMAILS: ['admin@yourcompany.com']
  },

  // Поддерживаемые плагины
  PLUGINS: {
    'bulk-export': {
      name: 'Figma Bulk Export',
      version: '2.2.0',
      subscriptions_table: 'subscriptions',
      usage_logs_table: 'usage_logs'
    }
    // Здесь можно добавить другие плагины:
    // 'another-plugin': { ... }
  },

  // Общие планы подписки
  PLANS: {
    monthly: { name: 'Месячная подписка', duration: 30, price: 500 },
    quarterly: { name: 'Квартальная подписка', duration: 90, price: 1200 },
    yearly: { name: 'Годовая подписка', duration: 365, price: 4000 }
  }
};

// Функция проверки конфигурации
function isConfigured() {
  return ADMIN_CONFIG.SUPABASE.URL &&
         !ADMIN_CONFIG.SUPABASE.URL.includes('your-project') &&
         ADMIN_CONFIG.SUPABASE.URL.includes('.supabase.co');
}

// Экспорт
if (typeof window !== 'undefined') {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
  window.isConfigured = isConfigured;
}
