import type { Disputa } from './race.js';
import {
  type Pesquisa,
  type RegistroTSE,
  dataReferencia,
  normalizarLinhaNaoCandidato,
} from './poll.js';

/**
 * Serviço de domínio: agregação ponderada de pesquisas de uma mesma Disputa.
 * Puro — sem I/O, sem dependência de partidos (espectro é resolvido por quem
 * consome o resultado, ex.: senate.ts, que tem acesso à lista de partidos).
 */

export const CANDIDATOS_EXCLUIDOS_PADRAO: readonly string[] = [
  'brancos/nulos',
  'não sabe',
  'nenhum',
  'não respondeu',
  'outros',
];

/**
 * Verdadeiro quando a linha de resultado não representa um candidato: ou o
 * nome está na lista de exclusão do recorte, ou o rótulo cai em uma das
 * categorias canônicas de não-candidato (`normalizarLinhaNaoCandidato`, em
 * `poll.ts` — brancos, nulos, nenhum, indecisos, "não sabe", "não respondeu",
 * "outros", cenário espontâneo).
 */
export function ehLinhaNaoCandidato(candidato: string, excluidos: ReadonlySet<string>): boolean {
  const chave = candidato.toLowerCase().trim();
  if (excluidos.has(chave)) return true;
  return normalizarLinhaNaoCandidato(candidato) !== null;
}

/**
 * Nível de confiança da liderança nas 3 faixas de docs/design-system.md,
 * calculado a partir da vantagem (pontos) sobre o 2º colocado e da margem de
 * referência ponderada. Usado tanto pelo agregado presidencial/governador
 * quanto pelas cadeiras projetadas do Senado (`domain/senate.ts`).
 */
export type NivelConfianca = 'folga' | 'acirrada' | 'empate';

/**
 * Tolerância das comparações contra a margem de referência.
 *
 * `margemReferencia` é média PONDERADA das margens declaradas, e com uma
 * única pesquisa de margem 3 a conta (3·peso)/peso devolve
 * 2.9999999999999996 em binário. Sem epsilon, uma vantagem de exatamente 3
 * pontos deixa de ser empate técnico — foi o que aconteceu com o governo do
 * RN (45 x 42, margem 3), o 2º turno estadual mais apertado.
 *
 * Está exportada e não privada porque a MESMA comparação aparece em cinco
 * lugares — aqui, no empate técnico, na projeção do Senado, na faixa de
 * vantagem do mapa presidencial e no nível de confiança da camada de
 * apresentação. Quando só o empate técnico foi corrigido, a cor do mapa
 * passou a dizer "corrida acirrada" na mesma UF em que o texto dizia "empate
 * técnico": a classificação e o rótulo vinham por caminhos diferentes. Um
 * epsilon só, importado por todos, é o que impede as duas vias de divergir.
 */
export const EPSILON_MARGEM = 1e-9;

/**
 * Classifica a confiança da liderança: `empate` quando a vantagem está
 * dentro da margem de referência, `acirrada` quando a supera mas fica abaixo
 * do dobro da margem, `folga` quando é igual ou maior que o dobro.
 */
export function classificarConfianca(vantagem: number, margemReferencia: number): NivelConfianca {
  if (vantagem <= margemReferencia + EPSILON_MARGEM) return 'empate';
  if (vantagem < margemReferencia * 2) return 'acirrada';
  return 'folga';
}

export const JANELA_DIAS_PADRAO = 45;
export const MEIA_VIDA_DIAS_PADRAO = 14;
export const MARGEM_REFERENCIA_PADRAO = 3.0;
const AMOSTRA_PADRAO = 1000;

export interface OpcoesAgregacao {
  /** Janela de recência em dias. Padrão 45. */
  janelaDias?: number;
  /** Meia-vida do peso por recência, em dias. Padrão 14. */
  meiaVidaDias?: number;
  /** Nomes de "candidato" a excluir do ranking (case-insensitive). Padrão: brancos/nulos, não sabe, nenhum, não respondeu, outros. */
  excluirCandidatos?: readonly string[];
}

