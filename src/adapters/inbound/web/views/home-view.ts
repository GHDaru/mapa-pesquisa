import '../styles/home.css';
import type { CasosDeUso, DigestDiario } from '../../../../application/use-cases/index.js';
import { JANELA_DIAS_PADRAO, MEIA_VIDA_DIAS_PADRAO } from '../../../../domain/aggregate.js';
import { UFS } from '../../../../domain/race.js';
import { criarEl, formatarData, formatarNumero, formatarPct } from './_shared.js';

/* =========================================================================
 * Capa explicativa do projeto — NÃO mostra resultado de pesquisa (nenhum
 * nome de candidato, percentual, projeção de cadeira ou estimativa de
 * votos): ver docs/briefing-landing-page.md, "mudança de conteúdo". A home
 * explica o que o site é, como os dados são coletados/agregados, big
 * numbers gerais sobre a base e a atualização do dia como notícia curta —
 * quem quiser o resultado em si clica para a tela correspondente.
 * ======================================================================= */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* =========================================================================
 * "Big numbers" — função pura (sem DOM, sem I/O). Recebe o digest já
 * calculado pelo caso de uso `getDailyDigest()` e monta os 7 tiles quietos
 * do topo da home: quantidade, cobertura e proveniência da base, nunca um
 * resultado de pesquisa. Testada isoladamente em __tests__/home-view.test.ts.
 * ======================================================================= */

export interface BigNumberTile {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly detalhe: string | null;
  readonly href: string;
  /** true só para o tile de registro no TSE — único uso do selo verde nos big numbers. */
  readonly seloTse: boolean;
}

export function montarBigNumbers(digest: DigestDiario): readonly BigNumberTile[] {
  return [
    {
      id: 'pesquisas',
      rotulo: 'Pesquisas na base',
      valor: formatarNumero(digest.totalPesquisas, 0),
      detalhe: null,
      href: '#/pesquisas',
      seloTse: false,
    },
    {
      id: 'estados',
      rotulo: 'Estados cobertos',
      valor: formatarNumero(digest.ufsCobertas, 0),
      detalhe: `de ${UFS.length} estados — governador e senador`,
      href: '#/mapa',
      seloTse: false,
    },
    {
      id: 'institutos',
      rotulo: 'Institutos de pesquisa',
      valor: formatarNumero(digest.institutos, 0),
      detalhe: null,
      href: '#/pesquisas',
      seloTse: false,
    },
    {
      id: 'registro-tse',
      rotulo: 'Com registro no TSE',
      valor: formatarPct(digest.percentualComRegistro, 0),
      detalhe: `${formatarNumero(digest.comRegistroTSE, 0)} de ${formatarNumero(digest.totalPesquisas, 0)} pesquisas`,
      href: '#/pesquisas',
      seloTse: true,
    },
    {
      id: 'partidos',
      rotulo: 'Partidos cadastrados',
      valor: formatarNumero(digest.partidos, 0),
      detalhe: null,
      href: '#/partidos',
      seloTse: false,
    },
    {
      id: 'senado',
      rotulo: 'Assentos do Senado mapeados',
      valor: formatarNumero(digest.cadeirasSenado, 0),
      detalhe: null,
      href: '#/senado',
      seloTse: false,
    },
    {
      id: 'atualizado',
      rotulo: 'Atualizado em',
      valor: formatarData(digest.dataAtualizacao),
      detalhe: null,
      href: '#atualizacao-do-dia',
      seloTse: false,
    },
  ];
}

/* =========================================================================
 * Helpers de DOM/formatação locais desta view.
 * ======================================================================= */

