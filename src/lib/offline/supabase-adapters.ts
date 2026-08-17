/** @module-kind io */
/**
 * Adaptadores que ligam o motor offline ao Supabase.
 *
 * Mantidos isolados para que o motor (`sync-queue`, `media-queue`,
 * `sync-runner`) permaneça testável sem rede.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Sender } from "./sync-queue";
import type { MediaUploader } from "./media-queue";

/**
 * Sender padrão: upsert por PK (UUID do cliente) → idempotente.
 * `op === "delete"` → delete por id.
 */
export const supabaseSender: Sender = async (item) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (supabase.from as any)(item.table);
  if (item.op === "delete") {
    const id = item.payload.id as string;
    const { error } = await tbl.delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await tbl.upsert(item.payload, {
    onConflict: item.onConflict ?? "id",
  });
  if (error) throw error;
};

/**
 * Uploader padrão: sobe o blob no bucket com `upsert: true` (mesmo path
 * sobrescreve — idempotente no replay) e, se houver registro pai
 * informado, grava o `storage_path` nele.
 */
export const supabaseUploader: MediaUploader = async (item) => {
  const { error: upErr } = await supabase.storage.from(item.bucket).upload(item.path, item.blob, {
    contentType: item.contentType,
    upsert: true,
  });
  if (upErr) throw upErr;

  if (item.parentTable && item.parentId && item.parentColumn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = (supabase.from as any)(item.parentTable);
    const { error } = await tbl.update({ [item.parentColumn]: item.path }).eq("id", item.parentId);
    if (error) throw error;
  }
};
