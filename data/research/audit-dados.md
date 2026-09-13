# Auditoria de dados — amostra de 14 pesquisas (2026-09-13)

Metodologia: 2 buscas por pesquisa (WebSearch apenas, WebFetch/curl bloqueados). Tolerância de 0,5 p.p. para percentuais. "NÃO CONFIRMADO" = busca não trouxe elemento suficiente para validar nem refutar.

## 1. Presidenciais (1º turno, mais recentes)

### `2026-09-11-datafolha-br-presidente-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Datafolha, campo 08–10/09, public. 11/09 | confirmado, 2002 entrevistados, campo 08–10/09 | https://www.brasildefato.com.br/2026/09/11/datafolha-lula-tem-39-flavio-bolsonaro-35-no-primeiro-turno/ |
| b) 2 primeiros | OK | Lula 39,0 / Flávio 35,0 | Lula 39% / Flávio 35% | mesma URL |
| c) registroTSE | NÃO CONFIRMADO | BR-01833/2026 | não apareceu literalmente nos resumos consultados | — |
| d) partido do líder | OK | PT | PT | — |
| e) pesquisa mais recente | OK (nenhuma mais nova) | — | nenhuma pesquisa nacional 1º turno posterior a 11/09 encontrada até 13/09 | — |
| extra | ERRO | `contratante: null` | Folha da Manhã S.A. e Globo Comunicação e Participações S/A (aparece explicitamente) | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/datafolha-presidente-setembro-2026-2/ |

### `2026-09-10-atlasintel-br-presidente-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | AtlasIntel/Bloomberg, campo 04–09/09, public. 10/09 | confirmado, 5000 entrevistados | https://www.correiobraziliense.com.br/politica/2026/09/7496900-atlasintel-divulga-hoje-nova-pesquisa-sobre-eleicao-presidencial.html |
| b) 2 primeiros | OK | Lula 43,0 / Flávio 37,4 | Lula 43% (vantagem de 5,6 p.p. sobre Flávio → 37,4%) | mesma URL |
| c) registroTSE | OK | BR-01452/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | PT | PT | — |
| e) pesquisa mais recente | OK (nenhuma mais nova) | — | segundo turno AtlasIntel de 10/09 já está no arquivo (t2); nenhum 1º turno mais novo | — |

### `2026-09-10-meio-ideia-br-presidente-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | **ERRO** | publicadoEm 2026-09-10 | divulgada na **quarta-feira, 9 de setembro** de 2026 (2026-09-09 é quarta-feira) | https://exame.com/brasil/pesquisa-meio-ideia-lula-tem-384-e-flavio-bolsonaro-373-no-1o-turno/ |
| b) 2 primeiros | OK | Lula 38,4 / Flávio 37,3 | Lula 38,4% / Flávio 37,3% | mesma URL |
| c) registroTSE | OK | BR-07935/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | PT | PT | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa Ideia/Meio mais nova encontrada | — |

### `2026-09-09-gerp-br-presidente-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Gerp, campo 03–08/09, public. 09/09 | confirmado, 2400 entrevistados, campo 03–08/09 | https://exame.com/brasil/pesquisa-gerp-flavio-bolsonaro-tem-37-e-lula-34-no-1o-turno/ |
| b) 2 primeiros | OK | Flávio 36,6 / Lula 34,4 | Flávio 36,6% / Lula 34,4% | mesma URL |
| c) registroTSE | NÃO CONFIRMADO | `null` (observação diz não localizado) | nenhuma busca trouxe o número — consistente com o `null` já assumido | — |
| d) partido do líder | OK | PL (Flávio) | PL | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa Gerp mais nova | — |

## 2. Governadores (mais recente por UF)

