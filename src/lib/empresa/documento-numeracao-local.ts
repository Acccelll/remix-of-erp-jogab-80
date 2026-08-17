/** @module-kind io */
/**
 * PRO-031 · slice-14 — Registro local de números documentais emitidos.
 *
 * Mantém a relação `documentoId -> número parametrizado` quando a tabela de
 * origem ainda não possui coluna própria de número customizado. A emissão da
 * sequência continua centralizada em `emitirNumeroCustomizado`; este módulo só
 * persiste a associação para listagens e PDFs.
 */

import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import {
  empresaParametrizacaoRepo,
  type TipoDocumentoNumeravel,
} from "@/lib/empresa/parametrizacao";

export interface DocumentoNumeracaoLocal {
  documentoId: string;
  tipo: TipoDocumentoNumeravel;
  empresaId?: string;
  numero: string;
  sequencial: number;
  criadoEm: string;
}

const STORAGE_KEY = STORAGE_KEYS.documentoNumeracaoLocal;

function readAll(): DocumentoNumeracaoLocal[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DocumentoNumeracaoLocal[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: DocumentoNumeracaoLocal[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function normalizarNumero(numero: string): string {
  return numero.trim().toLocaleLowerCase("pt-BR");
}

function extrairSequencial(numero: string): number {
  const match = numero.trim().match(/(\d+)(?!.*\d)/);
  if (!match) return 0;
  const sequencial = Number(match[1]);
  return Number.isFinite(sequencial) && sequencial > 0 ? sequencial : 0;
}

function avancarSequenciaSeNecessario(
  empresaId: string | undefined,
  tipo: TipoDocumentoNumeravel,
  sequencial: number,
): void {
  if (!empresaId || sequencial < 1) return;
  const param = empresaParametrizacaoRepo.get(empresaId);
  const config = param.numeracoes[tipo];
  if (!config || config.proximo > sequencial) return;
  empresaParametrizacaoRepo.setNumeracao(empresaId, tipo, {
    ...config,
    proximo: sequencial + 1,
  });
}

export function listDocumentoNumeracaoLocal(tipo?: TipoDocumentoNumeravel): DocumentoNumeracaoLocal[] {
  const rows = readAll();
  return tipo ? rows.filter((r) => r.tipo === tipo) : rows;
}

export function getDocumentoNumeroLocal(
  documentoId: string | null | undefined,
  tipo: TipoDocumentoNumeravel,
): DocumentoNumeracaoLocal | null {
  if (!documentoId) return null;
  return readAll().find((r) => r.documentoId === documentoId && r.tipo === tipo) ?? null;
}

export function registrarDocumentoNumeroLocal(
  input: Omit<DocumentoNumeracaoLocal, "criadoEm"> & { criadoEm?: string },
): DocumentoNumeracaoLocal {
  const rows = readAll();
  const existente = rows.find((r) => r.documentoId === input.documentoId && r.tipo === input.tipo);
  if (existente) return existente;
  const novo: DocumentoNumeracaoLocal = {
    documentoId: input.documentoId,
    tipo: input.tipo,
    empresaId: input.empresaId || undefined,
    numero: input.numero,
    sequencial: input.sequencial,
    criadoEm: input.criadoEm ?? new Date().toISOString(),
  };
  writeAll([...rows, novo]);
  return novo;
}

export function registrarDocumentoNumeroImportadoLocal(
  input: Pick<DocumentoNumeracaoLocal, "documentoId" | "tipo" | "numero"> & {
    empresaId?: string;
    criadoEm?: string;
  },
): DocumentoNumeracaoLocal | null {
  const numero = input.numero.trim();
  if (!numero) return null;

  const rows = readAll();
  const existente = rows.find((r) => r.documentoId === input.documentoId && r.tipo === input.tipo);
  if (existente) return existente;

  const chave = normalizarNumero(numero);
  const duplicado = rows.some((r) => r.tipo === input.tipo && normalizarNumero(r.numero) === chave);
  if (duplicado) return null;

  const sequencial = extrairSequencial(numero);
  const novo: DocumentoNumeracaoLocal = {
    documentoId: input.documentoId,
    tipo: input.tipo,
    empresaId: input.empresaId || undefined,
    numero,
    sequencial,
    criadoEm: input.criadoEm ?? new Date().toISOString(),
  };
  writeAll([...rows, novo]);
  avancarSequenciaSeNecessario(input.empresaId, input.tipo, sequencial);
  return novo;
}