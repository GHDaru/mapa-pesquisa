# Notas — Pesquisas Governador 2026 (SP, RJ, MG, ES, PR, SC, RS, GO, MT, MS, DF)

Estados sob responsabilidade deste levantamento: SP, RJ, MG, ES, PR, SC, RS, GO, MT, MS, DF.
Dados brutos em `data/research/polls-governador-sul-sudeste-co.json` (cargo = "governador", turno 1).
Pesquisas obtidas via WebSearch (WebFetch/curl bloqueados) — números vêm de resumos de matérias (Gazeta do Povo, Poder360, CNN Brasil, Exame, Metrópoles, CartaCapital, Brasil de Fato, EM.com.br etc.), não da fonte primária (site do instituto ou TSE), portanto tratar como boa aproximação, não como transcrição oficial.

## São Paulo (SP)
- **Líder:** Tarcísio de Freitas (Republicanos), com vantagem folgada em todas as pesquisas (42–49,7%).
- **2º colocado:** Fernando Haddad (PT), 27–34,5%.
- Demais candidatos (Vera Lúcia/PSTU, Carlos Machado/PCB, Edjane Policiais/Agir, Vivian Mendes/UP, Izadora Dias/PCO) somam menos de 5% no total (Paraná Pesquisas).
- **Lacunas:** registro TSE da Quaest de setembro divergiu entre fontes (SP-06946/2026 vs SP-00959/2026) — mantido `null` no JSON até confirmação; margem de erro da Datafolha não encontrada; contratante da Paraná Pesquisas não identificado.

## Rio de Janeiro (RJ)
- **Líder:** Eduardo Paes (PSD), com folga em todas as pesquisas de agosto/setembro (39–43,6%).
- **2º colocado:** Douglas Ruas (PL), 18–27,6% — variação grande entre institutos (Quaest mostra Ruas mais baixo que AtlasIntel/Paraná Pesquisas).
- **3º colocado:** Anthony Garotinho (Republicanos), 8–10,7%.
- Observação: Cláudio Castro (PL, ex-governador) migrou a candidatura para o Senado do RJ, não aparece mais nas pesquisas de governador de agosto/setembro.
- **Lacunas:** nenhuma crítica; candidatos menores e brancos/nulos não detalhados nos resumos.

## Minas Gerais (MG)
- **Líder:** Cleitinho Azevedo (Republicanos) em todas as pesquisas recentes, mas com variação de intensidade: 32% (Quaest) a 41% (AtlasIntel) e 37% (Datafolha).
- **Disputa pelo 2º lugar:** Patrus Ananias (PT) e Alexandre Kalil (PDT) tecnicamente empatados nas pesquisas Datafolha e Quaest (11–13%); AtlasIntel mostra Patrus destacado em 2º com 30% (divergência relevante entre institutos, atenção ao consolidar).
- Mateus Simões (PSD, indicado por Romeu Zema) aparece em posição inferior (4–8%), atrás de Patrus e Kalil.
- Romeu Zema (NOVO) está inelegível para reeleição (limite de mandatos).
- **Lacunas:** nenhuma crítica relevante; pequena divergência entre institutos quanto à ordem do 2º lugar deve ser tratada com cautela no mapa.

## Espírito Santo (ES)
- **Situação:** disputa mais apertada da amostra — Real Time Big Data (mais recente, 04–08/09) mostra Ricardo Ferraço (MDB) na frente com 43% x 33% de Lorenzo Pazolini (Republicanos); Paraná Pesquisas (22–26/08) mostrava os dois praticamente empatados (39,0% Pazolini x 38,2% Ferraço).
- Helder Salomão (PT) aparece distante, com 7,5%.
- Paulo Hartung (PSD) foi citado em pesquisa Quaest de julho como tecnicamente empatado com Ferraço/Pazolini, mas não foi possível obter números percentuais confiáveis dessa rodada — não incluído no JSON.
- **Lacunas:** não foi encontrada pesquisa de instituto com registro TSE claro para uma 3ª rodada mais recente (setembro) além da Real Time Big Data; Quaest de agosto/julho não teve números percentuais localizados com segurança.

## Paraná (PR)
- **Líder:** Sergio Moro (PL) em todas as pesquisas (37–45%).
- **2º lugar disputado:** Requião Filho (PDT) e Sandro Alex (PSD, candidato apoiado pelo governador Ratinho Júnior) alternam posição conforme o instituto — Paraná Pesquisas põe Requião Filho à frente (24% x 17,5%), enquanto Alfa Inteligência inverte (Sandro Alex 26% x Requião Filho 20%).
- Ratinho Júnior (governador atual, PSD) está inelegível para reeleição consecutiva.
- **Lacunas:** amostra e margem de erro da pesquisa Paraná Pesquisas de 02–03/09 não localizadas nos resumos consultados.

## Santa Catarina (SC)
- **Líder folgado:** Jorginho Mello (PL, governador atual), com 50–51,6% em ambas as pesquisas (Quaest e AtlasIntel).
- **2º lugar:** João Rodrigues (PSD), 17–18,5%.
- Gelson Merísio (PSB) cresceu de 4% (agosto, Quaest) para 17,6% (setembro, AtlasIntel) — variação a confirmar com mais pesquisas.
- **Lacunas:** nenhuma crítica relevante.

