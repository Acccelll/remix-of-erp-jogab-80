import React, { useState } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TipoVeiculo } from "@/types";
import VeiculoHistoricoSection from "@/components/frotas/VeiculoHistoricoSection";
import { PreventivaBadge } from "@/components/frotas/PreventivaBadge";
import { motoristasElegiveis } from "@/lib/frotas/alocacao";

const TIPOS_VEICULO: TipoVeiculo[] = [
  "Utilitário",
  "De Passeio",
  "Retroescavadeira",
  "Escavadeira",
  "Munck",
  "Ônibus",
  "Camionete",
];

interface Props {
  open: boolean;
  onClose: () => void;
  veiculoId: string | null;
}

const VeiculoProfileDialog: React.FC<Props> = ({ open, onClose, veiculoId }) => {
  const { veiculos, updateVeiculo } = useVeiculosContext();
  const { obras } = useObrasContext();
  const { hasAccess } = usePermissions();
  const { colaboradores } = useColaboradoresContext();
  const veiculo = veiculos.find((v) => v.id === veiculoId);
  const canEdit = hasAccess("frotas", "editar");

  const motoristas = motoristasElegiveis(colaboradores);

  const [editing, setEditing] = useState(false);
  const [editCodigo, setEditCodigo] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editTipo, setEditTipo] = useState<TipoVeiculo>("Utilitário");

  if (!veiculo) return null;

  // Backwards-compat: if "manutencao" not set, fall back to legacy "quebrado"
  const emManutencao = veiculo.manutencao ?? veiculo.quebrado;

  const startEditing = () => {
    setEditCodigo(veiculo.codigo);
    setEditNome(veiculo.nome);
    setEditTipo(veiculo.tipo);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editCodigo || !editNome) return;
    updateVeiculo(veiculo.id, { codigo: editCodigo, nome: editNome, tipo: editTipo });
    setEditing(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setEditing(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2">
            {editing ? (
              <div className="flex flex-col gap-2 w-full">
                <div>
                  <Label className="text-xs">Placa</Label>
                  <Input
                    value={editCodigo}
                    onChange={(e) => setEditCodigo(e.target.value.toUpperCase().slice(0, 7))}
                    className="mt-1"
                    maxLength={7}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={editTipo} onValueChange={(v) => setEditTipo(v as TipoVeiculo)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_VEICULO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!editCodigo || !editNome}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span className="matricula-badge">{veiculo.codigo}</span>
                {veiculo.nome}
                <PreventivaBadge ativoId={veiculo.id} />
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto"
                    onClick={startEditing}
                    aria-label="Editar campo"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <div className="flex items-center justify-between py-2 px-1 mb-2 rounded-md bg-muted/50">
            <span className="text-sm font-medium">Alugado</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {veiculo.alugado ? "Sim" : "Não"}
              </span>
              <Switch
                checked={veiculo.alugado}
                onCheckedChange={(v) => canEdit && updateVeiculo(veiculo.id, { alugado: !!v })}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="py-2 px-1 mb-2 rounded-md bg-muted/50">
            <Label className="text-xs">Motorista</Label>
            <Select
              value={veiculo.motoristaId || "__none__"}
              onValueChange={(v) =>
                canEdit && updateVeiculo(veiculo.id, { motoristaId: v === "__none__" ? null : v })
              }
              disabled={!canEdit}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="Nenhum motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {motoristas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="condicao">
            <TabsList className="w-full">
              <TabsTrigger value="condicao" className="flex-1 text-xs">
                Condição
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex-1 text-xs">
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="condicao">
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={veiculo.riscado}
                    onCheckedChange={(v) => canEdit && updateVeiculo(veiculo.id, { riscado: !!v })}
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Riscado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={emManutencao}
                    onCheckedChange={(v) =>
                      canEdit && updateVeiculo(veiculo.id, { manutencao: !!v, quebrado: !!v })
                    }
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Em Manutenção</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!veiculo.sujo}
                    onCheckedChange={(v) => canEdit && updateVeiculo(veiculo.id, { sujo: !!v })}
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Sujo</span>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="historico">
              <div className="pt-2">
                <VeiculoHistoricoSection veiculo={veiculo} obras={obras} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VeiculoProfileDialog;
