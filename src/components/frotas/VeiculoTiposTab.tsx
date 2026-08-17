// Aba "Tipos" da página Veículos — cadastro de tipos com o campo Grupo
// ("Veículos" | "Equipamentos"), que separa as seções do Histograma.
import { useState } from "react";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { confirmDialog } from "@/lib/ui/confirm";
import {
  useVeiculoTipos,
  useSaveVeiculoTipo,
  useDeleteVeiculoTipo,
} from "@/hooks/frotas/useVeiculoTipos";
import type { GrupoVeiculoTipo, VeiculoTipoCadastro } from "@/types";

const GRUPOS: GrupoVeiculoTipo[] = ["Veículos", "Equipamentos"];

export function VeiculoTiposTab({ canEdit }: { canEdit: boolean }) {
  const { data: tipos = [] } = useVeiculoTipos();
  const saveTipo = useSaveVeiculoTipo();
  const deleteTipo = useDeleteVeiculoTipo();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VeiculoTipoCadastro | null>(null);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState<GrupoVeiculoTipo>("Veículos");

  const openForm = (tipo?: VeiculoTipoCadastro) => {
    setEditing(tipo ?? null);
    setNome(tipo?.nome ?? "");
    setGrupo(tipo?.grupo ?? "Veículos");
    setFormOpen(true);
  };

  const handleSave = () => {
    const clean = nome.trim();
    if (!clean) return;
    if (editing) {
      saveTipo.mutate({ id: editing.id, payload: { nome: clean, grupo } });
    } else {
      saveTipo.mutate({ payload: { nome: clean, grupo } });
    }
    setFormOpen(false);
  };

  const handleDelete = async (t: VeiculoTipoCadastro) => {
    const ok = await confirmDialog({
      title: `Remover o tipo "${t.nome}"?`,
      description: "Veículos existentes com este tipo não são alterados.",
    });
    if (ok) deleteTipo.mutate(t.id);
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm()}>
            <Plus className="h-4 w-4 mr-1" /> Novo Tipo
          </Button>
        </div>
      )}

      {tipos.length === 0 ? (
        <EmptyState icon={Truck} title="Nenhum tipo cadastrado." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GRUPOS.map((g) => (
            <Card key={g}>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {g}
                </h3>
                {tipos.filter((t) => t.grupo === g).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum tipo neste grupo.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {tipos
                      .filter((t) => t.grupo === g)
                      .map((t) => (
                        <li key={t.id} className="flex items-center justify-between py-1.5">
                          <span className="text-sm flex items-center gap-2">
                            {t.nome}
                            {!t.ativo && (
                              <Badge variant="outline" className="text-[10px]">
                                inativo
                              </Badge>
                            )}
                          </span>
                          {canEdit && (
                            <span className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openForm(t)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDelete(t)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipo-nome">Nome</Label>
              <Input
                id="tipo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Escavadeira"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <Select value={grupo} onValueChange={(v) => setGrupo(v as GrupoVeiculoTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRUPOS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!nome.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VeiculoTiposTab;
