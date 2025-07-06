import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface YooKassaWebhookPayload {
  type: string;
  event: string;
  object: {
    id: string;
    status: string;
    amount: {
      value: string;
      currency: string;
    };
    description?: string;
    metadata?: {
      email?: string;
      plan?: string;
      user_id?: string;
    };
    payment_method?: {
      type: string;
      id: string;
      saved: boolean;
    };
    created_at: string;
    paid: boolean;
    refunded: boolean;
  };
}

interface SubscriptionRow {
  id?: string;
  email: string;
  license_key: string;
  device_fingerprint?: string | null;
  status: string;
  plan: string;
  expires_at: string;
  payment_id: string;
  created_at?: string;
  updated_at?: string;
}

interface PaymentRow {
  id?: string;
  subscription_id?: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

serve(async (req) => {
  // Обработка CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // Инициализация Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Парсинг webhook payload
    const payload: YooKassaWebhookPayload = await req.json()
    console.log('YooKassa webhook received:', { type: payload.type, event: payload.event })

    const { type, event, object: payment } = payload

    // Обработка успешного платежа
    if (type === 'notification' && event === 'payment.succeeded') {
      await handleSuccessfulPayment(supabase, payment)
    }
    // Обработка отмененного платежа
    else if (type === 'notification' && event === 'payment.canceled') {
      await handleCanceledPayment(supabase, payment)
    }
    // Обработка возврата
    else if (type === 'notification' && event === 'refund.succeeded') {
      await handleRefund(supabase, payment)
    }
    else {
      console.log('Unhandled webhook event:', { type, event })
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
})

async function handleSuccessfulPayment(supabase: any, payment: any) {
  try {
    const { id: paymentId, amount, metadata = {} } = payment
    const { email, plan = 'monthly', user_id } = metadata

    if (!email) {
      console.error('No email in payment metadata:', paymentId)
      return
    }

    console.log('Processing successful payment:', { paymentId, email, plan })

    // Вычисление даты истечения подписки
    const expiresAt = new Date()
    switch (plan) {
      case 'monthly':
        expiresAt.setMonth(expiresAt.getMonth() + 1)
        break
      case 'quarterly':
        expiresAt.setMonth(expiresAt.getMonth() + 3)
        break
      case 'yearly':
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
        break
      default:
        expiresAt.setMonth(expiresAt.getMonth() + 1) // По умолчанию месяц
    }

    // Генерация лицензионного ключа
    const licenseKey = generateLicenseKey()

    // Проверка существующей подписки
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id, expires_at')
      .eq('email', email.toLowerCase())
      .single()

    let subscriptionId: string

    if (existingSubscription) {
      // Продление существующей подписки
      const currentExpiry = new Date(existingSubscription.expires_at)
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()))

      switch (plan) {
        case 'monthly':
          newExpiry.setMonth(newExpiry.getMonth() + 1)
          break
        case 'quarterly':
          newExpiry.setMonth(newExpiry.getMonth() + 3)
          break
        case 'yearly':
          newExpiry.setFullYear(newExpiry.getFullYear() + 1)
          break
      }

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          plan: plan,
          expires_at: newExpiry.toISOString(),
          payment_id: paymentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)

      if (updateError) {
        throw updateError
      }

      subscriptionId = existingSubscription.id
      console.log('Subscription extended:', { email, newExpiry: newExpiry.toISOString() })

    } else {
      // Создание новой подписки
      const subscriptionData: SubscriptionRow = {
        email: email.toLowerCase(),
        license_key: licenseKey,
        status: 'active',
        plan: plan,
        expires_at: expiresAt.toISOString(),
        payment_id: paymentId
      }

      const { data: newSubscription, error: insertError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select('id')
        .single()

      if (insertError) {
        throw insertError
      }

      subscriptionId = newSubscription.id
      console.log('New subscription created:', { email, licenseKey, expires: expiresAt.toISOString() })
    }

    // Сохранение информации о платеже
    const paymentData: PaymentRow = {
      subscription_id: subscriptionId,
      payment_id: paymentId,
      amount: parseFloat(amount.value),
      currency: amount.currency,
      status: 'succeeded',
      provider: 'yookassa',
      metadata: metadata
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)

    if (paymentError) {
      console.error('Payment record error:', paymentError)
      // Не прерываем процесс, если не удалось записать платеж
    }

    // Здесь можно добавить отправку email с лицензионным ключом
    // await sendLicenseEmail(email, licenseKey, plan, expiresAt)

    console.log('Payment processed successfully:', { paymentId, email, subscriptionId })

  } catch (error) {
    console.error('Error processing successful payment:', error)
    throw error
  }
}

async function handleCanceledPayment(supabase: any, payment: any) {
  try {
    const { id: paymentId, metadata = {} } = payment
    console.log('Processing canceled payment:', paymentId)

    // Обновление статуса платежа
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', paymentId)

    if (error) {
      console.error('Error updating canceled payment:', error)
    }

  } catch (error) {
    console.error('Error processing canceled payment:', error)
  }
}

async function handleRefund(supabase: any, refund: any) {
  try {
    const { payment_id: paymentId, amount } = refund
    console.log('Processing refund:', { paymentId, amount })

    // Найти подписку по payment_id
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, email')
      .eq('payment_id', paymentId)
      .single()

    if (subscription) {
      // Деактивировать подписку при полном возврате
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)

      if (error) {
        console.error('Error deactivating subscription after refund:', error)
      } else {
        console.log('Subscription deactivated after refund:', subscription.email)
      }
    }

    // Обновление статуса платежа
    await supabase
      .from('payments')
      .update({
        status: 'refunded',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', paymentId)

  } catch (error) {
    console.error('Error processing refund:', error)
  }
}

function generateLicenseKey(): string {
  const timestamp = Date.now().toString().slice(-6)
  const random1 = Math.random().toString(36).substr(2, 4).toUpperCase()
  const random2 = Math.random().toString(36).substr(2, 4).toUpperCase()
  return `FIGMA-${timestamp}-${random1}-${random2}`
}

// Функция отправки email (заглушка для будущей реализации)
async function sendLicenseEmail(email: string, licenseKey: string, plan: string, expiresAt: Date) {
  // Здесь можно интегрировать SendGrid, Mailgun или другой email сервис
  console.log('Email notification needed:', { email, licenseKey, plan, expiresAt })

  // Пример интеграции с SendGrid:
  /*
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }],
        subject: 'Ваш лицензионный ключ Figma Plugin'
      }],
      from: { email: 'noreply@yourcompany.com' },
      content: [{
        type: 'text/html',
        value: `
          <h2>Спасибо за покупку!</h2>
          <p>Ваш лицензионный ключ: <strong>${licenseKey}</strong></p>
          <p>План: ${plan}</p>
          <p>Действует до: ${expiresAt.toLocaleDateString()}</p>
        `
      }]
    })
  })
  */
}

/* Документация webhook:

YooKassa отправляет POST запросы на этот endpoint при изменении статуса платежа.

Основные события:
- payment.succeeded: платеж успешно завершен
- payment.canceled: платеж отменен
- refund.succeeded: возврат средств выполнен

Формат metadata в платеже:
{
  "email": "user@example.com",
  "plan": "monthly|quarterly|yearly",
  "user_id": "optional_user_id"
}

Функция автоматически:
1. Создает новую подписку или продлевает существующую
2. Генерирует лицензионный ключ
3. Записывает информацию о платеже
4. Может отправить email с лицензией (если настроен email сервис)

*/
