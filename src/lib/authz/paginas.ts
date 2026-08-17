/** @module-kind pure */
// PRO-031 · slice-01 — Catálogo de módulos → páginas para o Quadro de Permissões.
// Deriva a lista canônica direto do NAV_REGISTRY, mantendo uma fonte única.

import { NAV_REGISTRY, type NavGroup, type NavItem } from "@/config/navigation";
import type { NivelAcesso, PageKey } from "@/types";

export type AcaoPermissao = "V" | "E" | "X" | "I" | "Ex";

export const ACOES: readonly AcaoPermissao[] = ["V", "E", "X", "I", "Ex"] as const;

export const ACAO_LABEL: Record<AcaoPermissao, string> = {
  V: "Visualizar",
  E: "Editar",
  X: "Excluir",
  I: "Importar",
  Ex: "Exportar",
};

export const ACAO_LABEL_CURTO: Record<AcaoPermissao, string> = {
  V: "V",
  E: "E",
  X: "X",
  I: "I",
  Ex: "Ex",
};

export interface PaginaPermissao {
  rota: string;
  rotulo: string;
  moduloId: string;
  /** PageKey legado do item de navegação — âncora da ponte matriz ⇄ acessos. */
  permission: PageKey;
}

export interface ModuloPermissao {
  id: string;
  rotulo: string;
  paginas: PaginaPermissao[];
}

/** Módulos + páginas visíveis. Fonte: NAV_REGISTRY. */
export function listarModulos(): ModuloPermissao[] {
  return NAV_REGISTRY.map((g: NavGroup) => ({
    id: g.id,
    rotulo: g.label,
    // Itens alwaysVisible ficam fora do Quadro de Permissões: a rota é
    // aberta a qualquer autenticado, marcar/desmarcar não teria efeito.
    paginas: g.items
      .filter((it: NavItem) => !it.alwaysVisible)
      .map((it: NavItem) => ({
        rota: it.to,
        rotulo: it.label,
        moduloId: g.id,
        permission: it.permission,
      })),
  }));
}

/**
 * Conjunto de rotas representadas na matriz fina (as páginas de `NAV_REGISTRY`
 * que não são `alwaysVisible`). Atenção: `HIDDEN_NAV_ITEMS` **não** entra aqui
 * — `listarModulos` deriva só do registry, então abas de hub e deep links não
 * têm linha própria. Use `rotaDaMatrizPara` para descobrir qual linha governa
 * uma rota qualquer.
 */
export function rotasDaMatriz(): Set<string> {
  return new Set(listarModulos().flatMap((m) => m.paginas.map((p) => p.rota)));
}

/**
 * Páginas que viraram ABA/BOTÃO dentro de outra e por isso não compartilham
 * prefixo de URL com a página que as governa. Sem este mapa elas cairiam no
 * gate grosso do módulo — e liberar uma única página do Financeiro abriria,
 * por exemplo, a Previsão de Pagamento.
 *
 * Só entram aqui rotas que o prefixo não resolve; `/dp/custos/colaborador`
 * (prefixo `/dp/custos`) ou `/patrimonios/lista` (prefixo `/patrimonios`)
 * dispensam entrada.
 */
const ROTA_MAE: Record<string, string> = {
  // Abas do hub de Cadastros Financeiros
  "/financeiro/centros": "/financeiro/cadastros",
  "/financeiro/clientes": "/financeiro/cadastros",
  "/financeiro/naturezas": "/financeiro/cadastros",
  "/financeiro/formas-pagamento": "/financeiro/cadastros",
  // Abas/deep links do hub Fluxo & Dívidas
  "/financeiro/dividas": "/financeiro/fluxo",
  "/financeiro/previsao-pagamento": "/financeiro/fluxo",
  // Importação TOTVS virou botão dentro de Lançamentos
  "/financeiro/importar": "/financeiro/lancamentos",
  // Quadros que são a outra face dos hubs de Patrimônios/Contratos
  "/quadro-patrimonios": "/patrimonios",
  "/quadro-contratos": "/contratos",
  // Abas do hub Custos de Pessoal
  "/dp/historico-salarial": "/dp/custos",
  "/dp/provisoes": "/dp/custos",
  "/dp/custo-obra": "/dp/custos",
  "/dp/homem-hora": "/dp/custos",
  // Hora Extra migrou de Ponto para Custos de Pessoal (a8d3610).
  "/dp/horas-extras": "/dp/custos",
  // Folha de Pagamento foi fundida na aba Custo do Colaborador; a rota antiga
  // virou redirect e passa a ser governada pela linha do hub.
  "/dp/fopag": "/dp/custos",
  // `/dp/ponto/analise` e `/dp/ponto/importar` viraram redirects para o hub
  // `/dp/ponto` e não precisam de entrada: o prefixo já os resolve.
  // Quadro de Logística é a outra face do hub de Logística de Ativos.
  "/quadro-logistica-ativos": "/logistica-ativos",
};

