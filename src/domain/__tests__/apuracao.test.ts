import { describe, expect, it } from 'vitest';
import {
  ApuracaoError,
  type DadosApuracao,
  type DadosApuracaoRecorte,
  projetarApuracao,
  semApuracao,
} from '../apuracao.js';
import { criarEleitorado, type Eleitorado } from '../electorate.js';

/**
 * Testes com fixtures, não com a apuração real.
 *
 * Deliberado: a apuração muda a cada minuto, e a lição que a suíte aprendeu
 * em 02/10 é que travar o número do dia num teste produz uma bomba de tempo —
 * passa hoje e falha amanhã sem nada ter mudado no código. Aqui os números
 * são construídos para exercer a aritmética, e o caso de viés regional é
 * construído para falhar se alguém trocar a projeção por estado por uma
 * extrapolação do percentual nacional.
 */

const FONTE = { nome: 'Fixture', url: 'https://exemplo.invalido/apuracao' };

function eleitorado(entradas: readonly [string, number][]): Eleitorado[] {
  return entradas.map(([uf, eleitores]) =>
    criarEleitorado({
      uf,
      eleitores,
      referencia: '2026-07',
      fonte: FONTE,
    }),
  );
}

function recorte(
  uf: string | null,
  secoesTotalizadas: number,
  candidatos: readonly [string, number][],
): DadosApuracaoRecorte {
  return {
    cargo: 'presidente',
    uf,
    turno: 1,
    secoesTotalizadas,
    candidatos: candidatos.map(([candidato, votos]) => ({ candidato, partido: null, votos })),
    fonte: FONTE,
  };
}

function apuracao(recortes: readonly DadosApuracaoRecorte[]): DadosApuracao {
  return { atualizadoEm: '2026-10-04T21:00:00Z', recortes };
}

describe('projeção escala pelo que falta, sem dividir por zero', () => {
  it('a 50% totalizado, projeta o dobro do apurado', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 50, [['A', 1000], ['B', 500]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    const [a, b] = p.porUf[0]!.candidatos;
    expect(a!.votosApurados).toBe(1000);
    expect(a!.votosProjetados).toBe(2000);
    expect(b!.votosProjetados).toBe(1000);
    // O percentual não muda com a escala quando a composição não muda — é a
    // premissa da projeção, explicitada.
    expect(a!.pctApurado).toBeCloseTo(a!.pctProjetado, 10);
  });

  it('a 0% totalizado não divide por zero nem inventa voto', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 0, [['A', 0], ['B', 0]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    for (const c of p.porUf[0]!.candidatos) {
      expect(Number.isFinite(c.votosProjetados)).toBe(true);
      expect(c.votosProjetados).toBe(0);
      expect(c.pctProjetado).toBe(0);
    }
  });

  it('a 100% totalizado, projetado é igual a apurado', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 100, [['A', 1234], ['B', 999]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    for (const c of p.porUf[0]!.candidatos) {
      expect(c.votosProjetados).toBe(c.votosApurados);
    }
  });
});

