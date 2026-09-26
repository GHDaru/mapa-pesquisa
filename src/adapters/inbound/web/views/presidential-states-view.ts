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
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
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
  datasDosPontos,
  degrauDaRazao,
  escalaX,
  escalaY,
  faixaVantagem,
  formaDoPonto,
  formatarEleitorado,
  hashDoTurno,
  LIMIARES_VANTAGEM,
  marcaDeAreaDaFaixa,
  notaSomaDoPainel,
  opacidadeVantagem,
  ordenarParaGrade,
  padEsquerdoMiniChart,
  pctCobertura,
  pontosDaBase,
  RAIO_PONTO,
  razaoVantagem,
  rotuloBaseParcial,
  rotuloContagemPesquisas,
  rotuloFaixaVantagem,
  rotuloPesquisasComPeriodo,
  rotuloVantagemMini,
  serieCandidatoPorDia,
  temEvolucaoParaLinha,
  temPesquisaUnica,
  turnoDoHash,
  type DominioX,
  type FaixaVantagem,
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

const ESPECTROS_LEGENDA: readonly Espectro[] = [
  'esquerda',
  'centro-esquerda',
  'centro',
  'centro-direita',
  'direita',
] as const;

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

/** Data (ISO) de referência de uma pesquisa, na mesma ordem de preferência do resto da tela. */
function dataPesquisa(p: Pesquisa): string {
  return p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '';
}

/** Quantas pesquisas o agregado da UF usou — 0 quando não há agregado. */
function nPesquisasUsadas(item: PresidencialUf): number {
  return item.agregado?.pesquisasUsadas.length ?? 0;
}

/**
 * Linha de procedência da UF ("1 pesquisa · 10/09/2026", "3 pesquisas ·
 * ago–set/2026"): a mesma frase no cartão da grade, no tooltip do mapa e no
 * selo do painel. Antes, os três lugares AFIRMAVAM confiança (opacidade,
 * "LIDERA COM FOLGA") sem dizer sobre quantas pesquisas — o leitor só
 * descobria que era uma só abrindo o `<details>` do painel.
 */
function procedenciaUf(item: PresidencialUf): string {
  const usadas = item.agregado?.pesquisasUsadas ?? [];
  return rotuloPesquisasComPeriodo(usadas.length, usadas.map(dataPesquisa));
}

/**
 * Ids das pesquisas que o agregado da UF usou — a base que o cartão, o tooltip
 * e o painel DECLARAM. É por eles que os pontos do mini-gráfico são filtrados,
 * para o desenho e o rótulo não saírem de conjuntos diferentes.
 */
function idsUsadosUf(item: PresidencialUf): ReadonlySet<string> {
  return new Set((item.agregado?.pesquisasUsadas ?? []).map((p) => p.id));
}

/**
 * Datas distintas efetivamente desenhadas como pontos no mini-gráfico da UF.
 * Exportada para teste: o invariante é que este conjunto seja igual ao das
 * datas das pesquisas que o cartão DECLARA em `procedenciaUf` — antes o cartão
 * dizia "1 pesquisa · 16/09/2026" e desenhava 21/06 e 16/09.
 */
export function datasDesenhadasUf(item: PresidencialUf): string[] {
  if (!item.agregado || !item.serie) return [];
  const candidatos = item.agregado.candidatos.slice(0, 2).map((c) => c.candidato);
  return datasDosPontos(pontosDaBase(item.serie.pontos, idsUsadosUf(item)), candidatos);
}

/** Quantas das pesquisas usadas pela UF não publicaram o tamanho da amostra. */
function pesquisasSemAmostra(item: PresidencialUf): number {
  return (item.agregado?.pesquisasUsadas ?? []).filter((p) => p.amostra == null).length;
}

/**
 * Quantas pesquisas a grade desenha sem amostra publicada — TODAS as que viram
 * glifo na tela, inclusive as dos cartões de ponto único. Exportada para teste:
 * a nota da seção afirma esse número em palavras, e a conta anterior filtrava
 * `!ehPontoUnico(u)`, ou seja, excluía justamente os cartões de UMA pesquisa.
 * No 2º turno ela dizia 2 com 3 glifos vazados na tela (Rio de Janeiro, Mato
 * Grosso do Sul e Goiás) — e o cartão do Rio, além de não ser contado, desenhava
 * disco cheio.
 */
export function pesquisasSemAmostraDesenhadas(dados: PresidencialPorEstado): number {
  return dados.ufs
    .filter((u) => !u.semDados && u.agregado?.lider)
    .reduce((n, u) => n + pesquisasSemAmostra(u), 0);
}

/** true quando o cartão da UF vira marcador de ponto único (só uma data de pesquisa). */
function ehPontoUnico(item: PresidencialUf): boolean {
  if (item.semDados || !item.agregado || !item.serie || !item.agregado.lider) return false;
  return !temEvolucaoParaLinha(datasDesenhadasUf(item));
}

/** Margem de erro de referência da UF (a do agregado, ou o padrão do domínio). */
function margemUf(item: PresidencialUf): number {
  return item.agregado?.margemReferencia ?? MARGEM_REFERENCIA_PADRAO;
}

/**
 * Degrau de tinta da UF no mapa "Quem lidera": SÓ a vantagem em múltiplos da
 * margem de erro do estado. A contagem de pesquisas não entra mais aqui (ver
 * `faixaVantagem` em presidential-states-layout.ts) — ela virou a marca
 * não-cromática de `temPesquisaUnica`, para que os rótulos de razão da legenda
 * voltem a ser verdadeiros sobre toda UF pintada em cada faixa.
 */
function faixaVantagemUf(item: PresidencialUf): FaixaVantagem {
  return faixaVantagem({
    vantagem: item.vantagem,
    margemReferencia: margemUf(item),
    semDados: item.semDados,
  });
}

/** true quando a UF tem uma única pesquisa no recorte (asterisco na sigla do mapa). */
function temPesquisaUnicaUf(item: PresidencialUf): boolean {
  return temPesquisaUnica(nPesquisasUsadas(item), item.semDados);
}

/**
 * Exportada para teste: as UFs cuja faixa de tinta NÃO corresponde à razão
 * vantagem/margem medida — ou seja, as UFs pintadas numa faixa cujo rótulo é
 * factualmente falso sobre elas. Tem de ser `[]` nos dois turnos. Antes de o
 * desconto de pesquisa única sair do canal de cor, eram 15 das 27 UFs no 2º
 * turno e 4 das 27 no 1º.
 */
