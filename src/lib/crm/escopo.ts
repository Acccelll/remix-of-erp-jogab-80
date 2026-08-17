/** @module-kind pure */
/**
 * Escopo de visibilidade do CRM — quem enxerga qual negociação.
 *
 * Regra: **GM vê tudo**. Qualquer outro usuário vê as oportunidades dos clientes
 * em que consta como "Responsável por negociação" (a sua *carteira*, gravada em
 * `Cliente.responsaveisNegociacao`) MAIS aquelas em que ele é o responsável do
 * próprio card. O segundo braço é o que mantém visível uma oportunidade ainda
 * sem cliente vinculado: sem `clienteId` não há carteira que a carregue.
 *
 * ⚠️ Espelhado no backend por `escopoOportunidadesFin()` no `api.php`, que é a
 * camada que vale como segurança — esta aqui é UX/defesa em profundidade.
 * Mudou a regra em um lado? Mude no outro. Ver docs/security/access-control.md §9.3.
 */

export interface ClienteCarteira {
  id: string;
  responsaveisNegociacao?: string[];
}

export interface OportunidadeEscopo {
  clienteId?: string | null;
  responsavelId?: string | null;
}

/** Ids dos clientes em que `userId` é responsável por negociação. */
export function carteiraDoUsuario(
  clientes: readonly ClienteCarteira[],
  userId: string | null | undefined,
): Set<string> {
  if (!userId) return new Set();
  const out = new Set<string>();
  for (const c of clientes) {
    if (c.responsaveisNegociacao?.includes(userId)) out.add(c.id);
  }
  return out;
}

/**
 * Decide se uma oportunidade entra no funil do usuário. `carteira` é o resultado
 * de `carteiraDoUsuario`; `restrito` false (GM) libera tudo.
 */
export function podeVerOportunidade(
  oportunidade: OportunidadeEscopo,
  opcoes: { restrito: boolean; userId: string | null | undefined; carteira: ReadonlySet<string> },
): boolean {
  const { restrito, userId, carteira } = opcoes;
  if (!restrito || !userId) return true;
  if (oportunidade.clienteId && carteira.has(oportunidade.clienteId)) return true;
  return oportunidade.responsavelId === userId;
}
