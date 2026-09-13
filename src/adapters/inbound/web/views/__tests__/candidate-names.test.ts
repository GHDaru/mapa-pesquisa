import { describe, expect, it } from 'vitest';
import { nomeCurto, nomeCurtissimo } from '../candidate-names.js';

describe('candidate-names: nomeCurto — apelidos cadastrados', () => {
  it('Luiz Inácio Lula da Silva -> Lula', () => {
    expect(nomeCurto('Luiz Inácio Lula da Silva')).toBe('Lula');
  });

  it('Flávio Bolsonaro mantém nome e sobrenome no rótulo "normal"', () => {
    expect(nomeCurto('Flávio Bolsonaro')).toBe('Flávio Bolsonaro');
  });

  it('Augusto Cury -> Cury', () => {
    expect(nomeCurto('Augusto Cury')).toBe('Cury');
  });

  it('Ronaldo Caiado -> Caiado', () => {
    expect(nomeCurto('Ronaldo Caiado')).toBe('Caiado');
  });

  it('Romeu Zema -> Zema', () => {
    expect(nomeCurto('Romeu Zema')).toBe('Zema');
  });

  it('Renan Santos mantém o primeiro nome (Santos é sobrenome ambíguo)', () => {
    expect(nomeCurto('Renan Santos')).toBe('Renan Santos');
  });

  it('Pablo Marçal -> Marçal', () => {
    expect(nomeCurto('Pablo Marçal')).toBe('Marçal');
  });

  it('é insensível a maiúsculas/espaços extras na chave de busca', () => {
    expect(nomeCurto('  luiz inácio LULA da silva  ')).toBe('Lula');
  });
});

describe('candidate-names: nomeCurtissimo', () => {
  it('Flávio Bolsonaro -> Flávio (miniatura mais apertada que o gráfico grande)', () => {
    expect(nomeCurtissimo('Flávio Bolsonaro')).toBe('Flávio');
  });

  it('sem apelido "curtissimo" cadastrado, cai para o mesmo valor de nomeCurto', () => {
    expect(nomeCurtissimo('Ronaldo Caiado')).toBe('Caiado');
    expect(nomeCurtissimo('Luiz Inácio Lula da Silva')).toBe('Lula');
  });
});

describe('candidate-names: regra genérica (sem apelido cadastrado)', () => {
  it('usa o último sobrenome quando ele não é ambíguo', () => {
    expect(nomeCurto('Fulano de Andrade')).toBe('Andrade');
  });

  it('ignora partículas "de/da/do/dos/das" ao achar o último sobrenome', () => {
    expect(nomeCurto('José Eduardo dos Reis')).toBe('Reis');
  });

  it('mantém o primeiro nome quando o sobrenome é ambíguo (Silva, Santos, Oliveira, Souza, Pereira, Lima, Costa)', () => {
    expect(nomeCurto('João Silva')).toBe('João Silva');
    expect(nomeCurto('Maria Costa')).toBe('Maria Costa');
    expect(nomeCurto('Carlos Alberto de Souza')).toBe('Carlos Souza');
  });

  it('nome de um único token retorna o próprio nome', () => {
    expect(nomeCurto('Marçal')).toBe('Marçal');
  });
});
