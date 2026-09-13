/**
 * Funções puras de layout/escala/formatação para a tela "Presidente por
 * estado" (views/presidential-states-view.ts): quantis para o modo
 * "Eleitorado" do mapa, ordenação da grade de miniaturas e geometria do
 * mini-gráfico de tendência (escala x/y, path suavizado, raio por amostra).
 * Sem DOM, sem I/O — testável isoladamente (ver
 * __tests__/presidential-states-layout.test.ts).
 */

/** Campos mínimos para ordenar a grade de miniaturas por estado. */
export interface ItemEleitoral {
  readonly eleitores: number | null;
  readonly semDados: boolean;
}

/**
 * Ordena para a grade de miniaturas: estados com pesquisa primeiro
 * (maior eleitorado primeiro), estados sem pesquisa estadual sempre por
 * último (independente do eleitorado). Não muta o array de entrada.
 */
export function ordenarParaGrade<T extends ItemEleitoral>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.semDados !== b.semDados) return a.semDados ? 1 : -1;
    return (b.eleitores ?? -1) - (a.eleitores ?? -1);
  });
}

/**
 * Breakpoints de quantil (`classes - 1` valores crescentes) sobre uma
 * amostra de números, por interpolação linear entre os índices ordenados
 * (mesmo método usado por bibliotecas de estatística/d3.quantile).
 * `classes` deve ser >= 2. Retorna `[]` para amostra vazia.
 */
export function calcularQuantis(valores: readonly number[], classes = 5): number[] {
  if (valores.length === 0) return [];
  const ordenados = [...valores].sort((a, b) => a - b);
  const breakpoints: number[] = [];
  for (let i = 1; i < classes; i++) {
    const posicao = (i / classes) * (ordenados.length - 1);
    const inferior = Math.floor(posicao);
    const superior = Math.ceil(posicao);
    const valorInferior = ordenados[inferior]!;
    const valorSuperior = ordenados[superior]!;
    const valor =
      inferior === superior
        ? valorInferior
        : valorInferior + (valorSuperior - valorInferior) * (posicao - inferior);
    breakpoints.push(valor);
  }
  return breakpoints;
}

/**
 * Classifica um valor em uma das `breakpoints.length + 1` classes
 * (0-based), dados breakpoints crescentes de `calcularQuantis`.
 */
export function classificarPorQuantil(valor: number, breakpoints: readonly number[]): number {
  let classe = 0;
  for (const bp of breakpoints) {
    if (valor > bp) classe++;
    else break;
  }
  return classe;
}

