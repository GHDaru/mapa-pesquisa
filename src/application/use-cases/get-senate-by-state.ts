import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, type NivelConfianca, agregarPesquisas } from '../../domain/aggregate.js';
import type { Fonte } from '../../domain/poll.js';
import { criarDisputa, UFS } from '../../domain/race.js';
import { projetarSenado } from '../../domain/senate.js';

export interface CadeiraFixaResumo {
  readonly senador: string;
  readonly partido: string;
  readonly mandatoFim: number;
}

/** Ocupante atual (antes da eleição) de uma das cadeiras eleitas em 2018, em disputa em 2026. */
export interface OcupanteAtualResumo {
  readonly senador: string;
  readonly partido: string;
}

export interface CandidatoProjetadoResumo {
  readonly candidato: string;
  readonly partido: string | null;
  readonly pct: number;
  readonly confianca: NivelConfianca | null;
}

export interface SenadoUf {
  readonly uf: string;
  /** Cadeira eleita em 2022 (mandato até 2031), não disputada em 2026; null se ausente dos dados. */
  readonly cadeiraFixa: CadeiraFixaResumo | null;
  /** Os 2 ocupantes hoje das cadeiras eleitas em 2018 (mandato até 2027), em disputa em 2026. */
  readonly cadeirasAtuaisEmDisputa: readonly OcupanteAtualResumo[];
  /** Os 2 primeiros colocados do agregado de pesquisas de senador na UF, ou vazio sem pesquisa. */
  readonly projetadas: readonly CandidatoProjetadoResumo[];
  readonly empate: boolean;
  /** Fonte da última pesquisa de senador usada no agregado, ou null sem pesquisa. */
  readonly fonte: Fonte | null;
}

/**
 * Caso de uso: resumo do Senado por UF (cadeira fixa, ocupantes atuais das
 * cadeiras em disputa e projeção com percentuais). Reaproveita o serviço de
 * domínio `projetarSenado` para a origem e a confiança de cada assento
 * projetado; o percentual vem do mesmo agregado usado por essa projeção.
 */
export function criarGetSenateByState(repos: Repositorios, clock: Clock) {
  return function getSenateByState(): readonly SenadoUf[] {
    const hoje = clock.hoje();
    const cadeiras = repos.senateSeats.todas();
    const partidos = repos.parties.todos();

    const agregadosPorUf: Record<string, Agregado | null> = {};
    for (const uf of UFS) {
      const polls = repos.polls.porDisputa(criarDisputa(uf, 'senador', 1));
      agregadosPorUf[uf] = agregarPesquisas(polls, {}, hoje);
    }

    const projecao = projetarSenado(cadeiras, agregadosPorUf, partidos);

    return UFS.map((uf): SenadoUf => {
      const cadeirasDaUf = cadeiras.filter((c) => c.uf === uf);

      const fixaDados = cadeirasDaUf.find((c) => !c.emDisputa2026) ?? null;
      const cadeiraFixa: CadeiraFixaResumo | null = fixaDados
        ? { senador: fixaDados.senador, partido: fixaDados.partido, mandatoFim: fixaDados.mandatoFim }
        : null;

      const cadeirasAtuaisEmDisputa: OcupanteAtualResumo[] = cadeirasDaUf
        .filter((c) => c.emDisputa2026)
        .map((c) => ({ senador: c.senador, partido: c.partido }));

      const agregado = agregadosPorUf[uf] ?? null;
      const assentosProjetados = projecao.assentos.filter((a) => a.uf === uf && a.origem === 'projetada');
      // `assentosProjetados` vem de `projecao.assentos`, que é ordenado
      // GLOBALMENTE por espectro (ver `projetarSenado`/`posicaoHemiciclo` em
      // domain/senate.ts) — essa ordem não coincide, em geral, com a ordem
      // por `pct` de `agregado.candidatos`. Pareia cada assento com o
      // candidato do agregado pela IDENTIDADE (nome + partido), nunca pelo
      // índice: zipar por índice troca o percentual (e o selo de empate)
      // entre o 1º e o 2º colocado sempre que os dois têm espectros
      // diferentes (ver docs/revisao-senado.md, bug P0).
      const projetadas: CandidatoProjetadoResumo[] = assentosProjetados.map((assento) => {
        const candidatoAgregado = agregado?.candidatos.find(
          (c) => c.candidato === assento.ocupante && c.partido === assento.partido,
        );
        return {
          candidato: assento.ocupante ?? candidatoAgregado?.candidato ?? '',
          partido: assento.partido,
          pct: candidatoAgregado?.pct ?? 0,
          confianca: assento.confianca,
        };
      });

      return {
        uf,
        cadeiraFixa,
        cadeirasAtuaisEmDisputa,
        projetadas,
        empate: agregado?.empateTecnico ?? false,
        fonte: agregado?.ultimaPesquisa.fonte ?? null,
      };
    });
  };
}
