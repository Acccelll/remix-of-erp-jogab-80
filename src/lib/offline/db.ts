/** @module-kind pure */
/**
 * Camada de IndexedDB do motor offline (Fase 4.0 — PoC).
 *
 * Stores:
 *  - sync_queue: mutações pendentes (upsert idempotente por UUID do cliente).
 *  - media_queue: blobs de mídia a subir para o Storage; o registro pai só
 *    referencia a URL depois que o upload concluir.
 *  - drafts: rascunhos por chave lógica (ex.: `rdo:<obraId>:<data>`), para
 *    rehidratar o formulário ao reabrir o app sem rede.
 *
 * Esta camada é intencionalmente "burra": só lê/escreve. A lógica de envio
 * vive em `sync-queue.ts` (puramente funcional, testável sem IndexedDB).
 */
import { openDB, type IDBPDatabase, type DBSchema } from "idb";

export type SyncOp = "upsert" | "delete";

export interface SyncQueueItem {
  /** UUID gerado no cliente. Vira a PK da linha remota → upsert idempotente. */
  id: string;
  /** Nome da tabela no Supabase (ex.: "rdo", "rdo_efetivo"). */
  table: string;
  op: SyncOp;
  /** Payload do upsert (inclui `id`) ou `{ id }` para delete. */
  payload: Record<string, unknown>;
  /** Coluna(s) de conflito para o upsert. Default: "id". */
  onConflict?: string;
  /** Ordem FIFO estável (createdAt + seq não basta sob clock skew). */
  seq: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /** Backoff exponencial — não envia antes deste timestamp (ms epoch). */
  nextAttemptAt?: number;
}

export interface MediaQueueItem {
  /** UUID do registro de mídia (ex.: rdo_fotos.id). */
  id: string;
  bucket: string;
  /** Caminho final no bucket (ex.: `rdo/<rdoId>/<id>.jpg`). */
  path: string;
  blob: Blob;
  contentType: string;
  /** Tabela + id pai a ser atualizado com `storage_path` após o upload. */
  parentTable?: string;
  parentId?: string;
  parentColumn?: string;
  seq: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: number;
}

export interface DraftRecord {
  /** Chave lógica do rascunho (ex.: `rdo:<obraId>:<YYYY-MM-DD>`). */
  key: string;
  data: unknown;
  updatedAt: number;
  status: "rascunho" | "sincronizando" | "sincronizado";
}

interface OfflineSchema extends DBSchema {
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { by_seq: number };
  };
  media_queue: {
    key: string;
    value: MediaQueueItem;
    indexes: { by_seq: number };
  };
  drafts: {
    key: string;
    value: DraftRecord;
  };
}

const DB_NAME = "buildflow-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("sync_queue")) {
          const store = db.createObjectStore("sync_queue", { keyPath: "id" });
          store.createIndex("by_seq", "seq");
        }
        if (!db.objectStoreNames.contains("media_queue")) {
          const store = db.createObjectStore("media_queue", { keyPath: "id" });
          store.createIndex("by_seq", "seq");
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Apenas para testes — descarta a conexão cacheada. */
export function __resetOfflineDbForTests() {
  dbPromise = null;
}
