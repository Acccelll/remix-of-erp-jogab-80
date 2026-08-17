/**
 * Hook global de visibilidade da fila offline (OFF.2).
 *
 * Faz polling leve (3s) das contagens das filas e expõe estado mínimo para o
 * banner. Roda no app shell — não atrela a nenhum domínio (RDO, Inspeção,
 * etc.). Quando online e há itens, dispara `runSync`; respeita backoff
 * exponencial via `nextAttemptAt` no item (a fila pula sozinha).
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { queueSize, listQueue } from "@/lib/offline/sync-queue";
import { mediaQueueSize } from "@/lib/offline/media-queue";
import { runSync } from "@/lib/offline/sync-runner";
import { supabaseSender, supabaseUploader } from "@/lib/offline/supabase-adapters";
import {
  criticalFlowIds,
  noteCriticalFlowFail,
  noteCriticalFlowOk,
} from "@/lib/observability/critical-flows";

export interface SyncQueueStatus {
  online: boolean;
  pending: number;
  mediaPending: number;
  total: number;
  syncing: boolean;
  lastError?: string;
  flushNow: () => Promise<void>;
}

const POLL_INTERVAL_MS = 3_000;

export function useSyncQueueStatus(): SyncQueueStatus {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [mediaPending, setMediaPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>();
  const flushingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [a, b, q] = await Promise.all([queueSize(), mediaQueueSize(), listQueue()]);
      setPending(a);
      setMediaPending(b);
      const err = q.find((it) => it.lastError)?.lastError;
      setLastError(err);
    } catch {
      // IndexedDB indisponível (SSR/teste) — ignora.
    }
  }, []);

  const flushNow = useCallback(async () => {
    if (flushingRef.current || !online) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      const result = await runSync(supabaseSender, supabaseUploader);
      const failed = result.data.failed + result.media.failed;
      if (failed > 0) {
        noteCriticalFlowFail(criticalFlowIds.offlineQueue, "sync parcial com falhas", {
          dataRemaining: result.data.remaining,
          mediaRemaining: result.media.remaining,
          failed,
        });
      } else {
        noteCriticalFlowOk(criticalFlowIds.offlineQueue, {
          dataSent: result.data.sent,
          mediaSent: result.media.sent,
          done: result.done,
        });
      }
    } catch (err) {
      noteCriticalFlowFail(criticalFlowIds.offlineQueue, err);
      // erros individuais já viram lastError via refresh.
    } finally {
      flushingRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [online, refresh]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
      if (!cancelled && online && (pending > 0 || mediaPending > 0)) {
        await flushNow();
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // pending/mediaPending intentionally excluded — polling already re-reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, refresh, flushNow]);

  // Reconectou → dispara imediatamente.
  useEffect(() => {
    if (online) void flushNow();
  }, [online, flushNow]);

  return {
    online,
    pending,
    mediaPending,
    total: pending + mediaPending,
    syncing,
    lastError,
    flushNow,
  };
}
