import { renderVoteEstimate } from './vote-estimate-panel.js';
import '../styles/presidential-states.css';
import brazilMapDados from '@svg-maps/brazil';
import {
  usouPesquisaForaDaJanela,
  type CasosDeUso,
  type PresidencialPorEstado,
  type PresidencialUf,
} from '../../../../application/use-cases/index.js';
import {
  JANELA_DIAS_PADRAO,
  MARGEM_REFERENCIA_PADRAO,
  type Agregado,
  type CandidatoAgregado,
} from '../../../../domain/aggregate.js';
import type { SerieTemporal } from '../../../../domain/aggregate.js';
import type { Pesquisa } from '../../../../domain/poll.js';
import { espectroDoPartido } from '../../../../domain/spectrum.js';
import { nomeCurtissimo } from './candidate-names.js';
import {
  avisoForaDaJanela,
  listaEmPortugues,
  rotuloForaDaJanela,
  rotuloRecorte,
  rotuloTurno,
  type Turno,
  type UfForaDaJanela,
} from './_shared.js';
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
  padEsquerdoMiniChart,
  raioAmostra,
  rotuloVantagemMini,
  serieCandidatoPorDia,
  temEvolucaoParaLinha,
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

/**
 * Contexto de recorte que toda peça da tela (mapa, tooltip, miniatura,
 * painel do estado) recebe para deixar explícito QUAL turno está sendo
 * mostrado — o dado sozinho não diz isso ao leitor.
 */
interface Recorte {
  readonly turno: Turno;
  /** "1º turno" ou "2º turno · Lula x Flávio Bolsonaro". */
  readonly rotulo: string;
}

function recorteDe(dados: PresidencialPorEstado): Recorte {
  return { turno: dados.turno, rotulo: rotuloRecorte(dados.turno, dados.confronto) };
}

/** Data (ISO) da pesquisa que o agregado da UF efetivamente usou, ou null. */
function dataUltimaPesquisa(item: PresidencialUf): string | null {
  const p = item.ultimaPesquisa;
  if (!p) return null;
  return p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? null;
}

/**
 * As UFs (nome por extenso + data da pesquisa usada) cujo agregado ficou
 * fora da janela de recência — a lista que vira o aviso do cabeçalho, a
 * legenda "Recência do dado" e o contorno tracejado no mapa. Exportada para
 * teste: com os dados reais, é `[]` no 1º turno de hoje e `[Rondônia]` no
 * 2º turno, e é ela que garante que a tela não apresente julho como se
 * fosse setembro.
 */
export function ufsComDadoForaDaJanela(dados: PresidencialPorEstado): UfForaDaJanela[] {
  return dados.ufs
    .filter((item) => usouPesquisaForaDaJanela(item))
    .map((item) => ({ nome: NOME_POR_UF.get(item.uf) ?? item.uf, dataIso: dataUltimaPesquisa(item) }));
}

