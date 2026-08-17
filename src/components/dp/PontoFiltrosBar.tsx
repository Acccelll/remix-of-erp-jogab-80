// Filtros do hub de Ponto — recorte único para todas as abas.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DatePickerField from "@/components/common/DatePickerField";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import type { PontoFiltrosUi } from "@/hooks/dp/usePontoFiltros";
import { hojeBrasilia, primeiroDiaMesBrasilia } from "@/lib/core/date";

interface Props {
  filtros: PontoFiltrosUi;
  /** Oculta o seletor de colaborador em abas que já são por pessoa. */
  semColaborador?: boolean;
}

/** Data de N dias atrás no fuso de Brasília, em YYYY-MM-DD. */
function diasAtras(dias: number): string {
  const base = new Date(`${hojeBrasilia()}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - dias);
  return base.toISOString().slice(0, 10);
}

export default function PontoFiltrosBar({ filtros, semColaborador }: Props) {
  const { obras, colaboradores } = useCatalogos();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium block mb-1">Início</label>
          <DatePickerField value={filtros.inicio} onChange={filtros.setInicio} className="w-40" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Fim</label>
          <DatePickerField value={filtros.fim} onChange={filtros.setFim} className="w-40" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Obra</label>
          <select
            value={filtros.obraId}
            onChange={(e) => filtros.setObraId(e.target.value)}
            className="h-10 rounded-md border px-2 bg-background"
          >
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        {!semColaborador && (
          <div>
            <label className="text-xs font-medium block mb-1">Colaborador</label>
            <select
              value={filtros.colaboradorId}
              onChange={(e) => filtros.setColaboradorId(e.target.value)}
              className="h-10 rounded-md border px-2 bg-background min-w-[200px]"
            >
              <option value="">Todos</option>
              {[...colaboradores]
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            filtros.setInicio(primeiroDiaMesBrasilia());
            filtros.setFim(hojeBrasilia());
          }}
        >
          Mês atual
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            filtros.setInicio(diasAtras(15));
            filtros.setFim(hojeBrasilia());
          }}
        >
          Últimos 15 dias
        </Button>
        <label className="flex items-center gap-2 text-xs ml-2 cursor-pointer">
          <Checkbox
            checked={filtros.incluirIndiretos}
            onCheckedChange={(v) => filtros.setIncluirIndiretos(!!v)}
          />
          Incluir centros indiretos (ADM/Barracão)
        </label>
        {(filtros.obraId || filtros.colaboradorId) && (
          <Button variant="ghost" size="sm" onClick={filtros.limpar}>
            Limpar filtros
          </Button>
        )}
      </div>
    </Card>
  );
}
