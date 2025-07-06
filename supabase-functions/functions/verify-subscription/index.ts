import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VerifyRequest {
  email: string;
  license_key: string;
  device_fingerprint: string;
  plugin_version?: string;
}

interface SubscriptionRow {
  id: string;
  email: string;
  license_key: string;
  device_fingerprint: string | null;
  status: string;
  plan: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  payment_id: string | null;
  last_checked: string;
}

serve(async (req) => {
  // Обработка CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ valid: false, error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )
  }

  try {
    // Инициализация Supabase клиента
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Парсинг запроса
    const requestData: VerifyRequest = await req.json()
    const { email, license_key, device_fingerprint, plugin_version } = requestData

    // Валидация входных данных
    if (!email || !license_key || !device_fingerprint) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Email, лицензионный ключ и fingerprint устройства обязательны'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Некорректный формат email' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Поиск подписки по email и лицензионному ключу
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('license_key', license_key.trim())
      .single()

    if (fetchError || !subscription) {
      // Логирование для отладки
      console.log('Subscription not found:', { email, license_key, error: fetchError })

      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Подписка не найдена. Проверьте email и лицензионный ключ.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    const sub = subscription as SubscriptionRow

    // Проверка статуса подписки
    if (sub.status !== 'active') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Подписка ${sub.status === 'inactive' ? 'деактивирована' : 'заблокирована'}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Проверка срока действия
    const now = new Date()
    const expiresAt = new Date(sub.expires_at)

    if (expiresAt < now) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Подписка истекла. Продлите подписку для продолжения работы.',
          expired: true,
          expires_at: sub.expires_at
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Проверка привязки к устройству (одна лицензия = одно устройство)
    if (sub.device_fingerprint && sub.device_fingerprint !== device_fingerprint) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Лицензия уже активирована на другом устройстве. Обратитесь к администратору для сброса.',
          device_conflict: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Обновление данных подписки
    const updateData: Partial<SubscriptionRow> = {
      last_checked: new Date().toISOString()
    }

    // Привязка к устройству при первой активации
    if (!sub.device_fingerprint) {
      updateData.device_fingerprint = device_fingerprint
      console.log('Device fingerprint bound:', { email, device_fingerprint })
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', sub.id)

    if (updateError) {
      console.error('Update error:', updateError)
      // Не возвращаем ошибку, так как основная проверка прошла успешно
    }

    // Подсчет дней до истечения
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Успешный ответ
    return new Response(
      JSON.stringify({
        valid: true,
        expires: sub.expires_at,
        plan: sub.plan,
        status: sub.status,
        days_left: daysLeft,
        email: sub.email,
        device_bound: !!sub.device_fingerprint,
        last_checked: updateData.last_checked
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Verification error:', error)

    return new Response(
      JSON.stringify({
        valid: false,
        error: 'Ошибка сервера при проверке подписки',
        network_error: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

/* Дополнительная документация для функции:

Эндпоинт: POST /functions/v1/verify-subscription

Тело запроса:
{
  "email": "user@example.com",
  "license_key": "FIGMA-123456-ABCDEF",
  "device_fingerprint": "unique-device-id",
  "plugin_version": "2.1.0"
}

Успешный ответ (200):
{
  "valid": true,
  "expires": "2024-12-31T23:59:59.000Z",
  "plan": "monthly",
  "status": "active",
  "days_left": 15,
  "email": "user@example.com",
  "device_bound": true,
  "last_checked": "2024-07-06T10:30:00.000Z"
}

Ошибки:
- 400: Некорректные данные запроса
- 404: Подписка не найдена
- 403: Подписка истекла или заблокирована, конфликт устройств
- 500: Ошибка сервера

*/
