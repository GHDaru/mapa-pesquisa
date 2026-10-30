import { describe, expect, it } from 'vitest';
import type { AreaMedida } from '../../../../../domain/migracao.js';
import {
  escalaDaMedida,
  faixaDoValor,
  FAIXAS,
  hashDaAnalise,
  MEDIDAS,
  MEDIDA_PADRAO,
  medidaPorChave,
  MINIMO_DE_VALIDOS_NO_RANKING,
  nomeDaArea,
  paraRanking,
  parametrosDoHash,
  probabilidade,
  quantil,
  valorDaMedida,
} from '../analise-layout.js';

function area(parcial: Partial<AreaMedida>): AreaMedida {
  const base = {
    cod: null, uf: 'SP', nome: 'São Paulo',
    secoes: 0, aptos1T: 0, aptos2T: 0, comparecimento1T: 0, comparecimento2T: 0,
    validos1T: 0, validos2T: 0, lula1T: 0, flavio1T: 0, lula2T: 0, flavio2T: 0,
    blocoEliminado1T: 0, brancoNuloRecuperado: 0, comparecimentoNovo: 0,
    cury1T: 0, renan1T: 0, caiado1T: 0, zema1T: 0, outrosEliminados1T: 0,
    deOutrasOrigens: 0, travessiaLiquida: 0,
    pctLula1T: null, pctLula2T: null, deslocamento: null, pctBlocoEliminado: null,
    pctTravessia: null, abstencao1T: null, abstencao2T: null, deltaAbstencao: null,
    pctLula1TDoisCandidatos: null, pctFlavio1TDoisCandidatos: null,
    ganhoDoisCandidatos: null, xExigido: null,
  };
  return { ...base, ...parcial } as AreaMedida;
}

describe('quantil', () => {
  it('interpola entre os vizinhos', () => {
    expect(quantil([0, 10], 0.5)).toBe(5);
    expect(quantil([0, 10, 20], 0.5)).toBe(10);
    expect(quantil([5], 0.9)).toBe(5);
  });

  it('não estoura nas pontas nem com lista vazia', () => {
    expect(quantil([1, 2, 3], 0)).toBe(1);
    expect(quantil([1, 2, 3], 1)).toBe(3);
    expect(quantil([1, 2, 3], 5)).toBe(3);
    expect(Number.isNaN(quantil([], 0.5))).toBe(true);
  });
});

describe('escalaDaMedida', () => {
  it('sempre entrega 7 faixas, qualquer que seja a medida', () => {
    for (const medida of MEDIDAS) {
      const e = escalaDaMedida([1, 2, 3, 4, 5, 6, 7, 8, 9, 50], medida);
      expect(e?.cortes).toHaveLength(FAIXAS - 1);
    }
  });

  it('divergente é simétrica em torno da âncora', () => {
    const medida = medidaPorChave('deslocamento');
    const e = escalaDaMedida([-6, -3, 0, 3, 6], medida);
    const cortes = e?.cortes as number[];
    expect(cortes).toHaveLength(6);
    for (let i = 0; i < 3; i += 1) {
      expect(cortes[i] as number).toBeCloseTo(-(cortes[5 - i] as number), 10);
    }
  });

  it('sequencial corta por quantil, então faixa cheia mesmo com cauda longa', () => {
    const medida = medidaPorChave('ganhoLula');
    const valores = [1, 1, 2, 2, 3, 3, 4, 4, 5, 1_000_000];
    const e = escalaDaMedida(valores, medida);
    const cortes = e?.cortes as number[];
    expect(cortes[0] as number).toBeLessThan(10);
    // Os cortes sobem; nenhum empilhamento num extremo só.
    for (let i = 1; i < cortes.length; i += 1) {
      expect(cortes[i] as number).toBeGreaterThanOrEqual(cortes[i - 1] as number);
    }
  });

  it('sem valor nenhum devolve null em vez de uma escala falsa', () => {
    expect(escalaDaMedida([], MEDIDA_PADRAO)).toBeNull();
    expect(escalaDaMedida([Number.NaN], MEDIDA_PADRAO)).toBeNull();
  });
});

describe('faixaDoValor', () => {
  it('cresce com o valor e cobre as 7 faixas', () => {
    const medida = medidaPorChave('deslocamento');
    const e = escalaDaMedida([-6, -3, 0, 3, 6], medida);
    expect(faixaDoValor(e, -99)).toBe(0);
    expect(faixaDoValor(e, 99)).toBe(FAIXAS - 1);
    expect(faixaDoValor(e, 0)).toBe(3);
  });

  it('valor ausente não recebe cor', () => {
    const e = escalaDaMedida([1, 2, 3], MEDIDA_PADRAO);
    expect(faixaDoValor(e, null)).toBeNull();
    expect(faixaDoValor(null, 1)).toBeNull();
    expect(faixaDoValor(e, Number.NaN)).toBeNull();
  });
});

