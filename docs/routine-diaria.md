# Rotina diária de atualização (Claude Routine)

Roda todo dia às 23:00 UTC (20:00 em Brasília). A Routine **acorda a sessão
principal do projeto** (a mesma sessão do Claude Code que desenvolve o site),
porque só ela tem credenciais de push para `GHDaru/mapa-pesquisa`. Sessões
novas criadas pela Routine não recebem o repositório como fonte (o push
volta 403 pelo proxy e não há conector GitHub) — foi o que travou a
primeira versão da rotina entre 13 e 15/09.

O horário é 20:00 de Brasília, e não de manhã, porque os institutos
liberam as rodadas ao longo do dia: a execução de 16/09 às 09:15 varreu
os três cargos e voltou vazia. A primeira tentativa de correção, 18:00,
ainda era cedo: o Datafolha nacional divulga às 19:15. Às 20:00 o dia
está fechado.

## Contrato da execução

Data de hoje (UTC) = `HOJE`. Última atualização = `atualizadoEm` em `data/meta.json`.

1. **Sincronizar**: `git pull origin claude/mapa-eleitoral-brasil-uhl8ol`.
2. **Buscar** (3 subagentes em paralelo, só WebSearch — WebFetch às fontes está bloqueado):
   - presidente (nacional `BR` e presidenciais por estado);
   - governador (27 UFs);
   - senador (27 UFs, 2 vagas por estado).

   Cada subagente procura pesquisas **publicadas entre `atualizadoEm` e `HOJE`**
   que ainda não estejam na base (mesmo instituto + mesma data de campo + mesma
   UF + mesmo turno = já existe) e grava
   `data/research/polls-diario-HOJE-<cargo>.json` (array no esquema de
   `docs/data-schema.md`; `[]` se não houver nada). Regras duras:
   - nunca inventar números: só entra pesquisa com instituto, percentuais,
     período de campo ou data de publicação e URL da fonte no resumo da busca;
   - `registroTSE` quando aparecer; senão `null` com explicação em `observacao`;
   - id `AAAA-MM-DD-instituto-uf-cargo-tN` pela data de publicação; 2º turno
     com um registro por confronto (`-t2-lula-flavio`);
   - siglas de partido como em `data/parties.json`;
   - conferir o próprio arquivo com `npm run data:merge -- --date HOJE` e
     `npm run data:validate`, depois desfazer a mesclagem
     (`git checkout -- data/polls.json data/meta.json data/parties.json data/senate-seats.json data/electorate.json`).

   **Atenção à corrida**: esse `git checkout` de limpeza dos subagentes
   apaga uma mesclagem que a sessão principal já tenha feito. Só rode a
   mesclagem do passo 3 depois que os **três** agentes tiverem terminado,
   e confira o total em `data/polls.json` antes de commitar.
3. **Mesclar e validar**: `npm run data:merge -- --date HOJE`,
   `npm run data:validate`, `npm test`. Corrigir só formato dos arquivos novos.
4. **Publicar**: commit `dados: pesquisas até HOJE` (ou
   `dados: verificação HOJE, sem pesquisas novas` — `meta.json` muda mesmo
   assim, para o site mostrar quando foi a última checagem) e
   `git push -u origin claude/mapa-eleitoral-brasil-uhl8ol` com retry
   (2/4/8/16 s). O deploy no GitHub Pages é automático.
5. **Backlog**: pesquisas anteriores à janela que os agentes notarem faltando
   vão para `docs/backlog-pesquisas.md` (não são buscadas no mesmo dia).
6. **Resumo** de 5 linhas: novas por cargo, institutos, lacunas, push/deploy.

Regras gerais: nunca editar pesquisas antigas para "passar" na validação;
nunca incluir identificador de modelo em commits ou arquivos; orçamento
de ~20 min por execução.

## Arquivos por dia

Os arquivos `data/research/polls-diario-AAAA-MM-DD-*.json` são cumulativos:
`ingest/merge-research.ts` lê todos os `polls-*.json`, deduplica por `id` e
reescreve `data/polls.json`. Não é preciso mexer nos blocos antigos.

