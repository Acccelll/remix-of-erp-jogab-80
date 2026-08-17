#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="$ROOT_DIR/supabase/tests/sec-002"
PSQL_ARGS=(-v ON_ERROR_STOP=1 -X)

if [[ "${SEC002_ALLOW_STAGING:-}" != "1" ]]; then
  echo "SEC-002 abortado: exporte SEC002_ALLOW_STAGING=1 para staging/preview." >&2
  exit 2
fi

if [[ -z "${PGDATABASE:-}" ]]; then
  echo "SEC-002 abortado: PGDATABASE deve estar definido e não pode ser produção." >&2
  exit 2
fi

case "${PGDATABASE,,}" in
  postgres|production|prod|gestaobra|gestaobra_prod)
    echo "SEC-002 abortado: banco de produção não autorizado ($PGDATABASE)." >&2
    exit 2
    ;;
esac

psql "${PSQL_ARGS[@]}" <<'SQL'
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception 'SEC-002 precondition failed: pgcrypto ausente';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('user_in_empresa','user_in_obra','user_in_board','user_in_card')
    group by n.nspname having count(distinct p.proname) = 4
  ) then
    raise exception 'SEC-002 precondition failed: helpers-02 ausente';
  end if;
end $$;
SQL

run_group() {
  local group="$1"
  local dir="$TEST_DIR/$group"
  [[ -d "$dir" ]] || return 0
  while IFS= read -r -d '' file; do
    echo "SEC-002 running: ${file#$ROOT_DIR/}"
    (cd "$TEST_DIR" && psql "${PSQL_ARGS[@]}" -f "${file#$TEST_DIR/}")
  done < <(find "$dir" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)
}

run_group helpers
run_group batch-B
run_group batch-C
run_group batch-D
run_group batch-E

echo "SEC-002 tests completed."