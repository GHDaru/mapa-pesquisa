import '../styles/vote-estimate.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { Partido } from '../../../../domain/party.js';
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
import type {
  CandidatoEstimado,
  EstimativaVotos,
  OrigemVotoCandidato,
  UfOrigemVotos,
} from '../../../../domain/vote-estimate.js';
import { formatarNumeroPt, formatarPct, formatarVantagem } from '../format.js';
import { criarEl, rotuloEspectro, tokenFillEspectro, tokenSolidEspectro } from './_shared.js';

/**
 * Painel "Votos estimados por agregação estadual": consome apenas
 * `casos.getVoteEstimate()` e `casos.listParties()`. Módulo independente —
 * não importa nem depende de nenhuma outra view (`presidential-states-view`,
 * `senate-view`, `timeline-chart`, `presidential-view`, `candidate-names`),
 * cada uma delas em desenvolvimento em paralelo por outro agente; só usa
 * helpers estáveis e já compartilhados (`_shared.ts`, `format.ts`) e sua
 * própria folha de estilos (`styles/vote-estimate.css`, prefixo `ve-`).
 *
 * "Nunca inventa dados": quando `getVoteEstimate()` retorna `null` (dados
 * insuficientes — ver `domain/vote-estimate.ts`), o painel mostra um aviso
 * textual em vez de qualquer número.
 */

/** Renderiza o painel de votos estimados dentro de `container`. */
export function renderVoteEstimate(container: HTMLElement, casos: CasosDeUso): void {
  container.innerHTML = '';

  const raiz = criarEl('section', { className: 've-view', attrs: { 'aria-labelledby': 've-titulo' } });

  const estimativa = casos.getVoteEstimate();
  if (estimativa === null || estimativa.candidatos.length === 0) {
    raiz.append(
      criarEl('h1', { className: 've-title', texto: 'Votos estimados por agregação estadual', attrs: { id: 've-titulo' } }),
      criarEl('p', {
        className: 've-empty',
        texto:
          'Ainda não há dados suficientes (eleitorado cadastrado e pesquisas presidenciais, estaduais ou nacional) para calcular esta estimativa.',
      }),
    );
    container.append(raiz);
    return;
  }

  const partidos = casos.listParties();

  raiz.append(criarCabecalho(estimativa));
  raiz.append(criarSecaoComparacaoBarras(estimativa, partidos));
  raiz.append(criarSecaoComparacao(estimativa));
  raiz.append(criarLinhaNaoAtribuidos(estimativa));
  raiz.append(criarSecaoPorUf(estimativa));

  container.append(raiz);
}

/* ========================= Formatação ========================= */

/** Formata votos em milhões, 1 casa decimal, pt-BR: "62,3 milhões". */
export function formatarMilhoes(votos: number, casas = 1): string {
  const milhoes = votos / 1_000_000;
  return `${formatarNumeroPt(milhoes, casas)} milhões`;
}

/** Formata um inteiro com separador de milhar pt-BR: "1.234.567". */
function formatarInteiro(valor: number): string {
  return Math.round(valor).toLocaleString('pt-BR');
}

/* ==================== Barra empilhada (3 origens) ==================== */

export interface SegmentosBarra {
  /** % (0..100) dos votos vinda do percentual próprio da pesquisa estadual. */
  readonly pctEstadual: number;
  /** % (0..100) dos votos vinda do complemento nacional em UFs com pesquisa. */
  readonly pctComplemento: number;
  /** % (0..100) dos votos vinda de UFs sem pesquisa estadual. */
  readonly pctSemPesquisa: number;
}

/**
 * Calcula as proporções (0..100) dos 3 segmentos da barra empilhada de um
 * candidato a partir das 3 parcelas de voto já expostas por `estimarVotos`.
 * Soma sempre 100 (ou fica com os 3 em 0 quando o candidato não tem nenhum
 * voto estimado, para não dividir por zero).
 */
export function montarSegmentosBarra(
  candidato: Pick<CandidatoEstimado, 'votos' | 'votosDeUfComPesquisa' | 'votosComplementoNacional' | 'votosDeUfSemPesquisa'>,
): SegmentosBarra {
  const total = candidato.votos;
  if (!(total > 0)) {
    return { pctEstadual: 0, pctComplemento: 0, pctSemPesquisa: 0 };
  }
  return {
    pctEstadual: (candidato.votosDeUfComPesquisa / total) * 100,
    pctComplemento: (candidato.votosComplementoNacional / total) * 100,
    pctSemPesquisa: (candidato.votosDeUfSemPesquisa / total) * 100,
  };
}

