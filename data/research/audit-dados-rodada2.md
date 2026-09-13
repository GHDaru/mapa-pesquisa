# Auditoria de dados — RODADA 2 — amostra de 14 pesquisas + 27 cadeiras de senador (2026-09-13)

Metodologia: 2 buscas por pesquisa (WebSearch apenas, WebFetch/curl bloqueados), amostra diferente da rodada 1, extraída de `data/polls.json` (arquivo fundido). 6 buscas adicionais para a lista de 27 senadores com `emDisputa2026=false` em `data/senate-seats.json`. Tolerância de 0,5 p.p. para percentuais. "NÃO CONFIRMADO" = busca não trouxe elemento suficiente para validar nem refutar. Nenhum JSON de origem foi editado nesta rodada.

## 1. Presidenciais (2º turno)

### `2026-09-11-datafolha-br-presidente-t2-lula-flavio`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Datafolha, campo 08–10/09, public. 11/09 | confirmado, 2002 entrevistados | https://exame.com/brasil/datafolha-lula-tem-46-e-flavio-bolsonaro-44-no-segundo-turno/ |
| b) 2 primeiros | OK | Lula 46,0 / Flávio 44,0 | Lula 46% / Flávio 44% | mesma URL |
| c) registroTSE | OK | BR-01833/2026 | confirmado (mesmo registro da pesquisa de 1º turno do mesmo instituto/rodada) | consulta TSE referenciada via Gazeta do Povo |
| d) partido do líder | OK | PT | PT | — |
| e) pesquisa mais recente | **ERRO (faltante)** | — | **Futura/100% Cidades, divulgada 11/09, campo 04–10/09**: Flávio 45,4% x Lula 45% — pesquisa distinta, do mesmo dia, ausente da base | https://www.poder360.com.br/poder-eleicoes-2026/flavio-tem-454-contra-45-de-lula-no-2o-turno-diz-pesquisa/ |

### `2026-09-10-atlasintel-br-presidente-t2-flavio`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | AtlasIntel/Bloomberg, campo 04–09/09, public. 10/09 | confirmado, 5000 entrevistados | https://www.cnnbrasil.com.br/eleicoes/atlasintel-bloomberg-flavio-tem-464-no-2o-turno-lula-462/ |
| b) 2 primeiros | OK | Flávio 46,4 / Lula 46,2 | Flávio 46,4% / Lula 46,2% | mesma URL |
| c) registroTSE | OK | BR-01452/2026 | confirmado literalmente | https://exame.com/brasil/pesquisa-atlasintel-flavio-bolsonaro-tem-464-e-lula-462-no-2o-turno/ |
| d) partido do líder | OK | PL | PL | — |
| e) pesquisa mais recente | OK | — | nenhuma AtlasIntel mais nova; Datafolha e Futura de 11/09 já tratadas acima | — |

### `2026-09-09-gerp-br-presidente-t2-flavio-lula`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Gerp, campo 03–08/09, public. 09/09 | confirmado, 2400 entrevistados | https://exame.com/brasil/pesquisa-gerp-flavio-bolsonaro-tem-47-e-lula-40-no-2o-turno/ |
| b) 2 primeiros | OK | Flávio 47,0 / Lula 40,0 | Flávio 47% / Lula 40% | mesma URL |
| c) registroTSE | **ERRO (dado ausente)** | `null` | **BR-00251/2026** — confirmado (mesma amostra 2400, campo 03–08/09, parceria Gerp/AESP Rádio+TV) | busca dedicada ao protocolo |
| d) partido do líder | OK | PL (Flávio) | PL | — |
| e) pesquisa mais recente | OK | — | nenhuma Gerp mais nova | — |

## 2. Governadores (mais recente por UF)

### RS — `2026-09-10-real-time-big-data-rs-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Real Time Big Data, campo 05–09/09, public. 10/09 | confirmado | https://www.metropoles.com/brasil/real-time-big-data-zucco-e-juliana-brizola-estao-empatados-com-44-no-rs |
| b) 2 primeiros | OK | Zucco 36,0 / Brizola 35,0 | Zucco 36% / Brizola 35% | mesma URL |
| c) registroTSE | NÃO CONFIRMADO | RS-05497/2026 | não apareceu literalmente nos resumos | — |
| d) partido do líder | OK | PL (Zucco) | PL | — |
| e) pesquisa mais recente | OK | — | AtlasIntel (03/09, mais antiga) já superada por esta; nenhuma pós-10/09 | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/atlasintel-governador-rio-grande-do-sul-setembro-2026/ |

