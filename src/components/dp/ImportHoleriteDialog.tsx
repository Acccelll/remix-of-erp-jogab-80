import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ImportDialogShell } from "@/components/import/ImportDialogShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { parseHoleriteXls, maskCPFDisplay } from "@/lib/dp/parser-holerite-xls";
import type { ImportSummary } from "@/lib/repositories/dpHolerite";
import { useImportDpHolerites } from "@/hooks/dp/useDpHolerites";
import { cleanCPF } from "@/lib/utils";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { toast } from "sonner";
import { useDpFechamentoCompetenciaMerged } from "@/hooks/dp/useDpFechamentoCompetenciaRemoto";
import { competenciaValida } from "@/lib/dp/fechamento-competencia";

interface Props {
  trigger?: React.ReactNode;
  onImported?: () => void;
}

export default function ImportHoleriteDialog({ trigger, onImported }: Props) {
  const { colaboradores } = useCatalogos();
  const importHolerites = useImportDpHolerites();
  // Merged: lê a fonte real (MySQL quando autenticado). O hook local sozinho
  // não enxerga fechamentos remotos e deixava a trava de reimport inerte.
  const { ativo } = useDpFechamentoCompetenciaMerged();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setErrors([]);
    setWarnings([]);
    setSummary(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setErrors([]);
    setWarnings([]);
    setSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const result = parseHoleriteXls(buf);
      if (result.errors.length) {
        setErrors(result.errors);
        setBusy(false);
        return;
      }
      setWarnings(result.warnings);

      // PRO-003 · slice-03 — bloqueia reimport em competência fechada.
      const competenciasArquivo = Array.from(
        new Set(result.linhas.map((l) => l.competencia).filter(competenciaValida)),
      );
      const bloqueadas = competenciasArquivo.filter((c) => ativo(c) != null);
      if (bloqueadas.length > 0) {
        const detalhes = bloqueadas
          .map((c) => {
            const a = ativo(c);
            return `${c}${a ? ` (fechada por ${a.fechadoPor} em ${a.fechadoEm.slice(0, 10)})` : ""}`;
          })
          .join(", ");
        setErrors([
          `Importação bloqueada: competência(s) fechada(s): ${detalhes}. Peça a reabertura ao DP antes de reimportar.`,
        ]);
        setBusy(false);
        return;
      }


      // dp_holerite.colaborador_id no MySQL aceita o id do cadastro como
      // texto — vincula direto por CPF, sem o filtro de UUID exigido pela
      // antiga coluna uuid do Supabase.
      const cpfMap = new Map<string, string>();
      colaboradores.forEach((c) => {
        const k = cleanCPF(c.cpf || "");
        if (k.length !== 11) return;
        cpfMap.set(k, String(c.id));
      });

      const sum = await importHolerites.mutateAsync({
        linhas: result.linhas,
        resolveColabId: (cpf) => cpfMap.get(cpf) || null,
      });
      setSummary(sum);
      const tipo = result.linhas[0]?.tipo === "adiantamento" ? "Adiantamento" : "Holerite";
      toast.success(`${tipo} importado`, {
        description: `${sum.inserted} colaborador(es) processado(s).`,
      });
      onImported?.();
    } catch (e: any) {
      const partes = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean);
      console.error("[ImportHolerite] erro:", e);
      setErrors([partes.length ? partes.join(" · ") : String(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImportDialogShell
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
      title="Importar Holerite ou Adiantamento"
      description={
        <>
          Selecione a planilha <strong>"Holerite em Excel"</strong> (folha do dia 5) ou o{" "}
          <strong>"Adiantamento Salarial"</strong> (dia 20), formato .xls / .xlsx. O tipo é
          detectado automaticamente pelas rubricas presentes. Reimportar a mesma competência{" "}
          <strong>sobrescreve</strong> os dados daquele tipo.
        </>
      }
      trigger={
        trigger || (
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Importar planilha
          </Button>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()} className="w-full">
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        {file ? file.name : "Escolher arquivo"}
      </Button>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro na importação</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-sm">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {summary && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Importação concluída</AlertTitle>
          <AlertDescription className="space-y-1">
            <div>{summary.inserted} holerite(s) gravado(s).</div>
            <div>
              Total líquido: <strong>{formatBRLFromNumber(summary.totalLiquido)}</strong>
            </div>
            <div>
              Custo total: <strong>{formatBRLFromNumber(summary.totalCusto)}</strong>
            </div>
            {summary.cpfsNaoCadastrados.length > 0 && (
              <div className="mt-2">
                <div className="font-medium text-warning">
                  {summary.cpfsNaoCadastrados.length} CPF(s) não cadastrado(s):
                </div>
                <ul className="text-xs max-h-32 overflow-y-auto list-disc pl-4">
                  {summary.cpfsNaoCadastrados.map((c) => (
                    <li key={c.cpf}>
                      {maskCPFDisplay(c.cpf)} — {c.nome}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && !summary && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Avisos</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-xs max-h-24 overflow-y-auto">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Fechar
        </Button>
        <Button onClick={handleImport} disabled={!file || busy || importHolerites.isPending}>
          {busy ? "Importando..." : "Importar"}
        </Button>
      </DialogFooter>
    </ImportDialogShell>
  );
}
