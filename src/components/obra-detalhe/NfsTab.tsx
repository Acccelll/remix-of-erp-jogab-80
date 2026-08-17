import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Loader2, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { faturamentoRpc, notasFiscaisRepo } from "@/lib/repositories/medicoes";
import { nfsStorage } from "@/lib/repositories/storage";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { brl, calcularVencimento } from "@/lib/billing";

import { ImportNfseXmlDialog } from "@/components/financeiro/ImportNfseXmlDialog";
import { TaxCalculator, calcTaxes } from "@/components/obra/TaxCalculator";
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";
import { swallow } from "@/lib/core/errors";
import {
  emitirNumeroCustomizado,
  previewNumeroCustomizado,
} from "@/lib/empresa/numeracao-documentos";

export function NfsTab({
  obra,
  nfs,
  medicoes,
  bmsPrev,
  onChange,
}: {
  obra: any;
  nfs: any[];
  medicoes: any[];
  bmsPrev: any[];
  onChange: () => void;
}) {
  const { canEdit } = useObraPermissions();
  const { currentPlayer } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // NFS-e importadas pelo módulo Faturamento e vinculadas a esta obra.
  const codigosObra = useMemo(
    () =>
      [obra?.codigo, obra?.codigo_totvs, String(obra?.nome ?? "").match(/^\s*(\d{2,5})/)?.[1]]
        .map((c: any) => (c == null ? "" : String(c).trim()))
        .filter(Boolean),
    [obra?.codigo, obra?.codigo_totvs, obra?.nome],
  );
  const { data: nfsImportadasRaw = [] } = useQuery({
    queryKey: ["faturamento_nfse_obra", obra.id, codigosObra.join("|")],
    queryFn: async () => {
      return await notasFiscaisRepo.listFaturamentoImportadasByObra(obra.id, codigosObra);
    },
  });
  // Evita duplicar quando a NF já está registrada em notas_fiscais (match por número).
  const nfsNumeros = useMemo(
    () => new Set((nfs ?? []).map((n: any) => String(n.numero ?? "").trim()).filter(Boolean)),
    [nfs],
  );
  const nfsImportadas = useMemo(
    () => (nfsImportadasRaw as any[]).filter((n) => !nfsNumeros.has(String(n.numero_nfse).trim())),
    [nfsImportadasRaw, nfsNumeros],
  );
  // Faturamento da obra = NFs próprias + NFS-e importadas do módulo Faturamento.
  const totalFaturado = useMemo(() => {
    const bruto =
      (nfs ?? []).reduce((a: number, n: any) => a + Number(n.valor || 0), 0) +
      nfsImportadas.reduce((a: number, n: any) => a + Number(n.valor_servicos || 0), 0);
    const liquido =
      (nfs ?? []).reduce((a: number, n: any) => a + Number(n.valor_liquido ?? n.valor ?? 0), 0) +
      nfsImportadas.reduce(
        (a: number, n: any) => a + Number(n.valor_liquido ?? n.valor_servicos ?? 0),
        0,
      );
    return { bruto, liquido };
  }, [nfs, nfsImportadas]);

  const [excluindo, setExcluindo] = useState<any | null>(null);
  const [excluindoBusy, setExcluindoBusy] = useState(false);
  const busy = extracting || saving;

  const empresaId = typeof obra?.empresa_id === "string" ? obra.empresa_id : null;
  const previewNumeroNf = useMemo(
    () => (open && !editingId ? previewNumeroCustomizado(empresaId, "nota_fiscal") : null),
    [empresaId, open, editingId],
  );
  const usarNumeracaoNfParametrizada = !editingId && !!previewNumeroNf;

  const bmsDisponiveis = useMemo(
    () =>
      (bmsPrev ?? [])
        .filter(
          (b: any) =>
            (!b.nota_fiscal_id && b.status !== "faturada") ||
            (editingId && b.nota_fiscal_id === editingId),
        )
        .sort((a: any, b: any) => Number(a.numero) - Number(b.numero)),
    [bmsPrev, editingId],
  );

  function sugerirBms(extracted: any) {
    const emi = extracted.data_emissao ? parseISO(extracted.data_emissao) : null;
    const valor = Number(extracted.valor || 0);
    let melhor: any = null;
    let melhorScore = Infinity;
    for (const b of bmsDisponiveis) {
      const dataPrev = b.data_emissao_nfs_prevista ? parseISO(b.data_emissao_nfs_prevista) : null;
      const dias =
        emi && dataPrev ? Math.abs((emi.getTime() - dataPrev.getTime()) / 86400000) : 999;
      const valorPrev = Number(b.valor_previsto_dinamico ?? b.valor_previsto_inicial ?? 0);
      const diffPct =
        valor > 0 && valorPrev > 0 ? Math.abs(valorPrev - valor) / Math.max(valorPrev, valor) : 1;
      const score = dias + diffPct * 30;
      if (score < melhorScore) {
        melhorScore = score;
        melhor = b;
      }
    }
    return melhor;
  }

  async function importarArquivo(file: File) {
    setExtracting(true);
    try {
      const { parseNfseFile } = await import("@/lib/faturamento/nfse-parser");
      const e = await parseNfseFile(file);
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isXml = file.name.toLowerCase().endsWith(".xml");
      const patch: any = { pdf: isPdf ? file : f.pdf, xml: isXml ? file : f.xml };
      const fieldMap: Array<[string, any]> = [
        ["numero", e.numero],
        ["data_emissao", e.data_emissao],
        ["competencia", e.competencia],
        ["valor", e.valor],
        ["codigo_cno", e.codigo_cno],
        ["codigo_art", e.codigo_art],
        ["codigo_verificacao", e.codigo_verificacao],
        ["percentual_material", e.percentual_material],
        ["aliquota_iss", e.aliquota_iss],
        ["aliquota_inss", e.aliquota_inss],
      ];
      const filled = new Set<string>();
      for (const [k, v] of fieldMap) {
        if (v !== undefined && v !== null && v !== "") {
          patch[k] = v;
          filled.add(k);
        }
      }
      const bms = sugerirBms(e);
      if (bms && !f.bms_prevista_id) {
        patch.bms_prevista_id = bms.id;
        filled.add("bms_prevista_id");
      }
      setF({ ...f, ...patch });
      setExtractedFields(filled);
      toast.success(
        `${e._source.toUpperCase()} processado · ${filled.size} campo(s) preenchido(s)`,
      );
    } catch (err: any) {
      toast.error(`Falha ao ler arquivo: ${err.message ?? err}`);
    } finally {
      setExtracting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await saveInner();
    } finally {
      setSaving(false);
    }
  }

  async function saveInner() {
    const dataEmissao = f.data_emissao ? parseISO(f.data_emissao) : new Date();
    const venc = calcularVencimento(
      dataEmissao,
      Number(obra.prazo_pagamento_dias || 0),
      Array.isArray(obra.dias_fixos_pagamento) ? obra.dias_fixos_pagamento : [],
    );
    const valor = Number(f.valor || 0);

    const cfg = {
      percentual_material: Number(f.percentual_material ?? obra.percentual_material ?? 70),
      aliquota_iss: Number(f.aliquota_iss ?? obra.aliquota_iss ?? 5),
      aliquota_inss: Number(f.aliquota_inss ?? obra.aliquota_inss ?? 11),
      aliquota_cbs: Number(f.aliquota_cbs ?? obra.aliquota_cbs ?? 0),
      aliquota_ibs: Number(f.aliquota_ibs ?? obra.aliquota_ibs ?? 0),
      outras_retencoes: Number(f.outras_retencoes ?? 0),
    };
    const t = calcTaxes(valor, cfg);

    const bmsSelecionada = f.bms_prevista_id
      ? bmsPrev.find((b: any) => b.id === f.bms_prevista_id)
      : null;
    const medicaoIdFinal = f.medicao_id || bmsSelecionada?.medicao_id || null;

    let pdf_url: string | null = null;
    const arquivos: File[] = [];
    if (f.pdf instanceof File) arquivos.push(f.pdf);
    if (f.xml instanceof File) arquivos.push(f.xml);

    if (arquivos.length) {
      // TODO(auth): rever ao decidir Supabase Auth + RLS — usamos a identidade
      // do AppContext para compor o caminho do upload (mesmo padrão de FinObras).
      const uid = currentPlayer?.id ?? "anon";
      for (const arq of arquivos) {
        const path = `${uid}/${obra.id}/${Date.now()}-${arq.name}`;
        const { error: upErr } = await nfsStorage.upload(path, arq, { upsert: false });
        if (upErr) return toast.error(`Upload ${arq.name}: ${upErr.message}`);
        if (arq.name.toLowerCase().endsWith(".pdf") && !pdf_url) pdf_url = path;
      }
    }

    let numeroFinal = (f.numero ?? "").toString().trim() || null;
    let rollbackNumero: (() => void) | undefined;
    if (usarNumeracaoNfParametrizada && !numeroFinal) {
      const emitido = emitirNumeroCustomizado(empresaId, "nota_fiscal");
      if (emitido) {
        numeroFinal = emitido.numero;
        rollbackNumero = emitido.rollback;
      }
    }

    const payload: any = {
      obra_id: obra.id,
      medicao_id: medicaoIdFinal,
      numero: numeroFinal,
      data_emissao: f.data_emissao || null,
      competencia: f.competencia || f.data_emissao || null,
      valor,
      valor_servicos: t.valor_servico,
      valor_material: t.valor_material,
      percentual_material: cfg.percentual_material,
      inss_retido: t.retencao_inss,
      iss_retido: t.retencao_iss,
      retencao_cbs: t.retencao_cbs,
      retencao_ibs: t.retencao_ibs,
      outras_retencoes: t.outras_retencoes,
      valor_liquido: t.valor_liquido,
      codigo_cno: f.codigo_cno || null,
      codigo_art: f.codigo_art || null,
      codigo_verificacao: f.codigo_verificacao || null,
      data_vencimento: venc.toISOString().slice(0, 10),
    };
    if (pdf_url) payload.pdf_url = pdf_url;

    // H1.3 — salvamento atômico no banco (NF + recebimento + vínculo BMS + recálculo).
    const { data: result, error } = await faturamentoRpc.salvarNfAtomica({
      p_nf_id: editingId ?? null,
      p_payload: payload,
      p_data_prevista: venc.toISOString().slice(0, 10),
      p_valor_liquido: t.valor_liquido,
      p_bms_prevista_id: f.bms_prevista_id ?? null,
      p_medicao_id_fallback: medicaoIdFinal ?? null,
      p_valor_contrato: Number(obra.valor_contrato || 0),
    });

    if (error || !result) {
      rollbackNumero?.();
      return toast.error(error?.message ?? "Erro ao salvar NF");
    }

    toast.success(
      `${editingId ? "NF atualizada" : "NF salva"} · líquido ${brl(t.valor_liquido)} · venc. ${format(venc, "dd/MM/yyyy")}`,
    );
    setOpen(false);
    setF({});
    setExtractedFields(new Set());
    setEditingId(null);
    onChange();
  }

  function abrirEdicao(n: any) {
    const bmsLink = (bmsPrev ?? []).find((b: any) => b.nota_fiscal_id === n.id);
    setEditingId(n.id);
    setExtractedFields(new Set());
    setF({
      numero: n.numero ?? "",
      data_emissao: n.data_emissao ?? "",
      competencia: n.competencia ?? "",
      valor: n.valor ?? "",
      codigo_cno: n.codigo_cno ?? "",
      codigo_art: n.codigo_art ?? "",
      codigo_verificacao: n.codigo_verificacao ?? "",
      percentual_material: n.percentual_material,
      medicao_id: n.medicao_id ?? null,
      bms_prevista_id: bmsLink?.id ?? null,
    });
    setOpen(true);
  }

  async function abrirPdf(path: string) {
    const { data, error } = await nfsStorage.createSignedUrl(path, 60);
    if (error || !data) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  }

  async function excluirNF(n: any) {
    setExcluindoBusy(true);
    try {
      // Tenta apagar PDF do storage (silencioso, fora da transação).
      if (n.pdf_url) {
        try {
          await nfsStorage.remove([n.pdf_url]);
        } catch (err) {
          swallow("NfsTab.removePdf", err, "PDF ausente no storage");
        }
      }
      // H1.3 — exclusão atômica (BMS + recebimento + NF + recálculo).
      const { error } = await faturamentoRpc.excluirNfAtomica({
        p_nf_id: n.id,
        p_valor_contrato: Number(obra.valor_contrato || 0),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("NF excluída");
      setExcluindo(null);
      onChange();
    } finally {
      setExcluindoBusy(false);
    }
  }

  const auto = (k: string) =>
    extractedFields.has(k) ? (
      <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-primary">
        <Sparkles className="h-3 w-3" />
        auto
      </span>
    ) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notas Fiscais</CardTitle>
        <div className="flex items-center gap-2">
          {canEdit && (
            <ImportNfseXmlDialog obraId={obra.id}>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar XML
              </Button>
            </ImportNfseXmlDialog>
          )}
          <Dialog
            open={open}
            onOpenChange={(o) => {
              if (busy) return;
              setOpen(o);
              if (!o) {
                setF({});
                setExtractedFields(new Set());
                setEditingId(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canEdit}>
                <Plus className="h-4 w-4 mr-2" />
                NF
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => {
                if (busy) e.preventDefault();
              }}
              onEscapeKeyDown={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar NF" : "Nova NF"}</DialogTitle>
              </DialogHeader>
              {busy && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {extracting ? "Lendo arquivo…" : "Salvando NF…"}
                  </p>
                </div>
              )}

              <div className="rounded-md border border-dashed bg-muted/40 p-3 mb-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Importar NFS-e (PDF ou XML)
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="file"
                    accept=".pdf,.xml,application/pdf,application/xml,text/xml"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importarArquivo(file);
                    }}
                  />
                  {extracting && <span className="text-xs text-muted-foreground">Extraindo…</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Os campos do formulário serão preenchidos automaticamente. Revise antes de salvar.
                </p>
                <div className="flex gap-3 text-xs mt-2">
                  {f.pdf instanceof File && (
                    <span className="text-muted-foreground">📄 {f.pdf.name}</span>
                  )}
                  {f.xml instanceof File && (
                    <span className="text-muted-foreground">🗎 {f.xml.name}</span>
                  )}
                </div>
              </div>

              <form onSubmit={save} className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Número{auto("numero")}</Label>
                  <Input
                    value={f.numero ?? ""}
                    onChange={(e) => setF({ ...f, numero: e.target.value })}
                    placeholder={
                      usarNumeracaoNfParametrizada ? `Automático: ${previewNumeroNf}` : undefined
                    }
                    disabled={usarNumeracaoNfParametrizada}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data emissão *{auto("data_emissao")}</Label>
                  <DatePickerField
                    required
                    value={f.data_emissao ?? ""}
                    onChange={(v) => setF({ ...f, data_emissao: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Competência{auto("competencia")}</Label>
                  <DatePickerField
                    value={f.competencia ?? ""}
                    onChange={(v) => setF({ ...f, competencia: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor bruto (R$) *{auto("valor")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={f.valor ?? ""}
                    onChange={(e) => setF({ ...f, valor: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label>BMS prevista (vínculo){auto("bms_prevista_id")}</Label>
                  <Select
                    value={f.bms_prevista_id ?? "__none__"}
                    onValueChange={(v) =>
                      setF({ ...f, bms_prevista_id: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— sem vínculo —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— sem vínculo —</SelectItem>
                      {bmsDisponiveis.map((b: any) => {
                        const valorPrev = Number(
                          b.valor_previsto_dinamico ?? b.valor_previsto_inicial ?? 0,
                        );
                        const corte = b.data_corte
                          ? format(parseISO(b.data_corte), "dd/MM/yy")
                          : "—";
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            BMS {b.numero} · corte {corte} · {brl(valorPrev)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    A BMS escolhida será marcada como faturada e ligada a esta NF.
                  </p>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label>Medição (opcional)</Label>
                  <Select
                    value={f.medicao_id ?? "__none__"}
                    onValueChange={(v) => setF({ ...f, medicao_id: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— herdar da BMS —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— herdar da BMS —</SelectItem>
                      {medicoes
                        .filter((m) => m.status === "aprovada")
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.numero} · {brl(m.valor)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Código CNO{auto("codigo_cno")}</Label>
                  <Input
                    value={f.codigo_cno ?? ""}
                    onChange={(e) => setF({ ...f, codigo_cno: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Código ART{auto("codigo_art")}</Label>
                  <Input
                    value={f.codigo_art ?? ""}
                    onChange={(e) => setF({ ...f, codigo_art: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Código de verificação{auto("codigo_verificacao")}</Label>
                  <Input
                    value={f.codigo_verificacao ?? ""}
                    onChange={(e) => setF({ ...f, codigo_verificacao: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <TaxCalculator
                    valor={Number(f.valor || 0)}
                    obra={obra}
                    values={{
                      percentual_material: f.percentual_material,
                      aliquota_iss: f.aliquota_iss,
                      aliquota_inss: f.aliquota_inss,
                      aliquota_cbs: f.aliquota_cbs,
                      aliquota_ibs: f.aliquota_ibs,
                      outras_retencoes: f.outras_retencoes,
                    }}
                    onChange={(v: any) => setF({ ...f, ...v })}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Anexar PDF (manual)</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setF({ ...f, pdf: e.target.files?.[0] ?? null })}
                  />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="submit" disabled={busy}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando…
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfs.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.numero ?? "—"}</TableCell>
                  <TableCell>
                    {n.data_emissao ? format(parseISO(n.data_emissao), "dd/MM/yy") : "—"}
                  </TableCell>
                  <TableCell className="num">{brl(n.valor)}</TableCell>
                  <TableCell className="num">{brl(n.valor_liquido ?? n.valor)}</TableCell>
                  <TableCell>
                    {n.data_vencimento ? format(parseISO(n.data_vencimento), "dd/MM/yy") : "—"}
                  </TableCell>
                  <TableCell>
                    {n.pdf_url ? (
                      <Button size="sm" variant="ghost" onClick={() => abrirPdf(n.pdf_url!)}>
                        Ver
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canEdit}
                      onClick={() => abrirEdicao(n)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canEdit}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setExcluindo(n)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {nfsImportadas.map((n) => (
                <TableRow key={`fat-${n.id}`} className="bg-muted/20">
                  <TableCell>
                    {n.numero_nfse}
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      importada
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {n.data_emissao ? format(parseISO(n.data_emissao), "dd/MM/yy") : "—"}
                  </TableCell>
                  <TableCell className="num">{brl(n.valor_servicos)}</TableCell>
                  <TableCell className="num">{brl(n.valor_liquido ?? n.valor_servicos)}</TableCell>
                  <TableCell>
                    {n.data_vencimento ? format(parseISO(n.data_vencimento), "dd/MM/yy") : "—"}
                  </TableCell>
                  <TableCell>—</TableCell>
                  <TableCell colSpan={2} className="text-xs text-muted-foreground">
                    do módulo Faturamento
                  </TableCell>
                </TableRow>
              ))}
              {nfs.length === 0 && nfsImportadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Sem NFs emitidas
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total faturado</TableCell>
                  <TableCell className="num">{brl(totalFaturado.bruto)}</TableCell>
                  <TableCell className="num">{brl(totalFaturado.liquido)}</TableCell>
                  <TableCell colSpan={4} className="text-xs text-muted-foreground">
                    inclui NFS-e do módulo Faturamento
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog
        open={!!excluindo}
        onOpenChange={(o) => {
          if (!o && !excluindoBusy) setExcluindo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir NF {excluindo?.numero ?? ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a nota fiscal, desvincula a BMS prevista (que voltará para
              "prevista") e exclui o recebimento futuro associado. Recebimentos já confirmados serão
              preservados. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindoBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindoBusy}
              onClick={(e) => {
                e.preventDefault();
                if (excluindo) excluirNF(excluindo);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindoBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo…
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
