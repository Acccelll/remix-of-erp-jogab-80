# ETAPA 11 — Auditoria de Segurança, Controle de Acesso e Resiliência — Planifik

**Perspectiva:** Application Security Architect / Security Reviewer / Auditor Técnico
**Metodologia:** padrão Etapa 5.5 com campos estendidos (Tipo, Estratégia, Valor Esperado, **Métrica de Sucesso**). Novo prefixo: **SEC-**. Esta etapa é a **herdeira formal de DB-002** (RLS permissivo), que passa a ser tratado como o núcleo do plano de segurança.
**Base:** análise estática do frontend + do `api.php` (backend PHP presente no zip) + migrations (RLS) + edge functions + configuração de ambiente. Achados verificados por leitura direta.
**Regra:** somente diagnóstico. Nenhum arquivo alterado, nenhuma exploração executada — apenas inspeção de código. Fora de escopo: testes, CI/CD, infra (exceto o que toca segredos/segurança).

> **Nota de gravidade:** esta é a etapa com os achados mais severos da auditoria. Três achados são **P0**. A causa raiz é única e já conhecida de todas as etapas: a **fronteira dupla de backend** — mas aqui ela deixa de ser questão de arquitetura e passa a ser questão de exposição.

---

## ETAPA A — Autenticação

**Dois sistemas encadeados, com robustez oposta:**

1. **PHP (dono da identidade real):** `POST /login` compara **senha em texto puro** contra a coluna `usuarios.senha` (`WHERE login = :l AND senha = :s` — sem hash, confirmado na leitura); em sucesso, emite um "token" que é apenas `base64(json({user_id, login, exp}))` — **sem assinatura**, sem segredo, sem HMAC. `validateToken` faz `base64_decode` e checa só a expiração. O refresh aceita token expirado dentro de janela de 30 dias e reemite.
2. **Supabase Auth (espelho):** sessão real provisionada por edge functions (`provision-auth-user`, `sync-player-auth`), com JWT legítimo — este lado é sólido.

Sessão mantida em `localStorage` (`go_token`, `go_player`); expiração de 24 h no payload PHP; logout limpa storage; reauth global em 401 (`ReauthDialog`). **Consistência:** a _mecânica_ de sessão (encadeamento, reauth, self-heal) é bem construída; a _base criptográfica_ do lado PHP é inexistente (**SEC-001**).

## ETAPA B — Autorização

Concessão: matriz `acessos: Record<PageKey, NivelAcesso>` vinda do PHP no login + `isGM`. Verificação: `canAccess` no AppContext (menu/rotas/telas). Centralização: parcial — três sistemas sem fachada (ARC-009, já catalogado): acessos-página (PHP), `obra_membros` (Supabase) e roles/RLS. Aqui a leitura de segurança acrescenta o agravante: **a autorização de página é decidida no cliente** a partir de um token que o próprio cliente pode forjar (SEC-001), e **o dado do Supabase é protegido por RLS que em 226 políticas não protege nada** (DB-002/SEC-002). Ou seja: as duas pontas da autorização têm o mesmo furo — a verificação existe, mas o que a sustenta é falsificável ou permissivo.

## ETAPA C — Controle de Acesso

RBAC existe (página×nível+GM) e é o modelo declarado; ABAC aparece no melhor pedaço — os guards de banco `_require_obra_access/_require_gm` (RLS rica, 281 usos). O problema não é ausência de modelo, é **coexistência de um modelo rico com um modelo neutralizado** sem critério: 226 políticas `USING(true) TO anon, authenticated` ao lado dos guards. Escalável? O desenho rico sim; a metade permissiva é dívida que cresce a cada tabela nova que nasce copiando o template "Allow all".

## ETAPA D — Proteção de Rotas

