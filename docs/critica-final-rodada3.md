# Confirmação final — rodada 3 (pós-correções dos seis especialistas + capa)

**Revisor:** crítico duro de produto de dados eleitorais, sem contexto prévio deste ciclo de
correções — só os sete relatórios e o código/dados reais.

**Metodologia:** `npm run build` (limpo, `tsc --noEmit` + `vite build`, sem erros) + `npx vite
preview --port 4203`. Chromium via `playwright-core` 1.63.0
(`executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome`), lançado com
`--proxy-server=127.0.0.1:<porta de $HTTPS_PROXY> --ignore-certificate-errors`. Scripts síncronos
em `/tmp/claude-0/.../scratchpad/audit*.js` (não versionados). `npm run test` também rodado à
parte: **332/332 testes passam, 20/20 arquivos**. Toda alegação abaixo tem evidência de
`page.evaluate` (DOM/CSS computado real) salva nos JSONs de scratchpad, não só impressão visual de
screenshot. 15 screenshots em `docs/screenshots/critica-final/` (limite de 16 respeitado).

**Resultado em uma frase:** dos 20 itens P0/P1 levantados pelos seis relatórios de página + a
crítica da capa, **20/20 estão corrigidos e confirmados por medição ao vivo** — mas a rodada de
regressão encontrou **1 bug novo, não documentado antes, em `#/pesquisas` a 1280px** (overflow
horizontal de página inteira, não só da tabela) que nenhuma das sete revisões anteriores havia
testado nesse eixo específico.

---

## 1. Checklist por relatório

### `docs/revisao-mapa.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P1-1 | Mobile pula preview tocável (tap abre direto o painel de 80vh) | **CORRIGIDO** | `map-view.ts:296-307` (`aoInteragirComEstado`) implementa 2 toques: testei ao vivo com `page.touchscreen.tap()` em 400×800 — 1º toque em um `path`: `tooltip.hidden=false`, `panelOpen=false` (só prévia fixada); 2º toque no mesmo estado: `tooltip.hidden=true`, `panelOpen=true` (painel abre). Comportamento exatamente como a spec pede. |
| P1-2 | Legenda de confiança usa cor (`--color-accent`, roxo) que não existe no mapa | **CORRIGIDO** | `getComputedStyle` ao vivo: os 3 swatches "Lidera com folga/acirrada/Empate técnico" usam `rgb(138,143,152)` — mesma cor computada de `uniqueMapFills` do mapa real (`--spectrum-3-fill`, tom "centro"). Roxo não aparece em nenhum swatch. |

Bônus (não era P0/P1, mas registrado no relatório como "a única maior lacuna"): `elementFromPoint`
em SP e RS a `scrollY=0`, 1280×800 — ambos **encontrados** (`elementFromPointIsThisPath: true` nos
dois), `document.documentElement.scrollHeight = 866` vs `innerHeight = 800` (era 1317 vs 800 na
revisão original). O mapa não cabe 100% acima da dobra ainda (866 > 800), mas a diferença caiu de
517px para 66px e os dois estados citados como "impossíveis de apontar" já são clicáveis sem
rolar. Não estava na lista de P0/P1 a confirmar, então não conta para o veredito, mas é uma melhora
real que registro por honestidade.

### `docs/revisao-presidente.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P0 | Rótulos do gráfico ilegíveis em 400px (~5,8px renderizado) | **CORRIGIDO** | Rótulos migrados para overlay HTML fora do sistema de coordenadas do SVG (`criarRotuloOverlay`, `timeline-chart.ts:310-329`). Medido ao vivo em 400×900: `.pv-timeline-end-label` altura real `19.5px` a `font-size: 13px` computado (era `~5.8px`/`13px` nominal). `.pv-timeline-axis-label` altura real `16.8px` a `12px` computado. Confirmado visualmente em `presidente-400-dark.png` — "39,1% Lula" e "34,4% Flávio" nítidos. |
| P1-1 | Tooltip sem `aria-describedby`/`id`, sem `aria-live` | **CORRIGIDO** | `svg.getAttribute('aria-describedby') === 'pv-timeline-tooltip-1'` e `tooltip.id === 'pv-timeline-tooltip-1'` — casam exatamente. `document.querySelector('[aria-live]')` agora existe (era `null`). |
| P1-2 | `role="img"` num SVG interativo (incoerente com teclado/estado) | **CORRIGIDO** | `svg.getAttribute('role') === 'application'` (era `'img'`). |
| P1-3 | Sem tap-fixo em touch (dependia de emulação de hover) | **CORRIGIDO** | Código-fonte confirma handler dedicado de `pointerdown` no SVG (`timeline-chart.ts:886-897`) com comentário explícito referenciando o bug; interação por teclado testada ao vivo (`ArrowLeft` move o crosshair de `x1=0` para `x1=355.8`), confirmando que o SVG responde a interação real, consistente com o mecanismo documentado. |

