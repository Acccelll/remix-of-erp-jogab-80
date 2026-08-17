import React, { useState, useEffect, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useContratosContext } from "@/contexts/ContratosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import DatePickerField from "@/components/common/DatePickerField";
import { formatBRLFromNumber, formatBRLInput, parseBRL } from "@/lib/core/currency";
import { Contrato, StatusContrato, TipoContrato, AditivoContrato, TipoVeiculo } from "@/types";
import { TIPOS_VEICULO } from "@/lib/frotas/tipos";
import ContratoHistoricoSection from "@/components/contratos/ContratoHistoricoSection";
import { useContratoPeriodos } from "@/hooks/contratos/useContratoPeriodos";
import { ContratoDocumentosSection } from "@/components/contratos/ContratoDocumentosSection";
import { ComentariosPanel } from "@/components/common/ComentariosPanel";
import { Plus, Trash2 } from "lucide-react";
import { useFormasPagamento } from "@/hooks/financeiro/useFormasPagamento";
import { fmtDataLocal } from "@/lib/core/date";
import { getDocumentoNumeroLocal } from "@/lib/empresa/documento-numeracao-local";

interface Props {
  open: boolean;
  onClose: () => void;
  contratoId: string | null;
}

export const TIPOS_CONTRATO: TipoContrato[] = [
  "Máquina",
  "Internet",
  "Faxina",
  "Alimentação",
  "Alojamento",
  "Luz",
  "Água",
  "Contêiner",
  "Outro",
];
export const STATUS_CONTRATO: { value: StatusContrato; label: string; className: string }[] = [
  {
    value: "rascunho",
    label: "Rascunho",
    className: "bg-muted text-muted-foreground border-border",
  },
  {
    value: "ativo",
    label: "Ativo",
    className: "bg-success/15 text-success border-success/40",
  },
  {
    value: "suspenso",
    label: "Suspenso",
    className: "bg-warning/15 text-warning border-warning/40",
  },
  {
    value: "encerrado",
    label: "Encerrado",
    className: "bg-slate-500/15 text-slate-700 border-slate-300",
  },
  {
    value: "inadimplente",
    label: "Inadimplente",
    className: "bg-destructive/15 text-destructive border-destructive/40",
  },
];

const parseBRDate = (s: string): Date | null => {
  if (!s) return null;
  // Accept YYYY-MM-DD or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00");
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return null;
};

