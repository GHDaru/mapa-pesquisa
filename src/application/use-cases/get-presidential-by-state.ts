import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas, serieTemporal, type SerieTemporal } from '../../domain/aggregate.js';
import type { Pesquisa } from '../../domain/poll.js';
import { criarDisputa, UFS } from '../../domain/race.js';
import { CONFRONTO_LULA_FLAVIO, type Confronto, filtrarPorConfronto } from '../../domain/runoff.js';
import { DATA_PRIMEIRO_TURNO } from '../../domain/poll-accuracy.js';
import { dataReferencia } from '../../domain/poll.js';

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
  /**
   * No 2º turno: `true` quando a leitura da UF foi medida DEPOIS do 1º turno,
   * `false` quando vem inteira de antes dele. `null` no 1º turno (onde a
   * pergunta não cabe) e quando a UF está `semDados`.
   *
   * A distinção não é cosmética. Antes de 04/10 uma pesquisa de "Lula x Flávio"
   * media um confronto HIPOTÉTICO, com o eleitor sem saber quem passaria;
   * depois, mede a eleição marcada. São perguntas diferentes, e até 12/10 as 27
   * UFs do mapa de 2º turno respondiam todas a primeira — por isso nada na tela
   * precisava distinguir. O Distrito Federal é a primeira a responder a
   * segunda, e a partir daí desenhar as duas do mesmo jeito afirma uma
   * equivalência que não existe.
   */
  readonly medidaAposOPrimeiroTurno: boolean | null;
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
  /**
   * No 2º turno, as UFs com dado cuja leitura é INTEIRA de antes de 04/10 —
   * isto é, mede o confronto hipotético, não a eleição marcada (ver
   * `PresidencialUf.medidaAposOPrimeiroTurno`). Vazio no 1º turno.
   */
  readonly ufsAntesDoPrimeiroTurno: readonly string[];
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
    const ufsAntesDoPrimeiroTurno: string[] = [];

    const ufs: PresidencialUf[] = UFS.map((uf): PresidencialUf => {
      const todas = repos.polls.porDisputa(criarDisputa(uf, 'presidente', turno));
      const polls = confronto ? filtrarPorConfronto(todas, confronto) : todas;
      const agregado = agregarPesquisas(polls, {}, hoje);
      // A série sai da MESMA base que o agregado declara
      // (`agregado.pesquisasUsadas`), não de todas as pesquisas da disputa. A
      // rodada anterior já havia filtrado os PONTOS do mini-gráfico por essa base
      // na camada de view (`pontosDaBase`), mas a LINHA suavizada continuava
      // vindo de `serieTemporal(polls)`: como `mediaBilateral` pondera todas as
      // pesquisas por distância no tempo, uma pesquisa fora da base ainda moldava
      // a curva. Medido nos dados reais, no 1º turno: Sergipe, cartão "2 pesquisas
      // · ago–set/2026", tinha a curva deslocada em até 1,15 ponto por uma
      // pesquisa de 03/08; Goiás, mesmo rótulo, em 0,05 ponto por uma de 13/05.
      // Com a série restrita à base, o que é desenhado e o que é declarado saem
      // do mesmo conjunto nos dois canais (pontos e linha).
      const serie = agregado
        ? serieTemporal(agregado.pesquisasUsadas, {}, hoje)
        : polls.length > 0
          ? serieTemporal(polls, {}, hoje)
          : null;
      const eleitores = repos.electorate.porUf(uf)?.eleitores ?? null;

      if (agregado && eleitores != null) {
        eleitoradoComPesquisa += eleitores;
      }
      if (agregado?.foraDaJanela) ufsForaDaJanela.push(uf);

      // Lado da eleição em que a leitura da UF foi medida. Olha as pesquisas
      // que o agregado DECLARA ter usado (não todas as da disputa): se alguma
      // delas tem campo posterior a 04/10, a leitura já fala da eleição
      // marcada. Mesma data e mesma comparação do agregado nacional
      // (`get-presidential-aggregate.ts`), para os dois canais não divergirem.
      const medidaAposOPrimeiroTurno =
        turno === 2 && agregado != null
          ? agregado.pesquisasUsadas.some((p) => dataReferencia(p) > DATA_PRIMEIRO_TURNO)
          : null;
      if (medidaAposOPrimeiroTurno === false) ufsAntesDoPrimeiroTurno.push(uf);

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
        medidaAposOPrimeiroTurno,
      };
    });

    const todoOEleitorado = repos.electorate.todos();
    const eleitoradoNacional =
      todoOEleitorado.length > 0 ? todoOEleitorado.reduce((soma, e) => soma + e.eleitores, 0) : null;

    return {
      ufs,
      eleitoradoNacional,
      eleitoradoComPesquisa,
      turno,
      confronto,
      ufsForaDaJanela,
      ufsAntesDoPrimeiroTurno,
    };
  };
}
