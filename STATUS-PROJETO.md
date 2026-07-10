# STATUS DO PROJETO - Orzai / Base CRM

Este arquivo e a ponte oficial de contexto entre modelos de IA e operadores humanos.
Ele descreve apenas o estado atual e operacional do projeto.

Regra deste documento:
- registrar somente o que esta ativo, validado ou realmente pendente
- evitar historico longo de tentativas antigas
- usar o git como historico detalhado de mudancas
- atualizar este arquivo ao concluir qualquer bloco relevante

---

## 1. Resumo executivo

O produto e comercializado como `Orzai` (o CRM em si continua sendo o `Base CRM`).
Deploy publico ativo em `https://orzai.vercel.app` (projeto Vercel renomeado de
`belart-crm-portavel-20260625-175520` para `orzai`).

Arquitetura ativa hoje:
- frontend e backend em `Next.js`
- persistencia principal em `Supabase Postgres` via `Prisma`
- autenticacao atual e `auth proprio do CRM`
- IA ativa via `OpenRouter`
- canal de mensagens oficial e `WhatsApp Cloud API (Meta)`, mas **sem integracao ativa
  configurada no momento** (ver secao 10.2)
- landing page publica reformulada como pagina de vendas, com aba de
  `Demonstracoes` e um sandbox interativo publico em `/demo` (sem login,
  dados ficticios, nao toca no banco real)
- funil de vendas simplificado de 10 para 5 etapas: `Novo Lead`, `Em Conversa`,
  `Aguardando Retorno`, `Negociacao`, `Matriculado`
- modulo de `Agendamento Inteligente` (Fase 1) implementado: agenda propria
  ligada ao assistente de IA, sem depender de Cal.com/provedor externo

O que NAO e mais trilha ativa:
- `Firebase`, `Ollama`, `Gemini`, `Evolution API` como integracao operacional

---

## 2. Decisoes arquiteturais atuais

- `Supabase` e a persistencia principal do CRM
- `Prisma` continua como camada de acesso a dados
- `OpenRouter` e o provedor atual de IA
- `WhatsApp Cloud API` e o canal oficial de mensagens (quando reativado)
- `auth proprio` permanece ativo por enquanto
- **deploy manual**: o projeto Vercel (`orzai`) NAO esta conectado ao GitHub para
  deploy automatico. Todo `git push` precisa ser seguido de `vercel --prod`
  manual, e o alias `orzai.vercel.app` precisa ser reapontado apos cada deploy
  (`vercel alias set <url-do-deploy> orzai.vercel.app`)
- `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET` na Vercel estao marcadas como
  `Sensitive` — nunca podem ser lidas de volta via CLI/API, nem por quem as
  criou. Se precisar delas, pegar direto no painel do Supabase
- existe uma copia local do projeto em `C:\Users\ander\Downloads\orzai-crm-base`,
  sem `.git` conectado ao GitHub, sem `.vercel` e sem credenciais reais —
  serve como copia de seguranca editavel isoladamente

---

## 3. Stack ativa

- `Next.js`, `React`, `TypeScript`, `Tailwind CSS`, `shadcn/ui` local, `Recharts`
- `Prisma`, `PostgreSQL`, `Supabase`
- `OpenRouter` (IA), `WhatsApp Cloud API` (mensageria, inativa no momento)

---

## 4. Estado funcional atual

### CRM principal

- login, dashboard, leads, tarefas, listas de leads, customizacoes,
  administracao de usuarios, auditoria administrativa
- funil de vendas com 5 etapas (`Novo Lead`, `Em Conversa`, `Aguardando Retorno`,
  `Negociacao`, `Matriculado`) — reduzido de 10 etapas nesta sessao; `Perdido` e
  `Reativar Futuramente` foram absorvidos por `Aguardando Retorno` (o funil novo
  nao tem mais um estado de "lead perdido" permanente)
- score preditivo hibrido (`LLM + regras`), persistido por lead
- tema claro "Belart amigavel" disponivel via toggle sol/lua no topo (dark
  continua sendo o padrao)
- app otimizado para mobile: sidebar comeca fechada em telas pequenas e fecha
  sozinha ao trocar de tela, tela de login nao esprema mais botoes, tela de
  Atendimento nao usa mais uma barra de icones fixa de 68px que sobrava
  praticamente sem espaco util em celulares

