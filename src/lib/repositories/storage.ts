import { supabase } from "@/integrations/supabase/client";
import { fetchWithRetry } from "@/lib/core/http/withRetry";

function isExternalUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

/**
 * ARC-003 · Lote C.2
 * Wrapper para operações de Storage. Cada bucket ganha seu factory
 * para uniformizar chamadas e evitar `supabase.storage.from(...)` espalhado.
 */
function bucket(name: string) {
  return {
    async upload(path: string, file: File | Blob, opts?: { contentType?: string; upsert?: boolean }) {
      return supabase.storage.from(name).upload(path, file, {
        contentType: opts?.contentType,
        upsert: opts?.upsert ?? false,
      });
    },
    async createSignedUrl(path: string, expiresInSeconds: number) {
      if (isExternalUrl(path)) {
        return { data: { signedUrl: path }, error: null };
      }
      return supabase.storage.from(name).createSignedUrl(path, expiresInSeconds);
    },
    async remove(paths: string[]) {
      const storagePaths = paths.filter((path) => !isExternalUrl(path));
      if (storagePaths.length === 0) return { data: [], error: null };
      return supabase.storage.from(name).remove(storagePaths);
    },
    async getPublicUrl(path: string) {
      if (isExternalUrl(path)) {
        return { data: { publicUrl: path } };
      }
      return supabase.storage.from(name).getPublicUrl(path);
    },
    async download(path: string) {
      if (isExternalUrl(path)) {
        const res = await fetchWithRetry(path, {}, { timeoutMs: 30000, maxAttempts: 2, label: "storage.external" });
        return { data: await res.blob(), error: null };
      }
      return supabase.storage.from(name).download(path);
    },
  };
}

export const cardAnexosStorage = bucket("card-anexos");
export const nfsStorage = bucket("nfs");
/** AFD da fiscalização: bucket privado, policies restritas a GM. */
export const pontoAfdStorage = bucket("ponto-afd");
/** Remessas/retornos CNAB: bucket privado, policies restritas a Financeiro/GM. */
export const cnabStorage = bucket("cnab");

export const storageRepo = { bucket };
