/**
 * A aritmética da migração entre os dois turnos e da hipótese do gerador.
 *
 * Tudo aqui é função pura sobre CONTAGENS. Os arquivos em data/analise/
 * guardam só contagens justamente para que share, deslocamento, abstenção e o
 * X da hipótese sejam derivados aqui, onde há teste, em vez de chegarem
 * prontos de um script de ingestão que ninguém reconferiu.
 *
 * ## A armadilha de base, que custou uma conta errada
 *
 * A margem do 1º turno que se publica (Flávio +1,8650) é sobre TODOS os
 * válidos, inclusive os 9,3 milhões dos eliminados. A margem do 2º turno
 * (+3,5704) é sobre dois candidatos. Subtrair uma da outra mistura bases, e a
 * diferença entre as duas É o bloco de eliminados — foi assim que uma
 * correlação de +0,80 entre deslocamento e bloco eliminado apareceu no
 * caderno de notas deste projeto sendo, na verdade, correlação da mistura com
 * ela mesma (o valor na base comparável é +0,52). Por isso
 * `margem1TDoisCandidatos` existe e tem nome comprido: toda comparação entre
 * turnos passa por ela.
 *
 * ## As unidades
 *
 * Margens, shares e X estão todos em **pontos percentuais / por cento**
 * (3,5704 e não 0,035704), como aparecem na tela. As fórmulas convertem para
 * fração internamente.
 */

/** Contagens de uma área — estado, município ou país. Só o que vem dos arquivos. */
export interface ContagensDaArea {
  readonly secoes: number;
  readonly aptos1T: number;
  readonly aptos2T: number;
  readonly comparecimento1T: number;
  readonly comparecimento2T: number;
  readonly validos1T: number;
  readonly validos2T: number;
  readonly lula1T: number;
  readonly flavio1T: number;
  readonly lula2T: number;
  readonly flavio2T: number;
  readonly blocoEliminado1T: number;
  readonly brancoNuloRecuperado: number;
  readonly comparecimentoNovo: number;
  readonly cury1T: number;
  readonly renan1T: number;
  readonly caiado1T: number;
  readonly zema1T: number;
  readonly outrosEliminados1T: number;
  readonly deOutrasOrigens: number;
  readonly travessiaLiquida: number;
}

/** Uma área identificada. `cod` é o código do TSE do município; null para estado e país. */
export interface AreaDaAnalise extends ContagensDaArea {
  readonly cod: string | null;
  readonly uf: string;
  readonly nome: string;
}

/**
 * Medidas derivadas. `null` onde o denominador não existe — um município sem
 * válidos no 2º turno não tem share, e inventar zero seria pior que admitir a
 * ausência.
 */
export interface MedidasDaArea {
  readonly pctLula1T: number | null;
  readonly pctLula2T: number | null;
  readonly deslocamento: number | null;
  readonly pctBlocoEliminado: number | null;
  readonly pctTravessia: number | null;
  readonly abstencao1T: number | null;
  readonly abstencao2T: number | null;
  readonly deltaAbstencao: number | null;
  readonly pctLula1TDoisCandidatos: number | null;
  readonly pctFlavio1TDoisCandidatos: number | null;
  readonly ganhoDoisCandidatos: number | null;
  readonly xExigido: number | null;
}

export type AreaMedida = AreaDaAnalise & MedidasDaArea;

const div = (a: number, b: number): number | null => (b > 0 ? (100 * a) / b : null);

/** Margem do 2º turno em p.p., positiva para Lula. Base: os dois finalistas. */
export function margem2T(c: ContagensDaArea): number | null {
  return div(c.lula2T - c.flavio2T, c.validos2T);
}

/**
 * Margem do 1º turno em p.p., **na base de dois candidatos** — só Lula e
 * Flávio no denominador. É esta que se compara com a do 2º turno; ver a nota
 * de base no topo do módulo.
 */
export function margem1TDoisCandidatos(c: ContagensDaArea): number | null {
  return div(c.lula1T - c.flavio1T, c.lula1T + c.flavio1T);
}

/** Deslocamento da margem entre os turnos, em p.p., nas duas bases iguais. */
export function deslocamentoDaMargem(c: ContagensDaArea): number | null {
  const m2 = margem2T(c);
  const m1 = margem1TDoisCandidatos(c);
  return m2 === null || m1 === null ? null : m2 - m1;
}

