# Correções: Kanban e Aprovação Financeira

## 1. Kanban

### 1.1 Cor da capa não aparece no card
A paleta grava cores em hexadecimal (`#ef4444`), mas o card do quadro tenta usar esse valor como classe do Tailwind — classe inexistente, faixa invisível.

- Em `QuadroBoard.tsx` (e nos demais cards que exibem capa), pintar a faixa via `style={{ backgroundColor: cor }}` quando o valor for hex, mantendo a classe quando for token antigo.
- Deixar a faixa mais visível (altura maior quando não houver imagem de capa).

### 1.2 Membro não consegue se remover do cartão
Hoje só GM ou administrador do quadro pode alterar membros; o "X" falha silenciosamente para os demais.

- Migração: política de exclusão em `card_membros` permitindo que qualquer pessoa remova **o próprio vínculo** (`user_id = auth.uid()`), sem afetar as regras de adicionar/remover terceiros.
- No diálogo do cartão, mostrar o "X" também para o próprio usuário e exibir erro em toast quando a remoção falhar.

## 2. Aprovação Financeira

### 2.1 Ícones de comentário desalinhados
Quando o nome do setor quebra em duas linhas ("Depto. Pessoal"), o balão acompanha o texto.

- Fixar o balão numa coluna própria dentro da célula: rótulo com largura estável e ícone alinhado à direita, sempre na mesma posição vertical (primeira linha), em todas as linhas da tabela.

### 2.2 Botão do olho redundante
- Remover o botão "Visualizar detalhes" das ações da linha (a linha já abre a visualização ao ser clicada) e limpar o ícone não usado.

### 2.3 Barra inferior deixa ver a tabela por baixo
A barra de rolagem espelho é semi-transparente e fica sobre o conteúdo.

- Em `StickyScrollbar`: fundo opaco, borda superior sutil e um espaçamento reservado no fim do conteúdo para que nenhuma linha fique escondida atrás da barra.

### 2.4 Notificações vazando entre setores
Hoje a notificação só guarda o canal (`compras`/`financeiro`), não o setor da solicitação — então quem tem perfil "compras" recebe avisos de solicitações do Depto. Pessoal e vice-versa.

Regra escolhida: **cada notificação pertence ao setor da solicitação**; usuários do perfil de setor veem só o próprio setor, Financeiro e GM veem tudo.

- Migração: nova coluna `setor` (texto, opcional) em `public.notificacoes`.
- Ao criar/aprovar/recusar/comentar em Aprovação Financeira, gravar o setor da solicitação.
- No sino, filtrar: registros com `setor` preenchido só aparecem para quem é daquele setor, para o Financeiro e para o GM. Notificações antigas (sem setor) continuam visíveis como hoje.
- Notificações dirigidas (criador da solicitação) permanecem chegando normalmente.

## Detalhes técnicos
- Arquivos: `src/pages/quadros/QuadroBoard.tsx`, `src/components/cards/CardGenericoDialog.tsx`, `src/components/common/StickyScrollbar.tsx`, `src/pages/financeiro/AprovacaoFinanceira.tsx`, `src/lib/notificacoes/index.ts` + `policy.ts`, `src/lib/repositories/notificacoes.ts`, `src/components/layout/NotificationBell.tsx`.
- Duas migrações: política de auto-remoção em `card_membros` e coluna `setor` em `notificacoes`.
- Testes Vitest para a nova regra pura de filtragem por setor.