- **Cliente:** `ProtectedRoutes` bloqueia por `currentPlayer` (só autenticação); autorização por página via `canAccess`. **Redundância saudável na intenção, insuficiência na garantia:** proteção de rota no cliente é UX, não segurança — quem importa é o backend, e é lá (RLS permissivo + token forjável) que o controle falha.
- **PHP:** `$protectedRoutes` (allowlist de ~45 resources) exige token — bom desenho, anulado por SEC-001 (token sem assinatura).
- Risco de acesso indevido: **real** — um token base64 montado à mão com `exp` futuro passa em `validateToken`; e tabelas com `USING(true) TO anon` são legíveis/graváveis com a chave publishable (que é pública por natureza).

## ETAPA E — Proteção de Dados

- **Persistência insegura:** token e objeto `player` (com matriz de permissões) em `localStorage` — acessível a qualquer XSS; sem HttpOnly cookie (**SEC-004**).
- **Exposição via RLS permissivo:** dados de negócio em tabelas `USING(true) TO anon` são exfiltráveis com a chave pública (SEC-002).
- **Segredo real vazado no repositório:** `api.php` contém a **senha do banco MySQL em texto** (`$password = "...";`) e o arquivo está no zip; além disso `.env` **não está no `.gitignore`** (**SEC-003**).
- Compartilhamento excessivo: `select("*")` (PERF-002) também é questão de segurança — projeta colunas que a tela não precisa e que podem ser sensíveis.

## ETAPA F — Validação

Entrada: sem estratégia única (BIZ-003/DS-001) — e do ângulo de segurança, a validação imperativa de UI **não é fronteira de confiança** (roda no cliente). A fronteira real seria o backend: no PHP há uso de **PDO com prepared statements** (positivo — mitiga SQLi na maioria dos casos); no Supabase, os CHECKs do banco (432) validam domínio. Saída/escape: React escapa por padrão; **1 único `dangerouslySetInnerHTML`**, em `ui/chart.tsx` (injeta CSS de tema gerado internamente, não entrada de usuário — baixo risco, mas é o único sink e merece nota). Ausência crítica: validação server-side de payloads no PHP além de SQL (regras de negócio confiam no cliente).

## ETAPA G — Segredos

- **VITE_*** no bundle: `SUPABASE_URL`, `PUBLISHABLE_KEY`, `API_URL` — corretos por serem públicos por design (a publishable key **depende de RLS** para significar algo — e é aí que SEC-002 morde).
- **`.env` não-ignorado** (SEC-003): risco de commit de segredos.
- **Senha MySQL hardcoded** no `api.php` (SEC-003) — o segredo mais sensível do sistema, em texto, versionável.
- Edge functions usam `SUPABASE_SERVICE_ROLE_KEY` via `Deno.env` (correto — server-side, fora do bundle) ✔.

## ETAPA H — Tratamento de Erros (ótica de segurança)

Já auditado como qualidade (QC-003); do ângulo de segurança: `json_response(["error" => ...], 401)` no PHP é genérico (bom — não vaza stack); no cliente, 90 `console.error` podem imprimir payloads/identidades no console do navegador (vazamento leve de informação em máquina compartilhada). Sem vazamento de stack server-side detectado. Recuperação: reauth em 401 é boa prática.

## ETAPA I — Resiliência

| Cenário              | Reação atual                                                                                                           | Avaliação                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Falha de rede        | banner de saúde do gateway PHP (3 falhas/5 min → "não saudável"); toasts                                               | ✔ bom                                |
| Timeout              | sem timeout explícito nas chamadas (fetch sem `AbortController` de deadline) — pende do default do browser             | 🟡 SEC-006                           |
| Serviço indisponível | banner + retry manual; fila offline para RDO/Inspeções                                                                 | ✔ parcial                            |
| Resposta inesperada  | tipos `any` (QC-001) — cliente confia na forma da resposta; sem validação de contorno                                  | 🟡 (herda QC-001)                    |
| Sessão expirada      | reauth global ✔                                                                                                        | ✔                                    |
| Permissão revogada   | **só relida no próximo login** (staleness do snapshot — EST/ARC-004): um usuário rebaixado mantém acessos até re-logar | 🟡 agravante de segurança de ARC-004 |
| Dados inconsistentes | fronteira texto sem FK (DB-001)                                                                                        | 🟡 já catalogado                     |
| Rate limiting        | **ausente** no PHP e no cliente (nenhum throttle de login — brute force livre)                                         | 🔴 SEC-005                           |
| Circuit breaker      | inexistente (o banner é sinal, não corte)                                                                              | aceitável no contexto                |

