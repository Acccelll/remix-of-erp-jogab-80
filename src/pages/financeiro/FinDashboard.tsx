import { Link, useNavigate, useSearchParams, useParams, Outlet } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";
import { obrasRepo } from "@/lib/repositories/obras";
import { notasFiscaisRepo, recebimentosRepo, medicoesRepo } from "@/lib/repositories/medicoes";
import { bmsPrevistasRepo } from "@/lib/repositories/obraDetalhe";
import { cronogramaFns as cronogramaRepo } from "@/hooks/obras/useCronograma";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { brl } from "@/lib/billing";
import { Wallet, HardHat, TrendingUp, AlertCircle, AlertTriangle } from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusObraBadge, isAtrasada } from "@/components/obra/StatusObraBadge";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { EvmPortfolioCard } from "@/components/dashboard/EvmPortfolioCard";
import { ResultadoAcumuladoPortfolioCard } from "@/components/dashboard/ResultadoAcumuladoPortfolioCard";
import { SnapshotAgeAlert } from "@/components/financeiro/SnapshotAgeAlert";
import type { FinLinha } from "@/lib/financeiro-totvs/agregacoes";

const BMS_FECHADA = new Set(["fechada", "faturada", "paga", "cancelada"]);
const bmsAberta = (b: any) => !BMS_FECHADA.has(String(b.status));

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const wrap = <T,>(p: Promise<T>) =>
        p.then((data) => ({ data, error: null as any })).catch((error) => ({ data: [] as any, error }));
      const [obras, recebimentos, nfs, medicoes, bms, crono, fin] = await Promise.all([
        wrap(obrasRepo.listDashboard()),
        wrap(recebimentosRepo.listDashboard()),
        wrap(notasFiscaisRepo.listDashboard()),
        wrap(medicoesRepo.listDashboard()),
        wrap(bmsPrevistasRepo.listDashboard()),
        wrap(cronogramaRepo.listDashboard()),
        wrap(financeiroRepo.vwDashboard()),
      ]);
      return {
        obras: obras.data ?? [],
        recebimentos: recebimentos.data ?? [],
        nfs: nfs.data ?? [],
        medicoes: medicoes.data ?? [],
        bms: bms.data ?? [],
        crono: crono.data ?? [],
        fin: (fin.data ?? []) as unknown as FinLinha[],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  const obras = data?.obras ?? [];
  const recebimentos = data?.recebimentos ?? [];
  const nfs = data?.nfs ?? [];
  const bms = data?.bms ?? [];
  const hoje = new Date();
  const hojeStr = format(hoje, "yyyy-MM-dd");
  const fim30 = addDays(hoje, 30);
  const fim60 = addDays(hoje, 60);
  const fim90 = addDays(hoje, 90);

  // Obras que já têm BMS previstas geradas (fonte nova)
  const obrasComBms = new Set(bms.map((b: any) => b.obra_id));

  const totalCarteira = obras.reduce((a, o) => a + Number(o.valor_contrato || 0), 0);

  // Previsto futuro (BMS abertas + fallback legado para obras sem BMS)
  const bmsFuturas = bms.filter(
    (b: any) => bmsAberta(b) && b.data_pagamento_prevista && b.data_pagamento_prevista >= hojeStr,
  );
  const recebLegadoFuturo = recebimentos.filter(
    (r) => !obrasComBms.has(r.obra_id) && !r.data_recebimento && r.data_prevista >= hojeStr,
  );
  const aReceber =
    bmsFuturas.reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0) +
    recebLegadoFuturo.reduce((a, r) => a + Number(r.valor_previsto || 0), 0);

  const range = (ate: Date) => {
    const ateStr = format(ate, "yyyy-MM-dd");
    const fromBms = bmsFuturas
      .filter((b: any) => b.data_pagamento_prevista <= ateStr)
      .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0);
    const fromLegado = recebLegadoFuturo
      .filter((r) => r.data_prevista <= ateStr)
      .reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
    return fromBms + fromLegado;
  };

  const faturadoMes = nfs
    .filter(
      (n) =>
        n.data_emissao &&
        new Date(n.data_emissao) >= startOfMonth(hoje) &&
        new Date(n.data_emissao) <= endOfMonth(hoje),
    )
    .reduce((a, n) => a + Number(n.valor || 0), 0);

  // Atrasado total (item 5.2 da auditoria) — soma BMS abertas vencidas + recebimentos
  // (congelados ou legado) não recebidos vencidos. Mesma lógica do AlertasCard.
  const atrasadoTotal =
    bms
      .filter(
        (b: any) =>
          bmsAberta(b) && b.data_pagamento_prevista && b.data_pagamento_prevista < hojeStr,
      )
      .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0) +
    recebimentos
      .filter(
        (r) =>
          !r.data_recebimento &&
          r.data_prevista < hojeStr &&
          (r.congelado || !obrasComBms.has(r.obra_id)),
      )
      .reduce((a, r) => a + Number(r.valor_previsto || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SnapshotAgeAlert />
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral de carteira e recebimentos.</p>
      </header>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <KpiFeatured
          icon={Wallet}
          label="A receber"
          value={brl(aReceber)}
          atrasado={atrasadoTotal}
        />
        <Kpi
          icon={HardHat}
          label="Carteira total"
          value={brl(totalCarteira)}
          hint={`${obras.length} obras`}
        />
        <Kpi
          icon={TrendingUp}
          label={`Faturado em ${format(hoje, "MMMM", { locale: ptBR })}`}
          value={brl(faturadoMes)}
        />
        <Kpi
          icon={AlertCircle}
          label="Próximos 30d"
          value={brl(range(fim30))}
          hint={`60d: ${brl(range(fim60))} · 90d: ${brl(range(fim90))}`}
        />
      </div>

      <PortfolioOverview obras={obras} recebimentos={recebimentos} nfs={nfs} bms={bms} />
      <EvmPortfolioCard
        obras={obras}
        crono={data?.crono ?? []}
        finLinhas={data?.fin ?? []}
        medicoes={data?.medicoes ?? []}
      />
      <ResultadoAcumuladoPortfolioCard />
      <ObrasAtrasadasCard obras={obras} />
      <MedicoesSemNfCard medicoes={data?.medicoes ?? []} nfs={nfs} obras={obras} />
      <AlertasCard recebimentos={recebimentos} obras={obras} bms={bms} />

      <Card>
        <CardHeader>
          <CardTitle>Obras</CardTitle>
        </CardHeader>
        <CardContent>
          {obras.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma obra cadastrada.{" "}
              <Link to="/financeiro/obras" className="text-primary underline">
                Cadastrar a primeira
              </Link>
              .
            </div>
          ) : (
            <div className="divide-y">
              {obras.map((o) => {
                const fat = nfs
                  .filter((n) => n.obra_id === o.id)
                  .reduce((a, n) => a + Number(n.valor || 0), 0);
                const pct = o.valor_contrato ? (fat / Number(o.valor_contrato)) * 100 : 0;
                return (
                  <Link
                    key={o.id}
                    to={`/financeiro/obras/${o.id}`}
                    className="flex items-center justify-between py-3 hover:bg-accent/50 px-2 rounded-md"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{o.nome}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Cód. {o.codigo}</span>
                        <StatusObraBadge obra={o} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        {brl(fat)} / {brl(o.valor_contrato)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pct.toFixed(1)}% faturado
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div
          className="text-xl font-semibold mt-2 tabular-nums overflow-hidden text-ellipsis whitespace-nowrap"
          title={value}
        >
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function KpiFeatured({
  icon: Icon,
  label,
  value,
  atrasado,
}: {
  icon: any;
  label: string;
  value: string;
  atrasado: number;
}) {
  return (
    <Card className="border-primary/50 bg-primary/5 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-primary font-medium">{label}</div>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div
          className="text-2xl md:text-3xl font-semibold mt-2 tabular-nums overflow-hidden text-ellipsis whitespace-nowrap"
          title={value}
        >
          {value}
        </div>
        {atrasado > 0 ? (
          <div className="text-xs mt-1 text-[color:var(--warning-foreground)] dark:text-[color:var(--warning)] font-medium">
            Atrasado: <span className="tabular-nums">{brl(atrasado)}</span>
          </div>
        ) : (
          <div className="text-xs mt-1 text-muted-foreground">Sem atrasos</div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertasCard({
  recebimentos,
  obras,
  bms,
}: {
  recebimentos: any[];
  obras: any[];
  bms: any[];
}) {
  const hoje = new Date();
  const hojeStr = format(hoje, "yyyy-MM-dd");
  const em7 = addDays(hoje, 7);
  const em7Str = format(em7, "yyyy-MM-dd");
  const obraMap = new Map(obras.map((o) => [o.id, o]));
  const obrasComBms = new Set(bms.map((b: any) => b.obra_id));

  // Atrasados: BMS abertas vencidas + recebimentos congelados (NF) vencidos
  const bmsAtrasadas = bms
    .filter(
      (b: any) => bmsAberta(b) && b.data_pagamento_prevista && b.data_pagamento_prevista < hojeStr,
    )
    .map((b: any) => ({
      key: `bms-${b.id}`,
      obra_id: b.obra_id,
      data: b.data_pagamento_prevista,
      valor: Number(b.valor_previsto_dinamico || 0),
      label: `BMS #${b.numero}`,
    }));
  const recebCongeladosAtrasados = recebimentos
    .filter((r) => r.congelado && !r.data_recebimento && r.data_prevista < hojeStr)
    .map((r) => ({
      key: `r-${r.id}`,
      obra_id: r.obra_id,
      data: r.data_prevista,
      valor: Number(r.valor_previsto || 0),
      label: "NF emitida",
    }));
  const recebLegadoAtrasados = recebimentos
    .filter(
      (r) =>
        !r.congelado &&
        !obrasComBms.has(r.obra_id) &&
        !r.data_recebimento &&
        r.data_prevista < hojeStr,
    )
    .map((r) => ({
      key: `r-${r.id}`,
      obra_id: r.obra_id,
      data: r.data_prevista,
      valor: Number(r.valor_previsto || 0),
      label: "Previsto",
    }));
  const atrasados = [...bmsAtrasadas, ...recebCongeladosAtrasados, ...recebLegadoAtrasados].sort(
    (a, b) => a.data.localeCompare(b.data),
  );

  // Próximos 7 dias
  const bmsProximas = bms
    .filter(
      (b: any) =>
        bmsAberta(b) &&
        b.data_pagamento_prevista &&
        b.data_pagamento_prevista >= hojeStr &&
        b.data_pagamento_prevista <= em7Str,
    )
    .map((b: any) => ({
      key: `bms-${b.id}`,
      obra_id: b.obra_id,
      data: b.data_pagamento_prevista,
      valor: Number(b.valor_previsto_dinamico || 0),
      label: `BMS #${b.numero}`,
    }));
  const recebProximos = recebimentos
    .filter((r) => !r.data_recebimento && r.data_prevista >= hojeStr && r.data_prevista <= em7Str)
    .filter((r) => r.congelado || !obrasComBms.has(r.obra_id))
    .map((r) => ({
      key: `r-${r.id}`,
      obra_id: r.obra_id,
      data: r.data_prevista,
      valor: Number(r.valor_previsto || 0),
      label: r.congelado ? "NF emitida" : "Previsto",
    }));
  const proximos = [...bmsProximas, ...recebProximos].sort((a, b) => a.data.localeCompare(b.data));

  if (atrasados.length === 0 && proximos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-warning" /> Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {atrasados.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-destructive mb-2">
              Atrasados ({atrasados.length})
            </div>
            <ul className="space-y-1 text-sm">
              {atrasados.slice(0, 5).map((r) => {
                const o = obraMap.get(r.obra_id);
                return (
                  <li
                    key={r.key}
                    className="flex items-center justify-between border-l-2 border-destructive pl-3 py-1"
                  >
                    <Link
                      to={`/financeiro/obras/${r.obra_id}?tab=previsao`}
                      className="hover:underline"
                    >
                      {o?.codigo ?? "—"} · {o?.nome ?? "?"}{" "}
                      <span className="text-xs text-muted-foreground ml-1">({r.label})</span>
                    </Link>
                    <span className="text-destructive">
                      {format(new Date(r.data), "dd/MM/yyyy")} · {brl(r.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {proximos.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-warning mb-2">
              Próximos 7 dias ({proximos.length})
            </div>
            <ul className="space-y-1 text-sm">
              {proximos.slice(0, 5).map((r) => {
                const o = obraMap.get(r.obra_id);
                return (
                  <li
                    key={r.key}
                    className="flex items-center justify-between border-l-2 border-warning pl-3 py-1"
                  >
                    <Link
                      to={`/financeiro/obras/${r.obra_id}?tab=previsao`}
                      className="hover:underline"
                    >
                      {o?.codigo ?? "—"} · {o?.nome ?? "?"}{" "}
                      <span className="text-xs text-muted-foreground ml-1">({r.label})</span>
                    </Link>
                    <span className="text-warning">
                      {format(new Date(r.data), "dd/MM/yyyy")} · {brl(r.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ObrasAtrasadasCard({ obras }: { obras: any[] }) {
  const atrasadas = obras.filter((o) => isAtrasada(o));
  if (atrasadas.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Obras atrasadas ({atrasadas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {atrasadas.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between border-l-2 border-destructive pl-3 py-1"
            >
              <Link to={`/financeiro/obras/${o.id}`} className="hover:underline">
                {o.codigo} · {o.nome}
              </Link>
              <span className="text-xs text-destructive">
                Previsão: {o.data_previsao_termino ?? o.data_fim ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MedicoesSemNfCard({
  medicoes,
  nfs,
  obras,
}: {
  medicoes: any[];
  nfs: any[];
  obras: any[];
}) {
  const obraMap = new Map(obras.map((o) => [o.id, o]));
  const medComNf = new Set(nfs.map((n) => n.medicao_id).filter(Boolean));
  const aprovadasSemNf = medicoes.filter((m) => m.status === "aprovada" && !medComNf.has(m.id));
  const hoje = new Date();

  const prazoNfAlertas = aprovadasSemNf
    .map((m) => {
      const o = obraMap.get(m.obra_id) as any;
      const prazo = Number(o?.prazo_emitir_nf_dias ?? 0);
      if (!prazo || !m.data_aprovacao) return null;
      const limite = addDays(new Date(m.data_aprovacao), prazo);
      const dias = Math.ceil((limite.getTime() - hoje.getTime()) / 86400000);
      if (dias > 7) return null;
      return { m, o, limite, dias };
    })
    .filter(Boolean) as { m: any; o: any; limite: Date; dias: number }[];

  const vencidasSemReceb = nfs.filter(
    (n) =>
      n.data_vencimento &&
      new Date(n.data_vencimento) < hoje &&
      n.status !== "recebida" &&
      n.status !== "cancelada",
  );
  if (aprovadasSemNf.length === 0 && vencidasSemReceb.length === 0 && prazoNfAlertas.length === 0)
    return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-warning" /> Pendências de faturamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {prazoNfAlertas.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-destructive mb-2">
              NF a emitir — prazo próximo ({prazoNfAlertas.length})
            </div>
            <ul className="space-y-1 text-sm">
              {prazoNfAlertas.slice(0, 5).map(({ m, o, limite, dias }) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between border-l-2 border-destructive pl-3 py-1"
                >
                  <Link
                    to={`/financeiro/obras/${m.obra_id}?tab=medicoes`}
                    className="hover:underline"
                  >
                    {o?.codigo ?? "—"} · Medição {m.numero}
                  </Link>
                  <span className="text-xs text-destructive">
                    {dias < 0 ? `Vencido há ${-dias}d` : `Faltam ${dias}d`} · limite{" "}
                    {format(limite, "dd/MM/yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {aprovadasSemNf.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-warning mb-2">
              Medições aprovadas sem NF ({aprovadasSemNf.length})
            </div>
            <ul className="space-y-1 text-sm">
              {aprovadasSemNf.slice(0, 5).map((m) => {
                const o = obraMap.get(m.obra_id);
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between border-l-2 border-warning pl-3 py-1"
                  >
                    <Link
                      to={`/financeiro/obras/${m.obra_id}?tab=medicoes`}
                      className="hover:underline"
                    >
                      {o?.codigo ?? "—"} · Medição {m.numero}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.data_corte), "dd/MM/yyyy")} · {brl(m.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {vencidasSemReceb.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-destructive mb-2">
              NFs vencidas sem recebimento ({vencidasSemReceb.length})
            </div>
            <ul className="space-y-1 text-sm">
              {vencidasSemReceb.slice(0, 5).map((n) => {
                const o = obraMap.get(n.obra_id);
                return (
                  <li
                    key={n.id}
                    className="flex items-center justify-between border-l-2 border-destructive pl-3 py-1"
                  >
                    <Link to={`/financeiro/obras/${n.obra_id}?tab=nfs`} className="hover:underline">
                      {o?.codigo ?? "—"} · NF {n.numero ?? "s/nº"}
                    </Link>
                    <span className="text-xs text-destructive">
                      Venc. {format(new Date(n.data_vencimento), "dd/MM/yyyy")} · {brl(n.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Dashboard;
