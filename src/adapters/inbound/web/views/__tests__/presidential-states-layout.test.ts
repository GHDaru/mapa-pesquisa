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
  padEsquerdoMiniChart,
  pctCobertura,
  pontosDaBase,
  RAIO_PONTO,
  rotuloVantagemMini,
  serieCandidatoPorDia,
  temEvolucaoParaLinha,
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

describe('presidential-states-layout: RAIO_PONTO e padEsquerdoMiniChart', () => {
  it('todo ponto tem o mesmo raio — o tamanho não codifica mais a amostra', () => {
    // A escala por amostra saiu por dois motivos: assumia 1000 entrevistados
    // onde a fonte não publicou amostra (11 dos 63 pontos do 1º turno) e
    // variava só de 6,31 a 7,24px de raio nos dados reais, sem legenda nenhuma.
    expect(RAIO_PONTO).toBe(6);
  });

  it('reserva o raio do ponto mais 2px de folga (nenhum ponto em cx=0 é cortado)', () => {
    expect(padEsquerdoMiniChart()).toBe(RAIO_PONTO + 2);
    expect(padEsquerdoMiniChart()).toBeGreaterThanOrEqual(RAIO_PONTO);
  });
});

describe('presidential-states-layout: pontosDaBase', () => {
  const pontos = [
    { pollId: 'p-antiga', data: '2026-06-21', candidato: 'Lula' },
    { pollId: 'p-usada', data: '2026-09-16', candidato: 'Lula' },
    { pollId: 'p-usada', data: '2026-09-16', candidato: 'Flávio Bolsonaro' },
  ];

  it('só deixa passar os pontos das pesquisas que o agregado declarou usar', () => {
    // Caso real: Piauí no 2º turno declarava "1 pesquisa · 16/09/2026" e
    // desenhava 21/06 e 16/09, uma tendência sobre 87 dias de vão.
    const base = pontosDaBase(pontos, new Set(['p-usada']));
    expect(base.map((p) => p.data)).toEqual(['2026-09-16', '2026-09-16']);
  });

  it('com todas as pesquisas usadas, não descarta nada', () => {
    expect(pontosDaBase(pontos, new Set(['p-antiga', 'p-usada']))).toHaveLength(3);
  });

  it('base vazia não desenha ponto nenhum', () => {
    expect(pontosDaBase(pontos, new Set())).toEqual([]);
  });

  it('o que o gráfico desenha e o que o rótulo declara saem do mesmo conjunto', () => {
    const idsUsados = new Set(['p-usada']);
    const datas = new Set(pontosDaBase(pontos, idsUsados).map((p) => p.data));
    expect(datas.size).toBe(1);
    expect(temEvolucaoParaLinha([...datas])).toBe(false);
  });
});

describe('presidential-states-layout: pctCobertura', () => {
  it('não imprime casa decimal quando o valor é exato', () => {
    // "cobre 100,0%" duas linhas acima de uma ressalva que diz que uma UF está
    // fora da janela é precisão falsa.
    expect(pctCobertura(10, 10)).toBe('100%');
    expect(pctCobertura(5, 10)).toBe('50%');
  });

  it('imprime uma casa decimal quando ela é real, com vírgula', () => {
    expect(pctCobertura(992, 1000)).toBe('99,2%');
    expect(pctCobertura(966, 1000)).toBe('96,6%');
  });

  it('total zero não vira divisão por zero', () => {
    expect(pctCobertura(0, 0)).toBe('0%');
  });
});

