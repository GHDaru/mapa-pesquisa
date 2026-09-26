import { describe, expect, it } from 'vitest';
import { classificarConfianca } from '../../../../../domain/aggregate.js';
import type { CandidatoEstimado, UfOrigemVotos, VotosCandidatoUf } from '../../../../../domain/vote-estimate.js';
import {
  calcularEscalaBarraComparacao,
  calcularEscalaGrafico,
  calcularVantagemAgregada,
  formatarMilhoes,
  formatarPontos,
  margemPontosDoCandidato,
  montarItensLegenda,
  montarSegmentosBarra,
  origensPresentes,
  quantidadeDeOrigens,
  razaoNaoAtribuidosSobreVantagem,
  rotuloVantagemAgregada,
  rotuloVereditoMargem,
  temAsteriscoNaTabela,
  temColunaOutros,
  textoSaltoNaoAtribuidos,
  textoQuebraNaoAtribuidos,
  textoVantagemAgregada,
} from '../vote-estimate-panel.js';

describe('vote-estimate-panel/formatarMilhoes', () => {
  it('formata votos em milhões com 1 casa decimal e vírgula pt-BR', () => {
    expect(formatarMilhoes(62_300_000)).toBe('62,3 milhões');
  });

  it('arredonda para 1 casa decimal', () => {
    expect(formatarMilhoes(1_234_567)).toBe('1,2 milhões');
  });

  it('formata zero como "0,0 milhões"', () => {
    expect(formatarMilhoes(0)).toBe('0,0 milhões');
  });

  it('formata valores menores que 1 milhão corretamente', () => {
    expect(formatarMilhoes(900_000)).toBe('0,9 milhões');
  });

  it('aceita número de casas decimais customizado', () => {
    expect(formatarMilhoes(62_400_000, 2)).toBe('62,40 milhões');
  });
});

describe('vote-estimate-panel/montarSegmentosBarra', () => {
  it('as 3 proporções somam 100 quando há votos', () => {
    const seg = montarSegmentosBarra({
      votos: 1_000_000,
      votosDeUfComPesquisa: 600_000,
      votosComplementoNacional: 150_000,
      votosDeUfSemPesquisa: 250_000,
    });
    expect(seg.pctEstadual + seg.pctComplemento + seg.pctSemPesquisa).toBeCloseTo(100, 6);
  });

  it('calcula a proporção correta de cada origem', () => {
    const seg = montarSegmentosBarra({
      votos: 1_000_000,
      votosDeUfComPesquisa: 600_000,
      votosComplementoNacional: 150_000,
      votosDeUfSemPesquisa: 250_000,
    });
    expect(seg.pctEstadual).toBeCloseTo(60, 6);
    expect(seg.pctComplemento).toBeCloseTo(15, 6);
    expect(seg.pctSemPesquisa).toBeCloseTo(25, 6);
  });

  it('quando só há uma origem, ela sozinha soma 100', () => {
    const seg = montarSegmentosBarra({
      votos: 500_000,
      votosDeUfComPesquisa: 500_000,
      votosComplementoNacional: 0,
      votosDeUfSemPesquisa: 0,
    });
    expect(seg).toEqual({ pctEstadual: 100, pctComplemento: 0, pctSemPesquisa: 0 });
  });

  it('candidato sem nenhum voto estimado (total 0) não divide por zero: os 3 segmentos ficam em 0', () => {
    const seg = montarSegmentosBarra({
      votos: 0,
      votosDeUfComPesquisa: 0,
      votosComplementoNacional: 0,
      votosDeUfSemPesquisa: 0,
    });
    expect(seg).toEqual({ pctEstadual: 0, pctComplemento: 0, pctSemPesquisa: 0 });
    expect(seg.pctEstadual + seg.pctComplemento + seg.pctSemPesquisa).toBe(0);
  });
});