/** Renderiza a tela "Presidente por estado" dentro de `container` (o `<main>` da app). */
export function renderPresidentialStates(container: HTMLElement, casos: CasosDeUso): void {
  container.innerHTML = '';

  const partidos = casos.listParties();

  let turno: Turno = 1;
  let dados = casos.getPresidentialByState(turno);
  let ufPorSigla = new Map(dados.ufs.map((u) => [u.uf, u] as const));
  let recorte = recorteDe(dados);

  const raiz = document.createElement('section');
  raiz.className = 'ps-view';
  raiz.setAttribute('aria-labelledby', 'ps-titulo');

  const cabecalho = criarCabecalho(dados, (novoTurno) => aplicarTurno(novoTurno));
  raiz.appendChild(cabecalho.el);

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

    mapWrap.appendChild(construirSvgMapa(modo, dados, ufPorSigla, partidos, tooltip, container, recorte));
    legendWrap.appendChild(
      modo === 'lideranca' ? criarLegendaLideranca(dados) : criarLegendaEleitorado(dados, recorte),
    );
  }
  redesenharMapa();

  // Abas: "Mapa e tendências" (mapa + miniaturas) e "Votos estimados" (agregação estadual × eleitorado).
  const abas = criarAbas();
  raiz.appendChild(abas.barra);

  const painelMapa = abas.paineis[0]!;
  painelMapa.appendChild(mapSection);

  const gradeWrap = document.createElement('div');
  painelMapa.appendChild(gradeWrap);
  function redesenharGrade(): void {
    gradeWrap.innerHTML = '';
    gradeWrap.appendChild(criarSecaoGrade(dados, partidos, container, recorte));
  }
  redesenharGrade();
  raiz.appendChild(painelMapa);

  const painelVotos = abas.paineis[1]!;
  // Turno já renderizado na aba de votos — null enquanto nunca renderizou ou
  // depois de uma troca de turno que a invalidou (a aba só recalcula quando
  // fica visível, para não pagar `getVoteEstimate` de um turno que ninguém
  // vai olhar).
  let turnoDosVotos: Turno | null = null;
  function renderizarVotos(): void {
    renderVoteEstimate(painelVotos, casos, turno);
    turnoDosVotos = turno;
  }
  abas.aoSelecionar((indice) => {
    if (indice === 1 && turnoDosVotos !== turno) renderizarVotos();
  });
  raiz.appendChild(painelVotos);

  function aplicarTurno(novoTurno: Turno): void {
    if (novoTurno === turno) return;
    turno = novoTurno;
    dados = casos.getPresidentialByState(turno);
    ufPorSigla = new Map(dados.ufs.map((u) => [u.uf, u] as const));
    recorte = recorteDe(dados);

    // O painel aberto é de uma UF no turno antigo: fecha em vez de deixar
    // números de um recorte sob o seletor de outro.
    fecharPainelUf();

    cabecalho.atualizar(dados);
    redesenharMapa();
    redesenharGrade();
    if (!painelVotos.hidden) renderizarVotos();
    else turnoDosVotos = null;
  }

  container.appendChild(raiz);
}

interface Abas {
  readonly barra: HTMLElement;
  readonly paineis: readonly HTMLElement[];
  aoSelecionar(cb: (indice: number) => void): void;
}

/** Barra de abas acessível (role=tablist, setas do teclado, aria-selected/aria-controls). */
function criarAbas(): Abas {
  const rotulos = ['Mapa e tendências', 'Votos estimados'] as const;
  const barra = document.createElement('div');
  barra.className = 'ps-tabs';
  barra.setAttribute('role', 'tablist');
  barra.setAttribute('aria-label', 'Visões da corrida presidencial por estado');
  const botoes: HTMLButtonElement[] = [];
  const paineis: HTMLElement[] = [];
  const ouvintes: ((indice: number) => void)[] = [];

  const selecionar = (indice: number): void => {
    botoes.forEach((b, i) => {
      const ativo = i === indice;
      b.setAttribute('aria-selected', ativo ? 'true' : 'false');
      b.tabIndex = ativo ? 0 : -1;
      b.classList.toggle('ps-tab--ativa', ativo);
      paineis[i]!.hidden = !ativo;
    });
    for (const cb of ouvintes) cb(indice);
  };

  rotulos.forEach((rotulo, i) => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'ps-tab';
    botao.id = `ps-tab-${i}`;
    botao.setAttribute('role', 'tab');
    botao.setAttribute('aria-controls', `ps-tabpanel-${i}`);
    botao.textContent = rotulo;
    botao.addEventListener('click', () => selecionar(i));
    botao.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const proximo = (i + (ev.key === 'ArrowRight' ? 1 : rotulos.length - 1)) % rotulos.length;
        selecionar(proximo);
        botoes[proximo]!.focus();
      }
    });
    barra.appendChild(botao);
    botoes.push(botao);

    const painel = document.createElement('div');
    painel.id = `ps-tabpanel-${i}`;
    painel.className = 'ps-tabpanel';
    painel.setAttribute('role', 'tabpanel');
    painel.setAttribute('aria-labelledby', botao.id);
    paineis.push(painel);
  });

  const abas: Abas = {
    barra,
    paineis,
    aoSelecionar(cb) {
      ouvintes.push(cb);
    },
  };
  // Estado inicial (sem disparar ouvintes ainda registrados).
  botoes.forEach((b, i) => {
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.tabIndex = i === 0 ? 0 : -1;
    b.classList.toggle('ps-tab--ativa', i === 0);
    paineis[i]!.hidden = i !== 0;
  });
  return abas;
}

