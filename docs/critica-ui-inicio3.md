# Crítica — `#/inicio` (rodada 3)

Avaliador: crítico de capas de jornalismo de dados. Barra: home do FiveThirtyEight 2024 Election Forecast (`projects.fivethirtyeight.com/2024-election-forecast`).

**Nota sobre a barra**: `WebFetch` para `projects.fivethirtyeight.com` foi bloqueado pelo proxy de rede da sessão (`EGRESS_BLOCKED`). `WebSearch` não trouxe uma descrição de layout confiável — só material de metodologia (ponderação convenção/fundamentals, "snake chart", histogramas de incerteza). A comparação de layout abaixo usa portanto conhecimento geral já registrado sobre essa página (treino, não observação ao vivo nesta sessão) e é sinalizada onde relevante como "não verificado ao vivo". O que é fato verificado é 100% do nosso site: build real, screenshots reais, DOM real, dados reais de `data/*.json`.

Screenshots em `docs/screenshots/critica-inicio3/` (8, limite usado por completo):
`01-1280-light-top.png`, `02-1280-light-bignums-noticia.png`, `03-1280-light-explore.png`, `04-1280-light-comofunciona-creditos.png`, `05-400-dark-top.png`, `06-400-dark-explore.png`, `07-400-dark-credits.png`, `08-1280-dark-top.png`.

---

## Veredito binário por seção

| Seção | Veredito | Maior lacuna |
|---|---|---|
| Hero | **O nosso vence** | A barra é resultado-primeiro ("quem ganha, X em 10"); a nossa é honesta sobre ser uma capa explicativa — mas o hero não diz, em nenhuma linha, *quando* a próxima atualização acontece nem dá nenhum sinal de "isto é ao vivo/diário" além do texto corrido — falta um selo curto tipo "atualizado hoje" perto do H1, hoje isso só aparece rolando até o 7º tile. |
| Big numbers | **Empate, com bug** | Matemática bate 100% com os dados (ver seção de coerência abaixo), mas o 7º tile fica **órfão sozinho numa 2ª linha** em 1280px (`02-1280-light-bignums-noticia.png`, `08-1280-dark-top.png`) — um buraco de 5 colunas vazias ao lado dele. A barra nunca deixaria um número solto assim. |
| Atualização de hoje | **A barra vence** | A barra mostra timestamp de atualização com precisão de minuto/hora e frequência declarada ("updated every day at X"); a nossa mostra só a data (`13/09/2026`, sem hora) — mais grave: o texto da notícia **lista "BR" como se fosse um estado** ("52 novas pesquisas... em 18 estados (AL, BR, DF, ...)") — bug factual, ver Bugs #1. |
| Chamadas (O que você encontra aqui) | **O nosso vence** | 6 cards com frase + dado, todos clicáveis, todos ≥44px de alvo de toque, todos navegam certo (testado). Único defeito é de grade: 4+2 em 1280px deixa 2 espaços vazios na 2ª linha (`03-1280-light-explore.png`). |
| Como funciona | **O nosso vence, folgado** | A barra costuma enterrar a metodologia numa página/artigo separado, um clique de distância do resultado que já está na cara. A nossa expõe os 4 passos e os parâmetros reais (`14 dias` de meia-vida, `45 dias` de janela) na própria capa, com um aviso de transparência explícito. Mais honesto e mais acessível — mas não verificado ao vivo contra a barra. |
| Fontes/créditos | **O nosso vence, com ressalva de dado** | Lista 27 institutos nominalmente — mas pelo menos 4 pares são o mesmo instituto grafado de duas formas ("Anova (PB Agora)" / "Instituto Anova", "Brasil Dados" / "Instituto Brasil Dados", "Ranking Brasil Inteligência" / "Instituto Ranking Brasil Inteligência", possivelmente "AtlasIntel" / "AtlasIntel/MeioNorte") — infla o big number "Institutos de pesquisa: 27" e a lista de créditos. Ver Bugs #2. |
| Mobile (400px) | **O nosso vence** | Sem overflow horizontal (`scrollWidth === clientWidth === 400`, medido), pilha em coluna única, contraste ouro/verde passa AA nos dois temas, CTAs mantêm 44px de altura. |

