# Especificação de UX — Mapa das Pesquisas 2026

Barra de qualidade: NYT *"Presidential polls 2024"* (mapa por estado) e *"Senate results 2024"*
(hemiciclo/balanço de poder). Esta seção descreve concretamente o que essas páginas fazem; a seção
seguinte especifica as nossas cinco telas em cima do mesmo padrão, com os tokens de
`design-system.md`.

## 1. O que o NYT faz (referência)

### 1.1 `polls-president.html` (mapa de pesquisas por estado)
- **Layout**: cabeçalho editorial (serifada grande, Cheltenham, para o título; Franklin sans para
  subtítulo e metadados) → mapa dos EUA (projeção Albers) ocupando a largura do artigo → legenda de
  cor logo abaixo do mapa, centralizada → tabela completa de médias por estado abaixo do mapa.
- **Pintura do mapa**: escala diverging vermelho↔azul; a **saturação/luminosidade** codifica a
  confiança (tossup quase branco/cinza, lean claro, likely mais saturado, solid mais escuro), a
  **matiz** codifica o partido líder. Estados sem pesquisa suficiente ficam cinza neutro. Isso é
  exatamente o padrão que adotamos em `design-system.md` (matiz = espectro do partido, opacidade =
  confiança), só que no nosso caso a matiz vem de uma escala contínua de 5 pontos por causa do
  multipartidarismo, não binária D/R.
- **Hover** (desktop): estado escurece levemente a borda e levanta um tooltip fixo ancorado perto do
  cursor com: nome do estado, retratos/nomes dos dois principais candidatos, percentual médio de
  cada um, número de pesquisas na média e a data da pesquisa mais recente. **Click/tap** (mobile):
  mesma informação, mas fixa o tooltip até tocar em outro estado ou fora do mapa (não depende de
  hover, que não existe em touch).
- **Tabela abaixo do mapa**: uma linha por estado, colunas com números **tabulares** (fonte
  monoespaçada ou `font-variant-numeric: tabular-nums`) para alinhar casas decimais; estados
  "campo de batalha" aparecem destacados/agrupados no topo antes da lista alfabética completa;
  cabeçalhos de coluna são clicáveis para ordenar.
- **Tipografia**: 3 níveis claros — serifada só no título editorial; sans-serif Franklin em pesos
  diferentes para hierarquia de dados (negrito para o nome do estado/candidato líder, regular para
  números secundários); rótulos de legenda em versalete pequeno.
- **Mobile**: o mapa geográfico shrinka mas continua sendo mapa (não vira lista) — o toque abre o
  mesmo tooltip fixo descrito acima, geralmente ancorado no topo ou embaixo do mapa para não ser
  cortado pela borda da tela; a tabela vira scroll horizontal ou colunas reduzidas (só líder + margem).
- **Rodapé/cabeçalho de dados**: linha "Atualizado [data/hora]" e nota metodológica curta (janela de
  média, ponderação por recência) sempre visível perto do topo, não escondida em modal.

### 1.2 `results-senate.html` (resultados do Senado)
- **Barra de balanço de poder** no topo: uma barra segmentada horizontal (100 células, uma por
  cadeira) colorida por partido, cinza para "não decidido", com uma marca vertical em 51 ("maioria")
  e um número grande de cada lado mostrando a contagem atual — é conceitualmente o mesmo problema do
  nosso hemiciclo, só que em barra em vez de arco.
- **Mapa + lista por corrida**: mapa dos EUA colorido por partido vencedor/projetado; abaixo, lista
  de corridas ordenável (por "mais disputada" por padrão), cada linha com nome do candidato, partido,
  % de votos, % apurado, selo "Called by The Times" quando decidido, e uma marca discreta para
  assento que não estava em disputa naquele ciclo (accent visual diferente de "disputado e decidido").
- **Atualização ao vivo**: badges de estado da corrida (não chamada / chamada) são o sinal redundante
  de confiança — nunca só a cor do partido.

### Princípios que extraímos para o nosso site
1. Matiz = quem lidera; opacidade/textura = confiança; nunca cor sozinha.
2. Todo dado visual tem uma tabela ou lista textual equivalente ao lado/abaixo.
3. Metadados de atualização e metodologia ficam visíveis, não escondidos.
4. Tooltip por hover no desktop, por tap fixo no mobile — nunca só hover.
5. Números em colunas usam algarismos tabulares.

---

## 2. Nossas telas

Breakpoints (mobile-first): `--bp-xs: 400px` (mínimo suportado), `--bp-sm: 640px`,
`--bp-md: 768px`, `--bp-lg: 1024px`, `--bp-xl: 1280px`. Container com `padding-inline: var(--space-4)`
abaixo de 640px e `var(--space-6)` acima. Nenhum elemento tem `min-width` maior que a tela.

### (a) Mapa do Brasil — tela inicial
- **Cabeçalho**: título "Governadores 2026" (`--text-headline`, peso 590) + linha de metadado
  "Atualizado em {meta.atualizadoEm, formatado dd/mm/yyyy às HH:mm}" (`--text-caption`,
  `--color-text-subtle`) lida de `data/meta.json`. Um botão/aba para trocar o mapa entre "Governador"
  e "Senador (projeção)" — mesma tela, `cargo` diferente.
