# Auditoria — Eleitorado (TSE 2026) e Pesquisas Presidenciais Estaduais

Data da auditoria: 2026-09-13. Método: WebSearch apenas (sem WebFetch/curl). Buscas usadas: 4 (eleitorado) + ~29 (pesquisas estaduais) = ~33 de um orçamento de até 40.

## 1. Eleitorado (`data/research/electorate.json`) vs TSE 2026

| UF | Valor no arquivo | Valor confirmado (TSE/TRE, jul/2026) | Status |
|---|---|---|---|
| SP | 34.104.226 | 34.104.226 (TSE, 21,48% do total) | ✅ Confere |
| MG | 16.377.659 | 16.377.659 (TSE) | ✅ Confere |
| RJ | 12.857.000 | 12.857.000 (TSE/TRE-RJ) | ✅ Confere |
| BA | 11.321.005 | 11.321.005 (TRE-BA) | ✅ Confere |
| RS | 8.526.233 | 8.526.233 (TRE-RS) | ✅ Confere |
| **Total nacional** | soma das 27 UFs no arquivo = **157.827.925** | TSE anuncia **158.745.463** eleitores aptos (nota "mais de 158 milhões", Julho/2026, reafirmada em Setembro/2026) | ⚠️ Diferença de **917.538** (~0,58%) |

**Observação sobre o total nacional:** os 5 valores auditados batem exatamente com o TSE, e o próprio texto da nota do TSE usada como fonte cita esses mesmos números de SP/MG/RJ/BA. A diferença entre a soma das 27 UFs do arquivo e o total nacional de 158.745.463 muito provavelmente corresponde aos eleitores registrados no **exterior** (zona eleitoral ZZ), que não são atribuídos a nenhuma UF e portanto não entram nas 27 entradas do arquivo — isso é consistente com o próprio schema (`docs/data-schema.md` pede "27 entradas, uma por UF"). **Não é um erro de dado nas 5 UFs auditadas**, mas o arquivo não deixa essa lacuna explícita em nenhum lugar; vale documentar isso (não é uma "correção" de valor, é uma nota de cobertura).

## 2. Pesquisas presidenciais estaduais — 1º turno mais recente por UF

