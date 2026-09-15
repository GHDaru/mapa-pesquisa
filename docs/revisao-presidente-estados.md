# Revisão — `#/presidente-estados`

Comparado contra a barra declarada no briefing: mapa por estado + miniaturas do
FiveThirtyEight *2024 election forecast* e miniaturas por estado do NYT 2024.
**Acesso de rede bloqueado** para `projects.fivethirtyeight.com` (proxy
`EGRESS_BLOCKED`) e `WebSearch` não trouxe capturas/descrições visuais
concretas dessas páginas (só material genérico de cobertura, ver rodapé) —
esta revisão usa como referência do padrão `docs/ux-spec.md` §1 (descrição
detalhada, já validada em rodadas anteriores, do que o NYT faz) e a auditoria
de DOM/dados ao vivo da nossa página, não capturas de tela do concorrente.

Build: `npm run build` (limpo) + `npx vite preview --port 4194`. Chromium via
`playwright-core` 1.63.0, proxy do ambiente. 12 screenshots em
`docs/screenshots/revisao-presidente-estados/` (dark/light × 1280×800/400×800,
modo Eleitorado, painel de MG, aba "Votos estimados"). Dados: 27 UFs, 100% de
cobertura de pesquisa presidencial estadual, "hoje" do sistema = 2026-09-15.

---

## O que a barra faz melhor (concreto)

1. **Precisão numérica verificada, não só plausível.** Cruzei MG e SP contra
   `data/polls.json`/`data/electorate.json` reconstruindo a média ponderada à
   mão (peso = `√amostra · exp(-ln2·idade/14)`, `src/domain/aggregate.ts:108-113`):
   MG deu Lula 35,28%/Flávio 30,75%/Zema 9,0%/Renan 5,0% — a tela mostra
   exatamente **35,3% / 30,7% / 9,0% / 5,0%**; SP deu Flávio 34,11%/Lula
   31,9% — a tela mostra **34% / 32%**. Eleitorado batendo 1:1
   (MG 16.377.659 → "16,4 milhões", SP 34.104.226 → "34,1 milhões"). O
   NYT/538 nunca expõem a fórmula com essa granularidade para conferência
   externa.
2. **Faixa de incerteza real na aba "Votos estimados", não só proveniência.**
   `criarLinhaComparacaoBarra` (`vote-estimate-panel.ts:237-287`) desenha
   barra proporcional a uma escala única (`calcularEscalaBarraComparacao`) MAIS
   um whisker de margem de erro (`.ve-chart-whisker`) — confirmado por DOM:
   larguras de barra 94,6%/79,2%/20,9%/3,3%/3,3%/2,5%/0,37%, cada uma com seu
   próprio whisker. Isso corrige a lacuna que a rodada 5 documentou (barra
   sempre 100%, sem incerteza) e hoje bate ponto a ponto com o padrão
   FiveThirtyEight de "barra + faixa" descrito no briefing.
3. **Zero corte de círculo nas miniaturas.** Auditoria de DOM em todos os 27
   `<svg class="ps-mini-chart">` não encontrou nenhum `circle.ps-mini-chart__ponto`
   com `cx < r` (o bug histórico "20 de 27 miniaturas" citado no próprio
   código, `presidential-states-layout.ts:227-237`) — `padEsquerdoMiniChart`
   está funcionando.
4. **Painel de estado mais rico que um tooltip único.** MG: badge de partido
   por candidato, selo "LIDERA, CORRIDA ACIRRADA", faixa de erro rotulada em
   texto (± pontos, não só visual), lista expansível de pesquisas com
   instituto/amostra/margem/registro TSE/fonte — nenhuma dessas 5 informações
   está disponível no hover único do NYT descrito em `docs/ux-spec.md:20-24`.
5. **Mobile é mapa de verdade, não uma lista.** Em 400×800 o SVG mantém
   `viewBox` e proporção (não vira tabela), e o painel de UF vira bottom
   sheet com alça de arraste — bate a recomendação do próprio `ux-spec.md:82-84`.

---

## Veredito binário por peça

| Peça | Veredito |
|---|---|
| Mapa coroplético (líder/eleitorado) | **Aprovado, com ressalva de altura** |
| Grade de miniaturas | **Reprovado** (linha de tendência omitida incorretamente em 3 estados) |
| Painel/drawer de UF (MG) | **Aprovado** |
| Aba "Votos estimados" | **Reprovado** (legenda da comparação ilegível) |
| Mobile 400px | **Aprovado** |
| Acessibilidade (tablist/aria) | **Aprovado** |

