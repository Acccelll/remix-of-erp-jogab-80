import type { MouseEvent } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** Opções do seletor de itens à mostra. Só tem efeito com `onPageSizeChange`. */
  pageSizeOptions?: number[];
  /**
   * Habilita o seletor de itens à mostra, no centro do rodapé. Com ele, o
   * rodapé deixa de sumir quando tudo cabe numa página — o seletor precisa
   * estar sempre ao alcance, senão não há como voltar de "100 itens".
   */
  onPageSizeChange?: (pageSize: number) => void;
};

/**
 * Paginação padrão para listas client-side já filtradas.
 * Usa páginas 1-based para preservar os call sites existentes.
 */
export function PaginationControls({
  page,
  totalItems,
  pageSize,
  onPageChange,
  disabled = false,
  className,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const canPrevious = currentPage > 1 && !disabled;
  const canNext = currentPage < totalPages && !disabled;

  if (totalItems <= pageSize && !onPageSizeChange) return null;

  const goTo = (nextPage: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (disabled) return;
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  };

  const contagem = (
    <span className="text-muted-foreground">
      Mostrando {start}–{end} de {totalItems}
    </span>
  );

  const navegacao =
    totalPages > 1 ? (
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={!canPrevious}
              onClick={goTo(currentPage - 1)}
              className={!canPrevious ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive onClick={(event) => event.preventDefault()}>
              {currentPage}
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <span className="px-2 text-muted-foreground">de {totalPages}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={!canNext}
              onClick={goTo(currentPage + 1)}
              className={!canNext ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ) : null;

  if (!onPageSizeChange) {
    return (
      <div className={cn("flex items-center justify-between gap-3 text-sm", className)}>
        {contagem}
        {navegacao}
      </div>
    );
  }

  // Grid de três faixas em vez de `justify-between`: o seletor precisa ficar no
  // meio do rodapé, e com `justify-between` ele penderia para o lado sempre que
  // contagem e navegação tivessem larguras diferentes — que é o caso normal.
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm",
        className,
      )}
    >
      <div className="justify-self-start min-w-0 truncate">{contagem}</div>
      <div className="justify-self-center flex items-center gap-2">
        <span className="text-muted-foreground whitespace-nowrap">Itens à mostra</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-[76px]" aria-label="Itens à mostra">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="justify-self-end">{navegacao}</div>
    </div>
  );
}

export default PaginationControls;