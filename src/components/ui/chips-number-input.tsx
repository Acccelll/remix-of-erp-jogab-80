import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChipsNumberInputProps {
  value: number[];
  onChange: (next: number[]) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}

/**
 * Entrada de múltiplos números inteiros como chips/tags.
 * Aceita: digitar e pressionar Enter, vírgula ou espaço para confirmar.
 * Backspace em entrada vazia remove o último chip.
 */
export function ChipsNumberInput({
  value,
  onChange,
  min = 1,
  max = 31,
  placeholder = "Ex.: 15, 30",
  className,
}: ChipsNumberInputProps) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const novos: number[] = [];
    for (const p of parts) {
      const n = Math.trunc(Number(p));
      if (!Number.isFinite(n)) continue;
      if (n < min || n > max) continue;
      if (value.includes(n) || novos.includes(n)) continue;
      novos.push(n);
    }
    if (novos.length) onChange([...value, ...novos].sort((a, b) => a - b));
    setDraft("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 min-h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      {value.map((n) => (
        <span
          key={n}
          className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs"
        >
          {n}
          <button
            type="button"
            className="hover:text-destructive"
            onClick={() => onChange(value.filter((x) => x !== n))}
            aria-label={`Remover ${n}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        inputMode="numeric"
        className="flex-1 min-w-[60px] bg-transparent outline-none placeholder:text-muted-foreground py-1"
        placeholder={value.length === 0 ? placeholder : ""}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => draft.trim() && commit(draft)}
      />
    </div>
  );
}
