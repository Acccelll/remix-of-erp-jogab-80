import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// A página é feita de componentes Radix, que dependem de APIs de layout e de
// ponteiro que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

/**
 * As ações da linha moraram soltas na coluna até a fila ser refeita — e o
 * "Copiar" acabou ficando pelo caminho. Agora as três que mexem na solicitação
 * (copiar, editar, cancelar) vivem atrás das reticências, e aprovar/recusar
 * seguem à mostra. O que este teste protege é isso não regredir de novo: que o
 * Copiar exista, que dispare a duplicação de verdade, e que o menu respeite
 * tanto a permissão quanto o status.
 */

const refetchFake = vi.fn();
const duplicar = vi.fn().mockResolvedValue({});
const semComentarios: unknown[] = [];
const semFormas: unknown[] = [];

// `canEdit` é lido de hasAccess("financeiro", "compras"); a variável deixa cada
// caso escolher a permissão sem precisar de um segundo arquivo de dublês.
let podeEditar = true;

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
    previsao: true,
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
  useSaveSolicitacao: () => ({ mutateAsync: duplicar }),
  useUpdateSolicitacaoStatus: () => ({ mutateAsync: vi.fn() }),
  useCreateSolicitacaoComentario: () => ({ mutateAsync: vi.fn() }),
  useInvalidateSolicitacoes: () => vi.fn(),
}));
vi.mock("@/hooks/financeiro/useFormasPagamento", () => ({
  useFormasPagamento: () => ({ data: semFormas, isLoading: false, refetch: refetchFake }),
}));
vi.mock("@/hooks/financeiro/useDespesas", () => ({ useSaveDespesa: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/contexts/auth/usePermissions", () => ({
  usePermissions: () => ({
    hasAccess: (_modulo: string, acao: string) => (acao === "compras" ? podeEditar : true),
    can: () => true,
  }),
}));
// Identidades estáveis de propósito: devolver literais novos a cada chamada faz
// os memos e efeitos que dependem deles rodarem a cada render.
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

// O `TooltipProvider` é global no app (`AppProviders`); aqui ele precisa vir
// junto, senão os "i" do formulário derrubam a renderização.
const abrirPagina = () =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/financeiro/aprovacao"]}>
        <AprovacaoFinanceira />
      </MemoryRouter>
    </TooltipProvider>,
  );

/** A linha da fila em que aquele solicitante aparece. */
const linhaDe = (solicitante: string) => {
  const linha = screen
    .getAllByRole("row")
    .find((tr) => within(tr).queryByText(solicitante) !== null);
  if (!linha) throw new Error(`Linha de ${solicitante} não encontrada`);
  return linha;
};

// Abre pelo teclado: o jsdom não constrói PointerEvent de verdade, então o
// `button` que o Radix checa no pointerdown se perde e o menu não abre. A tecla
// é um caminho que o próprio componente suporta e que sobrevive ao ambiente.
const abrirMenuDe = (solicitante: string) =>
  fireEvent.keyDown(within(linhaDe(solicitante)).getByLabelText("Mais ações"), {
    key: "ArrowDown",
  });

const itemDoMenu = (rotulo: RegExp) => screen.findByRole("menuitem", { name: rotulo });

