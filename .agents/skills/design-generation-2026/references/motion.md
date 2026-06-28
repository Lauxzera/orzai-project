# Motion — Referência

Leia este arquivo quando o pedido envolver animações, transições, micro-interações ou qualquer elemento em movimento.

---

## Princípio central em 2026

Motion ganha seu lugar — não piscando, mas guiando. A pergunta correta não é "que animação adiciono?" mas "o que o usuário precisa entender que só o movimento pode comunicar?"

**As três funções legítimas de motion:**
1. **Confirmar** — a ação foi registrada (form submit, like, delete)
2. **Orientar** — o conteúdo veio de onde / foi para onde (modal abre de baixo, toast vem do topo)
3. **Revelar estado** — algo mudou no sistema (loading, progresso, erro)

Tudo além disso é decoração. Decoração tem custo: aumenta payload, consome bateria, desequilibra usuários com distúrbios vestibulares, e em 2026 sinaliza design gerado por template.

---

## Obrigatoriedade: `prefers-reduced-motion`

**Todo componente com animação deve respeitar esta media query.** Sem exceção.

```css
/* Padrão: animação ativa */
.element {
  transition: transform 200ms ease-out, opacity 200ms ease-out;
}

/* Usuário solicitou menos movimento */
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
  }
}
```

Alternativa para propriedades que ainda fazem sentido sem movimento:

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: opacity 100ms linear; /* mantém fade, remove transform */
  }
}
```

---

## Biblioteca de micro-interações

### Hover em cards

```css
.card {
  transition: box-shadow 200ms ease-out, transform 200ms ease-out;
}
.card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .card { transition: box-shadow 150ms linear; }
  .card:hover { transform: none; }
}
```

**Quando usar:** Cards clicáveis, links de produto, itens de lista navegáveis.
**Quando não usar:** Cards informativos sem ação, stat cards, cards de status.

---

### Botão — feedback de clique

```css
.btn {
  transition: background-color 150ms ease, transform 100ms ease;
}
.btn:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .btn:active { transform: none; }
}
```

---

### Focus ring animado

```css
.interactive:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  /* Sem animação — focus deve ser imediato e óbvio */
}
```

Nunca anime o focus ring. Usuários de teclado dependem dele como orientação espacial.

---

### Entrada de elementos (scroll-reveal)

```css
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 400ms ease-out, transform 400ms ease-out;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

```javascript
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  }),
  { threshold: 0.1 }
);
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

**Regra de stagger:** se múltiplos elementos entram juntos, use delay incremental de 60–80ms entre eles. Acima de 5 elementos, não aplique stagger — parece lento.

---

### Toast / Notificação

```css
.toast {
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 200ms ease;
}
.toast.show {
  transform: translateY(0);
  opacity: 1;
}
.toast.hide {
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 200ms ease-in, opacity 150ms ease-in;
}
```

**Origem:** toasts vêm de cima (confirmação de ação concluída), alertas críticos vêm do centro (modais).

---

### Modal / Overlay

```css
.overlay {
  opacity: 0;
  transition: opacity 200ms ease;
}
.overlay.open { opacity: 1; }

.modal {
  transform: translateY(20px) scale(0.98);
  opacity: 0;
  transition: transform 250ms cubic-bezier(0.34, 1.2, 0.64, 1),
              opacity 200ms ease;
}
.modal.open {
  transform: translateY(0) scale(1);
  opacity: 1;
}
```

---

### Loading skeleton

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-skeleton-base) 25%,
    var(--color-skeleton-highlight) 50%,
    var(--color-skeleton-base) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-skeleton-base);
  }
}
```

---

## Tabela de durações e easings

| Tipo de movimento | Duração | Easing | Por quê |
|---|---|---|---|
| Hover simples (cor, borda) | 100–150ms | `ease` | Deve parecer instantâneo |
| Hover com transform | 200ms | `ease-out` | Sai rápido, desacelera |
| Clique / active state | 80–100ms | `ease` | Feedback imediato |
| Entrada de elemento | 300–400ms | `ease-out` | Chega rápido, assenta |
| Saída de elemento | 200–250ms | `ease-in` | Sai mais rápido que entrou |
| Modal abrir | 250ms | `cubic-bezier(0.34, 1.2, 0.64, 1)` | Leve overshoot dá sensação física |
| Modal fechar | 200ms | `ease-in` | Mais rápido — usuário já decidiu |
| Scroll reveal | 400ms | `ease-out` | Mais lento — conteúdo se apresenta |
| Toast entrada | 250ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot comunica chegada |
| Toast saída | 200ms | `ease-in` | Sai sem chamar atenção |
| Skeleton shimmer | 1.5s | `ease-in-out infinite` | Lento e contínuo = processando |

---

## State-aware motion (tendência 2026)

Animações que respondem dinamicamente ao input do usuário e à lógica do sistema:

```javascript
// Animação de submit que comunica estado
async function handleSubmit(btn, form) {
  // Estado: enviando
  btn.disabled = true;
  btn.style.setProperty('--btn-width', btn.offsetWidth + 'px');
  btn.classList.add('loading');

  try {
    await submitForm(form);
    // Estado: sucesso
    btn.classList.remove('loading');
    btn.classList.add('success');
    setTimeout(() => btn.classList.remove('success'), 2000);
  } catch {
    // Estado: erro
    btn.classList.remove('loading');
    btn.classList.add('error');
    btn.disabled = false;
  }
}
```

```css
.btn.loading { /* spinner inline */ }
.btn.success {
  background: var(--color-success);
  transition: background 200ms ease;
}
.btn.error {
  animation: shake 300ms ease;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-4px); }
  75%       { transform: translateX(4px); }
}
```

---

## O que nunca fazer

- **Animações em loop sem controle do usuário** — exceto skeletons e spinners (estados de espera). Todo loop precisa de um `pause` ou `stop`.
- **Parallax pesado** — impacta performance em scroll e causa náusea em usuários sensíveis.
- **Transições em `width`, `height` ou `top/left`** — use `transform: scaleX()` e `transform: translate()`. Propriedades de layout forçam reflow.
- **Múltiplas animações simultâneas no mesmo elemento** — confunde o usuário sobre o que mudou.
- **`transition: all`** — nunca. Anime apenas as propriedades que mudam.
- **Durações acima de 500ms sem justificativa** — acima de 400ms o usuário percebe como lento.
