# Notas de pesquisa — Senado Federal (setembro/2026)

Gerado em 2026-09-13. Fontes: buscas web (WebSearch) — WebFetch/curl bloqueados nesta sessão, então os dados vêm de trechos/resumos retornados pela busca, não da leitura integral das páginas. **A sessão atingiu o limite de 200 buscas web** antes de concluir todas as verificações planejadas (em especial a Tarefa 2 inteira e algumas confirmações pontuais da Tarefa 1). Isso está detalhado na seção "Lacunas" abaixo.

## 1. Distribuição por partido das 27 cadeiras fixas (eleitas em 2022, mandato 2023–2031, não disputadas em 2026)

| Partido | Cadeiras |
|---|---|
| PL | 7 |
| União | 4 |
| Republicanos | 3 |
| PSD | 3 |
| PT | 3 |
| PP | 3 |
| MDB | 1 |
| PSB | 1 |
| Sem Partido | 1 (Romário/RJ) |
| Não confirmado | 1 (RS — ver Lacunas) |

Total: 27.

## 2. Distribuição atual das 81 cadeiras (ocupante em exercício, setembro/2026)

| Partido | Cadeiras |
|---|---|
| PSD | 14 |
| PL | 13 |
| MDB | 9 |
| PT | 9 |
| PP | 7 |
| União | 6 |
| PSB | 6 |
| Republicanos | 5 |
| Podemos | 3 |
| PSDB | 2 |
| PDT | 2 |
| Sem Partido | 2 |
| Novo | 1 |
| Avante | 1 |
| Não confirmado | 1 (RS) |

Total: 81 (80 com partido identificado + 1 cadeira do RS eleita em 2022 cujo ocupante não foi confirmado nesta sessão).

Essa distribuição é **compatível em ordem de grandeza** com o que uma busca específica sobre a "composição atual do Senado" indicou de forma agregada (PL maior bancada com PSD logo atrás, MDB e PT em seguida, PP na sequência), o que dá alguma confiança na compilação, mas cada linha individual do `senate-seats.json` deve ser conferida com a fonte oficial (`legis.senado.leg.br/dadosabertos/senador/lista/atual`) antes de uso em produção, pois:
- várias filiações partidárias são voláteis (trocas frequentes de partido, especialmente em ano eleitoral);
- não foi possível ler as páginas oficiais na íntegra (só resumos de busca).

## 3. Pesquisas de Senado por estado (Tarefa 2)

**Nenhuma pesquisa eleitoral de Senado com números (percentuais por candidato) foi coletada nesta sessão.** O arquivo `data/research/polls-senador.json` foi entregue como array vazio (`[]`) deliberadamente, para não inventar dados.

Motivo: o orçamento de buscas web da sessão (200 chamadas) foi consumido inteiramente durante a Tarefa 1 (confirmação de titulares/partidos das 81 cadeiras, estado a estado), antes que qualquer busca dedicada a pesquisas de intenção de voto para Senado ("pesquisa Senado <UF> 2026", "Quaest senador <UF>", "Poder360 senado <UF>", "Genial/Quaest", "Paraná Pesquisas senado <UF>" etc.) pudesse ser executada. Nenhuma pergunta desse tipo foi feita para nenhum dos 27 estados.

Indícios encontrados incidentalmente (não verificados, sem números, não incluídos no JSON):
- Amapá: há pelo menos uma matéria da Gazeta do Povo ("Pesquisa mostra três favoritos ao Senado pelo Amapá em 2026", novembro/2025) que indica existir pesquisa de Senado publicada para o AP — precisa ser buscada e lida para extrair instituto, datas, amostra e números.
- Não foi possível determinar, para nenhum dos 27 estados, quem lidera as duas vagas em disputa.

### Recomendação para concluir a Tarefa 2
Repetir a pesquisa em uma nova sessão (ou com limite de busca elevado), com pelo menos 1 busca dedicada por estado a pesquisas de Senado, priorizando os institutos mais ativos (Quaest, Paraná Pesquisas, AtlasIntel, Real Time Big Data, Idealiza) e agregadores (Poder360, Gazeta do Povo). Sempre buscar o registro TSE do estudo (`divulgacaoeleicaoregistrada.tse.jus.br`) e a URL exata da matéria.

## 4. Lacunas e itens não confirmados na Tarefa 1