| UF | Entrada mais recente (id) | Instituto/datas confere? | É amostra estadual real? | Top-2 % (arquivo vs. apurado) | Registro TSE | Pesquisa mais recente faltando? |
|---|---|---|---|---|---|---|
| SP | `2026-09-02-atlasintel-sp-presidente-t1` | ✅ | ✅ (1.810 entrevistados em SP) | 39,9/36,0 vs 39,9/36,0 ✅ | SP-06964/2026 ✅ | **SIM** — Quaest/Genial (campo 04-07/09, registro SP-00959/2026) é mais recente, ver §3 |
| MG | `2026-09-09-quaest-mg-presidente-t1` | ✅ | ✅ (1.506, MG) | 31,0/27,0 vs 31/27 ✅ | MG-04716/2026 ✅ | Não encontrada |
| RJ | `2026-09-11-datafolha-rj-presidente-t1` | ✅ datas/instituto | ⚠️ **Não é amostra estadual dedicada** — é recorte do RJ dentro da amostra nacional Datafolha (n=2002 Brasil); isso já está corretamente sinalizado na `observacao` do próprio arquivo | 39,0/35,0 — não verificável isoladamente (é recorte, não achei nota primária com o número do recorte) | BR-01833/2026 (nacional, correto p/ recorte) | Não confirmado com certeza (há indício de pesquisa AtlasIntel/RJ na mesma semana — inconclusivo, ver §4) |
| RS | `2026-09-10-realtimebigdata-rs-presidente-t1` | ✅ | ✅ (1.600, RS) | 42,0/39,0 vs 42/39 ✅ | BR-00631/2026 ✅ (confirmado nas fontes primárias, apesar do prefixo BR) | Não encontrada |
| PR | `2026-09-11-realtimebigdata-pr-presidente-t1` | ✅ | ✅ (1.600, PR) | 45,0/29,0 vs 45/29 ✅ | BR-07275/2026 ✅ | Não encontrada |
| GO | `2026-09-03-atlasintel-go-presidente-t1` | ✅ datas/instituto/amostra | ✅ (1.214, GO) | **Arquivo tem `pct: null` para todos** — apurado: Flávio 38,2 / Lula 26,9 / Caiado 19,2 | **Arquivo tem `null`** — apurado: GO-05293/2026 | Não encontrada (mas o próprio registro está incompleto — ver §3) |
| BA | `2026-09-09-realtimebigdata-ba-presidente-t1` | ✅ | ✅ (1.600, BA) | 55,0/24,0 vs 55/24 ✅ | BR-06566/2026 ✅ | Não encontrada |
| PE | `2026-09-11-datafolha-pe-presidente-t1` | ✅ | ✅ (1.204, PE, amostra própria — diferente do caso do RJ) | 55,0/24,0 vs 55/24 ✅ | PE-04411/2026 ✅ | Não encontrada |
| PA | `2026-09-08-real-time-big-data-pa-presidente-t1` | ✅ | ✅ (1.600, PA) | 41,0/31,0 vs 41/31 ✅ | **Arquivo tem `null`** — apurado: BR-04485/2026 | Não encontrada |
| MA | `2026-09-10-real-time-big-data-ma-presidente-t1` | ✅ | ✅ (1.600, MA) | 62,0/25,0 vs 62/25 ✅ | **Arquivo tem `null`** — apurado: BR-00377/2026 | Não encontrada |
| AM | `2026-09-04-atlasintel-am-presidente-t1` | ✅ | ✅ (1.185, AM) | 41,3/39,1 vs 41,3/39,1 ✅ | AM-04939/2026 ✅ | Não encontrada |
| AC | `2026-08-27-quaest-ac-presidente-t1` | ✅ instituto/data de publicação | ✅ (804, AC) | 42,0/**25,0** vs 42,0/**25,0 ou 30,0** ⚠️ — fontes secundárias divergem (título/URL do Poder360 diz "lula-25"; um resumo agregado da mesma matéria menciona "30% no cenário sem Marçal"). **Não consegui resolver com certeza dentro do orçamento de buscas** | **Arquivo tem `null`** — apurado: BR-07015/2026 | Não encontrada |

Legenda: ✅ confere / ⚠️ divergência ou pendência.

## 3. Correções recomendadas (arquivo, id, campo, valor antigo → novo)

| Arquivo | id | Campo | Valor antigo | Valor novo recomendado | Confiança |
|---|---|---|---|---|---|
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-go-presidente-t1` | `resultados[0].pct` (Ronaldo Caiado) | `null` | `19.2` | Alta |
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-go-presidente-t1` | `resultados[1].pct` (Flávio Bolsonaro) | `null` | `38.2` | Alta |
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-go-presidente-t1` | `resultados[2].pct` (Lula) | `null` | `26.9` | Alta |
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-go-presidente-t1` | `margem` | `2.0` | `3.0` | Alta |
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-go-presidente-t1` | `registroTSE` | `null` | `"GO-05293/2026"` | Alta |
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-go-presidente-t1` | `observacao` | Afirma que "Ronaldo Caiado... lidera no estado, à frente de Lula e de Flávio Bolsonaro" | **Factualmente incorreto no 1º turno**: Flávio Bolsonaro lidera (38,2%), seguido por Lula (26,9%) e só depois Caiado (19,2%) — Caiado só lidera nos cenários de 2º turno testados. Reescrever a observação. | Alta |
| `polls-presidente-estados-a.json` | `2026-09-03-atlasintel-ba-presidente-t1` | `registroTSE` | `null` | `"BR-07739/2026"` | Média-alta |
| `polls-presidente-estados-b.json` | `2026-09-08-real-time-big-data-pa-presidente-t1` | `registroTSE` | `null` | `"BR-04485/2026"` | Alta |
| `polls-presidente-estados-b.json` | `2026-09-10-real-time-big-data-ma-presidente-t1` | `registroTSE` | `null` | `"BR-00377/2026"` | Alta |
| `polls-presidente-estados-b.json` | `2026-08-27-quaest-ac-presidente-t1` | `resultados[1].pct` (Lula) | `25.0` | **Verificar manualmente** — pode ser `25.0` (cenário com Marçal, mais citado) ou `30.0` (cenário sem Marçal, citado em ao menos uma fonte agregada) | Baixa — não corrigir sem checar a matéria original do Poder360 |

Nenhum arquivo JSON foi editado — estas são recomendações para quem mantém os dados.

## 4. Pesquisas faltantes (entrada mais recente que falta no arquivo)

### SP — Quaest/Genial, mais recente que a entrada atual (AtlasIntel, 02/09)

```json
{
  "id": "2026-09-08-quaest-sp-presidente-t1",
  "uf": "SP",
  "cargo": "presidente",
  "turno": 1,
  "instituto": "Quaest",
  "registroTSE": "SP-00959/2026",
  "contratante": "Globo Comunicação e Participações S/A",
  "dataInicio": "2026-09-04",
  "dataFim": "2026-09-07",
  "publicadoEm": "2026-09-08",
  "amostra": 1800,
  "margem": 2.0,
  "cenario": "estimulada, cenário principal (1º turno) — amostra estadual de São Paulo",
  "fonte": { "nome": "CartaCapital", "url": "https://www.cartacapital.com.br/politica/quaest-flavio-bolsonaro-tem-30-em-sp-contra-29-de-lula/" },
  "resultados": [
    { "candidato": "Flávio Bolsonaro", "partido": "PL", "pct": 30.0 },
    { "candidato": "Luiz Inácio Lula da Silva", "partido": "PT", "pct": 29.0 }
  ],
  "observacao": "Pesquisa Quaest/Genial (mesma rodada que gerou as matérias sobre MG, RJ, DF e PE) com campo mais recente (04-07/09) do que a entrada AtlasIntel de 02/09 atualmente tratada como 'mais recente' para SP. ATENÇÃO: veículos divergem no valor exato — CartaCapital publicou ao menos duas manchetes para o mesmo período de campo ('Flávio 30 x Lula 29' e, em outra matéria, 'empatam' / '31 x 30'); confirmar o número definitivo diretamente na Quaest/Genial antes de usar em produção."
}
```

Este item é o mais importante da seção: ele desatualiza o campo "pesquisa estadual mais recente" de SP no arquivo atual.

Para RJ, há um indício (não confirmado com confiança suficiente para virar entrada) de que AtlasIntel também rodou pesquisa no RJ na mesma semana da rodada de SP/GO/BA/AM (fonte: Jota, "AtlasIntel: Flávio avança no Centro-Oeste, e Lula, no Rio de Janeiro"), o que poderia ser uma pesquisa estadual dedicada mais recente que o Real Time Big Data de 02/09 hoje registrado como a amostra estadual própria mais recente do RJ. Não incluí como entrada por falta de confirmação de instituto/data/percentuais dentro do orçamento de buscas — sinalizo como pendência de verificação, não como pesquisa faltante confirmada.

## 5. Veredito

**Publicável hoje (SIM/NÃO): NÃO.**

**Maior lacuna:** a entrada de Goiás (`2026-09-03-atlasintel-go-presidente-t1`, arquivo `polls-presidente-estados-a.json`) — que hoje é a pesquisa presidencial estadual mais recente de 1º turno usada para GO — está com os **percentuais dos candidatos como `null`** (nenhum número publicável) **e** carrega uma observação que **inverte o resultado real do 1º turno**, atribuindo a liderança a Ronaldo Caiado quando na verdade Flávio Bolsonaro lidera (38,2%) à frente de Lula (26,9%) e do próprio Caiado (19,2%, apenas 3º lugar no 1º turno). Publicar o mapa hoje faria uma de duas coisas erradas para GO: mostrar "sem dado" onde há dado disponível, ou herdar a narrativa incorreta da observação. Isso, somado à pesquisa de SP desatualizada (falta a rodada Quaest de 04-07/09, mais recente que a atualmente usada) e às lacunas de registro TSE em BA/PA/MA, deixa a base abaixo do padrão de publicação — mas são correções pontuais e bem delimitadas, não um problema estrutural do dataset.
