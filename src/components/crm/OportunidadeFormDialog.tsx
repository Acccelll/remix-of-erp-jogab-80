// Diálogo reutilizável de criação/edição de Oportunidade.
// Usado tanto na página Oportunidades (lista) quanto no Funil de Vendas (quadro),
// para que abrir um card no Funil abra o mesmo pop-up sem trocar de aba.
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useClientesContext } from "@/contexts/ClientesContext";
import { usePlayersContext } from "@/contexts/PlayersContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Plus, Trash2 } from "lucide-react";
import type { Oportunidade } from "@/types";
import type { Contact } from "@/components/common/ContactsManager";
import { TemperatureSelector } from "@/components/crm/TemperatureSelector";
import { formatBRLFromNumber, formatBRLInput, parseBRL } from "@/lib/core/currency";
import { CRM_ESTAGIO_FECHADO_PERDIDO, useCrmMotivosPerda } from "@/hooks/crm/useCrmMotivosPerda";
import { useQueryClient } from "@tanstack/react-query";
import { diffOportunidade, registrarInteracao } from "@/lib/crm/historico";

import { SERVICOS } from "@/config/servicos";

const EMPTY_FORM = {
  nome: "",
  clienteId: "",
  servicos: [] as string[],
  email: "",
  telefone: "",
  status: "novo",
  estagio: "prospeccao",
  responsavelId: "",
  observacao: "",
  temperatura_temperatura: null as any,
  contatoNome: "",
  contatoFuncaoSetor: "",
  contatos: null as Contact[] | null,
  valorEstimado: 0,
  valorEstimadoMasked: "",
  dataPrevistaFechamento: "",
  localObra: "",
  potencialInicioObra: "",
  potencialTerminoObra: "",
};
type FormState = typeof EMPTY_FORM;

const oportunidadeToForm = (l: Oportunidade): FormState => {
  const all = (l.contatos as Contact[] | null) || [];
  const [principal, ...rest] = all;
  return {
    nome: l.nome,
    clienteId: l.clienteId || "",
    servicos: l.servicos || [],
    email: l.email || "",
    telefone: l.telefone || "",
    status: l.status,
    estagio: l.estagio,
    responsavelId: l.responsavelId || "",
    observacao: l.observacao || "",
    temperatura_temperatura: l.temperatura_temperatura || null,
    contatoNome: principal?.nome || "",
    contatoFuncaoSetor: (principal as any)?.funcaoSetor || "",
    contatos: rest.length ? rest : null,
    valorEstimado: Number(l.valorEstimado) || 0,
    valorEstimadoMasked: l.valorEstimado ? formatBRLFromNumber(l.valorEstimado) : "",
    dataPrevistaFechamento: l.dataPrevistaFechamento || "",
    localObra: l.localObra || "",
    potencialInicioObra: l.potencialInicioObra || "",
    potencialTerminoObra: l.potencialTerminoObra || "",
  };
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Oportunidade | null;
}