Todas as observações abaixo também estão gravadas no campo `observacao` da respectiva cadeira em `senate-seats.json`.

- **RS — cadeira eleita em 2022 (mandato 2023–2031):** não foi possível identificar com segurança quem é o titular. Campos `senador` e `partido` foram deixados `null` propositalmente. **Prioridade alta para verificação.**
- **CE — Cid Gomes:** conflito forte entre conhecimento prévio (registro amplamente divulgado de falecimento em outubro/2023) e o resumo de busca desta sessão (que o descreveu como candidato à reeleição em 2026). Não confirmado; a cadeira foi preenchida com o nome eleito em 2018 (Cid Gomes, PSB) por padrão, mas **precisa de verificação urgente** antes de uso — é possível que um(a) suplente esteja em exercício.
- **CE — Camilo Santana:** licenciado como Ministro da Educação; a titularidade tem alternado entre as suplentes Augusta Brito (PT) e Janaína Farias (PT); não confirmado quem exerce o mandato em setembro/2026.
- **MT — Carlos Fávaro:** é Ministro da Agricultura desde 2023; não confirmado se está licenciado com suplente em exercício.
- **AP — Randolfe Rodrigues:** partido informado como PT (busca desta sessão); historicamente era filiado à REDE. Não confirmado se há licença/afastamento.
- **AL — Rodrigo Cunha → Eudócia Caldas:** confirmado que Cunha renunciou em 29/12/2024 (assumiu vice-prefeitura de Maceió) e a suplente Eudócia Caldas assumiu a titularidade; partido dela (PSDB) não totalmente confirmado.
- **SP — Major Olimpio → "Giordano":** Major Olimpio (titular eleito em 2018) faleceu em janeiro/2022; suplente identificado apenas pelo primeiro nome "Giordano" nas buscas, sem partido definido ("Giordano, no party"). Nome completo e partido não confirmados.
- **RR — Roberta Acioly:** segundo as buscas, assumiu o mandato em 11/03/2026 (indício de suplência); não foi possível identificar o titular eleito em 2018 que ela substituiu.
- **SC — Jorge Seif → Hermes Klann:** Jorge Seif (PL), eleito em 2022, está licenciado; o primeiro suplente Hermes Klann (PL) está em exercício, segundo as buscas.
- **PR — Sergio Moro:** a cadeira eleita em 2022 pelo Paraná pertence a Sergio Moro (União Brasil); a busca dedicada a confirmar seu status atual (titular/licenciado/renunciado) foi bloqueada pelo esgotamento do limite de buscas antes de ser executada. **Verificar prioritariamente**, pois há rumores públicos (não confirmados nesta sessão) sobre mudanças na sua situação em 2025–2026.
- **MA — Lourdinha Pereira:** ocupante da cadeira eleita em 2022 pelo Maranhão, obtida de uma única busca agregada, sem confirmação cruzada.
- Filiações partidárias com fontes conflitantes nesta sessão (valor escolhido é o mais provável, mas não 100% confirmado): Ângelo Coronel/BA (PSD vs. Republicanos), Eliziane Gama/MA (PSD vs. PT), Carlos Viana/MG (PSD vs. Podemos), Efraim Filho/PB (União Brasil, segundo conhecimento prévio, vs. PL segundo a busca), Soraya Thronicke/MS (União Brasil, segundo conhecimento prévio, vs. PSB segundo a busca), Alessandro Vieira/SE (Cidadania historicamente vs. MDB segundo a busca), Romário/RJ (PL/Podemos historicamente vs. "sem partido" segundo a busca).

## 5. Metodologia / limitações gerais

- Sem acesso a WebFetch/curl: todos os dados vieram de resumos gerados pela própria ferramenta de busca a partir de trechos de página, não da leitura integral das fontes primárias (Senado Federal, TSE).
- O limite de 200 buscas web da sessão foi atingido durante a Tarefa 1, impedindo a conclusão de verificações adicionais e a execução completa da Tarefa 2.
- `fonte` em `senate-seats.json` aponta, na maioria das linhas, para a página genérica do Senado por UF (`https://www25.senado.leg.br/web/senadores/por-uf/-/uf/<UF>`), pois os resumos de busca não retornaram sempre a URL exata do artigo com o fato específico (ex.: data exata de posse de suplente). Isso deve ser refinado numa passada de verificação com leitura direta das fontes.
