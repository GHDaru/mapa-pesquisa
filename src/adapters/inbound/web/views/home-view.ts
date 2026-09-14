import '../styles/home.css';
import type { CasosDeUso, VisaoGeralUf } from '../../../../application/use-cases/index.js';
import { type Agregado, ehLinhaNaoCandidato, JANELA_DIAS_PADRAO, MEIA_VIDA_DIAS_PADRAO } from '../../../../domain/aggregate.js';
import type { Partido } from '../../../../domain/party.js';
import { dataReferencia, type Fonte, type Pesquisa } from '../../../../domain/poll.js';
import { type Cargo, UF_NACIONAL } from '../../../../domain/race.js';
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
import type { EstimativaVotos } from '../../../../domain/vote-estimate.js';
import { nomeCurto } from './candidate-names.js';
import { formatarVantagem } from '../format.js';
import {
  calcularFaixaIncerteza,
  classeEspectro,
  criarEl,
  formatarData,
  formatarNumero,
  formatarPct,
  rotuloEspectro,
  tokenFillEspectro,
} from './_shared.js';

/* =========================================================================
 * "Resumo do dia" — função pura (sem DOM, sem I/O). Recebe os agregados já
 * calculados pelos casos de uso e reformata os números do hero e das seções
 * seguintes: líder presidencial (1º turno, com o 2º colocado), estimativa
 * de votos dos 2 primeiros e a projeção do Senado por bloco de espectro.
 * Testada isoladamente em __tests__/home-view.test.ts.
 * ======================================================================= */

export interface ResumoSegundoColocado {
  readonly candidato: string;
  readonly partido: string | null;
  readonly pct: number;
}

export interface ResumoLiderPresidencial {
  readonly lider: string;
  readonly partido: string | null;
  readonly pct: number;
  readonly segundo: ResumoSegundoColocado | null;
  readonly vantagem: number;
  readonly empateTecnico: boolean;
  /** Margem de referência ponderada do agregado — desenha a faixa de incerteza do hero. */
  readonly margemReferencia: number;
  /** Quantas pesquisas entraram na média (janela de recência) — "média de N pesquisas" do hero. */
  readonly pesquisasUsadas: number;
}

export interface ResumoVotoCandidato {
  readonly candidato: string;
  readonly partido: string | null;
  readonly votos: number;
  readonly pctDoEleitorado: number;
}

export interface ResumoVotos {
  readonly primeiro: ResumoVotoCandidato;
  readonly segundo: ResumoVotoCandidato | null;
}

export interface ResumoSenado {
  readonly esquerda: number;
  readonly centro: number;
  readonly direita: number;
  readonly total: number;
}

export interface ResumoDoDia {
  readonly presidencial: ResumoLiderPresidencial | null;
  readonly votos: ResumoVotos | null;
  readonly senado: ResumoSenado;
}

type BucketSenado = 'esquerda' | 'centro' | 'direita';

/**
 * Reduz a escala de 5 níveis do espectro (docs/design-system.md) aos 3
 * blocos pedidos para o resumo do dia. `indefinido` (partido sem
 * classificação, ou cadeira sem vencedor definido) entra em "centro" — não
 * existe bloco "sem definição" no resumo de 3 números, e colocá-lo à
 * esquerda ou à direita implicaria uma posição que os dados não sustentam.
 */
const BUCKET_POR_ESPECTRO: Readonly<Record<Espectro, BucketSenado>> = {
  esquerda: 'esquerda',
  'centro-esquerda': 'esquerda',
  centro: 'centro',
  indefinido: 'centro',
  'centro-direita': 'direita',
  direita: 'direita',
};

function paraResumoVoto(c: EstimativaVotos['candidatos'][number]): ResumoVotoCandidato {
  return { candidato: c.candidato, partido: c.partido, votos: c.votos, pctDoEleitorado: c.pctDoEleitorado };
}

