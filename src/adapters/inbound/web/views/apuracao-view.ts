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
  agregarPorRegiao,
  fracaoDaBarra,
  formatarInt,
  formatarPct,
  horaCurta,
  montarLinhas,
  notaDasFontes,
  notaDoEstagio,
  semDado,
  somarNaoValidos,
  vantagemEntreOsDois,
  regiaoDaUf,
  REGIOES,
  type LinhaRegiao,
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

/**
 * Por estado ou por região. As duas leem o MESMO dado — a região é a soma das
 * UFs dela, não uma fonte nova —, mas respondem a perguntas diferentes: 27
 * linhas respondem "como está o meu estado" e 5 respondem "qual é o desenho
 * do país", que o voto brasileiro tem forte e que a lista por UF dissolve.
 */
type Recorte = 'estados' | 'regioes';

type ModoMapa = 'medidor' | 'preenchimento';

interface Estado {
  modo: Modo;
  recorte: Recorte;
  modoMapa: ModoMapa;
  avancoSimulado: number;
  projecao: Projecao | null;
  fontes: readonly FonteLida[];
  carregando: boolean;
  erro: string | null;
  lidoEm: string | null;
}

export interface OpcoesApuracao {
  /**
   * `false` esconde o `<h1>` próprio. A apuração vive DENTRO do mapa por
   * estado, como mais um modo ao lado de "Quem lidera" e "Eleitorado" — e lá
   * a página já tem título. Um segundo `<h1>` no meio do documento quebraria
   * a hierarquia para quem navega por cabeçalhos.
   */
  readonly titulo?: boolean;
}

export async function renderApuracao(
  main: HTMLElement,
  casos: CasosDeUso,
  opcoes: OpcoesApuracao = {},
): Promise<void> {
  const comTitulo = opcoes.titulo !== false;
  const partidos = casos.listParties();
  const aoVivo = casos.getApuracaoAoVivo();
  const apuracao1T = aoVivo.apuracaoPrimeiroTurno;

  const estado: Estado = {
    modo: 'ao-vivo',
    recorte: 'estados',
    modoMapa: 'medidor',
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
    raiz.append(criarCabecalho(estado, atualizar, desenhar, comTitulo));
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
    raiz.append(criarBigNumbers(p, partidos, estado));
    raiz.append(criarMapaProgresso(p, partidos, estado, desenhar));
    raiz.append(criarTabela(p, estado));
    raiz.append(criarFontes(estado));
  }

  desenhar();
  await atualizar();
}

/* ───────────────────────── cabeçalho e controles ───────────────────────── */

