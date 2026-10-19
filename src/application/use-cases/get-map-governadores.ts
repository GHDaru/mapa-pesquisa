import type { Clock, Repositorios } from '../ports.js';
import { agregarPesquisas, MARGEM_REFERENCIA_PADRAO } from '../../domain/aggregate.js';
import { UFS } from '../../domain/race.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import { DATA_PRIMEIRO_TURNO } from '../../domain/poll-accuracy.js';
import { espectroDoPartido, type Espectro } from '../../domain/spectrum.js';
import { mesmoCandidato } from '../../domain/candidate-identity.js';
import type { GovernadorUf } from '../../domain/resultado.js';
import { selecionarPesquisasDeGovernador } from './governor-poll-selection.js';

/**
 * Como o mapa de governadores deve pintar uma UF. A distinção não é de
 * estilo, é de NATUREZA do dado: `decidido` é fato apurado nas urnas e
 * `em-disputa` é estimativa de pesquisa. Um mapa que pintasse os dois do
 * mesmo jeito afirmaria que sabe das duas coisas com a mesma certeza.
 */
export type SituacaoNoMapa = 'decidido' | 'em-disputa' | 'sem-dados';

export interface EleitoNoMapa {
  readonly nome: string;
  readonly partido: string;
  /** % dos votos VÁLIDOS no 1º turno. */
  readonly pctValidos: number | null;
}

export interface DisputaNoMapa {
  readonly lider: string;
  readonly partido: string | null;
  /** % sobre o TOTAL de entrevistados, convenção da base. */
  readonly pct: number;
  readonly vantagem: number;
  readonly margemReferencia: number;
  readonly empateTecnico: boolean;
  readonly pesquisas: number;
  readonly institutoUltima: string | null;
  readonly dataUltima: string | null;
  /** Nome do segundo colocado, quando há. */
  readonly segundo: string | null;
}

/**
 * O que as pesquisas diziam ANTES de 4 de outubro, confrontado com o que as
 * urnas decidiram. Só existe onde a eleição está decidida — onde ainda há
 * 2º turno não há resultado com que comparar.
 */
export interface ComparacaoNoMapa {
  readonly liderNasPesquisas: string;
  readonly partidoNasPesquisas: string | null;
  /** Instituto e data da ÚLTIMA pesquisa anterior à eleição — a que é comparada. */
  readonly instituto: string;
  readonly dataReferencia: string;
  readonly diasAntesDaEleicao: number;
  readonly amostra: number | null;
  /** O líder dessa pesquisa é quem as urnas elegeram? */
  readonly acertouOLider: boolean;
  /**
   * % do ELEITO na pesquisa, renormalizado para base de VÁLIDOS pelo elenco
   * DA PRÓPRIA PESQUISA, para ser comparável com `pctValidosUrnas`:
   * percentual de pesquisa é sobre o total de entrevistados e percentual de
   * urna é sobre votos válidos. `null` quando o eleito não figurava nela.
   */
  readonly pctEleitoNasPesquisasValidos: number | null;
  readonly pctValidosUrnas: number | null;
  /** `pctValidosUrnas - pctEleitoNasPesquisasValidos`, quando os dois existem. */
  readonly erroEmPontos: number | null;
}

export interface MapaGovernadorUf {
  readonly uf: string;
  readonly situacao: SituacaoNoMapa;
  /** Espectro que dá a cor: do partido do eleito, ou do líder das pesquisas. */
  readonly espectro: Espectro;
  readonly eleito: EleitoNoMapa | null;
  readonly disputa: DisputaNoMapa | null;
  readonly comparacao: ComparacaoNoMapa | null;
  /** Ressalva da UF (sub judice, retotalização), quando existe. */
  readonly observacao: string | null;
}

/** Converte um percentual sobre o total para base de válidos dentro da própria pesquisa. */
function paraBaseValidos(pct: number, somaCandidatos: number): number | null {
  if (somaCandidatos <= 0) return null;
  return (pct / somaCandidatos) * 100;
}

function diasEntreIso(deIso: string, ateIso: string): number {
  const de = Date.parse(`${deIso}T00:00:00Z`);
  const ate = Date.parse(`${ateIso}T00:00:00Z`);
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.round((ate - de) / 86_400_000);
}

/**
 * Caso de uso: o mapa de governadores DEPOIS da eleição. Em cada UF entrega
 * o fato (quem foi eleito) onde as urnas já decidiram e a estimativa (quem
 * lidera as pesquisas do 2º turno) onde a disputa continua, mais — onde há
 * resultado — a comparação com o que as pesquisas diziam antes de 4/10.
 *
 * Duas decisões de método, ambas conservadoras:
 *
 * 1. Nas UFs em disputa só entram pesquisas com campo POSTERIOR ao 1º turno
 *    E que testem o confronto REAL definido pelas urnas. Cenário hipotético
 *    de 2º turno medido antes da eleição não é pesquisa da disputa que está
 *    em curso, ainda que esteja marcado como turno 2 na base.
 * 2. A comparação usa as pesquisas de 1º turno com campo ATÉ 4/10 — o que se
 *    sabia na véspera, não o que se sabe depois.
 */