interface Cabecalho {
  readonly el: HTMLElement;
  /** Reescreve os textos que dependem do turno (cobertura, intro e aviso de recência). */
  atualizar(dados: PresidencialPorEstado): void;
}

function criarCabecalho(
  dados: PresidencialPorEstado,
  aoTrocarTurno: (turno: Turno) => void,
): Cabecalho {
  const header = document.createElement('header');
  header.className = 'ps-header';

  const titulo = document.createElement('h1');
  titulo.id = 'ps-titulo';
  titulo.className = 'ps-title';
  titulo.textContent = 'Presidente por estado';
  header.appendChild(titulo);

  const metaEleitorado = document.createElement('p');
  metaEleitorado.className = 'ps-meta';
  header.appendChild(metaEleitorado);

  const intro = document.createElement('p');
  intro.className = 'ps-meta';
  header.appendChild(intro);

  header.appendChild(
    criarSeletorTurno(dados.turno, (turno) => {
      aoTrocarTurno(turno);
    }),
  );

  const aviso = document.createElement('p');
  aviso.className = 'ps-aviso';
  header.appendChild(aviso);

  function atualizar(novos: PresidencialPorEstado): void {
    const recorte = recorteDe(novos);

    if (novos.eleitoradoNacional != null && novos.eleitoradoNacional > 0) {
      const parcela = (novos.eleitoradoComPesquisa / novos.eleitoradoNacional) * 100;
      metaEleitorado.innerHTML = `Eleitorado nacional: <strong>${escaparHtml(
        formatarEleitorado(novos.eleitoradoNacional),
      )}</strong> de eleitores aptos. Pesquisa presidencial estadual de ${escaparHtml(
        recorte.rotulo,
      )} cobre <strong>${escaparHtml(formatarPct(parcela))}</strong> desse eleitorado.`;
    } else {
      metaEleitorado.textContent = 'Eleitorado nacional: dado ainda não cadastrado.';
    }

    intro.textContent =
      `A cor do mapa mostra o espectro do partido que lidera a média ponderada de pesquisas presidenciais ` +
      `de ${recorte.rotulo} em cada estado; a opacidade indica a confiança da liderança. ` +
      'Alterne para "Eleitorado" para ver o tamanho do colégio eleitoral por estado. ' +
      'Passe o mouse para uma prévia ou clique/Enter para abrir os detalhes.';

    const texto = avisoForaDaJanela(ufsComDadoForaDaJanela(novos));
    aviso.textContent = texto ?? '';
    aviso.hidden = texto == null;
  }

  atualizar(dados);
  return { el: header, atualizar };
}

/** Uma opção de um grupo de alternância (segmented control). */
interface OpcaoAlternancia<T> {
  readonly valor: T;
  readonly rotulo: string;
  /** Texto adicional só para leitor de tela, quando o rótulo visível é curto demais. */
  readonly rotuloAcessivel?: string;
}

/**
 * Grupo de alternância acessível (segmented control), o padrão visual do
 * toggle "Quem lidera / Eleitorado" desta tela, agora compartilhado com o
 * seletor de turno: botões com `aria-pressed`, um `role=group` rotulado,
 * tabindex roving e navegação por ←/→/Home/End (que também trocam a
 * seleção, como num grupo de rádio). O foco visível vem de
 * `.ps-view *:focus-visible` na folha de estilos.
 */