### SP — `2026-09-11-datafolha-sp-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Datafolha, campo 08–10/09, public. 11/09 (sexta) | confirmado ("divulgou pesquisa na sexta, 11") | https://www.cartacapital.com.br/politica/datafolha-tarcisio-tem-49-na-disputa-pelo-governo-de-sao-paulo-haddad-29/ |
| b) 2 primeiros | OK | Tarcísio 49,0 / Haddad 29,0 | Tarcísio 49% / Haddad 29% | mesma URL |
| c) registroTSE | OK | SP-04189/2026 | confirmado literalmente | https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/datafolha-governador-sao-paulo-setembro-2026/ |
| d) partido do líder | OK | Republicanos | Republicanos | — |
| e) pesquisa mais recente | OK | — | Paraná Pesquisas (mesmo público de 11/09, Tarcísio 49,7/Haddad 34,5) já está no arquivo; nenhuma mais nova | — |

### MG — `2026-09-08-datafolha-mg-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | **ERRO** | publicadoEm 2026-09-10 | divulgada na **sexta-feira, dia 11** de setembro (2026-09-11 é sexta) | https://www.gazetaweb.com/noticias/politica/datafolha-em-mg-cleitinho-cresce-e-tem-37-patrus-tem-13-e-kalil-11-935303 |
| b) 2 primeiros | OK | Cleitinho 37,0 / Patrus 13,0 | Cleitinho 37% / Patrus 13% | https://www.em.com.br/politica/2026/09/7498861-datafolha-cleitinho-chega-a-37-patrus-e-kalil-disputam-vaga-no-2-turno.html |
| c) registroTSE | OK | MG-01611/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | Republicanos | Republicanos | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa MG mais nova que 08–10/09 | — |

### BA — `2026-09-realtimebigdata-ba-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK (campo) / NÃO CONFIRMADO (publicação) | campo 04–08/09, publicadoEm `null` | campo 04–08/09 confirmado; divulgada por volta de 09/09 | https://jornalgrandebahia.com.br/2026/09/pesquisa-real-time-big-data-na-bahia-aponta-empate-tecnico-entre-jeronimo-e-acm-neto-rui-costa-lidera-senado-e-governo-tem-53-de-aprovacao/ |
| b) 2 primeiros | **ERRO (dado ausente)** | ambos `pct: null` | Jerônimo Rodrigues (PT) 45% / ACM Neto (União Brasil) 44% | mesma URL |
| c) registroTSE | OK | BA-01568/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK (ordem no arquivo) | ACM Neto listado antes (União Brasil) | líder real é **Jerônimo Rodrigues (PT)**, não ACM Neto — ordem do arquivo está invertida frente ao valor a preencher | mesma URL |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa BA gov mais nova que 04–08/09 | — |

### PR — `2026-09-10-alfa-inteligencia-pr-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Alfa Inteligência, campo 04–09/09, public. 10/09 | confirmado | https://www.tribunapr.com.br/eleicoes/2026/instituto-aponta-moro-em-vantagem-para-governador-do-parana-44-ainda-estao-indecisos/ |
| b) 2 primeiros | OK | Moro 39,0 / Sandro Alex 26,0 | Moro 39% / Sandro Alex 26% | mesma URL |
| c) registroTSE | OK | PR-03042/2026 | confirmado literalmente | https://agenciasertao.com/eleicoes/pesquisas.php?protocolo=PR050322026&uf=BR (contexto) |
| d) partido do líder | OK | PL | PL | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa PR gov mais nova que 10/09 | — |
| extra | ERRO | `contratante: null` | Rádio Transamérica de São Paulo Ltda. | mesma URL |

### CE — `2026-09-realtimebigdata-ce-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Real Time Big Data, campo 03–07/09, margem 2,0 | confirmado, campo 03–07/09, margem 2 p.p. | https://exame.com/brasil/pesquisa-real-time-big-data-elmano-tem-46-e-ciro-43-no-1o-turno-no-ceara/ |
| b) 2 primeiros | **ERRO (dado ausente)** | ambos `pct: null` | Elmano de Freitas (PT) 46% / Ciro Gomes (PSDB) 43% | mesma URL |
| c) registroTSE | OK | CE-03293/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | PT (Elmano) | PT | — |
| e) pesquisa mais recente | **ALERTA** | — | Quaest (campo 31/08–03/09, publ. 04/09) e Datafolha (campo 31/08–02/09) — ambas **mais antigas**, mas mostram **Ciro Gomes na frente** (Ciro 45%/Elmano 34% na Quaest; Ciro 46%/Elmano 37% na Datafolha) — divergência forte de líder entre institutos na mesma janela de tempo, deve ser sinalizada no mapa | https://exame.com/brasil/pesquisa-real-time-big-data-elmano-tem-46-e-ciro-43-no-1o-turno-no-ceara/ ; https://www.opovo.com.br/noticias/politica/eleicoes/2026/09/02/datafolha-divulga-nova-pesquisa-para-governo-do-ceara.html |

