import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas } from '../../domain/aggregate.js';
import { criarDisputa, UFS } from '../../domain/race.js';
import { projetarSenado, type ProjecaoSenado } from '../../domain/senate.js';

/** Caso de uso: projeção completa do Senado (27 fixas + 54 projetadas/indefinidas). */
export function criarProjectSenate(repos: Repositorios, clock: Clock) {
  return function projectSenate(): ProjecaoSenado {
    const hoje = clock.hoje();
    const cadeiras = repos.senateSeats.todas();
    const partidos = repos.parties.todos();

    const agregadosPorUf: Record<string, Agregado | null> = {};
    for (const uf of UFS) {
      const polls = repos.polls.porDisputa(criarDisputa(uf, 'senador', 1));
      agregadosPorUf[uf] = agregarPesquisas(polls, {}, hoje);
    }

    return projetarSenado(cadeiras, agregadosPorUf, partidos);
  };
}
