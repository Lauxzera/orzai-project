# STATUS DO PROJETO - CRM Base CRM

Este arquivo e a ponte oficial de contexto entre modelos de IA e operadores humanos.
Ele descreve apenas o estado atual e operacional do projeto.

Regra deste documento:
- registrar somente o que esta ativo, validado ou realmente pendente
- evitar historico longo de tentativas antigas
- usar o git como historico detalhado de mudancas
- atualizar este arquivo ao concluir qualquer bloco relevante

---

## 1. Resumo executivo

O CRM ja entrou na trilha de lancamento e possui deploy publico ativo.
O estado atual representa a base oficial de operacao, com a Cloud API da Meta em modo coexistencial e o modulo de Disparos Oficiais evoluindo para uso de templates aprovados da Meta.

Arquitetura ativa hoje:
- frontend e backend em `Next.js`
- persistencia principal em `Supabase Postgres` via `Prisma`
- autenticacao atual e `auth proprio do CRM`
- IA ativa via `OpenRouter`
- canal de mensagens em `WhatsApp Cloud API (Meta)`
- WhatsApp operando em modo coexistencial: preservar acesso da equipe ao WhatsApp Business no celular e WhatsApp Web e nao iniciar migracao completa do numero
- projeto continua operando localmente e esta sendo preparado para deploy
- projeto ja possui deploy publico e segue em estabilizacao final

O que NAO e mais trilha ativa:
- `Firebase`
- `Ollama`
- `Gemini`
- `Evolution API` como integracao operacional

---

## 2. Decisoes arquiteturais atuais

Estas decisoes devem ser tratadas como base oficial do projeto:

- `Supabase` e a persistencia principal do CRM
- `Prisma` continua como camada de acesso a dados
- `OpenRouter` e o provedor atual de IA
- `WhatsApp Cloud API` e o canal oficial de mensagens
- o modo de uso do WhatsApp e `coexistencia`; mudancas que possam migrar o numero, derrubar o celular/WhatsApp Web ou trocar o formato da API exigem aprovacao explicita
- `auth proprio` permanece ativo por enquanto
- `Supabase Auth` ainda nao foi adotado
- `Supabase Storage` ainda nao foi adotado
- o projeto ainda pode manter alguns fallbacks locais como contingencia, mas nao como trilha principal

---

## 3. Stack ativa

