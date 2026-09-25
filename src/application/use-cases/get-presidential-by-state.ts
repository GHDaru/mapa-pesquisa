import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas, serieTemporal, type SerieTemporal } from '../../domain/aggregate.js';
import type { Pesquisa } from '../../domain/poll.js';
import { criarDisputa, UFS } from '../../domain/race.js';
import { CONFRONTO_LULA_FLAVIO, type Confronto, filtrarPorConfronto } from '../../domain/runoff.js';

export interface PresidencialUf {
  readonly uf: string;
  /** Eleitores aptos na UF (data/electorate.json), ou null quando ainda não cadastrado. */
  readonly eleitores: number | null;
  /** Agregado da disputa presidencial (turno pedido) na UF, ou null sem pesquisa estadual. */
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

/**
 * true quando a UF não tem nenhuma pesquisa dentro da janela de recência e o
 * agregado usou a pesquisa mais recente disponível mesmo assim (mecanismo
 * `Agregado.foraDaJanela` de `domain/aggregate.ts`; caso de RO no 2º turno,
 * cuja única pesquisa é de julho). O dado é real, mas velho — a UI deve
 * marcar. false quando a UF está `semDados` (não há o que datar).
 */
export function usouPesquisaForaDaJanela(item: PresidencialUf): boolean {
  return item.agregado?.foraDaJanela ?? false;
}

export interface PresidencialPorEstado {
  readonly ufs: readonly PresidencialUf[];
  /** Soma de data/electorate.json — null enquanto o arquivo estiver vazio. */
  readonly eleitoradoNacional: number | null;
  /** Soma do eleitorado apenas das UFs que já têm pesquisa presidencial estadual. */
  readonly eleitoradoComPesquisa: number;
  /** Turno deste recorte (1 ou 2). */
  readonly turno: 1 | 2;
  /**
   * No 2º turno, o confronto usado no recorte (ex.: Lula x Flávio Bolsonaro);
   * null no 1º turno, onde não há confronto a escolher.
   */
  readonly confronto: Confronto | null;
  /**
   * UFs cujo agregado usou uma pesquisa fora da janela de recência (ver
   * `usouPesquisaForaDaJanela` e `Agregado.foraDaJanela`). No 2º turno é o
   * caso de RO, cuja única pesquisa do confronto é de julho.
   */
  readonly ufsForaDaJanela: readonly string[];
}

/** Opções do recorte por estado. */
export interface OpcoesPresidencialPorEstado {
  /**
   * No 2º turno, qual confronto considerar. Padrão `CONFRONTO_LULA_FLAVIO`.
   * Ignorado no 1º turno. Pesquisas de 2º turno de outros confrontos (Lula x
   * Cury, Lula x Caiado...) são descartadas — ver `domain/runoff.ts`.
   */
  readonly confronto?: Confronto;
}

/**
 * Caso de uso: pesquisas presidenciais por estado — uma pesquisa de
 * `presidente` com `uf` igual à sigla do estado (docs/data-schema.md,
 * "Pesquisas presidenciais por estado"), não a disputa nacional ("BR").
 *
 * `turno` é 1 (padrão, compatível com as chamadas existentes) ou 2. No 2º
 * turno o recorte é por CONFRONTO, não só por turno: só entram as pesquisas
 * que testam exatamente os dois candidatos de `opcoes.confronto` (padrão Lula
 * x Flávio Bolsonaro). UF sem pesquisa desse confronto fica `semDados`; UF com
 * pesquisa só fora da janela de recência usa a mais recente e fica marcada em
 * `foraDaJanela` (nunca inventa número).
 */
export function criarGetPresidentialByState(repos: Repositorios, clock: Clock) {
  return function getPresidentialByState(
    turno: 1 | 2 = 1,
    opcoes: OpcoesPresidencialPorEstado = {},
  ): PresidencialPorEstado {
    const hoje = clock.hoje();
    const confronto = turno === 2 ? (opcoes.confronto ?? CONFRONTO_LULA_FLAVIO) : null;
    let eleitoradoComPesquisa = 0;
    const ufsForaDaJanela: string[] = [];

    const ufs: PresidencialUf[] = UFS.map((uf): PresidencialUf => {
      const todas = repos.polls.porDisputa(criarDisputa(uf, 'presidente', turno));
      const polls = confronto ? filtrarPorConfronto(todas, confronto) : todas;
      const agregado = agregarPesquisas(polls, {}, hoje);
      const serie = polls.length > 0 ? serieTemporal(polls, {}, hoje) : null;
      const eleitores = repos.electorate.porUf(uf)?.eleitores ?? null;

      if (agregado && eleitores != null) {
        eleitoradoComPesquisa += eleitores;
      }
      if (agregado?.foraDaJanela) ufsForaDaJanela.push(uf);

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

    return { ufs, eleitoradoNacional, eleitoradoComPesquisa, turno, confronto, ufsForaDaJanela };
  };
}
