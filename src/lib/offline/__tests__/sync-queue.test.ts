/**
 * Teste de replay do motor offline (PORTÃO da Fase 4).
 *
 * Cobertura:
 *  1. Enfileira N itens offline e sincroniza tudo em ordem.
 *  2. Falha no meio do flush (simula rede caindo) → reexecuta flush →
 *     zero perda, zero duplicata remota (idempotência por UUID), ordem
 *     preservada.
 *  3. Item já sincronizado não reenvia (foi removido da fila).
 *  4. Re-enqueue do mesmo UUID antes de sincronizar mantém last-write-wins
 *     local, mas só uma linha no "servidor".
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { __clearQueueForTests, enqueue, flush, listQueue, queueSize } from "../sync-queue";
import { __resetOfflineDbForTests, type SyncQueueItem } from "../db";

function makeServer() {
  // Simula um banco remoto: Map<table, Map<id, payload>>.
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const callLog: Array<{ id: string; attempt: number }> = [];
  const attemptsById = new Map<string, number>();

  function upsert(item: SyncQueueItem) {
    const prev = attemptsById.get(item.id) ?? 0;
    const attempt = prev + 1;
    attemptsById.set(item.id, attempt);
    callLog.push({ id: item.id, attempt });
    let table = tables.get(item.table);
    if (!table) {
      table = new Map();
      tables.set(item.table, table);
    }
    table.set(item.id, { ...item.payload });
  }

  return {
    tables,
    callLog,
    upsert,
    count(table: string) {
      return tables.get(table)?.size ?? 0;
    },
  };
}

beforeEach(async () => {
  __resetOfflineDbForTests();
  // fake-indexeddb mantém estado entre testes; limpamos a store.
  try {
    await __clearQueueForTests();
  } catch {
    // primeira execução, store ainda não existe — ok
  }
});

describe("sync-queue (motor offline — replay)", () => {
  it("envia tudo em ordem FIFO quando o sender sempre passa", async () => {
    const server = makeServer();
    const ids = ["a", "b", "c", "d"].map((s) => `00000000-0000-0000-0000-00000000000${s}`);
    for (const id of ids) {
      await enqueue({ id, table: "rdo", payload: { id, nome: id } });
    }

    expect(await queueSize()).toBe(4);

    const result = await flush(async (item) => server.upsert(item));

    expect(result).toEqual({ sent: 4, failed: 0, remaining: 0 });
    expect(server.count("rdo")).toBe(4);
    expect(server.callLog.map((c) => c.id)).toEqual(ids);
  });

  it("replay após falha no meio não duplica nem perde linhas", async () => {
    const server = makeServer();
    const ids = Array.from({ length: 5 }, (_, i) => `00000000-0000-0000-0000-00000000000${i}`);
    for (const id of ids) {
      await enqueue({ id, table: "rdo", payload: { id, valor: i_for(id) } });
    }

    // Primeiro flush: o terceiro item falha (rede cai).
    let failOnce = true;
    const first = await flush(async (item) => {
      if (failOnce && item.id === ids[2]) {
        failOnce = false;
        throw new Error("network down");
      }
      server.upsert(item);
    });

    expect(first.sent).toBe(2);
    expect(first.failed).toBe(1);
    expect(first.remaining).toBe(3); // ids[2..4] ainda na fila
    expect(server.count("rdo")).toBe(2);

    // Segundo flush: tudo passa (avança o relógio além do backoff).
    const second = await flush(async (item) => server.upsert(item), Date.now() + 60 * 60_000);
    expect(second).toEqual({ sent: 3, failed: 0, remaining: 0 });

    // Zero duplicata remota: 5 linhas distintas.
    expect(server.count("rdo")).toBe(5);
    // Idempotência: nenhum item enviado mais de uma vez COM SUCESSO
    // (o item que falhou não chegou a aplicar — a falha foi antes do upsert).
    const successCounts = new Map<string, number>();
    for (const call of server.callLog) {
      successCounts.set(call.id, (successCounts.get(call.id) ?? 0) + 1);
    }
    for (const id of ids) {
      expect(successCounts.get(id)).toBe(1);
    }
    // Ordem preservada nos sucessos.
    expect(server.callLog.map((c) => c.id)).toEqual(ids);
  });

  it("idempotência sobrevive a sender que aplica e depois lança", async () => {
    // Caso real: rede entrega ao servidor, mas a resposta se perde
    // (timeout). O item fica na fila e o próximo flush reenvia o MESMO
    // payload com o mesmo UUID → o upsert remoto sobrescreve a si próprio.
    const server = makeServer();
    const id = "11111111-1111-1111-1111-111111111111";
    await enqueue({ id, table: "rdo", payload: { id, v: 1 } });

    let firstCall = true;
    await flush(async (item) => {
      server.upsert(item); // aplicou
      if (firstCall) {
        firstCall = false;
        throw new Error("timeout reading response");
      }
    });

    // Item ainda na fila porque o sender rejeitou.
    expect(await queueSize()).toBe(1);

    // Reexecuta — aplica de novo (upsert), mas continua sendo 1 linha.
    await flush(async (item) => server.upsert(item), Date.now() + 60 * 60_000);

    expect(await queueSize()).toBe(0);
    expect(server.count("rdo")).toBe(1);
    expect(server.tables.get("rdo")!.get(id)).toEqual({ id, v: 1 });
  });

  it("re-enqueue do mesmo UUID antes de sincronizar mantém last-write-wins", async () => {
    const server = makeServer();
    const id = "22222222-2222-2222-2222-222222222222";
    await enqueue({ id, table: "rdo", payload: { id, obs: "v1" } });
    await enqueue({ id, table: "rdo", payload: { id, obs: "v2" } });

    expect(await queueSize()).toBe(1); // mesma key, substituído

    await flush(async (item) => server.upsert(item));

    expect(server.tables.get("rdo")!.get(id)).toEqual({ id, obs: "v2" });
  });

  it("item já sincronizado não reenvia", async () => {
    const server = makeServer();
    const id = "33333333-3333-3333-3333-333333333333";
    await enqueue({ id, table: "rdo", payload: { id, x: 1 } });

    await flush(async (item) => server.upsert(item));
    expect(await queueSize()).toBe(0);

    // Novo flush sem enqueue não chama o sender.
    const queueAfter = await listQueue();
    expect(queueAfter).toHaveLength(0);
    const result = await flush(async (item) => server.upsert(item));
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(server.callLog.length).toBe(1);
  });
});

// Helper só para diferenciar payloads no teste de replay.
function i_for(id: string): number {
  return Number(id.slice(-1));
}