function comVirgula(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

/**
 * Formata um total de eleitores em português: "157,8 milhões" a partir de 1
 * milhão, "614,6 mil" a partir de 1000, número puro abaixo disso. Usa
 * singular "milhão" quando o valor arredondado é exatamente 1,0.
 */
export function formatarEleitorado(eleitores: number): string {
  if (eleitores >= 1_000_000) {
    const formatado = comVirgula(eleitores / 1_000_000);
    return `${formatado} ${formatado === '1,0' ? 'milhão' : 'milhões'}`;
  }
  if (eleitores >= 1_000) {
    return `${comVirgula(eleitores / 1_000)} mil`;
  }
  return eleitores.toLocaleString('pt-BR');
}

/** Diferença em dias inteiros entre duas datas ISO (YYYY-MM-DD), pode ser negativa. */
export function diasEntreIso(deIso: string, paraIso: string): number {
  const de = Date.parse(`${deIso}T00:00:00Z`);
  const para = Date.parse(`${paraIso}T00:00:00Z`);
  return Math.round((para - de) / 86_400_000);
}

export interface DominioX {
  readonly minIso: string;
  readonly maxIso: string;
}

/**
 * Posição x (0..largura) de uma data ISO dentro do domínio temporal. Quando
 * o domínio é um único dia (`span <= 0`, ex.: só há 1 pesquisa), todo ponto
 * cai no centro em vez de dividir por zero.
 */
export function escalaX(dataIso: string, dominio: DominioX, largura: number): number {
  const span = diasEntreIso(dominio.minIso, dominio.maxIso);
  if (span <= 0) return largura / 2;
  const offset = diasEntreIso(dominio.minIso, dataIso);
  return (offset / span) * largura;
}

export interface DominioY {
  readonly min: number;
  readonly max: number;
}

/**
 * Domínio vertical do mini-gráfico: sempre inclui 50 (linha de empate
 * técnico/tossup, o único "eixo" do gráfico) e garante ao menos `folga * 2`
 * pontos percentuais de amplitude, para que a linha nunca vire um traço
 * reto colado nas bordas quando os valores estão muito próximos.
 */
export function calcularDominioY(valores: readonly number[], folga = 4): DominioY {
  if (valores.length === 0) return { min: 50 - folga, max: 50 + folga };
  let min = Math.min(...valores, 50);
  let max = Math.max(...valores, 50);
  if (max - min < folga * 2) {
    const centro = (max + min) / 2;
    min = centro - folga;
    max = centro + folga;
  } else {
    min -= folga / 2;
    max += folga / 2;
  }
  return { min: Math.max(0, min), max: Math.min(100, max) };
}

/** Posição y (0 = topo/maior pct) de um percentual dentro do domínio e da altura útil. */
export function escalaY(pct: number, dominio: DominioY, altura: number): number {
  const span = dominio.max - dominio.min || 1;
  const clamped = Math.min(dominio.max, Math.max(dominio.min, pct));
  return altura - ((clamped - dominio.min) / span) * altura;
}

export interface PontoXY {
  readonly x: number;
  readonly y: number;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0';
}

/**
 * Constrói o atributo `d` de um path SVG suavizado (Catmull-Rom convertido
 * para curvas de Bézier cúbicas) por uma sequência de pontos já em
 * coordenadas de tela, ordenados por x crescente. Menos de 2 pontos não tem
 * linha (retorna string vazia — o chamador desenha só os pontos); 2 pontos
 * viram um segmento reto (Catmull-Rom degenera para uma reta de qualquer
 * forma nesse caso).
 */
export function caminhoSuavizado(pontos: readonly PontoXY[]): string {
  if (pontos.length < 2) return '';
  if (pontos.length === 2) {
    return `M${fmt(pontos[0]!.x)},${fmt(pontos[0]!.y)} L${fmt(pontos[1]!.x)},${fmt(pontos[1]!.y)}`;
  }
  let d = `M${fmt(pontos[0]!.x)},${fmt(pontos[0]!.y)}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i]!;
    const p1 = pontos[i]!;
    const p2 = pontos[i + 1]!;
    const p3 = pontos[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }
  return d;
}

const RAIO_MIN = 3;
const RAIO_MAX = 9;
const AMOSTRA_REFERENCIA = 1000;

/**
 * Raio (px) de um ponto de pesquisa no mini-gráfico, numa escala de raiz
 * quadrada do tamanho da amostra (percepção de área ~ proporcional ao
 * valor), clampada a [3, 9]px. Amostra ausente usa a referência padrão de
 * agregação (1000, ver domain/aggregate.ts).
 */
export function raioAmostra(amostra: number | null): number {
  const base = amostra != null && amostra > 0 ? amostra : AMOSTRA_REFERENCIA;
  const raio = RAIO_MIN + Math.sqrt(base / AMOSTRA_REFERENCIA) * 3;
  return Math.min(RAIO_MAX, Math.max(RAIO_MIN, raio));
}

/**
 * Rótulo curto do título de miniatura, estilo NYT: "Lula +2", "Harris <1"
 * (vantagem abaixo de 1 ponto, sem casa decimal) ou "Empate técnico"/"Sem
 * pesquisa estadual".
 */
export function rotuloVantagemMini(
  liderNome: string | null,
  vantagem: number,
  empateTecnico: boolean,
): string {
  if (!liderNome) return 'Sem pesquisa estadual';
  if (empateTecnico) return 'Empate técnico';
  if (vantagem < 1) return `${liderNome} <1`;
  return `${liderNome} +${Math.round(vantagem)}`;
}
