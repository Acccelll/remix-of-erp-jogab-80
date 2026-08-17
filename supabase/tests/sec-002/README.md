# SEC-002 tests — suíte RLS executável

Fonte da verdade: `docs/modernizacao/EXECUCAO/06_CHANGESETS/SEC-002.tests-02.suite.spec-01.md`.

Este diretório materializa o apply-01 da suíte: `_lib/`, `helpers/` e runner. Os diretórios `batch-B/`…`batch-E/` ficam delegados ao apply-02 futuro.

Execução autorizada apenas em staging/preview, com `SEC002_ALLOW_STAGING=1` e banco não produtivo.