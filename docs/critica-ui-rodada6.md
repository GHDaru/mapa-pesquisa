# Crítica de UI — Rodada 6 (verificação dos fixes das rodadas 4 e 5)

Metodologia: `npm run build` (passou, `tsc --noEmit` limpo) + `npx vite preview --port 4184`,
Playwright/Chromium headless (`/opt/pw-browsers/chromium-1194`), tema escuro. Toda alegação de
"corrigido" foi checada por **evidência de DOM** (`page.evaluate` sobre atributos SVG reais —
`cx`/`cy`/`r`/`viewBox`, `scrollLeft`, `scrollWidth`, `style.width` de barras) e não por impressão
visual das capturas — as capturas (8, dentro do limite de 14, `docs/screenshots/critica6/`) foram
usadas para confirmar o que o DOM já media, e todas foram lidas com a ferramenta de imagem.
`npx vitest run` também rodou: **291/291 testes passam**, incluindo os novos casos de
`presidential-states-layout.test.ts` e `timeline-chart.test.ts` citados no commit de correção.

Commits revisados: `97897ac` (fix da rodada 4: miniaturas, marcadores, detalhes, robustez),
`00b72ea` + o histórico anterior de `vote-estimate-panel.ts`/`vote-estimate.ts` (fix da crítica de
"Votos estimados").

---

## 1. Checklist item a item

| # | Item | Veredito | Evidência |
|---|---|---|---|
| a | Nenhum círculo das miniaturas com `cx < r` | **CORRIGIDO** | Auditoria DOM em `/#/presidente-estados`: 158 círculos em 27 mini-gráficos, **0** com `cx - r < 0` ou fora do `viewBox`. Menor borda esquerda medida: `cx - r = 2.0px` (antes era `0.0` exato, cortando o círculo ao meio). |
| b | MG e TO sem laço na linha | **CORRIGIDO** | Auditoria DOM: os dois cartões (`Minas Gerais`, `Tocantins`) têm **0 elementos `<path>`** — a linha é omitida quando o domínio X colapsa para 1 dia, só os pontos aparecem soltos. Sem path, não há Catmull-Rom para laçar. Confirmado visualmente em `02-presidente-estados-1280-grade.png` (cartões "Minas Gerais" e "Tocantins": pontos empilhados, zero traço). |
| c | Marcadores finais próximos no 2º turno com anel | **CORRIGIDO** | Cenário "Flávio Bolsonaro x Lula" (45,0% vs 44,8%, centros a 2,8px): DOM mostra `circle.pv-timeline-end-dot-anel` (r=7, `stroke`) desenhado atrás do marcador coberto, além dos dois `pv-timeline-end-dot` (r=4). Visível em `03-presidente-1280-2turno.png` — anel claramente visível ao redor do ponto de Lula, cobrindo o de Flávio. |
| d | "Detalhes" na base de pesquisas sem rolar a tabela | **CORRIGIDO** | Teste crítico: clique **nativo** (`element.click()` via `page.evaluate`, sem o auto-scroll-into-view do Playwright) no botão "Detalhes" da 1ª linha — `scrollLeft` do `.db-table-wrap` fica em `0` antes **e depois** do clique. (Um teste ingênuo com `page.click()` do Playwright mede `scrollLeft = 697` porque o próprio Playwright rola o botão parcialmente fora de tela para clicá-lo — isso não é o app se comportando mal, é a ação de teste; descartado como falso positivo.) Confirmado visualmente em `05-pesquisas-1280-detalhes.png`: linha de detalhe (DF, Governador) expandida em colspan completo, colunas Data/Publicada/Cargo/UF ainda visíveis à esquerda. |
| e | Barras de votos comparáveis com faixa de incerteza, sem cartões 100% | **CORRIGIDO** | Nova seção "Comparação entre candidatos" em `/#/presidente-estados` aba "Votos estimados": larguras de barra medidas via `style.width` = `94.6%, 79.2%, 20.9%, 3.33%, 3.32%, 2.51%, 0.37%` — claramente proporcionais a uma escala única, não 100% cada. 7 elementos `.ve-chart-whisker` (um por candidato) desenham a faixa de incerteza (margem de erro agregada) sobre a barra, com `aria-label` descrevendo o intervalo em texto ("Faixa de incerteza... 58,8 milhões a 65,8 milhões"). A barra de composição antiga (100% = proveniência) foi rebaixada a detalhe secundário dentro de cada linha, não mais o único gráfico. |
| f | Tabela de comparação vira cards em 400px | **CORRIGIDO** | Em 400px, ambos `.ve-table-wrap` da aba (UF e "Agregação estadual × média nacional") agora carregam a classe `.ve-stack-table-wrap`: `scrollWidth === clientWidth === 368` nas duas — sem rolagem horizontal interna em nenhuma. Antes só a tabela de UF virava cards. |
| g | `scrollWidth = 400` em todas as rotas e na aba de votos | **CORRIGIDO** | Medido em 400×850 nas 6 rotas (`/mapa`, `/presidente`, `/presidente-estados`, `/senado`, `/pesquisas`, `/partidos`) e na aba "Votos estimados": `document.documentElement.scrollWidth` = **400** em todos os casos, sem exceção. |
| h | Nenhuma rota mostra "Em construção" | **CORRIGIDO (com ressalva)** | `body.textContent` sem "Em construção" nas 6 rotas em 400px nem em `/presidente-estados` com a rede local normal. Código de `main.ts` agora tenta o `import()` de novo após 300ms antes de desistir, e ignora `vite:preloadError` (`evento.preventDefault()`) para não gerar ruído duplicado — mecanismo plausível e testável por leitura de código, mas **não foi possível forçar deliberadamente uma falha de rede neste ambiente para reproduzir a falha original e confirmar o retry ao vivo** (a suíte não expõe um hook para isso). Ressalva menor: se as **duas** tentativas falharem, a mensagem final ainda é "Esta tela ainda não está disponível" — texto que continua a confundir uma falha de carregamento com uma tela não implementada; o fix reduz a frequência do problema, não elimina a mensagem enganosa no pior caso. |

