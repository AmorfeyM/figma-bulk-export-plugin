// Простая версия плагина без TypeScript
try {
  console.log('🔌 Figma Bulk Export Plugin starting...');

  figma.showUI(__html__, {
    width: 400,
    height: 500,
    themeColors: true
  });

  console.log('✅ UI initialized successfully');
} catch (error) {
  console.error('❌ Plugin initialization error:', error);
  figma.notify('Ошибка запуска плагина: ' + error.message);
}

// Конфигурация плагина (встроенная для надежности)
const CONFIG = {
  SUPABASE_URL: 'https://jnxywpdrnyfmfynviggu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpueHl3cGRybnlmbWZ5bnZpZ2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3OTMwOTMsImV4cCI6MjA2NzM2OTA5M30.QpR2a-HLDOJyrT4vJgsPvhcjseFr4pXj1U48gghExrc',
  PLUGIN_VERSION: '2.2.0',
  YOOKASSA_ENABLED: false, // Отключено до настройки
  DEMO_MODE: false // Переключаем на продакшн режим
};

// API endpoint для проверки подписок (два варианта)
const USE_EDGE_FUNCTIONS = false; // Переключатель: true - Edge Functions, false - SQL Functions

const SUBSCRIPTION_API_URL = USE_EDGE_FUNCTIONS
  ? CONFIG.SUPABASE_URL + '/functions/v1/verify-subscription'
  : CONFIG.SUPABASE_URL + '/rest/v1/rpc/verify_subscription';

// Функция проверки конфигурации
function checkConfiguration() {
  const configValid = !CONFIG.SUPABASE_URL.includes('your-project-id') &&
                      !CONFIG.SUPABASE_ANON_KEY.includes('your_anon_key') &&
                      CONFIG.SUPABASE_URL.includes('.supabase.co');

  console.log('Configuration check:', {
    valid: configValid,
    url: CONFIG.SUPABASE_URL,
    hasValidKey: CONFIG.SUPABASE_ANON_KEY.length > 100,
    yookassaEnabled: CONFIG.YOOKASSA_ENABLED,
    demoMode: CONFIG.DEMO_MODE
  });

  return configValid;
}

// Генерация уникального fingerprint устройства
async function getDeviceFingerprint() {
  try {
    let fingerprint = await figma.clientStorage.getAsync('device_fingerprint');
    if (!fingerprint) {
      // Генерируем уникальный ID на основе различных параметров
      const timestamp = Date.now().toString();
      const random = Math.random().toString(36).substr(2, 9);
      const userAgent = 'figma-plugin'; // В Figma нет navigator.userAgent
      fingerprint = btoa(timestamp + random + userAgent).substr(0, 16);
      await figma.clientStorage.setAsync('device_fingerprint', fingerprint);
      console.log('📱 New device fingerprint created:', fingerprint);
    } else {
      console.log('📱 Using existing device fingerprint:', fingerprint);
    }
    return fingerprint;
  } catch (error) {
    console.warn('⚠️ Device fingerprint error:', error);
    const fallback = 'fallback-' + Date.now().toString().substr(-8);
    console.log('📱 Using fallback fingerprint:', fallback);
    return fallback;
  }
}