### `docs/revisao-presidente-estados.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P0 | Linha de tendência omitida em GO/AC/RO (pesquisas de datas diferentes, fora da janela de 45 dias) | **CORRIGIDO** | Auditoria ao vivo de todos os 27 `.ps-card`: **Goiás, Acre e Rondônia agora têm `lineCount: 2`** (linha desenhada), antes 0. Verificação cruzada: os 5 UFs que hoje mostram `lineCount: 0` (RS, PE, CE, PI, MT) têm **apenas 1 pesquisa cada** em `data/polls.json` (não há o que conectar — comportamento correto, não é o bug original), e Minas Gerais mostra `lineCount: 0`/`pointCount: 4` porque suas 2 pesquisas são do **mesmo dia** (caso legítimo já documentado). O gate agora usa a contagem real de datas plotadas, não `pesquisasUsadas.length` filtrado pela janela. |
| P1 | Legenda de 4 categorias em "Votos estimados" visualmente indistinguível (só variava opacidade sobre a mesma cor) | **CORRIGIDO** | `getComputedStyle` nos 4 swatches: 1) sólido `rgb(94,106,210)` opacidade 1; 2) `background-image: repeating-linear-gradient(...)` (hachura diagonal real, não só opacidade) para "Complemento nacional"; 3) `color(srgb .../.25)` flat para "sem pesquisa"; 4) quase transparente `.../.12` para a faixa de margem de erro. Confirmado visualmente em `presidente-estados-votos-1280-dark.png` — os 4 padrões são claramente diferentes ao olho (sólido / textura diagonal / cinza claro / quase invisível), não mais "4 blocos cinza quase idênticos". |

### `docs/revisao-senado.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P0 | Troca de candidato × percentual em 8 UFs (zip por índice de arrays com ordenações diferentes) | **CORRIGIDO** | **RS** (`#senado-tabela-linha-RS`, DOM ao vivo): "Manuela D'Ávila PSOL (Esquerda) **18,0%** Empate técnico / Marcel Van Hattem Novo (Direita) **22,0%**" — bate exatamente com `data/polls.json` (Van Hattem 22, D'Ávila 18; antes estava invertido). **MT**: "Janaína Riva MDB (Centro) **26,0%** / Mauro Mendes União Brasil (Centro-direita) **27,0%**" — bate com o dado bruto (Mauro Mendes 27/Janaína 26; antes invertido). Causa raiz corrigida em `get-senate-by-state.ts:71-85`: pareamento agora por identidade (`candidato === assento.ocupante && partido === assento.partido`), não por índice `i`. |
| P1-1 | Pareamento "Hoje"×"Projeção" sem garantia de correspondência por vaga | **CORRIGIDO** | Painel de Amapá testado ao vivo: layout mudou para dois grupos independentes — "Ocupantes atuais (2 vagas)" com "Cadeira 1/2 — hoje" e "Projeção 2026 (2 primeiros colocados)" com "1º/2º colocado" — não existe mais uma linha "Hoje: X → Projeção: Y" que sugira correspondência 1:1 inexistente nos dados. Comentário no código (`senate-view.ts:531-539`) documenta a decisão. |
| P1-2 | Distinção fixa/projetada por traço (sólido vs. tracejado 2px) ilegível em escala normal | **CORRIGIDO** | CSS redesenhado: fixa = anel branco `stroke-width: 2.5` (mais grosso); projetada = **marcador interno sólido** (`.pv-assento-marcador`, um disco central visível, não mais um tracejado fino) — mudança estrutural de técnica, não só ajuste de espessura. Comentário no CSS confirma que o tracejado foi testado e descartado por "ler como dente de engrenagem" no raio real do assento. |

