/**
 * Apuração ao vivo do 2º turno.
 *
 * O que esta tela promete, e o que ela se recusa a fazer:
 *
 * - **apurado** é contagem, sem incerteza; **projetado** é inferência sobre o
 *   que falta. Os dois aparecem separados e rotulados, nunca fundidos num
 *   número só;
 * - a projeção é montada **por estado** e só então somada, porque o percentual
 *   nacional parcial é enviesado pela ORDEM em que os estados totalizam;
 * - cada atualização declara **de onde veio cada número**: o endpoint lido e a
 *   hora. Quem olha tem de poder conferir;
 * - UF sem apuração não é completada com pesquisa nem com média: fica fora e
 *   aparece nomeada.
 *
 * O mapa aqui NÃO é um coroplético: cada UF é pintada pela cor de quem lidera
 * e **preenchida da esquerda para a direita** na proporção do que já foi
 * apurado ali. Uma UF a 20% aparece 20% pintada, e é por isso que o mapa
 * mostra ao mesmo tempo quem ganha e quanto disso é sabido — que é a pergunta
 * de verdade numa noite de apuração.
 */

import '../styles/views.css';
import brazilMapDados from '@svg-maps/brazil';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { DadosApuracao, Projecao } from '../../../../domain/apuracao.js';
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
import type { Partido } from '../../../../domain/party.js';
import { buscarApuracao, type FonteLida } from '../../../outbound/tse/tse-client.js';
import { simularApuracao } from '../../../outbound/tse/simulador.js';
import { bboxPath, criarEl, tokenFillEspectro } from './_shared.js';
import {
  fracaoDaBarra,
  formatarInt,
  formatarPct,
  horaCurta,
  montarLinhas,
  notaDasFontes,
  notaDoEstagio,
  semDado,
  vantagemEntreOsDois,
  type LinhaUf,
} from './apuracao-layout.js';

interface LocalidadeMapa {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}
interface MapaSvg {
  readonly viewBox: string;
  readonly locations: readonly LocalidadeMapa[];
}
const mapaBrasil = brazilMapDados as MapaSvg;

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const FINALISTAS: readonly [string, string] = ['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva'];

/**
 * O nome de urna da fonte oficial traduzido para o nome canônico da base.
 *
 * Existe porque o TSE publica "FLAVIO BOLSONARO" e "LULA", e o ranking de
 * institutos casa pesquisa com apuração POR NOME — gravar o nome de urna
 * quebraria a comparação inteira.
 */
function nomeCanonico(nomeDeUrna: string): string {
  const n = nomeDeUrna.toUpperCase();
  if (n.includes('FLAVIO') || n.includes('FLÁVIO')) return FINALISTAS[0];
  if (n.includes('LULA') || n.includes('INACIO') || n.includes('INÁCIO')) return FINALISTAS[1];
  return nomeDeUrna;
}

function resolverEspectro(partido: string | null, partidos: readonly Partido[]): Espectro {
  return espectroDoPartido(partido, partidos);
}

type Modo = 'ao-vivo' | 'simulacao';

interface Estado {
  modo: Modo;
  avancoSimulado: number;
  projecao: Projecao | null;
  fontes: readonly FonteLida[];
  carregando: boolean;
  erro: string | null;
  lidoEm: string | null;
}

