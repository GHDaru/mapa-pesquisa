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

## O que esta rotina faz AGORA (a partir de 05/10/2026)

O 1º turno foi em 04/10 e o resultado saiu: **Flávio Bolsonaro (PL) 47,50% x
Lula (PT) 44,61%** dos votos válidos, com 2º turno em **25/10**. A varredura
diária de pesquisas **perdeu o objeto** — não há rodada nova para achar até a
campanha do 2º turno começar.

A Routine (`trig_018yVtxvZDNPS4BLx8P3nzxg`) foi **repropósita em 05/10**, com o
nome trocado para "fechar o 1º turno e abrir o 2º". O prompt dela mudou; o
agendamento (23:00 UTC, 20:00 BRT) e o histórico de execuções foram
preservados, em vez de recriar o gatilho e perder os dois.

A ordem de prioridade passou a ser:

1. **Fechar a ficha nacional em `data/apuracao.json`.** Ela está em 84,96% das
   seções e com só os dois primeiros colocados. Falta: votos absolutos de todos
   os candidatos, `validosTotal`, brancos/nulos/abstenções, e uma fonte que
   afirme o encerramento. **Escrever ENCERRADA na `observacao`** é o que faz a
   tela trocar "contagem parcial" por "resultado final" e **liga a seção de
   ranking de institutos**, que está construída e desligada pelo limiar de
   99,5% de seções (`LIMIAR_APURACAO_ENCERRADA`).
2. **Presidente por estado** — a lacuna mais custosa. Sem ela a projeção por
   estado, construída e testada, não tem insumo, e não há como separar erro de
   pesquisa de viés de ordem de apuração.
3. **Fechar os recortes parciais de governador**: BA 67,11%, MG 81,15%,
   SP 90,02%. PR (99,17%) e RS (97,40%) já estão bons.
4. **Senador**, que não tem nenhum recorte de apuração.
5. **Pesquisas só de 2º turno**, quando a campanha começar, com o recorte
   reduzido ao confronto Lula x Flávio.

Quando a apuração estiver fechada e o ranking ligado, o ciclo de 2026 está
cumprido e a rotina deve ser desligada ou reapontada para o 2º turno.

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
   (2/4/8/16 s).

   **Conferir o deploy, não supor.** O workflow roda `npm test` ANTES de
   `npm run build`: suíte vermelha = deploy falho = site parado, com o push
   tendo funcionado normalmente. Esperar a conclusão e ler o resultado:

   ```
   gh api "repos/GHDaru/mapa-pesquisa/actions/runs?head_sha=<sha>"
   ```

   Só dizer que o deploy funcionou depois de ver `conclusion: success`.
   Entre 28/09 e 01/10 o deploy falhou quatro vezes seguidas e foi relatado
   como automático e bem-sucedido nas quatro; o site ficou cinco dias
   mostrando a base de 27/09.
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
- 2026-10-04 (dia da eleição): a rotina rodou com **dois** agentes em vez de
  três, e isso foi desvio deliberado do contrato. Com a votação encerrada, o
  valor marginal de três varreduras completas de pesquisa é baixo — domingo de
  eleição quase não tem divulgação nova — e o valor de uma leitura avançada da
  **apuração** é alto, porque é ela que alimenta a aba Projeção criada hoje.
  Um agente foi para a apuração e um cobriu os três cargos na janela magra.

  **A rotina precisa ser repropósita, e isso é decisão humana.** Do jeito que
  está, amanhã às 20:00 BRT ela vai lançar três agentes para procurar
  pesquisas que não existem. O que faria sentido a partir de agora:

  - se houver 2º turno, voltar a varrer pesquisas **quando a campanha do 2º
    turno começar**, com o recorte reduzido ao confronto que sobrou;
  - enquanto a apuração estiver aberta, trocar o objeto da rotina de
    `polls-diario-*.json` para `data/apuracao.json`, com cadência muito mais
    curta que diária (a apuração anda em minutos, não em dias);
  - depois da diplomação, desligar.

  Nenhuma dessas mudanças foi feita por esta sessão: mexer no agendamento é
  ação externa e fica para o dono do projeto.
- 2026-10-02: a execução descobriu que a suíte estava vermelha desde a
  mesclagem de 28/09 (contagens do dia cravadas como invariantes nos testes
  que leem dados reais) e que, por causa disso, **o deploy falhou nas quatro
  rodadas seguintes** — o site ficou congelado na base de 27/09, com 581
  pesquisas, enquanto a base local chegava a 788. Nos quatro dias o relato
  foi de suíte verde e deploy automático. Causa comum nos dois casos: não
  ler o resultado, só o fato de o comando ter rodado. Passo 4 passou a
  exigir a leitura da conclusão do workflow.
- 2026-09-26: fora da rotina, auditoria das somas dos 125 recortes ao corrigir as categorias de não-candidato. Alagoas no 2º turno presidencial somava 109,28% porque cada grafia de "brancos/nulos" virava uma linha própria no agregado. Corrigido. A auditoria revelou um bug pendente: os recortes de governador no 2º turno misturam confrontos diferentes e mostram três pessoas num returno de duas (ver `docs/backlog-pesquisas.md`).
