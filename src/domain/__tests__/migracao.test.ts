import { describe, expect, it } from 'vitest';
import estadosJson from '../../../data/analise/estados.json';
import geradorJson from '../../../data/analise/gerador.json';
import {
  comparecimentoNovoParaLula,
  deslocamentoDaMargem,
  margem1TDoisCandidatos,
  margem2T,
  margemVerdadeira,
  medidasDaArea,
  origensDeVoto,
  somarContagens,
  tetoDeX,
  xExigido,
  zerosCriadosPeloGerador,
  type ContagensDaArea,
} from '../migracao.js';

const estados = estadosJson as unknown as (ContagensDaArea & {
  uf: string;
  nome: string;
  taxaComparecimento: number;
})[];
const pais = somarContagens(estados);

describe('xExigido e margemVerdadeira', () => {
  it('com alvo zero devolve a própria margem observada — é identidade', () => {
    for (const m of [3.5704, 1, 10, 0.5]) {
      expect(xExigido(m, 0)).toBeCloseTo(m, 10);
    }
  });

  it('margemVerdadeira inverte xExigido', () => {
    for (const alvo of [0, -2.023, -2.1888, 1.5]) {
      const x = xExigido(3.5704, alvo);
      expect(margemVerdadeira(3.5704, x)).toBeCloseTo(alvo, 9);
    }
  });

  it('o X que o Brasil exigiria em cada cenário', () => {
    const m2 = margem2T(pais);
    const m1 = margem1TDoisCandidatos(pais);
    expect(m2).not.toBeNull();
    expect(m1).not.toBeNull();
    // Empatar o 2º turno; repetir o 1º turno; dar o que as pesquisas diziam.
    expect(xExigido(m2 as number, 0)).toBeCloseTo(3.5704, 3);
    expect(xExigido(m2 as number, m1 as number)).toBeCloseTo(5.4824, 2);
    expect(xExigido(m2 as number, -2.1888)).toBeCloseTo(5.6358, 3);
  });

  it('no teto que as seções permitem, Lula continua na frente', () => {
    const m2 = margem2T(pais) as number;
    // Teto só com o 2º turno (296 votos intocados) e somando os dois (586).
    expect(margemVerdadeira(m2, tetoDeX(296, 0.001))).toBeCloseTo(1.2935, 3);
    expect(margemVerdadeira(m2, tetoDeX(586, 0.001))).toBeCloseTo(2.4269, 3);
    expect(margemVerdadeira(m2, tetoDeX(296, 0.001))).toBeGreaterThan(0);
    expect(margemVerdadeira(m2, tetoDeX(586, 0.001))).toBeGreaterThan(0);
  });
});

describe('tetoDeX', () => {
  it('reproduz os tetos publicados', () => {
    expect(tetoDeX(296, 0.001)).toBeCloseTo(2.3067, 4);
    expect(tetoDeX(586, 0.001)).toBeCloseTo(1.1719, 4);
  });

  it('mais votos intocados aperta o teto', () => {
    expect(tetoDeX(586, 0.001)).toBeLessThan(tetoDeX(296, 0.001));
  });

  it('recusa entrada sem sentido em vez de devolver NaN', () => {
    expect(() => tetoDeX(0, 0.001)).toThrow(/positivo/);
    expect(() => tetoDeX(296, 0)).toThrow(/\(0,1\)/);
    expect(() => tetoDeX(296, 1)).toThrow(/\(0,1\)/);
  });
});

describe('zerosCriadosPeloGerador', () => {
  it('fecha com a conta fechada num caso de brinquedo', () => {
    // 100 seções com 1 voto observado: F verdadeiro = 1/(1−0,5) = 2, e
    // P(os dois trocados) = 0,5² = 0,25.
    expect(zerosCriadosPeloGerador({ '1': 100 }, 50)).toBeCloseTo(25, 10);
  });

  it('ignora a própria casa do zero e X fora de (0,1)', () => {
    expect(zerosCriadosPeloGerador({ '0': 9999 }, 50)).toBe(0);
    expect(zerosCriadosPeloGerador({ '1': 100 }, 0)).toBe(0);
    expect(zerosCriadosPeloGerador({ '1': 100 }, 100)).toBe(0);
  });

  it('na distribuição real, um gerador no teto cria uns três zeros, não 106', () => {
    const dist = geradorJson.flavioPorSecao as Readonly<Record<string, number>>;
    const zeradas = geradorJson.secoesZeradas.find((z) => z.caso === 'flavio');
    expect(zeradas?.secoes).toBe(106);
    const criados = zerosCriadosPeloGerador(dist, tetoDeX(296, 0.001));
    expect(criados).toBeGreaterThan(1);
    expect(criados).toBeLessThan(6);
    // E cresce com X, mas nem o X que empataria a eleição chega perto de 106.
    expect(zerosCriadosPeloGerador(dist, 3.5704)).toBeGreaterThan(criados);
    expect(zerosCriadosPeloGerador(dist, 5.6358)).toBeLessThan(20);
  });
});

