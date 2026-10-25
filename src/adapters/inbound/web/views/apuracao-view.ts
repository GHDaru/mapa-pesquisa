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
  margemApurada,
  montarCsv,
  nomeCurto,
  nomeDoArquivoCsv,
  ordenarLinhas,
  ORDENACOES,
  pctApuradoNaLinha,
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
  type Ordenacao,
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
  ordem: Ordenacao;
  /** `resumo` esconde as colunas de conferência; `tudo` traz todas. */
  colunas: 'resumo' | 'tudo';
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
    ordem: 'eleitorado',
    colunas: 'resumo',
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
    raiz.append(criarTabela(p, partidos, estado, desenhar));
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
  // Ordem FIXA dos finalistas, e não por quem está à frente: ordenar por voto
  // faria os dois cartões trocarem de lugar no meio da noite, e um cartão que
  // muda de posição é lido errado — é a mesma razão pela qual as colunas da
  // tabela têm ordem fixa.
  const ordenados = FINALISTAS.map((nome) => p.candidatos.find((c) => c.candidato === nome)).filter(
    (c): c is (typeof p.candidatos)[number] => c != null,
  );
  // Quem recebe o destaque é o líder PROJETADO, o mesmo que o painel nomeia.
  // Acender o cartão do líder na contagem enquanto o painel aponta o outro
  // poria a tela dizendo duas coisas ao mesmo tempo — e é justamente quando
  // os dois divergem que a projeção tem algo a dizer.
  const liderProjetado =
    [...p.candidatos].sort((a, b) => b.votosProjetados - a.votosProjetados)[0]?.candidato ?? null;
  const processado = p.coberturaNacionalEfetiva ?? p.secoesTotalizadasPonderada;
  const houveVoto = p.validosApurados > 0;

  /* ── linha 1: agora ── */
  const agora = criarEl('div', { className: 'ap-cartoes ap-cartoes-agora' });
  for (const c of ordenados) {
    const espectro = resolverEspectro(c.partido, partidos);
    const cartao = criarEl('div', {
      className: `ap-cartao${houveVoto && c.candidato === liderProjetado ? ' is-lider' : ''}`,
    });
    cartao.style.setProperty('--cor', tokenFillEspectro(espectro));
    cartao.append(criarEl('p', { className: 'ap-cartao-nome', texto: c.candidato }));

    // Os dois números do mesmo tamanho, lado a lado: o contado e o projetado.
    //
    // A projeção estava numa linha de rodapé do cartão, em corpo de nota, e
    // isso a subdimensionava justamente no momento em que ela vale mais: com
    // 30% apurado, o número que responde "quem ganha" é o projetado, não o
    // contado — o contado ainda está sendo decidido pela ORDEM em que os
    // estados totalizam. Mas elas são de naturezas diferentes, então o
    // tamanho é igual e o TRATAMENTO não: a projeção fica tracejada e
    // nomeada como estimativa, para nunca passar por contagem.
    const par = criarEl('div', { className: 'ap-cartao-par' });

    const ladoAgora = criarEl('div', { className: 'ap-cartao-lado' });
    ladoAgora.append(criarEl('p', { className: 'ap-cartao-etiqueta', texto: 'Contado' }));
    ladoAgora.append(criarEl('p', { className: 'ap-cartao-pct', texto: formatarPct(c.pctApurado, 2) }));
    ladoAgora.append(
      criarEl('p', { className: 'ap-cartao-votos', texto: `${formatarInt(c.votosApurados)} votos` }),
    );
    par.append(ladoAgora);

    const ladoProj = criarEl('div', { className: 'ap-cartao-lado ap-cartao-lado-proj' });
    ladoProj.append(criarEl('p', { className: 'ap-cartao-etiqueta', texto: 'Projeção' }));
    ladoProj.append(
      criarEl('p', { className: 'ap-cartao-pct', texto: formatarPct(c.pctProjetado, 2) }),
    );
    ladoProj.append(
      criarEl('p', { className: 'ap-cartao-votos', texto: `${formatarInt(c.votosProjetados)} votos` }),
    );
    par.append(ladoProj);
    cartao.append(par);

    // A barra traz os dois: o preenchido é o contado, e a marca é onde a
    // projeção diz que ele vai parar.
    const barra = criarEl('div', { className: 'ap-cartao-barra' });
    const preenche = criarEl('div', { className: 'ap-cartao-barra-fill' });
    preenche.style.width = `${Math.max(0, Math.min(100, c.pctApurado))}%`;
    barra.append(preenche);
    if (houveVoto) {
      const marca = criarEl('i', { className: 'ap-cartao-barra-marca' });
      marca.style.left = `${Math.max(0, Math.min(100, c.pctProjetado))}%`;
      marca.title = `Projeção: ${formatarPct(c.pctProjetado, 2)}`;
      barra.append(marca);
    }
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

  /* ── o painel da projeção ── */
  sec.append(criarPainelProjecao(p, partidos, processado));

  /* ── tira discreta: vantagem e o que não é voto em candidato ── */
  const totais = somarNaoValidos(montarLinhas(p.porUf, FINALISTAS));
  const tira = criarEl('div', { className: 'ap-tira' });

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
  return sec;
}

