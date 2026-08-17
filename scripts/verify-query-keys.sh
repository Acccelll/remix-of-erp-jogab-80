#!/usr/bin/env bash
# ARC-008 — Warning gate para query keys.
# Lista queryKey literals em src/hooks e src/pages cujo primeiro elemento
# (root) NÃO está em `registeredQueryKeyRoots` de src/lib/query-keys.ts.
# Emite apenas warning; não falha o CI enquanto a migração está em curso.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REG="$ROOT/src/lib/query-keys.ts"

# Extrai roots registrados (strings entre aspas dentro do array).
mapfile -t registered < <(awk '/registeredQueryKeyRoots =/,/\] as const/' "$REG" \
  | grep -oE '"[a-zA-Z0-9_-]+"' | tr -d '"' | sort -u)

# Padrão simplificado: procura `queryKey: ["ROOT"` ou `queryKey: ["ROOT",`.
hits=$(rg -n --no-heading -oE 'queryKey:\s*\[\s*"[a-zA-Z0-9_-]+"' \
  "$ROOT/src/hooks" "$ROOT/src/pages" 2>/dev/null || true)

unregistered=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  root=$(echo "$line" | grep -oE '"[a-zA-Z0-9_-]+"' | tail -1 | tr -d '"')
  if ! printf '%s\n' "${registered[@]}" | grep -qx "$root"; then
    echo "[ARC-008 warn] root não registrado: $line"
    unregistered=$((unregistered + 1))
  fi
done <<< "$hits"

if [ "$unregistered" -eq 0 ]; then
  echo "[ARC-008] OK — todos os roots de queryKey estão registrados."
else
  echo "[ARC-008] $unregistered ocorrência(s) com root fora do registro."
fi
exit 0