## ETAPA J — Observabilidade de Segurança

Trilha de auditoria de **negócio** existe e é boa (`audit_logs` + visualizador GM). Mas **não há trilha de segurança**: logins (sucesso/falha), reautenticações, mudanças de permissão e acessos negados não são registrados de forma consultável; sem registro de IP/tentativas. `system_events` cobre operação, não segurança (**SEC-007**). Sentry existe (subutilizado — QC-003).

## ETAPA K — Conformidade (proporcional ao contexto)

Contexto: ERP interno de um grupo (dezenas de usuários), não SaaS público de milhões — o que **reduz** a superfície, mas os dados são sensíveis (folha, custos, CPF de colaboradores, financeiro). Frente a OWASP Top 10, os desvios materiais: **A02 Cryptographic Failures** (senha em texto, token sem assinatura — SEC-001), **A01 Broken Access Control** (RLS permissivo — SEC-002), **A05 Security Misconfiguration** (segredos versionáveis, CORS com fallback `*` — SEC-003), **A07 Identification/Auth Failures** (sem rate limit, token forjável — SEC-001/005). LGPD: dados pessoais de colaboradores sob RLS permissivo e senha em texto são exposição relevante — proporcional ou não ao porte, é o tipo de risco que um cliente enterprise audita antes de comprar.

## ETAPA L — Padrões Positivos (evidências)

1. **PDO com prepared statements** no PHP — SQLi mitigado na superfície de dados.
2. **CORS com allowlist explícita** (4 origens nomeadas) — o desenho é correto (o fallback `*` é o defeito — SEC-003).
3. **Guards de acesso no banco** (`_require_*`, 281 usos) — ABAC no lugar certo, onde as políticas os usam.
4. **Reauth global em 401** + self-heal de usuário órfão.
5. **Service role key server-side** nas edge functions (fora do bundle).
6. **React auto-escape** + apenas 1 sink de HTML (interno).
7. **Trilha de auditoria de negócio** (`audit_logs`) navegável.
8. **Snapshots com hash** (integridade de importação TOTVS).

## ETAPA M — NOVOS ACHADOS (prefixo SEC-)

**SEC-001 — Autenticação PHP sem base criptográfica (senha em texto + token não assinado)** · REF/MOD · SEQUENCIAL · **Valor: SEC** · Autenticação · Etapa 11
**Métrica de sucesso:** 0 senhas em texto no banco; 100% dos tokens verificáveis por assinatura; token forjado rejeitado em teste.
**Evidências:** `api.php` — `SELECT * FROM usuarios WHERE login=:l AND senha=:s` (comparação em texto); `generateToken` = `base64_encode(json_encode({user_id,login,exp}))` sem assinatura; `validateToken` só decodifica e checa `exp`; refresh aceita token expirado por 30 dias.
**Diagnóstico:** qualquer pessoa que saiba o formato monta um token válido para qualquer `user_id` com `exp` futuro — autenticação efetivamente contornável; e um vazamento do banco expõe todas as senhas em texto (agravado por reúso de senha entre sistemas).
**Objetivo arquitetural:** identidade sustentada por hash de senha forte e tokens assinados/verificáveis (ou delegação plena ao Supabase Auth, aposentando o esquema PHP).
**Impacto:** **Crítico**. **Prioridade:** **P0**. **Complexidade:** Alta. **Dependências:** converge com ARC-002/ARC-004 (a aposentadoria do auth PHP é a via definitiva); medida emergencial (assinar token + hash de senha) independe. **Áreas impactadas:** login, todas as rotas protegidas do PHP, ReauthDialog. **Risco de regressão:** Alto (mexe no fluxo de acesso de todos). **Validação recomendada:** teste de token forjado rejeitado; migração de senhas para hash com verificação de login; suíte de auth E2E.
**Critérios de aceite:** (a) senhas armazenadas com hash forte; comparação por verificação de hash; (b) token assinado e verificado no servidor (segredo fora do repositório); (c) token forjado/adulterado rejeitado; (d) janela de refresh revista; (e) plano registrado de convergência para Supabase Auth.