describe('as bases do 1º turno não são a mesma coisa', () => {
  it('a margem de dois candidatos difere da margem sobre todos os válidos', () => {
    const doisCandidatos = margem1TDoisCandidatos(pais) as number;
    const todosOsValidos = (100 * (pais.lula1T - pais.flavio1T)) / pais.validos1T;
    expect(doisCandidatos).toBeCloseTo(-2.023, 2);
    expect(todosOsValidos).toBeCloseTo(-1.8649, 3);
    expect(doisCandidatos).not.toBeCloseTo(todosOsValidos, 2);
  });

  it('o deslocamento comparável é maior que a diferença das margens publicadas', () => {
    expect(deslocamentoDaMargem(pais) as number).toBeCloseTo(5.5934, 2);
  });
});

describe('medidasDaArea', () => {
  it('reproduz os totais do país', () => {
    const m = medidasDaArea(pais);
    expect(pais.lula2T - pais.lula1T).toBe(10_376_696);
    expect(pais.deOutrasOrigens + pais.travessiaLiquida).toBe(10_376_696);
    expect(m.pctLula2T as number).toBeCloseTo(51.7852, 3);
    expect(m.abstencao1T as number).toBeCloseTo(21.0836, 3);
    expect(m.abstencao2T as number).toBeCloseTo(19.2188, 3);
    expect(m.pctTravessia as number).toBeCloseTo(2.8771, 3);
    expect(pais.aptos1T).toBe(pais.aptos2T);
  });

  it('TODO estado exige X acima do teto — é isto que derruba a taxa única', () => {
    const teto = tetoDeX(296, 0.001);
    const xs = estados.map((e) => medidasDaArea(e).xExigido).filter((v): v is number => v !== null);
    expect(xs).toHaveLength(28);
    expect(Math.min(...xs)).toBeGreaterThan(teto);
    expect(Math.min(...xs)).toBeCloseTo(3.3865, 3);
    expect(Math.max(...xs)).toBeCloseTo(7.685, 3);
  });

  it('declara ausência em vez de inventar zero quando não há denominador', () => {
    const vazia = somarContagens([]);
    const m = medidasDaArea(vazia);
    expect(m.pctLula2T).toBeNull();
    expect(m.abstencao1T).toBeNull();
    expect(m.xExigido).toBeNull();
  });
});

describe('origensDeVoto', () => {
  it('zera origem que encolheu, porque pedaço negativo em barra não significa nada', () => {
    const encolheu: ContagensDaArea = { ...pais, comparecimentoNovo: -5000 };
    const origens = origensDeVoto(encolheu);
    const cmp = origens.find((o) => o.chave === 'comparecimentoNovo');
    expect(cmp?.votos).toBe(0);
    expect(origens).toHaveLength(7);
  });

  it('no país, as sete origens somam o bloco sem dono', () => {
    const total = origensDeVoto(pais).reduce((a, o) => a + o.votos, 0);
    expect(total).toBe(
      pais.cury1T + pais.renan1T + pais.caiado1T + pais.zema1T +
      pais.outrosEliminados1T + pais.brancoNuloRecuperado + pais.comparecimentoNovo,
    );
  });
});

describe('comparecimentoNovoParaLula', () => {
  it('usa a taxa de cada estado, e o líquido é pequeno diante do deslocamento', () => {
    const paraLula = comparecimentoNovoParaLula(estados);
    const liquido = paraLula - (pais.comparecimentoNovo - paraLula);
    const emPontos = (100 * liquido) / pais.validos2T;
    expect(paraLula).toBeGreaterThan(1_800_000);
    expect(paraLula).toBeLessThan(2_000_000);
    expect(emPontos).toBeCloseTo(0.6706, 2);
    expect(emPontos).toBeLessThan((deslocamentoDaMargem(pais) as number) / 5);
  });
});