### `docs/revisao-partidos.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P0-1 | Cadastro com 31 partidos vs. 30/29 de fontes públicas | **CORRIGIDO** | `data/parties.json` tem **30 objetos** (contagem programática direta), e a tabela ao vivo renderiza **30 linhas** (`tbody tr` count = 30). Bate com a fonte pública citada na revisão ("30ª legenda com o Missão"). |
| P0-2 | Federação PSDB-Cidadania listada como ativa sem ressalva de dissolução | **CORRIGIDO** | Ambos os registros (PSDB e Cidadania) agora têm campo `observacao` detalhando: aprovação da dissolução pelo Cidadania (16/03/2025), autorização do STF (ADI 7021, 06/08/2025) e o fato de a federação **ter sido mantida para 2026** (registro ativo, chapas homologadas) — presente e visível no `<details>` da tabela ao vivo. |
| P1-3 | Contraste do link "Ver fonte" no tema escuro: 4.44:1 (abaixo de 4.5:1 AA) | **CORRIGIDO** | Override específico de tema escuro (`:root:not([data-theme='light']) .pv-link-fonte { color: #6c76dc }`). Medido ao vivo: `getComputedStyle` retorna `rgb(108,118,220)`; contraste recalculado (fórmula WCAG) contra o fundo escuro real = **5.23:1** (era 4.44:1) — passa AA. |

### `docs/revisao-pesquisas.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P1 | 36% dos nomes de candidatos (199/553) cortados por `ellipsis` no card mobile | **CORRIGIDO** | Auditoria ao vivo em 400×900 sobre `.db-top3-nome`: **0 de 553 elementos** com `scrollWidth > clientWidth` (era 199/553). Regra `@media (max-width: 640px)` agora sobrescreve para `white-space: normal; overflow-wrap: anywhere`, deixando o nome quebrar em vez de truncar. |
| P1 | Contraste do selo "SEM REGISTRO" = 3.25:1 (abaixo de 4.5:1 AA) | **CORRIGIDO** | Selo mudou de texto colorido sobre fundo transparente para **fundo sólido + texto branco** (`background: var(--spectrum-1-solid); color: var(--color-on-accent)`). Medido ao vivo: `rgb(255,255,255)` sobre `rgb(184,50,50)` = **5.93:1** — passa AA com folga. |

### `docs/critica-ui-inicio3.md`

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P0 | "BR" listado como um dos "18 estados" no texto da notícia diária | **CORRIGIDO** | Texto ao vivo hoje: *"52 novas pesquisas entraram na última atualização em **17 estados** (AL, DF, GO, MA, MG, MS, MT, PA, PE, PR, RJ, RN, RR, RS, SC, SE, SP) **e na disputa nacional**, de Alfa Inteligência, ..."* — `BR` não aparece mais na lista de siglas (`brInStateList: false`, checado por regex `\bBR\b` sobre o texto renderizado), e a contagem mudou de 18 para 17 (agora reflete só estados de verdade). Correção em `digest.ts`: `incluiNacional` separado de `ufsNovas`. |
| P1 | 7º tile ("Atualizado em") órfão sozinho numa 2ª linha em 1280px | **CORRIGIDO** | Big numbers agora tem **6 tiles** (não 7) — o tile redundante foi removido, não só reposicionado. DOM ao vivo: os 6 `.hm-bignum` têm o mesmo `top` (612px) — **1 única linha**, sem sobra. |
| P1 | Grade de 6 chamadas deixa 2 posições vazias na 2ª linha em 1280px | **CORRIGIDO** | `.hm-explore-grid` travado em `grid-template-columns: repeat(3, minmax(0, 1fr))` a partir do breakpoint. DOM ao vivo: 6 cards em 2 linhas de 3 (`lastRowCount: 3`) — grade 3×2 perfeita, sem espaço vazio. Confirmado visualmente em `capa-1280-dark.png`. |

