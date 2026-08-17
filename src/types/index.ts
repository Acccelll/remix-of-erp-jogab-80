export interface Obra {
  id: string;
  nome: string;
  cliente: string;
  clienteId?: string;
  servicos?: string[] | null;
  ativa: boolean;
  requerIntegracao: boolean;
  integracaoInfo: string;
  dataMobilizacao?: string;
  dataDesmobilizacao?: string;
  cnpj?: string;
  prazoPadraoPagamento?: string;
  diaFixoPagamento1?: string;
  diaFixoPagamento2?: string;
  dataCorteMedicao1?: string;
  dataCorteMedicao2?: string;
  observacao?: string;
  flowcastId?: string;
  codigo?: string;
  local?: string;
  /** Cidade da obra — fonte primária de posicionamento no mapa de logística. */
  cidade?: string;
  /** Sigla da UF (2 letras), necessária para desambiguar cidades homônimas. */
  uf?: string;
  /** Coordenada exata, quando o pin foi ajustado à mão; sobrepõe cidade/UF. */
  latitude?: number;
  longitude?: number;
  centroCustoTotvs?: string;
  valorContrato?: number;
  valorAntecipacao?: number;
  pedidoContrato?: string;
  dataInicio?: string;
  dataFim?: string;
  dataPrevisaoTermino?: string;
  diasCorteBms?: any;
  diasAteEmissaoNf?: number;
  prazoPagamentoDias?: number;
  diasFixosPagamento?: any;
  regraMedicao?: string;
  percentualMaterial?: number;
  aliquotaIss?: number;
  aliquotaInss?: number;
  aliquotaCbs?: number;
  aliquotaIbs?: number;
  observacoes?: string;
}

export interface Integracao {
  obraId: string;
  obraNome: string;
  dataIntegracao: string;
}

export interface DocumentoVencimento {
  id: string;
  nome: string;
  dataVencimento: string;
  obrigatorio: boolean;
  feriasId?: string;
}

/** Vocabulário de status de alocação do log de eventos (api.php). */
export type StatusAlocacao =
  | "folga"
  | "afastamento"
  | "ferias"
  | "sem_alocacao"
  /** Movimentação anterior ao log tipado: sabe-se que saiu da obra, não para onde. */
  | "indeterminado";

export interface HistoricoEntry {
  id: string;
  tipo:
    | "mobilizacao"
    | "status"
    /** Patrimônio transferido para um colaborador responsável. */
    | "responsavel"
    /** Contrato mudou de situação: rascunho, ativo, suspenso, encerrado… */
    | "status_contrato"
    | "inativacao"
    | "reativacao"
    | "afastamento"
    | "cadastro"
    | "outro";
  /** Prosa montada pelo backend. Mantida para exportações; não é fonte de verdade. */
  descricao: string;
  /** Data efetiva do evento (quando ele vale), ISO. */
  data: string;
  usuario: string;
  // Campos estruturados do log tipado. Ausentes em bancos sem a migração
  // 2026_07_30_colaborador_eventos_tipados_mysql.
  obraOrigemId?: string | null;
  obraOrigemNome?: string | null;
  obraDestinoId?: string | null;
  obraDestinoNome?: string | null;
  statusOrigem?: StatusAlocacao | StatusPatrimonio | StatusContratoAlocacao | StatusContrato | null;
  statusDestino?: StatusAlocacao | StatusPatrimonio | StatusContratoAlocacao | StatusContrato | null;
  /** Preenchido quando `tipo === "responsavel"` (histórico de patrimônio). */
  colaboradorId?: string | null;
  colaboradorNome?: string | null;
  observacao?: string | null;
  /** Instante do lançamento, ISO. Distinto de `data` para eventos agendados. */
  registradoEm?: string | null;
}

/** Vocabulário de status do patrimônio no log de eventos (api.php). */
export type StatusPatrimonio = "manutencao" | "sujo" | "sem_alocacao" | "indeterminado";

/** Alocação do contrato no log de eventos. */
export type StatusContratoAlocacao = "ocioso" | "sem_alocacao" | "indeterminado";