export function montarResumoDoDia(
  agregadoPresidencialTurno1: Agregado | null,
  estimativaVotos: EstimativaVotos | null,
  totalPorEspectro: Readonly<Partial<Record<Espectro, number>>>,
): ResumoDoDia {
  const presidencial: ResumoLiderPresidencial | null =
    agregadoPresidencialTurno1?.lider != null
      ? {
          lider: agregadoPresidencialTurno1.lider.candidato,
          partido: agregadoPresidencialTurno1.lider.partido,
          pct: agregadoPresidencialTurno1.lider.pct,
          segundo: agregadoPresidencialTurno1.segundo
            ? {
                candidato: agregadoPresidencialTurno1.segundo.candidato,
                partido: agregadoPresidencialTurno1.segundo.partido,
                pct: agregadoPresidencialTurno1.segundo.pct,
              }
            : null,
          vantagem: agregadoPresidencialTurno1.vantagem,
          empateTecnico: agregadoPresidencialTurno1.empateTecnico,
          margemReferencia: agregadoPresidencialTurno1.margemReferencia,
          pesquisasUsadas: agregadoPresidencialTurno1.pesquisasUsadas.length,
        }
      : null;

  const candidatosVotos = estimativaVotos?.candidatos ?? [];
  const primeiroVoto = candidatosVotos[0];
  const votos: ResumoVotos | null = primeiroVoto
    ? {
        primeiro: paraResumoVoto(primeiroVoto),
        segundo: candidatosVotos[1] ? paraResumoVoto(candidatosVotos[1]) : null,
      }
    : null;

  let esquerda = 0;
  let centro = 0;
  let direita = 0;
  let total = 0;
  for (const [espectroBruto, quantidadeBruta] of Object.entries(totalPorEspectro)) {
    const quantidade = quantidadeBruta ?? 0;
    const bucket = BUCKET_POR_ESPECTRO[espectroBruto as Espectro] ?? 'centro';
    if (bucket === 'esquerda') esquerda += quantidade;
    else if (bucket === 'direita') direita += quantidade;
    else centro += quantidade;
    total += quantidade;
  }

  return { presidencial, votos, senado: { esquerda, centro, direita, total } };
}

/* =========================================================================
 * Helpers de DOM/formatação locais desta view (prefixo `hm-`, sem depender
 * das classes `pv-*` de styles/views.css — ver styles/home.css).
 * ======================================================================= */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Badge de sigla de partido, colorido pelo espectro — reforço textual via title/sr-only, nunca só a cor. */
function criarBadgePartido(sigla: string, espectro: Espectro): HTMLElement {
  return criarEl(
    'span',
    {
      className: `hm-badge-partido ${classeEspectro(espectro)}`,
      texto: sigla,
      attrs: { title: `${sigla} — ${rotuloEspectro(espectro)}` },
    },
    [criarEl('span', { className: 'sr-only', texto: ` (${rotuloEspectro(espectro)})` })],
  );
}

/** Link externo acessível para a fonte de uma pesquisa: nova aba + aviso para leitor de tela. */
function criarLinkFonte(fonte: Fonte): HTMLAnchorElement {
  return criarEl(
    'a',
    { className: 'hm-link-fonte hm-quiet-link', attrs: { href: fonte.url, target: '_blank', rel: 'noopener noreferrer' } },
    ['Fonte', criarEl('span', { className: 'sr-only', texto: ' (abre em nova aba)' })],
  );
}

const ROTULOS_CARGO: Readonly<Record<Cargo, string>> = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senador',
};

/** "Governador · BA"; para presidente nacional, só "Presidente" (não há UF a mostrar). */
function rotuloDisputa(p: Pesquisa): string {
  const rotuloCargo = ROTULOS_CARGO[p.disputa.cargo];
  if (p.disputa.cargo === 'presidente' && p.disputa.uf === UF_NACIONAL) return rotuloCargo;
  return `${rotuloCargo} · ${p.disputa.uf}`;
}

/** "1º turno" / "2º turno" — mesmo padrão de `polls-database-view.ts` e `presidential-view.ts`. */
function rotuloTurno(turno: 1 | 2): string {
  return `${turno}º turno`;
}

/**
 * Badge de turno ao lado do rótulo de disputa do card. Existe para que duas
 * pesquisas da mesma disputa/instituto/data (1º e 2º turno, ex.: RJ
 * Presidente) nunca pareçam cards duplicados na grade — ver P0 de
 * docs/critica-ui-inicio.md. Quando a pesquisa tem `cenario` (ex.: "2º turno
 * (Lula x Flávio Bolsonaro) — recorte..."), ele vira o `title` do badge: é
 * texto livre longo demais para caber no card, mas fica disponível ao passar
 * o mouse/foco.
 */
function criarBadgeTurno(p: Pesquisa): HTMLElement {
  return criarEl('span', {
    className: `hm-poll-card__turno hm-poll-card__turno--t${p.disputa.turno}`,
    texto: rotuloTurno(p.disputa.turno),
    attrs: p.cenario ? { title: p.cenario } : {},
  });
}

/** Os 2 primeiros colocados de uma pesquisa (exclui brancos/nulos/indecisos/etc.), por % desc. */
function top2Candidatos(p: Pesquisa): readonly { candidato: string; partido: string | null; pct: number }[] {
  return [...p.resultados]
    .filter((r) => !ehLinhaNaoCandidato(r.candidato, new Set()))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);
}

/* =========================================================================
 * 1. Hero — ver docs/briefing-landing-page.md "Estrutura do hero".
 * ======================================================================= */

/**
 * Textura ambiente do hero: hachura diagonal a 5% de opacidade (a
 * opacidade em si vive em `.hm-hero__texture`, styles/home.css) — mesmo
 * princípio visual de "sem dados"/incerteza já usado no mapa e no
 * hemiciclo (map-view.ts, senate-view.ts), aqui puramente decorativo atrás
 * do conteúdo do hero.
 */
