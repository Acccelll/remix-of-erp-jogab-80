import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/contexts/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Shield, HelpCircle } from "lucide-react";
import { logger } from "@/lib/core/logger";

// DS-001 — schemas locais deste formulário (autenticação não tem entidade de domínio em lib/schemas).
const loginSchema = z.object({
  username: z.string().trim().min(1, "Informe o e-mail ou usuário"),
  password: z.string().min(1, "Informe a senha"),
});
type LoginValues = z.infer<typeof loginSchema>;

const forgotSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});
type ForgotValues = z.infer<typeof forgotSchema>;

/** Só aceita caminho relativo de mesma origem, evitando open redirect. */
function destinoSeguro(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

const Login = () => {
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotErr, setForgotErr] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = destinoSeguro(searchParams.get("next"));

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setError("");
    try {
      const ok = await login(values.username, values.password);
      if (ok) {
        // Rotas externas ao router (ex.: consentimento OAuth) precisam de navegação dura.
        if (next !== "/") window.location.href = next;
        else navigate("/");
      } else {
        setError("E-mail ou senha inválidos. Verifique suas credenciais.");
      }
    } catch (err) {
      logger.error("Login error:", err);
      setError("Erro ao conectar ao servidor. Tente novamente.");
    }
  };


  const onForgot = async (values: ForgotValues) => {
    setForgotErr("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setForgotErr(error.message);
      } else {
        setForgotSent(true);
      }
    } catch {
      setForgotErr("Falha ao enviar o e-mail de redefinição.");
    }
  };

  const loading = form.formState.isSubmitting;
  const forgotLoading = forgotForm.formState.isSubmitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-3">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">Planifik</CardTitle>
          <p className="text-sm text-muted-foreground">Acesse sua conta</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail ou usuário</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        autoFocus
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="voce@empresa.com ou usuário"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setError("");
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setError("");
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                  <Shield className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </Form>
          <button
            type="button"
            onClick={() => {
              setForgotOpen(true);
              setForgotSent(false);
              setForgotErr("");
              forgotForm.reset({ email: form.getValues("username") });
            }}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Esqueci minha senha
          </button>
        </CardContent>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Redefinir senha</DialogTitle>
          </DialogHeader>
          {forgotSent ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Enviamos um link de redefinição para{" "}
                <strong className="text-foreground">{forgotForm.getValues("email")}</strong>.
                Verifique sua caixa de entrada (e o spam) e clique no link para escolher uma nova
                senha.
              </p>
              <Button variant="outline" onClick={() => setForgotOpen(false)} className="w-full">
                Fechar
              </Button>
            </div>
          ) : (
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Informe o e-mail da sua conta. Enviaremos um link seguro para você definir uma
                  nova senha.
                </p>
                <FormField
                  control={forgotForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="voce@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {forgotErr && <p className="text-sm text-destructive">{forgotErr}</p>}
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? "Enviando..." : "Enviar link"}
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