export interface CandidatoAgregado {
  readonly candidato: string;
  readonly partido: string | null;
  /** Percentual médio ponderado (0..100). */
  readonly pct: number;
  /** Quantidade de pesquisas usadas que incluíram este candidato. */
  readonly pesquisas: number;
}

export interface Agregado {
  readonly disputa: Disputa;
  readonly lider: CandidatoAgregado | null;
  readonly segundo: CandidatoAgregado | null;
  /** Diferença de pct entre líder e segundo colocado (0 se não houver segundo). */
  readonly vantagem: number;
  readonly empateTecnico: boolean;
  readonly margemReferencia: number;
  /** Candidatos no ranking (exclui as linhas de brancos/nulos/etc.), ordenados por pct desc. */
  readonly candidatos: readonly CandidatoAgregado[];
  /**
   * Linhas ignoradas do ranking, mesma agregação ponderada, já reduzidas às
   * categorias canônicas de `normalizarLinhaNaoCandidato` (`poll.ts`): as
   * grafias "Brancos/nulos", "Não sabe", "Nenhum/Brancos/nulos",
   * "Brancos/nulos/não sabe"... viram UMA linha "Brancos/nulos/não sabe", e
   * "Outros"/"Outros candidatos (...)" viram "Outros candidatos".
   *
   * `pesquisas` de cada categoria conta quantas das `pesquisasUsadas` a
   * publicaram — pode ser menor que `pesquisasUsadas.length`, e aí a soma
   * `candidatos` + `outros` não fecha 100: as pesquisas que não publicam a
   * quebra não são completadas com estimativa (caso do CE no 2º turno, em que
   * só 1 das 3 pesquisas do confronto publica a linha). Quem exibe deve dizer
   * de quantas pesquisas o número vem, não somar como se fosse de todas.
   */
  readonly outros: readonly CandidatoAgregado[];
  readonly pesquisasUsadas: readonly Pesquisa[];
  readonly ultimaPesquisa: Pesquisa;
  readonly algumaNaoRegistrada: boolean;
  /** true quando nenhuma pesquisa caiu dentro da janela e a mais recente disponível foi usada mesmo assim. */
  readonly foraDaJanela: boolean;
  /**
   * Pesquisas descartadas por estarem em BASE diferente da que o agregado
   * fala. O agregado usa o percentual cru, que é base de totais; uma rodada
   * publicada só em válidos traz números de 50 e poucos para uma média de 40
   * e poucos, e entraria inflando o resultado sem que nada acusasse.
   *
   * Converter válidos -> totais é impossível sem o bloco de brancos/nulos, que
   * a fonte não publicou; converter o resto para válidos mudaria todos os
   * números que o projeto publica. Então a ficha fica de fora e é DECLARADA
   * aqui, para a tela poder dizer quantas e quais — descarte silencioso é
   * justamente o que esta lista existe para impedir.
   */
  readonly descartadasPorBase: readonly Pesquisa[];
}

/** Idade em dias inteiros de uma data ISO (YYYY-MM-DD) em relação a `hoje`, calculada em UTC. */
function idadeEmDias(dataIso: string, hoje: Date): number {
  const dataMs = Date.parse(`${dataIso}T00:00:00Z`);
  const hojeMs = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return (hojeMs - dataMs) / 86_400_000;
}

function pesoRecenciaEAmostra(pesquisa: Pesquisa, hoje: Date, meiaVidaDias: number): number {
  const idadeDias = Math.max(0, idadeEmDias(dataReferencia(pesquisa), hoje));
  const pesoRecencia = Math.exp((-Math.LN2 * idadeDias) / meiaVidaDias);
  const pesoAmostra = Math.sqrt(pesquisa.amostra ?? AMOSTRA_PADRAO);
  return pesoRecencia * pesoAmostra;
}

interface Acumulador {
  candidato: string;
  partido: string | null;
  somaPesoPct: number;
  somaPeso: number;
  pesquisas: number;
  /** true quando a chave veio de linhas que não são candidato (vai para `outros`). */
  naoCandidato: boolean;
}

