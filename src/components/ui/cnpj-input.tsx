import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatCnpj, isValidCnpj, onlyDigits } from "@/lib/core/cnpj";

// Re-export para retrocompatibilidade (ARC-006: helpers movidos para lib/cnpj)
export { formatCnpj, isValidCnpj, onlyDigits };

export interface CnpjInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  value: string | null | undefined;
  onChange: (formatted: string) => void;
}

export const CnpjInput = React.forwardRef<HTMLInputElement, CnpjInputProps>(
  ({ value, onChange, placeholder = "00.000.000/0000-00", ...rest }, ref) => {
    const display = formatCnpj(value ?? "");
    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={display}
        onChange={(e) => onChange(formatCnpj(e.target.value))}
        placeholder={placeholder}
        {...rest}
      />
    );
  },
);
CnpjInput.displayName = "CnpjInput";