describe('vote-estimate-panel/calcularEscalaBarraComparacao', () => {
  it('calcula a posição da barra e da faixa de incerteza relativas à maior votosMax da tela', () => {
    const escala = calcularEscalaBarraComparacao(
      { votos: 60_000_000, votosMin: 58_000_000, votosMax: 62_000_000 },
      100_000_000,
    );
    expect(escala.pctBarra).toBeCloseTo(60, 6);
    expect(escala.pctMin).toBeCloseTo(58, 6);
    expect(escala.pctMax).toBeCloseTo(62, 6);
  });

  it('candidato líder (maior votosMax da tela) nunca extrapola 100% da escala', () => {
    const candidato = { votos: 62_000_000, votosMin: 60_000_000, votosMax: 64_000_000 };
    const escala = calcularEscalaBarraComparacao(candidato, candidato.votosMax);
    expect(escala.pctMax).toBeCloseTo(100, 6);
    expect(escala.pctBarra).toBeLessThanOrEqual(100);
  });

  it('candidato pequeno tem barra e faixa proporcionalmente muito menores que o líder', () => {
    const maiorVotosMax = 64_000_000; // votosMax do líder
    const pequeno = calcularEscalaBarraComparacao({ votos: 200_000, votosMin: 150_000, votosMax: 250_000 }, maiorVotosMax);
    const lider = calcularEscalaBarraComparacao({ votos: 62_000_000, votosMin: 60_000_000, votosMax: 64_000_000 }, maiorVotosMax);
    expect(pequeno.pctBarra).toBeLessThan(1);
    expect(lider.pctBarra).toBeGreaterThan(90);
  });

  it('sempre pctMin <= pctBarra <= pctMax (a faixa contém o ponto estimado)', () => {
    const casos = [
      { votos: 62_000_000, votosMin: 60_000_000, votosMax: 64_000_000 },
      { votos: 200_000, votosMin: 100_000, votosMax: 300_000 },
      { votos: 0, votosMin: 0, votosMax: 0 },
    ];
    for (const c of casos) {
      const escala = calcularEscalaBarraComparacao(c, 64_000_000);
      expect(escala.pctMin).toBeLessThanOrEqual(escala.pctBarra + 1e-9);
      expect(escala.pctBarra).toBeLessThanOrEqual(escala.pctMax + 1e-9);
    }
  });

  it('retorna os 3 valores em 0 quando a maior votosMax da tela é 0 (sem dividir por zero)', () => {
    const escala = calcularEscalaBarraComparacao({ votos: 0, votosMin: 0, votosMax: 0 }, 0);
    expect(escala).toEqual({ pctBarra: 0, pctMin: 0, pctMax: 0 });
  });
});

/* ===================================================================== *
 * Vantagem entre os dois primeiros, empate técnico agregado, escala do
 * gráfico e limpeza de copy/colunas herdadas do 1º turno.
 * Os números usados nos cenários "2º turno" e "1º turno" são os que a
 * página realmente calcula hoje com data/*.json (ver
 * `application/use-cases/get-vote-estimate.ts`), para os testes falharem
 * se a leitura editorial da tela deixar de bater com a estimativa.
 * ===================================================================== */

const ELEITORADO = 157_827_925;

function candidato(
  nome: string,
  votos: number,
  margemVotos: number,
  extras: Partial<CandidatoEstimado> = {},
): CandidatoEstimado {
  return {
    candidato: nome,
    partido: null,
    votos,
    votosMin: Math.max(0, votos - margemVotos),
    votosMax: votos + margemVotos,
    pctDoEleitorado: (votos / ELEITORADO) * 100,
    pctDosVotosAtribuidos: 0,
    votosDeUfComPesquisa: votos,
    votosDeUfSemPesquisa: 0,
    votosComplementoNacional: 0,
    ...extras,
  };
}

// 2º turno (Lula x Flávio Bolsonaro): 46,3% x 45,0%, margem agregada de ±2,2 pt.
const LULA_T2 = candidato('Luiz Inácio Lula da Silva', 73_148_118, 3_432_502);
const FLAVIO_T2 = candidato('Flávio Bolsonaro', 70_948_926, 3_432_502);
// 1º turno: 39,7% x 34,7%, mesma ordem de margem — vantagem de ~4,9 pt.
const LULA_T1 = candidato('Luiz Inácio Lula da Silva', 62_585_490, 3_471_162);
const FLAVIO_T1 = candidato('Flávio Bolsonaro', 54_824_865, 3_471_162);

