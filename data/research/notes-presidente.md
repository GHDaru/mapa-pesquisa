# Notas de pesquisa — Eleição presidencial 2026

Levantamento feito em 2026-09-13, via WebSearch (WebFetch/curl bloqueados no ambiente). Base para
`data/research/polls-presidente.json`.

## Candidatos principais e partidos (confirmados via busca)

| Candidato | Partido (vice) | Situação |
|---|---|---|
| Luiz Inácio Lula da Silva | PT (vice: Geraldo Alckmin, PSB) | Registro validado pelo TSE em 02/09/2026 |
| Flávio Bolsonaro | PL (vice: Alfredo Gaspar) | Registro validado pelo TSE em 02/09/2026 |
| Augusto Cury | Avante (vice: Júlio Delgado) | Escritor, estreante; terceira força na maioria das pesquisas (7–12%) |
| Ronaldo Caiado | PSD | Aparece sobretudo em cenários de 2º turno alternativos |
| Romeu Zema | Novo (vice: Eduardo Girão) | Registro validado pelo TSE em 02/09/2026; geralmente com 3–5% |
| Renan Santos | Missão (partido novo, fundado por ele/MBL) | Perfil "ultraliberal", pauta de costumes conservadora |
| Pablo Marçal | PRTB (contestado) | Inelegível até 2032 (Lei da Ficha Limpa); filiação ao PRTB questionada na Justiça Eleitoral; seu registro seguia em julgamento no TSE em setembro/2026. Institutos vêm testando cenários "com e sem Marçal". |
| Samara Martins | UP (vice: Raquel Brício) | Candidatura validada, votação marginal nas pesquisas |
| Hertz Dias | PSTU (vice: Vanessa Portugal) | Candidatura validada, votação marginal |
| Edmilson Costa | PCB (vice: Cleusa Santos) | Candidatura validada, votação marginal |

Havia, em 02/09/2026, ainda 7 outros pedidos de registro de candidatura presidencial em julgamento no
TSE (total de 13 pedidos), incluindo Caiado e Cury — por isso alguns institutos tratam esses nomes como
"pré-candidatos" em pesquisas de agosto.

## O que cada fonte oferece

- **Gazeta do Povo — hub `/eleicoes/2026/pesquisa-eleitoral-2026/`**: agrega, em texto corrido, praticamente
  toda pesquisa nacional de presidente divulgada (Quaest, Datafolha, PoderData, AtlasIntel, Real Time Big
  Data, Futura Inteligência, Gerp, Meio/Ideia, Indexa/Broadcast, Nexus/BTG). Traz datas de campo, amostra,
  margem de erro e, às vezes, o número de registro no TSE. É a melhor fonte única para uma rotina diária
  de varredura, mas os slugs de URL de pesquisas do mesmo instituto em datas próximas às vezes são quase
  idênticos (ex.: duas matérias "datafolha-presidente-setembro-2026" e "...-2"), o que exige conferir a
  data de campo dentro do texto, não só a URL.
- **Agência Sertão (`agenciasertao.com/eleicoes/pesquisas.php?protocolo=...`)**: republica dados brutos do
  registro de pesquisas do TSE por protocolo. Cada resultado de busca já entrega o número de protocolo no
  formato `BR-NNNNN/2026` embutido na própria URL (ex.: `protocolo=BR017202026` → `BR-01720/2026`). É a
  melhor fonte para casar instituto + data de divulgação + registroTSE, mas não traz os percentuais dos
  candidatos — é preciso cruzar com uma notícia.
- **TSE — consulta de pesquisas registradas** (`https://pesqele-divulgacao.tse.jus.br/`) e a notícia
  institucional (`tse.jus.br/comunicacao/noticias/...`): fonte oficial do registro (obrigatório por lei,
  Lei 9.504/97 art. 33) e das validações de candidatura. Não foi possível abrir esse sistema diretamente
  neste ambiente (WebFetch bloqueado); só apareceu em resultados de busca.