function construirTexturaHero(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'hm-hero__texture');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const defs = document.createElementNS(SVG_NS, 'defs');
  const pattern = document.createElementNS(SVG_NS, 'pattern');
  pattern.setAttribute('id', 'hm-hero-hachura');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', '8');
  pattern.setAttribute('height', '8');
  pattern.setAttribute('patternTransform', 'rotate(45)');
  const linha = document.createElementNS(SVG_NS, 'line');
  linha.setAttribute('x1', '0');
  linha.setAttribute('y1', '0');
  linha.setAttribute('x2', '0');
  linha.setAttribute('y2', '8');
  linha.setAttribute('stroke', 'currentColor');
  linha.setAttribute('stroke-width', '2');
  pattern.append(linha);
  defs.append(pattern);
  svg.append(defs);

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', 'url(#hm-hero-hachura)');
  svg.append(rect);

  return svg;
}

/** Eyebrow: "Presidente · 1º turno" + timestamp exato de `meta.atualizadoEm` — a fonte não traz hora, então o texto nunca inventa uma ("Atualizado em dd/mm/aaaa", nunca "às hh:mm"). */
function construirEyebrow(atualizadoEm: string): HTMLElement {
  return criarEl('p', { className: 'hm-hero__eyebrow' }, [
    criarEl('span', { className: 'hm-hero__eyebrow-tag', texto: 'Presidente · 1º turno' }),
    // Separador + timestamp num único span (`white-space: nowrap` via CSS)
    // para os dois quebrarem juntos em telas estreitas, nunca deixando o
    // "·" sozinho no fim da linha do olho editorial.
    criarEl('span', { className: 'hm-hero__eyebrow-meta' }, [
      criarEl('span', { className: 'hm-hero__eyebrow-sep', texto: '· ', attrs: { 'aria-hidden': 'true' } }),
      criarEl('span', {
        className: 'hm-hero__timestamp tabular-nums',
        texto: `Atualizado em ${formatarData(atualizadoEm)}`,
      }),
    ]),
  ]);
}

function construirLinhaLider(p: ResumoLiderPresidencial, espectro: Espectro): HTMLElement {
  return criarEl('p', { className: 'hm-hero__lider' }, [
    criarEl('span', { className: 'hm-hero__lider-nome', texto: nomeCurto(p.lider) }),
    p.partido ? criarBadgePartido(p.partido, espectro) : null,
    criarEl('span', { className: 'hm-hero__lider-pct', texto: formatarPct(p.pct) }),
  ]);
}

/**
 * Faixa de margem de erro sob o número do líder — mesma lógica visual de
 * `.pv-bar-track`/`.pv-bar-uncertainty` (presidential-view.ts,
 * styles/views.css), calculada por `calcularFaixaIncerteza`
 * (views/_shared.ts) para não duplicar a fórmula em duas views. Puramente
 * ilustrativa (a vantagem/empate já está dita por extenso ao lado —
 * `aria-hidden`).
 */
function construirFaixaLider(p: ResumoLiderPresidencial, espectroLider: Espectro): HTMLElement {
  const pct = Math.max(0, Math.min(100, p.pct));
  const { esquerda, largura } = calcularFaixaIncerteza(pct, p.margemReferencia);
  const cor = tokenFillEspectro(espectroLider);

  const filhos: (HTMLElement | null)[] = [
    criarEl('span', {
      className: 'hm-hero__track-uncertainty',
      attrs: { style: `left:${esquerda}%;width:${largura}%;background:${cor}` },
    }),
    criarEl('span', { className: 'hm-hero__track-fill', attrs: { style: `width:${pct}%;background:${cor}` } }),
  ];
  if (p.segundo) {
    const pctSegundo = Math.max(0, Math.min(100, p.segundo.pct));
    filhos.push(criarEl('span', { className: 'hm-hero__track-tick', attrs: { style: `left:${pctSegundo}%` } }));
  }

  return criarEl('div', { className: 'hm-hero__track', attrs: { 'aria-hidden': 'true' } }, filhos);
}

/** 2º colocado + vantagem ("+N,N pts", Fraunces reto) ou "Empate técnico" (Fraunces itálico) — nunca só cor. */
function construirLinhaSegundo(p: ResumoLiderPresidencial, segundo: ResumoSegundoColocado, espectro: Espectro): HTMLElement {
  const vantagemOuEmpate = p.empateTecnico
    ? criarEl('em', { className: 'hm-hero__empate', texto: 'Empate técnico' })
    : criarEl('strong', { className: 'hm-hero__vantagem', texto: formatarVantagem(p.vantagem) });

  return criarEl('p', { className: 'hm-hero__segundo' }, [
    criarEl('span', { className: 'hm-hero__segundo-label', texto: '2º colocado:' }),
    criarEl('span', { className: 'hm-hero__segundo-nome', texto: nomeCurto(segundo.candidato) }),
    segundo.partido ? criarBadgePartido(segundo.partido, espectro) : null,
    criarEl('span', { className: 'hm-hero__segundo-pct tabular-nums', texto: formatarPct(segundo.pct) }),
    vantagemOuEmpate,
  ]);
}

