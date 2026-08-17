/**
 * /gm/security-events — Visualizador de trilha de segurança (SEC-007 slice-03).
 *
 * Acesso: apenas GM. Lista eventos de autenticação/autorização registrados
 * em `public.security_events`. Filtro por tipo e por sucesso feito no
 * servidor via `.eq()` + paginação `.range()`; busca textual atua sobre a
 * página corrente (email/origem/user_id).
 */
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ShieldAlert, RefreshCw, Search } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/contexts/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtData } from "@/lib/utils";

interface SecurityEventRow {
  id: string;
  tipo: string;
  user_id: string | null;
  email: string | null;
  ip: string | null;
  user_agent: string | null;
  origem: string | null;
  sucesso: boolean;
  metadata: unknown;
  created_at: string;
}

const TIPOS_CONHECIDOS = [
  "login_ok",
  "login_fail",
  "logout",
  "reauth",
  "authz_denied",
  "perm_change",
  "role_assigned",
  "role_revoked",
  "session_expired",
];

const tipoVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  login_ok: "secondary",
  login_fail: "destructive",
  logout: "outline",
  reauth: "secondary",
  authz_denied: "destructive",
  perm_change: "outline",
  role_assigned: "secondary",
  role_revoked: "destructive",
  session_expired: "outline",
};

const PAGE_SIZE = 50;

export default function GMSecurityEvents() {
  const { currentPlayer } = useAuth();
  const [filtroTipo, setFiltroTipo] = useState<string>("__all__");
  const [filtroSucesso, setFiltroSucesso] = useState<string>("__all__"); // __all__ | ok | fail
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["security_events", "page", page, filtroTipo, filtroSucesso],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async (): Promise<{ rows: SecurityEventRow[]; total: number }> => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("security_events")
        .select(
          "id, tipo, user_id, email, ip, user_agent, origem, sucesso, metadata, created_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (filtroTipo !== "__all__") q = q.eq("tipo", filtroTipo);
      if (filtroSucesso === "ok") q = q.eq("sucesso", true);
      if (filtroSucesso === "fail") q = q.eq("sucesso", false);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as SecurityEventRow[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.tipo.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.origem ?? "").toLowerCase().includes(q) ||
        (r.user_id ?? "").toLowerCase().includes(q) ||
        (r.ip ?? "").toLowerCase().includes(q),
    );
  }, [rows, busca]);

  if (!currentPlayer) return <Navigate to="/" replace />;
  if (!currentPlayer.isGM) return <Navigate to="/" replace />;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Trilha de Segurança
          </h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} eventos registrados` : "Eventos de autenticação e autorização"} em{" "}
            <code>security_events</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Tipo e sucesso filtram no servidor. Busca textual atua sobre a página atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select
            value={filtroTipo}
            onValueChange={(v) => {
              setFiltroTipo(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              {TIPOS_CONHECIDOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtroSucesso}
            onValueChange={(v) => {
              setFiltroSucesso(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="ok">Apenas sucesso</SelectItem>
              <SelectItem value="fail">Apenas falhas</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="buscar na página… (email, origem, ip, id)"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Eventos{" "}
            <span className="text-sm text-muted-foreground font-normal">
              ({filtradas.length} nesta página · {total} no total)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            data={filtradas}
            isEmpty={(d) => d.length === 0}
            onRetry={() => refetch()}
            empty={
              <EmptyState
                icon={ShieldAlert}
                title="Sem eventos"
                description="Nenhum evento para os filtros atuais."
              />
            }
          >
            {(list) => (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {list.map((r) => {
                    const variant = tipoVariant[r.tipo] ?? "outline";
                    return (
                      <div key={r.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={variant}>{r.tipo}</Badge>
                            {!r.sucesso && (
                              <Badge variant="destructive" className="text-[10px]">
                                falha
                              </Badge>
                            )}
                            {r.email && (
                              <span className="font-mono text-xs truncate">{r.email}</span>
                            )}
                            {r.origem && (
                              <span className="font-mono text-xs text-muted-foreground truncate">
                                · {r.origem}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {fmtData(r.created_at)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                          {r.user_id && <span>user: {r.user_id.slice(0, 8)}</span>}
                          {r.ip && <span>ip: {r.ip}</span>}
                          {r.user_agent && (
                            <span className="truncate max-w-[400px]">ua: {r.user_agent}</span>
                          )}
                        </div>
                        {r.metadata && Object.keys(r.metadata as object).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              metadata
                            </summary>
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto mt-2">
                              {JSON.stringify(r.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </QueryState>
          <PaginationControls
            page={page}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={isFetching}
          />
        </CardContent>
      </Card>
    </div>
  );
}
