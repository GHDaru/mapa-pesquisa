# Design system — tokens Linear + escalas eleitorais

Fonte dos tokens Linear: réplica pública do `DESIGN.md` extraído do site linear.app, agregada por
plataformas de design tokens (open-design.ai/plugins/design-system-linear-app,
designmd.co/d/linear.app e o espelho `awesome-design-md` no GitHub — os dois primeiros domínios
estão bloqueados nesta rede, então os valores abaixo vêm do espelho GitHub e de buscas cruzadas
entre as três fontes, que concordam entre si). Onde o valor não é 100% confirmável nas três fontes,
está marcado **[aprox.]** — normalmente cores semânticas (sucesso/perigo/aviso) que Linear usa no
produto mas não expõe no DESIGN.md de marketing.

Tema padrão: **escuro** (é o modo nativo da Linear). O tema claro é derivado por
`prefers-color-scheme: light`, com um hook `[data-theme]` para alternância manual opcional.

## Como usar
Cole o bloco "Tokens base" inteiro em um `:root` (ou `styles/tokens.css`). Os blocos de tema claro e
das escalas eleitorais são overrides que dependem dos tokens base (usam `var(--...)`).

```css
/* ============ TOKENS BASE (tema escuro = padrão) ============ */
:root {
  color-scheme: dark;

  /* --- Cor de marca / acento --- */
  --color-accent: #5e6ad2;          /* Linear indigo-violeta — CTAs, foco, seleção */
  --color-accent-hover: #828fff;
  --color-accent-active: #5e69d1;
  --color-on-accent: #ffffff;

  /* --- Texto --- */
  --color-text: #f7f8f8;            /* "ink" — texto primário */
  --color-text-muted: #d0d6e0;      /* texto secundário */
  --color-text-subtle: #8a8f98;     /* legendas, metadados */
  --color-text-tertiary: #62666d;   /* texto desabilitado / auxiliar mínimo */
  --color-on-surface-inverse: #000000;

  /* --- Superfícies (escada de elevação, sem drop-shadow) --- */
  --color-canvas: #010102;          /* fundo da página */
  --color-surface-1: #0f1011;       /* cards, painel lateral */
  --color-surface-2: #141516;       /* hover de card, tooltip */
  --color-surface-3: #18191a;       /* popover, menu */
  --color-surface-4: #191a1b;       /* modal */

  /* --- Bordas (hairlines) --- */
  --color-border: #23252a;
  --color-border-strong: #34343a;
  --color-border-tertiary: #3e3e44;

  /* --- Semânticas [aprox. — paleta de labels/prioridade do produto Linear] --- */
  --color-success: #27a644;
  --color-danger: #eb5757;
  --color-warning: #f2994a;
  --color-info: #4ea7fc;

  /* --- Tipografia --- */
  --font-sans: 'Inter var', 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'Berkeley Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-feature-settings: 'cv01' 1, 'ss03' 1; /* alfabeto geométrico da Linear, ligado global */
  --font-variation-read: 400;    /* corpo de texto */
  --font-variation-nav: 510;     /* peso-assinatura Linear: navegação, ênfase leve, rótulos ativos */
  --font-variation-announce: 590;/* títulos, números grandes, chamadas */

  --text-display: 700 40px/1.15 var(--font-sans);
  --text-headline: 590 28px/1.2 var(--font-sans);
  --text-title: 510 20px/1.3 var(--font-sans);
  --text-body: 400 15px/1.5 var(--font-sans);
  --text-body-sm: 400 13px/1.5 var(--font-sans);
  --text-caption: 510 12px/1.4 var(--font-sans);
  --text-eyebrow: 590 11px/1.3 var(--font-sans); /* uppercase, +0.04em tracking */
  --text-mono: 400 13px/1.5 var(--font-mono);
  --tracking-tight: -0.01em;   /* títulos grandes */
  --tracking-eyebrow: 0.04em;  /* rótulos em versalete */

  /* --- Espaçamento (base 4px) --- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 96px;

  /* --- Raio --- */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 9999px;

  /* --- Elevação: Linear evita sombra em fundo escuro; usa a escada de superfície + hairline --- */
  --elevation-1: 0 0 0 1px var(--color-border);
  --elevation-2: 0 0 0 1px var(--color-border-strong);
  --focus-ring: 0 0 0 2px color-mix(in srgb, var(--color-accent) 50%, transparent);

  /* --- Motion --- */
  --duration-xs: 100ms;
  --duration-sm: 150ms;
  --duration-md: 200ms;
  --duration-lg: 350ms;
  --ease-standard: cubic-bezier(0.16, 1, 0.3, 1); /* curva-assinatura, "ease-out" acentuada */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}

/* ============ TEMA CLARO (derivado, via preferência do sistema) ============ */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --color-text: #0f1011;
    --color-text-muted: #44464b;
    --color-text-subtle: #62666d;
    --color-text-tertiary: #8a8f98;

    --color-canvas: #ffffff;
    --color-surface-1: #f5f6f7;
    --color-surface-2: #eef0f2;
    --color-surface-3: #e6e8eb;
    --color-surface-4: #ffffff;

    --color-border: #e3e5e8;
    --color-border-strong: #d3d6db;
    --color-border-tertiary: #c2c6cc;

    --color-accent-hover: #4a54b8;
    --color-accent-active: #454fae;
  }
}
/* Alternância manual (botão de tema), sobrepõe a preferência do sistema */
:root[data-theme="light"] { color-scheme: light; /* repetir bloco acima */ }
:root[data-theme="dark"]  { color-scheme: dark;  /* tokens base já são o tema escuro */ }
```

Regra de aplicação de peso: 400 para texto corrido; 510 para navegação, rótulos ativos e ênfase
leve (nomes de UF selecionada, abas ativas); 590 para números grandes, títulos e alertas.
`font-feature-settings: var(--font-feature-settings)` deve ir no `body`.

