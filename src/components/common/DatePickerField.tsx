// Campo de data padrão do ERP: input com máscara DD/MM/AAAA + popover de calendário.
// Substitui `<Input type="date" />` e `MaskedDateInput` (mantido como re-export).
// Value/onChange no formato ISO "YYYY-MM-DD".
import React, { useState, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerFieldProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string; // wrapper (largura, margens)
  inputClassName?: string; // input interno (altura, fonte)
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  title?: string;
  min?: string; // ISO
  max?: string; // ISO
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return "";
}

function displayToIso(display: string): string {
  const clean = display.replace(/\D/g, "");
  if (clean.length !== 8) return "";
  const dd = clean.substring(0, 2);
  const mm = clean.substring(2, 4);
  const yyyy = clean.substring(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  className,
  inputClassName,
  id,
  name,
  disabled,
  required,
  title,
  min,
  max,
  ...rest
}) => {
  const [display, setDisplay] = useState(isoToDisplay(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").substring(0, 8);
    let formatted = "";
    for (let i = 0; i < raw.length; i++) {
      if (i === 2 || i === 4) formatted += "/";
      formatted += raw[i];
    }
    setDisplay(formatted);
    if (raw.length === 8) onChange(displayToIso(formatted));
    else if (raw.length === 0) onChange("");
  };

  const selectedDate = isoToDate(value);
  const minDate = isoToDate(min ?? "");
  const maxDate = isoToDate(max ?? "");

  return (
    <div className={cn("relative flex", className)}>
      <Input
        id={id}
        name={name}
        value={display}
        onChange={handleTextChange}
        placeholder={placeholder}
        maxLength={10}
        disabled={disabled}
        required={required}
        title={title}
        className={cn("pr-10", inputClassName)}
        aria-invalid={rest["aria-invalid"]}
        aria-label={rest["aria-label"]}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DatePickerField;
