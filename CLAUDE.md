# VBoards (flowos)

Gestão de times (kanban, roadmap, processos, docs/fluxos, Planning/cronograma). Pacote npm: `vboards`.

## Stack
Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + Radix/shadcn (`src/components/ui`) + Supabase (`@supabase/ssr`) + dnd-kit + tiptap + reactflow. Testes: vitest.

## Comandos
- `npm run dev` / `npm run build`
- `npx tsc --noEmit` (typecheck)
- `npm run lint` (tem problemas antigos, não adicione novos; baseline: 18 erros + 4 warnings)
- `npm test` (vitest, alias `@/` em `vitest.config.ts`; testes ao lado do código, `*.test.ts`)

## Mapa de pastas
- `src/app/` rotas (`board`, `roadmap`, `processes`, `schedule`, `team`, `settings`, `apps`, `(auth)`, `api/`)
- `src/components/<feature>/` UI por feature; `ui/` primitivos
- `src/context/` auth, idioma, projeto; `src/hooks/`
- `src/lib/api.ts` todo acesso Supabase do cliente (mapeia snake_case do banco para camelCase dos tipos)
- `src/lib/i18n.ts` traduções; `src/lib/schedule.ts` regras do Planning
- `src/lib/server/` código só de servidor (integração, refine)
- `src/types/index.ts` tipos de domínio
- `supabase/*.sql` schema e RLS; `scripts/` utilitários

## Integração AgenticOffice/Habblaud (runner local)
Rotas em `src/app/api/agent-tasks/`, máquina a máquina, sem sessão de usuário:
- Auth (`agentCaller`): primeiro o legado `Bearer $COMMIT_HOOK_SECRET` + `email` no query/corpo (comparação em tempo constante; o e-mail vira o auth user cujo próprio e-mail é exatamente esse, conferido em `auth.users`); senão `Bearer vb_...` com escopo `agent` (a identidade vem do token, o param `email` é ignorado). Escrevem com a service role (`serviceClient`); os membros vêm de `findMembers(userId)` (ver Modelo de segurança).
- `GET /api/agent-tasks?email=` devolve `tasks` (subtarefas com `agent.status==='queued'`) e `refines` (cards com `refine.status==='queued'`).
- `POST update` atualiza o `agent` de uma subtarefa; `POST todos` espelha os todos do agente como subtarefas no card do dia; `POST refine` devolve o resultado do "Refinar com agente" (lógica pura em `src/lib/server/refine.ts`).
- O middleware exclui `api/agent-tasks`, `api/v1/`, `api/whatsapp/` e `openapi.json` da checagem de sessão.
- Os dois portões humanos são cliques na UI (Refinar, Aprovar plano); o agente nunca aprova sozinho.
- Planning: cards = tabela `schedule_items`, subtarefas em JSONB (`agent`, `source`); `refine` é JSONB do card.

## Tokens de API e API v1 (Jarvis)
- Tabela `api_tokens` (`supabase/api_tokens.sql` + `api_tokens_security.sql`, RLS sem policies = só service role). Token `vb_` + 32 bytes base64url, guardado só o sha256 hex, com `user_id` (auth user, gravado do `getUser()` da sessão), `scopes` e `expires_at` opcional. Gerência em Configurações → Tokens de API, pelas rotas de sessão `GET/POST /api/tokens` e `DELETE /api/tokens/:id` (só os tokens do próprio `user_id`; máx. 20 ativos; validade 30/90/365 dias ou nunca, padrão 90). `authenticate(req)` em `integration.ts` devolve `{userId, email, scopes}`, recusa token sem `user_id`, revogado ou vencido, e grava `last_used_at` no máximo 1x/min.
- Escopos (`src/lib/server/tokens.ts`): `read` (GETs), `write` (criar/editar tasks e cards, subtarefas sem fila, pedir refine), `agent` (rotas `agent-tasks`, caixa do Jarvis, subtarefas com `queue=true`). Nenhum escopo aprova plano. Falta de escopo = 403 `{error:"missing scope X"}` (`v1Context(req, scope)`, `needScope`).
- `src/app/api/v1/*`: só token `vb_` (sem o segredo legado), JSON, erros `{error}` com 400/401/403/404/409/500 (500 sempre `"internal error"`; o detalhe vai para `console.error`, via `fail`). Tudo escopado às organizações do usuário (`v1Context`, `scopedRow`: linha de outra org = 404). Lógica pura (validadores, `pickOrg`, `buildSummary`) em `src/lib/server/v1.ts`.
- Endpoints: `GET me`, `GET projects`, `GET/POST tasks`, `PATCH tasks/:id`, `GET/POST schedule`, `PATCH schedule/:id`, `POST schedule/:id/subtasks|refine`, `POST schedule/:id/approve` (só sessão humana via `humanContext`; qualquer header `Authorization` = 403), `GET summary`, `GET jarvis/inbox`, `POST jarvis/inbox/:id/ack`. NOT NULL do banco (23502) vira 400 (`projectId required`). `approve` usa `approveRefine` de `src/lib/schedule.ts`, o mesmo do botão do card; grava `approvedAt`, que o Habblaud usa como prova de aprovação humana, por isso nenhum token (nem `agent`) aprova.
- Não há log de atividade no app (`activity_logs` não é usada pelo código), então as mutações da v1 não registram nada.

