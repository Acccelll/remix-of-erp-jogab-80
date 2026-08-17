import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props<K extends string> {
  sortKey: K;
  currentKey?: K;
  dir: "asc" | "desc";
  onToggle: (k: K) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function SortHeader<K extends string>({
  sortKey,
  currentKey,
  dir,
  onToggle,
  children,
  className,
  align = "left",
}: Props<K>) {
  const active = currentKey === sortKey;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "right" && "ml-auto",
          active && "text-foreground font-medium",
        )}
      >
        <span>{children}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );
}
