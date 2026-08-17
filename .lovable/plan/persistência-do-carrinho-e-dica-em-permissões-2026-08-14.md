# Persistência do carrinho e dica em Permissões

## 1. Carrinho e filtros em Local Storage

- `src/hooks/financeiro/useCarrinhoStore.ts`: trocar `sessionStorage` por `localStorage` (chave canônica `gestaobra:fin:carrinho`), com migração silenciosa do conteúdo que ainda estiver na sessão atual.
- Filtros do Financeiro (Aprovação Financeira, Fluxo, Obras): o último recorte usado passa a ser lembrado. A URL continua tendo prioridade quando o link já traz parâmetros; sem parâmetros, restaura o último filtro salvo. Botão "Limpar" apaga também o valor salvo.

## 2. Ícone de informação em Permissões

Na linha "Aprovação Financeira" da tabela de páginas (`src/pages/gm/Permissoes.tsx`), acrescentar o `InfoDica` já existente com o texto:

> "Apenas é visível as solicitações do setor responsável pela solicitação — com exceção de Financeiro, este responsável pela Aprovação e Recusa das solicitações."