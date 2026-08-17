/** @module-kind pure */
/**
 * Registro de saúde por fluxo crítico — OPS-004.slice-01
 *
 * Contabiliza sucessos/falhas de fluxos operacionais (importação
 * TOTVS, sync de obra, fila offline, etc.) e devolve um status
 * agregado para monitor externo (`/health`) ou painel operacional.
 *
 * Regra pura: sem I/O, sem timers. O consumidor injeta o `now` nos
 * testes e chama `noteOk` / `noteFail` a partir do call-site real.
 *
 * Status por fluxo:
 * - `unknown`   — nunca sinalizou.
 * - `healthy`   — último sinal foi OK dentro da janela do fluxo.
 * - `degraded`  — houve falha recente, mas não excedeu o threshold.
 * - `down`      — falhas consecutivas >= threshold OU sem OK há mais
 *                 que a janela do fluxo (stale).
 *
 * Status agregado (`overallHealth`):
 * - `down`      se qualquer fluxo `down`.
 * - `degraded`  se qualquer fluxo `degraded` (e nenhum `down`).
 * - `healthy`   se todos `healthy` (unknown não conta como negativo,
 *   mas puxa `overall` para `degraded` se for o único sinal).
 */

export type FlowStatus = "unknown" | "healthy" | "degraded" | "down";

export interface FlowDefinition {
  /** Id estável do fluxo (ex.: "totvs.import"). */
  id: string;
  /** Rótulo humano (para UI/health). */
  label: string;
  /** Falhas consecutivas para virar `down`. Default 3. */
  failThreshold?: number;
  /** Janela sem OK após a qual o fluxo é considerado stale (ms). */
  staleAfterMs?: number;
}

export interface FlowState {
  status: FlowStatus;
  lastOkAt?: number;
  lastFailAt?: number;
  consecutiveFailures: number;
  lastError?: string;
}

export interface FlowSnapshot extends FlowState {
  id: string;
  label: string;
}

const DEFAULT_FAIL_THRESHOLD = 3;
const DEFAULT_STALE_MS = 30 * 60 * 1000; // 30 min

export class FlowHealthRegistry {
  private readonly defs = new Map<string, Required<FlowDefinition>>();
  private readonly state = new Map<string, FlowState>();

  register(def: FlowDefinition): void {
    this.defs.set(def.id, {
      id: def.id,
      label: def.label,
      failThreshold: def.failThreshold ?? DEFAULT_FAIL_THRESHOLD,
      staleAfterMs: def.staleAfterMs ?? DEFAULT_STALE_MS,
    });
    if (!this.state.has(def.id)) {
      this.state.set(def.id, {
        status: "unknown",
        consecutiveFailures: 0,
      });
    }
  }

  noteOk(id: string, now: number): void {
    if (!this.defs.has(id)) return;
    this.state.set(id, {
      status: "healthy",
      lastOkAt: now,
      lastFailAt: this.state.get(id)?.lastFailAt,
      consecutiveFailures: 0,
    });
  }

  noteFail(id: string, now: number, error?: string): void {
    const def = this.defs.get(id);
    if (!def) return;
    const prev = this.state.get(id) ?? {
      status: "unknown" as FlowStatus,
      consecutiveFailures: 0,
    };
    const consecutive = prev.consecutiveFailures + 1;
    this.state.set(id, {
      status: consecutive >= def.failThreshold ? "down" : "degraded",
      lastOkAt: prev.lastOkAt,
      lastFailAt: now,
      consecutiveFailures: consecutive,
      lastError: error,
    });
  }

  snapshot(now: number): FlowSnapshot[] {
    const out: FlowSnapshot[] = [];
    for (const def of this.defs.values()) {
      const s = this.state.get(def.id) ?? {
        status: "unknown" as FlowStatus,
        consecutiveFailures: 0,
      };
      let status = s.status;
      // Stale: sem OK dentro da janela → `down`, exceto se ainda é `unknown`.
      if (
        status !== "unknown" &&
        s.lastOkAt !== undefined &&
        now - s.lastOkAt > def.staleAfterMs
      ) {
        status = "down";
      }
      out.push({ id: def.id, label: def.label, ...s, status });
    }
    return out;
  }

  overallHealth(now: number): FlowStatus {
    const snap = this.snapshot(now);
    if (snap.length === 0) return "unknown";
    if (snap.some((s) => s.status === "down")) return "down";
    if (snap.some((s) => s.status === "degraded")) return "degraded";
    if (snap.every((s) => s.status === "unknown")) return "unknown";
    if (snap.every((s) => s.status === "healthy")) return "healthy";
    // Mistura de healthy/unknown → degraded (falta sinal).
    return "degraded";
  }

  reset(): void {
    this.state.clear();
    for (const id of this.defs.keys()) {
      this.state.set(id, { status: "unknown", consecutiveFailures: 0 });
    }
  }
}

/** Registry singleton para uso na aplicação (call-sites reais). */
export const flowHealth = new FlowHealthRegistry();