function uf(nome: string, votosPorCandidato: Record<string, VotosCandidatoUf>): UfOrigemVotos {
  return { uf: nome, eleitores: 1_000_000, origem: 'estadual', foraDaJanela: false, votosPorCandidato };
}

const estadual = (votos: number): VotosCandidatoUf => ({ votos, origem: 'estadual' });
const complemento = (votos: number): VotosCandidatoUf => ({ votos, origem: 'complemento-nacional' });

describe('vote-estimate-panel/margemPontosDoCandidato', () => {
  it('converte a semi-margem de votos para pontos do eleitorado total', () => {
    expect(margemPontosDoCandidato(LULA_T2, ELEITORADO)).toBeCloseTo(2.1748, 3);
  });

  it('não divide por zero quando não há eleitorado', () => {
    expect(margemPontosDoCandidato(LULA_T2, 0)).toBe(0);
  });

  it('nunca é negativa', () => {
    expect(margemPontosDoCandidato({ votos: 100, votosMax: 90 }, 1_000)).toBe(0);
  });
});

describe('vote-estimate-panel/calcularVantagemAgregada', () => {
  it('no 2º turno acusa empate técnico: 1,4 pt de vantagem contra ±2,2 pt de margem', () => {
    const v = calcularVantagemAgregada([LULA_T2, FLAVIO_T2], ELEITORADO)!;
    expect(v.lider).toBe('Luiz Inácio Lula da Silva');
    expect(v.segundo).toBe('Flávio Bolsonaro');
    expect(v.votos).toBeCloseTo(2_199_192, 0);
    expect(v.pontos).toBeCloseTo(1.3934, 3);
    expect(v.margemPontos).toBeCloseTo(2.1748, 3);
    expect(v.nivel).toBe('empate');
    expect(v.empateTecnico).toBe(true);
  });

  it('no 1º turno, com 4,9 pt de vantagem, NÃO é empate técnico', () => {
    const v = calcularVantagemAgregada([LULA_T1, FLAVIO_T1], ELEITORADO)!;
    expect(v.pontos).toBeCloseTo(4.9171, 3);
    expect(v.empateTecnico).toBe(false);
    expect(v.nivel).toBe('folga');
  });

  it('classifica como acirrada quando a vantagem supera a margem mas não o dobro', () => {
    const margem = 1_500_000; // ~0,95 pt
    const a = candidato('A', 50_000_000, margem);
    const b = candidato('B', 47_500_000, margem); // ~1,58 pt de vantagem
    const v = calcularVantagemAgregada([a, b], ELEITORADO)!;
    expect(v.nivel).toBe('acirrada');
    expect(v.empateTecnico).toBe(false);
  });

  it('usa exatamente o critério do domínio (classificarConfianca), não um critério próprio', () => {
    const casos: readonly [number, number][] = [
      [3_432_502, 3_432_502],
      [1_000_000, 5_000_000],
      [6_000_000, 1_000_000],
    ];
    for (const [margemA, margemB] of casos) {
      const a = candidato('A', 60_000_000, margemA);
      const b = candidato('B', 55_000_000, margemB);
      const v = calcularVantagemAgregada([a, b], ELEITORADO)!;
      expect(v.nivel).toBe(classificarConfianca(v.pontos, v.margemPontos));
      expect(v.empateTecnico).toBe(v.pontos <= v.margemPontos);
    }
  });

  it('é conservador: usa a MAIOR das duas semi-margens', () => {
    const a = candidato('A', 60_000_000, 1_000_000);
    const b = candidato('B', 55_000_000, 9_000_000);
    const v = calcularVantagemAgregada([a, b], ELEITORADO)!;
    expect(v.margemPontos).toBeCloseTo(margemPontosDoCandidato(b, ELEITORADO), 6);
    expect(v.empateTecnico).toBe(true);
  });

  it('empate técnico na fronteira: vantagem exatamente igual à margem ainda é empate', () => {
    const margem = 1_578_279.25; // exatamente 1 pt do eleitorado
    const a = candidato('A', 50_000_000, margem);
    const b = candidato('B', 50_000_000 - margem, margem);
    const v = calcularVantagemAgregada([a, b], ELEITORADO)!;
    expect(v.pontos).toBeCloseTo(v.margemPontos, 9);
    expect(v.empateTecnico).toBe(true);
  });

  it('devolve null com menos de dois candidatos — não inventa um empate', () => {
    expect(calcularVantagemAgregada([], ELEITORADO)).toBeNull();
    expect(calcularVantagemAgregada([LULA_T2], ELEITORADO)).toBeNull();
  });

  it('não quebra nem divide por zero com eleitorado zerado', () => {
    const v = calcularVantagemAgregada(
      [candidato('A', 0, 0), candidato('B', 0, 0)],
      0,
    )!;
    expect(v.pontos).toBe(0);
    expect(v.margemPontos).toBe(0);
    expect(v.votos).toBe(0);
  });
});

