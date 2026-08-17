import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Shield, CheckCircle2 } from "lucide-react";

/**
 * Página pública de redefinição de senha.
 * Acessada pelo link enviado por `supabase.auth.resetPasswordForEmail`,
 * que devolve com `type=recovery` no hash da URL e cria uma sessão
 * temporária só para permitir `updateUser({ password })`.
 */
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // O cliente Supabase processa o hash `#access_token=...&type=recovery`
    // automaticamente e dispara onAuthStateChange com event=PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasSession(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw1.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (pw1 !== pw2) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password: pw1 });
    setLoading(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setDone(true);
    // Encerra a sessão de recovery — usuário vai logar de novo com a senha nova.
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login", { replace: true }), 2500);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-3">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">Nova senha</CardTitle>
          <p className="text-sm text-muted-foreground">Defina sua nova senha de acesso</p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm">Senha atualizada com sucesso. Redirecionando para o login…</p>
            </div>
          ) : !hasSession ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Este link expirou ou é inválido. Volte ao login e solicite um novo link em{" "}
                <strong className="text-foreground">Esqueci minha senha</strong>.
              </p>
              <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={pw1}
                  onChange={(e) => {
                    setPw1(e.target.value);
                    setError("");
                  }}
                  className="mt-1"
                  autoFocus
                  minLength={8}
                />
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <Input
                  type="password"
                  value={pw2}
                  onChange={(e) => {
                    setPw2(e.target.value);
                    setError("");
                  }}
                  className="mt-1"
                  minLength={8}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
