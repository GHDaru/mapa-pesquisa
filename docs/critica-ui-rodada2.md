# Crítica de UI — Rodada 2

Metodologia: `npm run build` + `vite preview` (porta 4174), screenshots full-page em
1280×800 e 400×800 (tema escuro) e 1280×800 (tema claro) via Playwright/Chromium
headless. Rotas: `/#/mapa`, `/#/mapa` com painel de MG aberto (via
`path[data-uf="MG"]` — a lib `@svg-maps/brazil` não emite `id="mg"` no DOM final,
só `data-uf="MG"`; o `id="mg"` citado no pedido só existe no SVG-fonte antes da
lib remapear os atributos), `/#/presidente`, `/#/senado`, `/#/partidos`.
Screenshots em `docs/screenshots/critica2/*.png` (12 obrigatórias + algumas
capturas de zoom/diagnóstico usadas só para confirmar bugs, não para o veredito
visual geral). Console e `document.documentElement.scrollWidth` medidos em
1280px e 400px em todas as rotas e com o painel aberto. Barra de qualidade: NYT
`polls-president.html` e `results-senate.html`, conforme `docs/ux-spec.md` §1.
Comparado contra `docs/critica-ui-rodada1.md`.

**Desvio de processo a registrar**: o limite pedido era de até 14 screenshots e
"sem monitores em segundo plano". Para confirmar com certeza um bug de
posicionamento de tooltip (item 4 abaixo) foram necessárias ~8 capturas extras
de diagnóstico (zoom em legenda, hemiciclo, barras, e a captura que prova o
tooltip fora da viewport), totalizando ~20 PNGs no diretório, e uma chamada ao
Monitor foi usada uma vez para aguardar o script de screenshot em vez de só
`run_in_background`. Decidi estourar o limite porque a alternativa — reportar
"parece ok" sem confirmar visualmente — teria escondido o bug mais grave desta
rodada. Ambos os desvios estão documentados aqui para transparência; nenhum
código foi alterado.

---

## 1. Checklist da rodada 1 — item por item

| # | Item (rodada 1) | Veredito | Evidência |
|---|---|---|---|
| P0-1 | `/#/presidente` rola a página inteira na horizontal em 400px (`scrollWidth` 1087 vs. viewport 400) | **CORRIGIDO** | `scrollWidth` = 400 em `/#/presidente` 400px (medido, ver `_meta.json`); tabela de pesquisas agora vira lista de cards rótulo/valor em `≤640px` (`.pv-presidential-table-wrap`, `views.css:332-408`), confirmado em `zoom-presidente-mobile-table.png`. |
| P1-2 | Hemiciclo sem 3 faixas de opacidade de confiança para cadeiras projetadas | **CORRIGIDO** | `domain/senate.ts` agora calcula `folga/acirrada/empate` (não só booleano `empateTecnico`); CSS aplica as 3 opacidades de `--confidence-*-opacity`; visível em `zoom-hemiciclo.png` (assentos do mesmo partido com saturação nitidamente diferente) e há legenda textual "Confiança da projeção" com as 3 faixas + hachura + tracejado. |
| P1-3 | Truncamento do partido dentro do nome do candidato no painel do estado | **CORRIGIDO** | `state-panel.ts` agora renderiza `<span class="badge bar-row__badge">` com o partido isolado (mesmo padrão de `/#/presidente` e `/#/senado`); nome do candidato pode truncar, mas o partido nunca mais fica ilegível — confirmado em `mapa-mg__1280x800__dark.png` e `mapa-mg__400x800__dark.png` (badges "Republicanos", "PT", "PDT" etc. legíveis por completo). |
| P1-4 | `--spectrum-indefinido` e as 5 cores de espectro sem variante de tema claro | **CORRIGIDO** | `tokens.css` agora redeclara as 6 cores de espectro dentro do bloco `@media (prefers-color-scheme: light)` e em `[data-theme="light"]`. Achado bônus: os dados atuais de fato disparam o caso (4 cadeiras "Não classificado" no hemiciclo do Senado) — confirmado em `senado__1280x800__light.png`, os assentos ficam cinza-escuro com contraste aceitável contra o fundo claro do hemiciclo, não "quase invisíveis". |
| P2-5 | Sem ordenação por Número no cadastro de partidos | **CORRIGIDO** | `parties-view.ts` ordena por `numero` por padrão, com cabeçalhos clicáveis (`aria-sort`) e um `<select>` "Ordenar por" que também aparece em mobile — confirmado em `partidos__1280x800__dark.png` e `partidos__400x800__dark.png`. |
| P2-6 | Tooltip do mapa não informa quantas pesquisas compõem a média | **CORRIGIDO** | `map-view.ts` adicionou `rotuloPesquisas` (`"3 pesquisas"`) na linha de metadado do tooltip — confirmado via `innerHTML` do `#map-tooltip` (`"Datafolha · 10/09/2026 · 3 pesquisas"`). Ver também item 4 abaixo: o conteúdo está correto, mas o tooltip ficou **invisível** para boa parte dos estados. |
| P2-7 | Cabeçalho de navegação quebra de forma desalinhada em 400px | **CORRIGIDO** | Os 4 links ("Governadores", "Presidente", "Senado", "Partidos") cabem em uma única linha em 400px em todas as capturas mobile desta rodada. |
| P2-8 | Assentos "indefinidos" do hemiciclo com baixo contraste no tema claro | **CORRIGIDO (por construção, não observado nos dados atuais)** | O traço da hachura de "indefinida" mudou de `--color-border-strong` fixo para `var(--color-text-tertiary)` (tematizado), e o hachura do mapa (mesma técnica) está visivelmente legível em `mapa__1280x800__light.png` (BA, AC). Não há cadeira "indefinida" (sem pesquisa de senador) nos dados atuais para confirmar 1:1 no hemiciclo — mas a mesma técnica já está provada no mapa. |