export function ufsComRotuloDeFaixaFalso(dados: PresidencialPorEstado): string[] {
  return dados.ufs
    .filter((item) => {
      const faixa = faixaVantagemUf(item);
      if (!faixa.startsWith('lidera')) return false;
      const degrau = degrauDaRazao(razaoVantagem(item.vantagem, margemUf(item)));
      return faixa !== `lidera${degrau}`;
    })
    .map((item) => item.uf);
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

/**
 * Eleitorado das UFs cujo agregado usou pesquisa DE DENTRO da janela de
 * recência. Exportada para teste: com os dados de hoje é ~99,2% do eleitorado
 * nacional no 2º turno (Rondônia fora) e ~96,6% no 1º (Mato Grosso e Piauí
 * fora), contra os 100% que o cabeçalho anunciava sozinho.
 */
export function eleitoradoDentroDaJanela(dados: PresidencialPorEstado): number {
  return dados.ufs.reduce(
    (total, item) =>
      item.agregado != null && !usouPesquisaForaDaJanela(item) && item.eleitores != null
        ? total + item.eleitores
        : total,
    0,
  );
}

/** Renderiza a tela "Presidente por estado" dentro de `container` (o `<main>` da app). */
export function renderPresidentialStates(container: HTMLElement, casos: CasosDeUso): void {
  container.innerHTML = '';

  const partidos = casos.listParties();

  // O turno vem do endereço (`#/presidente-estados?turno=2`), não de um
  // padrão fixo: o mapa de 2º turno tem URL própria, compartilhável, e um
  // reload não devolve o leitor ao 1º turno.
  let turno: Turno = turnoDoHash(window.location.hash);
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
  legendWrap.className = 'ps-map-legend-col';
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
      modo === 'lideranca'
        ? criarLegendaLideranca(dados, partidos)
        : criarLegendaEleitorado(dados, recorte),
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
    // `replaceState` em vez de atribuir `location.hash`: o endereço passa a
    // ser o do turno escolhido (compartilhável, sobrevive ao reload) sem
    // disparar `hashchange` — que faria o roteador de main.ts remontar a tela
    // inteira e perder a aba e o scroll de quem só apertou um botão.
    window.history.replaceState(null, '', hashDoTurno(turno));
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
      // Duas coberturas, porque são duas coisas diferentes: quanto do
      // eleitorado tem ALGUMA pesquisa estadual, e quanto tem pesquisa DENTRO
      // da janela de recência. Antes só a primeira aparecia, com uma casa
      // decimal ("cobre 100,0%") e duas linhas acima da ressalva que dizia que
      // Rondônia está fora da janela — precisão falsa ao lado do aviso que a
      // desmente. `pctCobertura` só imprime a casa decimal quando ela é real.
      const total = novos.eleitoradoNacional;
      const dentroDaJanela = eleitoradoDentroDaJanela(novos);
      const coberturaTotal = pctCobertura(novos.eleitoradoComPesquisa, total);
      const coberturaRecente = pctCobertura(dentroDaJanela, total);
      const ressalvaJanela =
        dentroDaJanela < novos.eleitoradoComPesquisa
          ? ` Com pesquisa de dentro da janela de ${JANELA_DIAS_PADRAO} dias: <strong>${escaparHtml(
              coberturaRecente,
            )}</strong>.`
          : '';
      metaEleitorado.innerHTML =
        `Eleitorado nacional: <strong>${escaparHtml(
          formatarEleitorado(total),
        )}</strong> de eleitores aptos. Pesquisa presidencial estadual de ${escaparHtml(
          recorte.rotulo,
        )} cobre <strong>${escaparHtml(coberturaTotal)}</strong> desse eleitorado.` + ressalvaJanela;
    } else {
      metaEleitorado.textContent = 'Eleitorado nacional: dado ainda não cadastrado.';
    }

    // A intro descreve o que a tinta CODIFICA — tamanho da vantagem —, não
    // "força da evidência": a contagem de pesquisas e a idade do dado não
    // entram no cálculo da opacidade, e prometê-las ali fazia a tela afirmar o
    // que o dado não sustenta (Rondônia, uma pesquisa de 15/07 fora da janela,
    // saía mais escura que São Paulo, três pesquisas em 19 dias).
    intro.textContent =
      `A cor do mapa mostra o espectro do partido que lidera a média ponderada de pesquisas presidenciais ` +
      `de ${recorte.rotulo} em cada estado; a opacidade indica só o tamanho da vantagem sobre o 2º colocado, ` +
      'em múltiplos da margem de erro daquele estado. A força da evidência vem em marcas que não cobrem área ' +
      'do estado, para não mexerem na tinta: o asterisco na sigla marca estado com uma única pesquisa e o ' +
      `contorno tracejado, estado cuja pesquisa está fora da janela de ${JANELA_DIAS_PADRAO} dias. ` +
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
  const dataUltima = ultima ? formatarData(dataPesquisa(ultima)) : '—';
  const institutoUltima = ultima ? ultima.instituto : '—';
  // A contagem de pesquisas anda junto com a vantagem: é a afirmação de
  // confiança e a base dela na mesma linha de leitura, não a duas telas de
  // distância (o `<details>` do painel).
  const vantagemTexto = item.empateTecnico
    ? `Empate técnico · ${rotuloContagemPesquisas(nPesquisasUsadas(item))}`
    : `${formatarVantagem(item.vantagem)} — ${rotuloConfianca(nivel)} · ${rotuloContagemPesquisas(
        nPesquisasUsadas(item),
      )}`;

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
  return `${nomeEstado}, ${recorte.rotulo}: ${item.lider} (${partido}) lidera com ${pontos} pontos${sufixo}. Base: ${procedenciaUf(
    item,
  )}.${sufixoRecencia(item)}`;
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

/* ================= Marcas de textura do mapa (patterns SVG) ================= */

/**
 * A ÚNICA textura que o mapa sobrepõe a um preenchimento: listras diagonais.
 * Duas faixas a usam, e só elas podem (ver `marcaDeAreaDaFaixa` em
 * presidential-states-layout.ts, que explica a medição):
 *
 * - empate técnico, na cor do FUNDO (`COR_HACHURA_EMPATE`) — subtrai tinta, o
 *   que só pode empurrar a UF na direção do zero da rampa, onde o empate já
 *   está. Antes era `corEspectroSolido`, que tirava 0,118 de luminância e punha
 *   os dois maiores empates do 1º turno mais escuros que dois estados que
 *   lideram;
 * - "sem dados", no cinza terciário — fora da rampa, sem matiz de espectro.
 *
 * Ressalva ortogonal à rampa (pesquisa única, dado fora da janela) NÃO entra
 * aqui: qualquer cobertura de área move o estado no canal que a legenda reserva
 * só para a vantagem. Elas saem em marcas que não cobrem área — asterisco na
 * sigla e contorno tracejado + âncora.
 */
const COR_HACHURA_EMPATE = 'var(--color-canvas)';

interface RegistroMarcas {
  readonly defs: SVGDefsElement;
  readonly ids: Map<string, string>;
  readonly prefixo: string;
}

/**
 * Constrói um `<pattern>` de hachura POR cor, com a cor num atributo explícito
 * do `<line>`.
 *
 * A versão anterior tinha um único `<pattern id="ps-mapa-hachura">` cuja
 * `<line>` usava `stroke="currentColor"`, e quem referenciava tentava tingir a
 * marca com `overlay.style.color`. Isso não tem efeito: dentro de um paint
 * server, `currentColor` resolve contra o próprio `<pattern>` — que vive no
 * `<defs>` —, não contra o elemento que o usa. Medido no navegador, a linha
 * resolvia sempre para `rgb(15, 16, 17)` (`--color-text`), nunca para a cor do
 * espectro. Consequências: Minas Gerais no 2º turno (empate técnico, duas
 * pesquisas de setembro, 2º maior eleitorado do país) saía com listra quase
 * preta a ~50% de cobertura sobre azul pálido e lia como "sem dados"; e o chip
 * "Empate técnico" da legenda (listra cinza clara sobre índigo) não se parecia
 * com a marca que o mapa desenhava. Com um pattern por cor, e com a legenda
 * chamando ESTE MESMO construtor, as duas não podem mais divergir.
 */
function construirPatternMarca(id: string, cor: string): SVGPatternElement {
  const pattern = document.createElementNS(SVG_NS, 'pattern');
  pattern.setAttribute('id', id);
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', '6');
  pattern.setAttribute('height', '6');
  pattern.setAttribute('patternTransform', 'rotate(45)');
  const linha = document.createElementNS(SVG_NS, 'line');
  linha.setAttribute('x1', '0');
  linha.setAttribute('y1', '0');
  linha.setAttribute('x2', '0');
  linha.setAttribute('y2', '6');
  linha.setAttribute('stroke', cor);
  linha.setAttribute('stroke-width', '2.2');
  pattern.appendChild(linha);
  return pattern;
}

/** Cria o `<defs>` do SVG e o registro que deduplica os patterns por cor. */
function criarRegistroMarcas(svg: SVGSVGElement, prefixo: string): RegistroMarcas {
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  return { defs, ids: new Map(), prefixo };
}

/** `url(#id)` da hachura nesta cor neste SVG, criando o `<pattern>` na primeira vez. */
function refMarca(registro: RegistroMarcas, cor: string): string {
  let id = registro.ids.get(cor);
  if (id == null) {
    id = `${registro.prefixo}-hachura-${registro.ids.size + 1}`;
    registro.defs.appendChild(construirPatternMarca(id, cor));
    registro.ids.set(cor, id);
  }
  return `url(#${id})`;
}

/** Cópia do polígono da UF só para carregar uma textura por cima do preenchimento. */
function overlayMarca(d: string, ref: string): SVGPathElement {
  const overlay = document.createElementNS(SVG_NS, 'path');
  overlay.setAttribute('d', d);
  overlay.setAttribute('fill', ref);
  overlay.setAttribute('pointer-events', 'none');
  overlay.setAttribute('aria-hidden', 'true');
  return overlay;
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

  const marcas = criarRegistroMarcas(svg, 'ps-mapa');

  const grupoEstados = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(grupoEstados);
  // Contornos das UFs marcadas (dado fora da janela de recência) vivem num
  // grupo SEPARADO, depois de TODOS os preenchimentos: quando o tracejado era
  // um `stroke` no próprio `<path>` de preenchimento, cada vizinho desenhado
  // depois pintava seu `stroke` branco por cima e o tracejado nunca fechava —
  // o Piauí aparecia com tracejado só no norte/oeste e na divisa com o Ceará,
  // virando uma linha aberta flutuando dentro da mancha vermelha do Nordeste
  // (não dava para saber se o marcado era o Piauí ou o Ceará). Aqui o
  // contorno fecha em 360°, e uma âncora dentro do polígono, junto ao rótulo,
  // resolve o caso de estado pequeno cercado de vizinhos da mesma cor.
  const grupoMarcas = document.createElementNS(SVG_NS, 'g');
  grupoMarcas.setAttribute('class', 'ps-map-marcas');
  grupoMarcas.setAttribute('aria-hidden', 'true');
  svg.appendChild(grupoMarcas);
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

    let corHachura: string | null = null;
    let marcarPesquisaUnica = false;
    let marcarForaDaJanela = false;
    if (modo === 'lideranca') {
      const espectro = espectroDoPartido(item.partido, partidos);
      const nivel: NivelConfianca = nivelConfianca(item.vantagem, margemUf(item), item.semDados);
      const faixa = faixaVantagemUf(item);
      path.style.fill = corEspectro(espectro, nivel);
      // A opacidade codifica UMA coisa: o tamanho da vantagem em múltiplos da
      // margem de erro do estado — o que a legenda rotula. As ressalvas de
      // evidência que ela não carrega (uma pesquisa só, dado fora da janela)
      // saem em marcas não-cromáticas logo abaixo, cada uma com item de
      // legenda; ver `faixaVantagem` em presidential-states-layout.ts.
      path.style.opacity = opacidadeVantagem(faixa);
      path.dataset.vantagem = faixa;
      path.setAttribute('aria-label', ariaLabelLideranca(loc.name, item, recorte));
      // A UF tem dado real, mas de fora da janela de recência (RO no 2º
      // turno; MT e PI no 1º). Marcar no próprio mapa evita que a cor sugira
      // um número tão fresco quanto o dos vizinhos — o desenho da marca sai
      // depois de todos os preenchimentos, em `grupoMarcas`.
      if (usouPesquisaForaDaJanela(item)) marcarForaDaJanela = true;
      marcarPesquisaUnica = temPesquisaUnicaUf(item);
      // A única porta por onde uma textura cobre o polígono, e ela só abre para
      // as duas faixas que não podem ser reordenadas por isso (ver
      // `marcaDeAreaDaFaixa`): o empate, com hachura na cor do fundo, e "sem
      // dados", no cinza terciário.
      const marcaArea = marcaDeAreaDaFaixa(faixa);
      if (marcaArea === 'fundo') corHachura = COR_HACHURA_EMPATE;
      else if (marcaArea === 'cinzaNeutro') corHachura = 'var(--color-text-tertiary)';
    } else {
      if (item.eleitores != null) {
        const classe = classificarPorQuantil(item.eleitores, breakpointsEleitorado);
        path.style.fill = `var(--ps-electorate-${classe + 1})`;
      } else {
        path.style.fill = 'var(--confidence-sem-dados-fill)';
        corHachura = 'var(--color-text-tertiary)';
      }
      path.style.opacity = '1';
      path.setAttribute('aria-label', ariaLabelEleitorado(loc.name, item, breakpointsEleitorado, recorte));
    }

    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-haspopup', 'dialog');
    grupoEstados.appendChild(path);

    if (corHachura) {
      grupoEstados.appendChild(overlayMarca(loc.path, refMarca(marcas, corHachura)));
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

    if (marcarForaDaJanela) desenharMarcaForaDaJanela(grupoMarcas, uf, loc.path, cx, cy);

    // Estado minúsculo (só o Distrito Federal, 22,3 × 12,9 px a 1280): a sigla
    // NÃO cabe dentro dele. Medido no DOM antes desta linha existir: dos 249 px
    // internos do DF, 26% eram pixel de rótulo (12,9% do contorno preto, 8,8%
    // do miolo branco) e a cor do próprio estado não aparecia entre as três
    // cores mais frequentes da sua própria área — o polígono existia e não
    // podia ser visto, apagando o único estado da faixa "Lidera por até 2× a
    // margem" no 2º turno. A sigla sai para fora, com uma linha-guia até o
    // polígono, e a tinta do estado fica visível.
    const rotuloForaDoPoligono = area < AREA_ROTULO_EXTERNO;
    const rotuloX = rotuloForaDoPoligono ? cx + DESLOCAMENTO_ROTULO_EXTERNO.dx : cx;
    const rotuloY = rotuloForaDoPoligono
      ? cy + DESLOCAMENTO_ROTULO_EXTERNO.dy
      : // Com a âncora dentro do estado, a sigla sobe um pouco para as duas não
        // se sobreporem (e para a âncora continuar visível com a sigla coberta).
        marcarForaDaJanela
        ? cy - ANCORA_RAIO - 1
        : cy;
    if (rotuloForaDoPoligono) desenharGuiaDoRotulo(grupoMarcas, cx, cy, rotuloX, rotuloY);

    const texto = document.createElementNS(SVG_NS, 'text');
    texto.setAttribute('x', String(rotuloX));
    texto.setAttribute('y', String(rotuloY));
    texto.setAttribute('class', 'ps-uf-label');
    if (area < AREA_ESCONDER_SIGLA_ESTREITO && !rotuloForaDoPoligono) {
      texto.classList.add('ps-uf-label--pequena');
    }
    texto.textContent = uf;
    // Pesquisa única: asterisco na sigla. É a ressalva de evidência que saiu do
    // canal de cor e NÃO pode voltar como marca de área — a hachura de poros
    // anterior (8,5% de cobertura na cor do fundo) clareava a UF em até +0,052
    // de luminância, mais que um degrau inteiro da rampa, e cobria 70,6% da área
    // de terra no 2º turno. O asterisco não cobre área do polígono: anda com a
    // sigla, some com ela, e a legenda mostra o mesmo glifo.
    if (marcarPesquisaUnica) texto.appendChild(tspanMarcaPesquisaUnica());
    grupoRotulos.appendChild(texto);
  }

  return svg;
}

const ANCORA_RAIO = 4.6;

/**
 * Área de bbox (em unidades do viewBox 613 × 639) abaixo da qual a sigla não
 * cabe dentro do polígono e sai para fora, com linha-guia. Só o Distrito
 * Federal fica abaixo dela nos dados reais: bbox de ~167 unidades², contra
 * ~1.159 do segundo menor (Sergipe) — o corte em 400 isola o caso real com
 * folga de quase 3× para os dois lados.
 */
const AREA_ROTULO_EXTERNO = 400;

/** Para onde a sigla de estado minúsculo vai, em unidades do viewBox. */
const DESLOCAMENTO_ROTULO_EXTERNO = { dx: 21, dy: -13 } as const;

/** Glifo de "uma única pesquisa" que acompanha a sigla do estado no mapa. */
const MARCA_PESQUISA_UNICA = '*';

/** `<tspan>` do asterisco de pesquisa única — mesma peça no mapa e na legenda. */
function tspanMarcaPesquisaUnica(): SVGTSpanElement {
  const marca = document.createElementNS(SVG_NS, 'tspan');
  marca.setAttribute('class', 'ps-uf-label__marca');
  marca.setAttribute('dy', '-1');
  marca.textContent = MARCA_PESQUISA_UNICA;
  return marca;
}

/**
 * Linha-guia da sigla que foi para fora do polígono (estado minúsculo): sai da
 * borda do texto e vai até o centro do estado, para que o leitor saiba a qual
 * polígono a sigla pertence quando ela está pousada sobre o vizinho.
 */
function desenharGuiaDoRotulo(
  grupo: SVGGElement,
  cxEstado: number,
  cyEstado: number,
  xRotulo: number,
  yRotulo: number,
): void {
  const guia = document.createElementNS(SVG_NS, 'line');
  guia.setAttribute('x1', String(cxEstado));
  guia.setAttribute('y1', String(cyEstado));
  guia.setAttribute('x2', String(xRotulo - 6));
  guia.setAttribute('y2', String(yRotulo + 3));
  guia.setAttribute('class', 'ps-uf-guia');
  guia.setAttribute('pointer-events', 'none');
  grupo.appendChild(guia);
}

/**
 * Marca de "dado fora da janela de recência" de uma UF, desenhada num grupo
 * acima de todos os preenchimentos:
 *
 * 1. cópia do `d` do estado com `fill="none"` e tracejado — o contorno fecha
 *    em 360° porque nenhum vizinho é pintado depois dele (o bug anterior era
 *    exatamente esse: o `stroke` branco do vizinho apagava trechos do
 *    tracejado, deixando uma linha aberta que não identificava o polígono);
 * 2. uma âncora DENTRO do estado, junto ao rótulo — contorno sozinho não
 *    basta quando o estado marcado é pequeno e está cercado de vizinhos da
 *    mesma cor. Com a âncora, dá para saber qual polígono está marcado mesmo
 *    cobrindo a sigla com o dedo.
 */
function desenharMarcaForaDaJanela(
  grupo: SVGGElement,
  uf: string,
  d: string,
  cx: number,
  cy: number,
): void {
  const contorno = document.createElementNS(SVG_NS, 'path');
  contorno.setAttribute('d', d);
  contorno.setAttribute('fill', 'none');
  contorno.setAttribute('class', 'ps-uf-marca');
  contorno.dataset.uf = uf;
  contorno.setAttribute('pointer-events', 'none');
  grupo.appendChild(contorno);

  const ancora = document.createElementNS(SVG_NS, 'circle');
  ancora.setAttribute('cx', String(cx));
  ancora.setAttribute('cy', String(cy + ANCORA_RAIO + 2));
  ancora.setAttribute('r', String(ANCORA_RAIO));
  ancora.setAttribute('class', 'ps-uf-ancora');
  ancora.setAttribute('pointer-events', 'none');
  grupo.appendChild(ancora);

  const miolo = document.createElementNS(SVG_NS, 'circle');
  miolo.setAttribute('cx', String(cx));
  miolo.setAttribute('cy', String(cy + ANCORA_RAIO + 2));
  miolo.setAttribute('r', '1.5');
  miolo.setAttribute('class', 'ps-uf-ancora__miolo');
  miolo.setAttribute('pointer-events', 'none');
  grupo.appendChild(miolo);
}

function criarItemLegenda(cor: string, rotulo: string): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const swatch = document.createElement('span');
  swatch.className = 'ps-legend-swatch';
  swatch.style.background = cor;
  swatch.setAttribute('aria-hidden', 'true');
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(swatch, texto);
  return item;
}

