// Filtros do hub de Ponto, compartilhados entre as abas pela URL.
//
// Ficam em `useSearchParams` (e não em contexto) para que trocar de aba, recarregar
// ou compartilhar o link preserve o recorte — a mesma razão pela qual `HubTabs` guarda
// a aba ativa em `?tab=`.
import { useUrlState } from "@/hooks/useUrlState";
import { hojeBrasilia, primeiroDiaMesBrasilia } from "@/lib/core/date";

export interface PontoFiltrosUi {
  inicio: string;
  fim: string;
  obraId: string;
  colaboradorId: string;
  incluirIndiretos: boolean;
  setInicio: (v: string) => void;
  setFim: (v: string) => void;
  setObraId: (v: string) => void;
  setColaboradorId: (v: string) => void;
  setIncluirIndiretos: (v: boolean) => void;
  limpar: () => void;
}

export function usePontoFiltros(): PontoFiltrosUi {
  const [inicio, setInicio] = useUrlState("ini", primeiroDiaMesBrasilia());
  const [fim, setFim] = useUrlState("fim", hojeBrasilia());
  const [obraId, setObraId] = useUrlState("obra", "");
  const [colaboradorId, setColaboradorId] = useUrlState("colab", "");
  const [indiretos, setIndiretos] = useUrlState("indiretos", "1");

  return {
    inicio,
    fim,
    obraId,
    colaboradorId,
    incluirIndiretos: indiretos !== "0",
    setInicio,
    setFim,
    setObraId,
    setColaboradorId,
    setIncluirIndiretos: (v: boolean) => setIndiretos(v ? "1" : "0"),
    limpar: () => {
      setObraId("");
      setColaboradorId("");
    },
  };
}
