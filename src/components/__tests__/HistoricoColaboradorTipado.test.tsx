import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HistoricoSection from "../common/HistoricoSection";
import type { Colaborador, HistoricoEntry, Obra, PeriodoAlocacao } from "@/types";

/**
 * Contrato tipado do histórico do colaborador: períodos vêm da rota
 * `mobilizacoesPeriodos` e eventos vêm de `historico` com campos estruturados.
 * O componente não interpreta mais a prosa de `descricao`.
 */

const obra212: Obra = {
  id: "8",
  nome: "212",
  cliente: "Cliente",
  ativa: true,
  requerIntegracao: false,
  integracaoInfo: "",
};
const obras: Obra[] = [obra212];

const baseColab: Colaborador = {
  id: "89",
  matricula: "0013",
  nome: "Marcus",
  genero: "",
  cep: "",
  endereco: "",
  dataNascimento: "",
  cidade: "",
  etnia: "",
  estadoCivil: "",
  nomeConjuge: "",
  nomeMae: "",
  nomePai: "",
  nacionalidade: "",
  rg: "",
  dataEmissaoRG: "",
  orgaoEmissorRG: "",
  ufEmissorRG: "",
  cpf: "",
  dataEmissaoCPF: "",
  pis: "",
  dataEmissaoPIS: "",
  dataAdmissao: "",
  funcao: "",
  salario: "",
  formaSalario: "mensal",
  ativo: true,
  obraAtualId: null,
  integracoes: [],
  documentos: [],
  historico: [],
  ferias: [],
  mobilizacaoPendente: null,
};

/**
 * A transição é renderizada como `<span>origem <span>→</span> destino</span>`,
 * então o texto fica quebrado entre elementos e um matcher de string simples
 * não encontra. Compara o `textContent` normalizado: só o span mais interno
 * bate exatamente, os ancestrais carregam texto a mais.
 */
const transicoes = (texto: string) =>
  screen.queryAllByText(
    (_, el) => (el?.textContent || "").replace(/\s+/g, " ").trim() === texto,
  );

const eventoFerias: HistoricoEntry = {
  id: "mov_710",
  tipo: "status",
  descricao: 'Status alterado de "212" para "Férias" em 09/07/2026',
  data: "2026-07-09",
  usuario: "operador",
  obraOrigemId: "8",
  obraOrigemNome: "212",
  obraDestinoId: null,
  obraDestinoNome: null,
  statusOrigem: null,
  statusDestino: "ferias",
};

