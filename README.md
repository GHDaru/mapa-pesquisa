# Mapa das Pesquisas 2026

Site estático que mostra, por estado, quem lidera as pesquisas eleitorais de 2026 para governador e senador, um agregador nacional para presidente, o cadastro de partidos com espectro ideológico e uma projeção do Senado (27 cadeiras fixas até 2031 + 54 projetadas pelas pesquisas).

## Rodar localmente

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # vitest (domínio, casos de uso, adaptadores, UI)
npm run build      # typecheck + vite build → dist/
```

## Dados

- `data/polls.json`, `data/parties.json`, `data/senate-seats.json`, `data/meta.json` são gerados a partir de `data/research/*.json` por `npm run data:merge`.
- `npm run data:validate` valida tudo pelo domínio e resume cobertura por UF.
- Esquema em `docs/data-schema.md`. Toda pesquisa carrega instituto, datas, registro no TSE (quando divulgado) e URL da fonte. Nada é inventado: valores não confirmados ficam `null` com `observacao`.
- Auditorias independentes em `data/research/audit-dados*.md`.

## Arquitetura

DDD + hexagonal, descrita em `docs/architecture.md`: `src/domain` (puro), `src/application` (casos de uso e ports), `src/adapters/outbound/json` (repositórios) e `src/adapters/inbound/web` (UI em TypeScript sem framework, tokens do design system da Linear em `styles/tokens.css`).

## Publicação

- **GitHub Pages** (https://ghdaru.github.io/mapa-pesquisa/): workflow `.github/workflows/deploy.yml` faz build e deploy a cada push. É preciso habilitar uma vez em *Settings → Pages → Source: GitHub Actions*.
- **Vercel**: `vercel.json` já aponta `npm run build` e `dist/`.

## Atualização diária

Uma Routine do Claude acorda a sessão principal do projeto todos os dias às 09:00 (Brasília): três subagentes buscam pesquisas novas (presidente, governador, senador), gravam `data/research/polls-diario-AAAA-MM-DD-*.json`, e a sessão roda merge, validação e testes e faz push. Contrato em `docs/routine-diaria.md`; pendências em `docs/backlog-pesquisas.md`.

## Créditos

Mapa: [@svg-maps/brazil](https://github.com/VictorCazanave/svg-maps) (CC BY 4.0). Fontes das pesquisas: institutos citados em cada registro (Quaest, Datafolha, AtlasIntel, PoderData, Paraná Pesquisas, Real Time Big Data e outros), via Poder360, Wikipédia e imprensa.