/**
 * O painel da projeção: o número que o resto da internet não dá.
 *
 * Durante a apuração, o percentual contado responde "o que já entrou" — e
 * quem o lê como "quem ganha" cai na armadilha clássica, porque ele é
 * enviesado pela ORDEM em que os estados totalizam. Quem responde "quem
 * ganha" é a projeção, e ela estava escondida numa linha de rodapé.
 *
 * O painel existe para ela ter peso de manchete sem virar uma. Daí ele
 * sempre carregar, no mesmo bloco e sem precisar de clique: quanto foi
 * apurado, quantos estados estão de fora, e se o resultado já está
 * matematicamente definido — que é a única frase aqui que não é estimativa.
 */
function criarPainelProjecao(
  p: Projecao,
  partidos: readonly Partido[],
  processado: number,
): HTMLElement {
  const painel = criarEl('section', {
    className: 'ap-proj',
    attrs: { 'aria-label': 'Projeção do resultado' },
  });

  const ordenados = [...p.candidatos].sort((a, b) => b.votosProjetados - a.votosProjetados);
  const v = vantagemEntreOsDois(ordenados);
  const definido = p.margem?.matematicamenteDefinido === true;

  const topo = criarEl('div', { className: 'ap-proj-topo' });
  topo.append(
    criarEl('h2', {
      className: 'ap-proj-titulo',
      texto: definido ? 'Resultado matematicamente definido' : 'Projeção do resultado final',
    }),
  );
  topo.append(
    criarEl('span', {
      className: 'ap-proj-selo',
      texto: definido ? 'não é mais estimativa' : 'estimativa, não contagem',
    }),
  );
  painel.append(topo);

  // Sem voto contado não há projeção: a tela diz isso em vez de desenhar um
  // empate em zero, que pareceria uma medida e não é nenhuma.
  if (!v || v.votos <= 0 || p.validosApurados <= 0) {
    painel.append(
      criarEl('p', {
        className: 'ap-proj-vazio',
        texto:
          'A projeção aparece aqui assim que a primeira seção for totalizada. Antes disso não há o que projetar — e inventar um número para preencher o espaço seria pior do que deixá-lo vazio.',
      }),
    );
    return painel;
  }

  const corDoLider = tokenFillEspectro(
    resolverEspectro(ordenados.find((c) => c.candidato === v.lider)?.partido ?? null, partidos),
  );

  const manchete = criarEl('p', { className: 'ap-proj-manchete' });
  manchete.style.setProperty('--cor', corDoLider);
  manchete.append(criarEl('strong', { className: 'ap-proj-lider', texto: v.lider }));
  manchete.append(
    criarEl('span', {
      className: 'ap-proj-vantagem',
      texto: definido
        ? ` vence por ${formatarInt(v.votos)} votos (${formatarPct(v.pontos, 2)})`
        : ` à frente por ${formatarInt(v.votos)} votos (${formatarPct(v.pontos, 2)})`,
    }),
  );
  painel.append(manchete);

  // A barra de 50%: num 2º turno é a linha que decide, e vê-la é mais rápido
  // do que comparar dois percentuais.
  const duelo = criarEl('div', { className: 'ap-proj-duelo' });
  for (const [i, c] of ordenados.slice(0, 2).entries()) {
    const faixa = criarEl('div', { className: `ap-proj-faixa${i === 0 ? ' is-lider' : ''}` });
    faixa.style.setProperty(
      '--cor',
      tokenFillEspectro(resolverEspectro(c.partido, partidos)),
    );
    faixa.style.setProperty('--pct', String(Math.max(0, Math.min(100, c.pctProjetado))));
    faixa.append(criarEl('span', { className: 'ap-proj-faixa-nome', texto: nomeCurto(c.candidato) }));
    const trilho = criarEl('span', { className: 'ap-proj-faixa-trilho' });
    trilho.append(criarEl('i', { className: 'ap-proj-faixa-fill' }));
    faixa.append(trilho);
    faixa.append(
      criarEl('span', { className: 'ap-proj-faixa-pct', texto: formatarPct(c.pctProjetado, 2) }),
    );
    duelo.append(faixa);
  }
  painel.append(duelo);

  painel.append(
    criarEl('p', {
      className: 'ap-proj-nota',
      texto: notaDoEstagio({
        processadoNacional: processado,
        ufsSemApuracao: p.ufsSemApuracao,
        definido,
      }),
    }),
  );
  painel.append(
    criarEl('p', {
      className: 'ap-proj-metodo',
      texto:
        'A projeção é montada estado a estado — cada UF é escalada pelo que falta nela e só depois as UFs são somadas. É o contrário de extrapolar o percentual nacional, que durante o parcial diz mais sobre a ordem em que os estados totalizam do que sobre o voto.',
    }),
  );
  return painel;
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
          ? 'A cor diz quem lidera na REGIÃO: os estados de um mesmo bloco ganham a mesma cor, e as divisas entre eles ficam fracas. Tudo aqui é soma — os votos de cada candidato são a soma dos estados da região, a projeção é a soma das projeções deles, e o percentual é o que já foi apurado dividido pelo total da região. Região sem nenhuma seção fica cinza e sem líder.'
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

/**
 * Meia-largura da barra de vantagem, em pontos percentuais. FIXA.
 *
 * Fixa, e nunca derivada do máximo do momento: numa tela que se atualiza
 * sozinha, escala elástica faz a barra ENCOLHER enquanto a vantagem cresce,
 * porque o máximo cresceu junto. Quem olha duas vezes lê o contrário do que
 * aconteceu.
 */
const ESCALA_VANTAGEM_PP = 45;

function criarTabela(
  p: Projecao,
  partidos: readonly Partido[],
  estado: Estado,
  redesenhar: () => void,
): HTMLElement {
  const porUf = montarLinhas(p.porUf, FINALISTAS);
  const porRegiao = estado.recorte === 'regioes';
  // A tabela de região é a MESMA tabela, com as UFs somadas: mesma ordem de
  // colunas, mesmas unidades, mesma aritmética. O leitor que troca de recorte
  // não deveria ter de reaprender a ler.
  const todas: readonly (LinhaUf | LinhaRegiao)[] = porRegiao
    ? agregarPorRegiao(porUf, FINALISTAS)
    : porUf;
  const linhas = ordenarLinhas(todas, estado.ordem);
  const tudo = estado.colunas === 'tudo';
  const apuradoNacional = p.coberturaNacionalEfetiva ?? p.secoesTotalizadasPonderada;

  const sec = criarEl('section', { className: 'ap-tabela-sec' });
  sec.dataset.colunas = estado.colunas;

  const topo = criarEl('div', { className: 'ap-tabela-topo' });
  topo.append(
    criarEl('h2', {
      className: 'ap-h2',
      texto: porRegiao ? 'Região a região' : 'Estado a estado',
    }),
  );
  topo.append(criarBotaoCsv(linhas, estado, apuradoNacional));
  sec.append(topo);

  sec.append(
    criarEl('p', {
      className: 'ap-meta',
      texto:
        'Os percentuais desta tabela são os APURADOS: a conta sai dos votos já contados, não da projeção. A vantagem também. As projeções ficam nas colunas que se chamam projeção, em "todos os números".',
    }),
  );

  /* ── controles: ordem e colunas ── */
  const ctrl = criarEl('div', { className: 'ap-tabela-ctrl' });

  const rotuloOrdem = criarEl('label', { className: 'ap-ctrl' });
  rotuloOrdem.append(criarEl('span', { texto: 'Ordenar' }));
  const sel = criarEl('select', { className: 'ap-select' }) as HTMLSelectElement;
  for (const o of ORDENACOES) {
    const opt = criarEl('option', { texto: o.rotulo, attrs: { value: o.valor } }) as HTMLOptionElement;
    if (o.valor === estado.ordem) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () => {
    estado.ordem = sel.value as Ordenacao;
    redesenhar();
  });
  rotuloOrdem.append(sel);
  ctrl.append(rotuloOrdem);

  const btnColunas = criarEl('button', {
    className: 'ap-btn-secundario',
    texto: tudo ? 'Mostrar só a leitura' : 'Mostrar todos os números',
    attrs: { type: 'button', 'aria-pressed': String(tudo) },
  });
  btnColunas.addEventListener('click', () => {
    estado.colunas = tudo ? 'resumo' : 'tudo';
    redesenhar();
  });
  ctrl.append(btnColunas);
  sec.append(ctrl);

  /* ── a tabela ── */
  const tabela = criarEl('table', { className: 'ap-tabela' });
  tabela.append(
    criarEl('caption', {
      className: 'ap-sr',
      texto: porRegiao
        ? 'As cinco regiões, uma por linha: quanto já foi apurado, o percentual de cada candidato nos votos contados e a vantagem entre eles.'
        : 'As unidades da federação, uma por linha: quanto já foi apurado, o percentual de cada candidato nos votos contados e a vantagem entre eles.',
    }),
  );

  const thead = criarEl('thead');
  const trh = criarEl('tr');
  // As colunas de um mesmo candidato ficam JUNTAS, e os rótulos dizem o que a
  // célula é: "% apurado" para contagem, "Projeção" para inferência. O
  // cabeçalho dizia só "% Fulano" sobre um valor projetado — projeção com
  // rótulo de contagem é o erro clássico de noite de eleição na célula.
  const colunas: readonly {
    readonly rotulo: string;
    readonly extra?: boolean;
    readonly num?: boolean;
    readonly soLargo?: boolean;
  }[] = [
    { rotulo: porRegiao ? 'Região' : 'UF' },
    { rotulo: 'Eleitores', num: true, extra: true },
    { rotulo: 'Apurado', num: true },
    { rotulo: `% ${nomeCurto(FINALISTAS[0])}`, num: true },
    { rotulo: `% ${nomeCurto(FINALISTAS[1])}`, num: true },
    { rotulo: 'Vantagem' },
    // O saldo sai da leitura no celular: as seis colunas não cabiam em 358px
    // e ele ficava cortado fora da tela, ilegível e inalcançável — pior que
    // ausente, porque o leitor vê que falta alguma coisa e não alcança.
    { rotulo: 'Saldo de votos', num: true, soLargo: true },
    { rotulo: `Projeção ${FINALISTAS[0]}`, num: true, extra: true },
    { rotulo: `Votos ${FINALISTAS[0]}`, num: true, extra: true },
    { rotulo: `Projeção ${FINALISTAS[1]}`, num: true, extra: true },
    { rotulo: `Votos ${FINALISTAS[1]}`, num: true, extra: true },
    { rotulo: 'Brancos', num: true, extra: true },
    { rotulo: 'Nulos', num: true, extra: true },
    { rotulo: 'Abstenções', num: true, extra: true },
  ];
  for (const c of colunas) {
    const th = criarEl('th', { texto: c.rotulo, attrs: { scope: 'col' } });
    if (c.extra) th.classList.add('ap-extra');
    if (c.soLargo) th.classList.add('ap-so-largo');
    if (c.num) th.classList.add('ap-num');
    trh.append(th);
  }
  thead.append(trh);
  tabela.append(thead);

  const tbody = criarEl('tbody');
  const partidoPorCandidato = partidosDaProjecao(p);
  const corDoCandidato = (nome: string | null): string =>
    tokenFillEspectro(resolverEspectro(nome ? partidoPorCandidato.get(nome) ?? null : null, partidos));
  for (const l of linhas) tbody.append(criarLinha(l, corDoCandidato));
  tabela.append(tbody);

  const wrap = criarEl('div', { className: 'ap-tabela-wrap' });
  wrap.append(tabela);
  sec.append(wrap);
  sec.append(criarLegendaDaTabela());
  return sec;
}

/** O partido de cada finalista, para a cor da barra sair do espectro. */
function partidosDaProjecao(p: Projecao): ReadonlyMap<string, string | null> {
  const m = new Map<string, string | null>();
  for (const c of p.candidatos) m.set(c.candidato, c.partido);
  for (const u of p.porUf) for (const c of u.candidatos) if (!m.has(c.candidato)) m.set(c.candidato, c.partido);
  return m;
}

function criarLegendaDaTabela(): HTMLElement {
  return criarEl('p', {
    className: 'ap-meta',
    texto: `A barra de vantagem sai do centro: para um lado é ${FINALISTAS[0]}, para o outro é ${FINALISTAS[1]}, sempre no mesmo lado para cada um — a escala é fixa em ${ESCALA_VANTAGEM_PP} pontos para cada lado, de modo que a barra não encolha quando a vantagem crescer. A marca "pode virar" é um teste exato, sem modelo: a vantagem atual em votos é menor que tudo o que ainda pode entrar naquela linha.`,
  });
}

function criarLinha(l: LinhaUf | LinhaRegiao, corDoCandidato: (nome: string | null) => string): HTMLElement {
  const tr = criarEl('tr');
  const m = margemApurada(l);
  const vazia = semDado(l);

  /* ── a unidade ── */
  const cabeca = criarEl('th', { attrs: { scope: 'row' } });
  // O filete na cor de quem lidera. Cor nunca sozinha: o nome do líder está
  // escrito por extenso na coluna de vantagem, ao lado.
  cabeca.style.setProperty(
    '--cor-lider',
    m.lider ? corDoCandidato(m.lider) : 'var(--spectrum-indefinido)',
  );
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
    cabeca.append(criarEl('span', { className: 'ap-linha-nome', texto: l.uf }));
  }
  tr.append(cabeca);

  const celula = (texto: string, rotulo: string, classe?: string): HTMLElement => {
    const td = criarEl('td', { className: 'ap-num', texto, attrs: { 'data-rotulo': rotulo } });
    if (classe) td.classList.add(classe);
    return td;
  };

  tr.append(celula(formatarInt(l.eleitores), 'Eleitores', 'ap-extra'));

  /* ── apurado: número e barra lado a lado ── */
  const tdProc = criarEl('td', { className: 'ap-num ap-proc', attrs: { 'data-rotulo': 'Apurado' } });
  const cel = criarEl('div', { className: 'ap-proc-cel' });
  cel.append(
    criarEl('span', {
      className: 'ap-proc-num',
      texto: vazia ? 'sem seção' : formatarPct(l.processado),
    }),
  );
  const mini = criarEl('span', { className: 'ap-proc-barra' });
  const miniFill = criarEl('i', { className: 'ap-proc-fill' });
  miniFill.style.width = `${fracaoDaBarra(l.processado) * 100}%`;
  mini.append(miniFill);
  cel.append(mini);
  tdProc.append(cel);
  if (l.finalizada) {
    tdProc.append(criarEl('span', { className: 'ap-fim', texto: 'encerrada' }));
  }
  tr.append(tdProc);

  /* ── os percentuais APURADOS ── */
  for (const nome of FINALISTAS) {
    tr.append(celula(formatarPct(pctApuradoNaLinha(l, nome), 1), `% ${nomeCurto(nome)}`));
  }

  /* ── vantagem: barra divergente a partir do zero ── */
  const tdVant = criarEl('td', { className: 'ap-vant', attrs: { 'data-rotulo': 'Vantagem' } });
  if (vazia || m.lider == null) {
    tdVant.append(criarEl('span', { className: 'ap-vant-rotulo is-vazio', texto: '—' }));
  } else {
    const paraOPrimeiro = m.lider === FINALISTAS[0];
    tdVant.append(
      criarEl('span', {
        className: 'ap-vant-rotulo',
        // Pontos, não "%": a diferença entre dois percentuais é medida em
        // pontos, e escrever "%" aqui confundiria a margem com a votação.
        //
        // E abaixo de 0,05 ponto o arredondamento imprimiria "+0,0" ao lado
        // de um líder nomeado, que se lê como "lidera por nada". A margem
        // existe — a casa decimal é que não a alcança —, então ali o rótulo
        // passa a dizer os votos, que é onde ela aparece.
        texto:
          Math.abs(m.pontos) < 0.05
            ? `${nomeCurto(m.lider)} por ${formatarInt(Math.abs(m.votos))} votos`
            : `${nomeCurto(m.lider)} +${Math.abs(m.pontos).toFixed(1).replace('.', ',')}`,
      }),
    );
    const box = criarEl('span', { className: 'ap-vant-box' });
    box.dataset.lado = paraOPrimeiro ? 'dir' : 'esq';
    box.style.setProperty('--mag', String(Math.min(1, Math.abs(m.pontos) / ESCALA_VANTAGEM_PP)));
    box.style.setProperty('--cor', corDoCandidato(m.lider));
    box.append(criarEl('i', { className: 'ap-vant-eixo' }), criarEl('i', { className: 'ap-vant-barra' }));
    tdVant.append(box);
    if (m.podeVirar) {
      tdVant.append(criarEl('span', { className: 'ap-pode-virar', texto: 'pode virar' }));
    }
  }
  tr.append(tdVant);

  tr.append(
    celula(
      vazia || m.votos === 0 ? '—' : `${m.votos > 0 ? '+' : '−'}${formatarInt(Math.abs(m.votos))}`,
      'Saldo de votos',
      'ap-so-largo',
    ),
  );

  /* ── conferência ── */
  for (const nome of FINALISTAS) {
    const c = l.porCandidato.find((x) => x.candidato === nome);
    tr.append(celula(formatarInt(c?.votosProjetados), `Projeção ${nome}`, 'ap-extra'));
    tr.append(celula(formatarInt(c?.votosApurados), `Votos ${nome}`, 'ap-extra'));
  }
  tr.append(celula(formatarInt(l.brancos), 'Brancos', 'ap-extra'));
  tr.append(celula(formatarInt(l.nulos), 'Nulos', 'ap-extra'));
  tr.append(celula(formatarInt(l.abstencoes), 'Abstenções', 'ap-extra'));
  return tr;
}

