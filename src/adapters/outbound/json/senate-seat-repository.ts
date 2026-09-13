import type { SenateSeatRepository } from '../../../application/ports.js';
import {
  type CadeiraSenado,
  type DadosCadeiraSenado,
  criarCadeiraSenado,
} from '../../../domain/senate.js';

/**
 * SenateSeatRepository em memória. Recebe os dados já parseados de
 * data/senate-seats.json e valida cada entrada pelo domínio.
 */
export function criarSenateSeatRepositoryJson(
  dados: readonly DadosCadeiraSenado[],
): SenateSeatRepository {
  const cadeiras: CadeiraSenado[] = dados.map((d) => criarCadeiraSenado(d));

  return {
    todas(): readonly CadeiraSenado[] {
      return cadeiras;
    },
  };
}
