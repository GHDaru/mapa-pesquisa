import brazilMapDados from '@svg-maps/brazil';
import '../styles/views.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { SenadoUf } from '../../../../application/use-cases/get-senate-by-state.js';
import type { AssentoSenado } from '../../../../domain/senate.js';
import { posicaoHemiciclo } from '../../../../domain/senate.js';
import { UFS } from '../../../../domain/race.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import type { NivelConfianca } from '../../../../domain/aggregate.js';
import {
  classeEspectro,
  criarBadgePartido,
  criarEl,
  criarLinkFonte,
  criarSeloEmpateTecnico,
  formatarPct,
  rotuloEspectro,
  tokenFillEspectro,
  tokenSolidEspectro,
} from './_shared.js';
import { rotuloConfianca } from '../format.js';

/** Ver nota de tipagem em map-view.ts sobre por que este cast é necessário. */
interface LocalidadeMapa {
  readonly id: string;
  readonly name: string;
}
interface MapaSvg {
  readonly locations: readonly LocalidadeMapa[];
}
const brazilMap = brazilMapDados as MapaSvg;
const NOME_POR_UF = new Map(brazilMap.locations.map((loc) => [loc.id.toUpperCase(), loc.name]));

/** Rótulo textual da faixa de confiança de uma cadeira projetada — nunca só a cor/opacidade. */
function rotuloConfiancaAssento(confianca: NivelConfianca): string {
  switch (confianca) {
    case 'folga':
      return rotuloConfianca('solid');
    case 'acirrada':
      return rotuloConfianca('lean');
    case 'empate':
      return rotuloConfianca('empate');
  }
}

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
  readonly confianca: NivelConfianca | null;
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
    confianca: a.confianca,
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
      sinteticos.push({ uf: null, ocupante: null, partido, espectro, origemVisual: 'atual', confianca: null });
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
      return `${assento.uf} — ${assento.ocupante} (${partido}), projetada para 2026${assento.confianca ? `, ${rotuloConfiancaAssento(assento.confianca).toLowerCase()}` : ''}`;
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

function desenharHemiciclo(
  assentos: readonly AssentoVisual[],
  ufDestacada: string | null,
  aoSelecionarUf: (uf: string, origem: HTMLElement | SVGElement) => void,
): SVGSVGElement {
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
      criarSvgEl('rect', { width: '6', height: '6', fill: 'var(--color-surface-3)' }),
      criarSvgEl('line', { x1: '0', y1: '0', x2: '0', y2: '6', stroke: 'var(--color-text-tertiary)', 'stroke-width': '3' }),
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
    if (assento.origemVisual === 'projetada' && assento.confianca) {
      classes.push(`pv-confianca-${assento.confianca}`);
    }
    if (ufDestacada) classes.push(assento.uf === ufDestacada ? 'pv-destacado' : 'pv-esmaecido');

    // Só assentos com UF identificada (fixa/projetada/indefinida) abrem o
    // painel — os assentos sintéticos da composição atual (origem "atual")
    // não têm UF, só contam para o total do partido.
    const clicavel = assento.uf != null && assento.origemVisual !== 'atual';
    if (clicavel) classes.push('pv-assento--clicavel');

    const rotulo = rotuloAria(assento);
    // Grupo (não só o círculo) carrega a interatividade: assim o marcador
    // interno das cadeiras projetadas (abaixo) herda `fill`/`stroke` do
    // mesmo estado (foco, destaque, confiança) sem duplicar classes.
    const grupo = criarSvgEl('g', {
      class: classes.join(' '),
      tabindex: '0',
      role: clicavel ? 'button' : 'img',
      'aria-label': clicavel ? `${rotulo} — ver detalhes da UF` : rotulo,
      ...(clicavel ? { 'aria-haspopup': 'dialog' } : {}),
    });
    const titulo = criarSvgEl('title');
    titulo.textContent = rotulo;
    const corpo = criarSvgEl('circle', {
      class: 'pv-assento-corpo',
      cx: String(sx),
      cy: String(sy),
      r: String(SEAT_R),
    });
    grupo.append(titulo, corpo);

    // Distinção fixa/projetada reforçada além do contorno tracejado (que a
    // 9px de raio fica quase ilegível a olho nu, ver docs/revisao-senado.md
    // P1): um marcador interno sólido só nas cadeiras projetadas, além do
    // rótulo textual "projetada"/"não disputada" no aria-label/tooltip.
    if (assento.origemVisual === 'projetada') {
      grupo.append(
        criarSvgEl('circle', {
          class: 'pv-assento-marcador',
          cx: String(sx),
          cy: String(sy),
          r: String(SEAT_R * 0.36),
        }),
      );
    }

    if (clicavel) {
      const uf = assento.uf!;
      grupo.addEventListener('click', () => aoSelecionarUf(uf, grupo));
      grupo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          aoSelecionarUf(uf, grupo);
        }
      });
    }

    svg.append(grupo);
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