/** Contador só para manter únicos os ids de `<pattern>` dos chips da legenda. */
let psSeqChip = 0;

interface ChipMarca {
  /** Preenchimentos de base do chip (o que o mapa pinta antes da textura). */
  readonly coresBase: readonly string[];
  /** Opacidade do preenchimento de base, como no mapa. */
  readonly opacidadeBase?: string;
  /** Cor da textura — a MESMA que o mapa usa para essa marca. */
  readonly corMarca: string;
}

/**
 * Item de legenda cujo chip é desenhado pelo MESMO construtor de `<pattern>` do
 * mapa (`construirPatternMarca`), com a mesma geometria, a mesma cobertura e a
 * mesma cor de textura.
 *
 * Antes, o chip era um `<span>` com `--confidence-sem-dados-pattern` (listra
 * cinza clara de 4px sobre índigo) e o mapa desenhava listra de 3px em
 * `--color-text` sobre o azul pálido do estado: a legenda explicava uma marca
 * que não existia na tela. O `viewBox` do chip está na mesma escala de unidades
 * do mapa (19 unidades para 28px de chip, a mesma razão do mapa a 1280px), para
 * que o azulejo saia do mesmo tamanho na tela.
 */
function criarItemLegendaMarca(chip: ChipMarca, rotulo: string): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const svg = criarSvgChip();
  const marcas = criarRegistroMarcas(svg, `ps-chip-${++psSeqChip}`);
  desenharBaseDoChip(svg, chip.coresBase, chip.opacidadeBase);

  const textura = document.createElementNS(SVG_NS, 'rect');
  textura.setAttribute('width', String(CHIP_W));
  textura.setAttribute('height', String(CHIP_H));
  textura.setAttribute('fill', refMarca(marcas, chip.corMarca));
  svg.appendChild(textura);

  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(svg, texto);
  return item;
}

