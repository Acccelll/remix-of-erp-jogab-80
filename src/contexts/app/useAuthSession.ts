import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { api, apiFetch } from "@/lib/api";
import { defaultPlayers, migratePlayers } from "@/contexts/app/helpers";
import { playerFromApi } from "@/contexts/app/mappers";
import { swallow } from "@/lib/core/errors";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { emailDoLogin } from "@/lib/auth/identidade";
import type { Player } from "@/types";
import { logger } from "@/lib/core/logger";
import { setSentryUser, setSentryTags } from "@/lib/sentry";
import { registrarLogin } from "@/lib/audit/loginLog";

interface UseAuthSessionArgs {
  currentPlayer: Player | null;
  setCurrentPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  players: Player[];
  dataLoaded: boolean;
}

/**
 * ARC-002/ARC-004 · Onda 6 — Encapsula autenticação e ciclo de sessão do
 * `AppContext`: `ensureSupabaseSession`, `login`, `logout`, hidratação de
 * `go_token`/`go_player` em reloads e invalidação/sync de sessão quando
 * o perfil é removido ou tem `acessos`/`isGM` alterados no servidor.
 *
 * Recebe `currentPlayer`/`setCurrentPlayer` para preservar a identidade
 * do estado dentro do provider (evita duplicar contexto).
 */
