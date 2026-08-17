import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { GanttChart as GanttChartIcon, GitCompare as GitCompareIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OBRA_TAB_SECTIONS,
  OBRA_TABS_FINANCEIRAS,
  CRONOGRAMA_VIEW_VALUES,
  type CronogramaView,
} from "@/config/obra-tabs";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { SemAcessoModulo } from "@/components/common/SemAcessoModulo";
import { CronoExpansionProvider } from "@/lib/cronograma/crono-tree";
import { ObraSelecaoProvider } from "@/components/obra/ObraSelecaoContext";
import { ObraPermissionsProvider } from "@/components/obra/ObraPermissionsContext";
import { ItemDrawerSheet } from "@/components/obra/ItemDrawerSheet";
import { RevisoesTab } from "@/components/obra-detalhe/RevisoesTab";
import { PrevisaoTab } from "@/components/obra-detalhe/PrevisaoTab";
import { MedicoesTab } from "@/components/obra-detalhe/MedicoesTab";
import { NfsTab } from "@/components/obra-detalhe/NfsTab";
import { RecebTab } from "@/components/obra-detalhe/RecebTab";
import type { ResumoTabProps } from "@/components/obra/ResumoTab";

const AditivosTab = lazy(() =>
  import("@/components/obra/AditivosTab").then((m) => ({ default: m.AditivosTab })),
);
const HistoricoTab = lazy(() =>
  import("@/components/obra/HistoricoTab").then((m) => ({ default: m.HistoricoTab })),
);
const CompararRevisoesTab = lazy(() =>
  import("@/components/obra/CompararRevisoesTab").then((m) => ({ default: m.CompararRevisoesTab })),
);
const FinanceiroTab = lazy(() =>
  import("@/components/obra/FinanceiroTab").then((m) => ({ default: m.FinanceiroTab })),
);
const AnaliseTab = lazy(() =>
  import("@/components/obra/AnaliseTab").then((m) => ({ default: m.AnaliseTab })),
);
const LinhaBalancoTab = lazy(() =>
  import("@/components/obra/LinhaBalancoTab").then((m) => ({ default: m.LinhaBalancoTab })),
);
const DesempenhoTab = lazy(() =>
  import("@/components/obra/DesempenhoTab").then((m) => ({ default: m.DesempenhoTab })),
);
const RiscosTab = lazy(() =>
  import("@/components/obra/RiscosTab").then((m) => ({ default: m.RiscosTab })),
);
const OcorrenciasTab = lazy(() =>
  import("@/components/obra/OcorrenciasTab").then((m) => ({ default: m.OcorrenciasTab })),
);
const RdoTab = lazy(() => import("@/components/obra/RdoTab").then((m) => ({ default: m.RdoTab })));
const GanttTabWithMarcos = lazy(() =>
  import("@/components/obra/GanttTabWithMarcos").then((m) => ({ default: m.GanttTabWithMarcos })),
);
const ResumoTab = lazy(() =>
  import("@/components/obra/ResumoTab").then((m) => ({ default: m.ResumoTab })),
);
const CronogramaPrincipalTab = lazy(() =>
  import("@/components/obra/CronogramaPrincipalTab").then((m) => ({
    default: m.CronogramaPrincipalTab,
  })),
);
const CaminhoCriticoTab = lazy(() =>
  import("@/components/obra/CaminhoCriticoTab").then((m) => ({ default: m.CaminhoCriticoTab })),
);

export type BmsAberturaRequest = { bms: any; key: number } | null;

