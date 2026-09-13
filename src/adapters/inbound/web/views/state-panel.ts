import brazilMapDados from '@svg-maps/brazil';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { ResumoEstado } from '../../../../application/use-cases/get-state-summary.js';
import type { Agregado, CandidatoAgregado } from '../../../../domain/aggregate.js';
import type { Pesquisa } from '../../../../domain/poll.js';
import { espectroDoPartido } from '../../../../domain/spectrum.js';
import {
  corEspectroSolido,
  formatarData,
  formatarNumeroPt,
  formatarPct,
  formatarVantagem,
  nivelConfianca,
  rotuloConfianca,
} from '../format.js';

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

export interface AbrirPainelParams {
  readonly uf: string;
  readonly casos: CasosDeUso;
  readonly elementoOrigem: HTMLElement | SVGElement;
}

let backdropAtual: HTMLElement | null = null;
let origemAtual: HTMLElement | SVGElement | null = null;

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function focar(el: HTMLElement | SVGElement | null): void {
  if (el && typeof (el as { focus?: () => void }).focus === 'function') {
    (el as { focus: () => void }).focus();
  }
}

function aoTeclar(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    fecharPainelEstado();
    return;
  }
  if (e.key === 'Tab' && backdropAtual) {
    const painel = backdropAtual.querySelector<HTMLElement>('.state-panel');
    if (painel) trapFoco(e, painel);
  }
}

function trapFoco(e: KeyboardEvent, container: HTMLElement): void {
  const focaveis = Array.from(
    container.querySelectorAll<HTMLElement>(
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

/** Fecha o painel do estado, se houver um aberto, e devolve o foco à origem. */
export function fecharPainelEstado(): void {
  if (!backdropAtual) return;
  document.removeEventListener('keydown', aoTeclar);
  backdropAtual.remove();
  backdropAtual = null;
  focar(origemAtual);
  origemAtual = null;
}

/** Abre o painel/drawer do estado (governador + senador + pesquisas). */
export function abrirPainelEstado({ uf, casos, elementoOrigem }: AbrirPainelParams): void {
  fecharPainelEstado();

  const resumo = casos.getStateSummary(uf);
  const partidos = casos.listParties();
  const nome = NOME_POR_UF.get(uf) ?? uf;

  const backdrop = document.createElement('div');
  backdrop.className = 'state-panel-backdrop';
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) fecharPainelEstado();
  });

  const painel = document.createElement('div');
  painel.className = 'state-panel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-modal', 'true');
  painel.setAttribute('aria-labelledby', 'state-panel-titulo');
  painel.innerHTML = montarConteudo(uf, nome, resumo, partidos);

  backdrop.appendChild(painel);
  document.body.appendChild(backdrop);

  backdropAtual = backdrop;
  origemAtual = elementoOrigem;

  painel.querySelector('.state-panel__fechar')?.addEventListener('click', () => fecharPainelEstado());
  document.addEventListener('keydown', aoTeclar);

  focar(painel.querySelector<HTMLElement>('.state-panel__fechar'));
}

function montarConteudo(
  uf: string,
  nome: string,
  resumo: ResumoEstado,
  partidos: ReturnType<CasosDeUso['listParties']>,
): string {
  return `
    <div class="state-panel__handle" aria-hidden="true"></div>
    <header class="state-panel__header">
      <h2 id="state-panel-titulo" class="state-panel__titulo">${escaparHtml(nome)} <span class="state-panel__uf">(${uf})</span></h2>
      <button type="button" class="state-panel__fechar" aria-label="Fechar painel">
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <div class="state-panel__corpo">
      ${renderSecaoCargo('Governador', resumo.governador, partidos, {})}
      ${renderSecaoCargo('Senador', resumo.senador, partidos, {
        rotuloVagas: '2 vagas',
        destacarDoisPrimeiros: true,
      })}
    </div>
    <footer class="state-panel__footer">
      ${renderRodape(resumo)}
      <p class="state-panel__metodologia">
        Média ponderada por recência e tamanho de amostra.
        <a href="#/presidente">Como calculamos</a>.
      </p>
    </footer>
  `;
}

function renderRodape(resumo: ResumoEstado): string {
  const datas = [resumo.governador?.ultimaPesquisa, resumo.senador?.ultimaPesquisa]
    .filter((p): p is Pesquisa => Boolean(p))
    .map((p) => p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '')
    .filter(Boolean)
    .sort()
    .reverse();
  if (datas.length === 0) return '<p class="state-panel__ultima">Nenhuma pesquisa disponível para esta UF.</p>';
  return `<p class="state-panel__ultima">Última pesquisa em ${formatarData(datas[0]!)}.</p>`;
}

