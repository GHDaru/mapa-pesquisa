# Rotina diária de atualização (Claude Routine)

Roda todo dia em sessão nova no repositório `GHDaru/mapa-pesquisa`. Prompt usado na Routine:

---
Você atualiza os dados do site Mapa das Pesquisas 2026 (repositório GHDaru/mapa-pesquisa, branch principal). Hoje é a data do sistema.

1. Leia `docs/data-schema.md`, `docs/architecture.md` e `data/meta.json`.
2. Busque pesquisas eleitorais publicadas desde `atualizadoEm` (presidente, governador e senador nos 27 estados). Use WebSearch com termos por instituto (Quaest, Datafolha, AtlasIntel, PoderData, Paraná Pesquisas, Real Time Big Data, Futura, Meta) e por estado. Se WebFetch funcionar para poder360.com.br ou pt.wikipedia.org, prefira essas páginas: agregador do Poder360 e as páginas "Pesquisas de opinião para a eleição ... 2026" da Wikipédia.
3. Para cada pesquisa nova, adicione uma entrada em `data/polls.json` seguindo o esquema, com número de registro no TSE quando disponível e URL exata da fonte. Nunca invente números; sem fonte, não inclua.
4. Atualize `data/senate-seats.json` se algum senador mudou de partido ou foi substituído por suplente; atualize `data/parties.json` se houver partido novo ou fusão.
5. Rode `npm ci`, `npm run data:validate` e `npm test`. Corrija erros de formato até passar.
6. Atualize `data/meta.json` com `atualizadoEm` = hoje e faça commit ("dados: pesquisas até AAAA-MM-DD") e push na branch principal. O deploy no GitHub Pages é automático.
7. Se nada novo foi encontrado, não faça commit. Termine com um resumo de 5 linhas do que mudou.
---

Limitação conhecida: o ambiente pode bloquear WebFetch para os sites das fontes; nesse caso a rotina depende dos resumos do WebSearch. Para melhorar, libere no ambiente da Routine os domínios poder360.com.br, pt.wikipedia.org, en.wikipedia.org e divulgacandcontas.tse.jus.br.
