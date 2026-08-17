/** @module-kind pure */
/**
 * Drafts — rascunhos por chave lógica.
 *
 * Uso típico: `rdo:<obraId>:<YYYY-MM-DD>` guarda o formulário inteiro do
 * RDO daquela obra/dia para rehidratar offline. O `data` é opaco — quem
 * grava define o shape.
 */
import { getOfflineDb, type DraftRecord } from "./db";

export async function getDraft<T = unknown>(
  key: string,
): Promise<(DraftRecord & { data: T }) | null> {
  const db = await getOfflineDb();
  const rec = await db.get("drafts", key);
  return (rec as (DraftRecord & { data: T }) | undefined) ?? null;
}

export async function putDraft<T>(
  key: string,
  data: T,
  status: DraftRecord["status"] = "rascunho",
): Promise<void> {
  const db = await getOfflineDb();
  await db.put("drafts", { key, data, updatedAt: Date.now(), status });
}

export async function setDraftStatus(key: string, status: DraftRecord["status"]): Promise<void> {
  const db = await getOfflineDb();
  const rec = await db.get("drafts", key);
  if (!rec) return;
  rec.status = status;
  rec.updatedAt = Date.now();
  await db.put("drafts", rec);
}

export async function deleteDraft(key: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete("drafts", key);
}