function criarCabecalho(
  estado: Estado,
  atualizar: () => Promise<void>,
  redesenhar: () => void,
  comTitulo: boolean,
): HTMLElement {
  const topo = criarEl('header', { className: 'ap-topo' });
  if (comTitulo) topo.append(criarEl('h1', { className: 'ap-titulo', texto: 'Apuração ao vivo' }));
  else topo.append(criarEl('h3', { className: 'ap-titulo ap-titulo-embutido', texto: 'Apuração ao vivo' }));

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

  // O recorte governa o mapa E a tabela, então ele fica no cabeçalho, junto
  // dos outros controles da tela inteira — e não dentro do mapa, que daria a
  // entender que só o mapa muda.
  const grupoRecorte = criarEl('div', {
    className: 'ap-modo',
    attrs: { role: 'group', 'aria-label': 'Recorte dos números' },
  });
  for (const [rec, rotulo] of [['estados', 'Estados'], ['regioes', 'Regiões']] as const) {
    const b = criarEl('button', {
      className: `ap-modo-botao${estado.recorte === rec ? ' is-ativo' : ''}`,
      texto: rotulo,
      attrs: { type: 'button', 'aria-pressed': String(estado.recorte === rec) },
    });
    b.addEventListener('click', () => {
      if (estado.recorte === rec) return;
      estado.recorte = rec;
      // Só redesenha: o dado é o mesmo, a região é soma das UFs. Buscar de
      // novo no TSE para trocar de recorte seria pedir ao servidor o que já
      // está na memória, e numa noite de apuração isso multiplica requisição
      // por nada.
      redesenhar();
    });
    grupoRecorte.append(b);
  }
  controles.append(grupoRecorte);

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

/**
 * A primeira linha é O QUE ESTÁ CONTADO AGORA.
 *
 * A tela começou pela projeção, e isso estava invertido: projeção é
 * inferência sobre o que falta, contagem é fato. Numa noite de apuração o
 * leitor pergunta primeiro "como está agora" — e a resposta a essa pergunta
 * não pode estar um degrau abaixo de uma estimativa.
 *
 * Por isso a linha de cima tem quatro números do mesmo tamanho, e os quatro
 * descrevem o mesmo instante: os dois percentuais APURADOS, quanto já foi
 * apurado, e a hora da leitura. Os três primeiros não significam nada sem o
 * quarto — 50,6% às 17h12 com 3% apurado e 50,6% às 22h40 com 97% apurado são
 * afirmações de força completamente diferente —, então eles ficam lado a lado,
 * no mesmo peso, e não um no título e o outro no rodapé.
 *
 * A projeção vem logo abaixo, nomeada como projeção. Brancos, nulos e
 * abstenções ficam discretos de propósito: são contagem crua do que entrou e
 * não disputam a leitura com os percentuais dos candidatos.
 */
function criarBigNumbers(p: Projecao, partidos: readonly Partido[], estado: Estado): HTMLElement {
  const sec = criarEl('section', { className: 'ap-bignumbers' });
  const ordenados = [...p.candidatos].sort((a, b) => b.votosApurados - a.votosApurados);
  const processado = p.coberturaNacionalEfetiva ?? p.secoesTotalizadasPonderada;
  const houveVoto = p.validosApurados > 0;

  /* ── linha 1: agora ── */
  const agora = criarEl('div', { className: 'ap-cartoes ap-cartoes-agora' });
  for (const [i, c] of ordenados.entries()) {
    const espectro = resolverEspectro(c.partido, partidos);
    const cartao = criarEl('div', { className: `ap-cartao${i === 0 && houveVoto ? ' is-lider' : ''}` });
    cartao.style.setProperty('--cor', tokenFillEspectro(espectro));
    cartao.append(criarEl('p', { className: 'ap-cartao-nome', texto: c.candidato }));
    cartao.append(criarEl('p', { className: 'ap-cartao-pct', texto: formatarPct(c.pctApurado, 2) }));
    cartao.append(
      criarEl('p', { className: 'ap-cartao-votos', texto: `${formatarInt(c.votosApurados)} votos apurados` }),
    );
    cartao.append(
      criarEl('p', {
        className: 'ap-cartao-apurado',
        texto: `Projeção: ${formatarPct(c.pctProjetado, 2)} · ${formatarInt(c.votosProjetados)} votos`,
      }),
    );
    const barra = criarEl('div', { className: 'ap-cartao-barra' });
    const preenche = criarEl('div', { className: 'ap-cartao-barra-fill' });
    preenche.style.width = `${Math.max(0, Math.min(100, c.pctApurado))}%`;
    barra.append(preenche);
    cartao.append(barra);
    agora.append(cartao);
  }

  // Apuração e hora como números grandes, no mesmo tamanho dos candidatos:
  // eles são a condição de leitura dos outros dois, não uma legenda deles.
  const cartaoProc = criarEl('div', { className: 'ap-cartao ap-cartao-condicao' });
  cartaoProc.append(criarEl('p', { className: 'ap-cartao-nome', texto: 'Apuração' }));
  cartaoProc.append(criarEl('p', { className: 'ap-cartao-pct', texto: formatarPct(processado) }));
  cartaoProc.append(
    criarEl('p', { className: 'ap-cartao-votos', texto: `${formatarInt(p.validosApurados)} votos válidos contados` }),
  );
  cartaoProc.append(
    criarEl('p', {
      className: 'ap-cartao-apurado',
      texto:
        p.ufsSemApuracao.length > 0
          ? `${p.ufsSemApuracao.length} ${p.ufsSemApuracao.length === 1 ? 'estado ainda sem seção' : 'estados ainda sem seção'}`
          : 'Todos os estados já têm seção apurada',
    }),
  );
  const trilhoTopo = criarEl('div', { className: 'ap-cartao-barra' });
  const nivelTopo = criarEl('div', { className: 'ap-cartao-barra-fill' });
  nivelTopo.style.width = `${fracaoDaBarra(processado) * 100}%`;
  trilhoTopo.append(nivelTopo);
  cartaoProc.append(trilhoTopo);
  agora.append(cartaoProc);

  const cartaoHora = criarEl('div', { className: 'ap-cartao ap-cartao-condicao' });
  cartaoHora.append(criarEl('p', { className: 'ap-cartao-nome', texto: 'Atualizado às' }));
  cartaoHora.append(criarEl('p', { className: 'ap-cartao-pct', texto: horaCurta(estado.lidoEm) }));
  cartaoHora.append(
    criarEl('p', {
      className: 'ap-cartao-votos',
      texto: estado.carregando ? 'buscando agora…' : 'horário desta leitura',
    }),
  );
  cartaoHora.append(
    criarEl('p', {
      className: 'ap-cartao-apurado',
      texto: estado.modo === 'simulacao' ? 'MODO SIMULAÇÃO — não é a apuração' : 'direto do TSE, sem intermediário',
    }),
  );
  agora.append(cartaoHora);
  sec.append(agora);

  /* ── tira discreta: vantagem e o que não é voto em candidato ── */
  const v = vantagemEntreOsDois([...p.candidatos].sort((a, b) => b.votosProjetados - a.votosProjetados));
  const totais = somarNaoValidos(montarLinhas(p.porUf, FINALISTAS));
  const tira = criarEl('div', { className: 'ap-tira' });

  // Com zero voto contado não existe líder, e a ordenação por votos devolve
  // um empate em 0 como se fosse vantagem. Dizer "fulano à frente por 0
  // votos" é nomear uma liderança que ninguém mediu.
  if (v && v.votos > 0) {
    const item = criarEl('span', { className: 'ap-tira-item ap-tira-vantagem' });
    item.append(criarEl('span', { className: 'ap-tira-rotulo', texto: 'Vantagem projetada' }));
    item.append(
      criarEl('span', {
        className: 'ap-tira-valor',
        texto: `${formatarInt(v.votos)} votos · ${formatarPct(v.pontos, 2)} · ${v.lider}`,
      }),
    );
    tira.append(item);
  }
  for (const [rotulo, valor] of [
    ['Brancos', totais.brancos],
    ['Nulos', totais.nulos],
    ['Abstenções', totais.abstencoes],
  ] as const) {
    const item = criarEl('span', { className: 'ap-tira-item' });
    item.append(criarEl('span', { className: 'ap-tira-rotulo', texto: rotulo }));
    item.append(criarEl('span', { className: 'ap-tira-valor', texto: formatarInt(valor) }));
    // A taxa precisa do denominador do MESMO instante: comparecimento já
    // contado, não eleitorado inteiro — senão a taxa de branco cai a cada
    // seção que entra e parece estar diminuindo sozinha.
    if (valor != null && rotulo !== 'Abstenções' && p.validosApurados > 0) {
      item.append(
        criarEl('span', {
          className: 'ap-tira-nota',
          texto: formatarPct((valor / (p.validosApurados + valor)) * 100, 2),
        }),
      );
    }
    tira.append(item);
  }
  sec.append(tira);

  sec.append(
    criarEl('p', {
      className: 'ap-meta',
      texto: notaDoEstagio({
        processadoNacional: processado,
        ufsSemApuracao: p.ufsSemApuracao,
        definido: p.margem?.matematicamenteDefinido === true,
      }),
    }),
  );
  return sec;
}

/* ─────────────────────── mapa preenchido por progresso ─────────────────── */

function criarMapaProgresso(
  p: Projecao,
  partidos: readonly Partido[],
  estado: Estado,
  redesenhar: () => void,
): HTMLElement {
  const medidor = estado.modoMapa === 'medidor';
  const porRegiao = estado.recorte === 'regioes';
  const porUf = new Map(p.porUf.map((u) => [u.uf, u]));
  const nomePorUf = new Map(mapaBrasil.locations.map((l) => [l.id.toUpperCase(), l.name]));

  // No recorte por região, cada UF é pintada com o resultado DA REGIÃO dela.
  // O desenho continua sendo o dos estados — não existe polígono de região
  // neste mapa —, mas a cor, o medidor e o rótulo passam a ser do bloco: as
  // divisas internas ficam fracas e o rótulo vai para o centro da região, de
  // modo que o olho leia cinco áreas e não vinte e sete.
  const regioes = porRegiao ? agregarPorRegiao(montarLinhas(p.porUf, FINALISTAS), FINALISTAS) : [];
  const regiaoPorNome = new Map(regioes.map((r) => [r.regiao, r]));

  /** O que pinta e rotula uma UF: ela mesma, ou a região a que pertence. */
  function areaDe(uf: string): {
    readonly lider: string | null;
    readonly partidoDoLider: string | null;
    readonly processado: number;
    readonly nome: string;
  } | null {
    if (porRegiao) {
      const nome = regiaoDaUf(uf);
      const r = nome ? regiaoPorNome.get(nome) : undefined;
      if (!r || !nome) return null;
      // O partido vem de qualquer UF da região que tenha o candidato: o
      // candidato é o mesmo no país inteiro, só a ficha é por recorte.
      const partido =
        p.porUf
          .flatMap((u) => u.candidatos)
          .find((c) => c.candidato === r.lider)?.partido ?? null;
      return { lider: r.lider, partidoDoLider: partido, processado: r.processado, nome };
    }
    const u = porUf.get(uf);
    if (!u) return null;
    return {
      lider: u.lider,
      partidoDoLider: u.candidatos.find((c) => c.candidato === u.lider)?.partido ?? null,
      processado: u.secoesTotalizadas,
      nome: nomePorUf.get(uf) ?? uf,
    };
  }

  const sec = criarEl('section', { className: 'ap-mapa-sec' });
  sec.append(
    criarEl('h2', {
      className: 'ap-h2',
      texto: porRegiao ? 'Onde cada região está' : 'Onde cada estado está',
    }),
  );
  sec.append(
    criarEl('p', {
      className: 'ap-meta',
      texto: medidor
        ? porRegiao
          ? 'A cor diz quem lidera na REGIÃO: os estados de um mesmo bloco ganham a mesma cor, e as divisas entre eles ficam fracas. O medidor no centro do bloco diz quanto já foi apurado na região inteira, ponderado pelo eleitorado — não a média das UFs, que com estados de tamanhos tão diferentes seria outra conta e outro número. Região sem nenhuma seção fica cinza e sem líder.'
          : 'A cor do estado diz quem lidera ali. Quanto já foi apurado é dito pela barra sob a sigla, que é um medidor e não parte do desenho do país. Estado sem nenhuma seção fica cinza e sem líder: pintar liderança que ninguém mediu seria inventar.'
        : 'A cor cheia é de quem lidera, e ela avança da esquerda para a direita conforme as seções entram; o que falta fica hachurado na mesma cor. Quatro críticos cegos leram este desenho como divisão geográfica do estado, não como andamento — ele está aqui porque foi o pedido, e o modo "medidor" ao lado é a alternativa que eles apontaram.',
    }),
  );

  const sel = criarEl('div', { className: 'ap-modo ap-modo-mapa', attrs: { role: 'group', 'aria-label': 'Como o mapa mostra o andamento' } });
  for (const [m, rot] of [['medidor', 'Cor + medidor'], ['preenchimento', 'Preenchimento']] as const) {
    const b = criarEl('button', {
      className: `ap-modo-botao${estado.modoMapa === m ? ' is-ativo' : ''}`,
      texto: rot,
      attrs: { type: 'button', 'aria-pressed': String(estado.modoMapa === m) },
    });
    b.addEventListener('click', () => {
      if (estado.modoMapa === m) return;
      estado.modoMapa = m;
      redesenhar();
    });
    sel.append(b);
  }
  sec.append(sel);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', mapaBrasil.viewBox);
  svg.setAttribute('class', 'ap-mapa-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa da apuração por estado');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  /**
   * Hachura POR UF, tingida na cor de quem lidera ali.
   *
   * Uma hachura única e neutra para o mapa inteiro virava um lençol contínuo:
   * os riscos atravessavam fronteiras, o estado deixava de ter forma própria e
   * o vermelho da Bahia encostava no do Piauí sem fronteira visível — não dava
   * para dizer de quem era aquela cor. Tingida, a parte que falta continua
   * pertencendo ao líder daquele estado; com a origem deslocada por UF, os
   * riscos deixam de se alinhar de um estado para o outro.
   */
  function hachuraDe(uf: string, cor: string, i: number): string {
    const id = `ap-hach-${uf}`;
    const pat = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pat.setAttribute('id', id);
    pat.setAttribute('width', '5');
    pat.setAttribute('height', '5');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('patternTransform', `rotate(45) translate(${(i % 5) * 1.1} 0)`);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.setAttribute('width', '5');
    g.setAttribute('height', '5');
    g.setAttribute('fill', cor);
    g.setAttribute('fill-opacity', '0.14');
    pat.append(g);
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', '0');
    l.setAttribute('y1', '0');
    l.setAttribute('x2', '0');
    l.setAttribute('y2', '5');
    l.setAttribute('stroke', cor);
    l.setAttribute('stroke-opacity', '0.5');
    l.setAttribute('stroke-width', '2');
    pat.append(l);
    defs.append(pat);
    return id;
  }

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

  for (const [indice, loc] of mapaBrasil.locations.entries()) {
    const uf = loc.id.toUpperCase();
    const area = areaDe(uf);
    const bbox = bboxPath(loc.path);
    const grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    if (!area || semDado({ processado: area.processado })) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', loc.path);
      path.setAttribute('class', 'ap-mapa-uf');
      path.style.fill = 'var(--spectrum-indefinido)';
      path.setAttribute(
        'aria-label',
        `${area?.nome ?? nomePorUf.get(uf) ?? uf}: nenhuma seção apurada.`,
      );
      grupo.append(path);
      const borda = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      borda.setAttribute('d', loc.path);
      borda.setAttribute('class', 'ap-mapa-contorno');
      grupo.append(borda);
    } else {
      const espectro = resolverEspectro(area.partidoDoLider, partidos);
      const cor = tokenFillEspectro(espectro);
      const fracao = fracaoDaBarra(area.processado);
      const corte = bbox.minX + (bbox.maxX - bbox.minX) * fracao;
      const idClip = `ap-clip-${uf}`;

      // A parte NÃO contada, por baixo: hachura neutra no estado inteiro.
      const base = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      base.setAttribute('d', loc.path);
      base.setAttribute('class', 'ap-mapa-uf ap-mapa-vazio');
      if (medidor) {
        // Cor cheia: o polígono responde SÓ "quem lidera". O quanto foi
        // contado sai do desenho do país e vai para o medidor, que é a
        // forma que existe para dizer fração.
        base.style.fill = cor;
      } else {
        base.setAttribute('fill', `url(#${hachuraDe(uf, cor, indice)})`);
      }
      grupo.append(base);

      // A parte contada, por cima, recortada até onde a apuração chegou.
      if (!medidor) {
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
      }

      // Contorno por cima, para o estado continuar sendo um estado — e fraco
      // quando o recorte é por região, para que o bloco leia como um bloco
      // sem que as divisas estaduais desapareçam de vez.
      const contorno = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      contorno.setAttribute('d', loc.path);
      contorno.setAttribute('class', porRegiao ? 'ap-mapa-contorno ap-mapa-contorno-fraco' : 'ap-mapa-contorno');
      grupo.append(contorno);

      grupo.setAttribute(
        'aria-label',
        porRegiao
          ? `${nomePorUf.get(uf) ?? uf}, região ${area.nome}: ${formatarPct(area.processado)} apurado na região, ${area.lider ?? '—'} à frente.`
          : `${area.nome}: ${formatarPct(area.processado)} apurado, ${area.lider ?? '—'} à frente.`,
      );
    }

    // Rótulo e medidor. Por estado, um por UF; por região, um por região, e
    // os dois saem da MESMA função para que não divirjam com o tempo.
    if (!porRegiao) {
      rotularArea(grupo, {
        cx: (bbox.minX + bbox.maxX) / 2,
        cy: (bbox.minY + bbox.maxY) / 2,
        rotulo: uf,
        processado: area && !semDado({ processado: area.processado }) ? area.processado : null,
        cor: area ? tokenFillEspectro(resolverEspectro(area.partidoDoLider, partidos)) : null,
        escala: 1,
      });
    }

    svg.append(grupo);
  }

  // Um rótulo por região, no centro de massa dos estados dela.
  //
  // Centro de massa, e não média simples dos centros: o Norte tem o Amazonas
  // e o Amapá, e uma média simples puxaria o rótulo do Norte para um canto
  // onde ele não descreve a região. A área da caixa de cada UF é a melhor
  // aproximação de peso disponível aqui, já que o mapa não traz área real.
  if (porRegiao) {
    const caixaPorUf = new Map(
      mapaBrasil.locations.map((l) => [l.id.toUpperCase(), bboxPath(l.path)] as const),
    );
    for (const reg of REGIOES) {
      const r = regiaoPorNome.get(reg.nome);
      if (!r) continue;
      const caixas = reg.ufs.map((uf) => caixaPorUf.get(uf)).filter((b) => b != null);
      if (caixas.length === 0) continue;
      let peso = 0;
      let somaX = 0;
      let somaY = 0;
      for (const b of caixas) {
        const area = Math.max(1e-6, (b.maxX - b.minX) * (b.maxY - b.minY));
        peso += area;
        somaX += ((b.minX + b.maxX) / 2) * area;
        somaY += ((b.minY + b.maxY) / 2) * area;
      }
      const grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      grupo.setAttribute(
        'aria-label',
        `${reg.nome}: ${formatarPct(r.processado)} apurado, ${r.lider ?? 'sem líder ainda'}.`,
      );
      const partido =
        p.porUf.flatMap((u) => u.candidatos).find((c) => c.candidato === r.lider)?.partido ?? null;
      rotularArea(grupo, {
        cx: somaX / peso,
        cy: somaY / peso,
        rotulo: reg.nome,
        processado: r.lider == null ? null : r.processado,
        cor: tokenFillEspectro(resolverEspectro(partido, partidos)),
        escala: 1.7,
      });
      svg.append(grupo);
    }
  }

  const wrap = criarEl('div', { className: 'ap-mapa-wrap' });
  wrap.append(svg);
  sec.append(wrap);
  sec.append(criarLegendaDoMapa());
  return sec;
}

