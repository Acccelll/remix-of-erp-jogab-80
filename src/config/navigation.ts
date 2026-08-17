import type { LucideIcon } from "lucide-react";
import {
  Kanban,
  LayoutGrid,
  HardHat,
  Building,
  Users,
  Briefcase,
  FolderOpen,
  Package,
  Archive,
  Car,
  FileSignature,
  Files,
  Gauge,
  FileSpreadsheet,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  MapPinned,
  Network,
  Tags,
  Contact,
  CheckCircle,
  Receipt,
  CreditCard,
  Banknote,
  UserCog,
  Wallet,
  Clock,
  Timer,
  LineChart,
  Calculator,
  Shield,
  Truck,
  ClipboardList,
  List,
  Scale,
  FileText,
  PackageCheck,
  Boxes,
  ShieldAlert,
  CalendarRange,
  BarChart3,
  AlertTriangle,
  BookOpen,
  Activity,
  QrCode,
  ShieldCheck,
  Database,
  Layers,
  Settings,
  History,
  Flag,
} from "lucide-react";
import type { PageKey } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: PageKey;
  keywords?: string[];
  /**
   * Item renderizado para QUALQUER usuário autenticado, ignorando
   * `permission` (a rota correspondente não tem guard). Itens assim ficam
   * fora do Quadro de Permissões do GM — marcar lá não teria efeito.
   */
  alwaysVisible?: boolean;
}

export interface NavGroup {
  /** Identificador estável do grupo (usado em storage e para o indicador ativo). */
  id: string;
  label: string;
  /**
   * Permissões que tornam o grupo elegível. O grupo é exibido se o usuário
   * tem acesso a QUALQUER uma delas. Cada item ainda é filtrado por sua
   * própria `permission`.
   */
  permissions: PageKey[];
  items: NavItem[];
}

/**
 * Fonte única de navegação. Consolidação Fase 4:
 * - 52 → ~30 itens visíveis na sidebar.
 * - Páginas correlatas viraram abas dentro de hubs (Qualidade, Planejamento,
 *   Custos, Suprimentos, Fluxo & Dívidas, Cadastros Financeiros, Contratos,
 *   Patrimônios).
 * - Sub-rotas continuam acessíveis via URL direta, ⌘K (Command Palette) e
 *   breadcrumbs — ficam em `HIDDEN_NAV_ITEMS` mais abaixo.
 */
