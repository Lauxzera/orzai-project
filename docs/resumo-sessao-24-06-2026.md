# Resumo da Sessão — 24/06/2026

Documento-resumo de uma sessão longa de trabalho no CRM Base CRM, criado para dar contexto a outra IA/sessão que continue a partir daqui. Não é um transcript literal — é uma síntese organizada por tema, com decisões tomadas, código alterado (com paths) e o que ficou pendente.

---

## 1. Correções no inbox/WhatsApp

### 1.1 Envio/recebimento de vídeo falhando
**Causa:** a Meta Cloud API rejeitava vídeo enviado com `type: "document"` no payload (era preciso `type: "video"`).
**Correção:** `lib/server/messages-client.ts` (`sendMediaViaAPI`) passou a detectar `video/*` e enviar `type: "video"` corretamente; mantido como `document` no banco (sem migração de schema) usando `mimeType` no front pra decidir o player. Seletor de arquivo (`message-composer.tsx`) passou a aceitar `video/*`. Webhooks de entrada (`messages-file-store.ts`, `messages-prisma-store.ts`) passaram a reconhecer `message.video`.

### 1.2 Cockpit mostrando "lead não vinculado" incorretamente
**Causa:** o cockpit do atendimento buscava o lead só por `conversation.leadId`, sem o fallback por telefone que a lista lateral já usava — dava a impressão de "duas versões da UI".
**Correção:** unificada a lógica em `features/messages/hooks/use-messages-view.ts` (`lead` agora usa o mesmo fallback `leadId → telefone`).

### 1.3 PDF com falha de entrega ("Falha na entrega")
**Diagnóstico:** mensagem foi aceita pela API mas falhou na entrega assíncrona (webhook de status). Duas hipóteses levantadas: nome de arquivo muito longo/com caracteres repetidos, ou — mais provável — **janela de atendimento de 24h** (ver seção 4). Não foi corrigido um bug específico aqui; o `statusError` já é capturado e exibido via tooltip no `MessageBubble` (`conversation-thread.tsx`).

---

## 2. Roleta de leads (round-robin)

- **Disparo no instante do webhook**: antes só rodava quando alguém abria o inbox (polling). Criado `lib/server/lead-auto-assign.ts` (`ensureAutomaticLeadForWhatsappContact`), chamado direto em `messages-prisma-store.ts`/`messages-file-store.ts` ao processar mensagem inbound.
- **Visibilidade na administração**: novo `GET /api/admin/round-robin` + card "Roleta de atendimento" em `admin-users-view.tsx` — mostra fila, próximo da vez, carga por atendente.
- **Testes**: projeto não tinha framework de teste — instalado **Vitest** (`npm run test`, `vitest.config.ts`). Cobertura inicial em `round-robin.test.ts` e `sla.test.ts` (lógica de SLA extraída para `lib/server/sla.ts`).

---

## 3. Limpeza de código morto (IA)

Diagnóstico mostrou que o "enriquecimento automático de conversa" e "refresh de score preditivo" — que pesavam o sistema — **já tinham sido desativados** (rotas retornando `410 Gone`). Removido o código órfão: `app/api/ai/conversation-enrich/`, `app/api/ai/predictive-score/refresh/`, `lib/server/lead-predictive-score.ts`, e ~160 linhas de funções/schemas exclusivos em `lib/ai.ts`. O fluxo vivo (`/api/ai/lead-analysis`, análise de conversa) não foi tocado.

**Gap identificado e não resolvido**: não há métricas de uso real da IA (quantos cliques em "Analisar", taxa de aceite de sugestões). Ficou registrado como recomendação futura, não implementado.

---

## 4. Sistema de disparos (campanhas) x modelo oficial da Meta

**Diagnóstico inicial**: o sistema de campanhas só enviava texto livre, sem nenhuma checagem da **janela de atendimento de 24h** da Meta (regra: só pode mandar texto livre pra quem respondeu nas últimas 24h; fora disso, é obrigatório usar um **Message Template aprovado**). Disparo pra lead frio falhava (erro 131047) e era tratado como falha genérica.

