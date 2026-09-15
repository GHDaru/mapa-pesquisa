# Revisão — `#/presidente`

Metodologia: `npm run build` + `vite preview` (porta 4193), Playwright/Chromium headless
(`playwright-core` + `/opt/pw-browsers`) contra o build atual. Screenshots full-page em
1280×800 e 400×800, tema claro e escuro, mais hover num ponto, seletor de 2º turno e
tabela, em `docs/screenshots/revisao-presidente/*.png`. Toda afirmação abaixo vem de
DOM/CSS computado real (`getComputedStyle`, `getBoundingClientRect`, atributos SVG),
não de impressão visual da screenshot sozinha. Cruzei 3 linhas da tabela renderizada
contra `data/polls.json` (ids `2026-09-11-datafolha-br-presidente-t1`,
`...-t2-lula-flavio`, `...-futura-100-cidades-...`): instituto, período, amostra,
margem, registro TSE e os dois primeiros percentuais batem exatamente nas três — sem
bug de dado encontrado.

**Barra de qualidade**: `projects.fivethirtyeight.com` e `nytimes.com` estão
bloqueados pelo proxy de saída deste ambiente (`EGRESS_BLOCKED` / fetch recusado) e a
busca web não trouxe detalhes técnicos de implementação (só cobertura editorial). Não
vi as páginas ao vivo nesta sessão — a comparação usa a descrição já validada em
`docs/ux-spec.md` §1 (que documenta layout, hover/tap, tabela e tipografia do NYT) e
o histórico de rodadas anteriores (`docs/critica-ui-rodada1.md`, `rodada6.md`), que
também não conseguiram/registraram acesso direto. Declaro isso explicitamente em vez
de fingir ter visto a página de 2024 nesta sessão.

---

## O que a barra faz melhor que a nossa (concreto)

1. **Tap-fixo real em mobile.** O NYT explicitamente fixa o tooltip no toque até o
   usuário tocar em outro ponto ou fora do gráfico (`ux-spec.md` §1.1, princípio 4:
   "nunca só hover"). Lendo `ligarInteracao` em `timeline-chart.ts` (linhas 644-733),
   os únicos listeners são `pointermove`, `pointerleave`, `focus`, `blur`, `keydown`
   — não há `pointerdown`/`click` nenhum. Não existe um estado "pino" explícito nem
   um handler de "tocar fora fecha". O comportamento em touch depende inteiramente de
   como o navegador do usuário emula hover a partir de eventos de ponteiro sintéticos
   — não é uma decisão de produto testável, é um acidente de plataforma.
2. **`aria-describedby` do tooltip.** A própria spec do projeto (`ux-spec.md` §3)
   exige "Tooltip usa `role='tooltip'` associado por `aria-describedby`". Confirmado
   por DOM: `svg.pv-timeline-svg` não tem `aria-describedby` (`svgHasAriaDescribedby:
   false`), e `.pv-timeline-tooltip` não tem `id` (`tooltipHasId: null`) — os dois
   elementos nunca são ligados. Um leitor de tela não tem como saber que aquele
   tooltip descreve o SVG focado.

Fora esses dois pontos, a peça central (gráfico) é **mais informativa** que a
descrição da barra: 3 candidatos com linha própria (o NYT tipicamente mostra 2),
raio proporcional à amostra em vez de pontos uniformes, e um anel de contorno
automático quando dois marcadores finais colidem (corrida apertada) — o NYT não
resolve colisão de rótulos de forma visível nas descrições disponíveis.

---

## Veredito binário por peça

