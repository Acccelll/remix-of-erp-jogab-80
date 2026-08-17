/** @module-kind pure */
/**
 * Biblioteca de modelos de inspeção (INSP.2).
 *
 * Modelos padrão FVS, FVM, recebimento de material e segurança, prontos para
 * serem semeados em `inspecao_modelos` + `inspecao_perguntas`. Mantemos os
 * modelos no código (versionados) para permitir evolução controlada — quem
 * quiser pode clonar via UI e ajustar para a obra.
 *
 * Cada pergunta tem `tempId` (string estável dentro do modelo) usado pelas
 * regras condicionais (`depende_de` → `tempId`). Na hora de gravar no banco,
 * mapeamos `tempId → UUID gerado` antes de inserir.
 */
export type PerguntaTipo = "sim_nao_na" | "numero" | "texto" | "foto" | "escolha" | "escala";
export type ModeloCategoria = "fvs" | "fvm" | "recebimento" | "seguranca" | "qualidade" | "outros";

export interface PerguntaTemplate {
  /** Estável dentro do modelo; usado por `dependeDe`. */
  tempId: string;
  texto: string;
  tipo: PerguntaTipo;
  grupo?: string;
  obrigatoria?: boolean;
  peso?: number;
  /** opções (escolha), unidade (numero), min/max, etc. */
  config?: Record<string, unknown>;
  /** Mostra somente se a resposta da pergunta `dependeDe` == `dependeValor`. */
  dependeDe?: string;
  dependeValor?: string;
  /** Em sim_nao_na: gera NC automática quando resposta == este valor. */
  geraNcSe?: string;
}

export interface ModeloTemplate {
  codigo: string;
  nome: string;
  categoria: ModeloCategoria;
  setor: "Qualidade" | "Engenharia" | "Segurança" | "Suprimentos";
  descricao: string;
  scoreMinimo?: number;
  perguntas: PerguntaTemplate[];
}

// ============================================================
// FVS — Verificação de Serviço (estrutura de concreto armado)
// ============================================================
export const FVS_ESTRUTURA: ModeloTemplate = {
  codigo: "FVS-001-EST",
  nome: "FVS — Concretagem de Pilar/Viga/Laje",
  categoria: "fvs",
  setor: "Qualidade",
  scoreMinimo: 90,
  descricao: "Ficha de Verificação de Serviço para concretagem estrutural.",
  perguntas: [
    {
      tempId: "elemento",
      texto: "Elemento estrutural",
      tipo: "escolha",
      grupo: "Identificação",
      obrigatoria: true,
      config: { opcoes: ["Pilar", "Viga", "Laje", "Bloco/Sapata"] },
    },
    {
      tempId: "eixo",
      texto: "Eixo / Localização",
      tipo: "texto",
      grupo: "Identificação",
      obrigatoria: true,
    },
    {
      tempId: "fck",
      texto: "Fck especificado (MPa)",
      tipo: "numero",
      grupo: "Identificação",
      obrigatoria: true,
      config: { min: 15, max: 90, unidade: "MPa" },
    },

    // Pré-concretagem
    {
      tempId: "forma_alinhada",
      texto: "Fôrmas alinhadas e travadas?",
      tipo: "sim_nao_na",
      grupo: "Pré-concretagem",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "forma_alinhada_obs",
      texto: "Detalhe a não conformidade da fôrma",
      tipo: "texto",
      grupo: "Pré-concretagem",
      dependeDe: "forma_alinhada",
      dependeValor: "nao",
      obrigatoria: true,
    },
    {
      tempId: "armadura_correta",
      texto: "Armadura conforme projeto (bitolas/espaçamentos)?",
      tipo: "sim_nao_na",
      grupo: "Pré-concretagem",
      obrigatoria: true,
      peso: 3,
      geraNcSe: "nao",
    },
    {
      tempId: "cobrimento_ok",
      texto: "Cobrimento mínimo respeitado?",
      tipo: "sim_nao_na",
      grupo: "Pré-concretagem",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "limpeza_forma",
      texto: "Fôrma limpa e desmoldante aplicado?",
      tipo: "sim_nao_na",
      grupo: "Pré-concretagem",
      obrigatoria: true,
      geraNcSe: "nao",
    },

    // Concretagem
    {
      tempId: "slump_test",
      texto: "Slump test executado?",
      tipo: "sim_nao_na",
      grupo: "Concretagem",
      obrigatoria: true,
      geraNcSe: "nao",
    },
    {
      tempId: "slump_valor",
      texto: "Valor do abatimento (cm)",
      tipo: "numero",
      grupo: "Concretagem",
      dependeDe: "slump_test",
      dependeValor: "sim",
      obrigatoria: true,
      config: { min: 0, max: 25, unidade: "cm" },
    },
    {
      tempId: "cps_moldados",
      texto: "Corpos de prova moldados?",
      tipo: "sim_nao_na",
      grupo: "Concretagem",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "qtd_cps",
      texto: "Quantidade de CPs",
      tipo: "numero",
      grupo: "Concretagem",
      dependeDe: "cps_moldados",
      dependeValor: "sim",
      obrigatoria: true,
      config: { min: 2 },
    },
    {
      tempId: "vibracao_ok",
      texto: "Adensamento (vibração) adequado?",
      tipo: "sim_nao_na",
      grupo: "Concretagem",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "foto_geral",
      texto: "Foto da concretagem",
      tipo: "foto",
      grupo: "Concretagem",
      obrigatoria: true,
    },

    // Pós
    {
      tempId: "cura_iniciada",
      texto: "Cura iniciada nas primeiras 12h?",
      tipo: "sim_nao_na",
      grupo: "Pós-concretagem",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "observacoes_finais",
      texto: "Observações gerais",
      tipo: "texto",
      grupo: "Pós-concretagem",
      obrigatoria: false,
    },
  ],
};

