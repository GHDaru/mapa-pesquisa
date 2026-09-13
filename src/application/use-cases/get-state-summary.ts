import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas } from '../../domain/aggregate.js';
import { criarDisputa } from '../../domain/race.js';

export interface ResumoEstado {
  readonly uf: string;
  readonly governador: Agregado | null;
  readonly senador: Agregado | null;
}

/**
 * Caso de uso: resumo de uma UF (agregados de governador e senador).
 * Para governador, usa o 2º turno quando há pesquisas dele (mais relevante
 * que o 1º turno, já definido); senador não tem 2º turno no Brasil.
 */
export function criarGetStateSummary(repos: Repositorios, clock: Clock) {
  return function getStateSummary(uf: string): ResumoEstado {
    const hoje = clock.hoje();

    const pollsGovernadorTurno2 = repos.polls.porDisputa(criarDisputa(uf, 'governador', 2));
    const pollsGovernador =
      pollsGovernadorTurno2.length > 0
        ? pollsGovernadorTurno2
        : repos.polls.porDisputa(criarDisputa(uf, 'governador', 1));
    const governador = agregarPesquisas(pollsGovernador, {}, hoje);

    const pollsSenador = repos.polls.porDisputa(criarDisputa(uf, 'senador', 1));
    const senador = agregarPesquisas(pollsSenador, {}, hoje);

    return { uf, governador, senador };
  };
}
