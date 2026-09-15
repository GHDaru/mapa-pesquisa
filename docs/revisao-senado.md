# Revisão dura — `#/senado`

Escopo: `src/adapters/inbound/web/views/senate-view.ts` (a página real fica em
`src/adapters/inbound/web/views/`, não em `views/` na raiz), `styles/views.css`.
Barra de qualidade: FiveThirtyEight *2024 Senate forecast* e NYT
*"Senate results 2024"*.

## Aviso de acesso — leia antes do resto

`WebFetch` para `projects.fivethirtyeight.com` retornou `EGRESS_BLOCKED` (proxy
de rede bloqueia o domínio) e para `nytimes.com`/`web.archive.org` retornou
"unable to fetch". `WebSearch` não trouxe nenhum detalhe visual específico
dessas páginas (só resultados genéricos sobre o resultado da eleição de 2024).
Não tive acesso ao vivo, direto, a nenhuma das duas páginas nesta sessão.

O que segue como "a barra" vem de (a) `docs/ux-spec.md` §1, que já descreve as
duas páginas em termos concretos e testáveis (barra segmentada de 100 células,
marca em 51, selo "Called by The Times", etc.) e que os autores deste projeto
declaram ter usado como referência, e (b) conhecimento geral, não verificado
nesta sessão, de como essas duas páginas historicamente conhecidas são
montadas. Trato (b) como memória, não como observação — qualquer afirmação
abaixo sobre "o NYT faz X" é rastreável a (a) ou está marcada como tal.

Todo o resto deste documento (hemiciclo, painel, tabela, mobile,
acessibilidade, bugs) é observação direta: build real, servidor real,
Playwright real contra `http://localhost:4195/#/senado`, DOM lido, dados brutos
de `data/senate-seats.json` e `data/polls.json` cruzados manualmente.

Screenshots em `docs/screenshots/revisao-senado/` (10 arquivos, ver lista no
fim). Auditoria DOM completa em
`docs/screenshots/revisao-senado/dom-audit.json`.

---

## 1. O que a barra faz melhor (concreto)

1. **Número grande do balanço de poder.** A barra do NYT mostra, ladeando a
   barra de 100 células, um número grande de cada lado ("53" / "45") — o
   resultado agregado é a primeira coisa que o olho encontra. Aqui o card
   "Totais por espectro" existe, mas fica **abaixo** do hemiciclo, em texto do
   mesmo tamanho dos demais números da página; não há nenhum número grande
   "XX de 81" nem "faltam N para 41" perto do próprio desenho — só a linha
   fina "41 para maioria" (`.pv-majority-label`, `text-caption`).
2. **Selo de confiança por corrida, sempre visível.** O NYT usa um selo
   textual ("Called by The Times" / não chamada) ao lado de cada corrida na
   lista, redundante com a cor. Aqui a confiança da projeção (`folga` /
   `acirrada` / `empate`) só vira texto no `aria-label`/`title` do assento
   (tooltip) e, na tabela "Senadores por estado", só quando é `empate` (selo
   "EMPATE TÉCNICO" via `criarSeloEmpateTecnico`) — **não existe selo para
   "lidera com folga" / "lidera, corrida acirrada" na tabela**, só no
   painel/tooltip do assento. Quem só lê a tabela perde essa informação.
3. **Cadeira não disputada tem "accent visual diferente" desde a lista, não só
   no hemiciclo.** Segundo ux-spec §1.2, o NYT marca discretamente, na própria
   lista de corridas, a cadeira que não estava em disputa naquele ciclo. Aqui
   isso existe na tabela (coluna "Cadeira fixa (até 2031)" é uma coluna
   separada), o que na prática **é melhor** que o texto da spec sugere — ponto
   a favor da implementação, registrado para honestidade.
4. **Ordenação por "mais disputada" por padrão.** Segundo a spec, o NYT
   ordena a lista de corridas por "mais disputada" por padrão. Aqui a tabela
   abre ordenada por UF (alfabética) — quem quer ver as corridas apertadas
   primeiro precisa trocar manualmente para "Espectro projetado", que
   **agrupa por bloco ideológico, não por margem** (não existe ordenação por
   "mais apertada").

---

## 2. Veredito binário por peça

