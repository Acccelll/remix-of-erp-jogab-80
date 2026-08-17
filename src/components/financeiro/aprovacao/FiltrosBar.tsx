import { RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusFilter from "@/components/common/StatusFilter";
import ObrasFilter from "@/components/common/ObrasFilter";
import { SETORES, STATUS_OPTIONS } from "./types";

export type PagPendenteFilter = "todos" | "pendente" | "nao_pendente";

export interface FiltrosBarProps {
  search: string;
  onSearch: (v: string) => void;
  statusSelecionados: Set<string>;
  onStatusChange: (v: Set<string>) => void;
  setoresSelecionados: Set<string>;
  onSetoresChange: (v: Set<string>) => void;
  obrasOptions: { id: string; nome: string }[];
  obrasSelecionadas: Set<string>;
  onObrasChange: (v: Set<string>) => void;
  pagPendenteFilter: PagPendenteFilter;
  onPagPendenteChange: (v: PagPendenteFilter) => void;
  dataPagFrom: string;
  onDataPagFrom: (v: string) => void;
  dataPagTo: string;
  onDataPagTo: (v: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

const SETORES_OPTIONS = SETORES.map((s) => ({ value: s, label: s }));

export function FiltrosBar({
  search,
  onSearch,
  statusSelecionados,
  onStatusChange,
  setoresSelecionados,
  onSetoresChange,
  obrasOptions,
  obrasSelecionadas,
  onObrasChange,
  pagPendenteFilter,
  onPagPendenteChange,
  dataPagFrom,
  onDataPagFrom,
  dataPagTo,
  onDataPagTo,
  loading,
  onRefresh,
}: FiltrosBarProps) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar setor, solicitante, data, prioridade..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <StatusFilter
        options={STATUS_OPTIONS}
        selected={statusSelecionados}
        onChange={onStatusChange}
        label="Status"
      />
      <StatusFilter
        options={SETORES_OPTIONS}
        selected={setoresSelecionados}
        onChange={onSetoresChange}
        label="Setor"
      />
      <ObrasFilter obras={obrasOptions} selected={obrasSelecionadas} onChange={onObrasChange} />
      <Select
        value={pagPendenteFilter}
        onValueChange={(v) => onPagPendenteChange(v as PagPendenteFilter)}
      >
        <SelectTrigger className="h-9 w-[180px] text-xs">
          <SelectValue placeholder="Pagamento Pendente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Pagto. Pendente</SelectItem>
          <SelectItem value="pendente">Somente pendentes</SelectItem>
          <SelectItem value="nao_pendente">Não pendentes</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1 ml-auto">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Pgto. de</Label>
        <DatePickerField
          value={dataPagFrom}
          onChange={(v) => onDataPagFrom(v)}
          className="w-[140px]"
          inputClassName="h-9 text-xs"
        />
        <Label className="text-xs text-muted-foreground whitespace-nowrap">até</Label>
        <DatePickerField
          value={dataPagTo}
          onChange={(v) => onDataPagTo(v)}
          className="w-[140px]"
          inputClassName="h-9 text-xs"
        />
        {(dataPagFrom || dataPagTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDataPagFrom("");
              onDataPagTo("");
            }}
            className="h-9 px-2 text-xs"
          >
            Limpar
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Atualizar resultados"
          onClick={onRefresh}
          disabled={loading}
          title="Atualizar resultados"
          className="h-9 w-9"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