/** "Média de N pesquisas" + link inline "como calculamos" (cor `--hm-selo`) — sempre visível perto do número, nunca em rodapé. */
function construirLinhaConfianca(p: ResumoLiderPresidencial): HTMLElement {
  return criarEl('p', { className: 'hm-hero__confianca' }, [
    'Média de ',
    criarEl('span', { className: 'tabular-nums', texto: formatarNumero(p.pesquisasUsadas, 0) }),
    p.pesquisasUsadas === 1 ? ' pesquisa · ' : ' pesquisas · ',
    criarEl('a', { className: 'hm-hero__como', texto: 'como calculamos', attrs: { href: '#/presidente' } }),
  ]);
}

function construirHeroVazio(): HTMLElement {
  return criarEl('p', {
    className: 'hm-hero__vazio',
    texto: 'Ainda não há pesquisa presidencial de 1º turno suficiente para calcular um líder.',
  });
}

function construirHero(casos: CasosDeUso, resumo: ResumoDoDia, partidos: readonly Partido[]): HTMLElement {
  const meta = casos.getMeta();
  const p = resumo.presidencial;

  const conteudo: (Node | null)[] = [
    criarEl('h1', { className: 'sr-only', texto: 'Mapa das Pesquisas 2026' }),
    construirEyebrow(meta.atualizadoEm),
  ];

  if (p) {
    const espectroLider = espectroDoPartido(p.partido, partidos);
    conteudo.push(construirLinhaLider(p, espectroLider));
    conteudo.push(construirFaixaLider(p, espectroLider));
    if (p.segundo) {
      conteudo.push(construirLinhaSegundo(p, p.segundo, espectroDoPartido(p.segundo.partido, partidos)));
    }
    conteudo.push(construirLinhaConfianca(p));
  } else {
    conteudo.push(construirHeroVazio());
  }

  conteudo.push(
    criarEl('div', { className: 'hm-hero__actions' }, [
      criarEl('a', { className: 'hm-cta hm-cta--primary', texto: 'Ver o mapa', attrs: { href: '#/mapa' } }),
      criarEl('a', { className: 'hm-cta', texto: 'Ver presidente', attrs: { href: '#/presidente' } }),
    ]),
  );

  return criarEl('section', { className: 'hm-hero', attrs: { 'aria-label': 'Resumo da disputa presidencial' } }, [
    construirTexturaHero(),
    criarEl('div', { className: 'hm-hero__inner' }, conteudo),
  ]);
}

/* =========================================================================
 * 2. Resumo do dia — tiles quietos: estimativa de votos, Senado por
 * espectro e o tamanho da base de pesquisas (com o selo TSE).
 * ======================================================================= */

function construirLinhaVoto(c: ResumoVotoCandidato, partidos: readonly Partido[]): HTMLElement {
  const espectro = espectroDoPartido(c.partido, partidos);
  return criarEl('li', { className: 'hm-resumo__voto-linha' }, [
    c.partido ? criarBadgePartido(c.partido, espectro) : criarEl('span', { className: 'hm-resumo__sem-partido', texto: 'S/P' }),
    criarEl('span', { className: 'hm-resumo__voto-nome', texto: nomeCurto(c.candidato) }),
    criarEl('span', { className: 'hm-resumo__voto-valor tabular-nums', texto: `${formatarNumero(c.votos, 0)} votos` }),
    criarEl('span', { className: 'hm-resumo__voto-pct tabular-nums', texto: `${formatarPct(c.pctDoEleitorado)} do eleitorado` }),
  ]);
}

function construirCardVotos(v: ResumoVotos | null, partidos: readonly Partido[]): HTMLElement {
  if (!v) {
    return criarEl('div', { className: 'hm-resumo__card' }, [
      criarEl('p', { className: 'hm-resumo__label', texto: 'Estimativa de votos' }),
      criarEl('p', { className: 'hm-resumo__vazio', texto: 'Eleitorado insuficiente para estimar.' }),
    ]);
  }
  const candidatos = v.segundo ? [v.primeiro, v.segundo] : [v.primeiro];
  return criarEl('div', { className: 'hm-resumo__card' }, [
    criarEl('p', { className: 'hm-resumo__label', texto: 'Estimativa de votos — 1º e 2º' }),
    criarEl(
      'ul',
      { className: 'hm-resumo__votos-lista' },
      candidatos.map((c) => construirLinhaVoto(c, partidos)),
    ),
  ]);
}

const ROTULOS_BUCKET_SENADO: Readonly<Record<BucketSenado, string>> = {
  esquerda: 'Esquerda',
  centro: 'Centro',
  direita: 'Direita',
};
const SWATCH_BUCKET_SENADO: Readonly<Record<BucketSenado, string>> = {
  esquerda: 'var(--spectrum-1-fill)',
  centro: 'var(--spectrum-3-fill)',
  direita: 'var(--spectrum-5-fill)',
};