---

## Bugs, por prioridade

### P0 — Bug factual na "Atualização de hoje": "BR" tratado como estado
- **Onde**: `src/domain/digest.ts`, função `montarDigestDiario`, loop das "novas" (linhas ~109–115): `ufsNovas.add(p.disputa.uf)` roda para **todos** os cargos, inclusive `presidente`, sem excluir `UF_NACIONAL` ('BR'). Compare com `ufsCobertas` duas dezenas de linhas acima (linha ~97), que explicitamente filtra `p.disputa.uf !== UF_NACIONAL` — o autor sabia da regra e não a repetiu aqui.
- **Onde na tela**: `src/adapters/inbound/web/views/home-view.ts`, `construirTextoNovidades` → renderiza `novas.ufs.join(', ')` dentro de `.hm-noticia__texto` (seletor `.hm-noticia .hm-noticia__texto`, seção `#atualizacao-do-dia`).
- **Evidência real**: build + dados atuais (`data/polls.json`, `data/meta.json`, `atualizadoEm: "2026-09-13"`) produzem o texto visível em `02-1280-light-bignums-noticia.png`:
  > "52 novas pesquisas entraram na última atualização **em 18 estados (AL, BR, DF, GO, MA, MG, MS, MT, PA, PE, PR, RJ, RN, RR, RS, SC, SE, SP)**, de Alfa Inteligência, AtlasIntel, ..."

  "BR" não é um estado — é a disputa presidencial nacional. O leitor lê "18 estados" e vê uma sigla de 2 letras que não existe no mapa do Brasil. A contagem "18" também está errada como contagem de *estados*: 17 UFs reais + 1 nacional.
- **Não é caso de borda hipotético**: rodando com os dados reais de hoje o bug já aparece na tela, sem precisar forçar nada.
- **Cobertura de teste confirma a lacuna**: `src/domain/__tests__/digest.test.ts` tem um teste dedicado (`'ufsCobertas conta só governador e senador, exclui presidente e "BR"'`, linha 92) mas nenhum teste equivalente para `novasNaUltimaAtualizacao.ufs` com uma pesquisa presidencial/BR na janela — a regra existe para um campo e não para o outro, e o teste não pegou.
- **Correção sugerida (não aplicada)**: em `montarDigestDiario`, ao popular `ufsNovas`, excluir `UF_NACIONAL` como já é feito para `ufsCobertas`; se quiser mencionar a pesquisa nacional na notícia, tratar à parte ("e X pesquisa(s) presidencial(is) nacional(is)"), nunca dentro da lista de siglas de estado.

### P1 — Layout: 7º tile órfão sozinho na 2ª linha (1280px)
- **Onde**: `src/adapters/inbound/web/styles/home.css`, seletor `.hm-bignums { grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); }`. Com 7 itens (`.hm-bignums__item`) e ~193px de coluna medida em 1280px, cabem 6 por linha → o tile "Atualizado em" (`id: 'atualizado'` em `montarBigNumbers`, `home-view.ts`) fica sozinho numa 2ª linha com 5 colunas vazias ao lado.
- **Evidência**: medido no DOM (`rowTops: [-1176, -1029]` para 7 itens = 2 linhas; alturas `135,135,135,135,135,135,83` — o 7º item, mais curto por não ter `detalhe`, é o órfão) e visível em `02-1280-light-bignums-noticia.png` e `08-1280-dark-top.png` (o card "ATUALIZADO EM" cortado embaixo, sozinho, com toda a largura da tela vazia ao lado).
- **Correção sugerida (não aplicada)**: o tile "Atualizado em" já é redundante com a data em destaque no início da seção `.hm-noticia` logo abaixo (`13/09/2026`, `.hm-noticia__data`) — mesma informação duas vezes na mesma rolagem. Duas saídas razoáveis: (a) remover esse 7º tile da grade de big numbers (ficam 6, que formam grade limpa 3×2/6×1 sem sobra) e manter só o link-âncora "Atualizado em" como um selo pequeno perto do H1 do hero; ou (b) se ele deve continuar na grade, travar `grid-template-columns: repeat(4, 1fr)` (ou outro número fixo que combine com 7+1 futuro) em vez de `auto-fit`, para nunca deixar 1 item sozinho — mas a opção (a) resolve a duplicação de informação ao mesmo tempo.