const CHIP_W = 19;
const CHIP_H = 9.5;

function criarSvgChip(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CHIP_W} ${CHIP_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'ps-legend-swatch ps-legend-swatch--marca');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

/**
 * Base do chip: uma faixa vertical por cor, para o chip poder mostrar TODAS as
 * cores que o mapa está usando naquele recorte em vez de uma cor que não está
 * lá. Os chips da rampa eram índigo (`--color-accent`), matiz que não existe no
 * mapa — o leitor tinha de casar vermelho saturado contra índigo, e o chip de
 * "mais de 8×" (L=0,238) ficava a ΔL=0,013 do chip "Centro-direita" do grupo
 * logo acima, dois significados encostados.
 */
function desenharBaseDoChip(svg: SVGSVGElement, cores: readonly string[], opacidade?: string): void {
  const lista = cores.length > 0 ? cores : ['var(--confidence-sem-dados-fill)'];
  const largura = CHIP_W / lista.length;
  lista.forEach((cor, i) => {
    const faixa = document.createElementNS(SVG_NS, 'rect');
    faixa.setAttribute('x', String(i * largura));
    faixa.setAttribute('width', String(largura));
    faixa.setAttribute('height', String(CHIP_H));
    faixa.setAttribute('fill', cor);
    if (opacidade) faixa.setAttribute('opacity', opacidade);
    svg.appendChild(faixa);
  });
}

