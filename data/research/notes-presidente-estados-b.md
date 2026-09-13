# Pesquisas presidenciais por estado — bloco B (AC, AM, AP, PA, RO, RR, TO, AL, MA, PB, PI, RN, SE)

Fonte de dados: `data/research/polls-presidente-estados-b.json`. Todas as pesquisas foram localizadas via WebSearch (sem acesso a WebFetch/curl), a partir de manchetes e trechos de matérias — não foi possível abrir as páginas originais na íntegra em todos os casos. Números vêm de títulos/trechos explícitos das fontes citadas; quando houve conflito entre resumos de diferentes buscas para a mesma pesquisa, priorizei o número que aparece no título/slug da matéria mais direta (ex.: Poder360). Onde não foi possível confirmar um dado (datas de campo, amostra, margem, registro TSE), usei `null` e expliquei em `observacao`.

## Quem lidera em cada estado (1º turno, pesquisa mais recente do bloco)

| UF | Líder | Pesquisa mais recente | Situação |
|---|---|---|---|
| AC | **Flávio Bolsonaro** (42%) x Lula (25%) | Quaest, 23-26/08 | Flávio lidera com folga nas duas pesquisas do estado (Quaest e Real Time Big Data) |
| AL | **Lula** (51%) x Flávio (30%) | Real Time Big Data, publ. 01/09 | Lula lidera com folga nas duas pesquisas |
| AM | Empate técnico: Flávio (41,3%) x Lula (39,1%) | AtlasIntel, 29/08-03/09 | Dentro da margem de erro nas duas pesquisas e nos dois turnos; no 2º turno Flávio também aparece ligeiramente à frente |
| AP | Empate técnico: Lula (34%) x Flávio (32%) | Real Time Big Data, 03-07/09 | Diferença dentro da margem de erro (2 p.p.) em ambas as pesquisas de 1º turno; no 2º turno Lula abre vantagem um pouco maior (45% x 41%) |
| MA | **Lula** (62%) x Flávio (25%) | Real Time Big Data, 05-09/09 | Um dos estados de maior vantagem de Lula no país; confirmado também pela Quaest (58% x 20%) |
| PA | **Lula** (41%) x Flávio (31%) | Real Time Big Data, 03-07/09 | Lula lidera com folga nas duas pesquisas (RTBD e Quaest) e nos dois turnos |
| PB | **Lula** (55%) x Flávio (26%) — RTBD é a pesquisa com o maior N amostral; Quaest (mais recente) traz 50% x 21% | Quaest, 21-24/08 (mais recente) e RTBD, 19-22/08 | Lula lidera com folga larga nas duas pesquisas |
| PI | **Lula** (63,9%) x Flávio (15%) | AtlasIntel, 16-21/06 | Vantagem enorme para Lula; ver observação sobre lacuna de uma 2ª pesquisa mais recente |
| RN | **Lula** (56%) x Flávio (27%) | Real Time Big Data, 05-09/09 | Confirmado pela Quaest (54% x 20%); Lula também vence com folga no 2º turno (62% x 30%) |
| RO | **Flávio Bolsonaro** (45%) x Lula (25%) | Quaest, 21-24/08 | Um dos estados de maior vantagem de Flávio no país; confirmado pela Real Time Big Data (58% x 25%, e 66% x 24% no 2º turno) |
| RR | **Flávio Bolsonaro** (62%) x Lula (18%) | Real Time Big Data, 05-09/09 | Maior vantagem de Flávio entre os estados do bloco; confirmado pela Quaest (52% x 17%) |
| SE | **Lula** (53%) x Flávio (19%) — Quaest é a mais recente; RTBD (60% x 23%) é de julho/agosto | Quaest, publ. 27/08 | Lula vence com folga em todos os cenários testados |
| TO | Empate técnico no 1º turno: Lula e Flávio empatados em 37% | Real Time Big Data, 21-25/08 | Um dos estados mais disputados do bloco; no 2º turno Flávio abre vantagem (45% x 39%). Quaest (mesma janela) mostra Lula um pouco à frente (37% x 32%) |

