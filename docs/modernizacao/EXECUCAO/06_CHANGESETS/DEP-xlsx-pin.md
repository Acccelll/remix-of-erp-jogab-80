# DEP-xlsx-pin — Pinagem xlsx 0.20.3 (SheetJS CDN)

**Onda:** 0 · **Categoria:** Dependências/Segurança
**Relacionado:** SEC-003, ETAPA_11_SEGURANCA (CVE-2023-30533, CVE-2024-22363)

## Problema

`package.json` já declarava `xlsx` via tarball oficial `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, porém os lockfiles (`package-lock.json` e `bun.lockb`) resolviam ainda para `xlsx@0.18.5` do registro npm — versão **deprecada** e vulnerável a prototype pollution e ReDoS. O runtime carregava a versão pinada; o risco era regressão em qualquer `npm ci` / `bun install` que respeitasse o lock desatualizado.

## Ação

1. Removidos `package-lock.json` e `bun.lockb` desatualizados.
2. `bun install` regenerou o lock a partir do `package.json` já correto.
3. Verificação: `node_modules/xlsx/package.json` → `"version": "0.20.3"`.

## Evidência

```
+ xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

`node_modules/xlsx/package.json` reporta `0.20.3` (SheetJS CE oficial).

## Critérios de aceite

- (a) `package.json` referencia tarball oficial SheetJS ✅
- (b) lockfile resolve para 0.20.3 ✅
- (c) nenhuma referência residual a `xlsx@0.18.x` ✅
- (d) build/dev-server reiniciam sem erro ✅

## Discoveries

- **D-06:** Adicionar regra no CI para bloquear qualquer resolução de `xlsx` fora do domínio `cdn.sheetjs.com` (fica para OPS-001 / Onda 0 CI).
