import '../styles/views.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { Partido } from '../../../../domain/party.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import { ordemEspectro } from '../../../../domain/spectrum.js';
import { criarBadgePartido, criarEl, rotuloEspectro, tokenFillEspectro } from './_shared.js';

/**
 * Cadastro de partidos — tabela ordenável por qualquer coluna (Sigla, Nome,
 * Número — padrão, identificador oficial do TSE —, Espectro ou Federação),
 * com cabeçalhos clicáveis no desktop (clicar de novo no mesmo cabeçalho
 * inverte a direção, refletida em `aria-sort`) e um `select` equivalente
 * substituindo-os quando a tabela vira lista de cards em 400px — ver
 * docs/ux-spec.md §2(e) e docs/revisao-partidos.md ("O que a barra faz
 * melhor" #1: a tabela da Wikipédia é ordenável por qualquer coluna, a
 * nossa não era).
 */

type OrdenarPor = 'numero' | 'sigla' | 'nome' | 'espectro' | 'federacao';
type Direcao = 'asc' | 'desc';

const ROTULO_CAMPO: Readonly<Record<OrdenarPor, string>> = {
  numero: 'Número',
  sigla: 'Sigla',
  nome: 'Nome completo',
  espectro: 'Espectro',
  federacao: 'Federação',
};

function compararPartidos(a: Partido, b: Partido, campo: OrdenarPor): number {
  switch (campo) {
    case 'numero':
      return a.numero - b.numero;
    case 'sigla':
      return a.sigla.localeCompare(b.sigla, 'pt-BR') || a.numero - b.numero;
    case 'nome':
      return a.nome.localeCompare(b.nome, 'pt-BR') || a.numero - b.numero;
    case 'espectro':
      return ordemEspectro(a.espectro) - ordemEspectro(b.espectro) || a.numero - b.numero;
    case 'federacao': {
      const fa = a.federacao ?? '';
      const fb = b.federacao ?? '';
      // Sem federação sempre por último, em ambas as direções de ordenação
      // (não faz sentido "—" competir alfabeticamente com nomes reais).
      if (!fa && fb) return 1;
      if (fa && !fb) return -1;
      return fa.localeCompare(fb, 'pt-BR') || a.numero - b.numero;
    }
  }
}

function ordenarPartidos(partidos: readonly Partido[], campo: OrdenarPor, direcao: Direcao): Partido[] {
  const semFederacao = (p: Partido): boolean => campo === 'federacao' && !p.federacao;
  const ordenados = [...partidos].sort((a, b) => compararPartidos(a, b, campo));
  if (direcao === 'asc') return ordenados;
  // Reverter para "desc" também inverteria a regra de "sem federação por
  // último" (viraria "por primeiro") — separa esse grupo antes de reverter
  // o resto para mantê-lo sempre ao final, nas duas direções.
  const comValor = ordenados.filter((p) => !semFederacao(p)).reverse();
  const semValor = ordenados.filter((p) => semFederacao(p));
  return [...comValor, ...semValor];
}

