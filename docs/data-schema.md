# Esquema de dados (contrato entre pesquisa e código)

Todos os arquivos ficam em `data/`. Datas em ISO `YYYY-MM-DD`. Percentuais como número (ex.: 32.5). UF em sigla maiúscula; `"BR"` para disputa nacional.

## data/polls.json
```json
[
  {
    "id": "2026-09-10-quaest-br-presidente-t1",
    "uf": "BR",
    "cargo": "presidente",
    "turno": 1,
    "instituto": "Quaest",
    "registroTSE": "BR-01234/2026",
    "contratante": "Genial",
    "dataInicio": "2026-09-05",
    "dataFim": "2026-09-09",
    "publicadoEm": "2026-09-10",
    "amostra": 2004,
    "margem": 2.0,
    "cenario": "estimulada, cenário 1",
    "fonte": { "nome": "Poder360", "url": "https://..." },
    "resultados": [
      { "candidato": "Nome", "partido": "PT", "pct": 32.5 },
      { "candidato": "Brancos/nulos", "partido": null, "pct": 10.0 },
      { "candidato": "Não sabe", "partido": null, "pct": 5.0 }
    ]
  }
]
```
`registroTSE` é obrigatório quando conhecido; se não encontrado, use `null` e explique em `observacao`.
`cargo` ∈ `presidente | governador | senador`.

## data/parties.json
```json
[
  { "sigla": "PT", "nome": "Partido dos Trabalhadores", "numero": 13,
    "espectro": "esquerda", "fonteClassificacao": "https://...", "observacao": "" }
]
```
`espectro` ∈ `esquerda | centro-esquerda | centro | centro-direita | direita`.

## data/senate-seats.json
Uma entrada por cadeira (81). Cadeiras eleitas em 2022 têm `mandatoFim: 2031` e `emDisputa2026: false`; as 54 eleitas em 2018 (mandato até 2027) têm `emDisputa2026: true`.
```json
[
  { "uf": "SP", "senador": "Marcos Pontes", "partido": "PL", "mandatoInicio": 2023, "mandatoFim": 2031,
    "emDisputa2026": false, "fonte": "https://www25.senado.leg.br/..." }
]
```
Para as 54 cadeiras em disputa, também preencher `senador` e `partido` atuais (ocupante hoje), pois o mapa "atual" precisa deles.

## data/electorate.json (eleitorado por UF)
```json
[
  { "uf": "SP", "eleitores": 34667793, "referencia": "2026-07", "fonte": { "nome": "TSE — Estatísticas do eleitorado", "url": "https://..." } }
]
```
27 entradas, uma por UF. `eleitores` é o número de eleitores aptos na referência mais recente do TSE para 2026 (ou, se indisponível, a mais recente publicada, com a data em `referencia`).

## Pesquisas presidenciais por estado
Mesmo esquema de `data/polls.json`, com `cargo: "presidente"` e `uf` igual à sigla do estado (não `BR`). Turno 1 e 2. Ficam em `data/research/polls-presidente-estados-*.json`.

## `data/apuracao.json` — apuração oficial

Arquivo da noite de eleição, consumido pela aba **Projeção**
(`#/projecao`). **Não** passa pela mesclagem de pesquisas
(`ingest/merge-research.ts`): é escrito direto.

```json
{
  "atualizadoEm": "2026-10-04T21:55:00Z",
  "recortes": [
    {
      "cargo": "presidente",
      "uf": null,
      "turno": 1,
      "secoesTotalizadas": 47.26,
      "validosTotal": 54749261,
      "candidatos": [
        { "candidato": "Flávio Bolsonaro", "partido": "PL", "votos": 27484298 }
      ],
      "brancos": null,
      "nulos": null,
      "abstencoes": null,
      "fonte": { "nome": "...", "url": "https://..." },
      "observacao": "..."
    }
  ]
}
```

Campos e as razões de cada um:

- `atualizadoEm` — instante da leitura, ISO 8601. **Obrigatório e crítico**: a
  página é estática e a apuração não. A tela calcula a defasagem contra o
  relógio do leitor e avisa quando a leitura envelheceu.
- `uf` — `null` (ou `"BR"`) para o recorte nacional; sigla de duas letras para
  estado. O código trata os dois casos de nacional.
- `secoesTotalizadas` — percentual de 0 a 100. É a medida da incerteza, e
  nenhum número da tela aparece sem ele ao lado. Ficha sem esse campo não
  serve.
- **`votos` em números absolutos.** É como a fonte oficial publica, e com
  absolutos o problema de "total vs votos válidos" que domina a ingestão de
  pesquisas desaparece: dá para calcular as duas bases sem converter nada.
- `validosTotal` — total de válidos da leitura, quando publicado ou derivável
  dos valores publicados. **É o denominador dos percentuais.** Sem ele o código
  divide pela soma dos candidatos da ficha, e como a cobertura raramente
  publica todos os candidatos, isso infla cada um: no recorte nacional de
  04/10, cujos quatro candidatos somam 97,17% dos válidos, o primeiro colocado
  subia de 50,2% (o que a fonte publica) para 51,7% — a tela contradizendo a
  fonte citada ao lado dela.
- `brancos`, `nulos`, `abstencoes` — opcionais, `null` quando não publicados.
  Nunca completados por estimativa.
- `fonte` e `observacao` — a `observacao` vai para a tela, não só para o
  arquivo: é onde fica dito, por exemplo, que um valor foi derivado de
  percentual em vez de publicado como voto absoluto.

### O que a projeção faz, e o que se recusa a fazer

A projeção é somada **por estado**, cada UF escalada pelo que falta totalizar
nela, e nunca por extrapolação do percentual nacional parcial — esse
percentual é enviesado pela ORDEM em que os estados totalizam, não pelo voto.

- UF sem apuração **não é completada** por pesquisa nem por média: fica fora e
  aparece nomeada em `ufsSemApuracao`.
- A projeção **não é chamada de nacional** quando cobre parte do eleitorado; a
  cobertura é declarada na tela.
- Quando existe só o recorte nacional e nenhum estadual, a tela **não projeta**:
  mostra a contagem parcial, dita como contagem, com os rótulos trocados para
  não prometer projeção.
- O único veredito emitido é aritmético (`matematicamenteDefinido`): a vantagem
  do líder excede o teto de tudo o que ainda pode ser contado, incluindo o
  eleitorado inteiro das UFs sem nenhuma apuração. A tela nunca usa "vencedor",
  "eleito" ou "ganhou" — há teste travando isso.
- A comparação com as pesquisas renormaliza o agregado para a base de válidos
  antes de subtrair. Sem isso o "erro das pesquisas" embutiria a fatia de
  brancos, nulos e indecisos, uns dez pontos.