/* ========================= Cabeçalho ========================= */

function criarCabecalho(e: EstimativaVotos): HTMLElement {
  const parcela = e.eleitoradoTotal > 0 ? (e.eleitoradoComPesquisaEstadual / e.eleitoradoTotal) * 100 : 0;

  return criarEl('header', { className: 've-header' }, [
    criarEl('h1', { className: 've-title', texto: 'Votos estimados por agregação estadual', attrs: { id: 've-titulo' } }),
    criarEl('p', {
      className: 've-method',
      texto:
        'Método em uma frase: cada UF contribui com o seu eleitorado apto — o total de eleitores registrados no ' +
        'TSE, sem descontar abstenção (em 2022 o comparecimento nacional foi de cerca de 79%) — multiplicado pelo ' +
        'percentual da própria pesquisa presidencial estadual, ou pelo percentual do agregado nacional quando falta ' +
        'pesquisa estadual.',
    }),
    criarEl('p', {
      className: 've-meta',
      texto:
        'Candidatos que não aparecem na pesquisa estadual de uma UF (comum quando a pesquisa testa só os primeiros ' +
        'colocados) recebem o percentual do agregado nacional aplicado ao eleitorado dessa UF, para não zerar ' +
        'candidatos menores — marcado com "*" na tabela por UF, ao final da página.',
    }),
    criarEstatisticas(e, parcela),
  ]);
}

function criarEstatisticas(e: EstimativaVotos, parcela: number): HTMLElement {
  const item = (rotulo: string, valor: string): HTMLElement =>
    criarEl('div', { className: 've-stat' }, [
      criarEl('dt', { className: 've-stat__rotulo', texto: rotulo }),
      criarEl('dd', { className: 've-stat__valor', texto: valor }),
    ]);

  return criarEl('dl', { className: 've-stats' }, [
    item('Eleitorado total', formatarInteiro(e.eleitoradoTotal)),
    item('Coberto por pesquisa estadual', `${formatarPct(parcela)} · ${formatarInteiro(e.eleitoradoComPesquisaEstadual)}`),
    item('UFs com pesquisa estadual', `${e.ufsComPesquisa.length} de ${e.ufsComPesquisa.length + e.ufsSemPesquisa.length}`),
    item('UFs sem pesquisa estadual', String(e.ufsSemPesquisa.length)),
  ]);
}

/* ========================= Cartões por candidato ========================= */

function resolverEspectro(partido: string | null, partidos: readonly Partido[]): Espectro {
  return espectroDoPartido(partido, partidos);
}

function criarBadgePartido(partido: string | null, espectro: Espectro): HTMLElement {
  const rotulo = partido?.trim() || 'Sem partido';
  return criarEl(
    'span',
    {
      className: 've-badge-partido',
      texto: rotulo,
      attrs: {
        style: `background:${tokenSolidEspectro(espectro)}`,
        title: `${rotulo} — ${rotuloEspectro(espectro)}`,
      },
    },
    [criarEl('span', { className: 've-sr-only', texto: ` (${rotuloEspectro(espectro)})` })],
  );
}

function criarLegendaBarra(comFaixa: boolean): HTMLElement {
  const item = (classeExtra: string | null, texto: string): HTMLElement =>
    criarEl('span', { className: 've-bar-legend__item' }, [
      criarEl('span', { className: classeExtra ? `ve-legend-swatch ${classeExtra}` : 've-legend-swatch' }),
      texto,
    ]);

  const itens = [
    item(null, 'Votos de UFs com pesquisa estadual'),
    item('ve-legend-swatch--complemento', 'Complemento nacional em UFs com pesquisa'),
    item('ve-legend-swatch--sem-pesquisa', 'Votos de UFs sem pesquisa estadual'),
  ];
  if (comFaixa) {
    itens.push(item('ve-legend-swatch--faixa', 'Faixa = margem de erro agregada'));
  }

  return criarEl('p', { className: 've-bar-legend' }, itens);
}

