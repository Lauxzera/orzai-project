# Plano de Desenvolvimento — API CRM ↔ n8n

**Criado em:** 24/06/2026
**Status:** Planejamento — nenhuma implementação iniciada
**Decisão de arquitetura:** API CRUD genérica para o CRM. Toda a lógica de decisão/resposta do atendimento automatizado fica nos workflows do n8n — não reaproveita o sistema de IA interno (`lib/ai-tools.ts`, `/api/ai/assistant`), que continua servindo só o assistente nativo do CRM.

---

## Modelo de acesso e escopo do n8n (decidido em 24/06/2026)

| Recurso | Leitura | Escrita | Observação |
|---|---|---|---|
| Leads (Kanban) | **Total** — todos os leads, todos os status, todos os responsáveis | `status_funil`, `observacoes`, `objecao_principal`, `nome`, `telefone`, `whatsapp`, `email`, `curso_de_interesse` | Sem escrita em `responsavel` (ver linha de handoff abaixo) |
| Exclusão/arquivamento de lead | — | **Não permitido** | Fora do escopo do bot em qualquer cenário |
| Conversas/mensagens | Total (qualquer conversa) | Enviar mensagem (texto/mídia) como bot | Mensagem grava `senderType: "bot"` (Fase 0.5) |
| Handoff (repasse pra equipe) | — | Aciona sempre a roleta (`round-robin`) | **Bot não escolhe o vendedor.** Se o payload de handoff vier com um `responsavel` sugerido, a API ignora o campo e segue a rotação normal — evita que o bot fure a distribuição justa |
| Usuários/admin/auditoria | — | — | Fora do escopo — sem esse escopo na chave de API |
| Token Meta / canal WhatsApp | — | — | Nunca exposto decriptado; bot sempre passa pelos endpoints do CRM, nunca fala direto com a Graph API |

**Implicação da visão total do Kanban:** como o n8n agora vê a carteira completa (não só leads órfãos), a Fase 1.5 (rate limiting) e a Fase 4 (observabilidade/auditoria) passam de "recomendado" para **obrigatório antes de produção** — qualquer chave de API com esse alcance precisa de log de uso (`lastUsedAt` não é suficiente; vale registrar volume de leitura por período) e de um plano de revogação testado (Fase 5).

---

## Fase 0 — Pré-requisitos internos (bloqueante)

Sem isso, ligar o n8n quebra a roleta e deixa o sistema sem rastreabilidade. Tudo aqui é pré-condição para a Fase 1.

| # | Item | Por quê | Onde toca |
|---|---|---|---|
| 0.1 | Criar identidade própria para o bot (`User` dedicado, não chave anônima) | Toda ação precisa virar `LeadHistory` atribuível; sem isso não há auditoria de quem fez o quê | `prisma/schema.prisma` (possível flag `isBot` ou role nova), seed |
| 0.2 | Ajustar `isAutomaticWhatsappInboxLead` / `shouldAutoAssignLeadWithRoundRobin` | Hoje a heurística desliga a roleta quando existe `actor` — se o bot chamar com seu próprio `actor`, a roleta para de disparar | `lib/server/crm/prisma-store.ts:391-402` |
| 0.3 | Decidir se o bot entra no pool `isAgent` da roleta | Recomendação: **não** — bot intercepta antes da roleta, handoff explícito dispara a roleta pros humanos depois | `lib/server/round-robin.ts` |
| 0.4 | Estado "em atendimento pelo bot" na conversa | Evita bot e humano responderem a mesma mensagem ao mesmo tempo | `lib/messages.ts` (`ConversationServiceStatus` ou novo campo no `workspace`), `message-workspace-store.ts` |
| 0.5 | Atribuição de remetente nas mensagens (`senderType`/`senderId`) | Hoje `MessageRecord` não diz quem enviou um outbound — sem isso não dá pra medir "resolvido pelo bot vs precisou de humano" | `prisma/schema.prisma` (`MessageRecord`), `messages-prisma-store.ts`, `messages-file-store.ts` |

**Decisão pendente do usuário:** itens 0.1 e 0.5 exigem migração de schema em produção (Supabase). Como na correção de vídeo evitamos migração, aqui não tem como evitar — são campos novos genuinamente necessários. Vou pedir confirmação explícita antes de aplicar `db push`/migração quando chegar a hora.

---

## Fase 1 — Autenticação e segurança da API

| # | Item | Detalhe |
|---|---|---|
| 1.1 | Modelo `ApiKey` no Prisma | `id`, `partnerName` (ex. "n8n-atendimento"), `keyHash` (não criptografado — é comparação, não recuperação, então hash tipo SHA-256/HMAC é o padrão certo, não o AES-256-GCM usado pros tokens Meta), `scopes[]`, `active`, `createdAt`, `lastUsedAt`, `revokedAt` |
| 1.2 | `getApiKeyUser()` | Função paralela a `getSessionUser()` — lê header `Authorization: Bearer <key>`, valida hash, retorna um "ator" equivalente ao bot da Fase 0.1 |
| 1.3 | Escopos mínimos | `conversations:read` (todas), `conversations:write` (enviar mensagem), `leads:read` (todo o Kanban), `leads:write` (campos da tabela de escopo acima), `handoff:write` (só aciona roleta, não aceita escolha manual de vendedor). Sem escopo de admin, sem acesso a token Meta decriptado |
| 1.4 | Tela de gestão de chaves | Reaproveitar o padrão de `admin-users-view.tsx`: ADMIN gera/revoga a chave do n8n, vê `lastUsedAt` e volume de uso |
| 1.5 | Rate limiting por chave | **Obrigatório** (não opcional) dado o acesso de leitura total ao Kanban — evita que um workflow com bug martele a API, exponha a carteira inteira em um vazamento por excesso de chamadas, ou estoure o rate limit da Cloud API da Meta somando bot + humanos |