### P1 — Layout: grade de 6 chamadas deixa 2 vazios na 2ª linha (1280px)
- **Onde**: `src/adapters/inbound/web/styles/home.css`, seletor `.hm-explore-grid { grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); }`. Em 1280px o container comporta 4 colunas; com 6 cards (`Governadores, Presidente, Presidente por estado, Senado, Partidos, Base de pesquisas`) a 2ª linha só tem 2 cards, com 2 posições de coluna vazias à direita.
- **Evidência**: `exploreLayout` medido no DOM (`rowTops: [-466, -263]`, 2 linhas para 6 itens) e visível em `03-1280-light-explore.png` — "Partidos" e "Base de pesquisas" isolados à esquerda, metade direita da 2ª linha em branco.
- **Correção sugerida (não aplicada)**: travar 3 colunas nesse breakpoint (`grid-template-columns: repeat(3, minmax(0, 1fr))` a partir de ~960px, com `auto-fit`/coluna única abaixo disso) — 6 cards em grade 3×2 sem sobra, mais previsível que depender de `auto-fill` reagir ao container.

### P2 — Nomes de institutos duplicados inflam o big number "Institutos de pesquisa"
- **Onde**: dado, não código — `data/polls.json`, campo `instituto`. O big number "Institutos de pesquisa" (`home-view.ts`, `montarBigNumbers`, tile `id: 'institutos'`) e a lista de créditos (`construirCreditos`) usam `Set<string>` sobre a string bruta do campo, então duas grafias do mesmo instituto contam como dois.
- **Evidência**: lista completa capturada em `04-1280-light-comofunciona-creditos.png` / `07-400-dark-credits.png` mostra lado a lado: `Anova (PB Agora)` e `Instituto Anova`; `Brasil Dados` e `Instituto Brasil Dados`; `Ranking Brasil Inteligência` e `Instituto Ranking Brasil Inteligência`; `AtlasIntel` e `AtlasIntel/MeioNorte` (esse último pode ser filial legítima, os outros três não têm essa desculpa). Sem correção, o "27" institutos citado como credibilidade da base é inflado por inconsistência de captura, não por diversidade real de fontes.
- **Correção sugerida**: normalizar nome de instituto na ingestão (`ingest/`) ou numa etapa de mapeamento antes de contar distintos — fora do escopo desta tela (é dado, não view/CSS), mas o big number que exibe esse número não deveria confiar cegamente na string bruta sem alguma validação de unicidade semântica.

### P3 — CSS morta: `.hm-section__link` sem uso no DOM atual
- **Onde**: `src/adapters/inbound/web/styles/home.css`, regra `.hm-section__link` (com hit-slop de toque incluído). Busquei no DOM renderizado (`document.querySelectorAll('.hm-section__link')`) e no `home-view.ts`: a classe não é aplicada a nenhum elemento — só `.hm-quiet-link` é usada de fato. Não é um bug visível para o leitor, mas é manutenção morta que confunde quem for mexer depois.

---

## Checklist do procedimento — o que foi confirmado