/** Período de alocação do contrato, vindo da rota `contratosPeriodos`. */
export interface PeriodoContrato {
  id: string;
  contrato_id: string;
  contrato_nome?: string | null;
  tipo: "obra" | "status";
  obra_id: string | null;
  obra_nome: string | null;
  from_obra_nome?: string | null;
  status: StatusContratoAlocacao | null;
  data_inicio: string;
  data_fim: string | null;
  dias: number;
  substituido?: boolean;
  usuario_nome?: string | null;
  registrado_em?: string | null;
}

/**
 * Período de alocação do patrimônio, vindo da rota `patrimoniosPeriodos`.
 *
 * `responsavel` é o período em que o bem esteve com um colaborador. A obra em
 * que ele aparece nesse intervalo não é gravada aqui: é derivada de onde o
 * responsável está, o que evita dois registros do mesmo fato podendo divergir.
 */
export interface PeriodoPatrimonio {
  id: string;
  patrimonio_id: string;
  patrimonio_codigo?: string | null;
  patrimonio_nome?: string | null;
  tipo: "obra" | "status" | "responsavel";
  obra_id: string | null;
  obra_nome: string | null;
  from_obra_nome?: string | null;
  status: StatusPatrimonio | null;
  colaborador_id?: string | null;
  colaborador_nome?: string | null;
  data_inicio: string;
  data_fim: string | null;
  dias: number;
  substituido?: boolean;
  usuario_nome?: string | null;
  registrado_em?: string | null;
}

/** Período fechado de alocação, vindo da rota `mobilizacoesPeriodos`. */
export interface PeriodoAlocacao {
  id: string;
  colaborador_id: string;
  colaborador_nome?: string | null;
  colaborador_matricula?: string | null;
  colaborador_funcao?: string | null;
  /** `obra` conta como período em obra; `status` é férias/folga/afastamento. */
  tipo: "obra" | "status";
  obra_id: string | null;
  obra_nome: string | null;
  from_obra_nome?: string | null;
  status: StatusAlocacao | null;
  data_inicio: string;
  data_fim: string | null;
  dias: number;
  /** Período substituído por outro na mesma data (duplicata ou correção). */
  substituido?: boolean;
  usuario_nome?: string | null;
  registrado_em?: string | null;
}

export interface FeriasEntry {
  id: string;
  quitado: boolean;
  diasQuitados: string;
  afastamento: string;
  faltas: string;
  vencimento: string;
  limiteConcessao: string;
}

export interface MobilizacaoPendente {
  obraDestinoId: string;
  obraDestinoNome: string;
  dataMobilizacao: string;
}

export interface Colaborador {
  id: string;
  matricula: string;
  nome: string;
  genero: string;
  cep: string;
  endereco: string;
  dataNascimento: string;
  localNascimento?: string;
  cidade?: string;
  etnia: string;
  estadoCivil: string;
  nomeConjuge: string;
  nomeMae: string;
  nomePai: string;
  nacionalidade: string;
  rg: string;
  dataEmissaoRG: string;
  orgaoEmissorRG: string;
  ufEmissorRG: string;
  cpf: string;
  dataEmissaoCPF: string;
  pis: string;
  dataEmissaoPIS: string;
  dataAdmissao: string;
  funcao: string;
  salario: string;
  formaSalario: "mensal" | "horista";
  ativo: boolean;
  obraAtualId: string | null;
  integracoes: Integracao[];
  documentos: DocumentoVencimento[];
  historico: HistoricoEntry[];
  ferias: FeriasEntry[];
  mobilizacaoPendente: MobilizacaoPendente | null;
  dataInativacao?: string;
  motivoInativacao?: "rescisao" | "outro";
  dataRescisao?: string;
  banco?: string;
  numeroBanco?: string;
  agencia?: string;
  numeroConta?: string;
  tipoConta?: string;
  tipoChavePix?: string;
  chavePix?: string;
  responsabilidades?: string[];
  /** Status especial vindo do backend (Férias, Atestado, Folga, etc.) */
  statusEspecial?: string | null;
  /** Sigla da UF (2 letras), par de `cidade` no mapa de logística. */
  uf?: string;
  /** Coordenada exata, quando o pin foi ajustado à mão; sobrepõe cidade/UF. */
  latitude?: number;
  longitude?: number;
}