- **Mapa**: SVG `@svg-maps/brazil`, 27 paths por UF. Cada `path` recebe `fill: var(--spectrum-N-fill)`
  do espectro do partido líder do agregado de governador daquela UF, `opacity` pela faixa de
  confiança (`design-system.md`), e `fill` do padrão de hachura sobreposto quando `empateTecnico` ou
  `sem-dados`. Borda de cada UF: `stroke: var(--color-canvas)` 1px (separa estados no fundo escuro).
  Estado com foco/hover: `stroke: var(--color-accent)` 2px + leve `filter: brightness(1.08)`,
  transição `var(--duration-sm) var(--ease-out)`.
- **Legenda**: abaixo do mapa (nunca só um tooltip), com swatches para os 5 níveis de espectro ×
  rótulo textual do partido/bloco típico, e swatches separados para "lidera com folga / lidera,
  corrida acirrada / empate técnico / sem dados" reproduzindo as opacidades — cada swatch tem texto,
  não só cor.
- **Hover (mouse)**: mini-tooltip flutuante junto ao cursor com só o essencial (UF, líder, partido,
  vantagem em pontos) — não abre o painel completo, só um preview, igual ao NYT.
- **Click/tap**: abre o drawer/painel do estado (item b). Em `≥1024px` o drawer é lateral (largura
  fixa ~380px, mapa encolhe); abaixo disso é uma folha inferior (bottom sheet) que sobe cobrindo até
  80% da altura, com alça de arraste e botão fechar (X) sempre visível no topo.
- **Mobile 400px**: mapa mantém-se como mapa (nunca vira lista de UFs — SVG escala por `viewBox`,
  `max-width: 100%`), mas os `path` muito pequenos (ex.: DF, Sergipe) ganham um alvo de toque
  ampliado invisível (`pointer-events` numa área maior que o path) porque a área visual real é menor
  que 44×44px recomendados. Título do cabeçalho quebra para 2 linhas se necessário; abas
  Governador/Senador viram select ou segmented control de largura total.

### (b) Painel/drawer do estado
Campos, na ordem, mapeados 1:1 aos campos de `data/polls.json` / agregado de domínio:
1. Nome do estado + UF, bandeira/brasão opcional.
2. **Governador**: nome do líder do agregado, partido (badge com `--spectrum-N-solid` + sigla),
   vantagem em pontos sobre o 2º colocado, selo "EMPATE TÉCNICO" (texto, não só cor) quando
   `vantagem <= margem`. Lista dos 2-3 principais candidatos com barra horizontal de %.
3. **Senador**: mesmo formato; se a UF não está em disputa em 2026, mostra o titular atual (cadeira
   fixa) com rótulo "não é eleição este ano" em vez de pesquisa.
4. **Ficha de cada pesquisa usada no agregado** (lista expansível "ver as N pesquisas"): instituto,
   `dataInicio`–`dataFim`, `amostra`, `margem` (± pontos), `registroTSE` (ou "não localizado" se
   null), `contratante`, link "Fonte" (`fonte.nome`, abre `fonte.url` em nova aba com
   `rel="noopener"`).
5. Rodapé do painel: "última pesquisa em {data}" e link para a metodologia do agregador (item c).
- **Fechar**: botão X, tecla `Esc`, clique fora do drawer (backdrop), ou swipe-down no bottom sheet
  mobile. Foco retorna ao `path` do estado que abriu o painel.

### (c) Agregador presidencial nacional
- Página própria (`cargo = presidente`, `uf = "BR"`). Cabeçalho com metodologia resumida (peso por
  recência com meia-vida em dias, peso por `sqrt(amostra)`, janela de N dias — os mesmos parâmetros
  do serviço `agregarPesquisas`), link "como calculamos".
- **Gráfico de média ponderada**: barras horizontais empilhadas ou barras paralelas por candidato,
  ordenadas por % decrescente, com faixa de incerteza (± margem ponderada) desenhada como um
  segmento mais claro atrás da barra — mesmo princípio de opacidade para confiança usado no mapa.
  Badge "EMPATE TÉCNICO" entre 1º e 2º quando aplicável.
- **Lista de pesquisas** (tabela, não só cards): colunas Instituto | Contratante | Período | Amostra
  | Margem | % por candidato | Registro TSE | Fonte — números em `tabular-nums`, ordenável por data
  (padrão: mais recente primeiro). Pesquisa sem `registroTSE` mostra "não registrada" em
  `--color-text-tertiary` com ícone de alerta (não vermelho puro — reservar `--color-danger` para
  erros reais), tooltip explicando que a ausência é sinalizada, não a pesquisa descartada.
- **Mobile**: gráfico de barras mantém-se (empilha bem em largura total); tabela vira lista de cards
  empilhados, um por pesquisa, mesmos campos em pares rótulo/valor.