// ============================================================
// FVM — Verificação de Material (cimento/aço/argamassa)
// ============================================================
export const FVM_RECEBIMENTO_CIMENTO: ModeloTemplate = {
  codigo: "FVM-001-CIM",
  nome: "FVM — Recebimento de Cimento",
  categoria: "fvm",
  setor: "Qualidade",
  scoreMinimo: 95,
  descricao: "Ficha de Verificação de Material — sacos/granel de cimento.",
  perguntas: [
    {
      tempId: "tipo_cimento",
      texto: "Tipo de cimento",
      tipo: "escolha",
      obrigatoria: true,
      config: { opcoes: ["CP-II-E", "CP-II-F", "CP-III", "CP-IV", "CP-V-ARI"] },
    },
    { tempId: "nf_numero", texto: "Número da NF", tipo: "texto", obrigatoria: true },
    { tempId: "lote", texto: "Lote / Fabricação", tipo: "texto", obrigatoria: true },
    {
      tempId: "validade_ok",
      texto: "Dentro do prazo de validade?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      peso: 3,
      geraNcSe: "nao",
    },
    {
      tempId: "validade_obs",
      texto: "Validade do lote (data)",
      tipo: "texto",
      dependeDe: "validade_ok",
      dependeValor: "sim",
      obrigatoria: true,
    },
    {
      tempId: "embalagem_integra",
      texto: "Embalagens íntegras (sem rasgos/umidade)?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "qtd_avariadas",
      texto: "Quantidade de embalagens avariadas",
      tipo: "numero",
      dependeDe: "embalagem_integra",
      dependeValor: "nao",
      obrigatoria: true,
      config: { min: 0 },
    },
    {
      tempId: "armazenagem_ok",
      texto: "Armazenagem adequada (sobre estrado, coberto)?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      geraNcSe: "nao",
    },
    { tempId: "foto_carga", texto: "Foto da carga recebida", tipo: "foto", obrigatoria: true },
  ],
};

