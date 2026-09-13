import '../styles/views.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { AssentoSenado } from '../../../../domain/senate.js';
import { posicaoHemiciclo } from '../../../../domain/senate.js';
import { UFS } from '../../../../domain/race.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import { classeEspectro, criarEl, rotuloEspectro, tokenFillEspectro, tokenSolidEspectro } from './_shared.js';

/**
 * Hemiciclo do Senado (81 assentos), NYT "Senate results 2024" como barra de
 * qualidade — aqui em arco em vez de barra segmentada. Ver docs/ux-spec.md §2(d)
 * e docs/design-system.md "Hemiciclo do Senado".
 */

/* =========================================================================
 * Geometria pura do hemiciclo — sem I/O, sem DOM. Testada em
 * src/adapters/inbound/web/views/__tests__/senate-hemicycle-layout.test.ts.
 * ======================================================================= */

export interface PosicaoAssento {
  /** 0 = fileira mais interna. */
  readonly fileira: number;
  readonly totalFileiras: number;
  /** 180° = extremo esquerdo, 0° = extremo direito. */
  readonly anguloGraus: number;
  /** Raio relativo da fileira (1 = mais interna, cresce 1 por fileira). */
  readonly raio: number;
  /** Coordenadas em unidades relativas; y <= 0 (arco abre para cima). */
  readonly x: number;
  readonly y: number;
}

/**
 * Número de fileiras concêntricas: 3 para hemiciclos pequenos, 4 a partir de
 * 49 assentos (as 81 cadeiras do Senado caem nesta segunda faixa) — mantém a
 * densidade de assentos por fileira em uma faixa visualmente razoável.
 */
export function calcularNumeroFileiras(totalAssentos: number): number {
  if (totalAssentos <= 0) return 1;
  return totalAssentos <= 48 ? 3 : 4;
}

/** Distribui `total` unidades entre `pesos` proporcionalmente, somando exatamente `total` (método dos maiores restos). */
function distribuirProporcional(total: number, pesos: readonly number[]): number[] {
  const pesoTotal = pesos.reduce((soma, p) => soma + p, 0);
  const brutos = pesos.map((p) => (total * p) / pesoTotal);
  const base = brutos.map((v) => Math.floor(v));
  const jaAlocado = base.reduce((soma, v) => soma + v, 0);
  const falta = total - jaAlocado;
  const restosOrdenados = brutos
    .map((v, i) => ({ i, resto: v - base[i]! }))
    .sort((a, b) => b.resto - a.resto || b.i - a.i);
  for (let k = 0; k < falta; k++) {
    const alvo = restosOrdenados[k % restosOrdenados.length]!.i;
    base[alvo] = (base[alvo] ?? 0) + 1;
  }
  return base;
}

/**
 * Calcula a posição de cada assento de um hemiciclo com `totalAssentos`
 * cadeiras: fileiras concêntricas (raio crescente), número de assentos por
 * fileira proporcional à circunferência (arco de 180°), preenchidas da
 * esquerda (180°) para a direita (0°) — a i-ésima posição do resultado
 * corresponde ao i-ésimo assento da lista de entrada, que já vem ordenada
 * por espectro (ver `projetarSenado`/`posicaoHemiciclo` em domain/senate.ts).
 */
export function calcularLayoutHemiciclo(totalAssentos: number): PosicaoAssento[] {
  if (totalAssentos <= 0) return [];

  const totalFileiras = calcularNumeroFileiras(totalAssentos);
  const pesos = Array.from({ length: totalFileiras }, (_, i) => i + 1);
  const assentosPorFileira = distribuirProporcional(totalAssentos, pesos);

  const candidatos: { fileira: number; angulo: number; raio: number }[] = [];
  assentosPorFileira.forEach((quantidade, fileira) => {
    const raio = fileira + 1;
    for (let j = 0; j < quantidade; j++) {
      const angulo = quantidade === 1 ? 90 : 180 - (j * 180) / (quantidade - 1);
      candidatos.push({ fileira, angulo, raio });
    }
  });

  // Ordena globalmente por ângulo (esquerda -> direita) juntando todas as
  // fileiras: a i-ésima posição desta lista recebe o i-ésimo assento de
  // entrada, preservando a ordem esquerda->direita através das fileiras.
  candidatos.sort((a, b) => b.angulo - a.angulo || a.fileira - b.fileira);

  return candidatos.map(({ fileira, angulo, raio }) => {
    const rad = (angulo * Math.PI) / 180;
    return {
      fileira,
      totalFileiras,
      anguloGraus: angulo,
      raio,
      x: raio * Math.cos(rad),
      y: -raio * Math.sin(rad),
    };
  });
}