**SEC-002 — RLS permissivo: 226 políticas `USING(true) TO anon, authenticated`** · STD/CON · MIGRAÇÃO · **Valor: SEC** · Controle de Acesso · Etapa 11 _(herda DB-002)_
**Métrica de sucesso:** 0 políticas `TO anon ... USING(true)` sem justificativa; teste de leitura anônima retorna vazio nas tabelas de negócio.
**Evidências:** 226 de 611 políticas no padrão `FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)` (ex.: `mobilizacoes_periodos`), sobre tabelas de negócio; a `publishable key` é pública por design — o que torna essas tabelas efetivamente abertas a quem tiver a chave do bundle.
**Diagnóstico:** um terço do schema é lível/gravável sem identidade; combinado com a chave pública embutida no frontend, é exposição direta de dados sensíveis (custos, folha, dados de colaboradores).
**Objetivo arquitetural:** regime único de RLS por identidade/papel, preservando os fluxos legítimos (QR público de inspeção, edges com service role).
**Impacto:** **Crítico**. **Prioridade:** **P0**. **Complexidade:** Alta (rever 226 políticas sem quebrar telas). **Dependências:** ARC-009 (fachada de autorização) para o desenho-alvo; SEC-001 (identidade confiável) — RLS por papel só vale se a identidade valer. **Áreas impactadas:** todos os módulos Supabase; rota pública QR (M5). **Risco de regressão:** Alto (aperto indevido derruba telas legítimas). **Validação recomendada:** suíte de acesso por papel (anon/comum/GM) por tabela; E2E dos fluxos públicos e edges; teste de leitura anônima retornando vazio.
**Critérios de aceite:** (a) 0 política `TO anon ... USING(true)` sem justificativa documentada; (b) leitura anônima às tabelas de negócio retorna vazio (comprovado); (c) QR público e edges preservados por política mínima específica; (d) regime documentado por tabela (herda inventário de DB-002).

**SEC-003 — Segredos versionáveis e CORS com fallback aberto** · STD/REM · ISOLADA · **Valor: SEC** · Segredos/Config · Etapa 11
**Métrica de sucesso:** 0 segredos no repositório; `.env` ignorado; CORS sem fallback `*`.
**Evidências:** `api.php` com **senha do MySQL em texto** (`$password = "..."`); `.env` **ausente do `.gitignore`** (só `*.local` e `.env` não constam); CORS: allowlist correta **porém** com `else { header("Access-Control-Allow-Origin: *") }` mais `Allow-Credentials: true`.
**Diagnóstico:** o segredo mais crítico (acesso ao banco legado) é versionável e estava no artefato auditado; `.env` desprotegido convida commit de chaves; o fallback CORS `*` com credenciais amplia origem de requisições autenticadas.
**Objetivo arquitetural:** segredos fora do código/versionamento; CORS estritamente pela allowlist.
**Impacto:** **Crítico** (o vazamento da senha do banco é acesso direto aos dados). **Prioridade:** **P0**. **Complexidade:** Baixa. **Dependências:** nenhuma — ação imediata. **Áreas impactadas:** backend PHP, config de build/repo. **Risco de regressão:** Baixo. **Validação recomendada:** varredura de segredos no repositório (zero); rotação da senha exposta; teste CORS de origem não-listada bloqueada.
**Critérios de aceite:** (a) senha do banco fora do código, em variável de ambiente do host; (b) senha exposta **rotacionada** (assumir comprometida); (c) `.env` no `.gitignore`; (d) CORS sem fallback `*` quando há credenciais; (e) varredura de segredos limpa.

