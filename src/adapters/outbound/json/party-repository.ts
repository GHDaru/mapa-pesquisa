import type { PartyRepository } from '../../../application/ports.js';
import { type DadosPartido, type Partido, criarPartido } from '../../../domain/party.js';

/**
 * PartyRepository em memória. Recebe os dados já parseados de
 * data/parties.json e valida cada entrada pelo domínio.
 */
export function criarPartyRepositoryJson(dados: readonly DadosPartido[]): PartyRepository {
  const partidos: Partido[] = dados.map((d) => criarPartido(d));
  const porSiglaMapa = new Map(partidos.map((p) => [p.sigla, p]));

  return {
    todos(): readonly Partido[] {
      return partidos;
    },
    porSigla(sigla: string): Partido | undefined {
      return porSiglaMapa.get(sigla);
    },
  };
}
