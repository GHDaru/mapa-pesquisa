import brazilMapDados from '@svg-maps/brazil';
import { MARGEM_REFERENCIA_PADRAO } from '../../../../domain/aggregate.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import type { CasosDeUso, VisaoGeralUf } from '../../../../application/use-cases/index.js';
import {
  corEspectro,
  corEspectroSolido,
  formatarData,
  formatarNumeroPt,
  nivelConfianca,
  opacidadeConfianca,
  rotuloConfianca,
  rotuloEspectro,
  type NivelConfianca,
} from '../format.js';
import { abrirPainelEstado } from './state-panel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * `@svg-maps/brazil` referencia o tipo `Map` de um pacote de tipos
 * (`svg-maps__common`) que não está instalado — o `.d.ts` da lib não
 * resolve, e sem essa anotação o TS infere `any` (e propaga inferências
 * erradas, ex.: `new Map(...)` genérico caindo para `{}`). Tipagem local
 * mínima o suficiente para o que usamos (id/name/path por localidade).
 */
interface LocalidadeMapa {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}
interface MapaSvg {
  readonly label: string;
  readonly viewBox: string;
  readonly locations: readonly LocalidadeMapa[];
}
const brazilMap = brazilMapDados as MapaSvg;

/** Nomes por UF (em português, já vêm assim de @svg-maps/brazil). */
const NOME_POR_UF = new Map(brazilMap.locations.map((loc) => [loc.id.toUpperCase(), loc.name]));

/** Abaixo desta área (em unidades do viewBox) o estado ganha um alvo de toque ampliado. */
const AREA_ALVO_AMPLIADO = 3000;
/** Abaixo desta área a sigla da UF é escondida em telas estreitas (<640px). */
const AREA_ESCONDER_SIGLA_ESTREITO = 6000;

const ESPECTROS_LEGENDA: readonly Espectro[] = [
  'esquerda',
  'centro-esquerda',
  'centro',
  'centro-direita',
  'direita',
];

interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Bounding box aproximado de um path do @svg-maps/brazil. Os paths dessa
 * biblioteca usam só comandos `m`/`z` (moveto e lineto relativos, sem
 * curvas), então a soma cumulativa dos pares de coordenadas dá o bbox exato
 * — evita depender de `SVGGraphicsElement.getBBox()` (não disponível em
 * ambientes sem layout real, como os testes).
 */
