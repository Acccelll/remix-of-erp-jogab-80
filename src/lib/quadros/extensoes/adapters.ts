/** @module-kind orchestration */
/**
 * ETAPA 2 · Adaptadores de domínio.
 *
 * Registro modular: cada tipo de entidade fornece um adaptador. Não existe
 * `switch` central espalhado — o consumidor pede `getAdapter(entityType)`.
 * Os adaptadores só falam com repositórios (nunca com supabase diretamente),
 * e a validação definitiva permanece nas RPCs do banco.
 */
import { entidadesRepo } from "@/lib/repositories/kanbanExtensoes";
import type { EntidadeResumo, EntityAdapter, EntityType } from "./tipos";

const obraAdapter: EntityAdapter = {
  entityType: "obra",
  rotulo: "Obra",
  searchEntities: (termo, limite) => entidadesRepo.buscarObras(termo, limite),
  getEntitySummary: (id) => entidadesRepo.obraPorId(id),
  getEntityDisplayName: (e) => (e.subtitulo ? `${e.subtitulo} · ${e.nome}` : e.nome),
  getEntityRoute: (id) => `/obras/${id}`,
  validateRelationship: (rel) => ["contexto", "relacionado", "responsavel"].includes(rel),
};

const cronogramaAdapter: EntityAdapter = {
  entityType: "cronograma_item",
  rotulo: "Atividade do cronograma",
  searchEntities: (termo, limite) => entidadesRepo.buscarCronogramaItens(termo, limite),
  getEntitySummary: (id) => entidadesRepo.cronogramaItemPorId(id),
  getEntityDisplayName: (e) => e.nome,
  // Etapa 2: vínculo técnico, sem fluxo funcional. A rota abre a obra do item.
  getEntityRoute: () => null,
  validateRelationship: (rel) => ["atividade", "relacionado"].includes(rel),
};

const usuarioAdapter: EntityAdapter = {
  entityType: "usuario",
  rotulo: "Usuário",
  searchEntities: (termo, limite) => entidadesRepo.buscarUsuarios(termo, limite),
  getEntitySummary: (id) => entidadesRepo.usuarioPorId(id),
  getEntityDisplayName: (e) => e.nome,
  getEntityRoute: () => null,
  validateRelationship: (rel) => ["responsavel", "relacionado"].includes(rel),
};

const ADAPTERS: Record<EntityType, EntityAdapter> = {
  obra: obraAdapter,
  cronograma_item: cronogramaAdapter,
  usuario: usuarioAdapter,
};

export function getAdapter(entityType: string): EntityAdapter | undefined {
  return ADAPTERS[entityType as EntityType];
}

export function listAdapters(): EntityAdapter[] {
  return Object.values(ADAPTERS);
}

/** Fallback seguro: nunca lança, para não quebrar o card. */
export async function resumoSeguro(
  entityType: string,
  id: string,
): Promise<{ resumo: EntidadeResumo | null; erro: string | null }> {
  const adapter = getAdapter(entityType);
  if (!adapter) return { resumo: null, erro: "Adaptador indisponível." };
  try {
    return { resumo: await adapter.getEntitySummary(id), erro: null };
  } catch (e) {
    return { resumo: null, erro: (e as Error)?.message ?? "Falha ao carregar resumo." };
  }
}