### PA — `2026-09-11-atlasintel-pa-governador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | AtlasIntel/FIEPA, campo 05–10/09, public. 11/09 | confirmado (divulgada sexta 11/09) | https://exame.com/brasil/pesquisa-atlasintel-hana-tem-485-e-dr-daniel-417-no-1o-turno-no-para/ |
| b) 2 primeiros | **ERRO** | Hana 52,0 / Dr. Daniel 44,8 (valores de "votos válidos") usados como principais | A maioria das fontes (Exame, Poder360, Diário do Pará, Ponto de Pauta) cita **Hana 48,5% / Dr. Daniel 41,7%** como o número principal (cenário estimulado/total); 52%/44,8% é o corte "votos válidos" de uma única matéria | mesma URL |
| c) registroTSE | OK | PA-09626/2026 | confirmado (também citado BR-07955/2026, não mencionado no arquivo) | mesma URL |
| d) partido do líder | OK | MDB (Hana) | MDB | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa PA gov mais nova que 11/09 | — |

## 3. Senadores

### SP — `2026-09-08-quaest-sp-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Quaest, campo 04–07/09, public. 08/09 | confirmado | https://boainformacao.com.br/2026/09/pesquisa-da-quaest-aponta-empate-entre-marina-derrite-e-tebet-no-senado/ |
| b) 2 primeiros | OK | Marina 14,0 / Derrite 14,0 | Marina 14% / Derrite 14% | mesma URL |
| c) registroTSE | **ERRO** | `null` (observação diz "não localizado") | **SP-00959/2026** — encontrado; contratante Globo Comunicação e Participações S/A (também `null` no arquivo) | mesma URL |
| d) partido do líder | OK | Rede (Marina) | Rede | — |
| e) pesquisa mais recente | **ERRO (pesquisa faltante)** | — | **Datafolha, campo 08–10/09, public. 11/09**: Marina 13% / Simone Tebet 13% / André do Prado 11% / Derrite 10% / Salles 5%. Mais recente que a Quaest do arquivo e ausente da base | https://www.cnnbrasil.com.br/eleicoes/datafolha-marina-tebet-do-prado-e-derrite-empatam-para-senado-em-sp/ |

### RJ — `2026-09-02-real-time-big-data-rj-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Real Time Big Data, campo 28/08–01/09, public. 02/09 | confirmado | https://www.cnnbrasil.com.br/eleicoes/real-time-no-rj-benedita-crivella-pedro-paulo-e-jordy-empatam-no-senado/ |
| b) 2 primeiros | OK | Benedita 14,0 / Crivella 14,0 | Benedita 14% / Crivella 14% | mesma URL |
| c) registroTSE | **ERRO/incompleto** | BR-02209/2026 (observação já assinala incerteza) | Confirma-se BR-02209/2026, mas há também código específico **RJ-08350/2026** citado nas mesmas fontes — mais alinhado ao padrão UF-XXXXX usado no resto da base | mesma URL |
| d) partido do líder | OK | PT (Benedita) | PT | — |
| e) pesquisa mais recente | **ERRO (pesquisa faltante)** | — | **Datafolha, campo 08–10/09, public. 11/09**: Benedita 18% (líder isolada) / Jordy (PL) 10% / Portinho (PL) 10% / Pedro Paulo (PSD) 7% / Crivella (Republicanos) 7% / Mônica Benício (PSOL) 6%. Muito mais recente que a pesquisa do arquivo (9 dias) e com cenário mais amplo (18 nomes) | https://diariodorio.com/politica/2026/09/11/benedita-tem-15-para-o-senado-no-rio-jordy-e-portinho-aparecem-com-8-diz-datafolha.html |

