// PRO-032 · slice-01/-02/-03/-04 — Painel consolidado M12 no hub de Contratos.
// slice-02: adiciona série mensal (novos vs. encerrados) via recharts.
// slice-03: seletor de horizonte (3/6/12 meses) persistido em localStorage.
// slice-04: drill-down por mês (clique na barra abre lista do bucket).
import { useMemo, useState, useEffect } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  AlertTriangle,
  BellOff,
  FileSignature,
  FileWarning,
  Files,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/chart";
import { useContratosContext } from "@/contexts/ContratosContext";
import { useContratosVencendo } from "@/hooks/contratos/useContratosVencendo";
import { useContratoAlertaSilencio } from "@/hooks/contratos/useContratoAlertaSilencio";
import { useContratoDocumentosVencendo } from "@/hooks/contratos/useContratoDocumentosVencendo";
import { serieContratosMensal, contratosDoMes } from "@/lib/contratos/serie-mensal";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ContratoProfileDialog from "@/components/contratos/ContratoProfileDialog";
import { formatBRL } from "@/lib/core/currency";
import { swallow } from "@/lib/core/errors";



const fmtBRL = (v: number) => formatBRL(v, { fallback: "R$ 0,00" });


const HORIZONTE_KEY = "gestaobra:contratos:painel:horizonte";
type Horizonte = 3 | 6 | 12;