| Peça | Veredito | Evidência |
|---|---|---|
| **Gráfico (SVG linha)** | **Nosso vence, com bug sério em mobile** | Domínio Y, ticks, raio por amostra, linha suavizada e colisão de rótulos finais todos corretos por DOM (ver seção Bugs). Mas o texto do gráfico (rótulos diretos e eixo) fica ilegível em 400px — ver P0 abaixo. |
| **Tooltip** | **Reprovado (acessibilidade)** | Conteúdo correto (instituto, período, amostra, registro TSE — ver captura `05-hover-tooltip.png`), mas sem `aria-describedby`/`id`, sem `aria-live`, e sem mecanismo de tap-fixo em touch. Funciona bem só para mouse + teclado. |
| **Cartões 1º/2º turno** | **Aprovado** | Barra de incerteza atrás da barra de %, selo "EMPATE TÉCNICO" textual (não só cor), badge de partido com espectro — bate 1:1 com `ux-spec.md` §2(c). Nada a reprovar. |
| **Tabela de pesquisas** | **Aprovado** | 8 colunas, `tabular-nums` via `.pv-num`, "Sem registro" como selo textual (não vermelho puro), link de fonte com rótulo "abre em nova aba". 3/3 linhas conferidas batem com `data/polls.json`. |
| **Mobile (layout geral)** | **Aprovado, exceto o gráfico** | `document.documentElement.scrollWidth = 400` em 400px (sem scroll de página), tabela vira cards (`display:flex` por `td`, cabeçalho oculto, `::before` com `data-rotulo`). Falha isolada: o SVG do gráfico (ver P0). |
| **Acessibilidade (teclado)** | **Aprovado com ressalva** | `ArrowLeft`/`ArrowRight`/`Home`/`End` movem o crosshair e atualizam o tooltip (confirmado: `x1` do crosshair muda de `495.8` → `492.2` → `485.0` a cada `ArrowLeft`, tooltip atualiza). Ressalva: `role="img"` no SVG é semanticamente incoerente com um elemento que responde a teclado e muda de estado — `role="img"` declara "imagem estática" para tecnologia assistiva, não "widget interativo". |

---

## Bugs objetivos, por prioridade

### P0 — quebra a função em mobile

**Rótulos do gráfico ilegíveis em 400px (texto SVG escalado para ~6px renderizado).**
`views/timeline-chart.ts` desenha o SVG num `viewBox="0 0 720 340"` fixo e deixa o
CSS (`views.css` `.pv-timeline-svg { width:100%; height:auto }`) escalar o desenho
inteiro — texto incluso, porque `font-size` dos `<text>` SVG (`.pv-timeline-end-label`,
`.pv-timeline-axis-label`) está em unidades do viewBox, não em `px` de tela.

Medido por DOM em 400×900:
- `svg.getBoundingClientRect().width = 320px` (contêiner do cartão desconta padding),
  contra `viewBox` de `720` unidades → fator de escala `0.444`.
- `.pv-timeline-end-label` tem `font-size` computado `13px` (unidade do viewBox), mas
  `getBoundingClientRect().height = 7px` — ou seja, o glifo real na tela renderiza a
  ~`13 × 0.444 ≈ 5,8px`, bem abaixo de qualquer limiar de legibilidade (WCAG não
  define mínimo de corpo de fonte, mas 5,8px é ilegível para quase qualquer usuário,
  inclusive sem baixa visão).
- `.pv-timeline-axis-label` (os "0%", "39,1%", "1 jun" etc.): mesma conta, `12px`
  nominal → ~`5,3px` renderizado.
- Confirmado visualmente em `docs/screenshots/revisao-presidente/03-mobile-dark.png`
  e no recorte `10-mobile-chart-closeup.png`: os rótulos "39,1% Lula", "34,4% Flávio
  Bolsonaro", "9,5% Cury" e o eixo inteiro viram um borrão de pixels.

Isso não é um problema de contraste de cor (a cor do texto está correta nos dois
temas) — é a mecânica de escala do SVG ignorando que texto não deveria escalar junto
com a geometria. Fix esperado: `font-size` em `px` absolutos via CSS fora do sistema
de coordenadas do viewBox (ex.: um segundo `<svg>` não escalado para o texto, ou
`vector-effect="non-scaling-stroke"`-equivalente para texto, ou simplesmente reduzir
a densidade de rótulos/aumentar drasticamente o `font-size` nominal para compensar a
escala mínima esperada em 400px).

