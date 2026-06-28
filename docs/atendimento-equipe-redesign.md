# Redesenho Da Area De Atendimento

Este documento define a nova arquitetura da experiencia de atendimento do CRM.
O objetivo e substituir a logica visual de "lista de chats" por uma central comercial orientada a equipe, triagem, prioridade e decisao operacional.

---

## 1. Objetivo Do Redesenho

Transformar a aba atual de `Mensagens` em uma experiencia de `Atendimento` com foco em:

- operacao de equipe
- triagem rapida
- visibilidade de responsabilidade
- controle de prioridade e SLA
- tomada de decisao comercial
- menor dependencia de uma UI parecida com WhatsApp

O atendimento deixa de ser entendido como "abrir conversa e responder" e passa a ser entendido como:

- identificar o que precisa de acao
- entender contexto comercial
- decidir a proxima acao
- executar a acao dentro da conversa

---

## 2. Novo Modelo Mental

### Antes

- inbox centrado em conversa
- visual parecido com mensageria
- time navega por ultima mensagem
- contexto comercial fica disperso

### Depois

- central de atendimento
- visual centrado em cards operacionais
- time navega por fila, prioridade, dono e atraso
- conversa vira parte do dossie do atendimento

---

## 3. Nome Da Superficie

Recomendacao:

- trocar a visao `Mensagens` para `Atendimento`

Opcionalmente:

- `Mensagens` pode continuar existindo como subtitulo de canal
- a tela principal passa a ser descrita como `Central de Atendimento`

---

## 4. Estrutura Macro Da Tela

### 4.1 Layout Geral

Tela dividida em 4 zonas:

1. `Barra superior operacional`
2. `Painel de filas`
3. `Lista de atendimentos`
4. `Cockpit do atendimento`

### 4.2 Comportamento Base

- desktop grande:
  - 3 colunas principais + painel lateral de apoio
- notebook:
  - 2 colunas principais + painel colapsavel
- tablet:
  - fila > lista > cockpit com navegacao em camadas
- mobile:
  - fluxo sequencial, nao simultaneo

---

## 5. Arquitetura Das Areas

## 5.1 Barra Superior Operacional

Funcao:

- orientar o time
- mostrar estado geral da operacao
- entregar filtros globais

Conteudos:

- titulo: `Central de Atendimento`
- seletor de visao do time:
  - minhas filas
  - equipe inteira
  - sem responsavel
- busca global
- filtros rapidos:
  - prioridade
  - etapa
  - responsavel
  - origem
- indicadores compactos:
  - novos contatos
  - aguardando resposta
  - atrasados
  - em negociacao

Comportamento desejado:

- sem blocos enormes
- leitura imediata
- foco em estado da operacao

---

## 5.2 Painel De Filas

Funcao:

- virar a porta de entrada da operacao
- substituir o pensamento de "abrir chat" por "escolher fila"

Filas recomendadas:

- `Novos contatos`
- `Sem responsavel`
- `Aguardando cliente`
- `Retornos atrasados`
- `Prioridade alta`
- `Em negociacao`
- `Matricula em andamento`

Cada fila deve mostrar:

- nome da fila
- total
- variacao recente
- nivel de urgencia visual

Forma visual:

- cards compactos
- contadores fortes
- indicacao de cor por criticidade
- selecionavel como filtro principal

Comportamento:

- ao clicar numa fila, a lista de atendimentos muda
- a fila ativa define o contexto principal da coluna central

---

## 5.3 Lista De Atendimentos

Funcao:

- listar os itens operacionais que precisam de trabalho
- reduzir protagonismo da conversa como unidade visual

O item da lista deixa de ser "chat" e passa a ser "atendimento".

Cada card de atendimento deve mostrar:

- nome do lead
- telefone ou identificador
- curso/interesse
- etapa atual
- responsavel
- ultima acao
- tempo sem resposta
- prioridade
- badges de risco
- contagem de nao lidas

Indicadores importantes:

- `sem responsavel`
- `retorno vencido`
- `quente`
- `aguardando cliente`
- `novo lead`
- `em negociacao`

Estrutura recomendada do card:

1. topo:
   - nome
   - etapa
   - prioridade
2. meio:
   - interesse
   - responsavel
   - resumo curto da ultima interacao
3. rodape:
   - horario/atraso
   - nao lidas
   - proxima acao

Comportamento:

- hover revela acoes secundarias
- clique abre o cockpit do atendimento
- selecao precisa ficar muito clara

---

## 5.4 Cockpit Do Atendimento

Funcao:

- concentrar contexto, historico, conversa e decisao
- ser o coracao da experiencia

O cockpit nao deve parecer um app de mensagens.
Ele deve parecer uma mesa de trabalho comercial.

### Composicao Recomendada

#### Bloco A - Cabecalho Do Atendimento

- nome do lead
- status da etapa
- responsavel
- prioridade
- temperatura
- SLA/tempo sem retorno

#### Bloco B - Resumo Comercial

- interesse principal
- origem
- objecao atual
- proxima acao recomendada
- ultimo movimento relevante

#### Bloco C - Timeline De Atendimento

Mistura:

- mensagens
- mudancas de etapa
- tarefas
- tentativas de contato
- notas operacionais

Isso substitui a ideia de "chat puro" por uma `linha do tempo de atendimento`.

#### Bloco D - Conversa

A conversa continua existindo, mas como uma aba ou modulo do cockpit.

Abas sugeridas:

- `Visao geral`
- `Timeline`
- `Conversa`
- `Tarefas`
- `IA`

#### Bloco E - Painel De Acao

Acoes rapidas:

- assumir atendimento
- transferir
- mudar etapa
- registrar objecao
- agendar retorno
- criar tarefa
- enviar follow-up
- marcar como prioridade

---

## 6. Hierarquia De Navegacao

## Nivel 1

- Atendimento

## Nivel 2 Dentro De Atendimento

- Filas
- Carteira
- Canal
- Campanhas

## Nivel 3 Dentro Do Item

- Visao geral
- Conversa
- Timeline
- Tarefas
- IA

Essa hierarquia deixa o produto mais proximo de CRM e menos de inbox.

---

## 7. Direcao Visual

## 7.1 Sensacao Desejada

- premium
- comercial
- confiavel
- densa, mas clara
- moderna
- menos "app de mensagem"
- mais "central de operacao"

## 7.2 Principios Visuais

- cards operacionais com hierarquia forte
- superficies segmentadas
- densidade informacional controlada
- uso forte de badges e microestados
- destaque para criticidade
- tipografia mais firme nos pontos de decisao

## 7.3 O Que Evitar

- visual de baloes como protagonista
- tela dominada por lista de textos curtos
- excesso de cara de WhatsApp
- area central vazia quando nao ha conversa aberta
- elementos grandes demais para operacao em equipe

---

## 8. Componentes Novos Recomendados

- `AtendimentoQueueBoard`
- `AtendimentoQueueCard`
- `AtendimentoListCard`
- `AtendimentoCockpitHeader`
- `AtendimentoSummaryPanel`
- `AtendimentoTimeline`
- `AtendimentoActionRail`
- `AtendimentoSlaBadge`
- `AtendimentoOwnerBadge`
- `AtendimentoPriorityBadge`

---

## 9. Estados Essenciais

O novo atendimento precisa tratar bem:

- sem responsavel
- sem lead vinculado
- aguardando cliente
- retorno vencido
- risco alto
- atendimento concluido
- conversa vazia
- sem mensagens novas

Todos esses estados precisam ter leitura visual propria.

---

## 10. Fluxo Operacional Ideal

1. usuario entra em `Atendimento`
2. escolhe uma fila
3. visualiza os cards priorizados
4. abre um atendimento
5. entende rapidamente contexto e risco
6. executa uma acao
7. registra resultado
8. passa para o proximo atendimento

Esse fluxo deve ser mais rapido do que o atual para um time.

---

## 11. Ordem Recomendada De Implementacao

### Fase 1

- renomear a experiencia para `Atendimento`
- reestruturar layout macro
- introduzir painel de filas

### Fase 2

- trocar a lista atual por cards operacionais
- reposicionar filtros e ownership

### Fase 3

- transformar a area de conversa em cockpit
- criar timeline de atendimento

### Fase 4

- lapidar responsividade
- revisar a experiencia de equipe
- ajustar IA e acoes rapidas ao novo fluxo

---

## 12. Resultado Esperado

Ao final desse redesenho, a area deve:

- parecer um CRM comercial proprietario
- escalar melhor para mais usuarios
- melhorar triagem
- melhorar distribuicao de trabalho
- reduzir dependencia mental do modelo de chat
- aumentar a velocidade de operacao da equipe

