# Padrões de Componentes — Referência

Leia este arquivo quando o pedido envolver um dos componentes catalogados abaixo. Cada padrão inclui variações aprovadas, anti-padrões e decisões de design justificadas.

---

## Hero Section

**Trabalho único:** comunicar o valor principal em menos de 5 segundos e orientar a próxima ação.

### Variações aprovadas

**A — Headline + CTA (mais direto)**
```
[Headline grande — 1 ou 2 linhas]
[Subtítulo — 1 linha, explica o headline]
[Botão primário] [Link secundário]
```
Use quando: o produto/serviço é autoexplicativo. Headline carrega o peso.

**B — Headline + prova social**
```
[Headline grande]
[Subtítulo]
[Logos de clientes ou número de usuários]
[Botão CTA]
```
Use quando: a credibilidade é o principal diferencial.

**C — Headline + visual (split)**
```
[Esquerda: headline + subtítulo + CTA]   |   [Direita: visual/screenshot/ilustração]
```
Use quando: o produto tem interface visual que vale mostrar.

### Anti-padrões
- Headline com mais de 10 palavras que tente dizer tudo
- CTA genérico ("Saiba mais", "Clique aqui") sem indicar o que acontece
- Mais de 2 CTAs no hero — força decisão, paralisa o usuário
- Background complexo que compete com o texto

### CSS base

```css
.hero {
  padding: clamp(4rem, 10vw, 8rem) var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}
.hero-headline {
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  max-width: 16ch; /* quebra em no máximo ~3 linhas */
}
.hero-sub {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: var(--color-text-muted);
  max-width: 48ch;
  line-height: 1.6;
  margin-top: var(--space-4);
}
.hero-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-8);
}
```

---

## Card

**Trabalho único:** apresentar uma unidade de informação de forma escaneável, com uma ação clara ou navegação.

### Anatomia

```
┌─────────────────────────────┐
│ [Imagem ou ícone opcional]  │
│                             │
│ Eyebrow/categoria           │
│ Título do card              │
│ Descrição curta (2–3 linhas)│
│                             │
│ Metadado       [CTA →]      │
└─────────────────────────────┘
```

### Variações

**Card de conteúdo (artigo, post)**
- Imagem de destaque (aspect-ratio: 16/9 ou 3/2)
- Categoria em uppercase tracked
- Título em peso 600
- Trecho em muted
- Data ou tempo de leitura como metadado

**Card de produto/serviço**
- Ícone ou visual (não foto)
- Nome + descrição de 1 linha
- Features em lista curta (3 itens max)
- Preço ou CTA

**Card de depoimento**
- Avatar ou logo
- Citação em itálico (3–4 linhas max)
- Nome + cargo/empresa

**Stat card**
- Número grande (fonte weight 700, clamp de tamanho)
- Label descritiva abaixo
- Contexto opcional (vs. período anterior)

### CSS base

```css
.card {
  background: var(--color-surface);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  transition: box-shadow 200ms ease-out, transform 200ms ease-out;
}
.card:hover {  /* apenas se clicável */
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  transform: translateY(-2px);
}
.card-eyebrow {
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-2);
}
.card-title {
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: var(--space-2);
}
.card-desc {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.6;
  /* Limitar linhas */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## Formulário

**Trabalho único:** coletar informação do usuário com mínimo atrito e máximo de clareza sobre o que é esperado.

### Princípios de form design (2026)

1. **Um campo por vez em mobile** — se o form tem mais de 3 campos, considere fluxo passo a passo
2. **Label sempre visível** — placeholder não substitui label. Desaparece quando o usuário começa a digitar.
3. **Erro inline, próximo ao campo** — nunca no topo da página
4. **Botão descreve a consequência** — "Criar conta", "Enviar pedido", não "Confirmar"
5. **Autocomplete** — use atributos `autocomplete` corretos para agilizar preenchimento

### CSS base

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}
input, textarea, select {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;
  width: 100%;
}
input:hover, textarea:hover {
  border-color: var(--color-border-hover);
}
input:focus-visible, textarea:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
input[aria-invalid="true"] {
  border-color: var(--color-error);
}
.field-error {
  font-size: var(--text-xs);
  color: var(--color-error);
  display: flex;
  align-items: center;
  gap: 4px;
}
.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}
```

---

## Navegação (Nav)

### Padrões por contexto

**Nav horizontal (desktop, site institucional)**
```
[Logo]    [Link] [Link] [Link] [Link]    [CTA Button]
```
- Logo à esquerda, CTA à direita
- Links em weight 400–500, sem underline
- CTA diferenciado (cor, borda ou pill)
- Sticky apenas se adicionar valor de navegação (não por default)

**Nav com dropdown**
- Dropdown abre em hover no desktop, toque no mobile
- Fundo com leve sombra para separar do conteúdo
- Fecha com Esc e click fora
- `aria-expanded` atualizado programaticamente

**Nav mobile (hamburger)**
- Menu abre em overlay ou drawer lateral
- Foco vai para o primeiro item ao abrir
- Foca de volta no botão hamburger ao fechar
- `aria-label="Menu de navegação"` no botão

### CSS base (horizontal)

```css
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  height: 64px;
  border-bottom: 0.5px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-bg);
  z-index: 50;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  list-style: none;
}
.nav-link {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 150ms ease;
}
.nav-link:hover,
.nav-link[aria-current="page"] {
  color: var(--color-text);
}
```

---

## Dashboard / Data Display

**Trabalho único:** comunicar estado do sistema e métricas relevantes de forma escaneável, sem exigir análise.

### Hierarquia de informação

1. **KPIs principais** — números grandes, no topo, max 4
2. **Tendências** — gráficos secundários abaixo dos KPIs
3. **Tabelas detalhadas** — sempre abaixo dos gráficos
4. **Ações** — contextuais aos dados que as motivam

### Princípios de data display

- **Rótulo antes do número** — o usuário precisa saber o que está lendo antes de ler
- **Unidade junto ao número** — "R$ 42.800" não "42800" + "Reais" em outra linha
- **Tendência com contexto** — "+12% vs. mês anterior" não apenas "+12%"
- **Cor em dados** — apenas para codificar significado (vermelho = queda, verde = crescimento), nunca para decoração
- **Tabelas com `table-layout: fixed`** — evita expansão descontrolada
- **Números alinhados à direita** em colunas — facilita comparação visual

### CSS base (grid de KPIs)

```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}
.kpi-card {
  background: var(--color-surface);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
}
.kpi-label {
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-2);
}
.kpi-value {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.kpi-delta {
  font-size: var(--text-xs);
  margin-top: var(--space-2);
}
.kpi-delta.positive { color: var(--color-success); }
.kpi-delta.negative { color: var(--color-error); }
```
