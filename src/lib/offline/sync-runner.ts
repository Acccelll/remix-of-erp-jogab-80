/** @module-kind pure */
/**
 * Orquestrador de sync — Fase 4.2.
 *
 * Ordem de envio:
 *  1. `flush(sync_queue)` — mutações primeiro, porque criam o registro pai
 *     (`rdo_fotos`) que a mídia vai preencher.
 *  2. `flushMedia(media_queue)` — só depois sobem os blobs e atualizam a
 *     coluna `storage_path` do pai.
 *  3. Caller marca o draft como `sincronizado` se as duas filas zerarem.
 *
 * O orquestrador NÃO depende do Supabase — recebe `sender`/`uploader` para
 * permanecer testável e desacoplado.
 */
import { flush, type Sender, type FlushResult } from "./sync-queue";
import { flushMedia, type MediaUploader, type FlushMediaResult } from "./media-queue";

export interface SyncResult {
  data: FlushResult;
  media: FlushMediaResult;
  done: boolean;
}

export async function runSync(sender: Sender, uploader: MediaUploader): Promise<SyncResult> {
  const data = await flush(sender);
  const media = await flushMedia(uploader);
  return {
    data,
    media,
    done: data.remaining === 0 && media.remaining === 0,
  };
}
