import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileCode, Loader2, Upload } from "lucide-react";
import { ImportDialogShell } from "@/components/import/ImportDialogShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseNfseXmlFull, type NfseParsed } from "@/lib/faturamento/parse-xml";
import { upsertNfse } from "@/lib/faturamento/upsert";

export function ImportNfseXmlDialog({
  children,
  obraId,
}: {
  children?: React.ReactNode;
  obraId?: string;
}) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [parsed, setParsed] = useState<NfseParsed[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function validar() {
    if (!files.length) return;
    setParsing(true);
    try {
      const out: NfseParsed[] = [];
      const erros: string[] = [];
      for (const f of files) {
        try {
          const xml = await f.text();
          const r = parseNfseXmlFull(xml, f.name);
          if (r) out.push(r);
          else erros.push(f.name);
        } catch {
          erros.push(f.name);
        }
      }
      if (!out.length) {
        toast.error("Nenhuma NFS-e reconhecida nos XMLs.");
        setParsed(null);
      } else {
        setParsed(out);
        toast.success(
          `${out.length} NFS-e prontas${erros.length ? ` · ${erros.length} arquivos ignorados` : ""}.`,
        );
      }
    } finally {
      setParsing(false);
    }
  }

  async function importar() {
    if (!parsed) return;
    setImporting(true);
    try {
      const r = await upsertNfse(parsed, "xml", obraId);
      toast.success(
        `${r.novas} novas · ${r.atualizadas} atualizadas · ${r.vinculadas_obra} vinculadas à obra.`,
      );
      qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });
      if (obraId) qc.invalidateQueries({ queryKey: ["faturamento_nfse_obra", obraId] });
      setParsed(null);
      setFiles([]);
      if (ref.current) ref.current.value = "";
      setOpen(false);
    } catch (e: any) {
      toast.error(`Falha ao importar: ${e.message ?? e}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <ImportDialogShell
      open={open}
      onOpenChange={setOpen}
      title="Importar NFS-e individuais (XML)"
      description="Aceita múltiplos arquivos. Upsert por número + código de verificação — não duplica o que já veio da planilha; quando o XML traz dados ausentes (impostos, competência), atualiza o registro existente."
      trigger={
        children ?? (
          <Button>
            <FileCode className="h-4 w-4 mr-2" />
            Importar XML NFS-e
          </Button>
        )
      }
    >
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Arquivos .xml</Label>
          <Input
            ref={ref}
            type="file"
            multiple
            accept=".xml,application/xml,text/xml"
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []));
              setParsed(null);
            }}
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {files.length} arquivo(s) selecionado(s).
            </p>
          )}
        </div>
        <Button variant="outline" onClick={validar} disabled={!files.length || parsing}>
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
        </Button>
      </div>
      {parsed && (
        <div className="rounded-md border p-3 text-sm">
          {parsed.length} NFS-e prontas para importar.
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