/** Ângulo (graus) do raio que separa o assento de índice `maioria - 1` do seguinte. */
function anguloDaMaioria(layout: readonly PosicaoAssento[], maioria: number): number {
  const idx = Math.min(Math.max(maioria, 1), layout.length) - 1;
  const atual = layout[idx];
  if (!atual) return 90;
  const proximo = layout[idx + 1];
  return proximo ? (atual.anguloGraus + proximo.anguloGraus) / 2 : atual.anguloGraus;
}

/* =========================================================================
 * Render
 * ======================================================================= */

type OrigemVisual = 'fixa' | 'projetada' | 'indefinida' | 'atual';

interface AssentoVisual {
  readonly uf: string | null;
  readonly ocupante: string | null;
  readonly partido: string | null;
  readonly espectro: Espectro;
  readonly origemVisual: OrigemVisual;
  readonly empateTecnico?: boolean;
}

const MAIORIA = 41;
const SCALE = 42;
const SEAT_R = 9;
const PAD = SEAT_R + 8;
const TOPO_EXTRA = 30; // espaço para o rótulo "41 para maioria"

function assentosDaProjecao(assentos: readonly AssentoSenado[]): AssentoVisual[] {
  return assentos.map((a) => ({
    uf: a.uf,
    ocupante: a.ocupante,
    partido: a.partido,
    espectro: a.espectro,
    origemVisual: a.origem,
    ...(a.empateTecnico != null ? { empateTecnico: a.empateTecnico } : {}),
  }));
}

/** Composição atual (sem projeção): só há contagem por partido, não identidade por cadeira. */
function assentosDaComposicaoAtual(
  totalPorPartido: Readonly<Record<string, number>>,
  espectroPorPartido: ReadonlyMap<string, Espectro>,
): AssentoVisual[] {
  const sinteticos: AssentoVisual[] = [];
  for (const [partido, quantidade] of Object.entries(totalPorPartido)) {
    const espectro = espectroPorPartido.get(partido) ?? 'indefinido';
    for (let i = 0; i < quantidade; i++) {
      sinteticos.push({ uf: null, ocupante: null, partido, espectro, origemVisual: 'atual' });
    }
  }
  sinteticos.sort(
    (a, b) => posicaoHemiciclo(a.espectro) - posicaoHemiciclo(b.espectro) || (a.partido ?? '').localeCompare(b.partido ?? ''),
  );
  return sinteticos;
}

function rotuloAria(assento: AssentoVisual): string {
  const partido = assento.partido ?? 'sem partido';
  switch (assento.origemVisual) {
    case 'fixa':
      return `${assento.uf} — ${assento.ocupante} (${partido}), cadeira até 2031, não disputada em 2026`;
    case 'projetada':
      return `${assento.uf} — ${assento.ocupante} (${partido}), projetada para 2027${assento.empateTecnico ? ', empate técnico' : ''}`;
    case 'indefinida':
      return `${assento.uf}, cadeira indefinida — sem pesquisa suficiente para projetar`;
    case 'atual':
    default:
      return `${partido} (${rotuloEspectro(assento.espectro)}), bancada atual`;
  }
}

function criarSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [chave, valor] of Object.entries(attrs)) el.setAttribute(chave, valor);
  return el;
}

function desenharHemiciclo(assentos: readonly AssentoVisual[], ufDestacada: string | null): SVGSVGElement {
  const layout = calcularLayoutHemiciclo(assentos.length);
  const raioMax = layout.reduce((max, p) => Math.max(max, p.raio), 1);

  const largura = raioMax * SCALE * 2 + PAD * 2;
  const altura = raioMax * SCALE + PAD * 2 + TOPO_EXTRA;
  const cx = largura / 2;
  const cy = altura - PAD;

  const svg = criarSvgEl('svg', {
    viewBox: `0 0 ${largura} ${altura}`,
    role: 'group',
    'aria-label': `Hemiciclo do Senado com ${assentos.length} assentos, maioria em ${MAIORIA}`,
  });

  if (assentos.some((a) => a.origemVisual === 'indefinida')) {
    const defs = criarSvgEl('defs');
    const pattern = criarSvgEl('pattern', {
      id: 'pv-hachura-indefinida',
      width: '6',
      height: '6',
      patternTransform: 'rotate(45)',
      patternUnits: 'userSpaceOnUse',
    });
    pattern.append(
      criarSvgEl('rect', { width: '6', height: '6', fill: 'var(--color-surface-2)' }),
      criarSvgEl('line', { x1: '0', y1: '0', x2: '0', y2: '6', stroke: 'var(--color-border-strong)', 'stroke-width': '3' }),
    );
    defs.append(pattern);
    svg.append(defs);
  }

  // Marcador de maioria: raio radial na fronteira entre a 41ª e a 42ª cadeira.
  if (layout.length >= MAIORIA) {
    const anguloMaioria = anguloDaMaioria(layout, MAIORIA);
    const rad = (anguloMaioria * Math.PI) / 180;
    const raioLinha = raioMax * SCALE + SEAT_R + 4;
    const x2 = cx + raioLinha * Math.cos(rad);
    const y2 = cy - raioLinha * Math.sin(rad);
    const rotuloMaioria = criarSvgEl('text', { class: 'pv-majority-label', x: String(x2), y: String(y2 - 6) });
    rotuloMaioria.textContent = `${MAIORIA} para maioria`;
    svg.append(
      criarSvgEl('line', { class: 'pv-majority-line', x1: String(cx), y1: String(cy), x2: String(x2), y2: String(y2) }),
      rotuloMaioria,
    );
  }

  layout.forEach((pos, i) => {
    const assento = assentos[i];
    if (!assento) return;
    const sx = cx + pos.x * SCALE;
    const sy = cy + pos.y * SCALE;
    const classes = ['pv-assento', classeEspectro(assento.espectro), `pv-origem-${assento.origemVisual}`];
    if (assento.empateTecnico) classes.push('pv-empate-tecnico');
    if (ufDestacada) classes.push(assento.uf === ufDestacada ? 'pv-destacado' : 'pv-esmaecido');

    const rotulo = rotuloAria(assento);
    const circulo = criarSvgEl('circle', {
      class: classes.join(' '),
      cx: String(sx),
      cy: String(sy),
      r: String(SEAT_R),
      tabindex: '0',
      role: 'img',
      'aria-label': rotulo,
    });
    const titulo = criarSvgEl('title');
    titulo.textContent = rotulo;
    circulo.append(titulo);
    svg.append(circulo);
  });

  return svg;
}