| Peça | Veredito | Justificativa curta |
|---|---|---|
| **Hemiciclo** | **PASSA** | 81 assentos, marcador de maioria com linha + rótulo textual em 41, fixa vs. projetada distinguíveis por traço (não só cor), hachura para indefinida, esmaecimento no filtro, teclado completo. Ressalva de legibilidade no item 3 dos bugs (P1). |
| **Totais (bancadas/espectro)** | **PASSA** | Somas batem com o total de assentos nos dois modos (81 = 11+9+11+1+13+36 na projeção; 81 = 10+9+12+1+21+28 na composição atual), barras fixa+projetada com `sr-only` explicando a composição, `tabular-nums`. |
| **Painel da UF** | **FALHA** | Mostra número (%) errado atrelado ao candidato errado em pelo menos 8 das 27 UFs — ver bug P0. Um painel que inventa quem lidera não passa, por melhor que seja o resto (foco, `Esc`, `role=dialog`). |
| **Tabela "Senadores por estado"** | **FALHA** | Mesmo bug do painel se propaga para a coluna "Projetados 2027" nas mesmas UFs — confirmado ao vivo nas linhas `#senado-tabela-linha-{AP,RS,MT,DF,PE,RN,SE,TO}`. Ordenação e virada em cards funcionam (ver §item mobile), mas a peça central — os dados — está errada. |
| **Mobile 400px** | **PASSA** | `document.body.scrollWidth === window.innerWidth === 400` nos dois temas (sem overflow horizontal); hemiciclo escala por `viewBox`; tabela vira cards rótulo/valor; `<thead>` some (`display:none`) e `.pv-sort-select-wrap` aparece (`display:flex`) exatamente no breakpoint de 400px. |
| **Acessibilidade (mecânica)** | **PASSA** | 81/81 assentos com `aria-label` (0 sem rótulo nos dois modos/temas); `role="group"` no `<svg>` com contagem+maioria; assentos clicáveis com `role="button"` + `aria-haspopup="dialog"`, não-clicáveis com `role="img"`; `Enter`/`Espaço` abre o painel; `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; *focus trap* testado (15 `Tab` seguidos sem sair de `.state-panel`); `Esc` fecha e devolve foco exato ao `<circle>` de origem; contraste de texto ≥ 4.5:1 nos dois temas (título 19:1/19.6:1, meta/explainer 5.77:1/6.42:1, texto branco sobre os 6 tons de badge de espectro entre 5.0:1 e 8.2:1). Ressalva: a mecânica está correta, mas para as 8 UFs do bug P0 ela expõe fielmente, via `aria`/texto, um dado que é factualmente errado — acessível não é o mesmo que verdadeiro. |

---

## 3. Bugs objetivos por prioridade

### P0 — troca de candidato × percentual na projeção por UF (dado, não estilo)

**O quê:** para as UFs onde o 1º e o 2º colocados das pesquisas de senador têm
espectros políticos diferentes, o site atribui o percentual de um candidato ao
nome do outro — inverte quem "lidera" e pode disparar (ou esconder) o selo
"EMPATE TÉCNICO" na pessoa errada.

**Evidência concreta (RS), cruzada com o dado bruto:**

`data/polls.json` (única pesquisa de senador para RS, `dataFim: 2026-09-09`):
```json
{ "candidato": "Marcel Van Hattem", "partido": "Novo", "pct": 22 },
{ "candidato": "Manuela D'Ávila",   "partido": "PSOL", "pct": 18 }
```

DOM ao vivo, `#senado-tabela-linha-RS` (e idem no painel da UF, mesmo texto):
```
Manuela D'Ávila PSOL (Esquerda) 22,0% EMPATE TÉCNICO
Marcel Van Hattem Novo (Direita) 18,0%
```

Os números foram trocados: quem tem 22% no dado bruto (Van Hattem) aparece na
tela como se tivesse 18%, e vice-versa — e o selo "EMPATE TÉCNICO" acaba preso
ao nome errado.

**Escopo confirmado:** reproduzi o mesmo padrão programaticamente contra
`data/senate-seats.json` + `data/polls.json` + `data/parties.json` (o par
top-2 é reordenado por espectro sempre que os dois primeiros colocados caem em
blocos ideológicos diferentes) e confirmei ao vivo, lendo o DOM real da
tabela, em **8 das 27 UFs**: `AP, DF, MT, PE, RN, RS, SE, TO`. Exemplo
adicional (`#senado-tabela-linha-MT`): dado bruto tem Mauro Mendes (União)
27% / Janaína Riva (MDB) 26%; tela mostra "Janaina Riva MDB 27,0% / Mauro
Mendes União Brasil 26,0% EMPATE TÉCNICO" — mesmo padrão de troca.

