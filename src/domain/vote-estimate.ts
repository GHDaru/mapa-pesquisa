import type { Agregado } from './aggregate.js';

/**
 * Serviço de domínio: estimativa de votos presidenciais (1º turno) a partir
 * da agregação por UF (`get-presidential-by-state.ts`). Puro — sem I/O.
 *
 * Para cada UF, se houver pesquisa presidencial estadual (agregado próprio),
 * a estimativa usa os percentuais desse agregado; quando a UF ainda não tem
 * pesquisa estadual, usa os percentuais do agregado nacional (1º turno) como
 * substituto e marca a UF com `origem: 'nacional'` em `porUf`. Nunca inventa
 * dados: se uma UF não tem agregado estadual E não há agregado nacional para
 * suprir a lacuna, `estimarVotos` lança `EstimativaVotosError` em vez de
 * silenciosamente ignorar a UF.
 */

export interface EstimativaVotosUfEntrada {
  readonly uf: string;
  readonly eleitores: number;
  /** Agregado da disputa presidencial (1º turno) nessa UF, ou null sem pesquisa estadual. */
  readonly agregado: Agregado | null;
}

export interface CandidatoEstimado {
  readonly candidato: string;
  readonly partido: string | null;
  /** Votos estimados somados de todas as UFs (eleitores × pct/100). */
  readonly votos: number;
  /** Percentual sobre o eleitorado total (0..100). */
  readonly pctDoEleitorado: number;
  /** Percentual sobre a soma de votos atribuídos a candidatos (exclui `naoAtribuidos`). */
  readonly pctDosVotosAtribuidos: number;
  /** Parcela dos votos vinda de UFs com pesquisa estadual própria. */
  readonly votosDeUfComPesquisa: number;
  /** Parcela dos votos vinda de UFs sem pesquisa estadual (usou o agregado nacional). */
  readonly votosDeUfSemPesquisa: number;
}

export interface UfOrigemVotos {
  readonly uf: string;
  readonly eleitores: number;
  /** 'estadual' quando a UF tinha agregado próprio; 'nacional' quando usou o substituto nacional. */
  readonly origem: 'estadual' | 'nacional';
  /** Votos estimados por candidato nesta UF (chave = nome do candidato). */
  readonly votosPorCandidato: Readonly<Record<string, number>>;
}

export interface ComparacaoNacional {
  readonly candidato: string;
  /** Percentual do candidato no agregado nacional. */
  readonly pctNacional: number;
  /** Percentual estimado (pctDoEleitorado) resultante da agregação estadual. */
  readonly pctEstimado: number;
}

export interface EstimativaVotos {
  /** Candidatos com votos somados, ordenados por votos desc. */
  readonly candidatos: readonly CandidatoEstimado[];
  /**
   * Parcela do eleitorado não atribuída a nenhum candidato (brancos, nulos,
   * indecisos, "outros" — linhas que `agregarPesquisas` já separa em
   * `Agregado.outros` e não soma aqui como candidato).
   */
  readonly naoAtribuidos: { readonly votos: number; readonly pct: number };
  readonly eleitoradoTotal: number;
  /** Soma do eleitorado apenas das UFs que tinham pesquisa presidencial estadual própria. */
  readonly eleitoradoComPesquisaEstadual: number;
  readonly ufsComPesquisa: readonly string[];
  readonly ufsSemPesquisa: readonly string[];
  readonly porUf: readonly UfOrigemVotos[];
  /** Um item por candidato do agregado nacional, comparando pct nacional vs. estimado. */
  readonly comparacaoNacional: readonly ComparacaoNacional[];
}

export class EstimativaVotosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EstimativaVotosError';
  }
}

interface Acumulador {
  candidato: string;
  partido: string | null;
  votos: number;
  votosComPesquisa: number;
  votosSemPesquisa: number;
}

/**
 * Estima votos presidenciais (1º turno) por candidato, combinando o
 * eleitorado de cada UF com os percentuais do agregado estadual quando
 * disponível, ou do agregado nacional como substituto caso contrário.
 *
 * Lança `EstimativaVotosError` quando alguma UF não tem agregado estadual e
 * `agregadoNacional` é `null` (não há como estimar aquela UF sem inventar
 * dados).
 */
