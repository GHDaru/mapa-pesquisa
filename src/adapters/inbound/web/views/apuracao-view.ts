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
import {
  apuracaoZerada,
  buscarApuracao,
  ELEICOES,
  type FonteLida,
} from '../../../outbound/tse/tse-client.js';
import { simularApuracao } from '../../../outbound/tse/simulador.js';
import parciaisImprensa from '../../../../../data/exterior-parciais-imprensa.json' with { type: 'json' };
import {
  buscarExterior,
  CONTINENTES,
  type LinhaContinente,
} from '../../../outbound/tse/exterior.js';
import { bboxPath, criarEl, tokenFillEspectro } from './_shared.js';
import {
  agregarPorRegiao,
  apuracaoRetida,
  faltaParaLiberar,
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
  montarDicaDaUf,
  montarLinhas,
  nomearUnidades,
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

// 'ZZ' é o EXTERIOR, que o TSE publica como se fosse uma UF: 1.351 seções e
// 916.683 eleitores aptos — mais que onze das 27 unidades da federação. Sem
// ele, a projeção somava 27 recortes e chamava o resultado de nacional
// deixando quase um milhão de eleitores de fora, sem dizer.
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  'ZZ',
];

/** Nome legível do exterior: 'ZZ' não diz nada a quem lê. */
const NOME_EXTERIOR = 'Exterior';

/**
 * Hora em que a apuração deixa de ficar zerada, em horário de Brasília.
 *
 * É decisão de quem publica a página, não limitação técnica: os arquivos do
 * TSE já estão no ar e o código já sabe lê-los. Por isso a tela DIZ que está
 * segurando, com a hora — zero calado se lê como "ninguém votou" ou "o site
 * quebrou", e as duas leituras são falsas.
 */
