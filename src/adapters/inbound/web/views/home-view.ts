import '../styles/home.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import { type Agregado, ehLinhaNaoCandidato, JANELA_DIAS_PADRAO, MEIA_VIDA_DIAS_PADRAO } from '../../../../domain/aggregate.js';
import type { Partido } from '../../../../domain/party.js';
import { dataReferencia, type Fonte, type Pesquisa } from '../../../../domain/poll.js';
import { type Cargo, UF_NACIONAL } from '../../../../domain/race.js';
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
import type { EstimativaVotos } from '../../../../domain/vote-estimate.js';
import { nomeCurto } from './candidate-names.js';
import { formatarVantagem } from '../format.js';
import { classeEspectro, criarEl, formatarData, formatarNumero, formatarPct, rotuloEspectro } from './_shared.js';

/* =========================================================================
 * "Resumo do dia" — função pura (sem DOM, sem I/O). Recebe os agregados já
 * calculados pelos casos de uso e só reformata os 3 números do hero: líder
 * presidencial (1º turno), estimativa de votos dos 2 primeiros e a
 * projeção do Senado por bloco de espectro. Testada isoladamente em
 * __tests__/home-view.test.ts.
 * ======================================================================= */

export interface ResumoLiderPresidencial {
  readonly lider: string;
  readonly partido: string | null;
  readonly pct: number;
  readonly vantagem: number;
  readonly empateTecnico: boolean;
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
          vantagem: agregadoPresidencialTurno1.vantagem,
          empateTecnico: agregadoPresidencialTurno1.empateTecnico,
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
    { className: 'hm-link-fonte', attrs: { href: fonte.url, target: '_blank', rel: 'noopener noreferrer' } },
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
 * 1. Hero
 * ======================================================================= */

function construirCardPresidencial(p: ResumoLiderPresidencial | null, partidos: readonly Partido[]): HTMLElement {
  if (!p) {
    return criarEl('div', { className: 'hm-resumo__card' }, [
      criarEl('p', { className: 'hm-resumo__label', texto: 'Presidente — 1º turno' }),
      criarEl('p', { className: 'hm-resumo__vazio', texto: 'Ainda sem pesquisa presidencial suficiente.' }),
    ]);
  }
  const espectro = espectroDoPartido(p.partido, partidos);
  return criarEl('div', { className: 'hm-resumo__card' }, [
    criarEl('p', { className: 'hm-resumo__label', texto: 'Presidente — 1º turno' }),
    criarEl('p', { className: 'hm-resumo__value' }, [
      nomeCurto(p.lider),
      p.partido ? criarBadgePartido(p.partido, espectro) : null,
    ]),
    criarEl('p', { className: 'hm-resumo__detail tabular-nums', texto: `${formatarPct(p.pct)} · ${formatarVantagem(p.vantagem)}` }),
    p.empateTecnico ? criarEl('span', { className: 'pill pill--empate', texto: 'Empate técnico' }) : null,
  ]);
}

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

function construirHero(casos: CasosDeUso, resumo: ResumoDoDia, partidos: readonly Partido[]): HTMLElement {
  const meta = casos.getMeta();
  const totais = casos.getPollsDatabase().totais;

  const resumoEl = criarEl('div', { className: 'hm-resumo', attrs: { 'aria-label': 'Resumo do dia' } }, [
    construirCardPresidencial(resumo.presidencial, partidos),
    construirCardVotos(resumo.votos, partidos),
    construirCardSenado(resumo.senado),
  ]);

  return criarEl('section', { className: 'hm-hero' }, [
    criarEl('h1', { className: 'hm-hero__title', texto: 'Mapa das Pesquisas 2026' }),
    criarEl('p', {
      className: 'hm-hero__lede',
      texto:
        'Um mapa do Brasil com quem lidera as pesquisas para governador, senador e presidente, atualizado todo dia a partir de pesquisas registradas no TSE.',
    }),
    criarEl('div', { className: 'hm-hero__meta' }, [
      criarEl('span', {
        className: 'hm-pill tabular-nums',
        texto: `Atualizado em ${formatarData(meta.atualizadoEm)} · ${formatarNumero(totais.total, 0)} pesquisas na base`,
      }),
    ]),
    criarEl('div', { className: 'hm-hero__actions' }, [
      criarEl('a', { className: 'btn btn--primario', texto: 'Ver o mapa', attrs: { href: '#/mapa' } }),
      criarEl('a', { className: 'btn', texto: 'Presidente', attrs: { href: '#/presidente' } }),
    ]),
    resumoEl,
  ]);
}

/* =========================================================================
 * 2. Últimas pesquisas
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
 * 3. O que você encontra aqui
 * ======================================================================= */

interface ExploreCard {
  readonly titulo: string;
  readonly descricao: string;
  readonly dado: string;
  readonly href: string;
}

function construirExploreCard(c: ExploreCard): HTMLElement {
  return criarEl('a', { className: 'hm-explore-card', attrs: { href: c.href } }, [
    criarEl('h3', { className: 'hm-explore-card__title', texto: c.titulo }),
    criarEl('p', { className: 'hm-explore-card__desc', texto: c.descricao }),
    criarEl('p', { className: 'hm-explore-card__stat tabular-nums', texto: c.dado }),
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
      dado: `${ufsComGovernador} de ${overview.length} estados com pesquisa`,
      href: '#/mapa',
    },
    {
      titulo: 'Presidente',
      descricao: 'Média ponderada das pesquisas nacionais, 1º e 2º turno, com a evolução dia a dia.',
      dado: `${formatarNumero(presidencial.todasAsPesquisas.length, 0)} pesquisas nacionais`,
      href: '#/presidente',
    },
    {
      titulo: 'Presidente por estado',
      descricao: 'Como a corrida presidencial aparece dentro de cada estado, com estimativa de votos.',
      dado: `${ufsComPresidencialEstadual} estados com pesquisa própria`,
      href: '#/presidente-estados',
    },
    {
      titulo: 'Senado',
      descricao: 'Hemiciclo com as 27 cadeiras fixas e as 54 em disputa, projetadas pelas pesquisas.',
      dado: `${formatarNumero(senado.assentos.length, 0)} assentos`,
      href: '#/senado',
    },
    {
      titulo: 'Partidos',
      descricao: 'Cadastro de partidos com número, sigla e espectro ideológico, com a fonte da classificação.',
      dado: `${formatarNumero(totalPartidos, 0)} partidos`,
      href: '#/partidos',
    },
    {
      titulo: 'Base de pesquisas',
      descricao: 'Todas as pesquisas conhecidas, com instituto, registro no TSE e link para a fonte.',
      dado: `${formatarNumero(totalPesquisas, 0)} pesquisas`,
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
 * 4. Como funciona
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
 * 5. Fontes e créditos
 * ======================================================================= */

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
    criarEl('div', { className: 'hm-credits__group' }, [
      criarEl('h3', { className: 'hm-credits__title', texto: 'Mapa e código' }),
      criarEl('p', { className: 'hm-credits__text' }, [
        'Mapa: ',
        criarEl(
          'a',
          {
            className: 'hm-credits__link',
            texto: '@svg-maps/brazil',
            attrs: { href: 'https://github.com/VictorCazanave/svg-maps', target: '_blank', rel: 'noopener noreferrer' },
          },
        ),
        ' (CC BY 4.0). Código aberto no ',
        criarEl(
          'a',
          {
            className: 'hm-credits__link',
            texto: 'GitHub',
            attrs: { href: 'https://github.com/GHDaru/mapa-pesquisa', target: '_blank', rel: 'noopener noreferrer' },
          },
        ),
        '.',
        criarEl('span', { className: 'sr-only', texto: ' (links abrem em nova aba)' }),
      ]),
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
    construirUltimasPesquisas(casos, partidos),
    construirExplorar(casos),
    construirComoFunciona(),
    construirCreditos(casos),
  ]);

  container.append(view);
}
