import '../styles/presidential-states.css';
import brazilMapDados from '@svg-maps/brazil';
import type { CasosDeUso, PresidencialPorEstado, PresidencialUf } from '../../../../application/use-cases/index.js';
import { MARGEM_REFERENCIA_PADRAO, type Agregado, type CandidatoAgregado } from '../../../../domain/aggregate.js';
import type { PontoSerieTemporal } from '../../../../domain/aggregate.js';
import type { Pesquisa } from '../../../../domain/poll.js';
import { espectroDoPartido } from '../../../../domain/spectrum.js';
import { nomeCurtissimo } from './candidate-names.js';
import {
  corEspectro,
  corEspectroSolido,
  formatarData,
  formatarNumeroPt,
  formatarPct,
  formatarVantagem,
  nivelConfianca,
  opacidadeConfianca,
  pluralizar,
  rotuloConfianca,
  rotuloEspectro,
  type NivelConfianca,
} from '../format.js';
import {
  calcularDominioY,
  calcularQuantis,
  caminhoSuavizado,
  classificarPorQuantil,
  escalaX,
  escalaY,
  formatarEleitorado,
  ordenarParaGrade,
  raioAmostra,
  rotuloVantagemMini,
  type DominioX,
  type PontoXY,
} from './presidential-states-layout.js';

/**
 * Tela "Presidente por estado": mapa do Brasil (líder presidencial por UF,
 * com modo alternativo por eleitorado) + grade de miniaturas de tendência
 * por estado, estilo NYT (docs/ux-spec.md, "Barra de qualidade"). Consome
 * apenas `casos.getPresidentialByState()` e `casos.listParties()`.
 *
 * Not owned by main.ts's router beyond the render entrypoint: o painel do
 * estado é anexado dentro do próprio `container` (não em `document.body`,
 * como o painel de governadores em state-panel.ts) para ser removido de
 * graça quando `main.ts` limpa `main.innerHTML` na próxima navegação — este
 * módulo não pode depender de um hook de `main.ts` que não é seu.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ver nota de tipagem em map-view.ts sobre por que este cast é necessário. */
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
const NOME_POR_UF = new Map(brazilMap.locations.map((loc) => [loc.id.toUpperCase(), loc.name]));

const AREA_ALVO_AMPLIADO = 3000;
const AREA_ESCONDER_SIGLA_ESTREITO = 6000;

const ESPECTROS_LEGENDA = ['esquerda', 'centro-esquerda', 'centro', 'centro-direita', 'direita'] as const;

interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Ver nota de implementação em map-view.ts (paths do @svg-maps/brazil só usam m/z relativos). */
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

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemFallback(uf: string): PresidencialUf {
  return {
    uf,
    eleitores: null,
    agregado: null,
    serie: null,
    lider: null,
    partido: null,
    vantagem: 0,
    empateTecnico: false,
    semDados: true,
    ultimaPesquisa: null,
  };
}

type ModoMapa = 'lideranca' | 'eleitorado';
type Partidos = ReturnType<CasosDeUso['listParties']>;

/** Renderiza a tela "Presidente por estado" dentro de `container` (o `<main>` da app). */
export function renderPresidentialStates(container: HTMLElement, casos: CasosDeUso): void {
  container.innerHTML = '';

  const dados = casos.getPresidentialByState();
  const partidos = casos.listParties();
  const ufPorSigla = new Map(dados.ufs.map((u) => [u.uf, u] as const));

  const raiz = document.createElement('section');
  raiz.className = 'ps-view';
  raiz.setAttribute('aria-labelledby', 'ps-titulo');

  raiz.appendChild(criarCabecalho(dados));

  let modo: ModoMapa = 'lideranca';

  const mapSection = document.createElement('section');
  mapSection.className = 'ps-map-section';
  mapSection.setAttribute('aria-labelledby', 'ps-map-heading');

  const mapHeading = document.createElement('h2');
  mapHeading.id = 'ps-map-heading';
  mapHeading.className = 'ps-sr-only';
  mapHeading.textContent = 'Mapa por estado';
  mapSection.appendChild(mapHeading);

  mapSection.appendChild(
    criarToggleModo((novoModo) => {
      modo = novoModo;
      redesenharMapa();
    }),
  );

  const mapLayout = document.createElement('div');
  mapLayout.className = 'ps-map-layout';
  mapSection.appendChild(mapLayout);

  const mapWrap = document.createElement('div');
  mapWrap.className = 'ps-map-wrap';
  mapLayout.appendChild(mapWrap);

  const legendWrap = document.createElement('div');
  mapLayout.appendChild(legendWrap);

  function redesenharMapa(): void {
    mapWrap.innerHTML = '';
    legendWrap.innerHTML = '';

    const tooltip = document.createElement('div');
    tooltip.className = 'ps-tooltip';
    tooltip.id = 'ps-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    mapWrap.appendChild(tooltip);

    mapWrap.appendChild(construirSvgMapa(modo, dados, ufPorSigla, partidos, tooltip, container));
    legendWrap.appendChild(modo === 'lideranca' ? criarLegendaLideranca() : criarLegendaEleitorado(dados));
  }
  redesenharMapa();

  raiz.appendChild(mapSection);
  raiz.appendChild(criarSecaoGrade(dados, partidos, container));

  container.appendChild(raiz);
}