---

## Bugs objetivos por prioridade

### P0 — Linha de tendência omitida em miniaturas com pesquisas de datas diferentes (não é o caso documentado "mesmo dia")

**Evidência de dados** (`data/polls.json`, filtrado `cargo=presidente`,
`turno=1`): GO tem pesquisas AtlasIntel (2026-09-01) e Real Time Big Data
(2026-05-12) — **112 dias de diferença**; AC tem Quaest (2026-08-26) e Real
Time Big Data (2026-07-25) — **32 dias**; RO tem Quaest (2026-08-24) e Real
Time Big Data (2026-07-15) — **40 dias**. Nenhum desses é o cenário
"pesquisas no mesmo dia" que o código documenta como única razão legítima
para omitir a linha (`presidential-states-view.ts:819-824`).

**Evidência de DOM** (`.ps-mini-chart` de cada card, script Playwright
síncrono): os `circle.ps-mini-chart__ponto` de GO/AC/RO estão de fato
espalhados nas duas pontas do eixo x (`cx` variando de ~8,8 a 208 num
`viewBox` de 240px de largura — ex. Acre: `cx=8.79` e `cx=208`), provando que
os pontos antigos e recentes são renderizados; mas `svg.querySelectorAll('.ps-mini-chart__line')`
retorna **array vazio** nos três — nenhum `<path>` de linha é desenhado.

**Causa raiz identificada** (rodei `getPresidentialByState()` direto via
`node --import tsx`, sem passar pelo bundle): `agregado.pesquisasUsadas`
para GO tem **1 único item** (`['2026-09-01']`) porque `agregarPesquisas`
aplica a `janelaDias` padrão de 45 dias (`src/domain/aggregate.ts:136,147-149`)
e descarta a pesquisa de maio por estar fora da janela — mas
`serieTemporal`/`item.serie.pontos`, chamada com a MESMA lista de pesquisas
sem filtro de janela, continua incluindo o ponto de maio como um `PontoSerieTemporal`
de verdade (confirmado: `serie.dias` tem 127 entradas cobrindo 2026-05-12 a
2026-09-15, com valor numérico para os dois candidatos em **127 de 127**
dias). O gate que decide se a linha é desenhada,
`const multiplasPesquisas = agregado.pesquisasUsadas.length > 1;`
(`presidential-states-view.ts:805`), usa a contagem *filtrada pela janela*, não
a quantidade de datas realmente plotadas — por isso GO/AC/RO caem no mesmo
branch visual do caso intencional (MG/TO, pesquisas do mesmo dia), mas por um
motivo completamente diferente e não documentado: o leitor vê dois pontos
reais e distantes no tempo e nenhuma linha os conecta, sem nenhuma explicação
textual de por quê (o cartão de MG/TO ao menos tem a desculpa de "sem
evolução real para desenhar"; aqui há evolução real de -12 a +11 pontos entre
maio e setembro em GO, por exemplo, e ela é escondida).

Arquivos/seletores: `src/adapters/inbound/web/views/presidential-states-view.ts:803-834`
(`construirMiniGrafico`), `src/domain/aggregate.ts:129-159` (`agregarPesquisas`,
`janelaDias`) vs. `:290-364` (`serieTemporal`, sem filtro de janela).
UFs afetadas confirmadas: **Goiás, Acre, Rondônia** (3 de 27 — 11%).

### P1 — Legenda de 4 categorias na aba "Votos estimados" é visualmente indistinguível