**SEC-004 — Sessão sensível em localStorage (exposta a XSS)** · REF · SEQUENCIAL · **Valor: SEC** · Sessão · Etapa 11
**Métrica de sucesso:** token não acessível a JS (cookie HttpOnly) ou risco residual documentado e aceito.
**Evidências:** `go_token` e `go_player` (com matriz de permissões) em `localStorage` (`AppContext`, `ReauthDialog`, `api.ts`).
**Diagnóstico:** qualquer XSS lê a sessão e as permissões; localStorage não tem proteção de origem além do mesmo-site e é legível por qualquer script na página.
**Objetivo arquitetural:** transporte de sessão resistente a XSS (cookie HttpOnly/SameSite) na convergência para Supabase Auth, que já usa storage próprio gerenciado.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Média. **Dependências:** SEC-001/ARC-004 (a convergência resolve estruturalmente). **Áreas impactadas:** auth, api.ts. **Risco de regressão:** Médio. **Validação recomendada:** verificação de que token não é legível por JS; fluxo de sessão E2E.
**Critérios de aceite:** (a) token de sessão não acessível via `document`/`localStorage` a scripts, ou decisão documentada de risco aceito com mitigação; (b) `player`/permissões não persistidos em claro; (c) logout invalida sessão no servidor.

**SEC-005 — Ausência de rate limiting (brute force livre no login)** · NEW · ISOLADA · **Valor: SEC** · Resiliência/Auth · Etapa 11
**Métrica de sucesso:** tentativas de login limitadas por identidade/origem; bloqueio temporário após N falhas.
**Evidências:** `api.php` `case 'login'` sem contagem de tentativas/throttle; nenhum rate limit no cliente ou gateway.
**Diagnóstico:** com senha em texto (SEC-001) e sem throttle, força bruta é trivial.
**Objetivo arquitetural:** limitação de tentativas por identidade e origem.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Baixa-Média. **Dependências:** melhor após/junto de SEC-001. **Áreas impactadas:** login PHP. **Risco de regressão:** Baixo. **Validação recomendada:** teste de N falhas → bloqueio temporário.
**Critérios de aceite:** (a) limite de tentativas por conta/origem com backoff/bloqueio; (b) resposta neutra (não revela se login existe); (c) evento de segurança registrado (liga em SEC-007).

**SEC-006 — Chamadas sem timeout/deadline explícito** · STD · LOTE · **Valor: SEC/UX** · Resiliência · Etapa 11
**Métrica de sucesso:** chamadas de rede com deadline; UI degrada previsivelmente em serviço lento.
**Evidências:** `fetch` no `api.ts`/edges sem `AbortController`/timeout; resiliência delegada ao default do browser.
**Diagnóstico:** serviço lento (não caído) prende a UI sem corte previsível; não é vulnerabilidade clássica, mas é resiliência — pedida explicitamente nesta etapa.
**Objetivo arquitetural:** deadline padrão nas chamadas com degradação controlada.
**Impacto:** Baixo. **Prioridade:** P3. **Complexidade:** Baixa. **Dependências:** política de erro (QC-003). **Áreas impactadas:** api.ts, camada de dados. **Risco de regressão:** Baixo. **Validação recomendada:** simulação de resposta lenta → timeout e feedback.
**Critérios de aceite:** (a) deadline configurado nas chamadas de rede; (b) timeout produz feedback padrão (QC-003/DS-002); (c) offline/lento distinguidos ao usuário.

**SEC-007 — Sem trilha de auditoria de segurança** · NEW · ISOLADA · **Valor: SEC/OBS** · Observabilidade de Segurança · Etapa 11
**Métrica de sucesso:** logins, reauth, mudanças de permissão e acessos negados consultáveis.
**Evidências:** `audit_logs` cobre ações de negócio; nenhum registro consultável de eventos de autenticação/autorização; `system_events` é operacional.
**Diagnóstico:** um incidente (acesso indevido, credencial vazada) seria invisível — não há como responder "quem entrou, quando, de onde, o que foi negado".
**Objetivo arquitetural:** trilha de eventos de segurança separada e consultável.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Média. **Dependências:** SEC-001 (identidade confiável para logar) e SEC-005 (eventos de falha). **Áreas impactadas:** auth, GM. **Risco de regressão:** Baixo (aditivo). **Validação recomendada:** eventos de login/negação aparecendo na trilha; retenção definida.
**Critérios de aceite:** (a) eventos de auth/authz registrados (sucesso/falha, identidade, origem, timestamp); (b) visualizáveis por GM; (c) política de retenção definida.

