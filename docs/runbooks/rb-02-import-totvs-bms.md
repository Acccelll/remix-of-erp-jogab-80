# RB-02 — Import TOTVS/BMS travado

**Severidade padrão:** S2 (bloqueia fechamento de medição/DP).

## Sintoma

- Card de import em `pending`/`processando` por mais de 30 min.
- Contador de linhas processadas parado.
- Toast "Import em andamento" repetido em novos uploads.

## Diagnóstico

1. Confirmar identidade do job (id + `arquivo_nome`) na tela
   Importar (TOTVS ou BMS).
2. Ler tabelas de controle:
   - `totvs_imports` (status, linhas_total, linhas_processadas,
     erro).
   - `bms_imports` idem.
3. Cruzar com logs da edge function correspondente (ver RB-01).
4. Categorizar:
   - **Sem log** — worker não pegou o job.
   - **Log com stack** — parser quebrou em uma linha específica.
   - **Log sem stack, timeout** — arquivo grande demais.

## Ação

| Categoria | Ação |
| --- | --- |
| Sem log | Marcar job como `erro` com nota "worker não pegou"; usuário reprocessa. |
| Parser quebrado | Salvar a linha problemática; abrir Achado se for variação de layout (referenciar `PRO-018`). |
| Timeout | Orientar usuário a fatiar arquivo (< 5000 linhas por lote). |

Comandos úteis (via `supabase--read_query`):
```sql
select id, status, linhas_processadas, linhas_total, erro
from totvs_imports where status in ('pending','processando')
order by criado_em desc limit 20;
```

## Verificação

- Job listado como `concluido` ou `erro` (jamais deixar `pending`).
- Usuário confirma reprocessamento bem-sucedido.

## Pós-incidente

- Anexar `arquivo_nome` + linhas afetadas no Histórico.
- Se houve variação de layout, encaminhar para plano canônico
  (PRO-018).

## Histórico

_(vazio)_
