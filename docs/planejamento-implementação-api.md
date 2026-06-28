# Planejamento de Implementação — API CRM ↔ Automação (n8n)

**Criado em:** 24/06/2026
**Status:** Planejamento em aberto — nenhuma implementação iniciada. Documento vivo: continue as próximas conversas a partir daqui até decidirmos viabilidade e darmos início ao desenvolvimento.

---

## 1. Contexto e motivação

A equipe está desenvolvendo uma automação de atendimento via **n8n** que precisa:

1. Ter acesso ao painel Kanban do CRM (leads, status do funil, responsáveis);
2. Responder mensagens de WhatsApp automaticamente, antes de repassar a conversa para um vendedor humano finalizar a venda;
3. Operar com permissões equivalentes a "alguém da equipe de atendimento" — ou seja, não é um integrador de leitura passiva, é um ator que **lê e escreve** no CRM como se fosse um atendente.

Esse pedido surgiu depois de uma sequência de correções recentes no CRM (ver seção 6) que deixaram a base mais sólida para suportar esse tipo de integração — em especial a correção da roleta de distribuição de leads, que precisa continuar funcionando corretamente mesmo com um "atendente automático" no meio do fluxo.

---

## 2. Diagnóstico do estado atual da API (antes desta iniciativa)

Levantamento feito em 24/06/2026 sobre o que já existe no CRM:

| Necessidade para integração externa | Estado encontrado |
|---|---|
| Autenticação machine-to-machine (API key / OAuth) | **Inexistente.** Único mecanismo é cookie de sessão JWT (`jose`) para usuário humano logado no navegador. O único "Bearer token" do sistema é o `CRON_SECRET`, hardcoded para o cron interno do Vercel chamar `/api/jobs/check-sla` — não é genérico. |
| Versionamento de rota (`/api/v1/...`) | Inexistente — todas as rotas em `/api/*` sem prefixo de versão. |
| CORS | Inexistente (mas também não é necessário para este caso específico — ver seção 5). |
| Rate limiting / throttling | Inexistente em todo o projeto, inclusive no login. |
| Validação de input consistente (zod) | Parcial — só ~12 de 37 rotas usam zod; o resto faz parsing manual. |
| Documentação de contrato (OpenAPI/Swagger) | Inexistente. |
| Webhooks de saída (CRM → terceiro) | Inexistente — o CRM só **recebe** webhooks (Meta, Evolution API), nunca dispara um. |
| Cofre para credenciais sensíveis | **Existe e é reaproveitável:** `lib/server/encryption.ts` (AES-256-GCM) já guarda os tokens do WhatsApp/Meta com criptografia real. Para API keys de parceiro, o padrão correto é hash (comparação), não criptografia (recuperação) — são propósitos diferentes. |

Conclusão do diagnóstico: **toda a infraestrutura de "API para terceiros" precisa ser construída do zero.** O único componente pronto e diretamente reaproveitável é o cofre de criptografia.

---

## 3. Decisão de arquitetura

**Pergunta resolvida:** o n8n deveria reaproveitar o sistema de IA interno do CRM (`lib/ai-tools.ts`, `/api/ai/assistant`, que já tem 3 níveis: contexto nativo, tool-use, e propostas com aprovação) ou ter sua própria lógica de decisão consumindo uma API CRUD genérica?

**Decisão:** **API CRUD genérica.** Toda a lógica de decisão/resposta do atendimento automatizado fica nos workflows do n8n. O CRM não tenta "pensar" pelo n8n — só expõe dados e ações de forma segura e auditável. O sistema de IA interno continua existindo em paralelo, sem relação com essa integração.

**Implicação:** isso é mais simples de construir (não precisamos reconciliar dois "cérebros" de decisão), mas significa que **não há camada de aprovação humana automática no meio** — diferente do "Nível 3" do assistente interno, que sempre espera um humano aprovar antes de agir. O n8n decide e age sozinho dentro do escopo de permissões que lhe damos. Isso eleva a importância de definir esse escopo com precisão (seção 4) e de ter rede de segurança (handoff obrigatório via SLA próprio, seção 7.4).