/**
 * Legenda de confiança das cadeiras projetadas — reforço textual das 3
 * faixas de opacidade (docs/design-system.md), igual à do mapa (item b da
 * ux-spec). Estática: não muda com o modo/filtro, por isso montada 1x fora
 * de `atualizar()`.
 */
function criarLegendaConfianca(): HTMLElement {
  const card = criarEl('div', { className: 'pv-card pv-legend' });
  card.append(criarEl('h2', { className: 'pv-section-title', texto: 'Confiança da projeção' }));
  const linhas: readonly [NivelConfianca, string][] = [
    ['folga', 'var(--confidence-solid-opacity)'],
    ['acirrada', 'var(--confidence-lean-opacity)'],
    ['empate', 'var(--confidence-empate-opacity)'],
  ];
  for (const [confianca, opacidade] of linhas) {
    card.append(
      criarEl('div', { className: 'pv-legend-row' }, [
        criarEl('span', {
          className: 'pv-legend-swatch',
          attrs: { style: `background:var(--color-accent);opacity:${opacidade}` },
        }),
        criarEl('span', { texto: rotuloConfiancaAssento(confianca) }),
      ]),
    );
  }
  card.append(
    criarEl('div', { className: 'pv-legend-row' }, [
      criarEl('span', { className: 'pv-legend-swatch pv-legend-swatch--hachura' }),
      criarEl('span', { texto: 'Indefinida — sem pesquisa suficiente' }),
    ]),
  );
  card.append(
    criarEl('div', { className: 'pv-legend-row' }, [
      criarEl('span', { className: 'pv-legend-swatch pv-legend-swatch--tracejado' }),
      criarEl('span', { texto: 'Contorno tracejado + marcador central = cadeira projetada' }),
    ]),
  );
  return card;
}

/* =========================================================================
 * Painel/diálogo da UF (clique num assento) — mesma linguagem visual do
 * painel de estado (`state-panel.ts`/`.state-panel` em styles/app.css):
 * role="dialog", Esc fecha, foco preso enquanto aberto, foco retorna à
 * origem ao fechar. Ver docs/ux-spec.md §3 (teclado/foco) e §2(b).
 * ======================================================================= */

let painelSenadoBackdrop: HTMLElement | null = null;
let painelSenadoOrigem: HTMLElement | SVGElement | null = null;

function focarElemento(el: HTMLElement | SVGElement | null): void {
  if (el && typeof (el as { focus?: () => void }).focus === 'function') (el as { focus: () => void }).focus();
}

function aoTeclarPainelSenado(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    fecharPainelSenado();
    return;
  }
  if (e.key === 'Tab' && painelSenadoBackdrop) {
    const painel = painelSenadoBackdrop.querySelector<HTMLElement>('.state-panel');
    if (painel) trapFocoPainelSenado(e, painel);
  }
}

function trapFocoPainelSenado(e: KeyboardEvent, container: HTMLElement): void {
  const focaveis = Array.from(
    container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  );
  if (focaveis.length === 0) return;
  const primeiro = focaveis[0]!;
  const ultimo = focaveis[focaveis.length - 1]!;
  if (e.shiftKey && document.activeElement === primeiro) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primeiro.focus();
  }
}

