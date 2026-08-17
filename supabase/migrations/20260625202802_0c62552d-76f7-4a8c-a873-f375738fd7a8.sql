
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove agendamento anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('nc-notificar-prazos-diario');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Agenda: todos os dias às 11:00 UTC (~08:00 BRT)
SELECT cron.schedule(
  'nc-notificar-prazos-diario',
  '0 11 * * *',
  $$ SELECT public.fn_nc_notificar_prazos(); $$
);
