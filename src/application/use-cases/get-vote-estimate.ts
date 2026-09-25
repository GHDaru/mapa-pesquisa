import type { Clock, Repositorios } from '../ports.js';
import { agregarPesquisas } from '../../domain/aggregate.js';
import { estimarVotos, type EstimativaVotos, type EstimativaVotosUfEntrada } from '../../domain/vote-estimate.js';
import { criarDisputa, UF_NACIONAL, UFS } from '../../domain/race.js';
import { CONFRONTO_LULA_FLAVIO, type Confronto, filtrarPorConfronto } from '../../domain/runoff.js';

/** Opções da estimativa de votos. */
export interface OpcoesVoteEstimate {
  /**
   * No 2º turno, qual confronto considerar. Padrão `CONFRONTO_LULA_FLAVIO`.
   * Ignorado no 1º turno. Pesquisas de 2º turno de outros confrontos (Lula x
   * Cury, Lula x Caiado...) são descartadas — ver `domain/runoff.ts`.
   */
  readonly confronto?: Confronto;
}

/**
 * Caso de uso: estimativa de votos presidenciais, combinando o eleitorado de
 * cada UF (`data/electorate.json`) com o agregado presidencial estadual quando
 * existe pesquisa própria, ou o agregado nacional do MESMO recorte como
 * substituto quando a UF ainda não tem pesquisa estadual — mesma regra do
 * serviço de domínio `estimarVotos` (`domain/vote-estimate.ts`).
 *
 * `turno` é 1 (padrão, compatível com as chamadas existentes) ou 2. No 2º
 * turno o recorte é por CONFRONTO (padrão Lula x Flávio Bolsonaro): tanto o
 * agregado nacional quanto os estaduais só usam pesquisas que testam
 * exatamente esses dois candidatos. UF cuja única pesquisa do confronto está
 * fora da janela de recência mantém o dado real (a pesquisa mais recente) e
 * aparece em `ufsForaDaJanela`; UF sem nenhuma pesquisa do confronto cai no
 * substituto nacional e aparece em `ufsSemPesquisa`.
 *
 * Retorna `null` quando não há eleitorado cadastrado para nenhuma UF, ou
 * quando falta tanto o agregado estadual quanto o nacional para alguma UF
 * com eleitorado conhecido (nunca inventa uma estimativa parcial).
 */
export function criarGetVoteEstimate(repos: Repositorios, clock: Clock) {
  return function getVoteEstimate(
    turno: 1 | 2 = 1,
    opcoes: OpcoesVoteEstimate = {},
  ): EstimativaVotos | null {
    const hoje = clock.hoje();
    const confronto = turno === 2 ? (opcoes.confronto ?? CONFRONTO_LULA_FLAVIO) : null;
    const recortar = (pesquisas: ReturnType<Repositorios['polls']['porDisputa']>) =>
      confronto ? filtrarPorConfronto(pesquisas, confronto) : pesquisas;

    const pollsNacional = recortar(repos.polls.porDisputa(criarDisputa(UF_NACIONAL, 'presidente', turno)));
    const agregadoNacional = agregarPesquisas(pollsNacional, {}, hoje);

    const porUf: EstimativaVotosUfEntrada[] = [];
    for (const uf of UFS) {
      const eleitorado = repos.electorate.porUf(uf);
      if (eleitorado == null) continue; // sem eleitorado cadastrado: não dá para estimar a UF, exclui.
      const pollsUf = recortar(repos.polls.porDisputa(criarDisputa(uf, 'presidente', turno)));
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
