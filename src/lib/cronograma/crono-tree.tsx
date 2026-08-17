/** @module-kind pure */
/**
 * Árvore hierárquica do cronograma (estilo MS Project).
 * Reutilizada por Cronograma, Gantt, Comparar, Previsão (composição da BMS),
 * Análise e Medições para garantir consistência visual e expand/collapse global.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Tipos & helpers
// ============================================================

export type CronoNode = {
  wbs: string;
  name: string;
  depth: number;
  item?: any;
  children: CronoNode[];
};

export type CronoAggregate = {
  custo: number;
  pct: number;
  executado: number;
  base: number;
  inicio?: string;
  fim?: string;
};

function wbsParts(w: string): number[] {
  return w.split(".").map((p) => Number(p) || 0);
}

export function wbsCompare(a: string, b: string): number {
  const pa = wbsParts(a);
  const pb = wbsParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function parseDescricao(desc: string): {
  wbs: string;
  name: string;
  chain: { wbs: string; name: string }[];
} {
  const s = (desc || "").trim();
  const ctxMatch = s.match(/\s+·\s+\[(.+)\]\s*$/);
  const head = ctxMatch ? s.slice(0, ctxMatch.index).trim() : s;
  const chainStr = ctxMatch?.[1] ?? "";

  const splitWbs = (txt: string): { wbs: string; name: string } => {
    const m = txt.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
    return m ? { wbs: m[1], name: m[2].trim() } : { wbs: "", name: txt };
  };

  const leaf = splitWbs(head);
  const chain = chainStr ? chainStr.split(" › ").map(splitWbs) : [];
  return { ...leaf, chain };
}

export function buildTree(itens: any[]): CronoNode[] {
  const byWbs = new Map<string, CronoNode>();
  const ensure = (wbs: string, name: string): CronoNode => {
    let n = byWbs.get(wbs);
    if (!n) {
      n = { wbs, name, depth: wbs ? wbs.split(".").length : 1, children: [] };
      byWbs.set(wbs, n);
    } else if (!n.name) {
      n.name = name;
    }
    return n;
  };

  for (const it of itens) {
    const { wbs, name, chain } = parseDescricao(String(it.descricao ?? ""));
    for (const p of chain) ensure(p.wbs, p.name);
    // Auto-cria pais a partir do próprio WBS quando não há "chain" no descricao
    // (formato típico: "1.2.3 Nome" sem sufixo "· [Pai › Avô]"). Sem isso a
    // árvore fica plana mesmo com itens claramente hierárquicos.
    if (wbs && wbs.includes(".")) {
      const parts = wbs.split(".");
      for (let k = 1; k < parts.length; k++) {
        const pw = parts.slice(0, k).join(".");
        if (!byWbs.has(pw)) ensure(pw, pw);
      }
    }
    const leaf = ensure(wbs || `__${it.id}`, name || "(sem nome)");
    leaf.item = it;
  }

  const roots: CronoNode[] = [];
  const nodes = Array.from(byWbs.values()).sort((a, b) => wbsCompare(a.wbs, b.wbs));
  for (const n of nodes) {
    const parts = n.wbs.split(".");
    if (parts.length > 1) {
      const parentWbs = parts.slice(0, -1).join(".");
      const parent = byWbs.get(parentWbs);
      if (parent) {
        parent.children.push(n);
        continue;
      }
    }
    roots.push(n);
  }
  const sortRec = (n: CronoNode) => {
    n.children.sort((a, b) => wbsCompare(a.wbs, b.wbs));
    n.children.forEach(sortRec);
  };
  roots.sort((a, b) => wbsCompare(a.wbs, b.wbs));
  roots.forEach(sortRec);
  return roots;
}

export function aggregate(n: CronoNode, valorContrato: number): CronoAggregate {
  const leafCompute = (item: any): CronoAggregate => {
    const custo = Number(item.custo_baseline ?? item.custo ?? 0);
    const pct = Number(item.percentual_previsto || 0);
    const base = custo > 0 ? custo : (pct / 100) * valorContrato;
    const pctReal = Number(item.percentual_realizado || 0);
    return {
      custo,
      pct,
      base,
      executado: (base * pctReal) / 100,
      inicio: item.data_inicio,
      fim: item.data_fim,
    };
  };

  if (n.item && n.children.length === 0) {
    return leafCompute(n.item);
  }
  let custo = 0,
    pct = 0,
    base = 0,
    executado = 0;
  let inicio: string | undefined;
  let fim: string | undefined;
  for (const c of n.children) {
    const a = aggregate(c, valorContrato);
    custo += a.custo;
    pct += a.pct;
    base += a.base;
    executado += a.executado;
    if (a.inicio && (!inicio || a.inicio < inicio)) inicio = a.inicio;
    if (a.fim && (!fim || a.fim > fim)) fim = a.fim;
  }
  if (n.item) {
    const l = leafCompute(n.item);
    custo += l.custo;
    pct += l.pct;
    base += l.base;
    executado += l.executado;
    if (l.inicio && (!inicio || l.inicio < inicio)) inicio = l.inicio;
    if (l.fim && (!fim || l.fim > fim)) fim = l.fim;
  }
  return { custo, pct, base, executado, inicio, fim };
}

/** Coleta wbs de todos os nós que possuem filhos. */
export function collectParents(roots: CronoNode[]): string[] {
  const out: string[] = [];
  const walk = (n: CronoNode) => {
    if (n.children.length > 0) {
      out.push(n.wbs);
      n.children.forEach(walk);
    }
  };
  roots.forEach(walk);
  return out;
}

