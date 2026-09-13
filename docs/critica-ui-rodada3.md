# Crítica de UI — Rodada 3

Metodologia: `npm run build` + `vite preview` (porta 4175), Playwright/Chromium headless
(`/opt/pw-browsers/chromium-1194`), tema escuro (`colorScheme: 'dark'`). Medições objetivas via
`page.evaluate` (`getBoundingClientRect()`, `document.documentElement.scrollWidth`,
`getComputedStyle`) — não "parece ok visualmente". Rotas: `/#/mapa`, `/#/mapa` com painel de MG
aberto, `/#/presidente`, `/#/senado`. 12 PNGs em `docs/screenshots/critica3/` (dentro do limite de
12), todos lidos com a ferramenta de leitura de imagem. Barra de qualidade: `docs/ux-spec.md` §1
(NYT `polls-president.html` e `results-senate.html`). Comparado contra `docs/critica-ui-rodada2.md`.

**Nota de processo**: a instrução pedia hover em MG/SP/RS "com a página no topo" em 1280×800. A
essa resolução, com `scrollY=0`, o SVG do mapa (936px de altura) deixa SP e RS abaixo da dobra
(SP: `top=763`, RS: `top=944`, viewport = 800px) — não é possível apontar o mouse para um estado
que não está renderizado na tela. Isso não é o bug do tooltip da rodada 2 (que ocorria mesmo com o
estado visível); é geometria do mapa vs. viewport. Para não reportar um falso negativo, testei SP e
RS adicionalmente após rolar a página o suficiente para o estado ficar visível — nesse caso o
tooltip também ficou 100% dentro da viewport (ver §2). MG, que fica visível a `scrollY=0`, foi
testado nas duas resoluções exatamente como pedido.

---

## 1. Checklist da rodada 2 — item por item

| # | Item (rodada 2) | Veredito | Evidência |
|---|---|---|---|
| P0/P1-1 | Tooltip do mapa renderiza fora da viewport (clampava contra a altura do SVG, não da janela) | **CORRIGIDO** | `map-view.ts:193-212`, `posicionarTooltipPerto()` agora usa `window.innerWidth`/`innerHeight` e `x`/`y` já em coordenadas de viewport (`clientX`/`clientY`), com clamp em ambos os eixos. Medido: hover em MG a `scrollY=0`, 1280×800 → `#map-tooltip` `top=616.2` `bottom=782.3` (dentro de 0–800, `insideViewport: true`); 400×800 → MG `top=621.5/bottom=787.6`, SP `top=463.2/bottom=629.3`, RS `top=556.9/bottom=703.5`, todos dentro de 0–800. Após rolar para tornar SP visível em 1280×800, tooltip ficou em `top=445.1/bottom=611.2` (janela 800px) — também 100% dentro. Screenshots: `mapa-hover-mg__1280x800__dark.png`, `mapa-hover-mg__400x800__dark.png`. |
| P2-2 | "Ver as 1 pesquisa usadas" (concordância errada no singular) | **CORRIGIDO** | `state-panel.ts:284-302` agora declina artigo, substantivo e particípio (`pluralizar()` em `format.ts:69`) independentemente. Capturado ao vivo no painel de MG (Senador, 1 pesquisa): `"Ver a 1 pesquisa usada"` — texto correto. O caso plural (Governador, 3 pesquisas) também renderizou certo: `"Ver as 3 pesquisas usadas"`. |
| P2-3 | Agregador presidencial sem faixa de incerteza atrás da barra | **CORRIGIDO** | `presidential-view.ts:157-188` adiciona `.pv-bar-uncertainty` (span absoluto, `left`/`width` = `pct ± margemReferencia`, mesma cor da barra, `opacity: 0.3` fixo em `views.css:183-189`, `aria-hidden="true"`). Confirmado via DOM real em `/#/presidente` 1280px: 5 barras amostradas, todas com `.pv-bar-uncertainty` presente e `opacity: 0.3`, geometricamente centradas no valor da barra. Visível a olho em `presidente__1280x800__dark.png` e `presidente-mobile-top.png` (faixa mais clara ultrapassando a ponta da barra sólida). O painel do estado já tinha essa faixa (`.bar-uncertainty`, `opacity: 0.35`) — agora as duas telas com barra de candidato são consistentes entre si. |