function criarBarraPartido(
  partido: string,
  espectro: Espectro,
  fixa: number,
  projetada: number,
): HTMLElement {
  const total = fixa + projetada;
  const max = 20; // referência visual (maior bancada possível é bem menor que 81)
  const pctFixa = Math.min(100, (fixa / max) * 100);
  const pctProjetada = Math.min(100 - pctFixa, (projetada / max) * 100);
  const track = criarEl('div', { className: 'pv-bar-track' }, [
    criarEl('div', {
      className: 'pv-bar-fill',
      attrs: { style: `width:${pctFixa}%;background:${tokenSolidEspectro(espectro)}` },
    }),
    criarEl('div', {
      className: 'pv-bar-fill',
      attrs: { style: `width:${pctProjetada}%;left:${pctFixa}%;background:${tokenFillEspectro(espectro)}` },
    }),
  ]);
  return criarEl('div', { className: 'pv-bar-row' }, [
    criarEl('span', { className: 'pv-bar-name' }, [criarEl('span', { className: 'pv-bar-name-text', texto: partido })]),
    track,
    criarEl(
      'span',
      { className: 'pv-bar-pct pv-num' },
      [`${total}`, criarEl('span', { className: 'pv-sr-only', texto: ` (${fixa} fixas + ${projetada} projetadas)` })],
    ),
  ]);
}

function criarLinhaLegendaEspectro(espectro: Espectro, contagem: number): HTMLElement {
  return criarEl('div', { className: 'pv-legend-row' }, [
    criarEl('span', {
      className: 'pv-legend-swatch',
      attrs: { style: `background:${tokenFillEspectro(espectro)}` },
    }),
    criarEl('span', { texto: rotuloEspectro(espectro) }),
    criarEl('span', { className: 'pv-legend-count pv-num', texto: String(contagem) }),
  ]);
}

