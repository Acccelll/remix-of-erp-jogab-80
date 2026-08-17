/** @module-kind pure */
/**
 * Reflexo do patrimônio na obra do responsável.
 *
 * Modelo: um patrimônio entregue a um colaborador **persiste na coluna desse
 * colaborador** — `responsavel_id` preenchido, `obra_atual_id` nulo. A obra em
 * que ele aparece é derivada de onde o responsável está agora; nada é gravado
 * em duplicidade. Quando o responsável muda de obra, o bem acompanha sozinho,
 * sem migração de dados e sem dois registros do mesmo fato podendo divergir.
 *
 * A etiqueta que aparece na coluna da obra é, portanto, um **reflexo**: a
 * posição real do bem continua sendo a coluna do responsável. Arrastá-la
 * significa desfazer o vínculo, e por isso o quadro pede confirmação antes de
 * seguir para a data de mobilização.
 */

export interface ColaboradorRef {
  id: string;
  obraAtualId?: string | null;
  /** Férias, folga, afastamento — quem está fora não reflete em obra alguma. */
  statusEspecial?: string | null;
}

export interface PatrimonioRef {
  id: string;
  obraAtualId?: string | null;
  responsavelId?: string | null;
}

/** Como uma etiqueta ocupa a coluna em que está sendo desenhada. */
export type OrigemEtiqueta =
  /** O bem pertence a esta coluna: é a posição real dele. */
  | "propria"
  /** O bem está com um responsável que hoje está nesta obra. */
  | "reflexo";

export interface EtiquetaQuadro<T> {
  item: T;
  origem: OrigemEtiqueta;
  /** Preenchido em reflexos: o responsável que traz o bem para esta obra. */
  responsavelId?: string;
}

/**
 * Obra em que um patrimônio deve ser refletido, ou `null` quando não há
 * reflexo: sem responsável, ou responsável sem obra (sem alocação, férias,
 * folga, afastamento). Um bem com um responsável de férias não aparece em obra
 * nenhuma — o que é o correto, já que ele não está lá.
 */
export function obraRefletidaDoPatrimonio(
  pat: PatrimonioRef,
  colaboradores: ColaboradorRef[],
): string | null {
  if (!pat.responsavelId) return null;
  const resp = colaboradores.find((c) => String(c.id) === String(pat.responsavelId));
  if (!resp) return null;
  // Status especial vence a obra: é a mesma precedência usada nos quadros.
  if (resp.statusEspecial) return null;
  return resp.obraAtualId ?? null;
}

/**
 * Monta as etiquetas de uma coluna do quadro de patrimônios, juntando as
 * próprias com as refletidas por responsáveis alocados naquela obra.
 *
 * `colunaId` null é "Sem Alocação"; ids `__resp__<id>` são colunas de
 * responsável, que nunca recebem reflexo — nelas o bem já está em casa.
 */
export function etiquetasDaColuna<T extends PatrimonioRef>(
  colunaId: string | null,
  patrimonios: T[],
  colaboradores: ColaboradorRef[],
): EtiquetaQuadro<T>[] {
  const proprias = patrimonios
    .filter((p) => (p.obraAtualId || null) === colunaId)
    .map((p) => ({ item: p, origem: "propria" as const }));

  // Colunas especiais e de responsável não recebem reflexo.
  const ehObraReal = colunaId !== null && !colunaId.startsWith("__");
  if (!ehObraReal) return proprias;

  const reflexos = patrimonios
    .filter((p) => p.responsavelId && obraRefletidaDoPatrimonio(p, colaboradores) === colunaId)
    .map((p) => ({
      item: p,
      origem: "reflexo" as const,
      responsavelId: String(p.responsavelId),
    }));

  return [...proprias, ...reflexos];
}