_(Sem novo ID, por sobreposição consciente: permissão revogada só relida no login → agravante de segurança anexado a ARC-004; `select("*")` como sobre-exposição → nota anexada a PERF-002; validação de UI não é fronteira de confiança → nota anexada a BIZ-003.)_

## ETAPA N — Matriz de Maturidade

| Área                         | Segurança         | Resiliência | Organização | Escalabilidade | Maturidade |
| ---------------------------- | ----------------- | ----------- | ----------- | -------------- | ---------- |
| Autenticação (PHP)           | ★☆☆☆☆             | ★★★☆☆       | ★★★☆☆       | ★★☆☆☆          | ★☆☆☆☆      |
| Autenticação (Supabase)      | ★★★★☆             | ★★★★☆       | ★★★★☆       | ★★★★☆          | ★★★★☆      |
| Autorização                  | ★★☆☆☆             | ★★★☆☆       | ★★☆☆☆       | ★★★☆☆          | ★★☆☆☆      |
| Controle de Acesso (RLS)     | ★★☆☆☆ (bifurcado) | ★★★☆☆       | ★★★☆☆       | ★★★☆☆          | ★★☆☆☆      |
| Rotas                        | ★★★☆☆             | ★★★★☆       | ★★★★☆       | ★★★★☆          | ★★★☆☆      |
| Validação (fronteira)        | ★★☆☆☆             | ★★★☆☆       | ★★☆☆☆       | ★★★☆☆          | ★★☆☆☆      |
| Secrets                      | ★☆☆☆☆             | —           | ★★☆☆☆       | ★★★☆☆          | ★☆☆☆☆      |
| Sessões                      | ★★☆☆☆             | ★★★★☆       | ★★★☆☆       | ★★★☆☆          | ★★★☆☆      |
| Tratamento de Erros          | ★★★☆☆             | ★★★☆☆       | ★★☆☆☆       | ★★★☆☆          | ★★★☆☆      |
| Resiliência                  | ★★★☆☆             | ★★★☆☆       | ★★★★☆       | ★★★☆☆          | ★★★☆☆      |
| Observabilidade de Segurança | ★☆☆☆☆             | ★★☆☆☆       | ★★☆☆☆       | ★★★☆☆          | ★★☆☆☆      |

## ETAPA O — Matriz de Implementação (novos itens)

| Ordem                              | ID          | Tipo    | Estratégia | Valor   | Área               | Objetivo                                                | Impacto | Prioridade | Complexidade | Dependências     | Áreas Impactadas    | Isolável?                             | Critérios |
| ---------------------------------- | ----------- | ------- | ---------- | ------- | ------------------ | ------------------------------------------------------- | ------- | ---------- | ------------ | ---------------- | ------------------- | ------------------------------------- | --------- |
| **0 (emergencial, antes de tudo)** | **SEC-003** | STD/REM | ISOLADA    | SEC     | Segredos           | Segredos fora do repo + rotação + CORS estrito          | Crítico | **P0**     | Baixa        | —                | backend/repo        | Sim                                   | ficha M   |
| **0**                              | **SEC-001** | REF/MOD | SEQUENCIAL | SEC     | Autenticação       | Hash de senha + token assinado (ou ir p/ Supabase Auth) | Crítico | **P0**     | Alta         | converge ARC-004 | auth/PHP            | Parcial (medida emergencial isolável) | ficha M   |
| **0 (programa, início imediato)**  | **SEC-002** | STD/CON | MIGRAÇÃO   | SEC     | Controle de Acesso | Regime único de RLS por papel                           | Crítico | **P0**     | Alta         | ARC-009; SEC-001 | todos Supabase + QR | Parcial (por tabela)                  | ficha M   |
| junto de SEC-001                   | **SEC-005** | NEW     | ISOLADA    | SEC     | Auth/Resiliência   | Rate limit no login                                     | Alto    | P1         | Baixa-Média  | SEC-001          | login               | Sim                                   | ficha M   |
| na convergência de auth            | **SEC-004** | REF     | SEQUENCIAL | SEC     | Sessão             | Sessão resistente a XSS                                 | Alto    | P1         | Média        | SEC-001/ARC-004  | auth                | Parcial                               | ficha M   |
| após SEC-001/005                   | **SEC-007** | NEW     | ISOLADA    | SEC/OBS | Observabilidade    | Trilha de auditoria de segurança                        | Médio   | P2         | Média        | SEC-001/005      | auth/GM             | Sim                                   | ficha M   |
| lote P3                            | **SEC-006** | STD     | LOTE       | SEC/UX  | Resiliência        | Timeouts/deadlines                                      | Baixo   | P3         | Baixa        | QC-003           | camada de dados     | Sim                                   | ficha M   |

