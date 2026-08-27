// Dashboard Home do ERP (rota "/") — acessível a qualquer usuário
// autenticado, sem guard de permissão. Duas fontes:
//  1. Progresso das obras ativas segundo o cronograma (Planejamento);
//  2. Cartões do kanban em que o usuário logado é responsável ou membro.
// Sem dados financeiros: apenas percentuais, contagens e índices.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building,
  CalendarClock,
  CheckCircle2,
  LayoutGrid,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { Kpi } from "@/components/common/Kpi";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryState } from "@/components/common/QueryState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ObraProgressoCard } from "@/components/dashboard/ObraProgressoCard";
import { MeusCartoesSection } from "@/components/dashboard/MeusCartoesSection";
import { useDashboardObras, type SortType } from "@/hooks/obras/useDashboardObras";
import { useMeusCartoes } from "@/hooks/quadros/useMeusCartoes";
import { resumirMeusCartoes } from "@/lib/obras/dashboardObras";
import { useAuth } from "@/contexts/auth/useAuth";
import { useAcessoRestrito } from "@/hooks/campo/useAcessoRestrito";
import { Navigate } from "react-router-dom";

export default function DashboardObras() {
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const { restrito, carregando } = useAcessoRestrito();
  const [sort, setSort] = useState<SortType>("piores");
  const obrasProgresso = useDashboardObras({ sort });
  const cartoesQuery = useMeusCartoes();

  const cartoes = cartoesQuery.data ?? [];
  const resumoCartoes = useMemo(() => resumirMeusCartoes(cartoes, new Date()), [cartoes]);
  const obrasAtivas = obrasProgresso.obras.length;

  // Portal de Campo (system design §5.9): quem só tem vínculo em
  // `obra_membros` (nenhum PageKey/setor) nunca vê o dashboard completo —
  // vai direto pro shell reduzido.
  if (carregando) return null;
  if (restrito) return <Navigate to="/campo" replace />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {currentPlayer ? `Bem-vindo, ${currentPlayer.login}. ` : ""}
          Andamento das obras e seus cartões do kanban.
        </p>
      </div>

      {/* Faixa de KPIs clicáveis (estilo abas de resumo do layout de referência) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Obras ativas"
          value={obrasProgresso.isLoading ? "…" : obrasAtivas}
          tone="primary"
          icon={<Building className="h-4 w-4" />}
          onClick={() => navigate("/obras")}
        />
        <Kpi
          label="Meus cartões abertos"
          value={cartoesQuery.isLoading ? "…" : resumoCartoes.abertos}
          icon={<LayoutGrid className="h-4 w-4" />}
          onClick={() => navigate("/quadros/meus")}
        />
        <Kpi
          label="Vencidos"
          value={cartoesQuery.isLoading ? "…" : resumoCartoes.vencidos}
          tone="danger"
          highlight={resumoCartoes.vencidos > 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => navigate("/quadros/meus")}
        />
        <Kpi
          label="Vencem em 7 dias"
          value={cartoesQuery.isLoading ? "…" : resumoCartoes.venceHoje + resumoCartoes.vence7dias}
          tone="warning"
          hint={resumoCartoes.venceHoje > 0 ? `${resumoCartoes.venceHoje} hoje` : undefined}
          icon={<CalendarClock className="h-4 w-4" />}
          onClick={() => navigate("/quadros/meus")}
        />
        <Kpi
          label="Concluídos"
          value={cartoesQuery.isLoading ? "…" : resumoCartoes.concluidos}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          onClick={() => navigate("/quadros/meus")}
        />
      </div>

      {/* Progresso das obras segundo o cronograma */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Progresso das obras</h2>
          <div className="flex items-center gap-4">
            {obrasProgresso.totalObrasOcultas > 0 && (
              <span className="text-xs text-muted-foreground italic">
                {obrasProgresso.totalObrasOcultas}{" "}
                {obrasProgresso.totalObrasOcultas === 1 ? "obra oculta" : "obras ocultas"} (sem
                cronograma)
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ordenar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Critério de ordenação</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSort("piores")}>
                  Piores índices (SPI)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("melhores")}>
                  Melhores índices (SPI)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSort("codigo_asc")}>
                  Código Obra (Crescente)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("codigo_desc")}>
                  Código Obra (Decrescente)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("nome_asc")}>Nome (A-Z)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <QueryState
          isLoading={obrasProgresso.isLoading}
          isError={obrasProgresso.isError}
          error={obrasProgresso.error}
          data={obrasProgresso.obras}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="Nenhuma obra ativa." />}
          loading={
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          }
        >
          {(obras) => (
            <>
              {(obrasProgresso.diagnostico!.obrasSemFlowcastId > 0 ||
                obrasProgresso.diagnostico!.obrasSemItens > 0 ||
                obrasProgresso.diagnostico!.chavesOrfas.length > 0) && (
                <div className="rounded-md border border-warning/40 bg-warning/10 text-warning px-3 py-2 text-xs space-y-1 mb-3">
                  <div className="flex items-center gap-1 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" /> Diagnóstico do pareamento de
                    cronograma
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {obrasProgresso.diagnostico!.obrasSemFlowcastId > 0 && (
                      <li>
                        {obrasProgresso.diagnostico!.obrasSemFlowcastId} obra(s) sem vínculo — nem{" "}
                        <code className="font-mono">flowcastId</code> nem{" "}
                        <code className="font-mono">centro_custo_totvs</code> correspondente no
                        Supabase.
                      </li>
                    )}
                    {obrasProgresso.diagnostico!.obrasSemItens > 0 && (
                      <li>
                        {obrasProgresso.diagnostico!.obrasSemItens} obra(s) vinculadas, mas sem
                        itens de cronograma importados.
                      </li>
                    )}

                    {obrasProgresso.diagnostico!.chavesOrfas.length > 0 && (
                      <li>
                        {obrasProgresso.diagnostico!.chavesOrfas.length} obra_id(s) no cronograma
                        sem obra ativa correspondente:{" "}
                        <span className="font-mono">
                          {obrasProgresso.diagnostico!.chavesOrfas.slice(0, 3).join(", ")}
                          {obrasProgresso.diagnostico!.chavesOrfas.length > 3 ? "…" : ""}
                        </span>
                      </li>
                    )}
                    <li className="text-muted-foreground">
                      Total de itens de cronograma carregados:{" "}
                      {obrasProgresso.diagnostico!.totalItensCronograma}
                    </li>
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {obras.map((o) => (
                  <ObraProgressoCard
                    key={o.obra.id}
                    obra={o.obra}
                    resumo={o.resumo}
                    diagnostico={o.diagnostico}
                  />
                ))}
              </div>
            </>
          )}
        </QueryState>
      </section>

      {/* Meus cartões */}
      <section className="space-y-3">
        <QueryState
          isLoading={cartoesQuery.isLoading}
          isError={cartoesQuery.isError}
          error={cartoesQuery.error}
          data={cartoes}
          loading={<Skeleton className="h-48 rounded-lg" />}
        >
          {(data) => <MeusCartoesSection cartoes={data} />}
        </QueryState>
      </section>
    </div>
  );
}
