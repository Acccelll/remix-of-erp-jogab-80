
CREATE TABLE IF NOT EXISTS public.system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error','critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_events_kind_created_idx ON public.system_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_severity_created_idx ON public.system_events (severity, created_at DESC);

GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_events_select_gm" ON public.system_events;
CREATE POLICY "system_events_select_gm"
  ON public.system_events
  FOR SELECT
  TO authenticated
  USING (public.current_is_gm());
