/** @module-kind pure */
/**
 * Buffer circular de eventos para coletor externo — OPS-005.slice-01
 *
 * Guarda uma janela dos últimos N eventos amostrados. Consumido em lote
 * pelo transporte (slice-02). Sem I/O, sem timers.
 */

import type { StructuredEvent } from "./structured-logger";

export interface EventBufferOptions {
  capacity: number;
}

export class EventBuffer {
  private readonly capacity: number;
  private buf: StructuredEvent[] = [];
  private dropped = 0;

  constructor(opts: EventBufferOptions) {
    if (!(opts.capacity > 0)) {
      throw new Error("EventBuffer: capacity deve ser > 0");
    }
    this.capacity = Math.floor(opts.capacity);
  }

  push(event: StructuredEvent): void {
    if (this.buf.length >= this.capacity) {
      this.buf.shift();
      this.dropped += 1;
    }
    this.buf.push(event);
  }

  /** Remove e retorna todos os eventos acumulados. */
  drain(): StructuredEvent[] {
    const out = this.buf;
    this.buf = [];
    return out;
  }

  size(): number {
    return this.buf.length;
  }

  getCapacity(): number {
    return this.capacity;
  }

  droppedCount(): number {
    return this.dropped;
  }

  resetDropped(): void {
    this.dropped = 0;
  }
}
