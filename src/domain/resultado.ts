import type { CadeiraSenado } from './senate.js';
import type { DadosApuracao } from './apuracao.js';

/**
 * Resultado consumado da eleição de 2026, por oposição a tudo o mais no
 * projeto, que é pesquisa ou projeção. Três blocos: governadores (eleito no
 * 1º turno ou par que vai ao 2º), Câmara (bancadas) e Senado — este último
 * NÃO vem de arquivo, é DERIVADO da apuração que já temos em 27/27 UFs.
 */

export type SituacaoGovernador = 'eleito' | 'segundo-turno';

export interface CandidatoResultado {
  readonly nome: string;
  readonly partido: string;
  /** % dos votos válidos no 1º turno; null quando a fonte não publicou. */
  readonly pctValidos: number | null;
}

export interface GovernadorUf {
  readonly uf: string;
  readonly situacao: SituacaoGovernador;
  /** Preenchido quando `situacao` é 'eleito'. */
  readonly eleito: CandidatoResultado | null;
  /** Os dois que vão ao 2º turno; vazio quando já há eleito. */
  readonly finalistas: readonly CandidatoResultado[];
}

export interface BancadaCamara {
  readonly partido: string;
  readonly cadeiras: number;
}

export interface DadosResultado {
  readonly eleicao: number;
  readonly turno1: string;
  readonly turno2: string;
  readonly governadores: readonly GovernadorUf[];
  readonly camara: {
    readonly totalCadeiras: number;
    readonly bancadas: readonly BancadaCamara[];
  };
}

export class ResultadoInvalidoError extends Error {}

/** Total de UFs no país — governadores tem de cobrir todas, sem sobra nem falta. */
export const TOTAL_UFS = 27;

/**
 * Valida o arquivo de resultado. Dois fechamentos, e eles são a razão de a
 * validação existir: as UFs têm de somar 27 exatamente (uma UF esquecida
 * apareceria no mapa como buraco mudo), e as bancadas têm de somar o total
 * declarado da Câmara. Uma lista de bancadas que não fecha em 513 é lista
 * incompleta, e publicá-la faria a tela afirmar uma composição que não existe.
 */
export function criarResultado(dados: DadosResultado): DadosResultado {
  const ufs = new Set(dados.governadores.map((g) => g.uf));
  if (ufs.size !== dados.governadores.length) {
    throw new ResultadoInvalidoError('resultado: há UF repetida em governadores');
  }
  if (dados.governadores.length !== TOTAL_UFS) {
    throw new ResultadoInvalidoError(
      `resultado: governadores tem ${dados.governadores.length} UFs, esperado ${TOTAL_UFS}`,
    );
  }
  for (const g of dados.governadores) {
    if (g.situacao === 'eleito' && g.eleito == null) {
      throw new ResultadoInvalidoError(`resultado: ${g.uf} é 'eleito' mas não nomeia o eleito`);
    }
    if (g.situacao === 'segundo-turno' && g.finalistas.length !== 2) {
      throw new ResultadoInvalidoError(
        `resultado: ${g.uf} vai a 2º turno mas lista ${g.finalistas.length} finalista(s), esperado 2`,
      );
    }
  }
  const soma = dados.camara.bancadas.reduce((t, b) => t + b.cadeiras, 0);
  if (soma !== dados.camara.totalCadeiras) {
    throw new ResultadoInvalidoError(
      `resultado: bancadas somam ${soma}, e a Câmara tem ${dados.camara.totalCadeiras}`,
    );
  }
  return dados;
}

/** Quantas UFs já têm governador eleito e quantas ainda decidem em 25/10. */
export function contagemGovernadores(dados: DadosResultado): {
  eleitos: number;
  segundoTurno: number;
} {
  let eleitos = 0;
  let segundoTurno = 0;
  for (const g of dados.governadores) {
    if (g.situacao === 'eleito') eleitos++;
    else segundoTurno++;
  }
  return { eleitos, segundoTurno };
}

/** Governadores eleitos agrupados por partido, do maior para o menor. */
export function governadoresPorPartido(
  dados: DadosResultado,
): readonly { readonly partido: string; readonly ufs: readonly string[] }[] {
  const porPartido = new Map<string, string[]>();
  for (const g of dados.governadores) {
    if (g.eleito == null) continue;
    const lista = porPartido.get(g.eleito.partido) ?? [];
    lista.push(g.uf);
    porPartido.set(g.eleito.partido, lista);
  }
  return [...porPartido.entries()]
    .map(([partido, ufs]) => ({ partido, ufs: [...ufs].sort() }))
    .sort((a, b) => b.ufs.length - a.ufs.length || a.partido.localeCompare(b.partido, 'pt-BR'));
}

export interface SenadorEleito {
  readonly uf: string;
  readonly nome: string;
  readonly partido: string;
  readonly votos: number;
  readonly pctValidos: number;
  /**
   * Diferença, em pontos de válidos, para o 3º colocado — a folga da segunda
   * vaga. `null` quando a ficha da UF lista só os dois eleitos e não há 3º
   * contra quem medir: a vaga é dos dois, mas a folga é desconhecida, e
   * inventá-la seria pior que declarar que não sabemos.
   */
  readonly folgaParaOTerceiro: number | null;
}

