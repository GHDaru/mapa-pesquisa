import { describe, expect, it } from 'vitest';
import type { Agregado } from '../aggregate.js';
import {
  estimarVotos,
  EstimativaVotosError,
  type AncoragemUf,
  type EstimativaVotosUfEntrada,
} from '../vote-estimate.js';

function agregado(
  candidatos: readonly { candidato: string; partido: string | null; pct: number }[],
  outros: readonly { candidato: string; pct: number }[] = [],
): Agregado {
  return {
    disputa: { uf: 'SP', cargo: 'presidente', turno: 2 },
    lider: { ...candidatos[0]!, pesquisas: 1 },
    segundo: candidatos[1] ? { ...candidatos[1], pesquisas: 1 } : null,
    vantagem: (candidatos[0]?.pct ?? 0) - (candidatos[1]?.pct ?? 0),
    empateTecnico: false,
    margemReferencia: 2,
    candidatos: candidatos.map((c) => ({ ...c, pesquisas: 1 })),
    outros: outros.map((o) => ({ candidato: o.candidato, partido: null, pct: o.pct, pesquisas: 1 })),
    pesquisasUsadas: [],
    ultimaPesquisa: undefined as never,
    algumaNaoRegistrada: false,
    foraDaJanela: false,
    descartadasPorBase: [],
  } as unknown as Agregado;
}

const ANCORA: AncoragemUf = {
  validosPrimeiroTurno: 800_000,
  comparecimentoPrimeiroTurno: 850_000,
  abstencoesPrimeiroTurno: 150_000,
  origem: 'apuracao',
  votosPrimeiroTurno: { A: 400_000, B: 350_000 },
};

/** Pesquisa no corte de TOTAL: os dois candidatos somam 90, o resto é não-candidato. */
const UF_BASE: EstimativaVotosUfEntrada = {
  uf: 'SP',
  eleitores: 1_000_000,
  agregado: agregado(
    [
      { candidato: 'A', partido: 'PT', pct: 50 },
      { candidato: 'B', partido: 'PL', pct: 40 },
    ],
    [{ candidato: 'Brancos/nulos', pct: 10 }],
  ),
  ancoragem: ANCORA,
};

describe('estimarVotos — base ancorada no 1º turno', () => {
  it('aplica os percentuais sobre os VOTOS VÁLIDOS, não sobre o eleitorado', () => {
    const e = estimarVotos([UF_BASE], null, { base: 'validos-1o-turno' });
    expect(e.base).toBe('validos-1o-turno');
    expect(e.baseTotal).toBe(800_000);
    // 50 e 40 renormalizados para válidos dão 55,56% e 44,44% de 800.000.
    const [a, b] = e.candidatos;
    expect(a!.votos).toBeCloseTo(800_000 * (50 / 90), 6);
    expect(b!.votos).toBeCloseTo(800_000 * (40 / 90), 6);
    expect(a!.pctDosVotosAtribuidos).toBeCloseTo(55.5556, 3);
  });

  /**
   * O erro que a base ancorada existe para não cometer: aplicar percentual do
   * corte de TOTAL sobre votos válidos subestimaria os dois candidatos de uma
   * vez — aqui eles somariam 90% dos válidos em vez de 100%.
   */
  it('renormaliza para válidos: os candidatos somam exatamente a base', () => {
    const e = estimarVotos([UF_BASE], null, { base: 'validos-1o-turno' });
    const soma = e.candidatos.reduce((s, c) => s + c.votos, 0);
    expect(soma).toBeCloseTo(800_000, 6);
  });

  it('não sobra resíduo: voto válido é, por definição, voto em candidato', () => {
    const e = estimarVotos([UF_BASE], null, { base: 'validos-1o-turno' });
    expect(e.naoAtribuidos.votos).toBe(0);
    expect(e.naoAtribuidos.declarados.votos).toBe(0);
    expect(e.naoAtribuidos.semLinhaPublicada.votos).toBe(0);
  });

  it('a base `eleitorado` segue como era: percentual sobre o eleitorado, com resíduo', () => {
    const e = estimarVotos([UF_BASE], null);
    expect(e.base).toBe('eleitorado');
    expect(e.baseTotal).toBe(1_000_000);
    expect(e.candidatos[0]!.votos).toBeCloseTo(500_000, 6);
    expect(e.naoAtribuidos.votos).toBeCloseTo(100_000, 6);
  });

  it('a margem de erro acompanha a base, não o eleitorado', () => {
    const e = estimarVotos([UF_BASE], null, { base: 'validos-1o-turno' });
    const a = e.candidatos[0]!;
    expect(a.votosMax - a.votos).toBeCloseTo(800_000 * 0.02, 6);
  });

  it('recusa ancorar sem âncora, em vez de cair calado no eleitorado', () => {
    const semAncora: EstimativaVotosUfEntrada = { ...UF_BASE, ancoragem: null };
    expect(() => estimarVotos([semAncora], null, { base: 'validos-1o-turno' })).toThrow(
      EstimativaVotosError,
    );
  });

  it('marca a UF cuja âncora foi estimada, em vez de apresentá-la como apurada', () => {
    const substituta: EstimativaVotosUfEntrada = {
      ...UF_BASE,
      uf: 'PI',
      ancoragem: {
        validosPrimeiroTurno: 700_000,
        comparecimentoPrimeiroTurno: null,
        abstencoesPrimeiroTurno: null,
        origem: 'substituto-nacional',
        votosPrimeiroTurno: {},
      },
    };
    const e = estimarVotos([UF_BASE, substituta], null, { base: 'validos-1o-turno' });
    expect(e.ufsComAncoragemSubstituta).toEqual(['PI']);
  });

  /**
   * Comparecimento parcial é melhor que comparecimento falso: a UF sem o dado
   * sai da conta inteira, numerador e denominador, e é nomeada.
   */
  it('soma o comparecimento só onde ele é conhecido, e diz quais UFs ficaram de fora', () => {
    const semComparecimento: EstimativaVotosUfEntrada = {
      ...UF_BASE,
      uf: 'MG',
      eleitores: 2_000_000,
      ancoragem: {
        validosPrimeiroTurno: 1_500_000,
        comparecimentoPrimeiroTurno: null,
        abstencoesPrimeiroTurno: null,
        origem: 'apuracao',
        votosPrimeiroTurno: {},
      },
    };
    const e = estimarVotos([UF_BASE, semComparecimento], null, { base: 'validos-1o-turno' });
    expect(e.comparecimento).not.toBeNull();
    expect(e.comparecimento!.votos).toBe(850_000);
    expect(e.comparecimento!.eleitoresCobertos).toBe(1_000_000);
    expect(e.comparecimento!.ufsSemDado).toEqual(['MG']);
    // A ancoragem em si NÃO depende do comparecimento: as duas UFs entram.
    expect(e.baseTotal).toBe(2_300_000);
  });

  it('na base `eleitorado` não há comparecimento a declarar', () => {
    expect(estimarVotos([UF_BASE], null).comparecimento).toBeNull();
  });

  it('põe os dois lados da comparação nacional na mesma base', () => {
    const nacional = agregado(
      [
        { candidato: 'A', partido: 'PT', pct: 45 },
        { candidato: 'B', partido: 'PL', pct: 45 },
      ],
      [{ candidato: 'Brancos/nulos', pct: 10 }],
    );
    const e = estimarVotos([UF_BASE], nacional, { base: 'validos-1o-turno' });
    // 45/90 = 50% em válidos — não os 45% do corte de total.
    for (const c of e.comparacaoNacional) expect(c.pctNacional).toBeCloseTo(50, 6);
  });
});
