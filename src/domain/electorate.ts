import type { Fonte } from './poll.js';
import { UFS } from './race.js';

/**
 * Entidade Eleitorado — número de eleitores aptos por UF (fonte: TSE). Usado
 * para ponderar o peso de cada UF no mapa presidencial por estado. Domínio
 * puro — sem I/O. Ver docs/data-schema.md ("data/electorate.json").
 */
export interface Eleitorado {
  readonly uf: string;
  readonly eleitores: number;
  /** Referência temporal do dado, ex.: "2026-07" (ou só o ano, "2026"). */
  readonly referencia: string;
  readonly fonte: Fonte;
}

export interface DadosEleitorado {
  uf: string;
  eleitores: number;
  referencia: string;
  fonte: Fonte;
}

export class EleitoradoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EleitoradoInvalidoError';
  }
}

const REFERENCIA_REGEX = /^\d{4}(-\d{2})?$/;

/**
 * Factory com validação completa de um Eleitorado a partir de dados brutos
 * (ex.: linha de data/electorate.json). Lança EleitoradoInvalidoError com a
 * UF na mensagem quando os dados são inválidos.
 */
export function criarEleitorado(dados: DadosEleitorado): Eleitorado {
  const uf = dados.uf?.trim().toUpperCase();
  if (!uf || !UFS.includes(uf)) {
    throw new EleitoradoInvalidoError(`Eleitorado com UF inválida: "${dados.uf}".`);
  }

  if (!Number.isInteger(dados.eleitores) || dados.eleitores <= 0) {
    throw new EleitoradoInvalidoError(
      `Eleitorado (${uf}) inválido: "eleitores" deve ser um inteiro positivo, recebido "${dados.eleitores}".`,
    );
  }

  if (!dados.referencia || !REFERENCIA_REGEX.test(dados.referencia.trim())) {
    throw new EleitoradoInvalidoError(
      `Eleitorado (${uf}) inválido: "referencia" deve ser no formato "AAAA" ou "AAAA-MM", recebido "${dados.referencia}".`,
    );
  }

  if (!dados.fonte || !dados.fonte.nome?.trim() || !dados.fonte.url?.trim()) {
    throw new EleitoradoInvalidoError(`Eleitorado (${uf}) inválido: fonte deve ter nome e url preenchidos.`);
  }

  return {
    uf,
    eleitores: dados.eleitores,
    referencia: dados.referencia.trim(),
    fonte: { nome: dados.fonte.nome.trim(), url: dados.fonte.url.trim() },
  };
}