/**
 * De quanto teria de ser um X único para que o resultado verdadeiro fosse
 * `margemAlvo`, dada a margem observada. Margens e X em p.p./por cento.
 *
 * Modelo: cada voto dado a Flávio tem probabilidade X de sair da urna como
 * voto de Lula. Daí `m_obs = m_verd + X(1 − m_verd)`, cuja inversa é esta.
 * Com alvo zero a fórmula devolve a própria margem observada — identidade, e
 * é por isso que 3,5704% reaparece em todo o dossiê como "o X que empataria".
 */
export function xExigido(margemObservada: number, margemAlvo: number): number {
  return (100 * (margemObservada - margemAlvo)) / (100 - margemAlvo);
}

/** A inversa: se X fosse tanto, qual seria a margem verdadeira, em p.p. */
export function margemVerdadeira(margemObservada: number, x: number): number {
  return (100 * (margemObservada - x)) / (100 - x);
}

/**
 * Teto de X a partir de `votosIntocados` votos que um gerador teria de ter
 * trocado e não trocou, a um nível de significância. Teste binomial exato:
 * `(1 − X)^n = nivel`.
 */
export function tetoDeX(votosIntocados: number, nivel: number): number {
  if (votosIntocados <= 0 || nivel <= 0 || nivel >= 1) {
    throw new Error(
      `tetoDeX: votosIntocados deve ser positivo e nivel estar em (0,1); recebi ${votosIntocados} e ${nivel}.`,
    );
  }
  return 100 * (1 - Math.exp(Math.log(nivel) / votosIntocados));
}

/**
 * Quantas seções com zero voto de Flávio um gerador de taxa X criaria no
 * país, dada a distribuição observada de votos dele por seção.
 *
 * Uma seção com F votos verdadeiros aparece zerada só se TODOS forem
 * trocados, com probabilidade X^F. A distribuição chega pelos votos
 * observados, então F verdadeiro é reconstruído como F_obs/(1−X).
 *
 * É a conta que responde se as 106 seções zeradas de Flávio podem ser obra do
 * gerador: a 2,31% ele cria cerca de três.
 */
export function zerosCriadosPeloGerador(
  distribuicao: Readonly<Record<string, number>>,
  x: number,
): number {
  const frac = x / 100;
  if (frac <= 0 || frac >= 1) return 0;
  let total = 0;
  for (const [votos, secoes] of Object.entries(distribuicao)) {
    const v = Number(votos);
    if (!Number.isFinite(v) || v <= 0) continue;
    total += secoes * Math.pow(frac, v / (1 - frac));
  }
  return total;
}

/** Todas as medidas derivadas de uma área. */
export function medidasDaArea(c: ContagensDaArea): MedidasDaArea {
  const m2 = margem2T(c);
  const m1dp = margem1TDoisCandidatos(c);
  const q1 = div(c.lula1T, c.lula1T + c.flavio1T);
  const q2 = div(c.lula2T, c.validos2T);
  const ab1 = div(c.aptos1T - c.comparecimento1T, c.aptos1T);
  const ab2 = div(c.aptos2T - c.comparecimento2T, c.aptos2T);
  const pctLula1T = div(c.lula1T, c.validos1T);
  const pctLula2T = q2;
  return {
    pctLula1T,
    pctLula2T,
    deslocamento: pctLula1T === null || pctLula2T === null ? null : pctLula2T - pctLula1T,
    pctBlocoEliminado: div(c.blocoEliminado1T, c.validos1T),
    pctTravessia: div(c.travessiaLiquida, c.flavio1T),
    abstencao1T: ab1,
    abstencao2T: ab2,
    deltaAbstencao: ab1 === null || ab2 === null ? null : ab2 - ab1,
    pctLula1TDoisCandidatos: q1,
    pctFlavio1TDoisCandidatos: q1 === null ? null : 100 - q1,
    ganhoDoisCandidatos: q1 === null || q2 === null ? null : q2 - q1,
    // O X só existe se houver margem do 1º turno para servir de alvo e ela
    // não for 100 (Flávio zerado no 1º turno, onde a divisão estoura).
    xExigido: m2 === null || m1dp === null || Math.abs(100 - m1dp) < 1e-9 ? null : xExigido(m2, m1dp),
  };
}

