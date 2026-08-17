import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

// A página é feita de componentes Radix, que dependem de APIs de layout e de
// ponteiro que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

/**
 * Busca, filtros, ordem e página vivem na URL. O que este teste protege é a
 * armadilha do arranjo: setores e obras são semeados por `useEffect` quando as
 * listas assíncronas chegam, e o efeito que espelha o estado de volta na URL
 * roda no mesmo ciclo. Sem cuidado, um apaga o outro e o link compartilhado
 * abre a fila errada — sem erro nenhum aparecer.
 */

const refetchFake = vi.fn();
const semComentarios: unknown[] = [];
const semFormas: unknown[] = [];

const solicitacoes = [
  {
    id: "s1",
    setor: "compras",
    valor: 1500,
    solicitante: "Ana",
    fornecedor: "Bomba Ltda",
    referencia: "Bomba d'água",
    centro_custo_id: "obra-1",
    data_pagamento: "2026-03-10",
    prazo_estimado: null,
    nivel_prioridade: "normal",
    status: "em_analise",
    created_at: "2026-03-01T12:00:00Z",
    updated_at: "2026-03-01T12:00:00Z",
    forma_pagamento_id: null,
    condicao_pagamento: null,
    observacao: null,
    pagamento_pendente: false,
    previsao: false,
  },
  {
    id: "s2",
    setor: "compras",
    valor: 90000,
    solicitante: "Bruno",
    fornecedor: "Aço S/A",
    referencia: "Vergalhão",
    centro_custo_id: "obra-2",
    data_pagamento: "2026-03-12",
    prazo_estimado: null,
    nivel_prioridade: "alta",
    status: "aprovado",
    created_at: "2026-03-02T12:00:00Z",
    updated_at: "2026-03-02T12:00:00Z",
    forma_pagamento_id: null,
    condicao_pagamento: null,
    observacao: null,
    pagamento_pendente: false,
    previsao: false,
  },
];

vi.mock("@/hooks/financeiro/useSolicitacoesFinanceiras", () => ({
  useSolicitacoesFinanceiras: () => ({ data: solicitacoes, isLoading: false, refetch: refetchFake }),
  useSolicitacaoComentarios: () => ({ data: semComentarios, isLoading: false, refetch: refetchFake }),
  useSaveSolicitacao: () => ({ mutateAsync: vi.fn() }),
  useUpdateSolicitacaoStatus: () => ({ mutateAsync: vi.fn() }),
  useCreateSolicitacaoComentario: () => ({ mutateAsync: vi.fn() }),
  useInvalidateSolicitacoes: () => vi.fn(),
}));
vi.mock("@/hooks/financeiro/useFormasPagamento", () => ({
  useFormasPagamento: () => ({ data: semFormas, isLoading: false, refetch: refetchFake }),
}));
vi.mock("@/hooks/financeiro/useDespesas", () => ({ useSaveDespesa: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/contexts/auth/usePermissions", () => ({
  usePermissions: () => ({ hasAccess: () => true, can: () => true }),
}));
// Identidades estáveis de propósito: devolver literais novos a cada chamada faz
// os memos e efeitos que dependem deles rodarem a cada render — o dublê passa a
// testar o próprio dublê.
const jogador = { id: "p1", login: "ana", isGM: true };
const obrasFake = [
  { id: "obra-1", nome: "Obra Alfa" },
  { id: "obra-2", nome: "Obra Beta" },
];
const semColaboradores: unknown[] = [];
vi.mock("@/contexts/auth/useAuth", () => ({ useAuth: () => ({ currentPlayer: jogador }) }));
vi.mock("@/contexts/ObrasContext", () => ({ useObrasContext: () => ({ obras: obrasFake }) }));
vi.mock("@/contexts/ColaboradoresContext", () => ({
  useColaboradoresContext: () => ({ colaboradores: semColaboradores }),
}));
vi.mock("@/components/financeiro/aprovacao/EvolucaoAprovacoesCard", () => ({
  EvolucaoAprovacoesCard: () => <div />,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import AprovacaoFinanceira from "../AprovacaoFinanceira";

const EspiaoDeUrl = () => {
  const { search } = useLocation();
  return <div data-testid="url-atual">{search}</div>;
};

const abrirEm = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AprovacaoFinanceira />
      <EspiaoDeUrl />
    </MemoryRouter>,
  );

const linhasDaFila = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .filter((tr) => within(tr).queryAllByRole("cell").length > 1);

describe("Aprovação Financeira · estado na URL", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("aplica a busca que veio no endereço", () => {
    abrirEm("/financeiro/aprovacao?q=bomba");
    expect(screen.getByDisplayValue("bomba")).toBeInTheDocument();
    const linhas = linhasDaFila();
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText("Ana")).toBeInTheDocument();
  });

  it("aplica a ordenação que veio no endereço", () => {
    abrirEm("/financeiro/aprovacao?sort=valor&dir=desc");
    const primeira = linhasDaFila()[0];
    expect(within(primeira).getByText("Bruno")).toBeInTheDocument();
  });

  it("preserva o filtro de obra que veio no endereço", () => {
    // A armadilha: o efeito que semeia "todas as obras" roda depois da
    // montagem. Se ele atropelasse a seleção da URL, as duas linhas voltariam.
    abrirEm("/financeiro/aprovacao?obras=obra-2");
    const linhas = linhasDaFila();
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText("Bruno")).toBeInTheDocument();
  });

  it("ignora ordenação inválida em vez de quebrar", () => {
    // A URL é texto de terceiro: pode chegar com qualquer coisa.
    abrirEm("/financeiro/aprovacao?sort=DROP%20TABLE&dir=sideways");
    expect(linhasDaFila()).toHaveLength(2);
  });

  it("não escreve na URL o que está no padrão", async () => {
    abrirEm("/financeiro/aprovacao");
    // Sem filtro nenhum aplicado, o endereço tem de continuar limpo.
    await vi.waitFor(() => {
      expect(screen.getByTestId("url-atual")).toHaveTextContent("");
    });
  });
});
