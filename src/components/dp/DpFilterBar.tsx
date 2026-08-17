import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export interface DpFilters {
  competencia: string;
  obra: string;
  cargo: string;
  search: string;
}

interface Props {
  filters: DpFilters;
  setFilters: (f: DpFilters) => void;
  competencias: string[];
  obras: string[];
  cargos: string[];
  showCargo?: boolean;
  showObra?: boolean;
  showSearch?: boolean;
  rightSlot?: React.ReactNode;
}

export function formatCompetencia(c: string): string {
  if (!c || !/^\d{4}-\d{2}$/.test(c)) return c;
  const [y, m] = c.split("-");
  return `${m}/${y}`;
}

export default function DpFilterBar({
  filters,
  setFilters,
  competencias,
  obras,
  cargos,
  showCargo = true,
  showObra = true,
  showSearch = true,
  rightSlot,
}: Props) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border py-3 mb-4 flex flex-wrap gap-3 items-center">
      <div className="min-w-[160px]">
        <Select
          value={filters.competencia || "all"}
          onValueChange={(v) => setFilters({ ...filters, competencia: v === "all" ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas competências</SelectItem>
            {competencias.map((c) => (
              <SelectItem key={c} value={c}>
                {formatCompetencia(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showObra && (
        <div className="min-w-[200px]">
          <Select
            value={filters.obra || "all"}
            onValueChange={(v) => setFilters({ ...filters, obra: v === "all" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Obra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showCargo && (
        <div className="min-w-[180px]">
          <Select
            value={filters.cargo || "all"}
            onValueChange={(v) => setFilters({ ...filters, cargo: v === "all" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos cargos</SelectItem>
              {cargos.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar por nome ou CPF"
            className="pl-9"
          />
        </div>
      )}

      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