---

## 4. Modelo de acesso e escopo do n8n (decidido em 24/06/2026)

| Recurso | Leitura | Escrita | Observação |
|---|---|---|---|
| **Leads (Kanban)** | **Total** — todos os leads, todos os status, todos os responsáveis | `status_funil`, `observacoes`, `objecao_principal`, `nome`, `telefone`, `whatsapp`, `email`, `curso_de_interesse` | Sem escrita em `responsavel` |
| **Exclusão/arquivamento de lead** | — | **Não permitido** | Fora do escopo do bot em qualquer cenário |
| **Conversas/mensagens** | Total (qualquer conversa) | Enviar mensagem (texto/mídia) como bot | Mensagem grava `senderType: "bot"` |
| **Handoff (repasse pra equipe)** | — | Aciona sempre a roleta (round-robin) | **Bot não escolhe o vendedor.** Se o payload de handoff vier com um `responsavel` sugerido, a API ignora o campo e segue a rotação normal — preserva a distribuição justa |
| **Usuários/admin/auditoria** | — | — | Fora do escopo — chave de API não tem esse escopo |
| **Token Meta / canal WhatsApp** | — | — | Nunca exposto decriptado; bot sempre passa pelos endpoints do CRM, nunca fala direto com a Graph API |

**Decisões explícitas tomadas durante o planejamento:**
- "Acesso ao painel Kanban" = visão **completa** do funil (todos os leads, todos os responsáveis), não só leads órfãos. Isso foi um ajuste de escopo deliberado — a primeira proposta era mais restrita (só leads sem responsável), mas a equipe optou por acesso total porque o bot pode precisar responder sobre negociações já em curso com vendedores humanos.
- Campos editáveis pelo bot: status do funil, observações/objeção principal, e dados de contato/curso de interesse — não inclui troca de responsável.
- Handoff sempre via roleta automática, nunca escolha manual pelo bot.

**Implicação de segurança da visão total do Kanban:** como o n8n vê a carteira completa (não só leads órfãos), rate limiting (4.1) e auditoria/observabilidade (seção 7) deixam de ser "recomendado" e passam a ser **obrigatórios antes de produção** — uma chave de API com esse alcance de leitura precisa de log de volume de uso e de um plano de revogação testado.

---

## 5. Plano de fases

### Fase 0 — Pré-requisitos internos (bloqueante)

Sem isso, ligar o n8n quebra a roleta corrigida recentemente e deixa o sistema sem rastreabilidade de quem fez o quê.

| # | Item | Por quê | Onde toca |
|---|---|---|---|
| 0.1 | Criar identidade própria para o bot (`User` dedicado, não chave anônima) | Toda ação precisa virar `LeadHistory` atribuível; sem isso não há auditoria | `prisma/schema.prisma` (flag `isBot` ou role nova), seed |
| 0.2 | Ajustar `isAutomaticWhatsappInboxLead` / `shouldAutoAssignLeadWithRoundRobin` | Hoje a heurística desliga a roleta quando existe `actor` — se o bot chamar com seu próprio `actor`, a roleta para de disparar | `lib/server/crm/prisma-store.ts:391-402` |
| 0.3 | Decidir se o bot entra no pool `isAgent` da roleta | Recomendação: **não** — bot intercepta antes da roleta, handoff explícito dispara a roleta pros humanos depois | `lib/server/round-robin.ts` |
| 0.4 | Estado "em atendimento pelo bot" na conversa | Evita bot e humano responderem a mesma mensagem ao mesmo tempo | `lib/messages.ts` (`ConversationServiceStatus` ou campo novo no `workspace`), `message-workspace-store.ts` |
| 0.5 | Atribuição de remetente nas mensagens (`senderType`/`senderId`) | Hoje `MessageRecord` não diz quem enviou um outbound — sem isso não dá pra medir "resolvido pelo bot vs precisou de humano" | `prisma/schema.prisma` (`MessageRecord`), `messages-prisma-store.ts`, `messages-file-store.ts` |

