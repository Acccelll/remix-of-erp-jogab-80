import React, { useState } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, X, UserMinus } from "lucide-react";
import PatrimonioHistoricoSection from "@/components/patrimonios/PatrimonioHistoricoSection";
import { usePatrimonioPeriodos } from "@/hooks/patrimonios/usePatrimonioPeriodos";
import { ComentariosPanel } from "@/components/common/ComentariosPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  patrimonioId: string | null;
}

const PatrimonioProfileDialog: React.FC<Props> = ({ open, onClose, patrimonioId }) => {
  const {
    patrimonios,
    updatePatrimonio,
    responsabilidadesPatrimonios,
    encerrarResponsabilidade,
    cancelarMobilizacaoPatrimonio,
    getResponsabilidadeAtiva,
  } = usePatrimoniosContext();
  const { colaboradores } = useColaboradoresContext();
  const { obras } = useObrasContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const patrimonio = patrimonios.find((p) => p.id === patrimonioId);
  const canEdit = hasAccess("patrimonios", "editar");
  const isGM = currentPlayer?.isGM;

  const [editing, setEditing] = useState(false);
  const [editCodigo, setEditCodigo] = useState("");
  const [editNome, setEditNome] = useState("");
  const [confirmManutencao, setConfirmManutencao] = useState(false);

  // Hook antes do early return: a ordem dos hooks não pode variar entre renders.
  const { periodos: periodosPat } = usePatrimonioPeriodos(patrimonioId, open);

  if (!patrimonio) return null;

  const periodos = responsabilidadesPatrimonios
    .filter((r) => r.patrimonioId === patrimonio.id)
    .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
  const ativa = getResponsabilidadeAtiva(patrimonio.id);
  const responsavelAtivo = ativa ? colaboradores.find((c) => c.id === ativa.colaboradorId) : null;

  const startEditing = () => {
    setEditCodigo(patrimonio.codigo);
    setEditNome(patrimonio.nome);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editCodigo || !editNome) return;
    updatePatrimonio(patrimonio.id, { codigo: editCodigo, nome: editNome });
    setEditing(false);
  };

  const handleToggleManutencao = (v: boolean) => {
    if (!canEdit) return;
    if (v && ativa) {
      // Marcando Em Manutenção e há responsável ativo: pedir confirmação
      setConfirmManutencao(true);
      return;
    }
    updatePatrimonio(patrimonio.id, { emManutencao: v });
  };

  const fmtBR = (iso: string | null) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const colabNome = (id: string) => colaboradores.find((c) => c.id === id)?.nome || id;

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
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2">
            {editing ? (
              <div className="flex flex-col gap-2 w-full">
                <div>
                  <Label className="text-xs">Código</Label>
                  <Input
                    value={editCodigo}
                    onChange={(e) => setEditCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1"
                    maxLength={6}
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
                <span className="matricula-badge">{patrimonio.codigo}</span>
                {patrimonio.nome}
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
          <DialogDescription className="sr-only">Perfil do patrimônio</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {patrimonio.mobilizacaoPendente && (
            <div className="flex items-center justify-between rounded-md border border-warning/40 bg-warning/10 px-3 py-2 mb-3 text-xs">
              <span>
                Mobilização pendente para{" "}
                <strong>{patrimonio.mobilizacaoPendente.obraDestinoNome}</strong> em{" "}
                {patrimonio.mobilizacaoPendente.dataMobilizacao}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => cancelarMobilizacaoPatrimonio(patrimonio.id)}
                >
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
              )}
            </div>
          )}

          {responsavelAtivo && (
            <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 mb-3 text-xs">
              <span>
                Sob responsabilidade de <strong>{responsavelAtivo.nome}</strong>
                {responsavelAtivo.obraAtualId && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {obras.find((o) => o.id === responsavelAtivo.obraAtualId)?.nome || "—"}
                  </Badge>
                )}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2 px-1 mb-2 rounded-md bg-muted/50">
            <span className="text-sm font-medium">Alugado</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {patrimonio.alugado ? "Sim" : "Não"}
              </span>
              <Switch
                checked={patrimonio.alugado}
                onCheckedChange={(v) =>
                  canEdit && updatePatrimonio(patrimonio.id, { alugado: !!v })
                }
                disabled={!canEdit}
              />
            </div>
          </div>

          <Tabs defaultValue="condicao">
            <TabsList className="w-full">
              <TabsTrigger value="condicao" className="flex-1 text-xs">
                Condição
              </TabsTrigger>
              <TabsTrigger value="responsabilidade" className="flex-1 text-xs">
                Responsabilidade
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex-1 text-xs">
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="condicao">
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={patrimonio.riscado}
                    onCheckedChange={(v) =>
                      canEdit && updatePatrimonio(patrimonio.id, { riscado: !!v })
                    }
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Riscado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={patrimonio.quebrado}
                    onCheckedChange={(v) =>
                      canEdit && updatePatrimonio(patrimonio.id, { quebrado: !!v })
                    }
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Quebrado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!patrimonio.emManutencao}
                    onCheckedChange={(v) => handleToggleManutencao(!!v)}
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Em Manutenção</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!patrimonio.sujo}
                    onCheckedChange={(v) =>
                      canEdit && updatePatrimonio(patrimonio.id, { sujo: !!v })
                    }
                    disabled={!canEdit}
                  />
                  <span className="text-sm">Sujo</span>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="responsabilidade">
              <div className="pt-2 space-y-2">
                {periodos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum período de responsabilidade registrado.
                  </p>
                )}
                {periodos.map((p) => {
                  const aberto = p.dataFim === null;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 border border-border rounded-md px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{colabNome(p.colaboradorId)}</p>
                        <p className="text-muted-foreground">
                          {fmtBR(p.dataInicio)} →{" "}
                          {p.dataFim ? (
                            fmtBR(p.dataFim)
                          ) : (
                            <span className="text-primary">em aberto</span>
                          )}
                        </p>
                      </div>
                      {aberto && canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => encerrarResponsabilidade(p.id)}
                        >
                          <UserMinus className="h-3 w-3 mr-1" /> Encerrar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="historico" className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Comentários</h3>
                <ComentariosPanel tipo="patrimonio" id={patrimonio.id} enabled={open} />
              </div>
              <PatrimonioHistoricoSection patrimonio={patrimonio} periodos={periodosPat} obras={obras} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Confirmação Em Manutenção com responsável ativo */}
      <Dialog open={confirmManutencao} onOpenChange={(v) => !v && setConfirmManutencao(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Em Manutenção</DialogTitle>
            <DialogDescription>
              Este patrimônio está sob responsabilidade de <strong>{responsavelAtivo?.nome}</strong>
              . Deseja remover o responsável?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                updatePatrimonio(patrimonio.id, { emManutencao: true });
                setConfirmManutencao(false);
              }}
            >
              Manter responsável
            </Button>
            <Button
              onClick={async () => {
                if (ativa) await encerrarResponsabilidade(ativa.id);
                updatePatrimonio(patrimonio.id, { emManutencao: true });
                setConfirmManutencao(false);
              }}
            >
              Remover responsável
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default PatrimonioProfileDialog;
