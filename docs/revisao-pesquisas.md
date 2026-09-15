# Revisão dura — `#/pesquisas`

Escopo: `src/adapters/inbound/web/views/polls-database-view.ts`,
`src/adapters/inbound/web/styles/polls-database.css`,
`src/application/use-cases/get-polls-database.ts`, `src/domain/poll.ts`.
Barra de qualidade: FiveThirtyEight *polls database*
(`projects.fivethirtyeight.com/polls/`).

## Aviso de acesso — leia antes do resto

`WebFetch` para `projects.fivethirtyeight.com` e `fivethirtyeight.com`
retornou `EGRESS_BLOCKED` (proxy de rede bloqueia o domínio); para
`web.archive.org` a ferramenta recusou o fetch. Não vi a página ao vivo
nesta sessão. `WebSearch` trouxe algo verificável e específico, porém
indireto: o **schema real** dos CSVs que alimentam essa página (via
`fivethirtyeight.datasettes.com`, uma cópia pública do banco), que lista as
colunas por pesquisa: `pollster`, `fte_grade` (nota de confiabilidade A+ a
F), `sample_size`, `population`/`population_full` (A/RV/LV — adultos,
registrados, prováveis eleitores), `methodology`, `sponsor_ids`/`sponsors`,
`internal`, `partisan`, `tracking`, além de `state`, `start_date`,
`end_date`, `url`. Isso é fato confirmado, não memória. O que descrevo
abaixo como "a barra mostra/filtra por X" quando não vem dessa lista de
colunas é conhecimento geral, não observado nesta sessão, e está marcado
como tal — nunca apresento uma alegação de UI não verificável como se
tivesse visto a tela.

Todo o resto é observação direta: `npm run build` real, `vite preview`
real na porta 4197, Playwright real (Chromium local) contra
`http://localhost:4197/#/pesquisas`, DOM lido por script (não só
screenshot), CSV interceptado no `Blob` (bytes crus via `arrayBuffer()`,
não só `.text()` — ver bug metodológico anotado no item CSV), 238
pesquisas de `data/polls.json` cruzadas manualmente contra o que a tela
mostra e conta.

Screenshots em `docs/screenshots/revisao-pesquisas/` (8 arquivos, lista no
fim).

---

## 1. O que a barra faz melhor (concreto)

Com a ressalva de acesso acima, o ponto mais concreto e verificável é
estrutural, não visual: **o schema de dados do 538 carrega, por pesquisa,
um sinal de confiabilidade do instituto** (`fte_grade`, nota de A+ a F,
calculada por histórico de acerto) **e o tipo de amostra** (`population` —
A/RV/LV). Isso é o que permite ao leitor separar "essa pesquisa merece
peso" de "essa é de um instituto desconhecido" sem sair da tabela. Aqui,
`src/domain/poll.ts` (`DadosPesquisa`/`Pesquisa`) **não tem nenhum campo
equivalente** — nem nota do instituto, nem tipo de amostra/eleitorado. A
única variável de confiança exposta é binária e jurídica, não
metodológica: `registroTSE.naoRegistrada` (tem/não tem registro no TSE).
Ver item 4 (lacuna única).

Dentro do que o schema confirma como recurso da barra:

1. **Metadados por pesquisa mais ricos.** `sponsor_ids`/`sponsors`,
   `internal` e `partisan` deixam explícito quando uma pesquisa foi paga
   por uma campanha ou feita internamente por ela — sinal de viés
   declarado. Aqui existe `contratante` (equivalente a `sponsors`), mas
   não há campo para marcar pesquisa interna de campanha
   (`internal`/`partisan`); um contratante como um comitê de campanha
   aparece com o mesmo peso visual que a Federação das Indústrias do
   Pará (ver linha 3 do screenshot `02-desktop-light-filtrado.png`).
2. **Exportação bruta como fonte primária, não recurso escondido.** Os
   CSVs do 538 (`president_polls.csv` etc.) são a fonte oficial dos
   dados, publicados e versionados no GitHub — exportação não é um
   extra de UI, é o produto. Aqui o CSV (`Baixar CSV`) é bem feito (ver
   §2), mas é gerado só no cliente a partir do que já está filtrado na
   tela; não há um dump completo e estável linkável para quem quer os
   238 registros brutos sem passar pela UI.

---

## 2. Veredito binário por peça

