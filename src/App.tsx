import { lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/lib/ui/confirm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
// Árvore de contextos completa e ordenada — ver src/contexts/AppProviders.tsx.
// Nenhum provider global deve ser montado aqui (nem por página): a lista lá é
// a fonte única, e é ela que o teste de completude cobre.
import { AppProviders } from "@/contexts/AppProviders";
import { useAuth } from "@/contexts/auth/useAuth";
import Layout from "@/components/Layout";
import RequireAccess from "@/components/auth/RequireAccess";
import Login from "@/pages/Login";
import OAuthConsent from "@/pages/OAuthConsent";

import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";
import ReauthDialog from "@/components/common/ReauthDialog";

// Code-splitting: páginas carregadas sob demanda. O fallback de Suspense
// fica no Layout (sidebar/header permanecem montados) — evita o flash branco.
const Board = lazy(() => import("@/pages/quadros/Board"));
const DashboardObras = lazy(() => import("@/pages/obras/DashboardObras"));
const CampoLayout = lazy(() => import("@/pages/campo/CampoLayout"));
const CampoHome = lazy(() => import("@/pages/campo/CampoHome"));
const CampoRdo = lazy(() => import("@/pages/campo/CampoRdo"));
const CampoCronograma = lazy(() => import("@/pages/campo/CampoCronograma"));
const CampoRequisicao = lazy(() => import("@/pages/campo/CampoRequisicao"));
const Histograma = lazy(() => import("@/pages/obras/Histograma"));
const Colaboradores = lazy(() => import("@/pages/rh/Colaboradores"));
const LogisticaColaboradores = lazy(() => import("@/pages/rh/LogisticaColaboradores"));
const GMHub = lazy(() => import("@/pages/gm/GMHub"));
const GMSaude = lazy(() => import("@/pages/gm/GMSaude"));
const GMAuditoria = lazy(() => import("@/pages/gm/GMAuditoria"));
const GMSecurityEvents = lazy(() => import("@/pages/gm/GMSecurityEvents"));
const GMFeatureFlags = lazy(() => import("@/pages/gm/GMFeatureFlags"));
const GMCutover = lazy(() => import("@/pages/gm/GMCutover"));
const GMCutoverIndex = lazy(() => import("@/pages/gm/GMCutoverIndex"));

const AprovacaoFinanceira = lazy(() => import("@/pages/financeiro/AprovacaoFinanceira"));
const ControleDespesas = lazy(() => import("@/pages/financeiro/ControleDespesas"));
const FormaPagamento = lazy(() => import("@/pages/financeiro/FormaPagamento"));
const Funcoes = lazy(() => import("@/pages/rh/Funcoes"));
const Patrimonios = lazy(() => import("@/pages/patrimonios/Patrimonios"));
const QuadroPatrimonios = lazy(() => import("@/pages/patrimonios/QuadroPatrimonios"));
const ControleDocumentos = lazy(() => import("@/pages/rh/ControleDocumentos"));
const Veiculos = lazy(() => import("@/pages/frotas/Veiculos"));
const MobilizacaoProvisoria = lazy(() => import("@/pages/obras/MobilizacaoProvisoria"));
const HistoricoSalarial = lazy(() => import("@/pages/dp/HistoricoSalarial"));
const Provisoes = lazy(() => import("@/pages/dp/Provisoes"));
const HorasExtras = lazy(() => import("@/pages/dp/HorasExtras"));
const Custos = lazy(() => import("@/pages/dp/Custos"));
const CustoColaboradorObra = lazy(() => import("@/pages/dp/CustoColaboradorObra"));
const PontoHub = lazy(() => import("@/pages/dp/PontoHub"));
const HomemHora = lazy(() => import("@/pages/dp/HomemHora"));
const Contratos = lazy(() => import("@/pages/contratos/Contratos"));
const QuadroContratos = lazy(() => import("@/pages/contratos/QuadroContratos"));
const Obras = lazy(() => import("@/pages/obras/Obras"));
const FinDashboard = lazy(() => import("@/pages/financeiro/FinDashboard"));
const FinObraDetalhe = lazy(() => import("@/pages/financeiro/FinObraDetalhe"));
const FinLancamentos = lazy(() => import("@/pages/financeiro/FinLancamentos"));
const FinFluxo = lazy(() => import("@/pages/financeiro/FinFluxo"));
const FinCentros = lazy(() => import("@/pages/financeiro/FinCentros"));
const FinClientes = lazy(() => import("@/pages/financeiro/FinClientes"));
const FinImportar = lazy(() => import("@/pages/financeiro/FinImportar"));
const FinDividas = lazy(() => import("@/pages/financeiro/FinDividas"));
const PrevisaoPagamento = lazy(() => import("@/pages/financeiro/PrevisaoPagamento"));
const Cnab = lazy(() => import("@/pages/financeiro/Cnab"));
const FinNaturezas = lazy(() => import("@/pages/financeiro/FinNaturezas"));
const FinFaturamento = lazy(() => import("@/pages/financeiro/FinFaturamento"));
const FinAntecipacao = lazy(() => import("@/pages/financeiro/FinAntecipacao"));
const AntecipacaoImport = lazy(() => import("@/pages/financeiro/AntecipacaoImport"));
const SuprimentosHub = lazy(() => import("@/pages/suprimentos/SuprimentosHub"));
const PlanejamentoDashboard = lazy(() => import("@/pages/planejamento/PlanejamentoDashboard"));
const PacotesTrabalho = lazy(() => import("@/pages/planejamento/PacotesTrabalho"));
const PlanejamentoRestricoes = lazy(() => import("@/pages/planejamento/Restricoes"));
const PlanejamentoLookahead = lazy(() => import("@/pages/planejamento/Lookahead"));
const PlanejamentoPPC = lazy(() => import("@/pages/planejamento/PPC"));
const PlanejamentoRiscos = lazy(() => import("@/pages/planejamento/Riscos"));
const PlanejamentoLicoes = lazy(() => import("@/pages/planejamento/LicoesAprendidas"));
const PlanejamentoRdo = lazy(() => import("@/pages/planejamento/RdoConsolidado"));
const PlanejamentoDashLean = lazy(() => import("@/pages/planejamento/DashboardLean"));
const Quadros = lazy(() => import("@/pages/quadros/Quadros"));
const QuadroBoard = lazy(() => import("@/pages/quadros/QuadroBoard"));
const QuadroMeus = lazy(() => import("@/pages/quadros/QuadroMeus"));
const Inspecoes = lazy(() => import("@/pages/qualidade/Inspecoes"));
const InspecaoCaptura = lazy(() => import("@/pages/qualidade/InspecaoCaptura"));
const InspecoesDashboard = lazy(() => import("@/pages/qualidade/InspecoesDashboard"));
const InspecoesAgenda = lazy(() => import("@/pages/qualidade/InspecoesAgenda"));
const InspecoesQR = lazy(() => import("@/pages/qualidade/InspecoesQR"));
const InspecoesQRGo = lazy(() => import("@/pages/qualidade/InspecoesQRGo"));
const NaoConformidades = lazy(() => import("@/pages/qualidade/NaoConformidades"));
const Clientes = lazy(() => import("@/pages/crm/Clientes"));
const OportunidadePerfil = lazy(() => import("@/pages/crm/OportunidadePerfil"));
const CRMDashboard = lazy(() => import("@/pages/crm/CRMDashboard"));
const VendasHub = lazy(() => import("@/pages/crm/VendasHub"));
const RhHome = lazy(() => import("@/pages/rh/index"));

// Hubs (Fase 4: consolidação do menu lateral em abas)
const QualidadeHub = lazy(() => import("@/pages/qualidade/QualidadeHub"));
const PlanejamentoHub = lazy(() => import("@/pages/planejamento/PlanejamentoHub"));
const CustosHub = lazy(() => import("@/pages/dp/CustosHub"));
const FluxoHub = lazy(() => import("@/pages/financeiro/FluxoHub"));
const FinCadastrosHub = lazy(() => import("@/pages/financeiro/CadastrosHub"));
const ContratosHub = lazy(() => import("@/pages/contratos/ContratosHub"));
const PatrimoniosHub = lazy(() => import("@/pages/patrimonios/PatrimoniosHub"));
const LogisticaAtivosHub = lazy(() => import("@/pages/logisticaAtivos/LogisticaAtivosHub"));
const Romaneios = lazy(() => import("@/pages/logisticaAtivos/Romaneios"));
const QuadroRomaneios = lazy(() => import("@/pages/logisticaAtivos/QuadroRomaneios"));
const AdminEmpresas = lazy(() => import("@/pages/admin/Empresas"));
const AdminImportarObras = lazy(() => import("@/pages/admin/ImportarObras"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000, // 1 min: evita refetch automático a cada navegação
      gcTime: 5 * 60_000, // 5 min: mantém cache em memória entre páginas
      refetchOnWindowFocus: false,
    },
  },
});

const FinObraDetalheRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/obras/${id}`} replace />;
};

const ProtectedRoutes = () => {
  const { currentPlayer } = useAuth();
  if (!currentPlayer) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Home do ERP: acessível a qualquer usuário autenticado (sem guard).
            Mostra apenas progresso das obras e os cartões do próprio usuário. */}
        <Route path="/" element={<DashboardObras />} />
        {/* PRO-031 · Fase 3 — guards por módulo (RequireAccess). Redirects puros
            ficam fora dos guards: o destino é quem decide o acesso. */}
        <Route element={<RequireAccess page="obras_div" />}>
          <Route path="/quadros" element={<Quadros />} />
          <Route path="/quadros/meus" element={<QuadroMeus />} />
          <Route path="/quadros/:boardId" element={<QuadroBoard />} />
          {/* Qualidade — hub com abas (Inspeções, Dashboard, Agenda, QR, NCs). Deep links das abas mantidos abaixo. */}
          <Route path="/inspecoes" element={<QualidadeHub />} />
          <Route path="/inspecoes/dashboard" element={<InspecoesDashboard />} />
          <Route path="/inspecoes/agenda" element={<InspecoesAgenda />} />
          <Route path="/inspecoes/qr" element={<InspecoesQR />} />
          <Route path="/inspecoes/qr/go/:alvoId" element={<InspecoesQRGo />} />
          <Route path="/inspecoes/ncs" element={<NaoConformidades />} />
          {/* Rota legada (lista direta sem o hub) */}
          <Route path="/inspecoes/lista" element={<Inspecoes />} />
          <Route path="/inspecoes/:modeloId" element={<InspecaoCaptura />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/histograma" element={<Histograma />} />
          <Route path="/obras/:id" element={<FinObraDetalhe />} />
          {/* Planejamento Lean — hub com abas. Deep links das abas continuam abaixo. */}
          <Route path="/planejamento" element={<PlanejamentoHub />} />
          <Route path="/planejamento/dashboard" element={<PlanejamentoDashboard />} />
          <Route path="/planejamento/pacotes" element={<PacotesTrabalho />} />
          <Route path="/planejamento/restricoes" element={<PlanejamentoRestricoes />} />
          <Route path="/planejamento/lookahead" element={<PlanejamentoLookahead />} />
          <Route path="/planejamento/ppc" element={<PlanejamentoPPC />} />
          <Route path="/planejamento/riscos" element={<PlanejamentoRiscos />} />
          <Route path="/planejamento/licoes-aprendidas" element={<PlanejamentoLicoes />} />
          <Route path="/planejamento/rdo" element={<PlanejamentoRdo />} />
          <Route path="/planejamento/dashboard-lean" element={<PlanejamentoDashLean />} />
          <Route path="/mobilizacao-provisoria" element={<MobilizacaoProvisoria />} />
        </Route>
        {/* Legado: /quadro redireciona para /quadros (unificado). */}
        <Route path="/quadro" element={<Navigate to="/quadros" replace />} />

        {/* Recursos Humanos — módulo sob /rh. Rotas antigas redirecionam. */}
        <Route element={<RequireAccess page="rh" />}>
          {/* Board de alocação (ex-rota "/"): guard rh, alinhado ao item de nav. */}
          <Route path="/rh" element={<RhHome />} />
          <Route path="/rh/equipes" element={<Board />} />
          <Route path="/rh/colaboradores" element={<Colaboradores />} />
          <Route path="/rh/logistica" element={<LogisticaColaboradores />} />
          <Route path="/rh/funcoes" element={<Funcoes />} />
          <Route path="/rh/controle-documentos" element={<ControleDocumentos />} />
        </Route>
        <Route path="/colaboradores" element={<Navigate to="/rh/colaboradores" replace />} />
        <Route path="/funcoes" element={<Navigate to="/rh/funcoes" replace />} />
        <Route
          path="/controle-documentos"
          element={<Navigate to="/rh/controle-documentos" replace />}
        />

        {/* GM — hub com abas (Usuários/Permissões). Deep link da aba abaixo. */}
        <Route element={<RequireAccess gm />}>
          <Route path="/gm" element={<GMHub />} />
          <Route path="/gm/saude" element={<GMSaude />} />
          <Route path="/gm/auditoria" element={<GMAuditoria />} />
          <Route path="/gm/security-events" element={<GMSecurityEvents />} />
          <Route path="/gm/feature-flags" element={<GMFeatureFlags />} />
          <Route path="/gm/cutover" element={<GMCutoverIndex />} />
          <Route path="/gm/cutover/:obraId" element={<GMCutover />} />
        </Route>
        <Route path="/gm/permissoes" element={<Navigate to="/gm?tab=permissoes" replace />} />

        <Route element={<RequireAccess page="financeiro" />}>
          <Route path="/financeiro/dashboard" element={<FinDashboard />} />
          <Route path="/financeiro/lancamentos" element={<FinLancamentos />} />
          {/* Fluxo & Dívidas — hub com abas */}
          <Route path="/financeiro/fluxo" element={<FluxoHub />} />
          <Route path="/financeiro/fluxo/caixa" element={<FinFluxo />} />
          <Route path="/financeiro/centros" element={<FinCentros />} />
          <Route path="/financeiro/clientes" element={<FinClientes />} />
          {/* Compat: importação TOTVS agora é um botão dentro de Lançamentos, mas a rota antiga continua acessível */}
          <Route path="/financeiro/importar" element={<FinImportar />} />
          <Route path="/financeiro/dividas" element={<FinDividas />} />
          <Route path="/financeiro/previsao-pagamento" element={<PrevisaoPagamento />} />
          <Route path="/financeiro/cnab" element={<Cnab />} />
          <Route path="/financeiro/naturezas" element={<FinNaturezas />} />
          <Route path="/financeiro/faturamento" element={<FinFaturamento />} />
          <Route path="/financeiro/antecipacao" element={<FinAntecipacao />} />
          <Route path="/financeiro/antecipacao/importar" element={<AntecipacaoImport />} />
          <Route path="/financeiro/aprovacao" element={<AprovacaoFinanceira />} />
          <Route path="/financeiro/despesas" element={<ControleDespesas />} />
          <Route path="/financeiro/formas-pagamento" element={<FormaPagamento />} />
          {/* Cadastros Financeiros — hub com abas */}
          <Route path="/financeiro/cadastros" element={<FinCadastrosHub />} />
        </Route>
        {/* Compat: rotas antigas redirecionam para /obras */}
        <Route path="/financeiro/obras" element={<Navigate to="/obras" replace />} />
        <Route path="/financeiro/obras/:id" element={<FinObraDetalheRedirect />} />

        <Route element={<RequireAccess page="almoxarifado" />}>
          <Route path="/suprimentos" element={<SuprimentosHub />} />
        </Route>
        <Route
          path="/suprimentos/compras"
          element={<Navigate to="/suprimentos?tab=compras" replace />}
        />
        <Route
          path="/suprimentos/producao"
          element={<Navigate to="/suprimentos?tab=producao" replace />}
        />
        {/* Rotas legadas: redirecionam para a aba consolidada do Quadro de Compras. */}
        <Route
          path="/suprimentos/grupos"
          element={<Navigate to="/suprimentos?tab=compras&view=consolidado" replace />}
        />
        <Route
          path="/suprimentos/alertas"
          element={<Navigate to="/suprimentos?tab=compras&view=consolidado" replace />}
        />
        {/* Compat: rotas antigas entram pela porta única do hub de Suprimentos. */}
        <Route
          path="/suprimentos/grupos-gestao"
          element={<Navigate to="/suprimentos?tab=grupos" replace />}
        />
        <Route
          path="/suprimentos/insumos"
          element={<Navigate to="/suprimentos?tab=insumos" replace />}
        />
        <Route
          path="/suprimentos/composicoes"
          element={<Navigate to="/suprimentos?tab=composicoes" replace />}
        />
        <Route
          path="/suprimentos/orcamento"
          element={<Navigate to="/suprimentos?tab=orcamento" replace />}
        />
        <Route
          path="/suprimentos/curva-abc"
          element={<Navigate to="/suprimentos?tab=curva-abc" replace />}
        />
        <Route
          path="/suprimentos/fornecedores"
          element={<Navigate to="/suprimentos?tab=fornecedores" replace />}
        />
        <Route
          path="/suprimentos/requisicoes"
          element={<Navigate to="/suprimentos?tab=requisicoes" replace />}
        />
        <Route
          path="/suprimentos/cotacoes"
          element={<Navigate to="/suprimentos?tab=cotacoes" replace />}
        />
        <Route
          path="/suprimentos/ordens-compra"
          element={<Navigate to="/suprimentos?tab=ordens" replace />}
        />
        <Route
          path="/suprimentos/alcadas"
          element={<Navigate to="/suprimentos?tab=alcadas" replace />}
        />
        <Route
          path="/suprimentos/recebimento"
          element={<Navigate to="/suprimentos?tab=recebimento" replace />}
        />
        <Route
          path="/suprimentos/estoque"
          element={<Navigate to="/suprimentos?tab=estoque" replace />}
        />
        <Route
          path="/suprimentos/estoque/saldos"
          element={<Navigate to="/suprimentos?tab=estoque" replace />}
        />

        {/* CRM — root é o Dashboard */}
        <Route element={<RequireAccess page="crm" />}>
          <Route path="/crm" element={<CRMDashboard />} />
          <Route path="/crm/vendas" element={<VendasHub />} />
          <Route path="/crm/oportunidades/:id" element={<OportunidadePerfil />} />
          <Route path="/crm/clientes" element={<Clientes />} />
        </Route>
        <Route path="/crm/dashboard" element={<Navigate to="/crm" replace />} />
        <Route path="/crm/funil" element={<Navigate to="/crm/vendas" replace />} />
        <Route
          path="/crm/oportunidades"
          element={<Navigate to="/crm/vendas?tab=lista" replace />}
        />

        {/* Patrimônios — hub com abas (Quadro/Lista) */}
        <Route element={<RequireAccess page="patrimonios" />}>
          <Route path="/patrimonios" element={<PatrimoniosHub />} />
          <Route path="/patrimonios/lista" element={<Patrimonios />} />
          <Route path="/quadro-patrimonios" element={<QuadroPatrimonios />} />
          <Route path="/logistica-ativos" element={<LogisticaAtivosHub />} />
          <Route path="/logistica-ativos/lista" element={<Romaneios />} />
          <Route path="/quadro-logistica-ativos" element={<QuadroRomaneios />} />
        </Route>
        <Route element={<RequireAccess page="frotas" />}>
          <Route path="/veiculos" element={<Veiculos />} />
        </Route>

        <Route element={<RequireAccess page="dp" />}>
          <Route path="/dp/historico-salarial" element={<HistoricoSalarial />} />
          <Route path="/dp/provisoes" element={<Provisoes />} />
          {/* Compat: Horas Extras virou aba dentro de Análise de Ponto, mas mantemos a rota */}
          <Route path="/dp/horas-extras" element={<HorasExtras />} />
          {/* Folha de Pagamento foi fundida na aba Custo do Colaborador (a rota
              antiga é link salvo/decorado, então continua resolvendo). */}
          <Route path="/dp/fopag" element={<Navigate to="/dp/custos?tab=colaborador" replace />} />
          {/* Custos de Pessoal — hub com abas */}
          <Route path="/dp/custos" element={<CustosHub />} />
          <Route path="/dp/custos/colaborador" element={<Custos />} />
          <Route path="/dp/custo-obra" element={<CustoColaboradorObra />} />
          {/* Ponto — hub com abas; o recorte e a aba ativa vivem na query string */}
          <Route path="/dp/ponto" element={<PontoHub />} />
          {/* Compat: rotas antigas viraram abas do hub (Importar é uma gaveta do cabeçalho) */}
          <Route path="/dp/ponto/analise" element={<Navigate to="/dp/ponto" replace />} />
          <Route path="/dp/ponto/importar" element={<Navigate to="/dp/ponto" replace />} />
          <Route path="/dp/homem-hora" element={<HomemHora />} />
        </Route>

        {/* Contratos — hub com abas (Quadro/Lista) */}
        <Route element={<RequireAccess page="contratos" />}>
          <Route path="/contratos" element={<ContratosHub />} />
          <Route path="/contratos/lista" element={<Contratos />} />
          <Route path="/quadro-contratos" element={<QuadroContratos />} />
        </Route>

        {/* Ferramentas administrativas sem link na navegação (só por URL):
            cadastro de empresas e importador de obras. Ficam sob guard `gm`,
            como o resto de /gm. Antes usavam `page="admin"`, cuja PageKey deriva
            das linhas /gm da matriz — então um não-GM com "V" em /gm entrava
            aqui sem conseguir abrir o próprio /gm (que já era `RequireAccess gm`). */}
        <Route element={<RequireAccess gm />}>
          <Route path="/admin/empresas" element={<AdminEmpresas />} />
          <Route path="/admin/obras/importar" element={<AdminImportarObras />} />
        </Route>
      </Route>
      {/* Portal de Campo (system design §5.9) — shell reduzido fora do
          `Layout` completo, pra quem só tem vínculo em `obra_membros`
          (nenhum PageKey/setor). Redirect de entrada vive em DashboardObras. */}
      <Route path="/campo" element={<CampoLayout />}>
        <Route index element={<CampoHome />} />
        <Route path="rdo" element={<CampoRdo />} />
        <Route path="cronograma" element={<CampoCronograma />} />
        <Route path="requisicao" element={<CampoRequisicao />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppRoutes = () => {
  const { currentPlayer } = useAuth();
  return (
    <Routes>
      <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
      <Route
        path="/login"
        element={
          currentPlayer && !new URLSearchParams(window.location.search).get("next") ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProviders>
      <Sonner />
      <ConfirmDialogHost />
      <ReauthDialog />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </QueryClientProvider>
);

export default App;
