# Crítica de UI — `#/inicio` (home-view.ts + home.css)

Data da crítica: 2026-09-14. Barra: home de eleições do NYT 2024 / FiveThirtyEight 2024 (ver
`docs/ux-spec.md` §1). Build de produção (`npm run build` + `vite preview --port 4186`), Chromium via
playwright-core, screenshots em `docs/screenshots/critica-inicio/`:
`dark-1280x800.png`, `dark-400x800.png`, `light-1280x800.png`. `document.documentElement.scrollWidth`
em 400px = 400 = `clientWidth` nas três capturas — **sem scroll horizontal**. Console: um único erro,
`ERR_CONNECTION_RESET` em `fonts.googleapis.com` — bloqueio de rede do ambiente de teste (fallback de
`--font-sans` cobre isso), não é bug da aplicação.

## Bug de conteúdo (fora de escopo de código, só reporto)
- **`data/meta.json` desatualizado**: `atualizadoEm: "2026-09-13"`, hoje é 2026-09-14. O hero exibe
  "Atualizado em 13/09/2026" com a promessa textual "atualizado todo dia" na lede — a página está,
  neste momento, quebrando a própria promessa. Isso é pipeline/dado, não UI; não editei nada.

## Bugs objetivos novos (por prioridade)

**P0 — Cards de "Últimas pesquisas" ambíguos/parecem duplicados (sem rótulo de turno)**
`rotuloDisputa()` (home-view.ts:151-155) só mostra `Cargo · UF`, nunca o turno. Isso produz pares de
cards adjacentes na grade que parecem a mesma pesquisa duplicada com números diferentes:
- "10/09/2026 · Presidente · RJ · Datafolha · TSE BR-01833/2026" aparece **duas vezes** seguidas: uma
  com Flávio Bolsonaro 39,0%/Lula 35,0%, outra com 49,0%/41,0% — são 1º e 2º turno da mesma pesquisa
  (`2026-09-11-datafolha-rj-presidente-t1` / `-t2`, confirmado em `data/polls.json`), mas nada no card
  distingue os dois turnos.
- Mesmo padrão em "Governador · SP" (Datafolha 49,0%/29,0% vs. Paraná Pesquisas 49,7%/34,5% — aqui os
  institutos diferem, então é menos grave, mas ainda são dois cards quase idênticos lado a lado sem
  nada que ajude a diferenciá-los rapidamente além do nome do instituto).
O hero já resolve isso corretamente ("Presidente — 1º turno"); a grade de últimas pesquisas não usa o
mesmo padrão. Consequência prática: um leitor apressado lê os dois cards de RJ como "o site mostra o
mesmo dado duas vezes com números diferentes" — exatamente o tipo de falha de confiança que a barra
(NYT/538) evita ao rotular sempre com precisão qual corrida/cenário está sendo mostrado.

**P1 — Alvos de toque abaixo do mínimo recomendado no mobile (400px)**
Medido via `getBoundingClientRect()` em viewport 400×800:
- `.hm-link-fonte` ("Fonte" em cada card): **34×17px**.
- `.hm-section__link` ("Ver todas →"): **76×20px**.
- `.btn` / `.btn--primario` (hero "Ver o mapa" / "Presidente"): **120×41px** (altura abaixo de 44px).
Bem abaixo do alvo de 44×44px recomendado (WCAG 2.5.5 / mobile HIG). O link "Fonte" fica colado ao
texto "TSE ..." no rodapé do card com pouco respiro — risco real de toque errado em tela pequena.

**P2 — Redundância do "Atualizado em" dentro do próprio hero**
`construirHero()` (home-view.ts:265-267) repete a pill "Atualizado em {data}" poucos px abaixo do
cabeçalho global, que já mostra a mesma frase (`main.ts:76`). Não é incorreto, mas é uma repetição
literal da mesma string a poucas centenas de pixels de distância — a barra normalmente varia a forma
(cabeçalho: "Last updated Sep 14, 5:32 PM ET"; corpo: nota metodológica), não repete o texto idêntico.