### GO — `2026-09-11-parana-pesquisas-go-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Paraná Pesquisas, campo 08–10/09, public. 11/09 | confirmado, 1248 entrevistados | https://www.poder360.com.br/poder-eleicoes-2026/daniel-vilela-tem-451-contra-232-de-marconi-em-go-diz-pesquisa/ |
| b) 2 primeiros | OK | Vilela 45,1 / Marconi 23,2 | Vilela 45,1% / Marconi 23,2% | mesma URL |
| c) registroTSE | OK | GO-03096/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | MDB | MDB | — |
| e) pesquisa mais recente | OK | — | nenhuma pós-11/09 | — |
| extra | **ERRO** | `contratante: null` | **Portal 6 Comunicação LTDA** | mesma URL |

### PE — `2026-09-11-datafolha-pe-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Datafolha, campo 08–10/09, public. 11/09 | confirmado, 1204 entrevistados | https://www.poder360.com.br/poder-eleicoes-2026/raquel-lyra-tem-51-contra-44-de-joao-campos-em-pe-diz-datafolha/ |
| b) 2 primeiros | OK | Lyra 47,0 / Campos 42,0 | Lyra 47% / Campos 42% | mesma URL |
| c) registroTSE | NÃO CONFIRMADO | PE-04411/2026 | não apareceu literalmente | — |
| d) partido do líder | OK | PSD | PSD | — |
| e) pesquisa mais recente | OK | — | Real Time Big Data de 03/09 é mais antiga e já superada; nenhuma pós-11/09 | — |

### AM — `2026-09-05-atlasintel-am-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | **ERRO (campo ausente)** | AtlasIntel, campo 29/08–03/09, `publicadoEm: null` | confirmado campo; **divulgada sexta-feira, 04/09/2026** | https://exame.com (via busca), confirmado também pelo resumo da AtlasIntel |
| b) 2 primeiros | OK | Aziz 31,0 / Maria do Carmo 27,4 | Aziz 31% / Maria do Carmo 27,4% | mesma linha de busca |
| c) registroTSE | OK | AM-04939/2026 | confirmado literalmente | — |
| d) partido do líder | OK | PSD (Aziz) | PSD | — |
| e) pesquisa mais recente | **ERRO (faltante)** | — | **Paraná Pesquisas, divulgada 05/09, campo 02–04/09, registro AM-01118/2026**: Aziz 29,6% / Roberto Cidade (União) 21,5% / Maria do Carmo 19,4% / David Almeida (Avante) 16,8% — um dia mais nova, com cenário de 4 candidatos em vez de 2 | https://www.poder360.com.br/poder-eleicoes-2026/omar-aziz-lidera-no-1o-turno-para-o-governo-do-amazonas-diz-pesquisa/ |

### MA — `2026-09-10-paranapesquisas-ma-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | **ERRO GRAVE** | Paraná Pesquisas, `publicadoEm: "2026-09-10"` (mês assumido, conforme a própria observação do arquivo) | Esta pesquisa (Braide 34,6% / Brandão 30,3%, 1300 entrevistados, margem 2,8) é de **março/2026**: campo 05–08/03, **divulgada terça-feira, 10 de março de 2026** — não é uma pesquisa de setembro | https://www.metropoles.com/brasil/parana-pesquisas-braide-tem-346-e-brandao-303-ao-governo-do-ma ; confirmação da data em busca dedicada |
| b) 2 primeiros | OK (para a pesquisa correta, mas fora da janela pedida) | Braide 34,6 / Brandão 30,3 | idem | mesma URL |
| c) registroTSE | NÃO CONFIRMADO | MA-00634/2026 | não confirmado se corresponde à pesquisa de março ou é de outra | — |
| d) partido do líder | OK | PSD (Braide) | PSD | — |
| e) pesquisa mais recente | **ERRO (faltante crítico)** | — | **Real Time Big Data, divulgada 10/09/2026, campo 05–09/09, registro MA-02569/2026**: Braide 45% / Brandão (MDB) 32% / Camarão (PT) 11% / Rocha (PRTB) 5% — esta sim é a pesquisa real de setembro para o MA e deveria ocupar a posição de "mais recente" | https://exame.com/brasil/real-time-big-data-braide-tem-45-e-brandao-32-no-1o-turno-no-maranhao/ |

