import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas } from '../../domain/aggregate.js';
import { criarDisputa } from '../../domain/race.js';
import { selecionarPesquisasDeGovernador } from './governor-poll-selection.js';

export interface ResumoEstado {
  readonly uf: string;
  readonly governador: Agregado | null;
  readonly senador: Agregado | null;
}

/**
 * Caso de uso: resumo de uma UF (agregados de governador e senador).
 *
 * A escolha das pesquisas de governador vive em `governor-poll-selection.ts`,
 * compartilhada com o mapa — a regra antiga ("2º turno sempre que houver,
 * mais relevante que o 1º turno já definido") foi escrita antes de 4 de
 * outubro e, lida depois, mostrava num estado decidido no 1º turno uma
 * simulação de 2º turno que nunca aconteceu. Senador não tem 2º turno no
 * Brasil, e por isso segue direto.
 */
export function criarGetStateSummary(repos: Repositorios, clock: Clock) {
  return function getStateSummary(uf: string): ResumoEstado {
    const hoje = clock.hoje();

    const doResultado =
      repos.resultado.dados().governadores.find((g) => g.uf === uf) ?? null;
    const governador = agregarPesquisas(
      selecionarPesquisasDeGovernador(repos, uf, doResultado),
      {},
      hoje,
    );

    const pollsSenador = repos.polls.porDisputa(criarDisputa(uf, 'senador', 1));
    const senador = agregarPesquisas(pollsSenador, {}, hoje);

    return { uf, governador, senador };
  };
}
