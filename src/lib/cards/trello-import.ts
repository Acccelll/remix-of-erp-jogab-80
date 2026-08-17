/** @module-kind io */
/**
 * Importador de board do Trello (JSON oficial) → board atual do app.
 */
import { trelloImportRepo } from "@/lib/repositories/trelloImport";
import {
  EVENTOS_ATIVIDADE,
  corLabelTrello,
  corPalette,
  listasComFallback,
  safeDate,
  safeIsoTs,
  type MapaListas,
  type TrelloAction,
  type TrelloBoardJson,
  type TrelloCard,
  type TrelloChecklist,
  type TrelloLabel,
  type TrelloList,
  type TrelloMember,
} from "@/lib/cards/trello-parse";
import { requireUuid, uuidOrNull } from "@/lib/core/uuid";

export { corLabelTrello };
export type {
  MapaListas,
  TrelloAction,
  TrelloBoardJson,
  TrelloCard,
  TrelloChecklist,
  TrelloColor,
  TrelloLabel,
  TrelloList,
  TrelloMember,
} from "@/lib/cards/trello-parse";

export interface ImportarTrelloOpts {
  board: TrelloBoardJson;
  boardId: string;
  obraId?: string | null;
  criadoPor: string;
  mapaListas?: MapaListas;
  incluirArquivados?: boolean;
  setor?: string | null;
}

export interface ImportarTrelloResultado {
  listasCriadas: number;
  listasMescladas: number;
  cardsCriados: number;
  cardsSincronizados: number;
  labelsCriadas: number;
  checklistItens: number;
  comentarios: number;
  anexos: number;
  membrosExternos: number;
  boardMembrosVinculados: number;
  customFieldsCriados: number;
  customFieldValores: number;
  atividadesRegistradas: number;
  erros: string[];
}

async function upsertLabels(labels: TrelloLabel[]) {
  const norm = (labels ?? []).map((l) => ({
    tid: l.id,
    nome: (l.name?.trim() || `Etiqueta ${l.color ?? "sem cor"}`).slice(0, 200),
    cor: corLabelTrello(l.color),
  }));
  const chave = (n: string, c: string) => `${n.toLowerCase()}|${c.toLowerCase()}`;
  const unicas = Array.from(new Map(norm.map((l) => [chave(l.nome, l.cor), l])).values());

  const existentes = await trelloImportRepo.listLabelsByNomes(
    unicas.map((u) => u.nome).concat(["__none__"]),
  );

  const idxExist = new Map<string, string>();
  for (const e of existentes ?? []) idxExist.set(chave(e.nome ?? "", e.cor ?? ""), e.id);

  const aCriar = unicas
    .filter((u) => !idxExist.has(chave(u.nome, u.cor)))
    .map((u) => ({ nome: u.nome, cor: u.cor }));

  let criadas = 0;
  if (aCriar.length > 0) {
    const novas = await trelloImportRepo.insertLabels(aCriar);
    for (const n of novas ?? []) idxExist.set(chave(n.nome ?? "", n.cor ?? ""), n.id);
    criadas = novas?.length ?? 0;
  }
  const mapa: Record<string, string> = {};
  for (const l of norm) {
    const id = idxExist.get(chave(l.nome, l.cor));
    if (id) mapa[l.tid] = id;
  }
  return { mapa, criadas };
}

