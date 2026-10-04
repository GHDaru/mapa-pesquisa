/**
 * Apuração e projeção.
 *
 * A diferença entre as duas é o ponto desta tela, e a origem de quase todo
 * erro de leitura na noite de eleição:
 *
 * - **apurado** é contagem. Não tem incerteza: são os votos que já entraram.
 * - **projetado** é inferência sobre o que falta, e carrega a premissa de que
 *   as seções que faltam numa UF se parecem com as que já foram contadas lá.
 *
 * O percentual nacional parcial é a armadilha clássica: ele é enviesado pela
 * ORDEM em que os estados totalizam, não pelo voto. Em 2022 o Nordeste
 * totalizou primeiro e a vantagem do primeiro colocado encolheu à medida que
 * São Paulo entrou — sem que um único eleitor tivesse mudado de ideia. Por
 * isso a projeção daqui é montada **por estado** (cada UF é escalada pelo que
 * falta nela) e só depois somada, em vez de extrapolar o percentual nacional.
 *
 * O que esta camada se recusa a fazer:
 *
 * - completar UF sem apuração com pesquisa, média nacional ou qualquer outra
 *   coisa. UF sem dado fica de fora e aparece nomeada em `ufsSemApuracao`;
 * - chamar a projeção de "nacional" quando ela cobre parte do eleitorado. A
 *   cobertura é devolvida junto e a tela é obrigada a declará-la;
 * - dizer que um resultado está definido sem que a aritmética feche. Veja
 *   `matematicamenteDefinido`, que só é `true` quando a vantagem do líder
 *   excede TODO o voto que ainda pode aparecer, incluindo o teto do
 *   eleitorado das UFs que não têm nenhuma apuração.
 */

import type { Eleitorado } from './electorate.js';

export type CargoApuracao = 'presidente' | 'governador' | 'senador';

/** Linha de candidato como a fonte publica: votos absolutos, não percentual. */
export interface DadosCandidatoApurado {
  readonly candidato: string;
  readonly partido: string | null;
  readonly votos: number;
}

/**
 * Um recorte de apuração: um cargo, num turno, numa UF (ou nacional, com
 * `uf: null`). Votos em números absolutos porque é assim que a fonte oficial
 * publica — e porque com absolutos o problema de "total vs votos válidos",
 * que domina a ingestão de pesquisas, simplesmente não existe: dá para
 * calcular os dois sem converter nada.
 */
export interface DadosApuracaoRecorte {
  readonly cargo: CargoApuracao;
  readonly uf: string | null;
  readonly turno: 1 | 2;
  /** Percentual de seções totalizadas, 0 a 100. É a medida da incerteza. */
  readonly secoesTotalizadas: number;
  readonly candidatos: readonly DadosCandidatoApurado[];
  /**
   * Total de votos válidos da leitura, quando a fonte o publica ou ele é
   * derivável dos valores publicados.
   *
   * Existe porque sem ele o percentual sai errado: a cobertura raramente
   * publica TODOS os candidatos, e dividir pela soma dos que estão na ficha
   * infla cada um deles. Com os quatro candidatos do recorte nacional de
   * 04/10, que somam 97,17% dos válidos, isso elevava o primeiro colocado de
   * 50,2% (o que a fonte publica) para 51,7% — uma contradição com a própria
   * fonte citada ao lado.
   */
  readonly validosTotal?: number | null;
  readonly brancos?: number | null;
  readonly nulos?: number | null;
  readonly abstencoes?: number | null;
  readonly fonte: { readonly nome: string; readonly url: string };
  readonly observacao?: string | null;
}

export interface DadosApuracao {
  /** Instante da leitura, ISO 8601. A apuração muda a cada minuto. */
  readonly atualizadoEm: string;
  readonly recortes: readonly DadosApuracaoRecorte[];
}

export class ApuracaoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ApuracaoError';
  }
}

export interface CandidatoProjetado {
  readonly candidato: string;
  readonly partido: string | null;
  /** Votos que já estão contados. Não é estimativa. */
  readonly votosApurados: number;
  /** Votos ao fim, sob a premissa de que o que falta se parece com o contado. */
  readonly votosProjetados: number;
  /** Percentual sobre os válidos JÁ APURADOS. */
  readonly pctApurado: number;
  /** Percentual sobre os válidos PROJETADOS. */
  readonly pctProjetado: number;
}

