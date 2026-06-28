# Sistema de Disparos (Campanhas) via WhatsApp — Documentação Técnica Completa

**Criado em:** 24/06/2026
**Status:** Implementado e funcional para leads dentro da janela de 24h. Fallback para leads fora da janela depende de configuração manual (template aprovado na Meta) ainda não concluída.

Este documento reúne tudo que foi discutido e implementado sobre o sistema de disparos em massa do CRM: arquitetura, o problema de conformidade com a Meta que foi corrigido, a solução técnica aplicada, custos, e o passo a passo de configuração que ainda depende de ação humana.

---

## 1. Visão geral

O CRM tem uma funcionalidade de "Disparos Oficiais" (campanhas de mensagem em massa via WhatsApp Cloud API) usada para enviar uma mesma mensagem, com variáveis simples (`{nome}`, `{curso}`, etc.), para uma lista de leads selecionados.

**Componentes envolvidos:**
- UI: `components/crm/broadcasts-view.tsx` (workspace de disparos) e `features/messages/components/campaign-manager-panel.tsx` (painel de gestão de campanhas).
- Criação de campanha: `app/api/messages/campaigns/route.ts`.
- Disparo (envio efetivo): `app/api/messages/campaigns/dispatch/route.ts`.
- Persistência: `lib/server/message-campaign-store.ts` — modelo Prisma `MessageCampaignRecord` (tabela real em produção, ver `prisma/schema.prisma:253-269`).
- Envio à Meta: `lib/server/messages-client.ts` (`sendMessageViaAPI`, e agora também `sendTemplateMessageViaAPI`).

### Como o disparo acontece hoje (mecanismo de polling client-side)

O disparo **não é um cron de servidor automático**. Funciona assim:
1. Um admin/gestor abre a tela de Disparos Oficiais e inicia a campanha (status `running`).
2. Enquanto essa aba estiver aberta e visível no navegador, `broadcasts-view.tsx` chama `POST /api/messages/campaigns/dispatch` a cada **15 segundos** (constante `CAMPAIGN_DISPATCH_MS`, ajustada de 10s para 15s na Fase 4 de otimização).
3. Cada chamada processa **um único destinatário pendente** da campanha ativa mais antiga.
4. Se a aba for fechada ou o navegador minimizado, o disparo **trava** até alguém reabrir a tela (há uma guarda de `pageVisible` que impede o polling rodar em segundo plano).

**Limitação conhecida, não corrigida nesta rodada**: essa dependência de aba aberta é uma fragilidade arquitetural. Não foi resolvida porque migrar para um cron de servidor colidiria com o limite do plano Hobby da Vercel (cron só pode rodar 1x/dia, incompatível com o ritmo de disparo de "1 a cada 15s"). Ficou registrado como item para revisitar se a equipe migrar para o plano Pro da Vercel.

---

## 2. O problema identificado: desalinhamento com o modelo oficial da Meta

### 2.1 A regra da Meta (WhatsApp Business Platform)

A API do WhatsApp Business segmenta mensagens em duas situações:

1. **Dentro da janela de atendimento de 24h**: se o lead/cliente enviou uma mensagem nas últimas 24 horas, a empresa pode responder com **texto livre** (qualquer conteúdo, sem aprovação prévia). Essa janela é chamada de **"Service window"** e é resetada a cada nova mensagem do cliente.
2. **Fora da janela de 24h**: se o cliente não escreveu há mais de 24h, a empresa só pode **iniciar** uma nova conversa usando um **Message Template** pré-aprovado pela Meta (também chamado HSM — Highly Structured Message). Texto livre é **rejeitado** pela Graph API com o erro:
   > `(#131047) Message failed to send because more than 24 hours have passed since the customer last replied to this number.`
   (código de erro **131047**, às vezes acompanhado do subcode **2018278**)

### 2.2 O que o código fazia antes da correção

- O disparo de campanha chamava `sendMessageViaAPI` (texto livre) **incondicionalmente**, para todo destinatário, sem nunca checar quando foi a última mensagem do lead.
- Não havia nenhuma referência a `"type": "template"` em lugar nenhum do código — o sistema simplesmente não sabia enviar templates.
- Quando a Meta rejeitava (erro 131047) um envio para lead frio, o sistema tratava isso como uma falha genérica idêntica a qualquer outro erro (token inválido, número errado, rate limit). Após **3 falhas consecutivas**, a campanha era **pausada automaticamente** — sem nenhuma indicação de que o motivo real era a janela de 24h fechada.
- **Conclusão prática**: campanhas de reengajamento (o uso mais comum de "disparo em massa") falhavam silenciosamente para qualquer lead que não tivesse respondido recentemente — que é justamente o público-alvo típico desse tipo de campanha.

### 2.3 Evidências de que isso nunca foi validado em produção