**P3 — "Como funciona" usa um termo estatístico sem glosa**
Passo "Agregação" (home-view.ts:428-431): "peso maior para pesquisas recentes (meia-vida de 14 dias)"
— "meia-vida" é jargão estatístico não explicado in-line (a nota de "Transparência" logo abaixo é
clara, mas não cobre esse termo específico). Pequeno, mas é exatamente o tipo de termo que o critério
"sem jargão técnico desnecessário" pede para evitar ou explicar em uma frase.

## O que funciona (não é elogio gratuito — testado)
- Títulos truncados por CSS (`hm-poll-card__candidato-nome`, ellipsis) **sempre** têm `title` com o
  nome completo — testado nos 20 primeiros nomes renderizados; 3 estavam de fato truncados
  ("Tarcísio de Freitas", "Cleitinho Azevedo") e todos com `title` correto. Nenhum bug aqui.
- Os 2 links testados (`hero "Ver o mapa"` → `#/mapa`; explore card "Presidente" → `#/presidente`;
  também testei "Partidos" → `#/partidos`) navegam corretamente — sem link quebrado.
- Tema claro replica a hierarquia do escuro sem perda de contraste aparente; badges de partido usam
  os tokens `-solid` (contraste ≥ 4,5:1 documentado em `design-system.md`), independentes de tema.
- Mobile mantém a hierarquia (hero → resumo → últimas pesquisas → atalhos → como funciona → créditos)
  e a grade de pesquisas colapsa para 1 coluna sem cortar texto nem estourar largura.

## Veredito por seção (binário: "a barra vence" / "o nosso vence")

| Seção | Veredito | Maior lacuna |
|---|---|---|
| Hero | **A barra vence** | Data "Atualizado em" desatualizada (13/09 vs. hoje 14/09) contradiz a própria promessa textual "atualizado todo dia" — falha de credibilidade que a barra nunca deixaria visível. |
| Resumo do dia | **O nosso vence** | Os 3 números são autoexplicativos e completos, mas nenhum deles diz em quantas pesquisas se baseia (a barra sempre ancora um número agregado a uma contagem de fontes por perto). |
| Últimas pesquisas | **A barra vence** | Cards de mesma data/UF/instituto/registro TSE sem rótulo de turno parecem duplicatas com números divergentes (caso concreto: RJ Presidente, ver P0). |
| Atalhos ("o que você encontra aqui") | **O nosso vence** | Links testados funcionam e cada card tem uma estatística concreta; falta qualquer prévia visual (mapa em miniatura, por exemplo) — é uma grade de texto, não uma vitrine editorial. |
| Como funciona | **O nosso vence** | Passos numerados e a nota de transparência são claros; "meia-vida" fica sem glosa de uma frase (P3). |
| Fontes e créditos | **O nosso vence** | Lista institutos, atribui o mapa e o eleitorado às fontes certas; nada a apontar como lacuna objetiva. |
| Mobile | **A barra vence** | Alvos de toque abaixo de 44px em "Fonte", "Ver todas →" e botões do hero (P1) — a barra nunca publicaria um link de 34×17px como único caminho até a fonte de uma pesquisa. |

## Veredito final

**Pronto para publicar: NÃO.**

Motivo: P0 (cards ambíguos de turno) é um problema de legibilidade editorial genuíno, reproduzível com
dados reais de produção, exatamente na seção que mais precisa de clareza factual num site de dados
eleitorais. Some-se a isso a data desatualizada no hero (bug de conteúdo, mas com efeito direto na
seção mais visível da página) e os alvos de toque fora do padrão no mobile. Nenhum dos três exige
redesenho — são consertos localizados (adicionar turno ao rótulo do card, corrigir `meta.json`,
aumentar padding de `.hm-link-fonte` / `.hm-section__link` / `.btn`) — mas nenhum foi corrigido aqui,
conforme instrução de não editar código.
