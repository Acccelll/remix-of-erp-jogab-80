import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ColumnFilterHeaderProps<K extends string> {
  sortKey: K;
  currentKey?: K;
  dir: "asc" | "desc";
  onToggleSort: (k: K) => void;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;

  /** Valores distintos da coluna, já dedupados/ordenados pelo chamador. */
  options: string[];
  /** Valores selecionados. Vazio = sem filtro (mostra tudo). */
  selected: Set<string>;
  onChangeSelected: (next: Set<string>) => void;
}

export function ColumnFilterHeader<K extends string>({
  sortKey,
  currentKey,
  dir,
  onToggleSort,
  children,
  align = "left",
  className,
  options,
  selected,
  onChangeSelected,
}: ColumnFilterHeaderProps<K>) {
  const active = currentKey === sortKey;
  const SortIcon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  const filtroAtivo = selected.size > 0;

  function toggleValor(v: string) {
    const next = new Set(selected);
    // Se está "sem filtro" (vazio = todos), primeira ação desmarca o valor:
    // popula selected com todos menos v.
    if (next.size === 0) {
      for (const o of options) if (o !== v) next.add(o);
    } else if (next.has(v)) {
      next.delete(v);
    } else {
      next.add(v);
    }
    onChangeSelected(next);
  }
  function marcarTodos() {
    onChangeSelected(new Set());
  }
  function desmarcarTodos() {
    onChangeSelected(new Set(["__none__"]));
  }

  return (
    <TableHead
      className={cn(
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
        )}
      >
        <button
          type="button"
          onClick={() => onToggleSort(sortKey)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors",
            active && "text-foreground font-medium",
          )}
        >
          <span>{children}</span>
          <SortIcon className="h-3 w-3 opacity-60" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-5 w-5", filtroAtivo && "text-primary")}
              aria-label={`Filtrar coluna ${String(sortKey)}`}
            >
              <Filter className={cn("h-3 w-3", filtroAtivo && "fill-current")} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar valor..." />
              <CommandList>
                <div className="flex items-center justify-between px-2 py-1.5 text-xs border-b">
                  <button
                    type="button"
                    className="hover:underline text-primary"
                    onClick={marcarTodos}
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    className="hover:underline text-muted-foreground"
                    onClick={desmarcarTodos}
                  >
                    Desmarcar todos
                  </button>
                </div>
                <CommandGroup className="max-h-64 overflow-auto">
                  {options.map((v) => {
                    const marcado = selected.size === 0 ? true : selected.has(v);
                    return (
                      <CommandItem
                        key={v || "__vazio__"}
                        value={v || "(vazio)"}
                        onSelect={() => toggleValor(v)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox checked={marcado} className="pointer-events-none" />
                        <span className="truncate">{v || "(vazio)"}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </TableHead>
  );
}
