import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileCode, Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseNfeXml, validarChaveAcesso, type NfeExtracted } from "@/lib/faturamento/nfe-parser";
import {
  useCriarNotaFiscalEntrada,
  useGerarTituloNotaFiscalEntrada,
} from "@/hooks/suprimentos/useNotasFiscaisEntrada";
import { notasFiscaisEntradaRepo } from "@/lib/repositories/notasFiscaisEntrada";
import { formatBRL } from "@/lib/core/currency";

interface Props {
  ordemCompraId: string;
  recebimentoId: string;
  fornecedorId: string;
  onDone: () => void;
}

export default function NotaFiscalEntradaDialog({
  ordemCompraId,
  recebimentoId,
  fornecedorId,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<NfeExtracted | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gerandoTitulo, setGerandoTitulo] = useState(false);
  const [notaId, setNotaId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const criarMut = useCriarNotaFiscalEntrada();
  const gerarTituloMut = useGerarTituloNotaFiscalEntrada();

  function reset() {
    setFile(null);
    setParsed(null);
    setNotaId(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(f: File) {
    setFile(f);
    setParsed(null);
    setParsing(true);
    try {
      const xml = await f.text();
      const result = parseNfeXml(xml);
      if (!result.chave_acesso && result.itens.length === 0) {
        toast.error("Não foi possível reconhecer este XML como NF-e.");
      } else {
        setParsed(result);
      }
    } catch {
      toast.error("Falha ao ler o arquivo XML.");
    } finally {
      setParsing(false);
    }
  }

  async function salvar() {
    if (!file || !parsed) return;
    setSaving(true);
    try {
      const xmlPath = await notasFiscaisEntradaRepo.uploadXml(ordemCompraId, file);
      const id = await criarMut.mutateAsync({
        ordemCompraId,
        recebimentoId,
        fornecedorId,
        chaveAcesso: parsed.chave_acesso ?? null,
        numero: parsed.numero ?? null,
        serie: parsed.serie ?? null,
        cnpjEmitente: parsed.cnpj_emitente ?? null,
        valorTotal: parsed.valor_total ?? 0,
        dataEmissao: parsed.data_emissao ?? null,
        xmlPath,
        itens: parsed.itens.map((i) => ({
          descricao: i.descricao,
          quantidade: i.quantidade,
          valorUnitario: i.valor_unitario,
        })),
      });
      setNotaId(id);
      toast.success("Nota fiscal de entrada registrada.");
      onDone();
    } catch (e: any) {
      toast.error("Falha ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  async function gerarTitulo() {
    if (!notaId) return;
    setGerandoTitulo(true);
    try {
      await gerarTituloMut.mutateAsync(notaId);
      toast.success("Título financeiro gerado.");
      onDone();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error("Falha ao gerar título: " + (e?.message ?? ""));
    } finally {
      setGerandoTitulo(false);
    }
  }

  const chaveValida = parsed?.chave_acesso ? validarChaveAcesso(parsed.chave_acesso) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileCode className="h-3.5 w-3.5 mr-1" /> Anexar nota fiscal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nota fiscal de entrada (XML)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Arquivo .xml da NF-e</Label>
            <Input
              ref={inputRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="mt-1"
            />
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo XML…
            </div>
          )}

          {parsed && !notaId && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chave de acesso</span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  {parsed.chave_acesso ?? "—"}
                  {chaveValida === true && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                  {chaveValida === false && (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Número / Série</span>
                <span>
                  {parsed.numero ?? "—"} / {parsed.serie ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Emitente (CNPJ)</span>
                <span>{parsed.cnpj_emitente ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-medium">
                  {parsed.valor_total != null ? formatBRL(parsed.valor_total) : "—"}
                </span>
              </div>
              <div className="text-muted-foreground">{parsed.itens.length} item(ns)</div>
            </div>
          )}

          {notaId && (
            <div className="rounded-md border p-3 text-sm bg-muted/30">
              Nota fiscal registrada. Gere o título financeiro correspondente quando estiver
              pronto para o pagamento.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          {!notaId ? (
            <Button onClick={salvar} disabled={!parsed || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" /> Salvar
            </Button>
          ) : (
            <Button onClick={gerarTitulo} disabled={gerandoTitulo}>
              {gerandoTitulo && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar título financeiro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