function criarGrupoAlternancia<T>(
  opcoes: readonly OpcaoAlternancia<T>[],
  valorInicial: T,
  rotuloGrupo: string,
  onChange: (valor: T) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'ps-toggle-group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', rotuloGrupo);

  const botoes: HTMLButtonElement[] = [];

  const selecionar = (indice: number, focar: boolean): void => {
    botoes.forEach((b, i) => {
      const ativo = i === indice;
      b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
      b.tabIndex = ativo ? 0 : -1;
    });
    if (focar) botoes[indice]!.focus();
    onChange(opcoes[indice]!.valor);
  };

  opcoes.forEach((opcao, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps-toggle-btn';
    btn.textContent = opcao.rotulo;
    const ativo = opcao.valor === valorInicial;
    btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    btn.tabIndex = ativo ? 0 : -1;
    if (opcao.rotuloAcessivel) btn.setAttribute('aria-label', opcao.rotuloAcessivel);
    btn.addEventListener('click', () => selecionar(i, false));
    btn.addEventListener('keydown', (ev) => {
      const teclas: Readonly<Record<string, number>> = {
        ArrowRight: (i + 1) % opcoes.length,
        ArrowDown: (i + 1) % opcoes.length,
        ArrowLeft: (i + opcoes.length - 1) % opcoes.length,
        ArrowUp: (i + opcoes.length - 1) % opcoes.length,
        Home: 0,
        End: opcoes.length - 1,
      };
      const destino = teclas[ev.key];
      if (destino == null) return;
      ev.preventDefault();
      selecionar(destino, true);
    });
    botoes.push(btn);
    group.appendChild(btn);
  });

  return group;
}

function criarToggleModo(onChange: (modo: ModoMapa) => void): HTMLElement {
  return criarGrupoAlternancia<ModoMapa>(
    [
      { valor: 'lideranca', rotulo: 'Quem lidera' },
      { valor: 'eleitorado', rotulo: 'Eleitorado' },
    ],
    'lideranca',
    'Modo do mapa',
    onChange,
  );
}

/**
 * Seletor de turno da página inteira (mapa, miniaturas, painel do estado e
 * aba "Votos estimados" seguem o mesmo valor). Fica no cabeçalho, acima das
 * abas, justamente para continuar visível em todas elas.
 */
