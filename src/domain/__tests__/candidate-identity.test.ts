import { describe, expect, it } from 'vitest';
import { apelidosDoCandidato, mesmoCandidato } from '../candidate-identity.js';

describe('apelidosDoCandidato', () => {
  it('separa o nome do apelido entre parênteses', () => {
    expect(apelidosDoCandidato('João Henrique Caldas (JHC)')).toEqual([
      'joao henrique caldas',
      'jhc',
    ]);
  });

  it('devolve só o nome quando não há parênteses', () => {
    expect(apelidosDoCandidato('Tarcísio de Freitas')).toEqual(['tarcisio de freitas']);
  });

  it('não quebra com nome que é só o apelido entre parênteses', () => {
    expect(apelidosDoCandidato('(JHC)')).toEqual(['(jhc)', 'jhc']);
  });
});

describe('mesmoCandidato', () => {
  /**
   * O caso que originou o módulo: o resultado oficial de Alagoas traz "JHC" e
   * as pesquisas traziam "João Henrique Caldas (JHC)". Sem casar os dois, o
   * mapa declarava que as pesquisas erraram em Alagoas — uma afirmação falsa
   * sobre o mundo.
   */
  it('casa o apelido do resultado com o nome completo da pesquisa', () => {
    expect(mesmoCandidato('JHC', 'João Henrique Caldas (JHC)')).toBe(true);
    expect(mesmoCandidato('João Henrique Caldas (JHC)', 'JHC')).toBe(true);
  });

  it('ignora acento e caixa', () => {
    expect(mesmoCandidato('tarcisio de freitas', 'Tarcísio de Freitas')).toBe(true);
  });

  it('NÃO casa por substring — "Zucco" não é "Zuccolotto"', () => {
    expect(mesmoCandidato('Zucco', 'Zuccolotto')).toBe(false);
  });

  it('NÃO casa por primeiro nome — no ES há dois Ricardos diferentes', () => {
    expect(mesmoCandidato('Ricardo Ferraço', 'Ricardo Cappelli')).toBe(false);
  });

  it('candidatos diferentes continuam diferentes', () => {
    expect(mesmoCandidato('Eduardo Paes', 'Douglas Ruas')).toBe(false);
    expect(mesmoCandidato('Hana Ghassan', 'Dr. Daniel')).toBe(false);
  });

  it('nome vazio não casa com nada, nem com outro vazio', () => {
    expect(mesmoCandidato('', 'JHC')).toBe(false);
    expect(mesmoCandidato('', '')).toBe(false);
  });
});