### RN — `2026-09-realtimebigdata-rn-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Real Time Big Data, campo 05–09/09, `publicadoEm: null` | confirmado, campo 05-09/09 | https://www.poder360.com.br/poder-eleicoes-2026/allyson-lidera-disputa-pelo-governo-do-rn-com-30-diz-pesquisa/ |
| b) 2 primeiros | OK | Allyson 30,0 / Cadu Xavier 25,0 | Allyson 30% / "Cadu de Lula" 25% (mesmo candidato — nome de urna de Carlos Eduardo Xavier) | mesma URL |
| c) registroTSE | OK | RN-08492/2026 | confirmado literalmente | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/real-time-big-data-governador-senado-rio-grande-do-norte-setembro-2026/ |
| d) partido do líder | OK | União Brasil (Allyson) | União Brasil | — |
| e) pesquisa mais recente | **ALERTA (não confirmado o suficiente para corrigir)** | — | Instituto Exatus tem pesquisa de campo 07–09/09 (mesmo fim de campo) mostrando **Allyson com 41,9%** — vantagem bem maior que o "empate técnico" relativo do RTBD (30/25/23); data de divulgação exata da rodada Exatus de 07-09/09 não confirmada, então não foi possível determinar com segurança qual é "mais recente"; divergência de magnitude entre institutos deve ser sinalizada no mapa | https://agorarn.com.br/politica/exatus-allyson-lidera-governo-alvaro-cadu/ |

### DF — `2026-09-03-atlasintel-df-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | AtlasIntel, campo 27/08–01/09, public. 03/09 | confirmado, 1193 entrevistados | https://www.dgabc.com.br/Noticia/4344950/atlasintel-no-df-celina-leao-tem-30-7-e-leandro-grass-29-no-1-turno-cenario-e-de-empate |
| b) 2 primeiros | OK | Celina Leão 30,7 / Grass 29,0 | Celina Leão 30,7% / Grass 29% | mesma URL |
| c) registroTSE | OK | DF-02018/2026 | confirmado | — |
| d) partido do líder | OK | PP | PP | — |
| e) pesquisa mais recente | **ERRO (faltante crítico)** | — | **Datafolha, divulgada 11/09, campo 08–11/09, registro DF-06055/2026 (também BR-04623/2026)**: Celina Leão dispara para 40%/45% conforme o cenário, Arruda (PSD) 17%, Grass (PT) 16% — 8 dias mais nova e mostra mudança relevante de patamar (Celina ampliou vantagem, deixando de ser "empate técnico") | https://ohoje.com/2026/09/11/datafolha-celina-leao-dispara-e-chega-a-40-na-disputa-pelo-governo-do-df/ |

## 3. Senadores

### MG — `2026-09-08-realtimebigdata-mg-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Real Time Big Data, campo 03–07/09, public. 08/09 | confirmado, 2000 entrevistados | https://www.correiobraziliense.com.br/politica/2026/09/7495978-real-time-marilia-tem-21-para-o-senado-em-mg-aecio-e-domingos-14.html |
| b) 2 primeiros | OK | Marília 21,0 / Aécio-Domingos 14,0 (empate) | Marília 21% / Aécio e Domingos 14% cada | mesma URL |
| c) registroTSE | OK | MG-00998/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | PT (Marília) | PT | — |
| e) pesquisa mais recente | OK (observação) | — | Quaest de mesma janela (04–07/09) mostra Marília 13/Aécio 10/Viana 8 (registro MG-04716/2026) — números bem menores mas mesma ordem de líderes; sem confirmação de que seja mais recente que a RTBD, apenas divergente em magnitude | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/quaest-governador-senador-minas-gerais-setembro-2026/ |