function criarCabecalho(dados: PresidencialPorEstado): HTMLElement {
  const header = document.createElement('header');
  header.className = 'ps-header';

  const titulo = document.createElement('h1');
  titulo.id = 'ps-titulo';
  titulo.className = 'ps-title';
  titulo.textContent = 'Presidente por estado';
  header.appendChild(titulo);

  const metaEleitorado = document.createElement('p');
  metaEleitorado.className = 'ps-meta';
  if (dados.eleitoradoNacional != null && dados.eleitoradoNacional > 0) {
    const parcela = (dados.eleitoradoComPesquisa / dados.eleitoradoNacional) * 100;
    metaEleitorado.innerHTML = `Eleitorado nacional: <strong>${escaparHtml(
      formatarEleitorado(dados.eleitoradoNacional),
    )}</strong> de eleitores aptos. Pesquisa presidencial estadual cobre <strong>${escaparHtml(
      formatarPct(parcela),
    )}</strong> desse eleitorado.`;
  } else {
    metaEleitorado.textContent = 'Eleitorado nacional: dado ainda não cadastrado.';
  }
  header.appendChild(metaEleitorado);

  const intro = document.createElement('p');
  intro.className = 'ps-meta';
  intro.textContent =
    'A cor do mapa mostra o espectro do partido que lidera a média ponderada de pesquisas presidenciais (1º turno) de cada estado; a opacidade indica a confiança da liderança. Alterne para "Eleitorado" para ver o tamanho do colégio eleitoral por estado. Passe o mouse para uma prévia ou clique/Enter para abrir os detalhes.';
  header.appendChild(intro);

  return header;
}

function criarToggleModo(onChange: (modo: ModoMapa) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'ps-toggle-group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Modo do mapa');

  const opcoes: readonly { readonly modo: ModoMapa; readonly rotulo: string }[] = [
    { modo: 'lideranca', rotulo: 'Quem lidera' },
    { modo: 'eleitorado', rotulo: 'Eleitorado' },
  ];

  const botoes: HTMLButtonElement[] = [];
  for (const opcao of opcoes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps-toggle-btn';
    btn.textContent = opcao.rotulo;
    btn.setAttribute('aria-pressed', opcao.modo === 'lideranca' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      for (const b of botoes) b.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-pressed', 'true');
      onChange(opcao.modo);
    });
    botoes.push(btn);
    group.appendChild(btn);
  }
  return group;
}