/**
 * Textura ambiente do hero: hachura diagonal a 5% de opacidade (a opacidade
 * em si vive em `.hm-hero__texture`, styles/home.css) — mesmo princípio
 * visual de "sem dados"/incerteza já usado no mapa e no hemiciclo
 * (map-view.ts, senate-view.ts), aqui puramente decorativo atrás do
 * conteúdo do hero.
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

/**
 * Transforma um `<a href="#idNaPropriaHome">` num salto de rolagem local em
 * vez de uma navegação de rota: o roteador por hash (`main.ts`) só reconhece
 * `#/rota` — um `href="#algo"` fora desse padrão cairia no `default` do
 * `switch` de `renderizarRota` e re-renderizaria a home inteira do zero a
 * partir do topo, perdendo a posição. Em vez disso, intercepta o clique,
 * rola suavemente (respeitando `prefers-reduced-motion`) e move o foco para
 * a seção alvo, para quem usa teclado/leitor de tela acompanhar o salto —
 * mesmo padrão de `destacarLinhaTabelaSenado` em `senate-view.ts`. Nunca
 * altera `location.hash`, então o roteador nunca chega a disparar.
 */
function tornarAncoraLocal(link: HTMLAnchorElement): HTMLAnchorElement {
  const href = link.getAttribute('href') ?? '';
  const alvoId = href.startsWith('#') ? href.slice(1) : '';
  link.addEventListener('click', (evento) => {
    const alvo = alvoId ? document.getElementById(alvoId) : null;
    if (!alvo) return;
    evento.preventDefault();
    const reduzMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    alvo.scrollIntoView({ block: 'start', behavior: reduzMovimento ? 'auto' : 'smooth' });
    alvo.focus({ preventScroll: true });
  });
  return link;
}

/* =========================================================================
 * 1. Hero explicativo — manchete + objetivo do projeto + 2 CTAs. Sem nome
 * de candidato, sem percentual: a capa do site, não o resultado dele.
 * ======================================================================= */

function construirHero(): HTMLElement {
  const ctaComoFunciona = tornarAncoraLocal(
    criarEl('a', { className: 'hm-cta', texto: 'Como funciona', attrs: { href: '#como-funciona' } }),
  );

  return criarEl('section', { className: 'hm-hero', attrs: { 'aria-labelledby': 'hm-hero-titulo' } }, [
    construirTexturaHero(),
    criarEl('div', { className: 'hm-hero__inner' }, [
      criarEl('h1', {
        className: 'hm-hero__title',
        texto: 'Quem lidera as pesquisas em cada estado, todo dia.',
        attrs: { id: 'hm-hero-titulo' },
      }),
      criarEl('p', { className: 'hm-hero__lead' }, [
        'Um mapa do Brasil com as pesquisas de governador, senador e presidente registradas no TSE, agregadas por média ponderada e atualizadas todo dia por uma rotina automática.',
      ]),
      criarEl('div', { className: 'hm-hero__actions' }, [
        criarEl('a', { className: 'hm-cta hm-cta--primary', texto: 'Ver o mapa', attrs: { href: '#/mapa' } }),
        ctaComoFunciona,
      ]),
    ]),
  ]);
}

/* =========================================================================
 * 2. Big numbers — tiles quietos (JetBrains Mono), cada um clicável para a
 * seção correspondente. Nenhum é resultado de pesquisa: só quantidade,
 * cobertura e proveniência da base.
 * ======================================================================= */

function construirTileBigNumber(tile: BigNumberTile): HTMLElement {
  const link = criarEl('a', { className: 'hm-bignum', attrs: { href: tile.href } }, [
    criarEl('span', { className: 'hm-bignum__label', texto: tile.rotulo }),
    criarEl('span', { className: 'hm-bignum__value tabular-nums', texto: tile.valor }),
    tile.seloTse
      ? criarEl('span', { className: 'hm-selo-tse' }, [
          criarEl('span', { className: 'hm-selo-tse__icone', texto: '✓', attrs: { 'aria-hidden': 'true' } }),
          'Registrado no TSE',
        ])
      : null,
    tile.detalhe ? criarEl('span', { className: 'hm-bignum__detail', texto: tile.detalhe }) : null,
  ]);
  // O tile "Atualizado em {data}" aponta para a própria seção "Atualização de
  // hoje" desta página — os demais apontam para rotas de verdade e devem
  // continuar navegando normalmente pelo roteador por hash.
  if (tile.href.startsWith('#') && !tile.href.startsWith('#/')) {
    tornarAncoraLocal(link);
  }
  return link;
}

