# Revisão UX — `#/partidos`

**Revisor:** auditoria automatizada (Playwright + leitura de DOM/CSS/dados), 2026-09-15.
**Build testado:** `npm run build` + `npx vite preview --port 4196`, Chromium local via proxy.
**Barra de comparação:** tabela "Partidos políticos do Brasil" da Wikipédia (pt) e tabela de candidatos/partidos do FiveThirtyEight 2024.

**Nota de acesso à rede (declarado, como pedido):** `WebFetch` para `pt.wikipedia.org`, `en.wikipedia.org`, `www.tse.jus.br` e `projects.fivethirtyeight.com` foi **bloqueado pelo proxy de saída** neste ambiente (`EGRESS_BLOCKED`) em todas as tentativas. Consegui ver conteúdo real da Wikipédia e de notícias sobre o TSE apenas via `WebSearch` (snippets/resumos, não a página renderizada). Para o FiveThirtyEight, `WebSearch` não retornou descrição do layout real da tabela — não vi a página do 538 diretamente nesta sessão, e qualquer comparação com o 538 abaixo é baseada em conhecimento geral de produto, marcada como tal.

---

## O que a barra faz melhor (concreto)

1. **Ordenação por qualquer coluna.** A tabela MediaWiki da Wikipédia é `sortable` nativamente — clicando em qualquer cabeçalho (Sigla, Nome, Fundação, Ideologia) ela reordena. Confirmado via `WebSearch` ("são sortable under other criteria present in the other columns"). A página em revisão só ordena por **Número** ou **Espectro** (`views/parties-view.ts`, tipo `OrdenarPor = 'numero' | 'espectro'`) — Sigla, Nome e Federação não são clicáveis. Isso é uma regressão de funcionalidade frente à própria fonte primária que a página cita como `fonteClassificacao`.
2. **Coluna de fundação (data de criação do partido).** A Wikipédia lista a data de fundação de cada partido; o cadastro em `data/parties.json`/`parties-view.ts` não tem esse campo em lugar nenhum — um usuário não consegue saber se está olhando um partido centenário (MDB) ou um partido com um ano de idade (Missão) sem sair da página.
3. **Ideologia multi-tag vs. eixo único.** A Wikipédia registra múltiplas correntes por partido (ex.: conservadorismo + liberalismo econômico + bolsonarismo) em vez de comprimir tudo num único eixo esquerda–direita de 5 pontos. A página em revisão força cada partido a um único rótulo de espectro — o que a própria página reconhece implicitamente ao usar `<details>/"Observação"` para explicar divergências (ver PDT, PSD, Podemos, PP), mas o dado exposto continua sendo um único valor categórico.

**O que a página faz melhor que a barra (para registrar, já que também é comparação):** cada linha tem um link individual clicável para a fonte da classificação (`fonteClassificacao` → `<a class="pv-link-fonte">`), algo que nem a Wikipédia nem tabelas de imprensa costumam oferecer por linha (a Wikipédia cita fontes agregadas em nota de rodapé geral, não por célula). O card de mobile sem scroll horizontal também é superior à experiência de uma tabela wiki larga em tela de 400px (que exige scroll lateral).

---

## Veredito binário por peça

