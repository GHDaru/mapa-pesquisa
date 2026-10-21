import { describe, expect, it } from 'vitest';
import type { EstimativaVotos, UfOrigemVotos } from '../../../../../domain/vote-estimate.js';
import {
  ariaCadeiaUf,
  textosPrimeiroTurno,
  montarCadeiaPorUf,
  rotuloAbstencao,
} from '../vote-estimate-panel.js';

function uf(
  nome: string,
  eleitores: number,
  validos: number,
  comparecimento: number | null,
  votos: Record<string, number>,
  votosPrimeiroTurno: Record<string, number> = {},
  // Por padrão a fixture usa a subtração ingênua, que serve para os casos em
  // que a base não está sob teste; o teste da base passa o valor oficial.
  abstencao: number | null = comparecimento === null ? null : eleitores - comparecimento,
): UfOrigemVotos {
  return {
    uf: nome,
    eleitores,
    origem: 'estadual',
    foraDaJanela: false,
    votosPorCandidato: Object.fromEntries(
      Object.entries(votos).map(([k, v]) => [k, { votos: v, origem: 'estadual' as const }]),
    ),
    baseDeVotos: validos,
    ancoragem: {
      validosPrimeiroTurno: validos,
      comparecimentoPrimeiroTurno: comparecimento,
      abstencoesPrimeiroTurno: abstencao,
      origem: 'apuracao',
      votosPrimeiroTurno,
    },
  };
}

function estimativa(
  porUf: UfOrigemVotos[],
  extras: Partial<EstimativaVotos> = {},
): EstimativaVotos {
  return {
    base: 'validos-1o-turno',
    porUf,
    candidatos: [
      { candidato: 'A', partido: 'PT' },
      { candidato: 'B', partido: 'PL' },
    ],
    ufsComAncoragemSubstituta: [],
    ...extras,
  } as unknown as EstimativaVotos;
}

describe('montarCadeiaPorUf', () => {
  /** Fora da base ancorada a pergunta não se aplica — e duas colunas vazias mentiriam. */
  it('não monta cadeia na base do eleitorado', () => {
    const e = estimativa([uf('SP', 100, 80, 90, { A: 40, B: 40 })], { base: 'eleitorado' });
    expect(montarCadeiaPorUf(e)).toBeNull();
  });

  it('deriva a abstenção do comparecimento apurado', () => {
    const c = montarCadeiaPorUf(
      estimativa([uf('SP', 34_104_226, 24_882_948, 26_431_992, { A: 11_526_835, B: 13_356_113 })]),
    )!;
    expect(c[0]!.abstencao).toBe(34_104_226 - 26_431_992);
    expect(c[0]!.votantes).toBe(26_431_992);
    expect(c[0]!.validos).toBe(24_882_948);
  });

  /**
   * O número publicado vence a subtração. A apuração conta os aptos NAS SEÇÕES
   * da UF — base que inclui quem votou em trânsito para presidente — e por isso
   * `eleitores - comparecimento` dá outro número: em SP, 7.672.234 em vez dos
   * 7.690.900 oficiais. A taxa tem de sair sobre a base da apuração
   * (`aptosApuracao`), senão o % mistura as duas contagens.
   */
  it('usa a abstenção publicada e a base dela, não a subtração do eleitorado', () => {
    const c = montarCadeiaPorUf(
      estimativa([
        uf(
          'SP',
          34_104_226,
          24_882_948,
          26_431_992,
          { A: 11_526_835, B: 13_356_113 },
          {},
          7_690_900,
        ),
      ]),
    )!;
    expect(c[0]!.abstencao).toBe(7_690_900);
    expect(c[0]!.aptosApuracao).toBe(7_690_900 + 26_431_992);
    expect(c[0]!.aptosApuracao).not.toBe(c[0]!.eleitores);
    expect(rotuloAbstencao(c[0]!.abstencao, c[0]!.aptosApuracao)).toBe('7.690.900 · 22,5%');
    expect(ariaCadeiaUf('São Paulo', c[0]!)).toContain('abstenção de 22,5% no 1º turno');
  });

  /** Sem apuração não há abstenção publicada nem base para a taxa. */
  it('não inventa base de abstenção na UF sem apuração', () => {
    const c = montarCadeiaPorUf(
      estimativa([uf('SP', 34_104_226, 24_882_948, null, { A: 11_526_835, B: 13_356_113 })]),
    )!;
    expect(c[0]!.abstencao).toBeNull();
    expect(c[0]!.aptosApuracao).toBeNull();
    expect(rotuloAbstencao(c[0]!.abstencao, c[0]!.aptosApuracao)).toBe('—');
  });

  /**
   * Os percentuais da coluna são sobre os válidos DA UF: é isso que "já
   * normalizado para 100%" quer dizer, e é o que torna a linha conferível —
   * os dois votos têm de somar exatamente os válidos daquela UF.
   */
  it('normaliza os percentuais para somar 100 dentro da UF', () => {
    const c = montarCadeiaPorUf(estimativa([uf('SP', 1000, 800, 900, { A: 500, B: 300 })]))!;
    const [a, b] = c[0]!.candidatos;
    expect(a!.pct).toBeCloseTo(62.5, 10);
    expect(b!.pct).toBeCloseTo(37.5, 10);
    expect(a!.pct + b!.pct).toBeCloseTo(100, 10);
    expect(a!.votos + b!.votos).toBe(c[0]!.validos);
  });

  it('ordena do maior eleitorado para o menor', () => {
    const c = montarCadeiaPorUf(
      estimativa([
        uf('RR', 400, 300, 320, { A: 200, B: 100 }),
        uf('SP', 34_000, 25_000, 26_000, { A: 13_000, B: 12_000 }),
        uf('MG', 16_000, 12_000, 12_500, { A: 7_000, B: 5_000 }),
      ]),
    )!;
    expect(c.map((x) => x.uf)).toEqual(['SP', 'MG', 'RR']);
  });

  /** MG e MA não publicaram brancos e nulos: sem comparecimento não há abstenção. */
  it('deixa abstenção e votantes em null onde o comparecimento é desconhecido', () => {
    const c = montarCadeiaPorUf(
      estimativa([uf('MG', 16_377_659, 11_976_032, null, { A: 6_070_051, B: 5_905_981 })]),
    )!;
    expect(c[0]!.abstencao).toBeNull();
    expect(c[0]!.votantes).toBeNull();
    // Mas os válidos, que são a base da conta, continuam conhecidos.
    expect(c[0]!.validos).toBe(11_976_032);
  });

  it('marca a UF cuja âncora foi estimada', () => {
    const c = montarCadeiaPorUf(
      estimativa([uf('PI', 2_708_160, 2_039_477, null, { A: 1_453_670, B: 585_807 })], {
        ufsComAncoragemSubstituta: ['PI'],
      }),
    )!;
    expect(c[0]!.ancoraSubstituta).toBe(true);
  });

  it('leva o partido de cada candidato, que é o que dá a cor do mapa', () => {
    const c = montarCadeiaPorUf(estimativa([uf('SP', 1000, 800, 900, { A: 500, B: 300 })]))!;
    expect(c[0]!.candidatos.map((x) => x.partido)).toEqual(['PT', 'PL']);
  });
});