/**
 * Compara o resultado de uma UF com a ÚLTIMA pesquisa anterior à eleição.
 *
 * É uma pesquisa, não o agregado, e a razão é aritmética: renormalizar para
 * votos válidos exige dividir pela soma dos candidatos, e no agregado essa
 * soma mistura elencos DIFERENTES — um candidato testado por uma única
 * pesquisa entra com o percentual inteiro e infla a base, deprimindo a
 * fatia de todos os outros. Na primeira versão desta conta isso produziu
 * erros absurdos e todos no mesmo sentido (o eleito do PI aparecia com 43,5%
 * de válidos nas pesquisas contra 70,9% nas urnas). Uma pesquisa só tem
 * elenco coerente, e é a mesma decisão de método que `poll-accuracy.ts`
 * tomou para o ranking nacional.
 */
function compararComAUltimaPesquisa(
  anterioresAEleicao: readonly Pesquisa[],
  eleito: { readonly nome: string; readonly partido: string; readonly pctValidos: number | null },
): ComparacaoNoMapa | null {
  let ultima: Pesquisa | null = null;
  for (const p of anterioresAEleicao) {
    if (ultima === null || dataReferencia(p) > dataReferencia(ultima)) ultima = p;
  }
  if (ultima === null) return null;

  const candidatos = ultima.resultados.filter((r) => r.partido !== null);
  if (candidatos.length === 0) return null;
  const ordenados = [...candidatos].sort((a, b) => b.pct - a.pct);
  const lider = ordenados[0]!;
  const somaCandidatos = candidatos.reduce((s, c) => s + c.pct, 0);
  const doEleito = candidatos.find((c) => mesmoCandidato(c.candidato, eleito.nome)) ?? null;
  const pctEleitoValidos =
    doEleito === null ? null : paraBaseValidos(doEleito.pct, somaCandidatos);

  return {
    liderNasPesquisas: lider.candidato,
    partidoNasPesquisas: lider.partido,
    instituto: ultima.instituto,
    dataReferencia: dataReferencia(ultima),
    diasAntesDaEleicao: diasEntreIso(dataReferencia(ultima), DATA_PRIMEIRO_TURNO),
    amostra: ultima.amostra ?? null,
    acertouOLider: mesmoCandidato(lider.candidato, eleito.nome),
    pctEleitoNasPesquisasValidos: pctEleitoValidos,
    pctValidosUrnas: eleito.pctValidos,
    erroEmPontos:
      pctEleitoValidos !== null && eleito.pctValidos !== null
        ? eleito.pctValidos - pctEleitoValidos
        : null,
  };
}

export function criarGetMapaGovernadores(repos: Repositorios, clock: Clock) {
  return function getMapaGovernadores(): readonly MapaGovernadorUf[] {
    const hoje = clock.hoje();
    const partidos = repos.parties.todos();
    const resultado = repos.resultado.dados();
    const porUf = new Map<string, GovernadorUf>(resultado.governadores.map((g) => [g.uf, g]));

    return UFS.map((uf): MapaGovernadorUf => {
      const doResultado = porUf.get(uf) ?? null;
      const observacao = doResultado?.observacao ?? null;

      // --- UF decidida nas urnas: o mapa pinta o FATO -------------------
      if (doResultado?.situacao === 'eleito' && doResultado.eleito) {
        const eleito = doResultado.eleito;
        const comparacao = compararComAUltimaPesquisa(
          selecionarPesquisasDeGovernador(repos, uf, doResultado),
          eleito,
        );

        return {
          uf,
          situacao: 'decidido',
          espectro: espectroDoPartido(eleito.partido, partidos),
          eleito: { nome: eleito.nome, partido: eleito.partido, pctValidos: eleito.pctValidos },
          disputa: null,
          comparacao,
          observacao,
        };
      }

      // --- UF ainda em disputa: o mapa pinta a PESQUISA do 2º turno -----
      const pool = selecionarPesquisasDeGovernador(repos, uf, doResultado);
      const agregado = agregarPesquisas(pool, {}, hoje);

      if (!agregado?.lider) {
        return {
          uf,
          situacao: 'sem-dados',
          espectro: 'indefinido',
          eleito: null,
          disputa: null,
          comparacao: null,
          observacao,
        };
      }

      const ultima = agregado.ultimaPesquisa;
      return {
        uf,
        situacao: 'em-disputa',
        espectro: espectroDoPartido(agregado.lider.partido, partidos),
        eleito: null,
        disputa: {
          lider: agregado.lider.candidato,
          partido: agregado.lider.partido,
          pct: agregado.lider.pct,
          vantagem: agregado.vantagem,
          margemReferencia: agregado.margemReferencia ?? MARGEM_REFERENCIA_PADRAO,
          empateTecnico: agregado.empateTecnico,
          pesquisas: agregado.pesquisasUsadas.length,
          institutoUltima: ultima?.instituto ?? null,
          dataUltima: ultima ? dataReferencia(ultima) : null,
          segundo: agregado.segundo?.candidato ?? null,
        },
        comparacao: null,
        observacao,
      };
    });
  };
}