export interface ProjecaoUf {
  readonly uf: string;
  readonly secoesTotalizadas: number;
  readonly candidatos: readonly CandidatoProjetado[];
  readonly validosApurados: number;
  readonly validosProjetados: number;
  /** Eleitores aptos da UF, quando cadastrado em data/electorate.json. */
  readonly eleitores: number | null;
  readonly lider: string | null;
}

export interface MargemProjetada {
  readonly lider: string;
  readonly segundo: string;
  readonly vantagemVotos: number;
  readonly vantagemPct: number;
  /**
   * Teto do que ainda pode entrar: o que falta nas UFs com apuração mais o
   * eleitorado inteiro das UFs que não têm nenhuma. É deliberadamente
   * pessimista — serve para NÃO declarar definido o que não está.
   */
  readonly votosRestantesTeto: number;
  /** `true` só quando a vantagem excede `votosRestantesTeto`. */
  readonly matematicamenteDefinido: boolean;
  /** O líder passou de 50% dos válidos projetados (relevante no 1º turno). */
  readonly acimaDeCinquenta: boolean;
}

export interface Projecao {
  readonly cargo: CargoApuracao;
  readonly turno: 1 | 2;
  /** Projeção somada das UFs que têm apuração. NÃO é o país quando falta UF. */
  readonly candidatos: readonly CandidatoProjetado[];
  readonly porUf: readonly ProjecaoUf[];
  readonly ufsSemApuracao: readonly string[];
  readonly eleitoradoCoberto: number;
  readonly eleitoradoTotal: number;
  /** Média de seções totalizadas ponderada pelo eleitorado das UFs cobertas. */
  readonly secoesTotalizadasPonderada: number;
  readonly validosApurados: number;
  readonly validosProjetados: number;
  readonly margem: MargemProjetada | null;
  /**
   * O recorte nacional cru, quando a fonte o publica. Guardado para
   * CONTRASTE: a diferença entre ele e a projeção por estado é exatamente o
   * viés de ordem de apuração, e mostrá-la é mais informativo que escondê-la.
   */
  readonly nacionalCru: {
    readonly secoesTotalizadas: number;
    readonly candidatos: readonly CandidatoProjetado[];
    /** Percentual dos válidos coberto pelos candidatos que a fonte publicou. */
    readonly somaPctPublicada: number;
  } | null;
}

/** Soma de votos de uma lista de candidatos. */
function somaVotos(candidatos: readonly DadosCandidatoApurado[]): number {
  return candidatos.reduce((t, c) => t + c.votos, 0);
}

function validarRecorte(r: DadosApuracaoRecorte): void {
  if (r.secoesTotalizadas < 0 || r.secoesTotalizadas > 100) {
    throw new ApuracaoError(
      `secoesTotalizadas fora de 0–100 (${r.secoesTotalizadas}) em ${r.cargo} ${r.uf ?? 'BR'} turno ${r.turno}.`,
    );
  }
  for (const c of r.candidatos) {
    if (!Number.isFinite(c.votos) || c.votos < 0) {
      throw new ApuracaoError(
        `voto inválido (${c.votos}) para ${c.candidato} em ${r.cargo} ${r.uf ?? 'BR'} turno ${r.turno}.`,
      );
    }
  }
}

/**
 * Projeta um recorte: escala os votos apurados por 1/fração contada.
 *
 * Com 0% totalizado não há o que escalar e a projeção é igual ao apurado
 * (zero) — nunca uma divisão por zero, e nunca um número inventado.
 */
