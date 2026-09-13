import type { MetaRepository } from '../../../application/ports.js';

export interface DadosMeta {
  atualizadoEm: string;
}

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** MetaRepository em memória. Recebe os dados já parseados de data/meta.json. */
export function criarMetaRepositoryJson(dados: DadosMeta): MetaRepository {
  if (!dados || !DATA_ISO_REGEX.test(dados.atualizadoEm) || Number.isNaN(Date.parse(dados.atualizadoEm))) {
    throw new Error(
      `meta.json inválido: campo "atualizadoEm" deve ser uma data ISO (YYYY-MM-DD), recebido "${dados?.atualizadoEm}".`,
    );
  }

  return {
    atualizadoEm(): string {
      return dados.atualizadoEm;
    },
  };
}