/** Lista todas as folhas em ordem WBS. */
export function listLeaves(roots: CronoNode[]): CronoNode[] {
  const out: CronoNode[] = [];
  const walk = (n: CronoNode) => {
    if (n.children.length === 0) out.push(n);
    else n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

// ============================================================
// Context: sincronização de expand/collapse entre abas
// ============================================================

type ExpansionState = {
  collapsed: Set<string>;
  setCollapsed: (s: Set<string>) => void;
};

const CronoExpansionContext = createContext<ExpansionState | null>(null);

export function CronoExpansionProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState<Set<string>>(new Set());
  const setCollapsed = useCallback((s: Set<string>) => setCollapsedState(s), []);
  const value = useMemo(() => ({ collapsed, setCollapsed }), [collapsed, setCollapsed]);
  return <CronoExpansionContext.Provider value={value}>{children}</CronoExpansionContext.Provider>;
}

/**
 * Hook de expansão. Se houver provider, usa o estado compartilhado;
 * caso contrário, mantém estado local (modo isolado).
 */
export function useCronoExpansion() {
  const ctx = useContext(CronoExpansionContext);
  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set());
  if (ctx) return ctx;
  return { collapsed: localCollapsed, setCollapsed: setLocalCollapsed };
}

// ============================================================
// HierarquiaTree
// ============================================================

export type HierColumnContext = {
  node: CronoNode;
  agg: CronoAggregate;
  depth: number;
  isLeaf: boolean;
  isCollapsed: boolean;
};

export type HierColumn = {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  width?: string;
  /** Se omitido, renderiza vazio em nós-pai (somente folhas). */
  render?: (ctx: HierColumnContext) => React.ReactNode;
  /** Se true, renderiza tanto em pais quanto em folhas. */
  showOnParents?: boolean;
};

export type HierarquiaTreeProps = {
  /** Itens crus para construção da árvore (alternativa: roots). */
  itens?: any[];
  /** Árvore pré-construída. Tem precedência sobre itens. */
  roots?: CronoNode[];
  valorContrato?: number;
  /** Colunas extras após Descrição. */
  columns: HierColumn[];
  /** Mostra controles "Expandir tudo / Recolher tudo" no topo do card pai. */
  controls?: boolean;
  /** Renderiza apenas a árvore (sem header de controles). */
  emptyHint?: React.ReactNode;
  /** Classe extra na linha. Recebe contexto da linha. */
  rowClassName?: (ctx: HierColumnContext) => string;
  /** Renderização customizada da célula "Descrição" (após o chevron). */
  renderDescriptionExtra?: (ctx: HierColumnContext) => React.ReactNode;
  /** Início do estado: nada recolhido (padrão) ou somente raízes expandidas. */
  defaultCollapsed?: "none" | "leaves-only";
  /** Clique na linha (apenas folhas com item). Permite abrir painéis externos. */
  onRowClick?: (ctx: HierColumnContext) => void;
};

export function HierarquiaTreeControls({
  roots,
  className,
}: {
  roots: CronoNode[];
  className?: string;
}) {
  const { setCollapsed } = useCronoExpansion();
  const parents = useMemo(() => collectParents(roots), [roots]);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setCollapsed(new Set())}
        title="Expandir tudo"
      >
        <ChevronsUpDown className="h-3.5 w-3.5" /> Expandir tudo
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setCollapsed(new Set(parents))}
        title="Recolher tudo"
      >
        <ChevronsDownUp className="h-3.5 w-3.5" /> Recolher tudo
      </Button>
    </div>
  );
}

