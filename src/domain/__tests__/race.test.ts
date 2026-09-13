import { describe, expect, it } from 'vitest';
import { criarDisputa, disputaId, UFS } from '../race.js';

describe('domain/race', () => {
  it('cria disputa presidencial nacional', () => {
    const disputa = criarDisputa('BR', 'presidente', 1);
    expect(disputa.uf).toBe('BR');
    expect(disputaId(disputa)).toBe('BR-presidente-t1');
  });

  it('aceita disputa presidencial estadual (pesquisa por UF)', () => {
    const disputa = criarDisputa('SP', 'presidente', 1);
    expect(disputa.uf).toBe('SP');
    expect(disputaId(disputa)).toBe('SP-presidente-t1');
  });

  it('rejeita presidente com UF desconhecida (nem BR nem UF válida)', () => {
    expect(() => criarDisputa('XX', 'presidente', 1)).toThrow();
  });

  it('rejeita governador com UF "BR"', () => {
    expect(() => criarDisputa('BR', 'governador', 1)).toThrow();
  });

  it('rejeita UF desconhecida para senador', () => {
    expect(() => criarDisputa('XX', 'senador', 1)).toThrow();
  });

  it('rejeita turno inválido', () => {
    // @ts-expect-error turno inválido de propósito
    expect(() => criarDisputa('SP', 'governador', 3)).toThrow();
  });

  it('lista as 27 UFs', () => {
    expect(UFS).toHaveLength(27);
    expect(UFS).toContain('SP');
    expect(UFS).not.toContain('BR');
  });

  it('disputaId distingue turnos', () => {
    const t1 = criarDisputa('SP', 'governador', 1);
    const t2 = criarDisputa('SP', 'governador', 2);
    expect(disputaId(t1)).not.toBe(disputaId(t2));
  });
});