**Causa raiz (arquivo/linha):**
`src/application/use-cases/get-senate-by-state.ts:71-78`
```ts
const assentosProjetados = projecao.assentos.filter((a) => a.uf === uf && a.origem === 'projetada');
const projetadas: CandidatoProjetadoResumo[] = assentosProjetados.map((assento, i) => ({
  candidato: assento.ocupante ?? agregado?.candidatos[i]?.candidato ?? '',
  partido: assento.partido,
  pct: agregado?.candidatos[i]?.pct ?? 0,   // <- índice errado
  confianca: assento.confianca,
}));
```
`assentosProjetados` vem de `projecao.assentos`, que `projetarSenado` (em
`src/domain/senate.ts:183-187`) **ordena globalmente por espectro** antes de
devolver (é o array usado para desenhar o hemiciclo esquerda→direita):
```ts
assentos.sort((a, b) => {
  const diff = posicaoHemiciclo(a.espectro) - posicaoHemiciclo(b.espectro);
  ...
});
```
Já `agregado.candidatos` (em `src/domain/aggregate.ts:198`) está ordenado por
`pct` descendente: `candidatos.sort((a, b) => b.pct - a.pct)`. O código em
`get-senate-by-state.ts` faz *zip* dos dois arrays pelo mesmo índice `i`
assumindo que estão na mesma ordem — o que só é verdade quando o 1º e o 2º
colocados têm o mesmo espectro. Quando divergem (comum: um candidato de
direita e um de esquerda disputando as 2 vagas), o `sort` por espectro
reordena um array e não o outro, e o `pct` migra para o nome errado.

**Importante — o que NÃO está quebrado:** a contagem de cadeiras por partido/
espectro, o cálculo de maioria e a classificação de confiança (`folga` /
`acirrada` / `empate`) em si usam a `vantagem` calculada **dentro** de
`projetarSenado` (correta, antes do `sort`), então o *hemiciclo* e os cards de
totais continuam matematicamente corretos. O bug é isolado ao par
nome-visível × percentual-visível em `SenadoUf.projetadas`, consumido pelo
painel (`abrirPainelSenado`/`criarLinhasCadeirasEmDisputa`) e pela tabela
(`criarCelulaProjetados`).

**Impacto:** o site afirma, para quase 1/3 das UFs, um resultado de pesquisa
que não existe nos dados — o tipo de erro que uma barra de qualidade como
NYT/538 (cujo produto inteiro é a fidelidade do número) nunca deixaria passar.

---

### P1 — pareamento "Hoje" × "Projeção" na UF não tem garantia de correspondência por vaga

`criarLinhasCadeirasEmDisputa` (`senate-view.ts:470-495`) zipa
`dados.cadeirasAtuaisEmDisputa[i]` (ordem = ordem bruta de
`data/senate-seats.json`) com `dados.projetadas[i]` (ordem pós-`sort` por
espectro, ver P0) só pelo índice — não há nenhuma chave que amarre "esta
projeção é da vaga que hoje pertence a este titular". Mesmo corrigindo o pct
do P0, o efeito visual "Hoje: X → Projeção: Y" pode seguir juntando titular e
projeção de vagas diferentes dentro da mesma UF, porque as duas vagas de uma
UF não têm identidade própria nos dados (`CadeiraSenado` não tem um id de
vaga, só `uf` + `emDisputa2026`).

---

### P1 — distinção fixa/projetada por traço é ilegível em escala normal

`.pv-assento.pv-origem-fixa { stroke: #fff; stroke-width: 1.5 }` vs.
`.pv-assento.pv-origem-projetada { stroke-dasharray: 2 2; stroke-width: 1 }`
(`styles/views.css:496-497`), em círculos de raio `SEAT_R = 9`px
(`senate-view.ts:166`), dentro de um SVG limitado a `max-width: 640px`
(`.pv-hemiciclo-wrap svg`, `styles/views.css:484`). Cortei e ampliei 3× um
trecho do hemiciclo (`docs/screenshots/revisao-senado/crop-seat-zoom.png`,
gerado a partir de `senado-light-1280-painel-viewport.png`): só nessa ampliação
o contorno tracejado vira visivelmente "serrilhado" contra o sólido liso. No
screenshot em tamanho real (`senado-light-1280.png`, `senado-dark-1280.png`)
a diferença de 0,5px de `stroke-width` e um `dasharray` de 2px é, na prática,
imperceptível sem zoom — a única distinção não-cromática confiável a olho nu
acaba sendo a hachura de "indefinida" (bem mais grossa) e o esmaecimento do
filtro, não fixa-vs-projetada.