function renderSecaoCargo(
  titulo: string,
  agregado: Agregado | null,
  partidos: ReturnType<CasosDeUso['listParties']>,
  opcoes: { rotuloVagas?: string; destacarDoisPrimeiros?: boolean },
): string {
  const cabecalho = `
    <div class="state-panel__secao-titulo">
      <h3>${titulo}</h3>
      ${opcoes.rotuloVagas ? `<span class="pill pill--neutro">${opcoes.rotuloVagas}</span>` : ''}
    </div>
  `;

  if (!agregado || !agregado.lider) {
    return `
      <section class="state-panel__secao">
        ${cabecalho}
        <p class="state-panel__vazio">Sem pesquisas suficientes para ${titulo.toLowerCase()} nesta UF.</p>
      </section>
    `;
  }

  const espectroLider = espectroDoPartido(agregado.lider.partido, partidos);
  const nivel = nivelConfianca(agregado.vantagem, agregado.margemReferencia, false);

  const badgeLider = `
    <span class="badge" style="background:${corEspectroSolido(espectroLider)}">
      ${escaparHtml(agregado.lider.partido ?? 'S/PARTIDO')}
    </span>
  `;

  const seloEmpate = agregado.empateTecnico
    ? '<span class="pill pill--empate">EMPATE TÉCNICO</span>'
    : `<span class="pill pill--confianca">${rotuloConfianca(nivel)}</span>`;

  const maxPct = Math.max(...agregado.candidatos.map((c) => c.pct), 1);
  const candidatosMostrados = agregado.candidatos.slice(0, opcoes.destacarDoisPrimeiros ? 4 : 3);

  const listaCandidatos = candidatosMostrados
    .map((c, i) => renderBarraCandidato(c, maxPct, opcoes.destacarDoisPrimeiros === true && i < 2, partidos))
    .join('');

  const listaNaoRankeados = agregado.outros.length
    ? `<p class="state-panel__outros">Outros (brancos/nulos/não sabe): ${agregado.outros
        .map((o) => `${escaparHtml(o.candidato)} ${formatarPct(o.pct)}`)
        .join(', ')}</p>`
    : '';

  return `
    <section class="state-panel__secao">
      ${cabecalho}
      <div class="state-panel__lider">
        <span class="state-panel__lider-nome">${escaparHtml(agregado.lider.candidato)}</span>
        ${badgeLider}
        <span class="state-panel__vantagem">${formatarVantagem(agregado.vantagem)}</span>
        ${seloEmpate}
      </div>
      <ul class="bar-list">${listaCandidatos}</ul>
      ${listaNaoRankeados}
      ${renderListaPesquisas(agregado)}
    </section>
  `;
}

function renderBarraCandidato(
  c: CandidatoAgregado,
  maxPct: number,
  destaque: boolean,
  partidos: ReturnType<CasosDeUso['listParties']>,
): string {
  const espectro = espectroDoPartido(c.partido, partidos);
  const largura = Math.max(2, (c.pct / maxPct) * 100);
  return `
    <li class="bar-row${destaque ? ' bar-row--destaque' : ''}">
      <span class="bar-row__rotulo">${escaparHtml(c.candidato)}${c.partido ? ` <span class="bar-row__partido">(${escaparHtml(c.partido)})</span>` : ''}</span>
      <span class="bar-track" role="presentation">
        <span class="bar-fill" style="width:${largura}%; background:${corEspectroSolido(espectro)}"></span>
      </span>
      <span class="bar-row__pct">${formatarPct(c.pct)}</span>
    </li>
  `;
}

function renderListaPesquisas(agregado: Agregado): string {
  const linhas = agregado.pesquisasUsadas
    .slice()
    .sort((a, b) => (b.dataFim ?? b.publicadoEm ?? '').localeCompare(a.dataFim ?? a.publicadoEm ?? ''))
    .map((p) => renderPesquisa(p))
    .join('');

  return `
    <details class="poll-list">
      <summary>Ver as ${agregado.pesquisasUsadas.length} pesquisa${agregado.pesquisasUsadas.length === 1 ? '' : 's'} usadas</summary>
      <ul class="poll-list__itens">${linhas}</ul>
    </details>
  `;
}

function renderPesquisa(p: Pesquisa): string {
  const periodo =
    p.dataInicio && p.dataFim
      ? `${formatarData(p.dataInicio)}–${formatarData(p.dataFim)}`
      : formatarData(p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '');
  const registro = p.registroTSE.naoRegistrada
    ? '<span class="poll-item__sem-registro" title="Registro TSE não localizado na fonte">registro TSE não localizado ⚠</span>'
    : `registro TSE ${escaparHtml(p.registroTSE.valor)}`;
  const amostra = p.amostra != null ? `amostra ${p.amostra.toLocaleString('pt-BR')}` : 'amostra não informada';
  const margem = p.margem != null ? `margem ± ${formatarNumeroPt(p.margem)} pontos` : 'margem não informada';

  const contratante = p.contratante ? ` <span class="poll-item__contratante">(contratante: ${escaparHtml(p.contratante)})</span>` : '';

  return `
    <li class="poll-item">
      <p class="poll-item__linha1">
        <strong>${escaparHtml(p.instituto)}</strong>${contratante} · ${periodo}
      </p>
      <p class="poll-item__linha2">
        <span class="tabular-nums">${amostra}</span> · <span class="tabular-nums">${margem}</span> · ${registro}
      </p>
      <p class="poll-item__linha3">
        <a href="${escaparHtml(p.fonte.url)}" target="_blank" rel="noopener noreferrer">
          Fonte: ${escaparHtml(p.fonte.nome)} <span class="sr-only">(abre em nova aba)</span>
        </a>
      </p>
    </li>
  `;
}
