import { carregarDados } from '../../outbound/json/carregar-dados.js';
import { criarCasosDeUso, type CasosDeUso } from '../../../application/use-cases/index.js';
import type { Clock } from '../../../application/ports.js';
import { formatarData } from './format.js';
import { renderMap } from './views/map-view.js';
/**
 * `rotaDoHash` (função pura, testada em
 * views/__tests__/presidential-states-hash.test.ts) separa a ROTA dos
 * parâmetros do hash: uma tela pode guardar estado no próprio endereço (ex.:
 * `#/presidente-estados?turno=2`, o 2º turno com URL própria e resistente a
 * reload) e continuar sendo a mesma rota para o roteador e para o item ativo
 * da navegação. Fica ao lado de `turnoDoHash`, que lê o parâmetro, para as
 * duas leituras do hash nunca divergirem.
 */
import { rotaDoHash } from './views/presidential-states-layout.js';
import { fecharPainelEstado } from './views/state-panel.js';
import './styles/tokens.css';
import './styles/app.css';
import './styles/views.css';

/**
 * Bootstrap: carrega os dados, monta os casos de uso e liga o roteador por
 * hash. Router simples — sem histórico de estado além do próprio hash.
 *
 * As telas de presidente/senado/partidos são escritas por outro agente em
 * paralelo e podem ainda não existir no disco. `import.meta.glob` (recurso
 * do Vite) resolve isso sem quebrar o build: arquivos ausentes simplesmente
 * não aparecem no mapa abaixo, ao contrário de um `import()` dinâmico comum
 * com caminho literal, que o bundler tentaria resolver e falharia se o
 * arquivo não existir.
 */

type ModuloPagina = Record<string, unknown>;

const paginasOpcionais = import.meta.glob<ModuloPagina>('./views/*.ts');

interface Rota {
  readonly hash: string;
  readonly rotulo: string;
}

const ROTAS: readonly Rota[] = [
  { hash: '#/inicio', rotulo: 'Início' },
  { hash: '#/mapa', rotulo: 'Governadores' },
  { hash: '#/presidente', rotulo: 'Presidente' },
  { hash: '#/presidente-estados', rotulo: 'Presidente por estado' },
  { hash: '#/senado', rotulo: 'Senado' },
  { hash: '#/partidos', rotulo: 'Partidos' },
  { hash: '#/pesquisas', rotulo: 'Base de pesquisas' },
];

const clockReal: Clock = {
  hoje: () => new Date(),
};

