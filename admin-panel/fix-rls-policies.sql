-- Исправление политик Row Level Security для Supabase
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Удаляем существующие ограничительные политики
DROP POLICY IF EXISTS "Public read access" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role full access" ON public.subscriptions;
DROP POLICY IF EXISTS "Public read payments" ON public.payments;
DROP POLICY IF EXISTS "Service role payments access" ON public.payments;

-- 2. Создаем разрешающие политики для subscriptions
CREATE POLICY "Allow all operations for authenticated users" ON public.subscriptions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for anon users" ON public.subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Создаем разрешающие политики для payments (если таблица существует)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    EXECUTE 'CREATE POLICY "Allow all operations for authenticated users" ON public.payments FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all operations for anon users" ON public.payments FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 4. Альтернативный вариант - отключить RLS (менее безопасно, но проще)
-- Раскомментируйте следующие строки если политики выше не помогают:

-- ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- 5. Проверяем текущие политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('subscriptions', 'payments');

-- 6. Тестируем создание записи
SELECT public.create_subscription(
  'test-rls@example.com',
  'monthly',
  'figma-admin-2024-secure-key'
) as test_result;