export function estimarVotos(
  porUf: readonly EstimativaVotosUfEntrada[],
  agregadoNacional: Agregado | null,
): EstimativaVotos {
  const ufsSemAgregadoEstadual = porUf.filter((u) => u.agregado === null);
  if (agregadoNacional === null && ufsSemAgregadoEstadual.length > 0) {
    const lista = ufsSemAgregadoEstadual.map((u) => u.uf).join(', ');
    throw new EstimativaVotosError(
      `Não é possível estimar votos: ${ufsSemAgregadoEstadual.length} UF(s) sem pesquisa presidencial ` +
        `estadual (${lista}) e nenhum agregado nacional disponível como substituto.`,
    );
  }

  const acumulado = new Map<string, Acumulador>();
  const porUfResultado: UfOrigemVotos[] = [];
  const ufsComPesquisa: string[] = [];
  const ufsSemPesquisa: string[] = [];

  let eleitoradoTotal = 0;
  let eleitoradoComPesquisaEstadual = 0;
  let naoAtribuidosVotos = 0;

  for (const entrada of porUf) {
    eleitoradoTotal += entrada.eleitores;
    const usaEstadual = entrada.agregado !== null;
    // Validado acima: se !usaEstadual, agregadoNacional não é null.
    const agregado = (entrada.agregado ?? agregadoNacional)!;
    const origem: 'estadual' | 'nacional' = usaEstadual ? 'estadual' : 'nacional';

    if (usaEstadual) {
      ufsComPesquisa.push(entrada.uf);
      eleitoradoComPesquisaEstadual += entrada.eleitores;
    } else {
      ufsSemPesquisa.push(entrada.uf);
    }

    const votosPorCandidato: Record<string, number> = {};
    let somaPctCandidatos = 0;

    for (const c of agregado.candidatos) {
      const chave = c.candidato.trim();
      const votos = entrada.eleitores * (c.pct / 100);
      somaPctCandidatos += c.pct;
      votosPorCandidato[chave] = (votosPorCandidato[chave] ?? 0) + votos;

      const atual: Acumulador = acumulado.get(chave) ?? {
        candidato: chave,
        partido: c.partido,
        votos: 0,
        votosComPesquisa: 0,
        votosSemPesquisa: 0,
      };
      atual.votos += votos;
      if (usaEstadual) atual.votosComPesquisa += votos;
      else atual.votosSemPesquisa += votos;
      if (atual.partido === null && c.partido !== null) atual.partido = c.partido;
      acumulado.set(chave, atual);
    }

    // Parcela do eleitorado desta UF não coberta por candidatos (brancos,
    // nulos, indecisos, outros): o restante até 100% do pct dos candidatos.
    const pctNaoAtribuido = Math.max(0, 100 - somaPctCandidatos);
    naoAtribuidosVotos += entrada.eleitores * (pctNaoAtribuido / 100);

    porUfResultado.push({ uf: entrada.uf, eleitores: entrada.eleitores, origem, votosPorCandidato });
  }

  const candidatosSemPct: (Omit<CandidatoEstimado, 'pctDoEleitorado' | 'pctDosVotosAtribuidos'> & {
    votos: number;
  })[] = [...acumulado.values()].map((acc) => ({
    candidato: acc.candidato,
    partido: acc.partido,
    votos: acc.votos,
    votosDeUfComPesquisa: acc.votosComPesquisa,
    votosDeUfSemPesquisa: acc.votosSemPesquisa,
  }));

  const totalVotosAtribuidos = candidatosSemPct.reduce((soma, c) => soma + c.votos, 0);

  const candidatos: CandidatoEstimado[] = candidatosSemPct
    .map((c) => ({
      ...c,
      pctDoEleitorado: eleitoradoTotal > 0 ? (c.votos / eleitoradoTotal) * 100 : 0,
      pctDosVotosAtribuidos: totalVotosAtribuidos > 0 ? (c.votos / totalVotosAtribuidos) * 100 : 0,
    }))
    .sort((a, b) => b.votos - a.votos);

  const comparacaoNacional: ComparacaoNacional[] = agregadoNacional
    ? agregadoNacional.candidatos.map((c) => {
        const chave = c.candidato.trim();
        const estimado = candidatos.find((cf) => cf.candidato === chave);
        return { candidato: chave, pctNacional: c.pct, pctEstimado: estimado?.pctDoEleitorado ?? 0 };
      })
    : [];

  return {
    candidatos,
    naoAtribuidos: {
      votos: naoAtribuidosVotos,
      pct: eleitoradoTotal > 0 ? (naoAtribuidosVotos / eleitoradoTotal) * 100 : 0,
    },
    eleitoradoTotal,
    eleitoradoComPesquisaEstadual,
    ufsComPesquisa,
    ufsSemPesquisa,
    porUf: porUfResultado,
    comparacaoNacional,
  };
}