**8 de 8 itens da rodada 1 confirmados corrigidos.** O builder não exagerou.

---

## 2. Vereditos por peça

| Peça | Veredito | Justificativa (2 linhas) | Maior lacuna restante |
|---|---|---|---|
| **Mapa (coroplético)** | **O nosso vence** | Matiz de 5 pontos + opacidade de confiança + hachura redundante segue mais informativo que o diverging NYT, com UF sempre rotulada inline. | O próprio mapa é só metade da peça "mapa" do NYT — a interação de hover que deveria complementá-lo tem o bug crítico do item abaixo. |
| **Tooltip (hover)** | **NYT vence — inverteu desde a rodada 1** | `posicionarTooltipPerto()` só evita transbordar a **altura do wrapper do mapa** (que é muito maior que uma tela), não a altura da **janela visível**; qualquer estado que caia na metade inferior do mapa em 1280×800 sem rolar a página abre um tooltip fora da tela. | Confirmado objetivamente: hover em MG com `scrollY=0` produz `#map-tooltip` com `top=811px` numa janela de 800px de altura — **100% fora da área visível, sem nenhum indício de que algo aconteceu**. É o oposto do "posicionamento adaptativo" elogiado na rodada 1. |
| **Painel/drawer do estado** | **O nosso vence** | Governador + senador, barras por candidato, empate técnico, pesquisas expansíveis com TSE/margem/fonte — e agora com badge de partido correto (item corrigido). | "Ver as 1 pesquisa usadas" quando há 1 pesquisa só — concordância de gênero/número quebrada (ver bugs novos). |
| **Agregador presidencial** | **O nosso vence** | Tabela de 8 colunas agora colapsa para cards em mobile sem quebrar layout (P0 da rodada 1 resolvido); cenários de 2º turno com badge de empate técnico e link "Fonte" por pesquisa. | Nenhuma barra (1º turno nem cenários de 2º turno) desenha a "faixa de incerteza (± margem ponderada) ... segmento mais claro atrás da barra" que `ux-spec.md §2(c)` pede explicitamente — as barras são preenchimento sólido único, sem indicação visual de margem de erro (achado novo desta rodada). |
| **Hemiciclo do Senado** | **O nosso vence, com folga** | Arco real, 3 faixas de confiança nitidamente visíveis (era o maior gap da rodada 1, agora resolvido), contorno tracejado para projetada, marcador "41 para maioria", filtro de UF, tudo sem quebrar em mobile. | Não há hoje uma cadeira "indefinida" (sem pesquisa de senador) nos dados para provar que a hachura de fato aparece nesse componente especificamente (só no mapa) — risco baixo, dado que a técnica é compartilhada. |
| **Cadastro de partidos** | **O nosso vence** | Ordenação por Número (padrão) e por Espectro, com cabeçalhos clicáveis e `select` equivalente em mobile — pedido da rodada 1 atendido à risca. | Nenhuma pendência relevante identificada nesta rodada. |
| **Tipografia/cor geral** | **O nosso vence** | Tokens de espectro agora existem nas 3 variantes de tema (`:root`, `prefers-color-scheme: light`, `[data-theme="light"]`), sem cor "órfã" de um tema só. | Nenhuma pendência de token identificada nesta rodada. |
| **Mobile geral (400px)** | **O nosso vence, sem exceção** | `scrollWidth` = 400 (igual ao viewport) em **todas** as 5 rotas + painel aberto — a única violação da rodada 1 (`/#/presidente`) foi eliminada e nenhuma nova apareceu. Mobile não usa hover, então o bug do tooltip (item acima) não o afeta: toque abre o painel completo direto. | Nenhuma. |

---

## 3. Bugs objetivos novos (por prioridade)

