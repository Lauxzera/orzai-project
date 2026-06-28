# Arquitetura Completa — Templates Meta e Sistema de Disparos WhatsApp

**Criado em:** 25/06/2026  
**Objetivo:** definir a estrutura funcional, técnica e operacional do sistema de disparos via WhatsApp seguindo as diretrizes da Meta, preservando o CRM atual, evitando perda de informação e reduzindo risco de quebra em produção.

---

## 1. Objetivo do desenho

Este material define como o CRM deve operar para:

- enviar campanhas dentro da política oficial da Meta;
- separar com clareza mensagens livres de mensagens por template;
- suportar crescimento sem perder rastreabilidade;
- evitar mudanças arriscadas em produção sem necessidade;
- preparar o terreno para a próxima etapa de desenvolvimento.

Este documento cobre:

- modelo operacional;
- arquitetura recomendada;
- estrutura de dados;
- mapeamento de variáveis;
- fluxo de aprovação e uso de templates;
- regras de fallback;
- observabilidade;
- plano de implementação em fases.

---

## 2. Princípios obrigatórios

### 2.1 Conformidade com a Meta

O sistema deve obedecer estas regras:

- dentro da janela de atendimento de 24h: pode enviar texto livre;
- fora da janela de 24h: só pode enviar template aprovado;
- o template usado no envio deve existir exatamente com o mesmo nome e idioma na Meta;
- templates com variáveis só podem ser usados se todos os parâmetros forem enviados corretamente;
- erros previsíveis de política da Meta não devem ser tratados como falha técnica genérica.

### 2.2 Segurança operacional

- nenhuma campanha deve ser perdida se a aba do navegador for fechada;
- nenhum disparo deve depender de memória local do frontend;
- toda decisão de envio deve ficar registrada;
- toda falha deve ter motivo legível e classificável;
- toda evolução de schema deve ser opcional, faseada e reversível.

### 2.3 Compatibilidade com o CRM atual

O projeto hoje já possui:

- campanhas persistidas em `MessageCampaignRecord`;
- envio livre dentro da janela;
- fallback global por env para leads frios;
- placeholders internos como `{nome}`, `{curso}`, `{origem}`, `{cidade}`, `{responsavel}`.

O novo desenho deve preservar esse comportamento e ampliar a capacidade sem quebrar o fluxo existente.

---

## 3. Estado atual do sistema

Hoje o CRM funciona assim:

- campanha é criada com um texto-base;
- o texto livre usa placeholders internos do CRM;
- o disparo roda por polling client-side;
- fora da janela de 24h o sistema pode usar um template global da Meta via:
  - `WHATSAPP_FALLBACK_TEMPLATE_NAME`
  - `WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE`

Limitações atuais:

- não existe cadastro interno de templates;
- não existe seleção de template por campanha;
- o fallback é global;
- o envio de template ainda não usa variáveis no fluxo de campanhas;
- a operação depende de aba aberta para continuar processando.

---

## 4. Visão-alvo da arquitetura

### 4.1 Camadas

A arquitetura recomendada deve ter 5 camadas:

1. **Catálogo de templates**
   Armazena a definição interna dos templates aprovados na Meta.

2. **Motor de decisão de envio**
   Decide se o lead recebe texto livre, template ou é marcado como não elegível.

3. **Executor de disparo**
   Processa destinatários, aplica limites, envia e persiste resultado.

4. **Auditoria e observabilidade**
   Registra decisão, payload lógico, erro classificado e status final.

5. **Interface operacional**
   Permite criar campanha, escolher template, acompanhar progresso e reprocessar com segurança.

### 4.2 Separação conceitual

O sistema deve tratar como objetos diferentes:

- **Template Meta**
  Modelo oficial aprovado pela Meta.

- **Campanha CRM**
  Operação de envio para uma audiência.

- **Destinatário de campanha**
  Lead individual dentro da campanha.

- **Execução de envio**
  Tentativa concreta de disparo para um destinatário.

Essa separação reduz risco de perda de contexto e melhora suporte, auditoria e manutenção.

---

## 5. Estrutura funcional recomendada

### 5.1 Catálogo interno de templates

Mesmo que o template nasça na Meta, o CRM deve manter um espelho interno com metadados de operação.

Estrutura recomendada:

```ts
type WhatsappTemplateCatalogItem = {
  id: string;
  slug: string;
  metaTemplateName: string;
  languageCode: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "draft" | "pending_meta" | "approved" | "rejected" | "disabled";
  channel: "whatsapp";
  headerType: "none" | "text" | "image" | "video" | "document";
  bodyMode: "static" | "dynamic";
  footerEnabled: boolean;
  buttons: Array<{
    type: "none" | "quick_reply" | "url" | "phone";
    label: string;
    urlSuffixVariableKey?: string | null;
  }>;
  variableSchema: Array<{
    key: string;
    label: string;
    source:
      | "lead.nome"
      | "lead.telefone"
      | "lead.email"
      | "lead.cursoDeInteresse"
      | "lead.profissao"
      | "lead.cidade"
      | "lead.responsavelNome"
      | "custom";
    placeholderFormat: "positional";
    position: number;
    required: boolean;
    fallbackValue: string;
    exampleValue: string;
  }>;
  bodyPreview: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.2 Campanha

Estrutura conceitual recomendada:

```ts
type CampaignMode = "free_text" | "meta_template" | "hybrid";

type Campaign = {
  id: string;
  title: string;
  mode: CampaignMode;
  audienceId?: string | null;
  freeTextTemplate?: string | null;
  metaTemplateId?: string | null;
  fallbackTemplateId?: string | null;
  delaySeconds: number;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.3 Destinatário da campanha

O destinatário precisa registrar mais do que apenas `sent/failed/skipped`.

Estrutura recomendada:

```ts
type CampaignRecipient = {
  leadId: string;
  leadName: string;
  phone: string;
  eligibility:
    | "within_service_window"
    | "outside_service_window_with_template"
    | "outside_service_window_without_template"
    | "missing_phone"
    | "invalid_phone"
    | "missing_required_variables";
  selectedRoute: "free_text" | "meta_template" | "skip";
  templateVariableSnapshot?: Record<string, string> | null;
  status: "pending" | "sent" | "failed" | "skipped";
  errorCode?: string | null;
  errorMessage?: string | null;
  lastMessageId?: string | null;
  processedAt?: string | null;
};
```

### 5.4 Execução de envio

Mesmo que não entre na primeira migração, este é o formato ideal:

```ts
type CampaignDispatchAttempt = {
  id: string;
  campaignId: string;
  recipientLeadId: string;
  route: "free_text" | "meta_template";
  templateName?: string | null;
  templateLanguage?: string | null;
  payloadSnapshot: Record<string, unknown>;
  result: "sent" | "failed" | "skipped";
  metaMessageId?: string | null;
  metaErrorCode?: number | null;
  metaErrorSubcode?: number | null;
  errorMessage?: string | null;
  createdAt: string;
};
```

Essa camada evita perda de informação em investigações futuras.

---

## 6. Diretriz oficial para variáveis

### 6.1 Regra prática para o projeto

Para este CRM, a recomendação é padronizar apenas placeholders posicionais:

- `{{1}}`
- `{{2}}`
- `{{3}}`
- `{{4}}`

Motivo:

- simplifica o payload de envio;
- reduz ambiguidade na integração;
- facilita QA;
- é o formato mais previsível para mapeamento interno.

### 6.2 Mapeamento padrão sugerido

Padrão mínimo recomendado para Belart:

| Placeholder | Campo CRM | Finalidade |
|---|---|---|
| `{{1}}` | `lead.nome` | nome do lead |
| `{{2}}` | `lead.cursoDeInteresse` | curso |
| `{{3}}` | `lead.profissao` | função/profissão |
| `{{4}}` | `lead.telefone` | número de contato |
| `{{5}}` | `lead.responsavelNome` | atendente |
| `{{6}}` | `lead.cidade` | localização |

### 6.3 Regra de fallback de variável

Toda variável dinâmica deve ter fallback definido.

Exemplo:

- `lead.nome` vazio -> `"aluno(a)"`
- `lead.profissao` vazia -> `"seu perfil"`
- `lead.cidade` vazia -> `""`

Se a variável for obrigatória para sentido da mensagem e não houver valor adequado, o destinatário deve ser marcado como:

- `missing_required_variables`
- `status = skipped`

Isso evita envio incorreto ou rejeição da Meta.

---

## 7. Regras por componente do template

### 7.1 Body

- pode ter variáveis;
- deve ser o componente principal para personalização;
- o CRM deve validar quantidade de placeholders e quantidade de parâmetros antes do envio.

### 7.2 Header

- se for texto, pode ter variável;
- se for mídia, exige tratamento específico no payload;
- primeira fase recomendada: suportar apenas `headerType = none | text`.

### 7.3 Footer

- sempre texto fixo;
- não deve entrar no sistema de variáveis.

### 7.4 Buttons

- `quick_reply`: sem variável dinâmica útil ao payload de template;
- `url`: pode exigir variável apenas no final da URL;
- `phone`: fixo.

Recomendação para primeira fase robusta:

- suportar `none`;
- suportar `url` apenas em fase posterior;
- evitar aprovar templates críticos com header de mídia ou button variável antes do código estar pronto.

---

## 8. Fluxo operacional recomendado

### 8.1 Criação do template

Fluxo humano:

1. Definir objetivo da mensagem.
2. Definir categoria correta na Meta.
3. Redigir template.
4. Definir placeholders.
5. Submeter para aprovação.
6. Registrar template no catálogo interno do CRM.

### 8.2 Criação da campanha

Fluxo no CRM:

1. Escolher audiência.
2. Escolher modo de envio:
   - texto livre;
   - template Meta;
   - híbrido.
3. Selecionar template principal.
4. Validar variáveis exigidas.
5. Gerar preview.
6. Salvar campanha.

### 8.3 Decisão por destinatário

Algoritmo recomendado:

1. Validar telefone.
2. Buscar última conversa.
3. Verificar janela de 24h.
4. Se campanha for `free_text`:
   - dentro da janela -> enviar texto livre;
   - fora da janela -> usar fallback template se houver;
   - sem fallback -> `skipped`.
5. Se campanha for `meta_template`:
   - sempre enviar template;
   - se variáveis faltarem -> `skipped`.
6. Persistir decisão antes do envio.
7. Enviar.
8. Persistir resultado.

---

## 9. Modos de campanha recomendados

### 9.1 `free_text`

Uso:

- follow-up em leads quentes;
- réguas de atendimento recentes;
- mensagens contextualizadas após resposta do lead.

Risco:

- quebra fora da janela se não houver fallback.

### 9.2 `meta_template`

Uso:

- reengajamento;
- leads frios;
- campanhas sazonais;
- retorno ativo da empresa.

Vantagem:

- previsível e totalmente aderente à política Meta.

### 9.3 `hybrid`

Uso ideal:

- dentro da janela: texto livre;
- fora da janela: template aprovado.

Esse é o melhor modo operacional para o CRM no médio prazo.

---

## 10. Estrutura recomendada para o CRM

### 10.1 Fase segura sem migração imediata

Pode ser implementada preservando a base atual:

- manter `MessageCampaignRecord`;
- manter `recipients` em JSON;
- adicionar configuração de catálogo em arquivo/JSON interno ou tabela nova somente quando validado;
- manter fallback global funcionando.

### 10.2 Estrutura ideal com baixa ambiguidade

Tabelas futuras recomendadas:

- `WhatsappTemplateCatalog`
- `WhatsappTemplateVersion`
- `MessageCampaignRecord`
- `MessageCampaignRecipientRecord`
- `MessageCampaignDispatchAttempt`

### 10.3 Motivo para separar destinatários do JSON

Hoje `recipients` em JSON funciona, mas tem limitações:

- dificulta filtros e relatórios;
- dificulta reprocessamento seletivo;
- dificulta auditoria detalhada;
- aumenta risco de inconsistência silenciosa.

Para crescimento, a separação em tabela é o caminho correto.

---

## 11. Observabilidade e prevenção de perda de informação

### 11.1 O que deve sempre ser salvo

Para cada destinatário:

- motivo de elegibilidade;
- rota escolhida;
- template escolhido;
- snapshot de variáveis;
- horário da decisão;
- horário do envio;
- resultado final;
- código de erro Meta;
- mensagem de erro humana.

### 11.2 O que deve aparecer na UI

- total de leads por campanha;
- enviados;
- pulados;
- falhados;
- motivo agrupado;
- rota usada;
- template usado;
- possibilidade de exportar relatório.

### 11.3 O que deve entrar no logger

- `campaignId`
- `leadId`
- `route`
- `withinWindow`
- `templateName`
- `templateLanguage`
- `metaErrorCode`
- `metaErrorSubcode`

---

## 12. Riscos de quebra e mitigação

### 12.1 Risco: template aprovado diferente do cadastrado

Mitigação:

- salvar nome exato da Meta;
- bloquear uso se `metaTemplateName` estiver vazio;
- validar idioma também.

### 12.2 Risco: variável faltando

Mitigação:

- validação antes do envio;
- snapshot dos parâmetros;
- regra clara de `skipped` por falta de dado obrigatório.

### 12.3 Risco: campanha depender de aba aberta

Mitigação:

- curto prazo: manter como está, deixando isso explícito;
- médio prazo: mover o executor para job de servidor.

### 12.4 Risco: mudança de schema em produção

Mitigação:

- implementar por fases;
- não alterar tabela atual sem janela controlada;
- introduzir novas tabelas em paralelo em vez de mutar o fluxo crítico de uma vez.

### 12.5 Risco: erro Meta pausar campanha sem necessidade

Mitigação:

- classificar erros de política;
- não contar erro de janela como falha técnica;
- pausar apenas para erro real repetido.

---

## 13. Plano de implementação recomendado

### Fase 1 — Entrega segura imediata

Objetivo: formalizar a operação sem quebrar o sistema atual.

- documentar padrão de templates;
- padronizar placeholders posicionais;
- criar catálogo operacional fora do banco, se necessário;
- manter fallback global;
- revisar mensagens e motivos de erro.

### Fase 2 — Templates dinâmicos no fallback

Objetivo: permitir `{{1}}`, `{{2}}`, `{{3}}` no envio de campanha.

- ampliar `sendTemplateMessageViaAPI`;
- mapear variáveis do lead;
- validar campos obrigatórios;
- registrar snapshot de parâmetros.

### Fase 3 — Template por campanha

Objetivo: deixar de depender de env global.

- permitir escolher template na campanha;
- persistir `metaTemplateId` ou equivalente;
- manter fallback global apenas como último recurso.

### Fase 4 — Executor robusto de servidor

Objetivo: remover dependência de aba aberta.

- criar worker, cron frequente ou fila;
- tornar dispatch idempotente;
- controlar lock por campanha.

### Fase 5 — Auditoria completa

Objetivo: operação e suporte de nível produção.

- tabela de tentativas;
- exportação de relatório;
- dashboard de saúde de campanhas;
- métricas por template e por motivo de falha.

---

## 14. Recomendação objetiva para a Belart hoje

Para entregar valor rápido sem risco desnecessário:

1. Padronizar templates da Meta com placeholders posicionais.
2. Criar um catálogo interno simples, mesmo que inicialmente documental.
3. Tratar `profissao` como origem principal para "função".
4. Considerar `telefone` apenas quando fizer sentido no corpo.
5. Manter o fallback global ativo nesta etapa.
6. Planejar a próxima sprint para suportar variáveis no template.

---

## 15. Modelo operacional mínimo de catálogo

Este pode ser o padrão inicial de trabalho da equipe:

| Slug interno | Nome na Meta | Categoria | Idioma | Variáveis |
|---|---|---|---|---|
| `reengajamento_geral` | `reengajamento_geral` | Marketing | `pt_BR` | nenhuma |
| `reengajamento_nome_curso` | `reengajamento_nome_curso` | Marketing | `pt_BR` | `{{1}}=nome`, `{{2}}=curso` |
| `retorno_consultor` | `retorno_consultor` | Utility/Marketing | `pt_BR` | `{{1}}=nome`, `{{2}}=responsavelNome` |

---

## 16. Conclusão executiva

O CRM já possui a base necessária para operar com a Meta, mas ainda está em um estágio híbrido:

- aderente para texto livre dentro da janela;
- aderente para fallback simples fora da janela;
- ainda incompleto para uma operação madura de templates dinâmicos.

O desenho correto para não perder informação e não quebrar o sistema é:

- separar catálogo de template, campanha, destinatário e tentativa;
- padronizar variáveis posicionais;
- validar tudo antes do envio;
- registrar decisão e resultado;
- evoluir por fases, sem reescrever o fluxo crítico de uma vez.

Esse é o caminho recomendado para desenvolvimento responsável e sustentação segura do módulo de disparos.