/** Fecha o painel da UF do Senado, se houver um aberto, e devolve o foco à origem. */
export function fecharPainelSenado(): void {
  if (!painelSenadoBackdrop) return;
  document.removeEventListener('keydown', aoTeclarPainelSenado);
  painelSenadoBackdrop.remove();
  painelSenadoBackdrop = null;
  focarElemento(painelSenadoOrigem);
  painelSenadoOrigem = null;
}

function criarLinhaCadeiraFixa(dados: SenadoUf, espectroPorPartido: ReadonlyMap<string, Espectro>): HTMLElement {
  if (!dados.cadeiraFixa) {
    return criarEl('p', { className: 'pv-meta', texto: 'Nenhuma cadeira fixa registrada para esta UF.' });
  }
  const { senador, partido, mandatoFim } = dados.cadeiraFixa;
  return criarEl('p', { className: 'state-panel__lider' }, [
    criarEl('span', { className: 'state-panel__lider-nome', texto: senador }),
    criarBadgePartido(partido, espectroPorPartido.get(partido) ?? 'indefinido'),
    criarEl('span', { className: 'pv-meta', texto: `mandato até ${mandatoFim}` }),
  ]);
}

function criarLinhasCadeirasEmDisputa(dados: SenadoUf, espectroPorPartido: ReadonlyMap<string, Espectro>): HTMLElement {
  if (dados.cadeirasAtuaisEmDisputa.length === 0) {
    return criarEl('p', { className: 'pv-meta', texto: 'Nenhuma cadeira em disputa registrada para esta UF.' });
  }
  const linhas = dados.cadeirasAtuaisEmDisputa.map((atual, i) => {
    const projetado = dados.projetadas[i];
    const badgeAtual = criarBadgePartido(atual.partido, espectroPorPartido.get(atual.partido) ?? 'indefinido');
    const linhaAtual = criarEl('p', { className: 'pv-meta' }, [`Hoje: ${atual.senador} `, badgeAtual]);

    let linhaProjetada: HTMLElement;
    if (!projetado || !projetado.candidato) {
      linhaProjetada = criarEl('p', { className: 'pv-meta', texto: 'Projeção: sem pesquisa suficiente para esta cadeira.' });
    } else {
      const espectro = projetado.partido ? (espectroPorPartido.get(projetado.partido) ?? 'indefinido') : 'indefinido';
      const badgeProjetado = projetado.partido ? criarBadgePartido(projetado.partido, espectro) : null;
      const confiancaTexto = projetado.confianca ? ` — ${rotuloConfiancaAssento(projetado.confianca).toLowerCase()}` : '';
      linhaProjetada = criarEl('p', { className: 'pv-meta' }, [
        `Projeção: ${projetado.candidato} `,
        badgeProjetado,
        ` ${formatarPct(projetado.pct)}${confiancaTexto}`,
      ]);
    }
    return criarEl('div', { className: 'pv-senate-panel-disputa-item' }, [linhaAtual, linhaProjetada]);
  });
  return criarEl('div', { className: 'pv-senate-panel-disputas' }, linhas);
}

