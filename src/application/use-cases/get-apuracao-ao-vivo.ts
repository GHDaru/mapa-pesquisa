/**
 * Caso de uso da apuração ao vivo.
 *
 * A busca em si acontece no adaptador de entrada — é o browser que fala com o
 * TSE, porque a divulgação manda CORS e o dado não precisa de intermediário.
 * O que este caso de uso guarda é o resto: o eleitorado para a projeção, o
 * resultado do 1º turno que alimenta o simulador, e a própria chamada de
 * projeção, para que a view não importe domínio direto nem alcance repositório.
 */

import { projetarApuracao, type DadosApuracao, type Projecao } from '../../domain/apuracao.js';
import type { Repositorios } from '../ports.js';

export interface ApuracaoAoVivo {
  /** Projeta uma leitura qualquer — do TSE ou do simulador — contra o eleitorado. */
  readonly projetar: (dados: DadosApuracao, turno: 1 | 2) => Projecao;
  /**
   * O 1º turno real e completo, gabarito do simulador.
   *
   * É o que permite afirmar que a projeção converge: o estado final é
   * conhecido, então a convergência é verificável e não uma promessa.
   */
  readonly apuracaoPrimeiroTurno: DadosApuracao;
}

export function criarGetApuracaoAoVivo(repos: Repositorios) {
  return function getApuracaoAoVivo(): ApuracaoAoVivo {
    const eleitorado = repos.electorate.todos();
    return {
      projetar: (dados, turno) => projetarApuracao(dados, 'presidente', turno, eleitorado),
      apuracaoPrimeiroTurno: repos.apuracao.dados(),
    };
  };
}