| Peça | Veredito | Justificativa curta |
|---|---|---|
| Tabela (desktop) | **PASSA** | 31 linhas renderizadas, colunas corretas, ordenação funcional e `aria-sort` correto (ver Bugs #2 para ressalva de escopo) |
| Resumo por espectro | **PASSA** | `role="list"`/`listitem`, swatch + rótulo textual + contagem; soma 7+5+6+6+7 = 31, bate com o total |
| Mobile (400px) | **PASSA** | `thead` oculto, cards com `data-rotulo`, `scrollWidth` do documento = 400 = `innerWidth` (sem scroll horizontal) |
| Acessibilidade | **PASSA COM RESSALVA** | Foco visível funcional via teclado (`:focus-visible` + `box-shadow`), badges nunca dependem só de cor (swatch+texto+título), mas link "Ver fonte" falha AA de contraste no tema escuro (ver Bug #1) |
| Dados | **FALHA** | Dois achados concretos e checáveis: contagem de partidos incompatível com fontes públicas, e federação PSDB-Cidadania provavelmente extinta mas ainda listada como ativa sem ressalva |

---

## Bugs objetivos por prioridade

### P0 — Dados

**#1 — Cadastro tem 31 partidos; fontes públicas convergem para 30 (com o Missão) / 29 antes dele.**
- Arquivo: `data/parties.json` (31 objetos no array raiz, confirmado via leitura direta e contagem programática).
- Evidência: `WebSearch` retornou de forma consistente e cruzada:
  - TRE-CE, jul/2025: "No Brasil existem 29 partidos registrados na Justiça Eleitoral."
  - CNN Brasil / direitoce.com.br, nov/2025: Partido Missão é "**a 30ª legenda política do país**" ao ser registrado (04/11/2025).
  - Um resumo de `WebSearch` sobre a própria página da Wikipédia confirma: "Since November 2025, Brazil has **30** political parties registered."
- Nenhuma fonte encontrada relata 31 partidos com registro definitivo em qualquer momento até set/2026. Como `www.tse.jus.br` está bloqueado neste ambiente, não consegui apontar exatamente **qual** das 31 linhas é a sobra — mas o número total já é, por si, uma divergência objetiva e verificável contra três fontes independentes. Ação recomendada: cruzar as 31 siglas contra `www.tse.jus.br/partidos/partidos-registrados-no-tse` fora deste ambiente restrito.

**#2 — Federação PSDB-Cidadania listada como ativa sem ressalva, apesar de dissolução em andamento.**
- Arquivo: `data/parties.json`, objetos com `sigla: "PSDB"` (número 45) e `sigla: "Cidadania"` (número 23), campo `"federacao": "Federação PSDB-Cidadania"`, ambos sem `observacao` sobre o status da federação.
- Evidência (`WebSearch`):
  - Conselho Nacional do Cidadania votou **dissolver** a federação em 16/03/2025.
  - STF autorizou a dissolução antecipada da federação (antes do prazo mínimo de 4 anos) em 06/08/2025, na modulação da ADI 7021.
  - Protocolo formal de dissolução no TSE estava previsto para 2026.
- A data de referência da revisão é 15/09/2026 — ou seja, já dentro da janela em que o protocolo formal poderia ter sido efetivado. O dataset trata essa federação como um fato consolidado e atual, sem o mesmo cuidado de transparência que aplica em outras linhas (compare com PDT, PSD, Podemos, que têm `observacao` detalhando divergência entre fontes). Isso quebra o próprio padrão de rigor que o dataset estabelece para si.

### P1 — Acessibilidade

**#3 — Contraste do link "Ver fonte" abaixo do mínimo AA no tema escuro.**
- Arquivo/seletor: `src/adapters/inbound/web/styles/views.css` (`.pv-link-fonte`, `color: var(--color-accent)`), token em `src/adapters/inbound/web/styles/tokens.css:10` (`--color-accent: #5e6ad2`, `rgb(94,106,210)`).
- Medição real (computado via Playwright, fonte 13px normal, não é "texto grande" pela definição da WCAG):
  - Tema escuro: fundo `rgb(1,1,2)` vs. texto `rgb(94,106,210)` → **contraste 4.44:1** (abaixo do mínimo 4.5:1 do WCAG 2.1 AA 1.4.3 para texto normal).
  - Tema claro: mesmo token vs. fundo branco → 4.70:1 (passa, por pouco).
- É uma falha pequena em magnitude (0.06 abaixo do limite) mas objetiva e mensurável, e afeta o elemento mais repetido da tabela: o link de fonte aparece em todas as 31 linhas.

### P2 — Bug fora do escopo estrito da página, mas capturado durante a auditoria

**#4 — `favicon.ico` ausente → 404 no console em toda carga do app.**
- Arquivo: `index.html` (nenhum `<link rel="icon">` declarado).
- Evidência: toda navegação nova para `http://localhost:4196/#/partidos` gera `console.error` "Failed to load resource: 404" para `http://localhost:4196/favicon.ico` (confirmado em 2 de 2 execuções com navegador recém-lançado).
- Não é específico de `#/partidos` (é falha de nível de app), mas é o único erro de console que apareceu em toda a auditoria — registrado por completude.

---

## A única maior lacuna

**A camada de dados não tem processo de verificação de contagem/atualidade contra a fonte oficial (TSE), e isso já produziu uma divergência de contagem total (31 vs. 30/29 reportados por múltiplas fontes independentes) e pelo menos um dado provavelmente obsoleto (federação PSDB-Cidadania, em dissolução desde 2025).** A UI em si — tabela, resumo por espectro, responsividade, foco de teclado, badges com rótulo textual — está bem construída e em vários pontos (link de fonte por linha, ausência de scroll horizontal em 400px) supera a barra de comparação. Mas uma página cujo valor central é ser um cadastro de referência de partidos só vale o que valem os números nela — e os dois achados de dados acima (P0 #1 e #2) são exatamente o tipo de erro que essa página existe para evitar. Antes de qualquer melhoria de UI, o próximo passo deveria ser reconciliar as 31 linhas de `data/parties.json` contra a lista oficial do TSE, linha a linha.

---

## Evidência visual

Screenshots em `docs/screenshots/revisao-partidos/`:
- `1-desktop-dark.png` (1280×800, tema escuro, ordenação padrão por Número)
- `2-desktop-light.png` (1280×800, tema claro, ordenação padrão por Número)
- `3-mobile-dark.png` (400×800, tema escuro, cards)
- `4-mobile-light.png` (400×800, tema claro, cards)
