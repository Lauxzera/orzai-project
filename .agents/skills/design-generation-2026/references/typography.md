# Tipografia — Referência

Leia este arquivo quando o pedido envolver escolhas tipográficas complexas, pares de fontes, escalas ou uso de peso tipográfico como elemento de design.

---

## Princípio central

Tipografia carrega a personalidade do componente. A escolha de fonte não é neutra — é a primeira decisão de personalidade. Pares genéricos (Inter + Inter, Roboto + Roboto) comunicam ausência de ponto de vista.

**Regra:** use no máximo 2 famílias. A display constrói caráter; a body garante legibilidade. Se uma terceira família aparecer, ela substitui uma das duas — nunca se soma.

---

## Escala tipográfica base (mobile-first, fluida)

```css
:root {
  --text-xs:   clamp(0.75rem,  0.7rem + 0.25vw,  0.875rem);  /* 12–14px */
  --text-sm:   clamp(0.875rem, 0.8rem + 0.35vw,  1rem);      /* 14–16px */
  --text-base: clamp(1rem,     0.9rem + 0.5vw,   1.125rem);  /* 16–18px */
  --text-lg:   clamp(1.125rem, 1rem + 0.6vw,     1.25rem);   /* 18–20px */
  --text-xl:   clamp(1.25rem,  1.1rem + 0.75vw,  1.5rem);    /* 20–24px */
  --text-2xl:  clamp(1.5rem,   1.3rem + 1vw,     2rem);      /* 24–32px */
  --text-3xl:  clamp(2rem,     1.6rem + 2vw,     3rem);      /* 32–48px */
  --text-4xl:  clamp(2.5rem,   2rem + 2.5vw,     4rem);      /* 40–64px */
}
```

**Line-heights por uso:**
- Heading: `1.1–1.2`
- Subheading: `1.3–1.4`
- Body: `1.6–1.7`
- Caption/label: `1.4`
- Code: `1.6`

**Letter-spacing por uso:**
- Display grande: `-0.02em` a `-0.04em` (aperta levemente)
- Body: `0` (neutro)
- Uppercase labels: `+0.08em` a `+0.12em` (abre para legibilidade)
- Monospace: `0` (nunca apertar)

---

## Pesos — uso correto

| Peso | Nome    | Quando usar                                           |
|------|---------|-------------------------------------------------------|
| 300  | Light   | Apenas em texto grande (≥ 32px). Nunca em body.       |
| 400  | Regular | Body text, descrições, conteúdo corrido               |
| 500  | Medium  | Labels, subtítulos, texto de UI (botões, nav)         |
| 600  | Semibold| Headings de seção, nomes em cards                     |
| 700  | Bold    | Display, headlines, números de impacto                |
| 800+ | Black   | Só quando a personalidade da marca exige              |

**Anti-padrão:** usar 600 e 700 juntos na mesma hierarquia. A diferença visual é mínima e confunde. Escolha um.

---

## Pares de fontes aprovados por personalidade

### Técnico / Produto / B2B
- Display: `Inter` (600–700) + Body: `Inter` (400) — funcional, sem personalidade, só use se for a identidade
- Display: `DM Sans` (600) + Body: `DM Sans` (400) — mais caráter que Inter, ainda clean
- Display: `Space Grotesk` (600) + Body: `Inter` (400) — técnico com personalidade geométrica
- Display: `Syne` (700) + Body: `DM Sans` (400) — arrojado, editorial tech

### Editorial / Conteúdo / Blog
- Display: `Playfair Display` (700) + Body: `Source Serif 4` (400) — clássico editorial
- Display: `Fraunces` (700 italic) + Body: `Literata` (400) — warm editorial
- Display: `DM Serif Display` (400) + Body: `DM Sans` (400) — contraste serif/sans elegante

### Startup / Consumer / App
- Display: `Plus Jakarta Sans` (700) + Body: `Plus Jakarta Sans` (400) — moderno, amigável
- Display: `Outfit` (700) + Body: `Outfit` (400) — geométrico suave
- Display: `Nunito` (800) + Body: `Nunito` (400) — arredondado, acessível

### Premium / Luxury / Institucional
- Display: `Cormorant Garamond` (300–400 italic) + Body: `Jost` (300–400) — elegância máxima
- Display: `Editorial New` / `PP Editorial` (se disponível) + Body: `Helvetica Neue` — editorial de alto nível
- Display: `Libre Baskerville` (700) + Body: `Source Sans 3` (400) — confiável, institucional

### Código / Dev Tools / Terminal
- Display: `JetBrains Mono` (700) + Body: `JetBrains Mono` (400) — coerência total
- Display: `Space Mono` (700) + Body: `Inter` (400) — mono como statement, sans para leitura

---

## Itálico como destaque (padrão VM2 e tendência 2026)

Em vez de cor de destaque, use itálico seletivo na primeira ou segunda palavra de headings:

```html
<h2>
  <em>Quando</em> chamar a gente
</h2>
```

```css
h2 em {
  font-style: italic;
  /* Sem cor adicional. O contraste vem da forma, não da pigmentação. */
}
```

Este padrão funciona especialmente com fontes que têm itálico com personalidade (Playfair, Fraunces, Cormorant, DM Serif Display).

---

## Tipografia fluida em números de impacto

Para stat cards, contadores e números grandes:

```css
.stat-value {
  font-size: clamp(2.5rem, 5vw, 5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums; /* alinha colunas de números */
}
```

---

## Hierarquia em componentes de card

Ordem de importância visual (de maior para menor peso/tamanho):

1. **Número ou dado principal** — maior, mais bold
2. **Título/nome** — heading peso 600, tamanho lg/xl
3. **Descrição** — body regular, tamanho base, cor muted
4. **Metadado/label** — xs, uppercase, tracked, cor tertiary
5. **CTA** — medium, tamanho sm, distância clara dos demais

Nunca coloque dois itens no mesmo nível de peso/tamanho se eles têm importâncias diferentes.

---

## Erros comuns a evitar

| Erro | Correção |
|------|----------|
| Usar 3+ famílias de fonte | Máximo 2. Diversidade de peso compensa. |
| Body em 12–13px | Mínimo 14px para texto lido. Captions aceitam 12px. |
| Heading sem letter-spacing negativo em tamanho grande | Fontes grandes precisam de aperto sutil (`-0.02em`). |
| Label uppercase sem letter-spacing positivo | Uppercase sem tracking parece comprimido. Use `+0.08em`. |
| Bold em texto corrido | Bold em body é ruído. Use para no máximo 3–4 palavras. |
| Line-height 1.0 em body | Mínimo 1.5. Para parágrafos longos, 1.7. |
