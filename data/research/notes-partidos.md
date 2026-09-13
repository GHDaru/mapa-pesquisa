# Notas de pesquisa — Partidos políticos registrados no TSE (setembro/2026)

Levantamento realizado em 13/09/2026 via WebSearch (WebFetch/curl bloqueados). O Brasil tinha, em 2026,
**30 partidos com registro definitivo no TSE** (o 30º foi o Partido Missão, deferido em 04/11/2025) e
**5 federações partidárias** registradas.

## Tabela resumo

| Sigla | Número | Espectro | Federação |
|---|---|---|---|
| Republicanos | 10 | direita | — |
| PP | 11 | direita | União Progressista |
| PDT | 12 | centro-esquerda | — |
| PT | 13 | esquerda | Federação Brasil da Esperança (Fe Brasil) |
| Missão | 14 | direita | — |
| MDB | 15 | centro | — |
| PSTU | 16 | esquerda | — |
| Rede | 18 | centro-esquerda | Federação PSOL-Rede |
| Podemos | 20 | centro-direita | — |
| PCB | 21 | esquerda | — |
| PL | 22 | direita | — |
| Cidadania | 23 | centro | Federação PSDB-Cidadania |
| PRD | 25 | centro-direita | Federação Renovação Solidária |
| DC | 27 | direita | — |
| PCO | 29 | esquerda | — |
| Novo | 30 | direita | — |
| Mobiliza | 33 | centro-direita | — |
| PMB | 35 | centro-esquerda | — |
| Agir | 36 | centro-direita | — |
| PSB | 40 | centro-esquerda | — |
| PV | 43 | centro-esquerda | Federação Brasil da Esperança (Fe Brasil) |
| União Brasil | 44 | centro-direita | União Progressista |
| PSDB | 45 | centro | Federação PSDB-Cidadania |
| PSOL | 50 | esquerda | Federação PSOL-Rede |
| PSD | 55 | centro-direita | — |
| PCdoB | 65 | esquerda | Federação Brasil da Esperança (Fe Brasil) |
| Avante | 70 | centro | — |
| Solidariedade | 77 | centro | Federação Renovação Solidária |
| UP | 80 | esquerda | — |
| PROS | 90 | centro | — |

## Federações partidárias vigentes em 2026

1. **União Progressista** — União Brasil + PP. Oficializada em 19/08/2025, registro aprovado pelo TSE em 26/03/2026. Maior bancada da Câmara (109 deputados) e uma das maiores do Senado. Republicanos foi convidado mas recusou participar.
2. **Federação Renovação Solidária** — Solidariedade + PRD. Registrada em dezembro/2025.
3. **Federação Brasil da Esperança (Fe Brasil)** — PT + PCdoB + PV.
4. **Federação PSOL-Rede** — PSOL + Rede Sustentabilidade (desde 2022).
5. **Federação PSDB-Cidadania** — PSDB + Cidadania.

## Fusões relevantes

- **PRD (nº 25)**: resultado da fusão entre PTB e Patriota, aprovada por unanimidade pelo TSE em 09/11/2023. O número 14 (antigo PTB) ficou livre e foi assumido pelo novo Partido Missão em 2025.
- **União Brasil (nº 44)**: fusão de DEM e PSL, aprovada pelo TSE em fevereiro/2022.
- **Missão (nº 14)**: partido novo (não fusão), ligado ao MBL, registro deferido pelo TSE em 04/11/2025 — 30º partido com estatuto registrado.

## Metodologia de classificação ideológica

