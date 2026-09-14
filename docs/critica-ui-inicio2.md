# Crítica UI — Início (rodada 2)

Auditoria de `views/home-view.ts` + `styles/home.css` contra `docs/briefing-landing-page.md`, com build de produção (`npm run build`), `vite preview` na porta 4189, Chromium via Playwright (`/opt/pw-browsers`) e medições reais de DOM (`getComputedStyle`, `getBoundingClientRect`, `document.fonts`, cálculo de contraste WCAG). Screenshots em `docs/screenshots/critica-inicio2/`.

**Nota metodológica importante:** a primeira rodada de testes rodou com o Chromium sem o proxy de saída da sandbox configurado, e a stylesheet do Google Fonts falhou com `net::ERR_CERT_AUTHORITY_INVALID` — Fraunces/Inter/JetBrains Mono nunca carregaram e a página caiu inteira para a fonte serifada padrão do sistema (confirmado por três `canvas.measureText` idênticos entre `Fraunces`, `serif` genérico e um nome de fonte inexistente). Isso é um artefato da sandbox de teste (proxy TLS), não um bug do site — refiz toda a auditoria com `--proxy-server=127.0.0.1:33807 --ignore-certificate-errors`, e as fontes carregaram normalmente (200 em todas as requisições `fonts.gstatic.com`, `document.fonts` com as faces `Fraunces 600 normal [loaded]`, `Inter 600 normal [loaded]`, `JetBrains Mono 400/500 [loaded]`, `measureText` do nome do líder em Fraunces real = 128.4px vs. 120.06px do fallback forçado — diferença real de glifo confirmada). Todos os achados abaixo usam essa segunda rodada, com fontes de fato carregadas.

## Tabela: regra do briefing → status com evidência de DOM

