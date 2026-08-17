import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaginationControls } from "../PaginationControls";

// O Select do Radix depende de APIs de ponteiro e de rolagem que o jsdom não
// implementa. Os stubs ficam aqui, e não no setup global, porque este é o
// primeiro teste do projeto a abrir um Select — não há por que impor isso à
// suíte inteira antes de haver um segundo caso.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Abre pelo teclado: o jsdom não constrói PointerEvent de verdade, então o
// `button` que o Radix checa no pointerdown se perde e o menu não abre. A tecla
// é um caminho que o próprio componente suporta e que sobrevive ao ambiente.
const abrir = () => fireEvent.keyDown(screen.getByLabelText("Itens à mostra"), { key: "ArrowDown" });

/** Abre o Select e escolhe a opção pelo rótulo. */
const escolher = async (rotulo: string) => {
  abrir();
  fireEvent.click(await screen.findByRole("option", { name: rotulo }));
};

/**
 * O rodapé é compartilhado por três telas (DataTable, HistoricoSection e a fila
 * de Aprovação Financeira). O seletor de itens só existe quando o call site
 * passa `onPageSizeChange`; sem ele, o comportamento antigo tem de continuar
 * intacto — inclusive o de sumir quando tudo cabe numa página.
 */
describe("PaginationControls", () => {
  const base = { page: 1, totalItems: 42, pageSize: 10, onPageChange: () => {} };

  describe("sem seletor (call sites existentes)", () => {
    it("some quando tudo cabe numa página", () => {
      const { container } = render(
        <PaginationControls {...base} totalItems={8} pageSize={10} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("mostra contagem e navegação quando há mais de uma página", () => {
      render(<PaginationControls {...base} />);
      expect(screen.getByText(/Mostrando 1–10 de 42/)).toBeInTheDocument();
      expect(screen.getByText("de 5")).toBeInTheDocument();
      expect(screen.queryByLabelText("Itens à mostra")).not.toBeInTheDocument();
    });
  });

  describe("com seletor", () => {
    it("continua visível mesmo com tudo cabendo numa página", () => {
      // Sem isso não haveria como voltar de "100 itens" para "10".
      render(
        <PaginationControls
          {...base}
          totalItems={8}
          pageSize={10}
          onPageSizeChange={() => {}}
        />,
      );
      expect(screen.getByLabelText("Itens à mostra")).toBeInTheDocument();
      expect(screen.getByText(/Mostrando 1–8 de 8/)).toBeInTheDocument();
    });

    it("esconde a navegação quando só existe uma página", () => {
      render(
        <PaginationControls
          {...base}
          totalItems={8}
          pageSize={10}
          onPageSizeChange={() => {}}
        />,
      );
      expect(screen.queryByText(/^de \d+$/)).not.toBeInTheDocument();
    });

    it("avisa a escolha do usuário", async () => {
      const onPageSizeChange = vi.fn();
      render(<PaginationControls {...base} onPageSizeChange={onPageSizeChange} />);

      await escolher("50");

      expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });

    it("respeita as opções que o call site define", async () => {
      render(
        <PaginationControls {...base} pageSizeOptions={[5, 15]} onPageSizeChange={() => {}} />,
      );
      abrir();
      expect(await screen.findByRole("option", { name: "5" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "100" })).not.toBeInTheDocument();
    });
  });
});
