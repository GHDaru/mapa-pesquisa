import { describe, expect, it } from 'vitest';
import {
  atribuirTomSerie,
  caminhoSuavizado,
  calcularDominioY,
  criarEscalaLinear,
  criarEscalaTempo,
  dataParaMs,
  formatarRotuloDataCurta,
  gerarTicksTempo,
  gerarTicksY,
  raioPonto,
  RAIO_AMOSTRA_DESCONHECIDA,
} from '../timeline-chart.js';

describe('timeline-chart: calcularDominioY', () => {
  it('adiciona folga e arredonda para múltiplos de 5', () => {
    const dominio = calcularDominioY([38.9, 41.2, 12.5]);
    // min 12.5-3=9.5 -> floor a 5 -> 5; max 41.2+3=44.2 -> ceil a 5 -> 45
    expect(dominio).toEqual({ min: 5, max: 45 });
  });

  it('nunca desce abaixo de 0 nem passa de 100', () => {
    expect(calcularDominioY([1]).min).toBeGreaterThanOrEqual(0);
    expect(calcularDominioY([99]).max).toBeLessThanOrEqual(100);
  });

  it('retorna um domínio com largura mínima de um passo quando os valores são iguais', () => {
    const dominio = calcularDominioY([40, 40, 40]);
    expect(dominio.max).toBeGreaterThan(dominio.min);
  });

  it('lista vazia retorna domínio padrão [0, passo]', () => {
    expect(calcularDominioY([])).toEqual({ min: 0, max: 5 });
  });
});

describe('timeline-chart: gerarTicksY', () => {
  it('gera um tick a cada 5 pontos dentro do domínio', () => {
    expect(gerarTicksY({ min: 5, max: 25 })).toEqual([5, 10, 15, 20, 25]);
  });

  it('domínio não múltiplo de 5 gera ticks só nos múltiplos internos', () => {
    expect(gerarTicksY({ min: 7, max: 22 })).toEqual([10, 15, 20]);
  });
});

describe('timeline-chart: criarEscalaLinear', () => {
  it('mapeia o mínimo e o máximo do domínio para as extremidades do alcance', () => {
    const escala = criarEscalaLinear({ min: 0, max: 100 }, [0, 200]);
    expect(escala(0)).toBe(0);
    expect(escala(100)).toBe(200);
    expect(escala(50)).toBe(100);
  });

  it('domínio de largura 0 não gera NaN — retorna o centro do alcance', () => {
    const escala = criarEscalaLinear({ min: 40, max: 40 }, [0, 100]);
    expect(escala(40)).toBe(50);
  });
});

describe('timeline-chart: criarEscalaTempo', () => {
  it('mapeia datas ISO para px proporcionalmente aos dias decorridos', () => {
    const escala = criarEscalaTempo('2026-08-01', '2026-08-11', [0, 100]);
    expect(escala('2026-08-01')).toBe(0);
    expect(escala('2026-08-11')).toBe(100);
    expect(escala('2026-08-06')).toBeCloseTo(50, 5);
  });

  it('não sofre deslocamento de fuso horário (datas ISO puras)', () => {
    expect(dataParaMs('2026-01-01')).toBe(Date.UTC(2026, 0, 1));
  });
});

describe('timeline-chart: gerarTicksTempo', () => {
  it('usa ticks semanais para janelas curtas (<= 60 dias)', () => {
    const ticks = gerarTicksTempo('2026-08-01', '2026-08-22');
    expect(ticks.map((t) => t.data)).toEqual(['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22']);
  });

  it('usa ticks mensais para janelas longas (> 60 dias)', () => {
    const ticks = gerarTicksTempo('2026-01-15', '2026-05-01');
    // início + dia 1 de cada mês dentro do intervalo
    expect(ticks[0]!.data).toBe('2026-01-15');
    expect(ticks.some((t) => t.data === '2026-02-01')).toBe(true);
    expect(ticks.some((t) => t.data === '2026-03-01')).toBe(true);
    expect(ticks.some((t) => t.data === '2026-04-01')).toBe(true);
    expect(ticks.some((t) => t.data === '2026-05-01')).toBe(true);
  });
});

describe('timeline-chart: formatarRotuloDataCurta', () => {
  it('formata "8 set" a partir de uma data ISO', () => {
    expect(formatarRotuloDataCurta('2026-09-08')).toBe('8 set');
  });

  it('formata a virada de ano corretamente', () => {
    expect(formatarRotuloDataCurta('2026-10-04')).toBe('4 out');
  });
});

describe('timeline-chart: raioPonto', () => {
  it('cresce com a raiz quadrada da amostra, entre 3 e 7px', () => {
    const r300 = raioPonto(300);
    const r1200 = raioPonto(1200);
    const r5000 = raioPonto(5000);
    expect(r300).toBeGreaterThanOrEqual(3);
    expect(r5000).toBeLessThanOrEqual(7);
    expect(r300).toBeLessThan(r1200);
    expect(r1200).toBeLessThan(r5000);
  });

  it('satura no raio máximo acima da referência e usa um raio padrão sem amostra', () => {
    expect(raioPonto(50_000)).toBe(7);
    expect(raioPonto(null)).toBe(RAIO_AMOSTRA_DESCONHECIDA);
    expect(raioPonto(undefined)).toBe(RAIO_AMOSTRA_DESCONHECIDA);
  });
});

describe('timeline-chart: caminhoSuavizado', () => {
  it('lista vazia retorna string vazia', () => {
    expect(caminhoSuavizado([])).toBe('');
  });

  it('um único ponto retorna apenas "M x y"', () => {
    expect(caminhoSuavizado([{ x: 1, y: 2 }])).toBe('M 1 2');
  });

  it('dois pontos retornam uma reta "M.. L.."', () => {
    expect(caminhoSuavizado([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M 0 0 L 10 5');
  });

  it('três ou mais pontos retornam curvas de Bézier passando pelos pontos originais', () => {
    const d = caminhoSuavizado([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d).toContain('C ');
    // A curva deve terminar exatamente no último ponto de controle (20, 0).
    expect(d.trim().endsWith('20 0')).toBe(true);
  });
});

describe('timeline-chart: atribuirTomSerie', () => {
  it('primeira ocorrência de cada espectro usa o tom base', () => {
    expect(atribuirTomSerie(['esquerda', 'centro', 'direita'])).toEqual(['base', 'base', 'base']);
  });

  it('segunda ocorrência do mesmo espectro (ex.: dois candidatos de direita) usa o tom alt', () => {
    expect(atribuirTomSerie(['esquerda', 'direita', 'direita'])).toEqual(['base', 'base', 'alt']);
  });
});