const ContratoProfileDialog: React.FC<Props> = ({ open, onClose, contratoId }) => {
  const { contratos, updateContrato } = useContratosContext();
  const { obras } = useObrasContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const contrato = contratos.find((c) => c.id === contratoId);
  const canEdit = hasAccess("contratos", "editar");
  const { periodos: periodosContrato } = useContratoPeriodos(contratoId, open);

  const [form, setForm] = useState<Contrato | null>(null);
  const [valorMasked, setValorMasked] = useState("");
  const { data: formasPagamentoAll = [] } = useFormasPagamento();
  const formasPagamento = useMemo(
    () => formasPagamentoAll.filter((f) => f.ativo),
    [formasPagamentoAll],
  );

  // Sincroniza o formulário com o contrato selecionado
  useEffect(() => {
    if (contrato) {
      setForm({ ...contrato });
      setValorMasked(formatBRLFromNumber(contrato.valor));
    }
  }, [contrato?.id, open]);

  // ========== TODOS OS HOOKS (useMemo) vêm ANTES do return condicional ==========
  const aditivosOrdenados = useMemo(() => {
    if (!form) return [];
    return [...form.aditivos].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
    );
  }, [form?.aditivos]);

  const valorAtual = useMemo(() => {
    if (!form) return 0;
    return aditivosOrdenados.reduce(
      (acc, a) => (a.tipo === "reajuste" && a.novoValor != null ? a.novoValor : acc),
      form.valor,
    );
  }, [aditivosOrdenados, form?.valor]);

  const terminoAtual = useMemo(() => {
    if (!form) return "";
    return aditivosOrdenados.reduce(
      (acc, a) => (a.tipo === "prorrogacao" && a.novoTermino ? a.novoTermino : acc),
      form.termino,
    );
  }, [aditivosOrdenados, form?.termino]);

  const { diasPorObra, totalDias, custoPorDia } = useMemo(() => {
    if (!form) return { diasPorObra: {}, totalDias: 1, custoPorDia: 0 };

    const inicioDate = parseBRDate(form.inicio);
    const terminoDate = parseBRDate(terminoAtual) || new Date();
    const eventos = [...form.historico]
      .filter((h) => h.tipo === "mobilizacao" || h.tipo === "cadastro")
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    const dias: Record<string, number> = {};
    let obraAtual = "Sem Alocação";
    let momento = inicioDate || (eventos[0] ? new Date(eventos[0].data) : new Date());

    eventos.forEach((ev) => {
      const m = ev.descricao.match(/de "(.+?)" para "(.+?)"/);
      if (!m) return;
      const eventoData = new Date(ev.data);
      const diasEntre = Math.max(
        0,
        Math.floor((eventoData.getTime() - momento.getTime()) / 86400000),
      );
      dias[obraAtual] = (dias[obraAtual] || 0) + diasEntre;
      obraAtual = m[2];
      momento = eventoData;
    });
    // último período até hoje (ou término)
    const fim = terminoDate < new Date() ? terminoDate : new Date();
    if (fim > momento) {
      const diasEntre = Math.floor((fim.getTime() - momento.getTime()) / 86400000);
      dias[obraAtual] = (dias[obraAtual] || 0) + diasEntre;
    }

    const total =
      inicioDate && terminoDate
        ? Math.max(1, Math.floor((terminoDate.getTime() - inicioDate.getTime()) / 86400000))
        : 1;
    const custo = valorAtual / total;
    return { diasPorObra: dias, totalDias: total, custoPorDia: custo };
  }, [form?.historico, form?.inicio, terminoAtual, valorAtual]);

  // ========== Retorno condicional APÓS todos os hooks ==========
  if (!contrato || !form) return null;

  // Funções auxiliares (não são hooks)
  const set = <K extends keyof Contrato>(k: K, v: Contrato[K]) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  const handleSave = () => {
    if (!canEdit || !form) return;
    updateContrato(contrato.id, {
      locacaoServico: form.locacaoServico,
      inicio: form.inicio,
      termino: form.termino,
      responsavel: form.responsavel,
      contato: form.contato,
      valor: form.valor,
      formaPagamentoId: form.formaPagamentoId,
      periodicidadePagamento: form.periodicidadePagamento,
      tipo: form.tipo,
      endereco: form.endereco,
      tipoMaquina: form.tipoMaquina,
      observacao: form.observacao,
      status: form.status,
      aditivos: form.aditivos,
    });
    onClose();
  };

  // Aditivos
  const addAditivo = (tipo: "prorrogacao" | "reajuste") => {
    const novo: AditivoContrato = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      tipo,
      observacao: "",
    };
    const novos = [...form.aditivos, novo];
    set("aditivos", novos);
    updateContrato(contrato.id, { aditivos: novos });
  };

  const updateAditivo = (id: string, patch: Partial<AditivoContrato>) => {
    const novos = form.aditivos.map((a) => (a.id === id ? { ...a, ...patch } : a));
    set("aditivos", novos);
    updateContrato(contrato.id, { aditivos: novos });
  };

  const removeAditivo = (id: string) => {
    const novos = form.aditivos.filter((a) => a.id !== id);
    set("aditivos", novos);
    updateContrato(contrato.id, { aditivos: novos });
  };

  const statusInfo = STATUS_CONTRATO.find((s) => s.value === form.status) || STATUS_CONTRATO[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-mono">
              {getDocumentoNumeroLocal(contrato.id, "contrato")?.numero ??
                `CTR-${contrato.id.slice(-6).toUpperCase()}`}
            </Badge>
            {contrato.locacaoServico || "Contrato"}
            <Badge variant="outline" className={`text-[10px] ${statusInfo.className}`}>
              {statusInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-6">
            <TabsTrigger value="dados" className="flex-1">
              Dados
            </TabsTrigger>
            <TabsTrigger value="aditivos" className="flex-1">
              Aditivos
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex-1">
              Documentos
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">
              Histórico
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
            <TabsContent value="dados" className="space-y-3 mt-0">
              <div>
                <Label className="text-xs">Locação/Serviços</Label>
                <Input
                  value={form.locacaoServico}
                  onChange={(e) => set("locacaoServico", e.target.value)}
                  disabled={!canEdit}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Início</Label>
                  <DatePickerField
                    value={form.inicio}
                    onChange={(v) => set("inicio", v)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Término</Label>
                  <DatePickerField
                    value={form.termino}
                    onChange={(v) => set("termino", v)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Input
                    value={form.responsavel}
                    onChange={(e) => set("responsavel", e.target.value)}
                    disabled={!canEdit}
                    className="mt-1"
                    placeholder="Dono da casa, fornecedor, profissional"
                  />
                </div>
                <div>
                  <Label className="text-xs">Contato</Label>
                  <Input
                    value={form.contato}
                    onChange={(e) => set("contato", e.target.value)}
                    disabled={!canEdit}
                    className="mt-1"
                    placeholder="Nº de telefone do responsável"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={valorMasked}
                    onChange={(e) => {
                      const m = formatBRLInput(e.target.value);
                      setValorMasked(m);
                      set("valor", parseBRL(m));
                    }}
                    disabled={!canEdit}
                    className="mt-1"
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Select
                    value={form.formaPagamentoId || ""}
                    onValueChange={(v) => set("formaPagamentoId", v || undefined)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {formasPagamento.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Periodicidade de Pagamento</Label>
                <Select
                  value={form.periodicidadePagamento || ""}
                  onValueChange={(v) => set("periodicidadePagamento", v as any)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Diário", "Mensal", "Quinzenal", "Outro"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => set("tipo", v as TipoContrato)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CONTRATO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => set("status", v as StatusContrato)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CONTRATO.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.tipo === "Alojamento" && (
                <div>
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    value={form.endereco || ""}
                    onChange={(e) => set("endereco", e.target.value)}
                    disabled={!canEdit}
                    className="mt-1"
                    placeholder="Endereço do alojamento"
                  />
                </div>
              )}

              {form.tipo === "Máquina" && (
                <div>
                  <Label className="text-xs">Tipo de Máquina</Label>
                  <Input
                    value={form.tipoMaquina || ""}
                    onChange={(e) => set("tipoMaquina", e.target.value as any)}
                    disabled={!canEdit}
                    className="mt-1"
                    placeholder="Ex.: Retroescavadeira JCB"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Observação</Label>
                <Textarea
                  value={form.observacao || ""}
                  onChange={(e) => set("observacao", e.target.value)}
                  disabled={!canEdit}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="border border-border rounded-md p-3 bg-muted/30 text-xs space-y-1">
                <p>
                  <strong>Custo por Dia:</strong> {formatBRLFromNumber(custoPorDia)}{" "}
                  <span className="text-muted-foreground">
                    ({totalDias} dia{totalDias > 1 ? "s" : ""} no total)
                  </span>
                </p>
                <div>
                  <strong>Dias por obra:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    {Object.entries(diasPorObra)
                      .filter(([, d]) => d > 0)
                      .map(([obra, d]) => (
                        <li key={obra}>
                          {obra}: {d} dia{d > 1 ? "s" : ""}
                        </li>
                      ))}
                    {Object.values(diasPorObra).every((d) => d === 0) && (
                      <li className="text-muted-foreground list-none">
                        Nenhum período registrado.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="aditivos" className="space-y-3 mt-0">
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addAditivo("prorrogacao")}>
                    <Plus className="h-3 w-3 mr-1" /> Prorrogação
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addAditivo("reajuste")}>
                    <Plus className="h-3 w-3 mr-1" /> Reajuste
                  </Button>
                </div>
              )}
              {form.aditivos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum aditivo registrado.
                </p>
              )}
              {aditivosOrdenados.map((a) => (
                <div key={a.id} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {a.tipo === "prorrogacao" ? "Prorrogação" : "Reajuste"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fmtDataLocal(a.data)}</span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => removeAditivo(a.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {a.tipo === "prorrogacao" && (
                    <div>
                      <Label className="text-xs">Novo Término</Label>
                      <DatePickerField
                        value={a.novoTermino || ""}
                        onChange={(v) => updateAditivo(a.id, { novoTermino: v })}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {a.tipo === "reajuste" && (
                    <div>
                      <Label className="text-xs">Novo Valor</Label>
                      <Input
                        defaultValue={formatBRLFromNumber(a.novoValor || 0)}
                        onBlur={(e) => {
                          const v = parseBRL(e.target.value);
                          updateAditivo(a.id, { novoValor: v });
                          e.target.value = formatBRLFromNumber(v);
                        }}
                        disabled={!canEdit}
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Observação</Label>
                    <Input
                      value={a.observacao || ""}
                      onChange={(e) => updateAditivo(a.id, { observacao: e.target.value })}
                      disabled={!canEdit}
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="documentos" className="mt-0">
              <ContratoDocumentosSection
                contratoId={contrato.id}
                canEdit={canEdit}
                usuario={currentPlayer?.login || "Sistema"}
              />
            </TabsContent>

            <TabsContent value="historico" className="mt-0 space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Comentários</h3>
                <ComentariosPanel tipo="contrato" id={contrato.id} enabled={open} />
              </div>
              <ContratoHistoricoSection
                contrato={form}
                obras={obras}
                valorAtual={valorAtual}
                periodos={periodosContrato}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-6 pt-3">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {canEdit && <Button onClick={handleSave}>Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContratoProfileDialog;