function construirCardSenado(s: ResumoSenado): HTMLElement {
  const buckets: BucketSenado[] = ['esquerda', 'centro', 'direita'];
  return criarEl('div', { className: 'hm-resumo__card' }, [
    criarEl('p', { className: 'hm-resumo__label', texto: `Projeção do Senado — ${formatarNumero(s.total, 0)} assentos` }),
    criarEl(
      'ul',
      { className: 'hm-resumo__senado-lista' },
      buckets.map((bucket) =>
        criarEl('li', { className: 'hm-resumo__senado-linha' }, [
          criarEl('span', {
            className: 'hm-resumo__senado-swatch',
            attrs: { style: `background:${SWATCH_BUCKET_SENADO[bucket]}`, 'aria-hidden': 'true' },
          }),
          criarEl('span', { className: 'hm-resumo__senado-rotulo', texto: ROTULOS_BUCKET_SENADO[bucket] }),
          criarEl('span', { className: 'hm-resumo__senado-valor tabular-nums', texto: String(s[bucket]) }),
        ]),
      ),
    ),
  ]);
}

/** Tamanho da base de pesquisas, com o selo "Registrado no TSE" (`--hm-verificado`) ao lado da contagem — ver briefing item 5. */
function construirCardBaseDePesquisas(casos: CasosDeUso): HTMLElement {
  const totais = casos.getPollsDatabase().totais;
  return criarEl('div', { className: 'hm-resumo__card' }, [
    criarEl('p', { className: 'hm-resumo__label', texto: 'Base de pesquisas' }),
    criarEl('p', { className: 'hm-resumo__value tabular-nums', texto: formatarNumero(totais.total, 0) }),
    criarEl('p', { className: 'hm-resumo__detail' }, [
      criarEl('span', { className: 'hm-selo-tse' }, [
        criarEl('span', { className: 'hm-selo-tse__icone', texto: '✓', attrs: { 'aria-hidden': 'true' } }),
        'Registrado no TSE',
      ]),
      criarEl('span', {}, [
        criarEl('span', { className: 'tabular-nums', texto: formatarNumero(totais.comRegistroTSE, 0) }),
        ' de ',
        criarEl('span', { className: 'tabular-nums', texto: formatarNumero(totais.total, 0) }),
        ' pesquisas',
      ]),
    ]),
  ]);
}

function construirResumoDoDia(casos: CasosDeUso, resumo: ResumoDoDia, partidos: readonly Partido[]): HTMLElement {
  return criarEl('section', { className: 'hm-section', attrs: { 'aria-label': 'Resumo do dia' } }, [
    criarEl('h2', { className: 'hm-section__title', texto: 'Resumo do dia' }),
    criarEl('div', { className: 'hm-resumo' }, [
      construirCardVotos(resumo.votos, partidos),
      construirCardSenado(resumo.senado),
      construirCardBaseDePesquisas(casos),
    ]),
  ]);
}

/* =========================================================================
 * 3. Prévia do mapa — "prova", não abertura: grade reduzida das 27 UFs
 * coloridas pelo espectro de quem lidera o governo (getMapOverview()), com
 * link para as telas completas do mapa e do hemiciclo do Senado.
 * ======================================================================= */

/** Descrição por extenso do chip, usada em `title` e num `sr-only` — nunca só a cor. */
function descricaoChipEstado(u: VisaoGeralUf): string {
  if (u.semDados) return `${u.uf}: ainda sem pesquisa de governador suficiente.`;
  const lider = u.liderGovernador ? nomeCurto(u.liderGovernador) : '—';
  const partido = u.partido ? ` (${u.partido})` : '';
  const situacao = u.empateTecnico ? 'empate técnico' : `vantagem de ${formatarVantagem(u.vantagem)}`;
  return `${u.uf}: ${lider}${partido} — ${situacao}.`;
}

function construirChipEstado(u: VisaoGeralUf): HTMLElement {
  const classes = ['hm-mapa-preview__chip'];
  if (u.semDados) {
    classes.push('hm-mapa-preview__chip--sem-dados');
  } else {
    classes.push(classeEspectro(u.espectro));
    if (u.empateTecnico) classes.push('hm-mapa-preview__chip--empate');
  }
  const descricao = descricaoChipEstado(u);
  return criarEl('li', { className: classes.join(' '), attrs: { title: descricao } }, [
    u.uf,
    criarEl('span', { className: 'sr-only', texto: ` — ${descricao}` }),
  ]);
}

const LEGENDA_ESPECTRO_MAPA: readonly Espectro[] = ['esquerda', 'centro-esquerda', 'centro', 'centro-direita', 'direita'];

