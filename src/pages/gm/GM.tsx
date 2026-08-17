import React, { useState } from "react";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePlayersContext } from "@/contexts/PlayersContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Shield, Pencil, KeyRound, Mail, Lock, Eye } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Activity, History, Flag, Sparkles, GitBranch, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NivelAcesso, Player, PageKey } from "@/types";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/ui/confirm";

// Permissões são editadas exclusivamente na aba Permissões do hub (/gm?tab=permissoes).
// Novos usuários nascem com este seed (Player.acessos é obrigatório).
const defaultAcessos: Record<PageKey, NivelAcesso> = {
  obras_div: "visualizar",
  rh: "visualizar",
  dp: "visualizar",
  patrimonios: "visualizar",
  frotas: "visualizar",
  admin: "nenhum",
  financeiro: "nenhum",
  contratos: "nenhum",
  almoxarifado: "nenhum",
  crm: "nenhum",
};

const GM = () => {
  const { players, addPlayer, updatePlayer, deletePlayer } = usePlayersContext();
  const { currentPlayer, startPreview } = useAuth();
  const navigate = useNavigate();
  const isGM = currentPlayer?.isGM;

  // "Visualizar como usuário": entra em modo preview e vai para a home (rota
  // aberta) para começar a navegar com as permissões do usuário selecionado.
  const handlePreview = (p: Player) => {
    startPreview(p);
    navigate("/");
  };
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [email, setEmail] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resetPasswordPlayer, setResetPasswordPlayer] = useState<Player | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const handleSeedDemo = async (mode: "create" | "reset") => {
    if (mode === "reset") {
      const ok = await confirmDialog({
        title: "Recriar obra-demo?",
        description: "Isso apaga TODAS as obras [DEMO] e cria uma nova. Continuar?",
      });
      if (!ok) return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("seed-obra-demo", { body: { mode } });
      if (error) throw error;
      toast.success("Obra-demo pronta", {
        description: `Obra "${(data as any)?.obra?.nome}" criada com ${(data as any)?.cards_criados ?? 0} cards.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro", { description: msg });
    }
  };

  const openEdit = (p: Player) => {
    setEditingPlayer(p);
    setLogin(p.login);
    setSenha(p.senha);
    setEmail(p.email || "");
    setFormOpen(true);
  };

  const openAdd = () => {
    setEditingPlayer(null);
    setLogin("");
    setSenha("");
    setEmail("");
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!login) return;
    // Ao criar usuário novo, senha é obrigatória; ao editar, pode ficar em branco
    // para manter a atual.
    if (!editingPlayer && !senha) return;
    if (editingPlayer) {
      const data: Partial<Player> = editingPlayer.isGM
        ? { login, email }
        : { login, email, ...(senha ? { senha } : {}) };
      updatePlayer(editingPlayer.id, data);
    } else {
      addPlayer({ login, senha, email, acessos: defaultAcessos });
      toast.success("Usuário criado", {
        description: "Defina o que ele pode acessar na aba Permissões.",
        action: {
          label: "Definir permissões",
          onClick: () => navigate("/gm?tab=permissoes"),
        },
      });
    }
    setFormOpen(false);
  };

  const handleResetPassword = () => {
    if (!resetPasswordPlayer || newPassword.length < 4) return;
    updatePlayer(resetPasswordPlayer.id, { senha: newPassword });
    toast.success("Senha redefinida", {
      description: `Senha de ${resetPasswordPlayer.login} foi redefinida com sucesso.`,
    });
    setResetPasswordPlayer(null);
    setNewPassword("");
  };

  if (!isGM) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" /> Gerenciamento
        </h2>
        <div className="flex gap-2">
          {isGM && (
            <Button asChild variant="outline" size="sm">
              <Link to="/gm/saude">
                <Activity className="h-4 w-4 mr-1" /> Saúde do sistema
              </Link>
            </Button>
          )}
          {isGM && (
            <Button asChild variant="outline" size="sm">
              <Link to="/gm/auditoria">
                <History className="h-4 w-4 mr-1" /> Auditoria
              </Link>
            </Button>
          )}
          {isGM && (
            <Button asChild variant="outline" size="sm">
              <Link to="/gm/security-events">
                <ShieldAlert className="h-4 w-4 mr-1" /> Trilha de segurança
              </Link>
            </Button>
          )}
          {isGM && (
            <Button asChild variant="outline" size="sm">
              <Link to="/gm/feature-flags">
                <Flag className="h-4 w-4 mr-1" /> Feature flags
              </Link>
            </Button>
          )}
          {isGM && (
            <Button asChild variant="outline" size="sm">
              <Link to="/gm/cutover">
                <GitBranch className="h-4 w-4 mr-1" /> Cutover
              </Link>
            </Button>
          )}
          {isGM && (
            <Button variant="outline" size="sm" onClick={() => handleSeedDemo("create")}>
              <Sparkles className="h-4 w-4 mr-1" /> Obra de treino
            </Button>
          )}
          {isGM && (
            <Button onClick={openAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Usuário
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-2 mt-3">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg"
          >
            <div className="flex-1">
              <p className="font-medium flex items-center gap-2">
                {p.login}
                {p.isGM && <Badge className="text-[10px]">GM</Badge>}
              </p>
              {p.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Mail className="h-3.5 w-3.5" /> {p.email}
                </p>
              )}
            </div>
            {isGM && (
              <div className="flex gap-1">
                {!p.isGM && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(p)}
                    title="Visualizar como este usuário"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {!p.isGM && (
                  <Button asChild variant="ghost" size="sm" title="Gerenciar permissões">
                    <Link to={`/gm?tab=permissoes&user=${p.id}`}>
                      <Lock className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                {!p.isGM && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetPasswordPlayer(p);
                        setNewPassword("");
                      }}
                      title="Redefinir senha"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Player Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingPlayer ? "Editar Usuário" : "Adicionar Usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Login</Label>
              <Input value={login} onChange={(e) => setLogin(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1"
                disabled={editingPlayer?.isGM}
                placeholder={editingPlayer ? "Deixe em branco para manter a atual" : ""}
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="exemplo@email.com"
              />
            </div>
            {!editingPlayer?.isGM && (
              <p className="text-xs text-muted-foreground">
                Os acessos deste usuário são gerenciados na aba{" "}
                <Link to="/gm?tab=permissoes" className="underline text-primary">
                  Permissões
                </Link>
                .
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!login || (!editingPlayer && !senha)}>
              {editingPlayer ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordPlayer} onOpenChange={(v) => !v && setResetPasswordPlayer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Redefinir Senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Redefinir senha de <strong>{resetPasswordPlayer?.login}</strong>
          </p>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              placeholder="Mínimo 4 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordPlayer(null)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={newPassword.length < 4}>
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Excluir Player</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Deseja realmente excluir este player?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  deletePlayer(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GM;
