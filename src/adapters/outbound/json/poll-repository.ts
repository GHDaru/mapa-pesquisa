import type { PollRepository } from '../../../application/ports.js';
import { type DadosPesquisa, type Pesquisa, criarPesquisa } from '../../../domain/poll.js';
import { type Disputa, disputaId } from '../../../domain/race.js';

/**
 * PollRepository em memória. Recebe os dados já parseados de data/polls.json
 * e valida cada entrada pelo domínio — uma pesquisa inválida lança
 * PesquisaInvalidaError com o id no momento da construção do repositório.
 */
export function criarPollRepositoryJson(dados: readonly DadosPesquisa[]): PollRepository {
  const pesquisas: Pesquisa[] = dados.map((d) => criarPesquisa(d));

  return {
    todas(): readonly Pesquisa[] {
      return pesquisas;
    },
    porDisputa(disputa: Disputa): readonly Pesquisa[] {
      const alvo = disputaId(disputa);
      return pesquisas.filter((p) => disputaId(p.disputa) === alvo);
    },
  };
}
