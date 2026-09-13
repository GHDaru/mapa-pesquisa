# Auditoria de dados — Rodada 3

Data da auditoria: 2026-09-13 (WebSearch apenas; WebFetch/curl bloqueados). Amostra: para cada UF de {AC, AP, RO, RR, TO, AL, PI, SE, ES, SC, MT, MS, PB, RN} a pesquisa de **governador** que `data/polls.json` usa hoje como mais recente; para {AM, PA, BA, PE, RS, SC, DF} a pesquisa de **senador** mais recente. 21 pesquisas verificadas, ~31 buscas usadas.

## Tabela de verificação

| UF | Cargo | id auditado | Instituto/datas conferem? | Percentuais top-2 conferem (tol. 0,5)? | Partido do líder correto? | Pesquisa mais recente faltando? |
|---|---|---|---|---|---|---|
| AC | governador | `2026-09-06-travessia-ac-governador-t1` | Sim | Sim (36/32) | Sim (Republicanos) | Não |
| AP | governador | `2026-09-08-realtimebigdata-ap-governador-t1` | Sim (registro AP-04000/2026 confirmado) | Sim (62/31) | Sim (PSD) | Não |
| RO | governador | `2026-08-25-quaest-ro-governador-t1` | Sim para a pesquisa em si | Sim (24/21) | Sim (PL) | **Sim** — Brasil Dados (31/08–03/09) é mais recente |
| RR | governador | `2026-09-11-atlasintel-rr-governador-t1` | Sim | Sim (60,7/32,4) | Sim (PL) | Não |
| TO | governador | `2026-09-07-vrskala-to-governador-t1` | Sim (confirmado o mais recente; Paraná Pesquisas é de 28/08, Quaest de 25/08, RTBD de 26/08 — todos anteriores) | Líder sim (33,6%); 2º lugar (Dorinha) sem percentual confirmável em nenhuma fonte, condizente com a observação já registrada | Sim (PSDB) | Não, mas ver nota abaixo |
| AL | governador | `2026-09-10-atlasintel-al-governador-t1` | Sim | Sim (49,3/46,4) | Sim (PSDB) | Não |
| PI | governador | `2026-09-03-atlasintel-pi-governador-t1` | Sim | Sim (62,4/20,9) | Sim (PT) | Não |
| SE | governador | `2026-09-10-atlasintel-se-governador-t1` | Instituto/percentuais sim; **campos vazios sem necessidade** | Sim (41,3/34,2) | Sim (PSD) | Não |
| ES | governador | `2026-09-09-real-time-big-data-es-governador-t1` | Sim | Sim (43/33) | Sim (MDB) | Não |
| SC | governador | `2026-09-09-atlasintel-sc-governador-t1` | Datas/percentuais sim; **contratante provavelmente errado** | Sim (51,6/18,5) | Sim (PL) | Não |
| MT | governador | `2026-09-11-parana-pesquisas-mt-governador-t1` | Sim | Sim (40,8/30) | Sim (Republicanos) | Não |
| MS | governador | `2026-09-10-real-time-big-data-ms-governador-t1` | Sim; **margem preenchível** (era null) | Sim (42/26, confirmado literal, não mais estimado) | Sim (PP) | Não |
| PB | governador | `2026-09-08-anova-pb-governador-t1` | Sim | Sim (43,4/18,2) | Sim (PP) | Não |
| RN | governador | `2026-09-realtimebigdata-rn-governador-t1` | Datas/percentuais sim; **`publicadoEm` preenchível** (era null) — confirmado ser pesquisa genuína de setembro/2026, não um caso como o de MA na rodada 2 | Sim (30/25) | Sim (União Brasil) | Não |
| AM | senador | `2026-09-05-parana-pesquisas-am-senador-t1` | Sim | Sim (50/39,3) | Sim (MDB) | Não (mas falta 3º nome já antecipado na observação) |
| PA | senador | `2026-09-08-real-time-big-data-pa-senador-t1` | Sim | Sim (36/17) | Sim (MDB) | Não |
| BA | senador | `2026-09-03-atlasintel-ba-senador-t1` | Sim | Sim (28,2/23,7, corte total confirmado) | Sim (PT) | Não |
| PE | senador | `2026-09-11-datafolha-pe-senador-t1` | Sim | Sim (18/16) | Sim (PDT) | Não |
| RS | senador | `2026-09-10-real-time-big-data-rs-senador-t1` | Sim | Sim (22/18) | Sim (Novo) | Não |
| SC | senador | `2026-09-10-atlasintel-sc-senador-t1` | Datas/percentuais sim; **contratante preenchível** (era null) | Sim (28,4/20,2) | Sim (PL) | Não |
| DF | senador | `2026-09-11-datafolha-df-senador-t1` | Sim | Sim (21/18) | Sim (PL) | Não |