/**
 * Descobre qual linha da matriz governa `path`, na ordem:
 *   1. a própria rota, quando tem linha;
 *   2. o mapa `ROTA_MAE` (aba/botão que mudou de lugar);
 *   3. o prefixo de URL mais longo com linha — resolve deep links e rotas
 *      dinâmicas (`/obras/123` → `/obras`, `/quadros/abc` → `/quadros`).
 * Devolve `null` quando nada governa — aí o chamador cai no gate grosso.
 *
 * Existe porque a matriz só tem linha para `NAV_REGISTRY`: sem isto, as 43
 * páginas de `HIDDEN_NAV_ITEMS` e as 7 rotas dinâmicas ficam sem gate fino
 * (`RequireAccess` afrouxa para o módulo inteiro) e somem do Command Palette
 * (`can()` devolve false para rota sem linha).
 */
export function rotaDaMatrizPara(path: string): string | null {
  const rotas = rotasDaMatriz();
  if (rotas.has(path)) return path;
  const mae = ROTA_MAE[path];
  if (mae && rotas.has(mae)) return mae;
  let melhor: string | null = null;
  for (const r of rotas) {
    if (r === "/") continue;
    if (path.startsWith(r + "/") && (melhor === null || r.length > melhor.length)) {
      melhor = r;
    }
  }
  return melhor;
}

/** Matriz página → ações marcadas. */
export type MatrizPermissoes = Record<string /* rota */, Partial<Record<AcaoPermissao, boolean>>>;

export interface PapeisEspeciais {
  aprovarCompras?: boolean;
  aprovarFinanceiro?: boolean;
  setores?: string[]; // ver SETORES_SUPABASE
}

/**
 * Setores atribuíveis — espelham os valores do enum `public.app_role` do
 * Supabase (exceto gm/comum, que são roles base). As RLS do financeiro e de
 * medições leem `user_roles` via `current_has_setor()`; a edge function
 * `sync-player-auth` aplica estes setores no próximo login do usuário.
 *
 * ⚠️ FONTE ÚNICA, espelhada manualmente em 3 lugares — mantenha em sincronia:
 *   1) aqui (frontend);
 *   2) `api.php` → setoresValidosFin/LabelFin/LegadoFin (filtro no servidor);
 *   3) `supabase/functions/sync-player-auth` → SETORES_VALIDOS + enum app_role.
 * Ver docs/security/access-control.md §8 (correlações da matriz/setores).
 */
export const SETORES_SUPABASE: { value: string; label: string }[] = [
  { value: "engenharia", label: "Engenharia" },
  { value: "dp", label: "Depto. Pessoal" },
  { value: "financeiro", label: "Financeiro" },
  { value: "compras", label: "Compras" },
  { value: "seguranca", label: "Segurança" },
  { value: "fiscalizacao", label: "Fiscalização" },
  { value: "qualidade", label: "Qualidade" },
  { value: "almoxarifado", label: "Almoxarifado" },
  { value: "frotas", label: "Frotas" },
];

/** Normaliza/filtra setores para a allowlist (mesma regra da edge function). */
export function normalizarSetores(setores: unknown): string[] {
  if (!Array.isArray(setores)) return [];
  const validos = new Set(SETORES_SUPABASE.map((s) => s.value));
  const out: string[] = [];
  for (const s of setores) {
    if (typeof s !== "string") continue;
    const norm = s.trim().toLowerCase();
    if (validos.has(norm) && !out.includes(norm)) out.push(norm);
  }
  return out;
}

/**
 * Rótulos legados do Setor da Aprovação Financeira (lista antiga fixa no código
 * — `["RH", "Compras", "Almoxarifado", "Frotas", "Engenharia"]`) → slug canônico
 * de `SETORES_SUPABASE`. Só cobre valores sem correspondência direta por
 * slug/rótulo; o resto é resolvido por `normalizarSetorLegado`.
 *
 * "Almoxarifado" e "Frotas" moravam aqui, colapsados em `compras`/`engenharia`
 * por não existirem como setor. Agora existem, então as linhas antigas voltam a
 * cair no setor próprio — e a entrada legada tem que sair: o gêmeo PHP
 * (`setoresRawAceitosFin`) monta o `WHERE` a partir deste mapa, e mantê-la faria
 * conceder Compras aceitar também as linhas de Almoxarifado.
 */
const SETOR_LEGADO_MAP: Record<string, string> = {
  rh: "dp",
};

/**
 * Converte um valor de setor gravado (slug canônico já normalizado, rótulo
 * canônico, ou rótulo legado) no slug canônico correspondente. Quando não há
 * correspondência, devolve o valor original intacto — assim nenhum registro
 * antigo "some" (segue visível ao GM).
 */