function construirLegendaMapa(): HTMLElement {
  const itens = LEGENDA_ESPECTRO_MAPA.map((espectro) =>
    criarEl('li', {}, [
      criarEl('span', { className: `hm-mapa-preview__swatch ${classeEspectro(espectro)}`, attrs: { 'aria-hidden': 'true' } }),
      rotuloEspectro(espectro),
    ]),
  );
  itens.push(
    criarEl('li', {}, [
      criarEl('span', { className: 'hm-mapa-preview__swatch hm-mapa-preview__swatch--sem-dados', attrs: { 'aria-hidden': 'true' } }),
      'Sem pesquisa',
    ]),
  );
  return criarEl('ul', { className: 'hm-mapa-preview__legend' }, itens);
}

function construirPreviaDoMapa(casos: CasosDeUso): HTMLElement {
  const overview = casos.getMapOverview();
  const comDados = overview.filter((u) => !u.semDados).length;

  return criarEl('section', { className: 'hm-section', attrs: { 'aria-labelledby': 'hm-mapa-preview-titulo' } }, [
    criarEl('div', { className: 'hm-section__header' }, [
      criarEl('h2', { className: 'hm-section__title', texto: 'O mapa até agora', attrs: { id: 'hm-mapa-preview-titulo' } }),
      criarEl('a', { className: 'hm-section__link', texto: 'Ver mapa completo →', attrs: { href: '#/mapa' } }),
    ]),
    criarEl('p', { className: 'hm-mapa-preview__caption' }, [
      criarEl('span', { className: 'tabular-nums', texto: formatarNumero(comDados, 0) }),
      ' de ',
      criarEl('span', { className: 'tabular-nums', texto: formatarNumero(overview.length, 0) }),
      ' estados já têm pesquisa de governador — o espectro de quem lidera em cada um:',
    ]),
    criarEl(
      'ul',
      { className: 'hm-mapa-preview__grid', attrs: { 'aria-label': 'Estados por espectro de quem lidera o governo' } },
      overview.map((u) => construirChipEstado(u)),
    ),
    construirLegendaMapa(),
    criarEl('p', { className: 'hm-mapa-preview__links' }, [
      criarEl('a', { className: 'hm-quiet-link', texto: 'Ver hemiciclo do Senado →', attrs: { href: '#/senado' } }),
    ]),
  ]);
}

/* =========================================================================
 * 4. Últimas pesquisas
 * ======================================================================= */

function construirLinhaCandidatoPesquisa(
  c: { candidato: string; partido: string | null; pct: number },
  cargo: Cargo,
  partidos: readonly Partido[],
): HTMLElement {
  const espectro = espectroDoPartido(c.partido, partidos);
  const nome = cargo === 'presidente' ? nomeCurto(c.candidato) : c.candidato;
  return criarEl('li', { className: 'hm-poll-card__candidato' }, [
    c.partido ? criarBadgePartido(c.partido, espectro) : criarEl('span', { className: 'hm-poll-card__sem-partido', texto: 'S/P' }),
    criarEl('span', { className: 'hm-poll-card__candidato-nome', texto: nome, attrs: { title: c.candidato } }),
    criarEl('span', { className: 'hm-poll-card__candidato-pct tabular-nums', texto: formatarPct(c.pct) }),
  ]);
}

function construirCardPesquisa(p: Pesquisa, partidos: readonly Partido[]): HTMLElement {
  const candidatos = top2Candidatos(p);
  const registro = p.registroTSE.naoRegistrada
    ? criarEl('span', { className: 'hm-poll-card__registro hm-poll-card__registro--ausente', texto: 'Sem registro TSE' })
    : criarEl('span', { className: 'hm-poll-card__registro', texto: `TSE ${p.registroTSE.valor}` });

  return criarEl('article', { className: 'hm-poll-card' }, [
    criarEl('div', { className: 'hm-poll-card__meta' }, [
      criarEl('span', { className: 'hm-poll-card__data tabular-nums', texto: formatarData(dataReferencia(p)) }),
      criarEl('span', { className: 'hm-poll-card__disputa-group' }, [
        criarEl('span', { className: 'hm-poll-card__disputa', texto: rotuloDisputa(p) }),
        criarBadgeTurno(p),
      ]),
    ]),
    criarEl('p', { className: 'hm-poll-card__instituto', texto: p.instituto }),
    criarEl(
      'ul',
      { className: 'hm-poll-card__candidatos' },
      candidatos.map((c) => construirLinhaCandidatoPesquisa(c, p.disputa.cargo, partidos)),
    ),
    criarEl('div', { className: 'hm-poll-card__footer' }, [registro, criarLinkFonte(p.fonte)]),
  ]);
}

function construirUltimasPesquisas(casos: CasosDeUso, partidos: readonly Partido[]): HTMLElement {
  const pesquisas = casos.getPollsDatabase().pesquisas.slice(0, 12);
  return criarEl('section', { className: 'hm-section' }, [
    criarEl('div', { className: 'hm-section__header' }, [
      criarEl('h2', { className: 'hm-section__title', texto: 'Últimas pesquisas' }),
      criarEl('a', { className: 'hm-section__link', texto: 'Ver todas →', attrs: { href: '#/pesquisas' } }),
    ]),
    criarEl(
      'ul',
      { className: 'hm-polls-grid' },
      pesquisas.map((p) => criarEl('li', { className: 'hm-polls-grid__item' }, [construirCardPesquisa(p, partidos)])),
    ),
  ]);
}

