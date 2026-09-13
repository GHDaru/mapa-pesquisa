import type { Disputa } from './race.js';
import { type Pesquisa, type RegistroTSE, dataReferencia } from './poll.js';

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
 * Padrões (sem acento, minúsculas) que identificam linhas que não são candidatos:
 * brancos, nulos, indecisos, "não sabe", "não respondeu", "nenhum", "outros",
 * e qualquer linha marcada como cenário espontâneo.
 */
const PADROES_NAO_CANDIDATO: readonly RegExp[] = [
  /\bbranco/, /\bnulo/, /\bindecis/, /nao sabe/, /nao respond/, /nao opin/,
  /\bnenhum/, /^outros?\b/, /\boutros\b/, /espontan/, /nao vot/, /ns\/nr/,
];

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Verdadeiro quando a linha de resultado não representa um candidato. */
export function ehLinhaNaoCandidato(candidato: string, excluidos: ReadonlySet<string>): boolean {
  const chave = candidato.toLowerCase().trim();
  if (excluidos.has(chave)) return true;
  const plano = semAcento(candidato);
  return PADROES_NAO_CANDIDATO.some((re) => re.test(plano));
}

/**
 * Nível de confiança da liderança nas 3 faixas de docs/design-system.md,
 * calculado a partir da vantagem (pontos) sobre o 2º colocado e da margem de
 * referência ponderada. Usado tanto pelo agregado presidencial/governador
 * quanto pelas cadeiras projetadas do Senado (`domain/senate.ts`).
 */
export type NivelConfianca = 'folga' | 'acirrada' | 'empate';

/**
 * Classifica a confiança da liderança: `empate` quando a vantagem está
 * dentro da margem de referência, `acirrada` quando a supera mas fica abaixo
 * do dobro da margem, `folga` quando é igual ou maior que o dobro.
 */
export function classificarConfianca(vantagem: number, margemReferencia: number): NivelConfianca {
  if (vantagem <= margemReferencia) return 'empate';
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
  /** Linhas ignoradas do ranking (brancos/nulos, não sabe, etc.), mesma agregação ponderada. */
  readonly outros: readonly CandidatoAgregado[];
  readonly pesquisasUsadas: readonly Pesquisa[];
  readonly ultimaPesquisa: Pesquisa;
  readonly algumaNaoRegistrada: boolean;
  /** true quando nenhuma pesquisa caiu dentro da janela e a mais recente disponível foi usada mesmo assim. */
  readonly foraDaJanela: boolean;
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

  let usadas: Pesquisa[];
  let foraDaJanela: boolean;
  if (dentroDaJanela.length > 0) {
    usadas = dentroDaJanela;
    foraDaJanela = false;
  } else {
    usadas = [maisRecente];
    foraDaJanela = true;
  }

  const disputa = usadas[0]!.disputa;

  const acumulado = new Map<string, Acumulador>();
  for (const p of usadas) {
    const peso = pesoRecenciaEAmostra(p, hoje, meiaVidaDias);
    for (const r of p.resultados) {
      const chave = r.candidato.toLowerCase().trim();
      const atual = acumulado.get(chave) ?? {
        candidato: r.candidato,
        partido: r.partido,
        somaPesoPct: 0,
        somaPeso: 0,
        pesquisas: 0,
      };
      atual.somaPesoPct += peso * r.pct;
      atual.somaPeso += peso;
      atual.pesquisas += 1;
      if (atual.partido === null && r.partido !== null) atual.partido = r.partido;
      acumulado.set(chave, atual);
    }
  }

  const candidatos: CandidatoAgregado[] = [];
  const outros: CandidatoAgregado[] = [];
  for (const [chave, acc] of acumulado) {
    const item: CandidatoAgregado = {
      candidato: acc.candidato,
      partido: acc.partido,
      pct: acc.somaPeso > 0 ? acc.somaPesoPct / acc.somaPeso : 0,
      pesquisas: acc.pesquisas,
    };
    if (ehLinhaNaoCandidato(chave, excluidos)) {
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

  const empateTecnico = vantagem <= margemReferencia;
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
    return { dias: [], pontos: [], candidatos: [] };
  }

  const { passoDias: passoDiasBruto, ...opcoesAgregacao } = opcoes;
  const passoDias = Math.max(1, Math.trunc(passoDiasBruto ?? 1));

  const excluidos = new Set(
    (opcoes.excluirCandidatos ?? CANDIDATOS_EXCLUIDOS_PADRAO).map((s) => s.toLowerCase().trim()),
  );

  const primeiraDataIso = [...pesquisas].map((p) => dataReferencia(p)).sort()[0]!;
  const primeiraDataMs = Date.parse(`${primeiraDataIso}T00:00:00Z`);
  const hojeMs = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const hojeIso = dataIsoDoInstante(hojeMs);

  const dias: DiaSerieTemporal[] = [];
  for (let ms = primeiraDataMs; ms <= hojeMs; ms += passoDias * UM_DIA_MS) {
    const diaIso = dataIsoDoInstante(ms);
    const diaData = new Date(ms);
    const pesquisasAteDia = pesquisas.filter((p) => dataReferencia(p) <= diaIso);
    const agregado = agregarPesquisas(pesquisasAteDia, opcoesAgregacao, diaData);
    const valores: Record<string, number> = {};
    if (agregado) {
      for (const c of agregado.candidatos) valores[c.candidato] = c.pct;
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

  return { dias, pontos, candidatos };
}
