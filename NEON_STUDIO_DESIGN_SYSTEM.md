# Neon Studio Design System

Este documento detalha as diretrizes visuais, tokens e a estrutura do "Neon Studio", a identidade de interface premium criada para o Base CRM. O objetivo principal deste design system é prover uma interface futurista, imersiva, elegante e baseada no uso intensivo de *glassmorphism* (efeito de vidro translúcido) e luzes de neon.

**Sempre que uma IA ou desenvolvedor for criar ou refatorar uma tela, este documento deve ser lido e seguido estritamente.**

## Princípios de Design
1. **Remoção do aspecto "Caixa"**: Não usamos bordas rústicas ou sólidas marcadas (ex: `border-slate-200` ou `border-gray-800`). Em vez disso, delimitamos espaços através da diferença de tons e bordas translúcidas de baixíssima opacidade (`border-white/5`).
2. **Glassmorphism**: Todos os painéis flutuantes (como sidebars laterais de leads, modais, cards importantes) usam transparência de fundo combinada com o filtro CSS `backdrop-blur`.
3. **Efeitos de Neon (Glow)**: Ações primárias e indicadores de status emanam luz. Isso é feito usando sombras (`box-shadow`) coloridas de grande difusão e baixa opacidade.
4. **Hierarquia de Texto Suave**: Textos longos ou secundários nunca usam cor sólida bruta (como branco total ou cinza sólido). O desfoque natural acontece usando branco com controle de opacidade.

## Tokens & Classes (TailwindCSS)

### 1. Fundo Global e Superfícies (Backgrounds)
A cor primária do "vazio" é o preto puro quebrado, não usamos o fundo negro padrão.
- **Background Principal (App Base)**: `bg-[#080808]`
- **Superfície Secundária (Paineis, Wrappers grandes)**: `bg-[#0a0a0a]/95`, `bg-[#0c0c0c]` ou `bg-[#0c0c0c]/80` com `backdrop-blur-[24px]`.
- **Cartões Menores (Cards de informações)**: `bg-white/[0.015]`, `bg-white/[0.02]` ou `bg-white/5` acompanhado de um leve blur.
- **Inputs e Áreas interativas inativas**: `bg-white/5`

### 2. Bordas (Borders)
- **Painéis Maiores e Cards**: `border border-white/5`
- **Inputs, Checkboxes e Delimitadores Internos**: `border-white/10`

### 3. Arredondamentos (Border Radius)
O estilo Neon Studio aboliu quinas quadradas para quase todos os blocos principais.
- **Wrappers Maiores (Paineis completos, seções de dashboard)**: `rounded-[32px]` ou `rounded-[24px]`
- **Cartões Comuns, Cards de Lead**: `rounded-[20px]` ou `rounded-[16px]`
- **Inputs, Botões Grandes**: `rounded-[16px]`
- **Botões Menores, Badges Internas**: `rounded-[12px]` ou `rounded-full`

### 4. Cores Semânticas e Sombras Neon (Glow)
A sombra é usada não para profundidade (como no Material Design), mas para iluminação (Glow Effect).

- **Cor Primária (Rose/Pink do Base CRM)**: 
  - Fundo inativo: `bg-primary/10`
  - Texto: `text-primary`
  - Borda: `border-primary/20`
  - Efeito Neon: `shadow-[0_0_15px_rgba(219,13,113,0.2)]` (o RGB deve ser ajustado para a exata cor do primary se necessário).
  
- **Sucesso (Verde Emerald)**:
  - Estilo de card: `border-emerald-500/25 bg-emerald-500/10 text-emerald-400`
  - Efeito Neon: `shadow-[0_0_15px_rgba(16,185,129,0.15)]`
  
- **Aviso (Âmbar/Laranja)**:
  - Estilo de card: `border-amber-500/25 bg-amber-500/10 text-amber-500`
  - Efeito Neon: `shadow-[0_0_15px_rgba(245,158,11,0.15)]`

- **Erro/Destrutivo (Rose 500)**:
  - Estilo de card: `border-rose-500/20 bg-rose-500/10 text-rose-500`
  - Efeito Neon: `shadow-[0_0_15px_rgba(244,63,94,0.15)]`

### 5. Tipografia e Micro-estilos
- **Títulos e Valores Principais**: Textos com `text-white`. Usar fonte grossa se pequeno, ou mais light se grande (ex: `text-[24px] font-light`).
- **Textos de Corpo Secundários (Descrições, mensagens de chat)**: `text-white/50`, `text-white/60` ou `text-white/40`.
- **Eyebrows (Textos de subtítulo e cabeçalhos de tabela/listas)**: Fazer SEMPRE minúsculo ultra-rastreado. Ex: `text-[10px] font-bold uppercase tracking-widest text-white/30`. O tracking (espaçamento) é crucial.

## Como Aplicar
Se você for criar um componente que lista coisas, exemplo "Histórico":
**NÃO FAÇA ISSO:**
```tsx
<div className="border border-slate-200 bg-white rounded-lg shadow-sm">
```

**FAÇA ISSO:**
```tsx
<div className="overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.02] backdrop-blur-[12px] hover:bg-white/[0.03] transition-colors">
```

Para botões ou ícones flutuantes:
```tsx
<button className="rounded-full border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-[0_0_10px_rgba(219,13,113,0.2)]">...</button>
```