async function resolverListas(
  boardId: string,
  lists: TrelloList[],
  mapaListas: MapaListas,
): Promise<{ mapa: Record<string, string>; criadas: number; mescladas: number }> {
  const boardUuid = requireUuid(boardId, "boardId");
  const ordenadas = [...lists].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  const mapa: Record<string, string> = {};
  let criadas = 0;
  let mescladas = 0;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const existentesRaw = await trelloImportRepo.listBoardListas(boardUuid);

  const existentes = (existentesRaw ?? []) as Array<{
    id: string;
    nome: string;
    posicao: number;
    origem_externa?: string | null;
    origem_id?: string | null;
  }>;

  const posicoesExistentes = await trelloImportRepo.listPosicoesAtivas(boardUuid);

  const qtdPorLista = new Map<string, number>();
  for (const p of posicoesExistentes ?? []) {
    if (p.lista_id) qtdPorLista.set(p.lista_id, (qtdPorLista.get(p.lista_id) ?? 0) + 1);
  }

  const porOrigem = new Map<string, string>();
  const porNome = new Map<string, { id: string; qtd: number; posicao: number }>();
  for (const l of existentes) {
    if (l.origem_externa === "trello" && l.origem_id) porOrigem.set(l.origem_id, l.id);
    const nomeKey = norm(l.nome ?? "");
    if (nomeKey) {
      const qtd = qtdPorLista.get(l.id) ?? 0;
      const atual = porNome.get(nomeKey);
      const melhor = !atual || qtd > atual.qtd || (qtd === atual.qtd && l.posicao > atual.posicao);
      if (melhor) porNome.set(nomeKey, { id: l.id, qtd, posicao: l.posicao });
    }
  }

  const posMaxVal = await trelloImportRepo.getPosicaoMaxLista(boardUuid);
  let proxPos = posMaxVal + 1024;

  type ListaRow = {
    board_id: string;
    nome: string;
    posicao: number;
    cor: string | null;
    arquivada: boolean;
    origem_externa: string;
    origem_id: string;
  };
  const aCriar: Array<{ tid: string; row: ListaRow }> = [];
  for (const l of ordenadas) {
    const alvo = uuidOrNull(mapaListas[l.id]);
    if (alvo) {
      mapa[l.id] = alvo;
      mescladas++;
      continue;
    }
    const existentePorOrigem = porOrigem.get(l.id);
    if (existentePorOrigem) {
      mapa[l.id] = existentePorOrigem;
      mescladas++;
      continue;
    }
    const existentePorNome = porNome.get(norm(l.name ?? ""));
    if (existentePorNome?.id) {
      mapa[l.id] = existentePorNome.id;
      mescladas++;
      await trelloImportRepo.marcarListaOrigemTrello(existentePorNome.id, l.id);
      continue;
    }
    aCriar.push({
      tid: l.id,
      row: {
        board_id: boardUuid,
        nome: (l.name ?? "Sem nome").slice(0, 200),
        posicao: proxPos,
        cor: corPalette(l.color ?? null),
        arquivada: !!l.closed,
        origem_externa: "trello",
        origem_id: l.id,
      },
    });
    proxPos += 1024;
  }
  if (aCriar.length > 0) {
    const { data: novas, error } = await trelloImportRepo.insertBoardListas(
      aCriar.map((a) => a.row),
    );
    if (error) {
      const { data: retry, error: errRetry } = await trelloImportRepo.getBoardListasPorOrigem(
        boardUuid,
        aCriar.map((a) => a.tid),
      );
      if (errRetry || !retry || retry.length !== aCriar.length) throw error;
      for (const row of retry as Array<{ id: string; origem_id: string | null }>) {
        if (row.origem_id) mapa[row.origem_id] = row.id;
      }
      mescladas += retry.length;
      return { mapa, criadas, mescladas };
    }
    novas?.forEach((n: any, i: number) => {
      mapa[aCriar[i].tid] = n.id;
    });
    criadas = novas?.length ?? 0;
  }
  return { mapa, criadas, mescladas };
}