describe("Histórico do colaborador — contrato tipado", () => {
  it("colaborador de férias não aparece como período de obra, e a troca de status aparece em Outros eventos", () => {
    const colab: Colaborador = {
      ...baseColab,
      obraAtualId: null,
      statusEspecial: "ferias",
      historico: [eventoFerias],
    };

    render(
      <HistoricoSection
        colab={colab}
        obras={obras}
        mobPeriodos={[
          {
            id: "p1",
            colaborador_id: "89",
            tipo: "obra",
            obra_id: "8",
            obra_nome: "212",
            status: null,
            data_inicio: "2026-03-16",
            data_fim: "2026-07-08",
            dias: 115,
          },
          {
            id: "p2",
            colaborador_id: "89",
            tipo: "status",
            obra_id: null,
            obra_nome: null,
            status: "ferias",
            data_inicio: "2026-07-09",
            data_fim: null,
            dias: 21,
          },
        ]}
      />,
    );

    // Mobilizações contam só o período em obra — o de férias fica de fora.
    expect(screen.getByText(/1 período\(s\) — 115 dias em obra/)).toBeInTheDocument();
    // A troca de status aparece como transição legível, não como prosa crua.
    expect(transicoes("212 → Férias").length).toBeGreaterThan(0);
    expect(screen.getByText(/por operador/)).toBeInTheDocument();
    // E a situação atual fica visível sem depender de abrir seção nenhuma.
    expect(screen.getByText("Situação atual")).toBeInTheDocument();
  });

  it("volta de férias para obra preserva a origem em vez de dizer Sem Alocação", () => {
    const colab: Colaborador = {
      ...baseColab,
      obraAtualId: "8",
      historico: [
        {
          id: "mov_713",
          tipo: "mobilizacao",
          descricao: 'Mobilizado de "Férias" para "212" em 14/07/2026',
          data: "2026-07-14",
          usuario: "operador",
          obraOrigemId: null,
          obraOrigemNome: null,
          obraDestinoId: "8",
          obraDestinoNome: "212",
          statusOrigem: "ferias",
          statusDestino: null,
        },
      ],
    };

    render(<HistoricoSection colab={colab} obras={obras} mobPeriodos={[]} />);
    // Eventos de mobilização não poluem "Outros eventos" — o período já os
    // representa —, então a lista de eventos fica vazia aqui.
    expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument();
  });

  it("movimentação antiga sem destino gravado é rotulada como tal, não como um status inventado", () => {
    const colab: Colaborador = {
      ...baseColab,
      historico: [
        {
          ...eventoFerias,
          id: "mov_555",
          statusDestino: "indeterminado",
          descricao: "Status alterado de 212 para Saiu da obra em 28/05/2026",
        },
      ],
    };

    render(<HistoricoSection colab={colab} obras={obras} mobPeriodos={[]} />);
    expect(transicoes("212 → Saiu da obra").length).toBeGreaterThan(0);
  });

  it("mais de uma página de eventos não esvazia a seção nem troca o período mais recente", () => {
    // Antes, a lista unificada era fatiada em 20 ANTES de ser separada em
    // seções: as mobilizações enchiam a página e "Outros eventos" vinha vazio,
    // enquanto o card "Mais recente" virava o mais recente da página.
    const muitosEventos: HistoricoEntry[] = Array.from({ length: 25 }, (_, i) => ({
      ...eventoFerias,
      id: `evt_${i}`,
      data: `2026-06-${String(i + 1).padStart(2, "0")}`,
    }));

    const periodos: PeriodoAlocacao[] = Array.from({ length: 25 }, (_, i) => ({
      id: `per_${i}`,
      colaborador_id: "89",
      tipo: "obra",
      obra_id: "8",
      obra_nome: "212",
      status: null,
      data_inicio: `2025-06-${String(i + 1).padStart(2, "0")}`,
      data_fim: `2025-07-${String(i + 1).padStart(2, "0")}`,
      dias: 30,
    }));

    render(
      <HistoricoSection colab={{ ...baseColab, historico: muitosEventos }} obras={obras} mobPeriodos={periodos} />,
    );

    // Ambas as seções renderizam na primeira página, cada uma com seu total
    // global — não o total da página.
    expect(screen.getByText(/25 período\(s\) — 750 dias em obra/)).toBeInTheDocument();
    expect(screen.getByText("Outros eventos")).toBeInTheDocument();
    expect(transicoes("212 → Férias").length).toBe(20);
  });

  it("período substituído no mesmo dia não vira intervalo invertido de 0 dias", () => {
    // Duplicatas antigas geravam linhas como "01/06/2026 — 31/05/2026 · 0d".
    render(
      <HistoricoSection
        colab={baseColab}
        obras={obras}
        mobPeriodos={[
          {
            id: "p1",
            colaborador_id: "89",
            tipo: "obra",
            obra_id: "8",
            obra_nome: "212",
            status: null,
            data_inicio: "2026-05-28",
            data_fim: "2026-05-27",
            dias: 0,
            substituido: true,
          },
          {
            id: "p2",
            colaborador_id: "89",
            tipo: "obra",
            obra_id: "8",
            obra_nome: "212",
            status: null,
            data_inicio: "2026-05-28",
            data_fim: null,
            dias: 60,
          },
        ]}
      />,
    );

    expect(screen.getByText(/1 período\(s\) — 60 dias em obra/)).toBeInTheDocument();
    expect(screen.queryByText(/27\/05\/2026/)).not.toBeInTheDocument();
  });
});
