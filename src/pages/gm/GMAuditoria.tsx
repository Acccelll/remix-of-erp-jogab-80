/**
 * /gm/auditoria — Visualizador de audit_logs (H2.1).
 *
 * Acesso: apenas GM. Lista alterações registradas em public.audit_logs.
 * PERF-002.c — paginação server-side (Onda 4): filtro por entidade e paginação
 * são feitos no servidor via `.range()` + `count: "exact"`. A busca textual
 * atua sobre a página corrente (assumida barata; para busca global usar RPC).
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { History, RefreshCw, Search, LogIn } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/contexts/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtData } from "@/lib/utils";
import { listarLogins, listarLoginsRemoto, ultimosLoginsPorUsuario } from "@/lib/audit/loginLog";
import { apiFetch } from "@/lib/api";
import { usePlayersContext } from "@/contexts/PlayersContext";

interface AuditRow {
  id: string;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  obra_id: string | null;
  user_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

const acaoVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  insert: "secondary",
  create: "secondary",
  update: "outline",
  delete: "destructive",
};

const PAGE_SIZE = 50;

/** Lista fixa de entidades para o filtro (evita buscar todas as linhas só p/ preencher select). */
const ENTIDADES_CONHECIDAS = [
  "obras",
  "cards",
  "colaboradores",
  "notas_fiscais",
  "medicoes",
  "aditivos_contrato",
  "cronograma_marcos",
  "riscos",
  "ocorrencias",
];

export default function GMAuditoria() {
  const { currentPlayer } = useAuth();
  const { players } = usePlayersContext();
  const [filtroEntidade, setFiltroEntidade] = useState<string>("__all__");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1); // 1-based
  const [aba, setAba] = useState<"alteracoes" | "logins">("alteracoes");

  // Aba Logins: fonte canônica no MySQL (auditLogins), com fallback local.
  const loginsQuery = useQuery({
    queryKey: ["audit_logs", "logins"],
    staleTime: 30_000,
    queryFn: listarLoginsRemoto,
  });
  const logins = loginsQuery.data ?? listarLogins();
  const ultimosPorUsuario = useMemo(() => ultimosLoginsPorUsuario(logins), [logins]);

  // Aba Alterações: mescla as duas trilhas de auditoria — MySQL (mutações
  // do api.php, via rota auditLogs) e Supabase (triggers do trilho
  // remanescente) — ordenadas por data, com paginação client-side.
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["audit_logs", "merged", filtroEntidade],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async (): Promise<{ rows: AuditRow[]; total: number }> => {
      const [mysqlRows, supaRows] = await Promise.all([
        (async () => {
          try {
            const params: Record<string, string> = {};
            if (filtroEntidade !== "__all__") params.entidade = filtroEntidade;
            const data = await apiFetch<any[]>("auditLogs", { params });
            return (Array.isArray(data) ? data : []).map(
              (r): AuditRow => ({
                id: `mysql-${r.id}`,
                entidade: r.entidade,
                entidade_id: r.entidade_id ?? null,
                acao: r.acao,
                obra_id: null,
                user_id: r.user_login ?? r.user_id ?? null,
                before: r.before ?? null,
                after: r.after ?? null,
                created_at: r.created_at,
              }),
            );
          } catch {
            return [] as AuditRow[]; // rota/tabela ainda não publicada
          }
        })(),
        (async () => {
          let q = supabase
            .from("audit_logs")
            .select("id, entidade, entidade_id, acao, obra_id, user_id, before, after, created_at")
            .order("created_at", { ascending: false })
            .limit(1000);
          if (filtroEntidade !== "__all__") q = q.eq("entidade", filtroEntidade);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []) as AuditRow[];
        })(),
      ]);
      const merged = [...mysqlRows, ...supaRows].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      );
      return { rows: merged, total: merged.length };
    },
  });

  const todasLinhas = data?.rows ?? [];
  const total = data?.total ?? 0;
  const rows = useMemo(
    () => todasLinhas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [todasLinhas, page],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.entidade.toLowerCase().includes(q) ||
        r.acao.toLowerCase().includes(q) ||
        (r.entidade_id ?? "").toLowerCase().includes(q) ||
        (r.user_id ?? "").toLowerCase().includes(q),
    );
  }, [rows, busca]);

  if (!currentPlayer) return <Navigate to="/" replace />;
  if (!currentPlayer.isGM) return <Navigate to="/" replace />;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-6 w-6" />
            Auditoria
          </h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} alterações registradas` : "Alterações registradas"} em{" "}
            <code>audit_logs</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as "alteracoes" | "logins")}>
        <TabsList>
          <TabsTrigger value="alteracoes">
            <History className="h-4 w-4 mr-2" /> Alterações
          </TabsTrigger>
          <TabsTrigger value="logins">
            <LogIn className="h-4 w-4 mr-2" /> Logins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alteracoes" className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Entidade filtra no servidor. Busca textual atua sobre a página atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select
            value={filtroEntidade}
            onValueChange={(v) => {
              setFiltroEntidade(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todas as entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as entidades</SelectItem>
              {ENTIDADES_CONHECIDAS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="buscar na página… (entidade, ação, id)"
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
                icon={History}
                title="Sem registros"
                description="Nenhum evento para os filtros atuais."
              />
            }
          >
            {(list) => (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {list.map((r) => {
                    const variant = acaoVariant[r.acao?.toLowerCase()] ?? "outline";
                    return (
                      <div key={r.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={variant}>{r.acao}</Badge>
                            <span className="font-mono text-xs">{r.entidade}</span>
                            {r.entidade_id && (
                              <span className="font-mono text-xs text-muted-foreground truncate">
                                · {r.entidade_id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {fmtData(r.created_at)}
                          </span>
                        </div>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            before / after
                          </summary>
                          <div className="grid md:grid-cols-2 gap-2 mt-2">
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                              {JSON.stringify(r.before ?? null, null, 2)}
                            </pre>
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                              {JSON.stringify(r.after ?? null, null, 2)}
                            </pre>
                          </div>
                        </details>
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
        </TabsContent>

        <TabsContent value="logins" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Última vez online</CardTitle>
              <CardDescription>Por usuário registrado no sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {players.map((p) => {
                  const evt = ultimosPorUsuario.get(p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded border p-3 text-sm">
                      <div>
                        <div className="font-medium">{(p as any).nome ?? p.login}</div>
                        <div className="text-xs text-muted-foreground">@{p.login}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {evt ? fmtData(evt.createdAt) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de logins</CardTitle>
              <CardDescription>Eventos registrados neste navegador.</CardDescription>
            </CardHeader>
            <CardContent>
              {logins.length === 0 ? (
                <EmptyState icon={LogIn} title="Sem logins" description="Nenhum login registrado ainda." />
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {logins.map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between rounded border p-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={evt.sucesso ? "secondary" : "destructive"}>
                            {evt.sucesso ? "sucesso" : "falha"}
                          </Badge>
                          <span className="font-medium">{evt.login}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{fmtData(evt.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
