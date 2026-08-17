import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { obrasRepo } from "@/lib/repositories/obras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { parseObrasCsv, type ParseObrasResult } from "@/lib/obras/parseObrasCsv";
import { ImportValidationReport } from "@/components/migracao/ImportValidationReport";

interface RpcResult {
  codigo: string;
  acao: "criada" | "atualizada";
  obra_id: string;
}

export default function ImportarObras() {
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParseObrasResult | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<RpcResult[] | null>(null);

  const onFile = async (file: File) => {
    const txt = await file.text();
    setRaw(txt);
    setParsed(parseObrasCsv(txt));
    setResultado(null);
  };

  const analisar = () => {
    setResultado(null);
    setParsed(parseObrasCsv(raw));
  };

  const executar = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImportando(true);
    try {
      const data = (await obrasRepo.upsertLote(parsed.rows)) as RpcResult[];
      setResultado(data ?? []);
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["obras-min"] });
      toast.success(`Importação concluída: ${(data ?? []).length} obras processadas`);
    } catch (err) {
      toast.error("Falha na importação", { description: (err as Error).message });
    } finally {
      setImportando(false);
    }
  };

  const criadas = useMemo(
    () => (resultado ?? []).filter((r) => r.acao === "criada").length,
    [resultado],
  );
  const atualizadas = useMemo(
    () => (resultado ?? []).filter((r) => r.acao === "atualizada").length,
    [resultado],
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6" />
        <h1 className="font-display text-2xl font-bold">Importar obras (CSV)</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Cole o CSV exportado do sistema legado ou faça upload. Operação <strong>idempotente</strong>
        : obras com mesmo <code>codigo</code> são atualizadas. Clientes faltantes são criados
        automaticamente a partir do nome.
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Button type="button" variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" /> Selecionar CSV
              </span>
            </Button>
          </label>
          <span className="text-xs text-muted-foreground">ou cole abaixo</span>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="font-mono text-xs h-40"
          placeholder="codigo,nome,cliente,status,ativa,valor_contrato,data_inicio,..."
        />
        {raw.trim() && (
          <Button size="sm" variant="secondary" onClick={analisar}>
            Analisar CSV
          </Button>
        )}
      </div>

      {parsed && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="font-medium">{parsed.rows.length} obras válidas</div>
          {parsed.erros.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-destructive">
                {parsed.erros.length} linha(s) com erro
              </summary>
              <ul className="list-disc pl-5 text-xs mt-1">
                {parsed.erros.slice(0, 30).map((e, i) => (
                  <li key={i}>
                    linha {e.linha}: {e.mensagem}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {parsed && parsed.rows.length > 0 && !resultado && (
        <Button onClick={executar} disabled={importando}>
          {importando ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…
            </>
          ) : (
            `Importar ${parsed.rows.length} obras`
          )}
        </Button>
      )}

      {resultado && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
          <div className="font-medium">Resultado</div>
          <div className="flex gap-2">
            <Badge variant="default">{criadas} criadas</Badge>
            <Badge variant="secondary">{atualizadas} atualizadas</Badge>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer">Detalhes ({resultado.length})</summary>
            <ul className="list-disc pl-5 text-xs mt-1">
              {resultado.map((r) => (
                <li key={r.obra_id}>
                  {r.codigo} → {r.acao}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {resultado && parsed && (
        <ImportValidationReport
          data={{
            sistema: "obras_csv",
            obraId: null,
            contagemOrigem: parsed.rows.length,
            contagemDestino: resultado.length,
            divergencias: parsed.erros.map((e) => ({
              campo: "linha",
              origem: String(e.linha),
              destino: "—",
              nota: e.mensagem,
            })),
            amostra: parsed.rows.slice(0, 10),
          }}
        />
      )}
    </div>
  );
}