- Limite de 80 destinatários por campanha com mensagem "campanhas de teste aceitam no máximo 80 leads por vez" — indicativo de que a própria equipe tratava a funcionalidade como piloto.
- Um único commit de implementação (`3556819`), sem nenhuma correção/iteração posterior.
- Nenhuma documentação interna mencionava templates, HSM, ou janela de 24h.
- Zero testes automatizados cobrindo esse fluxo (corrigido nesta rodada).

---

## 3. A correção implementada

### 3.1 Detecção da janela de serviço — `lib/server/whatsapp-service-window.ts` (novo arquivo)

```ts
export const META_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinServiceWindow(conversation, now = Date.now()): boolean {
  if (!conversation) return false;
  if (conversation.lastMessageDirection !== "inbound") return false;
  if (!conversation.lastMessageAt) return false;
  const lastMessageAt = new Date(conversation.lastMessageAt).getTime();
  if (!Number.isFinite(lastMessageAt)) return false;
  return now - lastMessageAt < META_SERVICE_WINDOW_MS;
}

export function isServiceWindowClosedError(error): boolean {
  // identifica code 131047 ou subcode 2018278 retornados pela Graph API
}
```

Lógica: só considera "dentro da janela" se a **última mensagem da conversa foi do lead** (`inbound`) e ocorreu há menos de 24h. Se a última mensagem foi da própria empresa (`outbound`), considera fora da janela mesmo que recente — porque a regra da Meta é especificamente sobre a última mensagem **do cliente**.

Cobertura de testes em `lib/server/whatsapp-service-window.test.ts` (9 casos): sem conversa, última mensagem outbound, dentro da janela, fora da janela, limite exato (estrito — exatamente 24h conta como fechado), detecção do código de erro.

### 3.2 Erro estruturado da Graph API — `lib/server/messages-client.ts`

Antes, qualquer erro da Meta virava um `Error` genérico só com `.message` (texto), perdendo o código numérico estruturado que a Meta retorna. Criada a classe:

```ts
export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
}
```

`metaFetchJson` (função interna que faz toda chamada à Graph API) agora lança `MetaApiError` preservando `data.error.code` e `data.error.error_subcode` — permitindo ao código chamador diferenciar "janela fechada" de qualquer outro tipo de falha, de forma robusta (por código numérico, não por regex na mensagem em inglês, que poderia mudar).

### 3.3 Envio de template — `sendTemplateMessageViaAPI` em `lib/server/messages-client.ts`

```ts
export type SendTemplateInput = {
  phone: string;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
  conversationId?: string;
};

export async function sendTemplateMessageViaAPI(config, input): Promise<Message> {
  // monta payload Graph API:
  // { messaging_product: "whatsapp", to, type: "template",
  //   template: { name, language: { code }, components? } }
}
```

Suporta `bodyParams` (variáveis posicionais `{{1}}`, `{{2}}`...) no design, mas **o fluxo de disparo de campanha hoje não os utiliza** — chama sem parâmetros (ver seção 5, limitações).

### 3.4 Lógica de decisão no disparo — `app/api/messages/campaigns/dispatch/route.ts`

Fluxo por destinatário, a cada tick de 15s:

1. Busca a conversa do lead (`findConversationByLeadId`) e calcula `isWithinServiceWindow(conversation)`.
2. **Dentro da janela** → envia texto livre via `sendMessageViaAPI` (comportamento histórico, inalterado).
3. **Fora da janela + template de fallback configurado** (`WHATSAPP_FALLBACK_TEMPLATE_NAME` setado) → envia via `sendTemplateMessageViaAPI`.
4. **Fora da janela + sem template configurado** → marca o destinatário como **`skipped`** (não `failed`) com a mensagem:
   > "Fora da janela de atendimento de 24h e nenhum template de reengajamento configurado (WHATSAPP_FALLBACK_TEMPLATE_NAME)."
   Não tenta a chamada à Graph API (evita custo e erro previsível).
5. **Defesa extra**: se mesmo assim a Meta retornar erro 131047/2018278 (ex.: pequena divergência entre o cálculo local e o relógio da Meta), o catch identifica via `isServiceWindowClosedError` e também marca como `skipped` em vez de `failed` — e **não conta para o auto-pause de 3 falhas consecutivas** (já que não é uma falha real do sistema, é uma regra de negócio esperada).

### 3.5 Visibilidade na UI — `features/messages/components/campaign-manager-panel.tsx`

Antes, o painel só mostrava contadores agregados ("5 ignorados", "2 falhas") sem explicar o motivo. Agora, agrupa os motivos únicos de `skipped`/`failed` com contagem:
```
3x — Fora da janela de atendimento de 24h e nenhum template de reengajamento configurado (...)
1x — Lead não encontrado — pode ter sido excluído.
```

