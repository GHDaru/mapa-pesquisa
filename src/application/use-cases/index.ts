import type { Clock, Repositorios } from '../ports.js';
import { criarGetMapOverview } from './get-map-overview.js';
import { criarGetPollsDatabase } from './get-polls-database.js';
import { criarGetPresidentialAggregate } from './get-presidential-aggregate.js';
import { criarGetPresidentialByState } from './get-presidential-by-state.js';
import { criarGetPresidentialTimeline } from './get-presidential-timeline.js';
import { criarGetSenateByState } from './get-senate-by-state.js';
import { criarGetStateSummary } from './get-state-summary.js';
import { criarGetVoteEstimate } from './get-vote-estimate.js';
import { criarListParties } from './list-parties.js';
import { criarProjectSenate } from './project-senate.js';

export * from './get-map-overview.js';
export * from './get-polls-database.js';
export * from './get-presidential-aggregate.js';
export * from './get-presidential-by-state.js';
export * from './get-presidential-timeline.js';
export * from './get-senate-by-state.js';
export * from './get-state-summary.js';
export * from './get-vote-estimate.js';
export * from './list-parties.js';
export * from './project-senate.js';

export interface CasosDeUso {
  readonly getStateSummary: ReturnType<typeof criarGetStateSummary>;
  readonly getPresidentialAggregate: ReturnType<typeof criarGetPresidentialAggregate>;
  readonly getPresidentialTimeline: ReturnType<typeof criarGetPresidentialTimeline>;
  readonly getPresidentialByState: ReturnType<typeof criarGetPresidentialByState>;
  readonly getSenateByState: ReturnType<typeof criarGetSenateByState>;
  readonly projectSenate: ReturnType<typeof criarProjectSenate>;
  readonly listParties: ReturnType<typeof criarListParties>;
  readonly getMapOverview: ReturnType<typeof criarGetMapOverview>;
  readonly getVoteEstimate: ReturnType<typeof criarGetVoteEstimate>;
  readonly getPollsDatabase: ReturnType<typeof criarGetPollsDatabase>;
}

/** Fábrica dos casos de uso, com repositórios e relógio injetados. */
export function criarCasosDeUso(repos: Repositorios, clock: Clock): CasosDeUso {
  return {
    getStateSummary: criarGetStateSummary(repos, clock),
    getPresidentialAggregate: criarGetPresidentialAggregate(repos, clock),
    getPresidentialTimeline: criarGetPresidentialTimeline(repos, clock),
    getPresidentialByState: criarGetPresidentialByState(repos, clock),
    getSenateByState: criarGetSenateByState(repos, clock),
    projectSenate: criarProjectSenate(repos, clock),
    listParties: criarListParties(repos),
    getMapOverview: criarGetMapOverview(repos, clock),
    getVoteEstimate: criarGetVoteEstimate(repos, clock),
    getPollsDatabase: criarGetPollsDatabase(repos),
  };
}