export function renderSenate(container: HTMLElement, casos: CasosDeUso): void {
  const projecao = casos.projectSenate();
  const partidos = casos.listParties();
  const espectroPorPartido = new Map(partidos.map((p) => [p.sigla, p.espectro] as const));

  container.innerHTML = '';
  const raiz = criarEl('section', { className: 'pv-view', attrs: { 'aria-labelledby': 'senado-titulo' } });

  raiz.append(
    criarEl('header', { className: 'pv-header' }, [
      criarEl('h1', { className: 'pv-title', texto: 'Senado — hemiciclo', attrs: { id: 'senado-titulo' } }),
      criarEl('p', {
        className: 'pv-meta',
        texto: '81 assentos. Marcador de maioria em 41.',
      }),
    ]),
  );

  // --- Controles: alternância de modo + filtro de UF ---
  let modo: 'projecao' | 'atual' = 'projecao';
  let ufFiltro: string | null = null;

  const btnProjecao = criarEl('button', {
    className: 'pv-toggle-btn',
    texto: 'Projeção 2027',
    attrs: { type: 'button', 'aria-pressed': 'true' },
  });
  const btnAtual = criarEl('button', {
    className: 'pv-toggle-btn',
    texto: 'Composição atual',
    attrs: { type: 'button', 'aria-pressed': 'false' },
  });
  const toggle = criarEl('div', { className: 'pv-toggle-group', attrs: { role: 'group', 'aria-label': 'Modo de exibição' } }, [
    btnProjecao,
    btnAtual,
  ]);

  const selectUf = criarEl('select', { className: 'pv-select', attrs: { id: 'senado-filtro-uf' } });
  selectUf.append(criarEl('option', { texto: 'Todas as UFs', attrs: { value: '' } }));
  for (const uf of UFS) {
    selectUf.append(criarEl('option', { texto: uf, attrs: { value: uf } }));
  }
  const campoUf = criarEl('label', { className: 'pv-field', texto: 'Destacar UF' }, [selectUf]);

  const controles = criarEl('div', { className: 'pv-controls-row' }, [toggle, campoUf]);
  raiz.append(controles);

  const corpo = criarEl('div', { className: 'pv-card' });
  raiz.append(corpo);

  const legendaPartidos = criarEl('div', { className: 'pv-card' });
  const legendaEspectro = criarEl('div', { className: 'pv-card pv-legend' });
  const explicacao = criarEl('p', {
    className: 'pv-explainer',
    texto: '27 cadeiras eleitas em 2022 não estão em disputa; 54 são projetadas pelos dois primeiros das pesquisas de cada estado.',
  });
  raiz.append(
    criarEl('div', { className: 'pv-columns-2' }, [legendaPartidos, legendaEspectro]),
    explicacao,
  );

  function atualizar(): void {
    corpo.innerHTML = '';
    selectUf.disabled = modo !== 'projecao';
    if (modo !== 'projecao') selectUf.value = '';

    const assentosVisuais: AssentoVisual[] =
      modo === 'projecao'
        ? assentosDaProjecao(projecao.assentos)
        : assentosDaComposicaoAtual(projecao.composicaoAtual.totalPorPartido, espectroPorPartido);

    corpo.append(
      criarEl('div', { className: 'pv-hemiciclo-wrap' }, [
        desenharHemiciclo(assentosVisuais, modo === 'projecao' ? ufFiltro : null),
      ]),
    );

    // Totais por partido (fixa + projetada), ordenados pelo espectro.
    legendaPartidos.innerHTML = '';
    legendaPartidos.append(criarEl('h2', { className: 'pv-section-title', texto: 'Bancadas por partido' }));
    const porPartido = new Map<string, { fixa: number; projetada: number; espectro: Espectro }>();
    if (modo === 'projecao') {
      for (const a of projecao.assentos) {
        if (!a.partido) continue;
        const atual = porPartido.get(a.partido) ?? { fixa: 0, projetada: 0, espectro: a.espectro };
        if (a.origem === 'fixa') atual.fixa += 1;
        else if (a.origem === 'projetada') atual.projetada += 1;
        porPartido.set(a.partido, atual);
      }
    } else {
      for (const [partido, quantidade] of Object.entries(projecao.composicaoAtual.totalPorPartido)) {
        porPartido.set(partido, { fixa: quantidade, projetada: 0, espectro: espectroPorPartido.get(partido) ?? 'indefinido' });
      }
    }
    const partidosOrdenados = [...porPartido.entries()].sort(
      (a, b) =>
        posicaoHemiciclo(a[1].espectro) - posicaoHemiciclo(b[1].espectro) ||
        b[1].fixa + b[1].projetada - (a[1].fixa + a[1].projetada),
    );
    for (const [partido, dados] of partidosOrdenados) {
      legendaPartidos.append(criarBarraPartido(partido, dados.espectro, dados.fixa, dados.projetada));
    }

    // Totais por espectro.
    legendaEspectro.innerHTML = '';
    legendaEspectro.append(criarEl('h2', { className: 'pv-section-title', texto: 'Totais por espectro' }));
    const totalEspectro = modo === 'projecao' ? projecao.totalPorEspectro : projecao.composicaoAtual.totalPorEspectro;
    const espectrosOrdenados = (Object.entries(totalEspectro) as [Espectro, number][]).sort(
      (a, b) => posicaoHemiciclo(a[0]) - posicaoHemiciclo(b[0]),
    );
    for (const [espectro, contagem] of espectrosOrdenados) {
      legendaEspectro.append(criarLinhaLegendaEspectro(espectro, contagem));
    }
  }

  btnProjecao.addEventListener('click', () => {
    modo = 'projecao';
    btnProjecao.setAttribute('aria-pressed', 'true');
    btnAtual.setAttribute('aria-pressed', 'false');
    atualizar();
  });
  btnAtual.addEventListener('click', () => {
    modo = 'atual';
    btnProjecao.setAttribute('aria-pressed', 'false');
    btnAtual.setAttribute('aria-pressed', 'true');
    atualizar();
  });
  selectUf.addEventListener('change', () => {
    ufFiltro = selectUf.value || null;
    atualizar();
  });

  atualizar();
  container.append(raiz);
}
