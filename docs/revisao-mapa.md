# Revisão dura — `#/mapa` (Governadores) vs. a barra (FiveThirtyEight 2024 forecast map + NYT polls-president map)

**Metodologia e ressalva de acesso à barra**: `npm run build` (limpo) + `npx vite preview --port 4192`,
Playwright/Chromium headless via `playwright-core`, proxy `--proxy-server=$HTTPS_PROXY
--ignore-certificate-errors`. 8 screenshots em `docs/screenshots/revisao-mapa/` (dentro do limite de
10), todos lidos com a ferramenta de imagem. Toda alegação abaixo tem evidência de DOM
(`page.evaluate`) salva em `docs/screenshots/revisao-mapa/_*.json`.

**Não consegui abrir a barra ao vivo nesta sessão**: `WebFetch` em
`projects.fivethirtyeight.com` retornou `EGRESS_BLOCKED` (proxy da organização) e em
`nytimes.com` retornou "unable to fetch". `WebSearch` sobre os dois mapas trouxe só descrições
genéricas de terceiros (nenhuma renderização real, nenhum detalhe de DOM/CSS). Todo o conteúdo
"o que a barra faz" abaixo vem de `docs/ux-spec.md` §1 — que descreve os dois mapas em detalhe
concreto (layout, hover, legenda, mobile) e presumivelmente foi escrito a partir de acesso real em
sessão anterior — não de observação minha nesta revisão. Declaro isso explicitamente para não
fingir verificação que não fiz.

---

## 1. O que a barra faz melhor (concreto, via `docs/ux-spec.md`)

1. **O mapa inteiro cabe acima da dobra.** No NYT/538 o mapa (projeção Albers, proporção larga)
   ocupa a largura do artigo mas é raso o bastante para não exigir rolagem antes do primeiro hover.
   O nosso **não** cumpre isso — ver §4 (maior lacuna).
2. **Tooltip com dois candidatos lado a lado + retrato**, não só o líder. O nosso mostra só o
   líder no tooltip de hover (os demais só aparecem depois de abrir o painel completo).
3. **Tabela textual completa abaixo do mapa**, ordenável por coluna, com todos os 50 estados —
   equivalente tabular ao mapa que existe na mesma tela, sem precisar abrir nada. O nosso não tem
   nenhuma tabela na tela do mapa: o equivalente textual só existe estado a estado, dentro do
   painel, um de cada vez.
4. **Tap fixa o mesmo tooltip leve do hover** no mobile (NYT) — meramente prende o preview até o
   próximo toque, sem abrir uma superfície maior. O nosso pula esse estágio: tap abre direto o
   painel completo (bottom sheet até 80vh) — ver P1 #1 abaixo.

## 2. Vereditos binários por peça