### PR — `2026-09-11-real-time-big-data-pr-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Real Time Big Data, campo 04–08/09, public. 11/09 | confirmado, 1600 entrevistados | https://ric.com.br/politica/real-time-big-data-deltan-dallagnol-tem-19-curi-e-barros-empatam-em-18/ |
| b) 2 primeiros | OK | Deltan 19,0 / Curi 18,0 | Deltan 19% / Curi 18% (Filipe Barros também 18%) | mesma URL |
| c) registroTSE | OK | PR-08220/2026 | confirmado literalmente | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/real-time-big-data-senado-parana-setembro-2026/ |
| d) partido do líder | OK | Novo (Deltan) | Novo | — |
| e) pesquisa mais recente | OK (observação) | — | Neokemp (campo 08–10/09, registro PR-04426/2026) tem campo mais recente mas números muito diferentes (Deltan 47,4%/Barros 37,7%) — provavelmente metodologia distinta (só 2 nomes testados); RTBD (publicada 11/09) segue sendo a mais recente por data de divulgação | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/irg-pesquisas-senador-parana-setembro-2026/ |

### CE — `2026-09-04-atlasintel-ce-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | AtlasIntel/Focus, campo 28/08–02/09, public. 03/09 (arquivo usa 04/09) | confirmado campo; divulgação referida como "dia 3" em uma fonte e "04/09" em outra — pequena inconsistência entre fontes secundárias, não tratada como erro | https://www.cartacapital.com.br/politica/a-disputa-pelas-duas-vagas-do-ceara-no-senado-segundo-atlasintel/ |
| b) 2 primeiros | OK | Cid Gomes 24,4 / Luizianne 24,2 | Cid Gomes 24,4% / Luizianne Lins 24,2% | mesma URL |
| c) registroTSE | **ERRO** | CE-02357/2026 | **BR-07411/2026** — confirmado para esta pesquisa específica (mesmos 1834 entrevistados, campo 28/08–02/09) | busca dedicada ao protocolo |
| d) partido do líder | OK | PSB (Cid Gomes) | PSB | — |
| e) pesquisa mais recente | **ERRO (faltante)** | — | **Real Time Big Data, campo 03–07/09, registro CE-03293/2026** (mesmo registro já usado pela pesquisa de governador CE já presente na base): Cid Gomes 27% / Capitão Wagner 20% / Luizianne 20% / Alcides Fernandes 17% / Theophilo 5% — mais recente e com Cid isolado na liderança (diferente do empate Cid/Luizianne da AtlasIntel) | https://exame.com/brasil/real-time-big-data-cid-wagner-e-luizianne-lideram-corrida-ao-senado-no-ceara/ |

### GO — `2026-09-11-parana-pesquisas-go-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Paraná Pesquisas, campo 08–10/09, public. 11/09 | confirmado, 1248 entrevistados | https://exame.com/brasil/pesquisa-senado-em-goias-gracinha-tem-427-gayer-e-calil-empatam-diz-parana-pesquisas/ |
| b) 2 primeiros | OK | Gracinha 42,7 / Gayer 27,6 | Gracinha 42,7% / Gayer 27,6% | mesma URL |
| c) registroTSE | OK | GO-03096/2026 | confirmado (mesmo registro da pesquisa de governador GO, mesma rodada de campo) | mesma URL |
| d) partido do líder | OK | União (Gracinha) | União Brasil | — |
| e) pesquisa mais recente | OK | — | nenhuma pós-11/09 | — |
| extra | OK | `contratante: "Portal 6"` | Portal 6 Comunicação LTDA | mesma URL |

## 4. Cadeiras de senador com mandato até 2031 (`emDisputa2026=false`) — verificação por amostragem (6 buscas)

Não foi possível verificar as 27 cadeiras individualmente com 6 buscas; a estratégia foi mirar os casos de maior risco de estarem desatualizados: senadores que viraram ministros (uso de suplente) e senadores que trocaram de partido ou são pré-candidatos a governador em 2026 (nove dos 27 disputam governo de estado e por isso aparecem publicamente sob holofote).

