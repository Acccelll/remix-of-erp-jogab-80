#!/usr/bin/env bash
# ARC-003.d — Gate de fronteira repository:
# falha se pages/components acessarem diretamente supabase.from("<tabela coberta>").
#
# A lista de tabelas cobertas é derivada dos repositories em src/lib/repositories/*.
# Exceções documentadas (arquivos utilitários) ficam em EXCEPTIONS abaixo.

set -euo pipefail

# Tabelas explicitamente cobertas por repositories.
COVERED_TABLES=(
  "obras"
  "fornecedores"
  "insumos"
  "requisicoes"
  "cronograma_itens"
  "cards"
  "board_listas"
  "clientes"
  "dp_holerite"
  "ponto_registros"
  "financeiro_lancamentos"
  "inspecoes"
  "ordens_compra"
  "pacotes_trabalho"
  "restricoes"
  "riscos"
  "licoes_aprendidas"
  "cronograma_dependencias"
)

# Arquivos com bypass consciente (documentado em changeset).
EXCEPTIONS=(
  "src/lib/cards/trello-import.ts"
)

fail=0
for tbl in "${COVERED_TABLES[@]}"; do
  hits=$(rg -n --no-heading "supabase\.from\([\"']${tbl}[\"']" src/pages src/components 2>/dev/null || true)
  if [ -n "$hits" ]; then
    filtered=""
    while IFS= read -r line; do
      skip=0
      for ex in "${EXCEPTIONS[@]}"; do
        [[ "$line" == "$ex"* ]] && skip=1 && break
      done
      [ $skip -eq 0 ] && filtered+="$line"$'\n'
    done <<< "$hits"
    if [ -n "$filtered" ]; then
      echo "[ARC-003.d] Bypass de repository para tabela '$tbl':"
      echo "$filtered"
      fail=1
    fi
  fi
done

if [ $fail -ne 0 ]; then
  echo "[ARC-003.d] FALHA: use o repository correspondente em src/lib/repositories/."
  exit 1
fi

echo "[ARC-003.d] OK — nenhum bypass de repository em pages/components."
