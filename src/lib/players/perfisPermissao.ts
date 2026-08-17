/** @module-kind pure */
// PRO-028 · slice-01 — Perfis reutilizáveis de permissões.
//
// Objetivo: permitir que o GM defina "perfis" (papéis) com um mapa de
// acessos por página e aplique esses perfis a novos usuários sem redigitar
// a matriz. Persistência inicial local (`gestaobra:players:perfisPermissao`);
// integração com a matriz real por página fica em slice-02.
//
// Regras puras (sem I/O). O hook cuida da persistência.

import type { NivelAcesso, PageKey, Player } from "@/types";

export interface PerfilPermissao {
  id: string;
  nome: string;
  descricao?: string;
  acessos: Record<PageKey, NivelAcesso>;
  createdAt: string;
  updatedAt: string;
}

/** Todas as páginas que compõem a matriz de acesso. */
export const PAGINAS_PERMISSAO: readonly PageKey[] = [
  "rh",
  "dp",
  "patrimonios",
  "frotas",
  "obras_div",
  "admin",
  "financeiro",
  "contratos",
  "almoxarifado",
  "crm",
] as const;

/** Mapa "tudo nenhum" — ponto de partida seguro. */
export function acessosVazios(): Record<PageKey, NivelAcesso> {
  return PAGINAS_PERMISSAO.reduce(
    (acc, k) => {
      acc[k] = "nenhum";
      return acc;
    },
    {} as Record<PageKey, NivelAcesso>,
  );
}

/** Normaliza um mapa parcial, preenchendo páginas faltantes com "nenhum". */
export function normalizarAcessos(
  parcial: Partial<Record<PageKey, NivelAcesso>> | undefined | null,
): Record<PageKey, NivelAcesso> {
  const base = acessosVazios();
  if (!parcial) return base;
  for (const k of PAGINAS_PERMISSAO) {
    const v = parcial[k];
    if (v) base[k] = v;
  }
  return base;
}

export interface NovoPerfilInput {
  nome: string;
  descricao?: string;
  acessos: Partial<Record<PageKey, NivelAcesso>>;
}

export interface ValidacaoPerfil {
  ok: boolean;
  erros: string[];
}

/** Regras de validação de um perfil antes de persistir. */
export function validarPerfil(
  input: NovoPerfilInput,
  existentes: PerfilPermissao[],
  ignorarId?: string,
): ValidacaoPerfil {
  const erros: string[] = [];
  const nome = input.nome?.trim() ?? "";
  if (nome.length < 2) erros.push("Nome do perfil deve ter ao menos 2 caracteres.");
  const duplicado = existentes.some(
    (p) => p.id !== ignorarId && p.nome.trim().toLowerCase() === nome.toLowerCase(),
  );
  if (duplicado) erros.push("Já existe um perfil com esse nome.");
  return { ok: erros.length === 0, erros };
}

/** Fábrica de novo perfil com timestamps e mapa normalizado. */
export function criarPerfil(
  input: NovoPerfilInput,
  now: () => Date = () => new Date(),
): PerfilPermissao {
  const iso = now().toISOString();
  return {
    id: `perfil_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() || undefined,
    acessos: normalizarAcessos(input.acessos),
    createdAt: iso,
    updatedAt: iso,
  };
}

/** Deriva um perfil a partir dos acessos de um player. */
export function perfilAPartirDePlayer(
  player: Pick<Player, "acessos">,
  nome: string,
  descricao?: string,
): NovoPerfilInput {
  return { nome, descricao, acessos: normalizarAcessos(player.acessos) };
}

/**
 * Aplica um perfil aos acessos de um player. Se `modo` for `"substituir"`,
 * troca todo o mapa; se `"mesclar"`, mantém acessos já concedidos que sejam
 * mais amplos do que os do perfil (regra conservadora: não reduzir sem
 * intenção explícita — evita rebaixar GM por engano).
 */
export function aplicarPerfilEmPlayer<T extends { acessos: Record<PageKey, NivelAcesso> }>(
  player: T,
  perfil: PerfilPermissao,
  modo: "substituir" | "mesclar" = "substituir",
): T {
  if (modo === "substituir") {
    return { ...player, acessos: { ...perfil.acessos } };
  }
  const atual = normalizarAcessos(player.acessos);
  const combinado = acessosVazios();
  for (const k of PAGINAS_PERMISSAO) {
    combinado[k] = maiorNivel(atual[k], perfil.acessos[k]);
  }
  return { ...player, acessos: combinado };
}

// Hierarquia usada só para a mesclagem conservadora.
const RANK: Record<NivelAcesso, number> = {
  nenhum: 0,
  visualizar: 1,
  editar: 2,
  compras: 3,
  financeiro: 3,
};

function maiorNivel(a: NivelAcesso, b: NivelAcesso): NivelAcesso {
  return RANK[a] >= RANK[b] ? a : b;
}