**Placar consolidado: 20/20 itens P0/P1 confirmados CORRIGIDOS por medição de DOM ao vivo (não por
leitura de código isolada nem por impressão de screenshot).**

---

## 2. Regressões encontradas

### P1 — `#/pesquisas`, 1280×800: a página inteira pode ser rolada horizontalmente, revelando área morta e cortando a barra de navegação

- **Rota**: `#/pesquisas`, largura 1280px (desktop), tema escuro (reproduzido também em claro).
- **Seletor raiz do sintoma**: `document.documentElement` (`html`).
- **Seletor provável da causa**: `.db-table th` (`position: sticky; top: 0`) dentro de
  `.db-table-wrap` (`overflow-x: auto`), `src/adapters/inbound/web/styles/polls-database.css:216-231`.
- **Medição**: `document.documentElement.scrollWidth = 1749` contra `window.innerWidth = 1280`
  (`document.body.scrollWidth = 1280`, ou seja, o `body` está correto — é o `html` que "vaza").
  Apesar de `overflow-x: hidden` estar declarado tanto em `html` quanto em `body`
  (`getComputedStyle` confirma os dois), `window.scrollTo(500, 0)` **consegue mover a página**
  até `scrollX = 469` — ou seja, o `overflow-x: hidden` não está de fato bloqueando o scroll
  horizontal do documento, só escondendo a barra de rolagem.
- **Evidência visual**: `docs/screenshots/critica-final/REGRESSAO-pesquisas-1280-scroll-horizontal.png`
  (página rolada a `scrollX=400`) — a barra de navegação superior é cortada ("...vernadores" no
  lugar de "Governadores"), e uma faixa preta vazia de ~370px aparece à direita, com o conteúdo
  real empurrado para fora da viewport à esquerda.
