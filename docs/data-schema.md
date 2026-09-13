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
