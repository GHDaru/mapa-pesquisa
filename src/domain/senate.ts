import { type Espectro, espectroDoPartido } from './spectrum.js';
import type { Partido } from './party.js';
import type { Agregado } from './aggregate.js';
import { UFS } from './race.js';

/**
 * Cadeira do Senado — dado de origem (situação atual, conforme data-schema.md).
 */
export interface CadeiraSenado {
  readonly uf: string;
  readonly senador: string;
  readonly partido: string;
  readonly mandatoInicio: number;
  readonly mandatoFim: number;
  readonly emDisputa2026: boolean;
  readonly fonte: string;
}

export interface DadosCadeiraSenado {
  uf: string;
  senador: string;
  partido: string;
  mandatoInicio: number;
  mandatoFim: number;
  emDisputa2026: boolean;
  fonte: string;
}

export class CadeiraSenadoInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CadeiraSenadoInvalidaError';
  }
}

export function criarCadeiraSenado(dados: DadosCadeiraSenado): CadeiraSenado {
  if (!UFS.includes(dados.uf)) {
    throw new CadeiraSenadoInvalidaError(`Cadeira de Senado com UF inválida: "${dados.uf}".`);
  }
  if (!dados.senador || !dados.senador.trim()) {
    throw new CadeiraSenadoInvalidaError(`Cadeira de Senado (${dados.uf}) sem nome de senador.`);
  }
  if (!dados.partido || !dados.partido.trim()) {
    throw new CadeiraSenadoInvalidaError(`Cadeira de Senado (${dados.uf}) sem partido.`);
  }
  if (!Number.isInteger(dados.mandatoInicio) || !Number.isInteger(dados.mandatoFim)) {
    throw new CadeiraSenadoInvalidaError(`Cadeira de Senado (${dados.uf}) com mandato inválido.`);
  }
  if (typeof dados.emDisputa2026 !== 'boolean') {
    throw new CadeiraSenadoInvalidaError(`Cadeira de Senado (${dados.uf}) sem emDisputa2026 booleano.`);
  }
  return {
    uf: dados.uf,
    senador: dados.senador.trim(),
    partido: dados.partido.trim(),
    mandatoInicio: dados.mandatoInicio,
    mandatoFim: dados.mandatoFim,
    emDisputa2026: dados.emDisputa2026,
    fonte: dados.fonte ?? '',
  };
}

export type OrigemAssento = 'fixa' | 'projetada' | 'indefinida';

export interface AssentoSenado {
  readonly uf: string;
  readonly ocupante: string | null;
  readonly partido: string | null;
  readonly espectro: Espectro;
  readonly origem: OrigemAssento;
  readonly empateTecnico?: boolean;
}

export interface ProjecaoSenado {
  readonly assentos: readonly AssentoSenado[];
  readonly totalPorPartido: Readonly<Record<string, number>>;
  readonly totalPorEspectro: Readonly<Record<Espectro, number>>;
  readonly composicaoAtual: {
    readonly totalPorPartido: Readonly<Record<string, number>>;
    readonly totalPorEspectro: Readonly<Record<Espectro, number>>;
  };
}

/** Ordem de desenho do hemiciclo: esquerda -> ... -> direita, com 'indefinido' no centro. */
const ORDEM_HEMICICLO: readonly Espectro[] = [
  'esquerda',
  'centro-esquerda',
  'centro',
  'indefinido',
  'centro-direita',
  'direita',
];

function posicaoHemiciclo(espectro: Espectro): number {
  const idx = ORDEM_HEMICICLO.indexOf(espectro);
  return idx === -1 ? ORDEM_HEMICICLO.length : idx;
}

function incrementar(mapa: Record<string, number>, chave: string): void {
  mapa[chave] = (mapa[chave] ?? 0) + 1;
}

/**
 * Projeta a composição do Senado: 27 cadeiras fixas (não disputadas em 2026)
 * mais 54 projetadas a partir do agregado de pesquisas de senador por UF (os
 * dois primeiros colocados). Nunca inventa um vencedor: sem agregado (ou sem
 * candidatos suficientes) a cadeira fica 'indefinida'.
 */
export function projetarSenado(
  cadeiras: readonly CadeiraSenado[],
  agregadosPorUf: Readonly<Record<string, Agregado | null | undefined>>,
  partidos: readonly Partido[],
): ProjecaoSenado {
  const assentos: AssentoSenado[] = [];

  const composicaoAtualPorPartido: Record<string, number> = {};
  const composicaoAtualPorEspectro: Record<string, number> = {};
  for (const cadeira of cadeiras) {
    incrementar(composicaoAtualPorPartido, cadeira.partido);
    incrementar(composicaoAtualPorEspectro, espectroDoPartido(cadeira.partido, partidos));
  }

  for (const uf of UFS) {
    const cadeirasDaUf = cadeiras.filter((c) => c.uf === uf);
    const fixas = cadeirasDaUf.filter((c) => !c.emDisputa2026);
    const emDisputa = cadeirasDaUf.filter((c) => c.emDisputa2026);

    for (const cadeira of fixas) {
      assentos.push({
        uf,
        ocupante: cadeira.senador,
        partido: cadeira.partido,
        espectro: espectroDoPartido(cadeira.partido, partidos),
        origem: 'fixa',
      });
    }

    const agregado = agregadosPorUf[uf] ?? null;
    const ranking = agregado?.candidatos ?? [];
    const margemReferencia = agregado?.margemReferencia ?? 0;

    // Duas cadeiras em disputa por UF: preenchidas pelos dois primeiros do agregado.
    for (let i = 0; i < emDisputa.length; i++) {
      const candidato = ranking[i];
      if (!candidato) {
        assentos.push({
          uf,
          ocupante: null,
          partido: null,
          espectro: 'indefinido',
          origem: 'indefinida',
        });
        continue;
      }
      const proximo = ranking[i + 1];
      const assento: AssentoSenado = {
        uf,
        ocupante: candidato.candidato,
        partido: candidato.partido,
        espectro: espectroDoPartido(candidato.partido, partidos),
        origem: 'projetada',
        ...(proximo
          ? { empateTecnico: candidato.pct - proximo.pct <= margemReferencia }
          : {}),
      };
      assentos.push(assento);
    }
  }

  assentos.sort((a, b) => {
    const diff = posicaoHemiciclo(a.espectro) - posicaoHemiciclo(b.espectro);
    if (diff !== 0) return diff;
    return a.uf.localeCompare(b.uf);
  });

  const totalPorPartido: Record<string, number> = {};
  const totalPorEspectro: Record<string, number> = {};
  for (const assento of assentos) {
    if (assento.partido) incrementar(totalPorPartido, assento.partido);
    incrementar(totalPorEspectro, assento.espectro);
  }

  return {
    assentos,
    totalPorPartido,
    totalPorEspectro: totalPorEspectro as Record<Espectro, number>,
    composicaoAtual: {
      totalPorPartido: composicaoAtualPorPartido,
      totalPorEspectro: composicaoAtualPorEspectro as Record<Espectro, number>,
    },
  };
}
