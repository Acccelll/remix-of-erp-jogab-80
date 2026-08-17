CREATE POLICY "user_roles gm insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (private.is_current_player_gm());
CREATE POLICY "user_roles gm update" ON public.user_roles FOR UPDATE TO authenticated USING (private.is_current_player_gm()) WITH CHECK (private.is_current_player_gm());
CREATE POLICY "user_roles gm delete" ON public.user_roles FOR DELETE TO authenticated USING (private.is_current_player_gm());
CREATE POLICY "user_roles gm select all" ON public.user_roles FOR SELECT TO authenticated USING (private.is_current_player_gm());
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;