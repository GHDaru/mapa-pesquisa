import type { DadosApuracao } from '../domain/apuracao.js';
import type { Eleitorado } from '../domain/electorate.js';
import type { Partido } from '../domain/party.js';
import type { Pesquisa } from '../domain/poll.js';
import type { Disputa } from '../domain/race.js';
import type { CadeiraSenado } from '../domain/senate.js';

/**
 * Ports (interfaces) do lado outbound da arquitetura hexagonal. Implementados
 * pelos adaptadores em src/adapters/outbound/*; consumidos pelos casos de uso
 * em src/application/use-cases/*. Nenhuma dependência de infraestrutura aqui.
 */

export interface PollRepository {
  todas(): readonly Pesquisa[];
  porDisputa(disputa: Disputa): readonly Pesquisa[];
}

export interface PartyRepository {
  todos(): readonly Partido[];
  porSigla(sigla: string): Partido | undefined;
}

export interface SenateSeatRepository {
  todas(): readonly CadeiraSenado[];
}

export interface MetaRepository {
  atualizadoEm(): string;
}

export interface EleitoradoRepository {
  todos(): readonly Eleitorado[];
  porUf(uf: string): Eleitorado | undefined;
}

/**
 * Apuração oficial (data/apuracao.json). Fica vazia fora da noite de
 * eleição, e `vazia()` existe para que a tela declare a ausência em vez de
 * desenhar um gráfico de zeros.
 */
export interface ApuracaoRepository {
  dados(): DadosApuracao;
  atualizadoEm(): string;
  vazia(): boolean;
}

export interface Repositorios {
  polls: PollRepository;
  parties: PartyRepository;
  senateSeats: SenateSeatRepository;
  meta: MetaRepository;
  electorate: EleitoradoRepository;
  apuracao: ApuracaoRepository;
}

/** Relógio injetável — permite testes determinísticos dos casos de uso. */
export interface Clock {
  hoje(): Date;
}