describe('valorDaMedida', () => {
  it('o ganho de Lula vem das contagens, não de um campo derivado', () => {
    const a = area({ lula1T: 100, lula2T: 150 });
    expect(valorDaMedida(a, medidaPorChave('ganhoLula'))).toBe(50);
  });

  it('medida sem valor na área devolve null', () => {
    expect(valorDaMedida(area({}), medidaPorChave('xExigido'))).toBeNull();
    expect(valorDaMedida(area({ xExigido: 4.2 }), medidaPorChave('xExigido'))).toBe(4.2);
  });
});

describe('o endereço da tela', () => {
  it('ida e volta preserva nível, medida e área', () => {
    const p = { nivel: 'municipios' as const, medida: medidaPorChave('xExigido'), area: '71072' };
    expect(parametrosDoHash(hashDaAnalise(p))).toEqual(p);
  });

  it('o padrão fica na rota limpa, sem parâmetro redundante', () => {
    expect(hashDaAnalise({ nivel: 'estados', medida: MEDIDA_PADRAO, area: null })).toBe('#/analise');
    expect(parametrosDoHash('#/analise')).toEqual({ nivel: 'estados', medida: MEDIDA_PADRAO, area: null });
  });

  it('parâmetro desconhecido cai no padrão em vez de quebrar a tela', () => {
    const p = parametrosDoHash('#/analise?nivel=bairros&medida=inventada&area=');
    expect(p.nivel).toBe('estados');
    expect(p.medida).toBe(MEDIDA_PADRAO);
    expect(p.area).toBeNull();
  });

  it('nome de município com espaço e acento sobrevive ao endereço', () => {
    const p = { nivel: 'municipios' as const, medida: MEDIDA_PADRAO, area: 'SÃO PAULO/SP' };
    expect(parametrosDoHash(hashDaAnalise(p)).area).toBe('SÃO PAULO/SP');
  });
});

describe('paraRanking', () => {
  it('no nível municipal corta os pequenos demais, e declara o corte', () => {
    const medida = medidaPorChave('deslocamento');
    const grande = area({ cod: '1', deslocamento: 5, validos2T: MINIMO_DE_VALIDOS_NO_RANKING });
    const pequeno = area({ cod: '2', deslocamento: 90, validos2T: 10 });
    expect(paraRanking([grande, pequeno], 'municipios', medida)).toEqual([grande]);
    expect(paraRanking([grande, pequeno], 'estados', medida)).toHaveLength(2);
  });

  it('área sem valor na medida nunca entra', () => {
    const semValor = area({ cod: '3', validos2T: 999_999 });
    expect(paraRanking([semValor], 'municipios', medidaPorChave('deslocamento'))).toHaveLength(0);
  });
});

describe('nomeDaArea', () => {
  it('município leva a UF ao lado; estado não', () => {
    const a = area({ cod: '1', nome: 'Bom Jesus', uf: 'GO' });
    expect(nomeDaArea(a, 'municipios')).toBe('Bom Jesus · GO');
    expect(nomeDaArea(a, 'estados')).toBe('Bom Jesus');
  });
});

describe('probabilidade', () => {
  it('não publica mantissa 10 — o caso que a tela mostrou', () => {
    // 9,99×10⁻⁵ arredonda a mantissa para 10,0; tem de virar 1,0×10⁻⁴.
    expect(probabilidade(9.99e-5)).toBe('1,0×10⁻⁴');
    expect(probabilidade(0.00049)).toBe('4,9×10⁻⁴');
  });

  it('vira notação científica só quando três casas perderiam o número', () => {
    // 0,0005 ainda aparece como 0,001; abaixo disso três casas dariam
    // "0,000", que não diz nada.
    expect(probabilidade(0.0005)).toBe('0,001');
    expect(probabilidade(0.00049)).toBe('4,9×10⁻⁴');
  });

  it('o mesmo número sai no mesmo formato, venha exato ou por arredondamento', () => {
    // (1 − X)^296 dá 0,00099999…, e a linha vizinha dá 0,001 cravado: as
    // duas têm de aparecer iguais na tabela.
    expect(probabilidade(0.0009999999)).toBe(probabilidade(0.001));
    expect(probabilidade(0.0009999999)).toBe('0,001');
  });

  it('acima de um milésimo escreve o número por extenso', () => {
    expect(probabilidade(0.001)).toBe('0,001');
    expect(probabilidade(0.5)).toBe('0,500');
  });

  it('escreve expoentes de dois dígitos em sobrescrito', () => {
    expect(probabilidade(3.49e-8)).toBe('3,5×10⁻⁸');
    expect(probabilidade(2.12e-5)).toBe('2,1×10⁻⁵');
    expect(probabilidade(1e-12)).toBe('1,0×10⁻¹²');
  });

  it('valor impossível vira travessão em vez de NaN na tela', () => {
    expect(probabilidade(0)).toBe('—');
    expect(probabilidade(Number.NaN)).toBe('—');
  });
});
