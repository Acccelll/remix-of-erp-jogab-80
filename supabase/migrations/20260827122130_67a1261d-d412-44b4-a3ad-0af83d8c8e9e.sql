-- Kanban (system design §8, item 6.3): sincroniza `cards.obra_id`/
-- `cards.cronograma_item_id` (colunas legadas) com `card_entity_links`
-- (camada polimórfica da ETAPA 2) daqui pra frente.
--
-- Achado da investigação: a migration `20260731214830` fez um backfill
-- ÚNICO de `card_entity_links` a partir do `obra_id`/`cronograma_item_id`
-- que existia naquele momento (`origem = 'migracao_legado'`), mas não
-- deixou nenhum trigger — todo card criado/atualizado depois (o board de
-- Compras/Produção grava `obra_id` direto, sem nunca tocar
-- `card_entity_links`) diverge silenciosamente entre os dois desde então.
-- Este trigger fecha esse gap: authoring continua em `cards.obra_id`
-- (nenhuma tela muda), o vínculo polimórfico passa a ser espelho
-- automático — pré-requisito para estender o registry de extensões
-- (`src/lib/quadros/extensoes/registry.ts`) a novos `entity_type`
-- (Contratos/Patrimônios/Romaneios) sem herdar essa divergência.
CREATE OR REPLACE FUNCTION public.trg_cards_sync_entity_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.obra_id IS DISTINCT FROM OLD.obra_id THEN
    IF TG_OP = 'UPDATE' AND OLD.obra_id IS NOT NULL THEN
      UPDATE public.card_entity_links
        SET archived_at = now(), situacao = 'arquivada', updated_at = now()
        WHERE card_id = NEW.id AND extensao_codigo = 'obra' AND entity_type = 'obra'
          AND entity_id = OLD.obra_id AND relationship_type = 'contexto' AND archived_at IS NULL;
    END IF;
    IF NEW.obra_id IS NOT NULL THEN
      SELECT empresa_id INTO v_empresa FROM public.obras WHERE id = NEW.obra_id;
      INSERT INTO public.card_entity_links
        (card_id, extensao_codigo, entity_type, entity_id, relationship_type, is_primary, display_order, empresa_id, origem)
      VALUES (NEW.id, 'obra', 'obra', NEW.obra_id, 'contexto', false, 0, v_empresa, 'sync_trigger')
      ON CONFLICT (card_id, entity_type, entity_id, relationship_type) WHERE archived_at IS NULL
      DO NOTHING;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.cronograma_item_id IS DISTINCT FROM OLD.cronograma_item_id THEN
    IF TG_OP = 'UPDATE' AND OLD.cronograma_item_id IS NOT NULL THEN
      UPDATE public.card_entity_links
        SET archived_at = now(), situacao = 'arquivada', updated_at = now()
        WHERE card_id = NEW.id AND extensao_codigo = 'cronograma' AND entity_type = 'cronograma_item'
          AND entity_id = OLD.cronograma_item_id AND relationship_type = 'atividade' AND archived_at IS NULL;
    END IF;
    IF NEW.cronograma_item_id IS NOT NULL THEN
      SELECT o.empresa_id INTO v_empresa
        FROM public.cronograma_itens ci LEFT JOIN public.obras o ON o.id = ci.obra_id
        WHERE ci.id = NEW.cronograma_item_id;
      INSERT INTO public.card_entity_links
        (card_id, extensao_codigo, entity_type, entity_id, relationship_type, is_primary, display_order, empresa_id, origem)
      VALUES (NEW.id, 'cronograma', 'cronograma_item', NEW.cronograma_item_id, 'atividade', false, 1, v_empresa, 'sync_trigger')
      ON CONFLICT (card_id, entity_type, entity_id, relationship_type) WHERE archived_at IS NULL
      DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cards_sync_entity_links ON public.cards;
CREATE TRIGGER cards_sync_entity_links
  AFTER INSERT OR UPDATE OF obra_id, cronograma_item_id ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.trg_cards_sync_entity_links();

REVOKE ALL ON FUNCTION public.trg_cards_sync_entity_links() FROM PUBLIC, anon, authenticated;

-- Cobre a divergência já acumulada desde 20260731214830 (cards criados/
-- movidos entre obras depois do backfill único) sem duplicar os vínculos
-- que já foram corretamente migrados e nunca mudaram de obra desde então.
INSERT INTO public.card_entity_links
  (card_id, extensao_codigo, entity_type, entity_id, relationship_type, is_primary, display_order, empresa_id, origem)
SELECT c.id, 'obra', 'obra', c.obra_id, 'contexto', false, 0, o.empresa_id, 'sync_trigger_backfill'
FROM public.cards c
JOIN public.obras o ON o.id = c.obra_id
WHERE c.obra_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.card_entity_links l
    WHERE l.card_id = c.id AND l.extensao_codigo = 'obra' AND l.entity_type = 'obra'
      AND l.entity_id = c.obra_id AND l.relationship_type = 'contexto' AND l.archived_at IS NULL
  )
ON CONFLICT (card_id, entity_type, entity_id, relationship_type) WHERE archived_at IS NULL
DO NOTHING;

INSERT INTO public.card_entity_links
  (card_id, extensao_codigo, entity_type, entity_id, relationship_type, is_primary, display_order, empresa_id, origem)
SELECT c.id, 'cronograma', 'cronograma_item', c.cronograma_item_id, 'atividade', false, 1, o.empresa_id, 'sync_trigger_backfill'
FROM public.cards c
JOIN public.cronograma_itens ci ON ci.id = c.cronograma_item_id
LEFT JOIN public.obras o ON o.id = ci.obra_id
WHERE c.cronograma_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.card_entity_links l
    WHERE l.card_id = c.id AND l.extensao_codigo = 'cronograma' AND l.entity_type = 'cronograma_item'
      AND l.entity_id = c.cronograma_item_id AND l.relationship_type = 'atividade' AND l.archived_at IS NULL
  )
ON CONFLICT (card_id, entity_type, entity_id, relationship_type) WHERE archived_at IS NULL
DO NOTHING;