export interface Patrimonio {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  obraAtualId: string | null;
  riscado: boolean;
  quebrado: boolean;
  /** Backend: em_manutencao */
  emManutencao?: boolean;
  sujo?: boolean;
  alugado: boolean;
  /** ID do colaborador responsável atual (denormalizado do período aberto) */
  responsavelId?: string | null;
  mobilizacaoPendente: MobilizacaoPendente | null;
  historico: HistoricoEntry[];
  dataInativacao?: string;
}

export type TipoVeiculo =
  | "Utilitário"
  | "De Passeio"
  | "Retroescavadeira"
  | "Escavadeira"
  | "Munck"
  | "Ônibus"
  | "Camionete";

export interface Veiculo {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoVeiculo;
  ativo: boolean;
  obraAtualId: string | null;
  riscado: boolean;
  /** @deprecated use manutencao */
  quebrado: boolean;
  manutencao?: boolean;
  sujo?: boolean;
  alugado: boolean;
  /** ID do colaborador responsável atual (denormalizado do período aberto) */
  responsavelId?: string | null;
  motoristaId?: string | null;
  mobilizacaoPendente: MobilizacaoPendente | null;
  historico: HistoricoEntry[];
}

/**
 * O que fazer com o veículo de um colaborador que está sendo mobilizado.
 * Decidida por veículo no diálogo de Gestão de Equipe: o carro pode ter ido
 * junto, ter passado para outro motorista ou ter ficado na obra sem motorista.
 */
export type DecisaoVeiculo =
  | { acao: "acompanha" }
  | { acao: "novoMotorista"; motoristaId: string }
  | { acao: "semMotorista" };

/** Decisões indexadas por `veiculo.id`. */
export type DecisoesVeiculos = Record<string, DecisaoVeiculo>;

export type PageKey =
  | "rh"
  | "dp"
  | "patrimonios"
  | "frotas"
  | "obras_div"
  | "admin"
  | "financeiro"
  | "contratos"
  // Módulo Suprimentos/Almoxarifado. Persistido na coluna legada
  // `usuarios.acesso_compras` — como `rh` mora em `acesso_colaboradores` e
  // `obras_div` em `acesso_obras`, o nome da coluna não acompanha a PageKey.
  // Não confundir com "compras" NivelAcesso (grau de `acesso_financeiro`) nem
  // com o SETOR `compras` de SETORES_SUPABASE: são três eixos distintos.
  | "almoxarifado"
  | "crm";

// Contratos
export type StatusContrato = "rascunho" | "ativo" | "suspenso" | "encerrado" | "inadimplente";
export type TipoContrato =
  | "Máquina"
  | "Internet"
  | "Faxina"
  | "Alimentação"
  | "Alojamento"
  | "Luz"
  | "Água"
  | "Contêiner"
  | "Outro";

export interface AditivoContrato {
  id: string;
  data: string;
  tipo: "prorrogacao" | "reajuste";
  novoTermino?: string;
  novoValor?: number;
  observacao?: string;
}

export interface Contrato {
  id: string;
  locacaoServico: string;
  inicio: string;
  termino: string;
  responsavel: string;
  contato: string;
  valor: number;
  formaPagamentoId?: string;
  periodicidadePagamento?: "Diário" | "Mensal" | "Quinzenal" | "Outro";
  tipo: TipoContrato;
  endereco?: string;
  tipoMaquina?: TipoVeiculo;
  observacao?: string;
  status: StatusContrato;
  ativo: boolean;
  obraAtualId: string | null;
  ocioso?: boolean;
  mobilizacaoPendente: MobilizacaoPendente | null;
  historico: HistoricoEntry[];
  aditivos: AditivoContrato[];
}
export type NivelAcesso = "nenhum" | "visualizar" | "editar" | "compras" | "financeiro";

// Financeiro types
export interface FormaPagamento {
  id: string;
  nome: string;
  tipo: "cartao_credito" | "pix" | "boleto" | "faturamento";
  nome_cartao?: string;
  ativo: boolean;
}

export type StatusSolicitacao = "em_analise" | "aprovado" | "reprovado" | "cancelado";
export type NivelPrioridade = "baixa" | "normal" | "alta" | "urgente";

