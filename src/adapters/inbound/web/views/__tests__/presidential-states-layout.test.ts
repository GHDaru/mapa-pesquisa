import { describe, expect, it } from 'vitest';
import {
  calcularDominioY,
  calcularQuantis,
  caminhoSuavizado,
  classificarPorQuantil,
  diasEntreIso,
  escalaX,
  escalaY,
  formatarEleitorado,
  formatarVantagemTitulo,
  ordenarParaGrade,
  raioAmostra,
  rotuloVantagemMini,
} from '../presidential-states-layout.js';

describe('presidential-states-layout: ordenarParaGrade', () => {
  it('ordena por eleitorado decrescente quando todos têm pesquisa', () => {
    const itens = [
      { uf: 'RR', eleitores: 300_000, semDados: false },
      { uf: 'SP', eleitores: 35_000_000, semDados: false },
      { uf: 'BA', eleitores: 11_000_000, semDados: false },
    ];
    const ordenado = ordenarParaGrade(itens).map((i) => i.uf);
    expect(ordenado).toEqual(['SP', 'BA', 'RR']);
  });

  it('empurra estados sem pesquisa para o fim, mesmo com eleitorado grande', () => {
    const itens = [
      { uf: 'SP', eleitores: 35_000_000, semDados: true },
      { uf: 'RR', eleitores: 300_000, semDados: false },
      { uf: 'BA', eleitores: 11_000_000, semDados: false },
    ];
    const ordenado = ordenarParaGrade(itens).map((i) => i.uf);
    expect(ordenado).toEqual(['BA', 'RR', 'SP']);
  });

  it('não muta o array de entrada', () => {
    const itens = [
      { uf: 'B', eleitores: 1, semDados: false },
      { uf: 'A', eleitores: 2, semDados: false },
    ];
    const copia = [...itens];
    ordenarParaGrade(itens);
    expect(itens).toEqual(copia);
  });

  it('trata eleitorado nulo como o menor valor dentro do mesmo grupo', () => {
    const itens = [
      { uf: 'X', eleitores: null, semDados: false },
      { uf: 'Y', eleitores: 500, semDados: false },
    ];
    expect(ordenarParaGrade(itens).map((i) => i.uf)).toEqual(['Y', 'X']);
  });
});

describe('presidential-states-layout: calcularQuantis / classificarPorQuantil', () => {
  it('retorna 4 breakpoints para 5 classes', () => {
    const valores = Array.from({ length: 27 }, (_, i) => (i + 1) * 100_000);
    expect(calcularQuantis(valores, 5)).toHaveLength(4);
  });

  it('retorna lista vazia para amostra vazia', () => {
    expect(calcularQuantis([], 5)).toEqual([]);
  });

  it('classifica o menor valor na classe 0 e o maior na última classe', () => {
    const valores = Array.from({ length: 27 }, (_, i) => (i + 1) * 100_000);
    const breakpoints = calcularQuantis(valores, 5);
    expect(classificarPorQuantil(Math.min(...valores), breakpoints)).toBe(0);
    expect(classificarPorQuantil(Math.max(...valores), breakpoints)).toBe(4);
  });

  it('distribui quantidades aproximadamente iguais entre as 5 classes', () => {
    const valores = Array.from({ length: 100 }, (_, i) => i + 1);
    const breakpoints = calcularQuantis(valores, 5);
    const contagem = [0, 0, 0, 0, 0];
    for (const v of valores) contagem[classificarPorQuantil(v, breakpoints)]! += 1;
    for (const c of contagem) {
      expect(c).toBeGreaterThanOrEqual(18);
      expect(c).toBeLessThanOrEqual(22);
    }
  });

  it('um valor exatamente igual a um breakpoint fica na classe abaixo (limite inclusivo à esquerda)', () => {
    const breakpoints = [10, 20, 30, 40];
    expect(classificarPorQuantil(20, breakpoints)).toBe(1);
    expect(classificarPorQuantil(20.0001, breakpoints)).toBe(2);
  });
});

describe('presidential-states-layout: formatarEleitorado', () => {
  it('formata milhões com vírgula decimal', () => {
    expect(formatarEleitorado(157_800_000)).toBe('157,8 milhões');
  });

  it('usa singular "milhão" quando arredonda para 1,0', () => {
    expect(formatarEleitorado(1_020_000)).toBe('1,0 milhão');
  });

  it('formata milhares como "X mil" abaixo de 1 milhão', () => {
    expect(formatarEleitorado(614_631)).toBe('614,6 mil');
  });

  it('formata números abaixo de mil sem sufixo', () => {
    expect(formatarEleitorado(950)).toBe('950');
  });
});

describe('presidential-states-layout: diasEntreIso / escalaX', () => {
  it('calcula a diferença em dias entre duas datas ISO', () => {
    expect(diasEntreIso('2026-08-01', '2026-08-11')).toBe(10);
    expect(diasEntreIso('2026-08-11', '2026-08-01')).toBe(-10);
  });

  it('escalaX mapeia a data mínima em 0 e a máxima na largura total', () => {
    const dominio = { minIso: '2026-08-01', maxIso: '2026-08-11' };
    expect(escalaX('2026-08-01', dominio, 200)).toBe(0);
    expect(escalaX('2026-08-11', dominio, 200)).toBe(200);
    expect(escalaX('2026-08-06', dominio, 200)).toBeCloseTo(100, 5);
  });

  it('escalaX centraliza o ponto quando o domínio é um único dia (span <= 0)', () => {
    const dominio = { minIso: '2026-08-01', maxIso: '2026-08-01' };
    expect(escalaX('2026-08-01', dominio, 240)).toBe(120);
  });
});