// ============================================================
// Recebimento — material genérico
// ============================================================
export const RECEBIMENTO_GENERICO: ModeloTemplate = {
  codigo: "REC-001-GER",
  nome: "Recebimento — Material genérico",
  categoria: "recebimento",
  setor: "Suprimentos",
  scoreMinimo: 90,
  descricao: "Checklist genérico de recebimento de materiais e equipamentos.",
  perguntas: [
    { tempId: "fornecedor", texto: "Fornecedor", tipo: "texto", obrigatoria: true },
    { tempId: "nf", texto: "Nota fiscal", tipo: "texto", obrigatoria: true },
    { tempId: "oc", texto: "Ordem de compra de referência", tipo: "texto", obrigatoria: false },
    {
      tempId: "qtd_correta",
      texto: "Quantidade confere com a OC?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "diferenca_qtd",
      texto: "Diferença encontrada (unid.)",
      tipo: "numero",
      dependeDe: "qtd_correta",
      dependeValor: "nao",
      obrigatoria: true,
    },
    {
      tempId: "material_integro",
      texto: "Material em bom estado?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "avaria_desc",
      texto: "Descreva a avaria",
      tipo: "texto",
      dependeDe: "material_integro",
      dependeValor: "nao",
      obrigatoria: true,
    },
    {
      tempId: "avaria_foto",
      texto: "Foto da avaria",
      tipo: "foto",
      dependeDe: "material_integro",
      dependeValor: "nao",
      obrigatoria: true,
    },
    {
      tempId: "certificados",
      texto: "Certificados/laudos entregues (quando aplicável)?",
      tipo: "sim_nao_na",
      obrigatoria: true,
    },
    { tempId: "foto_geral", texto: "Foto do material recebido", tipo: "foto", obrigatoria: true },
  ],
};

// ============================================================
// Segurança — inspeção diária de frente de serviço
// ============================================================
export const SEGURANCA_FRENTE_SERVICO: ModeloTemplate = {
  codigo: "SEG-001-FRENTE",
  nome: "Segurança — Inspeção diária de frente de serviço",
  categoria: "seguranca",
  setor: "Segurança",
  scoreMinimo: 100,
  descricao: "Checklist diário de segurança em frente de serviço (NR-18/NR-35).",
  perguntas: [
    { tempId: "frente", texto: "Frente de serviço", tipo: "texto", obrigatoria: true },
    {
      tempId: "epi_todos",
      texto: "Todos os colaboradores com EPI completo?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      peso: 5,
      geraNcSe: "nao",
    },
    {
      tempId: "epi_faltante",
      texto: "Qual EPI faltou?",
      tipo: "texto",
      dependeDe: "epi_todos",
      dependeValor: "nao",
      obrigatoria: true,
    },
    { tempId: "altura", texto: "Há trabalho em altura?", tipo: "sim_nao_na", obrigatoria: true },
    {
      tempId: "pta_emitida",
      texto: "PTA (Permissão de Trabalho em Altura) emitida?",
      tipo: "sim_nao_na",
      dependeDe: "altura",
      dependeValor: "sim",
      obrigatoria: true,
      peso: 5,
      geraNcSe: "nao",
    },
    {
      tempId: "cinto_ancorado",
      texto: "Cinto de segurança ancorado em ponto fixo?",
      tipo: "sim_nao_na",
      dependeDe: "altura",
      dependeValor: "sim",
      obrigatoria: true,
      peso: 5,
      geraNcSe: "nao",
    },
    {
      tempId: "energia",
      texto: "Há serviço com energia elétrica?",
      tipo: "sim_nao_na",
      obrigatoria: true,
    },
    {
      tempId: "loto",
      texto: "Bloqueio/etiquetagem (LOTO) aplicado?",
      tipo: "sim_nao_na",
      dependeDe: "energia",
      dependeValor: "sim",
      obrigatoria: true,
      peso: 4,
      geraNcSe: "nao",
    },
    {
      tempId: "area_isolada",
      texto: "Área isolada e sinalizada?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      peso: 2,
      geraNcSe: "nao",
    },
    {
      tempId: "extintor_proximo",
      texto: "Extintor disponível e dentro da validade?",
      tipo: "sim_nao_na",
      obrigatoria: true,
      geraNcSe: "nao",
    },
    { tempId: "observacoes", texto: "Observações", tipo: "texto", obrigatoria: false },
    { tempId: "foto_frente", texto: "Foto da frente de serviço", tipo: "foto", obrigatoria: true },
  ],
};

export const MODELOS_PADRAO: ModeloTemplate[] = [
  FVS_ESTRUTURA,
  FVM_RECEBIMENTO_CIMENTO,
  RECEBIMENTO_GENERICO,
  SEGURANCA_FRENTE_SERVICO,
];