| UF | Nome/partido no arquivo | Verificação | Resultado |
|---|---|---|---|
| CE | Camilo Santana / PT | Foi ministro da Educação (jan/2023–abr/2026, com suplente Augusta Brito no exercício); **retornou ao Senado em 02/04/2026** e segue PT | OK — arquivo correto para o titular atualmente em exercício |
| AL | Renan Filho / MDB | Licenciado para ser ministro dos Transportes (suplente Fernando Farias exerceu o mandato); é pré-candidato a governador de Alagoas pelo MDB em 2026 | OK quanto ao partido (MDB); observação: se estiver licenciado para campanha no momento da consulta, o exercício efetivo da cadeira pode estar com o suplente — não é um erro de partido, mas o mapa deveria indicar quando o titular está afastado |
| MG | Cleitinho / Republicanos | Confirmado Republicanos (trocou de Cidadania→PSC→Republicanos entre 2022–23); é pré-candidato a governador de MG em 2026 (ver `2026-09-08-datafolha-mg-governador-t1`) | OK |
| RJ | Romário / Sem Partido | Confirmado: saiu do PL (mudança recente, ~14/08/2026) e está oficialmente sem partido, apoiando Eduardo Paes ao governo do RJ | OK — arquivo já reflete corretamente a mudança |
| GO | Wilder Morais / PL | Confirmado PL (filiado desde 2022, referido como "PL-GO" em fonte de setembro/2026); é pré-candidato a governador de GO | OK |
| Lista geral (Senado Notícias, "Eleições 2026: quem fica, quem sai e quem concorre") | — | Confirma 9 dos 27 titulares de 2031 como pré-candidatos a governador em 2026, com partidos: Alan Rick/Republicanos (AC), Omar Aziz/PSD (AM), Renan Filho/MDB (AL), Efraim Filho/PL (PB), Professora Dorinha/União (TO), Wilder Morais/PL (GO), Wellington Fagundes/PL (MT), Cleitinho/Republicanos (MG), Sergio Moro/PL (PR) | **Todos os 9 partidos batem com `senate-seats.json`** |

**Nenhuma divergência de nome ou partido foi encontrada** nos 6 pontos verificados (que cobrem, direta ou indiretamente, 10 das 27 cadeiras: CE, AL, MG, RJ, GO, AC, AM, PB, TO, MT, PR — note-se sobreposição). As 17 cadeiras restantes (AP, BA, ES, MA, MS, PA, PI, RN, RO, RR, SC, SP, SE, além de reconfirmar PE) não foram checadas nesta rodada por limite de buscas — recomenda-se checagem direta em `senado.leg.br/web/senadores/em-exercicio` em rodada futura, especialmente para identificar titulares atualmente afastados por licença (que a coluna "atual" do arquivo, tal como definida no `data-schema.md`, não distingue de titulares em exercício pleno).

---

## Correções recomendadas (não aplicadas — apenas recomendação)

```json
[
  {
    "arquivo": "polls-presidente.json",
    "id": "2026-09-09-gerp-br-presidente-t2-flavio-lula",
    "campo": "registroTSE",
    "valorAntigo": null,
    "valorNovo": "BR-00251/2026"
  },
  {
    "arquivo": "polls-governador-sul-sudeste-co.json",
    "id": "2026-09-11-parana-pesquisas-go-governador-t1",
    "campo": "contratante",
    "valorAntigo": null,
    "valorNovo": "Portal 6 Comunicação LTDA"
  },
  {
    "arquivo": "polls-governador-norte-nordeste.json",
    "id": "2026-09-05-atlasintel-am-governador-t1",
    "campo": "publicadoEm",
    "valorAntigo": null,
    "valorNovo": "2026-09-04"
  },
  {
    "arquivo": "polls-governador-norte-nordeste.json",
    "id": "2026-09-10-paranapesquisas-ma-governador-t1",
    "campo": "dataInicio",
    "valorAntigo": null,
    "valorNovo": "2026-03-05"
  },
  {
    "arquivo": "polls-governador-norte-nordeste.json",
    "id": "2026-09-10-paranapesquisas-ma-governador-t1",
    "campo": "dataFim",
    "valorAntigo": null,
    "valorNovo": "2026-03-08"
  },
  {
    "arquivo": "polls-governador-norte-nordeste.json",
    "id": "2026-09-10-paranapesquisas-ma-governador-t1",
    "campo": "publicadoEm",
    "valorAntigo": "2026-09-10",
    "valorNovo": "2026-03-10"
  },
  {
    "arquivo": "polls-governador-norte-nordeste.json",
    "id": "2026-09-10-paranapesquisas-ma-governador-t1",
    "campo": "amostra",
    "valorAntigo": null,
    "valorNovo": 1300
  },
  {
    "arquivo": "polls-governador-norte-nordeste.json",
    "id": "2026-09-10-paranapesquisas-ma-governador-t1",
    "campo": "observacao",
    "valorAntigo": "Data de publicação estimada com base em referência da fonte a 'terça-feira, dia 10'; mês não confirmado com certeza (assumido setembro/2026 por ser a pesquisa mais recente do instituto).",
    "valorNovo": "CORREÇÃO: esta pesquisa é de março/2026 (campo 05-08/03, divulgada 10/03/2026), não de setembro — o mês foi assumido incorretamente na coleta original. Não deveria ocupar a posição de 'pesquisa mais recente' para o governo do MA; ver pesquisa Real Time Big Data de 10/09/2026 em 'pesquisas faltantes'."
  },
  {
    "arquivo": "polls-senador-bloco2.json",
    "id": "2026-09-04-atlasintel-ce-senador-t1",
    "campo": "registroTSE",
    "valorAntigo": "CE-02357/2026",
    "valorNovo": "BR-07411/2026"
  }
]
```