**3 de 3 itens da rodada 2 confirmados corrigidos**, incluindo o P0 mais grave (tooltip). O builder
não exagerou desta vez também.

---

## 2. Vereditos por peça

| Peça | Veredito | Justificativa (2 linhas) | Maior lacuna restante |
|---|---|---|---|
| **Mapa (coroplético)** | **O nosso vence** | Matiz de 5 pontos + opacidade de confiança + hachura + rótulo de UF inline seguem mais densos em informação que o diverging binário do NYT. | Em 1280×800 o SVG (936px) é mais alto que a janela — SP e RS exigem rolagem antes de serem sequer apontáveis; o NYT encolhe o mapa para caber acima da dobra. |
| **Tooltip (hover)** | **NYT vence, mas por margem pequena — inverteu de volta desde a rodada 2** | O clamp contra `window.innerHeight` está correto e verificado nos 3 estados × 2 resoluções: nenhum tooltip saiu da tela. | Falta paridade com o NYT em conteúdo: o tooltip do NYT mostra os dois principais candidatos com % de cada; o nosso mostra só o líder (nome, partido, vantagem em pontos) — para ver o 2º colocado é preciso clicar e abrir o painel inteiro. |
| **Painel/drawer do estado** | **O nosso vence** | Governador + senador, barras com faixa de incerteza rotulada em texto ("Faixa = margem de erro (± X pontos)"), badge de partido isolado, concordância singular/plural corrigida. | Nome do candidato trunca em telas estreitas (`.bar-row__nome`, largura fixa da coluna) — mas tem `title` com o nome completo, então é degradação aceitável (mouse) e não bloqueia leitor de tela (texto real). |
| **Agregador presidencial** | **O nosso vence** | Faixa de incerteza agora desenhada e com legenda textual explicando o que é ("A faixa mais clara atrás de cada barra é a margem de erro..."); tabela de pesquisas colapsa para cards em mobile sem estourar `scrollWidth`. | Nome do candidato trunca em mobile (`.pv-bar-name-text`, `text-overflow: ellipsis`) **sem `title`** — diferente do painel do estado, que tem esse fallback. Achado novo (ver bugs). |
| **Hemiciclo do Senado** | **O nosso vence, com folga** | As 3 faixas de confiança têm opacidades mensuravelmente distintas (1 / 0.72 / 0.45, confirmado via `getComputedStyle`, não só "parece diferente"), marcador de 41, filtro por UF, bancada por partido com contagem numérica. | Segue sem nenhuma cadeira com confiança "indefinida" (sem pesquisa de senador) nos dados atuais — a única classe `espectro-indefinido` presente é de uma cadeira **fixa** (partido não classificado), não de uma projetada sem dado. Mesma lacuna apontada na rodada 2, ainda não teve como ser reverificada porque os dados não mudaram. |
| **Cadastro de partidos** | **Não testado nesta rodada** | Fora do escopo de screenshots desta rodada (rodada 2 já havia confirmado ordenação por Número/Espectro); nenhuma mudança de código na área foi encontrada nesta revisão. | — |
| **Tipografia/cor geral** | **O nosso vence** | Fontes de sistema como fallback renderizam legível em todas as capturas (Google Fonts bloqueado no ambiente, como já registrado na rodada 2); tokens de espectro com 3 variantes de tema continuam intactos. | Nenhuma pendência nova identificada. |
| **Mobile geral (400px)** | **O nosso vence, sem exceção** | `scrollWidth = 400` (igual ao viewport) em `/#/mapa`, `/#/presidente`, `/#/partidos` e no painel de MG aberto — nenhuma rota testada nesta rodada estourou horizontalmente. | A truncagem sem `title` no agregador presidencial (acima) é pior em mobile especificamente, porque não há hover para compensar — é a única pendência de mobile desta rodada. |