function posicionarTooltipPerto(tooltip: HTMLElement, x: number, y: number): void {
  const offset = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const largura = tooltip.offsetWidth || 230;
  const altura = tooltip.offsetHeight || 110;

  let left = x + offset;
  if (left + largura > vw) left = x - offset - largura;
  left = Math.min(Math.max(0, left), Math.max(0, vw - largura));

  let top = y + offset;
  if (top + altura > vh) top = y - offset - altura;
  top = Math.min(Math.max(0, top), Math.max(0, vh - altura));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function conteudoTooltip(
  item: PresidencialUf,
  modo: ModoMapa,
  breakpointsEleitorado: readonly number[],
  partidos: Partidos,
): string {
  const nome = NOME_POR_UF.get(item.uf) ?? item.uf;
  const eleitoresTexto = item.eleitores != null ? formatarEleitorado(item.eleitores) : 'não cadastrado';

  if (item.semDados || !item.agregado || !item.lider) {
    return `
      <strong>${escaparHtml(nome)}</strong>
      <span class="ps-tooltip__sub">Sem pesquisa presidencial estadual</span>
      <span class="ps-tooltip__meta">Eleitores: ${escaparHtml(eleitoresTexto)}</span>
    `;
  }

  const nivel = nivelConfianca(item.vantagem, item.agregado.margemReferencia, false);
  const ultima = item.ultimaPesquisa;
  const dataUltima = ultima ? formatarData(ultima.dataFim ?? ultima.publicadoEm ?? ultima.dataInicio ?? '') : '—';
  const institutoUltima = ultima ? ultima.instituto : '—';
  const vantagemTexto = item.empateTecnico ? 'Empate técnico' : `${formatarVantagem(item.vantagem)} — ${rotuloConfianca(nivel)}`;

  const linhaClasse =
    modo === 'eleitorado' && item.eleitores != null
      ? `<span class="ps-tooltip__meta">Faixa do mapa: ${classificarPorQuantil(item.eleitores, breakpointsEleitorado) + 1} de 5</span>`
      : '';

  return `
    <strong>${escaparHtml(nome)}</strong>
    <span class="ps-tooltip__meta">Eleitores: ${escaparHtml(eleitoresTexto)}</span>
    <span class="ps-tooltip__lider">${escaparHtml(item.lider)} <span class="ps-tooltip__partido">(${escaparHtml(item.partido ?? 'sem partido')})</span></span>
    <span class="ps-tooltip__vantagem">${vantagemTexto}</span>
    <span class="ps-tooltip__meta">${escaparHtml(institutoUltima)} · ${dataUltima}</span>
    ${linhaClasse}
  `;
}

function ariaLabelLideranca(nomeEstado: string, item: PresidencialUf): string {
  if (item.semDados || !item.lider) {
    return `${nomeEstado}: sem pesquisa presidencial estadual suficiente.`;
  }
  const pontos = formatarNumeroPt(item.vantagem);
  const partido = item.partido ?? 'sem partido';
  const sufixo = item.empateTecnico ? ', empate técnico' : '';
  return `${nomeEstado}: ${item.lider} (${partido}) lidera com ${pontos} pontos${sufixo}.`;
}

function ariaLabelEleitorado(nomeEstado: string, item: PresidencialUf, breakpoints: readonly number[]): string {
  if (item.eleitores == null) return `${nomeEstado}: eleitorado não cadastrado.`;
  const classe = classificarPorQuantil(item.eleitores, breakpoints) + 1;
  return `${nomeEstado}: ${formatarEleitorado(item.eleitores)} de eleitores (faixa ${classe} de 5).`;
}

function construirSvgMapa(
  modo: ModoMapa,
  dados: PresidencialPorEstado,
  ufPorSigla: ReadonlyMap<string, PresidencialUf>,
  partidos: Partidos,
  tooltip: HTMLDivElement,
  hostElement: HTMLElement,
): SVGSVGElement {
  const valoresEleitorado = dados.ufs
    .map((u) => u.eleitores)
    .filter((v): v is number => v != null);
  const breakpointsEleitorado = calcularQuantis(valoresEleitorado, 5);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', brazilMap.viewBox);
  svg.setAttribute('class', 'ps-map-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    modo === 'lideranca'
      ? 'Mapa do Brasil: quem lidera as pesquisas presidenciais por estado'
      : 'Mapa do Brasil: eleitorado por estado',
  );
  svg.setAttribute('focusable', 'false');

  const defs = document.createElementNS(SVG_NS, 'defs');
  const pattern = document.createElementNS(SVG_NS, 'pattern');
  pattern.setAttribute('id', 'ps-mapa-hachura');
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
  svg.appendChild(grupoEstados);
  const grupoRotulos = document.createElementNS(SVG_NS, 'g');
  grupoRotulos.setAttribute('aria-hidden', 'true');
  svg.appendChild(grupoRotulos);

  const locaisOrdenados = [...brazilMap.locations].sort((a, b) => {
    const bA = calcularBbox(a.path);
    const bB = calcularBbox(b.path);
    return (bA.minY + bA.maxY) / 2 - (bB.minY + bB.maxY) / 2;
  });

  function esconderTooltip(): void {
    tooltip.hidden = true;
  }
  function mostrarTooltipMouse(item: PresidencialUf, evento: PointerEvent): void {
    tooltip.innerHTML = conteudoTooltip(item, modo, breakpointsEleitorado, partidos);
    tooltip.hidden = false;
    posicionarTooltipPerto(tooltip, evento.clientX, evento.clientY);
  }
  function mostrarTooltipFoco(item: PresidencialUf, alvo: SVGElement): void {
    tooltip.innerHTML = conteudoTooltip(item, modo, breakpointsEleitorado, partidos);
    tooltip.hidden = false;
    const rect = alvo.getBoundingClientRect();
    posicionarTooltipPerto(tooltip, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  for (const loc of locaisOrdenados) {
    const uf = loc.id.toUpperCase();
    const item = ufPorSigla.get(uf) ?? itemFallback(uf);
    const bbox = calcularBbox(loc.path);
    const area = areaBbox(bbox);
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', loc.path);
    path.setAttribute('class', 'ps-uf');
    path.dataset.uf = uf;

    let corOverlay: string | null = null;
    if (modo === 'lideranca') {
      const espectro = espectroDoPartido(item.partido, partidos);
      const margemReferencia = item.agregado?.margemReferencia ?? MARGEM_REFERENCIA_PADRAO;
      const nivel: NivelConfianca = nivelConfianca(item.vantagem, margemReferencia, item.semDados);
      path.style.fill = corEspectro(espectro, nivel);
      path.style.opacity = opacidadeConfianca(nivel);
      path.setAttribute('aria-label', ariaLabelLideranca(loc.name, item));
      if (nivel === 'empate') corOverlay = corEspectroSolido(espectro);
      else if (nivel === 'semDados') corOverlay = 'var(--color-text-tertiary)';
    } else {
      if (item.eleitores != null) {
        const classe = classificarPorQuantil(item.eleitores, breakpointsEleitorado);
        path.style.fill = `var(--ps-electorate-${classe + 1})`;
      } else {
        path.style.fill = 'var(--confidence-sem-dados-fill)';
        corOverlay = 'var(--color-text-tertiary)';
      }
      path.style.opacity = '1';
      path.setAttribute('aria-label', ariaLabelEleitorado(loc.name, item, breakpointsEleitorado));
    }

    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-haspopup', 'dialog');
    grupoEstados.appendChild(path);

    if (corOverlay) {
      const overlay = document.createElementNS(SVG_NS, 'path');
      overlay.setAttribute('d', loc.path);
      overlay.setAttribute('fill', 'url(#ps-mapa-hachura)');
      overlay.setAttribute('pointer-events', 'none');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.color = corOverlay;
      grupoEstados.appendChild(overlay);
    }

    let alvoInterativo: SVGElement = path;
    if (area < AREA_ALVO_AMPLIADO) {
      const alvo = document.createElementNS(SVG_NS, 'circle');
      alvo.setAttribute('cx', String(cx));
      alvo.setAttribute('cy', String(cy));
      alvo.setAttribute('r', '13');
      alvo.setAttribute('class', 'ps-uf__alvo-toque');
      alvo.setAttribute('aria-hidden', 'true');
      alvo.setAttribute('tabindex', '-1');
      grupoEstados.appendChild(alvo);
      alvoInterativo = alvo;
    }

    const abrir = (): void => abrirPainelUf(item, loc.name, path, hostElement, partidos);

    for (const el of [path, alvoInterativo]) {
      el.addEventListener('pointerenter', (e) => mostrarTooltipMouse(item, e as PointerEvent));
      el.addEventListener('pointermove', (e) =>
        posicionarTooltipPerto(tooltip, (e as PointerEvent).clientX, (e as PointerEvent).clientY),
      );
      el.addEventListener('pointerleave', esconderTooltip);
      el.addEventListener('click', abrir);
    }
    path.addEventListener('focus', () => mostrarTooltipFoco(item, path));
    path.addEventListener('blur', esconderTooltip);
    path.addEventListener('keydown', (e) => {
      const evento = e as KeyboardEvent;
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        abrir();
      }
    });

    const texto = document.createElementNS(SVG_NS, 'text');
    texto.setAttribute('x', String(cx));
    texto.setAttribute('y', String(cy));
    texto.setAttribute('class', 'ps-uf-label');
    if (area < AREA_ESCONDER_SIGLA_ESTREITO) texto.classList.add('ps-uf-label--pequena');
    texto.textContent = uf;
    grupoRotulos.appendChild(texto);
  }

  return svg;
}

function criarItemLegenda(cor: string, rotulo: string, hachura = false): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const swatch = document.createElement('span');
  swatch.className = 'ps-legend-swatch' + (hachura ? ' ps-legend-swatch--hachura' : '');
  swatch.style.background = cor;
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(swatch, texto);
  return item;
}

function criarItemLegendaConfianca(opacidade: string, rotulo: string, hachura: boolean): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const swatch = document.createElement('span');
  swatch.className = 'ps-legend-swatch';
  swatch.style.background = 'var(--color-accent)';
  swatch.style.opacity = opacidade;
  if (hachura) swatch.classList.add('ps-legend-swatch--hachura');
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(swatch, texto);
  return item;
}