## Pesquisas faltantes (esquema de `docs/data-schema.md`)

```json
{
  "id": "2026-09-11-futura-100-cidades-br-presidente-t2-flavio-lula",
  "uf": "BR",
  "cargo": "presidente",
  "turno": 2,
  "instituto": "Futura/100% Cidades",
  "registroTSE": null,
  "contratante": null,
  "dataInicio": "2026-09-04",
  "dataFim": "2026-09-10",
  "publicadoEm": "2026-09-11",
  "amostra": 2000,
  "margem": 2.2,
  "cenario": "estimulada, 2º turno: Flávio Bolsonaro x Lula",
  "fonte": { "nome": "Poder360", "url": "https://www.poder360.com.br/poder-eleicoes-2026/flavio-tem-454-contra-45-de-lula-no-2o-turno-diz-pesquisa/" },
  "resultados": [
    { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 45.4 },
    { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 45.0 }
  ],
  "observacao": "registroTSE não localizado nas buscas desta sessão. Divulgada no mesmo dia (11/09) que a Datafolha já presente na base, mostrando cenário de empate técnico em vez da vantagem de 2 p.p. de Lula apontada pela Datafolha — divergência relevante entre institutos na mesma janela."
}
```

```json
{
  "id": "2026-09-05-parana-pesquisas-am-governador-t1",
  "uf": "AM",
  "cargo": "governador",
  "turno": 1,
  "instituto": "Paraná Pesquisas",
  "registroTSE": "AM-01118/2026",
  "contratante": null,
  "dataInicio": "2026-09-02",
  "dataFim": "2026-09-04",
  "publicadoEm": "2026-09-05",
  "amostra": 1350,
  "margem": 2.7,
  "cenario": "estimulada, primeiro turno",
  "fonte": { "nome": "Poder360", "url": "https://www.poder360.com.br/poder-eleicoes-2026/omar-aziz-lidera-no-1o-turno-para-o-governo-do-amazonas-diz-pesquisa/" },
  "resultados": [
    { "candidato": "Omar Aziz", "partido": "PSD", "pct": 29.6 },
    { "candidato": "Roberto Cidade", "partido": "União Brasil", "pct": 21.5 },
    { "candidato": "Professora Maria do Carmo", "partido": "PL", "pct": 19.4 },
    { "candidato": "David Almeida", "partido": "Avante", "pct": 16.8 }
  ],
  "observacao": "Um dia mais recente que a AtlasIntel (04/09) já presente na base; cenário com 4 nomes em vez de 2, o que explica os percentuais menores para Aziz e Maria do Carmo."
}
```