function montarLayout(atualizadoEm: string): { main: HTMLElement; nav: HTMLElement } {
  const app = document.getElementById('app');
  if (!app) throw new Error('Elemento #app não encontrado em index.html.');
  app.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'site-header';

  const titulo = document.createElement('a');
  titulo.className = 'site-header__titulo';
  titulo.href = '#/mapa';
  titulo.textContent = 'Mapa das Pesquisas 2026';

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Navegação principal');
  const lista = document.createElement('ul');
  nav.appendChild(lista);
  for (const rota of ROTAS) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = rota.hash;
    link.textContent = rota.rotulo;
    link.className = 'site-nav__link';
    li.appendChild(link);
    lista.appendChild(li);
  }

  const meta = document.createElement('p');
  meta.className = 'site-header__atualizado';
  meta.textContent = `Atualizado em ${formatarData(atualizadoEm)}`;

  header.append(titulo, nav, meta);

  const main = document.createElement('main');
  main.id = 'app-main';
  main.className = 'app-main';
  main.tabIndex = -1;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <p>
      Mapa: <a href="https://github.com/VictorCazanov/svg-maps" target="_blank" rel="noopener noreferrer">@svg-maps/brazil</a>
      (CC BY 4.0)<span class="sr-only"> — abre em nova aba</span>.
    </p>
    <p>Fontes: institutos de pesquisa e veículos de imprensa citados em cada pesquisa individual, com registro no TSE quando disponível.</p>
  `;

  app.append(header, main, footer);
  return { main, nav };
}

function normalizarHash(hash: string): string {
  if (!hash || hash === '#' || hash === '') return '#/inicio';
  return hash;
}

function mostrarEmConstrucao(main: HTMLElement): void {
  const aviso = document.createElement('div');
  aviso.className = 'app-main__em-construcao';
  aviso.innerHTML = `
    <h2>Em construção</h2>
    <p>Esta tela ainda não está disponível. Volte para o <a href="#/mapa">mapa de governadores</a>.</p>
  `;
  main.appendChild(aviso);
}

/**
 * Espera de fato antes da 2ª tentativa de `import()` — dá tempo do soluço
 * transitório (proxy, deploy reescrevendo `dist/assets/` no meio da
 * requisição, bloqueador de conteúdo) passar antes de tentar de novo.
 */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Carrega o módulo da rota e invoca sua função de render; lança se algo der errado (chamador decide o fallback). */
async function carregarERenderizar(
  carregar: () => Promise<ModuloPagina>,
  caminho: string,
  nomeFuncao: string,
  main: HTMLElement,
  casos: CasosDeUso,
): Promise<void> {
  const mod = await carregar();
  const render = mod[nomeFuncao];
  if (typeof render !== 'function') {
    throw new Error(`Módulo "${caminho}" não exporta "${nomeFuncao}".`);
  }
  (render as (main: HTMLElement, casos: CasosDeUso) => void)(main, casos);
}

/**
 * Carrega uma tela opcional (presidente/senado/partidos) e chama sua função
 * de render, com fallback "Em construção" só depois de 2 tentativas.
 *
 * Uma falha de rede transitória no `import()` dinâmico (ex.: "Unable to
 * preload CSS for /assets/...css" quando um deploy reescreve `dist/assets/`
 * no meio da requisição, ou um soluço de proxy/bloqueador de conteúdo) faz
 * a tela inteira parecer "não implementada" para quem a visita — mesmo
 * sendo uma tela funcional, sem nenhum jeito de tentar de novo a não ser
 * recarregar a página inteira. Por isso, antes de desistir e mostrar o
 * fallback genérico, tenta o `import()` mais uma vez após um pequeno atraso.
 */
async function renderPaginaOpcional(
  main: HTMLElement,
  casos: CasosDeUso,
  caminho: string,
  nomeFuncao: string,
): Promise<void> {
  const carregar = paginasOpcionais[caminho];
  if (!carregar) {
    mostrarEmConstrucao(main);
    return;
  }
  try {
    await carregarERenderizar(carregar, caminho, nomeFuncao, main, casos);
  } catch (primeiroErro) {
    console.warn(`Falha ao carregar ${caminho} (tentando de novo em 300ms):`, primeiroErro);
    await esperar(300);
    try {
      await carregarERenderizar(carregar, caminho, nomeFuncao, main, casos);
    } catch (segundoErro) {
      console.warn(`Falha ao carregar ${caminho} na 2ª tentativa, desistindo:`, segundoErro);
      mostrarEmConstrucao(main);
    }
  }
}

async function renderizarRota(main: HTMLElement, nav: HTMLElement, casos: CasosDeUso): Promise<void> {
  fecharPainelEstado();
  const hashAtual = rotaDoHash(normalizarHash(window.location.hash));

  for (const link of nav.querySelectorAll<HTMLAnchorElement>('.site-nav__link')) {
    const ativo = link.getAttribute('href') === hashAtual;
    link.classList.toggle('site-nav__link--ativo', ativo);
    if (ativo) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  main.innerHTML = '';

  switch (hashAtual) {
    case '#/presidente':
      await renderPaginaOpcional(main, casos, './views/presidential-view.ts', 'renderPresidential');
      break;
    case '#/presidente-estados':
      await renderPaginaOpcional(main, casos, './views/presidential-states-view.ts', 'renderPresidentialStates');
      break;
    case '#/senado':
      await renderPaginaOpcional(main, casos, './views/senate-view.ts', 'renderSenate');
      break;
    case '#/partidos':
      await renderPaginaOpcional(main, casos, './views/parties-view.ts', 'renderParties');
      break;
    case '#/pesquisas':
      await renderPaginaOpcional(main, casos, './views/polls-database-view.ts', 'renderPollsDatabase');
      break;
    case '#/mapa':
      renderMap(main, casos);
      break;
    case '#/inicio':
    default:
      await renderPaginaOpcional(main, casos, './views/home-view.ts', 'renderHome');
      break;
  }

  main.focus();
}

/**
 * O Vite dispara `vite:preloadError` no `window` quando o preload de um
 * asset (JS ou CSS) de um `import()` dinâmico falha — o mesmo tipo de
 * soluço transitório que faz `renderPaginaOpcional` cair no fallback "Em
 * construção" (ver nota lá). Sem `preventDefault()`, o evento também gera
 * ruído de "erro não tratado" no console para algo que o `catch` de
 * `renderPaginaOpcional` já está tentando de novo — então aqui só marca o
 * evento como tratado; a nova tentativa em si já acontece em
 * `renderPaginaOpcional`.
 */
function ignorarErrosDePreload(): void {
  window.addEventListener('vite:preloadError', (evento) => {
    console.warn('Preload de módulo/CSS falhou (Vite); ignorando — a rota já tenta carregar de novo:', evento);
    evento.preventDefault();
  });
}

function iniciar(): void {
  ignorarErrosDePreload();

  const repos = carregarDados();
  const casos = criarCasosDeUso(repos, clockReal);

  const { main, nav } = montarLayout(repos.meta.atualizadoEm());

  window.addEventListener('hashchange', () => {
    void renderizarRota(main, nav, casos);
  });
  void renderizarRota(main, nav, casos);
}

iniciar();
