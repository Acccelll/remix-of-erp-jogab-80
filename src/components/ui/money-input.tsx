import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return "";
  return fmt.format(n);
}

/** Parse user input. Accepts raw digits, "1.234,56", "1234.56", "R$ 1.234,56". */
function parseCurrency(raw: string): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Strip everything but digits, comma, dot, and minus
  const cleaned = s.replace(/[^\d.,\-]/g, "");
  if (!cleaned) return null;
  // If only digits → treat as cents (so "1234567" → 12345.67)
  if (/^-?\d+$/.test(cleaned)) {
    const n = Number(cleaned);
    return n / 100;
  }
  // Has separators: assume pt-BR (.= thousands, ,=decimal). If only "." present, treat as decimal.
  let normalized = cleaned;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return isNaN(n) ? null : n;
}

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> {
  value: number | string | null | undefined;
  onChange: (value: number | null) => void;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, placeholder = "0,00", ...rest }, ref) => {
    const numeric = value === "" || value == null ? null : Number(value);
    const [display, setDisplay] = React.useState<string>(() => formatNumber(numeric));
    const [focused, setFocused] = React.useState(false);

    // Sync external changes when not focused (avoid clobbering user typing)
    React.useEffect(() => {
      if (!focused) setDisplay(formatNumber(numeric));
    }, [numeric, focused]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      // Allow only digits and , . in the visible field
      const onlyDigits = raw.replace(/[^\d]/g, "");
      if (onlyDigits === "") {
        setDisplay("");
        onChange(null);
        return;
      }
      // Treat input as cents → format as currency live
      const asNumber = Number(onlyDigits) / 100;
      setDisplay(fmt.format(asNumber));
      onChange(asNumber);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(false);
      // Re-parse to handle pasted "1.234,56" etc.
      const parsed = parseCurrency(e.target.value);
      onChange(parsed);
      setDisplay(formatNumber(parsed));
      rest.onBlur?.(e);
    }

    return (
      <div className={cn("relative", className)}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          R$
        </span>
        <Input
          ref={ref}
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="pl-9 text-right tabular-nums"
          {...rest}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