export async function renderApuracao(main: HTMLElement, casos: CasosDeUso): Promise<void> {
  const partidos = casos.listParties();
  const aoVivo = casos.getApuracaoAoVivo();
  const apuracao1T = aoVivo.apuracaoPrimeiroTurno;

  const estado: Estado = {
    modo: 'ao-vivo',
    avancoSimulado: 0.35,
    projecao: null,
    fontes: [],
    carregando: false,
    erro: null,
    lidoEm: null,
  };

  const raiz = criarEl('section', { className: 'ap-raiz' });
  main.append(raiz);

  function projetar(dados: DadosApuracao): Projecao {
    return aoVivo.projetar(dados, 2);
  }

  async function atualizar(): Promise<void> {
    estado.carregando = true;
    estado.erro = null;
    desenhar();
    try {
      if (estado.modo === 'simulacao') {
        const { dados } = simularApuracao(apuracao1T, FINALISTAS, {
          avanco: estado.avancoSimulado,
          semente: Math.floor(Math.random() * 1e9),
        });
        estado.projecao = projetar(dados);
        estado.fontes = dados.recortes.map((r) => ({
          url: r.fonte.url,
          uf: r.uf ?? 'BR',
          lidoEm: dados.atualizadoEm,
          ok: true,
        }));
        estado.lidoEm = dados.atualizadoEm;
      } else {
        const { dados, fontes } = await buscarApuracao((url) => fetch(url, { cache: 'no-store' }), {
          ufs: UFS,
          cargo: 'presidente',
          turno: 2,
          nomeCanonico,
        });
        estado.projecao = projetar(dados);
        estado.fontes = fontes;
        estado.lidoEm = dados.atualizadoEm;
      }
    } catch (e) {
      estado.erro = e instanceof Error ? e.message : String(e);
    } finally {
      estado.carregando = false;
      desenhar();
    }
  }

  function desenhar(): void {
    raiz.innerHTML = '';
    raiz.append(criarCabecalho(estado, atualizar));
    if (estado.erro) {
      raiz.append(
        criarEl('p', {
          className: 'ap-erro',
          texto: `Não consegui ler a apuração: ${estado.erro}. O botão atualizar tenta de novo.`,
        }),
      );
    }
    const p = estado.projecao;
    if (!p) {
      raiz.append(
        criarEl('p', { className: 'ap-meta', texto: 'Clique em atualizar para buscar os dados.' }),
      );
      return;
    }
    raiz.append(criarBigNumbers(p, partidos));
    raiz.append(criarMapaProgresso(p, partidos));
    raiz.append(criarTabela(p, estado));
    raiz.append(criarFontes(estado));
  }

  desenhar();
  await atualizar();
}

/* ───────────────────────── cabeçalho e controles ───────────────────────── */

function criarCabecalho(estado: Estado, atualizar: () => Promise<void>): HTMLElement {
  const topo = criarEl('header', { className: 'ap-topo' });
  topo.append(criarEl('h1', { className: 'ap-titulo', texto: 'Apuração ao vivo' }));

  const controles = criarEl('div', { className: 'ap-controles' });

  const grupo = criarEl('div', { className: 'ap-modo', attrs: { role: 'group', 'aria-label': 'Fonte dos dados' } });
  for (const [modo, rotulo] of [['ao-vivo', 'Ao vivo (TSE)'], ['simulacao', 'Simulação']] as const) {
    const b = criarEl('button', {
      className: `ap-modo-botao${estado.modo === modo ? ' is-ativo' : ''}`,
      texto: rotulo,
      attrs: { type: 'button', 'aria-pressed': String(estado.modo === modo) },
    });
    b.addEventListener('click', () => {
      if (estado.modo === modo) return;
      estado.modo = modo;
      void atualizar();
    });
    grupo.append(b);
  }
  controles.append(grupo);

  if (estado.modo === 'simulacao') {
    const faixa = criarEl('label', { className: 'ap-faixa' });
    faixa.append(criarEl('span', { texto: `Avanço simulado: ${Math.round(estado.avancoSimulado * 100)}%` }));
    const input = criarEl('input', {
      attrs: { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(estado.avancoSimulado * 100)) },
    }) as HTMLInputElement;
    input.addEventListener('change', () => {
      estado.avancoSimulado = Number(input.value) / 100;
      void atualizar();
    });
    faixa.append(input);
    controles.append(faixa);
  }

  const botao = criarEl('button', {
    className: 'ap-atualizar',
    texto: estado.carregando ? 'Atualizando…' : 'Atualizar',
    attrs: { type: 'button', ...(estado.carregando ? { disabled: 'true' } : {}) },
  });
  botao.addEventListener('click', () => void atualizar());
  controles.append(botao);

  topo.append(controles);
  return topo;
}

/* ───────────────────────────── big numbers ─────────────────────────────── */

