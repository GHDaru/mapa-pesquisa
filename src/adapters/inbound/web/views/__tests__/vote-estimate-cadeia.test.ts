import { describe, expect, it } from 'vitest';
import type { EstimativaVotos, UfOrigemVotos } from '../../../../../domain/vote-estimate.js';
import { ariaCadeiaUf, montarCadeiaPorUf, rotuloAbstencao } from '../vote-estimate-panel.js';

function uf(
  nome: string,
  eleitores: number,
  validos: number,
  comparecimento: number | null,
  votos: Record<string, number>,
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
      origem: 'apuracao',
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

describe('rotuloAbstencao', () => {
  it('mostra o absoluto com a taxa ao lado', () => {
    expect(rotuloAbstencao(7_672_234, 34_104_226)).toBe('7.672.234 · 22,5%');
  });

  it('não inventa traço de porcentagem onde não há dado', () => {
    expect(rotuloAbstencao(null, 1000)).toBe('—');
  });

  it('não divide por zero', () => {
    expect(rotuloAbstencao(10, 0)).toBe('—');
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
