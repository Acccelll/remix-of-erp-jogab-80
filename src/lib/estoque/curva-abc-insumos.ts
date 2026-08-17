/** @module-kind pure */
/**
 * PRO-012 · slice-04 — Curva ABC de insumos para contagens cíclicas.
 *
 * Reaproveita a mesma agregação usada em `pages/suprimentos/CurvaABC.tsx`
 * (rateio do valor orçado por peso `coef × preço`), porém expõe apenas
 * o mapa `insumoId → classe` para uso off-UI (ex.: filtrar itens de um
 * plano de contagem).
 */
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { insumosRepo } from "@/lib/repositories/insumos";
import { curvaABC } from "@/lib/orcamento/orcamento";

export type ClasseABC = "A" | "B" | "C";

export async function carregarClasseInsumos(): Promise<Map<string, ClasseABC>> {
  const [itens, comp, insumos] = await Promise.all([
    suprimentosRepo.listOrcamentoItens(
      "id,obra_id,composicao_id,descricao,quantidade,preco_unitario,valor_total",
    ),
    suprimentosRepo.listComposicaoItens(),
    insumosRepo.listResumoPrecos(),
  ]);

  const insumoById = new Map<string, { descricao: string; preco_unitario: number }>();
  (insumos ?? []).forEach((i) =>
    insumoById.set(i.id, {
      descricao: i.descricao,
      preco_unitario: Number(i.preco_unitario ?? 0),
    }),
  );

  const compPor = new Map<string, { insumo_id: string; coeficiente: number }[]>();
  (comp ?? []).forEach((c: { composicao_id: string; insumo_id: string; coeficiente: number }) => {
    const arr = compPor.get(c.composicao_id) ?? [];
    arr.push({ insumo_id: c.insumo_id, coeficiente: Number(c.coeficiente) });
    compPor.set(c.composicao_id, arr);
  });

  const acc = new Map<string, { insumo_id: string; descricao: string; valor: number }>();
  for (const it of itens ?? []) {
    if (!it.composicao_id) continue;
    const c = compPor.get(it.composicao_id) ?? [];
    const valor = Number(it.valor_total ?? Number(it.quantidade) * Number(it.preco_unitario));
    if (!c.length || valor <= 0) continue;
    const pesos = c.map((x) => ({
      x,
      peso: x.coeficiente * (insumoById.get(x.insumo_id)?.preco_unitario ?? 0),
    }));
    const total = pesos.reduce((a, p) => a + p.peso, 0);
    if (total <= 0) continue;
    for (const { x, peso } of pesos) {
      const ins = insumoById.get(x.insumo_id);
      if (!ins) continue;
      const parcela = (peso / total) * valor;
      const cur = acc.get(x.insumo_id);
      if (cur) cur.valor += parcela;
      else acc.set(x.insumo_id, { insumo_id: x.insumo_id, descricao: ins.descricao, valor: parcela });
    }
  }

  const curva = curvaABC(Array.from(acc.values()));
  const out = new Map<string, ClasseABC>();
  curva.forEach((i) => out.set(i.insumo_id, i.classe));
  return out;
}
