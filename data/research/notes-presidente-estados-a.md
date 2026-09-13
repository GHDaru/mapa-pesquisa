# Pesquisas presidenciais por estado — bloco A (SP, MG, RJ, RS, PR, SC, ES, GO, DF, MT, MS, BA, PE, CE)

Levantamento feito só com WebSearch (sem WebFetch/curl) em 2026-09-13, a 3 semanas do 1º turno (04/10). Dados em `data/research/polls-presidente-estados-a.json`, 39 registros. Nem sempre foi possível confirmar todos os campos do esquema (amostra, margem, registroTSE, contratante); onde faltou, usei `null` + `observacao` em vez de inventar.

## Quem lidera em cada estado (pesquisa mais recente encontrada)

| UF | Líder no 1º turno | Situação | 2º turno Lula x Flávio (mais recente) |
|---|---|---|---|
| SP | Flávio Bolsonaro (39,9% x 36,0%, Atlas/Estadão) | Empate técnico | Flávio 46,8% x Lula 43,3% |
| MG | Lula (RTBD: 39% x 34%; Quaest: 31% x 27%) | Lula à frente nas duas | Quaest: Flávio 40% x Lula 37% (empate técnico); RTBD: Lula 46% x Flávio 44% (também empate técnico) — MG é o estado mais indefinido do bloco |
| RJ | Datafolha (crosstab nacional): Flávio 39% x Lula 35%; RTBD (amostra própria): Flávio 36% x Lula 34% | Empate técnico nas duas | Datafolha: Flávio 49% x Lula 41% |
| RS | Flávio Bolsonaro 42% x Lula 39% (RTBD) | Empate técnico | Flávio 53% x Lula 42% |
| PR | Flávio Bolsonaro 45% x Lula 29% (RTBD, set/26); 44% x 31% (RTBD, ago/26) | Flávio com vantagem clara e estável | Flávio 60% x Lula 30% |
| SC | Flávio Bolsonaro 48% x Lula 25% (Atlas); 45% x 20% (Quaest) | Flávio com grande vantagem | Não encontrado (nenhuma das duas pesquisas trouxe 2º turno Lula x Flávio para SC) |
| ES | Empate técnico 35% x 35% (RTBD, set/26); 35% x 34% (RTBD, ago/26) | Um dos estados mais equilibrados | Flávio 47% x Lula 42% |
| GO | Ronaldo Caiado (PSD, ex-governador) lidera — não é corrida Lula x Flávio | Caso especial: candidato local forte | Caiado 62,4% x Lula 29,8% (2º turno mais citado); em Flávio x Lula: Flávio 56% x Lula 33% |
| DF | Flávio Bolsonaro 42,4% x Lula 36,8% (Atlas) | Flávio à frente | Flávio 47,4% x Lula 42,5% |
| MT | Percent Brasil (mai/26): Flávio 44,6% x Lula 29,8% | Flávio com vantagem grande e crescente | AtlasIntel (set/26): Flávio 59,1% x Lula 35,2% |
| MS | IPEMS (set/26): Flávio 46,36% x Lula 25,84%; Ranking (ago/26): Flávio 40% x Lula 33% | Flávio com vantagem grande | Ranking: Flávio 52% x Lula 38% |
| BA | Lula 55% x Flávio 24% (RTBD); 55,7% x 25,7% (Atlas) | Lula dispara | Lula 61% x Flávio 30% (RTBD) |
| PE | Lula 55% x Flávio 24% (Datafolha, set/26) | Lula dispara | Lula 61% x Flávio 30% |
| CE | Lula 61% x Flávio 19% (RTBD) | Lula dispara | Lula 65% x Flávio 27% |

**Padrão geral confirmado pelas fontes:** Lula domina o Nordeste (BA, PE, CE — e, segundo mapa da Quaest citado na imprensa, também AL, MA, PA, PB, RN, SE); Flávio Bolsonaro lidera com folga no Centro-Oeste (MT, MS, DF) e no Sul (PR, RS, SC); SP, MG e RJ estão em empate técnico/indefinição, os três maiores colégios eleitorais do país. Goiás é o caso fora da curva por causa da candidatura do ex-governador Ronaldo Caiado (PSD).

