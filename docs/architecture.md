# Arquitetura — Mapa das Pesquisas 2026

Site estático (GitHub Pages / Vercel) em TypeScript + Vite, sem framework de UI. Dados em JSON versionados no repositório, atualizados diariamente por uma Routine do Claude que faz commit e push. DDD + arquitetura hexagonal (ports & adapters).

## Bounded context único: `eleicoes`

Linguagem ubíqua:
- **Partido** — sigla, nome, número, `Espectro` (esquerda | centro-esquerda | centro | centro-direita | direita), federação.
- **Disputa (Race)** — `uf` + `cargo` (presidente | governador | senador) + `turno`. UF `BR` para presidente.
- **Pesquisa (Poll)** — instituto, `RegistroTSE`, período de campo, amostra, margem, cenário, fonte, lista de `ResultadoCandidato` (candidato, partido, pct).
- **Agregado (PollAggregate)** — média ponderada das pesquisas recentes de uma Disputa. Serviço de domínio `agregarPesquisas`: peso por recência (meia-vida em dias) e por amostra (raiz quadrada), janela de N dias; expõe líder, vantagem, `empateTecnico` (vantagem ≤ soma das margens ponderadas ou ≤ margem do último levantamento).
- **Cadeira do Senado (SenateSeat)** — uf, ocupante, partido, mandato (início/fim), `emDisputa2026`.
- **Projeção do Senado (SenateProjection)** — serviço de domínio: 27 cadeiras fixas (mandato até 2031) + 54 projetadas com os dois primeiros colocados do agregado de `senador` por UF; quando não há pesquisa, a cadeira fica `indefinida` (nunca inventa). Saída: assentos com partido, espectro, origem (`fixa` | `projetada` | `indefinida`).

Regras invariantes (no domínio, testadas):
- Pesquisa sem `registroTSE` é aceita mas marcada `naoRegistrada`; o agregado exibe a flag.
- Percentuais de candidatos entre 0 e 100; para `senador`, soma pode exceder 100 (dois votos).
- Partido de candidato desconhecido → espectro `indefinido` (cor neutra), nunca erro.

## Camadas (hexagonal)

```
src/
  domain/            entidades, value objects, serviços de domínio (puro, sem I/O)
    party.ts poll.ts race.ts aggregate.ts senate.ts spectrum.ts
  application/       casos de uso + ports (interfaces)
    ports.ts         PollRepository, PartyRepository, SenateSeatRepository, Clock
    use-cases/       getStateSummary, getPresidentialAggregate, projectSenate, listParties
  adapters/
    outbound/json/   JsonPollRepository etc. (lê data/*.json via import estático do Vite)
    inbound/web/     UI: map, state-panel, presidential, senate-hemicycle, parties-table, router
  ingest/            (Node CLI, fora do bundle) parsers Poder360/Wikipedia → data/*.json; testes com fixtures HTML
data/                parties.json, polls.json, senate-seats.json, meta.json
docs/                este documento, data-schema.md, design-system.md, ux-spec.md
```

Dependências apontam para dentro: `adapters → application → domain`. O domínio não importa nada de fora. A UI só chama casos de uso. Trocar a fonte de dados (JSON → API) é trocar um adaptador outbound.

## Fluxo de dados

1. Routine diária (Claude) roda em sessão nova: pesquisa novas pesquisas (WebSearch; scrapers quando a rede permitir), atualiza `data/*.json`, roda `npm test`, faz commit/push na branch principal.
2. GitHub Actions (`deploy.yml`) constrói com Vite e publica em Pages a cada push.
3. O site carrega os JSON embutidos no bundle; `meta.json` traz `atualizadoEm`.

## Decisões
- **Mapa**: `@svg-maps/brazil` (CC-BY-4.0, atribuição no rodapé). Sem projeção nem GeoJSON: 27 paths com id = UF.
- **Sem framework**: DOM + TS; componentes como funções `render(container, viewModel)`. Mantém bundle pequeno e Pages simples.
- **Testes**: vitest, cobrindo domínio, casos de uso e parsers.
- **Design**: tokens da Linear em CSS variables (`docs/design-system.md`), tema escuro padrão, claro via `prefers-color-scheme`.
- **Cor do espectro**: escala 5 níveis vermelho → azul; líder com margem = cor cheia; empate técnico = cor com 45% de opacidade + hachura.