## Histórico

- 2026-09-13: Routine criada em modo "sessão nova" — nunca conseguiu fazer push (sem credenciais). Desativada em 2026-09-16.
- 2026-09-16: primeira atualização aplicada manualmente com o contrato acima (pesquisas de 12–16/09) e Routine recriada acordando a sessão principal.
- 2026-09-16 (12:14 UTC): primeira execução automática. Os três agentes voltaram vazios — nada havia sido publicado às 09:15 BRT. Horário movido para 18:00 BRT. Na mesma execução, a auditoria da Quaest de 07/09 foi resolvida (ver `docs/backlog-pesquisas.md`).
- 2026-09-16 (21:04 UTC): execução das 18:00. Uma pesquisa nova, a DataTrends nacional (primeira do instituto para presidente).
- 2026-09-17: dia cheio (26 pesquisas novas: AtlasIntel nacional/PR/PE, Gerp, PoderData, Datafolha PI, Neokemp PR, RTBD SC e TO, DataTempo, F5 Atualiza Dados). Horário movido de 18:00 para 20:00 BRT porque o Datafolha nacional divulga às 19:15. Documentada a corrida entre o `git checkout` dos subagentes e a mesclagem da sessão principal.
- 2026-09-18: 5 pesquisas novas. Aberto o alerta de integridade nas quatro rodadas do Instituto Veritá (indícios de fraude: ~62% de linhas duplicadas numa amostra de 1.220 no AM). Regra desde então: nenhuma rodada nova do instituto entra; a ocorrência é reportada para decisão humana.
- 2026-09-19: rodada normal. Encerradas duas pendências do backlog.
- 2026-09-20: domingo sem divulgação — nenhum instituto publicou. A execução preencheu uma lacuna anterior (Futura de 17/09) em vez de voltar vazia.
- 2026-09-21: rodada cheia. Um agente reportou uma pesquisa do Palver datada de 20/09 que **não existia** — a ficha era internamente inconsistente (5.000 entrevistas com margem de ±4; campo encerrando no mesmo dia da divulgação) e duas outras checagens a contradiziam. Ficou fora, e no dia 21 a rodada real apareceu com a ficha correta. Lição: ficha inconsistente é motivo para descartar, não para incluir com observação.
- 2026-09-22: dois agentes se contradisseram sobre o Datafolha do CE. O que disse "não saiu" só tinha varrido o recorte presidencial; a rodada existia (Ciro 47 x Elmano 40). Lição registrada: **"não saiu" só vale para o cargo que aquele agente varreu** — o resumo precisa dizer qual. Na mesma execução, corrigido um palpite meu: eu havia passado ao agente que a rodada da AtlasIntel no CE de 21/09 era Lula 51,6 x 25,7; o agente provou que esses eram os números de 04/09 e trouxe os corretos (56,6 x 33,8), confirmados depois por busca independente. Removida também uma pesquisa com contratante "Rede Record de Televisão" inferido de um calendário, não afirmado pela matéria.
- 2026-09-23: fechada a cobertura de 2º turno Lula x Flávio em AL, RR e SC. Registradas no backlog as armadilhas bloqueadas.
- 2026-09-24 e 25: rodadas normais. Em 25/09 o usuário decidiu que as quatro pesquisas do Veritá **permanecem na base com o alerta**, em vez de serem removidas. TO fechou o 2º turno; RO é a última lacuna (só o Veritá tem rodada lá, e está suspensa).
- 2026-09-26: fora da rotina, auditoria das somas dos 125 recortes ao corrigir as categorias de não-candidato. Alagoas no 2º turno presidencial somava 109,28% porque cada grafia de "brancos/nulos" virava uma linha própria no agregado. Corrigido. A auditoria revelou um bug pendente: os recortes de governador no 2º turno misturam confrontos diferentes e mostram três pessoas num returno de duas (ver `docs/backlog-pesquisas.md`).
