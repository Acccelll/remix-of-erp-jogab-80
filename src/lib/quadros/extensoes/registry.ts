/** @module-kind pure */
/**
 * ETAPA 2 · Registro central de extensões (código) — híbrido com o banco.
 *
 * Decisão arquitetural: o *catálogo* vive no banco (`kanban_extensoes`) para que
 * RLS, FKs e configurações por quadro tenham integridade referencial; os
 * *metadados de apresentação* (ícone, ordem do painel, ações, compatibilidade)
 * vivem aqui, em código, porque são versionados junto ao componente que os usa.
 * A chave de junção é o `codigo`.
 */
import type { EntityType, ExtensaoDef } from "./tipos";

export const EXTENSOES: ExtensaoDef[] = [
  {
    codigo: "obra",
    nome: "Obras",
    descricao: "Vincula o card a uma obra do ERP e exibe seu resumo.",
    icone: "Building2",
    versao: "1.0.0",
    modulo: "obras",
    entityTypes: ["obra"],
    cardTipos: [],
    painelOrdem: 10,
    suportaResumo: true,
    acoes: [
      {
        codigo: "revalidar_vinculos",
        rotulo: "Revalidar vínculos",
        descricao: "Reconsulta a fonte oficial e registra o resultado no histórico.",
        exigeEdicao: true,
      },
    ],
  },
  {
    codigo: "cronograma",
    nome: "Cronograma",
    descricao: "Vincula o card a atividades do cronograma (leitura nesta etapa).",
    icone: "CalendarRange",
    versao: "1.0.0",
    modulo: "planejamento",
    entityTypes: ["cronograma_item"],
    cardTipos: [],
    painelOrdem: 20,
    suportaResumo: true,
    acoes: [
      {
        codigo: "revalidar_vinculos",
        rotulo: "Revalidar vínculos",
        descricao: "Reconsulta a fonte oficial e registra o resultado no histórico.",
        exigeEdicao: true,
      },
    ],
  },
  {
    codigo: "pessoas",
    nome: "Pessoas",
    descricao: "Vincula o card a usuários do ERP.",
    icone: "Users",
    versao: "1.0.0",
    modulo: "core",
    entityTypes: ["usuario"],
    cardTipos: [],
    painelOrdem: 30,
    suportaResumo: false,
    acoes: [],
  },
  {
    codigo: "locacao",
    nome: "Locações",
    descricao: "Vincula o card a um contrato de locação (equipamento/serviço) do ERP.",
    icone: "FileSignature",
    versao: "1.0.0",
    modulo: "contratos",
    entityTypes: ["locacao"],
    cardTipos: [],
    painelOrdem: 40,
    // Fonte é MySQL — sem verificação server-side de existência/situação
    // (ver kanban_entidade_info); resumo vem só do adapter no frontend.
    suportaResumo: true,
    acoes: [],
  },
  {
    codigo: "patrimonio",
    nome: "Patrimônios",
    descricao: "Vincula o card a um patrimônio do ERP.",
    icone: "Boxes",
    versao: "1.0.0",
    modulo: "patrimonios",
    entityTypes: ["patrimonio"],
    cardTipos: [],
    painelOrdem: 50,
    suportaResumo: true,
    acoes: [],
  },
  {
    codigo: "romaneio",
    nome: "Romaneios",
    descricao: "Vincula o card a um romaneio de logística de ativos.",
    icone: "Truck",
    versao: "1.0.0",
    modulo: "logistica_ativos",
    entityTypes: ["romaneio"],
    cardTipos: [],
    painelOrdem: 60,
    suportaResumo: true,
    acoes: [
      {
        codigo: "revalidar_vinculos",
        rotulo: "Revalidar vínculos",
        descricao: "Reconsulta a fonte oficial e registra o resultado no histórico.",
        exigeEdicao: true,
      },
    ],
  },
];

const porCodigo = new Map(EXTENSOES.map((e) => [e.codigo, e]));

export function getExtensao(codigo: string): ExtensaoDef | undefined {
  return porCodigo.get(codigo);
}

export function listExtensoes(): ExtensaoDef[] {
  return [...EXTENSOES].sort((a, b) => a.painelOrdem - b.painelOrdem);
}

export function extensaoSuportaEntidade(codigo: string, entityType: string): boolean {
  const ext = porCodigo.get(codigo);
  return !!ext && ext.entityTypes.includes(entityType as EntityType);
}

/** Extensão compatível com o tipo do card (lista vazia = compatível com todos). */
export function extensaoCompativelComTipo(codigo: string, cardTipoCodigo?: string | null): boolean {
  const ext = porCodigo.get(codigo);
  if (!ext) return false;
  if (ext.cardTipos.length === 0) return true;
  if (!cardTipoCodigo) return false;
  return ext.cardTipos.includes(cardTipoCodigo);
}

/** Extensão que declara suporte a um tipo de entidade (para montar o seletor). */
export function extensaoParaEntidade(entityType: string): ExtensaoDef | undefined {
  return EXTENSOES.find((e) => e.entityTypes.includes(entityType as EntityType));
}

export function acoesDaExtensao(codigo: string) {
  return porCodigo.get(codigo)?.acoes ?? [];
}
