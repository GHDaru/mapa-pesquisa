import type { ResultadoRepository } from '../../../application/ports.js';
import { criarResultado, type DadosResultado } from '../../../domain/resultado.js';

/** Repositório do resultado consumado (data/resultado-1o-turno.json). */
export function criarResultadoRepositoryJson(dados: DadosResultado): ResultadoRepository {
  const validado = criarResultado(dados);
  return { dados: () => validado };
}