describe('o viés de ordem de apuração: por que a projeção é por estado', () => {
  /*
   * O caso de 2022 em miniatura. Uma UF pequena totalizada em 100% favorece A;
   * uma UF grande com 10% totalizado favorece B com folga. Somar os votos
   * APURADOS dá a liderança a A — é o percentual nacional parcial, e é
   * enganoso. Projetar cada UF pelo que falta nela e só então somar dá a
   * liderança a B, que é para onde o resultado caminha.
   *
   * Se alguém trocar a projeção por estado por uma extrapolação do percentual
   * nacional, este teste falha.
   */
  const dados = apuracao([
    recorte('AC', 100, [['A', 100_000], ['B', 50_000]]),
    recorte('SP', 10, [['A', 20_000], ['B', 60_000]]),
  ]);
  const ufs = eleitorado([['AC', 600_000], ['SP', 34_000_000]]);

  it('somar apurados dá a liderança a A; a projeção por estado dá a B', () => {
    const p = projetarApuracao(dados, 'presidente', 1, ufs);

    const apuradoA = p.candidatos.find((c) => c.candidato === 'A')!.votosApurados;
    const apuradoB = p.candidatos.find((c) => c.candidato === 'B')!.votosApurados;
    expect(apuradoA).toBe(120_000);
    expect(apuradoB).toBe(110_000);
    expect(apuradoA).toBeGreaterThan(apuradoB);

    // E ainda assim o líder projetado é B.
    expect(p.candidatos[0]!.candidato).toBe('B');
    expect(p.candidatos[0]!.votosProjetados).toBe(650_000);
    expect(p.candidatos[1]!.votosProjetados).toBe(300_000);
  });

  it('a média de seções é ponderada pelo eleitorado: UF pequena a 100% não faz o país parecer apurado', () => {
    const p = projetarApuracao(dados, 'presidente', 1, ufs);
    // Média simples seria (100 + 10) / 2 = 55. Ponderada pelo eleitorado é
    // pouco acima de 10, porque São Paulo domina o eleitorado.
    expect(p.secoesTotalizadasPonderada).toBeLessThan(12);
    expect(p.secoesTotalizadasPonderada).toBeGreaterThan(10);
  });

  it('guarda o recorte nacional cru para contraste, sem usá-lo na projeção', () => {
    const comNacional = apuracao([
      ...dados.recortes,
      recorte(null, 12, [['A', 120_000], ['B', 110_000]]),
    ]);
    const p = projetarApuracao(comNacional, 'presidente', 1, ufs);
    expect(p.nacionalCru).not.toBeNull();
    expect(p.nacionalCru!.candidatos[0]!.candidato).toBe('A');
    // A projeção por estado continua apontando B — o cru não a contamina.
    expect(p.candidatos[0]!.candidato).toBe('B');
  });
});

describe('cobertura: o que falta é nomeado, não completado', () => {
  it('nomeia as UFs sem apuração e mede o eleitorado coberto', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 100, [['A', 1], ['B', 2]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000], ['SP', 34_000_000], ['BA', 11_000_000]]),
    );
    expect(p.ufsSemApuracao).toEqual(['BA', 'SP']);
    expect(p.eleitoradoCoberto).toBe(600_000);
    expect(p.eleitoradoTotal).toBe(45_600_000);
    // Nenhum candidato ganhou voto das UFs ausentes.
    expect(p.candidatos.reduce((t, c) => t + c.votosApurados, 0)).toBe(3);
  });

  it('cargo sem nenhum recorte devolve projeção vazia e semApuracao true', () => {
    const p = projetarApuracao(apuracao([]), 'presidente', 1, eleitorado([['AC', 600_000]]));
    expect(semApuracao(p)).toBe(true);
    expect(p.candidatos).toEqual([]);
    expect(p.margem).toBeNull();
  });

  it('separa por cargo e por turno', () => {
    const dados: DadosApuracao = apuracao([
      recorte('AC', 100, [['A', 10]]),
      { ...recorte('AC', 100, [['Z', 99]]), cargo: 'governador' },
      { ...recorte('AC', 100, [['Y', 77]]), turno: 2 },
    ]);
    const ufs = eleitorado([['AC', 600_000]]);
    expect(projetarApuracao(dados, 'presidente', 1, ufs).candidatos[0]!.candidato).toBe('A');
    expect(projetarApuracao(dados, 'governador', 1, ufs).candidatos[0]!.candidato).toBe('Z');
    expect(projetarApuracao(dados, 'presidente', 2, ufs).candidatos[0]!.candidato).toBe('Y');
  });
});

