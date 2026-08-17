/** @module-kind pure */
/**
 * Fila de mídia — Fase 4.2.
 *
 * Separada da `sync_queue` porque mídia é grande, lenta e cai com rede
 * ruim; misturar bloquearia mutações pequenas. O blob fica no IndexedDB
 * com o UUID do registro pai (ex.: `rdo_fotos.id`). Ao subir:
 *  1. Upload para o Storage no `path` final → idempotente via `upsert:true`
 *     (mesmo path = sobrescreve, sem duplicata).
 *  2. Atualiza a linha pai (`parentTable.parentColumn = path`) se informado.
 *  3. Remove da fila.
 *
 * O `uploader` é injetável (Supabase no runtime, fake no teste).
 */
import { getOfflineDb, type MediaQueueItem } from "./db";
import { nextAttemptAt } from "./backoff";

export type MediaUploader = (item: MediaQueueItem) => Promise<void>;

export interface EnqueueMediaInput {
  id: string;
  bucket: string;
  path: string;
  blob: Blob;
  contentType?: string;
  parentTable?: string;
  parentId?: string;
  parentColumn?: string;
}

let seqCounter = 0;
function nextSeq(): number {
  seqCounter += 1;
  return Date.now() * 1000 + (seqCounter % 1000);
}

export async function enqueueMedia(input: EnqueueMediaInput): Promise<MediaQueueItem> {
  const db = await getOfflineDb();
  const item: MediaQueueItem = {
    id: input.id,
    bucket: input.bucket,
    path: input.path,
    blob: input.blob,
    contentType: input.contentType ?? input.blob.type ?? "application/octet-stream",
    parentTable: input.parentTable,
    parentId: input.parentId,
    parentColumn: input.parentColumn,
    seq: nextSeq(),
    createdAt: Date.now(),
    attempts: 0,
  };
  await db.put("media_queue", item);
  return item;
}

export async function mediaQueueSize(): Promise<number> {
  const db = await getOfflineDb();
  return db.count("media_queue");
}

export interface FlushMediaResult {
  sent: number;
  failed: number;
  remaining: number;
}

export async function flushMedia(
  uploader: MediaUploader,
  now: number = Date.now(),
): Promise<FlushMediaResult> {
  const db = await getOfflineDb();
  const items = await db.getAllFromIndex("media_queue", "by_seq");

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    if (item.nextAttemptAt && item.nextAttemptAt > now) break;
    try {
      await uploader(item);
      await db.delete("media_queue", item.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      const tx = db.transaction("media_queue", "readwrite");
      const fresh = await tx.store.get(item.id);
      if (fresh) {
        fresh.attempts += 1;
        fresh.lastError = err instanceof Error ? err.message : String(err);
        fresh.nextAttemptAt = nextAttemptAt(fresh.attempts, now);
        await tx.store.put(fresh);
      }
      await tx.done;
      break;
    }
  }

  const remaining = await db.count("media_queue");
  return { sent, failed, remaining };
}
