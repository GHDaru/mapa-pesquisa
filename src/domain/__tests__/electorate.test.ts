import { describe, expect, it } from 'vitest';
import { criarEleitorado, type DadosEleitorado } from '../electorate.js';

const VALIDO: DadosEleitorado = {
  uf: 'SP',
  eleitores: 34_667_793,
  referencia: '2026-07',
  fonte: { nome: 'TSE — Estatísticas do eleitorado', url: 'https://exemplo.test' },
};

describe('domain/electorate', () => {
  it('cria um Eleitorado válido', () => {
    const eleitorado = criarEleitorado(VALIDO);
    expect(eleitorado.uf).toBe('SP');
    expect(eleitorado.eleitores).toBe(34_667_793);
    expect(eleitorado.referencia).toBe('2026-07');
    expect(eleitorado.fonte.nome).toBe('TSE — Estatísticas do eleitorado');
  });

  it('aceita referência apenas com o ano', () => {
    const eleitorado = criarEleitorado({ ...VALIDO, referencia: '2026' });
    expect(eleitorado.referencia).toBe('2026');
  });

  it('rejeita UF inválida', () => {
    expect(() => criarEleitorado({ ...VALIDO, uf: 'XX' })).toThrow();
  });

  it('rejeita UF "BR" (eleitorado é sempre por UF, não nacional)', () => {
    expect(() => criarEleitorado({ ...VALIDO, uf: 'BR' })).toThrow();
  });

  it('rejeita eleitores não inteiro', () => {
    expect(() => criarEleitorado({ ...VALIDO, eleitores: 100.5 })).toThrow();
  });

  it('rejeita eleitores zero ou negativo', () => {
    expect(() => criarEleitorado({ ...VALIDO, eleitores: 0 })).toThrow();
    expect(() => criarEleitorado({ ...VALIDO, eleitores: -10 })).toThrow();
  });

  it('rejeita referência em formato inválido', () => {
    expect(() => criarEleitorado({ ...VALIDO, referencia: '07/2026' })).toThrow();
  });

  it('rejeita fonte sem nome ou url', () => {
    expect(() => criarEleitorado({ ...VALIDO, fonte: { nome: '', url: 'https://x.test' } })).toThrow();
    expect(() => criarEleitorado({ ...VALIDO, fonte: { nome: 'TSE', url: '' } })).toThrow();
  });

  it('mensagem de erro identifica a UF', () => {
    expect(() => criarEleitorado({ ...VALIDO, eleitores: -1 })).toThrowError(/SP/);
  });
});
