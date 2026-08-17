import { cleanCPF } from "@/lib/utils";
import {
  Cliente,
  Colaborador,
  Obra,
  Player,
  Funcao,
  Patrimonio,
  Veiculo,
  DocumentoTipo,
  Contrato,
  Oportunidade,
  Interacao,
  FunilEstagio,
} from "@/types";
import { parseApiArray, parseApiBoolean, sanitizeMobilizacaoPendente } from "./helpers";

/**
 * Latitude/longitude. O PDO devolve colunas DECIMAL como string, e o backend
 * grava NULL quando não há posição — daí a conversão explícita e o descarte de
 * valores não numéricos, que virariam um pin no meio do oceano.
 */
const parseCoord = (v: any): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const parseJsonArray = (v: any): number[] | undefined => {
  if (Array.isArray(v)) return v.map(Number).filter((n) => !isNaN(n));
  if (typeof v === "string" && v) {
    try {
      return JSON.parse(v)
        .map(Number)
        .filter((n: number) => !isNaN(n));
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const clienteFromApi = (row: any): Cliente => ({
  id: String(row.id),
  nome: row.nome || "",
  cnpj: row.cnpj ?? undefined,
  contato: row.contato ?? undefined,
  email: row.email ?? undefined,
  ativa: parseApiBoolean(row.ativa),
  // Carteira: ids de usuários responsáveis pela negociação (tabela de junção).
  responsaveisNegociacao: Array.isArray(row.responsaveisNegociacao)
    ? row.responsaveisNegociacao.map(String)
    : [],
  // Novos campos - Endereço
  nome_fantasia: row.nome_fantasia ?? undefined,
  telefone: row.telefone ?? undefined,
  cep: row.cep ?? undefined,
  logradouro: row.logradouro ?? undefined,
  numero: row.numero ?? undefined,
  complemento: row.complemento ?? undefined,
  bairro: row.bairro ?? undefined,
  municipio: row.municipio ?? undefined,
  uf: row.uf ?? undefined,
  // Novos campos - Prazos Comerciais
  prazo_pagamento_dias: row.prazo_pagamento_dias ?? undefined,
  dias_fixos_pagamento: Array.isArray(row.dias_fixos_pagamento)
    ? row.dias_fixos_pagamento
    : typeof row.dias_fixos_pagamento === "string"
      ? JSON.parse(row.dias_fixos_pagamento)
      : undefined,
  prazo_emitir_nf_dias: row.prazo_emitir_nf_dias ?? undefined,
  // Novos campos - Alíquotas
  percentual_material: row.percentual_material ? Number(row.percentual_material) : undefined,
  aliquota_iss: row.aliquota_iss ? Number(row.aliquota_iss) : undefined,
  aliquota_inss: row.aliquota_inss ? Number(row.aliquota_inss) : undefined,
  aliquota_cbs: row.aliquota_cbs ? Number(row.aliquota_cbs) : undefined,
  aliquota_ibs: row.aliquota_ibs ? Number(row.aliquota_ibs) : undefined,
  observacoes: row.observacoes ?? undefined,
});

// ===== CRM =====
export const funilEstagioFromApi = (row: any): FunilEstagio => ({
  id: String(row.id),
  chave: row.chave,
  rotulo: row.rotulo,
  ordem: Number(row.ordem) || 0,
  ativo: parseApiBoolean(row.ativo),
});

export const oportunidadeFromApi = (row: any): Oportunidade => {
  let contatos: Array<{ nome: string; telefone?: string; email?: string }> | null = null;
  if (row.contatos) {
    try {
      contatos =
        typeof row.contatos === "string"
          ? JSON.parse(row.contatos)
          : Array.isArray(row.contatos)
            ? row.contatos
            : null;
    } catch {
      contatos = null;
    }
  }
  let servicos: string[] | null = null;
  if (row.servicos) {
    try {
      servicos =
        typeof row.servicos === "string"
          ? JSON.parse(row.servicos)
          : Array.isArray(row.servicos)
            ? row.servicos
            : null;
    } catch {
      servicos = null;
    }
  }
  return {
    id: String(row.id),
    nome: row.nome || "",
    email: row.email ?? undefined,
    telefone: row.telefone ?? undefined,
    empresa: row.empresa ?? undefined,
    servicos,
    origem: row.origem ?? undefined,
    status: row.status || "novo",
    estagio: row.estagio || "prospeccao",
    observacao: row.observacao ?? undefined,
    clienteId: row.clienteId ? String(row.clienteId) : null,
    responsavelId: row.responsavelId ? String(row.responsavelId) : null,
    valorEstimado: Number(row.valorEstimado ?? row.valor_estimado) || 0,
    dataCriacao: row.dataCriacao ?? null,
    dataPrevistaFechamento: row.dataPrevistaFechamento ?? row.data_prevista_fechamento ?? null,
    temperatura_temperatura: row.temperatura_temperatura ?? null,
    contatos,
    localObra: row.localObra ?? row.local_obra ?? null,
    potencialInicioObra: row.potencialInicioObra ?? row.potencial_inicio_obra ?? null,
    potencialTerminoObra: row.potencialTerminoObra ?? row.potencial_termino_obra ?? null,
  };
};

export const interacaoFromApi = (row: any): Interacao => ({
  id: String(row.id),
  oportunidadeId: row.oportunidadeId ? String(row.oportunidadeId) : null,
  clienteId: row.clienteId ? String(row.clienteId) : null,
  tipo: row.tipo || "nota",
  descricao: row.descricao ?? undefined,
  data: row.data,
  usuarioId: row.usuarioId ? String(row.usuarioId) : null,
  usuario_login: row.usuario_login ?? null,
});

export const obraFromApi = (row: any): Obra =>
  ({
    id: String(row.id),
    // Identificação
    codigo: row.codigo ?? undefined,
    nome: row.nome || "",
    cliente: row.cliente || row.cliente_nome || "",
    clienteId:
      (row.clienteId ?? row.cliente_id) ? String(row.clienteId ?? row.cliente_id) : undefined,
    pedidoContrato: row.pedidoContrato ?? row.pedido_contrato ?? undefined,
    local: row.local ?? undefined,
    // Georreferenciamento (ausentes em bancos sem a migração de 2026-07-26)
    cidade: row.cidade ?? undefined,
    uf: row.uf ?? undefined,
    latitude: parseCoord(row.latitude),
    longitude: parseCoord(row.longitude),
    centroCustoTotvs: row.centroCustoTotvs ?? row.centro_custo_totvs ?? undefined,
    flowcastId: row.flowcastId ?? row.flowcast_id ?? undefined,
    // Status
    ativa: parseApiBoolean(row.ativa),
    requerIntegracao: parseApiBoolean(row.requerIntegracao),
    integracaoInfo: row.integracaoInfo || "",
    // Datas
    dataMobilizacao: row.dataMobilizacao ?? undefined,
    dataDesmobilizacao: row.dataDesmobilizacao ?? undefined,
    dataInicio: row.dataInicio ?? row.data_inicio ?? undefined,
    dataFim: row.dataFim ?? row.data_fim ?? undefined,
    dataPrevisaoTermino: row.dataPrevisaoTermino ?? row.data_previsao_termino ?? undefined,
    // Contrato financeiro
    valorContrato:
      row.valorContrato != null
        ? Number(row.valorContrato)
        : row.valor_contrato != null
          ? Number(row.valor_contrato)
          : undefined,
    valorAntecipacao:
      row.valorAntecipacao != null
        ? Number(row.valorAntecipacao)
        : row.valor_antecipacao != null
          ? Number(row.valor_antecipacao)
          : undefined,
    regraMedicao: row.regraMedicao ?? row.regra_medicao ?? undefined,
    diasCorteBms: parseJsonArray(row.diasCorteBms ?? row.dias_corte_bms),
    diasAteEmissaoNf:
      row.diasAteEmissaoNf != null
        ? Number(row.diasAteEmissaoNf)
        : row.dias_ate_emissao_nf != null
          ? Number(row.dias_ate_emissao_nf)
          : undefined,
    // Pagamento
    cnpj: row.cnpj ?? undefined,
    prazoPadraoPagamento: row.prazoPadraoPagamento ?? row.prazo_padrao_pagamento ?? undefined,
    prazoPagamentoDias:
      row.prazoPagamentoDias != null
        ? Number(row.prazoPagamentoDias)
        : row.prazo_pagamento_dias != null
          ? Number(row.prazo_pagamento_dias)
          : undefined,
    diaFixoPagamento1: row.diaFixoPagamento1 ?? row.dia_fixo_pagamento_1 ?? undefined,
    diaFixoPagamento2: row.diaFixoPagamento2 ?? row.dia_fixo_pagamento_2 ?? undefined,
    diasFixosPagamento: parseJsonArray(row.diasFixosPagamento ?? row.dias_fixos_pagamento),
    dataCorteMedicao1: row.dataCorteMedicao1 ?? row.data_corte_medicao_1 ?? undefined,
    dataCorteMedicao2: row.dataCorteMedicao2 ?? row.data_corte_medicao_2 ?? undefined,
    // Retenções
    percentualMaterial:
      row.percentualMaterial != null
        ? Number(row.percentualMaterial)
        : row.percentual_material != null
          ? Number(row.percentual_material)
          : undefined,
    aliquotaIss:
      row.aliquotaIss != null
        ? Number(row.aliquotaIss)
        : row.aliquota_iss != null
          ? Number(row.aliquota_iss)
          : undefined,
    aliquotaInss:
      row.aliquotaInss != null
        ? Number(row.aliquotaInss)
        : row.aliquota_inss != null
          ? Number(row.aliquota_inss)
          : undefined,
    aliquotaCbs:
      row.aliquotaCbs != null
        ? Number(row.aliquotaCbs)
        : row.aliquota_cbs != null
          ? Number(row.aliquota_cbs)
          : undefined,
    aliquotaIbs:
      row.aliquotaIbs != null
        ? Number(row.aliquotaIbs)
        : row.aliquota_ibs != null
          ? Number(row.aliquota_ibs)
          : undefined,
    // Misc
    observacao: row.observacao ?? undefined,
    observacoes: row.observacoes ?? undefined,
  }) as unknown as Obra;

export const colaboradorFromApi = (row: any): Colaborador => ({
  id: String(row.id),
  matricula: row.matricula || "",
  nome: row.nome || "",
  genero: row.genero || "",
  cep: row.cep || "",
  endereco: row.endereco || "",
  dataNascimento: row.dataNascimento || "",
  cidade: row.cidade || "",
  // Georreferenciamento (ausentes em bancos sem a migração de 2026-07-26)
  uf: row.uf ?? undefined,
  latitude: parseCoord(row.latitude),
  longitude: parseCoord(row.longitude),
  etnia: row.etnia || "",
  estadoCivil: row.estadoCivil || "",
  nomeConjuge: row.nomeConjuge || "",
  nomeMae: row.nomeMae || "",
  nomePai: row.nomePai || "",
  nacionalidade: row.nacionalidade || "",
  rg: row.rg || "",
  dataEmissaoRG: row.dataEmissaoRG || "",
  orgaoEmissorRG: row.orgaoEmissorRG || "",
  ufEmissorRG: row.ufEmissorRG || "",
  cpf: cleanCPF(row.cpf) || "",
  dataEmissaoCPF: row.dataEmissaoCPF || "",
  pis: row.pis || "",
  dataEmissaoPIS: row.dataEmissaoPIS || "",
  dataAdmissao: row.dataAdmissao || "",
  funcao: row.funcao || "",
  salario: row.salario || "0",
  formaSalario: (row.formaSalario || "mensal") as "mensal" | "horista",
  ativo: parseApiBoolean(row.ativo),
  obraAtualId:
    (row.obraAtualId ?? row.obra_atual_id) ? String(row.obraAtualId ?? row.obra_atual_id) : null,
  integracoes: Array.isArray(row.integracoes) ? row.integracoes : [],
  documentos: Array.isArray(row.documentos) ? row.documentos : [],
  historico: Array.isArray(row.historico) ? row.historico : [],
  ferias: Array.isArray(row.ferias) ? row.ferias : [],
  mobilizacaoPendente: sanitizeMobilizacaoPendente(row.mobilizacaoPendente),
  dataInativacao: row.dataInativacao ?? row.data_inativacao ?? undefined,
  motivoInativacao: row.motivoInativacao ?? row.motivo_inativacao ?? undefined,
  dataRescisao: row.dataRescisao ?? row.data_rescisao ?? undefined,
  banco: row.banco ?? undefined,
  numeroBanco: row.numeroBanco ?? row.numero_banco ?? undefined,
  agencia: row.agencia ?? undefined,
  numeroConta: row.numeroConta ?? row.numero_conta ?? undefined,
  tipoConta: row.tipoConta ?? row.tipo_conta ?? undefined,
  tipoChavePix: row.tipoChavePix ?? row.tipo_chave_pix ?? undefined,
  chavePix: row.chavePix ?? row.chave_pix ?? undefined,
  responsabilidades: Array.isArray(row.responsabilidades) ? row.responsabilidades : undefined,
  statusEspecial: row.statusEspecial ?? row.status_especial ?? null,
});

export const patrimonioFromApi = (row: any): Patrimonio => {
  const responsavelId = row.responsavelId ?? row.responsavel_id ?? null;
  const emManutencao = parseApiBoolean(row.emManutencao ?? row.em_manutencao ?? row.quebrado);
  const sujo = parseApiBoolean(row.sujo);

  // Coluna do quadro derivada do estado persistido. O banco guarda o vínculo em
  // `responsavel_id` (com `obra_atual_id` nulo, porque são exclusivos), mas o
  // quadro identifica colunas por `obraAtualId`. Sem esta derivação, o
  // `__resp__<id>` só existia em memória logo após o arrasto: no primeiro
  // reload o bem caía em "Sem Alocação" e o vínculo sumia da tela — embora
  // continuasse gravado.
  let obraAtualId: string | null = row.obraAtualId ? String(row.obraAtualId) : null;
  if (!obraAtualId && responsavelId) obraAtualId = `__resp__${responsavelId}`;
  else if (!obraAtualId && emManutencao) obraAtualId = "__manutencao__";
  else if (!obraAtualId && sujo) obraAtualId = "__sujo__";

  return {
    id: String(row.id),
    codigo: row.codigo || "",
    nome: row.nome || "",
    ativo: parseApiBoolean(row.ativo),
    obraAtualId,
    riscado: parseApiBoolean(row.riscado),
    quebrado: parseApiBoolean(row.quebrado ?? row.emManutencao ?? row.em_manutencao),
    emManutencao,
    sujo,
    alugado: parseApiBoolean(row.alugado),
    responsavelId,
    mobilizacaoPendente: sanitizeMobilizacaoPendente(row.mobilizacaoPendente),
    historico: Array.isArray(row.historico) ? row.historico : [],
    dataInativacao: row.dataInativacao ?? row.data_inativacao ?? undefined,
  };
};

export const veiculoFromApi = (row: any): Veiculo => ({
  id: String(row.id),
  codigo: row.codigo || "",
  nome: row.nome || "",
  tipo: row.tipo || "Utilitário",
  ativo: parseApiBoolean(row.ativo),
  obraAtualId: row.obraAtualId ? String(row.obraAtualId) : null,
  riscado: parseApiBoolean(row.riscado),
  quebrado: parseApiBoolean(row.quebrado ?? row.manutencao ?? row.em_manutencao),
  manutencao: parseApiBoolean(row.manutencao ?? row.em_manutencao ?? row.quebrado),
  sujo: parseApiBoolean(row.sujo),
  alugado: parseApiBoolean(row.alugado),
  motoristaId: row.motoristaId ?? row.motorista_id ?? null,
  mobilizacaoPendente: sanitizeMobilizacaoPendente(row.mobilizacaoPendente),
  historico: parseApiArray(row.historico),
});

export const contratoFromApi = (row: any): Contrato => ({
  id: String(row.id),
  locacaoServico: row.locacaoServico ?? row.locacao_servico ?? "",
  inicio: row.inicio ?? "",
  termino: row.termino ?? "",
  responsavel: row.responsavel ?? "",
  contato: row.contato ?? "",
  valor: typeof row.valor === "number" ? row.valor : parseFloat(row.valor || "0") || 0,
  formaPagamentoId: row.formaPagamentoId ?? row.forma_pagamento_id ?? undefined,
  periodicidadePagamento: row.periodicidadePagamento ?? row.periodicidade_pagamento ?? undefined,
  tipo: row.tipo || "Outro",
  endereco: row.endereco ?? undefined,
  tipoMaquina: row.tipoMaquina ?? row.tipo_maquina ?? undefined,
  observacao: row.observacao ?? undefined,
  status: row.status || "rascunho",
  ativo: row.ativo === undefined ? true : parseApiBoolean(row.ativo),
  obraAtualId: row.obraAtualId ? String(row.obraAtualId) : null,
  ocioso: parseApiBoolean(row.ocioso),
  mobilizacaoPendente: sanitizeMobilizacaoPendente(row.mobilizacaoPendente),
  historico: Array.isArray(row.historico) ? row.historico : [],
  aditivos: Array.isArray(row.aditivos) ? row.aditivos : [],
});

// Colunas JSON do MySQL podem chegar como objeto (já decodificado pelo PHP)
// ou string JSON; ausente/inválido vira undefined (fallback legado no runtime).
const parsePermissaoJson = <T>(value: unknown): T | undefined => {
  if (value == null) return undefined;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      const dec = JSON.parse(value);
      return dec && typeof dec === "object" ? (dec as T) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const playerFromApi = (row: any): Player => {
  const acessos = { ...(row.acessos || {}) };
  // Coluna dedicada no backend para a seção Administração (Contratos)
  if (
    row.acesso_contratos !== undefined &&
    row.acesso_contratos !== null &&
    row.acesso_contratos !== ""
  ) {
    acessos.contratos = row.acesso_contratos;
  }
  return {
    id: String(row.id),
    login: row.login || "",
    senha: row.senha || "",
    email: row.email || "",
    isGM: parseApiBoolean(row.isGM ?? row.is_gm),
    acessos,
    matrizPermissoes: parsePermissaoJson<Player["matrizPermissoes"]>(
      row.matrizPermissoes ?? row.matriz_permissoes,
    ),
    papeisPermissao: parsePermissaoJson<Player["papeisPermissao"]>(
      row.papeisPermissao ?? row.papeis_permissao,
    ),
  };
};

export const funcaoFromApi = (row: any): Funcao => ({
  id: String(row.id),
  nome: row.nome || "",
  nrs: Array.isArray(row.nrs)
    ? row.nrs
    : row.nrs_obrigatorias
      ? String(row.nrs_obrigatorias).split(",").filter(Boolean)
      : [],
  ativa:
    row.ativa !== undefined
      ? parseApiBoolean(row.ativa)
      : row.status === "ativa" || row.status === undefined,
  gestao: row.gestao || undefined,
  delegacaoId: row.delegacaoId != null ? String(row.delegacaoId) : null,
});

export const docTipoFromApi = (row: any): DocumentoTipo => {
  const dias =
    row.vencimentoDias ??
    row.vencimento_dias ??
    (row.vencimentoMeses != null
      ? Number(row.vencimentoMeses) * 30
      : row.vencimento_meses != null
        ? Number(row.vencimento_meses) * 30
        : 365);
  return {
    id: String(row.id),
    nome: row.nome || "",
    vencimentoDias: Number(dias) || 365,
    avisoDias: row.avisoDias ?? row.aviso_dias ?? 30,
  };
};
