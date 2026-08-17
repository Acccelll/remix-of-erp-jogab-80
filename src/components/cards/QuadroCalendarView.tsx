/**
 * QuadroCalendarView — REF.3 (view Calendário).
 * Mês com cards plotados na data de prazo. Click no card abre o detalhe.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarCard {
  id: string;
  numero: number;
  titulo: string;
  status: string;
  prazo: string | null;
}

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function QuadroCalendarView({
  cards,
  onOpenCard,
}: {
  cards: CalendarCard[];
  onOpenCard: (id: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  const { dias, porDia, semCount } = useMemo(() => {
    const primeiro = new Date(cursor.ano, cursor.mes, 1);
    const ultimo = new Date(cursor.ano, cursor.mes + 1, 0);
    const startWeekday = primeiro.getDay();
    const totalDias = ultimo.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(new Date(cursor.ano, cursor.mes, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const map: Record<string, CalendarCard[]> = {};
    let sem = 0;
    for (const c of cards) {
      if (!c.prazo) {
        sem++;
        continue;
      }
      (map[c.prazo] ??= []).push(c);
    }
    return { dias: cells, porDia: map, semCount: sem };
  }, [cards, cursor]);

  const goto = (delta: number) => {
    const m = cursor.mes + delta;
    const ano = cursor.ano + Math.floor(m / 12);
    const mes = ((m % 12) + 12) % 12;
    setCursor({ ano, mes });
  };

  const hojeIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => goto(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => goto(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              setCursor({ ano: d.getFullYear(), mes: d.getMonth() });
            }}
          >
            Hoje
          </Button>
        </div>
        <h2 className="text-sm md:text-base font-semibold">
          {MESES[cursor.mes]} {cursor.ano}
        </h2>
        <div className="text-xs text-muted-foreground">
          {semCount > 0 ? `${semCount} sem prazo` : ""}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden text-xs">
        {DOW.map((d) => (
          <div key={d} className="bg-muted/60 px-2 py-1 font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {dias.map((d, i) => {
          const iso = d
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            : null;
          const items = iso ? (porDia[iso] ?? []) : [];
          const isHoje = iso === hojeIso;
          return (
            <div
              key={i}
              className={cn(
                "bg-background min-h-[88px] p-1 flex flex-col gap-0.5",
                !d && "bg-muted/30",
              )}
            >
              {d && (
                <div className={cn("text-[11px] font-medium px-1", isHoje && "text-primary")}>
                  {d.getDate()}
                </div>
              )}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {items.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenCard(c.id)}
                    className="text-left truncate rounded px-1 py-0.5 bg-primary/10 hover:bg-primary/20 text-[11px]"
                    title={`#${c.numero} ${c.titulo}`}
                  >
                    <span className="text-muted-foreground mr-1">#{c.numero}</span>
                    {c.titulo}
                  </button>
                ))}
                {items.length > 4 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 self-start">
                    +{items.length - 4}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
