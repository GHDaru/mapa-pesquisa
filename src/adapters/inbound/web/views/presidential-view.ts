import '../styles/views.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { CenarioAgregado } from '../../../../application/use-cases/get-presidential-aggregate.js';
import { JANELA_DIAS_PADRAO } from '../../../../domain/aggregate.js';
import type { Agregado, CandidatoAgregado } from '../../../../domain/aggregate.js';
import type { Pesquisa } from '../../../../domain/poll.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import {
  criarBadgePartido,
  criarEl,
  criarLinkFonte,
  criarSeloEmpateTecnico,
  formatarNumero,
  formatarPct,
  formatarPeriodo,
  tokenFillEspectro,
} from './_shared.js';

/**
 * Agregador presidencial nacional — barra de qualidade: tabela de médias de
 * pesquisas do NYT (ver docs/ux-spec.md §2(c)). Único caso de uso consumido:
 * `getPresidentialAggregate` (turno1 + cenários de 2º turno + histórico
 * completo de pesquisas em `todasAsPesquisas`).
 */

export function renderPresidential(container: HTMLElement, casos: CasosDeUso): void {
  const { turno1, turno2, todasAsPesquisas } = casos.getPresidentialAggregate();
  const partidos = casos.listParties();
  const espectroPorPartido = new Map(partidos.map((p) => [p.sigla, p.espectro] as const));
  const espectroDe = (partido: string | null): Espectro =>
    partido ? (espectroPorPartido.get(partido) ?? 'indefinido') : 'indefinido';

  container.innerHTML = '';
  const raiz = criarEl('section', { className: 'pv-view', attrs: { 'aria-labelledby': 'presidente-titulo' } });

  raiz.append(
    criarEl('header', { className: 'pv-header' }, [
      criarEl('h1', {
        className: 'pv-title',
        texto: 'Presidente — média das pesquisas',
        attrs: { id: 'presidente-titulo' },
      }),
      criarEl('p', {
        className: 'pv-meta',
        texto: `Peso por recência (meia-vida) e por tamanho da amostra; janela de ${JANELA_DIAS_PADRAO} dias.`,
      }),
    ]),
  );

  raiz.append(criarCartaoTurno1(turno1, espectroDe));

  if (turno2.length > 0) {
    raiz.append(
      criarEl('section', {}, [
        criarEl('h2', { className: 'pv-section-title', texto: '2º turno — cenários testados' }),
        criarEl(
          'div',
          { className: 'pv-card-grid' },
          turno2.map((cenario) => criarCartaoTurno2(cenario, espectroDe)),
        ),
      ]),
    );
  }

  raiz.append(criarTabelaPesquisas(todasAsPesquisas));

  container.append(raiz);
}

function criarCartaoTurno1(
  turno1: Agregado | null,
  espectroDe: (partido: string | null) => Espectro,
): HTMLElement {
  const card = criarEl('div', { className: 'pv-card' });
  card.append(criarEl('h2', { className: 'pv-section-title', texto: '1º turno' }));

  if (!turno1 || !turno1.lider) {
    card.append(criarEl('p', { className: 'pv-meta', texto: 'Nenhuma pesquisa presidencial de 1º turno disponível.' }));
    return card;
  }

  const cabecalho = criarEl('div', { className: 'pv-controls-row' }, [
    criarEl('p', {
      className: 'pv-meta',
      texto: `Líder: ${turno1.lider.candidato} — vantagem de ${formatarNumero(turno1.vantagem)} ${
        turno1.vantagem === 1 ? 'ponto' : 'pontos'
      } sobre ${turno1.segundo?.candidato ?? 'o 2º colocado'}.`,
    }),
    turno1.empateTecnico ? criarSeloEmpateTecnico() : null,
  ]);
  card.append(cabecalho);

  const lista = criarEl('div', {}, turno1.candidatos.map((c) => criarBarraCandidato(c, espectroDe(c.partido))));
  card.append(lista);

  card.append(
    criarEl('p', {
      className: 'pv-meta',
      texto: `${turno1.pesquisasUsadas.length} ${
        turno1.pesquisasUsadas.length === 1 ? 'pesquisa usada' : 'pesquisas usadas'
      } nos últimos ${JANELA_DIAS_PADRAO} dias${
        turno1.foraDaJanela ? ' (nenhuma pesquisa recente: usando a mais recente disponível)' : ''
      }. Margem de referência ponderada: ± ${formatarNumero(turno1.margemReferencia)} pontos.${
        turno1.algumaNaoRegistrada ? ' Inclui pesquisa sem registro no TSE (ver tabela abaixo).' : ''
      }`,
    }),
  );

  return card;
}