export interface SolicitacaoFinanceira {
  id: string;
  setor: string;
  valor: number;
  data_pagamento?: string;
  prazo_estimado?: string;
  forma_pagamento_id?: string;
  nivel_prioridade: NivelPrioridade;
  condicao_pagamento?: string;
  centro_custo_id?: string;
  solicitante: string;
  fornecedor?: string;
  referencia?: string;
  observacao?: string;
  status: StatusSolicitacao;
  comentario_aprovacao?: string;
  pagamento_pendente?: boolean;
  /** Valor ainda provisório — destaca a linha em âmbar na fila de aprovação. */
  previsao?: boolean;
  criado_por: string;
  created_at?: string;
  updated_at?: string;
}

export interface SolicitacaoComentario {
  id: string;
  solicitacao_id: string;
  campo: string;
  texto: string;
  autor: string;
  created_at?: string;
}

export interface Despesa {
  id: string;
  solicitacao_id?: string;
  data_compra?: string;
  responsavel: string;
  descricao: string;
  centro_custo_id?: string;
  fornecedor?: string;
  valor: number;
  parcelas: number;
  cartao?: string;
  log_alteracoes?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface Player {
  id: string;
  login: string;
  senha: string;
  email: string;
  isGM: boolean;
  acessos: Record<PageKey, NivelAcesso>;
  /** PRO-031 · matriz página × ação (opcional; fonte-verdade quando presente). */
  matrizPermissoes?: Record<string, Partial<Record<"V" | "E" | "X" | "I" | "Ex", boolean>>>;
  /** PRO-031 · papéis especiais (aprovações + setores). */
  papeisPermissao?: {
    aprovarCompras?: boolean;
    aprovarFinanceiro?: boolean;
    setores?: string[];
  };
}

export interface Funcao {
  id: string;
  nome: string;
  nrs: string[];
  ativa: boolean;
  gestao?: string;
  /** Delegação (subdivisão para o histograma); null = sem delegação. */
  delegacaoId?: string | null;
}

/** Subdivisão de funções usada na visualização do Histograma. */
export interface Delegacao {
  id: string;
  nome: string;
  ordem: number;
}

export type GrupoVeiculoTipo = "Veículos" | "Equipamentos";

/** Cadastro de tipos de veículo (aba Tipos da página Veículos). */
export interface VeiculoTipoCadastro {
  id: string;
  nome: string;
  grupo: GrupoVeiculoTipo;
  ativo: boolean;
}

export interface DocumentoTipo {
  id: string;
  nome: string;
  vencimentoDias: number;
  avisoDias: number;
}

// DP Types — Departamento Pessoal

export interface HistoricoSalarialEntry {
  id: string;
  colaboradorId: string;
  vigencia: string;
  salarioAnterior?: number;
  salarioNovo: number;
  motivo: "admissao" | "reajuste" | "promocao" | "reenquadramento";
  cargo: string;
  responsavel: string;
  observacao?: string;
}

export type CategoriaProvisao = "ferias" | "decimo_terceiro" | "fgts" | "rescisao";
export type StatusProvisao = "prevista" | "consolidada" | "revertida";

export interface ProvisaoEntry {
  id: string;
  colaboradorId: string;
  competencia: string; // YYYY-MM
  categoria: CategoriaProvisao;
  status: StatusProvisao;
  valor: number;
  observacao?: string;
}

export type EtapaDecimoTerceiro = "adiantamento" | "parcela_final" | "encargos";
export type StatusDecimoTerceiro = "previsto" | "provisionado" | "pago";

export interface DecimoTerceiroEntry {
  id: string;
  colaboradorId: string;
  competencia: string; // YYYY
  etapa: EtapaDecimoTerceiro;
  status: StatusDecimoTerceiro;
  valor: number;
  origem: "folha" | "provisao" | "financeiro";
}

export type TipoHoraExtra = "he_50" | "he_100" | "noturna" | "domingo" | "feriado";
export type StatusHoraExtra = "pendente" | "aprovada" | "fechada" | "paga";

export interface HoraExtraEntry {
  id: string;
  colaboradorId: string;
  competencia: string; // YYYY-MM
  obraId?: string;
  obraNome?: string;
  tipo: TipoHoraExtra;
  status: StatusHoraExtra;
  quantidadeHoras: number;
  valorHora: number;
  valorTotal: number;
  data: string;
  observacao?: string;
}

export type TipoEventoFopag = "provento" | "desconto" | "base";
export type OrigemFopag =
  "cadastro" | "horas_extras" | "provisao" | "manual" | "importacao_mes" | "importacao_xls";

export interface CustoColaboradorCompetencia {
  id: string;
  colaboradorId: string;
  cpf: string;
  competencia: string; // YYYY-MM
  cargoLido?: string;
  matriculaLida?: string;
  centroCustoId?: string | null;
  centroCustoNome?: string;
  proventos: number;
  horasExtras: number;
  inssEmpresa: number;
  rat: number;
  inssTerceiros: number;
  fgts: number;
  provisao13: number;
  inssProvisao13: number;
  fgtsProvisao13: number;
  provisaoFerias: number;
  inssProvisaoFerias: number;
  fgtsProvisaoFerias: number;
  custoTotal: number;
}
export type StatusFopag = "previsto" | "consolidado" | "enviado_financeiro";

export interface FopagEntry {
  id: string;
  colaboradorId: string;
  competencia: string; // YYYY-MM
  evento: string;
  tipo: TipoEventoFopag;
  origem: OrigemFopag;
  status: StatusFopag;
  valor: number;
}

export interface FopagCompetencia {
  competencia: string; // YYYY-MM
  status: "aberta" | "fechada" | "enviada";
  totalProventos: number;
  totalDescontos: number;
  totalLiquido: number;
  totalFuncionarios: number;
}

export interface ResponsabilidadePeriodo {
  id: string;
  patrimonioId: string;
  colaboradorId: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string | null; // YYYY-MM-DD ou null se em aberto
}

// CRM Types
export interface Cliente {
  id: string;
  nome: string;
  cnpj?: string | null;
  contato?: string | null;
  email?: string | null;
  ativa: boolean;