### Agendamento Inteligente (Fase 1 — concluida)

- `Department.businessHours` (JSON) guarda o horario de funcionamento por
  setor; sem configuracao, usa padrao seg-sex 9h-18h
- `lib/server/ai/tools/calendar.ts`: `checkAvailability`/`bookAppointment`
  saíram do mock e consultam/gravam `Appointment` de verdade. O setor e
  resolvido automaticamente a partir do `leadId` — a IA so precisa saber o lead
- tools registradas em `CRM_TOOLS`/`executeTool` (`lib/ai-tools.ts`) — o
  assistente de IA ja sabe usa-las
- ao agendar, um lembrete e agendado ~2h antes via `scheduleFollowUp`
  (`lib/server/reengagement.ts`)
- card "Agenda de hoje" no Dashboard (`/api/crm/appointments/today`)

Pendente (Fase 2, nao iniciada):
- nada dispara a mensagem de lembrete ainda — falta um cron real (padrao
  `/api/jobs/check-sla`) que rode periodicamente e envie via WhatsApp
- nao existe tela de configuracao do horario de funcionamento (hoje so editavel
  direto no banco)
- cliente final agendando sozinho pelo WhatsApp (sem humano no meio) exige um
  pipeline de resposta automatica no webhook que ainda nao existe

### Landing page e demonstracao publica