function criarBigNumbers(p: Projecao, partidos: readonly Partido[]): HTMLElement {
  const sec = criarEl('section', { className: 'ap-bignumbers' });
  const ordenados = [...p.candidatos].sort((a, b) => b.votosProjetados - a.votosProjetados);

  const cartoes = criarEl('div', { className: 'ap-cartoes' });
  for (const [i, c] of ordenados.entries()) {
    const espectro = resolverEspectro(c.partido, partidos);
    const cartao = criarEl('div', {
      className: `ap-cartao${i === 0 ? ' is-lider' : ''}`,
    });
    cartao.style.setProperty('--cor', tokenFillEspectro(espectro));
    cartao.append(criarEl('p', { className: 'ap-cartao-nome', texto: c.candidato }));
    cartao.append(criarEl('p', { className: 'ap-cartao-pct', texto: formatarPct(c.pctProjetado, 2) }));
    cartao.append(
      criarEl('p', {
        className: 'ap-cartao-votos',
        texto: `${formatarInt(c.votosProjetados)} votos projetados`,
      }),
    );
    cartao.append(
      criarEl('p', {
        className: 'ap-cartao-apurado',
        texto: `${formatarInt(c.votosApurados)} já apurados · ${formatarPct(c.pctApurado, 2)}`,
      }),
    );
    const barra = criarEl('div', { className: 'ap-cartao-barra' });
    const preenche = criarEl('div', { className: 'ap-cartao-barra-fill' });
    preenche.style.width = `${Math.max(0, Math.min(100, c.pctProjetado))}%`;
    barra.append(preenche);
    cartao.append(barra);
    cartoes.append(cartao);
  }
  sec.append(cartoes);

  const processado = p.coberturaNacionalEfetiva ?? p.secoesTotalizadasPonderada;
  const v = vantagemEntreOsDois(ordenados);
  const resumo = criarEl('div', { className: 'ap-resumo' });

  // O "% apurado" sai do parágrafo e vira número.
  //
  // Ele estava dentro da prosa de metodologia, e o crítico pegou: é a condição
  // que qualifica TODOS os percentuais acima — 51% com 3% apurado e 51% com
  // 95% apurado não dizem a mesma coisa — e virara nota de rodapé. Condição de
  // leitura tem de ter o peso de dado, ao lado do dado que ela qualifica.
  const faixa = criarEl('div', { className: 'ap-faixa-estado' });
  if (v) {
    const bloco = criarEl('div', { className: 'ap-fe-item' });
    bloco.append(criarEl('span', { className: 'ap-fe-rotulo', texto: 'Vantagem' }));
    bloco.append(
      criarEl('span', {
        className: 'ap-fe-valor',
        texto: `${formatarInt(v.votos)} votos`,
      }),
    );
    bloco.append(
      criarEl('span', { className: 'ap-fe-nota', texto: `${formatarPct(v.pontos, 2)} · ${v.lider}` }),
    );
    faixa.append(bloco);
  }
  const blocoProc = criarEl('div', { className: 'ap-fe-item' });
  blocoProc.append(criarEl('span', { className: 'ap-fe-rotulo', texto: 'Seções apuradas' }));
  blocoProc.append(criarEl('span', { className: 'ap-fe-valor', texto: formatarPct(processado) }));
  const trilhoTopo = criarEl('div', { className: 'ap-fe-barra' });
  const nivelTopo = criarEl('div', { className: 'ap-fe-barra-fill' });
  nivelTopo.style.width = `${fracaoDaBarra(processado) * 100}%`;
  trilhoTopo.append(nivelTopo);
  blocoProc.append(trilhoTopo);
  faixa.append(blocoProc);
  resumo.append(faixa);
  resumo.append(
    criarEl('p', {
      className: 'ap-meta',
      texto: notaDoEstagio({
        processadoNacional: processado,
        ufsSemApuracao: p.ufsSemApuracao,
        definido: p.margem?.matematicamenteDefinido === true,
      }),
    }),
  );
  sec.append(resumo);
  return sec;
}

/* ─────────────────────── mapa preenchido por progresso ─────────────────── */

