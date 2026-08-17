import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { obrasRepo } from "@/lib/repositories/obras";
import { itensMedicaoRepo, medicoesRepo } from "@/lib/repositories/medicoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDataLocal } from "@/lib/core/date";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseBmsWorkbook, type BmsWorkbook, type BmsSheet } from "@/lib/bms/excel";
import { bmsCoverage } from "@/lib/bms/coverage";
import { CHAVES_COL_MAP, detalharDiffPerfis, perfilAPartirDeDiagnostico, type ChaveColMap, type BmsLayoutImportItem } from "@/lib/bms/layoutPerfis";
import { useBmsLayoutPerfis } from "@/hooks/obras/useBmsLayoutPerfis";
import { brl } from "@/lib/billing";

type ImportResult = { numero: string; status: "ok" | "erro"; mensagem?: string };

export function BmsImporter({ obraIdFixo }: { obraIdFixo: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const perfilImportRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [workbook, setWorkbook] = useState<BmsWorkbook | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<ImportResult[] | null>(null);
  const [previewSheet, setPreviewSheet] = useState<string | null>(null);
  const {
    perfis,
    criar: criarPerfilLayout,
    remover: removerPerfilLayout,
    atualizar: atualizarPerfilLayout,
    exportarJson: exportarPerfisLayoutJson,
    analisarImportacao: analisarImportacaoPerfis,
    aplicarImportacao: aplicarImportacaoPerfis,
  } = useBmsLayoutPerfis();
  const [editandoPerfilId, setEditandoPerfilId] = useState<string | null>(null);
  const [previewImport, setPreviewImport] = useState<BmsLayoutImportItem[] | null>(null);
  const [decisoesImport, setDecisoesImport] = useState<Record<string, "importar" | "preservar" | "mesclar">>({});
  const [camposMesclar, setCamposMesclar] = useState<Record<string, string[]>>({});

  const { data: medicoesExistentes } = useQuery({
    queryKey: ["medicoes-numeros", obraIdFixo],
    queryFn: async () => await medicoesRepo.listNumerosByObra(obraIdFixo),
  });

  const { data: obraInfo } = useQuery({
    queryKey: ["obra-contrato-info", obraIdFixo],
    queryFn: () => obrasRepo.getPedidoValorContrato(obraIdFixo),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsing(true);
    setResultado(null);
    try {
      const wb = await parseBmsWorkbook(f, { perfisLayout: perfis });
      if (!wb.sheets.length) {
        toast.error("Nenhuma planilha BMS reconhecida no arquivo.");
        setWorkbook(null);
      } else {
        setWorkbook(wb);
        const novas = new Set<string>();
        for (const s of wb.sheets) {
          if (!medicoesExistentes?.has(s.numero)) novas.add(s.numero);
        }
        setSelecionadas(novas);
        setPreviewSheet(wb.sheets[0]?.numero ?? null);
        const porPerfil = wb.sheets.filter((s) => s.perfil_layout_id).length;
        toast.success(
          `${wb.sheets.length} BMS reconhecido(s) no arquivo${porPerfil ? ` (${porPerfil} por perfil)` : ""}.`,
        );
      }
    } catch (err: any) {
      toast.error(`Falha ao ler planilha: ${err.message ?? err}`);
    } finally {
      setParsing(false);
    }
  }

  function toggle(num: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(num)) n.delete(num);
      else n.add(num);
      return n;
    });
  }

  async function importar() {
    if (!workbook) return;
    const alvos = workbook.sheets.filter((s) => selecionadas.has(s.numero));
    if (!alvos.length) return toast.error("Selecione ao menos um BMS para importar.");
    setImporting(true);
    const out: ImportResult[] = [];
    try {
      for (const s of alvos) {
        try {
          const dataCorte = s.data_fim || s.data || new Date().toISOString().slice(0, 10);
          const pctMedio = s.itens.length
            ? s.itens.reduce((a, i) => a + i.percentual_atual, 0) / s.itens.length
            : 0;

          // upsert por (obra_id, numero): se já existe, recria itens
          let medicaoId = await medicoesRepo.getIdByObraNumero(obraIdFixo, s.numero);
          if (medicaoId) {
            await medicoesRepo.update(medicaoId, {
              data_corte: dataCorte,
              data_inicio: s.data_inicio ?? null,
              valor: s.total_medicao,
              percentual: Number(pctMedio.toFixed(4)),
              arquivo_origem: workbook.arquivoNome,
              sheet_origem: s.sheetName,
            });
            await itensMedicaoRepo.removeByMedicao(medicaoId);
          } else {
            medicaoId = await medicoesRepo.createReturningId({
              obra_id: obraIdFixo,
              numero: s.numero,
              data_corte: dataCorte,
              data_inicio: s.data_inicio ?? null,
              valor: s.total_medicao,
              percentual: Number(pctMedio.toFixed(4)),
              status: "rascunho" as const,
              arquivo_origem: workbook.arquivoNome,
              sheet_origem: s.sheetName,
            });
          }

          const itens = s.itens.map((i) => ({
            medicao_id: medicaoId!,
            bms_item_codigo: i.codigo || null,
            bms_descricao: i.descricao,
            percentual_anterior: Math.min(100, Math.max(0, i.percentual_anterior)),
            percentual_atual: Math.min(100, Math.max(0, i.percentual_atual)),
            valor_anterior: i.valor_anterior,
            valor_atual: i.valor_mes,
          }));
          if (itens.length) {
            await itensMedicaoRepo.insertMany(itens);
          }
          out.push({ numero: s.numero, status: "ok" });
        } catch (err: any) {
          out.push({ numero: s.numero, status: "erro", mensagem: err.message ?? String(err) });
        }
      }
      setResultado(out);
      const ok = out.filter((r) => r.status === "ok").length;
      const erro = out.length - ok;
      if (erro === 0) toast.success(`${ok} BMS importado(s) com sucesso.`);
      else toast.warning(`${ok} importado(s), ${erro} com erro.`);
      qc.invalidateQueries({ queryKey: ["medicoes", obraIdFixo] });
      qc.invalidateQueries({ queryKey: ["medicoes-numeros", obraIdFixo] });
      qc.invalidateQueries({ queryKey: ["bms_prev", obraIdFixo] });
      setWorkbook(null);
      setSelecionadas(new Set());
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setImporting(false);
    }
  }

  const preview: BmsSheet | null = useMemo(
    () => workbook?.sheets.find((s) => s.numero === previewSheet) ?? null,
    [workbook, previewSheet],
  );

  function baixarPerfisLayout() {
    if (!perfis.length) return toast.error("Nenhum perfil de layout salvo para exportar.");
    const blob = new Blob([exportarPerfisLayoutJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestaobra-bms-layout-perfis-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Perfis de layout exportados.");
  }

  async function onImportarPerfisLayout(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const itens = analisarImportacaoPerfis(await f.text());
      if (itens.length === 0) {
        toast.info("Nenhum perfil encontrado no arquivo.");
        return;
      }
      setPreviewImport(itens);
      setDecisoesImport(
        Object.fromEntries(itens.map((i) => [i.perfil.id, i.sugestao])),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar perfis.");
    } finally {
      e.target.value = "";
    }
  }

  function confirmarImportacaoPerfis() {
    if (!previewImport) return;
    const decisoes = previewImport.map((i) => {
      const acao = decisoesImport[i.perfil.id] ?? i.sugestao;
      if (acao === "mesclar") {
        return {
          perfil: i.perfil,
          acao: "mesclar" as const,
          campos: (camposMesclar[i.perfil.id] ?? []) as any,
        };
      }
      return { perfil: i.perfil, acao };
    });
    const r = aplicarImportacaoPerfis(decisoes);
    toast.success(
      `Perfis: ${r.importados} novo(s) · ${r.atualizados} atualizado(s) · ${r.preservados} preservado(s).`,
    );
    setPreviewImport(null);
    setDecisoesImport({});
    setCamposMesclar({});
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importação de Boletins de Medição (BMS)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione a planilha .xlsx contendo as abas <strong>BMS 01, BMS 02 …</strong>. O sistema
            reconhece os boletins e permite importar todos ou apenas os novos. Cada aba vira uma{" "}
            <strong>Medição</strong> com seus itens.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Arquivo .xlsx de BMS</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFile}
                disabled={parsing || importing}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={importar}
                disabled={!workbook || importing || selecionadas.size === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar selecionados ({selecionadas.size})
                  </>
                )}
              </Button>
            </div>
          </div>
          {parsing && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha…
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <span className="font-medium">Perfis de layout BMS:</span>
            <Badge variant="outline">{perfis.length} salvo(s)</Badge>
            <input
              ref={perfilImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportarPerfisLayout}
            />
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 px-2"
              onClick={() => perfilImportRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Importar JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={baixarPerfisLayout}
              disabled={perfis.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {workbook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">BMS encontrados no arquivo</CardTitle>
            <p className="text-xs text-muted-foreground">{workbook.arquivoNome}</p>
            {workbook.sheets[0] && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                {workbook.sheets[0].cliente_unidade && (
                  <div>
                    <span className="font-medium">Cliente:</span>{" "}
                    {workbook.sheets[0].cliente_unidade}
                  </div>
                )}
                {workbook.sheets[0].contratada && (
                  <div>
                    <span className="font-medium">Contratada:</span> {workbook.sheets[0].contratada}
                  </div>
                )}
                {workbook.sheets[0].nome_projeto && (
                  <div>
                    <span className="font-medium">Projeto:</span> {workbook.sheets[0].nome_projeto}
                  </div>
                )}
                {workbook.sheets[0].contrato_numero && (
                  <div>
                    <span className="font-medium">Contrato:</span>{" "}
                    {workbook.sheets[0].contrato_numero}
                    {obraInfo?.pedido_contrato &&
                      String(obraInfo.pedido_contrato).replace(/\D/g, "") !==
                        String(workbook.sheets[0].contrato_numero).replace(/\D/g, "") && (
                        <Badge variant="destructive" className="ml-1">
                          ≠ obra ({obraInfo.pedido_contrato})
                        </Badge>
                      )}
                  </div>
                )}
                {workbook.sheets[0].cond_pagamento && (
                  <div>
                    <span className="font-medium">Cond. Pagto:</span>{" "}
                    {workbook.sheets[0].cond_pagamento}
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {(() => {
              const cov = bmsCoverage(workbook);
              const pct = Math.round(cov.coverageMedio * 100);
              const tone =
                pct >= 90 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive";
              return (
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                  <Badge variant="outline">
                    {cov.abasReconhecidas} reconhecida(s) · {cov.abasIgnoradas} ignorada(s)
                  </Badge>
                  {workbook.sheets.some((s) => s.perfil_layout_id) && (
                    <Badge variant="secondary">
                      {workbook.sheets.filter((s) => s.perfil_layout_id).length} por perfil
                    </Badge>
                  )}
                  <span className={`font-medium ${tone}`}>Cobertura média: {pct}%</span>
                  <span className="text-muted-foreground">
                    {cov.itensTotais} itens · total mês {brl(cov.valorTotalMes)}
                  </span>
                </div>
              );
            })()}
            {perfis.length > 0 && (
              <div className="mb-3 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                <div className="font-medium mb-1">Perfis de layout salvos</div>
                <ul className="space-y-2">
                  {perfis.map((p) => (
                    <li key={p.id} className="rounded border bg-background/60 px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        {p.cliente && (
                          <span className="text-muted-foreground">· {p.cliente}</span>
                        )}
                        <span className="text-muted-foreground">
                          · L{p.headerRow} · {Object.keys(p.colunas).length} colunas · v{p.versao ?? 1}
                        </span>
                        {(p.versao ?? 1) > 1 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            alterado {fmtDataLocal(p.atualizadoEm)}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-6 px-2"
                          onClick={() =>
                            setEditandoPerfilId(editandoPerfilId === p.id ? null : p.id)
                          }
                        >
                          {editandoPerfilId === p.id ? "Fechar" : "Editar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-destructive"
                          onClick={() => removerPerfilLayout(p.id)}
                        >
                          Remover
                        </Button>
                      </div>
                      {editandoPerfilId === p.id && (
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Nome</Label>
                              <Input
                                className="h-7 text-xs"
                                defaultValue={p.nome}
                                onBlur={(e) => {
                                  const v = e.target.value;
                                  if (v && v !== p.nome) {
                                    try {
                                      atualizarPerfilLayout(p.id, { nome: v });
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : String(err));
                                    }
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Cliente</Label>
                              <Input
                                className="h-7 text-xs"
                                defaultValue={p.cliente ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value;
                                  if (v !== (p.cliente ?? "")) {
                                    try {
                                      atualizarPerfilLayout(p.id, { cliente: v });
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : String(err));
                                    }
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Linha do cabeçalho</Label>
                              <Input
                                type="number"
                                min={0}
                                className="h-7 text-xs"
                                defaultValue={p.headerRow}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isFinite(v) && v !== p.headerRow) {
                                    try {
                                      atualizarPerfilLayout(p.id, { headerRow: v });
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : String(err));
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                          {CHAVES_COL_MAP.map((k) => (
                            <div key={k}>
                              <Label className="text-[10px] uppercase">{k}</Label>
                              <Input
                                type="number"
                                min={0}
                                className="h-7 text-xs"
                                defaultValue={p.colunas[k]}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isFinite(v) && v !== p.colunas[k]) {
                                    try {
                                      atualizarPerfilLayout(p.id, {
                                        colunas: { [k as ChaveColMap]: v },
                                      });
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : String(err));
                                    }
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-md border overflow-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>BMS</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Total mês</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workbook.sheets.map((s) => {
                    const existe = medicoesExistentes?.has(s.numero);
                    const sel = selecionadas.has(s.numero);
                    return (
                      <TableRow
                        key={s.numero}
                        className={previewSheet === s.numero ? "bg-muted/40" : "cursor-pointer"}
                        onClick={() => setPreviewSheet(s.numero)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={sel} onCheckedChange={() => toggle(s.numero)} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.numero}
                          {s.perfil_layout_nome && (
                            <div className="text-[10px] font-normal text-muted-foreground">
                              Perfil: {s.perfil_layout_nome}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{s.periodo_raw ?? "—"}</TableCell>
                        <TableCell className="text-xs">{s.data ?? "—"}</TableCell>
                        <TableCell className="text-right">{s.itens.length}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {brl(s.total_medicao)}
                        </TableCell>
                        <TableCell>
                          {existe ? (
                            <Badge variant="secondary">já existe (sobrescreve)</Badge>
                          ) : (
                            <Badge>novo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {workbook.ignoradas.length > 0 && (
              <div className="mt-3 text-xs">
                <div className="font-medium text-warning mb-1">
                  {workbook.ignoradas.length} aba(s) ignorada(s):
                </div>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                  {workbook.ignoradas.map((i) => (
                    <li key={i.sheetName}>
                      <strong>{i.sheetName}</strong> — {i.motivo}
                      {i.amostraLinhas && i.amostraLinhas.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-primary">
                            Ver amostra da planilha
                          </summary>
                          <pre className="mt-1 p-2 bg-muted/40 rounded text-[10px] leading-tight whitespace-pre-wrap break-all">
                            {i.amostraLinhas.join("\n")}
                          </pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pré-visualização — {preview.numero}
              {preview.valor_contrato ? (
                <span className="text-xs text-muted-foreground ml-2">
                  Contrato: {brl(preview.valor_contrato)}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Item</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-right">% ant.</TableHead>
                  <TableHead className="text-right">% atual</TableHead>
                  <TableHead className="text-right">Valor mês</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.itens.map((i, idx) => (
                  <TableRow key={`${i.codigo}-${idx}`}>
                    <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                    <TableCell className="text-sm">{i.descricao}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(i.valor_total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.percentual_anterior.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.percentual_atual.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(i.valor_mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(i.valor_acumulado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.diagnostico && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-primary">
                  Diagnóstico do parser (colunas reconhecidas)
                </summary>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <div>
                    <span className="font-medium">Linha do cabeçalho:</span>{" "}
                    L{preview.diagnostico.headerRow}
                  </div>
                  <div>
                    <span className="font-medium">Colunas mapeadas:</span>{" "}
                    <code className="text-[10px]">
                      {Object.entries(preview.diagnostico.colunas)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Rótulos:</span>{" "}
                    <code className="text-[10px]">
                      {preview.diagnostico.rotulosCabecalho.filter(Boolean).join(" | ")}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Sub-rótulos:</span>{" "}
                    <code className="text-[10px]">
                      {preview.diagnostico.rotulosSubcabecalho.filter(Boolean).join(" | ")}
                    </code>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    try {
                      const nome = window.prompt(
                        "Nome do perfil de layout",
                        preview.cliente_unidade
                          ? `${preview.cliente_unidade} — ${preview.numero}`
                          : preview.numero,
                      );
                      if (!nome) return;
                      const input = perfilAPartirDeDiagnostico(
                        preview.diagnostico!,
                        nome,
                        preview.cliente_unidade,
                      );
                      criarPerfilLayout(input);
                      toast.success("Perfil de layout salvo.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Falha ao salvar perfil");
                    }
                  }}
                >
                  Salvar como perfil
                </Button>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Resultado da importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {resultado.map((r) => (
                <li
                  key={r.numero}
                  className={r.status === "ok" ? "text-success" : "text-destructive"}
                >
                  <strong>{r.numero}</strong> —{" "}
                  {r.status === "ok" ? "importado" : `erro: ${r.mensagem}`}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={previewImport !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewImport(null);
            setDecisoesImport({});
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview de importação de perfis</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {previewImport?.map((i) => {
              const acao = decisoesImport[i.perfil.id] ?? i.sugestao;
              return (
                <div key={i.perfil.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{i.perfil.nome}</span>
                    <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                    {i.status === "conflito" && (
                      <span className="text-muted-foreground text-xs">
                        {i.diff.length} campo(s) divergentes
                      </span>
                    )}
                    {i.status !== "identico" && (
                      <div className="ml-auto flex gap-1">
                        <Button
                          size="sm"
                          variant={acao === "importar" ? "default" : "outline"}
                          className="h-6 px-2"
                          onClick={() =>
                            setDecisoesImport((d) => ({ ...d, [i.perfil.id]: "importar" }))
                          }
                        >
                          Importar
                        </Button>
                        <Button
                          size="sm"
                          variant={acao === "preservar" ? "default" : "outline"}
                          className="h-6 px-2"
                          onClick={() =>
                            setDecisoesImport((d) => ({ ...d, [i.perfil.id]: "preservar" }))
                          }
                        >
                          Preservar
                        </Button>
                        {i.status === "conflito" && (
                          <Button
                            size="sm"
                            variant={acao === "mesclar" ? "default" : "outline"}
                            className="h-6 px-2"
                            onClick={() =>
                              setDecisoesImport((d) => ({ ...d, [i.perfil.id]: "mesclar" }))
                            }
                          >
                            Mesclar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {i.status === "conflito" && i.atual && (
                    <div className="mt-2">
                      <div className="w-full overflow-x-auto"><table className="w-full text-xs border-collapse">
                        <thead className="text-muted-foreground">
                          <tr>
                            {acao === "mesclar" && <th className="w-6"></th>}
                            <th className="text-left font-normal py-0.5">Campo</th>
                            <th className="text-left font-normal py-0.5">Atual</th>
                            <th className="text-left font-normal py-0.5">Importado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalharDiffPerfis(i.atual, i.perfil).map((l) => {
                            const marcados = camposMesclar[i.perfil.id] ?? [];
                            const checked = marcados.includes(l.campo);
                            return (
                              <tr key={l.campo} className="border-t">
                                {acao === "mesclar" && (
                                  <td className="py-0.5">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) =>
                                        setCamposMesclar((s) => {
                                          const atuais = s[i.perfil.id] ?? [];
                                          const proximo = v
                                            ? Array.from(new Set([...atuais, l.campo]))
                                            : atuais.filter((c) => c !== l.campo);
                                          return { ...s, [i.perfil.id]: proximo };
                                        })
                                      }
                                    />
                                  </td>
                                )}
                                <td className="py-0.5 pr-2 font-mono">{l.campo}</td>
                                <td className="py-0.5 pr-2 text-destructive">{l.atual || "—"}</td>
                                <td className="py-0.5 text-success">{l.importado || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewImport(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarImportacaoPerfis}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