### BA — `2026-09-03-atlasintel-ba-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | AtlasIntel/A Tarde, campo 28/08–02/09, public. 03/09 | confirmado | https://www.metropoles.com/brasil/atlas-rui-costa-tem-282-ao-senado-na-bahia-jaques-wagner-marca-237 |
| b) 2 primeiros | OK | Rui Costa 28,2 / Jaques Wagner 23,7 | Rui Costa 28,2% / Jaques Wagner 23,7% (cenário "total"); 31,6%/26,5% em "votos válidos" — arquivo já documenta a divergência na observação | mesma URL |
| c) registroTSE | OK | BA-08891/2026 | confirmado literalmente | mesma URL |
| d) partido do líder | OK | PT (Rui Costa) | PT | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa Senado-BA mais nova que 03/09 | — |

### PE — `2026-09-11-datafolha-pe-senador-t1`
| item | status | valor no arquivo | valor encontrado | URL |
|---|---|---|---|---|
| a) instituto/data | OK | Datafolha, campo 08–10/09, public. 11/09 | confirmado | https://www.diariodepernambuco.com.br/politica/2026/09/11723711-datafolha-marilia-tem-18-para-o-senado-em-pe-humberto-16-mendonca-12-eduardo-10.html |
| b) 2 primeiros | OK | Marília 18,0 / Humberto 16,0 | Marília 18% / Humberto 16% | mesma URL |
| c) registroTSE | NÃO CONFIRMADO | PE-04411/2026 | não apareceu literalmente nos resumos consultados | — |
| d) partido do líder | OK | PDT (Marília) | PDT | — |
| e) pesquisa mais recente | OK | — | nenhuma pesquisa PE Senado mais nova que 11/09 | — |
| extra | **ERRO** | Eduardo da Fonte, `partido: null` | **PP** (Progressistas), candidato na chapa de Raquel Lyra | https://candidatos.nexojornal.com.br/2026/pe/eduardo-da-fonte-170002552102/ |

---

## Correções recomendadas (não aplicadas — apenas recomendação)

Arquivo: `polls-presidente.json`
- id `2026-09-10-meio-ideia-br-presidente-t1`: campo `publicadoEm`, valor antigo `"2026-09-10"`, valor novo `"2026-09-09"`.
- id `2026-09-11-datafolha-br-presidente-t1`: campo `contratante`, valor antigo `null`, valor novo `"Folha da Manhã S.A. e Globo Comunicação e Participações S/A"`.

Arquivo: `polls-governador-sul-sudeste-co.json`
- id `2026-09-08-datafolha-mg-governador-t1`: campo `publicadoEm`, valor antigo `"2026-09-10"`, valor novo `"2026-09-11"`.
- id `2026-09-10-alfa-inteligencia-pr-governador-t1`: campo `contratante`, valor antigo `null`, valor novo `"Rádio Transamérica de São Paulo Ltda."`.

Arquivo: `polls-governador-norte-nordeste.json`
- id `2026-09-realtimebigdata-ba-governador-t1`: campo `resultados[0].pct` (ACM Neto), valor antigo `null`, valor novo `44.0`; campo `resultados[1].pct` (Jerônimo Rodrigues), valor antigo `null`, valor novo `45.0`. Observação: reordenar para Jerônimo (líder) primeiro.
- id `2026-09-realtimebigdata-ce-governador-t1`: campo `resultados[0].pct` (Elmano), valor antigo `null`, valor novo `46.0`; campo `resultados[1].pct` (Ciro Gomes), valor antigo `null`, valor novo `43.0`.
- id `2026-09-11-atlasintel-pa-governador-t1`: campo `resultados[0].pct` (Hana Ghassan), valor antigo `52.0`, valor novo `48.5`; campo `resultados[1].pct` (Dr. Daniel), valor antigo `44.8`, valor novo `41.7`; mover 52%/44,8% para a `observacao` como corte "votos válidos".