export async function importarBoardTrello(
  opts: ImportarTrelloOpts,
): Promise<ImportarTrelloResultado> {
  const { board, boardId, obraId, criadoPor, setor } = opts;
  const boardUuid = requireUuid(boardId, "boardId");
  const obraUuid = obraId ? requireUuid(obraId, "obraId") : null;
  let autorUuid = uuidOrNull(criadoPor);
  if (!autorUuid) {
    autorUuid = uuidOrNull(await trelloImportRepo.getCurrentUserId());
  }
  if (!autorUuid) {
    throw new Error(
      "Sessão Cloud inválida para importação. Entre novamente e tente importar o Trello.",
    );
  }
  const mapaListas = opts.mapaListas ?? {};
  const incluirArquivados = opts.incluirArquivados ?? true;

  const erros: string[] = [];
  const r: ImportarTrelloResultado = {
    listasCriadas: 0,
    listasMescladas: 0,
    cardsCriados: 0,
    cardsSincronizados: 0,
    labelsCriadas: 0,
    checklistItens: 0,
    comentarios: 0,
    anexos: 0,
    membrosExternos: 0,
    boardMembrosVinculados: 0,
    customFieldsCriados: 0,
    customFieldValores: 0,
    atividadesRegistradas: 0,
    erros,
  };

  const {
    mapa: mapaLista,
    criadas,
    mescladas,
  } = await resolverListas(boardUuid, listasComFallback(board), mapaListas);
  r.listasCriadas = criadas;
  r.listasMescladas = mescladas;

  const { mapa: mapaLabels, criadas: labelsCriadas } = await upsertLabels(board.labels ?? []);
  r.labelsCriadas = labelsCriadas;

  // Custom fields
  const cfDefs = board.customFields ?? [];
  const mapaCustomField = new Map<string, string>();
  if (cfDefs.length > 0) {
    // TODO(ARC-001/E-01): tabela `card_custom_fields` inexistente no schema atual.
    const existentes = await trelloImportRepo.listCustomFields(cfDefs.map((f) => f.id));
    for (const e of existentes ?? []) {
      if (e.external_id) mapaCustomField.set(e.external_id, e.id);
    }
    const aCriar = cfDefs
      .filter((f) => !mapaCustomField.has(f.id))
      .map((f) => ({
        fonte: "trello",
        external_id: f.id,
        nome: f.name,
        tipo: f.type,
        options: (f.options ?? []).map((o) => ({
          id: o.id,
          label: o.value?.text ?? "",
          color: o.color,
        })),
      }));
    if (aCriar.length > 0) {
      const { data: novos, error } = await trelloImportRepo.insertCustomFields(aCriar);
      if (error) erros.push(`Custom fields: ${error.message}`);
      else {
        for (const n of novos ?? []) if (n.external_id) mapaCustomField.set(n.external_id, n.id);
        r.customFieldsCriados = novos?.length ?? 0;
      }
    }
  }

  // Membros + matching com profiles (por login/nome normalizado — profiles não guarda e-mail real)
  const normalizarTexto = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  const mapaMember = new Map<string, TrelloMember>();
  for (const m of board.members ?? []) mapaMember.set(m.id, m);
  const mapaMemberProfile = new Map<string, string>();
  if ((board.members ?? []).length > 0) {
    const profs = await trelloImportRepo.listAllProfiles();
    const porLogin = new Map<string, string>();
    const porNome = new Map<string, string>();
    for (const p of profs ?? []) {
      const pid = uuidOrNull((p as any).id);
      if (!pid) continue;
      const login = (p as any).login ? normalizarTexto(String((p as any).login)) : "";
      const nome = (p as any).nome ? normalizarTexto(String((p as any).nome)) : "";
      if (login) porLogin.set(login, pid);
      if (nome) porNome.set(nome, pid);
    }
    for (const m of board.members ?? []) {
      const username = m.username ? normalizarTexto(m.username) : "";
      const fullName = m.fullName ? normalizarTexto(m.fullName) : "";
      const pid =
        (username && porLogin.get(username)) ||
        (fullName && porNome.get(fullName)) ||
        (username && porNome.get(username)) ||
        null;
      if (pid) mapaMemberProfile.set(m.id, pid);
    }
    const naoVinculados = (board.members ?? []).filter((m) => !mapaMemberProfile.has(m.id));
    if (naoVinculados.length > 0) {
      erros.push(
        `Membros não vinculados automaticamente (adicione manualmente ao board): ${naoVinculados
          .map((m) => m.fullName || m.username || m.id)
          .join(", ")}`,
      );
    }
    const rows = Array.from(new Set(mapaMemberProfile.values())).map((uid) => ({
      board_id: boardUuid,
      user_id: uid,
      papel: "membro" as const,
    }));
    if (rows.length > 0) {
      const { error } = await trelloImportRepo.upsertBoardMembros(rows);
      if (!error) r.boardMembrosVinculados = rows.length;
    }
  }

  // Index comentários e atividades
  const comentariosPorCard = new Map<string, TrelloAction[]>();
  const atividadesPorCard = new Map<string, TrelloAction[]>();
  for (const a of board.actions ?? []) {
    const data = (a.data ?? {}) as { card?: { id?: string } };
    const cid = data.card?.id;
    if (!cid) continue;
    if (a.type === "commentCard" || a.type === "copyCommentCard") {
      const arr = comentariosPorCard.get(cid) ?? [];
      arr.push(a);
      comentariosPorCard.set(cid, arr);
    } else if (EVENTOS_ATIVIDADE.has(a.type)) {
      const arr = atividadesPorCard.get(cid) ?? [];
      arr.push(a);
      atividadesPorCard.set(cid, arr);
    }
  }

  const checklistsPorCard = new Map<string, TrelloChecklist[]>();
  for (const cl of board.checklists ?? []) {
    const arr = checklistsPorCard.get(cl.idCard) ?? [];
    arr.push(cl);
    checklistsPorCard.set(cl.idCard, arr);
  }

  // Posições por lista (rank por índice ×1024)
  const cardsPorLista = new Map<string, TrelloCard[]>();
  for (const c of board.cards ?? []) {
    if (!c.idList) continue;
    const arr = cardsPorLista.get(c.idList) ?? [];
    arr.push(c);
    cardsPorLista.set(c.idList, arr);
  }
  const posicaoCard = new Map<string, number>();
  for (const [, arr] of cardsPorLista) {
    arr.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    arr.forEach((c, i) => posicaoCard.set(c.id, (i + 1) * 1024));
  }

  const listsClosed = new Map<string, boolean>();
  for (const l of board.lists ?? []) listsClosed.set(l.id, !!l.closed);

  // Indexação para evitar duplicatas e permitir re-importação (sync)
  const trelloCardIds = (board.cards ?? []).map((c) => c.id).filter(Boolean);
  const mapaExistingCards = new Map<string, string>();
  if (trelloCardIds.length > 0) {
    const existing = await trelloImportRepo.listCardsExistentes(trelloCardIds);
    for (const e of (existing ?? []) as Array<{ id: string; origem_id: string | null }>) {
      if (e.origem_id) mapaExistingCards.set(e.origem_id, e.id);
    }
  }

  for (const card of board.cards ?? []) {
    if (card.closed && !incluirArquivados) continue;

    const arquivado = !!card.closed || !!listsClosed.get(card.idList);
    const listaUuid = mapaLista[card.idList];

    let coverUrl: string | null = null;
    let coverColor: string | null = null;
    const idCover = card.idAttachmentCover ?? card.cover?.idAttachment ?? null;
    if (idCover) {
      const att = (card.attachments ?? []).find((a) => a.id === idCover);
      if (att?.url) coverUrl = att.url;
    }
    if (!coverUrl) {
      const scaled = card.cover?.scaled?.[card.cover.scaled.length - 1]?.url ?? null;
      if (scaled) coverUrl = scaled;
    }
    if (!coverUrl) coverColor = corPalette(card.cover?.color ?? null);

    const existingId = mapaExistingCards.get(card.id);
    const cardPayload = {
      tipo: "generico",
      titulo: (card.name ?? "(sem título)").slice(0, 500),
      descricao: card.desc ?? null,
      status: "aberto",
      obra_id: obraUuid,
      prazo: safeDate(card.due),
      arquivado,
      criado_por: autorUuid,
      data_inicio: safeDate(card.start ?? null),
      due_complete: !!card.dueComplete,
      cover_color: coverColor,
      cover_url: coverUrl,
      capa_cor: coverColor,
      capa_url: coverUrl,
      posicao: posicaoCard.get(card.id) ?? null,
      origem_externa: "trello",
      origem_url: card.shortUrl ?? card.url ?? null,
      origem_id: card.id,
    };

    let novoCardId: string;
    if (existingId) {
      // TODO(ARC-001/E-01): `cards.status` é enum mas trello envia string livre; campos extras não estão no schema.
      const { error: errUpdate } = await trelloImportRepo.updateCard(existingId, cardPayload);
      if (errUpdate) {
        erros.push(`Card Sync "${card.name}": ${errUpdate.message}`);
        continue;
      }
      novoCardId = existingId;
      r.cardsSincronizados++;
      // Limpa dados voláteis para re-importar (labels e checklist)
      await trelloImportRepo.clearCardVolatile(novoCardId);
    } else {
      const { data: inserido, error: errCard } =
        await trelloImportRepo.insertCardReturningId(cardPayload);
      if (errCard || !inserido) {
        erros.push(`Card "${card.name}": ${errCard?.message ?? "falha"}`);
        continue;
      }
      novoCardId = inserido.id;
      r.cardsCriados++;
    }

    if (setor) {
      const { error } = await trelloImportRepo.upsertCardSetor(novoCardId, setor);
      if (error) erros.push(`Setor "${card.name}": ${error.message}`);
    }

    if (listaUuid) {
      // Triggers (cards_auto_board_posicao / card_setores_auto_board_posicao)
      // podem já ter inserido uma linha na 1ª lista do board. Fazemos upsert
      // para que a lista/posicao corretas do Trello prevaleçam.
      const { error } = await trelloImportRepo.upsertCardBoardPosicao({
        card_id: novoCardId,
        board_id: boardUuid,
        lista_id: listaUuid,
        posicao: posicaoCard.get(card.id) ?? 1024,
        arquivada: arquivado,
      });
      if (error) erros.push(`Posição "${card.name}": ${error.message}`);
    }

    const linksLabels = (card.idLabels ?? [])
      .map((idl) => mapaLabels[idl])
      .filter(Boolean)
      .map((labelId) => ({ card_id: novoCardId, label_id: labelId }));
    if (linksLabels.length > 0) {
      const { error } = await trelloImportRepo.insertLabelLinks(linksLabels);
      if (error) erros.push(`Labels "${card.name}": ${error.message}`);
    }

    const cls = checklistsPorCard.get(card.id) ?? [];
    type ChkRow = {
      card_id: string;
      grupo: string;
      texto: string;
      concluido: boolean;
      ordem: number;
      responsavel_id: string | null;
      prazo: string | null;
    };
    const itensInsert: ChkRow[] = [];
    const clsOrden = [...cls].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    for (const cl of clsOrden) {
      const grupo = (cl.name ?? "Checklist").slice(0, 200);
      const ordenado = [...(cl.checkItems ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
      ordenado.forEach((it, idx) => {
        itensInsert.push({
          card_id: novoCardId,
          grupo,
          texto: (it.name ?? "").slice(0, 1000) || "(item)",
          concluido: it.state === "complete",
          ordem: idx,
          responsavel_id: (it.idMember && mapaMemberProfile.get(it.idMember)) || null,
          prazo: safeDate(it.due ?? null),
        });
      });
    }
    if (itensInsert.length > 0) {
      const { error } = await trelloImportRepo.insertChecklistItens(itensInsert);
      if (error) erros.push(`Checklist "${card.name}": ${error.message}`);
      else r.checklistItens += itensInsert.length;
    }

    const cmts = comentariosPorCard.get(card.id) ?? [];
    const cmtsInsert = cmts
      .map((a) => ({ a, txt: String((a.data as any)?.text ?? "").trim() }))
      .filter((x) => x.txt.length > 0)
      .map(({ a, txt }) => ({
        card_id: novoCardId,
        autor: a.memberCreator?.fullName || a.memberCreator?.username || "Trello",
        texto: txt.slice(0, 5000),
        created_at: a.date,
      }));
    if (cmtsInsert.length > 0) {
      const { error } = await trelloImportRepo.insertComentarios(cmtsInsert);
      if (error) erros.push(`Comentários "${card.name}": ${error.message}`);
      else r.comentarios += cmtsInsert.length;
    }

    const anxInsert = (card.attachments ?? [])
      .filter((a) => !!a.url)
      .map((a) => ({
        card_id: novoCardId,
        nome: (a.name ?? a.url).slice(0, 300),
        storage_path: a.url,
        tamanho: a.bytes ?? null,
        mime: a.mimeType ?? null,
        enviado_por:
          (a.idMember &&
            (mapaMember.get(a.idMember)?.fullName || mapaMember.get(a.idMember)?.username)) ||
          autorUuid,
      }));
    if (anxInsert.length > 0) {
      const { error } = await trelloImportRepo.insertAnexos(anxInsert);
      if (error) erros.push(`Anexos "${card.name}": ${error.message}`);
      else r.anexos += anxInsert.length;
    }

    const memIds = card.idMembers ?? [];
    if (memIds.length > 0) {
      const memRows = memIds
        .map((mid) => mapaMember.get(mid))
        .filter((m): m is TrelloMember => !!m)
        .map((m) => ({
          card_id: novoCardId,
          fonte: "trello",
          external_id: m.id,
          nome: m.fullName ?? m.username ?? "(sem nome)",
          username: m.username ?? null,
          avatar_url: m.avatarUrl ?? null,
        }));
      if (memRows.length > 0) {
        // TODO(ARC-001/E-01): card_membros_externos schema não tem username/avatar_url.
        const { error } = await trelloImportRepo.insertMembrosExternos(memRows);
        if (error) erros.push(`Membros "${card.name}": ${error.message}`);
        else r.membrosExternos += memRows.length;
      }
    }

    const cfItems = card.customFieldItems ?? [];
    if (cfItems.length > 0 && mapaCustomField.size > 0) {
      const valores: Array<{
        card_id: string;
        field_id: string;
        valor_texto: string | null;
        valor_numero: number | null;
        valor_data: string | null;
        valor_bool: boolean | null;
        valor_option: string | null;
      }> = [];
      for (const it of cfItems) {
        const dbField = mapaCustomField.get(it.idCustomField);
        if (!dbField) continue;
        const def = cfDefs.find((f) => f.id === it.idCustomField);
        let valor_option: string | null = null;
        if (it.idValue && def?.options) {
          valor_option = def.options.find((o) => o.id === it.idValue)?.value?.text ?? null;
        }
        valores.push({
          card_id: novoCardId,
          field_id: dbField,
          valor_texto: it.value?.text ?? null,
          valor_numero: it.value?.number != null ? Number(it.value.number) : null,
          valor_data: safeIsoTs(it.value?.date ?? null),
          valor_bool: it.value?.checked != null ? it.value.checked === "true" : null,
          valor_option,
        });
      }
      if (valores.length > 0) {
        // TODO(ARC-001/E-01): card_custom_field_valores schema usa `campo_id`+`valor`; código usa `field_id`+valor_*.
        const { error } = await trelloImportRepo.insertCustomFieldValores(valores);
        if (error) erros.push(`Custom fields "${card.name}": ${error.message}`);
        else r.customFieldValores += valores.length;
      }
    }

    const atvs = atividadesPorCard.get(card.id) ?? [];
    if (atvs.length > 0) {
      const rows = atvs.map((a) => {
        const data = (a.data ?? {}) as Record<string, any>;
        let detalhe: Record<string, any> = {};
        if (a.type === "updateCard" && data.old && data.card) {
          const campos = Object.keys(data.old);
          detalhe = {
            campos,
            antes: data.old,
            depois: campos.reduce((acc: any, k: string) => {
              acc[k] = data.card?.[k];
              return acc;
            }, {}),
          };
        } else if (a.type === "addAttachmentToCard" || a.type === "deleteAttachmentFromCard") {
          detalhe = { attachment: data.attachment };
        } else if (a.type === "addChecklistToCard" || a.type === "removeChecklistFromCard") {
          detalhe = { checklist: data.checklist };
        } else if (a.type === "updateCheckItemStateOnCard") {
          detalhe = { checkItem: data.checkItem, state: data.checkItem?.state };
        } else if (a.type === "addMemberToCard" || a.type === "removeMemberFromCard") {
          detalhe = { member: data.member };
        } else if (a.type === "copyCard") {
          detalhe = { de: data.cardSource };
        }
        return {
          card_id: novoCardId,
          ator_id: null as string | null,
          ator_nome: a.memberCreator?.fullName || a.memberCreator?.username || "Trello",
          evento: a.type,
          detalhe: detalhe as any,
          created_at: a.date,
        };
      });
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await trelloImportRepo.insertAtividades(slice);
        if (error) erros.push(`Atividades "${card.name}": ${error.message}`);
        else r.atividadesRegistradas += slice.length;
      }
    }
  }

  return r;
}
