import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PercentInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> {
  value: number | string | null | undefined;
  onChange: (v: number | null) => void;
  /** Max value (default 100) */
  max?: number;
}

export const PercentInput = React.forwardRef<HTMLInputElement, PercentInputProps>(
  ({ value, onChange, className, placeholder = "0,00", max = 100, ...rest }, ref) => {
    const str =
      value == null || value === ""
        ? ""
        : typeof value === "number"
          ? String(value).replace(".", ",")
          : String(value).replace(".", ",");
    return (
      <div className={cn("relative", className)}>
        <Input
          ref={ref}
          inputMode="decimal"
          value={str}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d,.-]/g, "").replace(",", ".");
            if (raw === "" || raw === "-") {
              onChange(null);
              return;
            }
            const n = Number(raw);
            if (isNaN(n)) {
              onChange(null);
              return;
            }
            const clamped = Math.min(Math.max(n, 0), max);
            onChange(clamped);
          }}
          placeholder={placeholder}
          className="pr-8 text-right tabular-nums"
          {...rest}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          %
        </span>
      </div>
    );
  },
);
PercentInput.displayName = "PercentInput";