Nenhuma pesquisa desta amostra tem líder errado, data incorreta, ou é um caso de "mês antigo etiquetado como setembro" (o padrão do erro de MA na rodada 2 não se repetiu aqui — RN e SE tinham apenas campos em branco, não datas erradas).

## Correções recomendadas

Arquivos de origem em `data/research/`.

| arquivo | id | campo | valor antigo | valor novo |
|---|---|---|---|---|
| `polls-governador-norte-nordeste.json` | `2026-09-10-atlasintel-se-governador-t1` | `dataInicio` | `null` | `2026-09-04` |
| `polls-governador-norte-nordeste.json` | `2026-09-10-atlasintel-se-governador-t1` | `dataFim` | `null` | `2026-09-09` |
| `polls-governador-norte-nordeste.json` | `2026-09-10-atlasintel-se-governador-t1` | `amostra` | `null` | `1260` |
| `polls-governador-norte-nordeste.json` | `2026-09-10-atlasintel-se-governador-t1` | `resultados[2].partido` (Ricardo Marques) | `null` | `"PL"` |
| `polls-governador-norte-nordeste.json` | `2026-09-realtimebigdata-rn-governador-t1` | `publicadoEm` | `null` | `2026-09-10` |
| `polls-governador-sul-sudeste-co.json` | `2026-09-09-atlasintel-sc-governador-t1` | `contratante` | `"AtlasIntel (autofinanciada)"` | `"TV O Estado Florianópolis Ltda. (Grupo ND)"` |
| `polls-governador-sul-sudeste-co.json` | `2026-09-10-real-time-big-data-ms-governador-t1` | `margem` | `null` | `2` |
| `polls-governador-sul-sudeste-co.json` | `2026-09-10-real-time-big-data-ms-governador-t1` | `observacao` | (texto sobre percentual estimado) | Remover ressalva: 26% de Fábio Trad e margem de 2 pontos foram confirmados literalmente em múltiplas fontes (Infomoney, Metrópoles) |
| `polls-senador-bloco*.json` (arquivo com o SC senador) | `2026-09-10-atlasintel-sc-senador-t1` | `contratante` | `null` | `"TV O Estado Florianópolis Ltda. (Grupo ND)"` |
| `polls-senador-bloco*.json` (arquivo com o AM senador) | `2026-09-05-parana-pesquisas-am-senador-t1` | `resultados` | (2 candidatos) | Adicionar 3º: `{"candidato": "Plínio Valério", "partido": "PSDB", "pct": 28.9}` |
| `polls-senador-bloco*.json` (arquivo com o AM senador) | `2026-09-05-parana-pesquisas-am-senador-t1` | `observacao` | (texto dizendo que o 3º nome não foi localizado) | Atualizar: Plínio Valério (PSDB) localizado com 28,9% (fonte: Exame/Fato Amazônico) |

Nota sobre TO: nenhuma correção obrigatória — a pesquisa VR Skala (01–06/09) é de fato a mais recente para governador (Paraná Pesquisas é de 25–27/08, Quaest de 21–24/08, Real Time Big Data de 21–25/08, todas anteriores), e o percentual de Dorinha realmente não é divulgado em nenhuma fonte encontrada. Vale como observação adicional (não obrigatória): há uma disputa judicial em curso pedindo auditoria dos dados da VR Skala (Justiça determinou abertura de dados em 09/09/2026), o que pode ser citado em `observacao` por transparência, mas não é um erro factual do registro atual.

