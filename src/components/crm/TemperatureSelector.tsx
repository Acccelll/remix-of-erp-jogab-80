import React from "react";
import { cn } from "@/lib/utils";

type TemperatureLevel = "frio" | "morno" | "quente" | null | undefined;

interface TemperatureSelectorProps {
  value?: TemperatureLevel;
  onChange?: (value: TemperatureLevel) => void;
  disabled?: boolean;
}

export function TemperatureSelector({
  value,
  onChange,
  disabled = false,
}: TemperatureSelectorProps) {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "0") onChange?.("frio");
    else if (val === "1") onChange?.("morno");
    else if (val === "2") onChange?.("quente");
  };

  const getSliderValue = () => {
    if (value === "frio") return "0";
    if (value === "morno") return "1";
    if (value === "quente") return "2";
    return "1";
  };

  const getThumbColor = () => {
    if (value === "frio") return "accent-blue-500";
    if (value === "morno") return "accent-yellow-500";
    if (value === "quente") return "accent-red-500";
    return "accent-gray-400";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Temperatura</span>
        <span className="text-xs text-muted-foreground">
          {value === "frio"
            ? "Frio"
            : value === "morno"
              ? "Morno"
              : value === "quente"
                ? "Quente"
                : "—"}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="1"
        value={getSliderValue()}
        onChange={handleSliderChange}
        disabled={disabled}
        className={cn("w-full h-2 rounded-lg appearance-none cursor-pointer", getThumbColor())}
        style={{
          background:
            "linear-gradient(to right, rgb(59,130,246) 0%, rgb(59,130,246) 33.33%, rgb(234,179,8) 33.33%, rgb(234,179,8) 66.66%, rgb(239,68,68) 66.66%, rgb(239,68,68) 100%)",
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Frio</span>
        <span>Morno</span>
        <span>Quente</span>
      </div>
    </div>
  );
}