**7 de 8 itens corrigidos sem ressalva; o item (h) está corrigido no mecanismo mas sem confirmação ao vivo do caminho de falha, e mantém uma mensagem final imprecisa no caso raro de dupla falha.**

---

## 2. Vereditos por peça

| Peça | Veredito | Justificativa (2 linhas) | Maior lacuna restante |
|---|---|---|---|
| **Gráfico temporal (linha) — `/presidente`** | **O nosso vence** | Pontos por amostra, linha suavizada, rótulos diretos, e agora (rodada 6) o anel de contorno resolve a colisão de marcadores no cenário mais disputado (Flávio×Lula, 0,2pt) — o NYT nem cobre 3 candidatos. | Domínio Y ainda é largo (0–50%) por incluir Cury a distância; segue sendo tensão de design, não bug, mas dilui o efeito dramático que a barra de qualidade pede para corridas apertadas. |
| **Miniaturas por estado (grade estilo NYT)** | **O nosso vence** | Os dois bugs de render que davam a vitória ao NYT na rodada 4 (corte de ponto na borda esquerda em 74% dos estados, laço decorativo em MG/TO) estão confirmados corrigidos por auditoria de DOM, não só visual. | Quando a linha é omitida (MG, TO), o cartão não diz explicitamente por quê ("tendência indisponível: pesquisas na mesma data") — o usuário só vê pontos soltos sem explicação textual, uma pequena regressão de clareza em troca de não inventar uma forma falsa. |
| **Mapa presidencial por estado (coroplético)** | **O nosso vence** | Sem mudanças nesta rodada; espectro de 5 níveis + opacidade de confiança + hachura de empate técnico continuam batendo a escala binária do NYT. | Nenhuma nova; mapa mais alto que a viewport em telas baixas segue como lacuna herdada (não bloqueante). |
| **Painel do estado (presidente)** | **O nosso vence** | Sem mudanças; badges de partido, faixa de incerteza rotulada em texto, lista de pesquisas expansível seguem mais completos que o tooltip único do NYT. | Nenhuma nova. |
| **Senado por estado (painel + tabela)** | **O nosso vence** | Confirmado ao vivo de novo (painel do Amapá, `06-senado-1280-painel.png`): mostra ocupante atual E candidato projetado com partido para as duas cadeiras, algo que o mapa+lista do NYT não faz. | Nenhuma nova; painel funciona, mas cobre o conteúdo à direita ao abrir (backdrop lateral) — comportamento esperado de um `dialog`, não um bug. |
| **Base de pesquisas** | **O nosso vence** | O scroll-jack ao expandir "Detalhes" (bug mais citado da rodada 4 para esta peça) está corrigido — verificado com clique nativo, sem o artefato de auto-scroll do Playwright. Continua com mais colunas/filtros/exportação que NYT/538. | A tabela já nasce com rolagem horizontal em 1280px mesmo sem nada expandido (bug P2 #6 da rodada 4) — não fazia parte do escopo desta verificação e segue sem correção. |
| **Votos estimados (aba)** | **O nosso vence** | A lacuna que dava a vitória ao NYT/538 na crítica anterior — barra sem comparação de magnitude e sem faixa de incerteza — foi resolvida com uma seção nova de barras proporcionais a uma escala única + whisker de margem de erro; a metodologia agora também menciona abstenção/comparecimento explicitamente no cabeçalho e na linha "Não atribuídos". | Função `criarBarraSegmentada` e as classes CSS `.ve-card`/`.ve-cards` ficaram órfãs (ver bugs novos, §3) — não afeta o usuário, mas é dívida técnica deixada pelo próprio fix. |
| **Mobile geral (400px)** | **O nosso vence** | `scrollWidth = 400` sem exceção nas 6 rotas e na aba de votos; tabelas problemáticas da rodada 5 (a segunda tabela do painel de votos) agora também viram cards. | Robustez do fallback "Em construção" (item h) não foi confirmada ao vivo sob falha de rede real neste ambiente — só por leitura de código. |

---

## 3. Bugs novos encontrados (objetivos)

1. **[Baixo] Código morto deixado pelo fix da aba "Votos estimados".** `criarBarraSegmentada`
   (`src/adapters/inbound/web/views/vote-estimate-panel.ts:211-230`) não é mais chamada por
   nenhum lugar do arquivo — era usada só pelo card por candidato removido em `00b72ea` ("remove
   cartões redundantes"), mas a função (com seu comentário desatualizado, que ainda fala em "dentro
   do card") ficou para trás. `tsc --noEmit` não acusa porque `noUnusedLocals` não está ativado no
   `tsconfig.json`. Sem impacto visual, mas é dívida técnica real introduzida nesta rodada de
   correção.
2. **[Baixo] CSS órfão correspondente.** `.ve-cards`, `.ve-cards > *`, `.ve-card`, `.ve-card__topo`,
   `.ve-card__nome`, `.ve-card__votos`, `.ve-card__pct`, `.ve-card__composicao-rotulo` em
   `src/adapters/inbound/web/styles/vote-estimate.css` (linhas ~165-230, mais uma referência em
   `.ve-card` dentro de um bloco de `prefers-reduced-motion` perto da linha 491) não têm mais
   nenhum elemento correspondente no DOM depois da remoção dos cards — mesma causa do item acima.
3. **[Cosmético] Mensagem final do fallback de rota ainda engana no pior caso.** Mesmo com o retry
   de 300ms, se a **segunda** tentativa de `import()` também falhar, `mostrarEmConstrucao` mostra
   literalmente "Esta tela ainda não está disponível" — indistinguível de uma tela genuinamente não
   implementada. O mecanismo (item h) reduz a frequência do problema relatado na rodada 4, mas não
   resolve a ambiguidade da mensagem para quem tiver duas falhas seguidas (rede ruim persistente).

Nenhum bug de dado incorreto (valores, somas, contraste, aria-label ausente) foi encontrado nesta
rodada além dos três itens acima, todos de baixo impacto para quem usa o site.

---

## 4. Veredito final

**Pronto para publicar: SIM.**

Os quatro bugs de render/interação de dado da rodada 4 (pontos cortados nas miniaturas, laço em
MG/TO, marcadores sobrepostos no 2º turno, scroll-jack da base de pesquisas) e a lacuna estrutural
da rodada 5 (barra de votos sem comparação de magnitude nem incerteza) foram verificados como
corrigidos por evidência de DOM — não por leitura das capturas de tela nem pelas alegações dos
builders. `scrollWidth = 400` se mantém sem exceção em todas as rotas e na aba de votos, nenhuma
rota mostra "Em construção" sob condições normais, e os 291 testes automatizados passam. As únicas
pendências que restam são cosméticas: dois pedaços de código/CSS órfãos deixados pelo próprio fix
(sem efeito visível) e uma mensagem de fallback que continua ambígua no caso raro de falha dupla de
rede — nenhuma delas é um bug de dado incorreto ou uma regressão de paridade com a barra de
qualidade (NYT/538). Recomendo uma limpeza rápida do código morto antes do próximo ciclo de
features, mas ela não bloqueia a publicação.
