# Crítica de UI — Rodada 4

Metodologia: `npm run build` + `vite preview` (porta 4176), Playwright/Chromium headless
(`/opt/pw-browsers/chromium-1194`), tema escuro (`colorScheme: 'dark'`) e claro onde pedido.
Medições objetivas via `page.evaluate` (`getBoundingClientRect()`, `scrollWidth`, atributos SVG
reais como `cx`/`cy`) — não "parece ok visualmente". 16 PNGs em `docs/screenshots/critica4/`
(dentro do limite de 16), todos lidos com a ferramenta de leitura de imagem, mais crops ampliados
gerados localmente (Pillow) para inspecionar pixels específicos. Barra de qualidade: `docs/ux-spec.md`
§1 (NYT `polls-president.html` e `results-senate.html`) e a skill de dataviz
(`anti-patterns.md`, `marks-and-anatomy.md`), cobertas integralmente antes da revisão.

**Nota de processo — repositório compartilhado com sessões concorrentes.** Durante esta rodada o
mesmo checkout estava sendo modificado por outra(s) sessão(ões) de agente em paralelo: `git log`
mostra commits como `ui: aba Votos estimados na tela Presidente por estado` e
`crítica: aba Votos estimados (relatório e screenshots)` aterrissando **enquanto** este relatório
estava em andamento, inclusive um commit alheio que reaproveitou por engano PNGs já gerados por
esta sessão (`docs/screenshots/critica4/01...14.png`) dentro do seu próprio commit. Isso teve um
efeito colateral real e capturado: uma tentativa de screenshot de `/#/presidente-estados` em 400px
caiu no fallback "Em construção" porque o `import()` dinâmico de `presidential-states-view.ts`
falhou com `Unable to preload CSS for /assets/vote-estimate-panel-*.css` — quase certamente o outro
processo reescrevendo `dist/assets/` no exato instante da requisição. Ao perceber isso, esta sessão
parou, conferiu `git status`/`git log`, rodou **`npm run build` de novo a partir do HEAD estável**,
reiniciou o `vite preview` e refez as 6 capturas de `/#/presidente-estados` (mais a versão clara) —
os PNGs finais em `docs/screenshots/critica4/05` a `09` e `17` refletem esse rebuild limpo. O
episódio em si virou um achado de robustez legítimo (ver bug P1 "Em construção" na §3) porque provou,
ao vivo, que uma falha transitória de rede/carregamento de módulo faz a tela inteira parecer
"não implementada" para quem a visita — não é um artefato exclusivo da colisão entre sessões, é o
comportamento real do app diante de qualquer hiccup de carregamento (confirmado por retry: falhou
1 vez em 6 tentativas limpas, sem a outra sessão rodando).

Rotas cobertas: `/#/presidente` (topo/gráfico, hover, seletor de 2º turno), `/#/presidente-estados`
(mapa liderança/eleitorado, grade, painel MG), `/#/senado` (painel de assento, tabela por estado),
`/#/pesquisas` (topo, filtro, detalhes). Tema claro em 1280px para presidente e presidente-estados.
`scrollWidth` a 400px medido nas 6 rotas da navegação.

---

## 1. `scrollWidth` a 400px (todas as rotas)

| Rota | scrollWidth | Veredito |
|---|---|---|
| `/#/mapa` | 400 | OK |
| `/#/presidente` | 400 | OK |
| `/#/presidente-estados` | 400 | OK |
| `/#/senado` | 400 | OK |
| `/#/pesquisas` | 400 | OK |
| `/#/partidos` | 400 | OK |

Nenhuma rota estoura a largura da viewport em mobile. Único erro de console recorrente:
`net::ERR_CONNECTION_RESET` em `fonts.googleapis.com` (rede bloqueada neste ambiente, sem impacto —
fallback de fonte de sistema funciona), consistente com as 3 rodadas anteriores.

---

## 2. Vereditos por peça