describe('definido matematicamente: só quando a aritmética fecha', () => {
  it('não declara definido enquanto UF sem apuração puder virar o resultado', () => {
    // A lidera por 1.000 votos, mas São Paulo inteiro não tem nenhuma seção
    // totalizada. O teto de votos restantes inclui o eleitorado paulista.
    const p = projetarApuracao(
      apuracao([recorte('AC', 100, [['A', 11_000], ['B', 10_000]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000], ['SP', 34_000_000]]),
    );
    expect(p.margem!.lider).toBe('A');
    expect(p.margem!.vantagemVotos).toBe(1000);
    expect(p.margem!.votosRestantesTeto).toBeGreaterThanOrEqual(34_000_000);
    expect(p.margem!.matematicamenteDefinido).toBe(false);
  });

  it('declara definido quando a vantagem supera tudo o que ainda pode entrar', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 100, [['A', 500_000], ['B', 10_000]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    expect(p.margem!.votosRestantesTeto).toBe(0);
    expect(p.margem!.vantagemVotos).toBe(490_000);
    expect(p.margem!.matematicamenteDefinido).toBe(true);
  });

  it('acimaDeCinquenta lê os válidos projetados, não os apurados', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 40, [['A', 600], ['B', 400]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    expect(p.margem!.acimaDeCinquenta).toBe(true);
    const empatado = projetarApuracao(
      apuracao([recorte('AC', 40, [['A', 500], ['B', 500]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    expect(empatado.margem!.acimaDeCinquenta).toBe(false);
  });

  it('um candidato só não produz margem', () => {
    const p = projetarApuracao(
      apuracao([recorte('AC', 100, [['A', 10]])]),
      'presidente',
      1,
      eleitorado([['AC', 600_000]]),
    );
    expect(p.margem).toBeNull();
  });
});

describe('validação: ficha impossível não entra', () => {
  it('rejeita seções totalizadas fora de 0 a 100', () => {
    const ufs = eleitorado([['AC', 600_000]]);
    expect(() => projetarApuracao(apuracao([recorte('AC', 101, [['A', 1]])]), 'presidente', 1, ufs)).toThrow(
      ApuracaoError,
    );
    expect(() => projetarApuracao(apuracao([recorte('AC', -1, [['A', 1]])]), 'presidente', 1, ufs)).toThrow(
      ApuracaoError,
    );
  });

  it('rejeita voto negativo ou não finito', () => {
    const ufs = eleitorado([['AC', 600_000]]);
    expect(() =>
      projetarApuracao(apuracao([recorte('AC', 50, [['A', -5]])]), 'presidente', 1, ufs),
    ).toThrow(ApuracaoError);
    expect(() =>
      projetarApuracao(apuracao([recorte('AC', 50, [['A', Number.NaN]])]), 'presidente', 1, ufs),
    ).toThrow(ApuracaoError);
  });

  it('valida todos os recortes, inclusive de cargo que não está sendo projetado', () => {
    // Um recorte podre de governador não pode passar só porque a projeção
    // pedida é de presidente — o arquivo inteiro é conferido.
    const dados = apuracao([
      recorte('AC', 50, [['A', 10]]),
      { ...recorte('AC', 150, [['Z', 1]]), cargo: 'governador' },
    ]);
    expect(() => projetarApuracao(dados, 'presidente', 1, eleitorado([['AC', 600_000]]))).toThrow(
      ApuracaoError,
    );
  });
});

describe('percentuais: cada um sobre a sua própria base', () => {
  it('pctApurado soma 100 entre os apurados e pctProjetado entre os projetados', () => {
    const p = projetarApuracao(
      apuracao([
        recorte('AC', 100, [['A', 100], ['B', 50]]),
        recorte('SP', 25, [['A', 25], ['B', 75]]),
      ]),
      'presidente',
      1,
      eleitorado([['AC', 600_000], ['SP', 34_000_000]]),
    );
    const somaApurado = p.candidatos.reduce((t, c) => t + c.pctApurado, 0);
    const somaProjetado = p.candidatos.reduce((t, c) => t + c.pctProjetado, 0);
    expect(somaApurado).toBeCloseTo(100, 6);
    expect(somaProjetado).toBeCloseTo(100, 6);
    // E são bases diferentes: com UFs em estágios diferentes, os dois
    // percentuais do mesmo candidato não coincidem.
    const a = p.candidatos.find((c) => c.candidato === 'A')!;
    expect(a.pctApurado).not.toBeCloseTo(a.pctProjetado, 2);
  });

  it('soma votos do mesmo candidato entre UFs e preserva a sigla vista', () => {
    const dados: DadosApuracao = apuracao([
      {
        ...recorte('AC', 100, [['A', 10]]),
        candidatos: [{ candidato: 'A', partido: null, votos: 10 }],
      },
      {
        ...recorte('SP', 100, [['A', 90]]),
        candidatos: [{ candidato: 'A', partido: 'PT', votos: 90 }],
      },
    ]);
    const p = projetarApuracao(dados, 'presidente', 1, eleitorado([['AC', 600_000], ['SP', 34_000_000]]));
    expect(p.candidatos).toHaveLength(1);
    expect(p.candidatos[0]!.votosApurados).toBe(100);
    expect(p.candidatos[0]!.partido).toBe('PT');
  });
});
