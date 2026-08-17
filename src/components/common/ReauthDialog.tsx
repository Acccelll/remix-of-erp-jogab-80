import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { swallow } from "@/lib/core/errors";

const API_BASE = import.meta.env.VITE_API_URL || "https://jogab.com.br/api.php";

/**
 * Modal global de re-login disparado quando o backend retorna 401.
 * Recebe um `resolve(success)` via CustomEvent("auth:expired") e
 * permite que `apiFetch` reenvie a request original.
 */
const ReauthDialog = () => {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ resolve: (ok: boolean) => void }>;
      resolveRef.current = ce.detail?.resolve || null;
      try {
        const player = localStorage.getItem("go_player");
        if (player) {
          const parsed = JSON.parse(player);
          if (parsed?.login) setUsername(parsed.login);
        }
      } catch (err) { swallow("ReauthDialog.loadPlayer", err, "player ausente"); }
      setPassword("");
      setOpen(true);
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  const finish = (ok: boolean) => {
    setOpen(false);
    setLoading(false);
    const r = resolveRef.current;
    resolveRef.current = null;
    r?.(ok);
  };

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error("Informe usuário e senha.");
      return;
    }
    setLoading(true);
    try {
      const url = new URL(API_BASE);
      url.searchParams.set("rota", "login");
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("Credenciais inválidas");
      const data = await res.json();
      if (!data?.token) throw new Error("Token não retornado");
      localStorage.setItem("go_token", data.token);
      try {
        const cur = localStorage.getItem("go_player");
        const merged = cur ? { ...JSON.parse(cur), ...data } : data;
        localStorage.setItem("go_player", JSON.stringify(merged));
      } catch {
        localStorage.setItem("go_player", JSON.stringify(data));
      }
      toast.success("Sessão renovada.");
      finish(true);
    } catch (err: any) {
      toast.error(err?.message || "Falha no login.");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    toast.error("Sessão expirada. Faça login novamente.");
    localStorage.removeItem("go_token");
    localStorage.removeItem("go_player");
    finish(false);
    // Redireciona para a tela de login
    setTimeout(() => {
      window.location.href = "/";
    }, 300);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sessão expirada</DialogTitle>
          <DialogDescription>
            Sua sessão expirou. Faça login novamente para continuar de onde parou.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="reauth-user">Usuário</Label>
            <Input
              id="reauth-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="reauth-pass">Senha</Label>
            <Input
              id="reauth-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleLogin} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReauthDialog;