/**
 * O rótulo com o MEDIDOR embaixo.
 *
 * Quatro críticos cegos, em rodadas independentes, leram o preenchimento do
 * polígono como divisão geográfica e não como andamento — e o quarto fechou o
 * argumento: área pequena não comporta uma fração legível como número, então
 * a barra tem de ser o canal, não o reforço. Daí trilho visível, largura FIXA
 * (não proporcional à área, senão a comparação entre áreas some) e o número ao
 * lado. Um quinto crítico mediu que o trilho tinha 1,25:1 de contraste contra
 * o próprio estado e o medidor sumia; o trilho é opaco por isso.
 *
 * `processado: null` desenha só o rótulo: área sem nenhuma seção não ganha
 * medidor, porque um medidor em zero e um medidor ausente dizem coisas
 * diferentes e só a segunda é verdade ali.
 */
function rotularArea(
  grupo: SVGElement,
  o: {
    readonly cx: number;
    readonly cy: number;
    readonly rotulo: string;
    readonly processado: number | null;
    readonly cor: string | null;
    readonly escala: number;
  },
): void {
  const ns = 'http://www.w3.org/2000/svg';
  const texto = document.createElementNS(ns, 'text');
  texto.setAttribute('x', String(o.cx));
  texto.setAttribute('y', String(o.cy - 1.5 * o.escala));
  texto.setAttribute('class', o.escala > 1 ? 'ap-mapa-sigla ap-mapa-sigla-regiao' : 'ap-mapa-sigla');
  texto.setAttribute('aria-hidden', 'true');
  texto.textContent = o.rotulo;
  grupo.append(texto);

  if (o.processado == null) return;

  const larg = 17 * o.escala;
  const alt = 4.2 * o.escala;
  const bx = o.cx - larg / 2;
  const by = o.cy + 1.9 * o.escala;
  const trilho = document.createElementNS(ns, 'rect');
  trilho.setAttribute('x', String(bx));
  trilho.setAttribute('y', String(by));
  trilho.setAttribute('width', String(larg));
  trilho.setAttribute('height', String(alt));
  trilho.setAttribute('rx', String(alt / 2));
  trilho.setAttribute('class', 'ap-mapa-trilho');
  trilho.setAttribute('aria-hidden', 'true');
  grupo.append(trilho);

  const nivel = document.createElementNS(ns, 'rect');
  nivel.setAttribute('x', String(bx));
  nivel.setAttribute('y', String(by));
  nivel.setAttribute('width', String(larg * fracaoDaBarra(o.processado)));
  nivel.setAttribute('height', String(alt));
  nivel.setAttribute('rx', String(alt / 2));
  nivel.setAttribute('class', 'ap-mapa-nivel');
  if (o.cor) nivel.style.fill = o.cor;
  nivel.setAttribute('aria-hidden', 'true');
  grupo.append(nivel);

  const num = document.createElementNS(ns, 'text');
  num.setAttribute('x', String(bx + larg + 1.6 * o.escala));
  num.setAttribute('y', String(by + alt));
  num.setAttribute('class', o.escala > 1 ? 'ap-mapa-pct ap-mapa-pct-regiao' : 'ap-mapa-pct');
  num.setAttribute('aria-hidden', 'true');
  num.textContent = `${Math.round(o.processado)}%`;
  grupo.append(num);
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
  const porUf = montarLinhas(p.porUf, FINALISTAS);
  const porRegiao = estado.recorte === 'regioes';
  // A tabela de região é a MESMA tabela, com as UFs somadas: mesma ordem de
  // colunas, mesmas unidades, mesma aritmética. O leitor que troca de recorte
  // não deveria ter de reaprender a ler.
  const linhas: readonly (LinhaUf | LinhaRegiao)[] = porRegiao
    ? agregarPorRegiao(porUf, FINALISTAS)
    : porUf;
  const sec = criarEl('section', { className: 'ap-tabela-sec' });
  sec.append(
    criarEl('h2', {
      className: 'ap-h2',
      texto: porRegiao ? 'Região a região' : 'Estado a estado',
    }),
  );

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
    porRegiao ? 'Região' : 'UF', 'Eleitores', '% apurado',
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

function criarLinha(l: LinhaUf | LinhaRegiao, estado: Estado): HTMLElement {
  const tr = criarEl('tr');
  const cabeca = criarEl('th', { attrs: { scope: 'row' } });
  if ('regiao' in l) {
    cabeca.append(criarEl('span', { className: 'ap-linha-nome', texto: l.regiao }));
    // Quais UFs entraram, e quais ficaram de fora por não ter seção nenhuma.
    // Sem isso, uma região aparece completa quando não está — que é o jeito
    // mais silencioso de uma soma mentir.
    cabeca.append(
      criarEl('span', {
        className: 'ap-linha-nota',
        texto:
          l.ufsSemApuracao.length > 0
            ? `${l.ufs.length - l.ufsSemApuracao.length} de ${l.ufs.length} UFs · sem seção: ${l.ufsSemApuracao.join(', ')}`
            : `${l.ufs.length} UFs`,
      }),
    );
  } else {
    cabeca.textContent = l.uf;
  }
  tr.append(cabeca);
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