/** Soma as contagens de várias áreas numa só. */
export function somarContagens(areas: readonly ContagensDaArea[]): ContagensDaArea {
  const zero: ContagensDaArea = {
    secoes: 0, aptos1T: 0, aptos2T: 0, comparecimento1T: 0, comparecimento2T: 0,
    validos1T: 0, validos2T: 0, lula1T: 0, flavio1T: 0, lula2T: 0, flavio2T: 0,
    blocoEliminado1T: 0, brancoNuloRecuperado: 0, comparecimentoNovo: 0,
    cury1T: 0, renan1T: 0, caiado1T: 0, zema1T: 0, outrosEliminados1T: 0,
    deOutrasOrigens: 0, travessiaLiquida: 0,
  };
  const chaves = Object.keys(zero) as (keyof ContagensDaArea)[];
  const acc: Record<string, number> = { ...zero };
  for (const area of areas) {
    for (const k of chaves) acc[k] = (acc[k] ?? 0) + area[k];
  }
  return acc as unknown as ContagensDaArea;
}

/** As origens de voto de uma área, para a barra de composição. */
export interface OrigemDeVoto {
  readonly chave: string;
  readonly rotulo: string;
  readonly votos: number;
}

const ORIGENS: readonly { chave: keyof ContagensDaArea; rotulo: string }[] = [
  { chave: 'cury1T', rotulo: 'Cury' },
  { chave: 'renan1T', rotulo: 'Renan Santos' },
  { chave: 'caiado1T', rotulo: 'Caiado' },
  { chave: 'zema1T', rotulo: 'Zema' },
  { chave: 'outrosEliminados1T', rotulo: 'Demais eliminados' },
  { chave: 'brancoNuloRecuperado', rotulo: 'Branco e nulo' },
  { chave: 'comparecimentoNovo', rotulo: 'Comparecimento novo' },
];

/**
 * As sete origens de voto, só as que CRESCERAM. Onde o comparecimento caiu ou
 * o branco e o nulo aumentaram o valor é negativo, e um pedaço negativo numa
 * barra empilhada não significa nada — então entra como zero, e o total da
 * barra se declara como "somando as origens que cresceram".
 */
export function origensDeVoto(c: ContagensDaArea): readonly OrigemDeVoto[] {
  return ORIGENS.map(({ chave, rotulo }) => ({
    chave: String(chave),
    rotulo,
    votos: Math.max(c[chave], 0),
  }));
}

/** Quanto do comparecimento novo foi para Lula, com a taxa de cada estado. */
export function comparecimentoNovoParaLula(
  estados: readonly { readonly comparecimentoNovo: number; readonly taxaComparecimento: number }[],
): number {
  return estados.reduce((a, e) => a + (e.comparecimentoNovo * e.taxaComparecimento) / 100, 0);
}

/** Uma taxa de transferência nacional, estimada dentro de cada município. */
export interface TaxaNacional {
  readonly origem: string;
  readonly chave: string;
  readonly votosDisponiveis: number;
  readonly pctParaLula: number;
}

/** O par de seções zeradas, pareado entre os turnos. */
export interface SecaoZerada {
  readonly caso: 'flavio' | 'lula';
  readonly rotulo: string;
  readonly secoes: number;
  readonly votosDoAdversario2T: number;
  readonly votosProprios1T: number;
  readonly votosDoAdversario1T: number;
  readonly comparecimento1T: number;
  readonly jaZeradasNo1T: number;
}

/**
 * O que não se deriva das contagens: medido por seção, na ingestão.
 * `flavioPorSecao` é a distribuição de votos de Flávio por seção no 2º turno,
 * e é dela que sai quantos zeros um gerador criaria.
 */
export interface ConstantesDoGerador {
  readonly taxasNacionais: readonly TaxaNacional[];
  readonly secoesZeradas: readonly SecaoZerada[];
  readonly nivelDoTeto: number;
  readonly margemDoAgregadoDePesquisas: number;
  readonly flavioPorSecao: Readonly<Record<string, number>>;
}

/** Contorno de uma área no mapa, já projetado e simplificado. */
export interface ContornoDaArea {
  readonly cod: string;
  readonly uf: string;
  readonly nome: string;
  readonly d: string;
}

export interface Malha {
  readonly largura: number;
  readonly altura: number;
  readonly ufs: readonly ContornoDaArea[];
  readonly municipios: readonly ContornoDaArea[];
}

export interface EstadoDaAnalise extends AreaDaAnalise {
  readonly taxaComparecimento: number;
}

export interface DadosAnalise {
  readonly estados: readonly EstadoDaAnalise[];
  readonly municipios: readonly AreaDaAnalise[];
  readonly malha: Malha;
  readonly gerador: ConstantesDoGerador;
}
