import React, { useState } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Eye, EyeOff, ArrowUpDown, X, Briefcase, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmployeeProfileDialog from "@/components/rh/EmployeeProfileDialog";
import DelegacoesTab from "@/components/rh/DelegacoesTab";
import { useFuncoes, useSaveFuncao } from "@/hooks/rh/useFuncoes";
import { Funcao } from "@/types";

const Funcoes = () => {
  const { hasAccess } = usePermissions();
  const { obras } = useObrasContext();
  const { colaboradores } = useColaboradoresContext();
  const { data: funcoes = [] } = useFuncoes();
  const saveFuncao = useSaveFuncao();
  const canEdit = hasAccess("rh", "editar");
  const canViewProfile = hasAccess("rh", "editar");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sortAZ, setSortAZ] = useState(false);
  const [aba, setAba] = useState<"funcoes" | "delegacoes">("funcoes");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Funcao | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [gestao, setGestao] = useState<"Supervisão" | "Gestão" | "Operação" | "">("");
  const [nrs, setNrs] = useState<string[]>([]);
  const [newNR, setNewNR] = useState("");

  const openForm = (funcao?: Funcao) => {
    if (funcao) {
      setEditing(funcao);
      setNome(funcao.nome);
      setGestao((funcao.gestao || "") as any);
      setNrs([...funcao.nrs]);
    } else {
      setEditing(null);
      setNome("");
      setGestao("");
      setNrs([]);
    }
    setNewNR("");
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!nome) return;
    const gestaoVal = gestao || undefined;
    if (editing) {
      saveFuncao.mutate({ id: editing.id, payload: { nome, nrs, gestao: gestaoVal } });
    } else {
      saveFuncao.mutate({ payload: { nome, nrs, ativa: true, gestao: gestaoVal } });
    }
    setFormOpen(false);
  };

  const addNR = () => {
    if (newNR.trim() && !nrs.includes(newNR.trim())) {
      setNrs([...nrs, newNR.trim()]);
      setNewNR("");
    }
  };

  const removeNR = (nr: string) => setNrs(nrs.filter((n) => n !== nr));

  let filtered = funcoes.filter((f) => {
    if (!showInactive && !f.ativa) return false;
    if (showInactive && f.ativa) return false;
    if (search) return f.nome.toLowerCase().includes(search.toLowerCase());
    return true;
  });
  if (sortAZ) filtered = [...filtered].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6" /> {aba === "delegacoes" ? "Delegações" : "Funções"}
        </h2>
        <Tabs value={aba} onValueChange={(v) => setAba(v as "funcoes" | "delegacoes")}>
          <TabsList>
            <TabsTrigger value="funcoes">Funções</TabsTrigger>
            <TabsTrigger value="delegacoes">Delegações</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {aba === "delegacoes" && (
        <p className="text-sm text-muted-foreground mb-4">
          As delegações definem subdivisões para a visualização do histograma.
        </p>
      )}
      {aba === "delegacoes" ? (
        <DelegacoesTab canEdit={canEdit} />
      ) : (
        <>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSortAZ(!sortAZ)}>
            <ArrowUpDown className="h-4 w-4 mr-1" /> A-Z
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="inativos-funcoes"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="inativos-funcoes" className="text-sm">
              {showInactive ? (
                <EyeOff className="h-4 w-4 inline" />
              ) : (
                <Eye className="h-4 w-4 inline" />
              )}{" "}
              Inativos
            </Label>
          </div>
          {canEdit && (
            <Button onClick={() => openForm()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Função
            </Button>
          )}
        </div>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome da função..."
          className="pl-9"
        />
      </div>
      <div className="grid gap-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma função encontrada.
          </p>
        )}
        {filtered.map((f) => {
          const colabsDaFuncao = colaboradores.filter((c) => c.funcao === f.nome);
          const total = colabsDaFuncao.length;
          const ativos = colabsDaFuncao.filter((c) => c.ativo).length;
          const isOpen = expanded.has(f.id);
          const ordenados = [...colabsDaFuncao].sort((a, b) => {
            if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
            return a.nome.localeCompare(b.nome, "pt-BR");
          });
          return (
            <Collapsible
              key={f.id}
              open={isOpen}
              onOpenChange={(o) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (o) next.add(f.id);
                  else next.delete(f.id);
                  return next;
                })
              }
              className="bg-card border border-border rounded-lg"
            >
              <div className="flex items-center gap-3 p-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                    disabled={total === 0}
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform text-muted-foreground ${isOpen ? "rotate-0" : "-rotate-90"} ${total === 0 ? "invisible" : ""}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{f.nome}</p>
                        {f.gestao && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              f.gestao === "Gestão"
                                ? "bg-blue-100 text-primary border-primary/40"
                                : f.gestao === "Supervisão"
                                  ? "bg-warning/15 text-warning border-warning/40"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {f.gestao}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {f.nrs.map((nr) => (
                          <Badge key={nr} variant="outline" className="text-xs">
                            {nr}
                          </Badge>
                        ))}
                        {f.nrs.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            Nenhuma NR cadastrada
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {total} cadastrado{total === 1 ? "" : "s"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs whitespace-nowrap border-success/40 text-success bg-success/10"
                  >
                    {ativos} ativo{ativos === 1 ? "" : "s"}
                  </Badge>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openForm(f)}>
                      Editar
                    </Button>
                    {f.ativa ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveFuncao.mutate({ id: f.id, payload: { ativa: false } })}
                      >
                        Inativar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveFuncao.mutate({ id: f.id, payload: { ativa: true } })}
                      >
                        Ativar
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <CollapsibleContent>
                <div className="border-t border-border bg-muted/30 px-4 py-3">
                  {ordenados.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Nenhum colaborador associado a esta função.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ordenados.map((c) => {
                        const obra = c.obraAtualId
                          ? obras.find((o) => o.id === c.obraAtualId)
                          : null;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            disabled={!canViewProfile}
                            onClick={() => canViewProfile && setProfileId(c.id)}
                            className={`flex items-center gap-2 p-2 rounded-md border bg-card text-left ${canViewProfile ? "hover:border-primary hover:shadow-sm cursor-pointer" : "cursor-default"} ${!c.ativo ? "opacity-60" : ""}`}
                          >
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-secondary rounded shrink-0">
                              {(c.matricula || "").padStart(4, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{c.nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {obra?.nome || (c.ativo ? "Sem alocação" : "Inativo")}
                              </p>
                            </div>
                            {!c.ativo && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                Inativo
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <EmployeeProfileDialog
        open={!!profileId}
        onClose={() => setProfileId(null)}
        colaboradorId={profileId ?? ""}
      />

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar Função" : "Nova Função"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da Função *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Gestão</Label>
              <Select
                value={gestao || "__none__"}
                onValueChange={(v) => setGestao((v === "__none__" ? "" : v) as typeof gestao)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar nível de gestão…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  <SelectItem value="Supervisão">Supervisão</SelectItem>
                  <SelectItem value="Gestão">Gestão</SelectItem>
                  <SelectItem value="Operação">Operação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>NRs Obrigatórias</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newNR}
                  onChange={(e) => setNewNR(e.target.value)}
                  placeholder="Ex: NR-10, NR-35..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNR())}
                />
                <Button type="button" size="sm" onClick={addNR}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {nrs.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {nrs.map((nr) => (
                    <Badge key={nr} variant="secondary" className="text-xs gap-1">
                      {nr}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeNR(nr)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!nome}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
};

export default Funcoes;