/** Uma linha de resultado já reduzida ao rótulo com que entra na agregação. */
interface LinhaAgregavel {
  rotulo: string;
  partido: string | null;
  pct: number;
}

/**
 * Reduz os resultados de UMA pesquisa às linhas que entram na agregação:
 * candidatos passam intactos e as linhas de não-candidato são convertidas para
 * a categoria canônica (`normalizarLinhaNaoCandidato`) e SOMADAS dentro da
 * pesquisa.
 *
 * É essa soma dentro da pesquisa que conserta a aritmética entre pesquisas: a
 * Real Time Big Data publica "Brancos/nulos" 5,0 e "Não sabe" 4,0 (= 9,0) e a
 * AtlasIntel publica "Brancos/nulos/não sabe" 9,4; reduzidas à mesma categoria,
 * as duas contribuem com UM valor comparável (9,0 e 9,4) para a mesma média
 * ponderada, em vez de virarem três linhas independentes somando 18,4 pontos.
 * Nada é estimado: pesquisa que não publica a quebra não entra no denominador
 * da categoria (é o que `CandidatoAgregado.pesquisas` reporta).
 */
/**
 * Em que base os percentuais de uma pesquisa estão expressos.
 *
 * - `'totais'`: sobre todos os entrevistados; brancos, nulos e indecisos
 *   aparecem como linhas e entram no denominador.
 * - `'validos'`: só sobre quem declarou voto em candidato; os candidatos
 *   somam ~100 sozinhos.
 */
export type BaseDoPercentual = 'totais' | 'validos';

/** Folga, em pontos, para a soma dos candidatos ser lida como "fecha em 100". */
const TOLERANCIA_SOMA_VALIDOS = 1.2;

/**
 * Margem contra erro de ponto flutuante na comparação com a tolerância.
 * Sem ela, uma lista que soma 98,8 — escrita assim pela fonte, e exatamente
 * no limite — cai fora por 2,8e-15: `50 + 48.8 - 100` dá 1,2000000000000028
 * em binário, não 1,2.
 */
const EPSILON_SOMA = 1e-9;

/**
 * Infere a base de uma pesquisa das suas PRÓPRIAS linhas, sem campo novo no
 * schema: lista que soma ~100 **sem nenhuma linha de não-candidato** é base de
 * válidos; qualquer outra é base de totais.
 *
 * É a regra que o projeto já usava para ler uma fonte, agora executável. Note
 * que ela é conservadora de propósito: uma pesquisa de totais em que os
 * candidatos por acaso somem 100 sem brancos/nulos publicados não existe na
 * prática (o corte total só é identificável pelas linhas publicadas), e na
 * dúvida o lado seguro é `'totais'`, que é a base em que o agregado fala.
 */
export function baseDaPesquisa(
  pesquisa: Pesquisa,
  excluidos: ReadonlySet<string> = new Set(
    CANDIDATOS_EXCLUIDOS_PADRAO.map((s) => s.toLowerCase().trim()),
  ),
): BaseDoPercentual {
  let somaCandidatos = 0;
  let temNaoCandidato = false;
  for (const r of pesquisa.resultados) {
    if (ehLinhaNaoCandidato(r.candidato, excluidos)) {
      temNaoCandidato = true;
      continue;
    }
    somaCandidatos += r.pct;
  }
  if (temNaoCandidato) return 'totais';
  return Math.abs(somaCandidatos - 100) <= TOLERANCIA_SOMA_VALIDOS + EPSILON_SOMA
    ? 'validos'
    : 'totais';
}

/**
 * Separa um conjunto de pesquisas pela base, aplicando a regra de mistura.
 *
 * Existe como função própria porque o filtro é necessário em DOIS lugares que
 * não compartilham caminho: `agregarPesquisas`, que produz o número de hoje, e
 * `serieTemporal`/`mediaBilateral`, que produz a linha do gráfico. A primeira
 * versão protegeu só o agregado, e a série temporal — a média móvel que a tela
 * desenha — continuou somando bases diferentes. Duas cópias divergentes da
 * mesma regra é como esse defeito voltaria.
 */
