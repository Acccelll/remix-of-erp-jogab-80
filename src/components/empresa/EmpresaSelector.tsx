import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useState } from "react";

export function EmpresaSelector() {
  const { empresas, empresaAtualId, setEmpresaAtualId, empresaAtual } = useEmpresa();
  const { currentPlayer } = useAuth();
  const isGm = !!currentPlayer?.isGM;
  const [open, setOpen] = useState(false);

  // Esconde se o usuário só tem 1 empresa e não é GM (não há o que escolher).
  if (!isGm && empresas.length <= 1) return null;
  if (empresas.length === 0) return null;

  const label =
    empresaAtualId === null
      ? "Todas as empresas"
      : empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Empresa";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 max-w-[180px]"
          role="combobox"
          aria-expanded={open}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{label}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar empresa..." className="h-8" />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {isGm && (
                <CommandItem
                  value="__todas__"
                  onSelect={() => {
                    setEmpresaAtualId(null);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${empresaAtualId === null ? "opacity-100" : "opacity-0"}`}
                  />
                  Todas as empresas
                </CommandItem>
              )}
              {empresas.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.razao_social + " " + (e.nome_fantasia ?? "")}
                  onSelect={() => {
                    setEmpresaAtualId(e.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${empresaAtualId === e.id ? "opacity-100" : "opacity-0"}`}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">
                      {e.nome_fantasia || e.razao_social}
                    </span>
                    {e.cnpj && <span className="text-[10px] text-muted-foreground">{e.cnpj}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
