
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros_externos TO authenticated;
GRANT ALL ON public.card_membros_externos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_custom_fields TO authenticated;
GRANT ALL ON public.card_custom_fields TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_custom_field_valores TO authenticated;
GRANT ALL ON public.card_custom_field_valores TO service_role;