Foi adotada como referência primária a classificação acadêmica de linha Zucco/Power (posicionamento
estimado a partir da percepção de parlamentares e do comportamento legislativo — ver "Uma Nova
Classificação Ideológica dos Partidos Políticos Brasileiros", Scielo/Dados) e o "GPS Partidário" da
Folha (atualizado em setembro/2026, que ordena os partidos de PSTU/UP, mais à esquerda, a Novo/PL, mais
à direita). Como segunda referência foi usado o estudo citado pelo Congresso em Foco nas eleições de
2024 (classifica Agir, DC, Novo, PL, Podemos, PP, PRD, Mobiliza (PRTB), PSD, Republicanos e União Brasil
no campo da direita; MDB, Avante, PSDB e Solidariedade no centro). Quando as fontes divergiam de forma
relevante — especialmente para partidos "centrão" que oscilam entre autodeclaração de centro e
classificação acadêmica/jornalística mais à direita (PSD, União Brasil, Podemos, PRD, Agir, Cidadania,
Mobiliza) — foi registrada a divergência no campo `observacao` de cada partido em `parties.json`, e a
posição final adotada tenta refletir o consenso predominante ou uma posição intermediária justificada.

Partidos de esquerda historicamente pequenos (PCB, PCO, PSTU, UP) foram classificados com base em fontes
que os agrupam como extrema-esquerda (CartaCapital, "Esquerda, volver!").

## Números do TSE — nunca inferidos, todos confirmados por busca

Todos os 30 números foram confirmados via WebSearch (não houve necessidade de usar `null` em nenhum
caso). Fontes cruzadas: CNN Brasil ("De 10 a 90: como são definidos os números dos partidos"), Ric.com.br,
Wikipédia (PT-BR e EN), sites oficiais dos partidos (ex.: redesustentabilidade.org.br, psd, progressistas.org.br)
e notícias do TSE.

## Cores

O campo `cor` foi preenchido apenas quando havia razoável confirmação por múltiplas fontes sobre a cor
predominante da identidade visual do partido (ex.: PT = vermelho, PSDB = azul, Novo = laranja, PV = verde,
PSB = amarelo). Para partidos "centrão" cuja identidade visual mistura verde/amarelo/azul da bandeira
nacional de forma pouco distintiva (PP, União Brasil, Republicanos, PSD, MDB) ou cuja cor não pôde ser
confirmada com segurança, o campo foi deixado como `null` — nenhuma cor foi inventada.

## Principais fontes consultadas

- https://pt.wikipedia.org/wiki/Lista_de_partidos_pol%C3%ADticos_do_Brasil
- https://en.wikipedia.org/wiki/List_of_political_parties_in_Brazil
- https://www.tse.jus.br/comunicacao/noticias/2026/Janeiro/brasil-tem-23-partidos-politicos-em-formacao
- https://ric.com.br/politica/numero-dos-partidos-politicos-2026-veja-a-lista-completa-e-atualizada/
- https://www.cnnbrasil.com.br/politica/de-10-a-90-entenda-como-sao-definidos-os-numeros-dos-partidos/
- https://www.cnnbrasil.com.br/politica/uniao-brasil-e-pp-oficializam-superfederacao-com-foco-nas-eleicoes-de-2026/
- https://pt.wikipedia.org/wiki/Uni%C3%A3o_Progressista
- https://www.tse.jus.br/comunicacao/noticias/2026/Marco/tse-aprova-registro-da-federacao-uniao-progressista-1
- https://www.camara.leg.br/noticias/1172750-solidariedade-e-prd-formam-federacao-e-passam-a-atuar-de-forma-conjunta,-com-dez-deputados
- https://en.wikipedia.org/wiki/PSOL_REDE_Federation
- https://conjur.com.br/2025-nov-04/missao-partido-politico-do-mbl-tem-registro-deferido-pelo-tse/
- https://www.tse.jus.br/comunicacao/noticias/2025/Novembro/tse-aprova-registro-e-homologa-estatuto-do-partido-missao
- https://conjur.com.br/2023-nov-09/tse-autoriza-fusao-de-ptb-e-patriota-para-criacao-do-prd/
- https://en.wikipedia.org/wiki/Democratic_Renewal_Party_(Brazil)
- https://www.scielo.br/j/dados/a/zzyM3gzHD4P45WWdytXjZWg/?format=html&lang=pt (Uma Nova Classificação Ideológica dos Partidos Políticos Brasileiros)
- https://jornaldebrasilia.com.br/noticias/politica-e-poder/novo-e-pl-sao-as-siglas-mais-a-direita-pstu-e-up-as-mais-a-esquerda-mostra-gps-partidario-2026/ (GPS Partidário, Folha, set/2026)
- https://revistacenarium.com.br/gps-partidario-novo-e-sigla-mais-a-direita-e-pstu-a-mais-a-esquerda-no-brasil/
- https://www.brasildefato.com.br/2024/10/29/eleicoes-2024-centro-e-direita-colocam-a-esquerda-em-sinal-de-alerta-para-2026/ (estudo citado pelo Congresso em Foco, 2024)
- https://www.cartacapital.com.br/politica/esquerda-volver-o-que-une-e-divide-up-pco-pstu-e-pcb/
- https://en.wikipedia.org/wiki/Popular_Unity_(Brazil)
- https://pt.wikipedia.org/wiki/Rede_Sustentabilidade
- https://pt.wikipedia.org/wiki/Cidadania_(partido_pol%C3%ADtico)
- https://pt.wikipedia.org/wiki/Democracia_Crist%C3%A3_(Brasil)
- https://pt.wikipedia.org/wiki/Agir_(Brasil)
- https://pt.wikipedia.org/wiki/Uni%C3%A3o_Brasil
- https://pv.org.br/opartido/os-12-valores-do-pv/

## Limitações

- O orçamento de buscas da sessão (WebSearch) se esgotou antes de confirmar independentemente as cores
  oficiais de todos os 30 partidos e antes de obter o texto completo do artigo da Gazeta do Povo sobre
  autodeclaração ideológica ("Apenas um partido se define como de direita no Brasil"); a referência a
  esse artigo foi mantida apenas como evidência indireta de divergência entre autodeclaração e
  classificação externa, sem citá-lo como fonte primária de nenhum partido específico.
- Nenhum número de partido foi inventado; todos os 30 foram confirmados cruzando ao menos duas fontes.
