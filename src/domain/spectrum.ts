/**
 * Espectro político. Domínio puro — sem I/O.
 */
export type Espectro =
  | 'esquerda'
  | 'centro-esquerda'
  | 'centro'
  | 'centro-direita'
  | 'direita'
  | 'indefinido';

export const ESPECTROS_VALIDOS: readonly Espectro[] = [
  'esquerda',
  'centro-esquerda',
  'centro',
  'centro-direita',
  'direita',
  'indefinido',
];

/** Ordem numérica do espectro, usada para ordenar o hemiciclo do Senado (esquerda -2 .. direita +2). */
const ORDEM_ESPECTRO: Record<Espectro, number> = {
  esquerda: -2,
  'centro-esquerda': -1,
  centro: 0,
  'centro-direita': 1,
  direita: 2,
  indefinido: 0,
};

export function ordemEspectro(espectro: Espectro): number {
  return ORDEM_ESPECTRO[espectro];
}

export function ehEspectroValido(valor: string): valor is Espectro {
  return (ESPECTROS_VALIDOS as readonly string[]).includes(valor);
}

/**
 * Subconjunto de Partido necessário para resolver o espectro de uma sigla.
 * Evita dependência circular com party.ts (que também pode precisar de spectrum.ts).
 */
export interface PartidoComEspectro {
  sigla: string;
  espectro: Espectro;
}

/**
 * Resolve o espectro de um partido pela sigla. Partido desconhecido ou sigla
 * ausente (candidato sem partido, ex.: "Brancos/nulos") retornam 'indefinido',
 * nunca lançam erro — é uma invariante do domínio (ver docs/architecture.md).
 */
export function espectroDoPartido(
  sigla: string | null | undefined,
  partidos: readonly PartidoComEspectro[],
): Espectro {
  if (!sigla) return 'indefinido';
  const partido = partidos.find((p) => p.sigla === sigla);
  return partido ? partido.espectro : 'indefinido';
}
