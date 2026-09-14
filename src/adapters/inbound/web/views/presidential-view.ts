import '../styles/views.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { CenarioAgregado } from '../../../../application/use-cases/get-presidential-aggregate.js';
import { JANELA_DIAS_PADRAO } from '../../../../domain/aggregate.js';
import type { Agregado, CandidatoAgregado, SerieTemporal } from '../../../../domain/aggregate.js';
import type { Pesquisa } from '../../../../domain/poll.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import {
  calcularFaixaIncerteza,
  criarBadgePartido,
  criarEl,
  criarLinkFonte,
  criarSeloEmpateTecnico,
  formatarNumero,
  formatarPct,
  formatarPeriodo,
  tokenFillEspectro,
} from './_shared.js';
import { nomeCurto } from './candidate-names.js';
import { atribuirTomSerie, renderTimelineChart, type SerieCandidato } from './timeline-chart.js';

/**
 * Rótulo curto de um cenário de 2º turno ("2º turno: Luiz Inácio Lula da
 * Silva x Flávio Bolsonaro" -> "Lula x Flávio Bolsonaro") para caber no
 * título do cartão e na opção do seletor sem truncar — o valor interno
 * `cenario.cenario` (nome completo) continua intacto, é a chave usada por
 * `getPresidentialTimeline(2, cenario)` (ver get-presidential-timeline.ts).
 */
function rotuloCenarioCurto(cenario: string): string {
  const semPrefixo = cenario.replace(/^2º turno:\s*/i, '');
  return semPrefixo
    .split(/\s+x\s+/i)
    .map((nome) => nomeCurto(nome.trim()))
    .join(' x ');
}

/**
 * Agregador presidencial nacional — barra de qualidade: tabela de médias de
 * pesquisas do NYT (ver docs/ux-spec.md §2(c)). Casos de uso consumidos:
 * `getPresidentialAggregate` (turno1 + cenários de 2º turno + histórico
 * completo de pesquisas em `todasAsPesquisas`) e `getPresidentialTimeline`
 * (série diária para o gráfico do topo da tela).
 */

const MAX_CANDIDATOS_DESTACADOS = 3;

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
      criarEl('p', {
        className: 'pv-meta pv-uncertainty-legend',
        texto:
          'A faixa mais clara atrás de cada barra é a margem de erro da pesquisa (faixa = margem de erro); o valor exato aparece na legenda de cada cenário.',
      }),
    ]),
  );

  raiz.append(criarCartaoTimeline(casos, turno2, espectroDe));

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

/**
 * Escolhe os até `MAX_CANDIDATOS_DESTACADOS` candidatos com linha própria no
 * gráfico (já vêm ordenados por média final desc. em `serie.candidatos` —
 * ver `domain/aggregate.ts`); os demais aparecem só como pontos cinza
 * ("Outros", sem linha) desenhados por `renderTimelineChart`. Dois
 * candidatos do mesmo espectro (ex.: dois de direita) recebem tons
 * distintos via `atribuirTomSerie` — ver styles/views.css.
 */
function candidatosDestacadosDaSerie(
  serie: SerieTemporal,
  espectroDe: (partido: string | null) => Espectro,
): SerieCandidato[] {
  const nomes = serie.candidatos.slice(0, MAX_CANDIDATOS_DESTACADOS);
  const partidoPorNome = new Map<string, string | null>();
  for (const ponto of serie.pontos) {
    if (!partidoPorNome.has(ponto.candidato)) partidoPorNome.set(ponto.candidato, ponto.partido);
  }
  const espectros = nomes.map((nome) => espectroDe(partidoPorNome.get(nome) ?? null));
  const tons = atribuirTomSerie(espectros);
  return nomes.map((nome, i) => ({
    nome,
    partido: partidoPorNome.get(nome) ?? null,
    espectro: espectros[i]!,
    tom: tons[i]!,
  }));
}

/**
 * Cartão do gráfico temporal presidencial, no topo da tela (acima dos
 * cartões de agregado) — barra de qualidade: NYT "Presidential polls 2024"
 * (ver docs/ux-spec.md). 1º turno por padrão; se houver cenários de 2º
 * turno testados, um seletor troca para a série de um deles (ex.: "Lula x
 * Flávio Bolsonaro") via `getPresidentialTimeline(2, cenario)`.
 */