function criarLegendaLideranca(): HTMLElement {
  const legenda = document.createElement('div');
  legenda.className = 'ps-legend';
  legenda.setAttribute('aria-label', 'Legenda do mapa — quem lidera');

  const grupoEspectro = document.createElement('div');
  grupoEspectro.className = 'ps-legend-grupo';
  const tituloEspectro = document.createElement('h3');
  tituloEspectro.className = 'ps-legend-grupo__titulo';
  tituloEspectro.textContent = 'Espectro do partido líder';
  grupoEspectro.appendChild(tituloEspectro);
  const listaEspectro = document.createElement('ul');
  listaEspectro.className = 'ps-legend-lista';
  for (const espectro of ESPECTROS_LEGENDA) {
    listaEspectro.appendChild(criarItemLegenda(corEspectro(espectro, 'solid'), rotuloEspectro(espectro)));
  }
  listaEspectro.appendChild(criarItemLegenda(corEspectro('indefinido', 'solid'), rotuloEspectro('indefinido')));
  grupoEspectro.appendChild(listaEspectro);
  legenda.appendChild(grupoEspectro);

  const grupoConfianca = document.createElement('div');
  grupoConfianca.className = 'ps-legend-grupo';
  const tituloConfianca = document.createElement('h3');
  tituloConfianca.className = 'ps-legend-grupo__titulo';
  tituloConfianca.textContent = 'Confiança da liderança';
  grupoConfianca.appendChild(tituloConfianca);
  const listaConfianca = document.createElement('ul');
  listaConfianca.className = 'ps-legend-lista';
  listaConfianca.appendChild(
    criarItemLegendaConfianca('var(--confidence-solid-opacity)', rotuloConfianca('solid'), false),
  );
  listaConfianca.appendChild(
    criarItemLegendaConfianca('var(--confidence-lean-opacity)', rotuloConfianca('lean'), false),
  );
  listaConfianca.appendChild(
    criarItemLegendaConfianca('var(--confidence-empate-opacity)', rotuloConfianca('empate'), true),
  );
  listaConfianca.appendChild(criarItemLegenda('var(--confidence-sem-dados-fill)', rotuloConfianca('semDados'), true));
  grupoConfianca.appendChild(listaConfianca);
  legenda.appendChild(grupoConfianca);

  return legenda;
}

function criarLegendaEleitorado(dados: PresidencialPorEstado): HTMLElement {
  const legenda = document.createElement('div');
  legenda.className = 'ps-legend';
  legenda.setAttribute('aria-label', 'Legenda do mapa — eleitorado');

  const valores = dados.ufs
    .map((u) => u.eleitores)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const breakpoints = calcularQuantis(valores, 5);

  const grupo = document.createElement('div');
  grupo.className = 'ps-legend-grupo';
  const titulo = document.createElement('h3');
  titulo.className = 'ps-legend-grupo__titulo';
  titulo.textContent = 'Eleitores por estado (5 faixas por quantil)';
  grupo.appendChild(titulo);

  const lista = document.createElement('ul');
  lista.className = 'ps-legend-lista';

  if (valores.length > 0) {
    const limites = [valores[0]!, ...breakpoints, valores[valores.length - 1]!];
    for (let i = 0; i < 5; i++) {
      const min = limites[i]!;
      const max = limites[i + 1]!;
      const rotulo = i === 0 ? `até ${formatarEleitorado(max)}` : `${formatarEleitorado(min)} – ${formatarEleitorado(max)}`;
      lista.appendChild(criarItemLegenda(`var(--ps-electorate-${i + 1})`, rotulo));
    }
  }

  if (dados.ufs.some((u) => u.eleitores == null)) {
    lista.appendChild(criarItemLegenda('var(--confidence-sem-dados-fill)', 'Eleitorado não cadastrado', true));
  }

  grupo.appendChild(lista);
  legenda.appendChild(grupo);
  return legenda;
}

