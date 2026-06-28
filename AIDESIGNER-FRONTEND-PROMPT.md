# Prompt Da Skill AIDesigner Frontend

Fonte original:
- `C:\Users\D&D\Documents\Codex\2026-04-24\crie-um-crm-simples-e-operacional\.agents\skills\aidesigner-frontend\SKILL.md`

## Objetivo

Usar o `AIDesigner` para definir uma direcao visual forte e depois portar essa direcao para o frontend real do projeto, em vez de publicar HTML cru.

## Missao

1. Inspecionar o repositorio antes de qualquer geracao.
2. Gerar ou refinar um artefato HTML no AIDesigner.
3. Capturar esse artefato em uma execucao local.
4. Renderizar preview e gerar um resumo de adocao.
5. Em trabalhos de clone, executar uma rodada local de QA visual antes de concluir.
6. Portar o design para rotas, componentes, tokens e primitives reais do projeto.

## Padroes De Escopo

- Gastar creditos do AIDesigner apenas quando o usuario pedir explicitamente esse fluxo ou deixar isso claro.
- Preferir o servidor MCP conectado do `aidesigner` para `whoami`, `get_credit_status`, `generate_design` e `refine_design`.
- Tratar o HTML retornado primeiro como artefato de design e depois como insumo de implementacao.
- Preferir uma direcao visual coesa em vez de varias opcoes fracas.

## Autenticacao E Superficie De Execucao

- Em Codex ou Claude Code, preferir o MCP conectado do `aidesigner`, que usa creditos da conta via OAuth.
- Para uso local fora do MCP do host, `AIDESIGNER_MCP_ACCESS_TOKEN` e o bearer token preferido.
- `AIDESIGNER_API_KEY` continua como fallback explicito para CI ou uso manual.
- `AIDESIGNER_MCP_URL` e `AIDESIGNER_BASE_URL` sao opcionais.
- Para operacoes locais em arquivos, usar sempre a CLI oficial do AIDesigner. Nao montar chamadas `curl` manualmente.

```bash
npx -y @aidesigner/agent-skills <verbo> ...
```

Verbos suportados:

- `init`
- `doctor`
- `capture`
- `preview`
- `adopt`

## Pre-Flight

1. Antes de gerar qualquer coisa, procurar contexto de design no repositorio nesta ordem:
   - `DESIGN.md`, `.aidesigner/DESIGN.md` ou `docs/design.md`, se existirem
   - arquivos de tema, tokens, Tailwind config, variaveis CSS, fontes e primitives compartilhadas
   - a rota ou pagina alvo e componentes proximos para entender layout e interacao reais
2. Se nao existir um brief de design, inspecionar o codigo e inferir o design system atual antes de gastar creditos.
3. Montar um brief interno curto cobrindo:
   - plataforma e superficie alvo
   - objetivo do produto e acao principal do usuario
   - linguagem visual atual a preservar ou da qual se afastar
   - padroes, restricoes e tipos de conteudo importantes do repositorio
   - tipografia, tokens, superficies, espacamentos e motion apenas quando o projeto ja os definir ou o usuario quiser preservar a estetica atual
   - restricoes explicitas e itens que nao podem quebrar
4. Decidir se a solicitacao e:
   - geracao por prompt
   - `clone` para recriacao fiel de uma URL especifica
   - `enhance` para redesenho preservando conteudo/intencao de uma URL especifica
   - `inspire` para nova direcao visual inspirada por uma URL especifica
5. Se a solicitacao for `clone`, verificar se existe ferramenta de screenshot/browser automation antes de gastar creditos.
   - Confirmar se Puppeteer ou equivalente ja esta disponivel
   - Se nao estiver, instalar no repositorio com o gerenciador de pacotes do projeto
   - Nao iniciar clone sem condicao de QA visual depois

## Fluxo De Trabalho

### 1. Construir O Prompt Visual

- Separar o trabalho em duas camadas:
  - prompt visual de referencia para o AIDesigner
  - especificacao de implementacao mantida localmente
