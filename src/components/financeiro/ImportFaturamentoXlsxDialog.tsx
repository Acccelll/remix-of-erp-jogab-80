import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { ImportDialogShell } from "@/components/import/ImportDialogShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseFaturamentoXlsx } from "@/lib/faturamento/parse-xlsx";
import { upsertNfse } from "@/lib/faturamento/upsert";
import type { NfseParsed } from "@/lib/faturamento/parse-xml";
import { brl } from "@/lib/billing";

export function ImportFaturamentoXlsxDialog({ children }: { children?: React.ReactNode }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<NfseParsed[] | null>(null);
  const [aba, setAba] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function validar() {
    if (!file) return;
    setParsing(true);
    try {
      const { linhas, aba } = await parseFaturamentoXlsx(file);
      if (!linhas.length) {
        toast.error("Nenhuma NFS-e reconhecida na planilha.");
        setParsed(null);
      } else {
        setParsed(linhas);
        setAba(aba);
        toast.success(`${linhas.length} NFS-e reconhecidas na aba "${aba}".`);
      }
    } catch (e: any) {
      toast.error(`Falha ao ler planilha: ${e.message ?? e}`);
    } finally {
      setParsing(false);
    }
  }

  async function importar() {
    if (!parsed) return;
    setImporting(true);
    try {
      const r = await upsertNfse(parsed, "planilha");
      if (r.erros?.length) {
        toast.warning(`${r.erros.length} linha(s) falharam. Ex.: ${r.erros[0]}`);
      }
      toast.success(
        `${r.novas} novas · ${r.atualizadas} atualizadas · ${r.inalteradas} inalteradas · ${r.vinculadas_obra} vinculadas à obra.`,
      );
      qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });

      setParsed(null);
      setFile(null);
      if (ref.current) ref.current.value = "";
      setOpen(false);
    } catch (e: any) {
      toast.error(`Falha ao importar: ${e.message ?? e}`);
    } finally {
      setImporting(false);
    }
  }

  const total = parsed?.reduce((a, l) => a + (l.valor_servicos || 0), 0) ?? 0;

  return (
    <ImportDialogShell
      open={open}
      onOpenChange={setOpen}
      title="Importar planilha de faturamento (base total)"
      description={
        <>
          Lê a aba <strong>Detalhe Nfse</strong>. Faz upsert por número + código de verificação;
          registros já existentes vindos de XML são preservados.
        </>
      }
      trigger={
        children ?? (
          <Button variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar planilha base
          </Button>
        )
      }
    >
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Arquivo .xlsx</Label>
          <Input
            ref={ref}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setParsed(null);
            }}
          />
        </div>
        <Button variant="outline" onClick={validar} disabled={!file || parsing}>
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
        </Button>
      </div>
      {parsed && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div>
            <strong>{parsed.length}</strong> NFS-e na aba "{aba}".
          </div>
          <div>
            Valor total dos serviços: <strong>{brl(total)}</strong>
          </div>
          <div className="text-xs text-muted-foreground">
            Vinculação automática à obra pelo "|OBRA NNN|" da discriminação ou pela coluna
            "Codigo da Obra".
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={importar} disabled={!parsed || importing}>
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Importar {parsed?.length ?? 0}
            </>
          )}
        </Button>
      </div>
    </ImportDialogShell>
  );
}