export const NAV_REGISTRY: NavGroup[] = [
  {
    id: "obras",
    label: "Obras",
    permissions: ["obras_div"],
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: Gauge,
        permission: "obras_div",
        alwaysVisible: true,
        keywords: ["home", "inicio", "painel", "progresso", "obras", "meus cartoes", "dashboard"],
      },
      {
        to: "/quadros",
        label: "Kanban",
        icon: LayoutGrid,
        permission: "obras_div",
        keywords: ["trello", "cards", "tarefas", "board", "multi", "listas", "quadro geral"],
      },

      {
        to: "/histograma",
        label: "Histograma",
        icon: BarChart3,
        permission: "obras_div",
        keywords: ["recursos", "semanas", "delegações", "equipamentos", "mão de obra", "alocação"],
      },
      {
        to: "/planejamento",
        label: "Planejamento Lean",
        icon: Gauge,
        permission: "obras_div",
        keywords: [
          "evm",
          "curva s",
          "spi",
          "cpi",
          "ppc",
          "lookahead",
          "pacotes",
          "restricoes",
          "rdo",
          "riscos",
          "licoes",
          "lean",
          "last planner",
        ],
      },
      {
        to: "/inspecoes",
        label: "Qualidade",
        icon: ShieldCheck,
        permission: "obras_div",
        keywords: [
          "fvs",
          "fvm",
          "checklist",
          "nr",
          "qualidade",
          "inspecao",
          "nc",
          "nao conformidade",
          "agenda",
          "qr",
        ],
      },
      {
        to: "/mobilizacao-provisoria",
        label: "Mobilização Provisória",
        icon: HardHat,
        permission: "obras_div",
      },
      {
        to: "/obras",
        label: "Obras",
        icon: Building,
        permission: "obras_div",
        keywords: ["obras", "cadastro de obras"],
      },
    ],
  },
  {
    id: "recursos-humanos",
    label: "Recursos Humanos",
    permissions: ["rh"],
    items: [
      { to: "/rh/equipes", label: "Gestão de Equipe", icon: Kanban, permission: "rh" },
      { to: "/rh/colaboradores", label: "Colaboradores", icon: Users, permission: "rh" },
      {
        to: "/rh/logistica",
        label: "Logística de Colaboradores",
        icon: MapPinned,
        permission: "rh",
        keywords: ["mapa", "geolocalizacao", "distancia", "rota", "mobilizacao", "logistica"],
      },

      { to: "/rh/funcoes", label: "Funções", icon: Briefcase, permission: "rh" },
      {
        to: "/rh/controle-documentos",
        label: "Controle de Documentos",
        icon: FolderOpen,
        permission: "rh",
      },
    ],
  },
  {
    id: "departamento-pessoal",
    label: "Departamento Pessoal",
    permissions: ["dp"],
    items: [
      {
        to: "/dp/ponto",
        label: "Ponto",
        icon: Clock,
        permission: "dp",
        keywords: [
          "analise de ponto",
          "importar",
          "rhid",
          "sincronizacao",
          "absenteismo",
          "horas extras",
        ],
      },
      {
        to: "/dp/custos",
        label: "Custos de Pessoal",
        icon: Calculator,
        permission: "dp",
        keywords: [
          "custo do colaborador",
          "custo mod",
          "provisoes",
          "horas extras",
          "homem hora",
          "historico salarial",
          // A Folha de Pagamento virou a aba Custo do Colaborador daqui; sem
          // estes termos a busca do menu perderia quem procura pelo nome antigo.
          "folha de pagamento",
          "fopag",
          "holerite",
          "adiantamento",
          "encargos",
          "fator k",
        ],
      },
    ],
  },
  {
    id: "suprimentos",
    label: "Suprimentos",
    // Módulo próprio (PageKey `almoxarifado`). Antes herdava obras_div, o que
    // fazia conceder Suprimentos conceder Obras junto — inclusive no servidor,
    // onde obras_div libera medições/notas fiscais da obra.
    permissions: ["almoxarifado"],
    items: [
      {
        to: "/suprimentos",
        label: "Suprimentos",
        icon: Package,
        permission: "almoxarifado",
        keywords: [
          "compras",
          "produção",
          "requisições",
          "cotações",
          "ordens de compra",
          "estoque",
          "recebimento",
          "fornecedores",
          "insumos",
          "composições",
          "orçamento",
          "curva abc",
          "alçadas",
          "grupos",
        ],
      },
    ],
  },
  {
    id: "ativos",
    label: "Ativos & Frotas",
    permissions: ["patrimonios", "frotas", "contratos"],
    items: [
      {
        to: "/patrimonios",
        label: "Patrimônios",
        icon: Package,
        permission: "patrimonios",
        keywords: ["quadro", "lista", "ativos"],
      },
      {
        to: "/veiculos",
        label: "Veículos",
        icon: Car,
        permission: "frotas",
        keywords: ["frota", "carros"],
      },
      {
        to: "/contratos",
        label: "Contratos",
        icon: FileSignature,
        permission: "contratos",
        keywords: ["quadro", "lista", "gestao"],
      },
      {
        to: "/logistica-ativos",
        label: "Logística",
        icon: Truck,
        permission: "patrimonios",
        keywords: ["romaneio", "transporte", "quadro", "lista", "estoque", "mobilizacao"],
      },
    ],
  },
  {
    id: "financeiro",
    // ⚠️ Todas as páginas abaixo compartilham a PageKey "financeiro": o gate
    // GROSSO (hasAccess) não as distingue. A visibilidade por página depende do
    // gate FINO por rota (can(rota,"V")) na sidebar/CommandPalette/RequireAccess.
    // Ao gatear página do financeiro, use rota — nunca hasAccess("financeiro").
    // Ver docs/security/access-control.md §8.3.
    label: "Financeiro",
    permissions: ["financeiro"],
    items: [
      { to: "/financeiro/dashboard", label: "Dashboard", icon: Gauge, permission: "financeiro" },
      {
        to: "/financeiro/lancamentos",
        label: "Lançamentos",
        icon: FileSpreadsheet,
        permission: "financeiro",
      },
      {
        to: "/financeiro/aprovacao",
        label: "Aprovação Financeira",
        icon: CheckCircle,
        permission: "financeiro",
      },
      {
        to: "/financeiro/despesas",
        label: "Despesas",
        icon: Receipt,
        permission: "financeiro",
        keywords: ["controle de despesas"],
      },
      {
        to: "/financeiro/faturamento",
        label: "Faturamento",
        icon: ReceiptText,
        permission: "financeiro",
      },
      {
        to: "/financeiro/antecipacao",
        label: "Antecipação",
        icon: Banknote,
        permission: "financeiro",
        keywords: ["desconto", "cessão", "FIDC", "risco sacado"],
      },
      {
        to: "/financeiro/fluxo",
        label: "Fluxo & Dívidas",
        icon: TrendingUp,
        permission: "financeiro",
        keywords: ["fluxo de caixa", "evolução de dívidas"],
      },
      {
        to: "/financeiro/cadastros",
        label: "Cadastros",
        icon: Database,
        permission: "financeiro",
        keywords: ["centros de custo", "naturezas", "clientes", "formas de pagamento"],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    permissions: ["crm"],
    items: [
      { to: "/crm", label: "Dashboard", icon: Gauge, permission: "crm" },
      {
        to: "/crm/vendas",
        label: "Funil de Vendas",
        icon: TrendingUp,
        permission: "crm",
        keywords: ["funil", "oportunidades", "vendas"],
      },
      { to: "/crm/clientes", label: "Clientes", icon: Contact, permission: "crm" },
    ],
  },
  {
    id: "gerenciamento",
    label: "Gerenciamento",
    permissions: ["admin"],
    items: [
      { to: "/gm", label: "GM", icon: Shield, permission: "admin" },
      { to: "/gm/auditoria", label: "Auditoria", icon: History, permission: "admin" },
      { to: "/gm/saude", label: "Saúde do Sistema", icon: Activity, permission: "admin" },
      { to: "/gm/feature-flags", label: "Feature Flags", icon: Flag, permission: "admin" },
    ],
  },
];

/**
 * Itens "escondidos" da sidebar (movidos para abas dentro de hubs) que
 * continuam acessíveis via URL direta e ⌘K Command Palette.
 *
 * Importante: cada `to` deve corresponder a uma rota real em `src/App.tsx`
 * e não pode duplicar nenhum `to` de `NAV_REGISTRY`.
 */
export const HIDDEN_NAV_ITEMS: NavItem[] = [
  // Qualidade — abas de /inspecoes
  {
    to: "/inspecoes/lista",
    label: "Inspeções — Lista",
    icon: ClipboardList,
    permission: "obras_div",
    keywords: ["fvs", "fvm", "checklist"],
  },
  {
    to: "/inspecoes/dashboard",
    label: "Inspeções — Dashboard",
    icon: Gauge,
    permission: "obras_div",
    keywords: ["kpi", "score", "nc"],
  },
  {
    to: "/inspecoes/agenda",
    label: "Inspeções — Agenda",
    icon: CalendarRange,
    permission: "obras_div",
    keywords: ["agendamento", "recorrente"],
  },
  {
    to: "/inspecoes/qr",
    label: "Inspeções — QR Codes",
    icon: QrCode,
    permission: "obras_div",
    keywords: ["qr", "etiqueta", "frente", "equipamento"],
  },
  {
    to: "/inspecoes/ncs",
    label: "Não Conformidades",
    icon: ShieldAlert,
    permission: "obras_div",
    keywords: ["nc", "5w2h", "tratativa"],
  },

  // Suprimentos — abas de /suprimentos
  {
    to: "/suprimentos/compras",
    label: "Suprimentos — Compras",
    icon: Kanban,
    permission: "almoxarifado",
    keywords: ["quadro de compras", "kanban", "consolidado"],
  },
  {
    to: "/suprimentos/producao",
    label: "Suprimentos — Produção",
    icon: Kanban,
    permission: "almoxarifado",
    keywords: ["quadro de produção", "solda", "corte", "dobra"],
  },
  {
    to: "/suprimentos/requisicoes",
    label: "Requisições",
    icon: ClipboardList,
    permission: "almoxarifado",
    keywords: ["pedido", "compra", "solicitação"],
  },
  {
    to: "/suprimentos/cotacoes",
    label: "Cotações",
    icon: Scale,
    permission: "almoxarifado",
    keywords: ["mapa", "comparativo", "preço"],
  },
  {
    to: "/suprimentos/ordens-compra",
    label: "Ordens de Compra",
    icon: FileText,
    permission: "almoxarifado",
    keywords: ["OC", "pedido", "compra"],
  },
  {
    to: "/suprimentos/estoque/saldos",
    label: "Estoque — Saldos",
    icon: Boxes,
    permission: "almoxarifado",
  },
  {
    to: "/suprimentos/recebimento",
    label: "Recebimento",
    icon: PackageCheck,
    permission: "almoxarifado",
    keywords: ["NF", "entrega"],
  },
  {
    to: "/suprimentos/fornecedores",
    label: "Fornecedores",
    icon: Truck,
    permission: "almoxarifado",
    keywords: ["compras", "supplier"],
  },
  {
    to: "/suprimentos/insumos",
    label: "Banco de Insumos",
    icon: Package,
    permission: "almoxarifado",
    keywords: ["materiais", "mão de obra", "equipamento", "serviço"],
  },
  {
    to: "/suprimentos/composicoes",
    label: "Composições",
    icon: Layers,
    permission: "almoxarifado",
    keywords: ["SINAPI", "SICRO", "TCPO", "coeficiente"],
  },
  {
    to: "/suprimentos/orcamento",
    label: "Orçamento por Atividade",
    icon: Calculator,
    permission: "almoxarifado",
    keywords: ["atividade", "custo", "baseline"],
  },
  {
    to: "/suprimentos/curva-abc",
    label: "Curva ABC",
    icon: BarChart3,
    permission: "almoxarifado",
    keywords: ["classe A", "classe B", "classe C", "insumos críticos"],
  },
  {
    to: "/suprimentos/alcadas",
    label: "Alçadas de Aprovação",
    icon: ShieldAlert,
    permission: "almoxarifado",
    keywords: ["alçada", "aprovação", "OC", "limite"],
  },
  {
    to: "/suprimentos/grupos-gestao",
    label: "Grupos de Negociação",
    icon: Settings,
    permission: "almoxarifado",
    keywords: ["configuração", "compras", "rótulos", "cards"],
  },

  // Planejamento — abas de /planejamento
  {
    to: "/planejamento/dashboard",
    label: "Planejamento — Dashboard",
    icon: Gauge,
    permission: "obras_div",
  },
  {
    to: "/planejamento/dashboard-lean",
    label: "Planejamento — Dashboard Lean",
    icon: Activity,
    permission: "obras_div",
    keywords: ["executivo", "consolidado"],
  },
  {
    to: "/planejamento/pacotes",
    label: "Pacotes de Trabalho",
    icon: Package,
    permission: "obras_div",
    keywords: ["last planner", "lean", "wbs"],
  },
  {
    to: "/planejamento/restricoes",
    label: "Restrições",
    icon: ShieldAlert,
    permission: "obras_div",
    keywords: ["bloqueio", "constraint"],
  },
  {
    to: "/planejamento/lookahead",
    label: "Lookahead 6 semanas",
    icon: CalendarRange,
    permission: "obras_div",
  },
  {
    to: "/planejamento/ppc",
    label: "PPC & Causas",
    icon: BarChart3,
    permission: "obras_div",
    keywords: ["percent plan complete", "pareto"],
  },
  {
    to: "/planejamento/riscos",
    label: "Matriz de Riscos",
    icon: AlertTriangle,
    permission: "obras_div",
    keywords: ["risco", "heatmap"],
  },
  {
    to: "/planejamento/licoes-aprendidas",
    label: "Lições Aprendidas",
    icon: BookOpen,
    permission: "obras_div",
  },
  {
    to: "/planejamento/rdo",
    label: "RDO Consolidado",
    icon: ClipboardList,
    permission: "obras_div",
    keywords: ["diário de obra", "efetivo"],
  },

  // DP — abas de /dp/custos
  {
    to: "/dp/custos/colaborador",
    label: "Custo do Colaborador",
    icon: Calculator,
    permission: "dp",
  },
  { to: "/dp/custo-obra", label: "Custo de Mão de Obra Direta", icon: UserCog, permission: "dp" },
  { to: "/dp/provisoes", label: "Provisões", icon: Wallet, permission: "dp" },
  { to: "/dp/homem-hora", label: "Homem/Hora", icon: Timer, permission: "dp" },
  { to: "/dp/historico-salarial", label: "Histórico Salarial", icon: LineChart, permission: "dp" },

  // Financeiro — abas de /financeiro/fluxo e /financeiro/cadastros
  {
    to: "/financeiro/fluxo/caixa",
    label: "Fluxo de Caixa",
    icon: TrendingUp,
    permission: "financeiro",
  },
  {
    to: "/financeiro/dividas",
    label: "Evolução de Dívidas",
    icon: TrendingDown,
    permission: "financeiro",
  },
  { to: "/financeiro/centros", label: "Centros de Custo", icon: Network, permission: "financeiro" },
  { to: "/financeiro/naturezas", label: "Naturezas", icon: Tags, permission: "financeiro" },
  { to: "/financeiro/clientes", label: "Clientes", icon: Contact, permission: "financeiro" },
  {
    to: "/financeiro/formas-pagamento",
    label: "Formas de Pagamento",
    icon: CreditCard,
    permission: "financeiro",
  },

  // Contratos / Patrimônios — abas dos respectivos hubs
  { to: "/contratos/lista", label: "Contratos — Lista", icon: Files, permission: "contratos" },
  {
    to: "/quadro-contratos",
    label: "Contratos — Quadro",
    icon: FileSignature,
    permission: "contratos",
  },
  {
    to: "/patrimonios/lista",
    label: "Patrimônios — Lista",
    icon: Archive,
    permission: "patrimonios",
  },
  {
    to: "/quadro-patrimonios",
    label: "Patrimônios — Quadro",
    icon: Package,
    permission: "patrimonios",
  },
  {
    to: "/logistica-ativos/lista",
    label: "Logística — Lista",
    icon: List,
    permission: "patrimonios",
  },
  {
    to: "/quadro-logistica-ativos",
    label: "Logística — Quadro",
    icon: Truck,
    permission: "patrimonios",
  },
];

/** Lista achatada de todos os itens (sidebar + escondidos), útil para Command Palette. */
export const NAV_ITEMS: NavItem[] = [...NAV_REGISTRY.flatMap((g) => g.items), ...HIDDEN_NAV_ITEMS];

/**
 * Mapa segmento de URL -> rótulo legível, derivado do registro e
 * complementado com segmentos "pais" / dinâmicos usados em breadcrumbs.
 */
export const ROUTE_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = {
    financeiro: "Financeiro",
    rh: "Recursos Humanos",
    dp: "Departamento Pessoal",
    ponto: "Ponto",
    crm: "CRM",
    funil: "Funil de Vendas",
    oportunidades: "Oportunidades",
    vendas: "Vendas",
    suprimentos: "Suprimentos",
    planejamento: "Planejamento Lean",
    inspecoes: "Qualidade",
    obras: "Obras",
    quadros: "Kanban",
    meus: "Meus cards",
    gm: "GM",
    cutover: "Cutover",
    "feature-flags": "Feature Flags",
    auditoria: "Auditoria",
    saude: "Saúde",
    admin: "Admin",
    importar: "Importar",
    qr: "QR",
    go: "Abrir",
    ncs: "Não Conformidades",
    lista: "Lista",
    dashboard: "Dashboard",
    agenda: "Agenda",
    cadastros: "Cadastros",
    estoque: "Estoque",
    saldos: "Saldos",
    compras: "Compras",
    producao: "Produção",
    "ordens-compra": "Ordens de Compra",
    recebimento: "Recebimento",
    cotacoes: "Cotações",
    requisicoes: "Requisições",
    fornecedores: "Fornecedores",
    insumos: "Insumos",
    composicoes: "Composições",
    orcamento: "Orçamento",
    "curva-abc": "Curva ABC",
    alcadas: "Alçadas",
    grupos: "Grupos",
    "grupos-gestao": "Grupos (gestão)",
    fluxo: "Fluxo de Caixa",
    caixa: "Caixa",
    centros: "Centros de Custo",
    clientes: "Clientes",
    dividas: "Dívidas",
    naturezas: "Naturezas",
    faturamento: "Faturamento",
    aprovacao: "Aprovação",
    despesas: "Despesas",
    "formas-pagamento": "Formas de Pagamento",
    lancamentos: "Lançamentos",
    pacotes: "Pacotes",
    restricoes: "Restrições",
    lookahead: "Lookahead",
    ppc: "PPC",
    riscos: "Riscos",
    "licoes-aprendidas": "Lições Aprendidas",
    rdo: "RDO",
    "dashboard-lean": "Dashboard Lean",
    patrimonios: "Patrimônios",
    "quadro-patrimonios": "Quadro de Patrimônios",
    "logistica-ativos": "Logística",
    "quadro-logistica-ativos": "Quadro de Logística",
    veiculos: "Veículos",
    "mobilizacao-provisoria": "Mobilização Provisória",
    "controle-documentos": "Documentos",
    "historico-salarial": "Histórico Salarial",
    provisoes: "Provisões",
    "horas-extras": "Horas Extras",
    fopag: "Fopag",
    custos: "Custos",
    colaborador: "Colaborador",
    "custo-obra": "Custo por Obra",
    analise: "Análise",
    "homem-hora": "Homem-Hora",
    contratos: "Contratos",
    "quadro-contratos": "Quadro de Contratos",
    empresas: "Empresas",
    colaboradores: "Colaboradores",
    funcoes: "Funções",
    equipes: "Gestão de Equipe",
  };
  for (const item of NAV_ITEMS) {
    const segments = item.to.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && !labels[last]) labels[last] = item.label;
  }
  return labels;
})();