  /**
   * Ids de `usuarios` responsáveis pela negociação deste cliente (a "carteira").
   * Persistido na tabela de junção MySQL `cliente_responsaveis` e usado como
   * recorte de visibilidade do CRM — ver src/lib/crm/escopo.ts.
   */
  responsaveisNegociacao?: string[];

  // Endereço
  nome_fantasia?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;

  // Prazos comerciais
  prazo_pagamento_dias?: number | null;
  dias_fixos_pagamento?: number[];
  prazo_emitir_nf_dias?: number | null;

  // Alíquotas/Retenções
  percentual_material?: number | null;
  aliquota_iss?: number | null;
  aliquota_inss?: number | null;
  aliquota_cbs?: number | null;
  aliquota_ibs?: number | null;
  observacoes?: string | null;
}

export interface Oportunidade {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  clienteId?: string | null;
  servicos?: string[] | null;
  origem?: string | null;
  status: string;
  estagio: string;
  observacao?: string | null;
  responsavelId?: string | null;
  valorEstimado: number;
  dataCriacao?: string | null;
  dataPrevistaFechamento?: string | null;
  temperatura_temperatura?: "frio" | "morno" | "quente" | null;
  contatos?: Array<{
    nome: string;
    telefone?: string;
    email?: string;
    funcaoSetor?: string;
  }> | null;
  localObra?: string | null;
  potencialInicioObra?: string | null;
  potencialTerminoObra?: string | null;
}

export interface OportunidadeComentario {
  id: string;
  oportunidadeId: string;
  texto: string;
  autor: string;
  created_at: string;
  updated_at: string;
}

/**
 * Comentário encadeado genérico para as entidades dos quadros operacionais
 * (Colaborador, Patrimônio, Contrato). `entidadeId` é o id da entidade dona.
 */
export interface ComentarioEntidade {
  id: string;
  entidadeId: string;
  texto: string;
  autor: string;
  created_at: string;
  updated_at: string;
}

export interface FunilEstagio {
  id: string;
  chave: string;
  rotulo: string;
  ordem: number;
  ativo: boolean;
}

export interface Interacao {
  id: string;
  oportunidadeId?: string | null;
  clienteId?: string | null;
  tipo: string;
  descricao?: string | null;
  data: string;
  usuarioId?: string | null;
  usuario_login?: string | null;
}