### 3.6 Por que não houve migração de banco de dados

`MessageCampaignRecord` é uma tabela Prisma real em produção (`prisma/schema.prisma:253`). Dado o histórico recente de incidente ao alterar infraestrutura de banco (ver seção sobre a Fase 3 do plano de otimização, em outro documento), a decisão de design foi **evitar qualquer novo campo na tabela**. Por isso:
- O template de fallback é **global**, configurado via variável de ambiente (`WHATSAPP_FALLBACK_TEMPLATE_NAME`), não por campanha individual armazenada no banco.
- Se no futuro for necessário ter templates diferentes por campanha (ex.: campanha A usa template X, campanha B usa template Y), **isso vai exigir uma migração de schema** — que deve ser planejada com calma e confirmação explícita antes de aplicar em produção, seguindo o mesmo cuidado adotado nesta sessão.

---

## 4. Variáveis de ambiente

Adicionadas ao `.env.example`:

```bash
# Disparo de campanhas fora da janela de atendimento de 24h (opcional).
# Sem isso configurado, leads que nao responderam ha mais de 24h sao
# marcados como "pulados" em vez de falhar contra a Graph API.
# O template precisa existir e estar APROVADO no Meta Business Manager
# antes de ser usado aqui.
WHATSAPP_FALLBACK_TEMPLATE_NAME=
WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE=pt_BR
```

| Variável | Obrigatória? | Efeito se vazia |
|---|---|---|
| `WHATSAPP_FALLBACK_TEMPLATE_NAME` | Não | Leads fora da janela de 24h são marcados como "pulados" em vez de receber mensagem |
| `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE` | Não (padrão `pt_BR`) | Precisa bater exatamente com o idioma escolhido na criação do template na Meta (`pt_BR` ≠ `pt_PT`) |

**Importante**: o código continua **100% funcional sem essas variáveis configuradas** — o sistema simplesmente não envia nada pra quem está fora da janela, em vez de tentar e falhar. Configurá-las é o que "liga" o reengajamento de leads frios.

---

## 5. Limitações conhecidas (escopo desta correção)

1. **Sem suporte a variáveis no template de fallback**: `sendTemplateMessageViaAPI` é chamada sem `bodyParams` no fluxo de campanha. O template criado na Meta deve ser **texto fixo, sem `{{1}}` ou `{{nome}}`** — se tiver variável, a Meta vai rejeitar o envio por falta de parâmetro.
2. **Um único template global**: não há seleção de template por campanha — é sempre o mesmo template (`WHATSAPP_FALLBACK_TEMPLATE_NAME`) para qualquer campanha que precise de fallback.
3. **Dependência de aba aberta no navegador**: o disparo não roda como cron de servidor (ver seção 1).
4. **Sem suporte a Header de mídia, Footer ou Buttons no template de fallback**: a chamada atual só envia o `body`. Se o template aprovado tiver imagem no header, por exemplo, o código precisaria ser estendido para enviar o componente de header também.

---

## 6. Modelo de mensageria da Meta — categorias de template

| Categoria | Quando usar | Aprovação | Desconto por volume |
|---|---|---|---|
| **Marketing** | Promoções, reengajamento, campanhas — **categoria recomendada para o nosso caso de uso** | Revisão mais rígida | Não |
| **Utility** | Mensagens transacionais (confirmação de pedido, status) | Mais fácil | Sim |
| **Authentication** | Códigos OTP/verificação | — | Sim |
| **Service** | Texto livre dentro da janela de 24h (resposta normal do atendimento) | Não precisa de template | Grátis |

---

## 7. Passo a passo: criar o template no Meta Business Manager