---

## 3. Bugs objetivos novos (por prioridade)

### P2 — inconsistência/acabamento
1. **Nome do candidato trunca sem `title` no agregador presidencial, em mobile.**
   `presidential-view.ts:171`: `criarEl('span', { className: 'pv-bar-name-text', texto: candidato.candidato })`
   — sem atributo `title`. `views.css:160-164` aplica `overflow: hidden; text-overflow: ellipsis;
   white-space: nowrap` sobre essa classe, dentro de uma coluna `minmax(120px, 1fr)`
   (`views.css:146`). Em 400px isso corta nomes longos: capturado ao vivo em
   `presidente-mobile-top.png` como "Luiz Ináci…", "Flávio Bol…", "August…". O mesmo padrão no
   painel do estado (`state-panel.ts`, `.bar-row__nome`) **tem** `title="${rotuloCompleto}"` — a
   inconsistência entre as duas telas é o problema: o usuário mobile do agregador presidencial (que
   não tem hover) não tem nenhuma forma de ver o nome completo do 3º colocado sem abrir o dev tools.
   Não é um bug novo introduzido por esta correção — já existia antes —, mas nenhuma das 3 correções
   da rodada 2 tocou essa área e ele segue objetivamente presente. Prints: `presidente-mobile-top.png`.

### Notas (não são bugs de produto)
2. Confirma-se novamente `ERR_CONNECTION_RESET` em `fonts.googleapis.com` neste ambiente de rede
   bloqueada — mesma observação da rodada 2, sem impacto de layout (fallback de sistema funciona).
3. O hemiciclo continua sem um caso real de cadeira "indefinida" (projetada, sem pesquisa) nos
   dados atuais para confirmar a hachura *nesse componente específico* — mesma lacuna não-crítica
   registrada na rodada 2 (a técnica de hachura já está provada no mapa).

Nenhum bug de dado incorreto na tela, nenhum problema de contraste novo, e nenhum foco quebrado
foram encontrados nesta rodada (verificado: `aria-label` completo por `path`, `tabindex="0"` nos 27
estados).

---

## 4. Lacunas em ordem de impacto

1. **Nome truncado sem `title` no agregador presidencial mobile** (bug 1) — cosmético/acessibilidade
   menor, mas é o único ponto onde uma tela perde uma proteção que a tela irmã (painel do estado) já
   tem. Correção é de uma linha (`attrs: { title: candidato.candidato }`).
2. **Tooltip só mostra o líder, não os dois primeiros colocados como o NYT** — não é regressão, é uma
   lacuna de paridade de conteúdo que existia antes e não foi o alvo desta rodada; registrada para
   priorização futura.
3. **Mapa mais alto que a janela em 1280×800** — força rolagem para alcançar SP/RS/PR/SC antes de
   poder até apontar o mouse; não é o bug de tooltip (que está corrigido), mas é o motivo pelo qual
   testar hover em SP/RS "no topo da página" exigiu o desvio de metodologia documentado na abertura
   deste relatório.

---

## 5. Veredito final

**Pronto para publicar: SIM.**

Os 3 itens levados da rodada 2 — incluindo o P0 do tooltip fora da viewport, que era o único
bloqueador — foram genuinamente corrigidos e verificados com medição objetiva (`getBoundingClientRect`
contra `window.innerHeight`, não inspeção visual do primeiro estado que aparecer). A única pendência
nova encontrada (nome truncado sem `title` no agregador presidencial mobile) é cosmética/de
acessibilidade menor: degrada a experiência de um usuário mobile tentando ler o nome completo do 3º
colocado, mas não quebra nenhuma função, não esconde dado nenhum (o texto completo está no DOM para
leitor de tela) e tem correção trivial. As duas lacunas remanescentes registradas na seção 4 (paridade
de conteúdo do tooltip com o NYT; ausência de caso de teste para hachura "indefinida" no hemiciclo) são
de escopo/dado, não de defeito, e já estavam fora do pedido desta rodada.
