import { describe, expect, it } from 'vitest';
import { criarPartido } from '../party.js';

describe('domain/party', () => {
  it('cria um partido válido', () => {
    const pt = criarPartido({ sigla: 'PT', nome: 'Partido dos Trabalhadores', numero: 13, espectro: 'esquerda' });
    expect(pt.sigla).toBe('PT');
    expect(pt.espectro).toBe('esquerda');
  });

  it('rejeita sigla vazia', () => {
    expect(() =>
      criarPartido({ sigla: '', nome: 'Sem sigla', numero: 1, espectro: 'centro' }),
    ).toThrow();
  });

  it('rejeita espectro inválido', () => {
    expect(() =>
      criarPartido({ sigla: 'ZZ', nome: 'Partido Z', numero: 99, espectro: 'radical' }),
    ).toThrowError(/ZZ/);
  });

  it('rejeita número não positivo', () => {
    expect(() =>
      criarPartido({ sigla: 'ZZ', nome: 'Partido Z', numero: 0, espectro: 'centro' }),
    ).toThrow();
  });

  it('aceita federação e cor opcionais', () => {
    const partido = criarPartido({
      sigla: 'PL',
      nome: 'Partido Liberal',
      numero: 22,
      espectro: 'direita',
      federacao: 'Federação X',
      cor: '#ff0000',
    });
    expect(partido.federacao).toBe('Federação X');
    expect(partido.cor).toBe('#ff0000');
  });
});