describe('vote-estimate-panel/formatarPontos', () => {
  it('formata pontos com vírgula e sufixo "pt"', () => {
    expect(formatarPontos(1.3934)).toBe('1,4 pt');
    expect(formatarPontos(2.1748)).toBe('2,2 pt');
  });

  it('não mostra sinal (o texto já diz de quem é a vantagem)', () => {
    expect(formatarPontos(-1.3)).toBe('1,3 pt');
  });
});

describe('vote-estimate-panel/texto da vantagem', () => {
  it('diz a vantagem em votos E em pontos', () => {
    const v = calcularVantagemAgregada([LULA_T2, FLAVIO_T2], ELEITORADO)!;
    expect(rotuloVantagemAgregada(v)).toBe(
      'Vantagem de Luiz Inácio Lula da Silva: 2,2 milhões de votos · 1,4 pt',
    );
  });

  it('diz explicitamente que a diferença cabe na margem: empate técnico', () => {
    const v = calcularVantagemAgregada([LULA_T2, FLAVIO_T2], ELEITORADO)!;
    expect(rotuloVereditoMargem(v)).toBe(
      'dentro da margem de erro agregada (±2,2 pt): empate técnico',
    );
  });

  it('fora da margem, não fala em empate: diz que a liderança está acima dela', () => {
    const v = calcularVantagemAgregada([LULA_T1, FLAVIO_T1], ELEITORADO)!;
    expect(rotuloVereditoMargem(v)).toContain('margem de erro agregada (±2,2 pt)');
    expect(rotuloVereditoMargem(v)).toContain('liderança com folga');
    expect(rotuloVereditoMargem(v)).not.toContain('empate');
  });

  it('a frase completa do 2º turno casa com a busca por vantagem/empate técnico no painel', () => {
    const v = calcularVantagemAgregada([LULA_T2, FLAVIO_T2], ELEITORADO)!;
    const texto = textoVantagemAgregada(v);
    expect(texto).toMatch(/vantagem|diferença entre|à frente|empate técnico/i);
    expect(texto).toMatch(/empate técnico/i);
    expect(texto.endsWith('.')).toBe(true);
  });
});

