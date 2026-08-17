import React from "react";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StatusOption {
  value: string;
  label: string;
}

interface StatusFilterProps {
  options: StatusOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}

const StatusFilter: React.FC<StatusFilterProps> = ({
  options,
  selected,
  onChange,
  label = "Status",
}) => {
  const total = options.length;
  const allSelected = selected.size === total;
  const hiddenCount = total - selected.size;

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  const toggleAll = () => {
    if (allSelected) onChange(new Set());
    else onChange(new Set(options.map((o) => o.value)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <ListFilter className="h-4 w-4 mr-1" />
          {label}
          {hiddenCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {hiddenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <ScrollArea className="max-h-72">
          <div className="space-y-1 pr-2">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm font-medium border-b pb-2 mb-1">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span>Todos</span>
            </label>
            {options.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox checked={selected.has(o.value)} onCheckedChange={() => toggle(o.value)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default StatusFilter;