1. Acesse [business.facebook.com](https://business.facebook.com) → **WhatsApp Manager** (ou [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates)).
2. Selecione a WABA (conta WhatsApp Business) vinculada ao número usado pelo CRM.
3. **Criar modelo** → escolha a categoria **Marketing** (para reengajamento).
4. **Nome**: minúsculas, sem espaço, use `_` (ex.: `reengajamento_geral`) — esse nome exato vai em `WHATSAPP_FALLBACK_TEMPLATE_NAME`.
5. **Idioma**: escolha **Portuguese (BR)** → corresponde a `pt_BR` no código. Se escolher outro, ajuste `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE` para bater exatamente.
6. **Corpo (Body)**: texto **fixo, sem variáveis** (ver limitação na seção 5). Exemplo:
   > "Olá! Notamos que faz um tempo desde nossa última conversa sobre os cursos do Base CRM. Ainda tem interesse? Responda essa mensagem que a gente continua o atendimento 😊"
7. **Header/Footer/Buttons**: opcionais, deixe vazio por enquanto (o código atual não envia esses componentes).
8. **Enviar para aprovação**. Aprovação costuma levar de minutos a 24h. Status: `Pending` → `Approved` ou `Rejected` (se rejeitado, a Meta explica o motivo — geralmente tom promocional agressivo).
9. Após aprovado: configurar `WHATSAPP_FALLBACK_TEMPLATE_NAME` e `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE` na Vercel e fazer redeploy.

---

## 8. Sintaxe de variáveis em templates (referência geral, não usada no fallback atual)

A Meta aceita dois formatos:

- **Numeradas** (clássico): `{{1}}`, `{{2}}`, `{{3}}`... — posicionais, mapeadas por ordem no array de parâmetros enviado pela API.
- **Nomeadas** (mais legível para múltiplas variáveis): `{{nome}}`, `{{curso}}` — minúsculas, `snake_case`, sem espaço/acento. Na criação do template, cada variável nomeada pede um valor de exemplo (usado na revisão de aprovação).

Onde cada componente aceita variável:

| Componente | Aceita variável? |
|---|---|
| Body | Sim — `{{1}}` ou `{{nome}}` |
| Header | Só se for texto; mídia (imagem/vídeo/documento) não usa variável de texto |
| Footer | Não — sempre fixo |
| Buttons | Botão de URL pode ter variável no final do link; quick-reply e telefone não |

---

## 9. Custo dos templates (Brasil, 2026)

A Meta migrou de cobrança por conversa para **cobrança por mensagem entregue**, em vigor desde julho/2025. Você só paga por mensagens efetivamente **entregues** — falhas, rejeições e os destinatários marcados como `skipped` pelo nosso sistema **não geram custo**.

| Categoria | Custo aproximado por mensagem entregue | Desconto por volume? |
|---|---|---|
| **Marketing** | R$ 0,31 – R$ 0,38 | ❌ Não |
| **Authentication** | R$ 0,15 – R$ 0,19 | ✅ Sim |
| **Utility** | R$ 0,04 – R$ 0,05 | ✅ Sim |
| **Service** (texto livre, dentro da janela de 24h) | **R$ 0,00** | — |

**Variação de custo — pontos de atenção**:
- Categoria é o que mais varia o custo: Marketing custa **~8x mais** que Utility.
- Conversas iniciadas pelo cliente continuam sempre grátis (Service), independente de volume.
- Volume **não** reduz o custo de Marketing (diferente de Utility/Authentication, que ficam mais baratas com volume mensal maior).
- Faturamento de contas brasileiras ainda em **USD** — cobrança nativa em BRL está prevista para o 2º semestre de 2026, segundo cronograma da Meta.

**Estimativa prática**: disparo para 500 leads fora da janela de 24h, categoria Marketing: `500 × ~R$0,35 ≈ R$175` por disparo completo (considerando só os que de fato são entregues).

**Observação de confiabilidade dos números**: os valores acima vêm de fontes de mercado (blogs especializados em WhatsApp Business API), não foi possível extrair os números exatos diretamente da página oficial da Meta (renderizada via JavaScript, não acessível por fetch estático). **Confirme o valor real aplicado à sua conta em Meta Business Manager → Faturamento (Billing) antes de rodar uma campanha grande.**

Fontes consultadas:
- [WhatsApp Business API Pricing in Brazil 2026 — Message Central](https://www.messagecentral.com/blog/whatsapp-business-api-pricing-brazil)
- [Pricing on the WhatsApp Business Platform — Meta Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [WhatsApp Business API Pricing in 2026 — Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026)
- [WhatsApp Business API Pricing 2026: Complete Cost Guide with Country Rates — Flowcall](https://flowcall.co/blog/whatsapp-business-api-pricing-2026)
- [Template fundamentals — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)

---

## 10. Checklist de ativação completa (pendente do lado humano)

- [ ] Criar template no Meta Business Manager (categoria Marketing, sem variáveis, idioma `pt_BR`)
- [ ] Aguardar aprovação da Meta
- [ ] Configurar `WHATSAPP_FALLBACK_TEMPLATE_NAME` na Vercel com o nome exato do template
- [ ] Confirmar `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE` bate com o idioma escolhido
- [ ] Redeploy
- [ ] Testar uma campanha pequena com leads conhecidos fora da janela de 24h, confirmar que a mensagem chega
- [ ] Confirmar o custo real por mensagem no Billing da Meta antes de campanhas grandes

## 11. Possíveis evoluções futuras (não implementadas)

- Suporte a variáveis no template de fallback (preencher `{{nome}}` com o nome do lead).
- Seleção de template por campanha (exigiria migração de schema no `MessageCampaignRecord`).
- Suporte a Header de mídia/Buttons no template.
- Mover o disparo de polling client-side para cron de servidor (depende de upgrade do plano Vercel para suportar frequência maior que 1x/dia).