| Peça | Veredito | Justificativa curta |
|---|---|---|
| **Filtros** | **PASSA, com ressalva** | Cargo/UF/Instituto/Turno/busca/checkbox todos recalculam o contador e a tabela corretamente e batem, um a um, contra filtragem manual de `data/polls.json` (SP+Quaest → 3/3, RJ → 8/8, busca "Datafolha" → 23/23, replicando a lógica exata de `semAcento`/`pesquisaCasaComBusca`). Ressalva: o `<select>` de Instituto lista sempre os 27 institutos globais, nunca cruzado com a UF já selecionada — ver bug P2. |
| **Tabela** | **PASSA** | Ordenação por Data de campo (chave real = `dataFim ?? publicadoEm ?? dataInicio`), Instituto e UF verificada por script contra os 238 registros nas duas direções (asc/desc) — **zero violações de ordem** em qualquer das 4 combinações testadas. `aria-sort` correto no `<th>` ativo. 14 colunas no `<thead>` = `NUM_COLUNAS_TABELA` (colspan da linha de detalhes bate). |
| **Detalhes** | **PASSA** | O botão "Detalhes" testado com `element.click()` nativo (sem a ação de "scroll into view" que o Playwright injeta antes de simular clique de usuário) **não move `.db-table-wrap.scrollLeft`** (400 → 400, isolado e reproduzido). O comentário no código (linhas 453-463 de `polls-database-view.ts`) sobre o bug antigo do `<details>` está correto e o fix se sustenta sob teste direto de DOM, não só screenshot. |
| **CSV** | **PASSA** | BOM UTF-8 presente nos **bytes crus** do Blob (`EF BB BF` confirmados via `arrayBuffer()` — checar só com `.blob.text()` dá falso negativo, porque `TextDecoder` por padrão descarta o BOM ao decodificar; documentando isso para não repetir o erro). Cabeçalho de 17 colunas bate com `CABECALHO_CSV`. Contagem de linhas = contagem de pesquisas filtradas em 2 cenários testados (238 sem filtro → 239 linhas; RJ → 8 pesquisas → 9 linhas, 100% das linhas com `uf === "RJ"`). Escapamento RFC 4180 correto (`csvCampo`). |
| **Mobile (400px)** | **FALHA** | Sem overflow horizontal de página (`document.documentElement.scrollWidth === window.innerWidth === 400`), cards com rótulo à esquerda funcionam. Mas **36% dos nomes de candidatos em "Principais colocados" são cortados por `text-overflow: ellipsis`** em 400px (199 de 553 nomes testados, ver bug P1) — informação apagada, não só apertada. |
| **Acessibilidade** | **FALHA** | `rel="noopener noreferrer"` + `target="_blank"` + aviso `sr-only` "(abre em nova aba)" corretos nos links de fonte; `aria-live="polite"` no contador; `aria-expanded`/`aria-controls` corretos no botão Detalhes; ordem de tabulação lógica (nav → Cargo → UF → Instituto → Turno → busca → tabela) com anel de foco (`box-shadow`) visível em todo elemento testado (12/12). Mas o selo "SEM REGISTRO" — o único sinal visual do dado mais editorialmente sensível da base (44 das 238 pesquisas) — tem **contraste de 3.25:1**, abaixo do mínimo de 4.5:1 do WCAG AA para texto normal (ver bug P1). |

---

## 3. Bugs objetivos por prioridade

### P1 — Nomes de candidatos cortados em "Principais colocados" no mobile

- **Onde**: `src/adapters/inbound/web/styles/polls-database.css`, regra
  `.db-top3-nome` (linhas 257-264): `overflow: hidden; text-overflow:
  ellipsis; white-space: nowrap`. O bloco responsivo
  `@media (max-width: 640px)` (linhas 377-448) não sobrescreve essa
  regra para o card mobile.
- **Evidência de DOM**: em viewport 400×800, `document.querySelectorAll('.db-top3-nome')`
  → 553 elementos testados, **199 com `scrollWidth > clientWidth`**
  (36%), ex.: `"José Roberto Arruda"` → `scrollWidth: 127`,
  `clientWidth: 113`, renderiza como "José Roberto Ar…" (ver
  `docs/screenshots/revisao-pesquisas/07-mobile-light-detalhes.png`). Em
  1280px a mesma consulta dá **0 de 553** cortados — bug exclusivo do
  layout de cards.
- **Por que importa**: é justamente o dado mais olhado da linha (quem
  está na frente); no bloco "Detalhes" expandido (`.db-detalhes-nome`,
  sem a regra de ellipsis) o mesmo nome aparece inteiro alguns pixels
  abaixo — a UI já sabe mostrar o nome completo, só não faz isso no
  resumo do card.

### P1 — Contraste insuficiente no selo "SEM REGISTRO"

- **Onde**: `polls-database.css`, `.db-selo-sem-registro` (linhas
  231-235): `color: var(--color-text-tertiary)` sobre fundo
  transparente/branco.