**Reposicionamento do catálogo:** os três P0 de segurança **precedem** o P0 técnico ARC-001 na ordem de execução por gravidade de exposição — passa a haver um **bloco P0-segurança (SEC-003 → SEC-001 → SEC-002 iniciando)** antes do bloco técnico. Nenhuma ordem posterior removida; apenas antecipa-se segurança.

## ETAPA P — Impacto Cruzado

| Achado  | Módulos               | Regressão | Funcionalidades críticas                   | Testes                                                 | Depende de etapas            |
| ------- | --------------------- | --------- | ------------------------------------------ | ------------------------------------------------------ | ---------------------------- |
| SEC-003 | backend/repo          | Baixa     | acesso ao banco; CORS de todas as chamadas | varredura de segredos; CORS bloqueando origem estranha | —                            |
| SEC-001 | todos (login)         | Alta      | autenticação inteira                       | token forjado rejeitado; migração de senha; auth E2E   | ARC-002/004 (convergência)   |
| SEC-002 | todos Supabase; M5 QR | Alta      | leitura/escrita de todo dado de negócio    | acesso por papel; leitura anon vazia; QR/edges vivos   | DB-002 (inventário), ARC-009 |
| SEC-004 | auth                  | Média     | persistência de sessão                     | token não legível por JS; sessão E2E                   | SEC-001/ARC-004              |
| SEC-005 | login                 | Baixa     | resistência a brute force                  | N falhas → bloqueio                                    | SEC-001                      |
| SEC-006 | camada de dados       | Baixa     | resiliência a lentidão                     | timeout com feedback                                   | QC-003                       |
| SEC-007 | auth/GM               | Baixa     | resposta a incidente                       | eventos na trilha                                      | SEC-001/005                  |

## ETAPA Q — Plano Diretor de Segurança

**Visão geral:** a segurança do Planifik é **um produto de duas metades** iguais às de todas as etapas anteriores — a metade Supabase tem os alicerces certos (JWT real, guards de banco, service role server-side, CORS com allowlist, PDO parametrizado) e a metade PHP legada carrega falhas de fundamentos (senha em texto, token sem assinatura, segredo versionável, sem rate limit). A diferença desta etapa é que a fronteira dupla, antes um custo de manutenção, aqui é uma **superfície de exposição**: os dois lados da autorização (token forjável + RLS permissivo) falham na mesma direção.