/* ──────────────────────────── baixar em CSV ────────────────────────────── */

/**
 * O botão diz a hora da leitura dentro do próprio rótulo.
 *
 * Não é enfeite: um CSV de apuração é uma foto, e quem baixa dois na mesma
 * noite precisa saber qual é qual antes de clicar. A hora e o percentual
 * apurado também vão para o nome do arquivo e para dentro de cada linha.
 */
function criarBotaoCsv(
  linhas: readonly (LinhaUf | LinhaRegiao)[],
  estado: Estado,
  apuradoNacional: number,
): HTMLElement {
  const botao = criarEl('button', {
    className: 'ap-btn-csv',
    attrs: { type: 'button' },
  });
  botao.append(criarEl('span', { texto: 'Baixar CSV' }));
  botao.append(
    criarEl('span', {
      className: 'ap-btn-csv-hora',
      texto: estado.lidoEm ? ` · leitura de ${horaCurta(estado.lidoEm)}` : '',
    }),
  );

  botao.addEventListener('click', () => {
    const csv = montarCsv({
      linhas,
      candidatos: FINALISTAS,
      lidoEm: estado.lidoEm,
      apuradoNacional,
      simulacao: estado.modo === 'simulacao',
      recorte: estado.recorte,
    });
    const nome = nomeDoArquivoCsv({
      lidoEm: estado.lidoEm,
      apuradoNacional,
      simulacao: estado.modo === 'simulacao',
      recorte: estado.recorte,
      turno: 2,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.append(a);
    a.click();
    a.remove();
    // Sem revogar, cada download deixa o arquivo inteiro preso na memória da
    // aba — e numa noite de apuração são muitos downloads na mesma aba.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });

  return botao;
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
