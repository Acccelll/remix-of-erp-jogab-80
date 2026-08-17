#!/usr/bin/env bash
# BIZ-002 — Verificação da convenção de camada src/lib.
# Falha se:
#   1) arquivo em src/lib (fora de pastas isentas) não declara @module-kind
#   2) arquivo marcado @module-kind pure importa supabase/fetch/localStorage
#   3) arquivo com import supabase fora de src/lib/repositories/ não é io|orchestration
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/src/lib"
EXCLUDE_DIRS='__tests__|types|constants|repositories'

fail=0

# Todos arquivos ts/tsx da lib exceto pastas isentas
mapfile -t files < <(find "$LIB" -type f \( -name '*.ts' -o -name '*.tsx' \) \
  | grep -Ev "/($EXCLUDE_DIRS)/" \
  | grep -Ev '\.d\.ts$')

for f in "${files[@]}"; do
  kind=$(grep -oE '@module-kind (pure|io|orchestration)' "$f" | head -1 | awk '{print $2}')
  rel="${f#$ROOT/}"

  if [[ -z "$kind" ]]; then
    echo "MISSING @module-kind: $rel"
    fail=1
    continue
  fi

  has_supabase=$(grep -cE "from ['\"]@/integrations/supabase|from ['\"]@supabase" "$f" || true)
  if [[ "$kind" == "pure" ]]; then
    if [[ "$has_supabase" -gt 0 ]] \
      || grep -qE "\\bfetch\\(|\\blocalStorage\\b|\\bsessionStorage\\b" "$f"; then
      echo "PURE MODULE WITH I/O: $rel"
      fail=1
    fi
  fi
done

# Arquivos com supabase fora de repositories
mapfile -t io_files < <(grep -rlE "from ['\"]@/integrations/supabase|from ['\"]@supabase" "$LIB" \
  | grep -Ev "/(repositories|__tests__)/" || true)

for f in "${io_files[@]}"; do
  kind=$(grep -oE '@module-kind (pure|io|orchestration)' "$f" | head -1 | awk '{print $2}')
  rel="${f#$ROOT/}"
  if [[ "$kind" != "io" && "$kind" != "orchestration" ]]; then
    echo "SUPABASE OUTSIDE repositories/ NOT MARKED io|orchestration: $rel"
    fail=1
  fi
done

if [[ "$fail" -eq 0 ]]; then
  echo "OK: convenção BIZ-002 satisfeita."
fi
exit "$fail"
