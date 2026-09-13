import { describe, expect, it } from 'vitest';
import {
  corEspectro,
  corEspectroSolido,
  formatarData,
  formatarNumeroPt,
  formatarPct,
  formatarVantagem,
  nivelConfianca,
  opacidadeConfianca,
  pluralizar,
  rotuloConfianca,
  rotuloEspectro,
} from '../format.js';

describe('formatarNumeroPt', () => {
  it('usa vírgula decimal e 1 casa por padrão', () => {
    expect(formatarNumeroPt(42.34)).toBe('42,3');
  });

  it('aceita número de casas customizado', () => {
    expect(formatarNumeroPt(3, 0)).toBe('3');
  });
});

describe('formatarPct', () => {
  it('formata com 1 casa, vírgula e sinal de percentual', () => {
    expect(formatarPct(42.34)).toBe('42,3%');
  });

  it('arredonda corretamente valores inteiros', () => {
    expect(formatarPct(50)).toBe('50,0%');
  });
});

describe('formatarData', () => {
  it('converte data ISO para dd/mm/aaaa', () => {
    expect(formatarData('2026-09-13')).toBe('13/09/2026');
  });

  it('ignora componente de hora quando presente', () => {
    expect(formatarData('2026-01-05T00:00:00Z')).toBe('05/01/2026');
  });

  it('devolve a string original quando não reconhece o formato', () => {
    expect(formatarData('data-invalida')).toBe('data-invalida');
  });
});

describe('formatarVantagem', () => {
  it('formata vantagem positiva com sinal de mais e "pts"', () => {
    expect(formatarVantagem(5.2)).toBe('+5,2 pts');
  });

  it('formata zero com sinal de mais', () => {
    expect(formatarVantagem(0)).toBe('+0,0 pts');
  });

  it('usa sinal de menos para valores negativos', () => {
    expect(formatarVantagem(-1.5)).toBe('−1,5 pts');
  });
});

describe('rotuloEspectro', () => {
  it('traduz cada espectro para um rótulo textual', () => {
    expect(rotuloEspectro('esquerda')).toBe('Esquerda');
    expect(rotuloEspectro('centro-direita')).toBe('Centro-direita');
    expect(rotuloEspectro('indefinido')).toBe('Não classificado');
  });
});

describe('pluralizar', () => {
  it('devolve a forma singular quando a quantidade é 1', () => {
    expect(pluralizar(1, 'a', 'as')).toBe('a');
  });

  it('devolve a forma plural para quantidade zero', () => {
    expect(pluralizar(0, 'a', 'as')).toBe('as');
  });

  it('devolve a forma plural para quantidade maior que 1', () => {
    expect(pluralizar(3, 'a', 'as')).toBe('as');
  });

  it('monta a concordância completa de "Ver a(s) N pesquisa(s) usada(s)"', () => {
    expect(`Ver ${pluralizar(1, 'a', 'as')} 1 pesquisa ${pluralizar(1, 'usada', 'usadas')}`).toBe(
      'Ver a 1 pesquisa usada',
    );
    expect(`Ver ${pluralizar(3, 'a', 'as')} 3 pesquisas ${pluralizar(3, 'usada', 'usadas')}`).toBe(
      'Ver as 3 pesquisas usadas',
    );
  });
});

describe('nivelConfianca', () => {
  it('classifica sem dados com prioridade sobre o cálculo', () => {
    expect(nivelConfianca(10, 3, true)).toBe('semDados');
  });

  it('classifica empate técnico quando vantagem <= margem', () => {
    expect(nivelConfianca(2, 3, false)).toBe('empate');
  });

  it('classifica corrida acirrada quando margem < vantagem < 2x margem', () => {
    expect(nivelConfianca(4, 3, false)).toBe('lean');
  });

  it('classifica liderança com folga quando vantagem >= 2x margem', () => {
    expect(nivelConfianca(7, 3, false)).toBe('solid');
  });
});

describe('corEspectro', () => {
  it('devolve a variável CSS de fill do espectro quando há confiança', () => {
    expect(corEspectro('esquerda', 'solid')).toBe('var(--spectrum-1-fill)');
    expect(corEspectro('direita', 'lean')).toBe('var(--spectrum-5-fill)');
  });

  it('ignora o espectro e devolve cinza neutro quando sem dados', () => {
    expect(corEspectro('esquerda', 'semDados')).toBe('var(--confidence-sem-dados-fill)');
  });

  it('devolve a cor neutra para espectro indefinido', () => {
    expect(corEspectro('indefinido', 'solid')).toBe('var(--spectrum-indefinido)');
  });
});

describe('corEspectroSolido', () => {
  it('devolve a variável CSS -solid do espectro', () => {
    expect(corEspectroSolido('centro')).toBe('var(--spectrum-3-solid)');
  });
});

describe('opacidadeConfianca', () => {
  it('mapeia cada nível para a variável CSS de opacidade correspondente', () => {
    expect(opacidadeConfianca('solid')).toBe('var(--confidence-solid-opacity)');
    expect(opacidadeConfianca('lean')).toBe('var(--confidence-lean-opacity)');
    expect(opacidadeConfianca('empate')).toBe('var(--confidence-empate-opacity)');
    expect(opacidadeConfianca('semDados')).toBe('1');
  });
});

describe('rotuloConfianca', () => {
  it('devolve um rótulo textual para cada nível de confiança', () => {
    expect(rotuloConfianca('solid')).toBe('Lidera com folga');
    expect(rotuloConfianca('empate')).toBe('Empate técnico');
    expect(rotuloConfianca('semDados')).toBe('Sem dados');
  });
});
