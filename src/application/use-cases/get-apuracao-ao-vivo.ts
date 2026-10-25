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
import type { Eleitorado } from '../../domain/electorate.js';
import type { Repositorios } from '../ports.js';

/**
 * O eleitorado do exterior, que NÃO mora em `data/electorate.json`.
 *
 * O TSE publica o voto fora do país sob o código de UF `zz`, com a mesma
 * forma dos 27 estados — 1.351 seções, 916.683 eleitores aptos —, e a
 * apuração precisa dele: sem o exterior, a projeção soma 27 recortes e deixa
 * de fora quase um milhão de eleitores.
 *
 * Ele fica aqui, e não no arquivo de eleitorado, porque aquele arquivo é do
 * domínio das PESQUISAS: ele existe para converter percentual de pesquisa em
 * voto estimado, e o exterior não tem pesquisa nenhuma. Pô-lo lá fez 38
 * testes quebrarem de uma vez, e com razão — passaria a existir uma 28ª
 * unidade sem pesquisa em todas as contas que pressupõem cobertura das 27.
 */
const ELEITORADO_EXTERIOR: Eleitorado = {
  uf: 'ZZ',
  eleitores: 916683,
  referencia: '2026-10',
  fonte: {
    nome: 'TSE — Divulgação de Resultados, arquivo oficial do exterior (campo "te"), 2º turno',
    url: 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz-c0001-e006258-u.json',
  },
};

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
  /**
   * O eleitorado por unidade, incluindo o exterior.
   *
   * Vai junto porque a tela precisa dele mesmo quando a leitura do TSE falha
   * ou ainda não começou: ele é o denominador da taxa de abstenção do 1º
   * turno, que é dado fechado e não tem por que sumir só porque a apuração de
   * hoje não respondeu.
   */
  readonly eleitorado: readonly Eleitorado[];
}

export function criarGetApuracaoAoVivo(repos: Repositorios) {
  return function getApuracaoAoVivo(): ApuracaoAoVivo {
    const eleitorado = [...repos.electorate.todos(), ELEITORADO_EXTERIOR];
    return {
      projetar: (dados, turno) => projetarApuracao(dados, 'presidente', turno, eleitorado),
      apuracaoPrimeiroTurno: repos.apuracao.dados(),
      eleitorado,
    };
  };
}