/** Chip de faixa de vantagem: só o degrau de opacidade, nas cores que o mapa usa. */
function criarItemLegendaVantagem(
  coresDoMapa: readonly string[],
  opacidade: string,
  rotulo: string,
): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const svg = criarSvgChip();
  desenharBaseDoChip(svg, coresDoMapa, opacidade);
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(svg, texto);
  return item;
}

/**
 * Chip de "empate técnico": as cores do mapa na opacidade de empate + hachura na
 * cor do fundo, exatamente como o mapa pinta agora. Antes era índigo com hachura
 * índigo, e ficava a ΔL=0,007 do chip "Lidera por até 2×" e 0,07 mais claro que
 * qualquer empate real da tela — a legenda desenhava uma marca que o mapa não
 * tinha.
 */
function chipEmpate(coresDoMapa: readonly string[]): ChipMarca {
  return {
    coresBase: coresDoMapa,
    opacidadeBase: opacidadeVantagem('empate'),
    corMarca: COR_HACHURA_EMPATE,
  };
}

/** Chip de "sem dados": exatamente o par cinza que o mapa usa. */
function chipSemDados(): ChipMarca {
  return {
    coresBase: ['var(--confidence-sem-dados-fill)'],
    corMarca: 'var(--color-text-tertiary)',
  };
}

/**
 * Chip de "uma única pesquisa": a MESMA sigla com asterisco que o mapa desenha,
 * na mesma classe tipográfica (`.ps-uf-label`), sobre a primeira cor presente no
 * mapa. Não é mais uma textura: a marca deixou de cobrir área do polígono.
 */
function criarItemLegendaPesquisaUnica(coresDoMapa: readonly string[], rotulo: string): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ps-legend-item';
  const svg = criarSvgChip();
  desenharBaseDoChip(svg, coresDoMapa.slice(0, 1));
  const sigla = document.createElementNS(SVG_NS, 'text');
  sigla.setAttribute('x', String(CHIP_W / 2));
  sigla.setAttribute('y', String(CHIP_H / 2));
  sigla.setAttribute('class', 'ps-uf-label ps-legend-sigla');
  sigla.textContent = 'UF';
  sigla.appendChild(tspanMarcaPesquisaUnica());
  svg.appendChild(sigla);
  const texto = document.createElement('span');
  texto.textContent = rotulo;
  item.append(svg, texto);
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

/**
 * Trecho " (de ± 1,8 a ± 3,0 pontos neste recorte)" para a nota da legenda,
 * lido das margens reais dos agregados — nunca um intervalo inventado. Vazio
 * quando não há agregado nenhum; sem faixa quando todas as margens são iguais.
 */
/**
 * Espectros efetivamente pintados no mapa "Quem lidera" deste recorte, na ordem
 * canônica da escala ideológica. É a lista que a legenda descreve e a paleta que
 * os chips da rampa de vantagem usam — nunca uma cor que não está na tela.
 */
function espectrosNoMapa(dados: PresidencialPorEstado, partidos: Partidos): Espectro[] {
  const presentes = new Set<Espectro>();
  for (const item of dados.ufs) {
    if (item.semDados || !item.lider) continue;
    presentes.add(espectroDoPartido(item.partido, partidos));
  }
  const ordem: readonly Espectro[] = [...ESPECTROS_LEGENDA, 'indefinido'];
  return ordem.filter((e) => presentes.has(e));
}

function textoFaixaDeMargens(dados: PresidencialPorEstado): string {
  const margens = dados.ufs
    .map((u) => u.agregado?.margemReferencia)
    .filter((m): m is number => m != null);
  if (margens.length === 0) return '';
  const min = Math.min(...margens);
  const max = Math.max(...margens);
  if (min === max) return ` (± ${formatarNumeroPt(min)} pontos neste recorte)`;
  return ` (de ± ${formatarNumeroPt(min)} a ± ${formatarNumeroPt(max)} pontos neste recorte)`;
}

