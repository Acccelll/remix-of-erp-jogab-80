/** @module-kind pure */
// Códigos e constantes centralizadas do módulo de Depto. Pessoal.
// Mantém consistência entre parser, telas e regras de negócio.

// Códigos de proventos que compõem "horas extras" no custo.
export const HE_CODIGOS = new Set(["200", "205", "250", "268", "854"]);

// Códigos de DSR sobre horas extras (Descanso Semanal Remunerado).
export const DSR_HE_CODIGOS = new Set(["250", "854"]);

// Rubrica do salário base (dias normais P).
export const SALARIO_BASE_CODIGO = "8781";

// Rubrica que caracteriza um holerite como adiantamento.
export const ADIANTAMENTO_CODIGO = "980";

// Limite a partir do qual horas extras viram alerta (% sobre a folha).
export const LIMITE_HE_FOLHA_PCT = 15;

// HE 60% acumulada no período a partir da qual o risco deixa de ser "médio".
// 03:30 é o teto praticado antes de o excedente exigir acordo de compensação.
export const HE60_RISCO_ALTO_MIN = 210;

// Teto diário de hora extra (CLT art. 59: 2 horas por dia). Acima disso o dia
// vira ocorrência mesmo que o acumulado do mês esteja dentro do limite.
export const LIMITE_HE_DIARIA_MIN = 120;

// Adicional de cada faixa de hora extra sobre a hora normal.
export const FATOR_HE_50 = 1.5;
export const FATOR_HE_60 = 1.6;
export const FATOR_HE_100 = 2.0;

// Tolerância da conciliação Ponto × Folha. Diferença menor que os dois limites
// é arredondamento de fechamento, não erro: acusá-la afogaria o que importa.
export const TOLERANCIA_CONCILIACAO_PCT = 2;
export const TOLERANCIA_CONCILIACAO_REAIS = 5;

// Multa rescisória sobre o FGTS acumulado.
export const RESCISAO_MULTA_FGTS = 0.4;

// Jornada padrão CLT (44h/sem ≈ 220h/mês). Usada como denominador no cálculo de R$/h.
export const JORNADA_MENSAL_HORAS = 220;
export const JORNADA_DIARIA_HORAS = 8;

// Qualquer minuto de interjornada (descanso entre jornadas) violado é considerado falha.
export const LIMITE_INTERJORNADA_MIN = 0;

// Códigos de centros de custo "indiretos" (administrativo / barracão) — não rateáveis a obra.
export const CENTROS_INDIRETOS = new Set(["101", "102", "ADM"]);
export const PALAVRAS_CENTRO_INDIRETO = ["adm", "barrac", "administra", "escrit"];

/** Extrai um identificador numérico canônico para casar depto de ponto x obra. */
export function extrairCodigoNumerico(s: string | null | undefined): string | null {
  if (!s) return null;
  // Pega o último grupo de 3-4 dígitos (cobre tanto "210 - COPI" quanto "01.002.0210").
  const matches = String(s).match(/\d{3,4}/g);
  if (!matches) return null;
  return matches[matches.length - 1].replace(/^0+/, "") || matches[matches.length - 1];
}

/** Detecta se um nome de departamento é centro indireto (ADM / Barracão / Escritório). */
export function isCentroIndireto(dep: string | null | undefined): boolean {
  if (!dep) return false;
  const s = dep.toLowerCase();
  if (PALAVRAS_CENTRO_INDIRETO.some((p) => s.includes(p))) return true;
  const cod = extrairCodigoNumerico(dep);
  return !!cod && CENTROS_INDIRETOS.has(cod);
}
