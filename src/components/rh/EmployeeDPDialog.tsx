import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "lucide-react";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { useColaboradorDp } from "@/hooks/dp/useColaboradorDp";
import { periodosEmObra, proporcaoPorObra } from "@/lib/dp/rateioPeriodos";

import { formatMatricula } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "@/components/ui/chart";

interface EmployeeDPDialogProps {
  colaboradorId: string | null;
  open: boolean;
  onClose: () => void;
}

import { formatBRL } from "@/lib/core/currency";

const formatCurrency = (v: number) => formatBRL(v);

const tipoHELabels: Record<string, string> = {
  he_50: "HE 50%",
  he_100: "HE 100%",
  noturna: "Noturna",
  domingo: "Domingo",
  feriado: "Feriado",
  normal: "HE Normal",
  domingo_feriado: "Dom/Feriado",
};
const catLabels: Record<string, string> = {
  ferias: "Férias",
  decimo_terceiro: "13º Salário",
  fgts: "FGTS",
  rescisao: "Rescisão",
  outro: "FGTS/Outros",
};

/** Garante que o valor retornado seja sempre um array, independente do que veio da API */
function toArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

const EmployeeDPDialog: React.FC<EmployeeDPDialogProps> = ({ colaboradorId, open, onClose }) => {
  const { colaboradores, obras } = useCatalogos();
  const { historico, horasExtras, fopag, provisoes, mobPeriodos } = useColaboradorDp(
    colaboradorId,
    open,
  );
  const [heFilter, setHeFilter] = useState("todas");
  const [heTipoFilter, setHeTipoFilter] = useState("todos");
  const [fopagFilter, setFopagFilter] = useState("todas");
  const [provCategoriaFilter, setProvCategoriaFilter] = useState("todas");
  const [obraFilter, setObraFilter] = useState("todas");

  const colab = useMemo(
    () => colaboradores.find((c) => c.id === colaboradorId),
    [colaboradores, colaboradorId],
  );

  const obraNome = useMemo(() => {
    if (!colab?.obraAtualId) return "Sem obra";
    return obras.find((o) => o.id === colab.obraAtualId)?.nome || "Sem obra";
  }, [colab, obras]);


  // Períodos em obra. Férias, folga e afastamento vêm na mesma lista desde que
  // a rota `mobilizacoesPeriodos` passou a existir, e não são alocação em obra.
  const emObra = useMemo(() => periodosEmObra(mobPeriodos), [mobPeriodos]);

  // Obras onde o colaborador esteve mobilizado.
  const obrasDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    emObra.forEach((p) => {
      map.set(String(p.obra_id), p.obra_nome || "Obra");
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [emObra]);

  // Rateio: como a rota folhaRateada não existe no backend, calculamos localmente
  const rateioData = useMemo(() => {
    if (obraFilter === "todas" || !fopag.length) return null;

    // Regra e premissa documentadas em @/lib/dp/rateioPeriodos.
    const proporcao = proporcaoPorObra(mobPeriodos, obraFilter);
    if (proporcao === 0) return [];

    // Agrupa fopag por competência e aplica proporção
    const byComp: Record<string, { provento_total: number; desconto_total: number }> = {};
    for (const e of fopag) {
      const comp = e.competencia || "";
      if (!byComp[comp]) byComp[comp] = { provento_total: 0, desconto_total: 0 };
      const valor = Number(e.valor || 0);
      if (e.tipo === "provento") byComp[comp].provento_total += valor * proporcao;
      if (e.tipo === "desconto") byComp[comp].desconto_total += valor * proporcao;
    }

    return Object.entries(byComp)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([competencia, v]) => ({ competencia, ...v }));
  }, [obraFilter, fopag, mobPeriodos]);

  // Competências disponíveis
  const heCompetencias = useMemo(
    () => [...new Set(horasExtras.map((e: any) => e.competencia))].filter(Boolean).sort().reverse(),
    [horasExtras],
  );
  const fopagCompetencias = useMemo<string[]>(
    () =>
      [...new Set(fopag.map((e: any) => String(e.competencia || "")))]
        .filter(Boolean)
        .sort()
        .reverse(),
    [fopag],
  );

  const provCategorias = useMemo(
    () => ["todas", ...new Set(provisoes.map((p: any) => p.tipo || p.categoria || "outro"))],
    [provisoes],
  );

  // Filtros
  const filteredHE = useMemo(() => {
    let result = horasExtras;
    if (heFilter !== "todas") result = result.filter((e: any) => e.competencia === heFilter);
    if (heTipoFilter !== "todos")
      result = result.filter((e: any) => (e.tipo || "") === heTipoFilter);
    return result;
  }, [horasExtras, heFilter, heTipoFilter]);

  const filteredFopag = useMemo(
    () =>
      fopagFilter === "todas" ? fopag : fopag.filter((e: any) => e.competencia === fopagFilter),
    [fopag, fopagFilter],
  );

  const filteredProvisoes = useMemo(
    () =>
      provCategoriaFilter === "todas"
        ? provisoes
        : provisoes.filter((p: any) => (p.tipo || p.categoria || "outro") === provCategoriaFilter),
    [provisoes, provCategoriaFilter],
  );

  // Resumo
  const salarioAtual = colab
    ? parseFloat(
        String(colab.salario || "0")
          .replace(/[^\d.,]/g, "")
          .replace(",", "."),
      ) || 0
    : 0;
  const totalHE12m = useMemo(
    () => horasExtras.reduce((s: number, e: any) => s + Number(e.valor_total || 0), 0),
    [horasExtras],
  );
  const ultimaComp = fopagCompetencias[0] || "";
  const ultimaFopag = fopag.filter((e: any) => e.competencia === ultimaComp);
  const totalProventos = ultimaFopag
    .filter((e: any) => e.tipo === "provento")
    .reduce((s: number, e: any) => s + Number(e.valor || 0), 0);
  const totalDescontos = ultimaFopag
    .filter((e: any) => e.tipo === "desconto")
    .reduce((s: number, e: any) => s + Number(e.valor || 0), 0);
  const provAno = provisoes.reduce((s: number, e: any) => s + Number(e.valor || 0), 0);

  // Gráfico evolução salarial
  const salarioChart = useMemo(
    () =>
      historico.map((h: any) => ({
        vigencia: h.data_inicio || h.vigencia || "",
        salario: Number(h.salario ?? h.salario_novo ?? 0),
      })),
    [historico],
  );

  // Gráfico HE por tipo
  const heByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    filteredHE.forEach((e: any) => {
      const t = e.tipo || "normal";
      map[t] = (map[t] || 0) + Number(e.horas ?? e.quantidade_horas ?? 0);
    });
    return Object.entries(map).map(([tipo, horas]) => ({
      tipo: tipoHELabels[tipo] || tipo,
      horas,
    }));
  }, [filteredHE]);

  const fopagProventos = filteredFopag
    .filter((e: any) => e.tipo === "provento")
    .reduce((s: number, e: any) => s + Number(e.valor || 0), 0);
  const fopagDescontos = filteredFopag
    .filter((e: any) => e.tipo === "desconto")
    .reduce((s: number, e: any) => s + Number(e.valor || 0), 0);

  if (!colab) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2">
            <User className="h-5 w-5" />
            {colab.nome} – {formatMatricula(colab.matricula)}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {colab.funcao} • {obraNome} •{" "}
            {colab.formaSalario === "horista" ? "Horista" : "Mensalista"}
          </div>
        </DialogHeader>

        <Tabs
          defaultValue="resumo"
          className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pb-6"
        >
          <TabsList className="grid grid-cols-5 mb-4 shrink-0">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="salario">Evolução Salarial</TabsTrigger>
            <TabsTrigger value="he">Horas Extras</TabsTrigger>
            <TabsTrigger value="fopag">Folha</TabsTrigger>
            <TabsTrigger value="provisoes">Provisões</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            {/* ===== RESUMO ===== */}
            <TabsContent value="resumo" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Salário Atual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{formatCurrency(salarioAtual)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">
                      Total HE (período)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{formatCurrency(totalHE12m)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">
                      Última Folha (líq.)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">
                      {formatCurrency(totalProventos - totalDescontos)}
                    </p>
                    <p className="text-xs text-muted-foreground">{ultimaComp || "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Provisões (ano)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{formatCurrency(provAno)}</p>
                  </CardContent>
                </Card>
              </div>

              {ultimaFopag.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Últimos Eventos – {ultimaComp}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Evento</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ultimaFopag.slice(0, 10).map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs">{e.evento}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {e.tipo === "provento" ? "P" : e.tipo === "base" ? "B" : "D"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(Number(e.valor || 0))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ===== EVOLUÇÃO SALARIAL ===== */}
            <TabsContent value="salario" className="mt-0">
              {salarioChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={salarioChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="vigencia" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Line
                      type="monotone"
                      dataKey="salario"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhum registro de histórico salarial.
                </p>
              )}

              {historico.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vigência</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Salário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((h: any) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs">{h.data_inicio || h.vigencia}</TableCell>
                        <TableCell className="text-xs">{h.cargo || colab.funcao}</TableCell>
                        <TableCell className="text-xs">{h.motivo}</TableCell>
                        <TableCell className="text-right text-xs">
                          {formatCurrency(Number(h.salario ?? h.salario_novo ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>

            {/* ===== HORAS EXTRAS ===== */}
            <TabsContent value="he" className="space-y-4 mt-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Competência:</span>
                  <Select value={heFilter} onValueChange={setHeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {heCompetencias.map((c: string) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Tipo:</span>
                  <Select value={heTipoFilter} onValueChange={setHeTipoFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="normal">HE Normal (50%)</SelectItem>
                      <SelectItem value="he_50">HE 50%</SelectItem>
                      <SelectItem value="he_100">HE 100%</SelectItem>
                      <SelectItem value="noturna">Noturna</SelectItem>
                      <SelectItem value="domingo_feriado">Dom/Feriado</SelectItem>
                      <SelectItem value="domingo">Domingo</SelectItem>
                      <SelectItem value="feriado">Feriado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Total Horas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">
                      {filteredHE
                        .reduce(
                          (s: number, e: any) => s + Number(e.horas ?? e.quantidade_horas ?? 0),
                          0,
                        )
                        .toFixed(1)}
                      h
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Valor Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">
                      {formatCurrency(
                        filteredHE.reduce((s: number, e: any) => s + Number(e.valor_total || 0), 0),
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {heByTipo.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={heByTipo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Valor/H</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHE.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.data}</TableCell>
                      <TableCell className="text-xs">{tipoHELabels[e.tipo] || e.tipo}</TableCell>
                      <TableCell className="text-right text-xs">
                        {Number(e.horas ?? e.quantidade_horas ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(Number(e.valor_hora || 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(Number(e.valor_total || 0))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredHE.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-xs">
                        Nenhum registro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </TabsContent>

            {/* ===== FOLHA ===== */}
            <TabsContent value="fopag" className="space-y-4 mt-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Competência:</span>
                  <Select value={fopagFilter} onValueChange={setFopagFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {fopagCompetencias.map((c: string) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {obrasDisponiveis.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Obra (rateio):</span>
                    <Select value={obraFilter} onValueChange={setObraFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas (sem rateio)</SelectItem>
                        {obrasDisponiveis.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Rateio por obra */}
              {obraFilter !== "todas" && rateioData !== null ? (
                <>
                  <p className="text-xs text-muted-foreground italic">
                    Valores rateados proporcionalmente aos dias na obra
                  </p>
                  {rateioData.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Proventos (rateado)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(
                                rateioData.reduce(
                                  (s: number, r: any) => s + (r.provento_total || 0),
                                  0,
                                ),
                              )}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Descontos (rateado)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-bold text-destructive">
                              {formatCurrency(
                                rateioData.reduce(
                                  (s: number, r: any) => s + (r.desconto_total || 0),
                                  0,
                                ),
                              )}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Líquido (rateado)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-bold">
                              {formatCurrency(
                                rateioData.reduce(
                                  (s: number, r: any) => s + (r.provento_total || 0),
                                  0,
                                ) -
                                  rateioData.reduce(
                                    (s: number, r: any) => s + (r.desconto_total || 0),
                                    0,
                                  ),
                              )}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead className="text-right">Proventos</TableHead>
                            <TableHead className="text-right">Descontos</TableHead>
                            <TableHead className="text-right">Líquido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rateioData.map((r: any) => (
                            <TableRow key={r.competencia}>
                              <TableCell className="text-xs">{r.competencia}</TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(r.provento_total || 0)}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(r.desconto_total || 0)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium">
                                {formatCurrency((r.provento_total || 0) - (r.desconto_total || 0))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Sem dados de rateio para esta obra.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Proventos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(fopagProventos)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Descontos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg font-bold text-destructive">
                          {formatCurrency(fopagDescontos)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Líquido</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg font-bold">
                          {formatCurrency(fopagProventos - fopagDescontos)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {filteredFopag.filter((e: any) => e.tipo === "provento").length > 0 && (
                    <>
                      <h4 className="text-sm font-semibold mt-2">Proventos</h4>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Evento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFopag
                            .filter((e: any) => e.tipo === "provento")
                            .map((e: any) => (
                              <TableRow key={e.id}>
                                <TableCell className="text-xs">{e.evento}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {e.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {formatCurrency(Number(e.valor || 0))}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      </div>
                    </>
                  )}

                  {filteredFopag.filter((e: any) => e.tipo === "desconto").length > 0 && (
                    <>
                      <h4 className="text-sm font-semibold mt-2">Descontos</h4>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Evento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFopag
                            .filter((e: any) => e.tipo === "desconto")
                            .map((e: any) => (
                              <TableRow key={e.id}>
                                <TableCell className="text-xs">{e.evento}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {e.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {formatCurrency(Number(e.valor || 0))}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      </div>
                    </>
                  )}

                  {filteredFopag.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum evento na folha.
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            {/* ===== PROVISÕES ===== */}
            <TabsContent value="provisoes" className="space-y-4 mt-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Categoria:</span>
                <Select value={provCategoriaFilter} onValueChange={setProvCategoriaFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provCategorias.map((cat: string) => (
                      <SelectItem key={cat} value={cat}>
                        {cat === "todas" ? "Todas" : catLabels[cat] || cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProvisoes.map((p: any) => {
                    const cat = p.tipo || p.categoria || "outro";
                    const comp = (p.data_competencia || p.competencia || "").slice(0, 7);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{comp}</TableCell>
                        <TableCell className="text-xs">{catLabels[cat] || cat}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.status || "prevista"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {formatCurrency(Number(p.valor || 0))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProvisoes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">
                        Nenhuma provisão.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDPDialog;