/* =========================================================================
 * 5. O que você encontra aqui
 * ======================================================================= */

/**
 * Um pedaço do texto da legenda ("dado") de um card de "O que você encontra
 * aqui": ou um número (vai para um `<span class="tabular-nums">` próprio, em
 * JetBrains Mono) ou uma palavra solta (Inter, herdada do parágrafo). Nunca
 * a legenda inteira em mono — ver P0 de docs/critica-ui-inicio2.md.
 */
type PedacoDado = { readonly numero: string } | { readonly texto: string };

function numero(valor: string): PedacoDado {
  return { numero: valor };
}
function texto(valor: string): PedacoDado {
  return { texto: valor };
}

interface ExploreCard {
  readonly titulo: string;
  readonly descricao: string;
  readonly dado: readonly PedacoDado[];
  readonly href: string;
}

/** Só o(s) número(s) do "dado" viram `<span class="tabular-nums">` (mono); o resto do texto fica em Inter. */
function construirStatCard(dado: readonly PedacoDado[]): HTMLElement {
  return criarEl(
    'p',
    { className: 'hm-explore-card__stat' },
    dado.map((pedaco) => ('numero' in pedaco ? criarEl('span', { className: 'tabular-nums', texto: pedaco.numero }) : pedaco.texto)),
  );
}

function construirExploreCard(c: ExploreCard): HTMLElement {
  return criarEl('a', { className: 'hm-explore-card', attrs: { href: c.href } }, [
    criarEl('h3', { className: 'hm-explore-card__title', texto: c.titulo }),
    criarEl('p', { className: 'hm-explore-card__desc', texto: c.descricao }),
    construirStatCard(c.dado),
  ]);
}

function construirExplorar(casos: CasosDeUso): HTMLElement {
  const overview = casos.getMapOverview();
  const ufsComGovernador = overview.filter((u) => !u.semDados).length;

  const presidencial = casos.getPresidentialAggregate();
  const porEstado = casos.getPresidentialByState();
  const ufsComPresidencialEstadual = porEstado.ufs.filter((u) => !u.semDados).length;

  const senado = casos.projectSenate();
  const totalPartidos = casos.listParties().length;
  const totalPesquisas = casos.getPollsDatabase().totais.total;

  const cards: readonly ExploreCard[] = [
    {
      titulo: 'Governadores',
      descricao: 'O mapa do Brasil colorido pelo espectro de quem lidera a disputa em cada estado.',
      dado: [numero(String(ufsComGovernador)), texto(' de '), numero(String(overview.length)), texto(' estados com pesquisa')],
      href: '#/mapa',
    },
    {
      titulo: 'Presidente',
      descricao: 'Média ponderada das pesquisas nacionais, 1º e 2º turno, com a evolução dia a dia.',
      dado: [numero(formatarNumero(presidencial.todasAsPesquisas.length, 0)), texto(' pesquisas nacionais')],
      href: '#/presidente',
    },
    {
      titulo: 'Presidente por estado',
      descricao: 'Como a corrida presidencial aparece dentro de cada estado, com estimativa de votos.',
      dado: [numero(String(ufsComPresidencialEstadual)), texto(' estados com pesquisa própria')],
      href: '#/presidente-estados',
    },
    {
      titulo: 'Senado',
      descricao: 'Hemiciclo com as 27 cadeiras fixas e as 54 em disputa, projetadas pelas pesquisas.',
      dado: [numero(formatarNumero(senado.assentos.length, 0)), texto(' assentos')],
      href: '#/senado',
    },
    {
      titulo: 'Partidos',
      descricao: 'Cadastro de partidos com número, sigla e espectro ideológico, com a fonte da classificação.',
      dado: [numero(formatarNumero(totalPartidos, 0)), texto(' partidos')],
      href: '#/partidos',
    },
    {
      titulo: 'Base de pesquisas',
      descricao: 'Todas as pesquisas conhecidas, com instituto, registro no TSE e link para a fonte.',
      dado: [numero(formatarNumero(totalPesquisas, 0)), texto(' pesquisas')],
      href: '#/pesquisas',
    },
  ];

  return criarEl('section', { className: 'hm-section' }, [
    criarEl('h2', { className: 'hm-section__title', texto: 'O que você encontra aqui' }),
    criarEl(
      'ul',
      { className: 'hm-explore-grid' },
      cards.map((c) => criarEl('li', { className: 'hm-explore-grid__item' }, [construirExploreCard(c)])),
    ),
  ]);
}

/* =========================================================================
 * 6. Como funciona
 * ======================================================================= */

