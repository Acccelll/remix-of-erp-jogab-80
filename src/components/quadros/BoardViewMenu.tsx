import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, Maximize2, Minimize2, Settings2 } from "lucide-react";
import type { SortDef } from "@/lib/quadros/sortAndGroup";

export interface BoardViewMenuProps<T> {
  sortOptions?: SortDef<T>[];
  sortBy: string;
  onSortByChange: (v: string) => void;

  allowGroupByFuncao?: boolean;
  groupByFunc: boolean;
  onGroupByFuncChange: (v: boolean) => void;

  columns: Array<{ id: string; label: string }>;
  hiddenColumns: Set<string>;
  onToggleColumn: (id: string) => void;
  onShowAllColumns: () => void;

  allowDensityToggle?: boolean;
  density: "compact" | "comfortable";
  onDensityChange: (d: "compact" | "comfortable") => void;

  allowSnapshot?: boolean;
  onSnapshot?: () => void;
}

/**
 * Unifies view-config controls (sort, group, columns, density, PNG snapshot) into a single popover.
 * Filters that change *which data is shown* live in BoardFiltersMenu instead.
 */
function BoardViewMenu<T>({
  sortOptions,
  sortBy,
  onSortByChange,
  allowGroupByFuncao,
  groupByFunc,
  onGroupByFuncChange,
  columns,
  hiddenColumns,
  onToggleColumn,
  onShowAllColumns,
  allowDensityToggle,
  density,
  onDensityChange,
  allowSnapshot,
  onSnapshot,
}: BoardViewMenuProps<T>) {
  const hasSort = sortOptions && sortOptions.length > 0;
  const hiddenCount = hiddenColumns.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          aria-label="Configurações de visualização"
        >
          <Settings2 className="h-4 w-4" /> Visualizar
          {(groupByFunc || hiddenCount > 0 || (hasSort && sortBy)) && (
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 space-y-3">
          {hasSort && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ordenar
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => onSortByChange("")}
                  className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-left"
                >
                  <Checkbox checked={!sortBy} className="pointer-events-none" />
                  <span>Padrão</span>
                </button>
                {sortOptions!.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSortByChange(opt.value)}
                    className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-left"
                  >
                    <Checkbox checked={sortBy === opt.value} className="pointer-events-none" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {allowGroupByFuncao && (
            <>
              <Separator />
              <label className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                <span>Agrupar por função</span>
                <Checkbox
                  checked={groupByFunc}
                  onCheckedChange={(v) => onGroupByFuncChange(!!v)}
                  aria-label="Agrupar por função"
                />
              </label>
            </>
          )}

          {allowDensityToggle && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Densidade
                </p>
                <ToggleGroup
                  type="single"
                  value={density}
                  onValueChange={(v) => v && onDensityChange(v as "compact" | "comfortable")}
                  className="justify-start"
                >
                  <ToggleGroupItem
                    value="compact"
                    size="sm"
                    aria-label="Compacto"
                    className="gap-1"
                  >
                    <Minimize2 className="h-3.5 w-3.5" /> Compacto
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="comfortable"
                    size="sm"
                    aria-label="Confortável"
                    className="gap-1"
                  >
                    <Maximize2 className="h-3.5 w-3.5" /> Confortável
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </>
          )}

          {columns.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Colunas{" "}
                    {hiddenCount > 0 && (
                      <span className="text-primary">
                        ({columns.length - hiddenCount}/{columns.length})
                      </span>
                    )}
                  </p>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={onShowAllColumns}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      Mostrar todas
                    </button>
                  )}
                </div>
                <ScrollArea className="h-48 -mx-1">
                  <div className="flex flex-col gap-0.5 px-1">
                    {columns.map((c) => {
                      const hidden = hiddenColumns.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onToggleColumn(c.id)}
                          className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-left"
                        >
                          <Checkbox checked={!hidden} className="pointer-events-none" />
                          <span className="truncate">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {allowSnapshot && onSnapshot && (
            <>
              <Separator />
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={onSnapshot}>
                <Camera className="h-4 w-4" /> Baixar PNG do quadro
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default BoardViewMenu;