export function HierarquiaTree({
  itens,
  roots: rootsProp,
  valorContrato = 0,
  columns,
  emptyHint,
  rowClassName,
  renderDescriptionExtra,
  onRowClick,
}: HierarquiaTreeProps) {
  const { collapsed, setCollapsed } = useCronoExpansion();

  const roots = useMemo(() => rootsProp ?? buildTree(itens ?? []), [rootsProp, itens]);

  function toggle(key: string, recursive = false) {
    const n = new Set(collapsed);
    if (recursive) {
      // recolhe/expande nó + descendentes
      const targetParents: string[] = [];
      const walk = (node: CronoNode) => {
        if (node.children.length > 0) {
          targetParents.push(node.wbs);
          node.children.forEach(walk);
        }
      };
      const found = findNode(roots, key);
      if (found) walk(found);
      const isOpenNow = !n.has(key);
      if (isOpenNow) targetParents.forEach((k) => n.add(k));
      else targetParents.forEach((k) => n.delete(k));
    } else {
      if (n.has(key)) n.delete(key);
      else n.add(key);
    }
    setCollapsed(n);
  }

  const rows: { node: CronoNode; depth: number }[] = [];
  const walk = (n: CronoNode, depth: number) => {
    rows.push({ node: n, depth });
    if (collapsed.has(n.wbs)) return;
    for (const c of n.children) walk(c, depth + 1);
  };
  roots.forEach((r) => walk(r, 0));

  if (rows.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">{emptyHint ?? "Sem itens."}</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">EDT</TableHead>
          <TableHead>Descrição</TableHead>
          {columns.map((c) => (
            <TableHead
              key={c.key}
              className={cn(
                c.align === "right" && "text-right",
                c.align === "center" && "text-center",
                c.width,
                c.headerClassName,
              )}
            >
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ node, depth }) => {
          const isLeaf = node.children.length === 0;
          const isCollapsed = collapsed.has(node.wbs);
          const agg = aggregate(node, valorContrato);
          const ctx: HierColumnContext = { node, agg, depth, isLeaf, isCollapsed };
          const clickable = !!onRowClick && isLeaf && !!node.item;
          return (
            <TableRow
              key={node.wbs || node.item?.id}
              onClick={
                clickable
                  ? (e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest('button,a,input,select,textarea,[role="button"]')) return;
                      onRowClick!(ctx);
                    }
                  : undefined
              }

              className={cn(
                !isLeaf && "bg-muted/40",
                clickable && "cursor-pointer hover:bg-muted/40",
                rowClassName?.(ctx),
              )}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">{node.wbs}</TableCell>
              <TableCell>
                <div className="flex items-center" style={{ paddingLeft: `${depth * 18}px` }}>
                  {!isLeaf ? (
                    <button
                      type="button"
                      onClick={(e) => toggle(node.wbs, e.altKey)}
                      className="mr-1 inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={
                        isCollapsed
                          ? "Expandir (Alt+clique = recursivo)"
                          : "Recolher (Alt+clique = recursivo)"
                      }
                      title={
                        isCollapsed
                          ? "Expandir (Alt+clique recursivo)"
                          : "Recolher (Alt+clique recursivo)"
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="mr-1 inline-block w-5 text-center text-xs text-muted-foreground">
                      ·
                    </span>
                  )}
                  <span className={!isLeaf ? "font-semibold" : ""}>{node.name}</span>
                  {renderDescriptionExtra && (
                    <span className="ml-2">{renderDescriptionExtra(ctx)}</span>
                  )}
                </div>
              </TableCell>
              {columns.map((c) => {
                const showOnThisRow = isLeaf || c.showOnParents !== false;
                return (
                  <TableCell
                    key={c.key}
                    className={cn(
                      c.align === "right" && "text-right whitespace-nowrap",
                      c.align === "center" && "text-center",
                      !isLeaf && !c.showOnParents && "text-muted-foreground italic",
                      c.className,
                    )}
                  >
                    {showOnThisRow && c.render ? c.render(ctx) : null}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function findNode(roots: CronoNode[], wbs: string): CronoNode | null {
  for (const r of roots) {
    if (r.wbs === wbs) return r;
    const f = findNode(r.children, wbs);
    if (f) return f;
  }
  return null;
}