| Peça | Veredito | Justificativa (2 linhas) | Maior lacuna restante |
|---|---|---|---|
| **Gráfico temporal (linha) — `/presidente`** | **O nosso vence** | Pontos por amostra (raio √amostra), linha suavizada, marca do 1º turno, rótulos diretos no fim com apelido curto + `<title>` completo, navegação por teclado (setas/Home/End) — mais rico que o NYT (que só cobre 2 candidatos). | Eixo Y não é estreito como o do NYT: como o gráfico destaca até 3 candidatos (Lula, Flávio, **Cury ~9,5%**), o domínio vertical vira 5%–50% (45 pontos) em vez de uma faixa dramática de ~15 pontos em torno dos dois líderes — dilui exatamente o efeito visual que a barra de qualidade pede. |
| **Tooltip do gráfico (hover)** | **O nosso vence** | Evolução real desde a rodada 3: agora mostra os 3 candidatos destacados + instituto/amostra/registro TSE do ponto mais próximo, não só o líder. | Quando dois valores finais ficam muito próximos (cenário 2º turno Flávio×Lula: 45,0% vs 44,8%), os **marcadores** (não os rótulos) colidem quase totalmente — ver bug P1 abaixo. |
| **Mapa presidencial por estado (coroplético)** | **O nosso vence** | Espectro de 5 níveis + opacidade de confiança + hachura de empate técnico + siglas de UF inline batem a escala diverging binária do NYT em densidade de informação; testado também em tema claro com contraste de rótulo bom (halo branco sobre preenchimento). | Nenhuma pendência nova; mantém a lacuna já registrada (mapa mais alto que a viewport em 1280×800, herdada do `/mapa` de governadores — aqui o "Mapa e tendências" já vem com scroll natural da página, não chega a ser bloqueante). |
| **Miniaturas por estado (grade estilo NYT)** | **NYT vence** | Mecânica é boa (raio por amostra, rótulo final sem colidir entre 2 candidatos, fallback correto para "só 1 pesquisa" sem linha) — mas a implementação atual **corta visualmente o ponto mais antigo em 20 de 27 estados com mini-gráfico** (74%) e produz um laço decorativo sem sentido em Minas Gerais e Tocantins. Nenhum gráfico do NYT sairia do forno assim. | Ver bugs P0/P1 #1 e #2 abaixo — são os dois achados mais concretos desta rodada. |
| **Painel do estado (presidente, `/presidente-estados`)** | **O nosso vence** | Todos os candidatos com badge de partido, faixa de incerteza rotulada em texto, selo de confiança/empate técnico, lista de pesquisas expansível com registro TSE e fonte — mais completo que o tooltip único do NYT. | Nenhuma pendência nova encontrada. |
| **Senado: nomes por estado (painel + tabela)** | **O nosso vence** | Confirmado ao vivo (painel do Amapá e tabela completa): mostra **ocupante atual E candidato projetado, cada um com partido**, para as duas cadeiras em disputa — mais informação por UF que o mapa+lista do NYT, que só mostra o vencedor projetado. | Nenhum bug encontrado; item já elogiado nas rodadas 2/3 continua estável. |
| **Base de pesquisas (`/pesquisas`)** | **O nosso vence** | Comparado à tabela de pesquisas do FiveThirtyEight/NYT: temos mais colunas relevantes (registro TSE, cenário, contratante), filtro por cargo/UF/instituto/turno/texto, exportação CSV e detalhamento por pesquisa — nenhuma das duas referências oferece exportação nem esse nível de filtro na própria página. | Expandir "Detalhes" de uma linha faz a tabela **rolar horizontalmente sozinha** (557px) e esconder as colunas que identificam a linha (Data/Cargo/UF/Instituto) — ver bug P1 #3. |
| **Tipografia/cor geral** | **O nosso vence** | Tokens de design system aplicados de forma consistente nos dois temas; testado ao vivo em claro (presidente e presidente-estados) sem quebra de contraste; texto nunca herda a cor do dado (regra da skill de dataviz respeitada — rótulos usam token de texto, só o swatch/marca carrega a cor). | Fonte Inter segue bloqueada neste ambiente de rede (fallback de sistema cobre bem); não é possível confirmar o polimento tipográfico final aqui. |
| **Mobile geral (400px)** | **O nosso vence** | `scrollWidth = 400` em todas as 6 rotas, sem exceção; abas, legendas e cartões reempilham corretamente. | A falha intermitente de carregamento de módulo (nota de processo acima) é mais perigosa justamente em mobile, onde rede instável é comum — mesmo não sendo um bug exclusivo de mobile. |

---

## 3. Bugs objetivos (por prioridade)

### P1 — bugs de dado/render visíveis e reproduzíveis

