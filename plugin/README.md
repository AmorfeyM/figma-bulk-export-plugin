# 🔌 Figma Bulk Export Plugin

Плагин для массового экспорта изображений из Figma по секциям.

## 🚀 Установка

1. Скачайте файлы: `manifest.json`, `code-simple.js`, `ui-final.html`
2. Откройте Figma Desktop
3. Plugins → Development → Import plugin from manifest
4. Выберите `manifest.json`

## 🔑 Авторизация

Тестовые данные:
- **Email:** test@demo.com
- **Лицензия:** TEST-FIGMA-2024-KEY1

## 🔄 Сброс подписки

### Способ 1: Через консоль браузера
1. Откройте плагин
2. Нажмите F12 → Console
3. Введите: `resetSubscription()`
4. Перезапустите плагин

### Способ 2: Через Figma
1. Plugins → Development → Remove plugin
2. Заново импортируйте через manifest.json

### Способ 3: Через хранилище
В консоли браузера:
```javascript
// Очистить все данные плагина
parent.postMessage({
  pluginMessage: { type: 'subscription-reset' }
}, '*');
```

## 📋 Использование

1. Создайте секции с фреймами в Figma
2. Запустите плагин
3. Авторизуйтесь с лицензионным ключом
4. Выберите настройки экспорта
5. Нажмите "Начать экспорт"

## 🛠️ Тестовые лицензии

- `TEST-FIGMA-2024-KEY1` - месячная подписка
- `test@demo.com` - тестовый email

## 🌐 Админ-панель

https://same-xh79cp3e97u-latest.netlify.app/admin
