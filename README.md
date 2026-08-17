# ERP-JOGAB

Preciso de uma aplicação web direcionada para gestão de colaboradores direcionado para obras e controle de vencimentos de documentos (como ASOs, NRs, CNHs, etc.), dentro das funções dele inclui:

 

Página principal: Quadro de Obras

1.       A tela principal do software são quadros, respectivos a cada usina/obra ativa, dispostos em uma tela com os colaboradores como etiquetas anexadas a esses quadros que podem ser movidas de um quadro para outro.

2.       Toda vez que uma etiqueta é movida, aparece uma janela de confirmação, a janela de confirmação tem o escrito “Quando será mobilizado?” que deve ser colocado dia e mês apenas. Ao confirmar, a etiqueta muda de cor (evidenciando visualmente que o colaborador/etiqueta será movido (a)) e assim que chegar na data estipulada, a etiqueta é movida automaticamente e volta a cor normal.

3.       Quando o colaborador é movido para outra obra, eu gostaria que no perfil dele houvesse um histórico de mobilizações e de afastamentos.

4.       Quando o quadro da usina/obra ativa exigir integração, gostaria que uma janela de aviso aparecesse avisando que tal colaborador não é integrado e deve realizar a integração.

5.       Devido ao possível excesso de quadros, coloque uma forma adicional de movimentação de colaborador através dos quadros: ao clicar com o botão direito na etiqueta, aparece uma pequena janelinha com uma barra deslizante de todas as usinas/obras ativas para que possa mobilizá-lo para outra.

6.       Ao dar dois cliques rápidos com o botão esquerdo na etiqueta, é possível abrir a janela do colaborador já na aba de Integração.

 

Página de Colaboradores

1.       Há uma lista de colaboradores clicáveis que abre uma janela com as informações do colaborador.

2.       No canto superior esquerdo há um botão de “+”, para acrescentar colaborador em que, ao clicar abre um formulário digital de cadastro de colaboradores em que eu posso só apertar Tab e ir para o próximo campo para acelerar o fluxo de trabalho e com os seguintes campos:

- Nº de Matrícula (até quatro dígitos)

- Nome do Funcionário

- Gênero

- CEP

- Endereço Completo

- Data de Nascimento

- Local de Nascimento

- Etnia

- Estado Civil

- Nome do Cônjuge

- Nome da Mãe

- Nome do Pai

- Nacionalidade

- RG

- Data de Emissão do RG

- Órgão Emissor do RG

- UF Emissor do RG

- CPF

- Data de Emissão do CPF

- PIS

- Data de Emissão de PIS

- Data de Admissão

- Função

- Salário

- Forma de Salário (caixa de alternativa entre Mensal ou Horista)

3.       Ainda na página de colaboradores deve ser possível realizar a importação e exportação em lote desses colaboradores usando planilha no formato CSV e/ou XLS já parametrizada e num modelo fixo.

4.       Dentro do perfil do colaborador tem que ter três abas, uma chamada “Ficha”, com todos os dados de cadastro, uma chamada “Integrações” que estará listada todas as usinas/obras em que é obrigatória a integração do colaborador, e com a data de que foi integrado a usina/obra, e a terceira aba de “Histórico” para verificar mobilizações, afastamentos, etc. com datas e quem foi o usuário que fez a movimentação da etiqueta do colaborador.

5.       Adicione uma caixa com “nº de matrícula” (deve ter exatamente três dígitos) na aba de Ficha Cadastral, esse nº de matrícula deve aparecer no lugar da sigla na caixinha redonda ao lado esquerdo do nome completo.

6.       Adicione uma nova aba entre Integração e Histórico, chamada “Controle de Vencimento”, nele é para controlar o vencimento dos seguintes documentos:

- ASO (campo obrigatório)

- Férias (campo obrigatório)

7.       Há campos que podem ser adicionados manualmente, porque dependem de função e depende se o colaborador tem ou não, como CNH e NRs.

8.       Quando é adicionado uma data de integração na aba “Integração”, é criada automaticamente um campo com o nome daquela integração na aba “Controle de Vencimento” para um ano depois.

9.       Adicionar um botão de “Ativo” no colaborador, para que se ele for inativo, for oculto dos quadros e da lista de Colaboradores.

10.  Adicionar um botão de “Inativos” na página de Colaboradores, para visualizar quais colaboradores foram inativados.

 

Página de Obras

1.       Nesta página, é possível cadastrar centros de custo (Obras) e que possam ser ativados e desativados, quando ativos aparecem como quadros na página principal.

2.       Ao abrir um centro de custo, o campo de nome e de cliente são obrigatórios (apesar de poderem ser alterados), e há uma caixa que diz “Requer integração?”.

3.       Deve haver uma caixa com o nome de “Integração” em que se pode colocar o site ou a forma como se integra o colaborador a usina/obra.

4.       Aparecer janela de confirmação ao inativar usina/obra.

5.       Ocultar obra da lista de gestão de obras.

6.       Adicionar um botão de “Inativos” na página de Gestão de Obras, para visualizar quais usinas/obras foram inativadas.

7.       Adicionar filtro ao cabeçalho na lista para que se possa organizar a lista em ordem alfabética.

8.       Aparecer janela de confirmação ao inativar usina/obra.

9.       Ocultar obra da lista de gestão de obras.

10.  Adicionar um botão de “Inativos” na página de Gestão de Obras, para visualizar quais usinas/obras foram inativadas.

11.  Adicionar filtro ao cabeçalho na lista para que se possa organizar a lista em ordem alfabética.

 

Página de GM

1.       Crie uma nova página chamada “GM” abaixo de “Gestão de Obras”.

2.       Aqui é onde pode-se adicionar cargos para os que serão chamados de “Players”, ou seja, quem pode acessar os quadros da aplicação web; quem pode visualizar, editar e cadastrar colaboradores, cadastrar usinas/obras.

3.       Os perfis Players precisam ser criados pelo perfil GM, onde será criada uma senha e o login, de maneira simples, sem cadastro, sem e-mail, sem burocracia.

4.       A conta do GM é:
Login: Cappucceno
Senha: XWWSDZ66

5.       O botão “Adicionar Player”, tem uma seleção de nível de acesso para cada página (Quadro de Obras, Colaboradores, Obras e GM) para cada usuário adicionado da plataforma com três níveis diferentes para cada página:
- Não visualizar (não vê a página)
- Visualizar (só vê)
- Editar (pode ver e editar)

6.       A conta do GM é a única que pode excluir usuários e colaboradores.

 

Em toda a web application

1.       Um símbolo de sininho no canto superior do site para mostrar as notificações dos documentos que estão próximos a uma semana de vencer, de acordo com o colocado na página dos colaboradores.

2.       Ao clicar no sininho, mostra o nome do colaborador e os documentos próximos a uma semana de vencer.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://jogab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/743e12ae-6928-4f0d-9c18-c2bf6f2ead15).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
