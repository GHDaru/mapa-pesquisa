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

/**
 * Sobre o que os percentuais das pesquisas são aplicados.
 *
 * - `eleitorado`: base histórica, `eleitores × pct/100`. Trata cada eleitor
 *   registrado como se fosse votar e usa o percentual sobre o TOTAL de
 *   entrevistados. Serve para dizer "quantos eleitores do país estão com cada
 *   candidato hoje", mas não é comparável com um resultado de urna.
 * - `validos-1o-turno`: base ancorada no que de fato aconteceu em 4 de
 *   outubro. Os votos VÁLIDOS do 1º turno em cada UF já embutem, medidos e
 *   não supostos, a abstenção e os brancos e nulos daquela UF. Aplicando sobre
 *   eles os percentuais em base de VÁLIDOS, o resultado sai na mesma moeda do
 *   boletim do TSE — e os percentuais podem ser comparados diretamente com os
 *   47,03% x 45,16% do 1º turno.
 *
 * A suposição da segunda base, dita por inteiro: **o 2º turno terá a mesma
 * abstenção e a mesma taxa de brancos e nulos do 1º, UF a UF**. Historicamente
 * o 2º turno costuma ter abstenção um pouco MAIOR, então a estimativa de
 * votos absolutos tende a ficar um pouco alta; os PERCENTUAIS, que é o que a
 * tela destaca, quase não se mexem com isso, porque abstenção que sobe
 * proporcionalmente nos dois lados não muda a divisão entre eles.
 */
export type BaseDaEstimativa = 'eleitorado' | 'validos-1o-turno';

/** O que o 1º turno mediu numa UF, e que serve de âncora para o 2º. */
export interface AncoragemUf {
  /** Votos válidos apurados na UF no 1º turno. É a base de votos da estimativa ancorada. */
  readonly validosPrimeiroTurno: number;
  /**
   * Comparecimento apurado (válidos + brancos + nulos), quando a apuração traz
   * brancos e nulos. `null` quando a fonte não os publicou — a ancoragem ainda
   * funciona (ela só precisa dos válidos), mas a tela não pode anunciar a
   * taxa de abstenção daquela UF.
   */
  readonly comparecimentoPrimeiroTurno: number | null;
  /**
   * `apuracao` quando os válidos vieram da apuração daquela UF;
   * `substituto-nacional` quando a UF não tem apuração e os válidos foram
   * estimados pela razão válidos/eleitorado das UFs que têm. A distinção não
   * é decorativa: a segunda é suposição, e a tela a declara.
   */
  readonly origem: 'apuracao' | 'substituto-nacional';
  /**
   * Votos de cada candidato nesta UF no 1º turno, por nome, como a apuração
   * os publicou. Vazio quando a UF não tem apuração (e aí não há percentual
   * de 1º turno para mostrar ao lado da estimativa).
   *
   * Mora na âncora porque é exatamente isso: o que o 1º turno MEDIU nesta UF.
   */
  readonly votosPrimeiroTurno: Readonly<Record<string, number>>;
}