export function renderParties(container: HTMLElement, casos: CasosDeUso): void {
  const todos = casos.listParties();

  container.innerHTML = '';
  const raiz = criarEl('section', { className: 'pv-view', attrs: { 'aria-labelledby': 'partidos-titulo' } });

  const meta = criarEl('p', { className: 'pv-meta' });
  raiz.append(
    criarEl('header', { className: 'pv-header' }, [
      criarEl('h1', { className: 'pv-title', texto: 'Cadastro de partidos', attrs: { id: 'partidos-titulo' } }),
      meta,
    ]),
  );

  raiz.append(criarResumoPorEspectro(todos));

  // --- Controle de ordenação: cabeçalhos clicáveis (desktop) + select (mobile) ---
  let ordenarPor: OrdenarPor = 'numero';
  let direcao: Direcao = 'asc';

  const selectOrdenacao = criarEl('select', { className: 'pv-select', attrs: { id: 'partidos-ordenar' } }, [
    criarEl('option', { texto: 'Número', attrs: { value: 'numero' } }),
    criarEl('option', { texto: 'Sigla', attrs: { value: 'sigla' } }),
    criarEl('option', { texto: 'Nome completo', attrs: { value: 'nome' } }),
    criarEl('option', { texto: 'Espectro', attrs: { value: 'espectro' } }),
    criarEl('option', { texto: 'Federação', attrs: { value: 'federacao' } }),
  ]);
  const campoOrdenacao = criarEl('label', { className: 'pv-field pv-sort-select-wrap', texto: 'Ordenar por' }, [
    selectOrdenacao,
  ]);
  raiz.append(campoOrdenacao);

  const tabelaWrap = criarEl('div', {});
  raiz.append(tabelaWrap);

  function aoOrdenar(campo: OrdenarPor): void {
    if (ordenarPor === campo) {
      direcao = direcao === 'asc' ? 'desc' : 'asc';
    } else {
      ordenarPor = campo;
      direcao = 'asc';
    }
    atualizar();
  }

  function atualizar(): void {
    const partidos = ordenarPartidos(todos, ordenarPor, direcao);
    const rotuloDirecao = direcao === 'asc' ? 'crescente' : 'decrescente';
    meta.textContent = `${partidos.length} partidos, ordenados por ${ROTULO_CAMPO[ordenarPor].toLowerCase()} (${rotuloDirecao}).`;
    selectOrdenacao.value = ordenarPor;
    tabelaWrap.innerHTML = '';
    tabelaWrap.append(criarTabelaPartidos(partidos, ordenarPor, direcao, aoOrdenar));
  }

  selectOrdenacao.addEventListener('change', () => {
    const valor = selectOrdenacao.value;
    const campo: OrdenarPor =
      valor === 'sigla' || valor === 'nome' || valor === 'espectro' || valor === 'federacao' ? valor : 'numero';
    ordenarPor = campo;
    direcao = 'asc';
    atualizar();
  });

  atualizar();
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

function criarThOrdenavel(
  campo: OrdenarPor,
  ordenarPor: OrdenarPor,
  direcao: Direcao,
  aoClicar: (campo: OrdenarPor) => void,
): HTMLElement {
  const rotulo = ROTULO_CAMPO[campo];
  const ativo = ordenarPor === campo;
  const btn = criarEl('button', {
    className: 'pv-table-sort-btn',
    texto: rotulo,
    attrs: {
      type: 'button',
      'aria-label': `Ordenar por ${rotulo}${ativo ? `, ordem ${direcao === 'asc' ? 'crescente' : 'decrescente'} — clique para inverter` : ''}`,
    },
  });
  btn.addEventListener('click', () => aoClicar(campo));
  const ariaSort = ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none';
  return criarEl('th', { attrs: { scope: 'col', 'aria-sort': ariaSort } }, [btn]);
}

function criarTabelaPartidos(
  partidos: readonly Partido[],
  ordenarPor: OrdenarPor,
  direcao: Direcao,
  aoOrdenar: (campo: OrdenarPor) => void,
): HTMLElement {
  const wrap = criarEl('div', { className: 'pv-table-wrap pv-parties-table-wrap' });
  const table = criarEl('table', { className: 'pv-table' });

  table.append(
    criarEl('thead', {}, [
      criarEl('tr', {}, [
        criarThOrdenavel('numero', ordenarPor, direcao, aoOrdenar),
        criarThOrdenavel('sigla', ordenarPor, direcao, aoOrdenar),
        criarThOrdenavel('nome', ordenarPor, direcao, aoOrdenar),
        criarThOrdenavel('espectro', ordenarPor, direcao, aoOrdenar),
        criarThOrdenavel('federacao', ordenarPor, direcao, aoOrdenar),
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