describe('montarCadeiaPorUf — percentuais do 1º turno', () => {
  // SP real: Lula 9.498.712 e Flávio 12.918.448 de 24.882.948 válidos.
  const sp = () =>
    montarCadeiaPorUf(
      estimativa([
        uf(
          'SP',
          34_104_226,
          24_882_948,
          26_431_992,
          { A: 11_526_835, B: 13_356_113 },
          { A: 9_498_712, B: 12_918_448 },
        ),
      ]),
    )![0]!;

  // A lista vem ordenada por votos ESTIMADOS, então procura-se por nome.
  const de = (nome: string) => sp().candidatos.find((c) => c.nome === nome)!;

  it('calcula o percentual publicado sobre TODOS os válidos da UF', () => {
    const a = de('A');
    const b = de('B');
    expect(a.pctPrimeiroTurno).toBeCloseTo((9_498_712 / 24_882_948) * 100, 6);
    expect(b.pctPrimeiroTurno).toBeCloseTo((12_918_448 / 24_882_948) * 100, 6);
    // Os dois NÃO somam 100: no 1º turno a cédula tinha mais nomes.
    expect(a.pctPrimeiroTurno! + b.pctPrimeiroTurno!).toBeLessThan(100);
  });

  /**
   * A segunda leitura é a comparável com a estimativa: recontada só entre os
   * dois que passaram, ela soma 100, igual à coluna ao lado.
   */
  it('calcula também o percentual entre apenas os dois finalistas, e esse soma 100', () => {
    const a = de('A');
    const b = de('B');
    const dois = 9_498_712 + 12_918_448;
    expect(a.pctPrimeiroTurnoEntreOsDois).toBeCloseTo((9_498_712 / dois) * 100, 6);
    expect(a.pctPrimeiroTurnoEntreOsDois! + b.pctPrimeiroTurnoEntreOsDois!).toBeCloseTo(100, 6);
  });

  /** As duas leituras contam histórias diferentes, e é por isso que ambas aparecem. */
  it('a leitura crua e a recontada divergem — e a diferença é a herança, não movimento', () => {
    const a = de('A');
    expect(a.pctPrimeiroTurno).toBeLessThan(a.pctPrimeiroTurnoEntreOsDois!);
  });

  it('casa o nome mesmo com grafia diferente entre apuração e pesquisa', () => {
    const c = montarCadeiaPorUf(
      estimativa([uf('SP', 1000, 800, 900, { A: 500, B: 300 }, { a: 400, B: 200 })]),
    )!;
    // "a" na apuração contra "A" na pesquisa: mesmo candidato.
    expect(c[0]!.candidatos[0]!.pctPrimeiroTurno).toBeCloseTo(50, 6);
  });

  it('fica em null onde a UF não tem apuração, em vez de zerar', () => {
    const c = montarCadeiaPorUf(
      estimativa([uf('PI', 2_708_160, 2_039_477, null, { A: 1_453_670, B: 585_807 }, {})], {
        ufsComAncoragemSubstituta: ['PI'],
      }),
    )!;
    expect(c[0]!.candidatos[0]!.pctPrimeiroTurno).toBeNull();
    expect(c[0]!.candidatos[0]!.pctPrimeiroTurnoEntreOsDois).toBeNull();
  });
});