- `Next.js`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui` local
- `Recharts`
- `Prisma`
- `PostgreSQL`
- `Supabase`
- `OpenRouter`
- `WhatsApp Cloud API`

---

## 4. Estado funcional atual

### CRM principal

Funciona com persistencia remota em `Supabase Postgres`:
- login
- dashboard
- leads
- tarefas
- listas de leads
- customizacoes
- administracao de usuarios
- auditoria administrativa
- cadastro de lead com obrigatoriedade reduzida para `nome + telefone`
- novos leads automaticos ou manuais nao devem mais receber curso pre-preenchido por default; o campo pode permanecer em branco ate confirmacao humana
- score preditivo dos leads foi recalibrado para usar mais sinais reais do cadastro e historico (funil, matricula, completude, frescor, follow-up e intencao registrada), evitando concentracao artificial no mesmo valor
- o score preditivo agora usa modelo hibrido `LLM + regras`, com persistencia de score, confianca, motivos e riscos por lead
- a reavaliacao do score pode acontecer por refresh imediato na analise do lead e por reprocessamento periodico de leads defasados

### Mensagens

Persistem no banco:
- `conversations`
- `messages`
- `messageWorkspaces`
- `messageCampaigns`

Estado do canal:
- backend oficial da Meta ja existe
- inbox oficial ja persiste no banco
- fluxo inicial de `Embedded Signup / Coexistencia` ja comecou a ser implementado
- ainda depende de configuracao final de credenciais e webhook publico para operacao real de producao
- inbox recebeu correcoes recentes para evitar mistura de mensagens ao trocar de conversa
- o carregamento de mensagens do inbox agora reconcilia apenas a thread da conversa ativa, sem reaproveitar mensagens de outros chats durante trocas rapidas de conversa ou refresh em segundo plano
- a troca de conversas do inbox agora usa cache por `conversationId` com `stale-while-revalidate`, reduzindo a espera visual ao reabrir chats recentes sem perder o isolamento entre threads
- esse cache do inbox agora vive em memoria global do modulo com TTL de expiracao apos sair da aba de mensagens, permitindo navegar por outras areas do CRM e voltar sem perder o aquecimento imediato das conversas recentes
- a lista de conversas nao deve mais ser substituida por skeleton durante refresh em segundo plano
- a lista de conversas do inbox agora exibe a ultima interacao com granularidade de minutos e horas no mesmo dia, `ontem` no dia anterior e `dd/MM` para contatos mais antigos
- conversas inbound sem lead vinculado agora devem gerar automaticamente um `Novo Lead`, preenchendo nome e telefone com os dados disponiveis do WhatsApp e completando o restante com defaults operacionais do CRM
- o composer do inbox agora usa fila otimista de envio: a mensagem aparece imediatamente com estado visual de envio, o campo ja fica liberado para o proximo texto e o backend preserva a ordem real de despacho
- o inbox agora tambem faz prefetch leve das conversas mais provaveis, para diminuir a latencia percebida ao alternar entre atendimentos frequentes
- o webhook da Meta agora reconhece eventos de eco do coexistence (`smb_message_echoes`) e persiste respostas feitas pelo WhatsApp Business App / WhatsApp Web como mensagens `outbound` reais da conversa
- com isso, inbox e analytics passam a ter base para reduzir falsos positivos de `conversa sem resposta` quando o atendimento humano aconteceu fora do CRM

### Disparos Oficiais

Estado atual:
- campanhas em massa usam `MessageCampaignRecord` com destinatarios em JSON
- modos disponiveis: `free_text`, `meta_template` e `hybrid`
- dentro da janela de atendimento de 24h, o CRM pode enviar texto livre
- fora da janela de 24h, o CRM deve usar template Meta aprovado ou marcar o destinatario como `skipped`
- o modo `hybrid` usa texto livre quando permitido e template aprovado quando necessario
- o envio por template suporta parametros posicionais `{{1}}`, `{{2}}`, etc., mapeados para campos do lead
- o CRM valida a quantidade de parametros do template selecionado contra as variaveis marcadas na UI
- quando `META_WABA_ID` esta configurado, o CRM lista templates aprovados da conta WhatsApp Business para selecao com mouse
- a digitacao manual do nome do template ainda existe como fallback operacional
- fallback global opcional continua disponivel via `WHATSAPP_FALLBACK_TEMPLATE_NAME` e `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE`

Identificadores Meta confirmados para a conta real:
- App Meta: `1250488524805073`
- Config ID Embedded Signup: `2041214766787970`
- Phone Number ID: `200460319811155`
- WABA ID: `188150857713468`
- Conta WhatsApp: `Base CRM`

### IA

Fluxos ativos:
- assistente comercial
- analise de lead
- analise de conversa
- enriquecimento do CRM guiado por conversa
- propostas de acao com aprovacao do usuario

Fonte atual:
- `OpenRouter`

Comportamento esperado:
- quando a chamada externa funciona, a resposta deve indicar `source: "openrouter"`
- quando falha, o sistema responde por `fallback`
- perguntas factuais sobre o CRM (ex.: total de leads, ativos, arquivados, tarefas pendentes e retornos atrasados) devem responder com numeros deterministicos vindos do CRM, sem inferencia livre da LLM
- a `analise de lead` deve usar como base o cadastro do lead, tarefas, historico recente e conversa real do WhatsApp quando existir
- sinais de compra, riscos comerciais e mensagem sugerida de follow-up devem refletir o conteudo da conversa, nao apenas o cadastro
- o `assistente comercial` nao deve mais usar atalhos de resposta rapida padronizada; a resposta deve sair do contexto completo do CRM e da LLM, com fallback apenas quando necessario
- o score preditivo persistido do lead deve prevalecer sobre formula fixa local quando a analise hibrida ja tiver rodado para aquele contexto

---

## 5. Integracoes realmente ativas

### 5.1 Supabase

Uso atual:
- banco principal do CRM
- banco principal do modulo de mensagens
- suporte SSR/client ja presente no codigo

Arquivos centrais:
- [lib/supabase/shared.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\supabase\shared.ts)
- [lib/supabase/client.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\supabase\client.ts)
- [lib/supabase/server.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\supabase\server.ts)
- [lib/supabase/service.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\supabase\service.ts)
- [lib/supabase/middleware.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\supabase\middleware.ts)
- [middleware.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\middleware.ts)
- [prisma/schema.prisma](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\prisma\schema.prisma)

### 5.2 OpenRouter

Uso atual:
- provedor de IA do projeto

Arquivo central:
- [lib/ai.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\ai.ts)

Rotas principais:
- [app/api/ai/assistant/route.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\app\api\ai\assistant\route.ts)
- [app/api/ai/lead-analysis/route.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\app\api\ai\lead-analysis\route.ts)
- [app/api/ai/conversation-analysis/route.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\app\api\ai\conversation-analysis\route.ts)

### 5.3 WhatsApp Cloud API

Uso atual:
- trilha oficial de mensagens

Arquivos centrais:
- [lib/server/messages-client.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\server\messages-client.ts)
- [lib/server/messages-repository.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\server\messages-repository.ts)
- [lib/server/messages-prisma-store.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\server\messages-prisma-store.ts)
- [app/api/webhooks/meta/route.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\app\api\webhooks\meta\route.ts)

---

## 6. Variaveis de ambiente importantes

### Base do sistema

```env
AUTH_SECRET=
APP_URL=
DATABASE_URL=
DIRECT_URL=
SUPABASE_DATABASE_URL=
SUPABASE_DIRECT_URL=
```

### Supabase web

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

### OpenRouter

Configuracao esperada hoje:

```env
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-4-31b-it:free
OPENROUTER_MODEL_ASSISTANT=google/gemma-4-31b-it:free
OPENROUTER_MODEL_LEAD_ANALYSIS=openai/gpt-oss-20b:free
OPENROUTER_MODEL_CONVERSATION_ANALYSIS=openai/gpt-oss-20b:free
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=Base CRM
```

### WhatsApp Cloud API

```env
WHATSAPP_PROVIDER=meta
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_ACCESS_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
META_EMBEDDED_SIGNUP_ENABLED=false
META_COEXISTENCE_ENABLED=false
META_EMBEDDED_SIGNUP_APP_ID=
META_EMBEDDED_SIGNUP_CONFIG_ID=
META_EMBEDDED_SIGNUP_REDIRECT_URI=
WHATSAPP_FALLBACK_TEMPLATE_NAME=
WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE=pt_BR
```

Valores confirmados para a conta Meta real:
- `META_PHONE_NUMBER_ID=200460319811155`
- `META_WABA_ID=188150857713468`
- `META_EMBEDDED_SIGNUP_APP_ID=1250488524805073`
- `META_EMBEDDED_SIGNUP_CONFIG_ID=2041214766787970`

Regra operacional:
- `META_WABA_ID` apenas identifica a conta WhatsApp Business e nao quebra coexistencia
- manter `META_COEXISTENCE_ENABLED=true` em producao
- nao iniciar fluxo de migracao completa do numero
- nao alterar configuracoes que derrubem WhatsApp Business no celular ou WhatsApp Web

### Integracoes auxiliares

```env
FOLLOWUP_TOKEN=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_RANGE=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