/** Abre o painel/diálogo com os detalhes do Senado de uma UF (clique num assento). */
function abrirPainelSenado(uf: string, casos: CasosDeUso, origem: HTMLElement | SVGElement): void {
  fecharPainelSenado();

  const dados = casos.getSenateByState().find((d) => d.uf === uf);
  const partidos = casos.listParties();
  const espectroPorPartido = new Map(partidos.map((p) => [p.sigla, p.espectro] as const));
  const nome = NOME_POR_UF.get(uf) ?? uf;

  const backdrop = document.createElement('div');
  backdrop.className = 'state-panel-backdrop';
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) fecharPainelSenado();
  });

  const painel = criarEl('div', {
    className: 'state-panel',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'senado-painel-titulo' },
  });

  const btnFechar = criarEl('button', {
    className: 'state-panel__fechar',
    attrs: { type: 'button', 'aria-label': 'Fechar painel' },
  });
  btnFechar.innerHTML = '<span aria-hidden="true">×</span>';
  btnFechar.addEventListener('click', () => fecharPainelSenado());

  painel.append(
    criarEl('div', { className: 'state-panel__handle', attrs: { 'aria-hidden': 'true' } }),
    criarEl('header', { className: 'state-panel__header' }, [
      criarEl('h2', { className: 'state-panel__titulo', attrs: { id: 'senado-painel-titulo' } }, [
        nome,
        criarEl('span', { className: 'state-panel__uf', texto: ` (${uf})` }),
      ]),
      btnFechar,
    ]),
  );

  const corpo = criarEl('div', { className: 'state-panel__corpo' });
  if (!dados) {
    corpo.append(criarEl('p', { className: 'state-panel__vazio', texto: 'Dados do Senado indisponíveis para esta UF.' }));
  } else {
    corpo.append(
      criarEl('section', { className: 'state-panel__secao' }, [
        criarEl('div', { className: 'state-panel__secao-titulo' }, [criarEl('h3', { texto: 'Cadeira fixa — mandato até 2031' })]),
        criarLinhaCadeiraFixa(dados, espectroPorPartido),
      ]),
      criarEl('section', { className: 'state-panel__secao' }, [
        criarEl('div', { className: 'state-panel__secao-titulo' }, [
          criarEl('h3', { texto: 'Cadeiras em disputa — mandato até 2027' }),
          dados.empate ? criarSeloEmpateTecnico() : null,
        ]),
        criarLinhasCadeirasEmDisputa(dados, espectroPorPartido),
      ]),
    );
  }
  painel.append(corpo);

  const footer = criarEl('footer', { className: 'state-panel__footer' });
  if (dados?.fonte) {
    footer.append(
      criarEl('p', { className: 'state-panel__ultima' }, ['Última pesquisa de senador usada — fonte: ', criarLinkFonte(dados.fonte)]),
    );
  } else {
    footer.append(criarEl('p', { className: 'state-panel__ultima', texto: 'Nenhuma pesquisa de senador encontrada para esta UF.' }));
  }
  painel.append(footer);

  backdrop.appendChild(painel);
  document.body.appendChild(backdrop);

  painelSenadoBackdrop = backdrop;
  painelSenadoOrigem = origem;
  document.addEventListener('keydown', aoTeclarPainelSenado);
  focarElemento(btnFechar);
}

/* =========================================================================
 * Tabela "Senadores por estado" — abaixo do hemiciclo, as 27 UFs (ver
 * docs/ux-spec.md). Ordenável por UF (padrão, alfabética) ou por espectro
 * projetado (agrupa a progressão de cor, mesmo padrão de `parties-view.ts`);
 * vira lista de cards em 400px.
 * ======================================================================= */

type OrdenarSenadoPor = 'uf' | 'espectro';

/** Espectro do 1º colocado projetado da UF (para ordenar por espectro), ou 'indefinido' sem projeção. */
function espectroProjetadoLider(dados: SenadoUf, espectroPorPartido: ReadonlyMap<string, Espectro>): Espectro {
  const lider = dados.projetadas[0];
  if (!lider?.partido) return 'indefinido';
  return espectroPorPartido.get(lider.partido) ?? 'indefinido';
}

function ordenarSenadoPorUf(
  dados: readonly SenadoUf[],
  ordenarPor: OrdenarSenadoPor,
  espectroPorPartido: ReadonlyMap<string, Espectro>,
): SenadoUf[] {
  if (ordenarPor === 'uf') return [...dados].sort((a, b) => a.uf.localeCompare(b.uf));
  return [...dados].sort((a, b) => {
    const diff =
      posicaoHemiciclo(espectroProjetadoLider(a, espectroPorPartido)) -
      posicaoHemiciclo(espectroProjetadoLider(b, espectroPorPartido));
    return diff !== 0 ? diff : a.uf.localeCompare(b.uf);
  });
}

