/** @module-kind pure */
/**
 * ETAPA 2 · Contratos da camada de extensões e vínculos.
 *
 * O motor Kanban não conhece regras de domínio: ele conhece apenas estes
 * contratos. Cada módulo do ERP fornece um *adaptador* que implementa
 * `EntityAdapter` e uma entrada no registro (`ExtensaoDef`).
 */

/** Tipos de entidade vinculável já suportados (expansível por módulo). */
export type EntityType =
  | "obra"
  | "cronograma_item"
  | "usuario"
  | "locacao"
  | "patrimonio"
  | "romaneio";

export type VinculoSituacao = "ok" | "arquivada" | "quebrado";

export interface ExtensaoDef {
  /** Código técnico estável — chave em `kanban_extensoes.codigo`. */
  codigo: string;
  nome: string;
  descricao: string;
  /** Nome do ícone lucide-react. */
  icone: string;
  versao: string;
  /** Módulo responsável pelos dados (fonte oficial). */
  modulo: string;
  /** Tipos de entidade que a extensão sabe vincular. */
  entityTypes: EntityType[];
  /** Códigos de tipo de card compatíveis. Vazio = compatível com todos. */
  cardTipos: string[];
  /** Ordem do painel no detalhe do card. */
  painelOrdem: number;
  /** Se pode contribuir com resumo na frente do card. */
  suportaResumo: boolean;
  /** Ações neutras registradas pela extensão (Etapa 2: apenas técnicas). */
  acoes: ExtensaoAcaoDef[];
}

export interface ExtensaoAcaoDef {
  codigo: string;
  rotulo: string;
  descricao: string;
  /** `true` quando exige permissão de edição do card. */
  exigeEdicao: boolean;
}

export interface EntidadeResumo {
  id: string;
  entityType: EntityType;
  nome: string;
  subtitulo?: string | null;
  status?: string | null;
  arquivada?: boolean;
  empresaId?: string | null;
  rota?: string | null;
}

/** Contrato comum a todos os adaptadores de domínio. */
export interface EntityAdapter {
  entityType: EntityType;
  rotulo: string;
  /** Busca paginada respeitando RLS do módulo de origem. */
  searchEntities(termo: string, limite?: number): Promise<EntidadeResumo[]>;
  /** Resumo de apresentação (não é fonte oficial — é cache de exibição). */
  getEntitySummary(id: string): Promise<EntidadeResumo | null>;
  getEntityDisplayName(e: EntidadeResumo): string;
  getEntityRoute(id: string, e?: EntidadeResumo | null): string | null;
  /** Regra local de compatibilidade card ↔ entidade. */
  validateRelationship(relationship: string): boolean;
}

/** Linha retornada pela RPC `card_entity_links_listar`. */
export interface CardVinculo {
  id: string;
  extensao_codigo: string;
  entity_type: EntityType;
  entity_id: string;
  relationship_type: string;
  is_primary: boolean;
  display_order: number;
  situacao: VinculoSituacao;
  entidade_nome: string | null;
  entidade_disponivel: boolean;
  entidade_arquivada: boolean;
  empresa_id: string | null;
  acesso_permitido: boolean;
  created_by: string | null;
  created_by_nome: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface BoardExtensao {
  id: string;
  board_id: string;
  extensao_codigo: string;
  ativo: boolean;
  mostrar_resumo: boolean;
  ordem: number;
  config: Record<string, unknown>;
}

export interface CardTipo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  extensoes_padrao: string[];
  sistema: boolean;
  ativo: boolean;
  ordem: number;
}