export function separarPorBase(
  pesquisas: readonly Pesquisa[],
  excluidos: ReadonlySet<string>,
): { usadas: Pesquisa[]; descartadas: Pesquisa[] } {
  const bases = pesquisas.map((p) => baseDaPesquisa(p, excluidos));
  const mistura = bases.includes('totais') && bases.includes('validos');
  const usadas: Pesquisa[] = [];
  const descartadas: Pesquisa[] = [];
  for (let i = 0; i < pesquisas.length; i++) {
    const p = pesquisas[i]!;
    if (mistura && bases[i] === 'validos') descartadas.push(p);
    else usadas.push(p);
  }
  return { usadas, descartadas };
}

function linhasAgregaveis(
  pesquisa: Pesquisa,
  excluidos: ReadonlySet<string>,
): { candidatos: LinhaAgregavel[]; naoCandidatos: LinhaAgregavel[] } {
  const candidatos: LinhaAgregavel[] = [];
  const porCategoria = new Map<string, LinhaAgregavel>();
  for (const r of pesquisa.resultados) {
    if (!ehLinhaNaoCandidato(r.candidato, excluidos)) {
      candidatos.push({ rotulo: r.candidato, partido: r.partido, pct: r.pct });
      continue;
    }
    // Rótulo desconhecido (ex.: nome excluído via `excluirCandidatos`) fica com
    // o rótulo original — nunca é forçado dentro de uma categoria canônica.
    const rotulo = normalizarLinhaNaoCandidato(r.candidato) ?? r.candidato.trim();
    const atual = porCategoria.get(rotulo.toLowerCase());
    if (atual) {
      atual.pct += r.pct;
      if (atual.partido === null) atual.partido = r.partido;
    } else {
      porCategoria.set(rotulo.toLowerCase(), { rotulo, partido: r.partido, pct: r.pct });
    }
  }
  return { candidatos, naoCandidatos: [...porCategoria.values()] };
}

/**
 * Agrega pesquisas de uma mesma Disputa em um resultado ponderado.
 * Assume que todas as pesquisas em `pesquisas` pertencem à mesma Disputa
 * (é responsabilidade de quem chama filtrar por uf/cargo/turno/cenário).
 * Retorna null quando não há nenhuma pesquisa.
 */
