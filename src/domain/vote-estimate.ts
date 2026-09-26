import type { Agregado } from './aggregate.js';

/**
 * Serviço de domínio: estimativa de votos presidenciais a partir da agregação
 * por UF (`get-presidential-by-state.ts`). Puro — sem I/O. Serve tanto ao 1º
 * turno quanto ao 2º: a função não conhece turno nem confronto, só recebe os
 * agregados já recortados por quem chama (`get-vote-estimate.ts` cuida de
 * filtrar o confronto do 2º turno — ver `domain/runoff.ts`).
 *
 * Para cada UF, se houver pesquisa presidencial estadual (agregado próprio),
 * a estimativa usa os percentuais desse agregado; quando a UF ainda não tem
 * pesquisa estadual, usa os percentuais do agregado nacional (do mesmo
 * recorte) como substituto e marca a UF com `origem: 'nacional'` em `porUf`.
 * Quando a UF só tem pesquisa fora da janela de recência, `agregarPesquisas`
 * já usou a mais recente disponível e marcou `foraDaJanela` — a estimativa
 * propaga essa marca em `porUf[].foraDaJanela` e `ufsForaDaJanela`, em vez de
 * descartar o dado real ou substituí-lo pelo nacional. Nunca inventa
 * dados: se uma UF não tem agregado estadual E não há agregado nacional para
 * suprir a lacuna, `estimarVotos` lança `EstimativaVotosError` em vez de
 * silenciosamente ignorar a UF.
 *
 * Correção metodológica: muitas pesquisas estaduais só testam os 2 ou 3
 * primeiros colocados, então um candidato menor (ex.: alguém com ~9% no
 * nacional) simplesmente não aparece no agregado estadual — tratar isso como
 * 0 nessa UF derruba artificialmente candidatos menores no total nacional
 * estimado. Por isso, em toda UF que TEM pesquisa estadual, qualquer
 * candidato do agregado NACIONAL que não apareça no agregado ESTADUAL recebe
 * o percentual nacional desse candidato aplicado ao eleitorado da UF — a
 * parcela é marcada com `origem: 'complemento-nacional'` (distinta de
 * 'estadual', a pesquisa própria da UF, e de 'nacional', usado só quando a UF
 * inteira não tem pesquisa estadual). Se a soma dos percentuais atribuídos
 * numa UF (estadual + complemento) passar de 100%, todos os percentuais
 * atribuídos daquela UF são normalizados proporcionalmente para caber no
 * eleitorado — a UF entra em `ufsNormalizadas`.
 */

export interface EstimativaVotosUfEntrada {
  readonly uf: string;
  readonly eleitores: number;
  /** Agregado da disputa presidencial (do turno/confronto em recorte) nessa UF, ou null sem pesquisa estadual. */
  readonly agregado: Agregado | null;
}

export interface CandidatoEstimado {
  readonly candidato: string;
  readonly partido: string | null;
  /** Votos estimados somados de todas as UFs (eleitores × pct/100). */
  readonly votos: number;
  /**
   * Extremo inferior da faixa de incerteza: `votos` menos a margem de erro
   * agregada, propagada UF a UF (eleitores × margem/100 de cada pesquisa —
   * estadual ou nacional — usada naquela UF, somada entre as UFs). Nunca
   * negativo.
   */
  readonly votosMin: number;
  /**
   * Extremo superior da faixa de incerteza: `votos` mais a mesma margem de
   * erro agregada usada em `votosMin`. Ver `votosMin`.
   */
  readonly votosMax: number;
  /** Percentual sobre o eleitorado total (0..100). */
  readonly pctDoEleitorado: number;
  /** Percentual sobre a soma de votos atribuídos a candidatos (exclui `naoAtribuidos`). */
  readonly pctDosVotosAtribuidos: number;
  /** Parcela dos votos vinda do percentual PRÓPRIO da pesquisa estadual, em UFs que têm pesquisa estadual. */
  readonly votosDeUfComPesquisa: number;
  /** Parcela dos votos vinda de UFs sem pesquisa estadual (usou o agregado nacional para a UF inteira). */
  readonly votosDeUfSemPesquisa: number;
  /**
   * Parcela dos votos, em UFs que TÊM pesquisa estadual, de quando este
   * candidato não apareceu nessa pesquisa estadual e foi suprido pelo
   * percentual do agregado nacional aplicado ao eleitorado da UF.
   */
  readonly votosComplementoNacional: number;
}

