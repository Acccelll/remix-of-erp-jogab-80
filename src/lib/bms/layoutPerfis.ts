/** @module-kind pure */
// PRO-018 · slice-03 — Perfis de layout BMS reutilizáveis (regras puras).
// Um perfil captura um `ColMap` reconhecido em uma aba e permite reutilizar
// o mesmo mapeamento em importações futuras (mesmo cliente/gerenciadora).

import type { BmsDiagnostico, BmsWorkbook } from "./excel";

export const CHAVES_COL_MAP = [
  "item", "desc", "qtd", "um", "preco", "total",
  "qa", "va", "qm", "vm", "qac", "vac", "sq", "sv",
] as const;
export type ChaveColMap = (typeof CHAVES_COL_MAP)[number];

export type BmsLayoutPerfil = {
  id: string;
  nome: string;
  cliente?: string;
  headerRow: number;
  colunas: Record<ChaveColMap, number>;
  criadoEm: string;
  /** PRO-018 · slice-08 — controle de versão do perfil (>=1). */
  versao: number;
  /** PRO-018 · slice-08 — ISO da última alteração. */
  atualizadoEm: string;
};

export type BmsLayoutPerfilInput = Omit<
  BmsLayoutPerfil,
  "id" | "criadoEm" | "versao" | "atualizadoEm"
>;

export type BmsLayoutPerfisExport = {
  tipo: "gestaobra.bms-layout-perfis";
  versao: 1;
  exportadoEm: string;
  perfis: BmsLayoutPerfil[];
};

export type ImportarPerfisResultado = {
  perfis: BmsLayoutPerfil[];
  importados: number;
  atualizados: number;
  /** PRO-018 · slice-08 — perfis mantidos por serem mais recentes que os importados. */
  preservados: number;
};

const RE_ID = /^[a-z0-9]{6,}$/i;

function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function validarPerfil(p: BmsLayoutPerfilInput): void {
  if (!p.nome?.trim()) throw new Error("Nome do perfil obrigatório.");
  if (!Number.isFinite(p.headerRow) || p.headerRow < 0) {
    throw new Error("headerRow inválido.");
  }
  for (const k of CHAVES_COL_MAP) {
    const v = p.colunas[k];
    if (!Number.isFinite(v) || (v as number) < 0) {
      throw new Error(`Coluna "${k}" inválida no perfil.`);
    }
  }
}

export function criarPerfil(
  input: BmsLayoutPerfilInput,
  agora: () => Date = () => new Date(),
): BmsLayoutPerfil {
  validarPerfil(input);
  const iso = agora().toISOString();
  return {
    id: novoId(),
    nome: input.nome.trim(),
    cliente: input.cliente?.trim() || undefined,
    headerRow: Math.trunc(input.headerRow),
    colunas: { ...input.colunas },
    criadoEm: iso,
    versao: 1,
    atualizadoEm: iso,
  };
}

function dataIsoValida(valor: unknown): valor is string {
  return typeof valor === "string" && Number.isFinite(Date.parse(valor));
}

