import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { norm } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/common/PaginationControls";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  searchPlaceholder?: string;
  /** disable global search bar */
  hideSearch?: boolean;
  /** rows per page (default 25) */
  pageSize?: number;
  /** click handler for the entire row */
  onRowClick?: (row: TData) => void;
  /** custom empty state rendered when there are 0 filtered rows */
  emptyState?: React.ReactNode;
  /** label shown left of search ("12 obras (de 30)") */
  countLabel?: (filtered: number, total: number) => React.ReactNode;
  /** initial sorting */
  initialSorting?: SortingState;
  /** Controlled global filter (e.g. synced to URL). */
  globalFilter?: string;
  onGlobalFilterChange?: (v: string) => void;
  /** Controlled sorting (e.g. synced to URL). */
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  /** Controlled page index (0-based). */
  pageIndex?: number;
  onPageIndexChange?: (i: number) => void;
  /** Controlled column visibility. */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (v: VisibilityState) => void;
  /** Extra toolbar slot rendered between count and search. */
  toolbar?: React.ReactNode;
  /**
   * Server-driven pagination (PERF-002.c).
   * Quando true, `data` já contém APENAS a página corrente e o filtro/ordenação
   * são responsabilidade do call site (via `pageIndex`/`onPageIndexChange`).
   * `totalItems` deve refletir a contagem total no servidor.
   */
  manualPagination?: boolean;
  /** Total no servidor. Obrigatório com `manualPagination`. */
  totalItems?: number;
  /** Optional dynamic className for each row. */
  rowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Buscar…",
  hideSearch = false,
  pageSize = 25,
  onRowClick,
  emptyState,
  countLabel,
  initialSorting = [],
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  sorting: sortingProp,
  onSortingChange,
  pageIndex: pageIndexProp,
  onPageIndexChange,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  toolbar,
  manualPagination = false,
  totalItems,
  rowClassName,
}: DataTableProps<TData>) {
  const [sortingInternal, setSortingInternal] = React.useState<SortingState>(initialSorting);
  const [globalFilterInternal, setGlobalFilterInternal] = React.useState("");
  const [pageIndexInternal, setPageIndexInternal] = React.useState(0);

  const sorting = sortingProp ?? sortingInternal;
  const setSorting = (updater: any) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    if (onSortingChange) onSortingChange(next);
    else setSortingInternal(next);
  };
  const globalFilter = globalFilterProp ?? globalFilterInternal;
  const setGlobalFilter = (updater: any) => {
    const next = typeof updater === "function" ? updater(globalFilter) : updater;
    if (onGlobalFilterChange) onGlobalFilterChange(next);
    else setGlobalFilterInternal(next);
    // reset page on filter change
    if (onPageIndexChange) onPageIndexChange(0);
    else setPageIndexInternal(0);
  };
  const pageIndex = pageIndexProp ?? pageIndexInternal;
  const setPageIndex = (updater: any) => {
    const next = typeof updater === "function" ? updater(pageIndex) : updater;
    if (onPageIndexChange) onPageIndexChange(next);
    else setPageIndexInternal(next);
  };
  const [columnVisibilityInternal, setColumnVisibilityInternal] = React.useState<VisibilityState>(
    {},
  );
  const columnVisibility = columnVisibilityProp ?? columnVisibilityInternal;
  const setColumnVisibility = (updater: any) => {
    const next = typeof updater === "function" ? updater(columnVisibility) : updater;
    if (onColumnVisibilityChange) onColumnVisibilityChange(next);
    else setColumnVisibilityInternal(next);
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination: { pageIndex, pageSize }, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const prev = { pageIndex, pageSize };
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      setPageIndex(next.pageIndex);
    },
    manualPagination,
    manualFiltering: manualPagination,
    manualSorting: manualPagination,
    pageCount: manualPagination
      ? Math.max(1, Math.ceil((totalItems ?? 0) / Math.max(1, pageSize)))
      : undefined,
    globalFilterFn: (row, _columnId, value) => {
      const term = norm(value);
      if (!term) return true;
      const hay = norm(
        Object.values(row.original as any)
          .map((v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)))
          .join(" "),
      );
      return hay.includes(term);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualPagination ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualPagination ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });

  const total = manualPagination ? (totalItems ?? data.length) : data.length;
  const filtered = manualPagination
    ? (totalItems ?? data.length)
    : table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  return (
    <div className="space-y-3">
      {!hideSearch && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {countLabel ? (
              countLabel(filtered, total)
            ) : (
              <>
                {filtered} de {total}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {toolbar}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8"
                aria-label="Buscar"
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(canSort && "cursor-pointer select-none")}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            canSort && "hover:text-foreground",
                          )}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (sorted === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            ))}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12">
                  {emptyState ?? <span className="text-muted-foreground">Nenhum resultado</span>}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={pageIndex + 1}
        totalItems={filtered}
        pageSize={pageSize}
        onPageChange={(nextPage) => setPageIndex(nextPage - 1)}
      />
    </div>
  );
}

/** Helper: stop row-click propagation on action buttons inside a row. */
export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