const LIBERA_AS = 19;

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
  /** O painel do exterior é visão auxiliar: só busca quando alguém abre. */
  exteriorAberto: boolean;
  exteriorCarregando: boolean;
  exterior: readonly LinhaContinente[] | null;
  exteriorFalhas: number;
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
    // O preenchimento abre primeiro: é o desenho pedido, e quem pediu não
    // achou o botão do outro modo — se quem especificou não acha, o leitor
    // não acha. O medidor deixou de ser a alternativa escondida e passou a
    // aparecer NOS DOIS modos, que resolve a objeção dos críticos (estado
    // pequeno não comporta fração de área legível) sem tirar o preenchimento.
    modoMapa: 'preenchimento',
    avancoSimulado: 0.35,
    projecao: null,
    fontes: [],
    carregando: false,
    erro: null,
    lidoEm: null,
    exteriorAberto: false,
    exteriorCarregando: false,
    exterior: null,
    exteriorFalhas: 0,
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
      } else if (apuracaoRetida(new Date(), LIBERA_AS)) {
        // Retido: nada é buscado. Não adianta ler e esconder — o número
        // apareceria no painel de rede de quem abrisse as ferramentas, e a
        // página estaria segurando com uma mão e entregando com a outra.
        const dados = apuracaoZerada({
          ufs: UFS,
          cargo: 'presidente',
          turno: 2,
          candidatos: FINALISTAS.map((candidato) => ({
            candidato,
            partido: candidato === FINALISTAS[0] ? 'PL' : 'PT',
          })),
        });
        estado.projecao = projetar(dados);
        estado.fontes = [];
        estado.lidoEm = null;
        estado.exterior = null;
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
      // Se o painel do exterior está aberto, ele acompanha o botão atualizar:
      // deixá-lo com números de dez minutos atrás, ao lado de números novos,
      // seria pior do que não tê-lo.
      if (
        estado.exteriorAberto &&
        estado.modo === 'ao-vivo' &&
        !apuracaoRetida(new Date(), LIBERA_AS)
      ) {
        void carregarExterior();
      }
    }
  }

  /**
   * Lê os 186 postos do exterior e soma por continente.
   *
   * Em simulação não há o que ler: o simulador trabalha sobre os recortes de
   * UF do 1º turno, e não existe simulação posto a posto. A tela diz isso em
   * vez de mostrar uma quebra vazia que pareceria apuração parada.
   */
  async function carregarExterior(): Promise<void> {
    if (estado.modo === 'simulacao') return;
    if (apuracaoRetida(new Date(), LIBERA_AS)) return;
    estado.exteriorCarregando = true;
    desenhar();
    try {
      const { linhas, falhas } = await buscarExterior((url) => fetch(url, { cache: 'no-store' }), {
        eleicao: ELEICOES.federal[2],
        ordem: FINALISTAS,
        nomeCanonico,
      });
      estado.exterior = linhas;
      estado.exteriorFalhas = falhas;
    } catch (e) {
      console.warn('Falha ao ler o exterior posto a posto:', e);
      estado.exterior = null;
    } finally {
      estado.exteriorCarregando = false;
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
    if (estado.modo === 'ao-vivo' && apuracaoRetida(new Date(), LIBERA_AS)) {
      raiz.append(criarAvisoDeEspera());
    }
    raiz.append(criarBigNumbers(p, partidos, estado));
    raiz.append(criarMapaProgresso(p, partidos, estado, desenhar));
    raiz.append(criarPainelExterior(p, partidos, estado, desenhar, carregarExterior));
    raiz.append(criarTabela(p, partidos, estado, desenhar));
    raiz.append(criarFontes(estado));
  }

  // Na hora da liberação a página se atualiza sozinha. Sem isto, quem deixou
  // a aba aberta esperando as 19h continuaria vendo zeros depois delas, e
  // concluiria que a apuração não começou.
  // O despertador se reagenda se acordar cedo: aba em segundo plano tem o
  // temporizador estrangulado pelo navegador, e um disparo único que chegasse
  // adiantado deixaria a página zerada para sempre.
  function agendarLiberacao(): void {
    const espera = faltaParaLiberar(new Date(), LIBERA_AS);
    if (espera <= 0) return;
    window.setTimeout(() => {
      if (apuracaoRetida(new Date(), LIBERA_AS)) {
        agendarLiberacao();
        return;
      }
      if (estado.modo === 'ao-vivo') void atualizar();
    }, espera + 500);
  }
  agendarLiberacao();

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
          ? `${nomearUnidades(p.ufsSemApuracao)} ainda sem seção`
          : 'Todas as unidades já têm seção apurada',
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
      texto: estado.carregando ? 'buscando agora…' : 'horário de Brasília',
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
  // A conta, escrita por extenso.
  //
  // Ela é uma divisão, e dizê-la em vez de descrevê-la muda o que o leitor
  // pode fazer com a página: com a fórmula à vista, qualquer pessoa confere a
  // projeção de qualquer estado com a calculadora do celular, usando dois
  // números que estão na mesma tela. Método que não dá para conferir é
  // promessa; método que dá para refazer é método.
  const formula = criarEl('p', { className: 'ap-proj-formula' });
  formula.append(criarEl('strong', { texto: 'votos contados no estado ÷ fração já computada = votos projetados do estado' }));
  painel.append(formula);

  painel.append(
    criarEl('p', {
      className: 'ap-proj-metodo',
      texto:
        'Um estado com 400 mil votos contados e 40% computado projeta 1 milhão: 400.000 ÷ 0,40. A conta é feita candidato a candidato, dentro de cada UF, com o fator daquela UF — e só depois os estados são somados. É o contrário de extrapolar o percentual nacional, que durante o parcial diz mais sobre a ordem em que os estados totalizam do que sobre o voto. A premissa, que é o que faz disto projeção e não contagem: as seções que faltam no estado se parecem com as que já foram contadas lá.',
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

  // A caixa de cada UF, e a caixa de cada região (união das caixas das UFs
  // dela). A caixa da região é o que faz o preenchimento correr pelo BLOCO
  // inteiro: cortado UF a UF, cada estado ganhava a própria linha de corte e
  // a região virava um listrado — o desenho dizia "cinco listras", não "uma
  // região pela metade".
  const caixaPorUf = new Map(
    mapaBrasil.locations.map((l) => [l.id.toUpperCase(), bboxPath(l.path)] as const),
  );
  const caixaPorRegiao = new Map(
    REGIOES.map((reg) => {
      const caixas = reg.ufs.map((uf) => caixaPorUf.get(uf)).filter((b) => b != null);
      return [
        reg.nome,
        {
          minX: Math.min(...caixas.map((b) => b.minX)),
          maxX: Math.max(...caixas.map((b) => b.maxX)),
          minY: Math.min(...caixas.map((b) => b.minY)),
          maxY: Math.max(...caixas.map((b) => b.maxY)),
        },
      ] as const;
    }),
  );

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
          ? 'Passe o mouse num estado para ver como ele está agora, ou clique para prender a leitura. A cor diz quem lidera na REGIÃO: os estados de um mesmo bloco ganham a mesma cor, e as divisas entre eles ficam fracas. Tudo aqui é soma — os votos de cada candidato são a soma dos estados da região, a projeção é a soma das projeções deles, e o percentual é o que já foi apurado dividido pelo total da região. Região sem nenhuma seção fica cinza e sem líder.'
          : 'Passe o mouse num estado para ver como ele está agora, ou clique para prender a leitura. A cor do estado diz quem lidera ali. Quanto já foi apurado é dito pela barra sob a sigla, que é um medidor e não parte do desenho do país. Estado sem nenhuma seção fica cinza e sem líder: pintar liderança que ninguém mediu seria inventar.'
        : 'Passe o mouse num estado para ver como ele está agora, ou clique para prender a leitura. A cor cheia é de quem lidera, e ela avança da esquerda para a direita conforme as seções entram; o que falta fica hachurado na mesma cor. O número ao lado de cada sigla é o percentual exato — ele existe porque estados pequenos como PB, AL, SE, ES, RJ e DF não têm área suficiente para que uma fração seja lida como número. Quatro críticos cegos leram este desenho como divisão geográfica do estado, e não como andamento; o modo "Cor + medidor" ao lado é a alternativa que eles apontaram, com o polígono em cor cheia respondendo só quem lidera.',
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

  // A dica do mapa. Uma só, reaproveitada por todos os estados: 27 elementos
  // escondidos seriam 27 nós a manter em sincronia com o dado a cada leitura.
  const dica = criarEl('div', {
    className: 'ap-dica',
    attrs: { role: 'tooltip', id: 'ap-dica' },
  });
  dica.hidden = true;

  const linhasPorUf = new Map(montarLinhas(p.porUf, FINALISTAS).map((l) => [l.uf, l]));

  function preencherDica(uf: string): void {
    const regiaoDoEstado = porRegiao ? regiaoDaUf(uf) : null;
    const r = regiaoDoEstado ? regiaoPorNome.get(regiaoDoEstado) : undefined;
    const conteudo = montarDicaDaUf({
      nome: nomePorUf.get(uf) ?? uf,
      linha: linhasPorUf.get(uf) ?? null,
      ordem: FINALISTAS,
      regiao:
        r && regiaoDoEstado
          ? { nome: regiaoDoEstado, processado: r.processado, lider: r.lider }
          : null,
    });

    dica.textContent = '';
    dica.append(criarEl('strong', { className: 'ap-dica-titulo', texto: conteudo.titulo }));
    for (const c of conteudo.candidatos) {
      const linhaC = criarEl('span', { className: 'ap-dica-linha' });
      linhaC.style.setProperty('--cor', corDoCandidatoNoMapa(c.nome));
      linhaC.append(criarEl('span', { className: 'ap-dica-nome', texto: c.nome }));
      linhaC.append(criarEl('span', { className: 'ap-dica-pct', texto: c.pct }));
      linhaC.append(criarEl('span', { className: 'ap-dica-votos', texto: `${c.votos} votos` }));
      dica.append(linhaC);
    }
    dica.append(criarEl('span', { className: 'ap-dica-proc', texto: conteudo.processado }));
    if (conteudo.nota) dica.append(criarEl('span', { className: 'ap-dica-nota', texto: conteudo.nota }));
  }

  /** A cor de cada finalista pelo nome curto, para a dica casar com o mapa. */
  function corDoCandidatoNoMapa(nomeCurtoDoCandidato: string): string {
    const inteiro = FINALISTAS.find((n) => nomeCurto(n) === nomeCurtoDoCandidato);
    const partido = inteiro
      ? p.porUf.flatMap((u) => u.candidatos).find((c) => c.candidato === inteiro)?.partido ?? null
      : null;
    return tokenFillEspectro(resolverEspectro(partido, partidos));
  }

  function posicionarDica(x: number, y: number): void {
    const margem = 14;
    const largura = dica.offsetWidth || 190;
    const altura = dica.offsetHeight || 96;
    let left = x + margem;
    if (left + largura > window.innerWidth) left = x - margem - largura;
    let top = y + margem;
    if (top + altura > window.innerHeight) top = y - margem - altura;
    dica.style.left = `${Math.max(0, Math.min(left, window.innerWidth - largura))}px`;
    dica.style.top = `${Math.max(0, Math.min(top, window.innerHeight - altura))}px`;
  }

  /**
   * A dica pode ficar PRESA num estado.
   *
   * Passar o mouse responde de relance e some quando o mouse sai, o que serve
   * para varrer o mapa mas não para ler com calma nem para comparar — e no
   * celular não existe "passar o mouse": o toque abre e o próximo toque em
   * qualquer lugar fechava. Clicar prende a leitura naquele estado: ela para
   * de seguir o cursor, sobrevive a sair do mapa, e só sai com um novo clique
   * no mesmo estado, um clique fora, ou Esc.
   *
   * Enquanto está presa, passar o mouse por outro estado NÃO troca o conteúdo
   * — seria o contrário de prender. Clicar em outro estado, sim: a intenção
   * de clicar é inequívoca.
   */
  let ufPresa: string | null = null;

  function marcarPresa(): void {
    for (const g of svg.querySelectorAll('g[data-uf]')) {
      g.classList.toggle('is-presa', g.getAttribute('data-uf') === ufPresa);
    }
  }

  function mostrarDica(uf: string, x: number, y: number): void {
    preencherDica(uf);
    if (ufPresa === uf) {
      dica.append(
        criarEl('span', { className: 'ap-dica-presa', texto: 'presa — clique de novo ou Esc para soltar' }),
      );
    }
    dica.hidden = false;
    posicionarDica(x, y);
  }

  function esconderDica(): void {
    if (ufPresa != null) return;
    dica.hidden = true;
  }

  function soltar(): void {
    ufPresa = null;
    marcarPresa();
    dica.hidden = true;
  }

  function alternarPresa(uf: string, alvo: Element): void {
    if (ufPresa === uf) {
      soltar();
      return;
    }
    ufPresa = uf;
    marcarPresa();
    const r = alvo.getBoundingClientRect();
    mostrarDica(uf, r.left + r.width / 2, r.top + r.height / 2);
  }

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
      // No recorte por região o corte é medido na caixa da REGIÃO, não na do
      // estado: é o que faz o avanço atravessar o bloco como uma coisa só.
      const caixaDoCorte = (porRegiao ? caixaPorRegiao.get(area.nome) : undefined) ?? bbox;
      const corte = caixaDoCorte.minX + (caixaDoCorte.maxX - caixaDoCorte.minX) * fracao;
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
      rect.setAttribute('x', String(caixaDoCorte.minX));
      rect.setAttribute('y', String(bbox.minY - 1));
      rect.setAttribute('width', String(Math.max(0, corte - caixaDoCorte.minX)));
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
    //
    // O medidor é desenhado nos DOIS modos de mapa, e não só no que leva o
    // nome dele: é o que cobre PB, AL, SE, ES, RJ e DF, pequenos demais para
    // que uma fração de ÁREA seja lida como número. No preenchimento, o
    // desenho responde "mais ou menos quanto" e o número ao lado da sigla
    // responde "exatamente quanto".
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

    // Mouse, teclado e toque. O `aria-label` do grupo já descreve o estado
    // para leitor de tela, então a dica é reforço visual e fica `aria-hidden`
    // pelo CSS do papel `tooltip` ligado por `aria-describedby`.
    grupo.setAttribute('tabindex', '0');
    grupo.setAttribute('data-uf', uf);
    grupo.setAttribute('aria-describedby', 'ap-dica');
    grupo.addEventListener('pointerenter', (e) => {
      if (ufPresa != null) return;
      const ev = e as PointerEvent;
      mostrarDica(uf, ev.clientX, ev.clientY);
    });
    grupo.addEventListener('pointermove', (e) => {
      if (ufPresa != null) return;
      const ev = e as PointerEvent;
      if (!dica.hidden) posicionarDica(ev.clientX, ev.clientY);
    });
    grupo.addEventListener('pointerleave', esconderDica);
    grupo.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarPresa(uf, grupo);
    });
    grupo.addEventListener('focus', () => {
      if (ufPresa != null) return;
      const r = grupo.getBoundingClientRect();
      mostrarDica(uf, r.left + r.width / 2, r.top + r.height / 2);
    });
    grupo.addEventListener('blur', esconderDica);
    grupo.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        alternarPresa(uf, grupo);
      } else if (ev.key === 'Escape' && ufPresa != null) {
        ev.preventDefault();
        soltar();
      }
    });

    svg.append(grupo);
  }

  // Um rótulo por região, no centro de massa dos estados dela.
  //
  // Centro de massa, e não média simples dos centros: o Norte tem o Amazonas
  // e o Amapá, e uma média simples puxaria o rótulo do Norte para um canto
  // onde ele não descreve a região. A área da caixa de cada UF é a melhor
  // aproximação de peso disponível aqui, já que o mapa não traz área real.
  if (porRegiao) {
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
  wrap.append(dica);
  wrap.append(svg);
  wrap.addEventListener('pointerleave', esconderDica);
  // Clicar no mapa fora de qualquer estado solta a dica presa. É o gesto que
  // as pessoas tentam primeiro para fechar, e no celular é o único que sobra.
  wrap.addEventListener('click', () => {
    if (ufPresa != null) soltar();
  });
  // Esc também, com o foco em qualquer lugar do mapa.
  wrap.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && ufPresa != null) soltar();
  });
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
    // O exterior é a sexta linha deste recorte, mas não é uma região nem uma
    // UF: contá-lo como "1 UFs" seria errado de duas maneiras na mesma frase.
    const ehExterior = l.regiao === 'Exterior';
    cabeca.append(
      criarEl('span', {
        className: 'ap-linha-nota',
        texto: ehExterior
          ? '186 postos, 1.351 seções'
          : l.ufsSemApuracao.length > 0
            ? `${l.ufs.length - l.ufsSemApuracao.length} de ${l.ufs.length} UFs · sem seção: ${l.ufsSemApuracao.join(', ')}`
            : `${l.ufs.length} UFs`,
      }),
    );
  } else {
    // 'ZZ' é o código do TSE para o exterior e não diz nada a quem lê.
    cabeca.append(
      criarEl('span', { className: 'ap-linha-nome', texto: l.uf === 'ZZ' ? NOME_EXTERIOR : l.uf }),
    );
    if (l.uf === 'ZZ') {
      cabeca.append(criarEl('span', { className: 'ap-linha-nota', texto: '186 postos, 1.351 seções' }));
    }
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

/* ─────────────────────── o exterior, por continente ────────────────────── */

/**
 * O exterior tem geografia própria, e ela é informativa: no 1º turno de 2026
 * o voto de fora foi para Lula (47,57% x 43,49%), ao contrário do país. Mas
 * ele não cabe no mapa do Brasil — não tem polígono —, então vem como painel
 * ao lado dele, em caixas pequenas, uma por continente.
 *
 * O painel é FECHADO por padrão porque abri-lo custa 186 requisições, uma por
 * posto, já que o TSE publica a quebra do exterior cidade a cidade e nada
 * mais: nem país, nem continente. O total do exterior não depende disso — ele
 * já entra na projeção nacional pelo recorte `zz`, fechado, de graça.
 */
function criarPainelExterior(
  p: Projecao,
  partidos: readonly Partido[],
  estado: Estado,
  redesenhar: () => void,
  carregar: () => Promise<void>,
): HTMLElement {
  const sec = criarEl('section', { className: 'ap-ext' });

  const topo = criarEl('div', { className: 'ap-ext-topo' });
  topo.append(criarEl('h2', { className: 'ap-h2', texto: 'Voto no exterior' }));

  const zz = p.porUf.find((u) => u.uf === 'ZZ');
  const resumo = criarEl('p', { className: 'ap-ext-resumo' });
  if (zz && !semDado({ processado: zz.secoesTotalizadas })) {
    const m = margemApurada({
      porCandidato: FINALISTAS.map((nome) => {
        const c = zz.candidatos.find((x) => x.candidato === nome);
        return {
          candidato: nome,
          pct: 0,
          votosApurados: c?.votosApurados ?? 0,
          votosProjetados: c?.votosProjetados ?? 0,
        };
      }),
    });
    resumo.textContent =
      m.lider == null
        ? `${formatarPct(zz.secoesTotalizadas)} apurado, sem líder ainda.`
        : `${formatarPct(zz.secoesTotalizadas)} apurado · ${nomeCurto(m.lider)} à frente por ${formatarInt(Math.abs(m.votos))} votos.`;
  } else {
    resumo.textContent = `916.683 eleitores aptos em 1.351 seções, distribuídas por 186 postos. ${
      zz ? 'Nenhuma seção apurada ainda.' : 'Sem leitura do exterior nesta rodada.'
    }`;
  }
  topo.append(resumo);

  const botao = criarEl('button', {
    className: 'ap-btn-secundario',
    texto: estado.exteriorAberto ? 'Esconder os continentes' : 'Abrir por continente',
    attrs: { type: 'button', 'aria-expanded': String(estado.exteriorAberto) },
  });
  if (estado.modo === 'ao-vivo' && apuracaoRetida(new Date(), LIBERA_AS)) {
    botao.disabled = true;
    botao.textContent = `Por continente, a partir das ${LIBERA_AS}h`;
  }
  botao.addEventListener('click', () => {
    estado.exteriorAberto = !estado.exteriorAberto;
    if (
      estado.exteriorAberto &&
      estado.exterior == null &&
      estado.modo === 'ao-vivo' &&
      !apuracaoRetida(new Date(), LIBERA_AS)
    ) {
      void carregar();
      return;
    }
    redesenhar();
  });
  topo.append(botao);
  sec.append(topo);

  // As parciais de imprensa, SÓ enquanto o TSE não publica e SÓ ao vivo.
  //
  // Elas somam boletins de urna que o próprio TSE disponibiliza, antes de a
  // totalização começar — não são boato, mas também não são a apuração. Ficam
  // num bloco à parte, com o horário e o veículo de cada leitura, e somem
  // sozinhas no instante em que a primeira seção do exterior é totalizada: a
  // partir dali existe número oficial, e manter a estimativa ao lado dele só
  // criaria dúvida sobre qual dos dois ler.
  // Durante a espera, o bloco de imprensa também fica de fora. Segurar a
  // apuração e ao lado publicar "Lula 133 mil × Flávio 89 mil" seria segurar
  // com uma mão e entregar com a outra — e a parcial de imprensa é número de
  // voto como qualquer outro.
  const totalizacaoComecou = zz != null && !semDado({ processado: zz.secoesTotalizadas });
  if (estado.modo === 'ao-vivo' && !totalizacaoComecou && !apuracaoRetida(new Date(), LIBERA_AS)) {
    sec.append(criarParciaisDeImprensa());
  }

  if (!estado.exteriorAberto) return sec;

  if (estado.modo === 'simulacao') {
    sec.append(
      criarEl('p', {
        className: 'ap-meta',
        texto:
          'A quebra por continente não é simulada. O simulador trabalha sobre os recortes de UF do 1º turno — o exterior inteiro é um deles —, e não existe simulação posto a posto. Em "Ao vivo (TSE)" o painel lê os 186 postos de verdade.',
      }),
    );
    return sec;
  }

  if (estado.exteriorCarregando || estado.exterior == null) {
    sec.append(
      criarEl('p', {
        className: 'ap-meta',
        texto: estado.exteriorCarregando
          ? 'Lendo os 186 postos do exterior, um arquivo cada…'
          : 'Não consegui ler os postos agora. Feche e abra o painel para tentar de novo.',
      }),
    );
    return sec;
  }

  const partidoPorCandidato = partidosDaProjecao(p);
  const corDoCandidato = (nome: string | null): string =>
    tokenFillEspectro(resolverEspectro(nome ? partidoPorCandidato.get(nome) ?? null : null, partidos));

  const grade = criarEl('div', { className: 'ap-ext-grade' });
  for (const linha of estado.exterior) {
    grade.append(criarCaixaContinente(linha, corDoCandidato));
  }
  sec.append(grade);

  sec.append(
    criarEl('p', {
      className: 'ap-meta',
      texto:
        estado.exteriorFalhas > 0
          ? `${estado.exteriorFalhas} de ${estado.exterior.reduce((s, l) => s + l.postos, 0)} postos não responderam e ficaram de fora desta leitura — o continente deles aparece com menos voto do que tem.`
          : `Todos os ${estado.exterior.reduce((s, l) => s + l.postos, 0)} postos responderam. O percentual de cada continente é seções totalizadas sobre seções existentes, somadas: não é média dos postos, que entre Tóquio e Artigas daria outro número. Aqui não há projeção — o exterior já entra projetado no total nacional, e esta quebra só descreve onde o voto está sendo contado.`,
    }),
  );
  return sec;
}

/** Uma caixinha de continente: cor de quem lidera e quanto já foi apurado. */
function criarCaixaContinente(
  linha: LinhaContinente,
  corDoCandidato: (nome: string | null) => string,
): HTMLElement {
  const caixa = criarEl('div', { className: 'ap-ext-caixa' });
  const semVoto = linha.lider == null;
  caixa.style.setProperty(
    '--cor',
    semVoto ? 'var(--spectrum-indefinido)' : corDoCandidato(linha.lider),
  );

  caixa.append(criarEl('p', { className: 'ap-ext-nome', texto: linha.continente }));
  caixa.append(
    criarEl('p', {
      className: 'ap-ext-lider',
      texto: semVoto ? 'sem seção apurada' : nomeCurto(linha.lider ?? ''),
    }),
  );

  const trilho = criarEl('div', { className: 'ap-ext-barra' });
  const nivel = criarEl('i', { className: 'ap-ext-barra-fill' });
  nivel.style.width = `${fracaoDaBarra(linha.processado) * 100}%`;
  trilho.append(nivel);
  caixa.append(trilho);

  caixa.append(
    criarEl('p', {
      className: 'ap-ext-meta',
      texto: `${formatarPct(linha.processado)} · ${linha.postosLidos} de ${linha.postos} postos`,
    }),
  );
  if (!semVoto) {
    const votos = [...linha.votos].sort((a, b) => b.votos - a.votos);
    caixa.append(
      criarEl('p', {
        className: 'ap-ext-votos',
        texto: votos.map((v) => `${nomeCurto(v.candidato)} ${formatarInt(v.votos)}`).join(' · '),
      }),
    );
  }
  return caixa;
}

/**
 * O bloco das parciais de imprensa.
 *
 * Ele é deliberadamente feio de ler como manchete: três leituras, três
 * horários, bases diferentes, e a mais antiga contradizendo as outras duas.
 * Isso não é defeito de apresentação — é o estado real da informação neste
 * momento, e achatar as três numa só linha seria escolher uma delas sem ter
 * motivo para escolher. A contradição fica à vista porque ela é o próprio
 * aviso de que ainda não há resultado.
 */
function criarParciaisDeImprensa(): HTMLElement {
  const bloco = criarEl('section', { className: 'ap-imprensa' });

  const topo = criarEl('div', { className: 'ap-imprensa-topo' });
  topo.append(
    criarEl('h3', { className: 'ap-imprensa-titulo', texto: 'Enquanto o TSE não publica' }),
  );
  topo.append(
    criarEl('span', { className: 'ap-proj-selo', texto: 'imprensa, não é a apuração' }),
  );
  bloco.append(topo);

  bloco.append(
    criarEl('p', {
      className: 'ap-imprensa-nota',
      texto:
        'A divulgação oficial do TSE ainda marca zero seção totalizada nos 186 postos do exterior, Tóquio e Sydney inclusive, que votaram horas atrás. Estes veículos somaram por conta própria os boletins de urna que o TSE disponibiliza. São fotografias de horários diferentes: não se comparam entre si, não se somam, e nada daqui entra em projeção, big number ou mapa.',
    }),
  );

  const lista = criarEl('ul', { className: 'ap-imprensa-lista' });
  for (const leitura of parciaisImprensa.leituras) {
    const item = criarEl('li', { className: 'ap-imprensa-item' });

    const cabeca = criarEl('p', { className: 'ap-imprensa-cabeca' });
    const link = criarEl('a', {
      texto: leitura.veiculo,
      attrs: { href: leitura.url, target: '_blank', rel: 'noopener noreferrer' },
    });
    cabeca.append(link);
    cabeca.append(criarEl('span', { className: 'ap-imprensa-hora', texto: ` · ${leitura.hora}` }));
    cabeca.append(criarEl('span', { className: 'ap-imprensa-base', texto: ` · base: ${leitura.base}` }));
    item.append(cabeca);

    const numeros = criarEl('p', { className: 'ap-imprensa-numeros' });
    numeros.textContent = leitura.candidatos
      .map(
        (c) =>
          `${nomeCurto(c.candidato)} ${formatarInt(c.votos)}${c.pct == null ? '' : ` (${formatarPct(c.pct, 1)})`}`,
      )
      .join('  ·  ');
    item.append(numeros);

    item.append(criarEl('p', { className: 'ap-imprensa-detalhe', texto: leitura.nota }));
    lista.append(item);
  }
  bloco.append(lista);

  bloco.append(
    criarEl('p', {
      className: 'ap-imprensa-nota',
      texto: `Capturado às ${horaCurta(parciaisImprensa.capturadoEm)}. Este bloco desaparece sozinho assim que a primeira seção do exterior for totalizada — a partir dali há número oficial, e é ele que vale.`,
    }),
  );
  return bloco;
}

/**
 * O aviso de que a apuração está retida.
 *
 * Ele existe porque a alternativa — zeros sem explicação — é pior do que não
 * mostrar nada: um mapa inteiro cinza às 18h se lê como falha da página ou
 * como "ninguém votou", e as duas conclusões são falsas. O aviso diz o que
 * está acontecendo, a partir de quando muda, e que a espera é escolha de quem
 * publica, não impedimento do TSE.
 */
function criarAvisoDeEspera(): HTMLElement {
  const aviso = criarEl('section', { className: 'ap-espera', attrs: { role: 'status' } });
  aviso.append(
    criarEl('p', {
      className: 'ap-espera-titulo',
      texto: `A apuração aparece aqui a partir das ${LIBERA_AS}h`,
    }),
  );
  aviso.append(
    criarEl('p', {
      className: 'ap-espera-texto',
      texto:
        'Até lá a página fica zerada de propósito. Não é falha nem ausência de dado: é escolha de quem publica. Nada está sendo lido do TSE enquanto isso — nem por baixo —, e na hora a página se atualiza sozinha, sem precisar recarregar. Para ver a mecânica funcionando antes disso, use o modo Simulação, que trabalha sobre o resultado real do 1º turno.',
    }),
  );
  return aviso;
}