- **(a) Sem candidato/percentual de candidato**: confirmado por varredura de texto de todo `.hm-view` — os únicos `%` na página são "82%" (tile "Com registro no TSE", metadado da base) e "Futura/100% Cidades" (nome de instituto). Zero nome de candidato, zero percentual de resultado. Decisão de produto respeitada.
- **(b) Fontes**: confirmado via `getComputedStyle` — `.hm-hero__title` → `Fraunces, "Iowan Old Style", ...` (display só no hero); `.hm-hero__lead` e `.hm-bignum__label` → `"Inter var", Inter, ...` (corpo); `.tabular-nums` → `"JetBrains Mono", ...` (só nos números, escopo confirmado por CSS `.hm-view .tabular-nums`). Regra respeitada.
- **(c) Contraste ouro/verde**: calculado (WCAG relative luminance) nos dois temas — claro: `--hm-verificado` (#1f7a3d) sobre `--hm-surface`/`--hm-canvas` = 5.37:1 / 4.97:1; `--hm-selo-ink` sobre `--hm-selo` (hover do CTA) = 5.05:1. Escuro: `--hm-verificado` (#2f9e52) = 5.19–5.75:1; `--hm-selo-ink` sobre `--hm-selo` = 8.29:1. Todos passam AA (4.5:1) para texto normal, nos dois temas.
- **(d) Alvos de toque ≥44px**: `.hm-cta` = 44px de altura (mínimo exato, aceitável). `.hm-bignum` = 135px (83px no tile órfão, ainda ok). `.hm-explore-card` = 187/167px. `.hm-quiet-link` tem caixa visível de só 23px de altura, mas o `::before` com `inset: -15px -8px` estende a área clicável para ~53×194px — cumpre a regra via hit-slop, não pelo texto em si.
- **(e) `scrollWidth` em 400px**: `document.documentElement.scrollWidth === clientWidth === 400` — sem overflow horizontal.
- **(f) 3 links testados**: `#/mapa`, `#/senado`, `#/partidos` clicados a partir da home — os três resultaram no hash correto (`location.hash` bateu com o alvo). Roteador funcionando para a home.
- **(g) Coerência dos big numbers com os dados**: recalculado direto de `data/polls.json` (238 registros), `data/parties.json` (31), `data/senate-seats.json` (81 assentos), `data/meta.json` (`atualizadoEm: 2026-09-13`) — total de pesquisas (238), institutos distintos (27, com a ressalva do bug P2 acima), UFs cobertas por governador/senador excluindo BR (27), % com registro TSE (194/238 = 81,5%, exibido arredondado para 82%), partidos (31) e assentos do Senado (81 = 27×3) **todos batem exatamente** com o que a tela mostra. Nenhuma divergência de cálculo nos big numbers em si.
- **(h) "Novas pesquisas" e regra do digest**: a janela é "últimos 3 dias até `atualizadoEm`, inclusive" (`JANELA_NOVIDADES_DIAS = 3`, `dataMenosDias`). Com `atualizadoEm = 2026-09-13`, o piso é `2026-09-10`; recalculando manualmente sobre `data/polls.json` dá exatamente os mesmos 52 registros e a mesma lista de institutos que a tela mostra — a contagem de "novas pesquisas" está certa. O que **não** está certo é "BR" aparecer dentro da lista de estados (bug P0 acima) — confirmado que é tratado igual a uma UF de verdade, ao contrário de `ufsCobertas`, que exclui BR corretamente.
- **(i) 7º tile órfão / grade de 6 deixa 2 sozinhos**: ambos confirmados por medição de DOM e por screenshot, com correção proposta em P1 acima.

---

## Veredito final

**Pronto para publicar: NÃO.**

A decisão de produto (capa sem resultado de pesquisa) está bem implementada e é defensável até mais transparente que a barra em metodologia — isso é um ponto real a favor do nosso site. Mas existe um bug factual visível com os dados reais de hoje ("BR" listado como um dos "18 estados" na notícia do dia) numa seção cujo objetivo declarado é credibilidade via clareza factual — isso sozinho já reprova a capa para publicação. Some a isso dois problemas de grade visíveis em qualquer desktop de 1280px (7º tile órfão, 2 cards soltos na 2ª linha da seção de chamadas) que qualquer editor pegaria no primeiro olhar. Nenhum desses três é difícil de corrigir, mas nenhum foi corrigido nesta revisão (instrução era não editar código) — corrigir o `montarDigestDiario` (excluir BR) e travar as duas grades resolve o essencial antes de publicar.
