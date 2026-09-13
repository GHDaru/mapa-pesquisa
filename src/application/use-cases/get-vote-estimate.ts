import type { Clock, Repositorios } from '../ports.js';
import { agregarPesquisas } from '../../domain/aggregate.js';
import { estimarVotos, type EstimativaVotos, type EstimativaVotosUfEntrada } from '../../domain/vote-estimate.js';
import { criarDisputa, UF_NACIONAL, UFS } from '../../domain/race.js';

/**
 * Caso de uso: estimativa de votos presidenciais (1º turno), combinando o
 * eleitorado de cada UF (`data/electorate.json`) com o agregado presidencial
 * estadual quando existe pesquisa própria, ou o agregado nacional (1º turno)
 * como substituto quando a UF ainda não tem pesquisa estadual — mesma regra
 * do serviço de domínio `estimarVotos` (`domain/vote-estimate.ts`).
 *
 * Retorna `null` quando não há eleitorado cadastrado para nenhuma UF, ou
 * quando falta tanto o agregado estadual quanto o nacional para alguma UF
 * com eleitorado conhecido (nunca inventa uma estimativa parcial).
 */
export function criarGetVoteEstimate(repos: Repositorios, clock: Clock) {
  return function getVoteEstimate(): EstimativaVotos | null {
    const hoje = clock.hoje();

    const pollsNacional = repos.polls.porDisputa(criarDisputa(UF_NACIONAL, 'presidente', 1));
    const agregadoNacional = agregarPesquisas(pollsNacional, {}, hoje);

    const porUf: EstimativaVotosUfEntrada[] = [];
    for (const uf of UFS) {
      const eleitorado = repos.electorate.porUf(uf);
      if (eleitorado == null) continue; // sem eleitorado cadastrado: não dá para estimar a UF, exclui.
      const pollsUf = repos.polls.porDisputa(criarDisputa(uf, 'presidente', 1));
      const agregado = agregarPesquisas(pollsUf, {}, hoje);
      porUf.push({ uf, eleitores: eleitorado.eleitores, agregado });
    }

    if (porUf.length === 0) return null;

    try {
      return estimarVotos(porUf, agregadoNacional);
    } catch {
      // Falta agregado estadual e nacional para alguma UF: sem dado
      // suficiente para uma estimativa honesta — retorna null em vez de
      // uma estimativa parcial/inventada.
      return null;
    }
  };
}