/* ================= Grade de miniaturas (estilo NYT) ================= */

const MINI_W = 240;
const MINI_H = 90;
const MINI_PAD_TOP = 10;
const MINI_PAD_BOTTOM = 16;
const MINI_PAD_RIGHT = 32;
const MINI_PLOT_W = MINI_W - MINI_PAD_RIGHT;
const MINI_PLOT_H = MINI_H - MINI_PAD_TOP - MINI_PAD_BOTTOM;

function criarSecaoGrade(dados: PresidencialPorEstado, partidos: Partidos, hostElement: HTMLElement): HTMLElement {
  const secao = document.createElement('section');
  secao.className = 'ps-grid-section';
  secao.setAttribute('aria-labelledby', 'ps-grid-heading');

  const heading = document.createElement('h2');
  heading.id = 'ps-grid-heading';
  heading.className = 'ps-section-title';
  heading.textContent = 'Tendência por estado';
  secao.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'ps-meta';
  intro.textContent =
    'Ordenado pelo tamanho do eleitorado (maior primeiro); estados sem pesquisa presidencial estadual aparecem ao final.';
  secao.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'ps-grid';
  for (const item of ordenarParaGrade(dados.ufs)) {
    grid.appendChild(criarCardMiniatura(item, partidos, hostElement));
  }
  secao.appendChild(grid);

  return secao;
}

function criarCardMiniatura(item: PresidencialUf, partidos: Partidos, hostElement: HTMLElement): HTMLElement {
  const nome = NOME_POR_UF.get(item.uf) ?? item.uf;
  const eleitoresTexto = item.eleitores != null ? `${formatarEleitorado(item.eleitores)} de eleitores` : 'Eleitorado não cadastrado';

  if (item.semDados || !item.agregado || !item.serie || !item.agregado.lider) {
    const card = document.createElement('div');
    card.className = 'ps-card ps-card--vazio';
    card.innerHTML = `
      <p class="ps-card__titulo"><span class="ps-card__uf">${escaparHtml(nome)}</span></p>
      <p class="ps-card__eleitores">${escaparHtml(eleitoresTexto)}</p>
      <div class="ps-mini-chart-placeholder">Sem pesquisa estadual</div>
    `;
    return card;
  }

  // Título visível usa o apelido "curtíssimo" (ex.: "Flávio", não "Flávio
  // Bolsonaro") — a miniatura tem menos espaço que o gráfico grande; o nome
  // completo continua acessível via `title` (tooltip nativo) e aria-label.
  const rotuloVisivel = rotuloVantagemMini(
    item.lider ? nomeCurtissimo(item.lider) : null,
    item.vantagem,
    item.empateTecnico,
  );
  const rotuloCompleto = rotuloVantagemMini(item.lider, item.vantagem, item.empateTecnico);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ps-card';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute(
    'aria-label',
    `${nome}: ${rotuloCompleto}. ${eleitoresTexto}. Abrir detalhes das pesquisas presidenciais do estado.`,
  );

  const titulo = document.createElement('p');
  titulo.className = 'ps-card__titulo';
  titulo.innerHTML = `<span class="ps-card__uf">${escaparHtml(nome)}</span><span class="ps-card__separador" aria-hidden="true">›</span><span class="ps-card__vantagem" title="${escaparHtml(rotuloCompleto)}">${escaparHtml(rotuloVisivel)}</span>`;
  btn.appendChild(titulo);

  const eleitoresP = document.createElement('p');
  eleitoresP.className = 'ps-card__eleitores';
  eleitoresP.textContent = eleitoresTexto;
  btn.appendChild(eleitoresP);

  btn.appendChild(construirMiniGrafico(item.agregado, item.serie.pontos, partidos));

  btn.addEventListener('click', () => abrirPainelUf(item, nome, btn, hostElement, partidos));

  return btn;
}

function descricaoAcessivelMiniGrafico(candidatos: readonly CandidatoAgregado[]): string {
  const partes = candidatos.map((c) => `${c.candidato} ${formatarPct(c.pct, 0)}`);
  return `Gráfico de tendência das pesquisas presidenciais estaduais ao longo do tempo: ${partes.join(', ')} na média atual.`;
}

/**
 * Mini-gráfico de tendência (estilo NYT): pontos individuais de cada
 * pesquisa (raio pela amostra, opacidade 0,35) e uma linha suavizada por
 * candidato (2 primeiros do agregado) que termina no valor atual da média
 * ponderada, rotulado no fim. Sem eixos, exceto a linha de base em 50% (o
 * limiar de empate técnico) e seu rótulo. Com apenas 1 pesquisa no
 * agregado, mostra só os pontos, sem linha (nada para suavizar/tender).
 */
