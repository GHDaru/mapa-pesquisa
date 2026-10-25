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

  const v = vantagemEntreOsDois(ordenados);
  const resumo = criarEl('div', { className: 'ap-resumo' });
  if (v) {
    resumo.append(
      criarEl('p', {
        className: 'ap-resumo-vantagem',
        texto: `${v.lider} à frente por ${formatarInt(v.votos)} votos (${formatarPct(v.pontos, 2)})`,
      }),
    );
  }
  resumo.append(
    criarEl('p', {
      className: 'ap-meta',
      texto: notaDoEstagio({
        processadoNacional: p.coberturaNacionalEfetiva ?? p.secoesTotalizadasPonderada,
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
        'A cor é de quem lidera naquele estado. O preenchimento, da esquerda para a direita, é quanto daquele estado já foi apurado — um estado pela metade aparece metade pintado. Estado ainda sem seção fica cinza, sem líder: pintar liderança que ninguém mediu seria inventar.',
    }),
  );

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', mapaBrasil.viewBox);
  svg.setAttribute('class', 'ap-mapa-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa da apuração por estado');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.append(defs);

  for (const loc of mapaBrasil.locations) {
    const uf = loc.id.toUpperCase();
    const u = porUf.get(uf);
    const bbox = bboxPath(loc.path);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', loc.path);
    path.setAttribute('class', 'ap-mapa-uf');

    if (!u || semDado({ processado: u.secoesTotalizadas })) {
      path.style.fill = 'var(--spectrum-indefinido)';
      path.setAttribute('aria-label', `${nomePorUf.get(uf) ?? uf}: nenhuma seção apurada.`);
    } else {
      const espectro = resolverEspectro(
        u.candidatos.find((c) => c.candidato === u.lider)?.partido ?? null,
        partidos,
      );
      const cor = tokenFillEspectro(espectro);
      const fracao = fracaoDaBarra(u.secoesTotalizadas);
      // Gradiente com DOIS stops no mesmo offset: corte seco, não degradê.
      // Um degradê leria como incerteza espacial, e o que se quer dizer aqui é
      // "esta fração do estado já foi contada" — uma fronteira, não um borrão.
      const id = `ap-grad-${uf}`;
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      grad.setAttribute('id', id);
      grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      grad.setAttribute('x1', String(bbox.minX));
      grad.setAttribute('x2', String(bbox.maxX));
      grad.setAttribute('y1', '0');
      grad.setAttribute('y2', '0');
      for (const [offset, corStop, opacidade] of [
        [0, cor, '1'],
        [fracao, cor, '1'],
        [fracao, cor, '0.18'],
        [1, cor, '0.18'],
      ] as const) {
        const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop.setAttribute('offset', String(offset));
        stop.setAttribute('stop-color', corStop);
        stop.setAttribute('stop-opacity', opacidade);
        grad.append(stop);
      }
      defs.append(grad);
      path.style.fill = `url(#${id})`;
      path.setAttribute(
        'aria-label',
        `${nomePorUf.get(uf) ?? uf}: ${formatarPct(u.secoesTotalizadas)} apurado, ${u.lider ?? '—'} à frente.`,
      );
    }
    svg.append(path);

    const texto = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    texto.setAttribute('x', String((bbox.minX + bbox.maxX) / 2));
    texto.setAttribute('y', String((bbox.minY + bbox.maxY) / 2));
    texto.setAttribute('class', 'ap-mapa-sigla');
    texto.setAttribute('aria-hidden', 'true');
    texto.textContent = uf;
    svg.append(texto);
  }

  const wrap = criarEl('div', { className: 'ap-mapa-wrap' });
  wrap.append(svg);
  sec.append(wrap);
  return sec;
}

/* ──────────────────────────── tabela por estado ────────────────────────── */

function criarTabela(p: Projecao, estado: Estado): HTMLElement {
  const linhas = montarLinhas(p.porUf, FINALISTAS);
  const sec = criarEl('section', { className: 'ap-tabela-sec' });
  sec.append(criarEl('h2', { className: 'ap-h2', texto: 'Estado a estado' }));

  const tabela = criarEl('table', { className: 'ap-tabela' });
  const thead = criarEl('thead');
  const trh = criarEl('tr');
  const colunas = [
    'UF', 'Eleitores', '% apurado',
    `% ${FINALISTAS[0]}`, `% ${FINALISTAS[1]}`,
    `Projeção ${FINALISTAS[0]}`, `Projeção ${FINALISTAS[1]}`,
    `Votos ${FINALISTAS[0]}`, `Votos ${FINALISTAS[1]}`,
    'Brancos', 'Nulos', 'Abstenções', 'Hora',
  ];
  for (const c of colunas) trh.append(criarEl('th', { texto: c, attrs: { scope: 'col' } }));
  thead.append(trh);
  tabela.append(thead);

  const tbody = criarEl('tbody');
  for (const l of linhas) tbody.append(criarLinha(l, estado));
  tabela.append(tbody);

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

  for (const c of l.porCandidato) tr.append(celula(formatarPct(c.pct, 2), `% ${c.candidato}`));
  for (const c of l.porCandidato)
    tr.append(celula(formatarInt(c.votosProjetados), `Projeção ${c.candidato}`));
  for (const c of l.porCandidato)
    tr.append(celula(formatarInt(c.votosApurados), `Votos ${c.candidato}`));

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