- **Wikipédia em português — "Pesquisas de opinião para a eleição presidencial no Brasil em 2026"** e a
  subpágina `/Primeiro_Turno/2026/Janeiro_a_Agosto`: parecem ser as páginas mais completas em formato de
  tabela agregada (todas as pesquisas nacionais, 1º e 2º turnos, desde 2022/2023). Não consegui abrir o
  conteúdo integral (sem WebFetch), então os dados desta pesquisa vieram de notícias primárias, não dessa
  página — mas ela é a melhor candidata para virar a fonte central de uma rotina diária, se o pipeline
  final puder buscar HTML de páginas da Wikipédia.
- **Poder360 / PoderData**: publica pesquisas próprias (parceria "PoderData/Aya") com boa frequência
  (a cada 1–2 semanas). Não ficou claro, pelas buscas, o papel exato de "Aya" (executora de campo?
  correalizadora?) — ver lacuna abaixo.
- **CNN Brasil, Exame, JOTA, Metrópoles, Poder360, Congresso em Foco, Band, Terra, Revista Oeste, Brasil de
  Fato, Agência Brasil**: republicam notícias de cada pesquisa isoladamente, quase sempre com o número
  exato (casas decimais) e datas de campo — boas fontes de checagem cruzada quando a Gazeta do Povo não
  detalha o suficiente.

## Melhores URLs para uma rotina diária de busca

1. `https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/` — hub principal, atualizado a
   cada nova pesquisa nacional de presidente.
2. `https://pt.wikipedia.org/wiki/Pesquisas_de_opini%C3%A3o_para_a_elei%C3%A7%C3%A3o_presidencial_no_Brasil_em_2026`
   (+ subpágina `/Primeiro_Turno/2026/Janeiro_a_Agosto`) — provável tabela agregada mais completa.
3. `https://agenciasertao.com/eleicoes/pesquisas.php?protocolo=<PROTOCOLO>&uf=BR` — para confirmar/():
   casar `registroTSE` depois de descobrir o protocolo via busca (`site:agenciasertao.com <instituto> presidente 2026`).
4. `https://www.poder360.com.br/poder-eleicoes-2026/` — cobre PoderData e costuma noticiar rapidamente
   pesquisas de terceiros também.
5. `https://www.tse.jus.br/eleicoes/pesquisa-eleitorais/consulta-as-pesquisas-registradas` — fonte oficial
   do TSE para registro de pesquisas (não testada diretamente neste ambiente).
6. Sites dos institutos quando existirem página própria de estudos: `https://www.nexus.fsb.com.br/estudos-divulgados/`
   (Nexus/BTG) e `https://paranapesquisas.com.br/pesquisas/` (Paraná Pesquisas).

## Lacunas e incertezas encontradas

- **Paraná Pesquisas — presidente nacional (BR)**: não consegui confirmar, com data e fonte específicas,
  uma pesquisa nacional (UF="BR") de presidente do instituto em agosto/setembro de 2026. As buscas só
  trouxeram pesquisas estaduais do Paraná (governador/senador) e resultados de outros institutos (Real
  Time Big Data) sobre o eleitorado paranaense na disputa presidencial, além de pesquisas de jan–mar/2026
  já antigas. Por isso Paraná Pesquisas **não entrou** no JSON final — recomendo checar diretamente
  `paranapesquisas.com.br/pesquisas/` numa rotina futura.
- **Instituto Datasensus**: encontrei o registro no TSE (`BR-00140/2026`, pesquisa de presidente divulgada
  em 06/09/2026) mas não os percentuais dos candidatos nos resultados de busca — não incluí essa pesquisa
  no JSON por não conseguir confirmar os números.
- **Nexus/BTG — pesquisa de campo 4–7/set (registro BR-06790/2026)**: mais recente que a de 28–30/ago que
  entrou no JSON, mas a cota de buscas da sessão se esgotou antes de eu confirmar os percentuais. Vale
  buscar primeiro numa próxima rotina.
- **`registroTSE` não encontrado** para: Gerp (todas as edições), Futura Inteligência, Real Time Big Data
  (a 24/jul, embora a de 1/set tenha sido confirmada), PoderData de 23–26/ago, e a pesquisa Indexa/Broadcast
  de 20–23/ago (o protocolo `BR-06597/2026` encontrado é de uma pesquisa Indexa de 04/set, possivelmente
  diferente). Ficaram como `null` com explicação no campo `observacao`, conforme instruído.
