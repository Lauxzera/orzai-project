# Acessibilidade — Referência

Leia este arquivo quando o pedido envolver auditoria de acessibilidade, componentes interativos complexos ou quando o contexto indicar público diverso.

Em 2026, acessibilidade é infraestrutura — não feature. Código que falha nos itens abaixo não está pronto para produção.

---

## Checklist mínimo obrigatório

Todo componente gerado deve passar neste checklist antes de ser entregue:

### Contraste

- [ ] Texto normal (< 18px ou < 14px bold): contraste ≥ **4.5:1** contra o fundo
- [ ] Texto grande (≥ 18px ou ≥ 14px bold): contraste ≥ **3:1**
- [ ] Elementos de UI (bordas de inputs, ícones informativos): contraste ≥ **3:1**
- [ ] Texto sobre imagem ou gradiente: testar no ponto mais desfavorável

Ferramentas de referência: [contrast-ratio.com](https://contrast-ratio.com), [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

Combinações problemáticas comuns:
- Cinza `#888` sobre branco `#fff` → **4.48:1** (passa no limite, mas é arriscado)
- Cinza `#999` sobre branco → **2.85:1** (falha — nunca use para texto)
- Placeholder cinza claro → quase sempre falha; use `#767676` no mínimo

### HTML semântico

```html
<!-- Ação → button -->
<button type="button" onclick="doSomething()">Salvar</button>

<!-- Navegação → a -->
<a href="/sobre">Sobre nós</a>

<!-- NUNCA div para ação -->
<div onclick="doSomething()">❌ Não clique</div>
```

Estrutura de headings obrigatória:
- Uma única `<h1>` por página
- Hierarquia sem pular níveis: h1 → h2 → h3 (nunca h1 → h3)
- Headings comunicam estrutura, não apenas tamanho visual

### Focus management

```css
/* Nunca remova o outline sem substituir */
:focus { outline: none; }              /* ❌ */
:focus-visible {                        /* ✅ */
  outline: 2px solid var(--color-focus, #0066CC);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Para elementos com background próprio */
:focus-visible {
  box-shadow: 0 0 0 3px var(--color-focus-ring, rgba(0,102,204,0.4));
}
```

### Atributos ARIA essenciais

```html
<!-- Botão apenas com ícone -->
<button aria-label="Fechar modal">
  <svg aria-hidden="true">...</svg>
</button>

<!-- Input sem label visível -->
<input type="search" aria-label="Buscar produtos" placeholder="Buscar...">

<!-- Elemento de loading -->
<div aria-live="polite" aria-label="Carregando resultados">
  <div class="spinner" role="status"></div>
</div>

<!-- Modal -->
<div role="dialog"
     aria-modal="true"
     aria-labelledby="modal-title"
     aria-describedby="modal-desc">
  <h2 id="modal-title">Confirmar exclusão</h2>
  <p id="modal-desc">Esta ação não pode ser desfeita.</p>
</div>

<!-- Nav com múltiplas navs na página -->
<nav aria-label="Navegação principal">...</nav>
<nav aria-label="Navegação do rodapé">...</nav>
```

### Cor como único portador de informação — nunca

```html
<!-- ❌ Errado: só a cor diferencia estado -->
<span style="color: red">Campo obrigatório</span>

<!-- ✅ Correto: ícone + texto + cor -->
<span style="color: var(--color-error)">
  <svg aria-hidden="true"><!-- ícone de erro --></svg>
  Campo obrigatório
</span>
```

Aplica-se a: mensagens de erro, badges de status, gráficos, indicadores de step.

### Tamanho de toque mínimo

Elementos interativos em dispositivos touch: **mínimo 44×44px** de área clicável.

```css
.btn-small {
  min-width: 44px;
  min-height: 44px;
  padding: 10px 16px; /* garante área mesmo com texto curto */
}

/* Para ícones pequenos, expanda a área sem mudar o visual */
.icon-btn {
  padding: 12px;
  margin: -12px; /* compensa o padding sem deslocar o layout */
}
```

---

## Padrões de componentes acessíveis

### Formulário

```html
<div class="field">
  <label for="email">
    E-mail
    <span aria-hidden="true" style="color: var(--color-error)">*</span>
    <span class="sr-only">(obrigatório)</span>
  </label>
  <input
    type="email"
    id="email"
    name="email"
    required
    autocomplete="email"
    aria-describedby="email-hint email-error"
    aria-invalid="false"
  >
  <span id="email-hint" class="hint">Use seu e-mail corporativo</span>
  <span id="email-error" class="error" role="alert" hidden>
    E-mail inválido. Verifique o formato.
  </span>
</div>
```

```css
/* Screen reader only — visualmente oculto mas acessível */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
```

### Toggle / Switch

```html
<button
  role="switch"
  aria-checked="false"
  aria-label="Receber notificações por e-mail"
  class="toggle"
  onclick="this.setAttribute('aria-checked',
    this.getAttribute('aria-checked') === 'true' ? 'false' : 'true')"
>
  <span class="toggle-thumb" aria-hidden="true"></span>
</button>
```

### Tabs

```html
<div role="tablist" aria-label="Opções de plano">
  <button role="tab" aria-selected="true"  aria-controls="panel-mensal"  id="tab-mensal">Mensal</button>
  <button role="tab" aria-selected="false" aria-controls="panel-anual"   id="tab-anual" tabindex="-1">Anual</button>
</div>
<div role="tabpanel" id="panel-mensal" aria-labelledby="tab-mensal">...</div>
<div role="tabpanel" id="panel-anual"  aria-labelledby="tab-anual"  hidden>...</div>
```

Navegação por teclado: setas ← → movem entre tabs; Enter/Space ativa.

---

## Dual audience: humanos e LLMs (2026)

Em 2026, páginas são escaneadas por LLMs para responder buscas. Acessibilidade semântica beneficia ambos:

```html
<!-- Metadados estruturados para LLMs -->
<article itemscope itemtype="https://schema.org/Product">
  <h1 itemprop="name">Nome do produto</h1>
  <p itemprop="description">Descrição clara e direta.</p>
  <span itemprop="price">R$ 299,00</span>
</article>

<!-- Hierarquia de heading clara beneficia leitores de tela E crawlers -->
<main>
  <h1>Título principal da página</h1>
  <section>
    <h2>Primeira seção</h2>
    <h3>Subseção</h3>
  </section>
</main>
```
