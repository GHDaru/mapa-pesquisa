import type { Repositorios } from '../ports.js';
import type { Partido } from '../../domain/party.js';

/** Caso de uso: lista todos os partidos conhecidos. */
export function criarListParties(repos: Repositorios) {
  return function listParties(): readonly Partido[] {
    return repos.parties.todos();
  };
}
