import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, Search, X } from "lucide-react";
import type { ExtraFilter } from "@/lib/quadros/sortAndGroup";

export interface BoardFiltersMenuProps<T> {
  availableFuncoes: string[];
  funcFilter: Set<string>;
  onToggleFuncao: (f: string) => void;
  onClearFuncoes: () => void;

  extraFilters?: ExtraFilter<T>[];
  extraFilterKeys: Set<string>;
  onToggleExtra: (key: string) => void;
  onClearExtras: () => void;
}

/**
 * Aggregates data filters (função + extras) under a single popover with an active count badge.
 */
function BoardFiltersMenu<T>({
  availableFuncoes,
  funcFilter,
  onToggleFuncao,
  onClearFuncoes,
  extraFilters,
  extraFilterKeys,
  onToggleExtra,
  onClearExtras,
}: BoardFiltersMenuProps<T>) {
  const [funcQuery, setFuncQuery] = React.useState("");
  const total = funcFilter.size + extraFilterKeys.size;
  const filteredFuncoes = React.useMemo(() => {
    const q = funcQuery.trim().toLowerCase();
    if (!q) return availableFuncoes;
    return availableFuncoes.filter((f) => f.toLowerCase().includes(q));
  }, [availableFuncoes, funcQuery]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={total > 0 ? "default" : "outline"}
          size="sm"
          className="gap-1"
          aria-label={`Filtros${total > 0 ? ` (${total} ativos)` : ""}`}
        >
          <Filter className="h-4 w-4" /> Filtros
          {total > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 space-y-3">
          {extraFilters && extraFilters.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Atalhos
                </p>
                {extraFilterKeys.size > 0 && (
                  <button
                    type="button"
                    onClick={onClearExtras}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {extraFilters.map((f) => {
                  const active = extraFilterKeys.has(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => onToggleExtra(f.key)}
                      className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-left"
                    >
                      <Checkbox checked={active} className="pointer-events-none" />
                      <span className="truncate">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableFuncoes.length > 0 && (
            <>
              {extraFilters && extraFilters.length > 0 && <Separator />}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Função{" "}
                    {funcFilter.size > 0 && (
                      <span className="text-primary">({funcFilter.size})</span>
                    )}
                  </p>
                  {funcFilter.size > 0 && (
                    <button
                      type="button"
                      onClick={onClearFuncoes}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={funcQuery}
                    onChange={(e) => setFuncQuery(e.target.value)}
                    placeholder="Buscar função…"
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <ScrollArea className="h-44 -mx-1">
                  <div className="flex flex-col gap-0.5 px-1">
                    {filteredFuncoes.length === 0 && (
                      <p className="px-2 py-2 text-xs text-muted-foreground">Nenhuma função.</p>
                    )}
                    {filteredFuncoes.map((f) => {
                      const active = funcFilter.has(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => onToggleFuncao(f)}
                          className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-left"
                        >
                          <Checkbox checked={active} className="pointer-events-none" />
                          <span className="truncate">{f}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {total > 0 && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1 text-muted-foreground"
                onClick={() => {
                  onClearFuncoes();
                  onClearExtras();
                }}
              >
                <X className="h-3.5 w-3.5" /> Limpar todos os filtros
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default BoardFiltersMenu;
