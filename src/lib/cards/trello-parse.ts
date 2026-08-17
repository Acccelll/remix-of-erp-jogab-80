/** @module-kind pure */
/**
 * Domínio puro do importador Trello.
 *
 * Mantém os tipos e normalizadores sem dependência de persistência para que
 * CSV/JSON e a orquestração de importação compartilhem a mesma semântica.
 */
import { CORES_PALETA, isHexCor } from "@/lib/cards/cores";

export type TrelloColor =
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "blue"
  | "sky"
  | "lime"
  | "pink"
  | "black"
  | "null"
  | string;

export interface TrelloList {
  id: string;
  name: string;
  closed?: boolean;
  pos?: number;
  color?: string | null;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: TrelloColor | null;
}

export interface TrelloCheckItem {
  id?: string;
  name: string;
  state: "complete" | "incomplete";
  pos?: number;
  due?: string | null;
  idMember?: string | null;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  idCard: string;
  pos?: number;
  checkItems: TrelloCheckItem[];
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  mimeType?: string | null;
  bytes?: number | null;
  date?: string | null;
  idMember?: string | null;
  isUpload?: boolean;
}

export interface TrelloCover {
  idAttachment?: string | null;
  color?: string | null;
  scaled?: Array<{ url: string }>;
  size?: string;
  brightness?: string;
}

export interface TrelloCustomFieldOption {
  id: string;
  value?: { text?: string };
  color?: string;
  pos?: number;
}

export interface TrelloCustomField {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "checkbox" | "list" | string;
  options?: TrelloCustomFieldOption[];
}

export interface TrelloCustomFieldItem {
  idCustomField: string;
  idValue?: string;
  value?: { text?: string; number?: string; date?: string; checked?: string };
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  idLabels?: string[];
  due?: string | null;
  closed?: boolean;
  pos?: number;
  attachments?: TrelloAttachment[];
  start?: string | null;
  dueComplete?: boolean;
  shortUrl?: string;
  url?: string;
  idMembers?: string[];
  idAttachmentCover?: string | null;
  cover?: TrelloCover | null;
  customFieldItems?: TrelloCustomFieldItem[];
  dateLastActivity?: string | null;
}

export interface TrelloAction {
  type: string;
  date: string;
  data?: Record<string, unknown>;
  memberCreator?: { id?: string; fullName?: string; username?: string };
}

export interface TrelloMember {
  id: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string | null;
  email?: string | null;
}

export interface TrelloBoardJson {
  name?: string;
  lists: TrelloList[];
  cards: TrelloCard[];
  labels: TrelloLabel[];
  checklists?: TrelloChecklist[];
  actions?: TrelloAction[];
  members?: TrelloMember[];
  customFields?: TrelloCustomField[];
}

export type MapaListas = Record<string, string | null>;

const COR_TRELLO_HEX: Record<string, string> = {
  green: "#22c55e",
  lime: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
  purple: "#a855f7",
  blue: "#3b82f6",
  sky: "#14b8a6",
  black: "#111827",
};

export function corPalette(c?: string | null): string | null {
  if (!c) return null;
  if (isHexCor(c)) return c;
  const hex = COR_TRELLO_HEX[String(c).toLowerCase()];
  if (!hex) return null;
  return CORES_PALETA.find((p) => p.value.toLowerCase() === hex.toLowerCase())?.value ?? hex;
}

export function corLabelTrello(c: TrelloColor | null | undefined): string {
  return corPalette(c ?? null) ?? "#9CA3AF";
}

export function safeDate(due?: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function safeIsoTs(due?: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function listasComFallback(board: TrelloBoardJson): TrelloList[] {
  const porId = new Map<string, TrelloList>();
  for (const l of board.lists ?? []) if (l.id) porId.set(l.id, l);
  for (const c of board.cards ?? []) {
    if (c.idList && !porId.has(c.idList)) {
      porId.set(c.idList, {
        id: c.idList,
        name: `Lista ${c.idList}`,
        closed: false,
        pos: Number.MAX_SAFE_INTEGER,
      });
    }
  }
  return Array.from(porId.values());
}

export const EVENTOS_ATIVIDADE = new Set([
  "createCard",
  "copyCard",
  "convertToCardFromCheckItem",
  "addAttachmentToCard",
  "deleteAttachmentFromCard",
  "addChecklistToCard",
  "removeChecklistFromCard",
  "updateCheckItemStateOnCard",
  "addMemberToCard",
  "removeMemberFromCard",
  "updateCard",
]);