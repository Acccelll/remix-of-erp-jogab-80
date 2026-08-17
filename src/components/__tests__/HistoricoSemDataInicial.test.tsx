import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import HistoricoSection from "../common/HistoricoSection";
import VeiculoHistoricoSection from "../frotas/VeiculoHistoricoSection";
import PatrimonioHistoricoSection from "../patrimonios/PatrimonioHistoricoSection";
import ContratoHistoricoSection from "../contratos/ContratoHistoricoSection";
import type {
  Colaborador,
  Veiculo,
  Patrimonio,
  Contrato,
  Obra,
  HistoricoEntry,
  PeriodoAlocacao,
} from "@/types";

const obraA: Obra = {
  id: "obra-a",
  nome: "Obra Alpha",
  cliente: "Cliente A",
  ativa: true,
  requerIntegracao: false,
  integracaoInfo: "",
};
const obraB: Obra = {
  id: "obra-b",
  nome: "Obra Beta",
  cliente: "Cliente B",
  ativa: true,
  requerIntegracao: false,
  integracaoInfo: "",
};
const obras: Obra[] = [obraA, obraB];

// Bases mínimas para satisfazer os tipos sem precisar preencher tudo.
const baseColab: Colaborador = {
  id: "c1",
  matricula: "001",
  nome: "Fulano",
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

const baseVeiculo: Veiculo = {
  id: "v1",
  codigo: "VC001",
  nome: "Caminhão 1",
  tipo: "Utilitário",
  ativo: true,
  obraAtualId: null,
  riscado: false,
  quebrado: false,
  alugado: false,
  mobilizacaoPendente: null,
  historico: [],
};

const basePatrimonio: Patrimonio = {
  id: "p1",
  codigo: "PT0001",
  nome: "Furadeira",
  ativo: true,
  obraAtualId: null,
  riscado: false,
  quebrado: false,
  alugado: false,
  mobilizacaoPendente: null,
  historico: [],
};

const baseContrato: Contrato = {
  id: "k1",
  locacaoServico: "Internet fibra",
  inicio: "01/01/2025",
  termino: "31/12/2025",
  responsavel: "",
  contato: "",
  valor: 1200,
  tipo: "Internet",
  status: "ativo",
  ativo: true,
  obraAtualId: null,
  mobilizacaoPendente: null,
  historico: [],
  aditivos: [],
};

const mobEntry = (id: string, obraNome: string, dataBR: string): HistoricoEntry => ({
  id,
  tipo: "mobilizacao",
  descricao: `Mobilizado de Origem para "${obraNome}" em ${dataBR}`,
  data: dataBR,
  usuario: "tester",
});

/** Período de obra no formato devolvido pela rota `mobilizacoesPeriodos`. */
const periodoObra = (
  id: string,
  obra: Obra,
  inicio: string,
  fim: string | null,
  dias: number,
): PeriodoAlocacao => ({
  id,
  colaborador_id: "c1",
  tipo: "obra",
  obra_id: obra.id,
  obra_nome: obra.nome,
  status: null,
  data_inicio: inicio,
  data_fim: fim,
  dias,
});

describe("Históricos sem data de mobilização inicial", () => {
  // Colaborador, patrimônio e contrato deixaram de derivar períodos da prosa de
  // `historico[].descricao` e do período-base sintético: os períodos vêm
  // prontos das rotas `mobilizacoesPeriodos`, `patrimoniosPeriodos` e
  // `contratosPeriodos`, que já devolvem o período aberto.
  //
  // VEÍCULO é o único que segue no modelo antigo — regex sobre a descrição mais
  // período sintético — e os casos dele abaixo continuam inalterados de
  // propósito, cobrindo esse comportamento até que ele também seja migrado.
  describe("HistoricoSection (Colaborador)", () => {
    it("não inventa período quando o backend não devolve nenhum", () => {
      const colab: Colaborador = {
        ...baseColab,
        obraAtualId: obraA.id,
        historico: [],
      };
      render(<HistoricoSection colab={colab} obras={obras} />);
      // Antes, `obraAtualId` sozinho fabricava um card sem data inicial. Um
      // período sem início conhecido não é um fato do histórico: se o backend
      // não registrou, a aba não afirma.
      expect(screen.queryByText(obraA.nome)).not.toBeInTheDocument();
      expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument();
    });

    it("exibe o período aberto vindo do backend, sem duplicar a obra atual", () => {
      const colab: Colaborador = { ...baseColab, obraAtualId: obraA.id, historico: [] };
      render(
        <HistoricoSection
          colab={colab}
          obras={obras}
          mobPeriodos={[periodoObra("p1", obraA, "2025-01-10", null, 120)]}
        />,
      );
      expect(screen.getAllByText(obraA.nome)).toHaveLength(1);
      // Texto exato: "120 dias" solto casaria também o badge de total da seção.
      expect(screen.getByText("120 dias")).toBeInTheDocument();
      expect(screen.getByText(/10\/01\/2025\s*—\s*Atual/)).toBeInTheDocument();
    });

    it("lista os períodos anteriores além do mais recente", () => {
      const colab: Colaborador = { ...baseColab, obraAtualId: obraB.id, historico: [] };
      render(
        <HistoricoSection
          colab={colab}
          obras={obras}
          mobPeriodos={[
            periodoObra("p1", obraA, "2025-01-10", "2025-03-31", 81),
            periodoObra("p2", obraB, "2025-04-01", null, 90),
          ]}
        />,
      );
      // O mais recente vira o card destacado; o anterior fica na lista.
      expect(screen.getByText(obraB.nome)).toBeInTheDocument();
      expect(screen.getByText(/Ver histórico anterior \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(obraA.nome)).toBeInTheDocument();
    });

    it("período de férias não entra em Mobilizações e não soma dias de obra", () => {
      const colab: Colaborador = {
        ...baseColab,
        obraAtualId: null,
        statusEspecial: "ferias",
        historico: [],
      };
      render(
        <HistoricoSection
          colab={colab}
          obras={obras}
          mobPeriodos={[
            periodoObra("p1", obraA, "2025-01-10", "2025-03-31", 81),
            {
              id: "p2",
              colaborador_id: "c1",
              tipo: "status",
              obra_id: null,
              obra_nome: null,
              status: "ferias",
              data_inicio: "2025-04-01",
              data_fim: null,
              dias: 30,
            },
          ]}
        />,
      );
      // O total de Mobilizações conta só os 81 dias em obra: férias aparecem
      // à parte, não somadas como se fossem trabalho na obra.
      expect(screen.getByText(/1 período\(s\) — 81 dias em obra/)).toBeInTheDocument();
      expect(screen.getByText(/\+30d fora de obra/)).toBeInTheDocument();
      expect(screen.getByText(/Férias, folga e afastamento/)).toBeInTheDocument();
    });
  });

  describe("VeiculoHistoricoSection", () => {
    it("exibe obra atual sem data inicial quando não há mobilização", () => {
      const veiculo: Veiculo = { ...baseVeiculo, obraAtualId: obraA.id };
      render(<VeiculoHistoricoSection veiculo={veiculo} obras={obras} />);
      expect(screen.getByText(obraA.nome)).toBeInTheDocument();
      expect(screen.getByText(/Mobilização inicial não registrada/i)).toBeInTheDocument();
    });

    it("renderiza nada relativo a obra quando obraAtualId é null e histórico vazio", () => {
      const veiculo: Veiculo = { ...baseVeiculo, obraAtualId: null };
      render(<VeiculoHistoricoSection veiculo={veiculo} obras={obras} />);
      expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument();
      expect(screen.queryByText(/Mobilização inicial não registrada/i)).not.toBeInTheDocument();
    });
  });

  // Patrimônio passou ao mesmo contrato tipado do colaborador: os períodos vêm
  // da rota `patrimoniosPeriodos` e o período-base sintético deixou de existir.
  describe("PatrimonioHistoricoSection", () => {
    it("não inventa período quando o backend não devolve nenhum", () => {
      const patrimonio: Patrimonio = { ...basePatrimonio, obraAtualId: obraA.id };
      render(<PatrimonioHistoricoSection patrimonio={patrimonio} obras={obras} periodos={[]} />);
      expect(screen.queryByText(obraA.nome)).not.toBeInTheDocument();
      expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument();
    });

    it("separa dias em obra dos dias sob responsável", () => {
      const patrimonio: Patrimonio = { ...basePatrimonio, obraAtualId: null, responsavelId: "c1" };
      render(
        <PatrimonioHistoricoSection
          patrimonio={patrimonio}
          obras={obras}
          periodos={[
            {
              id: "p1", patrimonio_id: "p1", tipo: "obra", obra_id: obraA.id,
              obra_nome: obraA.nome, status: null, data_inicio: "2025-01-01",
              data_fim: "2025-03-31", dias: 90,
            },
            {
              id: "p2", patrimonio_id: "p1", tipo: "responsavel", obra_id: null,
              obra_nome: null, status: null, colaborador_id: "c1",
              colaborador_nome: "Fulano", data_inicio: "2025-04-01",
              data_fim: null, dias: 40,
            },
          ]}
        />,
      );
      // Os 40 dias sob responsável não entram no total de dias em obra.
      expect(screen.getByText(/1 período\(s\) — 90 dias em obra/)).toBeInTheDocument();
      expect(screen.getByText(/\+40d fora de obra/)).toBeInTheDocument();
      // E a responsabilidade agora aparece no histórico do bem, o que antes
      // só existia em responsabilidades_patrimonios.
      expect(screen.getByText("Responsáveis")).toBeInTheDocument();
      expect(screen.getByText("Fulano")).toBeInTheDocument();
    });
  });

  // Contrato passou ao mesmo contrato tipado: períodos vêm da rota
  // `contratosPeriodos` e o período-base sintético deixou de existir.
  describe("ContratoHistoricoSection", () => {
    it("não inventa período quando o backend não devolve nenhum", () => {
      const contrato: Contrato = { ...baseContrato, obraAtualId: obraA.id };
      render(
        <ContratoHistoricoSection
          contrato={contrato}
          obras={obras}
          valorAtual={1200}
          periodos={[]}
        />,
      );
      expect(screen.queryByText(obraA.nome)).not.toBeInTheDocument();
      expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument();
    });

    it("período ocioso não recebe custo de obra nem soma dias alocados", () => {
      const contrato: Contrato = {
        ...baseContrato,
        inicio: "01/01/2025",
        termino: "30/01/2025",
        obraAtualId: null,
        ocioso: true,
      };
      render(
        <ContratoHistoricoSection
          contrato={contrato}
          obras={obras}
          valorAtual={3000}
          periodos={[
            {
              id: "p1", contrato_id: "k1", tipo: "obra", obra_id: obraA.id,
              obra_nome: obraA.nome, status: null, data_inicio: "2025-01-01",
              data_fim: "2025-01-20", dias: 20,
            },
            {
              id: "p2", contrato_id: "k1", tipo: "status", obra_id: null,
              obra_nome: null, status: "ocioso", data_inicio: "2025-01-21",
              data_fim: null, dias: 10,
            },
          ]}
        />,
      );
      // 30 dias de vigência para R$ 3.000 → R$ 100/dia. A obra fica com os 20
      // dias em que o contrato esteve a serviço dela; os 10 ociosos não são
      // atribuídos a obra nenhuma.
      expect(screen.getByText(/1 período\(s\) — 20 dias em obra/)).toBeInTheDocument();
      expect(screen.getByText(/\+10d ocioso/)).toBeInTheDocument();
      expect(screen.getByText("Períodos ociosos")).toBeInTheDocument();
    });
  });

  describe("Filtro temporal com sintético", () => {
    it("colaborador: sintético não aparece em anosDisponiveis (sem ano para filtrar)", () => {
      const colab: Colaborador = {
        ...baseColab,
        obraAtualId: obraA.id,
        historico: [],
      };
      render(<HistoricoSection colab={colab} obras={obras} />);
      // Como só temos o sintético (sem data), não há ano disponível além do "Todos".
      // O trigger do Ano mostra "Todos os anos".
      expect(screen.getByText(/Todos os anos/i)).toBeInTheDocument();
    });
  });
});