export function agregarPesquisas(
  pesquisas: readonly Pesquisa[],
  opcoes: OpcoesAgregacao = {},
  hoje: Date = new Date(),
): Agregado | null {
  if (pesquisas.length === 0) return null;

  const janelaDias = opcoes.janelaDias ?? JANELA_DIAS_PADRAO;
  const meiaVidaDias = opcoes.meiaVidaDias ?? MEIA_VIDA_DIAS_PADRAO;
  const excluidos = new Set(
    (opcoes.excluirCandidatos ?? CANDIDATOS_EXCLUIDOS_PADRAO).map((s) => s.toLowerCase().trim()),
  );

  const ordenadas = [...pesquisas].sort((a, b) =>
    dataReferencia(b).localeCompare(dataReferencia(a)),
  );
  const maisRecente = ordenadas[0]!;

  const dentroDaJanela = ordenadas.filter(
    (p) => idadeEmDias(dataReferencia(p), hoje) <= janelaDias,
  );

  let candidatasDaJanela: Pesquisa[];
  let foraDaJanela: boolean;
  if (dentroDaJanela.length > 0) {
    candidatasDaJanela = dentroDaJanela;
    foraDaJanela = false;
  } else {
    candidatasDaJanela = [maisRecente];
    foraDaJanela = true;
  }

  // O agregado fala em percentual CRU. Isso só é um problema quando a janela
  // MISTURA bases: um conjunto homogêneo é internamente consistente, seja ele
  // de totais ou de válidos, e o agregado simplesmente fala na base dele.
  // Misturado, não — um 52 de válidos entre números de totais de 42 a 51 puxa
  // a média para cima sem que nada acuse.
  //
  // Quando mistura, fica a base de TOTAIS: é a de 832 das 836 pesquisas da
  // base, e converter válidos -> totais é impossível (exigiria o bloco de
  // brancos/nulos que a fonte não publicou), enquanto converter o resto para
  // válidos mudaria todo número que o projeto publica. O descarte é declarado
  // em `descartadasPorBase`, nunca silencioso.
  const { usadas, descartadas: descartadasPorBase } = separarPorBase(
    candidatasDaJanela,
    excluidos,
  );

  const disputa = usadas[0]!.disputa;

  const acumulado = new Map<string, Acumulador>();
  const acumular = (linha: LinhaAgregavel, peso: number, naoCandidato: boolean): void => {
    const chave = linha.rotulo.toLowerCase().trim();
    const atual = acumulado.get(chave) ?? {
      candidato: linha.rotulo,
      partido: linha.partido,
      somaPesoPct: 0,
      somaPeso: 0,
      pesquisas: 0,
      naoCandidato,
    };
    atual.somaPesoPct += peso * linha.pct;
    atual.somaPeso += peso;
    atual.pesquisas += 1;
    if (atual.partido === null && linha.partido !== null) atual.partido = linha.partido;
    acumulado.set(chave, atual);
  };
  for (const p of usadas) {
    const peso = pesoRecenciaEAmostra(p, hoje, meiaVidaDias);
    const linhas = linhasAgregaveis(p, excluidos);
    for (const linha of linhas.candidatos) acumular(linha, peso, false);
    for (const linha of linhas.naoCandidatos) acumular(linha, peso, true);
  }

  const candidatos: CandidatoAgregado[] = [];
  const outros: CandidatoAgregado[] = [];
  for (const acc of acumulado.values()) {
    const item: CandidatoAgregado = {
      candidato: acc.candidato,
      partido: acc.partido,
      pct: acc.somaPeso > 0 ? acc.somaPesoPct / acc.somaPeso : 0,
      pesquisas: acc.pesquisas,
    };
    if (acc.naoCandidato) {
      outros.push(item);
    } else {
      candidatos.push(item);
    }
  }
  candidatos.sort((a, b) => b.pct - a.pct);
  outros.sort((a, b) => b.pct - a.pct);

  const lider = candidatos[0] ?? null;
  const segundo = candidatos[1] ?? null;
  const vantagem = lider ? lider.pct - (segundo?.pct ?? 0) : 0;

  const margens: { margem: number; peso: number }[] = usadas
    .filter((p) => p.margem != null)
    .map((p) => ({ margem: p.margem as number, peso: pesoRecenciaEAmostra(p, hoje, meiaVidaDias) }));
  const somaPesoMargens = margens.reduce((s, m) => s + m.peso, 0);
  const margemReferencia =
    somaPesoMargens > 0
      ? margens.reduce((s, m) => s + m.margem * m.peso, 0) / somaPesoMargens
      : MARGEM_REFERENCIA_PADRAO;

  /** Ver EPSILON_MARGEM: sem ele, 3 pontos de vantagem com margem 3 não é empate. */
  const empateTecnico = vantagem <= margemReferencia + EPSILON_MARGEM;
  const algumaNaoRegistrada = usadas.some((p) => p.registroTSE.naoRegistrada);

  return {
    disputa,
    lider,
    segundo,
    vantagem,
    empateTecnico,
    margemReferencia,
    candidatos,
    outros,
    pesquisasUsadas: usadas,
    ultimaPesquisa: usadas[0]!,
    algumaNaoRegistrada,
    foraDaJanela,
    descartadasPorBase,
  };
}

const UM_DIA_MS = 86_400_000;