export function normalizarSetorLegado(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const norm = raw.trim().toLowerCase();
  if (!norm) return "";
  // Já é um slug canônico?
  if (SETORES_SUPABASE.some((s) => s.value === norm)) return norm;
  // Bate com um rótulo canônico (ex.: "Depto. Pessoal", "Engenharia")?
  const porRotulo = SETORES_SUPABASE.find((s) => s.label.toLowerCase() === norm);
  if (porRotulo) return porRotulo.value;
  // Rótulo legado conhecido?
  if (SETOR_LEGADO_MAP[norm]) return SETOR_LEGADO_MAP[norm];
  // Desconhecido: preserva o valor cru (trim) para não perder o dado.
  return raw.trim();
}

/** Slug canônico → rótulo exibível. Valor desconhecido devolve o próprio texto. */
export function setorLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const slug = normalizarSetorLegado(value);
  return SETORES_SUPABASE.find((s) => s.value === slug)?.label ?? value.trim();
}

interface PlayerSetores {
  isGM?: boolean;
  papeisPermissao?: { setores?: string[] } | null;
}

/**
 * Setores que o jogador pode visualizar. GM enxerga todos os setores
 * canônicos; os demais, apenas os atribuídos em Permissões (`papeisPermissao.setores`).
 */
export function setoresVisiveis(player: PlayerSetores | null): string[] {
  if (!player) return [];
  if (player.isGM) return SETORES_SUPABASE.map((s) => s.value);
  return normalizarSetores(player.papeisPermissao?.setores);
}

/**
 * Decisão de visibilidade de uma solicitação financeira por setor. GM vê tudo;
 * demais só veem solicitações de setores concedidos. O `setor` da solicitação
 * é normalizado (rótulos legados viram slug) antes da checagem.
 */
export function podePlayerVerSetorFinanceiro(
  player: PlayerSetores | null,
  setor: unknown,
): boolean {
  if (!player) return false;
  if (player.isGM) return true;
  return setoresVisiveis(player).includes(normalizarSetorLegado(setor));
}

/** Fábrica de matriz vazia. */
export function matrizVazia(): MatrizPermissoes {
  return {};
}

/**
 * Páginas que deixaram de ter linha própria porque foram FUNDIDAS em outra.
 * Diferente de `ROTA_MAE` (que roteia a consulta de uma rota viva sem linha),
 * aqui a rota antiga sumiu do registry: quem tinha a permissão dela precisa
 * herdá-la no destino, senão perde o acesso silenciosamente na primeira carga
 * depois do deploy.
 *
 * Uma entrada só sai daqui quando não houver mais matriz salva com a rota
 * antiga — na prática, quando todos os perfis tiverem sido salvos de novo.
 */
const ROTAS_FUNDIDAS: Record<string, string> = {
  // Folha de Pagamento (/dp/fopag) → aba Custo do Colaborador do hub Custos.
  "/dp/fopag": "/dp/custos",
};

/**
 * Move as permissões de rotas fundidas para a rota de destino, mantendo o maior
 * privilégio de cada ação (união, nunca rebaixamento) e descartando a linha
 * antiga. Idempotente: rodar de novo numa matriz já migrada não muda nada.
 *
 * Aplicada na leitura (`usePermissions`) e ao carregar um perfil no Quadro de
 * Permissões — assim o GM vê o mesmo que o gate aplica, e o próximo save
 * persiste a matriz já sem a rota morta.
 */
export function migrarRotasFundidas(matriz: MatrizPermissoes): MatrizPermissoes {
  const legadas = Object.keys(ROTAS_FUNDIDAS).filter((r) => matriz[r]);
  if (legadas.length === 0) return matriz;

  const out: MatrizPermissoes = { ...matriz };
  for (const antiga of legadas) {
    const destino = ROTAS_FUNDIDAS[antiga];
    const linha = { ...(out[destino] ?? {}) };
    for (const acao of ACOES) {
      if (out[antiga]?.[acao]) linha[acao] = true;
    }
    delete out[antiga];
    if (Object.keys(linha).length > 0) out[destino] = linha;
  }
  return out;
}

/** Consulta segura de uma célula (default false). */
export function podeAcao(
  matriz: MatrizPermissoes | undefined | null,
  rota: string,
  acao: AcaoPermissao,
): boolean {
  return !!matriz?.[rota]?.[acao];
}

/** Atualiza uma célula imutavelmente. */
export function setAcao(
  matriz: MatrizPermissoes,
  rota: string,
  acao: AcaoPermissao,
  valor: boolean,
): MatrizPermissoes {
  const linha = { ...(matriz[rota] ?? {}) };
  if (valor) linha[acao] = true;
  else delete linha[acao];
  const novaMatriz = { ...matriz };
  if (Object.keys(linha).length === 0) delete novaMatriz[rota];
  else novaMatriz[rota] = linha;
  return novaMatriz;
}

