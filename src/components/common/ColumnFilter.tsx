import React from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColumnOption {
  id: string;
  label: string;
}

interface ColumnFilterProps {
  columns: ColumnOption[];
  hiddenColumns: Set<string>;
  onToggle: (columnId: string) => void;
}

const ColumnFilter: React.FC<ColumnFilterProps> = ({ columns, hiddenColumns, onToggle }) => {
  const hiddenCount = hiddenColumns.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-1" />
          Colunas
          {hiddenCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {hiddenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <ScrollArea className="h-72">
          <div className="space-y-1 pr-2">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm font-medium border-b pb-2 mb-1">
              <Checkbox
                checked={hiddenColumns.size === 0}
                onCheckedChange={() => {
                  if (hiddenColumns.size === 0) {
                    columns.forEach((col) => onToggle(col.id));
                  } else {
                    hiddenColumns.forEach((id) => onToggle(id));
                  }
                }}
              />
              <span>Todos</span>
            </label>
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={!hiddenColumns.has(col.id)}
                  onCheckedChange={() => onToggle(col.id)}
                />
                <span className="truncate">{col.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnFilter;
