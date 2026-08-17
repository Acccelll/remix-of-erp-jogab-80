/**
 * QuadroTabelaView — REF.3 (view Tabela).
 * Tabela ordenável simples para cards genéricos: nº, título, status,
 * prazo, responsável, setores, etiquetas. Click na linha abre o detalhe.
 */
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_GENERICO } from "@/lib/cards/generico";

export interface TabelaCard {
  id: string;
  numero: number;
  titulo: string;
  status: string;
  prazo: string | null;
  responsavel: { login: string | null } | null;
  card_setores: { setor: string }[];
  card_label_links: { card_labels: { id: string; nome: string; cor: string } }[];
}

type SortKey = "numero" | "titulo" | "status" | "prazo" | "responsavel";
type SortDir = "asc" | "desc";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_GENERICO.map((s) => [s.key, s.label]),
);

function cmp<T>(a: T, b: T, dir: SortDir): number {
  const m = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * m;
  return String(a).localeCompare(String(b)) * m;
}

export default function QuadroTabelaView({
  cards,
  onOpenCard,
}: {
  cards: TabelaCard[];
  onOpenCard: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("numero");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const ordenados = useMemo(() => {
    const arr = [...cards];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "numero":
          return cmp(a.numero, b.numero, sortDir);
        case "titulo":
          return cmp(a.titulo, b.titulo, sortDir);
        case "status":
          return cmp(
            STATUS_LABEL[a.status] ?? a.status,
            STATUS_LABEL[b.status] ?? b.status,
            sortDir,
          );
        case "prazo":
          return cmp(a.prazo, b.prazo, sortDir);
        case "responsavel":
          return cmp(a.responsavel?.login ?? null, b.responsavel?.login ?? null, sortDir);
      }
    });
    return arr;
  }, [cards, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "numero" || k === "prazo" ? "desc" : "asc");
    }
  };

  const Th = ({
    k,
    children,
    className,
  }: {
    k: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {children}
          <Icon className="h-3 w-3 opacity-60" />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="flex-1 overflow-auto rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <Th k="numero" className="w-16">
              Nº
            </Th>
            <Th k="titulo">Título</Th>
            <Th k="status" className="w-32">
              Status
            </Th>
            <Th k="prazo" className="w-28">
              Prazo
            </Th>
            <Th k="responsavel" className="w-36">
              Responsável
            </Th>
            <TableHead className="w-40">Setores</TableHead>
            <TableHead className="w-40">Etiquetas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenados.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Nenhum card encontrado.
              </TableCell>
            </TableRow>
          )}
          {ordenados.map((c) => {
            const venc = c.prazo
              ? new Date(c.prazo + "T00:00:00").getTime() < Date.now() - 86400000
              : false;
            return (
              <TableRow key={c.id} onClick={() => onOpenCard(c.id)} className="cursor-pointer">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{c.numero}
                </TableCell>
                <TableCell className="font-medium">{c.titulo}</TableCell>
                <TableCell>
                  <Badge variant="outline">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                </TableCell>
                <TableCell className={cn("text-xs", venc && "text-destructive")}>
                  {c.prazo ? c.prazo.split("-").reverse().join("/") : "—"}
                </TableCell>
                <TableCell className="text-xs">{c.responsavel?.login ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.card_setores.map((s) => (
                      <Badge key={s.setor} variant="outline" className="text-[10px] px-1.5 py-0">
                        {s.setor}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.card_label_links.map((l) => (
                      <span
                        key={l.card_labels.id}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
                        style={{ borderColor: l.card_labels.cor, color: l.card_labels.cor }}
                      >
                        {l.card_labels.nome}
                      </span>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