Arquivo: `polls-senador-bloco3.json`
- id `2026-09-08-quaest-sp-senador-t1`: campo `registroTSE`, valor antigo `null`, valor novo `"SP-00959/2026"`; campo `contratante`, valor antigo `null`, valor novo `"Globo Comunicação e Participações S/A"`.
- id `2026-09-02-real-time-big-data-rj-senador-t1`: campo `registroTSE`, valor antigo `"BR-02209/2026"`, valor novo `"RJ-08350/2026"` (manter BR-02209/2026 na observação como registro agregado).

Arquivo: `polls-senador-bloco2.json`
- id `2026-09-11-datafolha-pe-senador-t1`: campo `resultados[3].partido` (Eduardo da Fonte), valor antigo `null`, valor novo `"PP"`.

## Pesquisas faltantes (mais recentes que as do arquivo, no esquema de `data-schema.md`)

```json
{
  "id": "2026-09-11-datafolha-sp-senador-t1",
  "uf": "SP",
  "cargo": "senador",
  "turno": 1,
  "instituto": "Datafolha",
  "registroTSE": "SP-04189/2026",
  "contratante": "Folha de S.Paulo e TV Globo",
  "dataInicio": "2026-09-08",
  "dataFim": "2026-09-10",
  "publicadoEm": "2026-09-11",
  "amostra": 1610,
  "margem": 2.0,
  "cenario": "estimulada (2 vagas em disputa)",
  "fonte": { "nome": "CNN Brasil", "url": "https://www.cnnbrasil.com.br/eleicoes/datafolha-marina-tebet-do-prado-e-derrite-empatam-para-senado-em-sp/" },
  "resultados": [
    { "candidato": "Marina Silva", "partido": "Rede", "pct": 13.0 },
    { "candidato": "Simone Tebet", "partido": "PSB", "pct": 13.0 },
    { "candidato": "André do Prado", "partido": "PL", "pct": 11.0 },
    { "candidato": "Guilherme Derrite", "partido": "PP", "pct": 10.0 },
    { "candidato": "Ricardo Salles", "partido": "Novo", "pct": 5.0 }
  ],
  "observacao": "Registrada também sob BR-03904/2026 (código agregado nacional). Substitui em atualidade a Quaest de 08/09 já presente na base (campo 3 dias mais antigo)."
}
```

```json
{
  "id": "2026-09-11-datafolha-rj-senador-t1",
  "uf": "RJ",
  "cargo": "senador",
  "turno": 1,
  "instituto": "Datafolha",
  "registroTSE": null,
  "contratante": null,
  "dataInicio": "2026-09-08",
  "dataFim": "2026-09-10",
  "publicadoEm": "2026-09-11",
  "amostra": 1204,
  "margem": 3.0,
  "cenario": "estimulada (2 vagas em disputa, cenário com 18 nomes testados)",
  "fonte": { "nome": "Diário do Rio", "url": "https://diariodorio.com/politica/2026/09/11/benedita-tem-15-para-o-senado-no-rio-jordy-e-portinho-aparecem-com-8-diz-datafolha.html" },
  "resultados": [
    { "candidato": "Benedita da Silva", "partido": "PT", "pct": 18.0 },
    { "candidato": "Carlos Jordy", "partido": "PL", "pct": 10.0 },
    { "candidato": "Carlos Portinho", "partido": "PL", "pct": 10.0 },
    { "candidato": "Pedro Paulo", "partido": "PSD", "pct": 7.0 },
    { "candidato": "Marcelo Crivella", "partido": "Republicanos", "pct": 7.0 },
    { "candidato": "Mônica Benício", "partido": "PSOL", "pct": 6.0 },
    { "candidato": "Brancos/nulos", "partido": null, "pct": 18.0 },
    { "candidato": "Não sabe", "partido": null, "pct": 13.0 }
  ],
  "observacao": "registroTSE não localizado nas buscas desta sessão (não inventado). Substitui em atualidade a pesquisa Real Time Big Data de 02/09 já presente na base (9 dias mais antiga) e muda o líder isolado (Benedita 18% x segundo colocado a 10%, fora da margem de erro) frente ao empate quádruplo mostrado pela Real Time Big Data."
}
```

