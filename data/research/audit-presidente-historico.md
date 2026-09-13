# Auditoria — polls-presidente-historico.json

Data da auditoria: 2026-09-13. Método: WebSearch (WebFetch/curl bloqueados), ~43 buscas. Amostra: 14 pesquisas de 1º turno (cobrindo os 10 institutos presentes no arquivo e os 4 meses) + 4 de 2º turno (Quaest, PoderData, Datafolha, AtlasIntel). Para cada uma: (a) instituto/datas, (b) percentuais dos 2 primeiros colocados (tolerância 0,5 p.p.), (c) registro TSE, (d) existência da rodada específica (risco de confusão com outra rodada do mesmo instituto).

## Tabela de verificação

| id | (a) instituto/datas | (b) percentuais | (c) registro TSE | (d) rodada existe/não é confusão | Veredito |
|---|---|---|---|---|---|
| 2026-05-13-quaest-br-presidente-t1 | OK (campo 8–11/05, publ. 13/05) | OK (39,0/33,0) | OK (BR-03598/2026) | OK | Correto |
| 2026-05-13-quaest-br-presidente-t2-lula-flavio | OK | OK (42,0/41,0) | OK | OK | Correto |
| 2026-05-19-atlasintel-br-presidente-t1 | OK (campo 13–18/05, publ. 19/05) | OK (47,0/34,3) | Não encontrado (campo ficou null, correto) | OK — distinto da rodada suspensa de junho (BR-06939/2026), confirmada a suspensão pelo TSE em 08/06 | Correto |
| 2026-05-19-atlasintel-br-presidente-t2-lula-flavio | OK | OK (48,9/41,8) | Não encontrado (null, correto) | OK | Correto |
| 2026-06-10-quaest-br-presidente-t1 | OK (campo 5–8/06, publ. 10/06, quarta-feira) | OK (39,0/29,0) | OK (BR-07661/2026) | OK | Correto (fonte citada é sobre o 2º turno da mesma rodada; existe fonte melhor, ver correções) |
| 2026-06-10-quaest-br-presidente-t2-lula-flavio | OK | OK (44,0/38,0, "abre 6 pontos") | OK | OK | Correto |
| 2026-06-15-nexus-btg-br-presidente-t1 | OK (campo 12–14/06, publ. 15/06) | **ERRO**: JSON tem 40,0/34,0; fontes (CNN Brasil e página oficial da Nexus/FSB) dão 42,0/33,0 | OK (BR-06645/2026) | OK | **Corrigir** |
| 2026-06-15-nexus-btg-br-presidente-t2-lula-flavio | OK | OK (49,0/43,0, "1ª vez em 4 pesquisas que abre fora da margem") | OK | OK | Correto |
| 2026-06-20-datafolha-br-presidente-t1 | OK (campo 17–19/06; confirmado por Wikipédia e Gazeta do Povo) | OK (41,0/31,0) | Não encontrado (null, correto) | OK | Correto |
| 2026-06-20-datafolha-br-presidente-t2-lula-flavio | OK (dados batem com Wikipédia e são citados indiretamente pela matéria de 24/07 que compara "47 a 43 em junho") | OK (47,0/43,0) | Não encontrado (null, correto) | OK, mas **fonte.url errada**: aponta para uma matéria da Gulf News sobre uma pesquisa Datafolha de **2022** (campo 13–15/09/2022, 45%/33% e 54%/38%), sem relação com a rodada de junho/2026 | **Corrigir fonte** |
| 2026-07-01-atlasintel-br-presidente-t1 | OK (campo 26–30/06, publ. 01/07) | OK (45,0/36,0) | OK (BR-04582/2026) | OK | Correto |
| 2026-07-01-atlasintel-br-presidente-t2-lula-flavio | OK | OK (48,8/42,3) | OK | OK | Correto |
| 2026-07-21-real-time-big-data-br-presidente-t1 | OK (campo 18–20/07, publ. 21/07) | OK (40,0/33,0) | Registro encontrado agora: **BR-09247/2026** (JSON tem null) | OK | **Corrigir** (preencher registro) |
| 2026-07-21-real-time-big-data-br-presidente-t2-lula-flavio | OK | OK (45,0/42,0) | Idem acima, mesmo registro | OK | **Corrigir** (preencher registro) |
| 2026-07-30-poderdata-br-presidente-t1 | OK (campo 26–28/07, publ. 30/07) | OK (41,0/35,0, vantagem de 6 pontos) | OK (BR-07845/2026) | OK | Correto |
| 2026-07-30-poderdata-br-presidente-t2-flavio-lula | OK nas datas, mas o resultado atribuído a esta data **não existe em 30/07** | **ERRO GRAVE**: fontes mostram que em 30/07 o 2º turno era Lula 46,0 / Flávio 43,0 (Lula à frente, empate técnico); os números do JSON (Flávio 45,0/Lula 44,0) e a alegação de "1ª vez que Flávio aparece à frente" pertencem a uma pesquisa PoderData/Aya **de setembro** (campo 30/08–02/09, publ. ~03/09) | OK (mesmo registro do t1, mas indevidamente usado com dado de outra rodada) | **Corrigir** (maior problema encontrado) |
| 2026-07-08-meio-ideia-br-presidente-t1 | OK (campo 3–6/07, publ. 08/07) | OK (40,4/32,0) | **Faltando**: registro TSE encontrado = BR-05628/2026 (JSON tem null) | OK | **Corrigir** (preencher registro) |
| 2026-07-08-meio-ideia-br-presidente-t2-lula-flavio | OK nas datas | **ERRO**: fonte primária (Brasil de Fato, mesma matéria do t1) dá Lula 45,0/Flávio 40,0; o JSON tem 48,5/43,0, que pertence a outra rodada (a fonte citada, vídeo do Facebook "Hora H" da CNN, não é desta rodada de julho) | Idem, BR-05628/2026 | Existe, mas fonte/dados trocados | **Corrigir** |
| 2026-07-08-gerp-br-presidente-t1 | OK, confirmado por URL exata do Exame | OK (37,0/34,0) | OK (BR-03067/2026) | OK | Correto |
| 2026-07-08-gerp-br-presidente-t2-flavio-lula | OK, confirmado por URL exata da CNN Brasil | OK (47,0/42,0) | OK | OK | Correto |
| 2026-08-05-quaest-br-presidente-t1 | OK (registrado no TSE em 05/08, conforme fonte) | OK (39,0/30,0, vantagem de 9 pontos) | OK (BR-06591/2026) | OK — distinto da rodada de 14/08, confirmado | Correto |
| 2026-08-05-quaest-br-presidente-t2-lula-flavio | OK | OK (44,0/39,0) | OK | OK | Correto |
| 2026-08-11-gerp-br-presidente-t1 | OK (publ. 11/08) | OK (38,0/38,0, empate exato) | OK (BR-08045/2026) | OK | Correto |
| 2026-08-11-futura-inteligencia-br-presidente-t1 | OK (campo 3–7/08, publ. 11/08), confirmado por URL exata do Exame | OK (38,8/34,1) | OK (BR-08109/2026) | OK | Correto |
| 2026-08-11-cnt-mda-br-presidente-t1 | OK (campo 5–9/08, publ. 11/08) | OK (Lula 42,4; Flávio 28,7 confirmado diretamente pela fonte, não só por subtração) | Não encontrado nas buscas (null, correto) | OK | Correto |
| 2026-08-14-quaest-br-presidente-t1 | OK (publ. sexta 14/08) | OK (38,0/31,0) | OK (BR-06773/2026, inferido por consistência com o t2 confirmado) | OK | Correto |
| 2026-08-14-quaest-br-presidente-t2-lula-flavio | OK, confirmado por URL exata da Gazeta do Povo | OK (43,0/40,0) | OK | OK — distinto da rodada de 05/08, confirmado | Correto |

