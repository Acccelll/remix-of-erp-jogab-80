// Perfil do Cliente — dialog com abas: Obras, Comercial, Saúde Financeira, Ações.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientesContext } from "@/contexts/ClientesContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { notasFiscaisRepo } from "@/lib/repositories/medicoes";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { fmtData } from "@/lib/utils";
import type { Cliente, Oportunidade, Obra } from "@/types";
import { AlertTriangle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
}

function matchOportunidadeToCliente(oportunidade: Oportunidade, cliente: Cliente): boolean {
  if (oportunidade.clienteId && oportunidade.clienteId === cliente.id) return true;
  const n = (s?: string | null) => (s ?? "").trim().toLowerCase();
  if (n(oportunidade.empresa) && n(oportunidade.empresa) === n(cliente.nome)) return true;
  if (n(oportunidade.empresa) && n(oportunidade.empresa) === n(cliente.nome_fantasia)) return true;
  return false;
}

function matchObraToCliente(obra: Obra, cliente: Cliente): boolean {
  if (obra.clienteId && obra.clienteId === cliente.id) return true;
  const n = (s?: string | null) => (s ?? "").trim().toLowerCase();
  return !!(obra.cliente && n(obra.cliente) === n(cliente.nome));
}

export default function ClienteProfileDialog({ cliente, onClose }: Props) {
  const open = !!cliente;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {cliente?.nome_fantasia || cliente?.nome || "Cliente"}
            {cliente?.nome_fantasia && (
              <span className="text-sm text-muted-foreground font-normal ml-2">
                ({cliente.nome})
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Perfil do cliente {cliente?.nome_fantasia || cliente?.nome || ""}
          </DialogDescription>
        </DialogHeader>
        {cliente && <ClienteTabs cliente={cliente} />}
      </DialogContent>
    </Dialog>
  );
}

function ClienteTabs({ cliente }: { cliente: Cliente }) {
  return (
    <Tabs defaultValue="obras" className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="obras">Histórico de Obras</TabsTrigger>
        <TabsTrigger value="comercial">Histórico Comercial</TabsTrigger>
        <TabsTrigger value="saude">Saúde Financeira</TabsTrigger>
        <TabsTrigger value="acoes">Próximas Ações</TabsTrigger>
      </TabsList>
      <TabsContent value="obras" className="pt-4">
        <ObrasTab cliente={cliente} />
      </TabsContent>
      <TabsContent value="comercial" className="pt-4">
        <ComercialTab cliente={cliente} />
      </TabsContent>
      <TabsContent value="saude" className="pt-4">
        <SaudeTab cliente={cliente} />
      </TabsContent>
      <TabsContent value="acoes" className="pt-4">
        <AcoesTab cliente={cliente} />
      </TabsContent>
    </Tabs>
  );
}

function ObrasTab({ cliente }: { cliente: Cliente }) {
  const { obras } = useObrasContext();
  const navigate = useNavigate();
  const doCliente = useMemo(
    () => obras.filter((o) => matchObraToCliente(o, cliente)),
    [obras, cliente],
  );

  if (doCliente.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma obra vinculada a este cliente.</p>;
  }
  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2">Código</th>
            <th className="text-left px-3 py-2">Nome</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Início</th>
            <th className="text-right px-3 py-2">Valor contrato</th>
          </tr>
        </thead>
        <tbody>
          {doCliente.map((o) => (
            <tr
              key={o.id}
              className="border-t hover:bg-muted/30 cursor-pointer"
              onClick={() => navigate(`/obras/${o.id}`)}
            >
              <td className="px-3 py-2 font-mono text-xs">{o.codigo || "—"}</td>
              <td className="px-3 py-2">{o.nome}</td>
              <td className="px-3 py-2">
                <Badge variant={o.ativa ? "default" : "secondary"}>
                  {o.ativa ? "Ativa" : "Inativa"}
                </Badge>
              </td>
              <td className="px-3 py-2">{fmtData(o.dataInicio)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatBRLFromNumber(o.valorContrato ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComercialTab({ cliente }: { cliente: Cliente }) {
  const { oportunidades } = useClientesContext();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<"andamento" | "todas">("andamento");

  const filtrados = useMemo(() => {
    const doCliente = oportunidades.filter((l) => matchOportunidadeToCliente(l, cliente));
    if (filtro === "todas") return doCliente;
    return doCliente.filter(
      (l) => l.estagio !== "fechado_ganho" && l.estagio !== "fechado_perdido",
    );
  }, [oportunidades, cliente, filtro]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filtro === "andamento" ? "default" : "outline"}
          onClick={() => setFiltro("andamento")}
        >
          Em andamento
        </Button>
        <Button
          size="sm"
          variant={filtro === "todas" ? "default" : "outline"}
          onClick={() => setFiltro("todas")}
        >
          Todas
        </Button>
      </div>
      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma oportunidade encontrada.</p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2">Título</th>
                <th className="text-left px-3 py-2">Estágio</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Previsão</th>
                <th className="text-left px-3 py-2">Temperatura</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr
                  key={l.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/crm/oportunidades/${l.id}`)}
                >
                  <td className="px-3 py-2">{l.nome}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{l.estagio}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBRLFromNumber(l.valorEstimado || 0)}
                  </td>
                  <td className="px-3 py-2">{fmtData(l.dataPrevistaFechamento)}</td>
                  <td className="px-3 py-2 capitalize">{l.temperatura_temperatura || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface LancamentoRow {
  id: string;
  obra_id: string | null;
  valor_liquido: number | null;
  valor_baixado: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status_cod: number | null;
}

interface NfRow {
  id: string;
  obra_id: string | null;
  valor: number | null;
  status: string | null;
}

function SaudeTab({ cliente }: { cliente: Cliente }) {
  const { obras } = useObrasContext();
  const obraIds = useMemo(
    () => obras.filter((o) => matchObraToCliente(o, cliente)).map((o) => o.id),
    [obras, cliente],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-saude", cliente.id, obraIds.join(",")],
    enabled: obraIds.length > 0,
    queryFn: async () => {
      const [lancs, notas] = await Promise.all([
        financeiroRepo.listSaudeByObraIds(obraIds),
        notasFiscaisRepo.listResumoByObraIds(obraIds),
      ]);
      return {
        lancamentos: (lancs ?? []) as LancamentoRow[],
        notas: (notas ?? []) as NfRow[],
      };
    },
  });

  const metrics = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const lancs = data?.lancamentos ?? [];
    const notas = data?.notas ?? [];

    let saldoDevedor = 0;
    let vencidosValor = 0;
    let vencidosQtd = 0;
    let aVencerMesValor = 0;
    let aVencerMesQtd = 0;
    let maxDiasAtraso = 0;

    for (const l of lancs) {
      const liq = Number(l.valor_liquido ?? 0);
      const baixado = Number(l.valor_baixado ?? 0);
      const saldo = liq - baixado;
      const pago = !!l.data_pagamento || saldo <= 0.01;
      if (pago) continue;
      saldoDevedor += saldo;
      if (l.data_vencimento) {
        const venc = new Date(l.data_vencimento);
        if (venc < hoje) {
          vencidosValor += saldo;
          vencidosQtd += 1;
          const dias = Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
          if (dias > maxDiasAtraso) maxDiasAtraso = dias;
        } else if (venc >= inicioMes && venc <= fimMes) {
          aVencerMesValor += saldo;
          aVencerMesQtd += 1;
        }
      }
    }

    const faturamentoAcumulado = notas
      .filter((n) => (n.status ?? "") !== "cancelada")
      .reduce((s, n) => s + Number(n.valor ?? 0), 0);

    let status: "adimplente" | "atraso" | "bloqueado" = "adimplente";
    if (maxDiasAtraso > 60) status = "bloqueado";
    else if (vencidosQtd > 0) status = "atraso";

    return {
      saldoDevedor,
      vencidosValor,
      vencidosQtd,
      aVencerMesValor,
      aVencerMesQtd,
      faturamentoAcumulado,
      status,
      maxDiasAtraso,
    };
  }, [data]);

  if (obraIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem obras vinculadas — não há dados financeiros.
      </p>
    );
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const statusConfig = {
    adimplente: {
      label: "Adimplente",
      icon: CheckCircle2,
      cls: "bg-success/10 text-success border-success/30",
    },
    atraso: {
      label: "Em atraso",
      icon: AlertTriangle,
      cls: "bg-warning/10 text-warning border-warning/30",
    },
    bloqueado: {
      label: "Crédito Bloqueado",
      icon: XCircle,
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
  }[metrics.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className={`border-2 ${statusConfig.cls.split(" ")[2]}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Status de Crédito</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${statusConfig.cls}`}
          >
            <StatusIcon className="h-4 w-4" />
            <span className="font-semibold">{statusConfig.label}</span>
          </div>
          {metrics.maxDiasAtraso > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Maior atraso: {metrics.maxDiasAtraso} dias
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Saldo devedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {formatBRLFromNumber(metrics.saldoDevedor)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Faturamento acumulado: {formatBRLFromNumber(metrics.faturamentoAcumulado)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Boletos vencidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-destructive">
            {formatBRLFromNumber(metrics.vencidosValor)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{metrics.vencidosQtd} título(s)</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">A vencer neste mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {formatBRLFromNumber(metrics.aVencerMesValor)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {metrics.aVencerMesQtd} título(s)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AtividadeRow {
  id: number | string;
  tipo?: string | null;
  descricao?: string | null;
  data_vencimento?: string | null;
  concluida?: number | boolean;
  oportunidade_id?: number | string | null;
}

function AcoesTab({ cliente }: { cliente: Cliente }) {
  const { oportunidades } = useClientesContext();
  const navigate = useNavigate();
  const oportunidadesDoCliente = useMemo(
    () => oportunidades.filter((l) => matchOportunidadeToCliente(l, cliente)),
    [oportunidades, cliente],
  );
  const oportunidadeIds = oportunidadesDoCliente.map((l) => l.id);

  // Buscar atividades de cada oportunidade (uma vez por oportunidade). Consulta best-effort — se rota falhar, mostra vazio.
  const { data: atividades, isLoading } = useQuery({
    queryKey: ["cliente-acoes", cliente.id, oportunidadeIds.join(",")],
    enabled: oportunidadeIds.length > 0,
    queryFn: async () => {
      const { apiFetch } = await import("@/lib/api");
      const results = await Promise.all(
        oportunidadeIds.map((id) =>
          apiFetch<AtividadeRow[]>("crmAtividades", { params: { oportunidade_id: id } }).catch(
            () => [] as AtividadeRow[],
          ),
        ),
      );
      return results.flat().filter((a) => !a.concluida);
    },
  });

  const ordenadas = useMemo(() => {
    const arr = atividades ?? [];
    return [...arr].sort((a, b) => {
      const da = a.data_vencimento || "9999";
      const db = b.data_vencimento || "9999";
      return da.localeCompare(db);
    });
  }, [atividades]);

  if (oportunidadeIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma oportunidade vinculado — cadastre uma oportunidade para agendar ações.
      </p>
    );
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (ordenadas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma ação pendente. Acesse a oportunidade para agendar uma nova.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ordenadas.map((a) => (
        <div
          key={String(a.id)}
          className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer"
          onClick={() => a.oportunidade_id && navigate(`/crm/oportunidades/${a.oportunidade_id}`)}
        >
          <Badge variant="outline" className="capitalize">
            {a.tipo || "tarefa"}
          </Badge>
          <div className="flex-1">
            <div className="text-sm">{a.descricao || "(sem descrição)"}</div>
            <div className="text-xs text-muted-foreground">
              Vence em {fmtData(a.data_vencimento)}
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}