## Pesquisas faltantes

Uma pesquisa mais recente do que a atualmente tratada como "última" foi localizada:

```json
{
  "id": "2026-09-XX-brasildados-ro-governador-t1",
  "uf": "RO",
  "cargo": "governador",
  "turno": 1,
  "instituto": "Brasil Dados",
  "registroTSE": "RO-08019/2026",
  "contratante": "Brasil Dados Inteligência em Dados e Soluções e Pesquisas LTDA",
  "dataInicio": "2026-08-31",
  "dataFim": "2026-09-03",
  "publicadoEm": null,
  "amostra": 1060,
  "margem": 3.0,
  "cenario": "estimulada, primeiro turno",
  "fonte": {
    "nome": "Agência Rondônia",
    "url": "https://www.agenciarondonia.com/2026/09/marcos-rogerio-lidera-pesquisa-do.html"
  },
  "resultados": [
    { "candidato": "Marcos Rogério", "partido": "PL", "pct": 36 },
    { "candidato": "Adailton Fúria", "partido": "PSD", "pct": 27 },
    { "candidato": "Hildon Chaves", "partido": "União Brasil", "pct": 11 }
  ],
  "observacao": "Mais recente que a pesquisa Quaest de 25/08/2026 (RO-05711/2026) atualmente tratada como última do estado — mesmo líder (Marcos Rogério), mas vantagem menor (9 pontos vs. 3 pontos antes). Data exata de publicação não confirmada nas fontes desta sessão (buscas indicam 'há 2-3 dias' a partir de 13/09/2026, i.e. provavelmente 10 ou 11/09/2026); usar null em publicadoEm até confirmação."
}
```

Esta é a única pesquisa faltante identificada nesta rodada (as demais 20 pesquisas auditadas já eram, de fato, as mais recentes de suas disputas).

## Veredito

**Publicável: SIM.**

Maior lacuna única: a pesquisa Brasil Dados (RO, governador, campo 31/08–03/03/09) não está na base, então o site mostra a Quaest de 25/08 como "última pesquisa" de Rondônia quando já existe uma mais nova. Isso não altera o líder (Marcos Rogério segue à frente nas duas) nem inverte nenhuma data — é uma lacuna de atualização, não um erro de fato. Fora isso, todos os problemas desta rodada são menores: campos em branco preenchíveis (datas/amostra/partido em SE, publicadoEm em RN), contratante incorreto ou ausente (SC governador e SC senador) e uma margem de erro ausente (MS) — exatamente o tipo de erro que o critério de aceitação classifica como aceitável. Nenhum líder e nenhuma data de nenhuma das 21 pesquisas auditadas estava errado.

## Aplicado

Todas as correções recomendadas e a pesquisa faltante desta rodada foram aplicadas nos arquivos de origem em `data/research/`:

- `polls-governador-norte-nordeste.json`: SE (`2026-09-10-atlasintel-se-governador-t1`) — `dataInicio`, `dataFim`, `amostra` e partido de Ricardo Marques preenchidos; RN (`2026-09-realtimebigdata-rn-governador-t1`) — `publicadoEm` preenchido; RO (`2026-09-avulso-brasildados-ro-governador-t1`) — percentuais e `contratante` preenchidos (pesquisa antes descartada do merge por falta de números).
- `polls-governador-sul-sudeste-co.json`: SC governador (`2026-09-09-atlasintel-sc-governador-t1`) — `contratante` corrigido; MS governador (`2026-09-10-real-time-big-data-ms-governador-t1`) — `margem` preenchida e ressalva removida da `observacao`.
- `polls-senador-bloco3.json`: SC senador (`2026-09-10-atlasintel-sc-senador-t1`) — `contratante` preenchido.
- `polls-senador-bloco1.json`: AM senador (`2026-09-05-parana-pesquisas-am-senador-t1`) — 3º candidato (Plínio Valério, PSDB, 28,9%) adicionado e `observacao` atualizada.

Após as correções: `npm run data:merge -- --date 2026-09-13`, `npm run data:validate` e `npm test` executados com sucesso (123 pesquisas únicas, validação sem erros estruturais, 112 testes passando).