| Regra do briefing | Status | Evidência |
|---|---|---|
| `--hm-canvas/surface/ink/ink-muted` por tema | CORRIGIDO | `getComputedStyle` confirma dark `#0a0b0d`/`#17181b`/`#f2f0ea`/`#9a9ea5` e light `#f7f6f2`/`#ffffff`/`#17181b`/`#5c6066`, batendo com o briefing. |
| `--hm-selo` dourado único acento (eyebrow, "como calculamos", selo TSE contorno, hover CTA primário) | CORRIGIDO | Grep em `home.css` não encontra nenhum outro uso de `--hm-selo`; nenhum badge de partido ou CTA secundário usa a cor. |
| `--hm-verificado` verde só no selo TSE | CORRIGIDO | Uso único em `.hm-selo-tse { color: var(--hm-verificado) }`. |
| Espectro político só via tokens globais `--spectrum-*`, nunca repintando nav/CTA/eyebrow | CORRIGIDO | Nenhum uso de `--spectrum-*` fora de badges de partido, chips do mapa e swatches do Senado. |
| Proibido indigo `--color-accent`, glassmorphism, blur, glow, gradiente | CORRIGIDO | `grep -n "gradient\|blur\|glow\|backdrop-filter\|--color-accent"` em `home.css` não retorna nenhuma ocorrência de propriedade real (só um comentário explicando a proibição). |
| Contraste dourado/verde ≥ 4.5:1 nos dois temas | CORRIGIDO | Calculado via WCAG a partir do RGB computado real: dourado/escuro **7.89:1**, verde/escuro **5.19:1**, dourado/claro **5.26:1**, verde/claro **5.37:1** — todos passam com folga. O CSS *desvia deliberadamente* do hex literal do briefing no tema claro (`#8f640a` em vez de `#d9a441`) — comentário no código justifica isso como necessário para o próprio contraste que o briefing pede; correto. |
| Fraunces (600 reto/itálico) só no nome/percentual do líder no hero | CORRIGIDO | `.hm-hero__lider-nome`, `.hm-hero__lider-pct`, `.hm-hero__vantagem`, `.hm-hero__empate` computam `font-family: Fraunces, ...`; nenhum outro elemento do hero ou das seções seguintes usa Fraunces. `document.fonts` mostra a face carregada (`Fraunces 600 normal [loaded]`) e o itálico real é acionado sob demanda (ver linha do empate técnico abaixo). |
| Inter em todo corpo/UI | CORRIGIDO com 1 exceção (ver bugs) | Eyebrow, labels de card, corpo de "O que você encontra aqui"/"Como funciona", nome de instituto/candidato — todos computam `"Inter var", Inter, ...`. **Exceção:** `.hm-explore-card__stat` (ver P0 abaixo). |
| JetBrains Mono só em percentual/timestamp/contagem | VIOLADO (P0 pontual) | Ver bug P0 "`.hm-explore-card__stat` em mono" abaixo — o restante da tela está correto (percentuais, datas de pesquisa, "Base de pesquisas" 238, timestamp do eyebrow todos em mono; rótulos e nomes em Inter). |
| Eyebrow "PRESIDENTE · 1º TURNO" + timestamp exato, sem inventar hora | CORRIGIDO | `data/meta.json` só tem data (`"atualizadoEm": "2026-09-13"`), e o eyebrow renderiza "Atualizado em 13/09/2026" sem hora — nenhuma hora inventada. |
| Nome do líder gigante + badge partido + percentual, Fraunces | CORRIGIDO | Ver screenshot `02-dark-1280-hero.png`: "Lula" (Fraunces 60px) + badge "PT" + "38,9%" (Fraunces 40px). |
| 2º colocado + vantagem "+N,N pts" (Fraunces reto) ou "EMPATE TÉCNICO" (Fraunces itálico) | CORRIGIDO | Estado real dos dados mostra vantagem "+4,5 pts" em Fraunces reto. Empate técnico forçado no DOM (sem tocar código-fonte, ver abaixo) confirma `font-style: italic` computado de verdade, não decorativo. |
| Faixa de margem de erro sob o número, reaproveitando padrão de `presidential-view.ts` | CORRIGIDO | `.hm-hero__track` presente com fill + faixa de incerteza + tick do 2º colocado, usando `calcularFaixaIncerteza` compartilhado. |
| Linha de confiança "média de N pesquisas" + "como calculamos" sempre visível, nunca em rodapé | CORRIGIDO | Aparece logo abaixo da faixa, dentro do hero (`02-dark-1280-hero.png`). |
| Textura hachura 4–6% de opacidade atrás do hero | CORRIGIDO | `getComputedStyle('.hm-hero__texture').opacity === "0.05"` (5%, dentro da faixa) nos dois temas; `z-index:0` fica atrás do `.hm-hero__inner` (`z-index:1`) — não atrapalha a leitura (confirmado visualmente nos screenshots). |
| Ordem pós-hero: Resumo do dia → prévia mapa/hemiciclo → últimas pesquisas → o que você encontra → como funciona → fontes | CORRIGIDO | `renderHome()` monta exatamente essa sequência; confirmado visualmente em `01-dark-1280-full.png`. |
| Sem scroll horizontal em 400px | CORRIGIDO | `document.documentElement.scrollWidth === 400 === innerWidth` em 400×800, nos dois temas testados. |
| Foco visível | CORRIGIDO | `.hm-view *:focus-visible` usa `box-shadow: var(--focus-ring)` (token global). |
| `prefers-reduced-motion` | CORRIGIDO (herdado) | Regra global em `styles/app.css` (`*, *::before, *::after { transition-duration: 0ms !important }`) cobre as transições de `.hm-cta`/`.hm-explore-card`; `home.css` não precisa duplicá-la. |
| Nunca só cor (badge partido, selo TSE, chips do mapa) | CORRIGIDO | Badge de partido tem `title` + `sr-only`; selo TSE tem texto "Registrado no TSE" explícito; chips do mapa têm `title` + `sr-only` com a situação por extenso. |
| CTAs e links com alvo de toque ≥44px | VIOLADO (1 caso) | Ver bug P0 "Ver hemiciclo do Senado" abaixo. Todos os outros alvos testados passam (ver tabela de medições). |
| Tema claro com mesmo cuidado do escuro | CORRIGIDO, com ressalva de qualidade | Paleta/contraste corretos (ver acima); ver crítica qualitativa sobre ritmo genérico, que afeta os dois temas igualmente. |

## Medições de alvo de toque (`getBoundingClientRect`, 1280px — idêntico em 400px)

| Elemento | Visível (w×h) | Hit-slop `::before` | Efetivo | Resultado |
|---|---|---|---|---|
| "Ver o mapa" (CTA primário) | 120.9×44 | — | 120.9×44 | PASSA (ambos ≥44) |
| "Ver presidente" (CTA) | 142×44 | — | 142×44 | PASSA (ambos ≥44) |
| "como calculamos" | 110×16 | `-15px -6px` | ~123×46 | PASSA via hit-slop |
| "Fonte" (1º card) | 39.6×22.5 | `-15px -8px` | ~55.6×52.5 | PASSA via hit-slop |
| "Ver mapa completo →" | 135.9×19.5 | `-15px -8px` | ~152×49.5 | PASSA via hit-slop |
| "Ver todas →" | 74×19.5 | `-15px -8px` | ~90×49.5 | PASSA via hit-slop |
| **"Ver hemiciclo do Senado →"** | **193×22.5** | **nenhum** | **193×22.5** | **FALHA** — 22.5px não atinge nem os 44px do briefing, nem a alternativa 24px |