## Lacunas e observações importantes

1. **SP**: só foi encontrada uma pesquisa com amostra própria e dedicada ao estado (AtlasIntel/Estadão, SP-06964/2026). As pesquisas Quaest e Datafolha "de SP" citadas na imprensa nesta janela eram, na verdade, pesquisas nacionais com registro `BR-`; não incluí essas por não configurarem pesquisa estadual dedicada. Faltou achar uma 2ª pesquisa estadual própria.
2. **RJ**: usei o recorte/crosstab do Rio de Janeiro dentro da pesquisa nacional Datafolha (BR-01833/2026) como a mais recente, com `amostra: null` porque o tamanho da subamostra do RJ não foi divulgado nas fontes — é diferente de uma pesquisa com amostra própria representativa do RJ (que é o caso da Real Time Big Data, RJ-08350/2026).
3. **SC**: nenhuma das duas pesquisas mais recentes trouxe cenário de 2º turno Lula x Flávio; não há registro de 2º turno no JSON para SC.
4. **GO**: a corrida presidencial no estado é dominada pelo candidato local Ronaldo Caiado (PSD), não por Lula x Flávio. Incluí três entradas: 1º turno (Atlas, percentuais não confirmados — `null`), 2º turno Caiado x Lula (Atlas, 62,4% x 29,8%) e 2º turno Flávio x Lula (RTBD, recorte nacional, 56% x 33%). A 2ª pesquisa de 1º turno usada é de maio/2026 (Real Time Big Data, BR-02402/2026) — bem mais antiga que as demais do bloco, incluída por falta de opção mais recente com dados completos.
5. **MT**: a pesquisa AtlasIntel de setembro só apareceu nas fontes com o número do 2º turno (59,1% x 35,2%); o 1º turno ficou `null` com observação. A 2ª pesquisa de 1º turno (Percent Brasil, com dados completos) é de abril-maio/2026, desatualizada frente à de setembro.
6. **MS**: a pesquisa mais recente (IPEMS, 12/set) não trouxe 2º turno; usei o 2º turno mais recente disponível, de uma rodada de agosto/2026 do Ranking Brasil Inteligência, cujas datas de campo exatas, amostra e registro TSE não foram confirmados nas fontes (`null` + observação).
7. **PE**: a 2ª pesquisa mais recente de 1º turno é de abril/2026 (BR-01221/2026); a fonte só informou a diferença de 27 pontos entre Lula e Flávio, sem percentuais exatos — ficou `null` + observação. Não achei pesquisa estadual dedicada a PE entre abril e setembro além da Datafolha de 8-10/set.
8. **CE**: só uma pesquisa com dados completos e amostra própria foi confirmada (Real Time Big Data, BR-05643/2026), apesar de a imprensa citar que Datafolha, Quaest, AtlasIntel e Paraná Pesquisas também pesquisaram o Ceará — os percentuais específicos dessas outras não foram confirmados dentro do orçamento de buscas.
9. **DF**: a pesquisa Real Time Big Data de agosto só trouxe números do cenário espontâneo (Lula 24% x Flávio 21%); o estimulado foi descrito apenas como "empate técnico", sem percentuais — por isso a entrada desse poll ficou marcada como cenário espontâneo, e não estimulado.
10. Vários `registroTSE` e `contratante` não foram confirmados nas fontes de notícia consultadas (ficaram `null`); isso é comum quando o veículo não reproduz a ficha técnica completa da pesquisa.

## Metodologia
Buscas via WebSearch (WebFetch/curl bloqueados) cobrindo institutos Quaest, Datafolha, AtlasIntel, Real Time Big Data, Paraná Pesquisas, Percent Brasil, IPEMS e Ranking Brasil Inteligência. Priorizei pesquisas com amostra própria e dedicada ao estado (registro estadual, ex. `SP-`, `MG-`, `RJ-`); quando só havia recorte regional de pesquisa nacional (registro `BR-`), usei mas sinalizei em `observacao`. Todos os percentuais foram tirados de manchetes/trechos de artigos jornalísticos retornados pela busca — não foi possível abrir os PDFs originais de registro no TSE para conferir a ficha técnica completa (amostra exata, brancos/nulos/não sabe etc.).
