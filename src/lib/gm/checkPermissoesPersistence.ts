/** @module-kind io */
/**
 * Diagnóstico da persistência de permissões no backend.
 * Verifica se as colunas de matriz de permissões existem e se as permissões
 * estão sendo salvas corretamente.
 */

import { apiFetch } from "@/lib/api";

export interface PermissoesDiagnostico {
  colunas: {
    matriz_permissoes: boolean;
    papeis_permissao: boolean;
    acesso_compras: boolean;
  };
  stats: {
    total_usuarios: number;
    usuarios_com_matriz: number;
    usuarios_com_papeis: number;
  };
  migracao_executada: boolean;
}

/**
 * Verifica se as permissões estão sendo persistidas corretamente.
 * Retorna um diagnóstico detalhado.
 */
export async function verificarPersistenciaPermissoes(): Promise<PermissoesDiagnostico | null> {
  try {
    const result = await apiFetch<PermissoesDiagnostico>("diagnostico-permissoes");
    return result;
  } catch (err) {
    console.error("Erro ao verificar persistência de permissões:", err);
    return null;
  }
}

/**
 * Executa a migração de permissões (cria colunas faltantes).
 * Só funciona se o usuário é GM.
 */
export async function executarMigraçãoPermissoes(): Promise<{ message: string; colunas_criadas?: string[] }> {
  try {
    const result = await apiFetch<{ message: string; colunas_criadas?: string[] }>(
      "diagnostico-permissoes",
      { method: "POST" }
    );
    return result;
  } catch (err) {
    console.error("Erro ao executar migração de permissões:", err);
    throw err;
  }
}