Total: 24 das 28 linhas (14 T1 + 4 T2 completos, com bônus de checagem cruzada nas contrapartes) sem erro; 6 linhas com correção necessária, nenhuma para remoção.

## Correções recomendadas

| id | campo | valor antigo | valor novo |
|---|---|---|---|
| 2026-06-15-nexus-btg-br-presidente-t1 | resultados[0].pct (Lula) | 39.0... na verdade 40.0 | 42.0 |
| 2026-06-15-nexus-btg-br-presidente-t1 | resultados[1].pct (Flávio Bolsonaro) | 34.0 | 33.0 |
| 2026-06-20-datafolha-br-presidente-t2-lula-flavio | fonte.url / fonte.nome | `https://gulfnews.com/.../lulas-lead-over-bolsonaro-edges-higher...` (matéria é de uma pesquisa Datafolha de **2022**) | Substituir por fonte de 2026 — ex.: `https://pt.wikipedia.org/wiki/Pesquisas_de_opini%C3%A3o_para_a_elei%C3%A7%C3%A3o_presidencial_no_Brasil_em_2026` (dados 47/43 confirmados também indiretamente pelo texto da matéria do USNews de 24/07/2026, que cita "a June survey showed Lula ahead by 47% to 43%") |
| 2026-07-21-real-time-big-data-br-presidente-t1 | registroTSE | null | "BR-09247/2026" |
| 2026-07-21-real-time-big-data-br-presidente-t2-lula-flavio | registroTSE | null | "BR-09247/2026" |
| 2026-07-30-poderdata-br-presidente-t2-flavio-lula | id | 2026-07-30-poderdata-br-presidente-t2-flavio-lula | 2026-07-30-poderdata-br-presidente-t2-lula-flavio |
| 2026-07-30-poderdata-br-presidente-t2-lula-flavio (após rename) | resultados[0] | {"candidato":"Flávio Bolsonaro","partido":"PL","pct":45.0} | {"candidato":"Luiz Inácio Lula da Silva","partido":"PT","pct":46.0} |
| 2026-07-30-poderdata-br-presidente-t2-lula-flavio | resultados[1] | {"candidato":"Luiz Inácio Lula da Silva","partido":"PT","pct":44.0} | {"candidato":"Flávio Bolsonaro","partido":"PL","pct":43.0} |
| 2026-07-30-poderdata-br-presidente-t2-lula-flavio | observacao | "Primeira vez, segundo a cobertura consultada, em que o PoderData/Aya mostrou Flávio numericamente à frente de Lula no 2º turno; diferença dentro da margem de erro." | Remover essa afirmação (é falsa para 30/07 — o marco de Flávio à frente pela 1ª vez ocorreu numa rodada PoderData/Aya de campo 30/08–02/09/2026, publicada por volta de 03/09, fora do período coberto por esta base). Substituir por: "Lula à frente por 3 pontos, dentro da margem de erro de 2 pontos (empate técnico)." |
| 2026-07-08-meio-ideia-br-presidente-t1 | registroTSE | null | "BR-05628/2026" |
| 2026-07-08-meio-ideia-br-presidente-t2-lula-flavio | registroTSE | null | "BR-05628/2026" |
| 2026-07-08-meio-ideia-br-presidente-t2-lula-flavio | resultados[0].pct (Lula) | 48.5 | 45.0 |
| 2026-07-08-meio-ideia-br-presidente-t2-lula-flavio | resultados[1].pct (Flávio Bolsonaro) | 43.0 | 40.0 |
| 2026-07-08-meio-ideia-br-presidente-t2-lula-flavio | fonte.url / fonte.nome | vídeo do Facebook (CNN Brasil "Hora H") com os números de outra rodada | `https://www.brasildefato.com.br/2026/07/08/pesquisa-meioideia-lula-lidera-cenarios-de-primeiro-e-segundo-turno-contra-flavio-bolsonaro-e-michelle/` (mesma matéria da linha t1, contém os dois cenários) |
| 2026-06-10-quaest-br-presidente-t1 | fonte.url (opcional, não é erro factual) | `congressoemfoco.com.br/noticia/119531` (matéria cujo título fala do 2º turno) | `https://www.cnnbrasil.com.br/eleicoes/quaest-lula-lidera-com-39-no-1o-turno-flavio-tem-29/` (fala diretamente do 1º turno desta rodada) |