function criarMapaProgresso(p: Projecao, partidos: readonly Partido[]): HTMLElement {
  const porUf = new Map(p.porUf.map((u) => [u.uf, u]));
  const nomePorUf = new Map(mapaBrasil.locations.map((l) => [l.id.toUpperCase(), l.name]));

  const sec = criarEl('section', { className: 'ap-mapa-sec' });
  sec.append(criarEl('h2', { className: 'ap-h2', texto: 'Onde cada estado está' }));
  sec.append(
    criarEl('p', {
      className: 'ap-meta',
      texto:
        'A cor cheia é de quem lidera, e ela avança da esquerda para a direita conforme as seções entram. O que ainda não foi contado fica hachurado, não colorido — um estado pela metade tem metade de cor e metade de hachura, e a barrinha ao lado da sigla repete a mesma fração em número. Estado sem nenhuma seção fica cinza liso e sem líder: pintar liderança que ninguém mediu seria inventar.',
    }),
  );

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', mapaBrasil.viewBox);
  svg.setAttribute('class', 'ap-mapa-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa da apuração por estado');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  // Hachura única para "ainda não contado".
  //
  // O primeiro desenho pintava o que falta com um TOM CLARO DA MESMA COR do
  // líder, e isso falhou de três jeitos ao mesmo tempo: o estado parecia
  // partido geograficamente em duas regiões, as bordas verticais de estados
  // vizinhos se alinhavam formando listras que atravessavam o país como fuso
  // horário, e no Nordeste os tons claros se fundiam num borrão em que não
  // dava para ver quem liderava. Hachura neutra resolve os três: ela não é cor
  // de candidato, não compete com a matiz, e diz "vazio" em vez de "outro".
  const hachura = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  hachura.setAttribute('id', 'ap-hachura');
  hachura.setAttribute('width', '4');
  hachura.setAttribute('height', '4');
  hachura.setAttribute('patternUnits', 'userSpaceOnUse');
  hachura.setAttribute('patternTransform', 'rotate(45)');
  const fundo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  fundo.setAttribute('width', '4');
  fundo.setAttribute('height', '4');
  fundo.setAttribute('class', 'ap-hachura-fundo');
  hachura.append(fundo);
  const risco = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  risco.setAttribute('x1', '0');
  risco.setAttribute('y1', '0');
  risco.setAttribute('x2', '0');
  risco.setAttribute('y2', '4');
  risco.setAttribute('class', 'ap-hachura-risco');
  hachura.append(risco);
  defs.append(hachura);
  svg.append(defs);

  for (const loc of mapaBrasil.locations) {
    const uf = loc.id.toUpperCase();
    const u = porUf.get(uf);
    const bbox = bboxPath(loc.path);
    const grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    if (!u || semDado({ processado: u.secoesTotalizadas })) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', loc.path);
      path.setAttribute('class', 'ap-mapa-uf');
      path.style.fill = 'var(--spectrum-indefinido)';
      path.setAttribute('aria-label', `${nomePorUf.get(uf) ?? uf}: nenhuma seção apurada.`);
      grupo.append(path);
    } else {
      const espectro = resolverEspectro(
        u.candidatos.find((c) => c.candidato === u.lider)?.partido ?? null,
        partidos,
      );
      const cor = tokenFillEspectro(espectro);
      const fracao = fracaoDaBarra(u.secoesTotalizadas);
      const corte = bbox.minX + (bbox.maxX - bbox.minX) * fracao;
      const idClip = `ap-clip-${uf}`;

      // A parte NÃO contada, por baixo: hachura neutra no estado inteiro.
      const base = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      base.setAttribute('d', loc.path);
      base.setAttribute('class', 'ap-mapa-uf ap-mapa-vazio');
      base.setAttribute('fill', 'url(#ap-hachura)');
      grupo.append(base);

      // A parte contada, por cima, recortada até onde a apuração chegou.
      const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clip.setAttribute('id', idClip);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(bbox.minX));
      rect.setAttribute('y', String(bbox.minY - 1));
      rect.setAttribute('width', String(Math.max(0, corte - bbox.minX)));
      rect.setAttribute('height', String(bbox.maxY - bbox.minY + 2));
      clip.append(rect);
      defs.append(clip);

      const cheio = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      cheio.setAttribute('d', loc.path);
      cheio.setAttribute('class', 'ap-mapa-uf ap-mapa-cheio');
      cheio.style.fill = cor;
      cheio.setAttribute('clip-path', `url(#${idClip})`);
      grupo.append(cheio);

      // A fronteira da apuração, marcada: é ela que diz "aqui parou a contagem"
      // em vez de "aqui muda o terreno".
      if (fracao > 0.02 && fracao < 0.98) {
        const linha = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        linha.setAttribute('x1', String(corte));
        linha.setAttribute('x2', String(corte));
        linha.setAttribute('y1', String(bbox.minY));
        linha.setAttribute('y2', String(bbox.maxY));
        linha.setAttribute('class', 'ap-mapa-frente');
        linha.setAttribute('clip-path', `url(#ap-recorte-${uf})`);
        const recorte = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        recorte.setAttribute('id', `ap-recorte-${uf}`);
        const forma = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        forma.setAttribute('d', loc.path);
        recorte.append(forma);
        defs.append(recorte);
        grupo.append(linha);
      }

      // Contorno por cima, para o estado continuar sendo um estado.
      const contorno = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      contorno.setAttribute('d', loc.path);
      contorno.setAttribute('class', 'ap-mapa-contorno');
      grupo.append(contorno);

      grupo.setAttribute(
        'aria-label',
        `${nomePorUf.get(uf) ?? uf}: ${formatarPct(u.secoesTotalizadas)} apurado, ${u.lider ?? '—'} à frente.`,
      );
    }

    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const texto = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    texto.setAttribute('x', String(cx));
    texto.setAttribute('y', String(cy - 1.5));
    texto.setAttribute('class', 'ap-mapa-sigla');
    texto.setAttribute('aria-hidden', 'true');
    texto.textContent = uf;
    grupo.append(texto);

    // A barrinha sob a sigla: a MESMA fração dita outra vez, como quantidade.
    // Encodar progresso só no preenchimento do polígono não bastou — a forma
    // do estado atrapalha a leitura. Uma barra reta não tem esse problema.
    if (u && !semDado({ processado: u.secoesTotalizadas })) {
      const larg = Math.min(20, Math.max(11, (bbox.maxX - bbox.minX) * 0.55));
      const trilho = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      trilho.setAttribute('x', String(cx - larg / 2));
      trilho.setAttribute('y', String(cy + 1.8));
      trilho.setAttribute('width', String(larg));
      trilho.setAttribute('height', '3.6');
      trilho.setAttribute('rx', '1.8');
      trilho.setAttribute('class', 'ap-mapa-trilho');
      trilho.setAttribute('aria-hidden', 'true');
      grupo.append(trilho);
      const nivel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      nivel.setAttribute('x', String(cx - larg / 2));
      nivel.setAttribute('y', String(cy + 1.8));
      nivel.setAttribute('width', String(larg * fracaoDaBarra(u.secoesTotalizadas)));
      nivel.setAttribute('height', '3.6');
      nivel.setAttribute('rx', '1.8');
      nivel.setAttribute('class', 'ap-mapa-nivel');
      nivel.setAttribute('aria-hidden', 'true');
      grupo.append(nivel);
    }

    svg.append(grupo);
  }

  const wrap = criarEl('div', { className: 'ap-mapa-wrap' });
  wrap.append(svg);
  sec.append(wrap);
  sec.append(criarLegendaDoMapa());
  return sec;
}

