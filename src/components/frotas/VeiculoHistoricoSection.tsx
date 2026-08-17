import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Filter, X, Building2, History } from "lucide-react";
import { Veiculo, Obra, HistoricoEntry } from "@/types";

const PAGE_SIZE = 20;

interface Props {
  veiculo: Veiculo;
  /** Períodos vindos da rota dedicada (opcional). Se ausente/erro, derivamos de veiculo.historico. */
  mobPeriodos?: any[];
  obras: Obra[];
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type EventoUnificado = {
  id: string;
  tipo: "mobilizacao" | "outro";
  data: string;
  dataFim?: string | null;
  descricao: string;
  obraId?: string | null;
  obraNome?: string | null;
  usuario?: string;
  dias?: number;
  /** Período sintético criado a partir de obraAtualId quando não há mobilização inicial registrada. */
  sintetico?: boolean;
};

function parseBRDate(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yr = Number(y);
    if (yr < 1900 || yr > 2200) return null;
    return `${y}-${mo}-${d}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function diasInclusivos(inicioISO: string, fimISO?: string | null): number {
  const ini = new Date(`${inicioISO}T00:00:00`);
  const fim = fimISO ? new Date(`${fimISO}T00:00:00`) : new Date();
  const fimNorm = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  const iniNorm = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
  const ms = fimNorm.getTime() - iniNorm.getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

function parseMobilizacaoDescricao(
  descricao: string,
  obras: Obra[],
): { obraDestino?: Obra; dataISO?: string | null } {
  if (!descricao) return {};
  const m = descricao.match(/para\s+"?(.+?)"?\s+em\s+(\d{2}\/\d{2}\/\d{4})/i);
  let obraDestinoNome: string | undefined;
  let dataISO: string | null | undefined;
  if (m) {
    obraDestinoNome = m[1].trim().replace(/^"|"$/g, "");
    dataISO = parseBRDate(m[2]);
  }

  let obraDestino: Obra | undefined;
  if (obraDestinoNome) {
    obraDestino = obras.find((o) => o.nome.toLowerCase() === obraDestinoNome!.toLowerCase());
    if (!obraDestino) {
      obraDestino = obras.find(
        (o) =>
          obraDestinoNome!.toLowerCase().includes(o.nome.toLowerCase()) ||
          o.nome.toLowerCase().includes(obraDestinoNome!.toLowerCase()),
      );
    }
  }
  return { obraDestino, dataISO };
}

const VeiculoHistoricoSection: React.FC<Props> = ({ veiculo, mobPeriodos, obras }) => {
  const [filtroObra, setFiltroObra] = useState<string>("all");
  const [filtroMes, setFiltroMes] = useState<string>("all");
  const [filtroAno, setFiltroAno] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  const eventos = useMemo<EventoUnificado[]>(() => {
    const list: EventoUnificado[] = [];

    const periodos = Array.isArray(mobPeriodos) ? mobPeriodos : [];
    if (periodos.length > 0) {
      periodos.forEach((p: any) => {
        const inicio = parseBRDate(p.data_inicio);
        const fim = parseBRDate(p.data_fim);
        if (!inicio) return;
        list.push({
          id: `mob-${p.id}`,
          tipo: "mobilizacao",
          data: inicio,
          dataFim: fim,
          descricao: `Mobilizado em ${p.obra_nome || "Obra"}`,
          obraId: p.obra_id ? String(p.obra_id) : null,
          obraNome: p.obra_nome || null,
          dias: diasInclusivos(inicio, fim),
        });
      });
    } else {
      const movs = (veiculo.historico || [])
        .filter((h) => h.tipo === "mobilizacao")
        .map((h) => {
          const { obraDestino, dataISO } = parseMobilizacaoDescricao(h.descricao, obras);
          const dataFinal = dataISO || parseBRDate(h.data);
          return { entry: h, obraDestino, dataISO: dataFinal };
        })
        .filter((m) => !!m.dataISO)
        .sort((a, b) => (a.dataISO! < b.dataISO! ? -1 : 1));

      movs.forEach((m, i) => {
        const proximo = movs[i + 1];
        let dataFim: string | null = null;
        if (proximo) {
          const fimDate = new Date(`${proximo.dataISO!}T00:00:00`);
          fimDate.setDate(fimDate.getDate() - 1);
          const y = fimDate.getFullYear();
          const mo = String(fimDate.getMonth() + 1).padStart(2, "0");
          const d = String(fimDate.getDate()).padStart(2, "0");
          dataFim = `${y}-${mo}-${d}`;
        }
        list.push({
          id: `mob-${m.entry.id}`,
          tipo: "mobilizacao",
          data: m.dataISO!,
          dataFim,
          descricao: `Mobilizado em ${m.obraDestino?.nome || "Obra"}`,
          obraId: m.obraDestino?.id || null,
          obraNome: m.obraDestino?.nome || null,
          usuario: m.entry.usuario,
          dias: diasInclusivos(m.dataISO!, dataFim),
        });
      });
    }

    (veiculo.historico || []).forEach((h: HistoricoEntry) => {
      if (h.tipo === "mobilizacao") return;
      const obraMatch = obras.find((o) =>
        h.descricao?.toLowerCase().includes(o.nome.toLowerCase()),
      );
      const dataISO = parseBRDate(h.data) || h.data;
      list.push({
        id: h.id,
        tipo: "outro",
        data: dataISO,
        descricao: h.descricao,
        obraId: obraMatch?.id || null,
        obraNome: obraMatch?.nome || null,
        usuario: h.usuario,
      });
    });

    list.sort((a, b) => (a.data < b.data ? 1 : -1));

    const obraAtualId = veiculo.obraAtualId;
    if (obraAtualId) {
      const periodoAberto = list.find(
        (e) => e.tipo === "mobilizacao" && (!e.dataFim || e.dataFim === null),
      );
      if (!periodoAberto || periodoAberto.obraId !== obraAtualId) {
        const obra = obras.find((o) => o.id === obraAtualId);
        if (obra) {
          list.unshift({
            id: `mob-base-${obraAtualId}`,
            tipo: "mobilizacao",
            data: "",
            dataFim: null,
            descricao: `Mobilizado em ${obra.nome}`,
            obraId: obra.id,
            obraNome: obra.nome,
            dias: 0,
            sintetico: true,
          });
        }
      }
    }

    return list;
  }, [mobPeriodos, veiculo.historico, veiculo.obraAtualId, obras]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    eventos.forEach((e) => {
      if (e.data) {
        const y = Number(e.data.slice(0, 4));
        if (!Number.isNaN(y)) anos.add(y);
      }
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [eventos]);

  const obrasNoHistorico = useMemo(() => {
    const ids = new Set<string>();
    eventos.forEach((e) => {
      if (e.obraId) ids.add(e.obraId);
    });
    return obras.filter((o) => ids.has(o.id));
  }, [eventos, obras]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((e) => {
      if (filtroObra !== "all" && e.obraId !== filtroObra) return false;
      if (filtroTipo !== "all" && e.tipo !== filtroTipo) return false;
      if (!e.data) {
        if (filtroAno !== "all" || filtroMes !== "all") return false;
        return true;
      }
      const y = Number(e.data.slice(0, 4));
      const mo = Number(e.data.slice(5, 7)) - 1;
      if (filtroAno !== "all" && y !== Number(filtroAno)) return false;
      if (filtroMes !== "all" && mo !== Number(filtroMes)) return false;
      return true;
    });
  }, [eventos, filtroObra, filtroMes, filtroAno, filtroTipo]);

  useEffect(() => {
    setPage(1);
  }, [filtroObra, filtroMes, filtroAno, filtroTipo]);

  const totalPages = Math.max(1, Math.ceil(eventosFiltrados.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const eventosPagina = eventosFiltrados.slice(start, start + PAGE_SIZE);

  const mobilizacoesFiltradas = eventosPagina.filter((e) => e.tipo === "mobilizacao");
  const outrosFiltrados = eventosPagina.filter((e) => e.tipo === "outro");

  const totalDias = eventosFiltrados
    .filter((e) => e.tipo === "mobilizacao")
    .reduce((s, m) => s + (m.dias || 0), 0);

  const clearFilters = () => {
    setFiltroObra("all");
    setFiltroMes("all");
    setFiltroAno("all");
    setFiltroTipo("all");
  };

  const hasFilters =
    filtroObra !== "all" || filtroMes !== "all" || filtroAno !== "all" || filtroTipo !== "all";

  const formatBR = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtros</span>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Obra</Label>
            <Select value={filtroObra} onValueChange={setFiltroObra}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as obras</SelectItem>
                {obrasNoHistorico.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="mobilizacao">Mobilizações</SelectItem>
                <SelectItem value="outro">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {mobilizacoesFiltradas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Mobilizações
            </h3>
            <Badge variant="secondary" className="text-xs">
              {mobilizacoesFiltradas.length} período(s) — {totalDias} dias
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {mobilizacoesFiltradas.map((m) => (
              <Card key={m.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">
                    {m.obraNome || "Obra"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">{m.sintetico ? "—" : `${m.dias} dias`}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.data ? formatBR(m.data) : "—"} — {m.dataFim ? formatBR(m.dataFim) : "Atual"}
                  </p>
                  {m.sintetico && (
                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                      Mobilização inicial não registrada
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {outrosFiltrados.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <History className="h-4 w-4" /> Outros eventos
            <Badge variant="secondary" className="text-xs ml-auto">
              {outrosFiltrados.length}
            </Badge>
          </h3>
          <div className="space-y-2">
            {outrosFiltrados.map((h) => (
              <div key={h.id} className="flex gap-3 p-3 rounded-lg border border-border">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{h.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBR(h.data)}
                    {h.usuario && ` — por ${h.usuario}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {eventosFiltrados.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum registro encontrado{hasFilters ? " com os filtros aplicados" : ""}.
        </p>
      )}

      <PaginationControls
        page={currentPage}
        totalItems={eventosFiltrados.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="pt-2 border-t border-border text-xs"
      />
    </div>
  );
};

export default VeiculoHistoricoSection;
