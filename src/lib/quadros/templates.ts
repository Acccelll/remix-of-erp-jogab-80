/** @module-kind pure */
/**
 * Templates de listas para boards (Fase C).
 *
 * Função pura: dado um tipo de template, retorna a sequência de listas
 * (nome + posição + wip opcional) a serem criadas. A persistência fica
 * a cargo do consumidor.
 */

export type TemplateId = "generico" | "compras" | "producao" | "obra";

export interface ListaTemplate {
  nome: string;
  posicao: number;
  wip_limite: number | null;
}

const RAW: Record<TemplateId, Array<Omit<ListaTemplate, "posicao">>> = {
  generico: [
    { nome: "A fazer", wip_limite: null },
    { nome: "Em andamento", wip_limite: null },
    { nome: "Aguardando", wip_limite: null },
    { nome: "Concluído", wip_limite: null },
  ],
  obra: [
    { nome: "A fazer", wip_limite: null },
    { nome: "Em andamento", wip_limite: null },
    { nome: "Aguardando", wip_limite: null },
    { nome: "Bloqueado", wip_limite: null },
    { nome: "Concluído", wip_limite: null },
  ],
  compras: [
    { nome: "Requisitado", wip_limite: null },
    { nome: "Cotação", wip_limite: 5 },
    { nome: "OC", wip_limite: null },
    { nome: "Recebido", wip_limite: null },
  ],
  producao: [
    { nome: "Fila", wip_limite: null },
    { nome: "Corte", wip_limite: 3 },
    { nome: "Dobra", wip_limite: 3 },
    { nome: "Solda", wip_limite: 3 },
    { nome: "Pronto", wip_limite: null },
  ],
};

export function listasDoTemplate(template: TemplateId): ListaTemplate[] {
  const base = RAW[template] ?? RAW.generico;
  return base.map((l, i) => ({ ...l, posicao: i }));
}

export const TEMPLATES_DISPONIVEIS: ReadonlyArray<{ id: TemplateId; label: string }> = [
  { id: "generico", label: "Genérico" },
  { id: "obra", label: "Obra" },
  { id: "compras", label: "Compras" },
  { id: "producao", label: "Produção" },
];