function construirBigNumbers(digest: DigestDiario): HTMLElement {
  const tiles = montarBigNumbers(digest);
  return criarEl('section', { className: 'hm-section', attrs: { 'aria-labelledby': 'hm-bignums-titulo' } }, [
    criarEl('h2', { className: 'sr-only', texto: 'A base de pesquisas em números', attrs: { id: 'hm-bignums-titulo' } }),
    criarEl(
      'ul',
      { className: 'hm-bignums' },
      tiles.map((tile) => criarEl('li', { className: 'hm-bignums__item' }, [construirTileBigNumber(tile)])),
    ),
  ]);
}

/* =========================================================================
 * 3. Atualização de hoje — notícia curta: o que entrou na última
 * atualização (contagem, estados, institutos), nunca o conteúdo em si.
 * ======================================================================= */

function pluralizar(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural;
}

function construirTextoNovidades(digest: DigestDiario): HTMLElement {
  const novas = digest.novasNaUltimaAtualizacao;

  if (novas.total === 0) {
    return criarEl('p', { className: 'hm-noticia__texto' }, [
      `Sem pesquisas novas desde ${formatarData(digest.dataAtualizacao)}.`,
    ]);
  }

  const partes: (Node | string)[] = [
    criarEl('span', { className: 'tabular-nums', texto: formatarNumero(novas.total, 0) }),
    ` ${pluralizar(novas.total, 'nova pesquisa entrou', 'novas pesquisas entraram')} na última atualização`,
  ];

  if (novas.ufs.length > 0) {
    partes.push(
      ` em ${pluralizar(novas.ufs.length, '1 estado', `${formatarNumero(novas.ufs.length, 0)} estados`)} (${novas.ufs.join(', ')})`,
    );
  }
  if (novas.institutos.length > 0) {
    partes.push(`, de ${novas.institutos.join(', ')}`);
  }
  partes.push('.');

  return criarEl('p', { className: 'hm-noticia__texto' }, partes);
}

function construirAtualizacaoDeHoje(digest: DigestDiario): HTMLElement {
  return criarEl(
    'section',
    { className: 'hm-noticia', attrs: { id: 'atualizacao-do-dia', tabindex: '-1', 'aria-labelledby': 'hm-noticia-titulo' } },
    [
      criarEl('h2', { className: 'hm-section__title', texto: 'Atualização de hoje', attrs: { id: 'hm-noticia-titulo' } }),
      criarEl('p', {
        className: 'hm-noticia__data tabular-nums',
        texto: formatarData(digest.dataAtualizacao),
      }),
      construirTextoNovidades(digest),
      criarEl('a', { className: 'hm-quiet-link', texto: 'Ver base de pesquisas →', attrs: { href: '#/pesquisas' } }),
    ],
  );
}

/* =========================================================================
 * 4. Chamadas de navegação — 6 cards, cada um com uma frase do que a
 * pessoa encontra lá e um dado geral (contagem, nunca um resultado).
 * ======================================================================= */

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
      descricao: 'O mapa do Brasil com a disputa de governador em cada estado, colorido pelo espectro de quem está à frente.',
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
      descricao: 'Hemiciclo com as 27 cadeiras fixas até 2031 e as 54 em disputa em 2026, projetadas pelas pesquisas de cada estado.',
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
 * 5. Como funciona
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

  return criarEl('section', { className: 'hm-section', attrs: { id: 'como-funciona', tabindex: '-1' } }, [
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
 * 6. Fontes e créditos
 * ======================================================================= */

/**
 * Só o que é específico da home (institutos, veículos, eleitorado) — o
 * rodapé global (`<footer class="site-footer">`, montado por `main.ts` logo
 * abaixo desta seção) já cobre a atribuição do mapa/código; repeti-la aqui
 * duplicava a mesma frase duas vezes seguidas na tela.
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
        institutos.map((nomeInstituto) => criarEl('li', { className: 'hm-credits__pill', texto: nomeInstituto })),
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
  const digest = casos.getDailyDigest();

  const view = criarEl('div', { className: 'hm-view' }, [
    construirHero(),
    construirBigNumbers(digest),
    construirAtualizacaoDeHoje(digest),
    construirExplorar(casos),
    construirComoFunciona(),
    construirCreditos(casos),
  ]);

  container.append(view);
}
