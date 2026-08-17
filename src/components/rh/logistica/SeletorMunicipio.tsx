import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMunicipios } from "@/hooks/rh/useLogisticaPontos";
import { slugCidade } from "@/lib/logistica/normalize";

export interface SeletorMunicipioProps {
  cidade: string;
  uf: string;
  onChange: (valor: { cidade: string; uf: string }) => void;
  disabled?: boolean;
  className?: string;
}

/** Quantos resultados renderizar — a base tem 5.571 e a lista precisa ser fluida. */
const MAX_RESULTADOS = 60;

/**
 * Combobox de município (cidade + UF) alimentado pela base do IBGE.
 *
 * Escolher da lista em vez de digitar livremente é o que garante que a obra
 * apareça no mapa: o par cidade/UF vem exatamente como o índice de
 * geocodificação o conhece, sem erro de grafia ou UF ausente.
 */
const SeletorMunicipio: React.FC<SeletorMunicipioProps> = ({
  cidade,
  uf,
  onChange,
  disabled,
  className,
}) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const { data: indice, isLoading } = useMunicipios();

  const resultados = useMemo(() => {
    if (!indice) return [];
    const termo = slugCidade(busca);
    if (!termo) return indice.todos.slice(0, MAX_RESULTADOS);

    const comecam: typeof indice.todos = [];
    const contem: typeof indice.todos = [];
    for (const m of indice.todos) {
      const slug = slugCidade(m.nome);
      if (slug.startsWith(termo)) comecam.push(m);
      else if (slug.includes(termo)) contem.push(m);
      if (comecam.length >= MAX_RESULTADOS) break;
    }
    return [...comecam, ...contem].slice(0, MAX_RESULTADOS);
  }, [indice, busca]);

  const rotulo = cidade ? (uf ? `${cidade}/${uf.toUpperCase()}` : cidade) : "";

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !rotulo && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{rotulo || "Selecione a cidade"}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar município…" value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Carregando municípios…" : "Nenhum município encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {rotulo && (
                <CommandItem
                  value="__limpar__"
                  onSelect={() => {
                    onChange({ cidade: "", uf: "" });
                    setAberto(false);
                  }}
                  className="text-muted-foreground"
                >
                  Limpar seleção
                </CommandItem>
              )}
              {resultados.map((m) => {
                const selecionado =
                  slugCidade(m.nome) === slugCidade(cidade) && m.uf === uf.toUpperCase();
                return (
                  <CommandItem
                    key={`${m.nome}|${m.uf}`}
                    value={`${m.nome}|${m.uf}`}
                    onSelect={() => {
                      onChange({ cidade: m.nome, uf: m.uf });
                      setAberto(false);
                      setBusca("");
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selecionado ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{m.nome}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">{m.uf}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SeletorMunicipio;