## Bugs por prioridade

### P0 — bloqueantes

1. **Texto de rótulo inteiro em JetBrains Mono, violando a regra "Inter no corpo, mono só em dado".**
   `.hm-explore-card__stat` (seção "O que você encontra aqui") aplica a classe `tabular-nums` ao parágrafo inteiro, não só ao número. `getComputedStyle` confirma: o nó de texto completo `"27 de 27 estados com pesquisa"` — incluindo as palavras "de", "estados", "com", "pesquisa" — computa `font-family: "JetBrains Mono", ...`. Visualmente confirmado em `docs/screenshots/critica-inicio2/11-dark-1280-explore-zoom.png`: a legenda de cada card ("27 de 27 estados com pesquisa", "67 pesquisas nacionais", "31 partidos" etc.) inteira sai em monoespaçada, brigando com o título Inter logo acima. É exatamente o tipo de erro que o briefing proíbe explicitamente. Afeta as 6 legendas de todos os cards de "O que você encontra aqui", nos dois temas.
   *Correção:* envolver só o número (`${ufsComGovernador}`, `${overview.length}` etc.) num `<span class="tabular-nums">` e deixar o resto do texto sem a classe — mesmo padrão já usado corretamente em `construirCardBaseDePesquisas`.

2. **"Ver hemiciclo do Senado →" sem alvo de toque mínimo.**
   Usa só a classe `.hm-quiet-link`, que não está na lista de seletores que ganham hit-slop via `::before` (`.hm-link-fonte, .hm-section__link`). Resultado medido: 193×22.5px, sem qualquer compensação — abaixo tanto do "≥44px" do briefing quanto da alternativa "44/24px". Todo o resto da tela (Fonte, Ver mapa completo, Ver todas, como calculamos) tem esse cuidado; esse link específico foi esquecido.
   *Correção:* adicionar `.hm-quiet-link` (ou especificamente esse link) à lista de seletores com hit-slop, ou dar-lhe `min-height:44px` com `display:inline-flex;align-items:center`.

3. **Contraste insuficiente do texto branco sobre os chips de UF do "mapa até agora" (todas as 5 cores do espectro).**
   `.hm-mapa-preview__chip` usa `color:#fff` sobre `background: var(--spectrum-N-fill)`. Medido via `getComputedStyle` + fórmula WCAG:
   - Tema escuro: espectro-5 (direita) **2.54:1**, espectro-1 (esquerda) **3.48:1**, espectro-3 **3.25:1**, espectro-4 **3.06:1** — todos abaixo de 4.5:1, o pior (2.54:1) nem chega ao mínimo de 3:1 para texto grande.
   - Tema claro: espectro-1 **3.48:1** e espectro-5 (com opacidade de empate) **4.43:1** também ficam abaixo de 4.5:1.
   Isso não é coincidência de má sorte: o comentário em `tokens.css` linha 145–150 diz textualmente que os tokens `--spectrum-*-fill` foram calibrados para **3:1 (WCAG 1.4.11, contraste não-textual)** — ou seja, foram desenhados para *preencher áreas* (mapa, hemiciclo), não para receber texto em cima. O preview do mapa na home é o único lugar que põe a sigla da UF (texto) diretamente sobre esse preenchimento, e herdou um token pensado para outro uso. É um bug real de acessibilidade, ainda que a causa raiz esteja num token compartilhado fora do escopo editável desta tela.
   *Correção (dentro do escopo de `home.css`, sem tocar `tokens.css`):* trocar a cor do texto do chip para preto/cor escura fixa, ou aplicar `text-shadow`/contorno, ou usar as variantes `-solid` (mais escuras, já validadas para texto branco) em vez de `-fill` nos chips.

### P1 — importantes