export function useAuthSession({
  currentPlayer,
  setCurrentPlayer,
  players,
  dataLoaded,
}: UseAuthSessionArgs) {
  const ensureSupabaseSession = useCallback(async (loginName: string, senha: string) => {
    const normalizedLogin = loginName.trim();
    const email = emailDoLogin(normalizedLogin);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (!error) return true;

      const localPlayer = migratePlayers(defaultPlayers).find(
        (player) =>
          player.login.trim().toLowerCase() === normalizedLogin.toLowerCase() &&
          player.senha.trim() === senha.trim(),
      );
      if (localPlayer) {
        const { error: provisionErr } = await supabase.functions.invoke("provision-auth-user", {
          body: {
            login: localPlayer.login,
            email,
            password: senha,
            is_gm: Boolean(localPlayer.isGM),
            acessos: localPlayer.acessos ?? {},
          },
        });
        if (!provisionErr) {
          const { error: provisionSignInErr } = await supabase.auth.signInWithPassword({
            email,
            password: senha,
          });
          if (!provisionSignInErr) return true;
          logger.error("supabase signIn (post-provision) failed:", provisionSignInErr);
        } else {
          logger.error("provision-auth-user failed:", provisionErr);
        }
      }

      const { error: syncErr } = await supabase.functions.invoke("sync-player-auth", {
        body: { login: normalizedLogin, senha },
      });
      if (syncErr) {
        logger.error("sync-player-auth failed:", syncErr);
        return false;
      }
      const { error: error2 } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error2) {
        logger.error("supabase signIn (post-sync) failed:", error2);
        return false;
      }
      return true;
    } catch (e) {
      logger.error("ensureSupabaseSession error:", e);
      return false;
    }
  }, []);

  // Hidrata sessão Supabase a partir do estado persistido em reloads.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("go_token")) {
      try {
        const raw = localStorage.getItem("go_player");
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.login && p?.senha) {
            supabase.auth.getSession().then(({ data }) => {
              if (!data.session) {
                ensureSupabaseSession(p.login, p.senha).catch(() => undefined);
              }
            });
          }
        }
      } catch (err) {
        swallow("useAuthSession.hydratePersisted", err, "estado persistido inválido");
      }
    }
  }, [ensureSupabaseSession]);

  // Persiste currentPlayer no localStorage.
  useEffect(() => {
    if (currentPlayer) localStorage.setItem("go_player", JSON.stringify(currentPlayer));
    else localStorage.removeItem("go_player");
  }, [currentPlayer]);

  // Invalidar sessão ao deletar perfil + sincronizar acessos/isGM do servidor.
  useEffect(() => {
    if (currentPlayer && !currentPlayer.isGM && dataLoaded) {
      const fresh = players.find((p) => p.id === currentPlayer.id);
      if (!fresh) {
        setCurrentPlayer(null);
        toast.error("Sessão encerrada", {
          description: "Seu perfil foi removido pelo administrador.",
        });
        return;
      }
      const accessosChanged =
        JSON.stringify(fresh.acessos) !== JSON.stringify(currentPlayer.acessos) ||
        fresh.isGM !== currentPlayer.isGM;
      if (accessosChanged) {
        setCurrentPlayer((prev) =>
          prev ? { ...prev, acessos: fresh.acessos, isGM: fresh.isGM } : prev,
        );
      }
    }
  }, [players, currentPlayer, dataLoaded, setCurrentPlayer]);

  const login = useCallback(
    async (u: string, p: string) => {
      const normalizedUser = u.trim();
      const normalizedPassword = p.trim();

      // Login real na API PHP — obtém token válido para as demais rotas.
      try {
        const result = await api.create("login", {
          username: normalizedUser,
          password: normalizedPassword,
        });
        if (result && !result.error && result.token) {
          const acessosLogin = { ...(result.acessos || {}) };
          if (
            result.acesso_contratos !== undefined &&
            result.acesso_contratos !== null &&
            result.acesso_contratos !== ""
          ) {
            acessosLogin.contratos = result.acesso_contratos;
          }
          const player: Player = {
            id: String(result.id),
            login: result.login,
            senha: normalizedPassword,
            email: result.email || "",
            isGM: Boolean(result.is_gm),
            acessos: acessosLogin,
            matrizPermissoes: result.matrizPermissoes ?? undefined,
            papeisPermissao: result.papeisPermissao ?? undefined,
          };
          const migrated = migratePlayers([{ ...player, token: result.token } as any])[0];
          setCurrentPlayer({ ...migrated, token: result.token } as any);
          localStorage.setItem("go_token", result.token);
          // Não bloqueia o login, mas também não pode falhar calado: sem sessão
          // no Supabase o menu e as permissões (que vêm do PHP) funcionam
          // normalmente e só os dados somem — o usuário via "página vazia" sem
          // nenhuma pista do que houve.
          void ensureSupabaseSession(normalizedUser, normalizedPassword)
            .then((ok) => {
              if (!ok) {
                toast.error("Login parcial: seus dados podem não aparecer", {
                  description:
                    "A sessão de dados não foi criada. Avise o administrador (GM) citando seu login.",
                  duration: 10000,
                });
              }
            })
            .catch((e) => logger.error("Supabase sync error:", e));
          setSentryUser({ id: player.id, login: player.login, email: player.email });
          setSentryTags({ role: player.isGM ? "gm" : "user", auth_via: "api" });
          void logSecurityEvent("login_ok", {
            email: player.email || null,
            metadata: { via: "api", login: normalizedUser },
          });
          registrarLogin({ userId: player.id, login: player.login, sucesso: true });
          return true;
        }
      } catch (err) {
        logger.error("API login error:", err);
      }

      // Fallback: compara com a lista em memória; se estiver vazia (usuário
      // não logado ainda), busca "usuarios" diretamente para permitir login
      // de usuários recém-criados sem depender do endpoint /login.
      let pool: Player[] = players;
      if (pool.length === 0) {
        try {
          const data = await apiFetch<any[]>("usuarios");
          pool = Array.isArray(data) ? migratePlayers(data.map(playerFromApi)) : [];
        } catch (err) {
          swallow("useAuthSession.login.fetchUsuarios", err, "fallback usuarios indisponível");
        }
      }
      if (pool.length === 0) {
        pool = migratePlayers(defaultPlayers);
      }
      // Senha vazia nunca autentica (protege contra seeds sem credencial).
      const player = pool.find(
        (pl) =>
          pl.login.trim() === normalizedUser &&
          pl.senha.trim() !== "" &&
          pl.senha.trim() === normalizedPassword,
      );
      if (player) {
        await ensureSupabaseSession(normalizedUser, normalizedPassword);
        setCurrentPlayer(migratePlayers([player])[0]);
        setSentryUser({ id: player.id, login: player.login, email: player.email });
        setSentryTags({ role: player.isGM ? "gm" : "user", auth_via: "pool_fallback" });
        void logSecurityEvent("login_ok", {
          email: player.email || null,
          metadata: { via: "pool_fallback", login: normalizedUser },
        });
        registrarLogin({ userId: player.id, login: player.login, sucesso: true });
        return true;
      }
      void logSecurityEvent("login_fail", {
        metadata: { login: normalizedUser, reason: "credenciais_invalidas" },
      });
      registrarLogin({ userId: "-", login: normalizedUser, sucesso: false });
      return false;
    },
    [players, ensureSupabaseSession, setCurrentPlayer],
  );

  const logout = useCallback(() => {
    const prevEmail = currentPlayer?.email ?? null;
    const prevId = currentPlayer?.id ?? null;
    setCurrentPlayer(null);
    localStorage.removeItem("go_token");
    supabase.auth.signOut().catch(() => undefined);
    setSentryUser(null);
    void logSecurityEvent("logout", {
      email: prevEmail,
      metadata: { player_id: prevId },
    });
  }, [currentPlayer, setCurrentPlayer]);

  return { ensureSupabaseSession, login, logout };
}