**Arquivo/seletor**: `src/adapters/inbound/web/views/timeline-chart.ts` (criação dos
`<text class="pv-timeline-end-label">` e `<text class="pv-timeline-axis-label">`,
linhas ~339, 350, 484-494); `src/adapters/inbound/web/styles/views.css` (`.pv-timeline-svg`
linhas 660-664, `.pv-timeline-end-label` linha 720, `.pv-timeline-axis-label` linha 675).

### P1 — acessibilidade, viola a própria spec

1. **Tooltip sem `aria-describedby`/`id`.** `ux-spec.md` §3 exige o vínculo
   explicitamente; não existe. `svg` tem só `aria-label` estático (o título do
   gráfico inteiro, fixado uma vez no render) — nenhum `aria-live` em lugar nenhum
   da página (`document.querySelector('[aria-live]')` retorna `null`). Um usuário de
   leitor de tela que navega por seta não recebe nenhum anúncio do valor do dia
   atual; só quem usa mouse ou lê a tela visualmente se beneficia da interação.
   **Seletor**: `svg.pv-timeline-svg` (criado em `renderTimelineChart`,
   `timeline-chart.ts` linhas 323-329) + `div.pv-timeline-tooltip` (linha 546-551).
2. **`role="img"` num elemento interativo.** O mesmo `<svg>` recebe `tabindex="0"` e
   8 handlers de teclado/ponteiro, mas `role="img"` diz a tecnologias assistivas que
   é conteúdo estático não-interativo — as duas coisas se contradizem. `ux-spec.md`
   §3 sugere `role="application"` + `aria-activedescendant` como a alternativa
   correta para "um único `tabindex=0` no SVG"; o código não usa nenhuma das duas.
3. **Sem tap-fixo em touch** (detalhado na seção "o que a barra faz melhor"). Sem
   `pointerdown`/`click`, o comportamento em touch real (iOS Safari, Chrome Android)
   não é garantido — testei com `page.touchscreen.tap()` do Playwright e o tooltip
   ficou visível por acidente (o tap sintético dispara `pointermove` sem
   `pointerleave` subsequente nesse ambiente), o que **não prova** que dispositivos
   reais se comportem igual; é a ausência de um handler dedicado que é o bug, não um
   resultado observado de falha ao vivo.

### P2 — tensão de design, não bug

**Domínio Y 0–50% no 1º turno enquanto os 2 primeiros colocados ficam entre 30–45%.**
`calcularDominioY` (linhas 37-53) está matematicamente correta — o mínimo cai para 0
porque Cury (candidato destacado nº3) tem pontos residuais próximos de 2-5% e a folga
de 3pp arredondada para baixo ao múltiplo de 5 empurra o piso a 0. O efeito visual:
quase metade da altura do gráfico (`docs/screenshots/.../01-desktop-dark.png`, região
0-20%) fica vazia, diluindo a separação visual entre Lula e Flávio Bolsonaro, que é a
corrida que importa. Já sinalizado em `critica-ui-rodada6.md` como "tensão de design,
não bug" e segue sem solução — mantenho o mesmo veredito, não é um bug objetivo, é
uma escolha (incluir "Outros" destacados no cálculo do domínio) que tem um custo de
legibilidade real.

---

## A única maior lacuna

**O gráfico — a peça mais forte da tela no desktop — perde a própria razão de existir
em mobile**: o rótulo direto no fim de cada linha (o recurso que substitui a legenda
tradicional, conforme `references/marks-and-anatomy.md`) é ilegível em 400px porque o
texto SVG escala junto com a geometria do `viewBox`. Não é um detalhe cosmético: numa
tela que serve principalmente celular (a base é eleitoral, não um dashboard de
analista), o usuário mobile vê pontos e linhas sem conseguir ler quem é quem ou qual o
valor — a única forma de recuperar a informação é abrir a tabela mais abaixo, o que
anula o propósito do gráfico como resumo visual rápido. Esse é o bug a corrigir antes
de qualquer polimento cosmético adicional.