- **Por que é regressão e não achado antigo**: nenhum dos sete relatórios testou
  `document.documentElement.scrollWidth` em 1280px para `#/pesquisas` — a revisão de pesquisas só
  mediu isso em 400px móvel ("Mobile (400px) — FALHA... `document.documentElement.scrollWidth ===
  window.innerWidth === 400`"). O item nunca foi checado em desktop, então isto nunca apareceu em
  nenhum relatório anterior como corrigido ou pendente — é um achado novo desta rodada de
  regressão, provavelmente pré-existente antes mesmo das correções desta janela (o `position:
  sticky` do cabeçalho da tabela é anterior), mas nunca antes detectado.
- **Impacto prático**: qualquer usuário de trackpad (gesto de deslizar 2 dedos) ou `Shift+roda do
  mouse` em `#/pesquisas` a 1280px consegue empurrar a página inteira para o lado sem querer,
  perdendo a navegação de volta até rolar de volta manualmente — em uma tela cujo propósito é
  consulta de dados tabulares (exatamente o tipo de interação de trackpad mais comum ao inspecionar
  uma tabela larga).
- **Não bloqueia**: a tabela em si funciona (rolagem interna própria em `.db-table-wrap` continua
  correta, com todas as 14 colunas acessíveis), e o bug só se manifesta com um gesto horizontal
  específico — não aparece no carregamento inicial (`scrollX = 0` por padrão).

### Nenhuma outra regressão encontrada

- **Erros de console**: zero em todas as 14 combinações da varredura (7 rotas × 1280/400px, tema
  escuro) — nenhum erro de JS, nenhum `pageerror`, e o `favicon.ico` 404 apontado em quase todos os
  relatórios como ruído está de fato resolvido (commit `873cf1e`, favicon SVG declarado).
- **`scrollWidth` em 400px**: `400 === clientWidth === innerWidth` em **todas as 7 rotas**, sem
  exceção — nenhuma regressão de overflow horizontal mobile.
- **`scrollWidth` em 1280px nas outras 6 rotas**: todas em `1280 === clientWidth === innerWidth`
  — só `#/pesquisas` diverge (ver acima).
- **Interações principais testadas e funcionais em todas as 7 rotas**:
  - Mapa: clique em SP abre painel com dados corretos (Tarcísio 47,1% / Haddad 30,3%);
    fluxo de 2 toques em mobile confirmado.
  - Presidente: `ArrowLeft` move o crosshair do gráfico e atualiza o tooltip.
  - Presidente por estado: clique em Roraima no mapa abre o painel (`panelOpen: true`).
  - Senado: clique num assento do hemiciclo (Amapá) abre o painel com dados corretos.
  - Partidos: clique no cabeçalho de coluna reordena a tabela (`changed: true`).
  - Base de pesquisas: filtro UF=SP muda a contagem de 238 para 8 pesquisas.
  - Capa: CTA "Ver o mapa" navega para `#/mapa` (`location.hash` bate).
- **Build**: `tsc --noEmit` limpo, `vite build` sem warnings além dos 2 avisos pré-existentes de
  code-splitting (não relacionados a nenhuma correção desta janela).
- **Testes automatizados**: `npm run test` — **332/332 passam, 20/20 arquivos**, incluindo os
  testes que cobrem diretamente os bugs corrigidos (`digest.test.ts`, `get-senate-by-state.test.ts`,
  `timeline-chart.test.ts`, `poll.test.ts` com `normalizarInstituto`).

---

## 3. Veredito final

## **Pronto para publicar: NÃO** (mas por uma margem pequena — 1 bug de layout, não de dado)

Os builders cumpriram o que prometeram: **20 de 20 itens P0/P1** dos seis relatórios de página e da
crítica da capa foram verificados, um a um, por medição de DOM ao vivo contra dados reais — não por
leitura de código nem por confiar na palavra dos commits. Isso inclui os dois bugs mais graves
encontrados nesta série de auditorias (troca de candidato/percentual no Senado em 8 UFs — um erro
de fato, não de estilo — e a contagem incorreta de partidos/federação desatualizada), ambos
confirmados corrigidos na fonte de dados e na tela. Os 332 testes automatizados também passam,
incluindo cobertura nova para os bugs específicos relatados.

A única coisa que impede o "SIM" é um bug de layout **novo e não documentado antes**: a página
`#/pesquisas` permite rolagem horizontal do documento inteiro em 1280px, cortando a navegação e
revelando espaço morto — descoberto só nesta rodada de regressão porque nenhuma das sete auditorias
anteriores testou `scrollWidth` do documento em desktop para essa rota especificamente (só em
mobile). Não é um bug de dado, não bloqueia nenhuma função, e o gatilho (gesto de trackpad/`Shift`+
roda) não é o caminho mais comum de uso — mas numa página cujo conteúdo central é uma tabela larga
(o cenário exato em que usuários tendem a testar rolagem horizontal), é exatamente o tipo de defeito
que reprovaria a tela numa checagem editorial land antes de publicar. Recomendação objetiva (não
aplicada, instrução era não editar código): investigar por que `position: sticky` no cabeçalho da
tabela, dentro do contêiner `overflow-x: auto`, está fazendo `document.documentElement.scrollWidth`
"vazar" para além do `body` apesar de `overflow-x: hidden` estar declarado em ambos — possivelmente
um `contain: layout` ou `overflow-x: clip` no `html`/`body` resolve sem tocar na tabela em si.

---

## Evidência anexa

Screenshots em `docs/screenshots/critica-final/` (15 arquivos):

- `mapa-1280-dark.png`, `mapa-1280-dark-painel-sp.png`, `mapa-400-dark.png`
- `presidente-1280-dark.png`, `presidente-400-dark.png`
- `presidente-estados-1280-dark.png`, `presidente-estados-votos-1280-dark.png`
- `senado-1280-dark.png`
- `partidos-1280-dark.png`
- `pesquisas-1280-dark.png`, `pesquisas-400-dark.png`, `pesquisas-1280-dark-overflow-check.png`
- `capa-1280-dark.png`, `capa-400-dark.png`
- `REGRESSAO-pesquisas-1280-scroll-horizontal.png`

JSONs de auditoria DOM completos (não versionados, no scratchpad da sessão):
`audit-part1.json` (mapa, presidente), `audit-part2.json` (mapa scrollY=0, presidente-estados,
votos estimados), `audit-part3.json` (senado, partidos, pesquisas), `audit-part4.json` (capa,
varredura de regressão nas 7 rotas), `pesquisas-overflow-diag.json` e `pesquisas-scroll-test.json`
(diagnóstico da regressão).