## Remover

Nenhum id precisa ser removido. Todas as 18 pesquisas da amostra (mais as 4 contrapartes checadas por consistência) correspondem a rodadas reais e localizáveis — nenhuma se mostrou inexistente ou duplicata fabricada de outra rodada do mesmo instituto. O caso mais próximo de um "id que não deveria existir com esses dados" é `2026-07-30-poderdata-br-presidente-t2-flavio-lula`, mas a solução correta é corrigir os números (a rodada de 30/07 existe e tem 2º turno; os valores é que foram trocados com os de uma rodada de setembro) — ver tabela de correções.

## Pesquisas faltantes

Duas pesquisas relevantes de institutos citados no escopo (Datafolha, AtlasIntel) não aparecem na base e caem dentro do período maio–agosto/2026:

```json
[
  {
    "id": "2026-08-21-datafolha-br-presidente-t1",
    "uf": "BR",
    "cargo": "presidente",
    "turno": 1,
    "instituto": "Datafolha",
    "registroTSE": "BR-04496/2026",
    "contratante": "TV Globo e Folha de S.Paulo",
    "dataInicio": "2026-08-18",
    "dataFim": "2026-08-20",
    "publicadoEm": "2026-08-21",
    "amostra": 2058,
    "margem": 2.0,
    "cenario": "estimulada, cenário principal (1º turno)",
    "fonte": { "nome": "O Povo", "url": "https://www.opovo.com.br/noticias/politica/eleicoes/2026/08/21/pesquisa-datafolha-traz-lula-comm-39-e-flavio-bolsonaro-33.html" },
    "resultados": [
      { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 39.0 },
      { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 33.0 }
    ],
    "observacao": "Pesquisa ausente na base auditada; localizada via WebSearch em 13/09/2026. Confirmar candidatos adicionais/brancos/nulos na fonte original antes de publicar."
  },
  {
    "id": "2026-08-21-datafolha-br-presidente-t2-lula-flavio",
    "uf": "BR",
    "cargo": "presidente",
    "turno": 2,
    "instituto": "Datafolha",
    "registroTSE": "BR-04496/2026",
    "contratante": "TV Globo e Folha de S.Paulo",
    "dataInicio": "2026-08-18",
    "dataFim": "2026-08-20",
    "publicadoEm": "2026-08-21",
    "amostra": 2058,
    "margem": 2.0,
    "cenario": "estimulada, 2º turno: Lula x Flávio Bolsonaro",
    "fonte": { "nome": "Brasil de Fato", "url": "https://www.brasildefato.com.br/2026/08/21/datafolha-no-segundo-turno-lula-tem-47-flavio-bolsonaro-tem-43/" },
    "resultados": [
      { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 47.0 },
      { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 43.0 }
    ],
    "observacao": "Pesquisa ausente na base auditada; localizada via WebSearch em 13/09/2026."
  },
  {
    "id": "2026-08-31-atlasintel-br-presidente-t1",
    "uf": "BR",
    "cargo": "presidente",
    "turno": 1,
    "instituto": "AtlasIntel",
    "registroTSE": "BR-07972/2026",
    "contratante": "Bloomberg",
    "dataInicio": "2026-08-25",
    "dataFim": "2026-08-30",
    "publicadoEm": "2026-08-31",
    "amostra": 5014,
    "margem": 1.0,
    "cenario": "estimulada, cenário principal (1º turno)",
    "fonte": { "nome": "JOTA", "url": "https://www.jota.info/eleicoes/eleicoes-2026/atlasintel-bloomberg-lula-lidera-com-434-mas-recua-flavio-tem-337-no-primeiro-turno" },
    "resultados": [
      { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 43.4 },
      { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 33.7 },
      { "candidato": "Augusto Cury", "partido": null, "pct": 7.8 }
    ],
    "observacao": "Pesquisa ausente na base auditada; localizada via WebSearch em 13/09/2026. Partido de Augusto Cury não confirmado com segurança nesta busca."
  },
  {
    "id": "2026-08-31-atlasintel-br-presidente-t2-lula-flavio",
    "uf": "BR",
    "cargo": "presidente",
    "turno": 2,
    "instituto": "AtlasIntel",
    "registroTSE": "BR-07972/2026",
    "contratante": "Bloomberg",
    "dataInicio": "2026-08-25",
    "dataFim": "2026-08-30",
    "publicadoEm": "2026-08-31",
    "amostra": 5014,
    "margem": 1.0,
    "cenario": "estimulada, 2º turno: Lula x Flávio Bolsonaro",
    "fonte": { "nome": "Brasil de Fato", "url": "https://www.brasildefato.com.br/2026/08/31/atlasbloomberg-lula-tem-471-no-2o-turno-contra-426-de-flavio-bolsonaro/" },
    "resultados": [
      { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 47.1 },
      { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 42.6 }
    ],
    "observacao": "Pesquisa ausente na base auditada; localizada via WebSearch em 13/09/2026."
  },
  {
    "id": "2026-08-11-gerp-br-presidente-t2-flavio-lula",
    "uf": "BR",
    "cargo": "presidente",
    "turno": 2,
    "instituto": "Gerp",
    "registroTSE": "BR-08045/2026",
    "contratante": null,
    "dataInicio": "2026-08-06",
    "dataFim": "2026-08-10",
    "publicadoEm": "2026-08-11",
    "amostra": 2400,
    "margem": 2.0,
    "cenario": "estimulada, 2º turno: Flávio Bolsonaro x Lula",
    "fonte": { "nome": "Gazeta do Povo", "url": "https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/gerp-presidente-agosto-2026/" },
    "resultados": [
      { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 45.0 },
      { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 43.0 }
    ],
    "observacao": "Preenche a lacuna deixada na entrada de 1º turno desta mesma rodada (2026-08-11-gerp-br-presidente-t1), cuja observação original dizia não ter sido possível confirmar o 2º turno; localizado via WebSearch em 13/09/2026 (diferença de 2 pontos, empate técnico)."
  }
]
```