function criarSeletorTurno(turnoInicial: Turno, onChange: (turno: Turno) => void): HTMLElement {
  const linha = document.createElement('div');
  linha.className = 'ps-turno-bar';

  const rotulo = document.createElement('span');
  rotulo.className = 'ps-turno-bar__rotulo';
  rotulo.textContent = 'Turno';
  linha.appendChild(rotulo);

  linha.appendChild(
    criarGrupoAlternancia<Turno>(
      [
        { valor: 1, rotulo: rotuloTurno(1) },
        { valor: 2, rotulo: rotuloTurno(2), rotuloAcessivel: '2º turno: Lula x Flávio Bolsonaro' },
      ],
      turnoInicial,
      'Turno da disputa presidencial',
      onChange,
    ),
  );

  const nota = document.createElement('span');
  nota.className = 'ps-turno-bar__nota';
  nota.textContent = 'No 2º turno, o confronto é Lula x Flávio Bolsonaro.';
  linha.appendChild(nota);

  return linha;
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
  recorte: Recorte,
): string {
  const nome = NOME_POR_UF.get(item.uf) ?? item.uf;
  const eleitoresTexto = item.eleitores != null ? formatarEleitorado(item.eleitores) : 'não cadastrado';
  const linhaRecorte = `<span class="ps-tooltip__recorte">${escaparHtml(recorte.rotulo)}</span>`;

  if (item.semDados || !item.agregado || !item.lider) {
    return `
      <strong>${escaparHtml(nome)}</strong>
      ${linhaRecorte}
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

  // A data já aparece na linha do instituto logo acima — aqui basta dizer o
  // que ela significa, sem repeti-la num espaço tão apertado.
  const avisoRecencia = usouPesquisaForaDaJanela(item)
    ? `<span class="ps-tooltip__aviso">Fora da janela de ${JANELA_DIAS_PADRAO} dias: é a pesquisa mais recente do estado neste recorte</span>`
    : '';

  return `
    <strong>${escaparHtml(nome)}</strong>
    ${linhaRecorte}
    <span class="ps-tooltip__meta">Eleitores: ${escaparHtml(eleitoresTexto)}</span>
    <span class="ps-tooltip__lider">${escaparHtml(item.lider)} <span class="ps-tooltip__partido">(${escaparHtml(item.partido ?? 'sem partido')})</span></span>
    <span class="ps-tooltip__vantagem">${vantagemTexto}</span>
    <span class="ps-tooltip__meta">${escaparHtml(institutoUltima)} · ${dataUltima}</span>
    ${avisoRecencia}
    ${linhaClasse}
  `;
}

/** Sufixo de leitor de tela para UF cujo dado é real mas fora da janela de recência. */
function sufixoRecencia(item: PresidencialUf): string {
  return usouPesquisaForaDaJanela(item) ? ` ${rotuloForaDaJanela(dataUltimaPesquisa(item))}.` : '';
}

function ariaLabelLideranca(nomeEstado: string, item: PresidencialUf, recorte: Recorte): string {
  if (item.semDados || !item.lider) {
    return `${nomeEstado}: sem pesquisa presidencial estadual suficiente no ${recorte.rotulo}.`;
  }
  const pontos = formatarNumeroPt(item.vantagem);
  const partido = item.partido ?? 'sem partido';
  const sufixo = item.empateTecnico ? ', empate técnico' : '';
  return `${nomeEstado}, ${recorte.rotulo}: ${item.lider} (${partido}) lidera com ${pontos} pontos${sufixo}.${sufixoRecencia(item)}`;
}

function ariaLabelEleitorado(
  nomeEstado: string,
  item: PresidencialUf,
  breakpoints: readonly number[],
  recorte: Recorte,
): string {
  if (item.eleitores == null) return `${nomeEstado}: eleitorado não cadastrado.`;
  const classe = classificarPorQuantil(item.eleitores, breakpoints) + 1;
  const lideranca = item.lider ? ` No ${recorte.rotulo}, quem lidera é ${item.lider}.` : '';
  return `${nomeEstado}: ${formatarEleitorado(item.eleitores)} de eleitores (faixa ${classe} de 5).${lideranca}`;
}

function construirSvgMapa(
  modo: ModoMapa,
  dados: PresidencialPorEstado,
  ufPorSigla: ReadonlyMap<string, PresidencialUf>,
  partidos: Partidos,
  tooltip: HTMLDivElement,
  hostElement: HTMLElement,
  recorte: Recorte,
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
      ? `Mapa do Brasil: quem lidera as pesquisas presidenciais por estado — ${recorte.rotulo}`
      : `Mapa do Brasil: eleitorado por estado (o eleitorado não muda com o turno; a prévia e o painel de cada estado mostram o ${recorte.rotulo})`,
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
    tooltip.innerHTML = conteudoTooltip(item, modo, breakpointsEleitorado, partidos, recorte);
    tooltip.hidden = false;
    posicionarTooltipPerto(tooltip, evento.clientX, evento.clientY);
  }
  function mostrarTooltipFoco(item: PresidencialUf, alvo: SVGElement): void {
    tooltip.innerHTML = conteudoTooltip(item, modo, breakpointsEleitorado, partidos, recorte);
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
      path.setAttribute('aria-label', ariaLabelLideranca(loc.name, item, recorte));
      // Contorno tracejado: a UF tem dado real, mas de fora da janela de
      // recência (RO no 2º turno). Marcar no próprio mapa evita que a cor
      // sugira um número tão fresco quanto o dos vizinhos.
      if (usouPesquisaForaDaJanela(item)) path.classList.add('ps-uf--fora-janela');
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
      path.setAttribute('aria-label', ariaLabelEleitorado(loc.name, item, breakpointsEleitorado, recorte));
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

    const abrir = (): void => abrirPainelUf(item, loc.name, path, hostElement, partidos, recorte);

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

/** Item de legenda com o mesmo contorno tracejado usado nas UFs fora da janela. */
function criarItemLegendaForaDaJanela(janelaTexto: string): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const swatch = document.createElement('span');
  swatch.className = 'ps-legend-swatch ps-legend-swatch--fora-janela';
  swatch.style.background = 'var(--color-surface-3)';
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = janelaTexto;
  item.append(swatch, texto);
  return item;
}

function criarLegendaLideranca(dados: PresidencialPorEstado): HTMLElement {
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

  // Só existe quando alguma UF realmente está nessa situação — legenda de
  // uma marca que não aparece no mapa seria ruído.
  const fora = ufsComDadoForaDaJanela(dados);
  if (fora.length > 0) {
    const grupoRecencia = document.createElement('div');
    grupoRecencia.className = 'ps-legend-grupo';
    const tituloRecencia = document.createElement('h3');
    tituloRecencia.className = 'ps-legend-grupo__titulo';
    tituloRecencia.textContent = 'Recência do dado';
    grupoRecencia.appendChild(tituloRecencia);
    const listaRecencia = document.createElement('ul');
    listaRecencia.className = 'ps-legend-lista';
    listaRecencia.appendChild(
      criarItemLegendaForaDaJanela(
        `Pesquisa fora da janela de ${JANELA_DIAS_PADRAO} dias (${listaEmPortugues(fora.map((u) => u.nome))})`,
      ),
    );
    grupoRecencia.appendChild(listaRecencia);
    legenda.appendChild(grupoRecencia);
  }

  return legenda;
}

function criarLegendaEleitorado(dados: PresidencialPorEstado, recorte: Recorte): HTMLElement {
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

  // O seletor de turno continua valendo aqui: o mapa não muda, mas tudo o
  // que ele abre (prévia e painel do estado) segue o turno escolhido.
  const nota = document.createElement('p');
  nota.className = 'ps-legend-nota';
  nota.textContent = `O eleitorado não muda com o turno. A prévia e o painel de cada estado mostram o ${recorte.rotulo}.`;
  legenda.appendChild(nota);

  return legenda;
}

/* ================= Grade de miniaturas (estilo NYT) ================= */

const MINI_W = 240;
const MINI_H = 90;
const MINI_PAD_TOP = 10;
const MINI_PAD_BOTTOM = 16;
const MINI_PAD_RIGHT = 32;
const MINI_PLOT_H = MINI_H - MINI_PAD_TOP - MINI_PAD_BOTTOM;

function criarSecaoGrade(
  dados: PresidencialPorEstado,
  partidos: Partidos,
  hostElement: HTMLElement,
  recorte: Recorte,
): HTMLElement {
  const secao = document.createElement('section');
  secao.className = 'ps-grid-section';
  secao.setAttribute('aria-labelledby', 'ps-grid-heading');

  const heading = document.createElement('h2');
  heading.id = 'ps-grid-heading';
  heading.className = 'ps-section-title';
  heading.textContent = `Tendência por estado — ${recorte.rotulo}`;
  secao.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'ps-meta';
  intro.textContent =
    `Cada miniatura traz a série de pesquisas de ${recorte.rotulo} do estado. ` +
    'Ordenado pelo tamanho do eleitorado (maior primeiro); estados sem pesquisa presidencial estadual aparecem ao final.';
  secao.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'ps-grid';
  for (const item of ordenarParaGrade(dados.ufs)) {
    grid.appendChild(criarCardMiniatura(item, partidos, hostElement, recorte));
  }
  secao.appendChild(grid);

  return secao;
}

function criarCardMiniatura(
  item: PresidencialUf,
  partidos: Partidos,
  hostElement: HTMLElement,
  recorte: Recorte,
): HTMLElement {
  const nome = NOME_POR_UF.get(item.uf) ?? item.uf;
  const eleitoresTexto = item.eleitores != null ? `${formatarEleitorado(item.eleitores)} de eleitores` : 'Eleitorado não cadastrado';

  if (item.semDados || !item.agregado || !item.serie || !item.agregado.lider) {
    const card = document.createElement('div');
    card.className = 'ps-card ps-card--vazio';
    card.innerHTML = `
      <p class="ps-card__titulo"><span class="ps-card__uf">${escaparHtml(nome)}</span></p>
      <p class="ps-card__eleitores">${escaparHtml(eleitoresTexto)}</p>
      <div class="ps-mini-chart-placeholder">Sem pesquisa estadual de ${escaparHtml(recorte.rotulo)}</div>
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
    `${nome}, ${recorte.rotulo}: ${rotuloCompleto}. ${eleitoresTexto}.${sufixoRecencia(item)} Abrir detalhes das pesquisas presidenciais do estado.`,
  );

  const titulo = document.createElement('p');
  titulo.className = 'ps-card__titulo';
  titulo.innerHTML = `<span class="ps-card__uf">${escaparHtml(nome)}</span><span class="ps-card__separador" aria-hidden="true">›</span><span class="ps-card__vantagem" title="${escaparHtml(rotuloCompleto)}">${escaparHtml(rotuloVisivel)}</span>`;
  btn.appendChild(titulo);

  const eleitoresP = document.createElement('p');
  eleitoresP.className = 'ps-card__eleitores';
  eleitoresP.textContent = eleitoresTexto;
  btn.appendChild(eleitoresP);

  if (usouPesquisaForaDaJanela(item)) {
    btn.classList.add('ps-card--fora-janela');
    const avisoP = document.createElement('p');
    avisoP.className = 'ps-card__aviso';
    avisoP.textContent = rotuloForaDaJanela(dataUltimaPesquisa(item));
    btn.appendChild(avisoP);
  }

  btn.appendChild(construirMiniGrafico(item.agregado, item.serie, partidos));

  btn.addEventListener('click', () => abrirPainelUf(item, nome, btn, hostElement, partidos, recorte));

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
function construirMiniGrafico(agregado: Agregado, serie: SerieTemporal, partidos: Partidos): SVGSVGElement {
  const candidatos = agregado.candidatos.slice(0, 2);

  const pontosPorCandidato = candidatos.map((c) =>
    serie.pontos.filter((p) => p.candidato === c.candidato).sort((a, b) => a.data.localeCompare(b.data)),
  );

  const todasDatas = pontosPorCandidato.flat().map((p) => p.data);
  const dominioX: DominioX =
    todasDatas.length > 0
      ? {
          minIso: todasDatas.reduce((m, d) => (d < m ? d : m)),
          maxIso: todasDatas.reduce((m, d) => (d > m ? d : m)),
        }
      : { minIso: '2000-01-01', maxIso: '2000-01-01' };
  // Linha de tendência só faz sentido quando há pelo menos 2 datas distintas
  // desenhadas como pontos — usa a SÉRIE real (`serie.pontos`, via
  // `todasDatas`), não `agregado.pesquisasUsadas.length > 1` (filtrado pela
  // janela de recência de 45 dias do agregado): esse gate antigo escondia a
  // linha em Goiás/Acre/Rondônia, que têm 2 pesquisas de datas bem
  // distantes mas só 1 sobrevivia à janela — bug P0 documentado em
  // docs/revisao-presidente-estados.md. Cobre também o caso "mesmo dia"
  // (MG/TO: 2 institutos publicando na mesma data) — não é evolução real
  // para desenhar, senão a suavização Catmull-Rom inventaria um laço entre
  // pontos empilhados no mesmo x (bug de laço confirmado em rodadas
  // anteriores) — `temEvolucaoParaLinha` retorna `false` nesse caso também,
  // já que só há 1 data distinta.
  const temLinha = temEvolucaoParaLinha(todasDatas);

  const todosPct = [...pontosPorCandidato.flat().map((p) => p.pct), ...candidatos.map((c) => c.pct)];
  const dominioY = calcularDominioY(todosPct);

  // Reserva a largura equivalente ao maior raio de ponto + 2px como padding
  // esquerdo: sem isso, o ponto mais antigo (mapeado para x=0 pela escala)
  // fica com o centro do círculo na borda esquerda do viewBox e é cortado
  // ao meio (bug confirmado via DOM em 20 de 27 mini-gráficos por estado).
  const padEsquerdo = padEsquerdoMiniChart(pontosPorCandidato.flat().map((p) => p.amostra));
  const larguraPlot = MINI_W - padEsquerdo - MINI_PAD_RIGHT;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MINI_W} ${MINI_H}`);
  svg.setAttribute('class', 'ps-mini-chart');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', descricaoAcessivelMiniGrafico(candidatos));

  const yBase = MINI_PAD_TOP + escalaY(50, dominioY, MINI_PLOT_H);
  const baseline = document.createElementNS(SVG_NS, 'line');
  baseline.setAttribute('x1', String(padEsquerdo));
  baseline.setAttribute('x2', String(padEsquerdo + larguraPlot));
  baseline.setAttribute('y1', String(yBase));
  baseline.setAttribute('y2', String(yBase));
  baseline.setAttribute('class', 'ps-mini-chart__baseline');
  svg.appendChild(baseline);

  const baselineLabel = document.createElementNS(SVG_NS, 'text');
  baselineLabel.setAttribute('x', String(padEsquerdo + larguraPlot + 3));
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
      x: padEsquerdo + escalaX(p.data, dominioX, larguraPlot),
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

    const finalCoord: PontoXY = { x: padEsquerdo + larguraPlot, y: finaisY[i]! };
    if (temLinha) {
      // Linha construída a partir de `serie.dias` (já suave — no máximo 1
      // valor por candidato por data), não dos pontos brutos de pesquisa:
      // evita o laço quando 2+ pesquisas caem na mesma data (mesmo x).
      const coordsDias: PontoXY[] = serieCandidatoPorDia(serie.dias, candidato.candidato, dominioX).map((d) => ({
        x: padEsquerdo + escalaX(d.data, dominioX, larguraPlot),
        y: MINI_PAD_TOP + escalaY(d.pct, dominioY, MINI_PLOT_H),
      }));
      const coordsLinha = coordsDias.length > 0 ? [...coordsDias, finalCoord] : [finalCoord];
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
  recorte: Recorte,
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
  painel.innerHTML = psMontarConteudo(item, nomeEstado, partidos, recorte);

  backdrop.appendChild(painel);
  hostElement.appendChild(backdrop);

  psBackdropAtual = backdrop;
  psOrigemAtual = origem;

  painel.querySelector('.ps-panel__fechar')?.addEventListener('click', () => fecharPainelUf());
  document.addEventListener('keydown', psAoTeclar);
  window.addEventListener('hashchange', psAoMudarHash, { once: true });

  psFocar(painel.querySelector<HTMLElement>('.ps-panel__fechar'));
}

function psMontarConteudo(
  item: PresidencialUf,
  nomeEstado: string,
  partidos: Partidos,
  recorte: Recorte,
): string {
  const eleitoresTexto =
    item.eleitores != null ? `${formatarEleitorado(item.eleitores)} de eleitores aptos` : 'Eleitorado não cadastrado';

  return `
    <div class="ps-panel__handle" aria-hidden="true"></div>
    <header class="ps-panel__header">
      <div>
        <h2 id="ps-panel-titulo" class="ps-panel__titulo">${escaparHtml(nomeEstado)} <span class="ps-panel__uf">(${item.uf})</span></h2>
        <p class="ps-panel__recorte">${escaparHtml(recorte.rotulo)}</p>
        <p class="ps-panel__eleitores">${escaparHtml(eleitoresTexto)}</p>
      </div>
      <button type="button" class="ps-panel__fechar" aria-label="Fechar painel">
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <div class="ps-panel__corpo">
      ${psRenderSecao(item, partidos, recorte)}
    </div>
    <footer class="ps-panel__footer">
      ${psRenderRodape(item, recorte)}
    </footer>
  `;
}

function psRenderSecao(item: PresidencialUf, partidos: Partidos, recorte: Recorte): string {
  const agregado = item.agregado;
  if (!agregado || !agregado.lider) {
    return `
      <section class="ps-panel__secao">
        <p class="ps-panel__vazio">Sem pesquisas presidenciais de ${escaparHtml(
          recorte.rotulo,
        )} para ${escaparHtml(item.uf)} nesta janela.</p>
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

  const avisoRecencia = agregado.foraDaJanela
    ? `<p class="ps-panel__aviso">${escaparHtml(
        rotuloForaDaJanela(dataUltimaPesquisa(item)),
      )}. É a pesquisa mais recente deste recorte no estado — nada foi estimado para completar.</p>`
    : '';

  return `
    <section class="ps-panel__secao">
      <div class="ps-panel__lider">
        <span class="ps-panel__lider-nome">${escaparHtml(agregado.lider.candidato)}</span>
        ${badgeLider}
        <span class="ps-panel__vantagem">${formatarVantagem(agregado.vantagem)}</span>
        ${seloEmpate}
      </div>
      ${avisoRecencia}
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

function psRenderRodape(item: PresidencialUf, recorte: Recorte): string {
  if (!item.ultimaPesquisa) {
    return `<p>Nenhuma pesquisa presidencial estadual de ${escaparHtml(
      recorte.rotulo,
    )} disponível para esta UF.</p>`;
  }
  const data = dataUltimaPesquisa(item) ?? '';
  return `
    <p class="ps-panel__ultima">Última pesquisa deste recorte em ${formatarData(data)}.</p>
    <p class="ps-panel__metodologia">Média ponderada por recência e tamanho de amostra. <a href="#/presidente">Como calculamos</a>.</p>
  `;
}
