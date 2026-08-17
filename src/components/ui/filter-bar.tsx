import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * DS-015 — Barra de filtros padrão.
 *
 * Uso:
 *   <FilterBar
 *     search={q} onSearchChange={setQ}
 *     placeholder="Buscar por nome, CPF..."
 *     onClear={() => { setQ(""); setStatus("todos"); }}
 *   >
 *     <Select ... />
 *     <StatusMultiSelect ... />
 *   </FilterBar>
 *
 * Convenções:
 * - Search sempre à esquerda (esconde com `hideSearch`).
 * - Filtros (children) empilham à direita, com quebra responsiva.
 * - Botão "Limpar" aparece se `onClear` for informado.
 * - Actions (botões primários) ficam separadas com `actions`.
 */
export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  search?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  hideSearch?: boolean;
  onClear?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  (
    {
      className,
      search,
      onSearchChange,
      placeholder = "Buscar...",
      hideSearch,
      onClear,
      actions,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        data-slot="filter-bar"
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
          className,
        )}
        {...rest}
      >
        {!hideSearch ? (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={placeholder}
              className="pl-8"
              aria-label={placeholder}
            />
          </div>
        ) : null}

        {children ? (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        ) : null}

        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </Button>
        ) : null}

        {actions ? (
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    );
  },
);
FilterBar.displayName = "FilterBar";