/** Legenda explícita: sem ela, hachura é só textura. */
function criarLegendaDoMapa(): HTMLElement {
  const leg = criarEl('div', { className: 'ap-legenda' });
  for (const [classe, rotulo] of [
    ['ap-leg-cheio', 'já apurado (na cor de quem lidera)'],
    ['ap-leg-vazio', 'falta apurar'],
    ['ap-leg-sem', 'sem nenhuma seção'],
  ] as const) {
    const item = criarEl('span', { className: 'ap-legenda-item' });
    item.append(criarEl('span', { className: `ap-leg-amostra ${classe}` }));
    item.append(criarEl('span', { texto: rotulo }));
    leg.append(item);
  }
  return leg;
}

/* ──────────────────────────── tabela por estado ────────────────────────── */

function criarTabela(p: Projecao, estado: Estado): HTMLElement {
  const linhas = montarLinhas(p.porUf, FINALISTAS);
  const sec = criarEl('section', { className: 'ap-tabela-sec' });
  sec.append(criarEl('h2', { className: 'ap-h2', texto: 'Estado a estado' }));

  const tabela = criarEl('table', { className: 'ap-tabela' });
  const thead = criarEl('thead');
  const trh = criarEl('tr');
  // As colunas de um mesmo candidato ficam JUNTAS.
  //
  // Antes elas vinham intercaladas por indicador (% dos dois, depois projeção
  // dos dois, depois votos dos dois) e o corte da tela caía no meio de um par:
  // aparecia o voto contado de um candidato e não o do outro, que é o pior
  // jeito de cortar — convida à leitura errada em vez de só esconder.
  const colunas = [
    'UF', 'Eleitores', '% apurado',
    `% ${FINALISTAS[0]}`, `Projeção ${FINALISTAS[0]}`, `Votos ${FINALISTAS[0]}`,
    `% ${FINALISTAS[1]}`, `Projeção ${FINALISTAS[1]}`, `Votos ${FINALISTAS[1]}`,
    'Brancos', 'Nulos', 'Abstenções', 'Hora',
  ];
  for (const c of colunas) trh.append(criarEl('th', { texto: c, attrs: { scope: 'col' } }));
  thead.append(trh);
  tabela.append(thead);

  const tbody = criarEl('tbody');
  for (const l of linhas) tbody.append(criarLinha(l, estado));
  tabela.append(tbody);

  sec.append(
    criarEl('p', {
      className: 'ap-meta ap-rolagem',
      texto:
        'A tabela é mais larga que a tela: arraste para o lado para ver brancos, nulos, abstenções e a hora da leitura. As três colunas de cada candidato andam juntas, para o corte nunca separar um do outro.',
    }),
  );
  const wrap = criarEl('div', { className: 'ap-tabela-wrap' });
  wrap.append(tabela);
  sec.append(wrap);
  return sec;
}

