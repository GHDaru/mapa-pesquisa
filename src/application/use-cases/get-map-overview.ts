import type { Clock, Repositorios } from '../ports.js';
import { agregarPesquisas } from '../../domain/aggregate.js';
import { criarDisputa, UFS } from '../../domain/race.js';
import { espectroDoPartido, type Espectro } from '../../domain/spectrum.js';

export interface VisaoGeralUf {
  readonly uf: string;
  readonly liderGovernador: string | null;
  readonly partido: string | null;
  readonly espectro: Espectro;
  readonly vantagem: number;
  readonly empateTecnico: boolean;
  readonly semDados: boolean;
}

/** Caso de uso: visão geral do mapa — líder de governador em cada uma das 27 UFs. */
export function criarGetMapOverview(repos: Repositorios, clock: Clock) {
  return function getMapOverview(): readonly VisaoGeralUf[] {
    const hoje = clock.hoje();
    const partidos = repos.parties.todos();

    return UFS.map((uf): VisaoGeralUf => {
      const pollsTurno2 = repos.polls.porDisputa(criarDisputa(uf, 'governador', 2));
      const polls =
        pollsTurno2.length > 0
          ? pollsTurno2
          : repos.polls.porDisputa(criarDisputa(uf, 'governador', 1));
      const agregado = agregarPesquisas(polls, {}, hoje);

      if (!agregado || !agregado.lider) {
        return {
          uf,
          liderGovernador: null,
          partido: null,
          espectro: 'indefinido',
          vantagem: 0,
          empateTecnico: false,
          semDados: true,
        };
      }

      return {
        uf,
        liderGovernador: agregado.lider.candidato,
        partido: agregado.lider.partido,
        espectro: espectroDoPartido(agregado.lider.partido, partidos),
        vantagem: agregado.vantagem,
        empateTecnico: agregado.empateTecnico,
        semDados: false,
      };
    });
  };
}
