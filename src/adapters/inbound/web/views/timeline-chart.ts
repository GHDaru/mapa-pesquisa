import type { DiaSerieTemporal, PontoSerieTemporal, SerieTemporal } from '../../../../domain/aggregate.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import { formatarNumero, formatarPeriodo, nivelEspectro, tokenFillEspectro } from './_shared.js';

/**
 * Gráfico de série temporal presidencial — barra de qualidade: NYT
 * "Presidential polls 2024" (ver docs/ux-spec.md). Este módulo separa a
 * geometria pura (escalas, ticks, path da linha, raio do ponto — testada em
 * `__tests__/timeline-chart.test.ts`) do render SVG + interação, que
 * manipula o DOM e por isso não é testada por unidade.
 */

/* =========================================================================
 * Geometria pura — sem I/O, sem DOM.
 * ======================================================================= */

export interface DominioNumerico {
  readonly min: number;
  readonly max: number;
}

const UM_DIA_MS = 86_400_000;

/** Data ISO (YYYY-MM-DD) -> milissegundos UTC, sem deslocamento de fuso horário. */
export function dataParaMs(dataIso: string): number {
  return Date.parse(`${dataIso}T00:00:00Z`);
}

/**
 * Domínio do eixo Y: mín/máx dos valores com folga (`folgaPontos`, padrão 3
 * pontos percentuais), arredondado para fora ao múltiplo de `passo` mais
 * próximo (padrão 5) — para que os ticks caiam em números redondos — e
 * limitado a [0, 100]. Retorna um domínio mínimo de `passo` de largura
 * mesmo quando todos os valores são iguais (evita escala degenerada).
 */
export function calcularDominioY(
  valores: readonly number[],
  opcoes: { folgaPontos?: number; passo?: number } = {},
): DominioNumerico {
  const passo = opcoes.passo ?? 5;
  const folga = opcoes.folgaPontos ?? 3;

  if (valores.length === 0) {
    return { min: 0, max: passo };
  }

  const bruto = { min: Math.min(...valores) - folga, max: Math.max(...valores) + folga };
  let min = Math.max(0, Math.floor(bruto.min / passo) * passo);
  let max = Math.min(100, Math.ceil(bruto.max / passo) * passo);
  if (max <= min) max = Math.min(100, min + passo);
  return { min, max };
}

/** Ticks do eixo Y: todo múltiplo de `passo` dentro de `dominio` (inclusive). */
export function gerarTicksY(dominio: DominioNumerico, passo = 5): number[] {
  const ticks: number[] = [];
  const inicio = Math.ceil(dominio.min / passo) * passo;
  for (let v = inicio; v <= dominio.max + 1e-9; v += passo) ticks.push(Math.round(v));
  return ticks;
}

/** Escala linear simples: mapeia `dominio` (min..max) para `alcance` (px), sem clamping. */
export function criarEscalaLinear(dominio: DominioNumerico, alcance: readonly [number, number]): (v: number) => number {
  const largura = dominio.max - dominio.min;
  if (largura === 0) return () => (alcance[0] + alcance[1]) / 2;
  const [r0, r1] = alcance;
  return (v: number) => r0 + ((v - dominio.min) / largura) * (r1 - r0);
}

/** Escala temporal: mapeia uma data ISO dentro de [inicioIso, fimIso] para `alcance` (px). */
export function criarEscalaTempo(
  inicioIso: string,
  fimIso: string,
  alcance: readonly [number, number],
): (dataIso: string) => number {
  const msInicio = dataParaMs(inicioIso);
  const msFim = dataParaMs(fimIso);
  const largura = msFim - msInicio;
  const [r0, r1] = alcance;
  if (largura <= 0) return () => r0;
  return (dataIso: string) => r0 + ((dataParaMs(dataIso) - msInicio) / largura) * (r1 - r0);
}