describe('vote-estimate-panel/calcularEscalaGrafico', () => {
  it('no 2º turno desenha a marca de 50% do eleitorado dentro da escala', () => {
    const escala = calcularEscalaGrafico([LULA_T2, FLAVIO_T2], ELEITORADO);
    expect(escala.metadeEleitorado).toBe(ELEITORADO / 2);
    expect(escala.pctMetadeEleitorado).not.toBeNull();
    expect(escala.pctMetadeEleitorado!).toBeGreaterThan(0);
    expect(escala.pctMetadeEleitorado!).toBeLessThan(100);
  });

  it('a marca de 50% fica além da faixa de incerteza de todo mundo (ninguém a alcança)', () => {
    const escala = calcularEscalaGrafico([LULA_T2, FLAVIO_T2], ELEITORADO);
    const pctMaiorFaixa = (LULA_T2.votosMax / escala.max) * 100;
    expect(escala.pctMetadeEleitorado!).toBeGreaterThan(pctMaiorFaixa);
  });

  it('no 1º turno a marca não cabe e a escala continua sendo a maior faixa de incerteza', () => {
    const candidatos = [LULA_T1, FLAVIO_T1, candidato('Augusto Cury', 8_304_753, 3_137_857)];
    const escala = calcularEscalaGrafico(candidatos, ELEITORADO);
    expect(escala.pctMetadeEleitorado).toBeNull();
    expect(escala.max).toBe(Math.max(...candidatos.map((c) => c.votosMax)));
  });

  it('sem eleitorado ou sem candidatos, não há marca de 50%', () => {
    expect(calcularEscalaGrafico([LULA_T2], 0).pctMetadeEleitorado).toBeNull();
    expect(calcularEscalaGrafico([], ELEITORADO)).toEqual({
      max: 0,
      metadeEleitorado: ELEITORADO / 2,
      pctMetadeEleitorado: null,
    });
  });

  it('a escala sempre acomoda a maior faixa de incerteza', () => {
    const escala = calcularEscalaGrafico([LULA_T2, FLAVIO_T2], ELEITORADO);
    expect(escala.max).toBeGreaterThanOrEqual(LULA_T2.votosMax);
  });
});

describe('vote-estimate-panel/origens e legenda', () => {
  it('no 2º turno só existe a origem estadual', () => {
    const origens = origensPresentes([LULA_T2, FLAVIO_T2]);
    expect(origens).toEqual({ estadual: true, complemento: false, semPesquisa: false });
    expect(quantidadeDeOrigens(origens)).toBe(1);
  });

  it('com uma única origem a legenda não ensina uma chave de cores que o gráfico não usa', () => {
    const itens = montarItensLegenda(origensPresentes([LULA_T2, FLAVIO_T2]), true, ELEITORADO / 2);
    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.texto)).toEqual([
      'Faixa = margem de erro agregada',
      'Linha tracejada = 50% do eleitorado (78,9 milhões de votos)',
    ]);
  });

  it('com barra empilhada a legenda traz só as origens presentes', () => {
    const comComplemento = candidato('Augusto Cury', 8_304_753, 3_137_857, {
      votosDeUfComPesquisa: 4_417_927,
      votosComplementoNacional: 3_886_826,
    });
    const itens = montarItensLegenda(origensPresentes([LULA_T1, comComplemento]), true, null);
    expect(itens.map((i) => i.texto)).toEqual([
      'Votos de UFs com pesquisa estadual',
      'Complemento nacional em UFs com pesquisa',
      'Faixa = margem de erro agregada',
    ]);
  });

  it('sem faixa e sem marca de 50%, uma origem única deixa a legenda vazia', () => {
    expect(montarItensLegenda(origensPresentes([LULA_T2, FLAVIO_T2]), false, null)).toEqual([]);
  });
});

describe('vote-estimate-panel/colunas e marcadores da tabela por UF', () => {
  const ufsT2 = [
    uf('SP', { 'Flávio Bolsonaro': estadual(17_021_213), 'Luiz Inácio Lula da Silva': estadual(15_127_291) }),
    uf('MG', { 'Flávio Bolsonaro': estadual(7_215_454), 'Luiz Inácio Lula da Silva': estadual(6_945_587) }),
  ];

  it('no 2º turno a coluna "Outros" não tem nenhum valor e não deve existir', () => {
    expect(temColunaOutros(ufsT2)).toBe(false);
  });

  it('a coluna "Outros" existe quando alguma UF tem um 3º nome com voto', () => {
    const comTerceiro = [...ufsT2, uf('BA', { A: estadual(10), B: estadual(9), C: estadual(8) })];
    expect(temColunaOutros(comTerceiro)).toBe(true);
  });

  it('um 3º nome zerado não ressuscita a coluna "Outros"', () => {
    const terceiroZerado = [uf('BA', { A: estadual(10), B: estadual(9), C: estadual(0) })];
    expect(temColunaOutros(terceiroZerado)).toBe(false);
  });

  it('no 2º turno não há nenhum "*" na tabela — e portanto nenhuma nota de "*"', () => {
    expect(temAsteriscoNaTabela(ufsT2)).toBe(false);
  });

  it('só há "*" quando um dos dois primeiros da UF veio do complemento nacional', () => {
    const complementadoForaDoTop2 = [uf('BA', { A: estadual(10), B: estadual(9), C: complemento(8) })];
    expect(temAsteriscoNaTabela(complementadoForaDoTop2)).toBe(false);

    const complementadoNoTop2 = [uf('BA', { A: estadual(10), B: complemento(9) })];
    expect(temAsteriscoNaTabela(complementadoNoTop2)).toBe(true);
  });
});