/** Constrói os 3 `<span>` de segmento (estadual/complemento/sem-pesquisa) de um candidato, sem o track/wrapper. */
function criarSegmentosBarra(candidato: CandidatoEstimado, espectro: Espectro): HTMLElement[] {
  const seg = montarSegmentosBarra(candidato);
  const corFill = tokenFillEspectro(espectro);

  const segmento = (pct: number, classe: string): HTMLElement | null => {
    if (pct <= 0) return null;
    return criarEl('span', {
      className: `ve-bar-seg ${classe}`,
      attrs: { style: `width:${pct}%; --ve-cor-seg:${corFill};` },
    });
  };

  return [
    segmento(seg.pctEstadual, 've-bar-seg--estadual'),
    segmento(seg.pctComplemento, 've-bar-seg--complemento'),
    segmento(seg.pctSemPesquisa, 've-bar-seg--sem-pesquisa'),
  ].filter((el): el is HTMLElement => el !== null);
}

/**
 * Mini-barra de composição (100% = votos do PRÓPRIO candidato), usada como
 * detalhe secundário de proveniência dentro do card — não compara magnitude
 * entre candidatos (ver `criarSecaoComparacaoBarras` para o gráfico de
 * comparação, com escala única e faixa de incerteza).
 */
function criarBarraSegmentada(candidato: CandidatoEstimado, espectro: Espectro): HTMLElement {
  const seg = montarSegmentosBarra(candidato);

  const track = criarEl('div', {
    className: 've-bar-track',
    attrs: {
      role: 'img',
      'aria-label':
        `Composição da fonte dos votos estimados de ${candidato.candidato} (não é uma comparação de magnitude): ` +
        `${formatarPct(seg.pctEstadual)} de UFs com pesquisa estadual, ` +
        `${formatarPct(seg.pctComplemento)} de complemento nacional em UFs com pesquisa, ` +
        `${formatarPct(seg.pctSemPesquisa)} de UFs sem pesquisa estadual.`,
    },
  });

  if (candidato.votos <= 0) {
    track.append(criarEl('span', { className: 've-bar-seg ve-bar-seg--sem-dados' }));
    return track;
  }

  track.append(...criarSegmentosBarra(candidato, espectro));
  return track;
}

/* ============ Gráfico de comparação: barras proporcionais + faixa de incerteza ============ */

export interface EscalaBarraComparacao {
  /** % (0..100, relativo à maior `votosMax` entre os candidatos) do comprimento da barra sólida (`votos`). */
  readonly pctBarra: number;
  /** % (0..100) da posição do extremo inferior da faixa de incerteza (`votosMin`). */
  readonly pctMin: number;
  /** % (0..100) da posição do extremo superior da faixa de incerteza (`votosMax`). */
  readonly pctMax: number;
}

/**
 * Calcula, para uma escala única compartilhada por todos os candidatos
 * (0 até `maiorVotosMax`), as posições (0..100%) do comprimento da barra e
 * dos dois extremos da faixa de incerteza. `maiorVotosMax` deve ser o maior
 * `votosMax` entre todos os candidatos exibidos, para que a faixa de
 * ninguém extrapole a escala.
 */
export function calcularEscalaBarraComparacao(
  candidato: Pick<CandidatoEstimado, 'votos' | 'votosMin' | 'votosMax'>,
  maiorVotosMax: number,
): EscalaBarraComparacao {
  if (!(maiorVotosMax > 0)) {
    return { pctBarra: 0, pctMin: 0, pctMax: 0 };
  }
  return {
    pctBarra: (candidato.votos / maiorVotosMax) * 100,
    pctMin: (candidato.votosMin / maiorVotosMax) * 100,
    pctMax: (candidato.votosMax / maiorVotosMax) * 100,
  };
}

