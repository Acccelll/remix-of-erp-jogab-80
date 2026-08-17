
-- Fase D — campos sob demanda: lembrete + local
-- (campos custom já existem em card_custom_fields/_valores; datas em cards.data_inicio/prazo)

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS lembrete timestamptz;

CREATE TABLE IF NOT EXISTS public.card_local (
  card_id   uuid PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  endereco  text,
  lat       double precision,
  lng       double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_local TO authenticated;
GRANT ALL ON public.card_local TO service_role;

ALTER TABLE public.card_local ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='card_local' AND policyname='card_local_select_auth'
  ) THEN
    CREATE POLICY card_local_select_auth ON public.card_local
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='card_local' AND policyname='card_local_write_auth'
  ) THEN
    CREATE POLICY card_local_write_auth ON public.card_local
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._card_local_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_card_local_touch ON public.card_local;
CREATE TRIGGER trg_card_local_touch
  BEFORE UPDATE ON public.card_local
  FOR EACH ROW EXECUTE FUNCTION public._card_local_touch();