describe('vote-estimate-panel/não atribuídos', () => {
  // Números reais do recorte (26/09): dois terços do resíduo do 2º turno são
  // percentual que nenhuma fonte publicou.
  const naoAtribuidosT2 = {
    votos: 13_730_881,
    pct: 8.6999,
    declarados: { votos: 4_513_000, pct: 2.8598 },
    semLinhaPublicada: { votos: 9_217_881, pct: 5.8401 },
  };
  const naoAtribuidosT1 = {
    votos: 4_044_005,
    pct: 2.5623,
    declarados: { votos: 1_040_000, pct: 0.6589 },
    semLinhaPublicada: { votos: 3_004_005, pct: 1.9034 },
  };

  it('mede os não atribuídos em múltiplos da vantagem entre os dois primeiros', () => {
    const v = calcularVantagemAgregada([LULA_T2, FLAVIO_T2], ELEITORADO)!;
    const razao = razaoNaoAtribuidosSobreVantagem(naoAtribuidosT2.votos, v.votos)!;
    expect(razao).toBeCloseTo(6.24, 2);
  });

  it('sem vantagem (empate exato) não divide por zero', () => {
    expect(razaoNaoAtribuidosSobreVantagem(13_730_881, 0)).toBeNull();
  });

  it('diz de quanto foi o salto em relação ao 1º turno, com os dois números reais', () => {
    const texto = textoSaltoNaoAtribuidos(naoAtribuidosT2, naoAtribuidosT1, '1º turno')!;
    expect(texto).toContain('No 1º turno eram 4,0 milhões (2,6%)');
    expect(texto).toContain('3,4 vezes esse volume');
  });

  it('não explica o salto pelo comportamento do eleitor', () => {
    const texto = textoSaltoNaoAtribuidos(naoAtribuidosT2, naoAtribuidosT1, '1º turno')!;
    expect(texto).not.toMatch(/para onde ir|não escolhe|só dois nomes/i);
  });

  it('quebra o resíduo entre linha publicada e percentual não divulgado', () => {
    const texto = textoQuebraNaoAtribuidos(naoAtribuidosT2)!;
    expect(texto).toContain('4,5 milhões (2,9% do eleitorado)');
    expect(texto).toContain('9,2 milhões (5,8%)');
    expect(texto).toContain('nenhuma fonte divulgou');
    expect(texto).toContain('67,1%');
    expect(texto).toContain('lacuna de divulgação');
  });

  it('sem parcela descoberta, não mostra a quebra', () => {
    expect(
      textoQuebraNaoAtribuidos({
        votos: 1_000_000,
        pct: 1,
        declarados: { votos: 1_000_000, pct: 1 },
        semLinhaPublicada: { votos: 0, pct: 0 },
      }),
    ).toBeNull();
  });

  it('sem recorte anterior, não inventa comparação', () => {
    expect(textoSaltoNaoAtribuidos(naoAtribuidosT2, null, '1º turno')).toBeNull();
  });

  it('não divide por zero quando o recorte anterior não tinha não atribuídos', () => {
    const texto = textoSaltoNaoAtribuidos(
      naoAtribuidosT2,
      { votos: 0, pct: 0, declarados: { votos: 0, pct: 0 }, semLinhaPublicada: { votos: 0, pct: 0 } },
      '1º turno',
    )!;
    expect(texto).toContain('No 1º turno eram 0,0 milhões (0,0%)');
    expect(texto).not.toContain('vezes');
  });
});