/**
 * Conjunto de rotas estáticas conhecidas (sem parâmetros dinâmicos), usado
 * pelo Breadcrumbs para decidir se cada nível intermediário deve ser clicável.
 */
export const KNOWN_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/histograma",
  "/suprimentos",
  "/quadros",
  "/quadros/meus",
  "/inspecoes",
  "/inspecoes/dashboard",
  "/inspecoes/agenda",
  "/inspecoes/qr",
  "/inspecoes/ncs",
  "/inspecoes/lista",
  "/rh/equipes",
  "/rh/colaboradores",
  "/rh/logistica",
  "/rh/funcoes",
  "/rh/controle-documentos",
  "/obras",
  "/planejamento",
  "/planejamento/dashboard",
  "/planejamento/pacotes",
  "/planejamento/restricoes",
  "/planejamento/lookahead",
  "/planejamento/ppc",
  "/planejamento/riscos",
  "/planejamento/licoes-aprendidas",
  "/planejamento/rdo",
  "/planejamento/dashboard-lean",
  "/gm",
  "/gm/saude",
  "/gm/auditoria",
  "/gm/security-events",
  "/gm/feature-flags",
  "/gm/cutover",
  "/financeiro/dashboard",
  "/financeiro/lancamentos",
  "/financeiro/fluxo",
  "/financeiro/fluxo/caixa",
  "/financeiro/centros",
  "/financeiro/clientes",
  "/financeiro/importar",
  "/financeiro/dividas",
  "/financeiro/naturezas",
  "/financeiro/faturamento",
  "/financeiro/antecipacao",
  "/financeiro/aprovacao",
  "/financeiro/despesas",
  "/financeiro/formas-pagamento",
  "/financeiro/cadastros",
  "/suprimentos/compras",
  "/suprimentos/producao",
  "/suprimentos/grupos-gestao",
  "/suprimentos/insumos",
  "/suprimentos/composicoes",
  "/suprimentos/orcamento",
  "/suprimentos/curva-abc",
  "/suprimentos/fornecedores",
  "/suprimentos/requisicoes",
  "/suprimentos/cotacoes",
  "/suprimentos/ordens-compra",
  "/suprimentos/alcadas",
  "/suprimentos/recebimento",
  "/suprimentos/estoque",
  "/suprimentos/estoque/saldos",
  "/patrimonios",
  "/patrimonios/lista",
  "/quadro-patrimonios",
  "/logistica-ativos",
  "/logistica-ativos/lista",
  "/quadro-logistica-ativos",
  "/veiculos",
  "/mobilizacao-provisoria",
  "/dp/historico-salarial",
  "/dp/provisoes",
  "/dp/fopag",
  "/dp/custos",
  "/dp/custos/colaborador",
  "/dp/custo-obra",
  "/dp/ponto",
  "/dp/ponto/importar",
  "/dp/ponto/analise",
  "/dp/homem-hora",
  "/contratos",
  "/contratos/lista",
  "/quadro-contratos",
  "/crm",
  "/crm/vendas",
  "/crm/funil",
  "/crm/oportunidades",
  "/crm/clientes",
  "/admin/empresas",
  "/admin/obras/importar",
]);
