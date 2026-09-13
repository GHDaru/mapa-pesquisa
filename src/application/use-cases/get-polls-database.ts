import type { Repositorios } from '../ports.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import type { Cargo } from '../../domain/race.js';
import { CARGOS_VALIDOS } from '../../domain/race.js';

export interface TotaisPesquisas {
  readonly total: number;
  readonly porCargo: Readonly<Record<Cargo, number>>;
  readonly porInstituto: Readonly<Record<string, number>>;
  readonly comRegistroTSE: number;
  readonly semRegistroTSE: number;
  /** Quantidade de UFs distintas com ao menos uma pesquisa (inclui "BR" quando há pesquisa nacional). */
  readonly ufsCobertas: number;
}

export interface BaseDePesquisas {
  /** Todas as pesquisas conhecidas (qualquer cargo/turno), mais recente primeiro. */
  readonly pesquisas: readonly Pesquisa[];
  readonly totais: TotaisPesquisas;
  /** Institutos distintos, ordem alfabética — para popular o filtro. */
  readonly institutos: readonly string[];
  /** UFs distintas (inclui "BR"), ordem alfabética — para popular o filtro. */
  readonly ufs: readonly string[];
}

/**
 * Caso de uso: base completa de pesquisas conhecidas (todos os cargos e
 * turnos), com totais para o cabeçalho e listas auxiliares para os filtros
 * da tela "Base de pesquisas" (`views/polls-database-view.ts`).
 */
export function criarGetPollsDatabase(repos: Repositorios) {
  return function getPollsDatabase(): BaseDePesquisas {
    const todas = repos.polls.todas();

    const pesquisas = [...todas].sort((a, b) => dataReferencia(b).localeCompare(dataReferencia(a)));

    const porCargo = Object.fromEntries(CARGOS_VALIDOS.map((cargo) => [cargo, 0])) as Record<Cargo, number>;
    const porInstituto = new Map<string, number>();
    const setInstitutos = new Set<string>();
    const setUfs = new Set<string>();
    let comRegistroTSE = 0;
    let semRegistroTSE = 0;

    for (const p of todas) {
      porCargo[p.disputa.cargo] += 1;
      porInstituto.set(p.instituto, (porInstituto.get(p.instituto) ?? 0) + 1);
      setInstitutos.add(p.instituto);
      setUfs.add(p.disputa.uf);
      if (p.registroTSE.naoRegistrada) semRegistroTSE += 1;
      else comRegistroTSE += 1;
    }

    return {
      pesquisas,
      totais: {
        total: todas.length,
        porCargo,
        porInstituto: Object.fromEntries(porInstituto),
        comRegistroTSE,
        semRegistroTSE,
        ufsCobertas: setUfs.size,
      },
      institutos: [...setInstitutos].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      ufs: [...setUfs].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  };
}