/** Data ISO (YYYY-MM-DD) de um instante em milissegundos, em UTC. */
function dataIsoDoInstante(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface OpcoesSerieTemporal extends OpcoesAgregacao {
  /** Passo entre pontos consecutivos da série, em dias. Padrão 1 (diário). */
  passoDias?: number;
  /**
   * 'bilateral' (padrão): cada dia da série é a média ponderada de TODAS as
   * pesquisas, com peso decaindo pela distância (antes ou depois) até o dia —
   * linha suave, sem degraus quando uma pesquisa entra/sai da janela; o último
   * dia coincide com o agregado causal. 'causal': reproduz `agregarPesquisas`
   * dia a dia (só pesquisas até o dia, com janela).
   */
  suavizacao?: 'bilateral' | 'causal';
}

/** Um resultado individual de uma pesquisa, para plotagem como ponto no gráfico. */
export interface PontoSerieTemporal {
  /** Data de referência da pesquisa (dataFim, ou publicadoEm/dataInicio na ausência). */
  readonly data: string;
  readonly candidato: string;
  readonly partido: string | null;
  readonly pct: number;
  readonly amostra: number | null;
  readonly instituto: string;
  readonly registroTSE: RegistroTSE;
  readonly pollId: string;
}

/** A média ponderada de cada candidato em um dia da série. */
export interface DiaSerieTemporal {
  readonly data: string;
  /** Percentual médio ponderado por candidato nesse dia (chave = nome do candidato). */
  readonly valores: Readonly<Record<string, number>>;
}

export interface SerieTemporal {
  readonly dias: readonly DiaSerieTemporal[];
  readonly pontos: readonly PontoSerieTemporal[];
  /** Nomes dos candidatos (exclui brancos/nulos/etc.), ordenados pela média final (hoje) desc. */
  readonly candidatos: readonly string[];
  /** Pesquisas fora da série por estarem em base diferente — ver `Agregado.descartadasPorBase`. */
  readonly descartadasPorBase: readonly Pesquisa[];
}

/**
 * Serviço de domínio: série temporal da agregação ponderada de uma Disputa.
 * Para cada dia entre a data da primeira pesquisa e `hoje` (passo de
 * `opcoes.passoDias`, padrão 1), calcula a média ponderada por candidato
 * usando o MESMO kernel de recência/amostra e a mesma janela de
 * `agregarPesquisas` — apenas "avançando o relógio" dia a dia. Só considera
 * candidatos (`ehLinhaNaoCandidato` exclui brancos/nulos/etc. do resultado,
 * embora eles continuem pesando no denominador de `agregarPesquisas`).
 * Retorna listas vazias quando não há nenhuma pesquisa.
 */
export function serieTemporal(
  pesquisas: readonly Pesquisa[],
  opcoes: OpcoesSerieTemporal = {},
  hoje: Date = new Date(),
): SerieTemporal {
  if (pesquisas.length === 0) {
    return { dias: [], pontos: [], candidatos: [], descartadasPorBase: [] };
  }

  const { passoDias: passoDiasBruto, ...opcoesAgregacao } = opcoes;
  const passoDias = Math.max(1, Math.trunc(passoDiasBruto ?? 1));

  const excluidos = new Set(
    (opcoes.excluirCandidatos ?? CANDIDATOS_EXCLUIDOS_PADRAO).map((s) => s.toLowerCase().trim()),
  );

  // Mesma guarda de base do agregado, pela mesma razão: a linha também é uma
  // média ponderada, e misturar bases a desloca sem que nada acuse. Sem isto,
  // o número de hoje ficaria limpo e o gráfico ao lado dele, não.
  const { usadas: pesquisasNaBase, descartadas: descartadasPorBase } = separarPorBase(
    pesquisas,
    excluidos,
  );
  if (pesquisasNaBase.length === 0) {
    return { dias: [], pontos: [], candidatos: [], descartadasPorBase };
  }
  pesquisas = pesquisasNaBase;

  const primeiraDataIso = [...pesquisas].map((p) => dataReferencia(p)).sort()[0]!;
  const primeiraDataMs = Date.parse(`${primeiraDataIso}T00:00:00Z`);
  const hojeMs = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const hojeIso = dataIsoDoInstante(hojeMs);

  const suavizacao = opcoes.suavizacao ?? 'bilateral';
  const meiaVidaDias = opcoes.meiaVidaDias ?? MEIA_VIDA_DIAS_PADRAO;

  const dias: DiaSerieTemporal[] = [];
  for (let ms = primeiraDataMs; ms <= hojeMs; ms += passoDias * UM_DIA_MS) {
    const diaIso = dataIsoDoInstante(ms);
    const diaData = new Date(ms);
    const valores: Record<string, number> = {};
    if (suavizacao === 'bilateral') {
      Object.assign(valores, mediaBilateral(pesquisas, ms, meiaVidaDias, excluidos));
    } else {
      const pesquisasAteDia = pesquisas.filter((p) => dataReferencia(p) <= diaIso);
      const agregado = agregarPesquisas(pesquisasAteDia, opcoesAgregacao, diaData);
      if (agregado) {
        for (const c of agregado.candidatos) valores[c.candidato] = c.pct;
      }
    }
    dias.push({ data: diaIso, valores });
  }

  // Garante que "hoje" está sempre presente (o passo pode não cair exatamente
  // nele) — é a partir dele que vem a ordenação final dos candidatos.
  const pesquisasAteHoje = pesquisas.filter((p) => dataReferencia(p) <= hojeIso);
  const agregadoFinal = agregarPesquisas(pesquisasAteHoje, opcoesAgregacao, hoje);
  if (dias.length === 0 || dias[dias.length - 1]!.data !== hojeIso) {
    const valores: Record<string, number> = {};
    if (agregadoFinal) {
      for (const c of agregadoFinal.candidatos) valores[c.candidato] = c.pct;
    }
    dias.push({ data: hojeIso, valores });
  }

  const pontos: PontoSerieTemporal[] = [];
  for (const p of pesquisas) {
    for (const r of p.resultados) {
      if (ehLinhaNaoCandidato(r.candidato, excluidos)) continue;
      pontos.push({
        data: dataReferencia(p),
        candidato: r.candidato,
        partido: r.partido,
        pct: r.pct,
        amostra: p.amostra ?? null,
        instituto: p.instituto,
        registroTSE: p.registroTSE,
        pollId: p.id,
      });
    }
  }
  pontos.sort((a, b) => a.data.localeCompare(b.data));

  const candidatos = agregadoFinal ? agregadoFinal.candidatos.map((c) => c.candidato) : [];

  return { dias, pontos, candidatos, descartadasPorBase };
}


/**
 * Média ponderada por candidato num instante, usando todas as pesquisas
 * (passadas e futuras) com peso exp(-ln2·|distância em dias|/meiaVida)·√amostra.
 * Cada candidato é normalizado pelo peso total das pesquisas em que apareceu.
 */
function mediaBilateral(
  pesquisas: readonly Pesquisa[],
  instanteMs: number,
  meiaVidaDias: number,
  excluidos: ReadonlySet<string>,
): Record<string, number> {
  const somaPesoPct = new Map<string, number>();
  const somaPeso = new Map<string, number>();
  for (const p of pesquisas) {
    const dataMs = Date.parse(`${dataReferencia(p)}T00:00:00Z`);
    if (!Number.isFinite(dataMs)) continue;
    const distanciaDias = Math.abs(instanteMs - dataMs) / UM_DIA_MS;
    const peso = Math.exp((-Math.LN2 * distanciaDias) / meiaVidaDias) * Math.sqrt(p.amostra ?? AMOSTRA_PADRAO);
    for (const r of p.resultados) {
      if (ehLinhaNaoCandidato(r.candidato, excluidos)) continue;
      const chave = r.candidato.trim();
      somaPesoPct.set(chave, (somaPesoPct.get(chave) ?? 0) + peso * r.pct);
      somaPeso.set(chave, (somaPeso.get(chave) ?? 0) + peso);
    }
  }
  const valores: Record<string, number> = {};
  for (const [candidato, total] of somaPeso) {
    if (total > 0) valores[candidato] = (somaPesoPct.get(candidato) ?? 0) / total;
  }
  return valores;
}