/** Cadeiras por partido no Senado da próxima legislatura. */
export interface BancadaSenado {
  readonly partido: string;
  /** Cadeiras eleitas em 2026 (as 54 em disputa). */
  readonly eleitas2026: number;
  /** Cadeiras que seguem, eleitas em 2022 e não disputadas agora. */
  readonly remanescentes: number;
  readonly total: number;
}

export interface ComposicaoSenado {
  readonly eleitos: readonly SenadorEleito[];
  readonly bancadas: readonly BancadaSenado[];
  /** 81 quando o cálculo fecha: 54 eleitas agora + 27 remanescentes. */
  readonly totalCadeiras: number;
  readonly cadeirasEmDisputa: number;
  readonly cadeirasRemanescentes: number;
  /** UFs cuja ficha de apuração não permitiu nomear dois eleitos. */
  readonly ufsIncompletas: readonly string[];
}

/** Quantos senadores cada UF elege em 2026 (renovação de 2/3). */
export const VAGAS_SENADO_POR_UF = 2;

/**
 * Composição do Senado a partir da APURAÇÃO, não de pesquisa: os dois mais
 * votados de cada UF são os eleitos, e somam-se às cadeiras de 2022 que não
 * estavam em disputa.
 *
 * Por que a folga para o 3º importa: em algumas UFs a segunda vaga foi
 * decidida por margem mínima, e uma composição partidária que não mostre isso
 * dá a todas as 54 cadeiras a mesma aparência de solidez.
 */
export function composicaoSenado(
  apuracao: DadosApuracao,
  cadeiras: readonly CadeiraSenado[],
): ComposicaoSenado {
  const eleitos: SenadorEleito[] = [];
  const ufsIncompletas: string[] = [];

  for (const recorte of apuracao.recortes) {
    if (recorte.cargo !== 'senador' || recorte.uf == null) continue;
    const ordenados = [...recorte.candidatos].sort((a, b) => b.votos - a.votos);
    // Base de percentual: os válidos publicados quando existem; na falta
    // deles, a soma dos candidatos da ficha. Nunca zero — divisão por zero
    // viraria 0% e a tela leria isso como "sem voto", não como "sem base".
    const validos =
      recorte.validosTotal != null && recorte.validosTotal > 0
        ? recorte.validosTotal
        : ordenados.reduce((t, c) => t + c.votos, 0);

    if (ordenados.length < VAGAS_SENADO_POR_UF) {
      ufsIncompletas.push(recorte.uf);
      continue;
    }

    // A folga só existe para a ÚLTIMA vaga, que é a disputada: é a distância
    // do 2º para o 3º. O 1º colocado não tem folga a declarar — a vaga dele
    // nunca esteve em jogo contra o 3º.
    const terceiro = ordenados[VAGAS_SENADO_POR_UF];
    if (terceiro == null) ufsIncompletas.push(recorte.uf);
    const folga =
      terceiro != null && validos > 0
        ? ((ordenados[VAGAS_SENADO_POR_UF - 1]!.votos - terceiro.votos) / validos) * 100
        : null;

    for (let i = 0; i < VAGAS_SENADO_POR_UF; i++) {
      const c = ordenados[i]!;
      eleitos.push({
        uf: recorte.uf,
        nome: c.candidato,
        partido: c.partido ?? '—',
        votos: c.votos,
        pctValidos: validos > 0 ? (c.votos / validos) * 100 : 0,
        folgaParaOTerceiro: i === VAGAS_SENADO_POR_UF - 1 ? folga : null,
      });
    }
  }

  const porPartido = new Map<string, { eleitas2026: number; remanescentes: number }>();
  const entrada = (p: string) => {
    const atual = porPartido.get(p) ?? { eleitas2026: 0, remanescentes: 0 };
    porPartido.set(p, atual);
    return atual;
  };
  for (const e of eleitos) entrada(e.partido).eleitas2026++;
  for (const c of cadeiras) {
    if (c.emDisputa2026) continue;
    entrada(c.partido).remanescentes++;
  }

  const bancadas = [...porPartido.entries()]
    .map(([partido, v]) => ({ ...v, partido, total: v.eleitas2026 + v.remanescentes }))
    .sort((a, b) => b.total - a.total || a.partido.localeCompare(b.partido, 'pt-BR'));

  const cadeirasRemanescentes = cadeiras.filter((c) => !c.emDisputa2026).length;
  return {
    eleitos: [...eleitos].sort(
      (a, b) => a.uf.localeCompare(b.uf, 'pt-BR') || b.votos - a.votos,
    ),
    bancadas,
    totalCadeiras: eleitos.length + cadeirasRemanescentes,
    cadeirasEmDisputa: eleitos.length,
    cadeirasRemanescentes,
    ufsIncompletas: [...new Set(ufsIncompletas)].sort(),
  };
}
