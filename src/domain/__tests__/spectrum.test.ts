import { describe, expect, it } from 'vitest';
import { espectroDoPartido, ordemEspectro } from '../spectrum.js';

const partidos = [
  { sigla: 'PT', espectro: 'esquerda' as const },
  { sigla: 'PL', espectro: 'direita' as const },
];

describe('domain/spectrum', () => {
  it('resolve o espectro de um partido conhecido', () => {
    expect(espectroDoPartido('PT', partidos)).toBe('esquerda');
  });

  it('retorna indefinido para partido desconhecido', () => {
    expect(espectroDoPartido('PSOCIAL', partidos)).toBe('indefinido');
  });

  it('retorna indefinido para sigla nula (ex.: Brancos/nulos)', () => {
    expect(espectroDoPartido(null, partidos)).toBe('indefinido');
  });

  it('ordena espectros da esquerda para a direita', () => {
    expect(ordemEspectro('esquerda')).toBeLessThan(ordemEspectro('centro-esquerda'));
    expect(ordemEspectro('centro-esquerda')).toBeLessThan(ordemEspectro('centro'));
    expect(ordemEspectro('centro')).toBeLessThan(ordemEspectro('centro-direita'));
    expect(ordemEspectro('centro-direita')).toBeLessThan(ordemEspectro('direita'));
  });
});
