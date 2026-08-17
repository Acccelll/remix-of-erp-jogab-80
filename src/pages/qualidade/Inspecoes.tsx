/**
 * Página de inspeções — listagem de modelos e histórico recente.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { inspecoesRepo, inspecaoModelosRepo } from "@/lib/repositories/inspecoes";
import { useAuth } from "@/contexts/auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  FileCheck2,
  PackageCheck,
  ShieldAlert,
  ClipboardList,
  Search,
} from "lucide-react";
import { fmtDataHora } from "@/lib/core/date";

interface ModeloRow {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: "fvs" | "fvm" | "recebimento" | "seguranca" | "qualidade" | "outros";
  setor: string | null;
  score_minimo: number | null;
}

interface InspecaoRow {
  id: string;
  modelo_id: string;
  status: string;
  score: number | null;
  aprovado: boolean | null;
  local: string | null;
  data_inspecao: string | null;
  created_at: string;
}

const CAT_LABEL: Record<ModeloRow["categoria"], string> = {
  fvs: "FVS — Serviço",
  fvm: "FVM — Material",
  recebimento: "Recebimento",
  seguranca: "Segurança",
  qualidade: "Qualidade",
  outros: "Outros",
};

const CAT_ICON: Record<ModeloRow["categoria"], React.ComponentType<{ className?: string }>> = {
  fvs: FileCheck2,
  fvm: ClipboardCheck,
  recebimento: PackageCheck,
  seguranca: ShieldAlert,
  qualidade: ClipboardList,
  outros: ClipboardList,
};

export default function Inspecoes() {
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const [filtro, setFiltro] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");

  const { data: modelos = [] } = useQuery({
    queryKey: ["inspecao-modelos"],
    queryFn: async () => {
      return (await inspecaoModelosRepo.listAtivos()) as ModeloRow[];
    },
  });

  const { data: recentes = [] } = useQuery({
    queryKey: ["inspecoes-recentes", currentPlayer?.id],
    queryFn: async () => {
      return (await inspecoesRepo.listRecentes(20)) as InspecaoRow[];
    },
  });

  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      if (categoria !== "todas" && m.categoria !== categoria) return false;
      if (filtro && !`${m.codigo} ${m.nome}`.toLowerCase().includes(filtro.toLowerCase()))
        return false;
      return true;
    });
  }, [modelos, filtro, categoria]);

  const modeloPorId = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inspeções</h1>
          <p className="text-sm text-muted-foreground">
            Modelos prontos de FVS, FVM, recebimento e segurança — captura offline-first em campo.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            <SelectItem value="fvs">FVS — Serviço</SelectItem>
            <SelectItem value="fvm">FVM — Material</SelectItem>
            <SelectItem value="recebimento">Recebimento</SelectItem>
            <SelectItem value="seguranca">Segurança</SelectItem>
            <SelectItem value="qualidade">Qualidade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Modelos disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {modelosFiltrados.map((m) => {
            const Icon = CAT_ICON[m.categoria];
            return (
              <Card key={m.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <Badge variant="outline" className="text-xs">
                      {CAT_LABEL[m.categoria]}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{m.nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.descricao}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.setor}</span>
                    {m.score_minimo != null && (
                      <span className="font-medium">Mín. {m.score_minimo}%</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/inspecoes/${m.id}`)}
                  >
                    Iniciar inspeção
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {modelosFiltrados.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
              Nenhum modelo encontrado.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Inspeções recentes</h2>
        {recentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma inspeção registrada ainda.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {recentes.map((i) => {
              const modelo = modeloPorId.get(i.modelo_id);
              return (
                <button
                  key={i.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                  onClick={() => navigate(`/inspecoes/${i.modelo_id}?inspecao=${i.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{modelo?.nome ?? i.modelo_id}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {i.local ?? "Sem local"} ·{" "}
                      {fmtDataHora(i.data_inspecao ?? i.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {i.score != null && (
                      <Badge variant={i.aprovado ? "default" : "destructive"}>
                        {i.score.toFixed(0)}%
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {i.status}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