**Correção aplicada**:
- `lib/server/whatsapp-service-window.ts` (novo) — `isWithinServiceWindow()` e `isServiceWindowClosedError()`, com testes em `whatsapp-service-window.test.ts`.
- `lib/server/messages-client.ts` — novo `MetaApiError` (preserva `code`/`subcode` da Meta) e `sendTemplateMessageViaAPI()`.
- `app/api/messages/campaigns/dispatch/route.ts` — checa a janela antes de enviar; dentro da janela manda texto livre (como antes); fora da janela, usa template (se `WHATSAPP_FALLBACK_TEMPLATE_NAME` configurado) ou marca como **"pulado"** com motivo claro (não como falha).
- `features/messages/components/campaign-manager-panel.tsx` — mostra o motivo agrupado de cada "pulado"/"falha".
- **Decisão de design**: evitado schema change no Prisma (campanhas são `MessageCampaignRecord`, tabela real em produção) — o template de fallback é **global via variável de ambiente**, não por campanha. Limitação atual: não suporta variáveis no corpo do template (`{{nome}}`) — só texto fixo.

**Pendente do lado do usuário**: criar e aprovar um template no Meta Business Manager (categoria recomendada: **Marketing**), depois configurar `WHATSAPP_FALLBACK_TEMPLATE_NAME`/`WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE` na Vercel.

**Custo dos templates (Brasil, 2026, estimativas de mercado — confirmar no Billing real da Meta)**:

| Categoria | Custo por mensagem entregue | Desconto por volume |
|---|---|---|
| Marketing | R$ 0,31 – R$ 0,38 | Não |
| Authentication | R$ 0,15 – R$ 0,19 | Sim |
| Utility | R$ 0,04 – R$ 0,05 | Sim |
| Service (texto livre, 24h) | Grátis | — |

**Sintaxe de variáveis nos templates**: Meta aceita numeradas (`{{1}}`, `{{2}}`) ou nomeadas (`{{nome}}`, minúsculo/snake_case). Footer não aceita variável; Header só se for texto; Buttons só URL pode ter variável no final do link. **Importante**: crie o template inicial **sem nenhuma variável**, já que o código hoje não preenche parâmetros.

---

## 5. Plano de otimização técnica (Fases 1-7)

Levantamento amplo de pontos de performance/manutenibilidade, organizado em fases por risco:

| Fase | Status | O que era |
|---|---|---|
| 1 | ✅ Concluída | `lib/generated/prisma/` removido do git (+ `postinstall`), N+1 corrigido no SLA, dynamic import de recharts/lamejs (descoberto que já estava OK) |
| 2 | ✅ Concluída | Logger estruturado (`lib/server/logger.ts`) aplicado em todas as rotas de negócio (webhooks, crons, IA, mensagens, analytics, instalação WhatsApp) |
| 3 | ⚠️ **Revertida — incidente de produção** | Migrar pool de conexões pra modo Transaction do Supabase pooler. **Quebrou o login em produção** (variável de ambiente mal configurada). Revertido via `git revert` + restauração manual das env vars na Vercel usando a string antiga recuperada do `.env.local` local. **Fica pausada** até reavaliação cuidadosa. |
| 4 | ✅ Concluída | Redução de polling fora do inbox ativo (notificação global 12s→25s, analytics 60s→180s, dispatch de campanha 10s→15s). Conversa ativa (3s) e lista online (6s) mantidos intactos por decisão explícita. |
| 5 | ❌ **Revertida a pedido** | Cache de mídia do WhatsApp via Supabase Storage (TTL 72h, limite 35MB). Implementado e testado, mas **revertido sem commit** porque dependia de criar bucket manual no Supabase — usuário pediu pra só mexer em código que não precise de configuração manual externa. |
| 6 | Não iniciada | Paginação do `/api/crm/state` — recomendado só quando a base de leads crescer e justificar o esforço. |
| 7 | Política contínua | Refatorar arquivos grandes (`use-messages-view.ts` ~2000 linhas, `app/page.tsx` ~1750, `lib/ai.ts`) só quando forem tocados por outro motivo, não como projeto isolado. |

