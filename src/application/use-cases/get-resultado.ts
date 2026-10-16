import type { Repositorios } from '../ports.js';
import {
  type ComposicaoSenado,
  type DadosResultado,
  composicaoSenado,
  contagemGovernadores,
  governadoresPorPartido,
} from '../../domain/resultado.js';

export interface FechamentoEleicao {
  readonly dados: DadosResultado;
  readonly senado: ComposicaoSenado;
  readonly governadores: { readonly eleitos: number; readonly segundoTurno: number };
  readonly governadoresPorPartido: readonly {
    readonly partido: string;
    readonly ufs: readonly string[];
  }[];
}

/**
 * Caso de uso: o fechamento do 1º turno. Junta o que é RESULTADO — nada aqui
 * sai de pesquisa. Governadores e Câmara vêm do arquivo de resultado; o
 * Senado é derivado da apuração, porque ela já cobre as 27 UFs e derivar é
 * melhor que manter a mesma informação em dois lugares que podem divergir.
 */
export function criarGetResultado(repos: Repositorios) {
  return function getResultado(): FechamentoEleicao {
    const dados = repos.resultado.dados();
    return {
      dados,
      senado: composicaoSenado(repos.apuracao.dados(), repos.senateSeats.todas()),
      governadores: contagemGovernadores(dados),
      governadoresPorPartido: governadoresPorPartido(dados),
    };
  };
}
