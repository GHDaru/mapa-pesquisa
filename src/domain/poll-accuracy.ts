/**
 * Acerto das pesquisas contra o resultado.
 *
 * É a conta que o projeto existe para fazer e que só pode ser feita uma vez
 * por eleição. Três decisões de método, porque cada uma delas muda o ranking
 * e esconder a escolha seria viés:
 *
 * 1. **Uma pesquisa por instituto: a última.** Medir a média das rodadas de um
 *    instituto premiaria quem publicou muito e puniria quem publicou pouco, e
 *    rodada de agosto não é tentativa de prever o resultado. Entra a última de
 *    cada um, com a data declarada — porque uma pesquisa de 13/09 e outra de
 *    02/10 não disputam em igualdade, e o leitor tem de ver isso.
 *
 * 2. **Base de votos válidos nas duas pontas.** As pesquisas da base estão no
 *    corte do total; o resultado oficial é em válidos. Cada pesquisa é
 *    renormalizada pela soma dos seus próprios candidatos antes de comparar.
 *
 * 3. **Dois erros, não um.** O erro médio absoluto por candidato mede
 *    calibração; o erro na margem entre os dois primeiros mede o que a
 *    cobertura de fato discute ("quem está na frente e por quanto"). Um
 *    instituto pode acertar a margem errando os dois níveis, e vice-versa.
 *    Ranquear por um só esconderia metade da história.
 *
 * O que esta camada se recusa a fazer: declarar um vencedor. Devolve os
 * números ordenados e marca empate dentro de uma tolerância; quem exibe é
 * obrigado a mostrar a data e a amostra ao lado, porque sem elas o ranking é
 * injusto com quem foi a campo antes.
 */

import type { Pesquisa } from './poll.js';

/** Data do 1º turno de 2026, para medir quantos dias antes cada pesquisa saiu. */
export const DATA_PRIMEIRO_TURNO = '2026-10-04';

export interface ErroDeCandidato {
  readonly candidato: string;
  /** Percentual da pesquisa, já renormalizado para a base de válidos. */
  readonly pctPesquisa: number;
  readonly pctResultado: number;
  /** `pctPesquisa - pctResultado`. Positivo = a pesquisa superestimou. */
  readonly erro: number;
}

export interface AcertoDoInstituto {
  readonly instituto: string;
  readonly pollId: string;
  /** Fim do campo (ou publicação, quando o campo não foi declarado). */
  readonly dataReferencia: string;
  /** Dias entre o fim do campo e a eleição. Quanto maior, menos comparável. */
  readonly diasAntes: number;
  readonly amostra: number | null;
  readonly margemDeclarada: number | null;
  readonly candidatosComparados: number;
  readonly erroMedioAbsoluto: number;
  readonly erroPorCandidato: readonly ErroDeCandidato[];
  /**
   * Margem do 1º sobre o 2º colocado **do resultado**, medida na pesquisa,
   * menos a margem real. Positivo = a pesquisa exagerou a vantagem de quem
   * venceu; negativo = subestimou. `null` quando a pesquisa não traz os dois.
   */
  readonly erroNaMargem: number | null;
  /** A pesquisa apontava como 1º colocado quem de fato ficou em 1º. */
  readonly acertouOLider: boolean;
  /** Ressalva do projeto sobre o instituto (integridade, suspensão judicial). */
  readonly alerta: string | null;
}

export interface AcertoDasPesquisas {
  /** Um registro por instituto, ordenado por erro médio absoluto crescente. */
  readonly institutos: readonly AcertoDoInstituto[];
  /** Mediana do erro médio absoluto. Mediana, não média: resiste a um outlier. */
  readonly erroMedianoDoCampo: number | null;
  /** Quantos institutos acertaram quem ficou em primeiro. */
  readonly acertaramOLider: number;
  /** Nome do 1º e do 2º colocado no resultado, na ordem. */
  readonly primeiroESegundo: readonly [string, string] | null;
  readonly margemReal: number | null;
}

/**
 * Ressalvas que o projeto registrou sobre institutos específicos. Um instituto
 * sob alerta não é removido do ranking — removê-lo esconderia a comparação —,
 * mas aparece marcado, porque ler o número dele sem a ressalva seria pior.
 */
export const ALERTAS_POR_INSTITUTO: Readonly<Record<string, string>> = Object.freeze({
  'Veritá':
    'alerta de integridade aberto em 18/09 (indícios de duplicação de linhas) e ' +
    'pesquisas barradas judicialmente em 13 estados e no DF neste ciclo',
  'Instituto Veritá':
    'alerta de integridade aberto em 18/09 (indícios de duplicação de linhas) e ' +
    'pesquisas barradas judicialmente em 13 estados e no DF neste ciclo',
  'Real Time Big Data':
    'rodadas suspensas judicialmente em sete estados (PR, CE, MA, RN, AL, SE e TO) ' +
    'por manifesta inverossimilhança econômica; a rodada nacional não foi alvo',
});

