import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusChipOption<T extends string> {
  value: T;
  label: string;
  /** Contagem opcional exibida ao lado do rótulo. */
  count?: number;
}

/**
 * Faixa horizontal de chips de status multi-seleção.
 *
 * A barra de rolagem nativa é escondida em muitos sistemas (macOS/mobile) e,
 * quando aparece, fica no fim do container — o usuário precisava rolar a página
 * até o rodapé para vê-la. Aqui renderizamos um trilho + polegar próprios,
 * SEMPRE visíveis logo abaixo dos chips, com setas de navegação.
 */
export function StatusChips<T extends string>({
  options,
  selected,
  onChange,
  className,
  ariaLabel,
}: {
  options: StatusChipOption<T>[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ ratio: 1, pos: 0 });

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setState({
      ratio: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
      pos: max > 0 ? el.scrollLeft / max : 0,
    });
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync, options.length]);

  function toggle(value: T) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // Nunca deixa a seleção vazia — sem nenhum status a visualização some.
    if (next.size === 0) return;
    onChange(next);
  }

  function nudge(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  }

  function dragFrom(clientX0: number) {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    const width = el.clientWidth;
    const start = el.scrollLeft;
    const move = (e: PointerEvent) => {
      const delta = (e.clientX - clientX0) / Math.max(1, width * (1 - state.ratio));
      el.scrollLeft = Math.max(0, Math.min(max, start + delta * max));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const rolavel = state.ratio < 1;

  return (
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      <div className="flex items-center gap-1">
        {rolavel && (
          <button
            type="button"
            aria-label="Rolar para a esquerda"
            onClick={() => nudge(-1)}
            className="shrink-0 rounded-full border border-border p-1 text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div
          ref={trackRef}
          onScroll={sync}
          className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            role="group"
            aria-label={ariaLabel}
            className="flex w-max flex-nowrap items-center gap-2 pr-2"
          >
            {options.map((o) => {
              const on = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {o.label}
                  {typeof o.count === "number" && (
                    <span className={cn("ml-1.5 tabular-nums", on ? "opacity-80" : "opacity-70")}>
                      {o.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {rolavel && (
          <button
            type="button"
            aria-label="Rolar para a direita"
            onClick={() => nudge(1)}
            className="shrink-0 rounded-full border border-border p-1 text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {rolavel && (
        <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
          <div
            role="scrollbar"
            aria-orientation="horizontal"
            aria-label="Rolagem horizontal dos chips"
            onPointerDown={(e) => {
              e.preventDefault();
              dragFrom(e.clientX);
            }}
            className="h-2 rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/70 cursor-grab active:cursor-grabbing"
            style={{
              width: `${Math.max(12, state.ratio * 100)}%`,
              marginLeft: `${state.pos * (100 - Math.max(12, state.ratio * 100))}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