- `features/landing/components/landing-page.tsx`: CTA trocado de linguagem de
  login ("Acessar") para aquisicao ("Testar demonstracao" / "Falar com
  vendas"), copy reescrita com dor especifica, secao "Demonstracoes", selo LGPD
- `/demo`: sandbox publico sem login, com Dashboard e Kanban reais rodando
  sobre dados ficticios locais (`seedState()`), nada e persistido
- botao "Falar com vendas" ainda usa placeholder `SEU_NUMERO_AQUI` (wa.me) em
  `landing-page.tsx` e `app/demo/page.tsx` — falta o numero comercial real

### Mensagens

- persistem no banco: `conversations`, `messages`, `messageWorkspaces`,
  `messageCampaigns`
- inbox com dois modos: "Lista + conversa" (classico) e "Modo guiado" (uma
  conversa por vez, com respostas sugeridas — pensado para quem esta comecando)
- **sem integracao ativa de WhatsApp configurada no momento** (ver 10.2)

### Disparos Oficiais

- campanhas em massa usam `MessageCampaignRecord`, modos `free_text`,
  `meta_template` e `hybrid`, respeitando a janela de atendimento de 24h

### IA

- assistente comercial, analise de lead, analise de conversa, propostas de
  acao com aprovacao do usuario (Level 3 — nunca executa sozinho, so propoe)
- fonte atual: `OpenRouter` (`source: "openrouter"` ou `fallback`)
- `lib/server/ai/insights.ts` (`ConversationInsight`) e
  `lib/server/reengagement.ts` (`ScheduledFollowUp`) tem tabela no banco mas
  **nenhuma rota ativa chama essas funcoes ainda** — codigo pronto, sem gatilho

---

## 5. Seguranca

- as credenciais padrao de seed (`admin/admin123`, `manager/manager123`,
  `sales/sales123`, `viewer/viewer123`) foram **desativadas** em producao —
  estavam ativas com acesso total e senha obvia. Usuarios reais nao foram
  afetados
- dados de leads e conversas tratados conforme LGPD (mensagem explicita na
  landing page)

---

## 6. Integracoes realmente ativas

### 6.1 Supabase
Banco principal do CRM e do modulo de mensagens.
Arquivos centrais: `lib/server/crm/prisma-store.ts`, `prisma/schema.prisma`,
`middleware.ts`.

### 6.2 OpenRouter
Provedor de IA. Arquivo central: `lib/ai.ts`. Tools em `lib/ai-tools.ts` e
`lib/server/ai/`.

### 6.3 WhatsApp Cloud API
Trilha oficial de mensagens — **sem integracao ativa configurada no momento**.
Arquivos centrais: `lib/server/messages-client.ts`,
`app/api/webhooks/meta/route.ts`.

---

## 7. Variaveis de ambiente importantes

Ver `.env.example` para a lista completa. Pontos que mudaram nesta sessao:
- `APP_URL=https://orzai.vercel.app` ja configurado em Production na Vercel
- `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET` sao `Sensitive` na Vercel (nao
  recuperaveis via CLI/API — pegar a senha real no painel do Supabase se
  precisar reconfigurar)
- identificadores Meta confirmados para a conta real (quando a integracao for
  reativada): App Meta `1250488524805073`, WABA ID `188150857713468`,
  Phone Number ID `200460319811155`, Conta WhatsApp `Base CRM`

---

## 8. Como subir o projeto

### Local
```bash
npm install
npm run dev
npm run lint
npm run test
```

### Deploy (manual — sem integracao GitHub-Vercel)
```bash
git push origin main
npx vercel --prod --yes
npx vercel alias set <url-do-deploy-novo> orzai.vercel.app
```

### Prisma / migrations aplicadas via script (Supabase `db push` e instavel neste ambiente)
```bash
npm run db:apply:coexistence
npm run db:apply:predictive-score
npm run db:apply:funnel-simplification
npm run db:apply:appointment
npm run db:apply:followup
```
Scripts equivalentes tambem existem para Department e ChannelIntegration
(`scripts/apply-department-schema.js`, `scripts/apply-channel-integration-schema.js`).

---

## 9. O que ja foi validado nesta sessao

- funil simplificado (10 -> 5 etapas) migrado em producao, com apenas 1 lead
  real no banco no momento da migracao
- schema de Setores/Departamentos (`Department`, `UserDepartmentRole` etc.) e
  de Canal (`ChannelIntegration`) aplicados em producao — corrigiam um bug real
  que quebrava o login (`Lead.departmentId` inexistente no banco)
- Agendamento Inteligente Fase 1 testado direto no banco de producao
  (criacao/consulta de `Appointment` e `ScheduledFollowUp`), dados de teste
  removidos depois
- landing page + `/demo` verificados em preview, sem erros de console
- otimizacao mobile verificada de 320px a 1440px em todas as telas do CRM
  (Dashboard, Leads, Inbox, Analytics, Disparos, Admin, Configuracoes, Tarefas,
  Listas, dialogos de lead)
- `npm run lint` e `npm run test` aprovados apos cada bloco de mudanca

---

## 10. Pendencias reais no estado atual

### 10.1 WhatsApp — sem integracao ativa
Confirmado pelo usuario nesta sessao: **nao ha nenhuma informacao de WhatsApp
vinculada ao projeto que esteja funcionando atualmente**. Precisa ser
investigado do zero antes de reativar (credenciais, token, webhook, numero).
Isso e considerado a prioridade numero 1 do produto — sem WhatsApp, o CRM nao
cumpre a promessa central da landing page ("CRM com WhatsApp nativo").

### 10.2 Numero comercial (WhatsApp de vendas)
Os botoes "Falar com vendas" (landing page e `/demo`) usam placeholder
`SEU_NUMERO_AQUI`. Falta o numero real pra esses CTAs funcionarem.

### 10.3 Dominio proprio + e-mail empresarial
Ainda nao comprado. Recomendacao ja discutida: Registro.br (`.com.br`) ou
Cloudflare Registrar (`.com`); Zoho Mail (plano gratuito) pro e-mail.

### 10.4 Conexao GitHub <-> Vercel para deploy automatico
Tentativa falhou por falta de permissao do app da Vercel no repositorio
GitHub (`Lauxzera/orzai-project`). Precisa ser autorizado pelo usuario via
painel da Vercel (Project Settings -> Git -> Connect Git Repository).
Ate la, todo deploy e manual (ver secao 8).

### 10.5 Agendamento Inteligente — Fase 2
Ver secao 4. Falta o cron que dispara o lembrete de verdade, a tela de
configuracao de horario de funcionamento, e o pipeline de agendamento
autonomo direto na conversa de WhatsApp com o cliente final.

### 10.6 IA em ambiente de producao
Falta confirmar com chave valida: resposta real do OpenRouter sem cair em
fallback, custo e modelo final por fluxo.

---

## 11. Sobras legadas conhecidas

- `app/api/webhooks/evolution/[[...event]]/route.ts` — rota de tombamento, nao
  e integracao ativa
- `middleware.ts` — aviso de deprecacao do Next pra migrar a `proxy`, nao
  bloqueante
- scripts Python de uso unico (rebrand/refactor) e HTMLs estaticos legados ja
  foram removidos do repositorio nesta sessao

---

## 12. O que um novo modelo deve assumir ao entrar no projeto

- o produto se chama `Orzai`, deploy em `https://orzai.vercel.app`
- `Supabase + Prisma` e a base oficial de dados; `OpenRouter` e a base oficial
  de IA
- `WhatsApp Cloud API` e o canal oficial de mensagens, mas esta **inativo**
  hoje — nao presumir que esta funcionando
- deploy e **manual** (`vercel --prod` + realiasing), nao ha CI/CD automatico
- credenciais padrao de seed foram desativadas — nao reintroduzir usuarios
  `admin/admin123` etc. como conveniencia de teste; se precisar logar como
  admin pra teste, criar um usuario temporario e apagar depois
- `STATUS-PROJETO.md` deve ser mantido curto, atual e orientado a operacao

Antes de mexer em qualquer integracao, conferir `.env.local`, `package.json`,
`prisma/schema.prisma`, `lib/ai.ts`, `lib/server/messages-client.ts`.

---

## 13. Proximo passo recomendado

Ordem de prioridade combinada com o usuario:
1. Investigar e reativar o WhatsApp (motivo central do produto)
2. Conseguir o numero comercial real pros CTAs de vendas
3. Dominio proprio + e-mail empresarial
4. Conectar GitHub <-> Vercel (deploy automatico)
5. Fase 2 do Agendamento Inteligente (cron de lembrete, config de horario)
6. Polimento de UX restante (onboarding, tooltips, painel de lead progressivo)

---

## 14. Registro mais recente

### Atualizacao 2026-07-10 — Sessao grande: rename, funil, agendamento, mobile, seguranca

- projeto Vercel renomeado de `belart-crm-portavel-20260625-175520` para
  `orzai`; URL antiga removida, `orzai.vercel.app` e a unica URL de producao
- corrigido bug que quebrava build havia dias: `date-fns` nao declarado no
  `package.json` (so existia por acaso no `node_modules` local)
- funil de vendas simplificado de 10 para 5 etapas, migrado em producao
- dividia tecnica de schema corrigida: `Department`, `ChannelIntegration`,
  `ScheduledFollowUp` e `Appointment` nao tinham migration aplicada — isso
  quebrava o login em producao (`Lead.departmentId` inexistente); corrigido
- landing page reescrita como pagina de vendas de verdade (CTA de aquisicao,
  copy com dor especifica, secao Demonstracoes) + sandbox publico `/demo`
- Agendamento Inteligente Fase 1 implementado (ver secao 4)
- otimizacao mobile em todo o app (sidebar, login, tela de Atendimento que
  tinha uma barra de 68px desperdicando quase 20% da tela)
- seguranca: credenciais padrao de seed desativadas em producao
- criada copia local do projeto em `orzai-crm-base`, isolada de
  GitHub/Vercel/credenciais reais
- `IDEIAS.md` criado com backlog de ideias de produto (extensoes do CRM e
  automacoes fora do escopo do CRM)

### Historico anterior a 2026-07-10

Ver commits do git para o historico detalhado. Resumo do que ja estava
consolidado antes desta sessao: Supabase como persistencia principal,
OpenRouter como IA principal, WhatsApp Cloud API como canal oficial (na epoca
funcionando via configuracao manual da Cloud API), Disparos Oficiais com modo
hibrido e selecao de template Meta por mouse, inbox estabilizado contra
mistura de mensagens entre conversas, score preditivo hibrido persistido por
lead.

---

## 15. Regra de manutencao deste arquivo

Sempre atualizar este documento quando houver:
- mudanca de arquitetura
- troca de provedor
- conclusao de fase relevante
- nova pendencia de lancamento
- validacao funcional importante

Evitar adicionar:
- historico extenso de tentativa
- diarios longos de depuracao
- fases antigas que ja nao governam mais o projeto