function construirMiniGrafico(
  agregado: Agregado,
  pontosSerie: readonly PontoSerieTemporal[],
  partidos: Partidos,
): SVGSVGElement {
  const candidatos = agregado.candidatos.slice(0, 2);
  const multiplasPesquisas = agregado.pesquisasUsadas.length > 1;

  const pontosPorCandidato = candidatos.map((c) =>
    pontosSerie.filter((p) => p.candidato === c.candidato).sort((a, b) => a.data.localeCompare(b.data)),
  );

  const todasDatas = pontosPorCandidato.flat().map((p) => p.data);
  const dominioX: DominioX =
    todasDatas.length > 0
      ? {
          minIso: todasDatas.reduce((m, d) => (d < m ? d : m)),
          maxIso: todasDatas.reduce((m, d) => (d > m ? d : m)),
        }
      : { minIso: '2000-01-01', maxIso: '2000-01-01' };

  const todosPct = [...pontosPorCandidato.flat().map((p) => p.pct), ...candidatos.map((c) => c.pct)];
  const dominioY = calcularDominioY(todosPct);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MINI_W} ${MINI_H}`);
  svg.setAttribute('class', 'ps-mini-chart');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', descricaoAcessivelMiniGrafico(candidatos));

  const yBase = MINI_PAD_TOP + escalaY(50, dominioY, MINI_PLOT_H);
  const baseline = document.createElementNS(SVG_NS, 'line');
  baseline.setAttribute('x1', '0');
  baseline.setAttribute('x2', String(MINI_PLOT_W));
  baseline.setAttribute('y1', String(yBase));
  baseline.setAttribute('y2', String(yBase));
  baseline.setAttribute('class', 'ps-mini-chart__baseline');
  svg.appendChild(baseline);

  const baselineLabel = document.createElementNS(SVG_NS, 'text');
  baselineLabel.setAttribute('x', String(MINI_PLOT_W + 3));
  baselineLabel.setAttribute('y', String(yBase + 3));
  baselineLabel.setAttribute('class', 'ps-mini-chart__baseline-label');
  baselineLabel.textContent = '50%';
  svg.appendChild(baselineLabel);

  // Posição final (valor atual da média ponderada) de cada candidato,
  // ajustada para os rótulos nunca colidirem quando as duas linhas terminam
  // muito próximas (ver dataviz SKILL.md, "quando rótulos de fim colidem").
  const finaisY = candidatos.map((c) => MINI_PAD_TOP + escalaY(c.pct, dominioY, MINI_PLOT_H));
  const rotuloYs = [...finaisY];
  if (rotuloYs.length === 2 && Math.abs(rotuloYs[0]! - rotuloYs[1]!) < 12) {
    const mid = (rotuloYs[0]! + rotuloYs[1]!) / 2;
    if (rotuloYs[0]! <= rotuloYs[1]!) {
      rotuloYs[0] = mid - 6;
      rotuloYs[1] = mid + 6;
    } else {
      rotuloYs[0] = mid + 6;
      rotuloYs[1] = mid - 6;
    }
  }

  candidatos.forEach((candidato, i) => {
    const espectro = espectroDoPartido(candidato.partido, partidos);
    const cor = corEspectroSolido(espectro);
    const pontos = pontosPorCandidato[i]!;

    const coordsHistoricos: PontoXY[] = pontos.map((p) => ({
      x: escalaX(p.data, dominioX, MINI_PLOT_W),
      y: MINI_PAD_TOP + escalaY(p.pct, dominioY, MINI_PLOT_H),
    }));

    for (let j = 0; j < pontos.length; j++) {
      const p = pontos[j]!;
      const coord = coordsHistoricos[j]!;
      const circulo = document.createElementNS(SVG_NS, 'circle');
      circulo.setAttribute('cx', String(coord.x));
      circulo.setAttribute('cy', String(coord.y));
      circulo.setAttribute('r', String(raioAmostra(p.amostra)));
      circulo.setAttribute('fill', cor);
      circulo.setAttribute('class', 'ps-mini-chart__ponto');
      svg.appendChild(circulo);
    }

    const finalCoord: PontoXY = { x: MINI_PLOT_W, y: finaisY[i]! };
    if (multiplasPesquisas) {
      const coordsLinha = coordsHistoricos.length > 0 ? [...coordsHistoricos, finalCoord] : [finalCoord];
      const d = caminhoSuavizado(coordsLinha);
      if (d) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'ps-mini-chart__line');
        path.setAttribute('stroke', cor);
        svg.appendChild(path);
      }
    }

    const marcador = document.createElementNS(SVG_NS, 'circle');
    marcador.setAttribute('cx', String(finalCoord.x));
    marcador.setAttribute('cy', String(finalCoord.y));
    marcador.setAttribute('r', '4');
    marcador.setAttribute('fill', cor);
    marcador.setAttribute('class', 'ps-mini-chart__ponto-final');
    svg.appendChild(marcador);

    const rotuloY = Math.min(MINI_H - 4, Math.max(MINI_PAD_TOP, rotuloYs[i]!));
    const rotulo = document.createElementNS(SVG_NS, 'text');
    rotulo.setAttribute('x', String(finalCoord.x + 5));
    rotulo.setAttribute('y', String(rotuloY + 3));
    rotulo.setAttribute('class', 'ps-mini-chart__rotulo');
    rotulo.textContent = formatarPct(candidato.pct, 0);
    svg.appendChild(rotulo);
  });

  return svg;
}

/* ================= Painel/drawer do estado (candidatos + pesquisas) ================= */

let psBackdropAtual: HTMLElement | null = null;
let psOrigemAtual: HTMLElement | SVGElement | null = null;

function psFocar(el: HTMLElement | SVGElement | null): void {
  if (el && typeof (el as { focus?: () => void }).focus === 'function') {
    (el as { focus: () => void }).focus();
  }
}

function psTrapFoco(e: KeyboardEvent, painel: HTMLElement): void {
  const focaveis = Array.from(
    painel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
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

function psAoTeclar(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    fecharPainelUf();
    return;
  }
  if (e.key === 'Tab' && psBackdropAtual) {
    const painel = psBackdropAtual.querySelector<HTMLElement>('.ps-panel');
    if (painel) psTrapFoco(e, painel);
  }
}

function psAoMudarHash(): void {
  fecharPainelUf();
}

/**
 * Fecha o painel do estado, se houver um aberto, e devolve o foco à
 * origem. Exportada para permitir fechamento explícito por quem monta a
 * tela; também é chamada automaticamente na próxima navegação por hash
 * (o painel é filho do `<main>`, então também some se `main.ts` limpar seu
 * conteúdo antes disso — este listener cobre o caso de o usuário nunca
 * fechar e apenas trocar de rota).
 */
export function fecharPainelUf(): void {
  if (!psBackdropAtual) return;
  document.removeEventListener('keydown', psAoTeclar);
  window.removeEventListener('hashchange', psAoMudarHash);
  psBackdropAtual.remove();
  psBackdropAtual = null;
  psFocar(psOrigemAtual);
  psOrigemAtual = null;
}

function abrirPainelUf(
  item: PresidencialUf,
  nomeEstado: string,
  origem: HTMLElement | SVGElement,
  hostElement: HTMLElement,
  partidos: Partidos,
): void {
  fecharPainelUf();

  const backdrop = document.createElement('div');
  backdrop.className = 'ps-panel-backdrop';
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) fecharPainelUf();
  });

  const painel = document.createElement('div');
  painel.className = 'ps-panel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-modal', 'true');
  painel.setAttribute('aria-labelledby', 'ps-panel-titulo');
  painel.innerHTML = psMontarConteudo(item, nomeEstado, partidos);

  backdrop.appendChild(painel);
  hostElement.appendChild(backdrop);

  psBackdropAtual = backdrop;
  psOrigemAtual = origem;

  painel.querySelector('.ps-panel__fechar')?.addEventListener('click', () => fecharPainelUf());
  document.addEventListener('keydown', psAoTeclar);
  window.addEventListener('hashchange', psAoMudarHash, { once: true });

  psFocar(painel.querySelector<HTMLElement>('.ps-panel__fechar'));
}

function psMontarConteudo(item: PresidencialUf, nomeEstado: string, partidos: Partidos): string {
  const eleitoresTexto =
    item.eleitores != null ? `${formatarEleitorado(item.eleitores)} de eleitores aptos` : 'Eleitorado não cadastrado';

  return `
    <div class="ps-panel__handle" aria-hidden="true"></div>
    <header class="ps-panel__header">
      <div>
        <h2 id="ps-panel-titulo" class="ps-panel__titulo">${escaparHtml(nomeEstado)} <span class="ps-panel__uf">(${item.uf})</span></h2>
        <p class="ps-panel__eleitores">${escaparHtml(eleitoresTexto)}</p>
      </div>
      <button type="button" class="ps-panel__fechar" aria-label="Fechar painel">
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <div class="ps-panel__corpo">
      ${psRenderSecao(item, partidos)}
    </div>
    <footer class="ps-panel__footer">
      ${psRenderRodape(item)}
    </footer>
  `;
}

function psRenderSecao(item: PresidencialUf, partidos: Partidos): string {
  const agregado = item.agregado;
  if (!agregado || !agregado.lider) {
    return `
      <section class="ps-panel__secao">
        <p class="ps-panel__vazio">Sem pesquisas presidenciais suficientes para ${escaparHtml(item.uf)} nesta janela.</p>
      </section>
    `;
  }

  const espectroLider = espectroDoPartido(agregado.lider.partido, partidos);
  const nivel = nivelConfianca(agregado.vantagem, agregado.margemReferencia, false);
  const badgeLider = `<span class="badge" style="background:${corEspectroSolido(espectroLider)}">${escaparHtml(
    agregado.lider.partido ?? 'S/PARTIDO',
  )}</span>`;
  const seloEmpate = agregado.empateTecnico
    ? '<span class="pill pill--empate">EMPATE TÉCNICO</span>'
    : `<span class="pill pill--confianca">${rotuloConfianca(nivel)}</span>`;

  const maxPct = Math.max(...agregado.candidatos.map((c) => c.pct), 1);
  const listaCandidatos = agregado.candidatos
    .slice(0, 6)
    .map((c) => psRenderBarraCandidato(c, maxPct, agregado.margemReferencia, partidos))
    .join('');

  const listaNaoRankeados = agregado.outros.length
    ? `<p class="ps-panel__vazio">Outros (brancos/nulos/não sabe): ${agregado.outros
        .map((o) => `${escaparHtml(o.candidato)} ${formatarPct(o.pct)}`)
        .join(', ')}</p>`
    : '';

  return `
    <section class="ps-panel__secao">
      <div class="ps-panel__lider">
        <span class="ps-panel__lider-nome">${escaparHtml(agregado.lider.candidato)}</span>
        ${badgeLider}
        <span class="ps-panel__vantagem">${formatarVantagem(agregado.vantagem)}</span>
        ${seloEmpate}
      </div>
      <ul class="ps-bar-list">${listaCandidatos}</ul>
      <p class="ps-bar-list__legenda">
        <span class="ps-bar-list__legenda-swatch" aria-hidden="true"></span>
        Faixa = margem de erro (± ${formatarNumeroPt(agregado.margemReferencia)} pontos)
      </p>
      ${listaNaoRankeados}
      ${psRenderListaPesquisas(agregado)}
    </section>
  `;
}

function psRenderBarraCandidato(
  c: CandidatoAgregado,
  maxPct: number,
  margemReferencia: number,
  partidos: Partidos,
): string {
  const espectro = espectroDoPartido(c.partido, partidos);
  const cor = corEspectroSolido(espectro);
  const largura = Math.max(2, (c.pct / maxPct) * 100);
  const faixaEsquerda = Math.max(0, ((c.pct - margemReferencia) / maxPct) * 100);
  const faixaDireita = Math.min(100, ((c.pct + margemReferencia) / maxPct) * 100);
  const faixaLargura = Math.max(0, faixaDireita - faixaEsquerda);
  const rotuloCompleto = c.partido ? `${c.candidato} (${c.partido})` : c.candidato;
  const badgePartido = c.partido
    ? `<span class="badge ps-bar-row__badge" style="background:${cor}">${escaparHtml(c.partido)}</span>`
    : '';
  return `
    <li class="ps-bar-row">
      <span class="ps-bar-row__info">
        <span class="ps-bar-row__nome" title="${escaparHtml(rotuloCompleto)}">${escaparHtml(c.candidato)}</span>
        ${badgePartido}
      </span>
      <span class="ps-bar-track" role="presentation">
        <span
          class="ps-bar-uncertainty"
          aria-hidden="true"
          style="left:${faixaEsquerda}%; width:${faixaLargura}%; background:${cor}"
        ></span>
        <span class="ps-bar-fill" style="width:${largura}%; background:${cor}"></span>
      </span>
      <span class="ps-bar-row__pct">${formatarPct(c.pct)}</span>
    </li>
  `;
}

function psRenderListaPesquisas(agregado: Agregado): string {
  const linhas = agregado.pesquisasUsadas
    .slice()
    .sort((a, b) => (b.dataFim ?? b.publicadoEm ?? '').localeCompare(a.dataFim ?? a.publicadoEm ?? ''))
    .map((p) => psRenderPesquisa(p))
    .join('');

  const n = agregado.pesquisasUsadas.length;
  const artigo = pluralizar(n, 'a', 'as');
  const substantivo = pluralizar(n, 'pesquisa', 'pesquisas');
  const participio = pluralizar(n, 'usada', 'usadas');

  return `
    <details class="ps-poll-list">
      <summary>Ver ${artigo} ${n} ${substantivo} ${participio}</summary>
      <ul class="ps-poll-list__itens">${linhas}</ul>
    </details>
  `;
}

function psRenderPesquisa(p: Pesquisa): string {
  const periodo =
    p.dataInicio && p.dataFim
      ? `${formatarData(p.dataInicio)}–${formatarData(p.dataFim)}`
      : formatarData(p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '');
  const registro = p.registroTSE.naoRegistrada
    ? '<span class="ps-poll-item__sem-registro" title="Registro TSE não localizado na fonte">registro TSE não localizado ⚠</span>'
    : `registro TSE ${escaparHtml(p.registroTSE.valor)}`;
  const amostra = p.amostra != null ? `amostra ${p.amostra.toLocaleString('pt-BR')}` : 'amostra não informada';
  const margem = p.margem != null ? `margem ± ${formatarNumeroPt(p.margem)} pontos` : 'margem não informada';
  const contratante = p.contratante
    ? ` <span class="ps-poll-item__contratante">(contratante: ${escaparHtml(p.contratante)})</span>`
    : '';

  return `
    <li class="ps-poll-item">
      <p class="ps-poll-item__linha1">
        <strong>${escaparHtml(p.instituto)}</strong>${contratante} · ${periodo}
      </p>
      <p class="ps-poll-item__linha2">
        <span class="tabular-nums">${amostra}</span> · <span class="tabular-nums">${margem}</span> · ${registro}
      </p>
      <p class="ps-poll-item__linha3">
        <a href="${escaparHtml(p.fonte.url)}" target="_blank" rel="noopener noreferrer">
          Fonte: ${escaparHtml(p.fonte.nome)} <span class="sr-only">(abre em nova aba)</span>
        </a>
      </p>
    </li>
  `;
}

function psRenderRodape(item: PresidencialUf): string {
  if (!item.ultimaPesquisa) {
    return '<p>Nenhuma pesquisa presidencial estadual disponível para esta UF.</p>';
  }
  const data = item.ultimaPesquisa.dataFim ?? item.ultimaPesquisa.publicadoEm ?? item.ultimaPesquisa.dataInicio ?? '';
  return `
    <p class="ps-panel__ultima">Última pesquisa em ${formatarData(data)}.</p>
    <p class="ps-panel__metodologia">Média ponderada por recência e tamanho de amostra. <a href="#/presidente">Como calculamos</a>.</p>
  `;
}