4. **Duas landing pages de créditos na mesma tela.** O `<footer class="site-footer">` global (`main.ts`, fora do escopo desta view) repete, logo abaixo da seção "Fontes e créditos" já construída por `home-view.ts`, praticamente a mesma frase ("Mapa: @svg-maps/brazil... Fontes: institutos de pesquisa..."). Confirmado em `01-dark-1280-full.png` — o rodapé de créditos aparece duas vezes seguidas, uma vez detalhada (seção da home) e uma vez resumida (rodapé do site). Fora do escopo de edição desta tarefa (`main.ts`), mas é uma redundância visível que vale reportar.
5. **Inconsistência de mono dentro da mesma frase curta.** Em "Base de pesquisas", `"194 de 238 pesquisas"`: o "194" (`comRegistroTSE`) está envolto em `<span class="tabular-nums">` e sai em mono; o "238" (`total`), na mesma frase, é texto solto e sai em Inter. Não é o erro grave do item P0 (não é uma palavra virando mono), mas é uma inconsistência de tratamento entre dois números irmãos na mesma sentença — um leitor atento percebe o descompasso visual.

### P2 — polimento / crítica qualitativa

6. **Ritmo vertical monótono entre seções.** `.hm-view` usa um único `gap: var(--space-8)` (96px) entre *todas* as sete seções da home, do hero ao rodapé de créditos, sem variação de peso ou densidade. Em comparação com o padrão de referência (NYT Upshot, FiveThirtyEight), que varia a separação e o tratamento de fundo por seção para criar hierarquia editorial, aqui cada seção recebe exatamente o mesmo respiro — o efeito, principalmente na versão de página inteira (`01-dark-1280-full.png`), é de um template de cards genérico e uniforme, não de uma página desenhada seção a seção. Não é uma violação de regra do briefing, é uma oportunidade de refinamento editorial.
7. **Grade de "O que você encontra aqui" com sobra visual.** Com 6 cards e `auto-fill` a 1280px, a segunda linha fica com só 2 cards alinhados à esquerda e um vão vazio à direita (`01-dark-1280-full.png`). Funciona, mas não é elegante; vale considerar `auto-fit` com `justify-items` ou simplesmente redistribuir para uma grade fixa de 3 colunas.

## Itálico do empate técnico — verificação forçada no DOM

Os dados atuais não têm nenhuma disputa em empate técnico, então forcei o estado diretamente no navegador (sem tocar o código-fonte): substitui o nó `.hm-hero__vantagem` por um `<em class="hm-hero__empate">Empate técnico</em>`, replicando exatamente o que `construirLinhaSegundo()` geraria. `getComputedStyle` confirmou `font-style: italic`, `font-family: Fraunces, ...`, `font-weight: 600` — itálico real do Fraunces, não um efeito falso. Confirmado visualmente em `docs/screenshots/critica-inicio2/07-light-1280-empate-forcado.png`: "*Empate técnico*" aparece visivelmente inclinado, distinto do "+4,5 pts" reto que substituiu.

## Navegação (cliques reais)

- "Ver o mapa" → navega para `#/mapa`, view renderiza conteúdo (>100 caracteres no DOM).
- "Ver presidente" → navega para `#/presidente`, view renderiza conteúdo.
Ambos os links do hero funcionam.

## Dado: `meta.atualizadoEm` vs. `data/polls.json`

`data/meta.json` diz `"atualizadoEm": "2026-09-13"`. A data mais recente encontrada em `data/polls.json` é `publicadoEm: "2026-09-12"` (a `dataFim` mais recente é `2026-09-11`). Há 1 dia de diferença — plausível se a rotina rodou no dia 13 sem achar pesquisa nova, mas vale confirmar. **Isto é um bug de dados/rotina, não desta peça de UI** — reportando conforme solicitado, sem tocar código.

## Veredito final

**Pronto para publicar: NÃO.**

A tela cumpre a esmagadora maioria do briefing com rigor real (paleta, contraste dourado/verde, Fraunces restrito ao hero com itálico genuíno no empate, ordem das seções, hachura na faixa certa de opacidade, ausência de indigo/glassmorphism/gradiente, zero scroll horizontal em 400px, quase todos os alvos de toque com hit-slop bem pensado) — é um trabalho competente e claramente acima da média de "landing gerada por IA". Mas tem três defeitos objetivos, verificados por DOM, que não são cosméticos:

1. Uma violação direta e visível da regra tipográfica central do briefing (frases inteiras em JetBrains Mono nos 6 cards de "O que você encontra aqui");
2. Um link sem alvo de toque mínimo (contrariando uma regra explícita "que segue valendo");
3. Um problema real de contraste (texto branco sobre os 5 preenchimentos do espectro no preview do mapa, com o pior caso em 2.54:1 — mais da metade abaixo do mínimo).

Nenhum desses é difícil de corrigir, mas todos são bugs reais, não nitpicking — corrigir os três antes de publicar.
