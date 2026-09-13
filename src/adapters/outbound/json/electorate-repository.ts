import type { EleitoradoRepository } from '../../../application/ports.js';
import { type DadosEleitorado, type Eleitorado, criarEleitorado } from '../../../domain/electorate.js';

/**
 * EleitoradoRepository em memória. Recebe os dados já parseados de
 * data/electorate.json e valida cada entrada pelo domínio. Tolera lista
 * vazia (`[]`) — o merge (ingest/merge-research.ts) copia
 * data/research/electorate.json por cima assim que o agente de pesquisa
 * publicar os números do TSE.
 */
export function criarEleitoradoRepositoryJson(dados: readonly DadosEleitorado[]): EleitoradoRepository {
  const eleitorado: Eleitorado[] = dados.map((d) => criarEleitorado(d));
  const porUfMapa = new Map(eleitorado.map((e) => [e.uf, e]));

  return {
    todos(): readonly Eleitorado[] {
      return eleitorado;
    },
    porUf(uf: string): Eleitorado | undefined {
      return porUfMapa.get(uf.trim().toUpperCase());
    },
  };
}