describe('presidential-states-layout: serieCandidatoPorDia', () => {
  const dominio = { minIso: '2026-08-01', maxIso: '2026-08-05' };

  it('extrai (data, pct) de um candidato, ignorando os demais', () => {
    const dias = [
      { data: '2026-08-01', valores: { Lula: 40, Flávio: 38 } },
      { data: '2026-08-02', valores: { Lula: 41, Flávio: 37 } },
    ];
    expect(serieCandidatoPorDia(dias, 'Lula', dominio)).toEqual([
      { data: '2026-08-01', pct: 40 },
      { data: '2026-08-02', pct: 41 },
    ]);
  });

  it('produz 1 único ponto para o dia em que 2 pesquisas foram publicadas (sem laço)', () => {
    // Cenário do bug MG/TO: 2 pesquisas do mesmo estado com datas de
    // referência iguais (aqui, 40% e 46% brutos no mesmo dia). Uma linha
    // interpolando os pontos brutos teria 2 pontos empilhados no mesmo x
    // (mais o ponto final), o que faz a suavização Catmull-Rom cruzar a si
    // mesma e formar um laço. `dias` já chega agregado (1 valor por data —
    // a média ponderada das 2 pesquisas), então o resultado tem 1 só ponto
    // nessa data, e a linha nunca pode laçar.
    const dias = [{ data: '2026-08-01', valores: { Lula: 43 } }, { data: '2026-08-03', valores: { Lula: 42 } }];
    const resultado = serieCandidatoPorDia(dias, 'Lula', dominio);
    const datas = resultado.map((p) => p.data);
    expect(new Set(datas).size).toBe(datas.length);
    expect(resultado).toEqual([
      { data: '2026-08-01', pct: 43 },
      { data: '2026-08-03', pct: 42 },
    ]);
  });

  it('ignora dias fora do intervalo [minIso, maxIso] do domínio', () => {
    const dias = [
      { data: '2026-07-20', valores: { Lula: 39 } },
      { data: '2026-08-03', valores: { Lula: 42 } },
      { data: '2026-09-01', valores: { Lula: 44 } },
    ];
    expect(serieCandidatoPorDia(dias, 'Lula', dominio)).toEqual([{ data: '2026-08-03', pct: 42 }]);
  });

  it('ignora dias em que o candidato não tem valor', () => {
    const dias = [
      { data: '2026-08-01', valores: { Lula: 40 } },
      { data: '2026-08-02', valores: {} },
    ];
    expect(serieCandidatoPorDia(dias, 'Lula', dominio)).toEqual([{ data: '2026-08-01', pct: 40 }]);
  });

  it('retorna lista vazia quando não há nenhum dia no domínio', () => {
    expect(serieCandidatoPorDia([], 'Lula', dominio)).toEqual([]);
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

describe('presidential-states-layout: temEvolucaoParaLinha', () => {
  it('falso para 0 ou 1 data (nada para suavizar)', () => {
    expect(temEvolucaoParaLinha([])).toBe(false);
    expect(temEvolucaoParaLinha(['2026-09-01'])).toBe(false);
  });

  it('falso quando todas as pesquisas caem na mesma data (caso MG/TO — 2 institutos no mesmo dia)', () => {
    expect(temEvolucaoParaLinha(['2026-09-01', '2026-09-01', '2026-09-01'])).toBe(false);
  });

  it('verdadeiro para 2+ datas distintas, mesmo bem afastadas no tempo (caso Goiás: 112 dias de diferença)', () => {
    expect(temEvolucaoParaLinha(['2026-05-12', '2026-09-01'])).toBe(true);
  });

  it('não depende da quantidade de pesquisas usadas pelo agregado (janela de recência) — só das datas plotadas', () => {
    // Regressão do bug confirmado em GO/AC/RO: `agregado.pesquisasUsadas`
    // pode ter só 1 item (a pesquisa antiga caiu fora da janela de 45 dias),
    // mas `serie.pontos` continua tendo os 2 pontos reais — o gate deve se
    // basear nas datas realmente desenhadas, não no tamanho de
    // `pesquisasUsadas`.
    const datasDaSerieAcre = ['2026-07-25', '2026-08-26']; // Real Time Big Data + Quaest, 32 dias de diferença
    expect(temEvolucaoParaLinha(datasDaSerieAcre)).toBe(true);
  });

  it('verdadeiro mesmo com datas repetidas, desde que haja pelo menos 2 distintas', () => {
    expect(temEvolucaoParaLinha(['2026-07-15', '2026-07-15', '2026-08-24'])).toBe(true);
  });
});
