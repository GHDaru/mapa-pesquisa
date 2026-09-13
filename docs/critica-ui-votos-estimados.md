# Crítica — aba "Votos estimados" (`/#/presidente-estados`, `#ps-tab-1`)

Comparado contra a barra: projeções de votos NYT/FiveThirtyEight 2024 (barras
comparáveis por candidato, proporcionais à magnitude, faixa de incerteza,
método em uma frase, tabela por estado com contribuição).

**Veredito: a barra vence.**

Arquivos revisados: `src/domain/vote-estimate.ts`,
`src/adapters/inbound/web/views/vote-estimate-panel.ts`,
`src/adapters/inbound/web/styles/vote-estimate.css`.
Screenshots em `docs/screenshots/critica5/` (1280 dark, 1280 light, 400 dark).

---

## A única maior lacuna

**A barra do card não compara magnitude nem mostra incerteza — ela só mostra
proveniência do dado, e sempre ocupa 100% da largura do card.**

`.ve-bar-track { width: 100%; }` (`styles/vote-estimate.css:222-230`) e
`criarBarraSegmentada` (`vote-estimate-panel.ts:172-208`) desenham, para
**todo** candidato, uma barra da largura inteira do card, subdividida em 3
segmentos (estadual / complemento nacional / sem pesquisa) que somam 100% dos
*votos daquele candidato* — nunca do total geral. Resultado visível nos
screenshots: a barra de Luiz Inácio Lula da Silva (62,3 milhões) e a de Pablo
Marçal (0,2 milhões, ~300× menor) têm exatamente o mesmo comprimento. A única
informação de magnitude do card está no texto ("62,3 milhões" vs "0,2
milhões"), não no gráfico — ou seja, o elemento visual que deveria ser o
gráfico de comparação é, na really, apenas um indicador textual-com-padrão de
metodologia por candidato, e nenhum gráfico de comparação existe na tela.

Isso é o anti-padrão listado em `anti-patterns.md` ("A chart container...
cada barra ocupa 100% da largura em vez de ser proporcional ao total") e viola
a recomendação central de `choosing-a-form.md` para "comparar magnitude":
usar comprimento de barra proporcional ao valor. Além disso, em nenhum lugar
da tela há faixa de incerteza (margem de erro, intervalo de confiança) — a
estimativa é sempre um ponto único, com uma precisão de 1 casa decimal em
milhões que sugere uma exatidão que a metodologia (pesquisas amostrais +
substituição nacional) não sustenta. A referência (NYT/538) tem as duas coisas
que faltam aqui: comprimento proporcional entre candidatos e faixa de
incerteza. O nosso painel não tem nenhuma das duas.

---

## Avaliação por eixo

### 1. Metodologia

- **Base do percentual não é explicada.** O texto diz "cada estado contribui
  com o seu eleitorado multiplicado pelo percentual da própria pesquisa
  presidencial estadual" (`criarCabecalho`, `vote-estimate-panel.ts:112-115`),
  mas `eleitorado` é "eleitores aptos" (TSE — ver
  `docs/data-schema.md:59` e `domain/electorate.ts:5`), isto é, o total de
  registrados, **não** quem de fato vai votar. Como o comparecimento no Brasil
  historicamente fica na casa de 75-80% (não 100%), aplicar direto o
  percentual da pesquisa (tipicamente apurado sobre entrevistados/decididos)
  sobre o eleitorado total infla a base sem dizer isso ao leitor. O texto
  nunca menciona abstenção nem comparecimento — nem no cabeçalho, nem na linha
  de "Não atribuídos".
- **"Não atribuídos" está parcialmente explicado.** O rótulo diz "brancos,
  nulos, indecisos, outros" (`criarLinhaNaoAtribuidos`,
  `vote-estimate-panel.ts:292-297`) mas omite abstenção — que, dado o ponto
  acima, é provavelmente o maior componente desse resíduo (14,8% do eleitorado
  no screenshot). Declarar a lista sem "abstenção" é enganoso por omissão.
- **Complemento nacional por candidato: sinalizado corretamente.** Este é o
  ponto forte da tela. Cada célula da tabela por UF marca com `*` quando a
  parcela veio do agregado nacional (`celulaCandidatoUf`,
  `vote-estimate-panel.ts:319-325`), há legenda explicando o `*`
  (`criarSecaoPorUf`, linha 369), e o card por candidato tem uma barra
  segmentada com legenda de 3 categorias (`criarLegendaBarra`, linhas
  158-170). Isso é mais transparente do que a maioria das coberturas
  jornalísticas de projeção — mas está desperdiçado numa barra que não
  compara nada (ver lacuna acima).
- **Frase de método única: não existe.** A referência pede "explicação de
  método em uma frase"; aqui o método está espalhado em 3 parágrafos/blocos
  (cabeçalho, legenda da barra, nota da tabela por UF) e nenhum deles é a
  frase-resumo que orienta o leitor antes de ele ver os números.

### 2. Forma (gráfico)

- Barras **não comparáveis entre candidatos** — todas a 100% da largura
  (anti-padrão confirmado, ver lacuna acima e screenshots 1280/400).
- **Nenhuma faixa de incerteza.** `EstimativaVotos`/`CandidatoEstimado`
  (`domain/vote-estimate.ts:37-56`) não carregam nenhum campo de margem/IC;
  a UI também não sintetiza uma (mesmo que aproximada, por design de página).
- A forma escolhida (card + barra de composição) seria adequada como
  *complemento* de metodologia, mas não substitui um gráfico de comparação de
  magnitude — segundo a própria tabela de `choosing-a-form.md`
  ("Compare magnitude, low → high: bar/column"), faltou o gráfico principal.

### 3. Tabela por UF

- Legibilidade e ordenação: boas. Ordenada por eleitorado decrescente
  (`criarSecaoPorUf`, linha 348), números em `tabular-nums`, 1º/2º colocado
  com valor absoluto, "Outros" agregado com contagem + soma — layout limpo,
  sem embutir número em cada segmento (evita o anti-padrão de rótulo dentro de
  barra).
- **Cards em 400px: inconsistente entre as duas tabelas do painel.** A
  tabela "Detalhe por UF" vira lista de cards em ≤640px
  (`.ve-uf-table-wrap` — regra de mídia em
  `styles/vote-estimate.css:317-357`), mas a tabela "Agregação estadual ×
  média nacional" **não tem essa regra** — ela é só `.ve-table-wrap`, sem o
  modificador `.ve-uf-table-wrap`. Medido no viewport 400px:
  `scrollWidth 630 / clientWidth 366` nessa tabela (contra
  `scrollWidth 640 / clientWidth 368`, mas convertida em cards, na tabela de
  UF). Na prática, a coluna "% média nacional" fica cortada na borda do card
  e exige rolagem horizontal *dentro* de uma caixa sem indicação visual de que
  há mais conteúdo — comportamento diferente do resto do painel e do resto do
  app. `scrollWidth` do documento continua 400px (sem vazamento de layout
  geral), mas a experiência dentro dessa tabela específica quebra o padrão.

### 4. Contraste / tokens (tema claro)

- Todas as cores usadas pelo painel vêm de tokens (`var(--color-*)`,
  `tokenFillEspectro`/`tokenSolidEspectro`/`corEspectroSolido`) — nenhuma cor
  hardcoded fora do branco fixo do texto de badge (`#ffffff` em
  `.ve-badge-partido`, que é o padrão do app inteiro, com contraste ≥4.5:1
  documentado em `format.ts:101`). Sem regressão aqui.
- Nada de novo a reportar além do que já é padrão de tokens do projeto —
  parece ok à leitura dos dois screenshots claro/escuro.

### 5. Bugs objetivos

- **Soma de milhões bate.** 62,3 + 52,1 + 13,7 + 2,2 + 2,2 + 1,7 + 0,2 =
  134,4M; + Não atribuídos 23,4M = 157,8M ≈ eleitorado total (157.827.925).
  Sem discrepância de soma nos números exibidos.
- **Diferença da tabela de comparação "parece" não bater, por arredondamento
  duplo.** Linha Lula: "39,5% / 38,9% / +0,5 pts". Um leitor fazendo
  39,5 − 38,9 de cabeça chega a 0,6, não 0,5 — porque `formatarVantagem`
  (`format.ts:52-55`) formata a diferença a partir do valor **não
  arredondado** (`c.pctEstimado - c.pctNacional`,
  `vote-estimate-panel.ts:245`), enquanto as duas colunas de percentual são
  arredondadas independentemente para exibição. O resultado é internamente
  consistente, mas parece um erro de aritmética para quem confere com a
  calculadora — exatamente a categoria de bug pedida para checar.

---

## Bugs por prioridade e correções concretas

1. **[Alta] Barra sem comparação de magnitude entre candidatos.**
   Arquivo: `src/adapters/inbound/web/views/vote-estimate-panel.ts`
   (`criarBarraSegmentada`, `criarCardCandidato`) e
   `src/adapters/inbound/web/styles/vote-estimate.css` (`.ve-bar-track`).
   Correção: adicionar um gráfico de barras horizontais (fora do card, numa
   seção própria acima ou substituindo a seção "Por candidato") onde o
   comprimento de cada barra é proporcional a `candidato.votos / maiorVotos`
   (ou ao eleitorado total). Manter a barra de composição atual como um
   elemento secundário dentro do card (ex.: mini-barra fixa de 100% só como
   detalhe de proveniência, claramente rotulada como tal, não como o gráfico
   principal).

2. **[Alta] Nenhuma faixa de incerteza em nenhum nível (candidato ou UF).**
   Arquivo: `src/domain/vote-estimate.ts` (`CandidatoEstimado`) precisa expor
   alguma medida de incerteza (mesmo que aproximada — ex.: dispersão entre
   pesquisas agregadas por UF, ou uma margem fixa configurável); a UI em
   `vote-estimate-panel.ts` precisa desenhá-la (ex.: um traço/whisker sobre a
   barra de magnitude proposta no item 1). Sem isso, todo número do painel
   aparenta uma precisão de ponto único que a metodologia não garante.

3. **[Média] Metodologia não menciona abstenção/comparecimento.**
   Arquivo: `src/adapters/inbound/web/views/vote-estimate-panel.ts`
   (`criarCabecalho`, `criarLinhaNaoAtribuidos`). Correção: no parágrafo do
   cabeçalho, explicitar que o percentual é aplicado sobre o eleitorado
   **registrado** (não sobre votos válidos/comparecimento), e incluir
   "abstenção" na lista de componentes de "Não atribuídos" (ou, melhor,
   separar abstenção estimada do resto quando o dado permitir).

4. **[Média] Tabela "Agregação estadual × média nacional" não vira cards em
   ≤640px como a tabela de UF.**
   Arquivo: `src/adapters/inbound/web/styles/vote-estimate.css`. Correção:
   ou aplicar a mesma classe/regra de `.ve-uf-table-wrap` a essa tabela
   (adicionando `data-rotulo` às células em
   `criarSecaoComparacao`, `vote-estimate-panel.ts:241-288`), ou, por ela ter
   só 3 candidatos e 4 colunas, considerá-la como cards curtos como as demais
   telas do app já fazem para tabelas pequenas — mas não deixá-la como a
   única tabela do painel com rolagem horizontal interna sem indicação
   visual.

5. **[Baixa] Diferença da tabela de comparação parece não bater com a
   subtração visível das duas colunas ao lado (arredondamento duplo).**
   Arquivo: `src/adapters/inbound/web/views/vote-estimate-panel.ts`
   (`criarSecaoComparacao`, linha 245) e `format.ts` (`formatarVantagem`).
   Correção: computar a diferença exibida a partir dos mesmos valores já
   arredondados para 1 casa (`Number(formatarNumeroPt(pctEstimado)) -
   Number(formatarNumeroPt(pctNacional))`), ou adicionar uma nota de rodapé
   do tipo "diferenças calculadas antes do arredondamento — pequenas
   divergências de 0,1 pt em relação à subtração direta são esperadas".

6. **[Baixa] Falta de "frase de método" única e destacada.**
   Arquivo: `vote-estimate-panel.ts` (`criarCabecalho`). Correção: condensar
   a primeira frase do `ve-meta` atual numa frase-resumo em destaque (ex.:
   `ve-title` subtítulo ou `<strong>`), deixando o detalhamento sobre
   complemento nacional para o parágrafo já existente.
