import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronDown, History, ArrowRightLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { brl } from "@/lib/billing";

const ENTIDADES = [
  "todas",
  "medicoes",
  "itens_medicao",
  "notas_fiscais",
  "recebimentos",
  "cronograma_baselines",
  "aditivos_contrato",
];
const ACAO_COLORS: Record<string, any> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
};

function AuditoriaPanel({ obraId }: { obraId: string }) {
  const [filtro, setFiltro] = useState("todas");

  const { data: logs } = useQuery({
    queryKey: ["audit_logs", obraId, filtro],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, obra_id, entidade, acao, user_id, before, after, created_at")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filtro !== "todas") q = q.eq("entidade", filtro);
      return (await q).data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" /> Últimas 200 alterações
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTIDADES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!logs?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Sem registros.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(parseISO(l.created_at), "dd/MM/yy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-xs">{l.entidade}</TableCell>
                    <TableCell>
                      <Badge variant={ACAO_COLORS[l.acao]}>{l.acao}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {l.user_id ? l.user_id.slice(0, 8) : "—"}
                    </TableCell>
                    <TableCell>
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <ChevronDown className="h-3 w-3 mr-1" /> ver diff
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="text-[10px] bg-muted/40 p-2 rounded mt-2 overflow-auto max-w-2xl max-h-64">
                            {JSON.stringify({ before: l.before, after: l.after }, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RedistribuicaoPanel({ obraId }: { obraId: string }) {
  const { data: rows } = useQuery({
    queryKey: ["bms_redistribuicao_hist", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bms_redistribuicao")
        .select(
          "id, obra_id, bms_origem_numero, bms_destino_numero, descricao_item, valor_atrasado, valor_absorvido, motivo, created_at",
        )
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const totalAbsorvido = (rows ?? []).reduce((acc, r) => acc + Number(r.valor_absorvido ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Redistribuições entre BMS (origem → destino)
        </span>
        <span>
          Total absorvido: <strong>{brl(totalAbsorvido)}</strong>
        </span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!rows?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma redistribuição registrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Atrasado</TableHead>
                  <TableHead className="text-right">Absorvido</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(parseISO(r.created_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">BMS {r.bms_origem_numero}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>BMS {r.bms_destino_numero}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={r.descricao_item ?? ""}>
                      {r.descricao_item || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {brl(r.valor_atrasado)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-medium">
                      {brl(r.valor_absorvido)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.motivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function HistoricoTab({ obraId }: { obraId: string }) {
  return (
    <Tabs defaultValue="auditoria" className="w-full">
      <TabsList className="mb-3">
        <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        <TabsTrigger value="redistribuicao">Redistribuição</TabsTrigger>
      </TabsList>
      <TabsContent value="auditoria">
        <AuditoriaPanel obraId={obraId} />
      </TabsContent>
      <TabsContent value="redistribuicao">
        <RedistribuicaoPanel obraId={obraId} />
      </TabsContent>
    </Tabs>
  );
}