function criarThOrdenavelSenado(
  rotulo: string,
  campo: OrdenarSenadoPor,
  ordenarPor: OrdenarSenadoPor,
  aoClicar: (campo: OrdenarSenadoPor) => void,
): HTMLElement {
  const ativo = ordenarPor === campo;
  const btn = criarEl('button', {
    className: 'pv-table-sort-btn',
    texto: rotulo,
    attrs: { type: 'button', 'aria-label': `Ordenar por ${rotulo}` },
  });
  btn.addEventListener('click', () => aoClicar(campo));
  return criarEl('th', { attrs: { scope: 'col', 'aria-sort': ativo ? 'ascending' : 'none' } }, [btn]);
}

function criarCelulaAtuaisEmDisputa(dados: SenadoUf, espectroPorPartido: ReadonlyMap<string, Espectro>): HTMLElement {
  if (dados.cadeirasAtuaisEmDisputa.length === 0) {
    return criarEl('span', { className: 'pv-meta', texto: '—' });
  }
  return criarEl(
    'ul',
    { className: 'pv-mini-list' },
    dados.cadeirasAtuaisEmDisputa.map((atual) =>
      criarEl('li', {}, [`${atual.senador} `, criarBadgePartido(atual.partido, espectroPorPartido.get(atual.partido) ?? 'indefinido')]),
    ),
  );
}

function criarCelulaProjetados(dados: SenadoUf, espectroPorPartido: ReadonlyMap<string, Espectro>): HTMLElement {
  const validos = dados.projetadas.filter((p) => p.candidato);
  if (validos.length === 0) {
    return criarEl('span', { className: 'pv-selo pv-selo-indefinida', texto: 'Sem pesquisa suficiente' });
  }
  return criarEl(
    'ul',
    { className: 'pv-mini-list' },
    validos.map((p) => {
      const espectro = p.partido ? (espectroPorPartido.get(p.partido) ?? 'indefinido') : 'indefinido';
      return criarEl('li', {}, [
        `${p.candidato} `,
        p.partido ? criarBadgePartido(p.partido, espectro) : null,
        ` `,
        criarEl('span', { className: 'pv-num', texto: formatarPct(p.pct) }),
        p.confianca === 'empate' ? criarSeloEmpateTecnico() : null,
      ]);
    }),
  );
}