- **`contratante` não encontrado** para: Datafolha (instituto do Grupo Folha, tradicionalmente sem
  contratante externo declarado nas notícias), Gerp, Real Time Big Data, Futura Inteligência e Veritá.
- **Datas de publicação estimadas** (marcadas em `observacao`): para Datafolha de 1–3/set e PoderData de
  23–26/ago e 30/ago–2/set, a busca deu o período de campo com clareza mas não a data exata de divulgação;
  usei uma estimativa de 1–2 dias após o fim do campo (padrão do setor) e sinalizei isso no JSON.
- **Cenários de 2º turno** cobertos: Lula x Flávio Bolsonaro (a maioria dos institutos), Ronaldo Caiado x
  Lula (Real Time Big Data). Não encontrei, nesta rodada, pesquisas recentes com percentuais para outros
  pares (ex.: Zema x Lula, Renan Santos x Lula), embora o Meio/Ideia mencione testar cenários com Cury,
  Caiado, Zema e Renan Santos sem informar os números exatos de cada um.
- **Duas notícias quase homônimas da Gazeta do Povo para Datafolha** (`datafolha-presidente-setembro-2026`
  e `...-2`): mapeei uma para a pesquisa de campo 1–3/set e outra para a de 8–10/set com base no conteúdo
  resumido pela busca, mas não abri as páginas para confirmar 100% qual URL corresponde a qual pesquisa —
  os números em si (38/32 e 39/35) foram confirmados por múltiplos resultados de busca independentes.
- Não há WebFetch/curl neste ambiente, então nenhuma página foi lida por inteiro — todos os dados vieram de
  trechos/resumos que o WebSearch devolveu. Antes de publicar em produção, vale reabrir as URLs listadas em
  `fonte.url` com uma ferramenta capaz de baixar HTML, para conferir números, brancos/nulos e datas exatas.

## Histórico maio–agosto

Levantamento complementar feito em 2026-09-13 (mesmo ambiente, só WebSearch) para popular o gráfico de
tendência com pesquisas nacionais de presidente publicadas entre 1º/05 e 19/08/2026 — período anterior ao
início do `data/research/polls-presidente.json` (que só cobre a partir de 20/08/2026). Resultado:
`data/research/polls-presidente-historico.json`, mesmo esquema, `uf: "BR"`, `cargo: "presidente"`. **38
entradas**: **21 de 1º turno** (meta 20–30, atingida) e **17 de 2º turno Lula x Flávio Bolsonaro/Flávio
Bolsonaro x Lula** (meta 10, superada). IDs conferidos por script Node contra o arquivo principal — nenhuma
colisão e nenhum duplicado internos. Institutos cobertos com pelo menos uma pesquisa confirmada no período:
Quaest (5 rodadas: 13/mai, 10/jun, 15/jul, 05/ago e 14/ago — as duas de agosto são pesquisas **distintas**,
não a mesma republicada), Datafolha (2: ~20/jun estimado e 24/jul), AtlasIntel/Bloomberg (3: 19/mai, 01/jul
e 29/jul), Real Time Big Data (2: 01/jun e 21/jul), PoderData (2: ~17/jul estimado e 30/jul), Nexus/FSB-BTG
Pactual (1: 15/jun), Ideia/Meio S.A. (1: 08/jul), Gerp (2: ~08/jul estimado e 11/ago — só 1º turno nesta
última), Futura Inteligência (1: 11/ago, só 1º turno) e CNT/MDA (2: 16/jun e ~11/ago estimado — só 1º turno
na de agosto), instituto que não aparecia no arquivo principal e foi acrescentado por já ter pesquisa
nacional de presidente no período.

### Achado relevante: pesquisa AtlasIntel suspensa pelo TSE em junho/2026