| Peça | Veredito | Por quê (evidência) |
|---|---|---|
| **Mapa (coroplético)** | **O nosso vence** | Matiz de 5 níveis + opacidade de confiança + hachura de empate/sem-dados + sigla inline por UF é estritamente mais denso em informação que a escala binária/diverging do NYT descrita em `ux-spec.md`. **Ressalva grave**: não cabe na viewport padrão — ver §4. |
| **Tooltip (hover)** | **O nosso vence** | Conteúdo textual (líder, partido, vantagem em pontos, rótulo de confiança, instituto, data, nº de pesquisas) já supera o mínimo documentado do NYT; clampagem contra `window.innerWidth/innerHeight` testada em 7 UFs (AC, RR, SP, RJ, RS, AM, PI) — 100% dentro da viewport (`_tooltip-checks.json`). Sem dado ao vivo da barra para comparar 1:1, mas o texto por si já é mais rico que "nome + %". |
| **Painel/drawer do estado** | **O nosso vence, sem ressalva** | Ficha por pesquisa individual (instituto, período, amostra, margem, **registro TSE**, contratante, link de fonte) é uma granularidade que nenhum tooltip único de mapa oferece. Conferido campo a campo contra `data/polls.json` para SP, MG e DF — 100% coerente (ver §3, "Verificação de dados"). |
| **Legenda** | **O nosso vence, com ressalva** | Todo swatch tem rótulo textual (nunca só cor), como o `ux-spec.md` exige — mas a legenda de confiança usa uma cor que **não existe no mapa** (ver P1 #2). |
| **Mobile (400px)** | **O nosso vence** | `document.documentElement.scrollWidth === clientWidth === innerWidth === 400` (`_scroll-400.json`) — zero rolagem horizontal. Alvo de toque ampliado para UFs pequenas. Painel mobile é bottom sheet com alça e X. Ressalva: falta o estágio de preview tocável do NYT (P1 #1). |
| **Acessibilidade** | **O nosso vence** | 27/27 `path.map-uf` com `aria-label` completo e semanticamente correto — incluindo sufixo "empate técnico" só quando aplicável, testado em BA/AL/AC (`_aria-labels.json`). Foco visível confirmado por screenshot (anel ao redor do `path` do PR, `04-dark-foco-teclado.png`). Ordem de tabulação N→S confirmada em DOM (RR→AP→PA…→RS). Ressalvas menores em P2. |

## 3. Verificação de dados (painel vs. `data/polls.json`)

Conferi manualmente **SP, MG e DF** (governador): instituto, `registroTSE` (inclusive o caso
"não localizado" da Quaest em SP, que não tem `registroTSE` no JSON e o painel mostra
corretamente "registro TSE não localizado ⚠"), datas de início/fim, amostra, margem, contratante
e URL da fonte — **os três batem exatamente** com `data/polls.json`, sem nenhuma divergência.
Evidência: `docs/screenshots/revisao-mapa/_panel-sp.json` e `_panel-mg-df.json`, comparados linha a
linha com a saída de `node -e "..."` sobre `data/polls.json` (SP: 3 pesquisas, MG: 3, DF: 3, todas
batendo instituto/registroTSE/datas/fonte).

## 4. A ÚNICA maior lacuna

**O SVG do mapa é mais alto que a janela em 1280×800 — SP, RJ, PR, SC e RS ficam total ou
parcialmente fora da área visível no carregamento, antes mesmo do usuário apontar o mouse.**

Evidência de DOM (`svg.map-svg.getBoundingClientRect()`):
```
{ width: 898, height: 936.08, top: 156.09, bottom: 1092.17 }   // janela: 800px de altura
```
`document.documentElement.scrollHeight = 1317` vs. `window.innerHeight = 800`. Consequência prática
medida: o centro geométrico do `path` de SP (`y: 732→874`) e de RS (`y: 839→1021`) cai **fora** da
viewport — `document.elementFromPoint()` no centro de ambos retorna `null` a `scrollY=0`, ou seja,
esses dois estados são literalmente impossíveis de apontar sem rolar a página primeiro.

Isto **não é um achado novo**: está registrado e reconfirmado em `docs/critica-ui-rodada2.md`,
`rodada3.md` (linha 39, medição idêntica de 936px), `rodada4.md` e `rodada6.md`, sempre rotulado
"lacuna herdada... não bloqueante" e nunca corrigido. É exatamente o oposto do que a barra faz —
tanto o mapa do 538 quanto o do NYT são desenhados para caber acima da dobra como a peça central da
tela. Card mais informativo (nosso) que não cabe na tela perde para um card mais simples (barra) que
o usuário efetivamente vê inteiro sem esforço. Recomendação objetiva (não implementada por mim,
apenas registrada): limitar a altura do `.map-svg` por `max-height` ligado a `100vh` menos o
cabeçalho, ou mover a legenda para abaixo do mapa em vez de ao lado (liberando altura horizontal via
`aspect-ratio` mais raso), ou usar um `viewBox` recortado que remova a margem vazia entre Roraima e
o topo do `viewBox` original de `@svg-maps/brazil`.

## 5. Bugs objetivos por prioridade

### P0
Nenhum bug de corrupção de dado, crash ou inacessibilidade total encontrado. A lacuna de viewport
(§4) seria P0 em qualquer outro contexto, mas está deliberadamente listada à parte por já ser
conhecida e rastreada havia 4 rodadas — repeti-la como "P0 novo" seria enganoso.

### P1
1. **Mobile pula a etapa de preview tocável — tap abre direto o painel completo de 80vh.**
   `src/adapters/inbound/web/views/map-view.ts:325-330`: o mesmo listener `click` (que chama
   `abrirPainel`) é anexado a `path` e ao `alvo-toque`, sem diferenciar `matchMedia('(hover: none)')`.
   Isso diverge do princípio 4 do próprio `docs/ux-spec.md` §1 ("Tooltip por hover no desktop, por
   tap fixo no mobile — nunca só hover") e do padrão do NYT lá descrito. Impacto prático: comparar 3
   estados no celular exige abrir e fechar 3 bottom sheets inteiras em vez de 3 toques rápidos sobre
   um preview leve.
2. **Legenda de confiança usa uma cor que não existe no mapa.** `map-view.ts:436`,
   função `criarItemLegendaConfianca`: `swatch.style.background = 'var(--color-accent)'` (roxo/azul
   fixo, `#5e6ad2`) para os três swatches "Lidera com folga / corrida acirrada / Empate técnico".
   No mapa real a opacidade é aplicada sobre a cor do espectro do líder (vermelho, cinza, azul
   etc. — ver `path.style.opacity = opacidadeConfianca(nivel)` em `map-view.ts:290`). Nenhum estado
   de esquerda (vermelho) jamais aparece roxo, mas é exatamente a cor que a legenda de confiança
   ensina. Confirmável nas capturas: `01-dark-1280x800.png` mostra PI em vermelho sólido (espectro
   esquerda) e a legenda de "Lidera com folga" em um quadradinho roxo — cores completamente
   diferentes para o mesmo conceito.

### P2
1. **Contraste do rótulo de UF falha em checadores automáticos (axe/Lighthouse) em 4 das 5 cores
   de espectro no nível "Lidera com folga".** `styles/app.css` (`.uf-label { fill:#ffffff;
   stroke:#000000; stroke-width:2px; paint-order:stroke fill }`) não varia por tema. Calculando
   contraste WCAG só de `fill` branco vs. `fill` da UF (sem contar o contorno, que ferramentas
   automáticas de contraste tipicamente não avaliam): esquerda `#eb5757` → 3.48:1, centro-esquerda
   `#c1707a` → 3.58:1, centro `#8a8f98` → 3.25:1, centro-direita `#7f93c4` → 3.06:1, direita
   `#4ea7fc` → 2.54:1 — todos abaixo de 4.5:1 (AA texto normal) e abaixo até de 3:1 (AA texto
   grande) em dois casos. Ao olho humano o halo preto de 2px resolve a legibilidade, mas não é uma
   técnica que passa em auditoria automatizada de contraste texto-vs-fundo, e o CSS não declara
   nenhum fallback de tema para essa combinação fixa.
2. **Sem `aria-describedby` ligando os 27 `path.map-uf` ao `#map-tooltip`.** O tooltip tem
   `role="tooltip"` (`map-view.ts:150`) mas nenhum `path` referencia esse `id` via
   `aria-describedby`, como o próprio `docs/ux-spec.md` §3 prescreve ("Tooltip usa `role="tooltip"`
   associado por `aria-describedby`"). Mitigado na prática porque `aria-label` já carrega
   informação equivalente (confirmado em `_aria-labels.json`), mas é uma lacuna literal e objetiva
   entre spec e código.
3. **Alvo de toque ampliado intercepta a interação automatizada do próprio `path` em UFs pequenas.**
   Para toda UF com área < 3000 (unidades do viewBox — inclui ao menos AC, RR, AP, DF, SE, AL),
   `map-view.ts:313-323` empilha um `<circle class="map-uf__alvo-toque">` **por cima** do `path`
   real. Um clique programático direto no `path` de DF trava com timeout do Playwright
   ("`<circle>` intercepts pointer events"); o clique real de mouse funciona porque o mesmo listener
   está no círculo (`_panel-mg-df.json` confirma dados corretos ao clicar via `page.mouse.click`).
   Não é bug para o usuário final, mas expõe que a área clicável real (o círculo, invisível, sem
   contorno) não coincide com o polígono visível do estado nem com o anel de foco de teclado (que
   fica no `path`, tabindex="0" — o círculo é `tabindex="-1"`), e não há nenhum indício visual de
   onde a área de toque ampliada realmente começa/termina.
4. **`favicon.ico` retorna 404** (único erro de console capturado em todas as passagens —
   `_console-errors.json`). `index.html` não declara `<link rel="icon">`. Cosmético, sem relação com
   o mapa em si.
5. **Paleta de espectro tem diferenciação fraca de matiz entre "esquerda" e "centro-esquerda"**
   (`#eb5757` vs. `#c1707a`, ambos vermelho/rosado) contra uma diferenciação forte entre
   "centro-direita" e "direita" (`#7f93c4` vs. `#4ea7fc`, dois azuis com luminância mais distinta).
   Para daltonismo vermelho-verde, os dois primeiros tendem a colapsar visualmente no mapa sem
   legenda ao lado (mobile scrollado, print, etc.) — mitigado pelo `aria-label` textual, mas não
   pelo canal visual isolado.

## 6. Resumo de erros de console

Um único erro em todas as 4 passagens (dark/light × 1280/400): `favicon.ico` 404 (P2 #4 acima).
Nenhum erro de JavaScript (`pageerror`), nenhuma falha de carregamento de módulo, nenhum warning
de React/hidratação (app é vanilla TS/DOM).