## WhatsApp (gateway WA-AKG) e caixa do Jarvis
`POST /api/whatsapp/webhook` (formato real do payload WA-AKG documentado em `src/lib/server/whatsapp.ts`):
- Valida `X-Webhook-Signature: sha256=<HMAC do corpo cru>`; só `message.received` e não `fromMe` (mensagens enviadas pelo próprio número do gateway saem como `message.sent` e são ignoradas).
- Texto cortado em 4000 caracteres no parse (antes da IA e do banco).
- Limite por remetente (jid do participante): 10/min e 100/dia, contados em `whatsapp_messages.sender_jid` (serverless, sem estado em memória); acima disso 200 `{ignored:"rate"}` sem IA.
- Dedup por `chatJid|senderJid|id` (`dedupKey`) em `whatsapp_messages` (`supabase/whatsapp.sql` + `whatsapp_rate_limit.sql`); se criar o card falhar, a linha é apagada para um reenvio refazer (o WA-AKG não tem retry automático, só reenvio manual).
- Dono (`WHATSAPP_OWNER_JIDS`) com texto começando por "Jarvis" vai para `jarvis_inbox` (`supabase/jarvis_inbox.sql`), de qualquer chat (grupo ou privado). Jarvis lê com `GET /api/v1/jarvis/inbox` e confirma com `POST /api/v1/jarvis/inbox/:id/ack`.
- O resto: grupo da allowlist vira task em `ideas` na org `WHATSAPP_ORG_ID` criada em `after()` (título/descrição via Claude se houver `ANTHROPIC_API_KEY`, senão primeira linha); fora da allowlist é ignorado.

Env (Vercel):
- `WHATSAPP_WEBHOOK_SECRET` obrigatório (sem ele a rota responde 503)
- `WHATSAPP_GROUP_JIDS` JIDs de grupo permitidos, separados por vírgula (`...@g.us`)
- `WHATSAPP_ORG_ID` obrigatório para criar cards (sem ele, mensagem que viraria card dá 503)
- `WHATSAPP_DEFAULT_PROJECT_ID` opcional: projeto do card quando a IA não acha um (precisa ser da org); recomendado, porque o schema de `tasks` não está em `supabase/` e `project_id` pode ser NOT NULL
- `WHATSAPP_OWNER_JIDS` (JIDs ou telefones do dono) + `WHATSAPP_OWNER_EMAIL` (usuário VBoards cujo token, com escopo `agent`, lê a caixa); sem os dois, a caixa fica desligada
- `ANTHROPIC_API_KEY` opcional; `WHATSAPP_AI_MODEL` opcional (padrão `claude-haiku-5-5`)

Spec OpenAPI 3.1 estática da v1 + caixa: `public/openapi.json` (servida em `/openapi.json`, fora do middleware). Atualize à mão quando mudar a API.

## Modelo de segurança
- Identidade = auth user id (`auth.users.id`), nunca e-mail. `team_members.email` é texto livre e convite cria linha só com e-mail.
- Uma linha de `team_members` conta para o usuário U só se `user_id = U` E existe `organization_members (organization_id, U)` (`selectMembers` em `src/lib/server/identity.ts`, usado por `findMembers`).
- RLS: entrar em `organization_members` só como você mesmo, sendo dono da org ou com convite para o seu e-mail; convite é aceito por clique (banner `PendingInvitations`, RPC `accept_invitation`), nunca automático. Trigger em `team_members` só deixa vincular `user_id` a si mesmo e trava o e-mail de linha vinculada. Trigger em `schedule_items` só deixa enfileirar (`agent.status`/`refine.status = queued`) com `requestedBy` = um member id seu na org.
- SQL de segurança, nesta ordem (depois dos `.sql` base): `fix_org_members_insert.sql` → `backfill_team_members_user_id.sql` → `schedule_items_requested_by_guard.sql` → `api_tokens_security.sql` → `whatsapp_rate_limit.sql`. Os dois últimos antes de publicar o código (as rotas leem as colunas novas).

## Supabase / RLS
Os `.sql` em `supabase/` são aplicados manualmente no SQL editor (não há migrations automáticas). Coluna nova numa tabela com RLS por organização não exige policy nova. Não rode SQL contra o banco sem o usuário pedir.

## Convenções
- Todo texto de UI vai em `i18n.ts` nas 3 línguas (en, pt, es); nunca string fixa.
- Mensagens de commit em pt-BR (viram subtasks no Planning), prefixo `feat:`/`fix:`/`chore:` ok.
- Texto vindo de agentes é renderizado como texto puro (`whitespace-pre-wrap`), nunca HTML.
- Indentação de 4 espaços nos arquivos de schedule/api; siga o estilo do arquivo.

## Não mexer
- `.env*` e chaves (service role, `COMMIT_HOOK_SECRET`).
- Sem push nem commit sem o usuário pedir; sem subir Docker.
- O contrato `agent-tasks` é compartilhado com o Habblaud: mudar formato de resposta/corpo quebra o runner.
