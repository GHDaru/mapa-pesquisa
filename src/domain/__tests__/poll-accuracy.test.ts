import { describe, expect, it } from 'vitest';
import {
  ALERTAS_POR_INSTITUTO,
  medirAcertoDasPesquisas,
  pctValidosDaPesquisa,
} from '../poll-accuracy.js';
import { criarPesquisa, type DadosPesquisa } from '../poll.js';

/**
 * Testes com fixtures. A medição de acerto é feita uma vez por eleição e o
 * ranking que ela produz é afirmação forte sobre o trabalho de institutos
 * reais — então cada decisão de método tem um teste que falha se ela mudar
 * sem que alguém perceba.
 */

const FONTE = { nome: 'Fixture', url: 'https://exemplo.invalido' };

function pesquisa(
  instituto: string,
  dataFim: string,
  resultados: readonly [string, number][],
  extra: Partial<DadosPesquisa> = {},
) {
  return criarPesquisa({
    id: `${dataFim}-${instituto.toLowerCase().replace(/\s+/g, '-')}-br-presidente-t1`,
    uf: 'BR',
    cargo: 'presidente',
    turno: 1,
    instituto,
    registroTSE: null,
    contratante: null,
    dataInicio: dataFim,
    dataFim,
    publicadoEm: dataFim,
    amostra: 2000,
    margem: 2,
    cenario: 'estimulada, 1º turno',
    fonte: FONTE,
    resultados: resultados.map(([candidato, pct]) => ({ candidato, partido: null, pct })),
    ...extra,
  } as DadosPesquisa);
}

/** Identifica linha de não-candidato nas fixtures. */
const ehNaoCandidato = (r: string) => /branco|nulo|indecis|não sabe/i.test(r);

/** Resultado de referência em base de válidos: A 50, B 42, C 8. */
const RESULTADO = new Map([
  ['A', 50],
  ['B', 42],
  ['C', 8],
]);

describe('base de válidos nas duas pontas', () => {
  it('renormaliza a pesquisa pela soma dos seus próprios candidatos', () => {
    const p = pesquisa('X', '2026-10-02', [
      ['A', 45],
      ['B', 36],
      ['C', 9],
      ['Brancos/nulos', 7],
      ['Indecisos', 3],
    ]);
    const pct = pctValidosDaPesquisa(p, ehNaoCandidato);
    expect(pct.get('A')).toBeCloseTo(50, 6);
    expect(pct.get('B')).toBeCloseTo(40, 6);
    expect(pct.get('C')).toBeCloseTo(10, 6);
    expect([...pct.values()].reduce((t, v) => t + v, 0)).toBeCloseTo(100, 6);
    // As linhas de não-candidato não entram nem como chave.
    expect(pct.has('Brancos/nulos')).toBe(false);
  });

  it('pesquisa sem candidato nenhum não produz divisão por zero', () => {
    const p = pesquisa('X', '2026-10-02', [['Brancos/nulos', 100]]);
    expect(pctValidosDaPesquisa(p, ehNaoCandidato).size).toBe(0);
  });
});

describe('uma pesquisa por instituto: a última', () => {
  it('ignora as rodadas anteriores do mesmo instituto', () => {
    const r = medirAcertoDasPesquisas(
      [
        pesquisa('X', '2026-08-01', [['A', 20], ['B', 70], ['C', 10]]),
        pesquisa('X', '2026-10-02', [['A', 50], ['B', 42], ['C', 8]]),
      ],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(r.institutos).toHaveLength(1);
    expect(r.institutos[0]!.dataReferencia).toBe('2026-10-02');
    // A rodada de agosto, grosseiramente errada, não contamina a média.
    expect(r.institutos[0]!.erroMedioAbsoluto).toBeCloseTo(0, 6);
  });

  it('declara quantos dias antes da eleição a pesquisa saiu', () => {
    const r = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-09-13', [['A', 50], ['B', 42], ['C', 8]])],
      RESULTADO,
      ehNaoCandidato,
    );
    // 13/09 a 04/10 são 21 dias — é o que torna o ranking comparável ou não.
    expect(r.institutos[0]!.diasAntes).toBe(21);
  });
});