const MESES_ABREV: readonly string[] = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** Rótulo curto pt-BR de uma data ISO: "8 set". */
export function formatarRotuloDataCurta(dataIso: string): string {
  const [, mesStr, diaStr] = dataIso.split('-');
  const mes = Number(mesStr) - 1;
  const dia = Number(diaStr);
  return `${dia} ${MESES_ABREV[mes] ?? mesStr}`;
}

export interface TickTempo {
  readonly data: string;
  readonly rotulo: string;
}

/**
 * Limite (em dias) acima do qual os ticks do eixo X passam de semanais para
 * mensais — mantém a densidade de rótulos legível em séries longas.
 */
export const LIMITE_DIAS_TICKS_SEMANAIS = 60;

/**
 * Ticks do eixo X: semanais (a cada 7 dias, ancorados em `inicioIso`) para
 * janelas de até `LIMITE_DIAS_TICKS_SEMANAIS` dias; mensais (dia 1 de cada
 * mês dentro do intervalo, mais o próprio `inicioIso`) para janelas maiores.
 */
export function gerarTicksTempo(inicioIso: string, fimIso: string): TickTempo[] {
  const msInicio = dataParaMs(inicioIso);
  const msFim = dataParaMs(fimIso);
  if (msFim <= msInicio) return [{ data: inicioIso, rotulo: formatarRotuloDataCurta(inicioIso) }];

  const totalDias = (msFim - msInicio) / UM_DIA_MS;
  const ticks: TickTempo[] = [];

  if (totalDias <= LIMITE_DIAS_TICKS_SEMANAIS) {
    for (let ms = msInicio; ms <= msFim; ms += 7 * UM_DIA_MS) {
      const data = new Date(ms).toISOString().slice(0, 10);
      ticks.push({ data, rotulo: formatarRotuloDataCurta(data) });
    }
    if (ticks[ticks.length - 1]?.data !== fimIso) {
      ticks.push({ data: fimIso, rotulo: formatarRotuloDataCurta(fimIso) });
    }
  } else {
    const inicio = new Date(msInicio);
    const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
    if (cursor.getTime() < msInicio) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    ticks.push({ data: inicioIso, rotulo: formatarRotuloDataCurta(inicioIso) });
    while (cursor.getTime() <= msFim) {
      const data = cursor.toISOString().slice(0, 10);
      if (data !== inicioIso) ticks.push({ data, rotulo: formatarRotuloDataCurta(data) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return ticks;
}

const AMOSTRA_REFERENCIA_MAX = 5000;
const RAIO_MIN = 3;
const RAIO_MAX = 7;
/** Raio (px) usado quando a pesquisa não informa o tamanho da amostra. */
export const RAIO_AMOSTRA_DESCONHECIDA = 4.5;

/**
 * Raio do ponto de uma pesquisa, proporcional à raiz quadrada da amostra
 * (mesmo princípio de peso de `domain/aggregate.ts`), entre `RAIO_MIN` e
 * `RAIO_MAX` px — ver `references/marks-and-anatomy.md` (marcador >= 8px de
 * diâmetro). Amostras acima de `AMOSTRA_REFERENCIA_MAX` saturam no raio máximo.
 */
export function raioPonto(amostra: number | null | undefined): number {
  if (amostra == null || !Number.isFinite(amostra) || amostra <= 0) return RAIO_AMOSTRA_DESCONHECIDA;
  const fracao = Math.sqrt(Math.min(amostra, AMOSTRA_REFERENCIA_MAX) / AMOSTRA_REFERENCIA_MAX);
  return RAIO_MIN + (RAIO_MAX - RAIO_MIN) * fracao;
}

export interface PontoXY {
  readonly x: number;
  readonly y: number;
}

/**
 * Path SVG de uma linha suavizada por spline de Catmull-Rom convertida em
 * curvas de Bézier cúbicas (tensão fixa 1/6, o padrão da conversão
 * Catmull-Rom -> Bézier). Vazio para 0 pontos, "M x y" para 1 ponto, reta
 * "M.. L.." para 2 pontos (uma curva não acrescenta nada a um segmento).
 */
export function caminhoSuavizado(pontos: readonly PontoXY[]): string {
  if (pontos.length === 0) return '';
  if (pontos.length === 1) return `M ${fmt(pontos[0]!.x)} ${fmt(pontos[0]!.y)}`;
  if (pontos.length === 2) {
    return `M ${fmt(pontos[0]!.x)} ${fmt(pontos[0]!.y)} L ${fmt(pontos[1]!.x)} ${fmt(pontos[1]!.y)}`;
  }

  const p = pontos;
  let d = `M ${fmt(p[0]!.x)} ${fmt(p[0]!.y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Estado de tom de série: 'base' para a 1ª ocorrência de um nível de espectro, 'alt' para as seguintes. */
export type TomSerie = 'base' | 'alt';

/**
 * Atribui um tom (base/alt) a cada candidato, na ordem dada, para que dois
 * candidatos do mesmo espectro (ex.: dois de direita) usem tons
 * distinguíveis — ver docs/design-system.md e os tokens `--pv-serie-*-alt`
 * de styles/views.css, validados com o script da skill de dataviz.
 */
export function atribuirTomSerie(espectros: readonly Espectro[]): TomSerie[] {
  const vistos = new Set<string>();
  return espectros.map((espectro) => {
    const chave = nivelEspectro(espectro) === 'indefinido' ? 'indefinido' : String(nivelEspectro(espectro));
    if (vistos.has(chave)) return 'alt';
    vistos.add(chave);
    return 'base';
  });
}

/** Referência var() do tom (base ou alt) de série para um espectro — ver styles/views.css. */
export function tokenTomSerie(espectro: Espectro, tom: TomSerie): string {
  if (tom === 'base') return tokenFillEspectro(espectro);
  const nivel = nivelEspectro(espectro);
  return nivel === 'indefinido' ? 'var(--spectrum-indefinido)' : `var(--pv-serie-alt-${nivel}-fill)`;
}

/* =========================================================================
 * Render — SVG + interação (crosshair, tooltip, teclado). Não testado por
 * unidade (manipula DOM); a geometria que consome já foi testada acima.
 * ======================================================================= */

/** Data do 1º turno das eleições de 2026 — única marca fixa do eixo X. */
export const DATA_ELEICAO_1O_TURNO = '2026-10-04';

export interface SerieCandidato {
  readonly nome: string;
  readonly partido: string | null;
  readonly espectro: Espectro;
  readonly tom: TomSerie;
}

export interface OpcoesTimelineChart {
  readonly serie: SerieTemporal;
  readonly candidatosDestacados: readonly SerieCandidato[];
  readonly tituloAcessivel: string;
}

const LARGURA = 720;
const ALTURA = 340;
const MARGEM = { topo: 16, direita: 96, baixo: 36, esquerda: 40 };

function criarSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [chave, valor] of Object.entries(attrs)) el.setAttribute(chave, valor);
  return el;
}

/** Renderiza o gráfico de série temporal presidencial dentro de `host`. */
export function renderTimelineChart(host: HTMLElement, opcoes: OpcoesTimelineChart): void {
  host.innerHTML = '';
  const { serie, candidatosDestacados, tituloAcessivel } = opcoes;

  if (serie.dias.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'pv-meta';
    vazio.textContent = 'Sem pesquisas suficientes para montar a série temporal.';
    host.append(vazio);
    return;
  }

  const nomesDestacados = candidatosDestacados.map((c) => c.nome);
  const porNome = new Map(candidatosDestacados.map((c) => [c.nome, c] as const));

  const primeiraData = serie.dias[0]!.data;
  const ultimaDataDados = serie.dias[serie.dias.length - 1]!.data;
  const fimEixo = ultimaDataDados > DATA_ELEICAO_1O_TURNO ? ultimaDataDados : DATA_ELEICAO_1O_TURNO;

  const valoresY: number[] = [];
  for (const dia of serie.dias) {
    for (const nome of nomesDestacados) {
      const v = dia.valores[nome];
      if (v != null) valoresY.push(v);
    }
  }
  for (const ponto of serie.pontos) {
    if (nomesDestacados.includes(ponto.candidato)) valoresY.push(ponto.pct);
  }

  const dominioY = calcularDominioY(valoresY);
  const areaX: [number, number] = [MARGEM.esquerda, LARGURA - MARGEM.direita];
  const areaY: [number, number] = [ALTURA - MARGEM.baixo, MARGEM.topo];

  const escalaX = criarEscalaTempo(primeiraData, fimEixo, areaX);
  const escalaY = criarEscalaLinear(dominioY, areaY);

  const svg = criarSvgEl('svg', {
    viewBox: `0 0 ${LARGURA} ${ALTURA}`,
    role: 'img',
    class: 'pv-timeline-svg',
    tabindex: '0',
    'aria-label': tituloAcessivel,
  });

  // --- Grade horizontal + eixo Y (recessivos, ver references/marks-and-anatomy.md) ---
  const ticksY = gerarTicksY(dominioY);
  const grupoGrade = criarSvgEl('g', { class: 'pv-timeline-grid' });
  for (const tick of ticksY) {
    const y = escalaY(tick);
    grupoGrade.append(
      criarSvgEl('line', { x1: String(areaX[0]), x2: String(areaX[1]), y1: String(y), y2: String(y), class: 'pv-timeline-gridline' }),
    );
    const rotulo = criarSvgEl('text', { x: String(areaX[0] - 8), y: String(y + 4), class: 'pv-timeline-axis-label', 'text-anchor': 'end' });
    rotulo.textContent = `${tick}%`;
    grupoGrade.append(rotulo);
  }
  svg.append(grupoGrade);

  // --- Eixo X (datas) ---
  const ticksX = gerarTicksTempo(primeiraData, fimEixo);
  const grupoEixoX = criarSvgEl('g', { class: 'pv-timeline-axis-x' });
  for (const tick of ticksX) {
    const x = escalaX(tick.data);
    const rotulo = criarSvgEl('text', { x: String(x), y: String(ALTURA - MARGEM.baixo + 18), class: 'pv-timeline-axis-label', 'text-anchor': 'middle' });
    rotulo.textContent = tick.rotulo;
    grupoEixoX.append(rotulo);
  }
  svg.append(grupoEixoX);

  // --- Marca da data da eleição ---
  const xEleicao = escalaX(DATA_ELEICAO_1O_TURNO);
  const grupoEleicao = criarSvgEl('g', { class: 'pv-timeline-election' });
  grupoEleicao.append(
    criarSvgEl('line', {
      x1: String(xEleicao), x2: String(xEleicao), y1: String(areaY[1]), y2: String(areaY[0]),
      class: 'pv-timeline-election-line',
    }),
  );
  const rotuloEleicao = criarSvgEl('text', {
    x: String(xEleicao), y: String(MARGEM.topo - 4), class: 'pv-timeline-election-label',
    'text-anchor': xEleicao > LARGURA - MARGEM.direita - 60 ? 'end' : 'middle',
  });
  rotuloEleicao.textContent = `1º turno · ${formatarRotuloDataCurta(DATA_ELEICAO_1O_TURNO)}`;
  grupoEleicao.append(rotuloEleicao);
  svg.append(grupoEleicao);

  // --- Pontos de "Outros" (cinza, sem linha) ---
  const grupoOutros = criarSvgEl('g', { class: 'pv-timeline-outros' });
  for (const ponto of serie.pontos) {
    if (nomesDestacados.includes(ponto.candidato)) continue;
    grupoOutros.append(
      criarSvgEl('circle', {
        cx: String(escalaX(ponto.data)),
        cy: String(escalaY(ponto.pct)),
        r: String(raioPonto(ponto.amostra)),
        class: 'pv-timeline-point pv-timeline-point-outros',
      }),
    );
  }
  svg.append(grupoOutros);

  // --- Séries destacadas: pontos + linha suavizada + rótulo direto ---
  const grupoSeries = criarSvgEl('g', { class: 'pv-timeline-series' });
  const candidatosParaRotulo: { candidato: SerieCandidato; x: number; y: number; corVar: string; texto: string }[] = [];
  for (const candidato of candidatosDestacados) {
    const corVar = tokenTomSerie(candidato.espectro, candidato.tom);

    const grupoPontos = criarSvgEl('g', { class: 'pv-timeline-points' });
    for (const ponto of serie.pontos) {
      if (ponto.candidato !== candidato.nome) continue;
      const circulo = criarSvgEl('circle', {
        cx: String(escalaX(ponto.data)),
        cy: String(escalaY(ponto.pct)),
        r: String(raioPonto(ponto.amostra)),
        class: 'pv-timeline-point',
        style: `fill:${corVar}`,
        'data-pesquisa-id': ponto.pollId,
      });
      grupoPontos.append(circulo);
    }
    grupoSeries.append(grupoPontos);

    const pontosLinha: PontoXY[] = [];
    for (const dia of serie.dias) {
      const v = dia.valores[candidato.nome];
      if (v == null) continue;
      pontosLinha.push({ x: escalaX(dia.data), y: escalaY(v) });
    }
    if (pontosLinha.length > 0) {
      desenharLinha(grupoSeries, pontosLinha, corVar);

      const ultimo = pontosLinha[pontosLinha.length - 1]!;
      const ultimoValor = [...serie.dias].reverse().find((d) => d.valores[candidato.nome] != null)?.valores[
        candidato.nome
      ];
      if (ultimoValor != null) {
        const marcador = criarSvgEl('circle', {
          cx: String(ultimo.x), cy: String(ultimo.y), r: '4', class: 'pv-timeline-end-dot', style: `fill:${corVar}`,
        });
        grupoSeries.append(marcador);

        candidatosParaRotulo.push({
          candidato,
          x: ultimo.x,
          y: ultimo.y,
          corVar,
          texto: `${formatarNumero(ultimoValor)}% ${candidato.nome}`,
        });
      }
    }
  }

  // Rótulos diretos no fim de cada linha — quando duas linhas terminam perto
  // uma da outra, afasta verticalmente (nunca empilha em cima, ver
  // references/marks-and-anatomy.md "quando rótulos de fim colidem").
  const ESPACO_MIN_ROTULO = 14;
  const rotulosOrdenados = [...candidatosParaRotulo].sort((a, b) => a.y - b.y);
  for (let i = 1; i < rotulosOrdenados.length; i++) {
    const anterior = rotulosOrdenados[i - 1]!;
    const atual = rotulosOrdenados[i]!;
    if (atual.y - anterior.y < ESPACO_MIN_ROTULO) {
      (atual as { y: number }).y = anterior.y + ESPACO_MIN_ROTULO;
    }
  }
  for (const { x, y, corVar, texto } of rotulosOrdenados) {
    const ancoraDireita = x > LARGURA - MARGEM.direita - 8;
    const linha = criarSvgEl('line', {
      x1: String(x), x2: String(x + (ancoraDireita ? -6 : 6)), y1: String(y), y2: String(y),
      class: 'pv-timeline-end-leader', style: `stroke:${corVar}`,
    });
    grupoSeries.append(linha);
    const rotulo = criarSvgEl('text', {
      x: String(x + (ancoraDireita ? -8 : 8)), y: String(y + 4), class: 'pv-timeline-end-label',
      'text-anchor': ancoraDireita ? 'end' : 'start',
    });
    rotulo.textContent = texto;
    grupoSeries.append(rotulo);
  }
  svg.append(grupoSeries);

  // --- Crosshair (oculto até hover/foco/teclado) ---
  const crosshair = criarSvgEl('line', {
    x1: '0', x2: '0', y1: String(areaY[1]), y2: String(areaY[0]), class: 'pv-timeline-crosshair', 'aria-hidden': 'true',
  });
  crosshair.style.display = 'none';
  svg.append(crosshair);

  host.append(svg);

  // --- Legenda: nome + partido de cada candidato destacado, + "Outros" ---
  const legenda = document.createElement('div');
  legenda.className = 'pv-timeline-legend';
  legenda.setAttribute('role', 'list');
  legenda.setAttribute('aria-label', 'Legenda de candidatos');
  for (const candidato of candidatosDestacados) {
    const item = document.createElement('span');
    item.className = 'pv-timeline-legend-item';
    item.setAttribute('role', 'listitem');
    const swatch = document.createElement('span');
    swatch.className = 'pv-timeline-legend-swatch';
    swatch.style.background = tokenTomSerie(candidato.espectro, candidato.tom);
    item.append(swatch);
    item.append(
      document.createTextNode(candidato.partido ? `${candidato.nome} (${candidato.partido})` : candidato.nome),
    );
    legenda.append(item);
  }
  const temOutros = serie.pontos.some((p) => !nomesDestacados.includes(p.candidato));
  if (temOutros) {
    const item = document.createElement('span');
    item.className = 'pv-timeline-legend-item';
    item.setAttribute('role', 'listitem');
    const swatch = document.createElement('span');
    swatch.className = 'pv-timeline-legend-swatch pv-timeline-legend-swatch--outros';
    item.append(swatch, document.createTextNode('Outros'));
    legenda.append(item);
  }
  host.append(legenda);

  // --- Tooltip flutuante ---
  const tooltip = document.createElement('div');
  tooltip.className = 'pv-timeline-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  host.style.position = host.style.position || 'relative';
  host.append(tooltip);

  ligarInteracao({
    svg,
    tooltip,
    crosshair,
    serie,
    candidatosDestacados,
    porNome,
    escalaX,
    escalaY,
    areaX,
    areaY,
    fimEixo,
    primeiraData,
  });
}

function desenharLinha(grupo: SVGGElement, pontos: readonly PontoXY[], corVar: string): void {
  const path = criarSvgEl('path', {
    d: caminhoSuavizado(pontos),
    class: 'pv-timeline-line',
    style: `stroke:${corVar}`,
    fill: 'none',
  });
  grupo.append(path);
}

interface EstadoInteracao {
  readonly svg: SVGSVGElement;
  readonly tooltip: HTMLDivElement;
  readonly crosshair: SVGLineElement;
  readonly serie: SerieTemporal;
  readonly candidatosDestacados: readonly SerieCandidato[];
  readonly porNome: ReadonlyMap<string, SerieCandidato>;
  readonly escalaX: (dataIso: string) => number;
  readonly escalaY: (v: number) => number;
  readonly areaX: readonly [number, number];
  readonly areaY: readonly [number, number];
  readonly fimEixo: string;
  readonly primeiraData: string;
}

/** Índice do dia de `serie.dias` cuja posição x está mais próxima de `xAlvo`. */
function diaMaisProximo(serie: SerieTemporal, escalaX: (d: string) => number, xAlvo: number): number {
  let melhorIdx = 0;
  let melhorDist = Infinity;
  serie.dias.forEach((dia, i) => {
    const dist = Math.abs(escalaX(dia.data) - xAlvo);
    if (dist < melhorDist) {
      melhorDist = dist;
      melhorIdx = i;
    }
  });
  return melhorIdx;
}

function montarTooltipHtml(
  dia: DiaSerieTemporal,
  candidatosDestacados: readonly SerieCandidato[],
  pontoPesquisa: PontoSerieTemporal | null,
): string {
  const linhas = candidatosDestacados
    .filter((c) => dia.valores[c.nome] != null)
    .map((c) => {
      const valor = dia.valores[c.nome]!;
      return `<li><span class="pv-timeline-tooltip-swatch" style="background:${tokenTomSerie(c.espectro, c.tom)}"></span>${escaparHtml(
        c.nome,
      )} <strong>${formatarNumero(valor)}%</strong></li>`;
    })
    .join('');

  const detalhePesquisa = pontoPesquisa
    ? `<p class="pv-timeline-tooltip-poll">${escaparHtml(pontoPesquisa.instituto)} · ${escaparHtml(
        formatarPeriodo(undefined, pontoPesquisa.data),
      )} · amostra ${
        pontoPesquisa.amostra != null ? pontoPesquisa.amostra.toLocaleString('pt-BR') : 'não informada'
      } · registro TSE ${pontoPesquisa.registroTSE.naoRegistrada ? 'não localizado' : escaparHtml(pontoPesquisa.registroTSE.valor)}</p>`
    : '';

  return `
    <p class="pv-timeline-tooltip-data">${escaparHtml(formatarPeriodo(undefined, dia.data))}</p>
    <ul class="pv-timeline-tooltip-list">${linhas}</ul>
    ${detalhePesquisa}
  `;
}

function escaparHtml(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ligarInteracao(estado: EstadoInteracao): void {
  const { svg, tooltip, crosshair, serie, candidatosDestacados, escalaX, escalaY, areaX, areaY } = estado;

  let indiceAtual = serie.dias.length - 1;
  let pontoHover: PontoSerieTemporal | null = null;

  function posicionarTooltip(xSvg: number, ySvg: number): void {
    const ret = svg.getBoundingClientRect();
    const hostRect = (svg.parentElement as HTMLElement).getBoundingClientRect();
    const escalaPxPorUnidade = ret.width / LARGURA;
    const xPx = xSvg * escalaPxPorUnidade;
    const yPx = ySvg * escalaPxPorUnidade;
    const offsetX = ret.left - hostRect.left;
    const offsetY = ret.top - hostRect.top;
    tooltip.style.left = `${offsetX + xPx + 12}px`;
    tooltip.style.top = `${offsetY + yPx}px`;
  }

  function atualizar(indice: number, xClientHint?: number): void {
    indiceAtual = Math.max(0, Math.min(serie.dias.length - 1, indice));
    const dia = serie.dias[indiceAtual]!;
    const x = escalaX(dia.data);
    crosshair.setAttribute('x1', String(x));
    crosshair.setAttribute('x2', String(x));
    crosshair.style.display = '';

    tooltip.innerHTML = montarTooltipHtml(dia, candidatosDestacados, pontoHover);
    tooltip.hidden = false;
    posicionarTooltip(x, xClientHint ?? (areaY[0] + areaY[1]) / 2);
  }

  function esconder(): void {
    crosshair.style.display = 'none';
    tooltip.hidden = true;
    pontoHover = null;
  }

  svg.addEventListener('pointermove', (e: PointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * LARGURA;
    if (xRel < areaX[0] || xRel > areaX[1]) {
      esconder();
      return;
    }
    const idx = diaMaisProximo(serie, escalaX, xRel);

    // Se o ponteiro está bem próximo de um marcador individual (raio + folga
    // de toque), mostra também os detalhes daquela pesquisa (instituto,
    // campo, amostra, registro TSE) — ver references/interaction.md.
    const yRel = ((e.clientY - rect.top) / rect.height) * ALTURA;
    let maisProximo: PontoSerieTemporal | null = null;
    let melhorDist = 14; // folga de toque em unidades do viewBox
    for (const p of serie.pontos) {
      const px = escalaX(p.data);
      const py = escalaY(p.pct);
      const dist = Math.hypot(px - xRel, py - yRel);
      if (dist < melhorDist) {
        melhorDist = dist;
        maisProximo = p;
      }
    }
    pontoHover = maisProximo;
    atualizar(idx, yRel);
  });
  svg.addEventListener('pointerleave', esconder);

  svg.addEventListener('focus', () => atualizar(indiceAtual));
  svg.addEventListener('blur', esconder);

  svg.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      pontoHover = null;
      atualizar(indiceAtual - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      pontoHover = null;
      atualizar(indiceAtual + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      pontoHover = null;
      atualizar(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      pontoHover = null;
      atualizar(serie.dias.length - 1);
    } else if (e.key === 'Escape') {
      esconder();
    }
  });
}