export function OportunidadeFormDialog({ open, onOpenChange, editing }: Props) {
  const { funilEstagios, addOportunidade, updateOportunidade, clientes } = useClientesContext();
  const { players } = usePlayersContext();
  const { motivos, getRegistro, registrarPerda, adicionarMotivo } = useCrmMotivosPerda();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [motivoPerdaId, setMotivoPerdaId] = useState("");
  const [motivoPerdaObs, setMotivoPerdaObs] = useState("");
  const [novoMotivoPerda, setNovoMotivoPerda] = useState("");
  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm(editing ? oportunidadeToForm(editing) : EMPTY_FORM);
      const perda = editing ? getRegistro(editing.id) : undefined;
      setMotivoPerdaId(perda?.motivoId ?? "");
      setMotivoPerdaObs(perda?.observacao ?? "");
      setNovoMotivoPerda("");
    }
  }, [open, editing, getRegistro]);

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.clienteId.trim()) {
      toast.error("Cliente é obrigatório");
      return;
    }
    const exigeMotivoPerda = form.estagio === CRM_ESTAGIO_FECHADO_PERDIDO;
    const motivoSelecionado = motivos.find((m) => m.id === motivoPerdaId);
    const motivoFinal =
      motivoSelecionado || (novoMotivoPerda.trim() ? adicionarMotivo(novoMotivoPerda) : null);
    if (exigeMotivoPerda && !motivoFinal) {
      toast.error("Informe o motivo da perda");
      return;
    }
    setSaving(true);
    try {
      const adicionaisLimpos = (form.contatos || []).filter(
        (c) =>
          (c.nome || "").trim() ||
          (c.email || "").trim() ||
          (c.telefone || "").trim() ||
          ((c as any).funcaoSetor || "").trim(),
      );
      const principal: Contact | null =
        (form.contatoNome || "").trim() ||
        (form.email || "").trim() ||
        (form.telefone || "").trim() ||
        (form.contatoFuncaoSetor || "").trim()
          ? {
              nome: form.contatoNome || "",
              email: form.email || undefined,
              telefone: form.telefone || undefined,
              funcaoSetor: form.contatoFuncaoSetor || undefined,
            }
          : null;
      const contatosMerged = [...(principal ? [principal] : []), ...adicionaisLimpos];
      const payload: any = {
        nome: form.nome.trim(),
        clienteId: form.clienteId,
        servicos: form.servicos.length ? form.servicos : null,
        email: form.email || null,
        telefone: form.telefone || null,
        status: form.status,
        estagio: form.estagio,
        responsavelId: form.responsavelId || null,
        observacao: form.observacao || null,
        temperatura_temperatura: form.temperatura_temperatura || null,
        valorEstimado: Number(form.valorEstimado) || 0,
        dataPrevistaFechamento: form.dataPrevistaFechamento || null,
        contatos: contatosMerged.length ? contatosMerged : null,
        localObra: form.localObra || null,
        potencialInicioObra: form.potencialInicioObra || null,
        potencialTerminoObra: form.potencialTerminoObra || null,
      };
      if (editing) {
        const alteracoes = diffOportunidade(editing as any, payload as any);
        await updateOportunidade(editing.id, payload);
        // Timeline visível "Histórico de interações": registra o que mudou.
        if (alteracoes.length > 0) {
          const descricao =
            alteracoes.length === 1
              ? `Alterou ${alteracoes[0].label}`
              : `Alterou ${alteracoes.length} campos: ${alteracoes
                  .map((a) => a.label)
                  .join(", ")}`;
          void registrarInteracao({
            oportunidadeId: editing.id,
            tipo: "edicao",
            descricao,
          });
          qc.invalidateQueries({ queryKey: ["crm-interacoes", editing.id] });
        }
        if (exigeMotivoPerda && motivoFinal) {
          registrarPerda({
            oportunidadeId: editing.id,
            motivoId: motivoFinal.id,
            motivoRotulo: motivoFinal.rotulo,
            observacao: motivoPerdaObs,
          });
        }
        toast.success("Oportunidade atualizada");
      } else {
        const criada = await addOportunidade(payload as any);
        if (criada?.id) {
          void registrarInteracao({
            oportunidadeId: criada.id,
            tipo: "criacao",
            descricao: `Oportunidade criada: ${payload.nome ?? ""}`,
          });
          qc.invalidateQueries({ queryKey: ["crm-interacoes", criada.id] });
        }
        if (exigeMotivoPerda && motivoFinal && criada?.id) {
          registrarPerda({
            oportunidadeId: criada.id,
            motivoId: motivoFinal.id,
            motivoRotulo: motivoFinal.rotulo,
            observacao: motivoPerdaObs,
          });
        }
        toast.success("Oportunidade criada");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1 col-span-2">
            <Label>Oportunidade *</Label>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Título da oportunidade"
            />
          </div>

          <div className="space-y-1">
            <Label>Valor estimado</Label>
            <Input
              inputMode="numeric"
              value={form.valorEstimadoMasked}
              onChange={(e) => {
                const masked = formatBRLInput(e.target.value);
                set("valorEstimadoMasked", masked);
                set("valorEstimado", parseBRL(masked));
              }}
              placeholder="R$ 0,00"
            />
          </div>
          <div className="space-y-1">
            <Label>Data prevista de fechamento</Label>
            <DatePickerField
              value={form.dataPrevistaFechamento}
              onChange={(v) => set("dataPrevistaFechamento", v)}
            />
          </div>

          <div className="space-y-1 col-span-2">
            <Label>Estágio</Label>
            <Select value={form.estagio} onValueChange={(v) => set("estagio", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...funilEstagios]
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((e) => (
                    <SelectItem key={e.chave} value={e.chave}>
                      {e.rotulo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {form.estagio === CRM_ESTAGIO_FECHADO_PERDIDO && (
            <div className="col-span-2 grid grid-cols-1 gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="space-y-1">
                <Label>Motivo da perda *</Label>
                <Select value={motivoPerdaId} onValueChange={setMotivoPerdaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Novo motivo</Label>
                <Input
                  value={novoMotivoPerda}
                  onChange={(e) => setNovoMotivoPerda(e.target.value)}
                  placeholder="Adicionar à lista gerenciável"
                />
              </div>
              <div className="space-y-1">
                <Label>Observação da perda</Label>
                <Textarea
                  value={motivoPerdaObs}
                  onChange={(e) => setMotivoPerdaObs(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Responsável</Label>
            <Select
              value={form.responsavelId || undefined}
              onValueChange={(v) => set("responsavelId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Atribuir" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.login}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <TemperatureSelector
              value={form.temperatura_temperatura}
              onChange={(v) => set("temperatura_temperatura", v)}
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label className="text-sm font-semibold">Contatos</Label>
            <div className="p-3 bg-muted/40 rounded border space-y-2">
              <div className="col-span-full text-xs font-medium text-muted-foreground">
                Contato 1 (principal)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={form.contatoNome}
                    onChange={(e) => set("contatoNome", e.target.value)}
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Função/Setor</Label>
                  <Input
                    value={(form as any).contatoFuncaoSetor || ""}
                    onChange={(e) => set("contatoFuncaoSetor" as any, e.target.value)}
                    placeholder="Ex.: Compras"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="Email"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => set("telefone", e.target.value)}
                    placeholder="Telefone"
                  />
                </div>
              </div>
            </div>

            {(form.contatos || []).map((c, i) => (
              <div key={i} className="p-3 bg-muted/40 rounded border space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Contato {i + 2}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={c.nome}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], nome: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Nome"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Função/Setor</Label>
                    <Input
                      value={(c as any).funcaoSetor || ""}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], funcaoSetor: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Ex.: Compras"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input
                      type="email"
                      value={c.email || ""}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], email: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      value={c.telefone || ""}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], telefone: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Telefone"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label="Remover contato"
                    onClick={() => {
                      const next = (form.contatos || []).filter((_, idx) => idx !== i);
                      set("contatos", next.length ? next : null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set("contatos", [
                  ...(form.contatos || []),
                  { nome: "", email: "", telefone: "", funcaoSetor: "" },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar outro contato
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Cliente *</Label>
            <Select value={form.clienteId} onValueChange={(v) => set("clienteId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Serviço</Label>
            <MultiSelect
              options={SERVICOS.map((s) => ({ value: s, label: s }))}
              selected={form.servicos}
              onChange={(v) => set("servicos", v)}
              placeholder="Selecione…"
            />
          </div>

          <div className="space-y-1 col-span-2">
            <Label>Local da obra</Label>
            <Input
              value={form.localObra}
              onChange={(e) => set("localObra", e.target.value)}
              placeholder="Cidade/UF"
            />
          </div>

          <div className="space-y-1">
            <Label>Potencial início de obra</Label>
            <DatePickerField
              value={form.potencialInicioObra}
              onChange={(v) => set("potencialInicioObra", v)}
            />
          </div>
          <div className="space-y-1">
            <Label>Potencial término de obra</Label>
            <DatePickerField
              value={form.potencialTerminoObra}
              onChange={(v) => set("potencialTerminoObra", v)}
            />
          </div>

          <div className="space-y-1 col-span-2">
            <Label>Observação</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.nome.trim() || !form.clienteId.trim()}
          >
            {editing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
