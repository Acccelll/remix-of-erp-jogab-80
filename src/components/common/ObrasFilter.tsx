import React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ObraOption {
  id: string;
  nome: string;
}

interface ObrasFilterProps {
  obras: ObraOption[];
  /** IDs selecionados (incluir "sem" para "Sem obra") */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

const ObrasFilter: React.FC<ObrasFilterProps> = ({ obras, selected, onChange }) => {
  const allIds = React.useMemo(() => [...obras.map((o) => o.id), "sem"], [obras]);
  const total = allIds.length;
  const allSelected = selected.size === total;
  const hiddenCount = total - selected.size;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleAll = () => {
    if (allSelected) onChange(new Set());
    else onChange(new Set(allIds));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Building2 className="h-4 w-4 mr-1" />
          Obras
          {hiddenCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {hiddenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="h-72">
          <div className="space-y-1 pr-2">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm font-medium border-b pb-2 mb-1">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span>Todas</span>
            </label>
            {obras.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                <span className="truncate">{o.nome}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm italic text-muted-foreground">
              <Checkbox checked={selected.has("sem")} onCheckedChange={() => toggle("sem")} />
              <span>Sem obra</span>
            </label>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ObrasFilter;