**Evidência de CSS computado** (dark e light, `getComputedStyle` em cada
`.ve-legend-swatch`): as 4 legendas ("Votos de UFs com pesquisa estadual",
"Complemento nacional...", "Votos de UFs sem pesquisa...", "Faixa = margem de
erro...") usam a **mesma cor-base** `--color-text-subtle` diferenciada só por
opacidade — 100% / 45% / 25% / 20% — sobre um swatch de 22×10px
(`vote-estimate.css:135-161`). Em dark mode: `rgb(138,143,152)` sólido vs.
`color(srgb .54 .56 .60 / .45)` vs. `/ .25` vs. `/ .2` — nos dois screenshots
(`04-desktop-dark-votos.png`, `08-desktop-light-votos.png`) as 4 pílulas
aparecem como blocos cinza quase idênticos a olho nu; a faixa do
"complemento nacional" deveria ter uma textura de hachura (`repeating-linear-gradient`
de 3px) que se perde completamente no tamanho renderizado. Isso é o oposto
do padrão que a própria barra usa dentro do gráfico (`--ve-cor-seg`, cor do
espectro do candidato) — a legenda ensina uma chave visual (cinza monocromático)
diferente da que o gráfico realmente usa (cor por candidato + opacidade),
então ela não ensina a decodificar a "Faixa = margem de erro" (whisker) nem
distingue "sem pesquisa estadual" de "complemento nacional" de forma
confiável — falha o próprio critério do briefing ("faixa de incerteza...
explicada").

Arquivo/seletor: `src/adapters/inbound/web/styles/vote-estimate.css:135-161`
(`.ve-legend-swatch` e variantes), consumida por `criarLegendaBarra`
(`vote-estimate-panel.ts:166-183`).

### P2 — Mapa mais alto que o viewport em 1280×800 (lacuna herdada, ainda presente)

**Evidência de DOM**: `svg.ps-map-svg` mede 1010px de altura útil,
`getBoundingClientRect().bottom = 1350px` contra `window.innerHeight = 800px`
— o mapa completo (Norte a Sul) não cabe sem rolar mesmo em desktop
"acima da dobra", confirmado nos screenshots `01`/`02`/`06`
(cortando a região Sul). Já documentado em `docs/critica-ui-rodada6.md`
como "não bloqueante"; segue não bloqueante, mas não foi corrigido nesta
janela de dados.

### P3 (cosmético/ruído) — 1 `404` de console em 1 dos 4 carregamentos

Apareceu uma única vez, no primeiro `context.newPage()` do primeiro script
rodado (`01-desktop-dark`), sem URL capturada e sem entrada correspondente
no log do `vite preview`; reexecutei o carregamento completo da página mais
7 vezes (2 modos de cor × 2 larguras + trocas de aba/painel) sem reproduzir —
trato como largada fria do processo Playwright/proxy, não como bug do app.
Não bloqueia nada listado acima.

---

## A única maior lacuna

**A linha de tendência das miniaturas — o elemento que a própria documentação
do projeto (`docs/critica-ui-rodada6.md`) citou como o diferencial decisivo
sobre o NYT ("os dois bugs de render que davam a vitória ao NYT... estão
confirmados corrigidos") — ainda tem um terceiro modo de falha não coberto
por aquela auditoria: ela desaparece sempre que a pesquisa mais antiga de um
estado cai fora da janela de recência de 45 dias do agregado, mesmo que essa
pesquisa continue sendo desenhada como ponto no gráfico.** O efeito prático,
verificado em Goiás/Acre/Rondônia, é o pior dos dois mundos: o usuário vê
dois pontos reais, meses de distância um do outro, sugerindo movimento — e
nenhuma linha os liga, sem nenhum texto explicando por quê (ao contrário do
caso MG/TO, que ao menos é "mesmo dia, nada para suavizar"). A causa é um
desacoplamento entre duas fontes de verdade que deveriam concordar:
`agregado.pesquisasUsadas.length` (filtrado por `janelaDias`) decide se há
linha, mas `serie.pontos`/`serie.dias` (não filtrados por `janelaDias`) decidem
o que é desenhado como ponto. Corrigir isso não é polimento — é a diferença
entre a miniatura mostrar uma tendência real (Goiás: Flávio subindo de
~19pp de vantagem sobre Caiado em maio para 11pp sobre Lula em setembro,
segundo os mesmos dados) ou escondê-la silenciosamente.

---

Fontes tentadas para a barra de referência (bloqueadas/sem detalhe visual
utilizável): [How 538's 2024 presidential election forecast works – ABC
News](https://abcnews.com/538/538s-2024-presidential-election-forecast-works/story?id=110867585),
[538 Forecast for 2024 Presidential Election – 270toWin](https://www.270towin.com/maps/538-forecast-2024-presidential-election).
Referência efetivamente usada: `docs/ux-spec.md` §1 (descrição já
levantada do padrão NYT) e a base de rodadas de crítica anteriores em `docs/`.
