import type { AreaMedida } from '../../../../domain/migracao.js';
import { formatarNumero } from './_shared.js';

/**
 * Lógica pura da tela de análise: quais medidas o mapa oferece, como os
 * valores viram faixas de cor, e como o endereço guarda o que está na tela.
 *
 * Fica separada da view porque é o que dá para testar — o vitest roda em
 * ambiente node, sem DOM, então uma regra de cor escondida dentro de uma
 * função que fabrica `<path>` não teria teste nenhum.
 */

export type Nivel = 'estados' | 'municipios';

export interface Medida {
  readonly chave: string;
  readonly rotulo: string;
  readonly unidade: string;
  /**
   * `divergente` para medidas com dois lados e um meio que significa "nada"
   * (deslocamento em torno de zero, share em torno de 50). `sequencial` para
   * magnitude, que só cresce.
   */
  readonly tipo: 'divergente' | 'sequencial';
  readonly ancora: number;
  readonly casas: number;
  /** Com sinal explícito: medidas que podem ser negativas se leem melhor assim. */
  readonly comSinal: boolean;
}

export const MEDIDAS: readonly Medida[] = [
  { chave: 'deslocamento', rotulo: 'Deslocamento de Lula', unidade: 'p.p.', tipo: 'divergente', ancora: 0, casas: 2, comSinal: true },
  { chave: 'pctLula2T', rotulo: 'Lula no 2º turno', unidade: '% dos válidos', tipo: 'divergente', ancora: 50, casas: 2, comSinal: false },
  { chave: 'pctTravessia', rotulo: 'Travessia líquida', unidade: '% da base de Flávio', tipo: 'sequencial', ancora: 0, casas: 2, comSinal: false },
  { chave: 'pctBlocoEliminado', rotulo: 'Bloco eliminado no 1º turno', unidade: '% dos válidos', tipo: 'sequencial', ancora: 0, casas: 2, comSinal: false },
  { chave: 'deltaAbstencao', rotulo: 'Variação da abstenção', unidade: 'p.p.', tipo: 'divergente', ancora: 0, casas: 2, comSinal: true },
  { chave: 'ganhoLula', rotulo: 'Ganho de Lula', unidade: 'votos', tipo: 'sequencial', ancora: 0, casas: 0, comSinal: false },
  { chave: 'xExigido', rotulo: 'X exigido por um gerador de taxa única', unidade: '%', tipo: 'sequencial', ancora: 0, casas: 3, comSinal: false },
];

export const MEDIDA_PADRAO = MEDIDAS[0] as Medida;

export function medidaPorChave(chave: string | null | undefined): Medida {
  return MEDIDAS.find((m) => m.chave === chave) ?? MEDIDA_PADRAO;
}