describe('os dois erros medem coisas diferentes, e é por isso que há dois', () => {
  it('um instituto pode acertar a margem errando os dois níveis', () => {
    // A margem real é 8 (50 − 42). Os candidatos desta pesquisa somam 100, de
    // modo que a renormalização não altera nada: a margem sai 46 − 38 = 8,
    // exata, mas cada candidato erra vários pontos.
    //
    // Nota de método: a primeira versão deste teste usava [46, 38, 8] mais 8
    // de indecisos, e falhou. A margem bruta era 8, mas depois de renormalizar
    // pelos 92 de candidatos ela virava 8,7 — a renormalização escala a margem
    // junto. Para margem exata, os candidatos precisam somar 100.
    const r = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-10-02', [['A', 46], ['B', 38], ['C', 16]])],
      RESULTADO,
      ehNaoCandidato,
    );
    const i = r.institutos[0]!;
    expect(r.margemReal).toBeCloseTo(8, 6);
    expect(i.erroNaMargem).toBeCloseTo(0, 1);
    expect(i.erroMedioAbsoluto).toBeGreaterThan(0.5);
  });

  it('erro na margem é positivo quando a pesquisa exagera a vantagem de quem venceu', () => {
    const exagera = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-10-02', [['A', 60], ['B', 32], ['C', 8]])],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(exagera.institutos[0]!.erroNaMargem).toBeGreaterThan(0);

    const subestima = medirAcertoDasPesquisas(
      [pesquisa('Y', '2026-10-02', [['A', 44], ['B', 48], ['C', 8]])],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(subestima.institutos[0]!.erroNaMargem).toBeLessThan(0);
  });

  it('a margem é medida entre o 1º e o 2º DO RESULTADO, não os da pesquisa', () => {
    // Aqui a pesquisa inverte a ordem: dá B na frente. A margem ainda é medida
    // como A − B, para que o sinal signifique sempre a mesma coisa.
    const r = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-10-02', [['A', 40], ['B', 52], ['C', 8]])],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(r.primeiroESegundo).toEqual(['A', 'B']);
    expect(r.institutos[0]!.erroNaMargem).toBeCloseTo(40 - 52 - 8, 6);
    expect(r.institutos[0]!.acertouOLider).toBe(false);
  });
});

describe('ordenação e resumo do campo', () => {
  const dados = [
    pesquisa('Preciso', '2026-10-02', [['A', 50], ['B', 42], ['C', 8]]),
    pesquisa('Medio', '2026-10-02', [['A', 53], ['B', 39], ['C', 8]]),
    pesquisa('Ruim', '2026-10-02', [['A', 40], ['B', 52], ['C', 8]]),
  ];

  it('ordena por erro médio absoluto crescente', () => {
    const r = medirAcertoDasPesquisas(dados, RESULTADO, ehNaoCandidato);
    expect(r.institutos.map((i) => i.instituto)).toEqual(['Preciso', 'Medio', 'Ruim']);
  });

  it('conta quantos acertaram o líder', () => {
    const r = medirAcertoDasPesquisas(dados, RESULTADO, ehNaoCandidato);
    expect(r.acertaramOLider).toBe(2);
  });

  it('usa MEDIANA do campo, que resiste a um instituto muito fora', () => {
    const r = medirAcertoDasPesquisas(dados, RESULTADO, ehNaoCandidato);
    const comOutlier = medirAcertoDasPesquisas(
      [...dados, pesquisa('Absurdo', '2026-10-02', [['A', 5], ['B', 90], ['C', 5]])],
      RESULTADO,
      ehNaoCandidato,
    );
    const media = (xs: readonly number[]) => xs.reduce((t, v) => t + v, 0) / xs.length;
    const mediaAntes = media(r.institutos.map((i) => i.erroMedioAbsoluto));
    const mediaDepois = media(comOutlier.institutos.map((i) => i.erroMedioAbsoluto));

    const deslocamentoDaMediana = Math.abs(comOutlier.erroMedianoDoCampo! - r.erroMedianoDoCampo!);
    const deslocamentoDaMedia = Math.abs(mediaDepois - mediaAntes);

    // O invariante é a comparação, não um limiar arbitrário: a mediana tem de
    // se mover bem menos que a média diante do mesmo outlier. É por isso que o
    // resumo do campo usa mediana.
    expect(deslocamentoDaMediana).toBeLessThan(deslocamentoDaMedia / 2);
  });

  it('resultado sem segundo colocado não produz margem nem quebra', () => {
    const r = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-10-02', [['A', 100]])],
      new Map([['A', 100]]),
      ehNaoCandidato,
    );
    expect(r.margemReal).toBeNull();
    expect(r.primeiroESegundo).toBeNull();
    expect(r.institutos[0]!.erroNaMargem).toBeNull();
  });
});

