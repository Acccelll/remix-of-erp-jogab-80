
-- 1) Histórico em card_board_posicao
ALTER TABLE public.card_board_posicao
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;

-- 2) Propagar datas/título do cronograma -> cards vinculados
CREATE OR REPLACE FUNCTION public.cards_sync_from_cronograma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.data_inicio IS DISTINCT FROM OLD.data_inicio)
     OR (NEW.data_fim IS DISTINCT FROM OLD.data_fim)
     OR (NEW.descricao IS DISTINCT FROM OLD.descricao) THEN
    UPDATE public.cards
       SET data_inicio = NEW.data_inicio,
           prazo       = NEW.data_fim,
           updated_at  = now()
     WHERE cronograma_item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cards_sync_from_cronograma ON public.cronograma_itens;
CREATE TRIGGER trg_cards_sync_from_cronograma
AFTER UPDATE ON public.cronograma_itens
FOR EACH ROW
EXECUTE FUNCTION public.cards_sync_from_cronograma();

-- Helper: garante posição na 1ª lista (não arquivada) de um board
CREATE OR REPLACE FUNCTION public._ensure_card_board_posicao(_card_id uuid, _board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lista_id uuid;
  _next_pos numeric;
BEGIN
  IF _board_id IS NULL OR _card_id IS NULL THEN RETURN; END IF;

  SELECT id INTO _lista_id
    FROM public.board_listas
   WHERE board_id = _board_id AND arquivada = false
   ORDER BY posicao ASC, created_at ASC
   LIMIT 1;

  IF _lista_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(posicao), 0) + 1 INTO _next_pos
    FROM public.card_board_posicao
   WHERE board_id = _board_id AND lista_id = _lista_id AND arquivada = false;

  INSERT INTO public.card_board_posicao(card_id, board_id, lista_id, posicao, arquivada)
       VALUES (_card_id, _board_id, _lista_id, _next_pos, false)
  ON CONFLICT (card_id, board_id) DO UPDATE
       SET arquivada = false,
           lista_id  = COALESCE(public.card_board_posicao.lista_id, EXCLUDED.lista_id),
           updated_at = now();
END;
$$;

-- 3a) cards.obra_id -> auto board da obra
CREATE OR REPLACE FUNCTION public.cards_auto_board_posicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _board_id uuid;
BEGIN
  IF NEW.obra_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.obra_id IS NOT DISTINCT FROM OLD.obra_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _board_id
    FROM public.boards
   WHERE tipo = 'obra' AND obra_id = NEW.obra_id AND arquivado = false
   ORDER BY created_at ASC
   LIMIT 1;

  IF _board_id IS NOT NULL THEN
    PERFORM public._ensure_card_board_posicao(NEW.id, _board_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cards_auto_board_posicao ON public.cards;
CREATE TRIGGER trg_cards_auto_board_posicao
AFTER INSERT OR UPDATE OF obra_id ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.cards_auto_board_posicao();

-- 3b) card_setores -> auto board do setor
CREATE OR REPLACE FUNCTION public.card_setores_auto_board_posicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _board_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO _board_id
      FROM public.boards
     WHERE tipo = 'setor' AND setor = NEW.setor AND arquivado = false
     ORDER BY created_at ASC
     LIMIT 1;
    IF _board_id IS NOT NULL THEN
      PERFORM public._ensure_card_board_posicao(NEW.card_id, _board_id);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO _board_id
      FROM public.boards
     WHERE tipo = 'setor' AND setor = OLD.setor AND arquivado = false
     ORDER BY created_at ASC
     LIMIT 1;
    IF _board_id IS NOT NULL THEN
      UPDATE public.card_board_posicao
         SET arquivada = true, updated_at = now()
       WHERE card_id = OLD.card_id AND board_id = _board_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_card_setores_auto_board_posicao ON public.card_setores;
CREATE TRIGGER trg_card_setores_auto_board_posicao
AFTER INSERT OR DELETE ON public.card_setores
FOR EACH ROW
EXECUTE FUNCTION public.card_setores_auto_board_posicao();
