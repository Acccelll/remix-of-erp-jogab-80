/** @module-kind pure */
/**
 * Overrides manuais de coordenadas para colaboradores e obras.
 *
 * Persistidos em `localStorage` — o esperado é que sejam raros e específicos
 * do usuário (ajuste fino para uma cidade que o geocode não encontrou), então
 * não vale abrir uma coluna nova no backend só para isso. Se um dia a operação
 * quiser compartilhar, a migração de shape aqui é trivial.
 */
import { useSyncExternalStore } from "react";
import type { Coordenada } from "@/lib/logistica/haversine";

const CHAVE = "logistica.overrides.v1";
const EVENTO = "logistica-overrides-atualizado";

export interface OverridesLogistica {
  colaboradores: Record<string, Coordenada>;
  obras: Record<string, Coordenada>;
}

const VAZIO: OverridesLogistica = { colaboradores: {}, obras: {} };

function ler(): OverridesLogistica {
  if (typeof window === "undefined") return VAZIO;
  try {
    const raw = window.localStorage.getItem(CHAVE);
    if (!raw) return VAZIO;
    const obj = JSON.parse(raw) as Partial<OverridesLogistica>;
    return {
      colaboradores: obj.colaboradores ?? {},
      obras: obj.obras ?? {},
    };
  } catch {
    return VAZIO;
  }
}

function escrever(v: OverridesLogistica) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(v));
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* quota cheia ou storage bloqueado — ignoramos silenciosamente */
  }
}

export function setColaboradorOverride(id: string, coord: Coordenada | null): void {
  const atual = ler();
  const novo = { ...atual, colaboradores: { ...atual.colaboradores } };
  if (coord) novo.colaboradores[id] = coord;
  else delete novo.colaboradores[id];
  escrever(novo);
}

export function setObraOverride(id: string, coord: Coordenada | null): void {
  const atual = ler();
  const novo = { ...atual, obras: { ...atual.obras } };
  if (coord) novo.obras[id] = coord;
  else delete novo.obras[id];
  escrever(novo);
}

export function limparOverrides(): void {
  escrever(VAZIO);
}

/**
 * Snapshot referencial: só muda quando o storage muda. Isso permite que os
 * memos de `useLogisticaPontos` reajam sem recomputar a cada render.
 */
let snapshot = ler();
let assinantes = 0;
function onExterno() {
  snapshot = ler();
}

export function useOverridesLogistica(): OverridesLogistica {
  return useSyncExternalStore(
    (cb) => {
      const handler = () => {
        snapshot = ler();
        cb();
      };
      if (assinantes === 0) window.addEventListener("storage", onExterno);
      assinantes += 1;
      window.addEventListener(EVENTO, handler);
      return () => {
        window.removeEventListener(EVENTO, handler);
        assinantes -= 1;
        if (assinantes === 0) window.removeEventListener("storage", onExterno);
      };
    },
    () => snapshot,
    () => VAZIO,
  );
}
