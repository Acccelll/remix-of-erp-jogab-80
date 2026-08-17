CREATE TABLE IF NOT EXISTS public.security_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       text NOT NULL,
  user_id    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email      text NULL,
  ip         text NULL,
  user_agent text NULL,
  origem     text NULL,
  sucesso    boolean NOT NULL DEFAULT true,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_events TO anon, authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events planifik" ON public.security_events;
CREATE POLICY "security_events planifik"
  ON public.security_events
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_tipo
  ON public.security_events(tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user
  ON public.security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_sucesso
  ON public.security_events(sucesso, created_at DESC)
  WHERE sucesso = false;

COMMENT ON TABLE  public.security_events IS 'SEC-007: trilha de auditoria de segurança (auth/authz). Separado de audit_logs (negócio) e system_events (operação).';
COMMENT ON COLUMN public.security_events.tipo IS 'login_ok | login_fail | logout | reauth | authz_denied | perm_change | role_assigned | role_revoked | session_expired';