describe('institutos sob ressalva são marcados, não removidos', () => {
  it('marca o alerta de integridade em vez de excluir do ranking', () => {
    const r = medirAcertoDasPesquisas(
      [
        pesquisa('Veritá', '2026-09-04', [['A', 50], ['B', 42], ['C', 8]]),
        pesquisa('Limpo', '2026-10-02', [['A', 50], ['B', 42], ['C', 8]]),
      ],
      RESULTADO,
      ehNaoCandidato,
    );
    // `criarPesquisa` canoniza o nome: "Veritá" é gravado como
    // "Instituto Veritá". Por isso o mapa de alertas cobre as duas grafias —
    // uma chave só deixaria o alerta de fora dependendo de como a ficha veio.
    const verita = r.institutos.find((i) => i.instituto === 'Instituto Veritá')!;
    // Está no ranking — removê-lo esconderia a comparação...
    expect(verita).toBeDefined();
    // ...mas carrega a ressalva, porque ler o número sem ela seria pior.
    expect(verita.alerta).toContain('integridade');
    expect(r.institutos.find((i) => i.instituto === 'Limpo')!.alerta).toBeNull();
  });

  it('o alerta do Real Time diz que a rodada nacional não foi alvo da suspensão', () => {
    expect(ALERTAS_POR_INSTITUTO['Real Time Big Data']).toContain('a rodada nacional não foi alvo');
  });
});

describe('candidato que uma das pontas não tem', () => {
  it('compara só os candidatos presentes nas duas, e declara quantos foram', () => {
    const r = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-10-02', [['A', 50], ['B', 42]])],
      RESULTADO,
      ehNaoCandidato,
    );
    // C está no resultado e não na pesquisa: fica fora, e a contagem diz 2.
    expect(r.institutos[0]!.candidatosComparados).toBe(2);
    expect(r.institutos[0]!.erroPorCandidato.map((e) => e.candidato)).toEqual(['A', 'B']);
  });

  it('instituto sem nenhum candidato em comum fica fora do ranking', () => {
    const r = medirAcertoDasPesquisas(
      [pesquisa('X', '2026-10-02', [['Z', 100]])],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(r.institutos).toHaveLength(0);
    expect(r.erroMedianoDoCampo).toBeNull();
  });
});

describe('direção do erro: ruído amostral ou viés de campo', () => {
  /*
   * A estatística que um ranking esconde. Erro espalhado nas duas direções é
   * ruído, e cada instituto responde pelo seu. Erro concentrado numa direção é
   * viés de campo — algo que todos os desenhos de amostra erraram junto.
   *
   * No 1º turno de 2026 isso não foi hipotético: 15 dos 16 institutos
   * subestimaram a margem do primeiro colocado.
   */
  it('conta separadamente quem subestimou e quem superestimou a margem', () => {
    const r = medirAcertoDasPesquisas(
      [
        // Subestimam a margem de A (real: 8 pontos).
        pesquisa('Sub1', '2026-10-02', [['A', 45], ['B', 47], ['C', 8]]),
        pesquisa('Sub2', '2026-10-02', [['A', 46], ['B', 46], ['C', 8]]),
        // Superestima.
        pesquisa('Super', '2026-10-02', [['A', 58], ['B', 34], ['C', 8]]),
      ],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(r.subestimaramAMargem).toBe(2);
    expect(r.superestimaramAMargem).toBe(1);
  });

  it('margem exata não conta como viés em nenhuma direção', () => {
    const r = medirAcertoDasPesquisas(
      [pesquisa('Exato', '2026-10-02', [['A', 50], ['B', 42], ['C', 8]])],
      RESULTADO,
      ehNaoCandidato,
    );
    expect(r.subestimaramAMargem).toBe(0);
    expect(r.superestimaramAMargem).toBe(0);
  });
});