describe('presidential-states-layout: calcularDominioY / escalaY', () => {
  it('domínio padrão (sem valores) fica centrado em 50 com a folga pedida', () => {
    expect(calcularDominioY([], 4)).toEqual({ min: 46, max: 54 });
  });

  it('sempre inclui 50 mesmo quando todos os valores estão bem acima', () => {
    const dominio = calcularDominioY([70, 75, 72]);
    expect(dominio.min).toBeLessThanOrEqual(50);
    expect(dominio.max).toBeGreaterThanOrEqual(75);
  });

  it('amplia valores muito próximos para nunca achatar a linha (amplitude mínima)', () => {
    const dominio = calcularDominioY([49, 51], 4);
    expect(dominio.max - dominio.min).toBeGreaterThanOrEqual(8);
  });

  it('nunca extrapola o intervalo [0, 100]', () => {
    const dominio = calcularDominioY([1, 2, 3], 10);
    expect(dominio.min).toBeGreaterThanOrEqual(0);
    expect(dominio.max).toBeLessThanOrEqual(100);
  });

  it('escalaY: o topo da altura útil corresponde ao maior valor do domínio', () => {
    const dominio = { min: 40, max: 60 };
    expect(escalaY(60, dominio, 100)).toBe(0);
    expect(escalaY(40, dominio, 100)).toBe(100);
    expect(escalaY(50, dominio, 100)).toBeCloseTo(50, 5);
  });

  it('escalaY clampa valores fora do domínio em vez de extrapolar', () => {
    const dominio = { min: 40, max: 60 };
    expect(escalaY(1000, dominio, 100)).toBe(0);
    expect(escalaY(-1000, dominio, 100)).toBe(100);
  });
});

describe('presidential-states-layout: caminhoSuavizado', () => {
  it('retorna string vazia para 0 ou 1 ponto', () => {
    expect(caminhoSuavizado([])).toBe('');
    expect(caminhoSuavizado([{ x: 10, y: 10 }])).toBe('');
  });

  it('com 2 pontos, desenha uma reta (M seguido de L)', () => {
    const d = caminhoSuavizado([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ]);
    expect(d).toMatch(/^M0\.00,0\.00 L10\.00,20\.00$/);
  });

  it('com 3+ pontos, começa com M e usa curvas C (Catmull-Rom -> Bézier)', () => {
    const d = caminhoSuavizado([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
      { x: 30, y: 5 },
    ]);
    expect(d.startsWith('M0.00,10.00')).toBe(true);
    expect(d).toContain('C');
    // Uma curva por segmento entre pontos consecutivos.
    expect(d.match(/C/g)).toHaveLength(3);
  });
});

describe('presidential-states-layout: raioAmostra', () => {
  it('amostra na referência padrão (1000) produz o raio de referência (mínimo + 3px)', () => {
    expect(raioAmostra(1000)).toBeCloseTo(6, 5);
  });

  it('amostra maior produz raio maior, mas nunca acima do máximo', () => {
    expect(raioAmostra(4000)).toBeGreaterThan(raioAmostra(1000));
    expect(raioAmostra(1_000_000)).toBeLessThanOrEqual(9);
  });

  it('amostra ausente (null) usa a referência padrão sem lançar erro', () => {
    expect(raioAmostra(null)).toBeCloseTo(raioAmostra(1000), 5);
  });

  it('nunca fica abaixo do raio mínimo, mesmo com amostra minúscula', () => {
    expect(raioAmostra(1)).toBeGreaterThanOrEqual(3);
  });
});

describe('presidential-states-layout: formatarVantagemTitulo', () => {
  it('uma casa decimal (vírgula) quando o valor é menor que 10', () => {
    expect(formatarVantagemTitulo(2.3)).toBe('+2,3');
    expect(formatarVantagemTitulo(0.4)).toBe('+0,4');
    expect(formatarVantagemTitulo(9.96)).toBe('+10,0');
  });

  it('sem casa decimal (inteiro arredondado) a partir de 10', () => {
    expect(formatarVantagemTitulo(15)).toBe('+15');
    expect(formatarVantagemTitulo(10.2)).toBe('+10');
  });
});

describe('presidential-states-layout: rotuloVantagemMini', () => {
  it('sem líder (sem pesquisa estadual)', () => {
    expect(rotuloVantagemMini(null, 0, false)).toBe('Sem pesquisa estadual');
  });

  it('empate técnico tem prioridade sobre o cálculo de vantagem', () => {
    expect(rotuloVantagemMini('Lula', 0.5, true)).toBe('Empate técnico');
  });

  it('vantagem abaixo de 10 pontos usa uma casa decimal', () => {
    expect(rotuloVantagemMini('Harris', 0.4, false)).toBe('Harris +0,4');
    expect(rotuloVantagemMini('Trump', 1.4, false)).toBe('Trump +1,4');
    expect(rotuloVantagemMini('Lula', 2.5, false)).toBe('Lula +2,5');
  });

  it('vantagem >= 10 pontos usa número inteiro, sem casa decimal', () => {
    expect(rotuloVantagemMini('Lula', 15.2, false)).toBe('Lula +15');
  });
});