/** Dias inteiros entre duas datas ISO. Negativo quando a primeira é posterior. */
function diasEntre(deIso: string, ateIso: string): number {
  const de = Date.parse(`${deIso}T00:00:00Z`);
  const ate = Date.parse(`${ateIso}T00:00:00Z`);
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.round((ate - de) / 86_400_000);
}

function dataReferenciaDa(p: Pesquisa): string {
  return p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '';
}

/**
 * Renormaliza as linhas de candidato de UMA pesquisa para somar 100 — a base
 * em que o resultado oficial é publicado. `excluidos` são os rótulos que não
 * são candidato (brancos, nulos, indecisos), que o chamador identifica com o
 * domínio de `poll.ts`.
 */
export function pctValidosDaPesquisa(
  pesquisa: Pesquisa,
  ehNaoCandidato: (rotulo: string) => boolean,
): Map<string, number> {
  const candidatos = pesquisa.resultados.filter((r) => !ehNaoCandidato(r.candidato));
  const soma = candidatos.reduce((t, r) => t + r.pct, 0);
  if (soma <= 0) return new Map();
  return new Map(candidatos.map((r) => [r.candidato, (r.pct / soma) * 100]));
}

function medianaDe(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? ordenados[meio]!
    : (ordenados[meio - 1]! + ordenados[meio]!) / 2;
}

/**
 * Mede o acerto de cada instituto contra o resultado.
 *
 * `pctResultado` já deve estar na base de válidos (soma ~100). `pesquisas` deve
 * vir filtrada para UM recorte — mesmo cargo, turno e UF —, porque misturar
 * recortes compararia coisas diferentes.
 */
export function medirAcertoDasPesquisas(
  pesquisas: readonly Pesquisa[],
  pctResultado: ReadonlyMap<string, number>,
  ehNaoCandidato: (rotulo: string) => boolean,
  dataEleicao: string = DATA_PRIMEIRO_TURNO,
): AcertoDasPesquisas {
  const ordenadoPorResultado = [...pctResultado.entries()].sort((a, b) => b[1] - a[1]);
  const primeiro = ordenadoPorResultado[0];
  const segundo = ordenadoPorResultado[1];
  const primeiroESegundo: readonly [string, string] | null =
    primeiro && segundo ? [primeiro[0], segundo[0]] : null;
  const margemReal = primeiro && segundo ? primeiro[1] - segundo[1] : null;

  // Última pesquisa de cada instituto, pela data de referência.
  const ultimaPorInstituto = new Map<string, Pesquisa>();
  for (const p of pesquisas) {
    const atual = ultimaPorInstituto.get(p.instituto);
    if (!atual || dataReferenciaDa(p) > dataReferenciaDa(atual)) {
      ultimaPorInstituto.set(p.instituto, p);
    }
  }

  const institutos: AcertoDoInstituto[] = [];
  for (const [instituto, p] of ultimaPorInstituto) {
    const pct = pctValidosDaPesquisa(p, ehNaoCandidato);
    const erroPorCandidato: ErroDeCandidato[] = [];
    for (const [candidato, pctResult] of pctResultado) {
      const pctPesquisa = pct.get(candidato);
      if (pctPesquisa == null) continue;
      erroPorCandidato.push({
        candidato,
        pctPesquisa,
        pctResultado: pctResult,
        erro: pctPesquisa - pctResult,
      });
    }
    if (erroPorCandidato.length === 0) continue;

    const erroMedioAbsoluto =
      erroPorCandidato.reduce((t, e) => t + Math.abs(e.erro), 0) / erroPorCandidato.length;

    let erroNaMargem: number | null = null;
    if (primeiroESegundo) {
      const a = pct.get(primeiroESegundo[0]);
      const b = pct.get(primeiroESegundo[1]);
      if (a != null && b != null && margemReal != null) erroNaMargem = a - b - margemReal;
    }

    const liderDaPesquisa = [...pct.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;

    institutos.push({
      instituto,
      pollId: p.id,
      dataReferencia: dataReferenciaDa(p),
      diasAntes: diasEntre(dataReferenciaDa(p), dataEleicao),
      amostra: p.amostra ?? null,
      margemDeclarada: p.margem ?? null,
      candidatosComparados: erroPorCandidato.length,
      erroMedioAbsoluto,
      erroPorCandidato: erroPorCandidato.sort((x, y) => y.pctResultado - x.pctResultado),
      erroNaMargem,
      acertouOLider: liderDaPesquisa != null && liderDaPesquisa === primeiroESegundo?.[0],
      alerta: ALERTAS_POR_INSTITUTO[instituto] ?? null,
    });
  }

  institutos.sort((a, b) => a.erroMedioAbsoluto - b.erroMedioAbsoluto);

  return {
    institutos,
    erroMedianoDoCampo: medianaDe(institutos.map((i) => i.erroMedioAbsoluto)),
    acertaramOLider: institutos.filter((i) => i.acertouOLider).length,
    primeiroESegundo,
    margemReal,
  };
}