---

## 7. Como subir o projeto

### Modo recomendado no Windows

Usar:

```text
iniciar.bat
```

Esse fluxo:
- pergunta se deve subir local ou em rede
- valida configuracao do OpenRouter
- sobe o CRM
- abre o navegador

### Desenvolvimento manual

```bash
npm install
npm run dev
```

### Verificacao de tipagem

```bash
npm run lint
```

Observacao importante:
- o script `lint` ja foi corrigido para funcionar no Windows mesmo com caminhos problemáticos

### Prisma

Comandos principais:

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:apply:predictive-score
```

---

## 8. Estrutura de dados relevante

Entidades principais no `Prisma` hoje:
- `User`
- `Lead`
- `Task`
- `LeadHistory`
- `LeadListRecord`
- `CrmCustomizationState`
- `AdminAuditRecord`
- `MessageConversation`
- `MessageRecord`
- `MessageWorkspaceRecord`
- `MessageCampaignRecord`

Leitura pratica:
- o banco principal do CRM ja esta consolidado
- o modulo de mensagens tambem ja foi levado para Prisma/Supabase

---

## 9. O que ja foi validado

Validacoes importantes ja executadas em rodadas recentes:

- `Supabase` funcionando como persistencia principal do CRM
- `Prisma db push` sincronizado com sucesso
- script `npm run db:apply:predictive-score` aplicado com sucesso no Supabase para criar as colunas persistidas do score preditivo quando o `schema engine` local nao responde
- login admin funcionando
- criacao e exclusao de lead
- criacao e conclusao de tarefa
- criacao e exclusao de lista
- customizacoes funcionando
- administracao de usuarios funcionando
- webhook sintetico da Meta persistindo conversa e mensagem no banco
- mensagens sendo lidas do banco
- endpoints de IA respondendo corretamente com `openrouter` ou `fallback`
- `npm run lint` aprovado
- `npm run test -- message-campaign-template whatsapp-service-window` aprovado para o fluxo de templates Meta e janela de 24h
- correcoes de encoding aplicadas para evitar corrupcao UTF-8
- scanner de encoding adicionado para apoio na verificacao de arquivos
- correcao de vulnerabilidades criticas e de alta severidade aplicada
- inbox estabilizado ao trocar entre conversas e durante refresh em segundo plano
- disparos oficiais com modo hibrido, envio por template Meta e selecao de template por mouse enviados para `main` nos commits `c52b043` e `916c384`

---

## 10. Pendencias reais no estado atual

Estas sao as pendencias que ainda importam de verdade:

### 10.1 Estabilizacao do ambiente publicado

O deploy publico ja existe em `Vercel`.

Ainda precisa validar no ambiente publicado:
- coerencia entre commit publicado e branch principal
- runtime do `Next.js`
- acesso ao banco `Supabase`
- leitura correta das `Environment Variables`
- comportamento final do webhook publico da Meta

### 10.2 WhatsApp oficial em ambiente publico

Falta confirmar/acompanhar em ambiente publico:
- `APP_URL` definitiva
- cadastro do webhook da Meta em `APP_URL/api/webhooks/meta`
- envio real
- recebimento real
- fluxo de midia real
- listagem de templates aprovados na aba de Disparos usando `META_WABA_ID=188150857713468`
- permissao `whatsapp_business_management` no token usado para listar templates
- disparo controlado com template aprovado em poucos leads

Ja confirmado:
- conta WhatsApp real selecionada na Meta: `Base CRM`
- WABA ID da conta real: `188150857713468`
- Phone Number ID local conhecido: `200460319811155`
- coexistencia deve ser preservada; nao migrar numero nem desconectar WhatsApp Business App/WhatsApp Web

Preparacao operacional ja pronta:
- endpoint de prontidao em `/api/messages/embedded-signup/readiness`
- script local de checklist em `npm run ops:whatsapp-readiness`

### 10.3 IA em ambiente de producao

Falta confirmar com chave valida e limite operacional:
- resposta real do OpenRouter sem cair em fallback
- custo e modelo final por fluxo
- comportamento das propostas de acao com aprovacao do usuario em uso real

### 10.4 Revisao final de sobras legadas

A revisao final deve observar principalmente:
- rotas antigas de compatibilidade da `Evolution`
- qualquer documentacao residual que pareca fluxo ativo
- warnings nao bloqueantes do `middleware` do Next

---

## 11. Sobras legadas conhecidas

Estas sobras sao conhecidas e nao representam a trilha principal:

- [app/api/webhooks/evolution/[[...event]]/route.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\app\api\webhooks\evolution\[[...event]]\route.ts)
  - rota de tombamento
  - responde como removida
  - nao e integracao ativa

- [middleware.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\middleware.ts)
  - ainda usa a convencao `middleware`
  - existe aviso de deprecacao do ecossistema Next para migrar a `proxy`
  - nao e bloqueador imediato

Regra de interpretacao:
- sobra legada nao significa bug
- mas deve ser revisada antes do lancamento final, para reduzir ruido

---

## 12. O que um novo modelo deve assumir ao entrar no projeto

Assuma estas verdades como padrao:

- o projeto NAO esta mais em migracao para Firebase
- o projeto NAO usa mais Ollama como trilha principal
- o projeto NAO usa Gemini como trilha ativa
- `Supabase + Prisma` e a base oficial de dados
- `OpenRouter` e a base oficial de IA
- `Meta Cloud API` e o canal oficial de mensagens
- `STATUS-PROJETO.md` deve ser mantido curto, atual e orientado a operacao

Antes de mexer em qualquer integracao, conferir:
- `.env.local`
- [package.json](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\package.json)
- [prisma/schema.prisma](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\prisma\schema.prisma)
- [lib/ai.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\ai.ts)
- [lib/server/messages-client.ts](C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\lib\server\messages-client.ts)

---

## 13. Proximo passo recomendado

Se a prioridade for estabilizacao final:

1. confirmar que a Vercel esta no commit esperado
2. validar `Environment Variables` e fluxo de coexistencia no deploy publico
3. validar OpenRouter em producao
4. validar webhook real da Meta
5. rodar smoke test final online
6. revisar sobras legadas

Se a prioridade for continuidade de produto antes do deploy:

1. revisar UX do modulo de mensagens
2. decidir `Supabase Auth` versus manter `auth proprio`
3. decidir `Supabase Storage` para anexos e midias

---

## 14. Registro mais recente

### Atualizacao 2026-06-25 — Disparos Meta e selecao de templates

Estado consolidado:
- commit `c52b043` adicionou envio de campanhas com template Meta, modo `hybrid`, checagem da janela de atendimento de 24h e fallback global opcional por template aprovado
- commit `916c384` adicionou sincronizacao/listagem de templates Meta via `META_WABA_ID` e selecao por mouse na aba de Disparos Oficiais
- a UI de campanhas agora mostra o template efetivo, fallback global, modo de envio, preview de parametros e valida quantidade de variaveis marcadas contra a quantidade de parametros do template selecionado
- `META_WABA_ID=188150857713468` foi confirmado visualmente no Meta Business Manager para a conta WhatsApp `Base CRM` e informado para configuracao na Vercel
- a regra de coexistencia foi reforcada em `docs/whatsapp-meta-setup.md`: nenhuma mudanca deve migrar o numero, desconectar o celular/WhatsApp Web ou trocar o formato da API sem aprovacao explicita
- validacoes executadas: `npm run lint` e `npm run test -- message-campaign-template whatsapp-service-window`

Pendencias imediatas:
- confirmar no painel da Vercel que o deploy do commit `916c384` finalizou com `META_WABA_ID` em Production
- abrir o CRM em producao e validar se os templates aprovados aparecem para selecao por mouse
- se a lista nao aparecer, validar permissao `whatsapp_business_management` do token atual
- executar primeiro disparo controlado com poucos leads e template aprovado

### Atualizacao 2026-06-01

Estado consolidado:
- `Supabase` concluido como persistencia principal
- `OpenRouter` concluido como trilha principal de IA
- `Ollama` removido da trilha principal
- `Firebase` abandonado
- `WhatsApp Cloud API` mantida como integracao oficial
- `npm run lint` aprovado apos ajuste do script no Windows
- este documento foi reescrito para servir como handoff real entre modelos

Atualizacao complementar:
- iniciado o fluxo ausente de `Embedded Signup / Coexistencia` da Meta
- criada persistencia do estado de onboarding do canal em `MessageChannelConfigRecord`
- criado callback interno em `/api/messages/embedded-signup/callback`
- a UI do canal ja mostra checklist e status do onboarding de coexistencia
- enquanto a nova tabela nao sincroniza no Supabase, o estado do onboarding usa fallback seguro em arquivo local

Atualizacao complementar:
- o assistente comercial passou a consultar fatos consolidados do CRM antes de responder perguntas numericas
- contagens de `leads totais`, `ativos`, `arquivados`, `tarefas pendentes` e `retornos atrasados` agora saem de fonte deterministica do backend
- objetivo desse ajuste: impedir que a LLM suponha quantidades inexistentes dentro do CRM
- `npm run lint` aprovado apos essa mudanca

Atualizacao complementar:
- o fluxo de `Embedded Signup / Coexistencia` ganhou rota real de inicio em `/api/messages/embedded-signup/start`
- o backend agora monta a URL de onboarding da Meta com `client_id`, `config_id`, `redirect_uri`, `scope` e `state`
- o callback do onboarding passou a validar o `state` recebido antes de aceitar a vinculacao
- quando o callback retorna `code + waba_id + phone_number_id`, o status local do canal sobe para `linked`
- a UI do canal ganhou botao para iniciar o `Embedded Signup` diretamente do CRM

Atualizacao complementar:
- o callback da coexistencia agora tenta trocar automaticamente o `code` da Meta por token de onboarding
- o CRM registra se a troca do `code` foi bem-sucedida ou falhou, sem expor token bruto na interface
- foi criada rota manual de retry em `/api/messages/embedded-signup/exchange`
- a UI do canal ganhou acao explicita para `Concluir troca do code`

Atualizacao complementar:
- criada rota de prontidao para teste em `/api/messages/embedded-signup/readiness`
- essa rota devolve checklist tecnico, URLs esperadas e passos do primeiro teste real
- `.env.example` foi ajustado para refletir `APP_URL` publica em HTTPS como padrao esperado para coexistencia

Atualizacao complementar:
- criado o script `npm run ops:whatsapp-readiness`
- esse script valida localmente se `APP_URL`, Cloud API, flags de coexistencia, credenciais do Embedded Signup, OpenRouter e banco principal estao prontos para o primeiro teste publico
- objetivo: transformar o teste de coexistencia em um procedimento repetivel antes do deploy final

Atualizacao complementar:
- o onboarding de coexistencia agora salva o token operacional, o `Phone Number ID`, o `WABA ID` e a data de vinculacao no backend
- o canal oficial passou a resolver a configuracao do WhatsApp usando os ativos vinculados pelo onboarding, sem depender apenas do `.env`
- o launch do Embedded Signup foi alinhado ao fluxo de `whatsapp_business_app_onboarding`
- como o `db push` da Supabase segue instavel neste ambiente, foi criado o script `npm run db:apply:coexistence` para aplicar as colunas finais do coexistence diretamente no Postgres
- a tabela `MessageChannelConfigRecord` e as colunas finais do coexistence ja foram aplicadas com sucesso no Supabase por esse script
- o coexistence deve ser tratado como concluido no projeto; o passo restante e apenas configuracao/validacao em ambiente publico da Meta

Atualizacao complementar:
- corrigido um falso negativo de configuracao no painel do coexistence
- causa: `MessageChannelConfigRecord` antigo estava sobrescrevendo flags e IDs novos vindos das `Environment Variables`
- ajuste aplicado: o backend agora reidrata `META_EMBEDDED_SIGNUP_ENABLED`, `META_COEXISTENCE_ENABLED`, `META_EMBEDDED_SIGNUP_APP_ID` e `META_EMBEDDED_SIGNUP_CONFIG_ID` a partir do ambiente quando o registro salvo estiver vazio ou desatualizado
- ajuste adicional: a `Redirect URI` do Embedded Signup foi realinhada para a rota real do projeto em `/api/messages/embedded-signup/callback`

### Atualizacao 2026-06-03

Estado complementar consolidado a partir do topo atual do Git:
- o CRM ja entrou em trilha de lancamento com deploy publico ativo
- foram aplicadas correcoes de `encoding` para impedir corrupcao UTF-8 no projeto
- foi adicionado scanner de encoding para verificacao rapida de arquivos problemáticos
- foram aplicadas correcoes de seguranca para vulnerabilidades criticas e de alta severidade
- o inbox foi estabilizado para nao misturar mensagens ao trocar de conversa
- a lista de conversas nao deve mais ser substituida por skeleton durante refresh em segundo plano
- a camada de IA evoluiu para niveis de contexto nativo do CRM, loop agentico e propostas de acao com aprovacao do usuario
- o `STATUS-PROJETO.md` foi revisto para refletir o topo real do repositório, e nao apenas a base arquitetural
- o inbox passou a mostrar a ultima interacao com formato operacional mais legivel: `Xmin atras`, `Xh atras`, `ontem` e `dd/MM`
- a analise de lead foi reforcada para ler o contexto completo do lead, incluindo historico e conversa armazenada, antes de montar resumo, riscos, sinais de compra e follow-up
- o assistente comercial deixou de usar a trilha de resposta instantanea curta e passou a depender do fluxo conversacional principal com contexto completo do CRM
- o score preditivo ganhou persistencia propria no banco e agora pode ser recalculado pela rota `/api/ai/predictive-score/refresh`
- a geracao do score unifica contexto do CRM: cadastro do lead, tarefas, historico recente e mensagens da conversa associada
- quando a OpenRouter estiver disponivel, ela produz score estruturado com confianca, motivos e riscos; quando nao estiver, o CRM cai em fallback controlado
- o frontend agenda refresh periodico dos scores para manter listas e detalhes coerentes sem depender de recarga manual
- o `db push` segue instavel neste ambiente para alteracoes de schema no Supabase; por isso foi criado o script `npm run db:apply:predictive-score`, que ja aplicou as colunas e o indice necessarios no banco remoto
- o webhook da Meta passou a ingerir ecos do coexistence (`smb_message_echoes`), salvando no banco respostas enviadas fora do CRM pelo WhatsApp Business App / WhatsApp Web para melhorar a fidelidade do inbox e da analytics

### Atualizacao 2026-06-11

Diagnostico do botao "Conectar WhatsApp" (Embedded Signup / Coexistence):
- a Cloud API direta (`META_PHONE_NUMBER_ID` + `META_ACCESS_TOKEN` configurados manualmente via WhatsApp Manager) ja esta operacional: o CRM envia, recebe e mostra mensagens, e o numero continua funcionando normalmente no WhatsApp Business App do celular e no WhatsApp Web (coexistencia ja funciona na pratica, fora do fluxo OAuth)
- `npm run ops:whatsapp-readiness` retorna todos os itens `[ok]`; App ID, Config ID, dominios, OAuth redirect URI e permissoes (`whatsapp_business_management`, `whatsapp_business_messaging`) foram conferidos manualmente no painel da Meta e estao corretos
- ao clicar em "Conectar WhatsApp" (fluxo `FB.login` com `featureType: whatsapp_business_app_onboarding`), a Meta exibe "Parece que esse app nao esta disponivel — Embedded signup is only available for BSPs or TPs"
- causa: esse `featureType` (Embedded Signup para Coexistence) e restrito pela Meta a apps com status de Business Solution Provider (BSP) ou Tech Provider (TP) — restricao de politica/registro de negocio da Meta, presente no codigo desde o commit `8f4f9c3` e nao relacionada a `.env`/configuracao do app
- decisao: como a coexistencia ja funciona operacionalmente sem esse popup, o botao "Conectar WhatsApp" foi mantido como acao opcional, com aviso na UI explicando que esse erro da Meta e esperado e nao afeta o funcionamento atual do canal
- pendencia futura (opcional): se for necessario re-onboardar um numero novo via Embedded Signup oficial, o Base CRM precisaria solicitar a Meta o registro do app como Tech Provider

### Atualizacao 2026-06-12 — WhatsApp offline em producao (causa raiz)

Apos o ambiente de homologacao ser criado, o WhatsApp parou de funcionar em producao (status "Sem integracao ativa" / Offline), mesmo com `npm run ops:whatsapp-readiness` retornando `[ok]`.

Foram identificadas e corrigidas DUAS causas, em sequencia:

1. **`WHATSAPP_PROVIDER` ausente na Vercel (Production)**: essa env var controla `provider`/`configured`/`status` em `getWhatsAppConfig()`, mas nao aparecia no checklist da UI (commit `c3d3b93` adicionou o item "WHATSAPP_PROVIDER=meta" ao checklist em `connection-status-card.tsx`). Usuario adicionou `WHATSAPP_PROVIDER=meta` na Vercel Production.

2. **`/api/messages/conversations` retornando 500** mesmo apos a correcao acima: com `provider=meta` ativo, `ensureLeadsForInboundConversations` (em `lib/server/messages-repository.ts`) passou a criar leads automaticos para conversas novas do WhatsApp, o que chama `lockLeadIdentity` em `lib/server/crm/prisma-store.ts`. Essa funcao usa `tx.$queryRaw\`SELECT pg_advisory_xact_lock(hashtext(...))\`` — `pg_advisory_xact_lock` retorna `void` no Postgres, e o Prisma 7.8 nao consegue desserializar uma coluna `void`, lancando `PrismaClientKnownRequestError: Failed to deserialize column of type 'void'`. Isso derrubava toda a listagem de conversas (`connection` chegava `null` no frontend, daí "Sem integracao ativa" mesmo com o checklist OK).
   - Reproduzido localmente rodando `next dev` com `.env.local` (que ja tinha `WHATSAPP_PROVIDER=meta` correto) e chamando `/api/messages/conversations` autenticado.
   - Corrigido no commit `1cfcaa5`: troca de `$queryRaw` para `$executeRaw` em `lockLeadIdentity` (linha ~305), que nao tenta desserializar o resultado da query.

Ambas as correcoes ja foram enviadas para `main` (commits `c3d3b93` e `1cfcaa5`) e devem ter sido aplicadas via deploy automatico da Vercel.

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