**#1. Ponto mais antigo cortado ao meio na borda esquerda de 20 de 27 mini-gráficos por estado.**
Auditoria direta do DOM (`circle.ps-mini-chart__ponto`, atributo `cx` real) em `/#/presidente-estados`
mostra que **20 dos 27 estados** com mini-gráfico têm pelo menos um ponto com `cx = 0.0` exatamente
— ou seja, um círculo de raio 3–9px cujo centro está literalmente no limite esquerdo do `viewBox="0
0 240 90"`, cortado pela metade porque o SVG não declara `overflow: visible` nem reserva a margem
esquerda equivalente ao raio do maior ponto. Lista completa capturada: São Paulo, Rio de Janeiro,
Bahia, Paraná, Pará, Santa Catarina, Maranhão, **Goiás**, Paraíba, Espírito Santo, Amazonas, Rio
Grande do Norte, Alagoas, Distrito Federal, Mato Grosso do Sul, Sergipe, Rondônia, Acre, Amapá,
Roraima. Visível a olho em `docs/screenshots/critica4/07-presidente-estados-1280-grade.png` (cartão
"Goiás": um crescente vermelho isolado na borda esquerda, sem o resto do círculo). Causa: em
`presidential-states-layout.ts`, `escalaX` mapeia a menor data do domínio para `0` exatamente, e
`MINI_PLOT_W`/`MINI_PAD_*` (em `presidential-states-view.ts:612-618`) não definem nenhuma margem
esquerda — só topo/baixo/direita. Ver `references/marks-and-anatomy.md`: "Bad: A label clipped by,
or overflowing, a too-small [mark]" se aplica igualmente a um marcador, não só a rótulo.

**#2. Laço/espiral decorativo sem sentido no mini-gráfico quando duas pesquisas do 1º turno da mesma
UF terminam no mesmo dia.** Confirmado em **Minas Gerais** e **Tocantins** (2 dos 23 estados com ≥2
pesquisas de 1º turno — os únicos onde as datas de referência colapsam para um único dia). Quando
`dominioX.minIso === dominioX.maxIso`, `escalaX` devolve o centro do plot para *todo* ponto
histórico (linha 105 de `presidential-states-layout.ts`, `if (span <= 0) return largura / 2`); como
há 2+ pontos empilhados no mesmo x com y diferentes, seguidos do ponto final da média (bem à
direita), a suavização Catmull-Rom entre eles produz uma curva que sobe, desce e cruza a si mesma —
um laço que não corresponde a nenhum movimento real da série. Visível em
`docs/screenshots/critica4/07-presidente-estados-1280-grade.png`, cartão "Minas Gerais" (zoom
confirma o cruzamento). É o mesmo tipo de falha que `references/anti-patterns.md` descreve para
eixos duplos: "a chart invents a [shape] that isn't in the data" — aqui é uma forma de linha, não uma
correlação, mas o princípio (o gráfico mente sobre uma tendência que não existe) é o mesmo.

**#3. Marcador de fim de linha do candidato 2º colocado desaparece atrás do 1º quando os valores
finais estão a poucas décimas de diferença.** No cenário de 2º turno "Flávio Bolsonaro x Lula"
(`/#/presidente`, seletor de cenário), os valores finais são 45,0% (Lula) e 44,8% (Flávio) — 0,2
ponto de diferença, o que no domínio do eixo (~25 pontos, 288px de altura útil) equivale a **~2–3px
de separação entre os centros dos dois círculos de raio 4px + anel de 2px**. O candidato desenhado
por último no array (Lula, por vir depois na ordem `serie.candidatos`) cobre quase inteiramente o
marcador do outro, que sobra como uma lasca azul de poucos pixels (ver crop ampliado, confirmado
via `docs/screenshots/critica4/03-presidente-1280-2turno-selector.png`). O código de
`timeline-chart.ts` já resolve a colisão de **texto** dos rótulos (`ESPACO_MIN_ROTULO`, linhas
430-438) mas não trata a colisão dos **marcadores** em si — exatamente o cenário mais noticiável
(corrida empatada) é o que fica visualmente pior.

**#4. Expandir "Detalhes" de uma pesquisa em `/#/pesquisas` rola a tabela horizontalmente sozinha e
esconde as colunas de identificação da linha.** Medido via `scrollLeft` real do `.db-table-wrap`:
`0` antes de abrir o `<details>`, **`557`** depois de um clique no `<summary>` — comportamento nativo
do navegador que rola o ancestral com scroll para manter o elemento focado visível, mas o efeito é
que Data de campo, Publicada, Cargo, UF, Turno e Instituto somem da tela (ver
`docs/screenshots/critica4/14-pesquisas-1280-filtro-detalhes.png`, que começa em "CONTRATANTE" em
vez da 1ª coluna). Usuário perde o contexto de qual linha está lendo justamente ao pedir mais
detalhe dela.

### P1 — robustez (não é um bug determinístico, mas é reproduzível e enganoso)