export default function ContratosOverview() {
  const { contratos } = useContratosContext();
  const alertasTodos = useContratosVencendo();
  const { filtrar } = useContratoAlertaSilencio();
  const docsVencendo = useContratoDocumentosVencendo(30);
  const [horizonte, setHorizonte] = useState<Horizonte>(() => {
    if (typeof window === "undefined") return 6;
    const raw = Number(window.localStorage.getItem(HORIZONTE_KEY));
    return raw === 3 || raw === 6 || raw === 12 ? (raw as Horizonte) : 6;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(HORIZONTE_KEY, String(horizonte));
    } catch (err) {
      swallow("contratos.overview.horizonte", err, "localStorage indisponível");
    }
  }, [horizonte]);
  const serie = useMemo(() => serieContratosMensal(contratos, horizonte), [contratos, horizonte]);
  const [mesAberto, setMesAberto] = useState<{ chave: string; rotulo: string } | null>(null);
  const detalhe = useMemo(
    () => (mesAberto ? contratosDoMes(contratos, mesAberto.chave) : null),
    [mesAberto, contratos],
  );
  const [contratoIdAberto, setContratoIdAberto] = useState<string | null>(null);

  function abrirContrato(id: string) {
    setMesAberto(null);
    setContratoIdAberto(id);
  }






  const stats = useMemo(() => {
    const ativos = contratos.filter((c) => c.ativo && c.status !== "encerrado");
    const alertasAtivos = filtrar(alertasTodos);
    const criticos = alertasAtivos.filter((a) => a.severidade === "critica").length;
    const silenciados = alertasTodos.length - alertasAtivos.length;
    const valorMensal = ativos
      .filter((c) => c.periodicidadePagamento === "Mensal")
      .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const docsVencidos = docsVencendo.filter((d) => d.situacao !== "proximo").length;
    return {
      totalAtivos: ativos.length,
      valorMensal,
      alertas: alertasAtivos.length,
      criticos,
      silenciados,
      docsVencendo: docsVencendo.length,
      docsVencidos,
    };
  }, [contratos, alertasTodos, filtrar, docsVencendo]);

  const cards = [
    {
      icon: Files,
      label: "Contratos ativos",
      valor: String(stats.totalAtivos),
      hint: stats.valorMensal > 0 ? `${fmtBRL(stats.valorMensal)}/mês (recorrentes)` : "sem valor recorrente",
      tone: "default" as const,
    },
    {
      icon: AlertTriangle,
      label: "Alertas ativos",
      valor: String(stats.alertas),
      hint:
        stats.criticos > 0
          ? `${stats.criticos} crítico(s)`
          : stats.alertas > 0
            ? "nenhum crítico"
            : "tudo em dia",
      tone: stats.criticos > 0 ? ("destructive" as const) : ("default" as const),
    },
    {
      icon: FileWarning,
      label: "Documentos a vencer",
      valor: String(stats.docsVencendo),
      hint:
        stats.docsVencidos > 0
          ? `${stats.docsVencidos} vencido(s)/hoje`
          : stats.docsVencendo > 0
            ? "todos futuros"
            : "sem pendências",
      tone: stats.docsVencidos > 0 ? ("destructive" as const) : ("default" as const),
    },
    {
      icon: BellOff,
      label: "Alertas silenciados",
      valor: String(stats.silenciados),
      hint: stats.silenciados > 0 ? "gerenciar no sino" : "nenhum",
      tone: "muted" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const toneBorder =
          c.tone === "destructive"
            ? "border-destructive/40 bg-destructive/5"
            : c.tone === "muted"
              ? "border-border/60 bg-muted/30"
              : "border-border";
        return (
          <Card key={c.label} className={toneBorder}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span>{c.label}</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{c.valor}</div>
              <div className="text-[11px] text-muted-foreground truncate">{c.hint}</div>
            </CardContent>
          </Card>
        );
      })}
      <Card className="col-span-2 md:col-span-4 border-border">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Movimentação mensal · últimos {horizonte} meses
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">novos vs. encerrados</span>
              <ToggleGroup
                type="single"
                size="sm"
                value={String(horizonte)}
                onValueChange={(v) => {
                  const n = Number(v);
                  if (n === 3 || n === 6 || n === 12) setHorizonte(n as Horizonte);
                }}
                className="h-6"
              >
                <ToggleGroupItem value="3" className="h-6 px-2 text-[11px]">3m</ToggleGroupItem>
                <ToggleGroupItem value="6" className="h-6 px-2 text-[11px]">6m</ToggleGroupItem>
                <ToggleGroupItem value="12" className="h-6 px-2 text-[11px]">12m</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={serie}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  const p = e?.activePayload?.[0]?.payload;
                  if (p?.chave && p?.rotulo) setMesAberto({ chave: p.chave, rotulo: p.rotulo });
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="novos" name="Novos" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar
                  dataKey="encerrados"
                  name="Encerrados"
                  fill="hsl(var(--destructive))"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="col-span-2 md:col-span-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <FileSignature className="h-3 w-3" />
        Painel M12 · dados agregados dos hooks já consumidos pelo sino e pelas
        abas do hub.
      </div>

      <Dialog open={!!mesAberto} onOpenChange={(o) => !o && setMesAberto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Movimentação · {mesAberto?.rotulo}
            </DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[11px] uppercase text-muted-foreground">
                  Novos ({detalhe.novos.length})
                </div>
                <ScrollArea className="h-56 rounded border border-border/60">
                  <ul className="p-2 space-y-1 text-xs">
                    {detalhe.novos.length === 0 && (
                      <li className="text-muted-foreground">nenhum</li>
                    )}
                    {detalhe.novos.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => abrirContrato(c.id)}
                          className="w-full text-left truncate hover:underline text-primary"
                        >
                          {c.locacaoServico}
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase text-muted-foreground">
                  Encerrados ({detalhe.encerrados.length})
                </div>
                <ScrollArea className="h-56 rounded border border-border/60">
                  <ul className="p-2 space-y-1 text-xs">
                    {detalhe.encerrados.length === 0 && (
                      <li className="text-muted-foreground">nenhum</li>
                    )}
                    {detalhe.encerrados.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => abrirContrato(c.id)}
                          className="w-full text-left truncate hover:underline text-primary"
                        >
                          {c.locacaoServico}
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ContratoProfileDialog
        open={!!contratoIdAberto}
        onClose={() => setContratoIdAberto(null)}
        contratoId={contratoIdAberto}
      />
    </div>
  );
}