// Проверка подписки с кэшированием
async function checkSubscription(email, licenseKey) {
  const cacheKey = 'subscription_cache';
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах

  // Проверяем кэш (офлайн работа до недели)
  try {
    const cached = await figma.clientStorage.getAsync(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      const expiresTime = new Date(data.expires).getTime();

      // Если кэш валиден и подписка не истекла, и с последней проверки прошло менее недели
      if (data.valid && expiresTime > now && (now - data.lastChecked) < WEEK_MS) {
        console.log('Using cached subscription data');
        return {
          valid: true,
          cached: true,
          expires: data.expires,
          offline: true,
          message: 'Офлайн режим (кэшированные данные)'
        };
      }
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }

  // Онлайн проверка подписки
  try {
    const fingerprint = await getDeviceFingerprint();

    console.log('🔍 Checking subscription online:', {
      email: email.toLowerCase().trim(),
      licenseKey: licenseKey.trim().substring(0, 8) + '...',
      fingerprint
    });

    let response, requestBody;

    if (USE_EDGE_FUNCTIONS) {
      // Edge Functions запрос
      requestBody = {
        email: email.toLowerCase().trim(),
        license_key: licenseKey.trim(),
        device_fingerprint: fingerprint,
        plugin_version: CONFIG.PLUGIN_VERSION || '2.1.0'
      };
    } else {
      // SQL Function запрос через RPC
      requestBody = {
        p_email: email.toLowerCase().trim(),
        p_license_key: licenseKey.trim(),
        p_device_fingerprint: fingerprint
      };
    }

    response = await fetch(SUBSCRIPTION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Response error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Subscription check result:', { valid: result.valid, expires: result.expires });

    if (result.valid) {
      // Кэшируем результат на неделю
      const cacheData = {
        valid: true,
        expires: result.expires,
        lastChecked: now,
        email: email.toLowerCase(),
        plan: result.plan,
        days_left: result.days_left
      };

      await figma.clientStorage.setAsync(cacheKey, JSON.stringify(cacheData));

      // Сохраняем данные пользователя
      await figma.clientStorage.setAsync('user_email', email.toLowerCase());
      await figma.clientStorage.setAsync('license_key', licenseKey);

      return {
        valid: true,
        expires: result.expires,
        plan: result.plan,
        days_left: result.days_left,
        device_bound: result.device_bound
      };
    } else {
      return {
        valid: false,
        error: result.error || 'Подписка не действительна',
        expired: result.expired,
        device_conflict: result.device_conflict
      };
    }

  } catch (error) {
    console.warn('Online verification failed:', error);

    // Fallback к кэшу при ошибке сети
    try {
      const cached = await figma.clientStorage.getAsync(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        const expiresTime = new Date(data.expires).getTime();

        // Если подписка еще не истекла, позволяем работать в офлайн режиме
        if (data.valid && expiresTime > now) {
          console.log('Using cached data due to network error');
          return {
            valid: true,
            cached: true,
            offline: true,
            expires: data.expires,
            plan: data.plan,
            days_left: data.days_left,
            message: 'Работа в офлайн режиме (сетевая ошибка)'
          };
        }
      }
    } catch (e) {
      console.warn('Cache fallback error:', e);
    }

    return {
      valid: false,
      error: 'Не удалось проверить подписку. Проверьте интернет-соединение.',
      networkError: true,
      details: error.message
    };
  }
}

// Простая функция для получения токена сессии (заглушка)
async function getFigmaSessionToken() {
  // В реальном плагине здесь может быть логика получения токена
  return 'figma-plugin-session';
}

// Функция для проверки активной подписки
async function isSubscriptionActive() {
  try {
    const email = await figma.clientStorage.getAsync('user_email');
    const licenseKey = await figma.clientStorage.getAsync('license_key');

    if (!email || !licenseKey) {
      return false;
    }

    const result = await checkSubscription(email, licenseKey);
    return result.valid;
  } catch (error) {
    return false;
  }
}

// Функция для сброса подписки
async function clearSubscriptionData() {
  try {
    await figma.clientStorage.deleteAsync('subscription_cache');
    await figma.clientStorage.deleteAsync('user_email');
    await figma.clientStorage.deleteAsync('license_key');
    return true;
  } catch (error) {
    console.warn('Clear subscription error:', error);
    return false;
  }
}

// Функция для поиска всех секций и их фреймов
function findSectionsAndFrames() {
  const sections = [];

  // Функция для рекурсивного поиска в узлах
  function searchInNode(node) {
    if (node.type === 'SECTION') {
      const frames = [];

      // Ищем все фреймы внутри секции
      function findFramesInNode(childNode) {
        if (childNode.type === 'FRAME') {
          frames.push(childNode);
        } else if (childNode.children) {
          for (const grandChild of childNode.children) {
            findFramesInNode(grandChild);
          }
        }
      }

      for (const child of node.children) {
        findFramesInNode(child);
      }

      if (frames.length > 0) {
        sections.push({
          name: node.name,
          frames: frames
        });
      }
    } else if (node.children) {
      for (const child of node.children) {
        searchInNode(child);
      }
    }
  }

  // Ищем секции на всех страницах
  for (const page of figma.root.children) {
    if (page.type === 'PAGE') {
      for (const child of page.children) {
        searchInNode(child);
      }
    }
  }

  return sections;
}

// Функция для экспорта фрейма в байты
async function exportFrameToBytes(frame, settings) {
  let exportSettings;

  if (settings.format === 'SVG') {
    exportSettings = {
      format: 'SVG'
    };
  } else {
    exportSettings = {
      format: settings.format,
      constraint: {
        type: 'SCALE',
        value: settings.scale
      }
    };
  }

  return await frame.exportAsync(exportSettings);
}

// Функция создания тестовой подписки (для демо-режима)
async function createTestSubscription(email, plan = 'monthly') {
  const testLicenseKey = `TEST-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  const expiresAt = new Date();

  switch (plan) {
    case 'monthly':
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      break;
    case 'quarterly':
      expiresAt.setMonth(expiresAt.getMonth() + 3);
      break;
    case 'yearly':
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      break;
  }

  console.log('Test subscription created:', {
    email,
    licenseKey: testLicenseKey,
    plan,
    expires: expiresAt.toISOString()
  });

  return {
    email,
    license_key: testLicenseKey,
    plan,
    expires_at: expiresAt.toISOString()
  };
}

// Обработчик сообщений от UI
figma.ui.onmessage = async (msg) => {
  try {
    console.log('📨 Received message:', msg.type);

    // Проверяем конфигурацию при первом запуске
    if (!checkConfiguration()) {
      console.warn('❌ Configuration not properly set up');
      console.log('📝 Please update Supabase credentials in code-simple.js');
    } else {
      console.log('✅ Configuration looks good');
    }
  } catch (error) {
    console.error('❌ Error in message handler:', error);
    figma.notify('Ошибка обработки сообщения: ' + error.message);
  }
  // Сброс подписки (для демонстрации)
  if (msg.type === 'subscription-reset') {
    try {
      await clearSubscriptionData();
      figma.ui.postMessage({
        type: 'subscription-status',
        active: false
      });
    } catch (error) {
      console.error('Ошибка сброса подписки:', error);
    }
    return;
  }

  // Создание тестовой подписки (для демо-режима)
  if (msg.type === 'create-test-subscription') {
    if (CONFIG.DEMO_MODE) {
      const { email, plan } = msg;
      const testSub = await createTestSubscription(email || 'test@demo.com', plan || 'monthly');

      // Сохраняем тестовую подписку локально
      await figma.clientStorage.setAsync('user_email', testSub.email);
      await figma.clientStorage.setAsync('license_key', testSub.license_key);
      await figma.clientStorage.setAsync('subscription_cache', JSON.stringify({
        valid: true,
        expires: testSub.expires_at,
        lastChecked: Date.now(),
        email: testSub.email,
        plan: testSub.plan,
        isTestSubscription: true
      }));

      figma.ui.postMessage({
        type: 'test-subscription-created',
        subscription: testSub,
        message: `Тестовая подписка создана!\nEmail: ${testSub.email}\nКлюч: ${testSub.license_key}`
      });
    } else {
      figma.ui.postMessage({
        type: 'test-subscription-error',
        error: 'Создание тестовых подписок доступно только в демо-режиме'
      });
    }
    return;
  }

  // Проверка статуса подписки
  if (msg.type === 'subscription-check') {
    const isActive = await isSubscriptionActive();

    if (isActive) {
      // Получаем данные пользователя для UI
      try {
        const email = await figma.clientStorage.getAsync('user_email');
        const cached = await figma.clientStorage.getAsync('subscription_cache');
        const cacheData = cached ? JSON.parse(cached) : null;

        figma.ui.postMessage({
          type: 'subscription-status',
          active: true,
          email: email,
          expires: cacheData ? cacheData.expires : null
        });
      } catch (error) {
        figma.ui.postMessage({
          type: 'subscription-status',
          active: true
        });
      }
    } else {
      figma.ui.postMessage({
        type: 'subscription-status',
        active: false
      });
    }
    return;
  }

  // Верификация подписки
  if (msg.type === 'subscription-verify') {
    const { email, license_key } = msg;

    if (!email || !license_key) {
      figma.ui.postMessage({
        type: 'subscription-error',
        message: 'Введите email и лицензионный ключ'
      });
      return;
    }

    // Проверяем подписку
    const result = await checkSubscription(email.toLowerCase().trim(), license_key.trim());

    if (result.valid) {
      figma.ui.postMessage({
        type: 'subscription-success',
        expires: result.expires,
        cached: result.cached,
        offline: result.offline,
        message: result.message
      });
    } else {
      figma.ui.postMessage({
        type: 'subscription-error',
        message: result.error || 'Подписка не найдена или истекла',
        networkError: result.networkError
      });
    }
    return;
  }

  // Получение информации о подписке
  if (msg.type === 'get-subscription-info') {
    try {
      const email = await figma.clientStorage.getAsync('user_email');
      const cached = await figma.clientStorage.getAsync('subscription_cache');
      const cacheData = cached ? JSON.parse(cached) : null;

      figma.ui.postMessage({
        type: 'subscription-info',
        email: email,
        expires: cacheData ? cacheData.expires : null,
        cached: !!cached,
        lastChecked: cacheData ? cacheData.lastChecked : null
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'subscription-info',
        email: null
      });
    }
    return;
  }

  // Создание платежа (ЗАГЛУШКА - YooKassa отключена)
  if (msg.type === 'create-payment') {
    const { email, plan } = msg;

    if (!email || !plan) {
      figma.ui.postMessage({
        type: 'payment-created',
        success: false,
        error: 'Email и план подписки обязательны'
      });
      return;
    }

    // ЗАГЛУШКА: YooKassa временно отключена
    if (!CONFIG.YOOKASSA_ENABLED) {
      const planInfo = {
        monthly: { name: 'Месячная подписка', price: 500 },
        quarterly: { name: 'Квартальная подписка', price: 1200 },
        yearly: { name: 'Годовая подписка', price: 4000 }
      };

      console.log('Payment request (DEMO MODE):', { email, plan, planInfo: planInfo[plan] });

      figma.ui.postMessage({
        type: 'payment-created',
        success: false,
        error: `💳 Покупка подписки временно недоступна\n\n📋 Ваш запрос:\n• Email: ${email}\n• План: ${planInfo[plan] ? planInfo[plan].name : 'Неизвестный'} (${planInfo[plan] ? planInfo[plan].price : 0}₽)\n\n📞 Для покупки обратитесь к администратору\n\n🔑 В демо-режиме используйте тестовые лицензии из админ-панели`,
        isDemo: true,
        requestDetails: {
          email,
          plan: planInfo[plan]
        }
      });
      return;
    }

    // Этот код будет использоваться когда YooKassa будет включена
    try {
      const createPaymentUrl = CONFIG.SUPABASE_URL + '/functions/v1/create-payment';

      const response = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: email,
          plan: plan,
          return_url: 'https://figma.com/plugin/success'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      figma.ui.postMessage({
        type: 'payment-created',
        success: result.success,
        payment_id: result.payment_id,
        payment_url: result.payment_url,
        amount: result.amount,
        plan: result.plan,
        error: result.error
      });

    } catch (error) {
      console.error('Create payment error:', error);
      figma.ui.postMessage({
        type: 'payment-created',
        success: false,
        error: 'Ошибка создания платежа: ' + error.message
      });
    }
    return;
  }

  // Проверяем активную подписку для всех остальных действий
  const hasActiveSubscription = await isSubscriptionActive();
  if (!hasActiveSubscription) {
    figma.ui.postMessage({
      type: 'subscription-required'
    });
    return;
  }

  if (msg.type === 'get-sections') {
    const sections = findSectionsAndFrames();
    const sectionsInfo = sections.map(section => ({
      name: section.name,
      frameCount: section.frames.length
    }));

    figma.ui.postMessage({
      type: 'sections-found',
      sections: sectionsInfo
    });
  }

  if (msg.type === 'start-export') {
    const settings = msg.settings;
    const sections = findSectionsAndFrames();

    if (sections.length === 0) {
      figma.ui.postMessage({
        type: 'export-error',
        message: 'Секции с фреймами не найдены'
      });
      return;
    }

    let totalFrames = 0;
    sections.forEach(section => {
      totalFrames += section.frames.length;
    });

    let exportedFrames = 0;
    const exportedData = {};

    try {
      for (const section of sections) {
        exportedData[section.name] = {};

        for (const frame of section.frames) {
          const imageBytes = await exportFrameToBytes(frame, settings);
          exportedData[section.name][frame.name] = imageBytes;

          exportedFrames++;
          const progress = Math.round((exportedFrames / totalFrames) * 100);

          figma.ui.postMessage({
            type: 'export-progress',
            progress: progress,
            currentSection: section.name,
            currentFrame: frame.name
          });
        }
      }

      figma.ui.postMessage({
        type: 'export-complete',
        data: exportedData
      });

    } catch (error) {
      figma.ui.postMessage({
        type: 'export-error',
        message: 'Ошибка экспорта: ' + (error.message || 'Неизвестная ошибка')
      });
    }
  }

  if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};
