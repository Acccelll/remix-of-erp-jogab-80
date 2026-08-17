/**
 * FiltrosCardsPanel — H4.1
 * Popover de filtros do board (etiqueta, responsável, prazo, setor,
 * sem responsável, checklist incompleto). Aplica via callback;
 * o pai persiste em `?filters=<base64-json>`.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { type FiltrosCards, type PrazoFiltro, temFiltrosAtivos } from "@/lib/cards/filtrosCards";

const SENTINEL = "__todos__";

interface OpcaoLabel {
  id: string;
  nome: string;
  cor: string;
}
interface OpcaoResp {
  id: string;
  nome: string;
}

interface Props {
  value: FiltrosCards;
  onChange: (f: FiltrosCards) => void;
  labelsDisponiveis: OpcaoLabel[];
  responsaveisDisponiveis: OpcaoResp[];
  setoresDisponiveis: string[];
}

export default function FiltrosCardsPanel({
  value,
  onChange,
  labelsDisponiveis,
  responsaveisDisponiveis,
  setoresDisponiveis,
}: Props) {
  const ativos = useMemo(() => {
    const out: string[] = [];
    if (value.etiquetaId) {
      const l = labelsDisponiveis.find((x) => x.id === value.etiquetaId);
      out.push(`etiq: ${l?.nome ?? "?"}`);
    }
    if (value.responsavelId) {
      const r = responsaveisDisponiveis.find((x) => x.id === value.responsavelId);
      out.push(`resp: ${r?.nome ?? "?"}`);
    }
    if (value.setor) out.push(`setor: ${value.setor}`);
    if (value.prazo) out.push(`prazo: ${value.prazo}`);
    if (value.semResponsavel) out.push("sem responsável");
    if (value.checklistIncompleto) out.push("checklist incompleto");
    return out;
  }, [value, labelsDisponiveis, responsaveisDisponiveis]);

  const tem = temFiltrosAtivos(value);

  function set<K extends keyof FiltrosCards>(k: K, v: FiltrosCards[K]) {
    onChange({ ...value, [k]: v });
  }

  function limpar() {
    onChange({});
  }

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" title="Filtros">
            <Filter className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Filtros</span>
            {tem && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {ativos.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Etiqueta</Label>
            <Select
              value={value.etiquetaId ?? SENTINEL}
              onValueChange={(v) => set("etiquetaId", v === SENTINEL ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Qualquer etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL}>Qualquer etiqueta</SelectItem>
                {labelsDisponiveis.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Responsável</Label>
            <Select
              value={value.responsavelId ?? SENTINEL}
              onValueChange={(v) => set("responsavelId", v === SENTINEL ? undefined : v)}
              disabled={!!value.semResponsavel}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Qualquer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL}>Qualquer</SelectItem>
                {responsaveisDisponiveis.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Setor</Label>
            <Select
              value={value.setor ?? SENTINEL}
              onValueChange={(v) => set("setor", v === SENTINEL ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Qualquer setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL}>Qualquer setor</SelectItem>
                {setoresDisponiveis.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prazo</Label>
            <Select
              value={value.prazo || SENTINEL}
              onValueChange={(v) => set("prazo", v === SENTINEL ? "" : (v as PrazoFiltro))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Qualquer prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL}>Qualquer prazo</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Próxima semana</SelectItem>
                <SelectItem value="sem-prazo">Sem prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="f-sem-resp"
              checked={!!value.semResponsavel}
              onCheckedChange={(c) => set("semResponsavel", !!c)}
            />
            <Label htmlFor="f-sem-resp" className="text-xs cursor-pointer">
              Sem responsável
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="f-chk"
              checked={!!value.checklistIncompleto}
              onCheckedChange={(c) => set("checklistIncompleto", !!c)}
            />
            <Label htmlFor="f-chk" className="text-xs cursor-pointer">
              Checklist incompleto
            </Label>
          </div>

          {tem && (
            <div className="border-t pt-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={limpar}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {tem && (
        <button
          type="button"
          onClick={limpar}
          title="Limpar filtros"
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          limpar
        </button>
      )}
    </div>
  );
}