function normalizarPerfilImportado(
  raw: unknown,
  idx: number,
  agora: () => Date,
): BmsLayoutPerfil {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Perfil ${idx + 1} inválido no arquivo JSON.`);
  }
  const obj = raw as Partial<BmsLayoutPerfil>;
  const colunas = {} as Record<ChaveColMap, number>;
  for (const k of CHAVES_COL_MAP) {
    const v = obj.colunas?.[k];
    if (!Number.isFinite(v)) {
      throw new Error(`Perfil ${idx + 1}: coluna "${k}" inválida.`);
    }
    colunas[k] = Math.trunc(v as number);
  }
  const input: BmsLayoutPerfilInput = {
    nome: String(obj.nome ?? "").trim(),
    cliente: typeof obj.cliente === "string" ? obj.cliente.trim() || undefined : undefined,
    headerRow: Math.trunc(Number(obj.headerRow)),
    colunas,
  };
  validarPerfil(input);
  const criadoEm = dataIsoValida(obj.criadoEm) ? obj.criadoEm : agora().toISOString();
  const versaoRaw = Number((obj as any).versao);
  const versao = Number.isFinite(versaoRaw) && versaoRaw >= 1 ? Math.trunc(versaoRaw) : 1;
  const atualizadoEm = dataIsoValida((obj as any).atualizadoEm)
    ? (obj as any).atualizadoEm
    : criadoEm;
  return {
    id: typeof obj.id === "string" && isPerfilId(obj.id) ? obj.id : novoId(),
    ...input,
    criadoEm,
    versao,
    atualizadoEm,
  };
}

/** PRO-018 · slice-07 — exporta perfis em payload JSON versionado. */
export function exportarPerfisJson(
  perfis: BmsLayoutPerfil[],
  agora: () => Date = () => new Date(),
): string {
  const payload: BmsLayoutPerfisExport = {
    tipo: "gestaobra.bms-layout-perfis",
    versao: 1,
    exportadoEm: agora().toISOString(),
    perfis: perfis.map((p) => ({ ...p, colunas: { ...p.colunas } })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * PRO-018 · slice-08 — importa payload versionado com resolução de conflito
 * por `versao`/`atualizadoEm`: mantém o perfil mais recente entre existente
 * e importado. Retorna contagens de importados, atualizados e preservados.
 */
export function importarPerfisJson(
  json: string,
  existentes: BmsLayoutPerfil[] = [],
  agora: () => Date = () => new Date(),
): ImportarPerfisResultado {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Arquivo JSON de perfis inválido.");
  }

  const rawPerfis: unknown[] | null = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as any).perfis)
      ? (parsed as any).perfis
      : null;
  if (!rawPerfis) throw new Error("Arquivo JSON não contém perfis de layout.");

  let lista = [...existentes];
  let importados = 0;
  let atualizados = 0;
  let preservados = 0;
  rawPerfis.forEach((raw, idx) => {
    const perfil = normalizarPerfilImportado(raw, idx, agora);
    const atual = lista.find((p) => p.id === perfil.id);
    if (!atual) {
      lista = upsertPerfil(lista, perfil);
      importados += 1;
      return;
    }
    if (ehMaisRecente(perfil, atual)) {
      lista = upsertPerfil(lista, perfil);
      atualizados += 1;
    } else {
      preservados += 1;
    }
  });
  return { perfis: lista, importados, atualizados, preservados };
}

function ehMaisRecente(a: BmsLayoutPerfil, b: BmsLayoutPerfil): boolean {
  if (a.versao !== b.versao) return a.versao > b.versao;
  return Date.parse(a.atualizadoEm) > Date.parse(b.atualizadoEm);
}

/**
 * PRO-018 · slice-10 — analisa payload para preview antes de aplicar,
 * classificando cada perfil como "novo", "conflito" (existe e difere) ou
 * "identico" (existe sem diferenças). Não altera estado.
 */
export type BmsLayoutImportItem = {
  perfil: BmsLayoutPerfil;
  atual?: BmsLayoutPerfil;
  status: "novo" | "conflito" | "identico";
  diff: BmsLayoutDiffCampo[];
  sugestao: "importar" | "preservar";
};

export function analisarImportacaoPerfis(
  json: string,
  existentes: BmsLayoutPerfil[] = [],
  agora: () => Date = () => new Date(),
): BmsLayoutImportItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Arquivo JSON de perfis inválido.");
  }
  const rawPerfis = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as any).perfis)
      ? (parsed as any).perfis
      : null;
  if (!rawPerfis) throw new Error("Arquivo JSON não contém perfis de layout.");

  return rawPerfis.map((raw: unknown, idx: number) => {
    const perfil = normalizarPerfilImportado(raw, idx, agora);
    const atual = existentes.find((p) => p.id === perfil.id);
    if (!atual) {
      return { perfil, status: "novo", diff: [], sugestao: "importar" } as BmsLayoutImportItem;
    }
    const diff = diffPerfis(atual, perfil);
    if (diff.length === 0) {
      return { perfil, atual, status: "identico", diff, sugestao: "preservar" };
    }
    return {
      perfil,
      atual,
      status: "conflito",
      diff,
      sugestao: ehMaisRecente(perfil, atual) ? "importar" : "preservar",
    };
  });
}

/** PRO-018 · slice-12 — decisão do preview (importar/preservar/mesclar). */
export type BmsLayoutImportDecisao =
  | { perfil: BmsLayoutPerfil; acao: "importar" | "preservar" }
  | { perfil: BmsLayoutPerfil; acao: "mesclar"; campos: BmsLayoutDiffCampo[] };

/** PRO-018 · slice-10/12 — aplica decisões manuais do preview. */
export function aplicarImportacaoPerfis(
  existentes: BmsLayoutPerfil[],
  decisoes: BmsLayoutImportDecisao[],
  agora: () => Date = () => new Date(),
): ImportarPerfisResultado {
  let lista = [...existentes];
  let importados = 0;
  let atualizados = 0;
  let preservados = 0;
  for (const dec of decisoes) {
    const { perfil, acao } = dec;
    const atual = lista.find((p) => p.id === perfil.id);
    if (acao === "preservar") {
      if (atual) preservados += 1;
      continue;
    }
    if (acao === "mesclar") {
      if (!atual) {
        lista = upsertPerfil(lista, perfil);
        importados += 1;
        continue;
      }
      const mesclado = mergePerfilPorCampos(atual, perfil, dec.campos, agora);
      lista = upsertPerfil(lista, mesclado);
      atualizados += 1;
      continue;
    }
    lista = upsertPerfil(lista, perfil);
    if (atual) atualizados += 1;
    else importados += 1;
  }
  return { perfis: lista, importados, atualizados, preservados };
}

/** PRO-018 · slice-12 — aplica só os campos escolhidos do importado sobre o atual. */
export function mergePerfilPorCampos(
  atual: BmsLayoutPerfil,
  importado: BmsLayoutPerfil,
  campos: BmsLayoutDiffCampo[],
  agora: () => Date = () => new Date(),
): BmsLayoutPerfil {
  const proximo: BmsLayoutPerfil = {
    ...atual,
    colunas: { ...atual.colunas },
  };
  for (const campo of campos) {
    if (campo === "nome") proximo.nome = importado.nome;
    else if (campo === "cliente") proximo.cliente = importado.cliente;
    else if (campo === "headerRow") proximo.headerRow = importado.headerRow;
    else {
      const k = campo.slice("colunas.".length) as ChaveColMap;
      proximo.colunas[k] = importado.colunas[k];
    }
  }
  validarPerfil({
    nome: proximo.nome,
    cliente: proximo.cliente,
    headerRow: proximo.headerRow,
    colunas: proximo.colunas,
  });
  proximo.versao = (atual.versao ?? 1) + 1;
  proximo.atualizadoEm = agora().toISOString();
  return proximo;
}

/** Extrai um perfil a partir de um diagnóstico já reconhecido pelo parser. */
export function perfilAPartirDeDiagnostico(
  diag: BmsDiagnostico,
  nome: string,
  cliente?: string,
): BmsLayoutPerfilInput {
  const colunas = {} as Record<ChaveColMap, number>;
  for (const k of CHAVES_COL_MAP) {
    const v = (diag.colunas as Record<string, number>)[k];
    if (!Number.isFinite(v)) {
      throw new Error(`Diagnóstico não contém a coluna "${k}".`);
    }
    colunas[k] = v as number;
  }
  return { nome, cliente, headerRow: diag.headerRow, colunas };
}

export function upsertPerfil(
  lista: BmsLayoutPerfil[],
  perfil: BmsLayoutPerfil,
): BmsLayoutPerfil[] {
  const idx = lista.findIndex((p) => p.id === perfil.id);
  if (idx < 0) return [...lista, perfil];
  const copia = [...lista];
  copia[idx] = perfil;
  return copia;
}

export function removerPerfil(lista: BmsLayoutPerfil[], id: string): BmsLayoutPerfil[] {
  return lista.filter((p) => p.id !== id);
}

/** PRO-018 · slice-06 — patch parcial validado sobre um perfil existente. */
export type BmsLayoutPerfilPatch = Partial<
  Pick<BmsLayoutPerfil, "nome" | "cliente" | "headerRow"> & {
    colunas: Partial<Record<ChaveColMap, number>>;
  }
>;

export function atualizarPerfil(
  lista: BmsLayoutPerfil[],
  id: string,
  patch: BmsLayoutPerfilPatch,
  agora: () => Date = () => new Date(),
): BmsLayoutPerfil[] {
  const idx = lista.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Perfil não encontrado.");
  const atual = lista[idx];
  const proximo: BmsLayoutPerfil = {
    ...atual,
    nome: patch.nome !== undefined ? patch.nome.trim() : atual.nome,
    cliente:
      patch.cliente !== undefined
        ? patch.cliente.trim() || undefined
        : atual.cliente,
    headerRow:
      patch.headerRow !== undefined ? Math.trunc(patch.headerRow) : atual.headerRow,
    colunas: { ...atual.colunas, ...(patch.colunas ?? {}) } as Record<ChaveColMap, number>,
  };
  validarPerfil({
    nome: proximo.nome,
    cliente: proximo.cliente,
    headerRow: proximo.headerRow,
    colunas: proximo.colunas,
  });
  proximo.versao = (atual.versao ?? 1) + 1;
  proximo.atualizadoEm = agora().toISOString();
  const copia = [...lista];
  copia[idx] = proximo;
  return copia;
}

/** Sugere um perfil elegível quando existem abas ignoradas por cabeçalho. */
export function sugerirPerfilPara(
  wb: BmsWorkbook,
  perfis: BmsLayoutPerfil[],
): BmsLayoutPerfil | null {
  if (wb.ignoradas.length === 0 || perfis.length === 0) return null;
  const ref = wb.sheets[0]?.cliente_unidade?.toLowerCase().trim();
  if (ref) {
    const compat = perfis.find((p) => p.cliente?.toLowerCase().trim() === ref);
    if (compat) return compat;
  }
  return perfis[0] ?? null;
}

export function isPerfilId(id: string): boolean {
  return RE_ID.test(id);
}

/** PRO-018 · slice-09 — campos alterados entre dois perfis (para diff/badges). */
export type BmsLayoutDiffCampo =
  | "nome"
  | "cliente"
  | "headerRow"
  | `colunas.${ChaveColMap}`;

export function diffPerfis(
  a: BmsLayoutPerfil,
  b: BmsLayoutPerfil,
): BmsLayoutDiffCampo[] {
  const campos: BmsLayoutDiffCampo[] = [];
  if (a.nome !== b.nome) campos.push("nome");
  if ((a.cliente ?? "") !== (b.cliente ?? "")) campos.push("cliente");
  if (a.headerRow !== b.headerRow) campos.push("headerRow");
  for (const k of CHAVES_COL_MAP) {
    if (a.colunas[k] !== b.colunas[k]) campos.push(`colunas.${k}` as const);
  }
  return campos;
}

/** PRO-018 · slice-11 — diff detalhado com valores lado a lado. */
export type BmsLayoutDiffLinha = {
  campo: BmsLayoutDiffCampo;
  atual: string;
  importado: string;
};

function valorCampo(p: BmsLayoutPerfil, campo: BmsLayoutDiffCampo): string {
  if (campo === "nome") return p.nome;
  if (campo === "cliente") return p.cliente ?? "";
  if (campo === "headerRow") return String(p.headerRow);
  const key = campo.slice("colunas.".length) as ChaveColMap;
  return String(p.colunas[key]);
}

export function detalharDiffPerfis(
  atual: BmsLayoutPerfil,
  importado: BmsLayoutPerfil,
): BmsLayoutDiffLinha[] {
  return diffPerfis(atual, importado).map((campo) => ({
    campo,
    atual: valorCampo(atual, campo),
    importado: valorCampo(importado, campo),
  }));
}


