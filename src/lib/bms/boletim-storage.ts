/** @module-kind io */
/** I/O opcional do Boletim de Medição: upload do arquivo gerado. */
import { authRepo } from "@/lib/repositories/auth";
import { storageRepo } from "@/lib/repositories/storage";

const bms = storageRepo.bucket("bms");

export async function uploadBoletim(
  blob: Blob,
  filename: string,
): Promise<{ path: string } | null> {
  const uid = await authRepo.getUserId();
  if (!uid) return null;
  const path = `${uid}/${filename}`;
  const { error } = await bms.upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) throw error;
  return { path };
}