## Rio Grande do Sul (RS)
- **Disputa apertada:** AtlasIntel (27/08–01/09) mostra Zucco (PL) com vantagem clara sobre Juliana Brizola (PDT) — 44,3% x 37,5%; já Real Time Big Data (05–09/09), pesquisa mais recente, mostra empate técnico (36% x 35%), com Gabriel Souza (MDB, vice-governador) em terceiro com 22%.
- Eduardo Leite (PSD, governador atual) está inelegível para reeleição consecutiva.
- **Lacunas:** divergência relevante entre AtlasIntel e Real Time Big Data quanto à distância entre os dois primeiros — sinalizar no mapa como corrida em aberto; não foi localizada pesquisa Quaest recente com números completos para RS.

## Goiás (GO)
- **Líder:** Daniel Vilela (MDB, atual governador/ex-vice de Caiado), com folga: 37% (agosto, Quaest) a 45,1% (setembro, Paraná Pesquisas) — índice suficiente para vitória em 1º turno segundo a pesquisa mais recente.
- **2º lugar:** Marconi Perillo (PSDB), 20–23,2%.
- Wilder Morais aparece em pesquisa de agosto (Quaest) com 12%, partido não confirmado na fonte consultada (registrado como `null` no JSON).
- Ronaldo Caiado (União Brasil/ex-governador) renunciou em março de 2026 para concorrer à Presidência; sua influência política permanece forte no estado (citada nas matérias sobre a candidatura de Gracinha Caiado ao Senado).
- **Lacunas:** partido de Wilder Morais não confirmado.

## Mato Grosso (MT)
- **Disputa dividida entre institutos:** Paraná Pesquisas (06–08/09) mostra Otaviano Pivetta (Republicanos, vice-governador) na frente com 40,8% x 30,0% de Wellington Fagundes (PL, senador); já Real Time Big Data (29/08–02/09) mostra ordem invertida — Fagundes 34% x Pivetta 27%, com Doutora Natasha (PSD) em 3º com 13%.
- Cerca de 50% dos eleitores ainda indecisos segundo Paraná Pesquisas — corrida em aberto.
- **Lacunas:** divergência de ordem entre os dois primeiros colocados entre institutos deve ser tratada com cautela; não foi localizada pesquisa Quaest recente para MT com números completos de governador.

## Mato Grosso do Sul (MS)
- **Líder:** Eduardo Riedel (PP, governador atual), com folga: 42–49% conforme o instituto.
- **2º lugar:** Fábio Trad (PT), 26%.
- Riedel tem índice para vencer no 1º turno segundo mais de um instituto (AtlasIntel e Quaest de agosto, este último não incluído no JSON por falta de datas de campo confirmadas).
- **Lacunas:** margem de erro da pesquisa Real Time Big Data (setembro) não encontrada; percentual de Fábio Trad nessa mesma pesquisa foi inferido a partir da "vantagem de 16 pontos" citada na matéria, não de um número percentual explícito — sinalizado no campo `observacao`.

## Distrito Federal (DF) — cargo: governador do Distrito Federal
- **Cenário de empate técnico:** Quaest (21–24/08) mostra Celina Leão (PP, atual governadora, ex-vice de Ibaneis Rocha) com vantagem confortável (34% x 20% de Arruda/PSD x 13% de Leandro Grass/PT); já AtlasIntel (27/08–01/09), mais recente, mostra Celina e Grass tecnicamente empatados (30,7% x 29%), com Arruda caindo para 14,2%.
- Paula Belmonte (PSDB) e Cappelli (PSB) aparecem com 8,2% e 5,8% respectivamente (AtlasIntel).
- Ibaneis Rocha (ex-governador) renunciou em março de 2026 por suspeita de ligação com o escândalo do Master; não é candidato.
- **Lacunas:** uma das fontes associou à pesquisa AtlasIntel também um registro "BR-04726/2026", possivelmente relativo ao cenário presidencial testado na mesma rodada — mantido apenas o registro específico DF-02018/2026 no JSON.

## Resumo de lacunas gerais (para o time de dados)
1. Registro TSE da Quaest-SP (setembro) inconsistente entre fontes — precisa confirmação direta no sistema DivulgaCandContas/TSE.
2. Vários campos `margem`/`amostra`/`contratante` ficaram `null` quando o resumo da matéria não trazia o dado (não foi inventado nenhum número).
3. Em MG, PR, RS e MT há divergência relevante de ordem entre 2º/3º colocados conforme o instituto — recomenda-se, no mapa, indicar "empate técnico"/"disputa aberta" nesses casos em vez de cravar um único favorito para a 2ª posição.
4. Todas as fontes usadas são secundárias (matérias de imprensa que citam os institutos), não o PDF/registro original do TSE — recomenda-se validação pontual antes de publicação final se o rigor exigido for alto.
