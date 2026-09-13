import '../styles/views.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { Partido } from '../../../../domain/party.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import { ordemEspectro } from '../../../../domain/spectrum.js';
import { criarBadgePartido, criarEl, rotuloEspectro, tokenFillEspectro } from './_shared.js';

/**
 * Cadastro de partidos — tabela ordenada da esquerda para a direita (escala
 * ideológica), com barra de resumo por espectro no topo. Ver
 * docs/ux-spec.md §2(e); vira lista de cards em telas de 400px (views.css).
 */

export function renderParties(container: HTMLElement, casos: CasosDeUso): void {
  const partidos = [...casos.listParties()].sort(
    (a, b) => ordemEspectro(a.espectro) - ordemEspectro(b.espectro) || a.numero - b.numero,
  );

  container.innerHTML = '';
  const raiz = criarEl('section', { className: 'pv-view', attrs: { 'aria-labelledby': 'partidos-titulo' } });

  raiz.append(
    criarEl('header', { className: 'pv-header' }, [
      criarEl('h1', { className: 'pv-title', texto: 'Cadastro de partidos', attrs: { id: 'partidos-titulo' } }),
      criarEl('p', {
        className: 'pv-meta',
        texto: `${partidos.length} partidos, ordenados da esquerda para a direita.`,
      }),
    ]),
  );

  raiz.append(criarResumoPorEspectro(partidos));
  raiz.append(criarTabelaPartidos(partidos));

  container.append(raiz);
}

function criarResumoPorEspectro(partidos: readonly Partido[]): HTMLElement {
  const contagem = new Map<Espectro, number>();
  for (const p of partidos) contagem.set(p.espectro, (contagem.get(p.espectro) ?? 0) + 1);

  const ordenados = [...contagem.entries()].sort((a, b) => ordemEspectro(a[0]) - ordemEspectro(b[0]));

  return criarEl(
    'div',
    { className: 'pv-summary-bar', attrs: { role: 'list', 'aria-label': 'Resumo por espectro' } },
    ordenados.map(([espectro, n]) =>
      criarEl('span', { className: 'pv-summary-chip', attrs: { role: 'listitem' } }, [
        criarEl('span', { className: 'pv-legend-swatch', attrs: { style: `background:${tokenFillEspectro(espectro)}` } }),
        `${rotuloEspectro(espectro)}: `,
        criarEl('span', { className: 'pv-num', texto: String(n) }),
      ]),
    ),
  );
}

function criarTabelaPartidos(partidos: readonly Partido[]): HTMLElement {
  const wrap = criarEl('div', { className: 'pv-table-wrap pv-parties-table-wrap' });
  const table = criarEl('table', { className: 'pv-table' });

  table.append(
    criarEl('thead', {}, [
      criarEl('tr', {}, [
        criarEl('th', { texto: 'Número', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Sigla', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Nome completo', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Espectro', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Federação', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Fonte da classificação', attrs: { scope: 'col' } }),
      ]),
    ]),
  );

  const linhas = partidos.map((p) => criarLinhaPartido(p));
  table.append(criarEl('tbody', {}, linhas));
  wrap.append(table);
  return wrap;
}

function criarLinhaPartido(partido: Partido): HTMLElement {
  const naoClassificado = partido.espectro === 'indefinido';

  const celulaEspectro = criarEl('td', { attrs: { 'data-rotulo': 'Espectro' } }, [
    criarEl('span', { className: `pv-legend-swatch`, attrs: { style: `background:${tokenFillEspectro(partido.espectro)};display:inline-block;margin-right:6px;vertical-align:middle` } }),
    rotuloEspectro(partido.espectro),
    naoClassificado
      ? criarEl('span', { className: 'pv-selo pv-selo-nao-classificado', texto: 'Não classificado' })
      : null,
  ]);

  const linha = criarEl('tr', {}, [
    criarEl('td', { className: 'pv-num', texto: String(partido.numero), attrs: { 'data-rotulo': 'Número' } }),
    criarEl('td', { attrs: { 'data-rotulo': 'Sigla' } }, [criarBadgePartido(partido.sigla, partido.espectro)]),
    criarEl('td', { texto: partido.nome, className: 'pv-col-wrap', attrs: { 'data-rotulo': 'Nome' } }),
    celulaEspectro,
    criarEl('td', { texto: partido.federacao ?? '—', className: 'pv-col-wrap', attrs: { 'data-rotulo': 'Federação' } }),
    criarEl(
      'td',
      { attrs: { 'data-rotulo': 'Fonte' } },
      [
        partido.fonteClassificacao
          ? criarEl('a', {
              className: 'pv-link-fonte',
              texto: 'Ver fonte',
              attrs: { href: partido.fonteClassificacao, target: '_blank', rel: 'noopener noreferrer' },
            }, [criarEl('span', { className: 'pv-sr-only', texto: ' (abre em nova aba)' })])
          : criarEl('span', { className: 'pv-meta', texto: '—' }),
      ],
    ),
  ]);

  if (partido.observacao) {
    const detalhes = criarEl('details', { className: 'pv-col-wrap' }, [
      criarEl('summary', { texto: 'Observação' }),
      criarEl('p', { className: 'pv-meta', texto: partido.observacao }),
    ]);
    const ultimaCelula = celulaEspectro;
    ultimaCelula.append(detalhes);
  }

  return linha;
}
