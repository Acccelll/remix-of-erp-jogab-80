import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { formatBRLInput, formatBRLFromNumber, parseBRL } from "@/lib/core/currency";
import type { NivelPrioridade } from "@/types";
import { SETORES, type Solicitacao, type FormaPag } from "./types";

export interface SolicitacaoFormPayload {
  setor: string;
  valor: number;
  data_pagamento: string | null;
  prazo_estimado: string | null;
  forma_pagamento_id: string | null;
  nivel_prioridade: NivelPrioridade;
  condicao_pagamento: string | null;
  centro_custo_id: string | null;
  solicitante: string;
  fornecedor: string | null;
  referencia: string | null;
  observacao: string | null;
  pagamento_pendente: boolean;
}

export interface SolicitacaoFormDialogProps {
  open: boolean;
  viewOnly: boolean;
  editing: Solicitacao | null;
  formas: FormaPag[];
  obras: { id: string; nome: string; ativa?: boolean }[];
  colaboradores: { id: string; nome: string; ativo?: boolean }[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: SolicitacaoFormPayload) => void;
}

export function SolicitacaoFormDialog({
  open,
  viewOnly,
  editing,
  formas,
  obras,
  colaboradores,
  saving,
  onClose,
  onSubmit,
}: SolicitacaoFormDialogProps) {
  const [setor, setSetor] = useState("");
  const [valor, setValor] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [prazoEstimado, setPrazoEstimado] = useState("");
  const [formaPagId, setFormaPagId] = useState("");
  const [prioridade, setPrioridade] = useState<NivelPrioridade>("normal");
  const [condicaoPag, setCondicaoPag] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pagamentoPendente, setPagamentoPendente] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setSetor(editing.setor);
      setValor(formatBRLFromNumber(editing.valor));
      setDataPagamento(editing.data_pagamento || "");
      setPrazoEstimado(editing.prazo_estimado || "");
      setFormaPagId(editing.forma_pagamento_id || "");
      setPrioridade(editing.nivel_prioridade as NivelPrioridade);
      setCondicaoPag(editing.condicao_pagamento || "");
      setCentroCustoId(editing.centro_custo_id || "");
      setSolicitante(editing.solicitante);
      setFornecedor(editing.fornecedor || "");
      setReferencia(editing.referencia || "");
      setObservacao(editing.observacao || "");
      setPagamentoPendente(!!editing.pagamento_pendente);
    } else {
      setSetor("");
      setValor("");
      setDataPagamento("");
      setPrazoEstimado("");
      setFormaPagId("");
      setPrioridade("normal");
      setCondicaoPag("");
      setCentroCustoId("");
      setSolicitante("");
      setFornecedor("");
      setReferencia("");
      setObservacao("");
      setPagamentoPendente(false);
    }
  }, [open, editing]);

  const canSubmit = !!setor && !!valor && !!solicitante;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      setor,
      valor: parseBRL(valor),
      data_pagamento: dataPagamento || null,
      prazo_estimado: prazoEstimado || null,
      forma_pagamento_id: formaPagId || null,
      nivel_prioridade: prioridade,
      condicao_pagamento: condicaoPag || null,
      centro_custo_id: centroCustoId || null,
      solicitante,
      fornecedor: fornecedor || null,
      referencia: referencia || null,
      observacao: observacao || null,
      pagamento_pendente: pagamentoPendente,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display">
            {viewOnly ? "Visualizar" : editing ? "Editar" : "Nova"} Solicitação
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Setor *</Label>
                <Select value={setor} onValueChange={setSetor} disabled={viewOnly}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SETORES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor *</Label>
                <Input
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => setValor(formatBRLInput(e.target.value))}
                  placeholder="R$ 0,00"
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
            </div>
            <div>
              <Label>Solicitante *</Label>
              <Combobox
                options={colaboradores
                  .filter((c) => c.ativo)
                  .map((c) => ({ value: c.id, label: c.nome }))}
                value={solicitante}
                onChange={setSolicitante}
                placeholder="Selecione ou digite..."
                searchPlaceholder="Buscar colaborador..."
                emptyText="Nenhum colaborador encontrado."
                disabled={viewOnly}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fornecedor</Label>
                <Input
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              <div>
                <Label>Referência</Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Pagamento</Label>
                <DatePickerField
                  value={dataPagamento}
                  onChange={(v) => setDataPagamento(v)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              <div>
                <Label>Prazo Estimado</Label>
                <DatePickerField
                  value={prazoEstimado}
                  onChange={(v) => setPrazoEstimado(v)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={formaPagId} onValueChange={setFormaPagId} disabled={viewOnly}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={prioridade}
                  onValueChange={(v) => setPrioridade(v as NivelPrioridade)}
                  disabled={viewOnly}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Importante</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condição de Pagamento</Label>
                <Input
                  value={condicaoPag}
                  onChange={(e) => setCondicaoPag(e.target.value)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              <div>
                <Label>Centro de Custo (Obra)</Label>
                <Select value={centroCustoId} onValueChange={setCentroCustoId} disabled={viewOnly}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {obras
                      .filter((o) => o.ativa)
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="mt-1"
                disabled={viewOnly}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={pagamentoPendente}
                onCheckedChange={(v) => setPagamentoPendente(!!v)}
                disabled={viewOnly}
              />
              <span className="text-sm font-medium">Pagamento Pendente</span>
            </label>
            {viewOnly && editing?.comentario_aprovacao && (
              <div className="bg-muted p-3 rounded-lg">
                <Label className="text-xs text-muted-foreground">
                  Comentário de aprovação/recusa
                </Label>
                <p className="text-sm mt-1">{editing.comentario_aprovacao}</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {viewOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!viewOnly && (
            <Button onClick={submit} disabled={!canSubmit || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar" : "Criar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