## Veredito

**Dados em condição de publicar: NÃO.**

Maior lacuna única: a base está desatualizada exatamente nas disputas de maior interesse nacional para Senado — SP e RJ possuem pesquisas Datafolha de 11/09 (mais recentes e com resultados de liderança sensivelmente diferentes) que não entraram no arquivo, enquanto o `polls-senador-bloco3.json` ainda expõe como "mais recente" pesquisas de 3 a 9 dias mais antigas; some-se a isso dois campos `publicadoEm` incorretos (Meio/Ideia e Datafolha-MG) e três pares de percentuais `null` que já existem publicados (BA e CE governador, PA governador com corte errado) — isso é volume suficiente de erro concreto para não liberar a base sem correção.

## Aplicado

Todas as correções recomendadas e as duas pesquisas faltantes desta auditoria foram aplicadas em 2026-09-13 aos arquivos de origem em `data/research/`, seguidas de `npm run data:merge -- --date 2026-09-13`, `npm run data:validate` e `npm test` (todos passaram: 117 pesquisas válidas, 0 erros estruturais, 81 testes ok).

### Correções aplicadas

- `polls-presidente.json`
  - `2026-09-11-datafolha-br-presidente-t1`: `contratante` preenchido com `"Folha da Manhã S.A. e Globo Comunicação e Participações S/A"`.
  - `2026-09-10-meio-ideia-br-presidente-t1`: `publicadoEm` corrigido de `"2026-09-10"` para `"2026-09-09"`.
- `polls-governador-sul-sudeste-co.json`
  - `2026-09-08-datafolha-mg-governador-t1`: `publicadoEm` corrigido de `"2026-09-10"` para `"2026-09-11"`.
  - `2026-09-10-alfa-inteligencia-pr-governador-t1`: `contratante` preenchido com `"Rádio Transamérica de São Paulo Ltda."`.
- `polls-governador-norte-nordeste.json`
  - `2026-09-realtimebigdata-ba-governador-t1`: `resultados[].pct` preenchidos (Jerônimo Rodrigues 45.0 / ACM Neto 44.0); ordem invertida para colocar o líder real (Jerônimo Rodrigues) primeiro.
  - `2026-09-realtimebigdata-ce-governador-t1`: `resultados[].pct` preenchidos (Elmano de Freitas 46.0 / Ciro Gomes 43.0); observação atualizada com alerta de divergência de líder frente a pesquisas Quaest/Datafolha mais antigas.
  - `2026-09-11-atlasintel-pa-governador-t1`: `resultados[].pct` corrigidos de 52.0/44.8 (corte "votos válidos") para 48.5/41.7 (cenário principal); valores antigos documentados na observação.
- `polls-senador-bloco3.json`
  - `2026-09-08-quaest-sp-senador-t1`: `registroTSE` preenchido com `"SP-00959/2026"`; `contratante` preenchido com `"Globo Comunicação e Participações S/A"`.
  - `2026-09-02-real-time-big-data-rj-senador-t1`: `registroTSE` corrigido de `"BR-02209/2026"` para `"RJ-08350/2026"`; código antigo mantido na observação como registro agregado.
- `polls-senador-bloco2.json`
  - `2026-09-11-datafolha-pe-senador-t1`: `resultados[3].partido` (Eduardo da Fonte) preenchido com `"PP"`.

### Pesquisas faltantes inseridas

- `polls-senador-bloco3.json`
  - `2026-09-11-datafolha-sp-senador-t1` (Datafolha, SP, senador, 1º turno).
  - `2026-09-11-datafolha-rj-senador-t1` (Datafolha, RJ, senador, 1º turno).

Nenhum valor foi inventado além do que constava na auditoria; onde a auditoria não trouxe um dado (ex.: `registroTSE` da pesquisa RJ), o campo permaneceu `null` com a observação explicando a lacuna.
