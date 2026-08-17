import { useRef } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DatePickerField from "@/components/common/DatePickerField";
import { useContratoDocumentos } from "@/hooks/contratos/useContratoDocumentos";
import { resumoDocumental, type StatusAssinaturaContrato } from "@/lib/contratos/documentos";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const STATUS_OPTIONS: Array<{ value: StatusAssinaturaContrato; label: string }> = [
  { value: "pendente", label: "Pendente" },
  { value: "enviado", label: "Enviado" },
  { value: "assinado", label: "Assinado" },
  { value: "dispensado", label: "Dispensado" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}

function baixar(dataUrl: string, nomeArquivo: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ContratoDocumentosSection({
  contratoId,
  canEdit,
  usuario,
}: {
  contratoId: string;
  canEdit: boolean;
  usuario: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { documentos, adicionarDocumento, atualizarStatus, atualizarValidade, removerDocumento } =
    useContratoDocumentos(contratoId);
  const resumo = resumoDocumental(documentos);
  const hojeISO = new Date().toISOString().slice(0, 10);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.warning(`${file.name} excede o limite de 2 MB.`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const novo = adicionarDocumento({
        contratoId,
        nomeArquivo: file.name,
        mime: file.type,
        tamanho: file.size,
        dataUrl,
        usuario,
      });
      toast.success(`${novo.nomeArquivo} anexado como v${novo.versao}.`);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{resumo.total} documento(s)</Badge>
          <Badge variant="outline">{resumo.assinados} assinado(s)</Badge>
          <Badge variant="outline">{resumo.pendentes + resumo.enviados} em aberto</Badge>
        </div>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Anexar
            </Button>
          </>
        )}
      </div>

      {documentos.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          <FileText className="h-6 w-6 mx-auto mb-2" />
          Nenhum documento anexado.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead className="w-20">Versão</TableHead>
              <TableHead className="w-36">Assinatura</TableHead>
              <TableHead className="w-36">Válido até</TableHead>
              <TableHead className="w-40">Upload</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="min-w-[180px]">
                  <div className="font-medium truncate">{doc.nomeArquivo}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(doc.tamanho)} · {doc.usuario}
                  </div>
                </TableCell>
                <TableCell>v{doc.versao}</TableCell>
                <TableCell>
                  <Select
                    value={doc.statusAssinatura}
                    onValueChange={(v) => atualizarStatus(doc.id, v as StatusAssinaturaContrato)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className={cn("h-8 text-xs", !canEdit && "opacity-100")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <DatePickerField
                    value={doc.validoAte ?? ""}
                    disabled={!canEdit}
                    onChange={(v) => atualizarValidade(doc.id, v || undefined)}
                    className="w-full"
                    inputClassName={cn(
                      "h-8 bg-transparent pl-2 text-xs",
                      doc.validoAte &&
                        doc.validoAte < hojeISO &&
                        "border-destructive text-destructive",
                    )}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatData(doc.dataUpload)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Baixar ${doc.nomeArquivo}`}
                      onClick={() => baixar(doc.dataUrl, doc.nomeArquivo)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remover ${doc.nomeArquivo}`}
                        onClick={() => removerDocumento(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