/**
 * Origem de uma parcela de votos de um candidato numa UF: 'estadual' veio do
 * percentual próprio da pesquisa estadual; 'nacional' veio do agregado
 * nacional porque a UF inteira não tem pesquisa estadual; 'complemento-
 * nacional' veio do agregado nacional porque a UF TEM pesquisa estadual mas
 * esse candidato específico não apareceu nela.
 */
export type OrigemVotoCandidato = 'estadual' | 'nacional' | 'complemento-nacional';

export interface VotosCandidatoUf {
  readonly votos: number;
  readonly origem: OrigemVotoCandidato;
}

export interface UfOrigemVotos {
  readonly uf: string;
  readonly eleitores: number;
  /** 'estadual' quando a UF tinha agregado próprio; 'nacional' quando usou o substituto nacional. */
  readonly origem: 'estadual' | 'nacional';
  /**
   * true quando o agregado estadual desta UF não tinha nenhuma pesquisa dentro
   * da janela de recência e usou a mais recente disponível
   * (`Agregado.foraDaJanela`). Sempre false quando `origem` é 'nacional'.
   */
  readonly foraDaJanela: boolean;
  /** Votos estimados por candidato nesta UF, com a origem de cada parcela (chave = nome do candidato). */
  readonly votosPorCandidato: Readonly<Record<string, VotosCandidatoUf>>;
}

export interface ComparacaoNacional {
  readonly candidato: string;
  /** Percentual do candidato no agregado nacional. */
  readonly pctNacional: number;
  /** Percentual estimado (pctDoEleitorado) resultante da agregação estadual. */
  readonly pctEstimado: number;
}

/** Parcela do eleitorado sem candidato, separada pelo que a fonte publicou. */
export interface NaoAtribuidos {
  readonly votos: number;
  readonly pct: number;
  /**
   * O que as pesquisas de fato publicaram como linha de não-candidato
   * (brancos/nulos/não sabe, "outros"), de `Agregado.outros`.
   */
  readonly declarados: { readonly votos: number; readonly pct: number };
  /**
   * O resto: parcela do eleitorado que nenhuma linha publicada cobre, porque
   * a matéria deu só os primeiros nomes e o percentual restante nunca foi
   * divulgado. Não é voto em branco nem indeciso — é lacuna de divulgação, e
   * no 2º turno é a maior parte do resíduo (≈2/3), porque as rodadas de
   * returno costumam publicar só os dois nomes.
   *
   * Quem exibe **não pode** descrever isso como escolha do eleitor: dizer
   * que "o voto que não vai para nenhum dos dois não tem para onde ir"
   * transforma lacuna de divulgação em achado político.
   */
  readonly semLinhaPublicada: { readonly votos: number; readonly pct: number };
}

export interface EstimativaVotos {
  /** Candidatos com votos somados, ordenados por votos desc. */
  readonly candidatos: readonly CandidatoEstimado[];
  /**
   * Parcela do eleitorado não atribuída a nenhum candidato. Vem de duas
   * origens muito diferentes, e `declarados`/`naoPublicados` as separam:
   * confundi-las faz a tela apresentar lacuna de divulgação como
   * comportamento de eleitor.
   */
  readonly naoAtribuidos: NaoAtribuidos;
  readonly eleitoradoTotal: number;
  /** Soma do eleitorado apenas das UFs que tinham pesquisa presidencial estadual própria. */
  readonly eleitoradoComPesquisaEstadual: number;
  readonly ufsComPesquisa: readonly string[];
  readonly ufsSemPesquisa: readonly string[];
  /**
   * UFs que tinham pesquisa estadual, mas só fora da janela de recência: o
   * agregado usou a pesquisa mais recente disponível (ver
   * `UfOrigemVotos.foraDaJanela`). Subconjunto de `ufsComPesquisa`.
   */
  readonly ufsForaDaJanela: readonly string[];
  readonly porUf: readonly UfOrigemVotos[];
  /** Um item por candidato do agregado nacional, comparando pct nacional vs. estimado. */
  readonly comparacaoNacional: readonly ComparacaoNacional[];
  /**
   * UFs onde a soma dos percentuais atribuídos (pesquisa estadual própria +
   * complemento nacional) passou de 100% e precisou ser normalizada
   * proporcionalmente para caber no eleitorado da UF.
   */
  readonly ufsNormalizadas: readonly string[];
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
  votosComplementoNacional: number;
  /** Soma, entre todas as UFs, de eleitores × (margem da pesquisa usada)/100 para este candidato. */
  margemVotos: number;
}

