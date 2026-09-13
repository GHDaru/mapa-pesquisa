import type { Repositorios } from '../../../application/ports.js';
import type { DadosEleitorado } from '../../../domain/electorate.js';
import type { DadosPartido } from '../../../domain/party.js';
import type { DadosPesquisa } from '../../../domain/poll.js';
import type { DadosCadeiraSenado } from '../../../domain/senate.js';
import { criarEleitoradoRepositoryJson } from './electorate-repository.js';
import { criarMetaRepositoryJson, type DadosMeta } from './meta-repository.js';
import { criarPartyRepositoryJson } from './party-repository.js';
import { criarPollRepositoryJson } from './poll-repository.js';
import { criarSenateSeatRepositoryJson } from './senate-seat-repository.js';

// Import estático dos dados versionados no repositório (embutidos no bundle
// pelo Vite; resolvidos pelo tsc via `resolveJsonModule`). Um agente separado
// mantém o conteúdo real de data/*.json — o formato deve seguir docs/data-schema.md.
import pollsJson from '../../../../data/polls.json';
import partiesJson from '../../../../data/parties.json';
import senateSeatsJson from '../../../../data/senate-seats.json';
import metaJson from '../../../../data/meta.json';
import electorateJson from '../../../../data/electorate.json';

/**
 * Monta os repositórios em memória a partir dos arquivos data/*.json.
 * Cada repositório valida seus dados pelo domínio na construção — dados
 * inválidos lançam um erro claro identificando o registro problemático.
 */
export function carregarDados(): Repositorios {
  return {
    polls: criarPollRepositoryJson(pollsJson as unknown as DadosPesquisa[]),
    parties: criarPartyRepositoryJson(partiesJson as unknown as DadosPartido[]),
    senateSeats: criarSenateSeatRepositoryJson(senateSeatsJson as unknown as DadosCadeiraSenado[]),
    meta: criarMetaRepositoryJson(metaJson as unknown as DadosMeta),
    electorate: criarEleitoradoRepositoryJson(electorateJson as unknown as DadosEleitorado[]),
  };
}
