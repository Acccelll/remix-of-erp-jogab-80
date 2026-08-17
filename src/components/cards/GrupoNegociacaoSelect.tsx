/**
 * Seletor reutilizável de grupo de negociação. Lista todos os rótulos
 * existentes em `card_grupos_negociacao` e permite criar um novo inline.
 *
 * Não dispara recálculo. Apenas atualiza o link na coluna escolhida.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { cardsQueryFns, gruposNegociacaoKeys, useCreateGrupoNegociacao } from "@/hooks/quadros/useCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

export function GrupoNegociacaoSelect({ value, onChange, className }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [criandoNome, setCriandoNome] = useState("");
  const [criando, setCriando] = useState(false);

  const createGrupoMut = useCreateGrupoNegociacao();

  const { data: grupos = [] } = useQuery({
    queryKey: gruposNegociacaoKeys.all,
    queryFn: () => cardsQueryFns.listGruposNegociacaoOrdenados(),
  });

  const atual = grupos.find((g) => g.id === value);

  async function criarGrupo() {
    const nome = criandoNome.trim();
    if (!nome) return;
    setCriando(true);
    try {
      const data = await createGrupoMut.mutateAsync(nome);
      setCriandoNome("");
      onChange(data.id);
      setOpen(false);
    } catch {
      toast.error("Falha ao criar grupo");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-start font-normal w-full">
            {atual ? atual.rotulo : <span className="text-muted-foreground">Sem negociação</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Buscar negociação…" />
            <CommandList>
              <CommandEmpty>Nenhum grupo.</CommandEmpty>
              <CommandGroup>
                {grupos.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={g.rotulo}
                    onSelect={() => {
                      onChange(g.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === g.id ? "opacity-100" : "opacity-0")}
                    />
                    {g.rotulo}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2 space-y-2">
              <div className="flex gap-1">
                <Input
                  value={criandoNome}
                  onChange={(e) => setCriandoNome(e.target.value)}
                  placeholder="Novo grupo…"
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criarGrupo();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={criarGrupo}
                  disabled={!criandoNome.trim() || criando}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remover do grupo"
          className="h-8 w-8 shrink-0"
          onClick={() => onChange(null)}
          title="Remover do grupo"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