function criarTabelaSenadoPorEstado(
  todos: readonly SenadoUf[],
  espectroPorPartido: ReadonlyMap<string, Espectro>,
  ordenarPor: OrdenarSenadoPor,
  aoOrdenar: (campo: OrdenarSenadoPor) => void,
): HTMLElement {
  const dados = ordenarSenadoPorUf(todos, ordenarPor, espectroPorPartido);

  const wrap = criarEl('div', { className: 'pv-table-wrap pv-senate-table-wrap' });
  const table = criarEl('table', { className: 'pv-table', attrs: { id: 'senado-tabela-por-estado' } });
  table.append(
    criarEl('thead', {}, [
      criarEl('tr', {}, [
        criarThOrdenavelSenado('UF', 'uf', ordenarPor, aoOrdenar),
        criarEl('th', { texto: 'Cadeira fixa (até 2031)', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Atuais em disputa (até 2027)', attrs: { scope: 'col' } }),
        criarThOrdenavelSenado('Projetados 2027', 'espectro', ordenarPor, aoOrdenar),
      ]),
    ]),
  );

  const linhas = dados.map((d) => {
    const celulaFixa = d.cadeiraFixa
      ? criarEl('span', {}, [`${d.cadeiraFixa.senador} `, criarBadgePartido(d.cadeiraFixa.partido, espectroPorPartido.get(d.cadeiraFixa.partido) ?? 'indefinido')])
      : criarEl('span', { className: 'pv-meta', texto: '—' });

    return criarEl('tr', { attrs: { id: `senado-tabela-linha-${d.uf}`, tabindex: '-1' } }, [
      criarEl('td', { className: 'pv-num', texto: d.uf, attrs: { 'data-rotulo': 'UF' } }),
      criarEl('td', { attrs: { 'data-rotulo': 'Cadeira fixa (até 2031)' } }, [celulaFixa]),
      criarEl('td', { className: 'pv-col-wrap', attrs: { 'data-rotulo': 'Atuais em disputa (até 2027)' } }, [
        criarCelulaAtuaisEmDisputa(d, espectroPorPartido),
      ]),
      criarEl('td', { className: 'pv-col-wrap', attrs: { 'data-rotulo': 'Projetados 2027' } }, [
        criarCelulaProjetados(d, espectroPorPartido),
      ]),
    ]);
  });
  table.append(criarEl('tbody', {}, linhas));
  wrap.append(table);
  return wrap;
}

/** Rola até a linha da UF na tabela e a destaca brevemente (nunca só clique/hover no mapa). */
function destacarLinhaTabelaSenado(uf: string): void {
  const linha = document.getElementById(`senado-tabela-linha-${uf}`);
  if (!linha) return;
  document.querySelectorAll('.pv-senate-table-row--destacada').forEach((el) => el.classList.remove('pv-senate-table-row--destacada'));
  linha.classList.add('pv-senate-table-row--destacada');
  const reduzMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  linha.scrollIntoView({ block: 'center', behavior: reduzMovimento ? 'auto' : 'smooth' });
  linha.focus({ preventScroll: true });
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
    criarLegendaConfianca(),
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
        desenharHemiciclo(assentosVisuais, modo === 'projecao' ? ufFiltro : null, (uf, origem) => {
          abrirPainelSenado(uf, casos, origem);
        }),
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
    // O select "Destacar UF" também abre/rola até a linha correspondente na
    // tabela abaixo do hemiciclo — ver docs/ux-spec.md.
    if (ufFiltro) destacarLinhaTabelaSenado(ufFiltro);
  });

  atualizar();

  // --- Tabela "Senadores por estado" (27 UFs), abaixo do hemiciclo ---
  const todosSenadoUf = casos.getSenateByState();
  let ordenarTabelaPor: OrdenarSenadoPor = 'uf';

  const selectOrdenacaoTabela = criarEl('select', { className: 'pv-select', attrs: { id: 'senado-tabela-ordenar' } }, [
    criarEl('option', { texto: 'UF', attrs: { value: 'uf' } }),
    criarEl('option', { texto: 'Espectro projetado', attrs: { value: 'espectro' } }),
  ]);
  const campoOrdenacaoTabela = criarEl(
    'label',
    { className: 'pv-field pv-sort-select-wrap', texto: 'Ordenar por' },
    [selectOrdenacaoTabela],
  );

  const tabelaSenadoWrap = criarEl('div', {});

  function atualizarTabelaSenado(): void {
    selectOrdenacaoTabela.value = ordenarTabelaPor;
    tabelaSenadoWrap.innerHTML = '';
    tabelaSenadoWrap.append(
      criarTabelaSenadoPorEstado(todosSenadoUf, espectroPorPartido, ordenarTabelaPor, (campo) => {
        ordenarTabelaPor = campo;
        atualizarTabelaSenado();
      }),
    );
  }
  selectOrdenacaoTabela.addEventListener('change', () => {
    ordenarTabelaPor = selectOrdenacaoTabela.value === 'espectro' ? 'espectro' : 'uf';
    atualizarTabelaSenado();
  });
  atualizarTabelaSenado();

  raiz.append(
    criarEl('section', {}, [
      criarEl('h2', { className: 'pv-section-title', texto: 'Senadores por estado' }),
      criarEl('p', {
        className: 'pv-explainer',
        texto:
          'Cadeira fixa eleita em 2022 (mandato até 2031); ocupantes atuais e projeção 2027 das 2 cadeiras eleitas em 2018, em disputa em 2026.',
      }),
      campoOrdenacaoTabela,
      tabelaSenadoWrap,
    ]),
  );

  container.append(raiz);
}