**Pendência:** itens 0.1 e 0.5 exigem migração de schema em produção (Supabase). Confirmação explícita do usuário será pedida antes de aplicar `db push`/migração quando chegar a hora.

### Fase 1 — Autenticação e segurança da API

| # | Item | Detalhe |
|---|---|---|
| 1.1 | Modelo `ApiKey` no Prisma | `id`, `partnerName`, `keyHash` (hash — não criptografia, é comparação, não recuperação), `scopes[]`, `active`, `createdAt`, `lastUsedAt`, `revokedAt` |
| 1.2 | `getApiKeyUser()` | Paralelo a `getSessionUser()` — lê `Authorization: Bearer <key>`, valida hash, retorna o ator-bot da Fase 0.1 |
| 1.3 | Escopos | `conversations:read` (todas), `conversations:write`, `leads:read` (todo o Kanban), `leads:write` (campos da seção 4), `handoff:write` (só aciona roleta). Sem escopo admin, sem token Meta decriptado |
| 1.4 | Tela de gestão de chaves | Reaproveitar padrão de `admin-users-view.tsx`: ADMIN gera/revoga, vê `lastUsedAt` e volume de uso |
| 1.5 | Rate limiting por chave | **Obrigatório** dado o acesso de leitura total ao Kanban |

**Nota sobre CORS:** não relevante para este caso — n8n chama a API server-to-server, não do navegador. Só importaria se um frontend de terceiro no browser precisasse chamar essa API diretamente.

### Fase 2 — Endpoints CRUD (`/api/v1/...`)

Primeiro uso de versionamento de rota no projeto — isola do `/api/*` interno que serve o próprio frontend (que pode mudar livremente; `/v1` é contrato estável pro n8n).

| Endpoint | Método | Função |
|---|---|---|
| `/api/v1/conversations` | GET | Lista conversas (todas, com filtros por status/responsável/atualização) |
| `/api/v1/conversations/:id/messages` | GET | Histórico da thread |
| `/api/v1/conversations/:id/messages` | POST | Enviar mensagem (texto/mídia) como bot — reaproveita `sendMessageViaAPI`/`sendMediaViaAPI`, grava `senderType: "bot"` |
| `/api/v1/leads` | GET | Lista/busca leads (telefone, status, responsável) — leitura total do funil |
| `/api/v1/leads/:id` | PATCH | Atualiza campos da seção 4. Ignora `responsavel` se enviado; não permite exclusão/arquivamento |
| `/api/v1/conversations/:id/handoff` | POST | Repasse explícito: marca o estado da Fase 0.4 como concluído, dispara a roleta normal. Não aceita vendedor sugerido. Grava `LeadHistory` "Repassado da automação para equipe comercial" |

Todos com validação `zod` desde o início (hoje só ~12 de 37 rotas internas têm isso).

### Fase 3 — Webhook de saída (CRM → n8n)

| # | Item | Detalhe |
|---|---|---|
| 3.1 | Escopo inicial | Uma única URL via variável de ambiente (`N8N_WEBHOOK_URL`) — não uma tabela genérica de "subscriptions" ainda; generalizar só se aparecer um segundo parceiro |
| 3.2 | Assinatura HMAC | Mesmo padrão usado para validar webhook da Meta (`verifyMetaWebhookSignature` em `messages-client.ts`), invertido: o CRM assina o que envia |
| 3.3 | Ponto de disparo | No mesmo lugar onde a Fase 0 intercepta a mensagem inbound antes da roleta (`lib/server/lead-auto-assign.ts` / `messages-prisma-store.ts`) |
| 3.4 | Resiliência | Retry com backoff se o n8n estiver fora; não pode travar o processamento do webhook da Meta esperando resposta do n8n |

### Fase 4 — Observabilidade