Não verificado por limite de orçamento de busca: se há rodadas PoderData de maio, junho ou agosto além das duas de julho já presentes na base (o instituto só aparece em julho no arquivo atual) — recomenda-se checagem adicional dedicada a essa lacuna.

## Veredito

**Publicável: NÃO.**

**Maior lacuna**: a linha `2026-07-30-poderdata-br-presidente-t2-flavio-lula` não é apenas um erro de 1 ou 2 pontos percentuais — ela importa um **evento inteiro de outra data** (Flávio Bolsonaro aparecendo numericamente à frente de Lula pela primeira vez) para dentro do período maio–agosto, quando isso na realidade só veio a ocorrer numa pesquisa PoderData/Aya de campo 30/08–02/09/2026 (fora da janela coberta por este arquivo). Isso muda a narrativa da corrida presidencial em julho (que na realidade ainda tinha Lula à frente por 3 pontos, 46 a 43) e é o tipo de erro que mais compromete a credibilidade da base se publicado como está. Some-se a isso a inversão de números na pesquisa Nexus/FSB de 15/06, os números trocados do 2º turno Meio/Ideia de 08/07, uma fonte citada que na verdade é de uma pesquisa Datafolha de 2022, e duas pesquisas completas (Datafolha 21/08 e AtlasIntel 31/08) ausentes da base — todas achados típicos do risco de "números trocados entre pesquisas parecidas" que motivou esta auditoria.

