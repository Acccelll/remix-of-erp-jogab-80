import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePlayersContext } from "@/contexts/PlayersContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ChangePasswordDialog = ({ open, onOpenChange }: Props) => {
  const { currentPlayer } = useAuth();
  const { updatePlayer } = usePlayersContext();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!currentPlayer) return;
    if (senhaAtual !== currentPlayer.senha) {
      setError("Senha atual incorreta");
      return;
    }
    if (novaSenha.length < 4) {
      setError("A nova senha deve ter pelo menos 4 caracteres");
      return;
    }
    if (novaSenha !== confirmar) {
      setError("As senhas não coincidem");
      return;
    }
    updatePlayer(currentPlayer.id, { senha: novaSenha });
    toast.success("Senha alterada com sucesso");
    onOpenChange(false);
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmar("");
    setError("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSenhaAtual("");
          setNovaSenha("");
          setConfirmar("");
          setError("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Alterar Senha</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={senhaAtual}
              onChange={(e) => {
                setSenhaAtual(e.target.value);
                setError("");
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => {
                setNovaSenha(e.target.value);
                setError("");
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmar}
              onChange={(e) => {
                setConfirmar(e.target.value);
                setError("");
              }}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!senhaAtual || !novaSenha || !confirmar}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