function criarCartaoTurno2(
  cenario: CenarioAgregado,
  espectroDe: (partido: string | null) => Espectro,
): HTMLElement {
  const { agregado } = cenario;
  const card = criarEl('div', { className: 'pv-card' });
  card.append(
    criarEl('div', { className: 'pv-controls-row' }, [
      criarEl('h3', { className: 'pv-section-title', texto: cenario.cenario }),
      agregado.empateTecnico ? criarSeloEmpateTecnico() : null,
    ]),
  );

  const doisCandidatos = [agregado.lider, agregado.segundo].filter(
    (c): c is CandidatoAgregado => c != null,
  );
  card.append(criarEl('div', {}, doisCandidatos.map((c) => criarBarraCandidato(c, espectroDe(c.partido)))));

  card.append(
    criarEl('p', {
      className: 'pv-meta',
      texto: `${agregado.pesquisasUsadas.length} ${
        agregado.pesquisasUsadas.length === 1 ? 'pesquisa' : 'pesquisas'
      } · última em ${agregado.ultimaPesquisa.dataFim ?? agregado.ultimaPesquisa.publicadoEm ?? '—'}.`,
    }),
  );

  return card;
}

function criarBarraCandidato(candidato: CandidatoAgregado, espectro: Espectro): HTMLElement {
  const pct = Math.max(0, Math.min(100, candidato.pct));
  return criarEl('div', { className: 'pv-bar-row' }, [
    criarEl('span', { className: 'pv-bar-name' }, [
      candidato.partido ? criarBadgePartido(candidato.partido, espectro) : null,
      criarEl('span', { className: 'pv-bar-name-text', texto: candidato.candidato }),
    ]),
    criarEl('span', { className: 'pv-bar-track' }, [
      criarEl('span', {
        className: 'pv-bar-fill',
        attrs: { style: `width:${pct}%;background:${tokenFillEspectro(espectro)}` },
      }),
    ]),
    criarEl('span', { className: 'pv-bar-pct pv-num', texto: formatarPct(candidato.pct) }),
  ]);
}

function criarTabelaPesquisas(pesquisas: readonly Pesquisa[]): HTMLElement {
  const wrap = criarEl('div', { className: 'pv-table-wrap' });
  const table = criarEl('table', { className: 'pv-table' });

  const thead = criarEl('thead', {}, [
    criarEl('tr', {}, [
      criarEl('th', { texto: 'Instituto', attrs: { scope: 'col' } }),
      criarEl('th', { texto: 'Disputa', attrs: { scope: 'col' } }),
      criarEl('th', { texto: 'Campo', attrs: { scope: 'col' } }),
      criarEl('th', { texto: 'Amostra', attrs: { scope: 'col' } }),
      criarEl('th', { texto: 'Margem', attrs: { scope: 'col' } }),
      criarEl('th', { texto: 'Registro TSE', attrs: { scope: 'col' } }),
      criarEl('th', { texto: '3 primeiros colocados', attrs: { scope: 'col' } }),
      criarEl('th', { texto: 'Fonte', attrs: { scope: 'col' } }),
    ]),
  ]);

  const linhas = pesquisas.map((p) => {
    const top3 = [...p.resultados].sort((a, b) => b.pct - a.pct).slice(0, 3);
    const disputa = p.disputa.turno === 1 ? '1º turno' : `2º turno${p.cenario ? ` — ${p.cenario}` : ''}`;

    return criarEl('tr', {}, [
      criarEl('td', { texto: p.instituto }),
      criarEl('td', { texto: disputa, className: 'pv-col-wrap' }),
      criarEl('td', { texto: formatarPeriodo(p.dataInicio, p.dataFim), className: 'pv-num' }),
      criarEl('td', {
        className: 'pv-num',
        texto: p.amostra != null ? p.amostra.toLocaleString('pt-BR') : '—',
      }),
      criarEl('td', { className: 'pv-num', texto: p.margem != null ? `± ${formatarNumero(p.margem)} pts` : '—' }),
      criarEl(
        'td',
        {},
        [
          p.registroTSE.naoRegistrada
            ? criarEl('span', {
                className: 'pv-selo pv-selo-sem-registro',
                texto: 'Sem registro',
                attrs: { title: 'Registro no TSE não localizado para esta pesquisa — não invalida o levantamento.' },
              })
            : criarEl('span', { className: 'pv-num', texto: p.registroTSE.valor }),
        ],
      ),
      criarEl(
        'td',
        { className: 'pv-col-wrap' },
        [
          criarEl(
            'ul',
            { className: 'pv-mini-list' },
            top3.map((r) =>
              criarEl('li', {}, [`${r.candidato}${r.partido ? ` (${r.partido})` : ''} — `, criarEl('span', { className: 'pv-num', texto: formatarPct(r.pct) })]),
            ),
          ),
        ],
      ),
      criarEl('td', {}, [criarLinkFonte(p.fonte)]),
    ]);
  });

  table.append(thead, criarEl('tbody', {}, linhas));
  wrap.append(table);

  return criarEl('section', {}, [
    criarEl('h2', { className: 'pv-section-title', texto: 'Todas as pesquisas presidenciais' }),
    wrap,
  ]);
}