function criarCartaoTimeline(
  casos: CasosDeUso,
  turno2: readonly CenarioAgregado[],
  espectroDe: (partido: string | null) => Espectro,
): HTMLElement {
  const card = criarEl('div', { className: 'pv-card pv-timeline-card' });
  const titulo = criarEl('h2', { className: 'pv-section-title', texto: 'Evolução das pesquisas — 1º turno' });
  card.append(titulo);

  let selectCenario: HTMLSelectElement | null = null;
  if (turno2.length > 0) {
    selectCenario = criarEl('select', { className: 'pv-select pv-timeline-scenario-select', attrs: { id: 'presidente-timeline-cenario' } }, [
      criarEl('option', { texto: '1º turno', attrs: { value: '' } }),
      ...turno2.map((c) =>
        criarEl('option', { texto: rotuloCenarioCurto(c.cenario), attrs: { value: c.cenario, title: c.cenario } }),
      ),
    ]);
    const campo = criarEl('label', { className: 'pv-field', texto: 'Mostrar série de' }, [selectCenario]);
    card.append(campo);
  }

  const host = criarEl('div', { className: 'pv-timeline-chart-host' });
  card.append(host);

  function atualizar(): void {
    const valorSelecionado = selectCenario?.value || '';
    const serie =
      valorSelecionado === ''
        ? casos.getPresidentialTimeline(1)
        : casos.getPresidentialTimeline(2, valorSelecionado);

    titulo.textContent =
      valorSelecionado === ''
        ? 'Evolução das pesquisas — 1º turno'
        : `Evolução das pesquisas — ${rotuloCenarioCurto(valorSelecionado)}`;
    titulo.title = valorSelecionado === '' ? '' : valorSelecionado;

    const candidatosDestacados = candidatosDestacadosDaSerie(serie, espectroDe);
    renderTimelineChart(host, {
      serie,
      candidatosDestacados,
      tituloAcessivel:
        valorSelecionado === ''
          ? 'Gráfico de evolução das pesquisas presidenciais no 1º turno, de agosto até a eleição'
          : `Gráfico de evolução das pesquisas do 2º turno, cenário ${valorSelecionado}`,
    });
  }

  selectCenario?.addEventListener('change', atualizar);
  atualizar();

  return card;
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

  const lista = criarEl(
    'div',
    {},
    turno1.candidatos.map((c) => criarBarraCandidato(c, espectroDe(c.partido), turno1.margemReferencia)),
  );
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
      criarEl('h3', {
        className: 'pv-section-title',
        texto: rotuloCenarioCurto(cenario.cenario),
        attrs: { title: cenario.cenario },
      }),
      agregado.empateTecnico ? criarSeloEmpateTecnico() : null,
    ]),
  );

  const doisCandidatos = [agregado.lider, agregado.segundo].filter(
    (c): c is CandidatoAgregado => c != null,
  );
  card.append(
    criarEl(
      'div',
      {},
      doisCandidatos.map((c) => criarBarraCandidato(c, espectroDe(c.partido), agregado.margemReferencia)),
    ),
  );

  card.append(
    criarEl('p', {
      className: 'pv-meta',
      texto: `${agregado.pesquisasUsadas.length} ${
        agregado.pesquisasUsadas.length === 1 ? 'pesquisa' : 'pesquisas'
      } · última em ${agregado.ultimaPesquisa.dataFim ?? agregado.ultimaPesquisa.publicadoEm ?? '—'}. Margem de referência ponderada: ± ${formatarNumero(agregado.margemReferencia)} pontos.`,
    }),
  );

  return card;
}

function criarBarraCandidato(
  candidato: CandidatoAgregado,
  espectro: Espectro,
  margemReferencia: number,
): HTMLElement {
  const pct = Math.max(0, Math.min(100, candidato.pct));
  // Faixa de incerteza (±margemReferencia) centrada no valor, na mesma escala
  // 0..100 da barra — ver docs/ux-spec.md §2(c).
  const { esquerda: faixaEsquerda, largura: faixaLargura } = calcularFaixaIncerteza(pct, margemReferencia);
  return criarEl('div', { className: 'pv-bar-row' }, [
    criarEl('span', { className: 'pv-bar-name' }, [
      candidato.partido ? criarBadgePartido(candidato.partido, espectro) : null,
      criarEl('span', { className: 'pv-bar-name-text', texto: candidato.candidato, attrs: { title: candidato.candidato } }),
    ]),
    criarEl('span', { className: 'pv-bar-track' }, [
      criarEl('span', {
        className: 'pv-bar-uncertainty',
        attrs: {
          style: `left:${faixaEsquerda}%;width:${faixaLargura}%;background:${tokenFillEspectro(espectro)}`,
          'aria-hidden': 'true',
        },
      }),
      criarEl('span', {
        className: 'pv-bar-fill',
        attrs: { style: `width:${pct}%;background:${tokenFillEspectro(espectro)}` },
      }),
    ]),
    criarEl('span', { className: 'pv-bar-pct pv-num', texto: formatarPct(candidato.pct) }),
  ]);
}

function criarTabelaPesquisas(pesquisas: readonly Pesquisa[]): HTMLElement {
  const wrap = criarEl('div', { className: 'pv-table-wrap pv-presidential-table-wrap' });
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
      criarEl('td', { texto: p.instituto, attrs: { 'data-rotulo': 'Instituto' } }),
      criarEl('td', { texto: disputa, className: 'pv-col-wrap', attrs: { 'data-rotulo': 'Disputa' } }),
      criarEl('td', {
        texto: formatarPeriodo(p.dataInicio, p.dataFim),
        className: 'pv-num',
        attrs: { 'data-rotulo': 'Campo' },
      }),
      criarEl('td', {
        className: 'pv-num',
        texto: p.amostra != null ? p.amostra.toLocaleString('pt-BR') : '—',
        attrs: { 'data-rotulo': 'Amostra' },
      }),
      criarEl('td', {
        className: 'pv-num',
        texto: p.margem != null ? `± ${formatarNumero(p.margem)} pts` : '—',
        attrs: { 'data-rotulo': 'Margem' },
      }),
      criarEl(
        'td',
        { attrs: { 'data-rotulo': 'Registro TSE' } },
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
        { className: 'pv-col-wrap', attrs: { 'data-rotulo': '3 primeiros colocados' } },
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
      criarEl('td', { attrs: { 'data-rotulo': 'Fonte' } }, [criarLinkFonte(p.fonte)]),
    ]);
  });

  table.append(thead, criarEl('tbody', {}, linhas));
  wrap.append(table);

  return criarEl('section', {}, [
    criarEl('h2', { className: 'pv-section-title', texto: 'Todas as pesquisas presidenciais' }),
    wrap,
  ]);
}