## Padrão regional

Os dados confirmam o padrão já observado nacionalmente: **Lula lidera com folga nos estados nordestinos do bloco** (MA, PB, PI, RN, SE, AL), enquanto **Flávio Bolsonaro lidera com folga em boa parte dos estados do Norte** (AC, RO, RR), e há **empate técnico em AM, AP e TO** — os três estados do Norte mais disputados.

## Lacunas e observações importantes

- **PI (Piauí):** só foi possível confirmar com segurança **uma** pesquisa estadual específica (AtlasIntel, 16-21/06/2026, registro PI-00806/2026 e BR-08344/2026). Há menções soltas no Poder360 a números de 2º turno mais recentes e maiores (67,3% x 20,6%; 68,3% x 24,4%), mas sem conseguir confirmar com segurança o instituto, a data de campo e o par de 1º turno correspondente — por isso não foram incluídos, para não arriscar inventar/combinar números de pesquisas diferentes. **Recomendo nova busca dedicada** (ideal: acesso direto ao Poder360/Gazeta do Povo) para atualizar o dado do Piauí, que está desatualizado (~3 meses) em relação ao restante do bloco.
- **AL (Alagoas):** não foi localizada pesquisa de 2º turno específica para o estado nas buscas realizadas.
- **RR (Roraima):** idem — sem pesquisa de 2º turno específica localizada.
- **RO (Rondônia):** a pesquisa Quaest de 21-24/08 não trouxe cenário de 2º turno específico para o estado nas fontes localizadas; usei o 2º turno da Real Time Big Data (14-15/07), mais antigo. Há um número avulso não confirmado ("Flávio 44% x Lula 43%") que pode ser mais recente, mas não consegui atribuí-lo com segurança a instituto/data.
- **AM (Amazonas):** a pesquisa Quaest (registro BR-09140/2026, campo 21-25/08) teve seus percentuais de 1º turno reconstruídos a partir de agregadores regionais (amazonas1.com.br, bncamazonas.com.br), já que a matéria original não pôde ser aberta — os números (Lula 38% x Flávio 33%) são consistentes entre as fontes secundárias consultadas, mas recomendo confirmação adicional se o dado for usado com alta precisão.
- **Registros TSE:** foram confirmados para AM (AM-04939/2026 e BR-01799/2026, AtlasIntel), AC (BR-08086/2026, RTBD), RO (BR-05580/2026, RTBD), PI (PI-00806/2026, AtlasIntel), RN (RN-00876/2026, Quaest) e PB (PB-07850/2026, Quaest). Para as demais pesquisas do bloco (a maioria Quaest estaduais e várias RTBD), o registro específico não apareceu nos resultados de busca — ficou `null` com observação.
- **Datas de campo/amostra/margem** não confirmadas com precisão para várias pesquisas (principalmente Quaest estaduais menores e alguns RTBD) — sinalizado em `observacao` em cada entrada.
- Vários números vieram de resumos automáticos de busca que, em alguns casos, contradiziam o título da própria matéria-fonte (ex.: Acre, Tocantins). Sempre que houve conflito, priorizei o número explícito no título/slug da URL da matéria mais direta e registrei a alternativa em `observacao` quando relevante.

## Metodologia

- Buscas cobriram Quaest, Real Time Big Data e AtlasIntel como principais institutos com cobertura estadual nas eleições presidenciais 2026.
- Para cada UF, tentei priorizar (a) a pesquisa mais recente e (b) uma segunda pesquisa de instituto diferente, para permitir comparação cruzada.
- Todas as pesquisas somam Lula (PT) e Flávio Bolsonaro (PL) como os dois principais nomes; alguns registros trazem também Augusto Cury (Avante), Ronaldo Caiado (PSD), Renan Santos (Missão) e Romeu Zema (Novo) quando o percentual estadual específico apareceu nos resultados de busca.
