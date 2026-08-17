# PERF-004.slice-01 — Fontes de terceiro fora do caminho crítico de render

**Onda:** 7 · **Achado:** PERF-004 · **Tipo:** STD · **Escopo:** ISOLADA (Plataforma)

## Problema

`index.html` carregava DM Sans + Space Grotesk via `<link rel="stylesheet">`
render-blocking direto para `fonts.googleapis.com`, atrasando o First Paint.

## Alterações

`index.html`
- `preconnect` para `fonts.googleapis.com` e `fonts.gstatic.com` (`crossorigin`).
- Troca o `<link rel="stylesheet">` bloqueante por `<link rel="preload" as="style">` com `onload="this.rel='stylesheet'"` — folha aplicada de forma assíncrona.
- Fallback `<noscript>` com o mesmo `<link rel="stylesheet">` (apenas metadata tags no `<head>`, conforme regra do projeto).
- `display=swap` já presente no querystring — texto renderiza com a fonte do sistema até o webfont chegar.

## Validação

- `bunx tsgo --noEmit` limpo (sem impacto em TS).
- `<noscript>` no `<head>` contém apenas `<link>` — conforme regra HTML5 do projeto.

## Estado

**PERF-004 encerrado.** Fontes deixam de bloquear o render inicial.