describe('textosPrimeiroTurno', () => {
  it('devolve null quando a UF não tem resultado de 1º turno', () => {
    expect(
      textosPrimeiroTurno({
        nome: 'A',
        partido: 'PT',
        votos: 1,
        pct: 50,
        pctPrimeiroTurno: null,
        pctPrimeiroTurnoEntreOsDois: null,
      }),
    ).toBeNull();
  });

  it('traz o publicado como principal e o recontado como secundário', () => {
    const t = textosPrimeiroTurno({
      nome: 'A',
      partido: 'PT',
      votos: 1,
      pct: 46.3,
      pctPrimeiroTurno: 38.2,
      pctPrimeiroTurnoEntreOsDois: 42.4,
    })!;
    expect(t.principal).toBe('38,2%');
    expect(t.secundario).toBe('42,4% entre os dois');
  });

  it('sem o recontado, fica só com o publicado', () => {
    const t = textosPrimeiroTurno({
      nome: 'A',
      partido: 'PT',
      votos: 1,
      pct: 46.3,
      pctPrimeiroTurno: 38.2,
      pctPrimeiroTurnoEntreOsDois: null,
    })!;
    expect(t.principal).toBe('38,2%');
    expect(t.secundario).toBeNull();
  });
});

describe('rotuloAbstencao', () => {
  it('mostra o absoluto com a taxa ao lado', () => {
    expect(rotuloAbstencao(7_690_900, 34_122_892)).toBe('7.690.900 · 22,5%');
  });

  it('não inventa traço de porcentagem onde não há dado', () => {
    expect(rotuloAbstencao(null, 1000)).toBe('—');
  });

  it('não divide por zero', () => {
    expect(rotuloAbstencao(10, 0)).toBe('—');
    expect(rotuloAbstencao(10, null)).toBe('—');
  });
});

describe('ariaCadeiaUf', () => {
  const sp = montarCadeiaPorUf(
    estimativa([uf('SP', 34_104_226, 24_882_948, 26_431_992, { A: 11_526_835, B: 13_356_113 })]),
  )![0]!;

  it('carrega a cadeia inteira para quem não vê a tabela', () => {
    const t = ariaCadeiaUf('São Paulo', sp);
    expect(t).toContain('34.104.226 eleitores');
    expect(t).toContain('abstenção de 22,5%');
    expect(t).toContain('26.431.992 votantes estimados');
    expect(t).toContain('24.882.948 votos válidos estimados');
    expect(t).toContain('13.356.113 votos');
  });

  /** Onde o degrau não existe, a frase pula em vez de dizer "zero". */
  it('omite abstenção e votantes quando não são conhecidos', () => {
    const mg = montarCadeiaPorUf(
      estimativa([uf('MG', 16_377_659, 11_976_032, null, { A: 6_070_051, B: 5_905_981 })]),
    )![0]!;
    const t = ariaCadeiaUf('Minas Gerais', mg);
    expect(t).not.toContain('abstenção');
    expect(t).not.toContain('votantes');
    expect(t).toContain('11.976.032 votos válidos estimados');
  });

  it('avisa quando a âncora da UF foi estimada', () => {
    const pi = montarCadeiaPorUf(
      estimativa([uf('PI', 2_708_160, 2_039_477, null, { A: 1_453_670, B: 585_807 })], {
        ufsComAncoragemSubstituta: ['PI'],
      }),
    )![0]!;
    expect(ariaCadeiaUf('Piauí', pi)).toContain('âncora estimada, não apurada');
  });
});