function ObraTopNav({
  sections,
  tab,
  setTab,
}: {
  sections: typeof OBRA_TAB_SECTIONS;
  tab: string;
  setTab: (v: string) => void;
}) {
  // Grupo ativo derivado da tab atual (deep-link compatível).
  const activeSection = useMemo(
    () => sections.find((s) => s.items.some((it) => it.value === tab)) ?? sections[0],
    [sections, tab],
  );

  // Lembra o último item visitado por grupo, para restaurar ao trocar de grupo.
  const lastByGroup = useRef<Record<string, string>>({});
  lastByGroup.current[activeSection.label] = tab;

  const handleGroupClick = (sec: (typeof sections)[number]) => {
    if (sec.label === activeSection.label) return;
    const remembered = lastByGroup.current[sec.label];
    const target =
      remembered && sec.items.some((it) => it.value === remembered)
        ? remembered
        : sec.items[0]?.value;
    if (target) setTab(target);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        className="hidden lg:block sticky top-0 z-20 -mx-1 px-1 bg-muted/30"
        aria-label="Seções da obra"
      >
        {/* Linha primária: grupos */}
        <div role="tablist" aria-label="Grupos" className="flex items-center gap-1 px-1 pt-1.5">
          {sections.map((sec) => {
            const active = sec.label === activeSection.label;
            return (
              <button
                key={sec.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleGroupClick(sec)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors border-b-2 -mb-px ${
                  active
                    ? "border-primary text-foreground font-medium bg-background/60"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* Linha secundária: itens do grupo ativo */}
        <div
          role="group"
          aria-label={`Itens de ${activeSection.label}`}
          className="flex items-center flex-wrap gap-0.5 px-2 py-1 border-t border-border/60"
        >
          {activeSection.items.map((it) => {
            const Icon = it.icon;
            const active = tab === it.value;
            const button = (
              <button
                type="button"
                data-tab-value={it.value}
                onClick={() => setTab(it.value)}
                aria-current={active ? "page" : undefined}
                aria-label={`${activeSection.label}: ${it.label}`}
                title={it.description}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm whitespace-nowrap rounded-md transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{it.label}</span>
              </button>
            );
            if (!it.description) return <span key={it.value}>{button}</span>;
            return (
              <Tooltip key={it.value}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                  {it.description}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}

export type ResumoTabFlatProps = Omit<
  ResumoTabProps,
  | "obra"
  | "obraId"
  | "bmsPrev"
  | "receb"
  | "nfs"
  | "onIrCronograma"
  | "onVerAnalise"
  | "onReguaSaved"
>;

export function ObraTabs({
  obra,
  id,
  tab,
  setTab,
  crono,
  medicoes,
  itensMedicao,
  nfs,
  receb,
  bmsPrev,
  redistrib,
  revisoes,
  qc,
  resumoProps,
  canEdit = false,
  canManage = false,
}: {
  obra: any;
  id: string;
  tab: string;
  setTab: (v: string) => void;
  crono: any[];
  medicoes: any[];
  itensMedicao: any[];
  nfs: any[];
  receb: any[];
  bmsPrev: any[];
  redistrib: any[];
  revisoes: any[];
  qc: ReturnType<typeof useQueryClient>;
  resumoProps: ResumoTabFlatProps;
  canEdit?: boolean;
  canManage?: boolean;
}) {
  const [bmsAbertura, setBmsAbertura] = useState<BmsAberturaRequest>(null);
  // Abas de medição/faturamento exigem o módulo Financeiro. Elas continuam
  // visíveis no rail: o usuário vê que a área existe e é avisado do que falta,
  // em vez de a aba sumir sem explicação.
  const { hasAccess } = usePermissions();
  const temFinanceiro = hasAccess("financeiro", "visualizar");
  /** Envolve o conteúdo de uma aba financeira, trocando-o pelo aviso. */
  const comFinanceiro = (valor: string, conteudo: React.ReactNode) =>
    temFinanceiro || !OBRA_TABS_FINANCEIRAS.has(valor) ? (
      conteudo
    ) : (
      <SemAcessoModulo modulo="Financeiro" contexto="os dados financeiros desta obra" />
    );

  function solicitarAbertura(bms: any) {
    setBmsAbertura({ bms, key: Date.now() });
    setTab("medicoes");
  }

  const RAIL_SECTIONS = OBRA_TAB_SECTIONS;
  const allItems = RAIL_SECTIONS.flatMap((s) => s.items);

  return (
    <ObraPermissionsProvider value={{ canEdit, canManage }}>
      <CronoExpansionProvider>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="lg:hidden mb-3">
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger aria-label="Selecionar seção da obra">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RAIL_SECTIONS.map((sec) => (
                  <SelectGroup key={sec.label}>
                    <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {sec.label}
                    </SelectLabel>
                    {sec.items.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-4">
            <ObraTopNav sections={RAIL_SECTIONS} tab={tab} setTab={setTab} />

            <div className="min-w-0">
              <TabsList className="sr-only">
                {allItems.map((it) => (
                  <TabsTrigger key={it.value} value={it.value}>
                    {it.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <Suspense
                fallback={
                  <div className="py-8">
                    <Skeleton className="h-96 rounded-lg" />
                  </div>
                }
              >
                <TabsContent value="resumo">
                  <ResumoTab
                    obra={obra}
                    obraId={id}
                    bmsPrev={bmsPrev}
                    receb={receb}
                    nfs={nfs}
                    onIrCronograma={() => setTab("cronograma")}
                    onVerAnalise={() => setTab("analise")}
                    onReguaSaved={() => qc.invalidateQueries({ queryKey: ["obra", id] })}
                    {...resumoProps}
                    semAcessoFinanceiro={!temFinanceiro}
                  />
                </TabsContent>

                <TabsContent value="previsao">
                  {comFinanceiro(
                    "previsao",
                    <>
                      <PrevisaoTab
                        obra={obra}
                        crono={crono}
                        receb={receb}
                        nfs={nfs}
                        bmsPrev={bmsPrev}
                        medicoes={medicoes}
                        itensMedicao={itensMedicao}
                        redistrib={redistrib}
                        revisoes={revisoes}
                        onAbrirBms={solicitarAbertura}
                        onChange={() => {
                          qc.invalidateQueries({ queryKey: ["receb", id] });
                          qc.invalidateQueries({ queryKey: ["bms_prev", id] });
                          qc.invalidateQueries({ queryKey: ["bms_redistribuicao", id] });
                        }}
                      />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="analise">
                  {comFinanceiro(
                    "analise",
                    <>
                      <AnaliseTab
                        obra={obra}
                        crono={crono}
                        medicoes={medicoes}
                        itensMedicao={itensMedicao}
                        nfs={nfs}
                      />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="linha-balanco">
                  <LinhaBalancoTab obraId={id!} />
                </TabsContent>
                <TabsContent value="desempenho">
                  {comFinanceiro(
                    "desempenho",
                    <>
                      <DesempenhoTab obra={obra} crono={crono} medicoes={medicoes} />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="cronograma">
                  <CronogramaTabs obra={obra} id={id} crono={crono} revisoes={revisoes} qc={qc} />
                </TabsContent>

                <TabsContent value="medicoes">
                  {comFinanceiro(
                    "medicoes",
                    <>
                      <MedicoesTab
                        obra={obra}
                        crono={crono}
                        medicoes={medicoes}
                        itensMedicao={itensMedicao}
                        revisoes={revisoes}
                        bmsAbertura={bmsAbertura}
                        onAberturaConsumida={() => setBmsAbertura(null)}
                        onChange={() => {
                          qc.invalidateQueries({ queryKey: ["medicoes", id] });
                          qc.invalidateQueries({ queryKey: ["itens_medicao", id] });
                          qc.invalidateQueries({ queryKey: ["crono", id] });
                          qc.invalidateQueries({ queryKey: ["receb", id] });
                          qc.invalidateQueries({ queryKey: ["bms_prev", id] });
                        }}
                      />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="nfs">
                  {comFinanceiro(
                    "nfs",
                    <>
                      <NfsTab
                        obra={obra}
                        nfs={nfs}
                        medicoes={medicoes}
                        bmsPrev={bmsPrev}
                        onChange={() => {
                          qc.invalidateQueries({ queryKey: ["nfs", id] });
                          qc.invalidateQueries({ queryKey: ["receb", id] });
                          qc.invalidateQueries({ queryKey: ["bms_prev", id] });
                        }}
                      />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="recebimentos">
                  {comFinanceiro(
                    "recebimentos",
                    <>
                      <RecebTab
                        receb={receb}
                        onChange={() => qc.invalidateQueries({ queryKey: ["receb", id] })}
                      />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="financeiro">
                  {comFinanceiro(
                    "financeiro",
                    <>
                      <FinanceiroTab obraId={id} />
                    </>,
                  )}
                </TabsContent>
                <TabsContent value="riscos">
                  <RiscosTab obraId={id} />
                </TabsContent>
                <TabsContent value="ocorrencias">
                  <OcorrenciasTab obraId={id} />
                </TabsContent>
                <TabsContent value="rdo">{id ? <RdoTab obraId={id} /> : null}</TabsContent>
                <TabsContent value="aditivos">
                  <AditivosTab obraId={id} />
                </TabsContent>
                <TabsContent value="historico">
                  <HistoricoTab obraId={id} />
                </TabsContent>
              </Suspense>
            </div>
          </div>
        </Tabs>
      </CronoExpansionProvider>
    </ObraPermissionsProvider>
  );
}

/**
 * Fase 2 — sub-navegação do Cronograma. Gantt e Comparar deixaram de ser
 * abas-irmãs no rail e viraram visões internas, controladas por `?cView=`.
 */
export function CronogramaTabs({
  obra,
  id,
  crono,
  revisoes,
  qc,
}: {
  obra: any;
  id: string;
  crono: any[];
  revisoes: any[];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("cView") ?? "principal";
  const view: CronogramaView = (CRONOGRAMA_VIEW_VALUES as readonly string[]).includes(rawView)
    ? (rawView as CronogramaView)
    : "principal";
  const setView = (v: CronogramaView) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("cView", v);
        return p;
      },
      { replace: true },
    );
  };

  return (
    <ObraSelecaoProvider>
      <Tabs value={view} onValueChange={(v) => setView(v as CronogramaView)} className="w-full">
        <TabsList className="mb-3 flex-wrap h-auto">
          <TabsTrigger value="principal">Principal</TabsTrigger>
          <TabsTrigger value="gantt">
            <GanttChartIcon className="h-3.5 w-3.5 mr-1.5" />
            Gantt
          </TabsTrigger>
          <TabsTrigger value="caminho">Caminho crítico</TabsTrigger>
          <TabsTrigger value="semanal">Semanal</TabsTrigger>
          <TabsTrigger value="comparar">
            <GitCompareIcon className="h-3.5 w-3.5 mr-1.5" />
            Comparar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="principal">
          <CronogramaPrincipalTab
            obra={obra}
            itens={crono}
            revisoes={revisoes}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["crono", id] });
              qc.invalidateQueries({ queryKey: ["receb", id] });
              qc.invalidateQueries({ queryKey: ["revisoes", id] });
            }}
          />
        </TabsContent>
        <TabsContent value="gantt">
          <GanttTabWithMarcos obraId={id} crono={crono as any} />
        </TabsContent>
        <TabsContent value="caminho">
          <CaminhoCriticoTab obraId={id} />
        </TabsContent>
        <TabsContent value="semanal">
          <RevisoesTab
            obra={obra}
            crono={crono}
            revisoes={revisoes}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["crono", id] });
              qc.invalidateQueries({ queryKey: ["revisoes", id] });
              qc.invalidateQueries({ queryKey: ["receb", id] });
            }}
          />
        </TabsContent>
        <TabsContent value="comparar">
          <CompararRevisoesTab obraId={id} />
        </TabsContent>
      </Tabs>
      <ItemDrawerSheet obraId={id} />
    </ObraSelecaoProvider>
  );
}