// ============================================================
// Validação do modelo (chamada nos testes; útil ao seedar/editar)
// ============================================================
export interface ValidationError {
  perguntaTempId?: string;
  campo: string;
  mensagem: string;
}

export function validarModelo(modelo: ModeloTemplate): ValidationError[] {
  const errors: ValidationError[] = [];
  const tempIds = new Set<string>();

  if (!modelo.codigo) errors.push({ campo: "codigo", mensagem: "código obrigatório" });
  if (!modelo.nome) errors.push({ campo: "nome", mensagem: "nome obrigatório" });
  if (modelo.perguntas.length === 0)
    errors.push({ campo: "perguntas", mensagem: "ao menos uma pergunta" });

  for (const p of modelo.perguntas) {
    if (!p.tempId) errors.push({ campo: "tempId", mensagem: "tempId obrigatório" });
    if (tempIds.has(p.tempId)) {
      errors.push({ perguntaTempId: p.tempId, campo: "tempId", mensagem: "tempId duplicado" });
    }
    tempIds.add(p.tempId);

    // Dependência: deve apontar para uma pergunta declarada ANTES (evita ciclos).
    if (p.dependeDe) {
      if (!tempIds.has(p.dependeDe)) {
        errors.push({
          perguntaTempId: p.tempId,
          campo: "dependeDe",
          mensagem: `dependeDe '${p.dependeDe}' não declarada antes desta pergunta`,
        });
      }
      if (p.dependeValor === undefined || p.dependeValor === "") {
        errors.push({
          perguntaTempId: p.tempId,
          campo: "dependeValor",
          mensagem: "dependeValor obrigatório quando dependeDe é informado",
        });
      }
    }

    // gera_nc_se só faz sentido em sim_nao_na ou escolha.
    if (p.geraNcSe && !["sim_nao_na", "escolha"].includes(p.tipo)) {
      errors.push({
        perguntaTempId: p.tempId,
        campo: "geraNcSe",
        mensagem: "geraNcSe só é aplicável a sim_nao_na/escolha",
      });
    }
  }

  return errors;
}

// ============================================================
// Avaliação de visibilidade condicional (UI + testes)
// ============================================================
export type RespostasMap = Record<string, string | number | undefined>;

/** Retorna true se a pergunta deve ser exibida considerando as respostas atuais. */
export function perguntaVisivel(p: PerguntaTemplate, respostas: RespostasMap): boolean {
  if (!p.dependeDe) return true;
  const val = respostas[p.dependeDe];
  if (val === undefined || val === null) return false;
  return String(val) === String(p.dependeValor);
}

/** Lista perguntas visíveis dado o estado das respostas. */
export function perguntasVisiveis(
  modelo: ModeloTemplate,
  respostas: RespostasMap,
): PerguntaTemplate[] {
  return modelo.perguntas.filter((p) => perguntaVisivel(p, respostas));
}

/**
 * Score 0-100 considerando apenas perguntas sim_nao_na *visíveis* que têm
 * `geraNcSe` definido (= perguntas conformidade). Perguntas informativas
 * (altura sim/nao, energia sim/nao) não entram no score. "na" também não.
 * Pondera por `peso`.
 */
export function calcularScore(modelo: ModeloTemplate, respostas: RespostasMap): number {
  const visiveis = perguntasVisiveis(modelo, respostas);
  let pesoTotal = 0;
  let pesoConforme = 0;
  for (const p of visiveis) {
    if (p.tipo !== "sim_nao_na" || !p.geraNcSe) continue;
    const v = respostas[p.tempId];
    if (v === undefined || v === "na") continue;
    const peso = p.peso ?? 1;
    pesoTotal += peso;
    if (String(v) !== p.geraNcSe) pesoConforme += peso;
  }
  if (pesoTotal === 0) return 100;
  return Math.round((pesoConforme / pesoTotal) * 10000) / 100;
}

/** Lista perguntas visíveis cuja resposta dispara NC (`geraNcSe`). */
export function ncsDisparadas(modelo: ModeloTemplate, respostas: RespostasMap): PerguntaTemplate[] {
  return perguntasVisiveis(modelo, respostas).filter((p) => {
    if (!p.geraNcSe) return false;
    const v = respostas[p.tempId];
    return v !== undefined && String(v) === p.geraNcSe;
  });
}
