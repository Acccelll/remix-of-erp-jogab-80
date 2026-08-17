/** @module-kind pure */
// Agregações da página Histograma — matriz recursos × colunas (obras e
// especiais) × semanas. O preview da semana atual usa o MESMO cálculo do
// contador da página Gestão de Equipe (Board):
//  - colaborador na obra: ativo e (statusEspecial || obraAtualId) === obra
//  - veículo na obra: ativo, pela obra do motorista ou, sem motorista, pela sua
//  - máquina alugada: contrato ativo tipo "Máquina" com obraAtualId
import type { Colaborador, Contrato, Delegacao, Funcao, Veiculo, VeiculoTipoCadastro } from "@/types";
import { veiculoNaColuna } from "@/lib/frotas/alocacao";

export const OBRA_KEY_CONTRATACAO = "contratacao";
export const OBRA_KEY_OCIOSO = "ocioso";

export type RecursoTipo = "funcao" | "veiculo_tipo";

export interface LinhaHistograma {
  recursoTipo: RecursoTipo;
  chave: string; // nome da função ou do tipo (versão simples)
  rotulo: string;
}

export interface GrupoLinhas {
  id: string;
  titulo: string;
  linhas: LinhaHistograma[];
}

/** Segunda-feira (ISO YYYY-MM-DD) da semana da data, com offset em semanas. */
export function segundaDaSemana(base: Date, offsetSemanas = 0): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = d.getDay(); // 0=dom
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offsetSemanas * 7);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const celulaKey = (obraKey: string, recursoTipo: RecursoTipo, chave: string) =>
  `${obraKey}|${recursoTipo}|${chave}`;

/**
 * Monta os grupos de linhas na ordem do modelo: delegações (funções),
 * Equipamentos (tipos) e Veículos (tipos). Funções sem delegação entram
 * num grupo próprio ao final da seção de mão de obra.
 */
export function montarGruposLinhas(
  funcoes: Funcao[],
  delegacoes: Delegacao[],
  tipos: VeiculoTipoCadastro[],
): { maoDeObra: GrupoLinhas[]; equipamentos: GrupoLinhas; veiculos: GrupoLinhas } {
  const ativas = funcoes.filter((f) => f.ativa);
  const maoDeObra: GrupoLinhas[] = [];
  for (const d of delegacoes) {
    const doGrupo = ativas.filter((f) => f.delegacaoId === d.id);
    if (doGrupo.length === 0) continue;
    maoDeObra.push({
      id: `delegacao-${d.id}`,
      titulo: d.nome,
      linhas: doGrupo.map((f) => ({ recursoTipo: "funcao", chave: f.nome, rotulo: f.nome })),
    });
  }
  const semDelegacao = ativas.filter(
    (f) => !f.delegacaoId || !delegacoes.some((d) => d.id === f.delegacaoId),
  );
  if (semDelegacao.length > 0) {
    maoDeObra.push({
      id: "sem-delegacao",
      titulo: delegacoes.length > 0 ? "Sem delegação" : "Funções",
      linhas: semDelegacao.map((f) => ({ recursoTipo: "funcao", chave: f.nome, rotulo: f.nome })),
    });
  }
  const tiposAtivos = tipos.filter((t) => t.ativo);
  const porGrupo = (grupo: "Equipamentos" | "Veículos"): LinhaHistograma[] =>
    tiposAtivos
      .filter((t) => t.grupo === grupo)
      .map((t) => ({ recursoTipo: "veiculo_tipo" as const, chave: t.nome, rotulo: t.nome }));
  return {
    maoDeObra,
    equipamentos: { id: "equipamentos", titulo: "Equipamentos", linhas: porGrupo("Equipamentos") },
    veiculos: { id: "veiculos", titulo: "Veículos", linhas: porGrupo("Veículos") },
  };
}

/**
 * Preview da semana atual — mesmo cálculo do contador da Gestão de Equipe.
 * Retorna Map<celulaKey, valor>.
 */
export function montarPreview(args: {
  colaboradores: Colaborador[];
  veiculos: Veiculo[];
  contratos: Contrato[];
  obraIds: string[];
}): Map<string, number> {
  const { colaboradores, veiculos, contratos, obraIds } = args;
  const preview = new Map<string, number>();
  const soma = (obraKey: string, tipo: RecursoTipo, chave: string, inc = 1) => {
    const k = celulaKey(obraKey, tipo, chave);
    preview.set(k, (preview.get(k) ?? 0) + inc);
  };

  const ativos = colaboradores.filter((c) => c.ativo);
  const obraSet = new Set(obraIds.map(String));

  for (const c of ativos) {
    const key = (c.statusEspecial || c.obraAtualId || null) as string | null;
    const funcao = c.funcao || "Sem função";
    if (key !== null && obraSet.has(String(key))) {
      soma(String(key), "funcao", funcao);
    } else {
      // Sem obra ou em status especial (folga/afastamento/férias/barracão).
      soma(OBRA_KEY_OCIOSO, "funcao", funcao);
    }
  }

  for (const obraId of obraSet) {
    const colabsDaObra = new Set(
      ativos
        .filter((c) => (c.statusEspecial || c.obraAtualId || null) === obraId)
        .map((c) => c.id),
    );
    // Veículos da obra pela mesma regra do Board (`veiculoNaColuna`).
    for (const v of veiculos) {
      if (veiculoNaColuna(v, colabsDaObra, obraId)) {
        soma(obraId, "veiculo_tipo", v.tipo || "Sem tipo");
      }
    }
    // Máquinas alugadas: contratos ativos do tipo Máquina na obra.
    for (const ct of contratos) {
      if (ct.ativo && ct.tipo === "Máquina" && String(ct.obraAtualId || "") === obraId) {
        soma(obraId, "veiculo_tipo", ct.tipoMaquina || "Sem tipo");
      }
    }
  }

  return preview;
}