- Métrica: % de conversas resolvidas só pelo bot vs que precisaram de handoff (decorre da Fase 0.5)
- Fallback: se o n8n falhar ou nunca chamar `handoff`, o lead não pode ficar preso — aplicar SLA próprio mais curto para conversa "em atendimento pelo bot" (reaproveitar `lib/server/sla.ts`, já testado)
- Log de volume de uso por chave de API (decorrente da seção 4 — agora obrigatório)

### Fase 5 — Hardening final antes de produção

- Testar revogação de chave (n8n perde acesso imediatamente, humanos não afetados)
- Confirmar onde o n8n roda (self-hosted vs n8n.cloud) — muda exposição de dado pessoal (LGPD); se cloud de terceiro, considerar mascarar campos não essenciais no payload do webhook de saída
- Simular volume real de mensagens simultâneas pelo bot

### Ordem recomendada de execução

1. **Fase 0** — sem isso nada do resto é seguro
2. **Fase 1 + Fase 2** em paralelo (Fase 2 só depende de Fase 1 no middleware de auth)
3. **Fase 3** — é o que de fato "liga" o n8n ao fluxo em tempo real
4. **Fase 4 e 5** — podem entrar incrementalmente depois do primeiro fluxo ponta a ponta funcionando

Cada fase deve fechar com `npm run lint` limpo e, onde fizer sentido, testes via Vitest (mesmo padrão usado na roleta/SLA).

---

## 6. Contexto recente do CRM relevante para esta decisão

Trabalho feito nas sessões imediatamente anteriores a este planejamento, que criou as condições para considerar essa integração:

- **Correção de envio/recebimento de vídeo no WhatsApp** (`afe5487`) — Meta rejeitava vídeo enviado com `type: "document"`.
- **Correção do cockpit de atendimento** (`a3985da`) — unificou a busca de lead por telefone entre lista e cockpit, eliminando a aparência de "duas versões da UI".
- **Roleta passa a disparar no instante do webhook** (`0528f15`) — antes só rodava quando alguém abria o inbox (polling). Esse é o comportamento que a integração com n8n precisa preservar (Fase 0.2/0.3).
- **Visibilidade da roleta na administração** (`fdacf39`) — painel mostrando fila, próximo da vez e carga por atendente.
- **Testes automatizados introduzidos** (`c0d7f27`) — Vitest cobrindo round-robin e liberação por SLA; primeira vez que o projeto tem testes.

Esses itens são citados aqui porque qualquer trabalho na API precisa **preservar esse comportamento** (especialmente a roleta) e pode **reaproveitar os padrões já estabelecidos** (testes com Vitest, separação `*WithClient` para lógica testável, assinatura HMAC de webhook).

---

## 7. Questões abertas / decisões pendentes

Pontos que ainda precisam de decisão antes ou durante a implementação:

1. **Onde o n8n vai rodar** (self-hosted vs n8n.cloud) — define exigências de LGPD e mascaramento de dados no webhook de saída (Fase 5).
2. **Migração de schema em produção** (Fase 0.1 e 0.5) — precisa de aprovação explícita no momento de aplicar.
3. **Critério de "viabilidade"** — o usuário pediu para usar este documento até "definirmos a viabilidade desse desenvolvimento de fato". Falta definir: o que conta como sinal de viável (ex: custo de infra do n8n, complexidade dos workflows que a equipe de atendimento consegue manter, volume de conversas esperado)?
4. **SLA do bot** — quanto tempo o bot pode "segurar" uma conversa antes de ser forçado a fazer handoff automático, caso não decida sozinho?
5. **Granularidade do rate limiting** (Fase 1.5) — por minuto, por hora, por chave única ou por escopo de operação (leitura vs escrita)?

---

## 8. Status

Nenhuma linha de código desta integração foi escrita. Este documento consolida o diagnóstico, a decisão de arquitetura, o modelo de acesso e o plano de fases discutidos até 24/06/2026. Próximas conversas sobre esta API devem continuar a partir daqui — atualize este arquivo conforme novas decisões forem tomadas, em vez de criar documentos paralelos.