function criarLegendaLideranca(dados: PresidencialPorEstado, partidos: Partidos): HTMLElement {
  const legenda = document.createElement('div');
  legenda.className = 'ps-legend';
  legenda.setAttribute('aria-label', 'Legenda do mapa — quem lidera');

  // Só os espectros que a tela está PINTANDO. A regra já valia para o grupo de
  // ressalvas ("legenda de marca que não está no mapa seria ruído") e não estava
  // sendo aplicada aqui: os dois recortes só têm esquerda (PT) e direita (PL), e
  // a legenda listava seis espectros — quatro linhas descrevendo estado nenhum,
  // mais a linha "Sem dados", que também era incondicional. Eram 5 das 12 linhas
  // da legenda sem referente na tela.
  const espectros = espectrosNoMapa(dados, partidos);
  const grupoEspectro = document.createElement('div');
  grupoEspectro.className = 'ps-legend-grupo';
  const tituloEspectro = document.createElement('h3');
  tituloEspectro.className = 'ps-legend-grupo__titulo';
  tituloEspectro.textContent = 'Espectro do partido líder';
  grupoEspectro.appendChild(tituloEspectro);
  const listaEspectro = document.createElement('ul');
  listaEspectro.className = 'ps-legend-lista';
  for (const espectro of espectros) {
    listaEspectro.appendChild(criarItemLegenda(corEspectro(espectro, 'solid'), rotuloEspectro(espectro)));
  }
  grupoEspectro.appendChild(listaEspectro);
  legenda.appendChild(grupoEspectro);

  // O título diz o que a tinta CODIFICA, não o que o leitor gostaria que ela
  // significasse: a opacidade mede o tamanho da vantagem em margens de erro, e
  // só isso. Enquanto o grupo se chamava "Confiança da liderança" e o degrau
  // descia um passo nas UFs de pesquisa única, 15 das 27 UFs do 2º turno (e 4
  // das 27 do 1º) ficavam pintadas numa faixa cujo rótulo era falso sobre
  // elas — Rondônia lidera por 21,0× a margem e saía na faixa "4× a 8×".
  const grupoVantagem = document.createElement('div');
  grupoVantagem.className = 'ps-legend-grupo';
  const tituloVantagem = document.createElement('h3');
  tituloVantagem.className = 'ps-legend-grupo__titulo';
  tituloVantagem.textContent = 'Vantagem do líder, em margens de erro';
  grupoVantagem.appendChild(tituloVantagem);
  const listaVantagem = document.createElement('ul');
  listaVantagem.className = 'ps-legend-lista';
  // 4 degraus de liderança, do mais forte ao mais fraco, na mesma ordem em que
  // a tinta escurece. Estes quatro ficam SEMPRE (ao contrário das linhas
  // categóricas do resto da legenda): são os degraus de uma escala contínua, e
  // omitir um degrau vazio deixaria os vizinhos ambíguos sobre a amplitude. Nos
  // dados de hoje nenhum deles está vazio nos dois recortes.
  const coresDoMapa = espectros.map((e) => corEspectro(e, 'solid'));
  for (const faixa of ['lidera4', 'lidera3', 'lidera2', 'lidera1'] as const) {
    listaVantagem.appendChild(
      criarItemLegendaVantagem(coresDoMapa, opacidadeVantagem(faixa), rotuloFaixaVantagem(faixa)),
    );
  }
  // Empate e "sem dados" são categorias, não degraus: entram só quando há UF
  // naquela situação. "Sem dados" descreve zero UFs nos dois recortes de hoje.
  if (dados.ufs.some((item) => faixaVantagemUf(item) === 'empate')) {
    listaVantagem.appendChild(criarItemLegendaMarca(chipEmpate(coresDoMapa), rotuloFaixaVantagem('empate')));
  }
  if (dados.ufs.some((item) => item.semDados)) {
    listaVantagem.appendChild(criarItemLegendaMarca(chipSemDados(), rotuloConfianca('semDados')));
  }
  grupoVantagem.appendChild(listaVantagem);

  // Sem esta nota, a escada parece quebrada (no 2º turno o Amapá com +4,0 sai
  // mais forte que o Distrito Federal com +4,9, porque a margem de erro de
  // cada estado é diferente).
  const notaVantagem = document.createElement('p');
  notaVantagem.className = 'ps-legend-nota';
  notaVantagem.textContent =
    `A escala é relativa à margem de erro de cada estado${textoFaixaDeMargens(dados)}: ` +
    'por isso uma vantagem menor pode aparecer mais forte que uma maior. ' +
    'A tinta não diz quantas pesquisas sustentam o número nem de quando elas são — ' +
    'isso está nas marcas abaixo e na linha de procedência de cada estado.';
  grupoVantagem.appendChild(notaVantagem);
  legenda.appendChild(grupoVantagem);

  // Ressalvas de evidência, em canais não-cromáticos: são elas que carregam o
  // que a opacidade deixou de afirmar. Cada item só aparece quando há UF
  // naquela situação — legenda de marca que não está no mapa seria ruído.
  const unicas = dados.ufs.filter((item) => temPesquisaUnicaUf(item));
  const fora = ufsComDadoForaDaJanela(dados);
  if (unicas.length > 0 || fora.length > 0) {
    const grupoEvidencia = document.createElement('div');
    grupoEvidencia.className = 'ps-legend-grupo';
    const tituloEvidencia = document.createElement('h3');
    tituloEvidencia.className = 'ps-legend-grupo__titulo';
    tituloEvidencia.textContent = 'Ressalvas sobre a evidência';
    grupoEvidencia.appendChild(tituloEvidencia);
    const listaEvidencia = document.createElement('ul');
    listaEvidencia.className = 'ps-legend-lista';
    if (unicas.length > 0) {
      listaEvidencia.appendChild(
        criarItemLegendaPesquisaUnica(
          coresDoMapa,
          `Asterisco na sigla: uma única pesquisa neste recorte (${unicas.length} de ${dados.ufs.length} estados)`,
        ),
      );
    }
    if (fora.length > 0) {
      listaEvidencia.appendChild(
        criarItemLegendaForaDaJanela(
          `Pesquisa fora da janela de ${JANELA_DIAS_PADRAO} dias (${listaEmPortugues(fora.map((u) => u.nome))})`,
        ),
      );
    }
    grupoEvidencia.appendChild(listaEvidencia);
    legenda.appendChild(grupoEvidencia);
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
    lista.appendChild(criarItemLegendaMarca(chipSemDados(), 'Eleitorado não cadastrado'));
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
const MINI_PAD_RIGHT = 42;
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

  // A seção prometia "a série" para todos os estados; no 2º turno, 13 dos 27
  // têm pesquisa de uma única data e não há série nenhuma para desenhar — o
  // texto agora diz quantos são, contado do próprio dado.
  const comDados = dados.ufs.filter((u) => !u.semDados && u.agregado?.lider);
  const pontoUnico = comDados.filter(ehPontoUnico).length;
  const notaPontoUnico =
    pontoUnico > 0
      ? ` Em ${pontoUnico} ${pluralizar(pontoUnico, 'estado', 'estados')} há pesquisa de uma única data: ` +
        `não existe série a traçar, e o cartão mostra o ponto único com a data, não um gráfico.`
      : '';

  // Quantas pesquisas a seção desenha sem amostra publicada, contado do próprio
  // dado: o ponto vazado precisa ser declarado em algum lugar, e antes o tamanho
  // do ponto afirmava a amostra sem que nenhuma legenda dissesse.
  //
  // A conta EXCLUÍA os cartões de ponto único (`.filter((u) => !ehPontoUnico(u))`),
  // que são justamente os que têm uma pesquisa só — e o marcador de ponto único
  // também não tinha o ramo de amostra ausente. No 2º turno isso escondia o Rio
  // de Janeiro (uma pesquisa, Datafolha de 10/09, `amostra: null`): o cartão
  // desenhava disco cheio e a nota dizia 2 quando os glifos sem amostra na tela
  // são 3 (RJ, MS e Goiás). Agora os dois lados saem do mesmo conjunto.
  const semAmostra = pesquisasSemAmostraDesenhadas(dados);
  const notaSemAmostra =
    semAmostra > 0
      ? ` Cada ponto é uma das pesquisas usadas; ${semAmostra} ${pluralizar(semAmostra, 'delas', 'delas')} ` +
        `não ${pluralizar(semAmostra, 'publicou', 'publicaram')} a amostra e ${pluralizar(
          semAmostra,
          'aparece',
          'aparecem',
        )} como anel vazado.`
      : ' Cada ponto é uma das pesquisas usadas.';

  const intro = document.createElement('p');
  intro.className = 'ps-meta';
  intro.textContent =
    `Cada miniatura traz a série de pesquisas de ${recorte.rotulo} do estado, quando há pesquisas de datas ` +
    `diferentes.${notaPontoUnico}${notaSemAmostra} ` +
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

  // Procedência logo sob o eleitorado: quantas pesquisas sustentam o título do
  // cartão, e de quando. A ressalva de recência entra NA MESMA linha, em peso
  // e cor mais leves que o dado: antes ela era um parágrafo próprio de duas
  // linhas, mais forte que o subtítulo do eleitorado, e empurrava o sparkline
  // para baixo desalinhando o cartão dos vizinhos da fileira.
  const metaP = document.createElement('p');
  metaP.className = 'ps-card__meta';
  metaP.textContent = procedenciaUf(item);
  if (usouPesquisaForaDaJanela(item)) {
    btn.classList.add('ps-card--fora-janela');
    const ressalva = document.createElement('span');
    ressalva.className = 'ps-card__ressalva';
    ressalva.textContent = ' · fora da janela';
    ressalva.title = rotuloForaDaJanela(dataUltimaPesquisa(item));
    metaP.appendChild(ressalva);
  }
  btn.appendChild(metaP);

  // Uma única data de pesquisa não é gráfico: sem eixo, sem baseline de 50% e
  // sem ponto duplicado (a Bahia desenhava, por candidato, uma bolinha pálida
  // no meio e outra sólida à direita com o MESMO valor, que se lia como falha
  // de renderização). Marcador único rotulado com a data, e o cartão diz isso.
  const datasDesenhadas = datasDesenhadasUf(item);
  btn.appendChild(
    temEvolucaoParaLinha(datasDesenhadas)
      ? construirMiniGrafico(item.agregado, item.serie, partidos)
      : construirMarcadorUnico(item.agregado, datasDesenhadas, partidos),
  );


  btn.addEventListener('click', () => abrirPainelUf(item, nome, btn, hostElement, partidos, recorte));

  return btn;
}

function descricaoAcessivelMiniGrafico(candidatos: readonly CandidatoAgregado[]): string {
  const partes = candidatos.map((c) => `${c.candidato} ${formatarPct(c.pct, 1)}`);
  return `Gráfico de tendência das pesquisas presidenciais estaduais ao longo do tempo: ${partes.join(', ')} na média atual.`;
}

/**
 * Marcador de ponto único: o que aparece no lugar do mini-gráfico quando o
 * estado só tem pesquisa de UMA data (13 dos 27 estados no 2º turno, 3 no
 * 1º). Não é gráfico e não finge ser: sem eixo temporal, sem baseline de 50%
 * e, principalmente, sem as DUAS bolinhas do mesmo valor que o sparkline
 * desenhava nesse caso (uma pálida no meio, "o ponto da pesquisa", e uma
 * sólida à direita, "a média atual" — o mesmo número duas vezes, que o leitor
 * lia como falha de renderização). Aqui é um ponto por candidato, rotulado, e
 * a data dita por extenso.
 *
 * O glifo segue a MESMA regra do sparkline (`formaDoPonto`): anel vazado quando
 * a fonte não publicou o tamanho da amostra. Este ramo não existia — o `fill`
 * era pintado incondicionalmente —, então o Rio de Janeiro no 2º turno (uma
 * pesquisa, Datafolha de 10/09, `amostra: null`) desenhava disco cheio, o glifo
 * que em todo o resto da tela significa "amostra publicada".
 */
function construirMarcadorUnico(
  agregado: Agregado,
  datasDesenhadas: readonly string[],
  partidos: Partidos,
): SVGSVGElement {
  const candidatos = agregado.candidatos.slice(0, 2);
  const dataIso = datasDesenhadas[0] ?? dataPesquisa(agregado.ultimaPesquisa);
  const dataTexto = dataIso ? formatarData(dataIso) : null;
  const forma = formaDoPonto(agregado.pesquisasUsadas.map((p) => p.amostra ?? null));
  const semAmostra = forma === 'anel';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MINI_W} ${MINI_H}`);
  svg.setAttribute('class', 'ps-mini-chart ps-mini-ponto');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  const partes = candidatos.map((c) => `${c.candidato} ${formatarPct(c.pct, 1)}`);
  svg.setAttribute(
    'aria-label',
    `Uma única pesquisa${dataTexto ? `, de ${dataTexto}` : ''}: ${partes.join(', ')}.${
      semAmostra ? ' A fonte não publicou o tamanho da amostra.' : ''
    } Sem série temporal para traçar neste estado.`,
  );

  candidatos.forEach((candidato, i) => {
    const cor = corEspectroSolido(espectroDoPartido(candidato.partido, partidos));
    const y = 26 + i * 26;

    const ponto = document.createElementNS(SVG_NS, 'circle');
    ponto.setAttribute('cx', '12');
    ponto.setAttribute('cy', String(y));
    if (semAmostra) {
      ponto.setAttribute('r', '4');
      ponto.setAttribute('fill', 'none');
      // `stroke` vai no `style`, não em atributo: `.ps-mini-ponto__marca` pinta
      // um halo em `--color-surface-1` no `stroke`, e qualquer declaração de
      // folha de estilo vence um atributo de apresentação — o anel sairia da cor
      // do cartão, invisível.
      ponto.style.stroke = cor;
      ponto.setAttribute('class', 'ps-mini-ponto__marca ps-mini-ponto__marca--sem-amostra');
    } else {
      ponto.setAttribute('r', '5');
      ponto.setAttribute('fill', cor);
      ponto.setAttribute('class', 'ps-mini-ponto__marca');
    }
    svg.appendChild(ponto);

    const nome = document.createElementNS(SVG_NS, 'text');
    nome.setAttribute('x', '24');
    nome.setAttribute('y', String(y + 4));
    nome.setAttribute('class', 'ps-mini-ponto__nome');
    nome.textContent = nomeCurtissimo(candidato.candidato);
    svg.appendChild(nome);

    const pct = document.createElementNS(SVG_NS, 'text');
    pct.setAttribute('x', String(MINI_W - 4));
    pct.setAttribute('y', String(y + 4));
    pct.setAttribute('class', 'ps-mini-ponto__pct');
    // Mesma casa decimal do título do cartão, senão "+4,9" aparece sobre
    // "47%" e "43%" (Distrito Federal, 2º turno) — uma conta que dá 4.
    pct.textContent = formatarPct(candidato.pct, 1);
    svg.appendChild(pct);
  });

  const nota = document.createElementNS(SVG_NS, 'text');
  nota.setAttribute('x', '2');
  nota.setAttribute('class', 'ps-mini-ponto__nota');
  // A ressalva da amostra fica em LINHA PRÓPRIA, não emendada na nota da data: o
  // texto corrido não cabe nas 240 unidades do viewBox (medido: a frase única
  // saía cortada em "— se" no cartão do Rio de Janeiro). O anel sozinho não se
  // explica num cartão sem legenda de glifo, e a nota da seção fala de "anel
  // vazado" — é esta linha que liga as duas coisas.
  nota.setAttribute('y', String(semAmostra ? MINI_H - 18 : MINI_H - 6));
  nota.textContent = dataTexto
    ? `Uma só data: ${dataTexto} — sem série a traçar`
    : 'Uma só data de pesquisa — sem série a traçar';
  svg.appendChild(nota);

  if (semAmostra) {
    const ressalva = document.createElementNS(SVG_NS, 'text');
    ressalva.setAttribute('x', '2');
    ressalva.setAttribute('y', String(MINI_H - 6));
    ressalva.setAttribute('class', 'ps-mini-ponto__nota');
    ressalva.textContent = 'Amostra não publicada — anel vazado';
    svg.appendChild(ressalva);
  }

  return svg;
}

/**
 * Mini-gráfico de tendência (estilo NYT): um ponto por pesquisa USADA pelo
 * agregado — as mesmas que o rótulo de procedência do cartão declara, nunca
 * mais que isso — e uma linha suavizada por candidato (2 primeiros do
 * agregado) que termina no valor atual da média ponderada, rotulado no fim.
 * Todos os pontos têm o mesmo raio; o anel vazado marca pesquisa cuja amostra
 * não foi publicada. Sem eixos, exceto a linha de base em 50% (o limiar de
 * empate técnico) e seu rótulo. Com apenas 1 data desenhada não há linha
 * (nada para suavizar/tender) e o cartão troca o gráfico pelo marcador de
 * ponto único.
 */
function construirMiniGrafico(agregado: Agregado, serie: SerieTemporal, partidos: Partidos): SVGSVGElement {
  const candidatos = agregado.candidatos.slice(0, 2);

  // Os pontos desenhados são EXATAMENTE as pesquisas que o agregado usou — as
  // mesmas que o rótulo de procedência do cartão declara. `serie.pontos` traz
  // todas as pesquisas da disputa, inclusive as que a janela de recência
  // descartou, e o cartão acabava afirmando uma base e desenhando outra
  // (Piauí, 2º turno: "1 pesquisa · 16/09/2026" com pontos em 21/06 e 16/09 e
  // uma tendência sobre 87 dias de vão; ver `pontosDaBase`).
  const idsUsados = new Set(agregado.pesquisasUsadas.map((p) => p.id));
  const pontosPorCandidato = candidatos.map((c) =>
    pontosDaBase(
      serie.pontos.filter((p) => p.candidato === c.candidato),
      idsUsados,
    ).sort((a, b) => a.data.localeCompare(b.data)),
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

  // Reserva a largura equivalente ao raio do ponto + 2px como padding
  // esquerdo: sem isso, o ponto mais antigo (mapeado para x=0 pela escala)
  // fica com o centro do círculo na borda esquerda do viewBox e é cortado
  // ao meio (bug confirmado via DOM em 20 de 27 mini-gráficos por estado).
  const padEsquerdo = padEsquerdoMiniChart();
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

  // O rótulo "50%" da linha de base sai na mesma coluna dos rótulos de fim, e
  // some quando um deles chega perto: com a Bahia (55,3) ou o Ceará (58,4), os
  // dois textos caíam um sobre o outro e nenhum dos dois se lia. A linha de
  // base continua desenhada — o que se perde é só a repetição do rótulo.
  if (rotuloYs.every((y) => Math.abs(y - yBase) >= 14)) {
    const baselineLabel = document.createElementNS(SVG_NS, 'text');
    baselineLabel.setAttribute('x', String(padEsquerdo + larguraPlot + 3));
    baselineLabel.setAttribute('y', String(yBase + 3));
    baselineLabel.setAttribute('class', 'ps-mini-chart__baseline-label');
    baselineLabel.textContent = '50%';
    svg.appendChild(baselineLabel);
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
      // Todo ponto tem o mesmo raio. O que a amostra tem de informativo e
      // legível é se ela FOI PUBLICADA: sem amostra, o ponto vira anel vazado
      // em vez de ser desenhado do tamanho de uma pesquisa de mil
      // entrevistados (ver `RAIO_PONTO` em presidential-states-layout.ts).
      if (p.amostra == null) {
        circulo.setAttribute('r', String(RAIO_PONTO - 1));
        circulo.setAttribute('fill', 'none');
        circulo.setAttribute('stroke', cor);
        circulo.setAttribute('class', 'ps-mini-chart__ponto ps-mini-chart__ponto--sem-amostra');
      } else {
        circulo.setAttribute('r', String(RAIO_PONTO));
        circulo.setAttribute('fill', cor);
        circulo.setAttribute('class', 'ps-mini-chart__ponto');
      }
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
    // Uma casa decimal, a mesma do título do cartão. Com inteiros, o Distrito
    // Federal no 2º turno mostrava "Flávio +4,9" sobre "47%" e "43%" — dois
    // números que dão 4, contradizendo o título em quase um ponto. O "%" sai:
    // a linha de base já está rotulada "50%" e o espaço é o que é.
    const rotulo = document.createElementNS(SVG_NS, 'text');
    rotulo.setAttribute('x', String(finalCoord.x + 5));
    rotulo.setAttribute('y', String(rotuloY + 3));
    rotulo.setAttribute('class', 'ps-mini-chart__rotulo');
    rotulo.textContent = formatarNumeroPt(candidato.pct);
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

/**
 * Exportada para teste: o invariante que interessa é que a nota de soma fale
 * das linhas que estão de fato desenhadas. Um `.slice()` na lista de
 * candidatos já fez a tela afirmar 99,2% sobre linhas que somavam 96,2%,
 * escondendo um candidato real, e só um teste sobre o HTML pega isso.
 */
export function psMontarConteudo(
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
  // O selo afirma a confiança; a contagem de pesquisas vem junto, no mesmo
  // selo, antes de o leitor abrir o `<details>`. Um "LIDERA COM FOLGA" sozinho
  // sobre uma única pesquisa de amostra não informada prometia mais do que o
  // dado sustenta.
  const contagem = rotuloContagemPesquisas(agregado.pesquisasUsadas.length);
  const seloEmpate = agregado.empateTecnico
    ? `<span class="pill pill--empate">EMPATE TÉCNICO · ${escaparHtml(contagem)}</span>`
    : `<span class="pill pill--confianca">${rotuloConfianca(nivel)} · ${escaparHtml(contagem)}</span>`;

  const maxPct = Math.max(...agregado.candidatos.map((c) => c.pct), 1);
  const nUsadas = agregado.pesquisasUsadas.length;
  // Sem corte: a lista tinha um `.slice(0, 6)` que escondia candidatos reais
  // (Romeu Zema com 3,0% em SP no 1º turno) enquanto a nota de soma somava a
  // lista inteira — a tela afirmava 99,2% sobre linhas que somavam 96,2%.
  // `candidatosVisiveis` é a única fonte tanto do desenho quanto da soma, para
  // que as duas não possam divergir de novo.
  const candidatosVisiveis = agregado.candidatos;
  const listaCandidatos = candidatosVisiveis
    .map((c) => psRenderBarraCandidato(c, maxPct, agregado.margemReferencia, partidos, nUsadas))
    .join('');

  // Cada linha de "outros" diz de quantas pesquisas o número saiu quando não
  // saiu de todas: no Ceará (2º turno), das 3 pesquisas do confronto só 1
  // publica brancos/nulos, e é essa assimetria — não um erro de conta — que
  // faz o recorte somar 102,4%.
  const listaNaoRankeados = agregado.outros.length
    ? `<p class="ps-panel__outros">Outros: ${agregado.outros
        .map((o) => {
          const base = rotuloBaseParcial(o.pesquisas, nUsadas);
          const ressalva = base ? ` <span class="ps-panel__parcial">(${escaparHtml(base)})</span>` : '';
          return `${escaparHtml(o.candidato)} ${formatarPct(o.pct)}${ressalva}`;
        })
        .join(', ')}</p>`
    : '';

  // A soma das linhas mostradas quase nunca fecha 100% (só 32 dos 125
  // recortes ficam entre 97% e 103%). O painel diz isso em vez de deixar o
  // leitor supor que o que falta é zero — ou que a conta está errada quando
  // passa de 100.
  const soma = [...candidatosVisiveis, ...agregado.outros].reduce((total, c) => total + c.pct, 0);
  const textoSoma = notaSomaDoPainel(soma, undefined, recorte.turno);
  const notaSoma = textoSoma ? `<p class="ps-panel__soma">${escaparHtml(textoSoma)}</p>` : '';

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
      ${notaSoma}
      ${psRenderListaPesquisas(agregado)}
    </section>
  `;
}