describe("Aprovação Financeira · ações da linha", () => {
  beforeEach(() => {
    window.localStorage.clear();
    duplicar.mockClear();
    podeEditar = true;
  });

  it("reúne copiar, editar e cancelar atrás das reticências", async () => {
    abrirPagina();
    abrirMenuDe("Ana");
    expect(await itemDoMenu(/Copiar/)).toBeInTheDocument();
    expect(await itemDoMenu(/Editar/)).toBeInTheDocument();
    expect(await itemDoMenu(/Cancelar/)).toBeInTheDocument();
  });

  it("copiar cria uma nova solicitação em análise a partir da original", async () => {
    abrirPagina();
    abrirMenuDe("Ana");
    fireEvent.click(await itemDoMenu(/Copiar/));

    await vi.waitFor(() => expect(duplicar).toHaveBeenCalledTimes(1));
    const { payload } = duplicar.mock.calls[0][0];
    // Copia os dados da original, mas nasce em análise e sem o parecer da outra.
    expect(payload).toMatchObject({
      fornecedor: "Bomba Ltda",
      referencia: "Bomba d'água",
      valor: 1500,
      status: "em_analise",
      comentario_aprovacao: null,
      // O valor copiado é o mesmo, então segue provisório: a cópia nasce
      // marcada. Perder isso faria a nova solicitação parecer valor fechado.
      previsao: true,
    });
    // Sem id: é solicitação nova, não uma gravação por cima da existente.
    expect(payload).not.toHaveProperty("id");
  });

  it("valor previsto destaca a linha em âmbar e mostra o badge", async () => {
    abrirPagina();
    const previsao = linhaDe("Ana");
    const normal = linhaDe("Bruno");

    // O badge é o que sobra quando a cor não chega: daltonismo, P&B, leitor de tela.
    expect(within(previsao).getByText("Previsão")).toBeInTheDocument();
    expect(within(normal).queryByText("Previsão")).toBeNull();

    // As variantes `even:`/`hover:` são obrigatórias: sem elas o zebrado e o
    // hover da própria linha, de especificidade maior, apagariam o âmbar.
    expect(previsao.className).toContain("bg-warning/10");
    expect(previsao.className).toContain("even:bg-warning/10");
    expect(previsao.className).toContain("hover:bg-warning/20");
    expect(normal.className).not.toContain("bg-warning");
  });

  it("fora de análise, só o copiar continua de pé", async () => {
    // Refazer uma recusada ou já aprovada é o caso mais comum de cópia; editar
    // e cancelar, esses não fazem mais sentido depois do parecer.
    abrirPagina();
    abrirMenuDe("Bruno");
    expect(await itemDoMenu(/Copiar/)).not.toHaveAttribute("aria-disabled", "true");
    expect(await itemDoMenu(/Editar/)).toHaveAttribute("aria-disabled", "true");
    expect(await itemDoMenu(/Cancelar/)).toHaveAttribute("aria-disabled", "true");
  });

  it("sem permissão de edição o menu não aparece", () => {
    // Melhor não existir do que abrir com tudo apagado.
    podeEditar = false;
    abrirPagina();
    expect(within(linhaDe("Ana")).queryByLabelText("Mais ações")).not.toBeInTheDocument();
  });
});

/**
 * A ordem dos campos do formulário nunca teve teste, e foi assim que o switch
 * de "Valor previsto" acabou nascendo no fim — a nove campos do valor que ele
 * descreve — e o "Pagamento Pendente" foi parar depois da Observação. O que
 * este bloco protege é o arranjo corrigido: cada controle perto do que governa.
 */
describe("Aprovação Financeira · formulário da solicitação", () => {
  beforeEach(() => {
    window.localStorage.clear();
    podeEditar = true;
  });

  /** Abre o formulário pelo "Editar" do menu de reticências. */
  const abrirFormulario = async () => {
    abrirPagina();
    abrirMenuDe("Ana");
    fireEvent.click(await itemDoMenu(/Editar/));
    return screen.findByRole("dialog");
  };

  it("o switch de valor previsto divide o campo com o Valor", async () => {
    await abrirFormulario();
    const campoValor = await screen.findByLabelText("Valor *");
    const grupoDoValor = campoValor.closest("div");
    if (!grupoDoValor) throw new Error("Grupo do campo Valor não encontrado");

    // Estar dentro do mesmo grupo é a garantia: solto em qualquer outro lugar
    // do formulário, o switch volta a ser um controle órfão.
    expect(within(grupoDoValor).getByLabelText("Previsto")).toBeInTheDocument();

    // E o grupo tem que ser só o do Valor. Se um dia ele passar a devolver um
    // contêiner mais largo, a asserção acima ficaria verdadeira com o switch
    // em qualquer lugar — deixaria de proteger o que se quer aqui.
    expect(within(grupoDoValor).queryByLabelText("Setor *")).toBeNull();
    expect(within(grupoDoValor).queryByLabelText("Observação")).toBeNull();
  });

  it("pagamento pendente vem antes da observação", async () => {
    // Observação é o único campo de texto livre e o que cresce — ela fecha o
    // formulário. Um checkbox depois dela ficava parecendo apêndice.
    await abrirFormulario();
    const pendente = await screen.findByText("Pagamento Pendente");
    const observacao = screen.getByLabelText("Observação");

    expect(
      pendente.compareDocumentPosition(observacao) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("a observação acompanha o texto em vez de rolar por dentro", async () => {
    // O corpo do diálogo já rola; sem isto voltam as duas barras aninhadas.
    await abrirFormulario();
    const observacao = await screen.findByLabelText("Observação");

    expect(observacao.className).toContain("resize-none");
    expect(observacao.className).toContain("overflow-hidden");
  });
});
