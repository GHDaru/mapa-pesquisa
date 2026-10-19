import type { Repositorios } from '../ports.js';
import { criarDisputa } from '../../domain/race.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import { DATA_PRIMEIRO_TURNO } from '../../domain/poll-accuracy.js';
import type { GovernadorUf } from '../../domain/resultado.js';

/**
 * Quais pesquisas de governador descrevem a disputa de uma UF HOJE.
 *
 * Existe como módulo próprio porque duas telas precisam da mesma resposta — o
 * mapa e o painel do estado — e elas não podem divergir: o mapa pintar o
 * resultado e o painel, ao abrir no mesmo clique, listar uma simulação de 2º
 * turno que as urnas não confirmaram seria a mesma contradição que já nos
 * custou leituras erradas em outras telas.
 *
 * A escolha depende do que as urnas fizeram:
 *
 * - UF **decidida** no 1º turno: entram as pesquisas de 1º turno com campo até
 *   4/10. Uma simulação de 2º turno medida antes da eleição não é a disputa
 *   que aconteceu — em São Paulo, decidido no 1º turno, ela mostraria um 2º
 *   turno que nunca existiu.
 * - UF **em 2º turno**: entram as pesquisas de 2º turno com campo posterior a
 *   4/10 que testem o confronto REAL definido pelas urnas. Sem isso, cenário
 *   hipotético e disputa em curso se misturariam na mesma média.
 * - **Sem dado de resultado** (antes da eleição, ou fixture de teste): mantém a
 *   regra antiga — 2º turno quando houver, 1º turno caso contrário.
 */
export function selecionarPesquisasDeGovernador(
  repos: Repositorios,
  uf: string,
  doResultado: GovernadorUf | null,
): readonly Pesquisa[] {
  const turno1 = () => repos.polls.porDisputa(criarDisputa(uf, 'governador', 1));
  const turno2 = () => repos.polls.porDisputa(criarDisputa(uf, 'governador', 2));

  if (doResultado?.situacao === 'eleito') {
    return turno1().filter((p) => dataReferencia(p) <= DATA_PRIMEIRO_TURNO);
  }

  if (doResultado?.situacao === 'segundo-turno') {
    const finalistas = doResultado.finalistas.map((f) => f.nome);
    return turno2()
      .filter((p) => dataReferencia(p) > DATA_PRIMEIRO_TURNO)
      .filter((p) =>
        finalistas.every((nome) => p.resultados.some((r) => r.candidato === nome)),
      );
  }

  const doSegundoTurno = turno2();
  return doSegundoTurno.length > 0 ? doSegundoTurno : turno1();
}
