/**
 * /gm (aba "Membros de Obra") — gestão do vínculo pessoa↔obra (`obra_membros`).
 *
 * Pré-requisito do Portal de Campo (system design §5.9): a RLS de RDO,
 * leitura de cronograma e criação de solicitação de material já é
 * obra-scoped via `user_em_obra(obra_id)`, que só depende de existir uma
 * linha aqui — não exige nenhum setor/PageKey novo. O que faltava era só
 * esta tela (só existia leitura no repositório antes disso).
 *
 * Acesso: apenas GM — mesma regra da RLS de escrita de `obra_membros`
 * ("obra_membros write gm"), então um não-GM só conseguiria ler a lista.
 */
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth/useAuth";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { obraMembrosRepo } from "@/lib/repositories/obras";
import { entidadesRepo } from "@/lib/repositories/kanbanExtensoes";

const PAPEL_LABEL: Record<string, string> = {
  gestor: "Gestor",
  membro: "Membro",
  observador: "Observador",
};

export default function GMMembrosObra() {
  const { isGM } = useAuth();
  const { obras } = useCatalogos();
  const qc = useQueryClient();

  const obrasAtivas = useMemo(() => obras.filter((o) => o.ativa), [obras]);
  const [obraId, setObraId] = useState<string>("");
  const [termo, setTermo] = useState("");
  const [papel, setPapel] = useState<"gestor" | "membro" | "observador">("membro");

  const membrosQ = useQuery({
    queryKey: ["obra-membros", obraId],
    queryFn: () => obraMembrosRepo.listByObra(obraId),
    enabled: !!obraId,
  });

  const buscaQ = useQuery({
    queryKey: ["obra-membros-busca-usuarios", termo],
    queryFn: () => entidadesRepo.buscarUsuarios(termo, 15),
    enabled: termo.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: (userId: string) => obraMembrosRepo.add(obraId, userId, papel),
    onSuccess: () => {
      toast.success("Vínculo criado.");
      setTermo("");
      qc.invalidateQueries({ queryKey: ["obra-membros", obraId] });
    },
    onError: (e) => toast.error((e as Error)?.message ?? "Falha ao vincular."),
  });

  const remover = useMutation({
    mutationFn: (userId: string) => obraMembrosRepo.remove(obraId, userId),
    onSuccess: () => {
      toast.success("Vínculo removido.");
      qc.invalidateQueries({ queryKey: ["obra-membros", obraId] });
    },
    onError: (e) => toast.error((e as Error)?.message ?? "Falha ao remover."),
  });

  if (!isGM) return <Navigate to="/" replace />;

  const membrosIds = new Set((membrosQ.data ?? []).map((m) => m.user_id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Vincula uma pessoa a uma obra — é esse vínculo que dá acesso a RDO, cronograma (leitura)
        e solicitação de material da obra no Portal de Campo, sem precisar de nenhum setor
        formal. Escolha a obra, busque a pessoa pelo login e adicione.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="max-w-sm">
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a obra" />
              </SelectTrigger>
              <SelectContent>
                {obrasAtivas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!obraId && (
            <p className="text-sm text-muted-foreground">Selecione uma obra para ver os membros.</p>
          )}

          {obraId && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar pessoa por login…"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                  />
                </div>
                <Select value={papel} onValueChange={(v) => setPapel(v as typeof papel)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAPEL_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {termo.trim().length >= 2 && (
                <div className="max-h-56 space-y-1 overflow-auto rounded-md border p-1">
                  {buscaQ.isLoading && (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                    </div>
                  )}
                  {!buscaQ.isLoading && (buscaQ.data ?? []).length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">Ninguém encontrado.</p>
                  )}
                  {(buscaQ.data ?? []).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={add.isPending || membrosIds.has(u.id)}
                      onClick={() => add.mutate(u.id)}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      <span className="truncate">
                        {u.nome}
                        {u.subtitulo ? ` · ${u.subtitulo}` : ""}
                      </span>
                      {membrosIds.has(u.id) ? (
                        <Badge variant="outline">já é membro</Badge>
                      ) : (
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-md border divide-y">
                {membrosQ.isLoading && (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando membros…
                  </div>
                )}
                {!membrosQ.isLoading && (membrosQ.data ?? []).length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum membro nesta obra ainda.</p>
                )}
                {(membrosQ.data ?? []).map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.nome || m.login || m.user_id}</div>
                      {m.login && <div className="truncate text-xs text-muted-foreground">{m.login}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{PAPEL_LABEL[m.papel] ?? m.papel}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Remover vínculo"
                        disabled={remover.isPending}
                        onClick={() => remover.mutate(m.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