function psRenderBarraCandidato(
  c: CandidatoAgregado,
  maxPct: number,
  margemReferencia: number,
  partidos: Partidos,
  nUsadas: number,
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
  // Um candidato testado por 1 das 4 pesquisas era desenhado com a mesma barra
  // e a mesma tipografia de outro testado pelas 4, sob um selo que diz "4
  // PESQUISAS" e um rodapé que promete média ponderada. O painel já declarava
  // isso nas linhas de "outros"; passa a declarar também nas de candidato.
  const base = rotuloBaseParcial(c.pesquisas, nUsadas);
  const ressalvaBase = base
    ? `<span class="ps-bar-row__parcial">${escaparHtml(base)}</span>`
    : '';
  return `
    <li class="ps-bar-row">
      <span class="ps-bar-row__info">
        <span class="ps-bar-row__nome" title="${escaparHtml(rotuloCompleto)}">${escaparHtml(c.candidato)}</span>
        ${badgePartido}
        ${ressalvaBase}
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
  // Com uma única pesquisa não existe média a ponderar: dizer "média ponderada
  // por recência e tamanho de amostra" logo abaixo de "Ver a 1 pesquisa usada"
  // descrevia um cálculo que não aconteceu.
  const metodologia =
    nPesquisasUsadas(item) <= 1
      ? 'Uma única pesquisa neste recorte — não há média a ponderar: o número é o dela.'
      : 'Média ponderada por recência e tamanho de amostra.';
  return `
    <p class="ps-panel__ultima">Última pesquisa deste recorte em ${formatarData(data)}.</p>
    <p class="ps-panel__metodologia">${metodologia} <a href="#/presidente">Como calculamos</a>.</p>
  `;
}
