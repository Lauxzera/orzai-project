# Status do Projeto — CRM Base CRM

**Última atualização:** 25/06/2026
**Branch:** `main`
**Deploy:** Vercel (auto-deploy no push para `main`)
**Banco:** PostgreSQL via Supabase (região sa-east-1)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.4 (App Router, webpack) |
| Linguagem | TypeScript (strict) |
| ORM | Prisma 7.8 + `@prisma/adapter-pg` |
| Banco | PostgreSQL (Supabase) |
| Autenticação | Session cookie JWT (`jose`), sem suporte a API key/machine-to-machine |
| WhatsApp | Meta Cloud API v23.0 (webhooks + envio) |
| Deploy | Vercel (Node.js serverless) |

---

## Funcionalidades implementadas

### CRM Principal
- Gestão completa de leads (cadastro, edição, arquivamento)
- Funil de vendas com 10 etapas (`FunnelStatus`)
- Score preditivo de leads (via OpenRouter)
- Tarefas e follow-up por lead
- Histórico de atendimento por lead
- Listas de leads personalizadas
- Dashboard e analytics
- Importação de leads via arquivo
- Customizações: cursos, origens, responsáveis, métodos de captação

### Inbox de Mensagens (WhatsApp)
- Listagem de conversas em tempo real (polling)
- Thread de mensagens por contato
- Compositor de mensagens (texto, imagem, vídeo, áudio, documento)
- Player de vídeo inline na thread (envio e recebimento via Meta Cloud API)
- Gravação de áudio direto no compositor (conversão MP3 via lamejs)
- Criação automática de lead no instante do webhook (não depende mais de abrir o inbox)
- Vinculação conversa ↔ lead por número de telefone (mesma regra de fallback usada no cockpit e na lista)
- Workspace de "Disparos Oficiais" (campanhas em massa via `campaign-manager-panel`)
- Disparos oficiais alinhados à janela de 24h da Meta: texto livre dentro da janela, template aprovado fora da janela
- Templates Meta podem ser selecionados por campanha no CRM; quando `META_WABA_ID` está configurado, a UI lista templates aprovados da WABA para seleção com mouse
- Envio por template suporta parâmetros posicionais `{{1}}`, `{{2}}`, etc., mapeados para campos do lead
- Modo híbrido disponível: texto livre quando permitido e template aprovado quando a conversa está fora da janela de atendimento
- Coexistência é diretriz obrigatória: nenhuma alteração deve migrar o número, derrubar WhatsApp Business no celular ou desconectar WhatsApp Web
- Status de entrega de mensagem (`sent`, `delivered`, `read`, `failed`)
- Captura de falha silenciosa de envio (status `failed` do webhook Meta)
- Campanhas de mensagens em massa
- Workspace por conversa: prioridade, status de serviço, tags, nota fixada
- Registro de tentativas de atendimento (WhatsApp, ligação, proposta, follow-up, matrícula)
- Botão "Ligar via WhatsApp" — abre `wa.me/{phone}` e registra tentativa no histórico
- Painel de carga por atendente (`TeamWorkloadBar`) com badges de SLA expirado

### Controle de Equipe
- Roles: ADMIN, MANAGER, SALES, VIEWER
- Flag `isAgent` independente do role — define quem entra na roleta de atendimento
- Gestão de usuários pelo admin (criar, editar, bloquear, excluir)
- Auditoria de ações administrativas (`AdminAuditRecord`)

### Roleta de Leads (round-robin)
- Novos leads via WhatsApp são distribuídos automaticamente entre agentes (`isAgent: true`, `active: true`)
- Disparo no instante do webhook da Meta (`lib/server/lead-auto-assign.ts`), não mais dependente de polling do inbox
- Distribuição sequencial e circular via `RoundRobinState` no banco
- Fallback para `Equipe Comercial` se não houver agentes ativos
- Painel de visibilidade em Administração → Usuários: ordem da fila, próximo da vez e carga atual por atendente (`GET /api/admin/round-robin`)
- Cobertura por testes automatizados (`lib/server/round-robin.test.ts`)

### SLA de Atendimento
- Leads `Novo Lead` sem atendimento por mais de 2h retornam para a fila (`Equipe Comercial`)
- Verificação automática via Vercel Cron — **atualmente 1x/dia (`0 12 * * *`)**, reduzido do schedule original de 30 minutos por limitação do plano Hobby da Vercel. Pendente avaliar upgrade de plano ou gatilho alternativo.
- Disparo manual disponível via POST para ADMIN/MANAGER
- Histórico de liberação registrado no lead (`SLA_EXPIRADO`)
- Visual: badge laranja com ícone de relógio no chip do atendente na barra de equipe
- Lógica extraída para `lib/server/sla.ts` e coberta por testes automatizados (`lib/server/sla.test.ts`)

---

## Qualidade e testes