function projetarCandidatos(
  candidatos: readonly DadosCandidatoApurado[],
  secoesTotalizadas: number,
  /**
   * Denominador dos percentuais. Quando a fonte declara o total de válidos, é
   * ele — e não a soma dos candidatos da ficha, que normalmente é menor porque
   * a cobertura omite os menores. Ver `validosTotal`.
   */
  validosTotal?: number | null,
): { candidatos: CandidatoProjetado[]; validosApurados: number; validosProjetados: number } {
  const fracao = secoesTotalizadas / 100;
  const somaDaFicha = somaVotos(candidatos);
  const validosApurados =
    validosTotal != null && validosTotal > 0 ? validosTotal : somaDaFicha;
  const escala = fracao > 0 ? 1 / fracao : 1;
  const projetados = candidatos.map((c) => ({
    candidato: c.candidato,
    partido: c.partido,
    votosApurados: c.votos,
    votosProjetados: c.votos * escala,
  }));
  // Projetado também escala o denominador, para o percentual projetado ficar
  // na mesma base do apurado.
  const validosProjetados = validosApurados * escala;
  return {
    candidatos: projetados
      .map((c) => ({
        ...c,
        pctApurado: validosApurados > 0 ? (c.votosApurados / validosApurados) * 100 : 0,
        pctProjetado: validosProjetados > 0 ? (c.votosProjetados / validosProjetados) * 100 : 0,
      }))
      .sort((a, b) => b.votosProjetados - a.votosProjetados),
    validosApurados,
    validosProjetados,
  };
}

/** Acumula votos por candidato somando as UFs. */
function somarPorCandidato(
  porUf: readonly ProjecaoUf[],
): { candidatos: CandidatoProjetado[]; validosApurados: number; validosProjetados: number } {
  const acc = new Map<string, { partido: string | null; apurados: number; projetados: number }>();
  for (const uf of porUf) {
    for (const c of uf.candidatos) {
      const atual = acc.get(c.candidato) ?? { partido: c.partido, apurados: 0, projetados: 0 };
      atual.apurados += c.votosApurados;
      atual.projetados += c.votosProjetados;
      // Mantém o primeiro partido não nulo visto — UFs podem omitir a sigla.
      if (atual.partido == null) atual.partido = c.partido;
      acc.set(c.candidato, atual);
    }
  }
  const validosApurados = [...acc.values()].reduce((t, v) => t + v.apurados, 0);
  const validosProjetados = [...acc.values()].reduce((t, v) => t + v.projetados, 0);
  const candidatos = [...acc.entries()]
    .map(([candidato, v]) => ({
      candidato,
      partido: v.partido,
      votosApurados: v.apurados,
      votosProjetados: v.projetados,
      pctApurado: validosApurados > 0 ? (v.apurados / validosApurados) * 100 : 0,
      pctProjetado: validosProjetados > 0 ? (v.projetados / validosProjetados) * 100 : 0,
    }))
    .sort((a, b) => b.votosProjetados - a.votosProjetados);
  return { candidatos, validosApurados, validosProjetados };
}

/**
 * Margem entre primeiro e segundo, e se o resultado já está aritmeticamente
 * fora de alcance.
 *
 * O teto de votos restantes é pessimista de propósito: soma o que falta nas
 * UFs cobertas com o eleitorado INTEIRO das UFs sem nenhuma apuração. Um
 * resultado só é declarado definido quando a vantagem supera esse teto, o
 * que é uma condição forte — e é a única que não depende de a projeção estar
 * certa.
 */
function calcularMargem(
  candidatos: readonly CandidatoProjetado[],
  validosApurados: number,
  validosProjetados: number,
  eleitoradoNaoCoberto: number,
): MargemProjetada | null {
  if (candidatos.length < 2) return null;
  const [primeiro, segundo] = candidatos as readonly [CandidatoProjetado, CandidatoProjetado];
  const vantagemVotos = primeiro.votosApurados - segundo.votosApurados;
  const restantesNasCobertas = Math.max(0, validosProjetados - validosApurados);
  const votosRestantesTeto = restantesNasCobertas + eleitoradoNaoCoberto;
  return {
    lider: primeiro.candidato,
    segundo: segundo.candidato,
    vantagemVotos,
    vantagemPct: primeiro.pctProjetado - segundo.pctProjetado,
    votosRestantesTeto,
    matematicamenteDefinido: vantagemVotos > votosRestantesTeto,
    acimaDeCinquenta: primeiro.pctProjetado > 50,
  };
}

/**
 * Monta a projeção de um cargo/turno a partir dos recortes de apuração.
 *
 * `eleitorado` entra para dois usos, ambos de honestidade e nenhum de
 * estimativa: medir a cobertura (quanto do eleitorado está representado) e
 * dar o teto dos votos que ainda podem aparecer nas UFs sem dado.
 */
