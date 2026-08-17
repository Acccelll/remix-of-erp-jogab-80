import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DatePickerField from "@/components/common/DatePickerField";
import { AlertCircle, ChevronDown, Loader, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRhidPreview, useRhidSync, type RhidPreviewResult } from "@/hooks/dp/useRhidSync";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useAuth } from "@/contexts/auth/useAuth";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { hojeBrasilia, primeiroDiaMesBrasilia } from "@/lib/core/date";

function isValidIsoDate(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}

interface RhidSyncDialogProps {
  onSuccess?: () => void;
}

export function RhidSyncDialog({ onSuccess }: RhidSyncDialogProps) {
  const { currentPlayer } = useAuth();
  const { colaboradores } = useColaboradoresContext();
  const [open, setOpen] = useState(false);
  const [inicio, setInicio] = useState(primeiroDiaMesBrasilia());
  const [fim, setFim] = useState(hojeBrasilia());
  const [preview, setPreview] = useState<RhidPreviewResult | null>(null);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);

  const previewMut = useRhidPreview();
  const syncMut = useRhidSync();

  // CPF é o pivô de vínculo, mesma regra da importação por CSV.
  const colabByCpf = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; matricula?: string }>();
    for (const c of colaboradores) {
      if (c.cpf) m.set(String(c.cpf).replace(/\D/g, ""), c);
    }
    return m;
  }, [colaboradores]);

  const resumo = useMemo(() => {
    if (!preview) return null;
    const vinculados = preview.rows.filter((r) => r.cpf && colabByCpf.has(r.cpf)).length;
    const pessoasUnicas = new Set(preview.rows.map((r) => `${r.cpf ?? ""}|${r.nome}`)).size;
    return { vinculados, pessoasUnicas };
  }, [preview, colabByCpf]);

  const periodoValido = isValidIsoDate(inicio) && isValidIsoDate(fim) && inicio <= fim;

  const handleBuscar = () => {
    if (!periodoValido) {
      toast.error("Informe um período válido (a data final não pode ser anterior à inicial).");
      return;
    }
    setPreview(null);
    setProgresso({ feito: 0, total: 0 });
    previewMut.mutate(
      {
        periodoInicio: inicio,
        periodoFim: fim,
        onProgress: (feito, total) => setProgresso({ feito, total }),
      },
      {
        onSuccess: (r) => {
          setPreview(r);
          setProgresso(null);
          if (r.rows.length === 0) {
            toast.warning("A RHiD não retornou apuração para este período.");
          } else if (r.erros.length > 0) {
            toast.warning(
              `${r.rows.length} registros — ${r.erros.length} colaborador(es) falharam.`,
            );
          } else {
            toast.success(`${r.rows.length} registros carregados da RHiD.`);
          }
        },
        onError: (e: unknown) => {
          setProgresso(null);
          toast.error("Falha ao buscar da RHiD: " + (e instanceof Error ? e.message : String(e)));
        },
      },
    );
  };

  const handleConfirmar = () => {
    if (!preview || preview.rows.length === 0) return;
    syncMut.mutate(
      {
        rows: preview.rows,
        periodoInicio: inicio,
        periodoFim: fim,
        importadoPor: currentPlayer?.login ?? "RHID_SYNC",
        colaboradoresCtx: colaboradores,
        erros: preview.erros,
        pessoas: preview.pessoas,
      },
      {
        onSuccess: () => {
          toast.success(`Importação concluída: ${preview.rows.length} registros da RHiD.`);
          setPreview(null);
          setOpen(false);
          onSuccess?.();
        },
        onError: (e: unknown) =>
          toast.error("Falha ao importar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  const buscando = previewMut.isPending;
  const gravando = syncMut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar RHiD
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sincronizar ponto com a RHiD</DialogTitle>
          <DialogDescription>
            Busca a apuração (motor ACJEF) de todos os colaboradores no período e importa pelo mesmo
            pipeline do CSV. As credenciais ficam no servidor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-medium block mb-1">Início</label>
                <DatePickerField
                  value={isValidIsoDate(inicio) ? inicio : ""}
                  onChange={setInicio}
                  disabled={buscando || gravando}
                  className="w-40"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Fim</label>
                <DatePickerField
                  value={isValidIsoDate(fim) ? fim : ""}
                  onChange={setFim}
                  disabled={buscando || gravando}
                  className="w-40"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={buscando || gravando}
                onClick={() => {
                  setInicio(primeiroDiaMesBrasilia());
                  setFim(hojeBrasilia());
                }}
              >
                Mês atual
              </Button>
              <Button onClick={handleBuscar} disabled={buscando || gravando || !periodoValido}>
                {buscando && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                {buscando ? "Buscando…" : "Buscar da RHiD"}
              </Button>
            </div>

            {progresso && progresso.total > 0 && (
              <div className="mt-4 space-y-1">
                <Progress value={(progresso.feito / progresso.total) * 100} />
                <p className="text-xs text-muted-foreground">
                  {progresso.feito} de {progresso.total} colaboradores
                </p>
              </div>
            )}
          </Card>

          {previewMut.isError && (
            <div className="p-3 bg-destructive/10 rounded-md flex gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{(previewMut.error as Error)?.message}</p>
            </div>
          )}

          {preview && resumo && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Registros</div>
                  <div className="text-2xl font-bold">{preview.rows.length}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Colaboradores</div>
                  <div className="text-2xl font-bold">{resumo.pessoasUnicas}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Vinculados (CPF)</div>
                  <div className="text-2xl font-bold text-success">
                    {resumo.vinculados}
                    <span className="text-base text-muted-foreground">/{preview.rows.length}</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Total HE 60%</div>
                  <div className="text-2xl font-bold tabular-nums">
                    {formatMinutes(preview.rows.reduce((a, r) => a + r.horas_extra_60_min, 0))}
                  </div>
                </Card>
              </div>

              {preview.erros.length > 0 && (
                <div className="p-3 bg-warning/10 rounded-md text-sm">
                  <p className="font-medium text-warning">
                    {preview.erros.length} colaborador(es) não puderam ser apurados
                  </p>
                  <ul className="text-xs mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                    {preview.erros.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        idPerson {e.idPerson}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diagnóstico: é aqui que se fecha o mapeamento contra a resposta real. */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ChevronDown className="w-4 h-4" />
                    Diagnóstico do mapeamento
                    {preview.naoMapeados.length > 0 && (
                      <span className="text-xs text-warning">
                        ({preview.naoMapeados.length} campos não mapeados)
                      </span>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="p-4 mt-2 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Interpretação das durações</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campo do ERP</TableHead>
                            <TableHead>Campo da RHiD</TableHead>
                            <TableHead>Valor bruto</TableHead>
                            <TableHead className="text-right">Minutos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.explicacao.map((l) => (
                            <TableRow key={l.campo}>
                              <TableCell className="text-xs">{l.campo}</TableCell>
                              <TableCell className="text-xs font-mono">{l.origem}</TableCell>
                              <TableCell className="text-xs font-mono">{l.bruto}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {l.minutos}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {preview.naoMapeados.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">
                          Campos retornados sem mapeamento
                        </h4>
                        <p className="text-xs font-mono break-all text-muted-foreground">
                          {preview.naoMapeados.join(", ")}
                        </p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Primeiro registro cru</h4>
                      <pre className="text-[11px] bg-muted p-2 rounded max-h-48 overflow-auto">
                        {JSON.stringify(preview.amostraBruta, null, 2)}
                      </pre>
                    </div>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              <Card className="p-4 overflow-auto">
                <h3 className="font-semibold mb-3">Pré-visualização (primeiras 30 linhas)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Colaborador (cadastro)</TableHead>
                      <TableHead>Nome na RHiD</TableHead>
                      <TableHead>Depto</TableHead>
                      <TableHead className="text-right">Prev.</TableHead>
                      <TableHead className="text-right">Trab.</TableHead>
                      <TableHead className="text-right">HE 60</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 30).map((r, i) => {
                      const match = r.cpf ? colabByCpf.get(r.cpf) : undefined;
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-xs tabular-nums">{r.data ?? "—"}</TableCell>
                          <TableCell className="text-xs tabular-nums">{r.cpf || "—"}</TableCell>
                          <TableCell className="font-medium text-xs">
                            {match ? (
                              match.nome
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.nome}</TableCell>
                          <TableCell className="text-xs">{r.departamento ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {formatMinutes(r.horas_previstas_min)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {formatMinutes(r.horas_trabalhadas_min)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {formatMinutes(r.horas_extra_60_min)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {match ? (
                              <span className="text-success">Vinculado</span>
                            ) : (
                              <span className="text-warning">Não cadastrado</span>
                            )}
                            {r.falta && <span className="text-destructive ml-2">Falta</span>}
                            {r.atestado && <span className="text-primary ml-2">Atestado</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreview(null)} disabled={gravando}>
                  Descartar
                </Button>
                <Button onClick={handleConfirmar} disabled={gravando || preview.rows.length === 0}>
                  {gravando && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                  {gravando
                    ? "Importando…"
                    : `Confirmar importação (${preview.rows.length} registros)`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RhidSyncDialog;
