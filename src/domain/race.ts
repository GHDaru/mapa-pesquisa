/**
 * Value objects relacionados à Disputa (Race). Domínio puro — sem I/O.
 */

export type Cargo = 'presidente' | 'governador' | 'senador';

export const CARGOS_VALIDOS: readonly Cargo[] = ['presidente', 'governador', 'senador'];

/** As 27 unidades federativas do Brasil (26 estados + DF). */
export const UFS: readonly string[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/** UF especial usada apenas para a disputa presidencial (nacional). */
export const UF_NACIONAL = 'BR';

export interface Disputa {
  readonly uf: string;
  readonly cargo: Cargo;
  readonly turno: 1 | 2;
}

export class DisputaInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisputaInvalidaError';
  }
}

function validarDisputa(disputa: Disputa): void {
  if (!CARGOS_VALIDOS.includes(disputa.cargo)) {
    throw new DisputaInvalidaError(`Cargo inválido: "${disputa.cargo}".`);
  }
  if (disputa.turno !== 1 && disputa.turno !== 2) {
    throw new DisputaInvalidaError(`Turno inválido: "${disputa.turno}". Deve ser 1 ou 2.`);
  }
  if (disputa.cargo === 'presidente') {
    if (disputa.uf !== UF_NACIONAL) {
      throw new DisputaInvalidaError(
        `Disputa de presidente deve usar uf "${UF_NACIONAL}", recebido "${disputa.uf}".`,
      );
    }
  } else {
    if (!UFS.includes(disputa.uf)) {
      throw new DisputaInvalidaError(
        `UF inválida para disputa de ${disputa.cargo}: "${disputa.uf}".`,
      );
    }
  }
}

/** Cria e valida uma Disputa. */
export function criarDisputa(uf: string, cargo: Cargo, turno: 1 | 2): Disputa {
  const disputa: Disputa = { uf, cargo, turno };
  validarDisputa(disputa);
  return disputa;
}

/** Identificador estável de uma Disputa, usado como chave de agrupamento/índice. */
export function disputaId(disputa: Disputa): string {
  return `${disputa.uf}-${disputa.cargo}-t${disputa.turno}`;
}