Observação honesta: com o dataset atual **nenhuma cadeira caiu em
"indefinida"** (`seatOrigins` em todas as capturas: `{projetada: 54, fixa:
27}`, nunca `indefinida`), então o padrão de hachura não pôde ser confirmado
visualmente nesta revisão — só por leitura de código
(`#pv-hachura-indefinida`, `senate-view.ts:243-258`).

---

### P2 — sem número agregado grande perto do hemiciclo

Já coberto no item 1 da comparação (§1.1) — rebaixado a P2 porque é uma
diferença de ênfase visual, não um erro de dado.

### P2 — rótulo "Projeção 2027" diverge do nome do modo em `docs/ux-spec.md`

`docs/ux-spec.md` §2(d) chama o modo de "Projeção 2026"; o código usa
"Projeção 2027" no botão e no `aria-label` de cada assento projetado
(`", projetada para 2027"`, `senate-view.ts:205`). Pode ser uma correção
deliberada (eleição em 2026, mandato novo começa em 2027), mas a spec não foi
atualizada para refletir isso — a documentação e a implementação divergem no
texto voltado ao usuário.

### P2 — ordenação da tabela por padrão é alfabética, não por corrida mais acirrada

Confirmado por interação real: `ordenarTabelaPor` inicial é `'uf'`
(`senate-view.ts:849`); a única alternativa (`'espectro'`) reordena por bloco
ideológico do líder, não por margem — não existe, em nenhum dos dois modos de
ordenação, uma opção "corrida mais apertada primeiro" como a referência do
NYT usa por padrão.

---

## 4. A ÚNICA maior lacuna

**A tela mostra números de pesquisa errados atrelados a candidatos errados em
quase um terço das UFs (8/27), tanto no painel quanto na tabela, com o selo
"EMPATE TÉCNICO" preso ao lado do nome trocado.** Todo o resto desta revisão —
layout do hemiciclo, contraste, teclado, responsividade — é secundário diante
disso: nenhuma comparação com NYT/538 importa se o produto mente sobre quem
está na frente. A causa é local e mecânica (`get-senate-by-state.ts:71-78`
zipando dois arrays com ordenações diferentes pelo mesmo índice `i`), então a
correção é pontual — mas até lá, o painel e a tabela do Senado não são
confiáveis como fonte de "quem lidera" para 8 estados.

---

## Evidência anexa

- `docs/screenshots/revisao-senado/dom-audit.json` — auditoria DOM completa
  (contagem de assentos, origens, `aria-label`s ausentes, marcador de
  maioria, legenda de confiança, colunas da tabela, `scrollWidth`, cores
  computadas, erros de console) para light/dark × 1280/400, projeção/atual/
  filtro SP/painel.
- `senado-light-1280.png`, `senado-dark-1280.png` — visão geral desktop,
  projeção, cada tema.
- `senado-light-1280-composicao-atual.png` — alternância "Composição atual".
- `senado-light-1280-filtro-sp.png` — filtro "Destacar UF" = SP, com
  destaque simultâneo no hemiciclo e na linha da tabela.
- `senado-light-1280-painel.png`, `senado-dark-1280-painel.png`,
  `senado-light-1280-painel-viewport.png` — painel da UF aberto (o último,
  sem `fullPage`, é o que comprova visualmente o backdrop escurecido, que some
  na captura `fullPage` por ser `position: fixed`).
- `crop-seat-zoom.png` — recorte 3× do hemiciclo evidenciando a diferença de
  traço sólido vs. tracejado.
- `senado-light-400.png`, `senado-dark-400.png` — mobile 400px, página
  completa.
- `senado-light-400-tabela.png` — tabela virada em cards no mobile.

Console do navegador: nenhum erro específico da tela de Senado nos dois
temas; o único erro capturado (`Failed to load resource: 404`) é o favicon
ausente do site inteiro, não relacionado a esta tela.