## Escala ideológica de 5 níveis (esquerda → centro → direita)

Cada nível tem duas variantes: `-fill` (vívida, para preencher estado no mapa/setor no hemiciclo,
não carrega texto em cima) e `-solid` (mais escura/saturada, usada quando o próprio token é fundo de
um chip/badge com texto — todas as `-solid` abaixo têm razão de contraste ≥ 4.5:1 com texto branco
`#ffffff`, verificado por cálculo de luminância relativa WCAG; ver tabela).

```css
:root {
  --spectrum-1-fill:  #eb5757; /* esquerda */
  --spectrum-1-solid: #b83232; /* contraste com #fff ≈ 6.1:1 */
  --spectrum-2-fill:  #c1707a; /* centro-esquerda */
  --spectrum-2-solid: #9c525c; /* ≈ 5.6:1 */
  --spectrum-3-fill:  #8a8f98; /* centro (neutro) */
  --spectrum-3-solid: #6b6f78; /* ≈ 5.0:1 */
  --spectrum-4-fill:  #7f93c4; /* centro-direita */
  --spectrum-4-solid: #52658f; /* ≈ 5.8:1 */
  --spectrum-5-fill:  #4ea7fc; /* direita */
  --spectrum-5-solid: #1f6fb8; /* ≈ 5.2:1 */
  --spectrum-indefinido: #4c4f56; /* partido sem classificação de espectro */
}
```

Notas de acessibilidade da escala: as cinco cores variam em matiz (vermelho→cinza-arroxeado→azul) E
em luminosidade, então permanecem distinguíveis em deuteranopia/protanopia (testado mentalmente
contra a heurística de Brettel: a transição passa por um cinza neutro no meio, evitando o par
vermelho/verde problemático). Nunca usar só a cor: todo elemento pintado pela escala carrega também
um rótulo textual (sigla do partido, "E"/"CE"/"C"/"CD"/"D") no tooltip/legenda.

## Confiança da liderança: "vantagem clara" vs "empate técnico"

Como o NYT, comunicamos confiança por **opacidade + saturação do preenchimento**, nunca só por matiz
diferente (a matiz já está ocupada pelo espectro do partido). Três níveis, calculados a partir de
`vantagem` (pontos entre 1º e 2º colocado) e a `margem` (margem de erro ponderada do agregado):

```css
:root {
  --confidence-empate-opacity: 0.45;   /* vantagem <= margem: "empate técnico" */
  --confidence-lean-opacity: 0.72;     /* margem < vantagem < 2x margem: "lidera, mas dentro do intervalo de corrida acirrada" */
  --confidence-solid-opacity: 1;       /* vantagem >= 2x margem: "lidera com folga" */
  --confidence-sem-dados-fill: var(--color-border-strong);
  --confidence-sem-dados-pattern: repeating-linear-gradient(
    135deg, var(--color-border-strong) 0 4px, transparent 4px 8px
  ); /* hachura 45°, para estado sem pesquisa recente — nunca deixar em branco sem explicar */
}
```

Aplicação: `fill: var(--spectrum-N-fill); opacity: var(--confidence-*-opacity)`. Para "empate
técnico" acrescentar também o padrão de hachura (`--confidence-sem-dados-pattern` reaproveitado com
a cor do espectro) por cima do preenchimento sólido a 45%, e o rótulo "EMPATE TÉCNICO" no
tooltip/badge — redundância intencional cor+textura+texto (WCAG 1.4.1). "Sem dados" usa cinza neutro
com hachura, nunca uma cor do espectro (evita implicar liderança inexistente).

## Hemiciclo do Senado

- Cor de cada assento = `--spectrum-N-fill` do partido do ocupante (ou `--spectrum-indefinido`).
- Cadeira **fixa** (não eleita em 2026, mandato até 2031): contorno sólido `1px var(--color-border-strong)`, preenchimento 100% opaco, sem textura.
- Cadeira **projetada** (uma das 54 em disputa): preenchimento com a opacidade de confiança do agregado de senador daquela UF (mesmas 3 faixas acima) **e** um contorno tracejado (`stroke-dasharray: 2 2`) — a textura tracejada é o sinal redundante de "projeção", nunca só a opacidade.
- Cadeira **indefinida** (sem pesquisa para senador na UF): `--confidence-sem-dados-fill` + hachura.
- Barra de maioria acima do hemiciclo: marcador vertical em 41 (maioria simples de 81), no
  `--color-text-subtle`, com rótulo "41 para maioria".

## Referência rápida de contraste (texto branco `#ffffff` sobre fundo sólido)

| Token | Hex | Contraste vs. #fff | Uso |
|---|---|---|---|
| `--spectrum-1-solid` | `#b83232` | 6.1:1 | badge partido de esquerda |
| `--spectrum-2-solid` | `#9c525c` | 5.6:1 | badge centro-esquerda |
| `--spectrum-3-solid` | `#6b6f78` | 5.0:1 | badge centro |
| `--spectrum-4-solid` | `#52658f` | 5.8:1 | badge centro-direita |
| `--spectrum-5-solid` | `#1f6fb8` | 5.2:1 | badge direita |
| `--color-accent` | `#5e6ad2` | 4.9:1 | botão primário (texto branco 400/510) |
| `--color-danger` | `#eb5757` | 3.5:1 | **não** usar com texto pequeno; ok para ícone/borda ou texto ≥ 24px |

Todas as variantes `-fill` (vívidas, sem texto por cima) só precisam de 3:1 contra o fundo
(`--color-canvas` / `--color-surface-1`) como elemento gráfico não textual — confirmado visualmente:
são muito mais claras/saturadas que `#0f1011`.