/** O valor de uma medida numa área. `ganhoLula` não é derivado — é a diferença das contagens. */
export function valorDaMedida(area: AreaMedida, medida: Medida): number | null {
  if (medida.chave === 'ganhoLula') return area.lula2T - area.lula1T;
  const valor = (area as unknown as Record<string, unknown>)[medida.chave];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

/** Quantil de uma lista JÁ ORDENADA, por interpolação linear. */
export function quantil(ordenados: readonly number[], p: number): number {
  if (ordenados.length === 0) return Number.NaN;
  if (ordenados.length === 1) return ordenados[0] as number;
  const pos = (ordenados.length - 1) * Math.min(Math.max(p, 0), 1);
  const baixo = Math.floor(pos);
  const alto = Math.min(baixo + 1, ordenados.length - 1);
  const peso = pos - baixo;
  return (ordenados[baixo] as number) * (1 - peso) + (ordenados[alto] as number) * peso;
}

export const FAIXAS = 7;

export interface Escala {
  /** Os 6 cortes que separam as 7 faixas, em ordem crescente. */
  readonly cortes: readonly number[];
  readonly tipo: 'divergente' | 'sequencial';
  readonly ancora: number;
}

/**
 * Sete faixas, que é o limite onde faixas vizinhas ainda se distinguem a
 * olho. Divergente: passo simétrico em torno da âncora, com a faixa do meio
 * significando "praticamente nada" — o raio vem do percentil 97 do desvio,
 * para um município extremo não achatar o país inteiro numa cor só.
 * Sequencial: sete quantis, que é o que faz a cor render em distribuição
 * torta como "ganho de Lula em votos".
 */
export function escalaDaMedida(valores: readonly number[], medida: Medida): Escala | null {
  const finitos = valores.filter((v) => Number.isFinite(v));
  if (finitos.length === 0) return null;
  if (medida.tipo === 'divergente') {
    const desvios = finitos.map((v) => Math.abs(v - medida.ancora)).sort((a, b) => a - b);
    const raio = quantil(desvios, 0.97) || 1;
    const passo = raio / 3;
    return {
      cortes: [-3, -2, -1, 1, 2, 3].map((k) => medida.ancora + k * passo),
      tipo: 'divergente',
      ancora: medida.ancora,
    };
  }
  const ordenados = [...finitos].sort((a, b) => a - b);
  const cortes: number[] = [];
  for (let k = 1; k < FAIXAS; k += 1) cortes.push(quantil(ordenados, k / FAIXAS));
  return { cortes, tipo: 'sequencial', ancora: medida.ancora };
}

/** Índice da faixa (0..6) de um valor, ou null quando não há valor. */
export function faixaDoValor(escala: Escala | null, valor: number | null): number | null {
  if (escala === null || valor === null || !Number.isFinite(valor)) return null;
  let i = 0;
  while (i < escala.cortes.length && valor >= (escala.cortes[i] as number)) i += 1;
  return i;
}

export interface ParametrosDaAnalise {
  readonly nivel: Nivel;
  readonly medida: Medida;
  readonly area: string | null;
}

/**
 * Lê o endereço. A tela guarda nível, medida e área escolhida no próprio
 * hash, para um mapa de município específico ser compartilhável e sobreviver
 * a um reload — o mesmo motivo que levou a tela de presidente por estado a
 * guardar o turno no endereço.
 */
export function parametrosDoHash(hash: string): ParametrosDaAnalise {
  const inicio = hash.indexOf('?');
  if (inicio < 0) return { nivel: 'estados', medida: MEDIDA_PADRAO, area: null };
  const p = new URLSearchParams(hash.slice(inicio + 1));
  const area = p.get('area');
  return {
    nivel: p.get('nivel') === 'municipios' ? 'municipios' : 'estados',
    medida: medidaPorChave(p.get('medida')),
    area: area !== null && area !== '' ? area : null,
  };
}

/** Hash canônico: só os parâmetros que diferem do padrão aparecem. */
export function hashDaAnalise(p: ParametrosDaAnalise): string {
  const partes: string[] = [];
  if (p.nivel === 'municipios') partes.push('nivel=municipios');
  if (p.medida.chave !== MEDIDA_PADRAO.chave) partes.push(`medida=${p.medida.chave}`);
  if (p.area !== null) partes.push(`area=${encodeURIComponent(p.area)}`);
  return partes.length > 0 ? `#/analise?${partes.join('&')}` : '#/analise';
}

/** A chave de uma área no nível corrente: código do TSE no município, sigla no estado. */
export function chaveDaArea(area: AreaMedida, nivel: Nivel): string {
  return nivel === 'municipios' ? (area.cod ?? area.uf) : area.uf;
}

/** Como a área se chama na tela: o município sempre com a UF ao lado. */
export function nomeDaArea(area: AreaMedida, nivel: Nivel): string {
  return nivel === 'municipios' ? `${area.nome} · ${area.uf}` : area.nome;
}

/**
 * Municípios pequenos demais tiram sentido de um ranking: dez eleitores
 * produzem extremos que não dizem nada do país. O corte é declarado na tela.
 */
export const MINIMO_DE_VALIDOS_NO_RANKING = 2000;

export function paraRanking(areas: readonly AreaMedida[], nivel: Nivel, medida: Medida): readonly AreaMedida[] {
  return areas.filter(
    (a) =>
      valorDaMedida(a, medida) !== null &&
      (nivel === 'estados' || a.validos2T >= MINIMO_DE_VALIDOS_NO_RANKING),
  );
}

const SOBRESCRITOS = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';

/**
 * Probabilidade pequena em notação científica legível: 3,5×10⁻⁸.
 *
 * O arredondamento da mantissa é o detalhe que importa. `(1 − X)^296` para o
 * teto a p = 0,001 não dá 0,001 exato, dá 0,00099999…, e sem cuidado a tela
 * publica "10,0×10⁻⁴" — certo no valor e ridículo na forma. Um teste de
 * render no Chromium pegou isso depois de o número já estar na tela, e o
 * segundo olhar pegou o irmão do defeito: a mesma probabilidade saindo como
 * "0,001" numa linha e em notação científica na linha de baixo.
 */
export function probabilidade(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return '—';
  // O corte é pelo valor ARREDONDADO, não pelo bruto: 0,001 e 0,00099999…
  // são o mesmo número para o leitor, e saíam em formatos diferentes em
  // linhas vizinhas da mesma tabela.
  if (Number(valor.toFixed(3)) >= 0.001) return formatarNumero(valor, 3);
  let expoente = Math.floor(Math.log10(valor));
  let mantissa = valor / 10 ** expoente;
  if (Number(mantissa.toFixed(1)) >= 10) {
    mantissa /= 10;
    expoente += 1;
  }
  const digitos = String(Math.abs(expoente))
    .split('')
    .map((c) => SOBRESCRITOS[Number(c)] ?? c)
    .join('');
  return `${formatarNumero(mantissa, 1)}\u00d710${expoente < 0 ? '\u207b' : ''}${digitos}`;
}