function criarLinhaComparacaoBarra(
  candidato: CandidatoEstimado,
  partidos: readonly Partido[],
  maiorVotosMax: number,
): HTMLElement {
  const espectro = resolverEspectro(candidato.partido, partidos);
  const seg = montarSegmentosBarra(candidato);
  const escala = calcularEscalaBarraComparacao(candidato, maiorVotosMax);

  const rotuloAria =
    `${candidato.candidato}: ${formatarMilhoes(candidato.votos)} de votos estimados, ` +
    `${formatarPct(candidato.pctDoEleitorado)} do eleitorado. ` +
    `Faixa de incerteza (margem de erro agregada): ${formatarMilhoes(candidato.votosMin)} a ` +
    `${formatarMilhoes(candidato.votosMax)}. Composição: ${formatarPct(seg.pctEstadual)} de UFs com pesquisa ` +
    `estadual, ${formatarPct(seg.pctComplemento)} de complemento nacional em UFs com pesquisa, ` +
    `${formatarPct(seg.pctSemPesquisa)} de UFs sem pesquisa estadual.`;

  const barra = criarEl('div', {
    className: 've-chart-bar',
    attrs: { style: `width:${escala.pctBarra}%` },
  });
  if (candidato.votos > 0) {
    barra.append(...criarSegmentosBarra(candidato, espectro));
  } else {
    barra.classList.add('ve-chart-bar--sem-dados');
  }

  const whisker = criarEl('div', {
    className: 've-chart-whisker',
    attrs: { style: `left:${escala.pctMin}%; width:${Math.max(0, escala.pctMax - escala.pctMin)}%` },
  });

  const track = criarEl(
    'div',
    { className: 've-chart-track', attrs: { role: 'img', 'aria-label': rotuloAria } },
    [barra, whisker],
  );

  const valor = criarEl('span', {
    className: 've-chart-value',
    texto: `${formatarMilhoes(candidato.votos)} · ${formatarPct(candidato.pctDoEleitorado)}`,
  });

  return criarEl('div', { className: 've-chart-row' }, [
    criarEl('div', { className: 've-chart-row__head' }, [
      criarBadgePartido(candidato.partido, espectro),
      criarEl('span', { className: 've-chart-row__nome', texto: candidato.candidato, attrs: { title: candidato.candidato } }),
    ]),
    criarEl('div', { className: 've-chart-row__bar-line' }, [track, valor]),
  ]);
}

function criarSecaoComparacaoBarras(e: EstimativaVotos, partidos: readonly Partido[]): HTMLElement {
  const candidatos = e.candidatos; // já ordenados por votos desc.
  const maiorVotosMax = candidatos.reduce((max, c) => Math.max(max, c.votosMax), 0);

  const chart = criarEl(
    'div',
    { className: 've-chart' },
    candidatos.map((c) => criarLinhaComparacaoBarra(c, partidos, maiorVotosMax)),
  );

  return criarEl('section', { attrs: { 'aria-labelledby': 've-chart-heading' } }, [
    criarEl('h2', {
      className: 've-section-title',
      texto: 'Comparação entre candidatos',
      attrs: { id: 've-chart-heading' },
    }),
    criarLegendaBarra(true),
    chart,
  ]);
}

/* ============ Comparação: agregação estadual × média nacional ============ */

function criarSecaoComparacao(e: EstimativaVotos): HTMLElement {
  const linhas = [...e.comparacaoNacional]
    .sort((a, b) => b.pctEstimado - a.pctEstimado)
    .map((c) => {
      const diferenca = c.pctEstimado - c.pctNacional;
      return criarEl('tr', {}, [
        criarEl('td', { texto: c.candidato, attrs: { 'data-rotulo': 'Candidato' } }),
        criarEl('td', {
          className: 've-col-num',
          texto: formatarPct(c.pctEstimado),
          attrs: { 'data-rotulo': '% estimado por estados' },
        }),
        criarEl('td', {
          className: 've-col-num',
          texto: formatarPct(c.pctNacional),
          attrs: { 'data-rotulo': '% média nacional' },
        }),
        criarEl('td', {
          className: 've-col-num',
          texto: formatarVantagem(diferenca),
          attrs: { 'data-rotulo': 'Diferença' },
        }),
      ]);
    });

  const wrap = criarEl('div', { className: 've-table-wrap ve-stack-table-wrap' }, [
    criarEl('table', { className: 've-table' }, [
      criarEl('thead', {}, [
        criarEl('tr', {}, [
          criarEl('th', { texto: 'Candidato', attrs: { scope: 'col' } }),
          criarEl('th', { className: 've-col-num', texto: '% estimado por estados', attrs: { scope: 'col' } }),
          criarEl('th', { className: 've-col-num', texto: '% média nacional', attrs: { scope: 'col' } }),
          criarEl('th', { className: 've-col-num', texto: 'Diferença', attrs: { scope: 'col' } }),
        ]),
      ]),
      criarEl('tbody', {}, linhas),
    ]),
  ]);

  return criarEl('section', { attrs: { 'aria-labelledby': 've-compare-heading' } }, [
    criarEl('h2', {
      className: 've-section-title',
      texto: 'Agregação estadual × média nacional',
      attrs: { id: 've-compare-heading' },
    }),
    wrap,
    criarEl('p', {
      className: 've-meta',
      texto:
        'Diferença calculada sobre os valores exatos (não arredondados) de cada percentual — por isso pode ' +
        'divergir em até 0,1 pt da subtração direta das duas colunas ao lado, já arredondadas para exibição.',
    }),
  ]);
}

/* ========================= Não atribuídos ========================= */