### (d) Hemiciclo do Senado
- 81 assentos em arranjo de arco (hemiciclo), várias fileiras concêntricas, distribuídos por
  ângulo, não por partido agrupado em blocos rígidos — layout tipo `d3-parliament-chart`: calcular
  fileiras por raio crescente, número de assentos por fileira proporcional à circunferência, order
  final da esquerda (ângulo 180°) para a direita (ângulo 0°) por posição do partido na escala de
  espectro (para o efeito visual de gradiente vermelho→azul da esquerda pra direita do hemiciclo,
  como o pedido descreve).
- Cor/textura de cada assento conforme regras já fixadas em `design-system.md` (fixa = contorno
  sólido opaco; projetada = opacidade por confiança + traço tracejado; indefinida = hachura cinza).
- **Marcador de maioria** em 41 assentos, linha vertical + rótulo textual "41 para maioria" acima do
  arco (não só uma cor de fundo dividida).
- **Filtros** acima do hemiciclo: alternância "Atual" (composição real, sem projeção) / "Projeção
  2026" (aplica o resultado do agregado às 54 cadeiras em disputa); filtro por partido (realça só os
  assentos daquele partido, esmaece o resto para 30% opacidade); busca por UF que aponta e foca no
  assento correspondente.
- **Hover/click num assento**: tooltip com UF, senador/candidato, partido, se é cadeira fixa ou
  projetada, e (se projetada) o link para o drawer do estado (item b).
- **Legenda textual ao lado**: contagem de assentos por partido (não só visual — uma lista
  ordenada por tamanho de bancada com número), reaproveitando os badges `--spectrum-N-solid`.
- **Mobile 400px**: hemiciclo é um SVG com `viewBox`, escala para largura total mantendo proporção
  (~2:1); filtros colapsam em um menu "Filtros" (ícone) que abre um sheet, para não competir por
  espaço horizontal com o desenho.

### (e) Cadastro de partidos
- Tabela (não cards) com colunas: Número | Sigla | Nome completo | Espectro (badge colorido +
  rótulo textual "Esquerda"/"Centro-esquerda"/etc., nunca só a cor) | Fonte da classificação (link).
  Ordenável por Número (padrão, é o identificador oficial TSE) ou por Espectro (agrupa visualmente
  a progressão de cor).
- Linha de partido sem classificação confirmada usa `--spectrum-indefinido` + rótulo "não
  classificado" e um campo `observacao` visível ao expandir a linha, nunca omitido.
- **Mobile 400px**: tabela vira lista de cards (1 por partido) com os mesmos pares rótulo/valor;
  cabeçalho da lista ganha um select de ordenação substituindo os cabeçalhos de coluna clicáveis.

---

## 3. Acessibilidade e teclado (todas as telas)

- **Nunca só cor**: todo par matiz+opacidade tem equivalente textual — rótulo de partido nos
  tooltips/badges, palavra "EMPATE TÉCNICO" / "SEM DADOS" / "PROJETADO" escrita, e texturas
  (hachura 45°, traço tracejado) como reforço não-cromático, conforme WCAG 1.4.1.
- **Contraste**: todo texto usa os pares confirmados em `design-system.md` (≥ 4.5:1 para texto
  normal, ≥ 3:1 para texto grande/ícones). `--color-danger` (`#eb5757`) só em texto ≥ 24px, ícone ou
  borda — nunca em texto pequeno sobre fundo escuro.
- **Teclado**: mapa e hemiciclo são conjuntos de elementos focáveis (`tabindex="0"` por
  path/assento, ou um único `tabindex="0"` no SVG com navegação por setas entre regiões via
  `role="application"` + `aria-activedescendant` — preferir a primeira abordagem, mais simples e
  compatível com leitor de tela). `Enter`/`Espaço` abre o painel/tooltip fixo; `Esc` fecha e devolve
  o foco à região que o abriu. Ordem de tabulação: cabeçalho → controles de filtro/abas → mapa/hemiciclo
  região por região (ordem geográfica N→S ou por ângulo) → legenda → tabela.
- **Foco visível**: `--focus-ring` (anel 2px na cor de acento a 50% de opacidade) em todo elemento
  interativo, nunca `outline: none` sem substituto.
- **Leitor de tela**: cada `path`/assento tem `aria-label` completo ("São Paulo, governador: Fulano,
  PT, lidera com 5,2 pontos, dentro da margem de erro" / "Cadeira de Minas Gerais, projetada, PL,
  vantagem de 3 pontos"). Tabelas usam `<table>` semântica real com `<th scope="col">`, nunca divs
  estilizadas. Tooltip usa `role="tooltip"` associado por `aria-describedby`; drawer usa
  `role="dialog"` + `aria-modal="true"` + foco preso (focus trap) enquanto aberto.
- **Movimento**: todas as transições respeitam `prefers-reduced-motion: reduce` (troca
  `var(--duration-*)` para `0ms` e remove `transform` de entrada, mantendo só a troca de opacidade).
- **Estados de link/fonte**: todo link externo (`fonte.url`, `fonteClassificacao`) tem
  `target="_blank" rel="noopener noreferrer"` e um ícone/rótulo indicando que abre em nova aba,
  anunciado a leitores de tela via texto visualmente oculto (`sr-only`, ex. "abre em nova aba").
