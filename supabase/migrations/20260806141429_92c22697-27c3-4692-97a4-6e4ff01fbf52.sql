DO $$
DECLARE r record; def text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND (p.prosrc ILIKE '%public.is_current_player_gm%' OR p.prosrc ILIKE '%public.current_player_has_access%')
  LOOP
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'public.is_current_player_gm', 'private.is_current_player_gm');
    def := replace(def, 'public.current_player_has_access', 'private.current_player_has_access');
    EXECUTE def;
  END LOOP;
END $$;