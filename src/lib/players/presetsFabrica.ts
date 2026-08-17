/** @module-kind pure */
// PRO-031 · slice-02 — Presets de fábrica para o Quadro de Permissões.

import {
  listarModulos,
  toggleModulo,
  setAcao,
  type MatrizPermissoes,
  type PapeisEspeciais,
} from "@/lib/authz/paginas";

export interface PresetFabrica {
  id: string;
  nome: string;
  descricao: string;
  build: () => { matriz: MatrizPermissoes; papeis: PapeisEspeciais };
}

function modPor(id: string) {
  return listarModulos().find((m) => m.id === id);
}

function marcarModulo(
  matriz: MatrizPermissoes,
  moduloId: string,
  acoes: ("V" | "E" | "X" | "I" | "Ex")[],
): MatrizPermissoes {
  const m = modPor(moduloId);
  if (!m) return matriz;
  let out = matriz;
  for (const a of acoes) out = toggleModulo(out, m, a, true);
  return out;
}

export const PRESETS_FABRICA: PresetFabrica[] = [
  {
    id: "auditor",
    nome: "Auditor",
    descricao: "Somente leitura + exportar. Nunca edita ou exclui.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      for (const m of listarModulos()) {
        matriz = toggleModulo(matriz, m, "V", true);
        matriz = toggleModulo(matriz, m, "Ex", true);
      }
      return { matriz, papeis: {} };
    },
  },
  {
    id: "fiscal-obra",
    nome: "Fiscal de Obra",
    descricao: "Ver/editar Obras e Qualidade. Setor fiscalização.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "obras", ["V", "E"]);
      return { matriz, papeis: { setores: ["fiscalizacao"] } };
    },
  },
  {
    id: "engenheiro-residente",
    nome: "Engenheiro Residente",
    descricao: "Operação plena em Obras + aprovar compras.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "obras", ["V", "E", "X", "Ex"]);
      matriz = marcarModulo(matriz, "suprimentos", ["V", "E"]);
      return {
        matriz,
        papeis: { aprovarCompras: true, setores: ["engenharia"] },
      };
    },
  },
  {
    id: "comprador",
    nome: "Comprador",
    descricao: "Suprimentos completo + aprovar compras.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "suprimentos", ["V", "E", "I", "Ex"]);
      matriz = marcarModulo(matriz, "obras", ["V"]);
      return { matriz, papeis: { aprovarCompras: true } };
    },
  },
  {
    id: "almoxarife",
    nome: "Almoxarife",
    descricao: "Patrimônios, estoque e recebimento.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "ativos", ["V", "E", "Ex"]);
      matriz = marcarModulo(matriz, "suprimentos", ["V", "E"]);
      return { matriz, papeis: {} };
    },
  },
  {
    id: "rh-view",
    nome: "RH — Visualização",
    descricao: "Somente ler RH e DP + exportar relatórios.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "recursos-humanos", ["V", "Ex"]);
      matriz = marcarModulo(matriz, "departamento-pessoal", ["V", "Ex"]);
      return { matriz, papeis: {} };
    },
  },
  {
    id: "rh-ops",
    nome: "RH — Operação",
    descricao: "Operar RH e DP com importação de folha.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "recursos-humanos", ["V", "E", "I", "Ex"]);
      matriz = marcarModulo(matriz, "departamento-pessoal", ["V", "E", "I", "Ex"]);
      return { matriz, papeis: {} };
    },
  },
  {
    id: "financeiro-analista",
    nome: "Financeiro — Analista",
    descricao: "Operar Financeiro (sem aprovar).",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "financeiro", ["V", "E", "I", "Ex"]);
      return { matriz, papeis: {} };
    },
  },
  {
    id: "financeiro-aprovador",
    nome: "Financeiro — Aprovador",
    descricao: "Analista + poder de aprovar pagamentos.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "financeiro", ["V", "E", "X", "I", "Ex"]);
      return { matriz, papeis: { aprovarFinanceiro: true, aprovarCompras: true } };
    },
  },
  {
    id: "crm-vendedor",
    nome: "CRM — Vendedor",
    descricao: "Operar CRM e exportar relatórios.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      matriz = marcarModulo(matriz, "crm", ["V", "E", "Ex"]);
      return { matriz, papeis: {} };
    },
  },
  {
    id: "gm-readonly",
    nome: "GM (preview leitura)",
    descricao: "Ver tudo sem alterar — útil para dry-run.",
    build: () => {
      let matriz: MatrizPermissoes = {};
      for (const m of listarModulos()) {
        matriz = toggleModulo(matriz, m, "V", true);
        matriz = toggleModulo(matriz, m, "Ex", true);
      }
      // pequena tolerância: nada de editar; explicitamente remover X.
      for (const m of listarModulos()) {
        for (const pg of m.paginas) {
          matriz = setAcao(matriz, pg.rota, "X", false);
          matriz = setAcao(matriz, pg.rota, "E", false);
        }
      }
      return { matriz, papeis: {} };
    },
  },
];
