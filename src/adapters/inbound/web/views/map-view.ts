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

/** Backdrop do painel/drawer (state-panel.ts) já segue este padrão de módulo:
 * guarda o "desfazer" do listener global da renderização anterior para
 * remover antes de registrar um novo, evitando empilhar listeners em
 * `document`/`window` a cada navegação de volta para `#/mapa`. */
let desligarOuvinteToqueFora: (() => void) | null = null;
let desligarOuvinteResize: (() => void) | null = null;

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

/**
 * Marcador textual curto para os dois espectros adjacentes mais difíceis de
 * distinguir por matiz para daltonismo vermelho-verde (`esquerda` #eb5757 vs.
 * `centro-esquerda` #c1707a — ver docs/revisao-mapa.md P2 #5). Reforço
 * puramente textual ao lado da sigla da UF no próprio mapa (não só no
 * `aria-label`/legenda, que já eram textuais) — não altera nenhum token de
 * cor, só acrescenta um rótulo visível.
 */
const MARCADOR_ESPECTRO: Partial<Record<Espectro, string>> = {
  esquerda: 'E',
  'centro-esquerda': 'CE',
};

/** Abaixo desta largura de viewport o mapa não fica com altura limitada — continua em largura total. */
const LARGURA_MIN_LIMITAR_ALTURA = 1024;

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
  desligarOuvinteToqueFora?.();
  desligarOuvinteToqueFora = null;
  desligarOuvinteResize?.();
  desligarOuvinteResize = null;

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
  // Conectado ao documento já aqui (em vez de só no final) para que
  // `ajustarAlturaMapa` (P0 — ver abaixo) consiga medir posições reais via
  // `getBoundingClientRect()` assim que o wrapper do mapa existir.
  container.appendChild(secao);

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

  // UF cujo tooltip-prévia está fixado por toque (mobile) — `null` quando
  // nenhum está fixado ou estamos em fluxo de mouse/teclado. Ver
  // `aoInteragirComEstado` e docs/ux-spec.md §1 princípio 4 (P1 #1 de
  // docs/revisao-mapa.md: no mobile o 1º toque só fixa a prévia; só o 2º
  // toque no MESMO estado abre o painel completo).
  let ufTooltipFixado: string | null = null;
  // Elemento com `aria-describedby="map-tooltip"` no momento — associação
  // dinâmica, só enquanto o tooltip está de fato visível para aquele
  // elemento (P2 #2 de docs/revisao-mapa.md: `role="tooltip"` sem nenhum
  // path referenciando-o via `aria-describedby`).
  let elementoDescrito: SVGElement | null = null;

  function esconderTooltip(): void {
    tooltip.hidden = true;
    if (elementoDescrito) {
      elementoDescrito.removeAttribute('aria-describedby');
      elementoDescrito = null;
    }
  }

  function marcarDescricaoTooltip(alvo: SVGElement): void {
    if (elementoDescrito && elementoDescrito !== alvo) elementoDescrito.removeAttribute('aria-describedby');
    alvo.setAttribute('aria-describedby', 'map-tooltip');
    elementoDescrito = alvo;
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
    const nPesquisas = resumo.governador?.pesquisasUsadas.length ?? 0;
    const rotuloPesquisas = nPesquisas === 1 ? '1 pesquisa' : `${nPesquisas} pesquisas`;
    const linhaInstituto = ultima
      ? `<span class="map-tooltip__meta">${ultima.instituto} · ${formatarData(
          ultima.dataFim ?? ultima.publicadoEm ?? ultima.dataInicio ?? '',
        )} · ${rotuloPesquisas}</span>`
      : '';
    return `
      <strong>${nome}</strong>
      <span class="map-tooltip__lider">${overview.liderGovernador} <span class="map-tooltip__partido">(${overview.partido ?? 'sem partido'})</span></span>
      <span class="map-tooltip__vantagem">+${formatarNumeroPt(overview.vantagem)} pts — ${rotuloConfianca(nivel)}</span>
      ${linhaInstituto}
    `;
  }

  /**
   * Posiciona o tooltip (`position: fixed`) usando coordenadas de viewport
   * (`x`/`y` já vêm como `clientX`/`clientY` ou de `getBoundingClientRect()`
   * — nunca coordenadas relativas ao wrapper do mapa). Faz flip para
   * cima/baixo e esquerda/direita conforme o espaço, e depois clampa contra
   * `window.innerWidth`/`innerHeight` para garantir que o tooltip fique
   * inteiramente dentro da janela visível — nunca só dentro do SVG do mapa,
   * que é mais alto que a tela em muitas resoluções (ver docs/critica-ui-rodada2.md
   * item 1).
   */
  function posicionarTooltipPerto(x: number, y: number): void {
    const offset = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // offsetWidth/offsetHeight só existem com layout real (não em jsdom);
    // usa um tamanho aproximado do `max-width` do CSS como fallback.
    const largura = tooltip.offsetWidth || 220;
    const altura = tooltip.offsetHeight || 90;

    let left = x + offset;
    if (left + largura > vw) left = x - offset - largura; // flip: esquerda do cursor
    left = Math.min(Math.max(0, left), Math.max(0, vw - largura));

    let top = y + offset;
    if (top + altura > vh) top = y - offset - altura; // flip: acima do cursor
    top = Math.min(Math.max(0, top), Math.max(0, vh - altura));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function mostrarTooltipMouse(uf: string, pathAcessivel: SVGElement, evento: PointerEvent): void {
    tooltip.innerHTML = conteudoTooltip(uf);
    tooltip.hidden = false;
    marcarDescricaoTooltip(pathAcessivel);
    posicionarTooltipPerto(evento.clientX, evento.clientY);
  }

  function mostrarTooltipFoco(uf: string, alvo: SVGElement): void {
    tooltip.innerHTML = conteudoTooltip(uf);
    tooltip.hidden = false;
    marcarDescricaoTooltip(alvo);
    const rect = alvo.getBoundingClientRect();
    posicionarTooltipPerto(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function abrirPainel(uf: string, origem: SVGElement): void {
    ufTooltipFixado = null;
    esconderTooltip();
    abrirPainelEstado({ uf, casos, elementoOrigem: origem });
  }

  /**
   * Um único handler de `click` para mouse/teclado (abre o painel direto,
   * comportamento desktop inalterado — ver docs/revisao-mapa.md) e para
   * toque (mobile, `pointerType === 'touch'`): o 1º toque num estado só fixa
   * o tooltip-prévia (igual ao hover), o 2º toque no MESMO estado abre o
   * painel. Toque em outro estado troca a prévia fixada; toque fora do mapa
   * fecha (ver ouvinte de `pointerdown` em `document`, registrado abaixo).
   */
  function aoInteragirComEstado(uf: string, path: SVGElement, pointerType: string): void {
    if (pointerType !== 'touch') {
      abrirPainel(uf, path);
      return;
    }
    if (ufTooltipFixado === uf && !tooltip.hidden) {
      abrirPainel(uf, path);
      return;
    }
    mostrarTooltipFoco(uf, path);
    ufTooltipFixado = uf;
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

    // Último tipo de ponteiro observado por estado (mouse/touch/pen) — o
    // evento `click` em si não carrega `pointerType` de forma confiável
    // (é um `MouseEvent`), então é capturado no `pointerdown` imediatamente
    // anterior para decidir, no `click`, entre abrir o painel direto
    // (desktop) ou o fluxo de prévia fixada por toque (mobile).
    let ultimoPointerType = 'mouse';

    // `alvoInterativo` é o próprio `path` em estados grandes (sem alvo de
    // toque ampliado) — iterar `[path, alvoInterativo]` sem deduplicar
    // registraria cada listener 2x no mesmo elemento. Antes isso era
    // inofensivo (`abrirPainel` é idempotente), mas duplica a chamada de
    // `aoInteragirComEstado` por toque: o 1º toque fixaria a prévia E, na
    // mesma interação, o 2º registro já veria `ufTooltipFixado === uf` e
    // abriria o painel direto — pulando o estágio de prévia no mobile.
    const elementosInterativos = alvoInterativo === path ? [path] : [path, alvoInterativo];
    for (const el of elementosInterativos) {
      el.addEventListener('pointerdown', (e) => {
        ultimoPointerType = (e as PointerEvent).pointerType;
      });
      el.addEventListener('pointerenter', (e) => {
        const evento = e as PointerEvent;
        if (evento.pointerType === 'touch') return; // toque usa o fluxo de aoInteragirComEstado, não hover
        mostrarTooltipMouse(uf, path, evento);
      });
      el.addEventListener('pointermove', (e) => {
        const evento = e as PointerEvent;
        if (evento.pointerType === 'touch') return;
        posicionarTooltipPerto(evento.clientX, evento.clientY);
      });
      el.addEventListener('pointerleave', (e) => {
        if ((e as PointerEvent).pointerType === 'touch') return;
        esconderTooltip();
      });
      el.addEventListener('click', () => aoInteragirComEstado(uf, path, ultimoPointerType));
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
    // Marcador textual (E/CE) para reforçar, sem depender de matiz, a
    // distinção entre esquerda e centro-esquerda — ver MARCADOR_ESPECTRO.
    const marcador = MARCADOR_ESPECTRO[espectro];
    if (marcador) {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('class', 'uf-label__marcador');
      tspan.setAttribute('dx', '1');
      tspan.textContent = marcador;
      texto.appendChild(tspan);
    }
    grupoRotulos.appendChild(texto);
  }

  mapWrap.appendChild(svg);

  // Toque fora de qualquer estado fecha o tooltip-prévia fixado (mobile) —
  // "clique fora fecha" do mesmo padrão já usado pelo backdrop do painel.
  function aoTocarForaDoMapa(e: PointerEvent): void {
    if (ufTooltipFixado === null) return;
    const alvo = e.target;
    if (alvo instanceof Element && alvo.closest('.map-uf, .map-uf__alvo-toque')) return;
    ufTooltipFixado = null;
    esconderTooltip();
  }
  document.addEventListener('pointerdown', aoTocarForaDoMapa);
  desligarOuvinteToqueFora = () => document.removeEventListener('pointerdown', aoTocarForaDoMapa);

  layout.appendChild(criarLegenda());

  ajustarAlturaMapa(mapWrap);
  window.addEventListener('resize', onResizeAjustarAltura);
  desligarOuvinteResize = () => window.removeEventListener('resize', onResizeAjustarAltura);
  function onResizeAjustarAltura(): void {
    if (!secao.isConnected) {
      window.removeEventListener('resize', onResizeAjustarAltura);
      return;
    }
    ajustarAlturaMapa(mapWrap);
  }
}

/**
 * P0 (docs/revisao-mapa.md §4): o SVG do mapa é mais alto que a janela em
 * 1280×800 (936px medidos vs. 800px de altura), deixando SP e RS fora da
 * área visível ao carregar. A partir de `LARGURA_MIN_LIMITAR_ALTURA` (mesma
 * faixa em que a legenda passa a ficar ao lado do mapa — `.map-view__layout`
 * vira `row`), mede o espaço realmente disponível abaixo do topo do wrapper
 * do mapa (cabeçalho do site + título + texto de introdução + respiro já
 * consumidos acima dele) e limita a altura do SVG a isso via a variável CSS
 * `--map-max-height`, mantendo a proporção (`.map-svg` usa `width:auto` +
 * `max-height` nesse breakpoint — ver styles/app.css). Abaixo do breakpoint
 * a variável é removida e o mapa volta a ocupar a largura total (mobile,
 * ver docs/ux-spec.md §2(a): "mapa mantém-se como mapa... SVG escala por
 * `viewBox`, `max-width: 100%`").
 */
function ajustarAlturaMapa(mapWrap: HTMLElement): void {
  if (!window.matchMedia(`(min-width: ${LARGURA_MIN_LIMITAR_ALTURA}px)`).matches) {
    mapWrap.style.removeProperty('--map-max-height');
    return;
  }
  const rect = mapWrap.getBoundingClientRect();
  const estilos = window.getComputedStyle(mapWrap);
  const reservado =
    Number.parseFloat(estilos.paddingTop) +
    Number.parseFloat(estilos.paddingBottom) +
    Number.parseFloat(estilos.borderTopWidth) +
    Number.parseFloat(estilos.borderBottomWidth);
  const folga = 24; // respiro para não colar no rodapé da viewport
  const disponivel = window.innerHeight - rect.top - reservado - folga;
  mapWrap.style.setProperty('--map-max-height', `${Math.max(280, disponivel)}px`);
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
  // `--color-accent` (roxo/azul de marca) nunca aparece no mapa — nenhum
  // espectro usa essa cor, então a amostra da legenda de confiança não batia
  // com nada do que se via no próprio mapa (docs/revisao-mapa.md P1 #2). Usa
  // o tom "centro" (`--spectrum-3-fill`), neutro e presente na paleta real
  // do mapa, como cor de exemplo para as opacidades.
  swatch.style.background = 'var(--spectrum-3-fill)';
  swatch.style.opacity = opacidade;
  if (hachura) swatch.classList.add('legend-swatch--hachura');
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(swatch, texto);
  return item;
}