/** Estado de um checkbox de módulo para uma ação (all/none/some). */
export type BulkState = "all" | "none" | "some";
export function estadoModulo(
  matriz: MatrizPermissoes,
  modulo: ModuloPermissao,
  acao: AcaoPermissao,
): BulkState {
  const total = modulo.paginas.length;
  if (total === 0) return "none";
  const marcadas = modulo.paginas.filter((p) => podeAcao(matriz, p.rota, acao)).length;
  if (marcadas === 0) return "none";
  if (marcadas === total) return "all";
  return "some";
}

/** Marca/desmarca toda uma ação num módulo. */
export function toggleModulo(
  matriz: MatrizPermissoes,
  modulo: ModuloPermissao,
  acao: AcaoPermissao,
  valor: boolean,
): MatrizPermissoes {
  let out = matriz;
  for (const pg of modulo.paginas) out = setAcao(out, pg.rota, acao, valor);
  return out;
}

// ---- Ponte com o modelo legado (Player.acessos: PageKey → NivelAcesso) ----

const RANK_NIVEL: Record<NivelAcesso, number> = {
  nenhum: 0,
  visualizar: 1,
  editar: 2,
  compras: 2,
  financeiro: 2,
};

/**
 * Deriva um mapa `PageKey → NivelAcesso` a partir da matriz nova, para manter
 * `hasAccess` funcionando sem refactor. Agregação por página: cada página do
 * NAV carrega sua PageKey (`permission`), então frotas/contratos/compras —
 * antes sem mapeamento por módulo — derivam corretamente.
 */
export function acessosDerivadosDeMatriz(
  matriz: MatrizPermissoes,
  papeis?: PapeisEspeciais,
): Record<PageKey, NivelAcesso> {
  const base: Record<PageKey, NivelAcesso> = {
    obras_div: "nenhum",
    rh: "nenhum",
    dp: "nenhum",
    patrimonios: "nenhum",
    frotas: "nenhum",
    admin: "nenhum",
    financeiro: "nenhum",
    contratos: "nenhum",
    almoxarifado: "nenhum",
    crm: "nenhum",
  };
  for (const m of listarModulos()) {
    for (const pg of m.paginas) {
      const nivel: NivelAcesso = podeAcao(matriz, pg.rota, "E")
        ? "editar"
        : podeAcao(matriz, pg.rota, "V")
          ? "visualizar"
          : "nenhum";
      if (RANK_NIVEL[nivel] > RANK_NIVEL[base[pg.permission]]) base[pg.permission] = nivel;
    }
  }
  // Papéis especiais sobem o nível de "financeiro".
  if (papeis?.aprovarFinanceiro) base.financeiro = "financeiro";
  else if (papeis?.aprovarCompras) base.financeiro = "compras";
  return base;
}

/**
 * Converte acessos legados em uma matriz equivalente, preservando a semântica
 * histórica dos níveis: `visualizar` sempre permitiu ver e exportar (V, Ex);
 * `editar`+ sempre incluiu excluir e importar (E, X, I). Assim, quem nunca
 * teve matriz salva não perde nenhuma ação que o nível grosso já dava.
 */
export function matrizDeAcessosLegados(
  acessos: Partial<Record<PageKey, NivelAcesso>>,
): MatrizPermissoes {
  let out: MatrizPermissoes = {};
  for (const m of listarModulos()) {
    for (const pg of m.paginas) {
      const r = RANK_NIVEL[acessos[pg.permission] ?? "nenhum"];
      if (r >= 1) {
        out = setAcao(out, pg.rota, "V", true);
        out = setAcao(out, pg.rota, "Ex", true);
      }
      if (r >= 2) {
        out = setAcao(out, pg.rota, "E", true);
        out = setAcao(out, pg.rota, "X", true);
        out = setAcao(out, pg.rota, "I", true);
      }
    }
  }
  return out;
}

/**
 * Decisão fina por página × ação para o jogador logado. GM tem tudo; com
 * matriz salva ela é a fonte-verdade; sem matriz, deriva do legado.
 */
export function podePlayerAcao(
  player: {
    isGM?: boolean;
    matrizPermissoes?: MatrizPermissoes | null;
    acessos?: Partial<Record<PageKey, NivelAcesso>>;
  } | null,
  rota: string,
  acao: AcaoPermissao,
): boolean {
  if (!player) return false;
  if (player.isGM) return true;
  const matriz = player.matrizPermissoes ?? matrizDeAcessosLegados(player.acessos ?? {});
  return podeAcao(matriz, rota, acao);
}