export interface EstimativaVotosUfEntrada {
  readonly uf: string;
  readonly eleitores: number;
  /** Agregado da disputa presidencial (do turno/confronto em recorte) nessa UF, ou null sem pesquisa estadual. */
  readonly agregado: Agregado | null;
  /**
   * O que o 1º turno mediu nesta UF. Obrigatório quando a estimativa roda na
   * base `validos-1o-turno`; ignorado na base `eleitorado`.
   */
  readonly ancoragem?: AncoragemUf | null;
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
  /**
   * O número sobre o qual os percentuais foram aplicados nesta UF: o
   * eleitorado na base `eleitorado`, os votos válidos do 1º turno na base
   * `validos-1o-turno`.
   */
  readonly baseDeVotos: number;
  /** A âncora usada, quando a base é `validos-1o-turno`. */
  readonly ancoragem: AncoragemUf | null;
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
  /** Sobre o que os percentuais foram aplicados. Ver `BaseDaEstimativa`. */
  readonly base: BaseDaEstimativa;
  /**
   * Soma das bases de todas as UFs: o eleitorado total na base `eleitorado`,
   * os VOTOS VÁLIDOS ESTIMADOS do 2º turno na base `validos-1o-turno`.
   */
  readonly baseTotal: number;
  /**
   * O comparecimento do 1º turno, somado sobre as UFs em que ele é CONHECIDO,
   * com o eleitorado dessas mesmas UFs ao lado.
   *
   * Parcial de propósito: três UFs não têm o dado (MG e MA não publicaram
   * brancos e nulos; o PI não tem apuração presidencial), e somar o
   * comparecimento delas como se fosse zero daria uma taxa nacional falsa.
   * Somar só onde se sabe, dividir pelo eleitorado DAQUELAS UFs e dizer
   * quantas ficaram de fora é a leitura que não mente. `null` só quando
   * nenhuma UF tem o dado. A ancoragem em si NÃO depende disto — ela precisa
   * só dos votos válidos.
   */
  readonly comparecimento: {
    readonly votos: number;
    readonly eleitoresCobertos: number;
    readonly ufsSemDado: readonly string[];
  } | null;
  /**
   * UFs cuja âncora não veio da apuração e foi estimada pela razão nacional.
   * Suposição declarada, não dado.
   */
  readonly ufsComAncoragemSubstituta: readonly string[];
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
  opcoes: { readonly base?: BaseDaEstimativa } = {},
): EstimativaVotos {
  const base: BaseDaEstimativa = opcoes.base ?? 'eleitorado';
  const ancorado = base === 'validos-1o-turno';

  // Sem âncora não se ancora: é melhor falhar alto do que cair em silêncio
  // de volta no eleitorado e apresentar uma base como se fosse a outra.
  if (ancorado) {
    const semAncora = porUf.filter((u) => u.ancoragem == null);
    if (semAncora.length > 0) {
      throw new EstimativaVotosError(
        `Não é possível ancorar a estimativa no 1º turno: ${semAncora.length} UF(s) sem âncora ` +
          `(${semAncora.map((u) => u.uf).join(', ')}).`,
      );
    }
  }

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
  let baseTotal = 0;
  let comparecimentoVotos = 0;
  let comparecimentoEleitores = 0;
  const ufsSemComparecimento: string[] = [];
  const ufsComAncoragemSubstituta: string[] = [];

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

    /**
     * Duas coisas mudam JUNTAS entre as bases, e separá-las seria o erro:
     *
     * - A base de votos. No eleitorado é o eleitorado; ancorada, são os votos
     *   válidos do 1º turno daquela UF.
     * - O denominador do percentual. Pesquisa nesta base está no corte de
     *   TOTAL de entrevistados, e sobre o total os candidatos somam menos de
     *   100 (o resto são brancos, nulos e indecisos). Aplicar esse percentual
     *   sobre VÁLIDOS misturaria as duas bases e subestimaria os dois
     *   candidatos de uma vez — por isso a base ancorada renormaliza SEMPRE
     *   para que os candidatos somem 100, que é o que "votos válidos"
     *   significa. A base `eleitorado` mantém o comportamento antigo:
     *   normaliza só quando a soma passa de 100, para não espremer o resíduo.
     */
    const precisaNormalizar = ancorado ? somaPctBruto > 0 : somaPctBruto > 100;
    const fatorNormalizacao = precisaNormalizar ? 100 / somaPctBruto : 1;
    if (!ancorado && precisaNormalizar) ufsNormalizadas.push(entrada.uf);

    const ancoragem = entrada.ancoragem ?? null;
    const baseDeVotos = ancorado ? ancoragem!.validosPrimeiroTurno : entrada.eleitores;
    baseTotal += baseDeVotos;
    if (ancorado && ancoragem) {
      if (ancoragem.origem === 'substituto-nacional') ufsComAncoragemSubstituta.push(entrada.uf);
      if (ancoragem.comparecimentoPrimeiroTurno === null) {
        ufsSemComparecimento.push(entrada.uf);
      } else {
        comparecimentoVotos += ancoragem.comparecimentoPrimeiroTurno;
        comparecimentoEleitores += entrada.eleitores;
      }
    }

    const votosPorCandidato: Record<string, VotosCandidatoUf> = {};
    let somaVotosAtribuidosUf = 0;

    for (const c of contribuicoes) {
      const pctFinal = c.pct * fatorNormalizacao;
      const votos = baseDeVotos * (pctFinal / 100);
      // A margem de erro é uma propriedade da pesquisa, não da parcela
      // normalizada de espaço no eleitorado — não aplica `fatorNormalizacao`
      // aqui, para não subestimar a incerteza justamente nas UFs onde o
      // agregado bruto excedeu 100% (ver `ufsNormalizadas`).
      const margemVotos = baseDeVotos * (c.margemPct / 100);
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
    // Na base ancorada o resíduo é ZERO por definição: voto válido é, por
    // definição, voto em candidato. Brancos, nulos e abstenção não sumiram —
    // saíram da base, já descontados pela apuração do 1º turno, e a tela os
    // reporta separadamente em vez de os misturar com os votos dos candidatos.
    const residuoUf = ancorado ? 0 : Math.max(0, entrada.eleitores - somaVotosAtribuidosUf);
    naoAtribuidosVotos += residuoUf;

    // Quanto do resíduo desta UF as pesquisas realmente publicaram como linha
    // de não-candidato. O `Math.min` evita que a linha publicada estoure o
    // resíduo quando a normalização acima já consumiu o eleitorado da UF.
    const agregadoDaUf = usaEstadual ? entrada.agregado! : agregadoNacional!;
    const pctNaoCandidatoPublicado = agregadoDaUf.outros.reduce((soma, c) => soma + c.pct, 0);
    naoAtribuidosDeclaradosVotos += Math.min(
      residuoUf,
      baseDeVotos * (pctNaoCandidatoPublicado / 100),
    );

    porUfResultado.push({
      uf: entrada.uf,
      eleitores: entrada.eleitores,
      origem: origemUf,
      foraDaJanela: entrada.agregado?.foraDaJanela ?? false,
      votosPorCandidato,
      baseDeVotos,
      ancoragem: ancorado ? ancoragem : null,
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

  /**
   * Os dois lados da comparação têm de estar na MESMA base, senão a coluna
   * "Diferença" subtrai grandezas diferentes. Na base ancorada o estimado é
   * percentual de voto VÁLIDO, então o percentual da média nacional também é
   * renormalizado para válidos — dividido pela soma dos próprios candidatos
   * do agregado nacional, que é a mesma conta que a imprensa faz para
   * publicar a manchete de válidos.
   */
  const somaCandidatosNacional = agregadoNacional
    ? agregadoNacional.candidatos.reduce((soma, c) => soma + c.pct, 0)
    : 0;
  const comparacaoNacional: ComparacaoNacional[] = agregadoNacional
    ? agregadoNacional.candidatos.map((c) => {
        const chave = c.candidato.trim();
        const estimado = candidatos.find((cf) => cf.candidato === chave);
        const pctNacional =
          ancorado && somaCandidatosNacional > 0 ? (c.pct / somaCandidatosNacional) * 100 : c.pct;
        const pctEstimado = ancorado
          ? (estimado?.pctDosVotosAtribuidos ?? 0)
          : (estimado?.pctDoEleitorado ?? 0);
        return { candidato: chave, pctNacional, pctEstimado };
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
    base,
    baseTotal,
    comparecimento:
      ancorado && comparecimentoEleitores > 0
        ? {
            votos: comparecimentoVotos,
            eleitoresCobertos: comparecimentoEleitores,
            ufsSemDado: ufsSemComparecimento,
          }
        : null,
    ufsComAncoragemSubstituta,
  };
}
