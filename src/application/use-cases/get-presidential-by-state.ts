import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas, serieTemporal, type SerieTemporal } from '../../domain/aggregate.js';
import type { Pesquisa } from '../../domain/poll.js';
import { criarDisputa, UFS } from '../../domain/race.js';

export interface PresidencialUf {
  readonly uf: string;
  /** Eleitores aptos na UF (data/electorate.json), ou null quando ainda não cadastrado. */
  readonly eleitores: number | null;
  /** Agregado da disputa presidencial (1º turno) na UF, ou null sem pesquisa estadual. */
  readonly agregado: Agregado | null;
  /** Série temporal da mesma disputa, ou null sem pesquisa estadual. */
  readonly serie: SerieTemporal | null;
  readonly lider: string | null;
  readonly partido: string | null;
  readonly vantagem: number;
  readonly empateTecnico: boolean;
  readonly semDados: boolean;
  readonly ultimaPesquisa: Pesquisa | null;
}

export interface PresidencialPorEstado {
  readonly ufs: readonly PresidencialUf[];
  /** Soma de data/electorate.json — null enquanto o arquivo estiver vazio. */
  readonly eleitoradoNacional: number | null;
  /** Soma do eleitorado apenas das UFs que já têm pesquisa presidencial estadual. */
  readonly eleitoradoComPesquisa: number;
}

/**
 * Caso de uso: pesquisas presidenciais (1º turno) por estado — uma pesquisa
 * de `presidente` com `uf` igual à sigla do estado (docs/data-schema.md,
 * "Pesquisas presidenciais por estado"), não a disputa nacional ("BR").
 */
export function criarGetPresidentialByState(repos: Repositorios, clock: Clock) {
  return function getPresidentialByState(): PresidencialPorEstado {
    const hoje = clock.hoje();
    let eleitoradoComPesquisa = 0;

    const ufs: PresidencialUf[] = UFS.map((uf): PresidencialUf => {
      const polls = repos.polls.porDisputa(criarDisputa(uf, 'presidente', 1));
      const agregado = agregarPesquisas(polls, {}, hoje);
      const serie = polls.length > 0 ? serieTemporal(polls, {}, hoje) : null;
      const eleitores = repos.electorate.porUf(uf)?.eleitores ?? null;

      if (agregado && eleitores != null) {
        eleitoradoComPesquisa += eleitores;
      }

      return {
        uf,
        eleitores,
        agregado,
        serie,
        lider: agregado?.lider?.candidato ?? null,
        partido: agregado?.lider?.partido ?? null,
        vantagem: agregado?.vantagem ?? 0,
        empateTecnico: agregado?.empateTecnico ?? false,
        semDados: agregado == null,
        ultimaPesquisa: agregado?.ultimaPesquisa ?? null,
      };
    });

    const todoOEleitorado = repos.electorate.todos();
    const eleitoradoNacional =
      todoOEleitorado.length > 0 ? todoOEleitorado.reduce((soma, e) => soma + e.eleitores, 0) : null;

    return { ufs, eleitoradoNacional, eleitoradoComPesquisa };
  };
}
