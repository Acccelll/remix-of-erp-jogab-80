DROP POLICY IF EXISTS "obras select" ON public.obras;
CREATE POLICY "obras select" ON public.obras
FOR SELECT TO authenticated
USING (true);