interface Contribuicao {
  readonly candidato: string;
  readonly partido: string | null;
  readonly pct: number;
  readonly origem: OrigemVotoCandidato;
  /**
   * Margem de erro (pontos percentuais, 0..100) do agregado que forneceu
   * `pct` — o agregado estadual para origem 'estadual', o nacional para
   * 'nacional' e 'complemento-nacional'. Usada para propagar a faixa de
   * incerteza (`CandidatoEstimado.votosMin`/`votosMax`).
   */
  readonly margemPct: number;
}

/** Chave de comparação entre candidatos (não usada para exibição): trim + minúsculas. */
/**
 * Monta `naoAtribuidos` separando o resíduo entre o que as fontes publicaram
 * como linha de não-candidato e o que nenhuma linha cobre. `declarados` é
 * limitado ao próprio resíduo — nas UFs em que o agregado bruto passou de
 * 100% e foi normalizado o resíduo é zero, e a linha publicada não cabe —,
 * então `semLinhaPublicada` nunca é negativo.
 */
function montarNaoAtribuidos(
  votos: number,
  declaradosVotos: number,
  eleitoradoTotal: number,
): NaoAtribuidos {
  const pctDe = (v: number): number => (eleitoradoTotal > 0 ? (v / eleitoradoTotal) * 100 : 0);
  const declarados = Math.min(votos, Math.max(0, declaradosVotos));
  const semLinha = votos - declarados;
  return {
    votos,
    pct: pctDe(votos),
    declarados: { votos: declarados, pct: pctDe(declarados) },
    semLinhaPublicada: { votos: semLinha, pct: pctDe(semLinha) },
  };
}

function chaveComparacao(nome: string): string {
  return nome.trim().toLowerCase();
}