function criarLinhaNaoAtribuidos(e: EstimativaVotos): HTMLElement {
  return criarEl('p', { className: 've-nao-atribuidos' }, [
    criarEl('strong', { texto: 'Não atribuídos (brancos, nulos, indecisos e candidatos fora do ranking): ' }),
    `${formatarMilhoes(e.naoAtribuidos.votos)} — ${formatarPct(e.naoAtribuidos.pct)} do eleitorado. `,
    'Inclui a abstenção: os percentuais das pesquisas são aplicados sobre o eleitorado apto, não sobre o ' +
      'comparecimento (ver "Método em uma frase" no topo da página).',
  ]);
}

/* ========================= Tabela por UF ========================= */

interface CandidatoNaUf {
  readonly nome: string;
  readonly votos: number;
  readonly origem: OrigemVotoCandidato;
}

function candidatosOrdenadosDaUf(uf: UfOrigemVotos): CandidatoNaUf[] {
  return Object.entries(uf.votosPorCandidato)
    .map(([nome, v]) => ({ nome, votos: v.votos, origem: v.origem }))
    .sort((a, b) => b.votos - a.votos);
}

function criarBadgeOrigem(origem: 'estadual' | 'nacional'): HTMLElement {
  const rotulo = origem === 'estadual' ? 'Estadual' : 'Nacional';
  return criarEl('span', { className: `ve-badge-origem ve-badge-origem--${origem}`, texto: rotulo });
}

/** Célula com nome + votos de um candidato na UF; marca com "*" quando a parcela veio do complemento nacional. */
function celulaCandidatoUf(c: CandidatoNaUf): HTMLElement {
  const marcador = c.origem === 'complemento-nacional' ? ' *' : '';
  return criarEl('span', {}, [
    `${c.nome}${marcador} `,
    criarEl('span', { className: 've-uf-candidato__votos', texto: formatarInteiro(c.votos) }),
  ]);
}

function criarLinhaUf(uf: UfOrigemVotos): HTMLElement {
  const candidatos = candidatosOrdenadosDaUf(uf);
  const [c1, c2] = candidatos;
  const outros = candidatos.slice(2);
  const somaOutros = outros.reduce((soma, c) => soma + c.votos, 0);

  return criarEl('tr', {}, [
    criarEl('td', { texto: uf.uf, attrs: { 'data-rotulo': 'UF' } }),
    criarEl('td', { className: 've-col-num', texto: formatarInteiro(uf.eleitores), attrs: { 'data-rotulo': 'Eleitores' } }),
    criarEl('td', { attrs: { 'data-rotulo': 'Origem' } }, [criarBadgeOrigem(uf.origem)]),
    criarEl('td', { attrs: { 'data-rotulo': '1º colocado' } }, [c1 ? celulaCandidatoUf(c1) : '—']),
    criarEl('td', { attrs: { 'data-rotulo': '2º colocado' } }, [c2 ? celulaCandidatoUf(c2) : '—']),
    criarEl('td', { attrs: { 'data-rotulo': 'Outros' } }, [
      outros.length > 0
        ? `${outros.length} candidato${outros.length > 1 ? 's' : ''} · ${formatarInteiro(somaOutros)}`
        : criarEl('span', { className: 've-meta-inline', texto: '—' }),
    ]),
  ]);
}

function criarSecaoPorUf(e: EstimativaVotos): HTMLElement {
  const linhas = [...e.porUf].sort((a, b) => b.eleitores - a.eleitores).map(criarLinhaUf);

  const wrap = criarEl('div', { className: 've-table-wrap ve-stack-table-wrap ve-uf-table-wrap' }, [
    criarEl('table', { className: 've-table' }, [
      criarEl('thead', {}, [
        criarEl(
          'tr',
          {},
          ['UF', 'Eleitores', 'Origem', '1º colocado', '2º colocado', 'Outros'].map((texto) =>
            criarEl('th', { texto, attrs: { scope: 'col' } }),
          ),
        ),
      ]),
      criarEl('tbody', {}, linhas),
    ]),
  ]);

  return criarEl('section', { attrs: { 'aria-labelledby': 've-uf-heading' } }, [
    criarEl('h2', { className: 've-section-title', texto: 'Detalhe por UF', attrs: { id: 've-uf-heading' } }),
    criarEl('p', {
      className: 've-meta',
      texto: '* candidato ausente da pesquisa estadual dessa UF — parcela suprida pelo percentual do agregado nacional.',
    }),
    wrap,
  ]);
}