export function projetarApuracao(
  apuracao: DadosApuracao,
  cargo: CargoApuracao,
  turno: 1 | 2,
  eleitorado: readonly Eleitorado[],
): Projecao {
  for (const r of apuracao.recortes) validarRecorte(r);

  const doCargo = apuracao.recortes.filter((r) => r.cargo === cargo && r.turno === turno);
  const recortesUf = doCargo.filter((r) => r.uf != null && r.uf !== 'BR');
  const recorteNacional = doCargo.find((r) => r.uf == null || r.uf === 'BR') ?? null;

  const eleitoresPorUf = new Map(eleitorado.map((e) => [e.uf, e.eleitores]));
  const eleitoradoTotal = eleitorado.reduce((t, e) => t + e.eleitores, 0);

  const porUf: ProjecaoUf[] = recortesUf.map((r) => {
    const p = projetarCandidatos(r.candidatos, r.secoesTotalizadas, r.validosTotal);
    return {
      uf: r.uf as string,
      secoesTotalizadas: r.secoesTotalizadas,
      candidatos: p.candidatos,
      validosApurados: p.validosApurados,
      validosProjetados: p.validosProjetados,
      eleitores: eleitoresPorUf.get(r.uf as string) ?? null,
      lider: p.candidatos[0]?.candidato ?? null,
    };
  });
  porUf.sort((a, b) => a.uf.localeCompare(b.uf));

  const ufsComDado = new Set(porUf.map((u) => u.uf));
  const ufsSemApuracao = eleitorado
    .map((e) => e.uf)
    .filter((uf) => !ufsComDado.has(uf))
    .sort();

  const eleitoradoCoberto = porUf.reduce((t, u) => t + (u.eleitores ?? 0), 0);
  const eleitoradoNaoCoberto = Math.max(0, eleitoradoTotal - eleitoradoCoberto);

  // Média de seções ponderada pelo eleitorado: uma UF pequena a 100% não pode
  // dar a impressão de que o país está totalizado.
  const pesoTotal = porUf.reduce((t, u) => t + (u.eleitores ?? 0), 0);
  const secoesTotalizadasPonderada =
    pesoTotal > 0
      ? porUf.reduce((t, u) => t + u.secoesTotalizadas * (u.eleitores ?? 0), 0) / pesoTotal
      : 0;

  /*
   * Somar candidatos entre UFs só faz sentido para PRESIDENTE, onde são os
   * mesmos nomes no país inteiro. Para governador e senador é erro de
   * categoria: somaria o votado na Bahia com o votado no Paraná numa lista
   * única, como se disputassem entre si, e produziria um "líder nacional de
   * governador" que não existe. Nesses cargos o agregado fica vazio de
   * propósito e cada UF se lê sozinha, em `porUf`.
   */
  const somado =
    cargo === 'presidente'
      ? somarPorCandidato(porUf)
      : { candidatos: [] as CandidatoProjetado[], validosApurados: 0, validosProjetados: 0 };

  return {
    cargo,
    turno,
    candidatos: somado.candidatos,
    porUf,
    ufsSemApuracao,
    eleitoradoCoberto,
    eleitoradoTotal,
    secoesTotalizadasPonderada,
    validosApurados: somado.validosApurados,
    validosProjetados: somado.validosProjetados,
    margem: calcularMargem(
      somado.candidatos,
      somado.validosApurados,
      somado.validosProjetados,
      eleitoradoNaoCoberto,
    ),
    nacionalCru: recorteNacional
      ? {
          secoesTotalizadas: recorteNacional.secoesTotalizadas,
          candidatos: projetarCandidatos(
            recorteNacional.candidatos,
            recorteNacional.secoesTotalizadas,
            recorteNacional.validosTotal,
          ).candidatos,
          /**
           * Quanto dos válidos os candidatos publicados cobrem. Abaixo de 100
           * significa que a fonte não publicou todos — e a tela precisa dizer
           * isso em vez de deixar a soma dos percentuais parecer completa.
           */
          somaPctPublicada:
            recorteNacional.validosTotal != null && recorteNacional.validosTotal > 0
              ? (somaVotos(recorteNacional.candidatos) / recorteNacional.validosTotal) * 100
              : 100,
        }
      : null,
  };
}

/** true quando não há nenhum recorte de apuração para o cargo/turno pedido. */
export function semApuracao(projecao: Projecao): boolean {
  return projecao.porUf.length === 0 && projecao.nacionalCru === null;
}