/**
 * Estima votos presidenciais por candidato (mesmo algoritmo para 1º e 2º
 * turno — o recorte de turno/confronto é responsabilidade de quem chama), combinando o
 * eleitorado de cada UF com os percentuais do agregado estadual quando
 * disponível (mais o complemento nacional para candidatos ausentes dessa
 * pesquisa estadual), ou do agregado nacional inteiro como substituto quando
 * a UF não tem pesquisa estadual.
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
  const ufsForaDaJanela: string[] = [];
  const ufsNormalizadas: string[] = [];

  let eleitoradoTotal = 0;
  let eleitoradoComPesquisaEstadual = 0;
  let naoAtribuidosVotos = 0;
  let naoAtribuidosDeclaradosVotos = 0;

  for (const entrada of porUf) {
    eleitoradoTotal += entrada.eleitores;
    const usaEstadual = entrada.agregado !== null;
    const origemUf: 'estadual' | 'nacional' = usaEstadual ? 'estadual' : 'nacional';

    let contribuicoes: Contribuicao[];

    if (usaEstadual) {
      ufsComPesquisa.push(entrada.uf);
      eleitoradoComPesquisaEstadual += entrada.eleitores;

      const estadual = entrada.agregado!;
      if (estadual.foraDaJanela) ufsForaDaJanela.push(entrada.uf);
      const chavesEstaduais = new Set(estadual.candidatos.map((c) => chaveComparacao(c.candidato)));

      contribuicoes = estadual.candidatos.map(
        (c): Contribuicao => ({
          candidato: c.candidato.trim(),
          partido: c.partido,
          pct: c.pct,
          origem: 'estadual',
          margemPct: estadual.margemReferencia,
        }),
      );

      // Candidatos do nacional ausentes da pesquisa estadual (muitas
      // pesquisas estaduais só testam os 2-3 primeiros colocados): supridos
      // pelo percentual nacional, para não zerar candidatos menores.
      if (agregadoNacional) {
        for (const cn of agregadoNacional.candidatos) {
          if (chavesEstaduais.has(chaveComparacao(cn.candidato))) continue;
          contribuicoes.push({
            candidato: cn.candidato.trim(),
            partido: cn.partido,
            pct: cn.pct,
            origem: 'complemento-nacional',
            margemPct: agregadoNacional.margemReferencia,
          });
        }
      }
    } else {
      ufsSemPesquisa.push(entrada.uf);
      // Validado acima: se !usaEstadual, agregadoNacional não é null.
      const nacional = agregadoNacional!;
      contribuicoes = nacional.candidatos.map(
        (c): Contribuicao => ({
          candidato: c.candidato.trim(),
          partido: c.partido,
          pct: c.pct,
          origem: 'nacional',
          margemPct: nacional.margemReferencia,
        }),
      );
    }

    const somaPctBruto = contribuicoes.reduce((soma, c) => soma + c.pct, 0);
    const precisaNormalizar = somaPctBruto > 100;
    const fatorNormalizacao = precisaNormalizar ? 100 / somaPctBruto : 1;
    if (precisaNormalizar) ufsNormalizadas.push(entrada.uf);

    const votosPorCandidato: Record<string, VotosCandidatoUf> = {};
    let somaVotosAtribuidosUf = 0;

    for (const c of contribuicoes) {
      const pctFinal = c.pct * fatorNormalizacao;
      const votos = entrada.eleitores * (pctFinal / 100);
      // A margem de erro é uma propriedade da pesquisa, não da parcela
      // normalizada de espaço no eleitorado — não aplica `fatorNormalizacao`
      // aqui, para não subestimar a incerteza justamente nas UFs onde o
      // agregado bruto excedeu 100% (ver `ufsNormalizadas`).
      const margemVotos = entrada.eleitores * (c.margemPct / 100);
      somaVotosAtribuidosUf += votos;

      votosPorCandidato[c.candidato] = { votos, origem: c.origem };

      const atual: Acumulador = acumulado.get(c.candidato) ?? {
        candidato: c.candidato,
        partido: c.partido,
        votos: 0,
        votosComPesquisa: 0,
        votosSemPesquisa: 0,
        votosComplementoNacional: 0,
        margemVotos: 0,
      };
      atual.votos += votos;
      atual.margemVotos += margemVotos;
      if (c.origem === 'estadual') atual.votosComPesquisa += votos;
      else if (c.origem === 'nacional') atual.votosSemPesquisa += votos;
      else atual.votosComplementoNacional += votos;
      if (atual.partido === null && c.partido !== null) atual.partido = c.partido;
      acumulado.set(c.candidato, atual);
    }

    // Parcela do eleitorado desta UF não coberta por nenhum candidato
    // (brancos, nulos, indecisos, outros): nunca negativa — quando a
    // normalização acima já usou 100% do eleitorado, fica em 0.
    const residuoUf = Math.max(0, entrada.eleitores - somaVotosAtribuidosUf);
    naoAtribuidosVotos += residuoUf;

    // Quanto do resíduo desta UF as pesquisas realmente publicaram como linha
    // de não-candidato. O `Math.min` evita que a linha publicada estoure o
    // resíduo quando a normalização acima já consumiu o eleitorado da UF.
    const agregadoDaUf = usaEstadual ? entrada.agregado! : agregadoNacional!;
    const pctNaoCandidatoPublicado = agregadoDaUf.outros.reduce((soma, c) => soma + c.pct, 0);
    naoAtribuidosDeclaradosVotos += Math.min(
      residuoUf,
      entrada.eleitores * (pctNaoCandidatoPublicado / 100),
    );

    porUfResultado.push({
      uf: entrada.uf,
      eleitores: entrada.eleitores,
      origem: origemUf,
      foraDaJanela: entrada.agregado?.foraDaJanela ?? false,
      votosPorCandidato,
    });
  }

  const candidatosSemPct: (Omit<CandidatoEstimado, 'pctDoEleitorado' | 'pctDosVotosAtribuidos'> & {
    votos: number;
  })[] = [...acumulado.values()].map((acc) => ({
    candidato: acc.candidato,
    partido: acc.partido,
    votos: acc.votos,
    votosMin: Math.max(0, acc.votos - acc.margemVotos),
    votosMax: acc.votos + acc.margemVotos,
    votosDeUfComPesquisa: acc.votosComPesquisa,
    votosDeUfSemPesquisa: acc.votosSemPesquisa,
    votosComplementoNacional: acc.votosComplementoNacional,
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
    naoAtribuidos: montarNaoAtribuidos(
      naoAtribuidosVotos,
      naoAtribuidosDeclaradosVotos,
      eleitoradoTotal,
    ),
    eleitoradoTotal,
    eleitoradoComPesquisaEstadual,
    ufsComPesquisa,
    ufsSemPesquisa,
    ufsForaDaJanela,
    porUf: porUfResultado,
    comparacaoNacional,
    ufsNormalizadas,
  };
}
