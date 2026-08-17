/** @module-kind pure */
/**
 * Fallback CSV → TrelloBoardJson mínimo.
 *
 * O CSV do Trello é uma versão simplificada: contém Card ID, Card Name,
 * Description, Labels (string), Members (string), Due Date, Counts de
 * checklist (sem itens), Comment Count (sem texto), List ID/Name, Custom
 * Fields como colunas extras.
 *
 * Esta função reconstrói uma estrutura compatível com `importarBoardTrello`,
 * preservando o que é possível: cards, listas, labels (apenas nomes),
 * datas, custom fields (como tipo text), idMembers a partir de nomes.
 *
 * Perdas conhecidas vs JSON: itens de checklist, comentários, attachments
 * reais, membros com avatar/username e cover.
 */
import type {
  TrelloBoardJson,
  TrelloCard,
  TrelloLabel,
  TrelloList,
} from "@/lib/cards/trello-parse";

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let cell = "";
  let inQ = false;
  const row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" && !inQ) {
      row.push(cell);
      rows.push([...row]);
      row.length = 0;
      cell = "";
      continue;
    }
    if (ch === "\r" && !inQ) continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const KNOWN = new Set([
  "Card ID",
  "Card Name",
  "Card URL",
  "Card Description",
  "Labels",
  "Members",
  "Due Date",
  "Attachment Count",
  "Attachment Links",
  "Checklist Item Total Count",
  "Checklist Item Completed Count",
  "Vote Count",
  "Comment Count",
  "Last Activity Date",
  "List ID",
  "List Name",
  "Board ID",
  "Board Name",
  "Archived",
  "Start Date",
  "Due Complete",
  "Due Reminder",
]);

export function parseTrelloCsv(text: string): TrelloBoardJson {
  const grid = splitCsv(text.replace(/^\uFEFF/, ""));
  if (grid.length === 0) return { lists: [], cards: [], labels: [] };
  const header = grid[0];
  const idx = (k: string) => header.indexOf(k);

  const customColumns = header.filter((h) => h && !KNOWN.has(h));

  const lists = new Map<string, TrelloList>();
  const labels = new Map<string, TrelloLabel>();
  const cards: TrelloCard[] = [];
  let boardId = "";
  let boardName = "";

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => !c?.trim())) continue;
    const get = (k: string) => {
      const i = idx(k);
      return i >= 0 ? row[i] : "";
    };

    boardId = boardId || get("Board ID");
    boardName = boardName || get("Board Name");

    const listId = get("List ID");
    const listName = get("List Name");
    if (listId && !lists.has(listId)) {
      lists.set(listId, { id: listId, name: listName, closed: false });
    }

    // Labels: "EM ESTOQUE (sky), IMPORTANTE (orange)"
    const labelsRaw = get("Labels");
    const idLabels: string[] = [];
    if (labelsRaw) {
      const parts = labelsRaw
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        const m = p.match(/^(.*)\s\(([^)]+)\)$/);
        const nome = (m ? m[1] : p).trim();
        const cor = m ? m[2] : null;
        const key = `csv:${nome}`;
        if (!labels.has(key)) labels.set(key, { id: key, name: nome, color: cor });
        idLabels.push(key);
      }
    }

    const membersRaw = get("Members");
    const idMembers = membersRaw
      ? membersRaw
          .split(/,\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const customFieldItems = customColumns
      .map((col) => ({ col, val: get(col) }))
      .filter((c) => c.val && c.val.trim() && c.val !== "'-1")
      .map((c) => ({
        idCustomField: `csv:cf:${c.col}`,
        value: { text: c.val },
      }));

    cards.push({
      pos: r * 1024,
      id: get("Card ID") || `csv:${r}`,
      name: get("Card Name"),
      desc: get("Card Description") || undefined,
      idList: listId,
      idLabels,
      due: get("Due Date") || null,
      start: get("Start Date") || null,
      dueComplete: get("Due Complete")?.toLowerCase() === "true",
      closed: get("Archived")?.toLowerCase() === "true",
      shortUrl: get("Card URL") || undefined,
      idMembers,
      customFieldItems,
    });
  }

  const customFields = customColumns.map((col) => ({
    id: `csv:cf:${col}`,
    name: col,
    type: "text" as const,
    options: [],
  }));

  return {
    name: boardName,
    lists: Array.from(lists.values()),
    cards,
    labels: Array.from(labels.values()),
    customFields,
    // members ficam vazios; ids são apenas os nomes (idMembers não casa com members[].id)
    members: [],
  };
}
