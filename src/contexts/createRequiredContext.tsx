/**
 * Contexto obrigatório — guarda única + diagnóstico de provider ausente.
 *
 * Todo contexto de aplicação (`src/contexts/**`) é criado por aqui. O ganho não
 * é o `throw` (que cada arquivo já fazia à mão), é o que sai no console **antes**
 * dele: quando `useColaboradoresContext` é chamado fora de
 * `ColaboradoresProvider`, o log diz qual provider falta, em que arquivo ele
 * mora, qual componente/arquivo fez a chamada, quais providers estavam
 * montados naquele instante e onde fica a composição canônica.
 *
 * O caso real que motivou isto: um refactor removeu wrappers de `App.tsx` e a
 * tela quebrou com "must be used within ColaboradoresProvider" — sem nenhuma
 * pista de qual página tinha sido derrubada nem de qual wrapper sumira.
 */
import React, { createContext, useContext, useEffect, useRef } from "react";
import { structured } from "@/lib/observability/structured-logger";

export interface RequiredContextMeta {
  /** Hook público do contexto (ex.: `useColaboradoresContext`). */
  hook: string;
  /** Provider que precisa envolver a árvore (ex.: `ColaboradoresProvider`). */
  provider: string;
  /** Arquivo onde o provider mora — leva direto à fonte a partir do log. */
  file: string;
}

export type RequiredContext<T> = React.Context<T | null> & {
  readonly meta: RequiredContextMeta;
};

/** Onde a árvore de providers é montada — citada no diagnóstico. */
export const COMPOSICAO_CANONICA = "src/contexts/AppProviders.tsx";

// ---------------------------------------------------------------------------
// Registro de providers montados
// ---------------------------------------------------------------------------
// Contagem por nome (e não um Set) porque o mesmo provider pode aparecer mais
// de uma vez na árvore — remontagem de rota, StrictMode, dialog em portal.

const montados = new Map<string, number>();

function registrar(provider: string): void {
  montados.set(provider, (montados.get(provider) ?? 0) + 1);
}

function desregistrar(provider: string): void {
  const n = (montados.get(provider) ?? 0) - 1;
  if (n > 0) montados.set(provider, n);
  else montados.delete(provider);
}

/** Providers presentes na árvore neste instante, em ordem alfabética. */
export function providersMontados(): string[] {
  return [...montados.keys()].sort();
}

// Superfície de inspeção manual, no mesmo padrão de `__planifikHealth`:
// `__planifikProviders()` no console lista o que está montado agora.
if (typeof globalThis !== "undefined") {
  (globalThis as { __planifikProviders?: () => string[] }).__planifikProviders = providersMontados;
}

/**
 * Declara que este provider está na árvore. Chamado no corpo de cada provider.
 *
 * O registro acontece **na renderização**, não em `useEffect`: efeitos de pai
 * rodam depois da renderização dos filhos, e é justamente um filho que estoura
 * o erro — em `useEffect` a lista sairia vazia exatamente quando ela importa.
 */
export function useProviderMounted(provider: string): void {
  const registrado = useRef(false);
  if (!registrado.current) {
    registrado.current = true;
    registrar(provider);
  }
  useEffect(() => {
    return () => {
      if (!registrado.current) return;
      registrado.current = false;
      desregistrar(provider);
    };
  }, [provider]);
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------

/** Frames de quem chamou o hook, sem o ruído deste módulo. */
function pilhaDeChamada(): string[] {
  const bruto = new Error().stack ?? "";
  return bruto
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l && !/createRequiredContext/.test(l))
    .slice(0, 8);
}

/**
 * Pilha de componentes do React ("in Colaboradores (at App.tsx:193)").
 * Só existe em build de desenvolvimento; em produção cai na pilha JS acima.
 */
function pilhaDeComponentes(): string {
  try {
    const internals = (
      React as unknown as {
        __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
          ReactDebugCurrentFrame?: { getStackAddendum?: () => string };
        };
      }
    ).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    return internals?.ReactDebugCurrentFrame?.getStackAddendum?.()?.trim() ?? "";
  } catch {
    // Um detalhe de debug jamais pode ser a causa de um segundo erro.
    return "";
  }
}

function rotaAtual(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Emite o diagnóstico e devolve o erro a ser lançado pelo chamador.
 * Exportada para teste; o caminho normal é `useRequiredContext`.
 */
export function erroProviderAusente(meta: RequiredContextMeta): Error {
  const rota = rotaAtual();
  const chamadores = pilhaDeChamada();
  const componentes = pilhaDeComponentes();
  const mounted = providersMontados();

  structured.error("react.context.provider_ausente", {
    fields: {
      hook: meta.hook,
      provider: meta.provider,
      providerFile: meta.file,
      rota,
      chamadores,
      componentes,
      providersMontados: mounted,
      composicaoCanonica: COMPOSICAO_CANONICA,
    },
  });

  const linhas = [
    `[providers] ${meta.hook}() foi chamado FORA de <${meta.provider}>.`,
    `  provider ausente : ${meta.provider} (${meta.file})`,
    `  rota             : ${rota || "(desconhecida)"}`,
    `  chamada em       : ${chamadores[0] ?? "(pilha indisponível)"}`,
    ...chamadores.slice(1).map((l) => `                     ${l}`),
    componentes ? `  componentes      :${componentes.replace(/\n/g, "\n    ")}` : "",
    `  providers montados: ${mounted.length ? mounted.join(", ") : "(nenhum)"}`,
    `  conserto         : garanta que a página está dentro de ${COMPOSICAO_CANONICA}`,
  ].filter(Boolean);
  console.error(linhas.join("\n"));

  // Prefixo preservado ("<hook> must be used within <Provider>") porque é o
  // texto que aparece em telas de erro e em relatos de usuário.
  return new Error(
    `${meta.hook} must be used within ${meta.provider} — ` +
      `provider ausente em ${rota || "rota desconhecida"}; ` +
      `composição canônica em ${COMPOSICAO_CANONICA}`,
  );
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Cria um contexto que exige provider. `meta` alimenta o diagnóstico. */
export function createRequiredContext<T>(meta: RequiredContextMeta): RequiredContext<T> {
  const ctx = createContext<T | null>(null) as React.Context<T | null> & {
    meta: RequiredContextMeta;
  };
  ctx.displayName = meta.provider;
  ctx.meta = meta;
  return ctx;
}

/** Lê o contexto, ou estoura com o diagnóstico completo se faltar o provider. */
export function useRequiredContext<T>(ctx: RequiredContext<T>): T {
  const value = useContext(ctx);
  if (value === null || value === undefined) throw erroProviderAusente(ctx.meta);
  return value;
}