- Converter o pedido do usuario e o brief em um prompt visual amplo.
- Dar liberdade ao AIDesigner para inventar composicao, estrutura, ritmo visual e estilo.
- Focar o prompt em tipo de produto, publico, prioridades de UX, sensacao desejada e restricoes nao negociaveis.
- Nao prescrever ordem exata de secoes, quantidade de cards, copy, labels de botoes ou posicionamento detalhado, a menos que o usuario tenha pedido isso explicitamente.
- Nao despejar documentacao inteira, inventario de conteudo, tabelas ou detalhes excessivos no prompt.
- Se o usuario tiver dado um PRD muito detalhado, comprimir isso em requisitos visuais menores para o AIDesigner e manter o detalhamento para a fase de implementacao.
- O prompt do AIDesigner deve ser curto e dirigido artisticamente, nao um PRD completo.
- Se o repositorio ja tiver um design system consolidado ou o usuario quiser manter a estetica, direcionar o prompt para consistencia com esse sistema.
- Se o repositorio for novo ou o usuario quiser uma mudanca visual, manter o prompt mais aberto na parte estetica, descrevendo a sensacao desejada sem travar tudo em cores exatas, gradientes ou paleta rigida, salvo pedido explicito.

### 2. Gerar Ou Refinar

- Se houver MCP conectado do `aidesigner`, chamar `generate_design` ou `refine_design` com um resumo compacto do repositorio em `repo_context`.
- Se estiver usando a CLI/helper, ela mesma faz a leitura do repositorio.
- Manter as chamadas MCP guiadas por prompt, salvo se o usuario tiver pedido fluxo com URL de referencia.
- Usar `clone` apenas quando o usuario pedir copia fiel.
- Usar `enhance` apenas quando o usuario pedir modernizacao/melhoria preservando intencao.
- Usar `inspire` apenas quando o usuario pedir uma nova direcao inspirada em uma URL.
- Em `clone`, confirmar primeiro a disponibilidade de ferramenta para screenshots.
- Se o usuario apenas citar uma URL como contexto, nao passar `mode` nem `url`.
- Se o usuario quiser `clone`, `enhance` ou `inspire` sem URL, parar e pedir a URL antes de gastar creditos.
- Se estiver continuando uma execucao anterior com referencia, preferir `refine_design` mantendo `mode` e `url`.
- Se o usuario quiser se afastar da referencia, abandonar `mode` e `url` e seguir com prompt puro.
- Se o trabalho com AIDesigner for recorrente, pode-se sugerir criar um `DESIGN.md` ou `.aidesigner/DESIGN.md` revisavel por humanos. Nao criar isso silenciosamente.

Se o MCP tiver sucesso, persistir o HTML localmente:

```bash
npx -y @aidesigner/agent-skills capture --html-file .aidesigner/mcp-latest.html \
  --prompt "<prompt final>" \
  --transport mcp \
  --remote-run-id "<run-id>"
```

Se o MCP estiver indisponivel ou com autenticacao expirada:

- Se `AIDESIGNER_API_KEY` ja estiver configurada, usar `generate` ou `refine` pela CLI como fallback explicito.
- Caso contrario, parar e explicar como conectar o AIDesigner:
  1. Rodar `npx -y @aidesigner/agent-skills init` neste repositorio, ou `--scope user` para todos os repositorios
  2. Abrir o cliente host
  3. Abrir o painel de MCP ou fluxo de login
  4. Conectar o servidor `aidesigner` e concluir o login no navegador
  5. Tentar novamente
- Mencionar como alternativa o uso de `AIDESIGNER_API_KEY`

### 3. Preview E Adocao

- Depois de cada execucao bem-sucedida, garantir que haja visual para o usuario.
- Usar o preview criado pelo `capture` ou rodar:

```bash
npx -y @aidesigner/agent-skills preview --id <run-id>
```

- Rodar a analise de adocao antes de portar:

```bash
npx -y @aidesigner/agent-skills adopt --id <run-id>
```

### 3A. Loop De QA Para Clone