Durante a varredura apareceu uma decisão do TSE (liminar do min. Kassio Nunes Marques, referendada em
sessão colegiada) suspendendo a divulgação de uma pesquisa AtlasIntel sobre a disputa presidencial,
registro **BR-06939/2026**, por suspeita de indução ao eleitor — o PL alegou que o questionário foi
construído para prejudicar Flávio Bolsonaro, e o próprio CEO da AtlasIntel reconheceu viés no conteúdo
submetido aos entrevistados; o TSE frisou que outras 27 pesquisas da AtlasIntel não tinham o mesmo problema.
**Essa pesquisa (BR-06939/2026) não entrou no JSON**: como a divulgação foi suspensa e não encontrei os
percentuais que ela teria mostrado, não havia números confiáveis para registrar, e incluir uma pesquisa
judicialmente contestada sem sinalização adequada pareceu arriscado para o gráfico de tendência. Vale
reavaliar numa rotina futura se o processo no TSE terminou liberando ou anulando definitivamente os dados.
Não confundir com a pesquisa AtlasIntel de 19/mai/2026 (registro não encontrado, mas sem qualquer menção de
contestação), que é a que entrou no JSON como a rodada de maio.

### Institutos da lista da tarefa sem pesquisa nacional confirmada no período

- **Paraná Pesquisas**: única pesquisa nacional (BR) de presidente localizada no período tem campo
  25–28/03/2026 (antes da janela pedida); não encontrei rodada nacional entre mai–ago/2026 nos resultados de
  busca (só pesquisas estaduais do Paraná). Não incluída.
- **Meta, Ipespe**: não apareceram em nenhum resultado de busca como institutos com pesquisa nacional de
  presidente no período — pode ser que não tenham publicado pesquisa presidencial nacional nessa janela, ou
  que o nome "Meta" colida com termos de busca genéricos (rede social, "meta" de campanha) e atrapalhe achar
  a pesquisa real, se existir.

### Lacunas e menores confianças específicas desta rodada

- **Quaest, registro BR-07661/2026 (rodada de 10/jun)**: extraído de uma resposta sintetizada de busca, sem
  citação literal de manchete confirmando o número — confiança menor que as demais rodadas Quaest. Datas de
  campo (5–8/jun) inferidas por analogia ao padrão de intervalo campo→divulgação do próprio instituto nas
  demais rodadas do período, não citadas literalmente para esta rodada específica.
- **Quaest de 14/ago, contratante "Rede Globo"**: apareceu assim numa única resposta sintetizada; diverge do
  padrão usual "Genial/Quaest" com contratante Genial. Mantido no JSON com essa ressalva na `observacao` —
  vale conferir diretamente com o instituto ou TSE numa rotina futura.
- **AtlasIntel de 19/mai**: percentuais do 1º turno (Lula 47 / Flávio 34,3) vieram de resposta sintetizada
  sem confirmação por manchete direta; o 2º turno (48,9/41,8) tem confirmação melhor (título de matéria da
  CNN Brasil).
- **Real Time Big Data de 21/jul**: o registro no TSE apareceu associado, em buscas diferentes, ora a esta
  rodada ora à de maio/junho (BR-05864/2026) — mantive como `null` por segurança, já que os números de 1º e
  2º turno em si vieram de manchetes diretas e batem entre si.
- **Gerp de 11/ago e CNT/MDA de ~11/ago**: só entraram com 1º turno; não consegui confirmar com segurança os
  percentuais exatos de 2º turno associados a cada uma (havia números de 2º turno parecidos atribuídos de
  forma inconsistente entre pesquisas Gerp próximas, e nenhum número exato de 2º turno para o CNT/MDA de
  agosto — só a vantagem em pontos percentuais do 1º turno, "13,7 p.p.", usada para deduzir por subtração o
  percentual de Flávio Bolsonaro, o que está sinalizado na `observacao` daquela entrada).
- **Futura Inteligência de 11/ago**: só 1º turno; o 2º turno foi descrito como "empate técnico" sem
  percentuais exatos nas fontes consultadas.
- Como no levantamento original, nenhuma página foi lida por inteiro (sem WebFetch/curl) — todos os números
  vieram de trechos/resumos do WebSearch, cruzados manualmente entre múltiplas buscas quando possível para
  reduzir o risco de o resumo automático combinar dados de pesquisas diferentes (isso de fato aconteceu
  algumas vezes durante a varredura, por exemplo confundindo o registro TSE de uma rodada AtlasIntel de
  julho com o de uma rodada de agosto — os números finais só entraram no JSON depois de reconciliados por
  título de matéria específico).
