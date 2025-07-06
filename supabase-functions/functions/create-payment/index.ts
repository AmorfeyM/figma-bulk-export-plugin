import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreatePaymentRequest {
  email: string;
  plan: string;
  return_url?: string;
}

interface YooKassaPaymentRequest {
  amount: {
    value: string;
    currency: string;
  };
  description: string;
  metadata: {
    email: string;
    plan: string;
  };
  confirmation: {
    type: string;
    return_url: string;
  };
  capture: boolean;
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    confirmation_url: string;
  };
  created_at: string;
  description: string;
  metadata: any;
  paid: boolean;
  refundable: boolean;
  test: boolean;
}

// Конфигурация планов подписки
const SUBSCRIPTION_PLANS = {
  monthly: {
    name: 'Месячная подписка',
    price: 500,
    duration: '30 дней'
  },
  quarterly: {
    name: 'Квартальная подписка',
    price: 1200,
    duration: '90 дней'
  },
  yearly: {
    name: 'Годовая подписка',
    price: 4000,
    duration: '365 дней'
  }
}

serve(async (req) => {
  // Обработка CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )
  }

  try {
    // Проверка настроек YooKassa
    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')
    const secretKey = Deno.env.get('YOOKASSA_SECRET_KEY')

    if (!shopId || !secretKey) {
      throw new Error('YooKassa configuration missing')
    }

    // Парсинг запроса
    const requestData: CreatePaymentRequest = await req.json()
    const { email, plan, return_url = 'https://yourcompany.com/success' } = requestData

    // Валидация входных данных
    if (!email || !plan) {
      return new Response(
        JSON.stringify({ error: 'Email и план подписки обязательны' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Некорректный формат email' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Проверка плана
    if (!SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]) {
      return new Response(
        JSON.stringify({
          error: 'Неверный план подписки',
          available_plans: Object.keys(SUBSCRIPTION_PLANS)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const selectedPlan = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]

    // Создание уникального idempotency key
    const idempotencyKey = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Подготовка данных для YooKassa
    const paymentData: YooKassaPaymentRequest = {
      amount: {
        value: selectedPlan.price.toFixed(2),
        currency: 'RUB'
      },
      description: `${selectedPlan.name} - Figma Bulk Export Plugin`,
      metadata: {
        email: email.toLowerCase(),
        plan: plan
      },
      confirmation: {
        type: 'redirect',
        return_url: return_url
      },
      capture: true
    }

    console.log('Creating payment:', { email, plan, amount: selectedPlan.price })

    // Отправка запроса в YooKassa
    const yookassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${shopId}:${secretKey}`)}`,
        'Idempotence-Key': idempotencyKey
      },
      body: JSON.stringify(paymentData)
    })

    if (!yookassaResponse.ok) {
      const errorText = await yookassaResponse.text()
      console.error('YooKassa API error:', {
        status: yookassaResponse.status,
        statusText: yookassaResponse.statusText,
        body: errorText
      })

      throw new Error(`YooKassa API error: ${yookassaResponse.status} ${yookassaResponse.statusText}`)
    }

    const paymentResponse: YooKassaPaymentResponse = await yookassaResponse.json()

    console.log('Payment created successfully:', {
      paymentId: paymentResponse.id,
      email,
      plan,
      amount: paymentResponse.amount.value
    })

    // Возвращаем ответ клиенту
    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentResponse.id,
        payment_url: paymentResponse.confirmation.confirmation_url,
        amount: paymentResponse.amount,
        plan: {
          name: selectedPlan.name,
          duration: selectedPlan.duration,
          price: selectedPlan.price
        },
        description: paymentData.description,
        created_at: paymentResponse.created_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Create payment error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Ошибка создания платежа',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

/* Документация API:

Эндпоинт: POST /functions/v1/create-payment

Тело запроса:
{
  "email": "user@example.com",
  "plan": "monthly|quarterly|yearly",
  "return_url": "https://yoursite.com/success" (опционально)
}

Успешный ответ (200):
{
  "success": true,
  "payment_id": "abc123-def456-ghi789",
  "payment_url": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=...",
  "amount": {
    "value": "500.00",
    "currency": "RUB"
  },
  "plan": {
    "name": "Месячная подписка",
    "duration": "30 дней",
    "price": 500
  },
  "description": "Месячная подписка - Figma Bulk Export Plugin",
  "created_at": "2024-07-06T10:30:00.000Z"
}

Ошибки:
- 400: Некорректные данные запроса
- 500: Ошибка создания платежа

Доступные планы:
- monthly: 500 руб/месяц
- quarterly: 1200 руб/квартал
- yearly: 4000 руб/год

После получения payment_url пользователь должен быть перенаправлен на эту страницу для оплаты.
После успешной оплаты YooKassa отправит webhook на /functions/v1/yookassa-webhook.

*/