- Framework de testes adicionado ao projeto: **Vitest** (`npm run test`, config em `vitest.config.ts`)
- Cobertura inicial: rotação da roleta (`round-robin.test.ts`) e liberação por SLA (`sla.test.ts`)
- Type-check (`npm run lint`) permanece limpo após cada entrega

---

## Configuração de produção (variáveis de ambiente obrigatórias)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (Supabase) |
| `AUTH_SECRET` | Secret para autenticação/sessão do CRM |
| `WHATSAPP_PROVIDER` | Deve ser `"meta"` |
| `META_ACCESS_TOKEN` | Token operacional da Meta Cloud API |
| `META_PHONE_NUMBER_ID` | ID do número de telefone na Meta |
| `META_WABA_ID` | ID da conta WhatsApp Business usada para listar templates Meta aprovados |
| `META_WEBHOOK_VERIFY_TOKEN` | Token de verificação do webhook |
| `META_APP_SECRET` | App Secret usado na integração Meta |
| `WHATSAPP_FALLBACK_TEMPLATE_NAME` | Template global opcional para leads fora da janela de 24h |
| `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE` | Idioma do template global, normalmente `pt_BR` |
| `CRON_SECRET` | Secret para autenticação do cron da Vercel (`/api/jobs/check-sla`) |
| `OPENROUTER_API_KEY` | Chave para score preditivo de leads (opcional) |

Identificadores Meta confirmados no projeto:

| Item | Valor |
|---|---|
| App Meta | `1250488524805073` |
| Config ID Embedded Signup | `2041214766787970` |
| Phone Number ID | `200460319811155` |
| WABA ID confirmado | `188150857713468` |
| Conta WhatsApp | `Base CRM` |

---

## Histórico de entregas recentes

| Data | Commit | Descrição |
|---|---|---|
| 25/06/2026 | `916c384` | Lista templates aprovados da Meta por `META_WABA_ID` e permite seleção por mouse nas campanhas |
| 25/06/2026 | `c52b043` | Adiciona envio de campanhas com template Meta, modo híbrido, janela de 24h e documentação da arquitetura |
| 24/06/2026 | `c0d7f27` | Adiciona Vitest e cobre roleta + liberação por SLA com testes |
| 24/06/2026 | `fdacf39` | Visibilidade da roleta na Administração (fila, próximo, carga por atendente) |
| 24/06/2026 | `0528f15` | Roleta passa a disparar no instante do webhook, não só no polling do inbox |
| 24/06/2026 | `a3985da` | Corrige cockpit do atendimento mostrando lead "não vinculado" quando já existia |
| 24/06/2026 | `afe5487` | Corrige envio/recebimento de vídeo no WhatsApp (Meta rejeitava por tipo incorreto) |
| 23/06/2026 | `3556819` | Refino do workflow de inbox + workspace de Disparos Oficiais (broadcasts) |
| 23/06/2026 | `476cd30` | Cron de SLA ajustado para 1x/dia (limite do plano Hobby da Vercel) |
| 17/06/2026 | `555a164` | Sistema de roleta de leads + SLA + botão de chamada WhatsApp |
| 17/06/2026 | `a756f05` | Correção de 3 bugs identificados em code review |
| ~Jun/2026 | `d557d66` | Refinamento do workflow do inbox de atendimento |
| ~Jun/2026 | `807ec42` | Otimização de carregamento do inbox e redução de polling |
| ~Jun/2026 | `33f4f2a` | Remoção do bloco de respostas rápidas do compositor |
| ~Jun/2026 | `185282c` | Flag `isAgent` para controle granular de atendentes |
| ~Jun/2026 | `7a3e5c0` | Gravação de áudio no compositor (MP3 via lamejs) |
| ~Jun/2026 | `24aabf9` | Captura de status `failed` do webhook Meta |

---

## Próximos passos sugeridos

- Avaliar upgrade do plano Vercel (ou gatilho alternativo) para voltar o cron de SLA a rodar a cada 30min
- Confirmar no painel da Vercel que o deploy do commit `916c384` finalizou com `META_WABA_ID=188150857713468` em Production
- Testar no CRM se a aba de Disparos lista templates aprovados da conta `Base CRM`
- Se a lista não aparecer, validar se o token atual possui permissão `whatsapp_business_management`
- Rodar um disparo controlado com poucos leads usando template aprovado e conferir status/rotas registradas
- Monitorar distribuições da roleta em produção usando o novo painel em Administração → Usuários
- Avaliar ajuste do tempo de SLA (atualmente 2h via constante `LEAD_SLA_HOURS`)
- Considerar painel de SLA: relatório de leads liberados por período
- Planejar integração com n8n para atendimento automatizado: requer identidade própria para o bot, estado de "em atendimento pelo bot" na conversa, atribuição de remetente nas mensagens, webhook de saída assinado (HMAC) e API key dedicada com escopo mínimo — diagnóstico completo feito em 24/06/2026, implementação ainda não iniciada
