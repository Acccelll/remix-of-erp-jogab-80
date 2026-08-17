import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrendSummary } from "../TrendSummary";

describe("TrendSummary", () => {
  it("não renderiza nada quando total é zero", () => {
    const { container } = render(
      <TrendSummary piora={0} estavel={0} melhora={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza placeholder quando total=0 e showWhenEmpty", () => {
    render(
      <TrendSummary
        piora={0}
        estavel={0}
        melhora={0}
        showWhenEmpty
        label="Últimas 4 semanas"
        emptyLabel="Sem dados"
      />,
    );
    expect(screen.getByText(/Últimas 4 semanas/)).toBeInTheDocument();
    expect(screen.getByText("Sem dados")).toBeInTheDocument();
  });


  it("renderiza contadores como spans quando não há onTogglePiora", () => {
    render(<TrendSummary piora={2} estavel={3} melhora={1} />);
    expect(screen.getByText(/Tendência \(6 com histórico\)/)).toBeInTheDocument();
    expect(screen.getByText(/2 em piora/)).toBeInTheDocument();
    expect(screen.getByText(/3 estáveis/)).toBeInTheDocument();
    expect(screen.getByText(/1 em melhora/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("chip 'em piora' vira botão toggle e chama onTogglePiora", () => {
    const onToggle = vi.fn();
    render(
      <TrendSummary
        piora={4}
        estavel={0}
        melhora={0}
        onTogglePiora={onToggle}
        piorAtiva={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /4 em piora/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("botão fica aria-pressed=true quando piorAtiva", () => {
    render(
      <TrendSummary
        piora={2}
        estavel={0}
        melhora={0}
        onTogglePiora={() => {}}
        piorAtiva
      />,
    );
    expect(screen.getByRole("button", { name: /2 em piora/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("botão fica desabilitado quando piora=0 e filtro inativo", () => {
    render(
      <TrendSummary
        piora={0}
        estavel={2}
        melhora={1}
        onTogglePiora={() => {}}
        piorAtiva={false}
      />,
    );
    expect(screen.getByRole("button", { name: /0 em piora/ })).toBeDisabled();
  });

  it("botão permanece habilitado quando piora=0 mas filtro está ativo (para permitir desligar)", () => {
    render(
      <TrendSummary
        piora={0}
        estavel={2}
        melhora={1}
        onTogglePiora={() => {}}
        piorAtiva
      />,
    );
    expect(screen.getByRole("button", { name: /0 em piora/ })).not.toBeDisabled();
  });

  it("aceita rótulos customizados via prop labels", () => {
    render(
      <TrendSummary
        piora={1}
        estavel={2}
        melhora={3}
        labels={{ piora: "atrasadas", estavel: "no prazo", melhora: "adiantadas" }}
      />,
    );
    expect(screen.getByText(/1 atrasadas/)).toBeInTheDocument();
    expect(screen.getByText(/2 no prazo/)).toBeInTheDocument();
    expect(screen.getByText(/3 adiantadas/)).toBeInTheDocument();
  });
});