- **Evidência de DOM**: computado no Chromium, `color: rgb(138, 143,
  152)` sobre fundo efetivo branco → **razão de contraste 3.25:1**
  (calculado via fórmula WCAG de luminância relativa). O mínimo AA para
  texto normal é 4.5:1; mesmo pela exceção de "texto grande" (3:1) o
  selo não se qualifica — a fonte é `--text-eyebrow`, tipicamente
  pequena.
- **Por que importa**: 44 das 238 pesquisas (linha "Sem registro TSE" no
  cabeçalho) dependem desse selo como único sinal — é precisamente a
  marcação de irregularidade formal perante o TSE, o tipo de informação
  que uma base de pesquisas eleitorais não pode deixar pouco legível.

### P2 — Filtros de UF e Instituto não são cruzados entre si

- **Onde**: `polls-database-view.ts`, `criarBarraFiltros` (linhas
  308-327): o `<select>` de Instituto é sempre populado com
  `base.institutos` (lista global de 27), independente do valor atual
  de `filtros.uf`.
- **Evidência de DOM**: com UF="SP" selecionado, o `<select>` de
  Instituto ainda lista as 27 opções completas (incluindo "Alfa
  Inteligência", que não tem nenhuma pesquisa em SP); escolher essa
  combinação produz corretamente "0 de 238 pesquisas" — o contador e o
  estado vazio funcionam — mas nada no filtro avisa de antemão que a
  combinação é impossível. SP tem só 4 institutos com dado (Datafolha,
  Paraná Pesquisas, Quaest, AtlasIntel), então 23 das 27 opções do
  segundo `<select>`, uma vez UF=SP já escolhido, levam a zero
  resultado.
- **Por que importa**: é exatamente o tipo de refinamento que o dataset
  do 538 sustenta bem — com `state` e `pollster` como colunas
  independentes mas o produto final tipicamente restringe as opções
  ativas ao cruzamento; aqui os dois filtros da mesma tela agem como se
  fossem de tabelas diferentes.

### P3 — 404 de `favicon.ico` no console (fora do escopo desta tela)

- **Onde**: `index.html` não declara `<link rel="icon">`; não há
  `public/favicon.ico`. `curl http://localhost:4197/favicon.ico` → 404,
  reproduzido também como `console.error` no Chromium.
- **Por que é P3**: acontece em qualquer rota do site, não é
  específico de `#/pesquisas`; não afeta função nem dado. Registrado só
  porque apareceu nos logs de console durante a auditoria.

---

## 4. A única maior lacuna

**A base não tem nenhum sinal de qualidade/metodologia do instituto —
nem nota de confiabilidade, nem tipo de amostra (adultos/eleitores
registrados/prováveis eleitores), nem indicação de metodologia
(telefone/painel online/etc.).** Isso não é uma ausência de UI: é
ausência no **modelo de dados** (`DadosPesquisa`/`Pesquisa` em
`src/domain/poll.ts` não tem nenhum campo desse tipo), então não há como
adicionar isso só na view. A base sabe dizer que uma pesquisa está "sem
registro" no TSE (irregularidade formal, 44 casos) mas não sabe dizer se
o instituto que a fez tem histórico de acerto ou é desconhecido — a
pergunta que mais importa para decidir quanto peso dar a um número (35%
vs. 40% para o mesmo cargo, institutos diferentes, mesma semana) fica sem
resposta em toda a tela. Essa é justamente a função que torna a base do
538 uma referência de jornalismo de dados e não só uma lista de números:
ela deixa explícito, linha a linha, o quanto confiar naquele número.

---

## Screenshots (`docs/screenshots/revisao-pesquisas/`)

| Arquivo | Cenário |
|---|---|
| `01-desktop-light-inicial.png` | 1280×800, claro, sem filtros, estado inicial |
| `02-desktop-light-filtrado.png` | 1280×800, claro, UF=SP + Instituto=Quaest (3 de 238) |
| `03-desktop-light-detalhes.png` | 1280×800, claro, linha de Detalhes expandida (sem scroll horizontal) |
| `04-desktop-light-busca.png` | 1280×800, claro, busca por texto "Datafolha" (23 de 238) |
| `05-desktop-dark-inicial.png` | 1280×800, escuro, estado inicial |
| `06-mobile-light-inicial.png` | 400×800, claro, cards mobile |
| `07-mobile-light-detalhes.png` | 400×800, claro, card com Detalhes expandido (evidência do corte de nome) |
| `08-mobile-dark-filtrado.png` | 400×800, escuro, UF=RJ filtrado |