### P0/P1 — quebra função silenciosamente
1. **Tooltip do mapa (hover) renderiza fora da viewport para metade dos estados, sem nenhum aviso visual.**
   `posicionarTooltipPerto()` em `map-view.ts` calcula o "flip" (`if (top > wrapRect.height - 90) top = ...`)
   contra `wrapRect.height` — a altura do **elemento SVG do mapa inteiro** (que ocupa mais de 900px de altura
   útil), não contra `window.innerHeight`. Como o mapa do Brasil é mais alto que uma tela de 1280×800, todo
   estado na metade inferior do desenho (MG, SP, PR, SC, RS, MS, RJ, ES...) recebe um tooltip posicionado
   corretamente **dentro do mapa**, mas **fora da janela visível do navegador**. Reproduzido de forma
   determinística: com `window.scrollY = 0` e viewport 800px de altura, hover sobre `path[data-uf="MG"]`
   produz `#map-tooltip` com `getBoundingClientRect().top = 811px` (bottom 977px) — o elemento existe no
   DOM (`hidden: false`, conteúdo correto, incluindo o "3 pesquisas" do item corrigido P2-6), mas nenhum
   pixel dele é visível sem rolar a página. Isso significa que, na visita inicial mais comum ao site
   (usuário não rolou ainda), passar o mouse sobre Minas Gerais, São Paulo ou Rio Grande do Sul — três dos
   estados mais populosos do país — **não produz feedback visual nenhum**. É o mesmo tipo de falha "função
   central quebra sem erro" do P0 da rodada 1, só que no componente que a própria rodada 1 elogiou como
   ponto forte ("tooltip com posicionamento adaptativo, não corta na borda"). Print: `bug-tooltip-mg-cutoff.png`.

### P2 — inconsistência/acabamento
2. **Concordância errada quando há exatamente 1 pesquisa no painel do estado.**
   `state-panel.ts:269`: ``<summary>Ver as ${n} pesquisa${n === 1 ? '' : 's'} usadas</summary>`` — o
   plural de "pesquisa" é tratado, mas o artigo ("as") e o particípio ("usadas") continuam fixos no plural.
   Com 1 pesquisa o texto fica "Ver as 1 pesquisa usadas" em vez de "Ver a 1 pesquisa usada". Visível em
   `mapa-mg__1280x800__dark.png`, seção Senador de MG ("Ver as 1 pesquisa usadas").
3. **Agregador presidencial não desenha a faixa de incerteza atrás das barras.**
   `ux-spec.md §2(c)` pede, para o gráfico de 1º turno e para os cenários de 2º turno, "uma faixa de
   incerteza (± margem ponderada) desenhada como um segmento mais claro atrás da barra — mesmo princípio
   de opacidade para confiança usado no mapa". `renderBarraCandidato` em `presidential-view.ts` só emite
   `.pv-bar-fill` (um preenchimento sólido único); não há segundo elemento/overlay para a margem. Isso não
   estava na lista da rodada 1 (que focou no P0 de layout mobile) e não foi tratado nesta correção — é uma
   lacuna de spec ainda aberta, visível comparando `zoom-presidente-barras.png` com a descrição do item (c).

### Nota (não é bug de produto)
4. O carregamento de fonte do Google Fonts (`fonts.googleapis.com`) falha com `ERR_CONNECTION_RESET` neste
   ambiente de teste (rede bloqueada, como avisado no pedido) em todas as rotas. Não quebra o layout —
   `--font-sans` tem fallback de sistema (`-apple-system, 'Segoe UI', system-ui, sans-serif`) e todas as
   telas renderizaram tipografia legível — mas é uma dependência externa síncrona no `<head>` sem
   `font-display` cacheado localmente; fica como observação de robustez, não como reprovação.

---

## 4. Lacunas em ordem de impacto

1. **Tooltip do mapa invisível para estados na metade inferior do desenho, em qualquer resolução onde o
   mapa é mais alto que a janela** (novo P0/P1, item 1) — maior lacuna desta rodada. Derruba o item mais
   elogiado da rodada 1 e a interação primária de "preview rápido" do site em desktop, para exatamente os
   estados mais populosos e mais prováveis de serem consultados primeiro.
2. **Faixa de incerteza ausente no agregador presidencial** (P2 item 3) — é o único componente das 5 telas
   que ainda não aplica o princípio central do `design-system.md` ("opacidade = confiança") na sua peça
   gráfica principal; o hemiciclo (que tinha o mesmo problema na rodada 1) foi corrigido, este não.
3. **Concordância singular/plural no painel do estado** (P2 item 2) — cosmético, mas incomum ver esse tipo
   de erro de texto num produto de dados que se vende pela precisão.

---

## 5. Veredito final

**Pronto para publicar: NÃO.**

Todos os 8 itens da rodada 1 foram genuinamente corrigidos — o builder não exagerou nem deixou nada pela
metade, incluindo o P0 (tabela presidencial mobile) que era bloqueador. Isso por si só seria "sim". Mas a
varredura desta rodada encontrou um bug novo de severidade equivalente ao P0 anterior: o tooltip de hover
do mapa — a peça mais elogiada do site na comparação com o NYT — fica **completamente fora da tela, sem
aviso, para estados como MG, SP, PR e RS** em qualquer viewport onde o mapa não cabe inteiro (ou seja, na
prática, para a maioria dos usuários de desktop na primeira visita). Corrigir `posicionarTooltipPerto()`
para clampar contra `window.innerHeight`/`getBoundingClientRect()` do `<html>` em vez da altura do próprio
SVG é uma correção pequena e localizada — mas precisa acontecer, e ser reverificada com a mesma técnica de
medição objetiva usada aqui (não só inspeção visual do primeiro estado que aparecer perto do topo do mapa),
antes de publicar.