```json
{
  "id": "2026-09-10-real-time-big-data-ma-governador-t1",
  "uf": "MA",
  "cargo": "governador",
  "turno": 1,
  "instituto": "Real Time Big Data",
  "registroTSE": "MA-02569/2026",
  "contratante": null,
  "dataInicio": "2026-09-05",
  "dataFim": "2026-09-09",
  "publicadoEm": "2026-09-10",
  "amostra": 1600,
  "margem": 2.0,
  "cenario": "estimulada, primeiro turno",
  "fonte": { "nome": "Exame", "url": "https://exame.com/brasil/real-time-big-data-braide-tem-45-e-brandao-32-no-1o-turno-no-maranhao/" },
  "resultados": [
    { "candidato": "Eduardo Braide", "partido": "PSD", "pct": 45.0 },
    { "candidato": "Orleans Brandão", "partido": "MDB", "pct": 32.0 },
    { "candidato": "Felipe Camarão", "partido": "PT", "pct": 11.0 },
    { "candidato": "Roberto Rocha", "partido": "PRTB", "pct": 5.0 }
  ],
  "observacao": "Esta é a verdadeira pesquisa mais recente de setembro/2026 para o governo do MA. Deve substituir a entrada 2026-09-10-paranapesquisas-ma-governador-t1 na posição de 'mais recente', pois aquela é, na realidade, uma pesquisa de março/2026 mal identificada (ver Correções recomendadas)."
}
```

```json
{
  "id": "2026-09-11-datafolha-df-governador-t1",
  "uf": "DF",
  "cargo": "governador",
  "turno": 1,
  "instituto": "Datafolha",
  "registroTSE": "DF-06055/2026",
  "contratante": null,
  "dataInicio": "2026-09-08",
  "dataFim": "2026-09-11",
  "publicadoEm": "2026-09-11",
  "amostra": 910,
  "margem": 3.0,
  "cenario": "estimulada, primeiro turno (dois cenários testados, 40% e 45% para a líder)",
  "fonte": { "nome": "O Hoje", "url": "https://ohoje.com/2026/09/11/datafolha-celina-leao-dispara-e-chega-a-40-na-disputa-pelo-governo-do-df/" },
  "resultados": [
    { "candidato": "Celina Leão", "partido": "PP", "pct": 40.0 },
    { "candidato": "José Roberto Arruda", "partido": "PSD", "pct": 17.0 },
    { "candidato": "Leandro Grass", "partido": "PT", "pct": 16.0 }
  ],
  "observacao": "Também registrada sob BR-04623/2026. Oito dias mais recente que a AtlasIntel (03/09) já presente na base; mostra Celina Leão ampliando vantagem de forma relevante (de empate técnico 30,7%x29% para liderança isolada de 40%x17%/16%) — mudança de patamar que a base atual não captura."
}
```

```json
{
  "id": "2026-09-05-real-time-big-data-ce-senador-t1",
  "uf": "CE",
  "cargo": "senador",
  "turno": 1,
  "instituto": "Real Time Big Data",
  "registroTSE": "CE-03293/2026",
  "contratante": null,
  "dataInicio": "2026-09-03",
  "dataFim": "2026-09-07",
  "publicadoEm": null,
  "amostra": 1600,
  "margem": 2.0,
  "cenario": "estimulada (2 vagas em disputa)",
  "fonte": { "nome": "Exame", "url": "https://exame.com/brasil/real-time-big-data-cid-wagner-e-luizianne-lideram-corrida-ao-senado-no-ceara/" },
  "resultados": [
    { "candidato": "Cid Gomes", "partido": "PSB", "pct": 27.0 },
    { "candidato": "Capitão Wagner", "partido": "União Brasil", "pct": 20.0 },
    { "candidato": "Luizianne Lins", "partido": "Rede", "pct": 20.0 },
    { "candidato": "Alcides Fernandes", "partido": "PL", "pct": 17.0 },
    { "candidato": "Guilherme Theophilo", "partido": "Novo", "pct": 5.0 }
  ],
  "observacao": "publicadoEm não confirmado com precisão nesta sessão (fontes datadas entre 08 e 09/09/2026; campo termina 07/09). Mesmo registroTSE (CE-03293/2026) já usado pela pesquisa de governador CE presente na base — mesma rodada de campo, questionário com múltiplos cargos. Mais recente que a AtlasIntel de 03/09 já na base, e muda o cenário de empate Cid/Luizianne para liderança isolada de Cid."
}
```

## Veredito

**Dados em condição de publicar: NÃO.**