### Lição do incidente da Fase 3 (importante para próximas sessões)
- Mudar `DATABASE_URL`/`DIRECT_URL` em produção é **alto risco** — qualquer erro de configuração quebra login e tudo que depende do banco.
- O projeto usa `@prisma/adapter-pg` com `pg.Pool` manual (não o motor nativo do Prisma) — `?pgbouncer=true` na connection string **não tem efeito** nessa arquitetura.
- Vercel **não tem histórico de variáveis de ambiente** — se errar e sobrescrever, a única forma de recuperar é achar a string antiga em outro lugar (no caso, salva em `.env.local` local, que nunca vai pro git).
- **Antes de aplicar qualquer mudança de infraestrutura em produção, confirmar explicitamente com o usuário e ter um plano de rollback claro.**

---

## 6. Outras correções pontuais

- **Bug de encoding (mojibake)**: 26 strings em `app/page.tsx` e `use-messages-view.ts` com "ã/í/ó/ç" corrompidos em "?" (ex.: "N?o foi poss?vel..."). Corrigidas todas; `scripts/check-encoding.js` (já existia no projeto) confirma zero problemas agora.

---

## 7. Planejamento de API para integração com n8n

Documentos completos em `docs/planejamento-implementação-api.md` (substitui `docs/plano-api-n8n.md`, que ainda não foi removido). Resumo:

- **Decisão de arquitetura**: API CRUD genérica pro CRM; toda lógica de decisão do atendimento automatizado fica nos workflows do n8n (não reaproveita o sistema de IA interno).
- **Modelo de acesso decidido**: visão total do Kanban (não só leads órfãos); bot pode editar status/observações/dados de contato, mas nunca escolhe o vendedor no handoff (sempre aciona a roleta normal).
- **Plano de fases** (0 a 5): identidade própria pro bot, correção da interação com a roleta, estado "em atendimento pelo bot", atribuição de remetente nas mensagens, API key + escopos, endpoints versionados `/api/v1/...`, webhook de saída assinado (HMAC).
- **Nada disso foi implementado ainda** — é só planejamento.

---

## 8. Estado atual do repositório

- Branch `main`, todos os commits até aqui já enviados ao GitHub, exceto:
  - Possíveis arquivos de documentação pendentes (`docs/plano-api-n8n.md` redundante).
  - Este próprio resumo.
- Testes: `npm run test` (Vitest) — cobertura em roleta, SLA, janela de serviço do WhatsApp.
- Type-check: `npm run lint` — limpo na última verificação.
- **Produção estável** após o incidente da Fase 3 ser revertido e as variáveis de ambiente corrigidas manualmente.

---

## 9. Pendências abertas (para continuar)

1. Criar template aprovado no Meta Business Manager + configurar `WHATSAPP_FALLBACK_TEMPLATE_NAME` na Vercel, pra ativar de fato o reengajamento de leads frios.
2. Decidir se vale suportar variáveis (`{{nome}}`) no template de fallback — hoje não suporta.
3. Reavaliar a Fase 3 (pool de conexões) com mais cautela, investigando a real compatibilidade do `@prisma/adapter-pg` com PgBouncer em modo transaction antes de tentar de novo.
4. Decidir se/quando revisitar a Fase 5 (cache de mídia) — código já existe num estado anterior (revertido), pode ser refeito quando topar criar o bucket no Supabase.
5. Instrumentar uso real da IA (cliques, aceite de sugestões) pra responder se vale manter/expandir.
6. Limpar documentos de planejamento duplicados (`docs/plano-api-n8n.md` vs `docs/planejamento-implementação-api.md`).