interface Passo {
  readonly titulo: string;
  readonly texto: string;
}

function construirComoFunciona(): HTMLElement {
  const passos: readonly Passo[] = [
    {
      titulo: 'Coleta diária',
      texto:
        'Uma rotina automática roda todo dia às 9h (horário de Brasília), busca pesquisas novas nos institutos e na imprensa, valida os dados e publica.',
    },
    {
      titulo: 'Agregação',
      texto:
        `Cada disputa vira uma média ponderada: peso maior para pesquisas recentes — a cada ${MEIA_VIDA_DIAS_PADRAO} dias, o peso de uma pesquisa mais antiga cai pela metade (sua "meia-vida") — e peso maior para amostras maiores, numa janela de ${JANELA_DIAS_PADRAO} dias. Vantagem dentro da margem de erro ponderada vira "empate técnico".`,
    },
    {
      titulo: 'Projeção do Senado',
      texto:
        'As 27 cadeiras não disputadas em 2026 entram como fixas; as 54 em disputa são projetadas pelos dois primeiros colocados do agregado de senador de cada estado.',
    },
    {
      titulo: 'Estimativa de votos',
      texto:
        'O eleitorado de cada estado (TSE) é multiplicado pela pesquisa presidencial daquele estado quando existe, ou pela média nacional quando o estado ainda não tem pesquisa própria.',
    },
  ];

  return criarEl('section', { className: 'hm-section' }, [
    criarEl('h2', { className: 'hm-section__title', texto: 'Como funciona' }),
    criarEl(
      'ol',
      { className: 'hm-steps' },
      passos.map((passo, indice) =>
        criarEl('li', { className: 'hm-step' }, [
          criarEl('span', { className: 'hm-step__num', texto: String(indice + 1), attrs: { 'aria-hidden': 'true' } }),
          criarEl('h3', { className: 'hm-step__title', texto: passo.titulo }),
          criarEl('p', { className: 'hm-step__desc', texto: passo.texto }),
        ]),
      ),
    ),
    criarEl('p', { className: 'hm-transparency' }, [
      criarEl('strong', { texto: 'Transparência: ' }),
      'só entram pesquisas com fonte identificada; o registro no TSE aparece quando divulgado; todo valor não confirmado fica em branco — nunca inventado.',
    ]),
  ]);
}

/* =========================================================================
 * 7. Fontes e créditos
 * ======================================================================= */

/**
 * Só o que é específico da home (institutos, veículos, eleitorado) — o
 * rodapé global (`<footer class="site-footer">`, montado por `main.ts` logo
 * abaixo desta seção) já cobre a atribuição do mapa/código; repeti-la aqui
 * duplicava a mesma frase duas vezes seguidas na tela. Ver P1 de
 * docs/critica-ui-inicio2.md.
 */
function construirCreditos(casos: CasosDeUso): HTMLElement {
  const institutos = casos.getPollsDatabase().institutos;

  return criarEl('section', { className: 'hm-section hm-credits' }, [
    criarEl('h2', { className: 'hm-section__title', texto: 'Fontes e créditos' }),
    criarEl('div', { className: 'hm-credits__group' }, [
      criarEl('h3', { className: 'hm-credits__title', texto: `Institutos de pesquisa (${institutos.length})` }),
      criarEl(
        'ul',
        { className: 'hm-credits__pills' },
        institutos.map((nome) => criarEl('li', { className: 'hm-credits__pill', texto: nome })),
      ),
    ]),
    criarEl('div', { className: 'hm-credits__group' }, [
      criarEl('h3', { className: 'hm-credits__title', texto: 'Veículos e imprensa' }),
      criarEl('p', {
        className: 'hm-credits__text',
        texto: 'Cada pesquisa cita sua fonte original — Poder360, Wikipédia e imprensa, entre outros veículos, um link por pesquisa.',
      }),
    ]),
    criarEl('div', { className: 'hm-credits__group' }, [
      criarEl('h3', { className: 'hm-credits__title', texto: 'Eleitorado' }),
      criarEl('p', {
        className: 'hm-credits__text',
        texto: 'Número de eleitores aptos por estado: Tribunal Superior Eleitoral (TSE).',
      }),
    ]),
  ]);
}

/* =========================================================================
 * Montagem final
 * ======================================================================= */

export function renderHome(container: HTMLElement, casos: CasosDeUso): void {
  const partidos = casos.listParties();
  const resumo = montarResumoDoDia(
    casos.getPresidentialAggregate().turno1,
    casos.getVoteEstimate(),
    casos.projectSenate().totalPorEspectro,
  );

  const view = criarEl('div', { className: 'hm-view' }, [
    construirHero(casos, resumo, partidos),
    construirResumoDoDia(casos, resumo, partidos),
    construirPreviaDoMapa(casos),
    construirUltimasPesquisas(casos, partidos),
    construirExplorar(casos),
    construirComoFunciona(),
    construirCreditos(casos),
  ]);

  container.append(view);
}