**#5. Falha transitória ao carregar um módulo de rota mostra "Em construção" (implica que a tela não
existe) em vez de um erro/retry.** Reproduzido ao vivo: de 6 tentativas limpas de abrir
`/#/presidente-estados`, 1 falhou com `Falha ao carregar ./views/presidential-states-view.ts: Error:
Unable to preload CSS for /assets/...css`, capturado só como `console.warn` (invisível para o
usuário) e a tela caiu no fallback genérico de `main.ts` ("Esta tela ainda não está disponível.").
Qualquer soluço de rede real (dados móveis, proxy corporativo, bloqueador de conteúdo interferindo
no `modulepreload`) reproduz o mesmo efeito em produção: uma tela inteira, funcional, passa a
parecer não implementada, sem qualquer forma de tentar de novo além de recarregar a página inteira.

### P2 — acabamento

**#6. Tabela de pesquisas já exige rolagem horizontal em 1280px mesmo sem nenhuma linha expandida**
(`scrollWidth 1771` vs `clientWidth 1214` — 557px de conteúdo fora da viewport). Com 14 colunas, é
esperado algum grau de rolagem, mas o "Fonte" e "Detalhes" (as colunas mais acionáveis) já nascem
fora da primeira dobra em uma tela de desktop padrão.

Nenhum bug de contraste, nenhum `aria-label` ausente e nenhum foco quebrado foram encontrados nesta
rodada nos elementos testados (mapa, hemiciclo, painéis, tabelas).

---

## 4. Lacunas em ordem de impacto

1. **Pontos cortados na borda esquerda das mini-gráficas (bug #1)** — o achado de maior alcance desta
   rodada: afeta 74% dos estados, é puramente geométrico (falta de margem esquerda no plot) e tem
   correção de poucas linhas (reservar `MINI_PAD_LEFT` equivalente ao raio máximo, deslocar
   `MINI_PLOT_W`).
2. **Laço decorativo em MG/TO quando as datas colapsam (bug #2)** — baixa frequência atual (2 casos)
   mas alta gravidade conceitual (o gráfico desenha um movimento que não existe); reaparecerá sempre
   que duas pesquisas do mesmo estado terminarem no mesmo dia, o que é comum perto da eleição.
3. **Scroll-jack ao expandir detalhes na base de pesquisas (bug #4)** — fricção real na peça que hoje
   mais supera a referência (FiveThirtyEight/NYT); um usuário that abre detalhes perde o contexto da
   linha.
4. **Marcadores sobrepostos em corridas empatadas no gráfico temporal (bug #3)** — cosmético mas
   ferre exatamente o cenário mais importante de mostrar (corrida de 0,2 ponto).
5. **Fallback "Em construção" mascarando falha de rede (bug #5)** — baixa frequência, mas engana
   sobre o que está quebrado; mais perigoso em mobile, onde a instrução desta rodada mais insistiu.
6. **Eixo Y largo no gráfico principal por incluir um 3º candidato distante (Cury)** — tensão de
   design genuína (o NYT de 2024 só cobria 2 candidatos; aqui há 3), não um bug, mas é a lacuna
   central de paridade com a barra de qualidade nomeada explicitamente na tarefa.

---

## 5. Veredito final

**Pronto para publicar: NÃO.**

As peças novas desta rodada (gráfico temporal, tooltip rico, painel do Senado com atual+projetado,
base de pesquisas) são, no conjunto, mais completas que as referências do NYT/538 — a maioria dos
vereditos acima é "o nosso vence" com justificativa concreta. Mas dois achados desta rodada são
bugs de **render incorreto de dado**, não de gosto ou paridade de recurso: o corte do ponto mais
antigo em 74% das mini-gráficas por estado (bug #1) e o laço sem sentido em Minas Gerais/Tocantins
(bug #2) — ambos verificados por auditoria direta do DOM (`cx` real dos círculos), não por
impressão visual. Um gráfico que desenha um formato que não corresponde aos dados (mesmo que raro,
como o laço) e um gráfico que corta visualmente um ponto de dado real (em 3 a cada 4 estados) são
exatamente os dois tipos de falha que a skill de dataviz classifica como mais graves — "a chart
invents a [shape] that isn't in the data" e "a mark clipped by... a too-small [container]". Ambos
têm correção pequena e localizada (`presidential-states-layout.ts`/`presidential-states-view.ts`),
mas precisam ser corrigidos e reverificados (idealmente nos 27 estados, não só MG/Goiás) antes de
publicar a tela "Presidente por estado". O scroll-jack da base de pesquisas (#4) e a colisão de
marcadores no 2º turno (#3) são secundários, mas reforçam a mesma recomendação: mais uma rodada de
correção + verificação objetiva antes do "sim".
