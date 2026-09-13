import type { Clock, Repositorios } from '../ports.js';
import { criarGetMapOverview } from './get-map-overview.js';
import { criarGetPresidentialAggregate } from './get-presidential-aggregate.js';
import { criarGetStateSummary } from './get-state-summary.js';
import { criarListParties } from './list-parties.js';
import { criarProjectSenate } from './project-senate.js';

export * from './get-map-overview.js';
export * from './get-presidential-aggregate.js';
export * from './get-state-summary.js';
export * from './list-parties.js';
export * from './project-senate.js';

export interface CasosDeUso {
  readonly getStateSummary: ReturnType<typeof criarGetStateSummary>;
  readonly getPresidentialAggregate: ReturnType<typeof criarGetPresidentialAggregate>;
  readonly projectSenate: ReturnType<typeof criarProjectSenate>;
  readonly listParties: ReturnType<typeof criarListParties>;
  readonly getMapOverview: ReturnType<typeof criarGetMapOverview>;
}

/** Fábrica dos casos de uso, com repositórios e relógio injetados. */
export function criarCasosDeUso(repos: Repositorios, clock: Clock): CasosDeUso {
  return {
    getStateSummary: criarGetStateSummary(repos, clock),
    getPresidentialAggregate: criarGetPresidentialAggregate(repos, clock),
    projectSenate: criarProjectSenate(repos, clock),
    listParties: criarListParties(repos),
    getMapOverview: criarGetMapOverview(repos, clock),
  };
}
