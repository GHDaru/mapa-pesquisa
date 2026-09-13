# Crítica de UI — Rodada 1

Metodologia: `npm run build` + `vite preview` (porta 4173), screenshots full-page em
1280×800 e 400×800, tema claro e escuro, via Playwright/Chromium headless. Rotas:
`/#/mapa` (padrão, com SP aberto, com hover em MG), `/#/presidente`, `/#/senado`
(padrão e "Composição atual"), `/#/partidos`. Screenshots em
`docs/screenshots/critica/*.png`. Console e `document.documentElement.scrollWidth`
em 400px verificados para cada rota/tema. Barra de qualidade: NYT
`polls-president.html` e `results-senate.html`, conforme descritos em
`docs/ux-spec.md` §1.

**Nota sobre o processo**: a primeira rodada de screenshots foi tirada contra um
build (`dist/`) mais antigo que `data/polls.json` no disco (mtime do bundle
anterior ao do dado) — isso produzia uma liderança fantasma no Paraná ("Não
sabe/indeciso" como líder, pintado como "Não classificado"). Um `npm run build`
antes da rodada final descartou esse falso positivo; confirmado depois (tema
claro e escuro) que o Paraná volta a aparecer corretamente como "Direita" —
os vereditos abaixo são contra o build atual, consistente com os dados
atuais em `data/`.

---

## 1. Vereditos por peça

| Peça | Veredito | Justificativa (2 linhas) | Maior lacuna restante |
|---|---|---|---|
| **Mapa (coroplético)** | **O nosso vence** | Matiz de 5 pontos (não binário) + opacidade de confiança + hachura redundante para empate/sem-dados é mais informativo que o diverging vermelho-azul do NYT; rótulos de UF sempre visíveis no próprio mapa (o NYT não rotula estados pequenos inline). | Nenhum rótulo textual de "espectro" aparece sobre o próprio mapa — só na legenda; em estados minúsculos (SE, DF) o usuário precisa caçar a cor na legenda para saber o partido antes do hover. |
| **Tooltip (hover)** | **O nosso vence** | Igual ao NYT em densidade/imediatismo: nome, líder, partido, vantagem+rótulo de confiança, instituto e data — tudo isso o NYT também mostra, e o nosso aparece com posicionamento adaptativo (não corta na borda). | Tooltip mostra só o instituto da pesquisa **mais recente** usada no agregado, não quantas pesquisas compõem a média (isso só aparece dentro do painel do estado) — o NYT mostra "N polls" no próprio tooltip. |
| **Painel/drawer do estado** | **O nosso vence** | Mais completo que qualquer coisa equivalente no NYT: governador + senador, barras por candidato, empate técnico, lista expansível de pesquisas com registro TSE/margem/fonte. | Nomes de candidato + partido são truncados com reticências no meio da sigla do partido (`"Tarcísio de Freitas (Rep..."`) em vez de usar o badge colorido de partido já usado em `/#/presidente` e `/#/senado` — informação relevante fica ilegível exatamente onde a coluna é mais estreita (drawer de 380px). |
| **Agregador presidencial** | **NYT vence** | O NYT nunca perde uma coluna da tabela em mobile (vira lista de cards, como o *nosso* cadastro de partidos já faz); a nossa tabela de pesquisas em 400px expõe só 3 de 8 colunas e **rola a página inteira na horizontal** para revelar o resto — o `overflow-x:auto` do wrapper da tabela não contém a página. | `document.documentElement.scrollWidth = 1087` em 400px em `/#/presidente` (verificado por scroll real: `window.scrollTo(999,0)` move `scrollX` para 687) — a tabela de pesquisas (`.pv-table { min-width:640px }`) nunca colapsa para cards como a tabela de partidos faz; o usuário mobile não consegue ver amostra/margem/candidatos/fonte sem descobrir que a página inteira, não só a tabela, rola de lado. |
| **Hemiciclo do Senado** | **O nosso vence** (com ressalva) | Geometria em arco real (não barra), fileiras concêntricas, marcador de "41 para maioria" com rótulo textual, toggle Projeção/Atual e filtro por UF — mais rico que a barra segmentada do NYT e sem quebra em mobile (cabe em 400px sem scroll). | O código só aplica opacidade reduzida a um assento projetado quando é `empateTecnico` (opacidade 0,45 binária); a escala de 3 níveis do resto do site (`lidera com folga` / `lidera, corrida acirrada` / `empate`) definida em `design-system.md` para cadeiras projetadas **não existe no hemiciclo** — toda cadeira projetada não empatada aparece 100% opaca, tenha o candidato vantagem de 0,1pt ou 30pts acima da margem "lean". |
| **Cadastro de partidos** | **O nosso vence** | Tabela ordenável visualmente por espectro (não é isso que o NYT compara, mas cumpre bem o espírito "tabela com tabular-nums, nunca só cor" do princípio 5); colapsa para cards com rótulo/valor em 400px sem perder nenhuma coluna. | Não há como reordenar por "Número" (identificador oficial do TSE) como `ux-spec.md §2(e)` pede — a tabela é sempre ordenada por espectro, sem cabeçalhos clicáveis nem seletor de ordenação (nem mesmo em mobile, onde o spec pede um `select` substituindo os cabeçalhos). |
| **Tipografia/cor geral** | **O nosso vence** | Hierarquia calma e consistente (Inter, pesos 400/510/590), `tabular-nums` aplicado consistentemente em todas as colunas numéricas das 3 telas de dados — mais disciplinado que a mistura serifada/sans do NYT. | `--spectrum-indefinido` (`#4c4f56`) e as 5 cores `--spectrum-N-fill/-solid` nunca são redefinidas no bloco de tema claro (`tokens.css` só redefine texto/superfície/borda) — qualquer líder "Não classificado" no mapa ou hemiciclo aparece quase preto sobre fundo branco no tema claro, e não há nenhuma UF nos dados atuais que dispare essa combinação, mas o token está pronto para produzir um "estado preto sem razão aparente" assim que aparecer um partido não classificado. |
| **Mobile geral (400px)** | **O nosso vence, exceto Presidente** | Mapa, drawer, hemiciclo e partidos mantêm 100% da função em 400px sem scroll horizontal de página (confirmado via `scrollWidth`); só `/#/presidente` viola isso. | Ver linha "Agregador presidencial" acima — é o único ponto do site que quebra a garantia "mobile sem perda de função" do próprio `ux-spec.md`. |

---

## 2. Bugs objetivos (por prioridade)

### P0 — quebra função
1. **`/#/presidente` em 400px rola a página inteira na horizontal.**
   `document.documentElement.scrollWidth` = 1087 contra viewport de 400px (confirmado
   nas 2 variações de tema). A tabela "Todas as pesquisas presidenciais" tem
   `.pv-table { min-width: 640px }` dentro de `.pv-table-wrap { overflow-x:auto }`;
   apesar do wrapper mostrar sua própria scrollbar interna, o layout do
   `<table>` (1082px) ainda infla o `scrollWidth` do documento e a página
   **inteira** (header, cards, tudo) pode ser arrastada 687px para a direita —
   verificado com `window.scrollTo(999,0)` movendo `window.scrollX` para 687.
   Nenhuma outra rota tem esse problema (`/#/partidos`, que também tem uma
   tabela grande, colapsa corretamente para cards em `max-width:400px` — a
   tabela de pesquisas presidenciais nunca ganhou o equivalente).

### P1 — dado/estado visualmente incorreto ou incompleto
2. **Hemiciclo do Senado não tem opacidade de confiança em 3 níveis para cadeiras
   projetadas.** `senate-view.ts` (`desenharHemiciclo`) e `domain/senate.ts`
   (`projetarSenado`) só carregam um booleano `empateTecnico` por assento —
   nunca calculam "lean" vs. "solid". CSS correspondente
   (`.pv-assento.pv-empate-tecnico { opacity: 0.45 }`) não tem irmã para
   `lean`. Resultado: um assento projetado com vantagem de 0,5 ponto acima da
   margem (tecnicamente não empatado, mas mal definido) pinta idêntico a um
   assento com vantagem de 30 pontos — o próprio `design-system.md` (seção
   "Hemiciclo do Senado") descreve as 3 faixas como aplicáveis aqui e elas não
   estão implementadas.
3. **Truncamento de partido dentro do nome do candidato no painel do estado.**
   `.bar-row__rotulo` concatena `"{candidato} ({partido})"` num único nó de
   texto com `text-overflow:ellipsis; white-space:nowrap`, cortando no meio da
   sigla do partido em nomes/partidos longos (ex.: "Tarcísio de Freitas
   (Rep..." em vez de mostrar "Republicanos" via o badge colorido que
   `/#/presidente` e `/#/senado` já usam para o mesmo dado). Informação
   perdida justamente na coluna mais estreita da UI (drawer de 380px).
4. **Token `--spectrum-indefinido` (e as 5 cores de espectro) não têm variante
   de tema claro.** Definidas uma única vez em `:root` (`tokens.css`), sem
   override no bloco `@media (prefers-color-scheme: light)` nem em
   `[data-theme="light"]`. Nos dados atuais nenhuma UF/partido dispara essa
   cor (todos os 31 partidos do cadastro têm espectro classificado, e
   confirmei nas screenshots de tema claro do mapa e do hemiciclo desta rodada
   que nenhum estado/assento aparece como "Não classificado" hoje) — mas o
   defeito no CSS é real: assim que um partido ficar sem classificação
   confirmada, ele pintará quase
   preto (`#4c4f56`) sobre fundo branco no tema claro, destoando de toda a
   paleta clara ao redor (inclusive do cinza "sem dados", que corretamente usa
   `--color-border-strong`, redefinido por tema).

### P2 — inconsistência/acabamento
5. **Cadastro de partidos não oferece ordenação por Número**, apesar de
   `ux-spec.md §2(e)` pedir explicitamente "ordenável por Número (padrão) ou
   por Espectro" com cabeçalhos clicáveis (e um `select` substituindo-os em
   mobile). A tabela atual (`parties-view.ts`) ordena estaticamente por
   espectro sem nenhum controle de ordenação, em nenhuma largura de tela.
6. **Tooltip do mapa não informa quantas pesquisas** compõem a média exibida
   (só mostra o instituto/data da mais recente) — informação que o
   `state-panel` tem (`"Ver as N pesquisas"`) mas não sobe ao preview de hover,
   ao contrário do NYT, que inclui a contagem de pesquisas no próprio popover.
7. **Cabeçalho de navegação quebra de forma um pouco desalinhada em 400px**
   (3 links numa linha, "Partidos" sozinho numa segunda linha) — funcional,
   mas seria mais limpo como um `select`/menu único, já que o resto do site
   evita justamente esse tipo de quebra irregular em controles (ex.:
   `pv-toggle-group` do Senado tem `flex-wrap` mas cabe inteiro em 400px).
8. **Assentos "indefinidos" do hemiciclo ficam com baixo contraste no tema
   claro.** A hachura usa `--color-surface-2` (`#eef0f2`, quase branco) com
   linhas em `--color-border-strong` (`#d3d6db`) — visível em
   `senado__1280x800__light.png`, esses assentos quase somem contra o fundo
   `--color-canvas` branco, ao contrário do tema escuro onde o mesmo par de
   tokens contrasta bem.

---

## 3. Lacunas em ordem de impacto

1. **Tabela de pesquisas presidenciais quebra o layout em mobile** (P0 #1) —
   único ponto do site que viola "mobile sem perda de função"; usuário em
   celular não consegue ler amostra, margem, candidatos ou fonte de nenhuma
   pesquisa presidencial sem descobrir que a página toda rola de lado.
2. **Opacidade de confiança ausente no hemiciclo para cadeiras projetadas**
   (P1 #2) — a peça mais nova/ambiciosa do site (arco geométrico) não recebeu
   o mesmo tratamento de "matiz = líder, opacidade = confiança" que o mapa e
   os badges já têm; hoje ela só distingue empate técnico de "não-empate",
   perdendo o gradiente de certeza que é o próprio conceito central do
   `design-system.md`.
3. **Sem ordenação por Número no cadastro de partidos** (P2 #5) — pequeno
   desvio de espec, mas relevante porque Número é o identificador oficial do
   TSE e a única forma de achar um partido específico sem saber seu espectro
   de cor.
4. **Truncamento de partido no painel do estado** (P1 #3) — cosmético mas
   perde dado (partido) num componente que existe exatamente para dar detalhe.
5. **Token de espectro "indefinido" sem variante clara** (P1 #4) — bug
   dormente, sem UF/partido nos dados atuais para expô-lo, mas vai aparecer
   quase-preto assim que algum partido ficar sem classificação confirmada.
6. **Tooltip do mapa sem contagem de pesquisas** (P2 #6) — diferença pequena
   frente ao NYT, não chega a comprometer a usabilidade.