## Aplicado

Todas as correções recomendadas foram aplicadas em `data/research/polls-presidente-historico.json`, sem nenhuma remoção (a auditoria não apontou ids para remover):

- Nexus/FSB 15/06 (t1): percentuais corrigidos para 42,0/33,0.
- Datafolha 20/06 (t2): fonte trocada para a Wikipédia (a antiga apontava para uma pesquisa Datafolha de 2022).
- Real Time Big Data 21/07 (t1 e t2): `registroTSE` preenchido com `BR-09247/2026`.
- PoderData 30/07 (t2): id renomeado de `...t2-flavio-lula` para `...t2-lula-flavio`, resultados corrigidos para Lula 46,0 / Flávio 43,0 e observação reescrita (o evento "Flávio à frente pela 1ª vez" pertence a uma rodada de setembro, fora do período coberto).
- Meio/Ideia 08/07 (t1 e t2): `registroTSE` preenchido com `BR-05628/2026`; no t2, resultados corrigidos para Lula 45,0 / Flávio 40,0 e fonte trocada para a matéria do Brasil de Fato.
- Quaest 10/06 (t1): fonte trocada para a matéria da CNN Brasil sobre o 1º turno desta rodada.

Pesquisas faltantes inseridas (nenhum valor além dos trazidos pela auditoria):

- `2026-08-11-gerp-br-presidente-t2-flavio-lula` — inserida em `data/research/polls-presidente-historico.json` (antes de 20/08).
- `2026-08-21-datafolha-br-presidente-t1` e `2026-08-21-datafolha-br-presidente-t2-lula-flavio` — inseridas em `data/research/polls-presidente.json` (20/08 em diante).
- `2026-08-31-atlasintel-br-presidente-t1` e `2026-08-31-atlasintel-br-presidente-t2-lula-flavio` — já existiam em `data/research/polls-presidente.json` com dados equivalentes; não duplicadas.

Verificado: ids únicos entre `polls-presidente-historico.json` e `polls-presidente.json` (sem sobreposição). Rodado com sucesso: `npm run data:merge -- --date 2026-09-13`, `npm run data:validate` e `npm test` (215 testes, todos passando).