**Nota sobre CORS:** como o n8n chama a API server-to-server (não é uma página rodando no navegador do usuário), CORS **não é relevante aqui** — só importaria se algum dia um frontend de terceiro no browser precisasse chamar essa API diretamente. Removendo esse item da lista de bloqueadores para esta integração específica.

---

## Fase 2 — Endpoints CRUD (`/api/v1/...`)

Primeira vez que o projeto usa versionamento de rota — isolar do `/api/*` interno que serve o próprio frontend (esse pode mudar livremente, o `/v1` é contrato estável pro n8n).

| Endpoint | Método | Função |
|---|---|---|
| `/api/v1/conversations` | GET | Lista conversas (todas, com filtros por status/responsável/atualização — visão completa do Kanban definida acima) |
| `/api/v1/conversations/:id/messages` | GET | Histórico da thread |
| `/api/v1/conversations/:id/messages` | POST | Enviar mensagem (texto/mídia) como bot — reaproveita `sendMessageViaAPI`/`sendMediaViaAPI` já existentes, grava `senderType: "bot"` (Fase 0.5) |
| `/api/v1/leads` | GET | Lista/busca leads (por telefone, status, responsável) — leitura total do funil |
| `/api/v1/leads/:id` | PATCH | Atualiza `status_funil`, `observacoes`, `objecao_principal`, dados de contato e `curso_de_interesse`. Não aceita `responsavel` (campo ignorado se enviado) nem exclusão/arquivamento |
| `/api/v1/conversations/:id/handoff` | POST | Ação explícita de repasse: marca o estado da Fase 0.4 como concluído e dispara a roleta normal — **não aceita vendedor sugerido**, sempre respeita a rotação. Grava `LeadHistory` "Repassado da automação para equipe comercial" |

Todos com validação `zod` (hoje só ~12 de 37 rotas têm isso — esses serão 100% desde o início).

---

## Fase 3 — Webhook de saída (CRM → n8n)

Hoje o CRM só recebe webhooks (Meta/Evolution). Para o n8n responder "antes de repassar", ele precisa ser avisado no instante em que a mensagem chega — senão sobra só polling, que é lento.

| # | Item | Detalhe |
|---|---|---|
| 3.1 | Decisão de escopo | Começar simples: uma única URL de destino via variável de ambiente (`N8N_WEBHOOK_URL`), não uma tabela genérica de "subscriptions" — generalizar depois se aparecer um segundo parceiro |
| 3.2 | Assinatura HMAC | Mesmo padrão já usado para validar webhook da Meta (`verifyMetaWebhookSignature` em `messages-client.ts`) — aqui invertido: o CRM assina o payload que envia |
| 3.3 | Disparo | Hook no mesmo ponto onde a Fase 0 já vai interceptar a mensagem inbound antes da roleta (`lib/server/lead-auto-assign.ts` ou ponto equivalente em `messages-prisma-store.ts`) |
| 3.4 | Resiliência | Retry com backoff se o n8n estiver fora; não pode travar o processamento do webhook da Meta esperando resposta do n8n |

---

## Fase 4 — Observabilidade

- Métrica simples: % de conversas resolvidas só pelo bot vs que precisaram de handoff (vem de graça da Fase 0.5)
- Alerta/fallback: se a chamada do n8n falhar ou nunca enviar `handoff`, lead não pode ficar preso — aplicar um SLA próprio mais curto pra conversa "em atendimento pelo bot" (reaproveitar `lib/server/sla.ts`, já testado, como base)

---

## Fase 5 — Hardening final antes de produção

- Testar revogação de chave (n8n perde acesso imediatamente, humanos não são afetados)
- Confirmar onde o n8n roda (self-hosted vs n8n.cloud) — muda exposição de dado pessoal (LGPD); se for cloud de terceiro, considerar mascarar campos não essenciais no payload do webhook de saída
- Carga: simular volume real de mensagens simultâneas pelo bot

---

## Ordem recomendada de execução

1. **Fase 0** (pré-requisitos internos) — sem isso nada do resto é seguro
2. **Fase 1** (auth) + **Fase 2** (endpoints) em paralelo, já que a Fase 2 depende da Fase 1 só no middleware de auth
3. **Fase 3** (webhook de saída) — é o que de fato "liga" o n8n ao fluxo em tempo real
4. **Fase 4 e 5** — observabilidade e hardening, podem entrar incrementalmente depois do primeiro fluxo ponta a ponta funcionando

Cada fase deve fechar com `npm run lint` limpo e, onde fizer sentido, testes via Vitest (mesmo padrão usado na roleta/SLA).
