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
- Auth: `Authorization: Bearer $COMMIT_HOOK_SECRET` (`checkAuth`); escrevem com a service role (`serviceClient`); o usuário é achado por e-mail em `team_members` (`findMembers`), filtrando pelas organizações dele.
- `GET /api/agent-tasks?email=` devolve `tasks` (subtarefas com `agent.status==='queued'`) e `refines` (cards com `refine.status==='queued'`).
- `POST update` atualiza o `agent` de uma subtarefa; `POST todos` espelha os todos do agente como subtarefas no card do dia; `POST refine` devolve o resultado do "Refinar com agente" (lógica pura em `src/lib/server/refine.ts`).
- O middleware exclui `api/agent-tasks` da checagem de sessão.
- Os dois portões humanos são cliques na UI (Refinar, Aprovar plano); o agente nunca aprova sozinho.
- Planning: cards = tabela `schedule_items`, subtarefas em JSONB (`agent`, `source`); `refine` é JSONB do card.

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