**Principais riscos:** autenticação contornável (SEC-001); dados de negócio abertos via RLS permissivo + chave pública (SEC-002); senha do banco versionável (SEC-003) — os três P0.
**Vulnerabilidades arquiteturais:** autorização decidida no cliente sobre identidade falsificável; regime de acesso bifurcado no banco.
**Pontos fortes:** Supabase Auth, guards `_require_*`, PDO, CORS allowlist, snapshots com hash, reauth global.
**Oportunidades:** cada P0 de segurança **acelera** a convergência PHP→Supabase já planejada (ARC-004) — consertar auth é dar o empurrão que a migração precisava; a fachada ARC-009 vira o desenho-alvo natural do RLS.
**Estratégia:** conter antes de construir — rotacionar segredo e fechar CORS (SEC-003, horas), depois blindar identidade (SEC-001+SEC-005), depois fechar o RLS em lotes (SEC-002) de mãos dadas com ARC-009; só então os itens P1/P2 de sessão e trilha.
**Sequência ao Lovable (consolidada, com segurança antecipada):** **SEC-003 → SEC-001(+SEC-005) → SEC-002 iniciando (programa) → ARC-001 → QC-001 onda 1 → DB-005/DB-003 → EST-002/UX-004 → quick wins → SEC-004 na convergência → janela de dados → DB-002/SEC-002 concluindo em lotes → SEC-007 → programa de validação → BIZ-001 → ARC-005/PERF-001 → ARC-002/ARC-004 (encerra SEC-001/004 por convergência) → PRO-004 → lotes P2/P3 (SEC-006 no fim).**

---

# RESUMO EXECUTIVO

**1. Visão geral:** arquitetura de segurança bifurcada — Supabase sólido em fundamentos, PHP legado com falhas graves de base. A mecânica de sessão (reauth, self-heal, encadeamento) é bem-feita; a criptografia que deveria sustentá-la, do lado PHP, não existe. É o capítulo mais severo da auditoria: **três P0**.

**2. Maturidade: ★★☆☆☆** — puxada para baixo pelos fundamentos do legado; a metade Supabase isolada seria ★★★★☆.

**3. Resiliência: ★★★☆☆** — boa em rede/sessão (banner, reauth, offline), fraca em abuso (sem rate limit) e em corte (sem timeout).

**4. Principais riscos:** token PHP forjável (autenticação contornável); 226 tabelas com RLS permissivo abertas via chave pública; senha do MySQL em texto no código; sessão sensível em localStorage.

**5. Principais pontos fortes:** Supabase Auth com JWT real; guards de acesso no banco; PDO parametrizado; CORS com allowlist; service role fora do bundle; reauth global; auditoria de negócio.

**6. Principais oportunidades:** os três P0 são o gatilho perfeito para acelerar a migração PHP→Supabase que o produto já planejava — segurança e arquitetura empurram na mesma direção; a fachada ARC-009 é o desenho-alvo do RLS.

**7. Novos Achados: 7** (SEC-001/002/003 **P0** · SEC-004/005 P1 · SEC-007 P2 · SEC-006 P3) + evidências de segurança anexadas a ARC-004, PERF-002, BIZ-003.

**8. Catálogo Mestre atualizado:** 89 → **96 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · BIZ 4 · EST 3 · DB 6 · QC 4 · PERF 4 · **SEC 7**). Prioridades: **P0 4** · P1 **37** · P2 **32** · P3 **23**.

**9. Matriz de Implementação atualizada:** criado **bloco P0-segurança antecipado** (SEC-003 → SEC-001 → SEC-002) à frente do bloco técnico; P1/P2/P3 de segurança encaixados na convergência de auth e nos lotes; DB-002 formalmente absorvido por SEC-002. Nenhuma ordem posterior removida.

**10. Conclusão executiva:** à pergunta — _"a arquitetura de segurança é consistente, resiliente e preparada para crescer?"_ — a resposta honesta é **não, ainda não, e este é o capítulo que não admite espera.** As demais etapas descrevem dívidas que encarecem a evolução; esta descreve exposições que arriscam o dado. A boa notícia repete o padrão do projeto: as correções não exigem reescrever segurança do zero — exigem **aposentar os fundamentos do legado** (o que a migração já ia fazer) e **fechar o RLS** (cujo desenho rico já existe ao lado do permissivo). Contenção em horas (segredo, CORS), blindagem em semanas (auth, RLS) — e o produto sai da zona de risco material para a mesma trajetória de maturidade que as outras camadas já trilham.

---

_Auditoria conforme metodologia da Etapa 5.5 com campos estendidos. Nenhum arquivo alterado; nenhuma exploração executada — apenas inspeção de código. Testes, CI/CD e infraestrutura permanecem reservados às suas etapas; observabilidade geral fora do recorte de segurança também._