function calcularBbox(d: string): Bbox {
  const tokens = d
    .trim()
    .split(/[\s,]+/)
    .filter((t) => t.length > 0 && !/^[a-zA-Z]+$/.test(t));
  let x = 0;
  let y = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    x += Number.parseFloat(tokens[i]!);
    y += Number.parseFloat(tokens[i + 1]!);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function areaBbox(b: Bbox): number {
  return (b.maxX - b.minX) * (b.maxY - b.minY);
}

function ariaLabelUf(nomeEstado: string, overview: VisaoGeralUf): string {
  if (overview.semDados || !overview.liderGovernador) {
    return `${nomeEstado}: sem pesquisas suficientes de governador nos últimos dias.`;
  }
  const pontos = formatarNumeroPt(overview.vantagem);
  const partido = overview.partido ?? 'sem partido';
  const sufixo = overview.empateTecnico ? ', empate técnico' : '';
  return `${nomeEstado}: ${overview.liderGovernador} (${partido}) lidera com ${pontos} pontos${sufixo}.`;
}

/** Renderiza o mapa do Brasil (governadores 2026) dentro de `container`. */
export function renderMap(container: HTMLElement, casos: CasosDeUso): void {
  container.innerHTML = '';

  const overviewLista = casos.getMapOverview();
  const overviewPorUf = new Map(overviewLista.map((o) => [o.uf, o]));

  // margemReferencia não vem no DTO do mapa (VisaoGeralUf) — busca-se o
  // agregado completo por UF só para refinar a opacidade em 3 faixas
  // (folga / corrida acirrada / empate), usando o mesmo caso de uso já
  // exposto para o painel do estado.
  const margemPorUf = new Map<string, number>();
  for (const o of overviewLista) {
    if (o.semDados) continue;
    const resumo = casos.getStateSummary(o.uf);
    if (resumo.governador) margemPorUf.set(o.uf, resumo.governador.margemReferencia);
  }

  const secao = document.createElement('section');
  secao.className = 'map-view';
  secao.setAttribute('aria-labelledby', 'map-view-heading');

  const heading = document.createElement('h2');
  heading.id = 'map-view-heading';
  heading.className = 'map-view__heading';
  heading.textContent = 'Governadores 2026 — quem lidera em cada estado';
  secao.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'map-view__intro';
  intro.textContent =
    'A cor do estado mostra o espectro do partido do candidato que lidera a média ponderada de pesquisas para governador; quanto mais clara/transparente, menor a confiança na liderança. Passe o mouse para uma prévia ou clique/Enter para abrir os detalhes.';
  secao.appendChild(intro);

  const layout = document.createElement('div');
  layout.className = 'map-view__layout';
  secao.appendChild(layout);

  const mapWrap = document.createElement('div');
  mapWrap.className = 'map-view__map-wrap';
  layout.appendChild(mapWrap);

  const tooltip = document.createElement('div');
  tooltip.className = 'map-tooltip';
  tooltip.id = 'map-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  mapWrap.appendChild(tooltip);

  function esconderTooltip(): void {
    tooltip.hidden = true;
  }

  function conteudoTooltip(uf: string): string {
    const overview = overviewPorUf.get(uf);
    const nome = NOME_POR_UF.get(uf) ?? uf;
    if (!overview || overview.semDados || !overview.liderGovernador) {
      return `<strong>${nome}</strong><span class="map-tooltip__sub">Sem dados suficientes</span>`;
    }
    const resumo = casos.getStateSummary(uf);
    const margem = margemPorUf.get(uf) ?? MARGEM_REFERENCIA_PADRAO;
    const nivel = nivelConfianca(overview.vantagem, margem, false);
    const ultima = resumo.governador?.ultimaPesquisa;
    const linhaInstituto = ultima
      ? `<span class="map-tooltip__meta">${ultima.instituto} · ${formatarData(
          ultima.dataFim ?? ultima.publicadoEm ?? ultima.dataInicio ?? '',
        )}</span>`
      : '';
    return `
      <strong>${nome}</strong>
      <span class="map-tooltip__lider">${overview.liderGovernador} <span class="map-tooltip__partido">(${overview.partido ?? 'sem partido'})</span></span>
      <span class="map-tooltip__vantagem">+${formatarNumeroPt(overview.vantagem)} pts — ${rotuloConfianca(nivel)}</span>
      ${linhaInstituto}
    `;
  }

  function posicionarTooltipPerto(x: number, y: number): void {
    const wrapRect = mapWrap.getBoundingClientRect();
    const offsetX = 14;
    const offsetY = 14;
    let left = x - wrapRect.left + offsetX;
    let top = y - wrapRect.top + offsetY;
    const maxLeft = wrapRect.width - 220;
    if (left > maxLeft) left = Math.max(0, x - wrapRect.left - 220 - offsetX);
    if (top > wrapRect.height - 90) top = Math.max(0, y - wrapRect.top - 90 - offsetY);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function mostrarTooltipMouse(uf: string, evento: PointerEvent): void {
    tooltip.innerHTML = conteudoTooltip(uf);
    tooltip.hidden = false;
    posicionarTooltipPerto(evento.clientX, evento.clientY);
  }

  function mostrarTooltipFoco(uf: string, alvo: SVGElement): void {
    tooltip.innerHTML = conteudoTooltip(uf);
    tooltip.hidden = false;
    const rect = alvo.getBoundingClientRect();
    posicionarTooltipPerto(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function abrirPainel(uf: string, origem: SVGElement): void {
    abrirPainelEstado({ uf, casos, elementoOrigem: origem });
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', brazilMap.viewBox);
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa do Brasil por estado');
  svg.setAttribute('focusable', 'false');

  const defs = document.createElementNS(SVG_NS, 'defs');
  const pattern = document.createElementNS(SVG_NS, 'pattern');
  pattern.setAttribute('id', 'mapa-hachura');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', '6');
  pattern.setAttribute('height', '6');
  pattern.setAttribute('patternTransform', 'rotate(45)');
  const linha = document.createElementNS(SVG_NS, 'line');
  linha.setAttribute('x1', '0');
  linha.setAttribute('y1', '0');
  linha.setAttribute('x2', '0');
  linha.setAttribute('y2', '6');
  linha.setAttribute('stroke', 'currentColor');
  linha.setAttribute('stroke-width', '3');
  pattern.appendChild(linha);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const grupoEstados = document.createElementNS(SVG_NS, 'g');
  grupoEstados.setAttribute('class', 'map-view__estados');
  svg.appendChild(grupoEstados);

  const grupoRotulos = document.createElementNS(SVG_NS, 'g');
  grupoRotulos.setAttribute('class', 'map-view__rotulos');
  grupoRotulos.setAttribute('aria-hidden', 'true');
  svg.appendChild(grupoRotulos);

  // Ordem geográfica aproximada N→S por latitude (cy do bbox) para a ordem de tabulação.
  const locaisOrdenados = [...brazilMap.locations].sort((a, b) => {
    const bA = calcularBbox(a.path);
    const bB = calcularBbox(b.path);
    return (bA.minY + bA.maxY) / 2 - (bB.minY + bB.maxY) / 2;
  });

  for (const loc of locaisOrdenados) {
    const uf = loc.id.toUpperCase();
    const overview = overviewPorUf.get(uf);
    const bbox = calcularBbox(loc.path);
    const area = areaBbox(bbox);
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;

    const nivel: NivelConfianca = overview
      ? nivelConfianca(overview.vantagem, margemPorUf.get(uf) ?? MARGEM_REFERENCIA_PADRAO, overview.semDados)
      : 'semDados';
    const espectro: Espectro = overview?.espectro ?? 'indefinido';

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', loc.path);
    path.setAttribute('class', 'map-uf');
    path.dataset.uf = uf;
    path.style.fill = corEspectro(espectro, nivel);
    path.style.opacity = opacidadeConfianca(nivel);
    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-haspopup', 'dialog');
    path.setAttribute('aria-label', ariaLabelUf(loc.name, overview ?? semDadosFallback(uf)));
    grupoEstados.appendChild(path);

    // Sobreposição de hachura: empate técnico (cor do espectro) ou sem dados (cinza neutro).
    if (nivel === 'empate' || nivel === 'semDados') {
      const overlay = document.createElementNS(SVG_NS, 'path');
      overlay.setAttribute('d', loc.path);
      overlay.setAttribute('fill', 'url(#mapa-hachura)');
      overlay.setAttribute('pointer-events', 'none');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.color =
        nivel === 'semDados' ? 'var(--color-text-tertiary)' : corEspectroSolido(espectro);
      grupoEstados.appendChild(overlay);
    }

    // Alvo de toque ampliado (invisível) para UFs pequenas — não é um tab-stop
    // extra: só encaminha os mesmos eventos do path, mantendo 1 parada de
    // tabulação por estado.
    let alvoInterativo: SVGElement = path;
    if (area < AREA_ALVO_AMPLIADO) {
      const alvo = document.createElementNS(SVG_NS, 'circle');
      alvo.setAttribute('cx', String(cx));
      alvo.setAttribute('cy', String(cy));
      alvo.setAttribute('r', '13');
      alvo.setAttribute('class', 'map-uf__alvo-toque');
      alvo.setAttribute('aria-hidden', 'true');
      alvo.setAttribute('tabindex', '-1');
      grupoEstados.appendChild(alvo);
      alvoInterativo = alvo;
    }

    for (const el of [path, alvoInterativo]) {
      el.addEventListener('pointerenter', (e) => mostrarTooltipMouse(uf, e as PointerEvent));
      el.addEventListener('pointermove', (e) => posicionarTooltipPerto((e as PointerEvent).clientX, (e as PointerEvent).clientY));
      el.addEventListener('pointerleave', esconderTooltip);
      el.addEventListener('click', () => abrirPainel(uf, path));
    }
    path.addEventListener('focus', () => mostrarTooltipFoco(uf, path));
    path.addEventListener('blur', esconderTooltip);
    path.addEventListener('keydown', (e) => {
      const evento = e as KeyboardEvent;
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        abrirPainel(uf, path);
      }
    });

    // Sigla centralizada — sempre nos estados maiores; escondida em telas
    // estreitas quando o estado é pequeno (CSS cuida da faixa de largura).
    const texto = document.createElementNS(SVG_NS, 'text');
    texto.setAttribute('x', String(cx));
    texto.setAttribute('y', String(cy));
    texto.setAttribute('class', 'uf-label');
    if (area < AREA_ESCONDER_SIGLA_ESTREITO) texto.classList.add('uf-label--pequena');
    texto.textContent = uf;
    grupoRotulos.appendChild(texto);
  }

  mapWrap.appendChild(svg);

  layout.appendChild(criarLegenda());
  container.appendChild(secao);
}

function semDadosFallback(uf: string): VisaoGeralUf {
  return {
    uf,
    liderGovernador: null,
    partido: null,
    espectro: 'indefinido',
    vantagem: 0,
    empateTecnico: false,
    semDados: true,
  };
}

function criarLegenda(): HTMLElement {
  const legenda = document.createElement('div');
  legenda.className = 'map-view__legend';
  legenda.setAttribute('aria-label', 'Legenda do mapa');

  const grupoEspectro = document.createElement('div');
  grupoEspectro.className = 'legend-grupo';
  const tituloEspectro = document.createElement('h3');
  tituloEspectro.className = 'legend-grupo__titulo';
  tituloEspectro.textContent = 'Espectro do partido líder';
  grupoEspectro.appendChild(tituloEspectro);
  const listaEspectro = document.createElement('ul');
  listaEspectro.className = 'legend-lista';
  for (const espectro of ESPECTROS_LEGENDA) {
    listaEspectro.appendChild(criarItemLegenda(corEspectro(espectro, 'solid'), rotuloEspectro(espectro)));
  }
  listaEspectro.appendChild(
    criarItemLegenda(corEspectro('indefinido', 'solid'), rotuloEspectro('indefinido')),
  );
  grupoEspectro.appendChild(listaEspectro);
  legenda.appendChild(grupoEspectro);

  const grupoConfianca = document.createElement('div');
  grupoConfianca.className = 'legend-grupo';
  const tituloConfianca = document.createElement('h3');
  tituloConfianca.className = 'legend-grupo__titulo';
  tituloConfianca.textContent = 'Confiança da liderança';
  grupoConfianca.appendChild(tituloConfianca);
  const listaConfianca = document.createElement('ul');
  listaConfianca.className = 'legend-lista';
  listaConfianca.appendChild(
    criarItemLegendaConfianca('var(--confidence-solid-opacity)', rotuloConfianca('solid'), false),
  );
  listaConfianca.appendChild(
    criarItemLegendaConfianca('var(--confidence-lean-opacity)', rotuloConfianca('lean'), false),
  );
  listaConfianca.appendChild(
    criarItemLegendaConfianca('var(--confidence-empate-opacity)', rotuloConfianca('empate'), true),
  );
  const semDadosItem = criarItemLegenda('var(--confidence-sem-dados-fill)', rotuloConfianca('semDados'));
  semDadosItem.querySelector('.legend-swatch')!.classList.add('legend-swatch--hachura');
  listaConfianca.appendChild(semDadosItem);
  grupoConfianca.appendChild(listaConfianca);
  legenda.appendChild(grupoConfianca);

  return legenda;
}

function criarItemLegenda(cor: string, rotulo: string): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'legend-item';
  const swatch = document.createElement('span');
  swatch.className = 'legend-swatch';
  swatch.style.background = cor;
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(swatch, texto);
  return item;
}

function criarItemLegendaConfianca(opacidade: string, rotulo: string, hachura: boolean): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'legend-item';
  const swatch = document.createElement('span');
  swatch.className = 'legend-swatch';
  swatch.style.background = 'var(--color-accent)';
  swatch.style.opacity = opacidade;
  if (hachura) swatch.classList.add('legend-swatch--hachura');
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(swatch, texto);
  return item;
}
