import { carregarDados } from '../../outbound/json/carregar-dados.js';
import { criarCasosDeUso, type CasosDeUso } from '../../../application/use-cases/index.js';
import type { Clock } from '../../../application/ports.js';
import { formatarData } from './format.js';
import { renderMap } from './views/map-view.js';
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
  { hash: '#/mapa', rotulo: 'Governadores' },
  { hash: '#/presidente', rotulo: 'Presidente' },
  { hash: '#/presidente-estados', rotulo: 'Presidente por estado' },
  { hash: '#/senado', rotulo: 'Senado' },
  { hash: '#/partidos', rotulo: 'Partidos' },
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
  if (!hash || hash === '#' || hash === '') return '#/mapa';
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

/** Carrega uma tela opcional (presidente/senado/partidos) e chama sua função de render, com fallback. */
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
    const mod = await carregar();
    const render = mod[nomeFuncao];
    if (typeof render !== 'function') {
      throw new Error(`Módulo "${caminho}" não exporta "${nomeFuncao}".`);
    }
    (render as (main: HTMLElement, casos: CasosDeUso) => void)(main, casos);
  } catch (erro) {
    console.warn(`Falha ao carregar ${caminho}:`, erro);
    mostrarEmConstrucao(main);
  }
}

async function renderizarRota(main: HTMLElement, nav: HTMLElement, casos: CasosDeUso): Promise<void> {
  fecharPainelEstado();
  const hashAtual = normalizarHash(window.location.hash);

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
    case '#/mapa':
    default:
      renderMap(main, casos);
      break;
  }

  main.focus();
}

function iniciar(): void {
  const repos = carregarDados();
  const casos = criarCasosDeUso(repos, clockReal);

  const { main, nav } = montarLayout(repos.meta.atualizadoEm());

  window.addEventListener('hashchange', () => {
    void renderizarRota(main, nav, casos);
  });
  void renderizarRota(main, nav, casos);
}

iniciar();