Maior lacuna única: o registro `2026-09-10-paranapesquisas-ma-governador-t1` (arquivo `polls-governador-norte-nordeste.json`) não é, na verdade, uma pesquisa de setembro de 2026 — é uma pesquisa Paraná Pesquisas de **março de 2026** (campo 05–08/03, divulgada 10/03/2026) cujo mês foi assumido incorretamente como setembro na coleta original, e que hoje ocupa a posição de "pesquisa mais recente" para o governo do Maranhão no mapa. Isso é um erro de categoria mais grave que os de percentuais ou registro: o mapa mostraria, como atual, uma disputa de seis meses atrás (Braide 34,6% x Brandão 30,3%) quando a realidade de setembro é uma vantagem de Braide muito maior e uma disputa pela terceira posição totalmente diferente (Braide 45% x Brandão 32%, com Camarão e Rocha também na disputa) — a existência da pesquisa real de setembro (Real Time Big Data, 10/09, MA-02569/2026) já identificada e pronta para uso na seção "Pesquisas faltantes" torna a correção simples, mas ela precisa ser feita antes de qualquer publicação. Somam-se a isso: um segundo caso de pesquisa "mais recente" desatualizada por dias com mudança relevante de patamar (DF: Datafolha de 11/09 mostra Celina Leão saltando de empate técnico para liderança isolada, ausente da base), dois registros TSE incorretos ou ausentes que já foram localizados (Gerp presidencial e AtlasIntel-CE senador) e um caso adicional de pesquisa faltante em AM.

## Aplicado

Todas as "Correções recomendadas" e "Pesquisas faltantes" desta rodada foram aplicadas diretamente nos arquivos de origem em `data/research/polls-*.json` em 2026-09-13.

### Correções aplicadas

| arquivo | id | campo | valor aplicado |
|---|---|---|---|
| `polls-presidente.json` | `2026-09-09-gerp-br-presidente-t2-flavio-lula` | `registroTSE` | `BR-00251/2026` |
| `polls-governador-sul-sudeste-co.json` | `2026-09-11-parana-pesquisas-go-governador-t1` | `contratante` | `Portal 6 Comunicação LTDA` |
| `polls-governador-norte-nordeste.json` | `2026-09-05-atlasintel-am-governador-t1` | `publicadoEm` | `2026-09-04` |
| `polls-governador-norte-nordeste.json` | `2026-09-10-paranapesquisas-ma-governador-t1` → **id corrigido para** `2026-03-10-paranapesquisas-ma-governador-t1` | `id`, `dataInicio`, `dataFim`, `publicadoEm`, `amostra`, `observacao` | `id: 2026-03-10-paranapesquisas-ma-governador-t1`; `dataInicio: 2026-03-05`; `dataFim: 2026-03-08`; `publicadoEm: 2026-03-10`; `amostra: 1300`; `observacao` reescrita explicando que a pesquisa é de março/2026, não de setembro. A entrada permanece na base (não foi removida), mas a janela de agregação de 45 dias usada em setembro/2026 não a alcança. |
| `polls-senador-bloco2.json` | `2026-09-04-atlasintel-ce-senador-t1` | `registroTSE` | `BR-07411/2026` |

### Pesquisas faltantes inseridas

| arquivo | id inserido |
|---|---|
| `polls-presidente.json` | `2026-09-11-futura-100-cidades-br-presidente-t2-flavio-lula` |
| `polls-governador-norte-nordeste.json` | `2026-09-05-parana-pesquisas-am-governador-t1` |
| `polls-governador-norte-nordeste.json` | `2026-09-10-real-time-big-data-ma-governador-t1` |
| `polls-governador-sul-sudeste-co.json` | `2026-09-11-datafolha-df-governador-t1` |
| `polls-senador-bloco2.json` | `2026-09-05-real-time-big-data-ce-senador-t1` |

Todas as entradas foram inseridas com exatamente os valores trazidos pela auditoria (nenhum campo foi inventado além do que consta acima). Após a aplicação:

- `npm run data:merge -- --date 2026-09-13` rodou sem erros e produziu `data/polls.json` com 122 pesquisas únicas (`data/meta.json` com `atualizadoEm: "2026-09-13"`).
- `npm run data:validate` passou sem erros estruturais (0 UFs sem pesquisa de governador ou senador, 0 partidos ausentes de `parties.json`).
- `npm test` passou com 112/112 testes.