- Se a solicitacao for `clone`, nao parar na primeira geracao.
- QA de clone precisa ser visual, nao apenas textual.
- Capturar screenshots do resultado gerado com browser automation.
- Se o clone ja tiver sido portado para o repositorio, capturar screenshots da implementacao integrada, nao so do HTML bruto.
- Comparar com a URL de referencia e screenshots disponiveis.
- Verificar:
  - ordem e quantidade de secoes
  - geometria principal do layout
  - espacamentos e alinhamentos
  - escala tipografica, peso e line-height
  - papel, crop e posicionamento das imagens
  - fundos, gradientes, bordas, sombras e overlays
  - quantidade de blocos repetidos, como logos, cards, FAQs e colunas de footer
- Se nao houver ferramenta de screenshot, parar e reportar o bloqueio.
- Se ainda houver diferenca relevante, corrigir localmente no artefato HTML ou no codigo do repositorio.
- Renderizar preview novo e comparar novamente ate que reste so diferenca pequena ou um bloqueio real.
- Usar `refine_design` apenas quando o clone estiver estruturalmente distante demais.
- Se o clone ja estiver no projeto, preferir QA sobre a implementacao integrada.

### 4. Portar Para O Repositorio

- Usar a saida do AIDesigner como referencia forte de design.
- Nao colar HTML standalone diretamente em repositorios com stack real.
- O artefato tem duas camadas:
  - **Camada de design system:** reproduzir com precisao cores, gradientes, sombras, raios de borda, spacing, tipografia, opacidades, hovers, transitions e estrutura de layout. Converter isso para os tokens e primitives do projeto.
  - **Camada de conteudo:** copy, quantidade de secoes, labels, dados mockados e afins podem ser adaptados ao contexto real do produto.
- Excecao de clone: se o artefato usar midias reais essenciais para fidelidade, preservar esses assets.
- Para clones, executar uma auditoria de assets antes de concluir.
- Portar metodicamente:
  1. extrair tokens e tema do artefato
  2. portar componentes respeitando valores exatos de spacing, sizing e efeitos
  3. evitar substituicoes "aproximadas" quando o artefato definiu valores concretos
- Reusar rotas, componentes e tokens existentes do projeto sempre que possivel.
- Preservar acessibilidade basica e responsividade.

### 5. Paralelizar Portagens Grandes Com Subagentes

- Se o artefato for grande o bastante para dividir por secoes ou familias de componentes, quebrar a implementacao em partes focadas.
- Manter no agente principal:
  - extracao de tokens
  - primitives compartilhadas
  - shell da rota e composicao geral
  - integracao final
- Usar subtarefas para blocos independentes, como:
  - hero
  - features
  - pricing
  - testimonial rail
  - FAQ
  - footer
  - grupos de paineis
  - familias repetidas de cards
- Dividir por secao ou familia coerente, nao por pedacos arbitrarios de DOM.
- Definir claramente:
  - escopo da secao
  - arquivos-alvo
  - fragmento do artefato ou screenshot relevante
  - tokens e restricoes visuais nao negociaveis
- Evitar multiplos agentes alterando o mesmo arquivo.
- Depois, consolidar primitives, remover duplicacoes de token e harmonizar a composicao.

## Saidas Obrigatorias

Apos uma execucao bem-sucedida, registrar ou entregar:

- prompt visual final ou resumo conciso do prompt
- `remote run id`, se houver retorno do MCP
- `local run id` em `.aidesigner/runs/<run-id>/`
- caminho do preview gerado
- caminho do adoption brief, ou confirmacao de que foi rodado
- rota, componente ou superficie alvo para integracao no projeto
- bloqueios ou riscos pendentes, se o design nao puder ser adotado por completo

## Referencias

- Contrato de API e comportamento do helper:
  - `references/api.md`
- Criterio de qualidade de adocao frontend:
  - `references/frontend-rubric.md`

## Regras Operacionais

- Se nem MCP nem `AIDESIGNER_API_KEY` estiverem disponiveis, parar e explicar como rodar `npx -y @aidesigner/agent-skills init` e reconectar.
- Nao apresentar HTML cru como implementacao final integrada em repositorios com framework.
- Aplicar os requisitos detalhados originais durante a implementacao, nao enfiando tudo no prompt do AIDesigner.
- Se o contexto do repositorio conflitar com a intencao do usuario, preservar o design system existente, salvo pedido explicito de nova direcao visual.