function criarLinha(l: LinhaUf, estado: Estado): HTMLElement {
  const tr = criarEl('tr');
  tr.append(criarEl('th', { texto: l.uf, attrs: { scope: 'row' } }));
  const celula = (texto: string, rotulo: string): HTMLElement =>
    criarEl('td', { className: 'ap-num', texto, attrs: { 'data-rotulo': rotulo } });

  tr.append(celula(formatarInt(l.eleitores), 'Eleitores'));

  const tdProc = criarEl('td', { className: 'ap-num ap-proc', attrs: { 'data-rotulo': '% apurado' } });
  const mini = criarEl('div', { className: 'ap-proc-barra' });
  const miniFill = criarEl('div', { className: 'ap-proc-fill' });
  miniFill.style.width = `${fracaoDaBarra(l.processado) * 100}%`;
  mini.append(miniFill);
  tdProc.append(criarEl('span', { texto: formatarPct(l.processado) }));
  tdProc.append(mini);
  tr.append(tdProc);

  for (const c of l.porCandidato) {
    tr.append(celula(formatarPct(c.pct, 2), `% ${c.candidato}`));
    tr.append(celula(formatarInt(c.votosProjetados), `Projeção ${c.candidato}`));
    tr.append(celula(formatarInt(c.votosApurados), `Votos ${c.candidato}`));
  }

  tr.append(celula(formatarInt(l.brancos), 'Brancos'));
  tr.append(celula(formatarInt(l.nulos), 'Nulos'));
  tr.append(celula(formatarInt(l.abstencoes), 'Abstenções'));
  tr.append(celula(horaCurta(estado.lidoEm), 'Hora'));
  return tr;
}

/* ───────────────────────────── fontes lidas ────────────────────────────── */

function criarFontes(estado: Estado): HTMLElement {
  const sec = criarEl('section', { className: 'ap-fontes' });
  sec.append(criarEl('h2', { className: 'ap-h2', texto: 'De onde vieram estes números' }));
  sec.append(criarEl('p', { className: 'ap-meta', texto: notaDasFontes(estado.fontes) }));

  if (estado.modo === 'simulacao') {
    sec.append(
      criarEl('p', {
        className: 'ap-aviso',
        texto:
          'MODO SIMULAÇÃO: estes números NÃO são a apuração. São gerados a partir do resultado real do 1º turno, recontando os dois finalistas entre si, com um desvio de ordem de apuração que desaparece em 100%. Servem para conferir que a projeção converge para o resultado conhecido — não para saber quem está ganhando hoje.',
      }),
    );
  }

  const det = criarEl('details', { className: 'ap-fontes-det' });
  det.append(criarEl('summary', { texto: `Os ${estado.fontes.length} arquivos lidos, um a um` }));
  const lista = criarEl('ul', { className: 'ap-fontes-lista' });
  for (const f of estado.fontes) {
    const li = criarEl('li', { className: f.ok ? '' : 'is-falha' });
    li.append(criarEl('span', { className: 'ap-fonte-uf', texto: f.uf }));
    const a = criarEl('a', { texto: f.url, attrs: { href: f.url, target: '_blank', rel: 'noopener' } });
    li.append(a);
    li.append(criarEl('span', { className: 'ap-fonte-hora', texto: horaCurta(f.lidoEm) }));
    if (!f.ok) li.append(criarEl('span', { className: 'ap-fonte-erro', texto: f.erro ?? 'falhou' }));
    lista.append(li);
  }
  det.append(lista);
  sec.append(det);
  return sec;
}
