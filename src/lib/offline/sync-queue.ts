/** @module-kind pure */
/**
 * Fila de sincronização idempotente (Fase 4.0 — PoC).
 *
 * Contrato de idempotência:
 *  - Todo item tem `id` = UUID gerado no cliente, que também é a PK da linha
 *    remota. O envio usa `upsert(..., { onConflict: <pk> })` → reexecutar a
 *    mesma operação é seguro (mesma linha, mesmos campos).
 *  - O item só é removido da fila após o `sender` resolver com sucesso. Se
 *    o `sender` rejeitar, incrementamos `attempts`/`lastError` e mantemos
 *    o item na fila para o próximo `flush`.
 *
 * O `sender` é injetado para que o teste de replay possa simular falha de
 * rede no meio do flush sem mockar o cliente Supabase.
 */
import { getOfflineDb, type SyncQueueItem, type SyncOp } from "./db";
import { nextAttemptAt } from "./backoff";

export type Sender = (item: SyncQueueItem) => Promise<void>;

export interface EnqueueInput {
  id: string;
  table: string;
  op?: SyncOp;
  payload: Record<string, unknown>;
  onConflict?: string;
}

let seqCounter = 0;
function nextSeq(): number {
  // Monotônico por sessão. `createdAt` empata, então somamos um contador.
  seqCounter += 1;
  return Date.now() * 1000 + (seqCounter % 1000);
}

export async function enqueue(input: EnqueueInput): Promise<SyncQueueItem> {
  const db = await getOfflineDb();
  const item: SyncQueueItem = {
    id: input.id,
    table: input.table,
    op: input.op ?? "upsert",
    payload: input.payload,
    onConflict: input.onConflict ?? "id",
    seq: nextSeq(),
    createdAt: Date.now(),
    attempts: 0,
  };
  // `put` cria ou substitui — se o usuário edita o mesmo rascunho várias
  // vezes offline, mantemos só o último payload (last-write-wins local).
  await db.put("sync_queue", item);
  return item;
}

export async function listQueue(): Promise<SyncQueueItem[]> {
  const db = await getOfflineDb();
  const all = await db.getAllFromIndex("sync_queue", "by_seq");
  return all;
}

export async function queueSize(): Promise<number> {
  const db = await getOfflineDb();
  return db.count("sync_queue");
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

/**
 * Envia itens em ordem FIFO. Para no primeiro erro de um item para preservar
 * a ordem causal (ex.: filho antes do pai falharia novamente); o caller
 * decide quando tentar de novo (reconexão, intervalo).
 *
 * Idempotência: se o `sender` chegar a enviar a linha mas falhar antes de
 * resolver (timeout, rede), o item fica na fila e a próxima execução
 * reenviará — o upsert por UUID garante que não vira duplicata remota.
 */
export async function flush(sender: Sender, now: number = Date.now()): Promise<FlushResult> {
  const db = await getOfflineDb();
  const items = await db.getAllFromIndex("sync_queue", "by_seq");

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    // Respeita backoff: se o primeiro item ainda não está pronto, paramos
    // para preservar ordem causal — itens posteriores também esperam.
    if (item.nextAttemptAt && item.nextAttemptAt > now) break;
    try {
      await sender(item);
      await db.delete("sync_queue", item.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      const tx = db.transaction("sync_queue", "readwrite");
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

  const remaining = await db.count("sync_queue");
  return { sent, failed, remaining };
}

/** Helpers só para testes — não usar em runtime. */
export async function __clearQueueForTests(): Promise<void> {
  const db = await getOfflineDb();
  await db.clear("sync_queue");
}
