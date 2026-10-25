import { describe, expect, it } from 'vitest';
import {
  agregarPorRegiao,
  fracaoDaBarra,
  montarLinhas,
  notaDasFontes,
  notaDoEstagio,
  regiaoDaUf,
  REGIOES,
  semDado,
  somarNaoValidos,
  vantagemEntreOsDois,
  type LinhaUf,
} from '../apuracao-layout.js';

const cand = (candidato: string, votosProjetados: number, pctProjetado: number) => ({
  candidato,
  partido: null,
  votosApurados: votosProjetados,
  votosProjetados,
  pctApurado: pctProjetado,
  pctProjetado,
});

describe('montarLinhas', () => {
  /**
   * `ProjecaoUf.candidatos` vem ordenada por votos, então ler a coluna de cima
   * a baixo saltaria entre um candidato e outro conforme a liderança muda de
   * estado. Uma tabela cuja terceira coluna troca de dono no meio da rolagem é
   * pior que inútil: é lida errado com confiança.
   */
  it('mantém a ordem fixa dos candidatos, mesmo onde a liderança inverte', () => {
    const porUf = [
      { uf: 'SP', secoesTotalizadas: 50, candidatos: [cand('A', 100, 60), cand('B', 66, 40)],
        validosApurados: 166, validosProjetados: 332, eleitores: 10, lider: 'A',
        brancos: 1, nulos: 2, abstencoes: 3, finalizada: false },
      { uf: 'BA', secoesTotalizadas: 50, candidatos: [cand('B', 90, 70), cand('A', 38, 30)],
        validosApurados: 128, validosProjetados: 256, eleitores: 20, lider: 'B',
        brancos: 4, nulos: 5, abstencoes: 6, finalizada: false },
    ];
    const linhas = montarLinhas(porUf, ['A', 'B']);
    for (const l of linhas) {
      expect(l.porCandidato.map((c) => c.candidato)).toEqual(['A', 'B']);
    }
    // E ordena por eleitorado, para a tabela abrir pelos estados que pesam.
    expect(linhas.map((l) => l.uf)).toEqual(['BA', 'SP']);
  });

  /** Candidato ausente de uma UF vira zero, nunca `undefined` na célula. */
  it('não deixa buraco quando a UF não traz um dos dois', () => {
    const linhas = montarLinhas(
      [{ uf: 'AC', secoesTotalizadas: 10, candidatos: [cand('A', 5, 100)],
         validosApurados: 5, validosProjetados: 50, eleitores: 1, lider: 'A',
         brancos: null, nulos: null, abstencoes: null, finalizada: false }],
      ['A', 'B'],
    );
    expect(linhas[0]!.porCandidato[1]).toMatchObject({ candidato: 'B', pct: 0, votosProjetados: 0 });
  });
});

describe('vantagemEntreOsDois', () => {
  it('mede a diferença entre os dois primeiros', () => {
    const v = vantagemEntreOsDois([cand('A', 100, 60), cand('B', 60, 40)])!;
    expect(v).toMatchObject({ lider: 'A', votos: 40, pontos: 20 });
  });

  /**
   * Com zero voto não há líder. A tela usa isto para não escrever "fulano à
   * frente por 0 votos" antes de a apuração começar — nomear liderança que
   * ninguém mediu é o mesmo erro que o mapa evita deixando as UFs cinza.
   */
  it('devolve vantagem zero no empate em zero, para a tela poder omitir', () => {
    const v = vantagemEntreOsDois([cand('A', 0, 0), cand('B', 0, 0)])!;
    expect(v.votos).toBe(0);
  });

  it('não inventa vantagem com um candidato só', () => {
    expect(vantagemEntreOsDois([cand('A', 10, 100)])).toBeNull();
  });
});

describe('notaDoEstagio', () => {
  it('diz que não começou quando não há seção', () => {
    const t = notaDoEstagio({ processadoNacional: 0, ufsSemApuracao: [], definido: false });
    expect(t).toContain('ainda não começou');
  });

  /**
   * A armadilha clássica de noite de eleição: o percentual nacional parcial é
   * enviesado pela ORDEM em que os estados totalizam, não pelo voto.
   */
  it('avisa do viés de ordem enquanto a cobertura é baixa', () => {
    const t = notaDoEstagio({ processadoNacional: 12, ufsSemApuracao: [], definido: false });
    expect(t).toContain('ORDEM');
  });

  it('cala o aviso quando a cobertura já é alta', () => {
    const t = notaDoEstagio({ processadoNacional: 92, ufsSemApuracao: [], definido: false });
    expect(t).not.toContain('ORDEM');
  });

  it('nomeia quantas UFs ficaram de fora, concordando no singular', () => {
    expect(notaDoEstagio({ processadoNacional: 30, ufsSemApuracao: ['AC'], definido: false }))
      .toContain('1 estado ainda não tem');
    expect(notaDoEstagio({ processadoNacional: 30, ufsSemApuracao: ['AC', 'AP'], definido: false }))
      .toContain('2 estados ainda não têm');
  });

  it('declara quando a aritmética já fechou', () => {
    const t = notaDoEstagio({ processadoNacional: 80, ufsSemApuracao: [], definido: true });
    expect(t).toContain('matematicamente definido');
  });
});

describe('notaDasFontes', () => {
  it('conta as leituras e a hora', () => {
    const t = notaDasFontes([
      { ok: true, lidoEm: '2026-10-25T20:10:00.000Z' },
      { ok: true, lidoEm: '2026-10-25T20:10:01.000Z' },
    ]);
    expect(t).toContain('2 de 2');
  });

  /** Falha não some: UF que não respondeu encolhe a projeção e tem de ser dita. */
  it('declara as que falharam em vez de escondê-las', () => {
    const t = notaDasFontes([
      { ok: true, lidoEm: '2026-10-25T20:10:00.000Z' },
      { ok: false, lidoEm: '2026-10-25T20:10:00.000Z' },
    ]);
    expect(t).toContain('1 de 2');
    expect(t).toContain('ficou de fora');
  });
});

describe('fracaoDaBarra e semDado', () => {
  it('limita entre 0 e 1 e trata lixo', () => {
    expect(fracaoDaBarra(50)).toBe(0.5);
    expect(fracaoDaBarra(140)).toBe(1);
    expect(fracaoDaBarra(-5)).toBe(0);
    expect(fracaoDaBarra(Number.NaN)).toBe(0);
  });

  /** UF a 0% não pode ser pintada: seria liderança que ninguém mediu. */
  it('trata 0% como sem dado', () => {
    expect(semDado({ processado: 0 })).toBe(true);
    expect(semDado({ processado: 0.4 })).toBe(false);
  });
});

/* ───────────────────────────── por região ─────────────────────────────── */

function linha(
  uf: string,
  opcoes: {
    eleitores?: number | null;
    processado?: number;
    a?: number;
    b?: number;
    brancos?: number | null;
    nulos?: number | null;
    abstencoes?: number | null;
    finalizada?: boolean;
  } = {},
): LinhaUf {
  const a = opcoes.a ?? 0;
  const b = opcoes.b ?? 0;
  const fracao = (opcoes.processado ?? 100) / 100;
  return {
    uf,
    eleitores: opcoes.eleitores === undefined ? 1_000_000 : opcoes.eleitores,
    processado: opcoes.processado ?? 100,
    finalizada: opcoes.finalizada ?? false,
    lider: a === b ? null : a > b ? 'A' : 'B',
    porCandidato: [
      { candidato: 'A', pct: 0, votosApurados: Math.round(a * fracao), votosProjetados: a },
      { candidato: 'B', pct: 0, votosApurados: Math.round(b * fracao), votosProjetados: b },
    ],
    brancos: opcoes.brancos === undefined ? null : opcoes.brancos,
    nulos: opcoes.nulos === undefined ? null : opcoes.nulos,
    abstencoes: opcoes.abstencoes === undefined ? null : opcoes.abstencoes,
    validosApurados: Math.round((a + b) * fracao),
  };
}

describe('apuracao-layout: regiões', () => {
  it('mapeia as 27 unidades da federação, sem sobra nem repetição', () => {
    const todas = REGIOES.flatMap((r) => r.ufs);
    expect(todas).toHaveLength(27);
    expect(new Set(todas).size).toBe(27);
    expect(regiaoDaUf('SP')).toBe('Sudeste');
    expect(regiaoDaUf('DF')).toBe('Centro-Oeste');
    expect(regiaoDaUf('ba')).toBe('Nordeste');
    expect(regiaoDaUf('XX')).toBeNull();
  });

  it('soma os votos das UFs da região', () => {
    const regioes = agregarPorRegiao(
      [
        linha('SP', { a: 600, b: 400 }),
        linha('RJ', { a: 100, b: 300 }),
        linha('MG', { a: 300, b: 200 }),
        linha('ES', { a: 0, b: 100 }),
      ],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.porCandidato.find((c) => c.candidato === 'A')!.votosProjetados).toBe(1000);
    expect(sudeste.porCandidato.find((c) => c.candidato === 'B')!.votosProjetados).toBe(1000);
    expect(sudeste.eleitores).toBe(4_000_000);
  });

  it('o percentual da região sai da soma dos votos, não da média dos percentuais das UFs', () => {
    // Uma UF enorme 90/10 e uma minúscula 10/90. A média das porcentagens
    // daria 50/50; a soma dos votos diz quase 90/10 — e é esta que é verdade.
    const regioes = agregarPorRegiao(
      [linha('SP', { a: 900_000, b: 100_000 }), linha('ES', { a: 10, b: 90 })],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.porCandidato.find((c) => c.candidato === 'A')!.pct).toBeCloseTo(89.99, 1);
    expect(sudeste.lider).toBe('A');
  });

  it('o % apurado é ponderado pelo eleitorado, não a média das UFs', () => {
    // RR a 100% com 300 mil eleitores e SP a 10% com 34 milhões: a média
    // simples diria 55% apurado no conjunto, o que é falso por uma ordem de
    // grandeza. Ponderado, fica rente aos 10% de São Paulo.
    const regioes = agregarPorRegiao(
      [
        linha('SP', { eleitores: 34_000_000, processado: 10, a: 100, b: 100 }),
        linha('ES', { eleitores: 300_000, processado: 100, a: 100, b: 100 }),
      ],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.processado).toBeGreaterThan(10);
    expect(sudeste.processado).toBeLessThan(11.5);
  });

  it('UF sem nenhuma apuração não entra na soma, mas é nomeada', () => {
    const regioes = agregarPorRegiao(
      [
        linha('SP', { a: 600, b: 400, processado: 50 }),
        linha('RJ', { a: 0, b: 0, processado: 0 }),
      ],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.ufsSemApuracao).toEqual(['RJ']);
    expect(sudeste.porCandidato.find((c) => c.candidato === 'A')!.votosProjetados).toBe(600);
    // O RJ a 0% não pode puxar o processado da região para 25%.
    expect(sudeste.processado).toBe(50);
  });

  it('região sem nenhum voto não ganha líder', () => {
    const regioes = agregarPorRegiao([linha('SP', { a: 0, b: 0, processado: 0 })], ['A', 'B']);
    expect(regioes.find((r) => r.regiao === 'Sudeste')!.lider).toBeNull();
  });

  it('brancos/nulos/abstenções ficam null quando ninguém publicou, e somam quando alguém publica', () => {
    const semNada = agregarPorRegiao([linha('SP', { a: 10, b: 5 })], ['A', 'B']);
    expect(semNada.find((r) => r.regiao === 'Sudeste')!.brancos).toBeNull();

    const comUm = agregarPorRegiao(
      [linha('SP', { a: 10, b: 5, brancos: 7 }), linha('RJ', { a: 1, b: 1 })],
      ['A', 'B'],
    );
    expect(comUm.find((r) => r.regiao === 'Sudeste')!.brancos).toBe(7);
  });

  it('só é finalizada quando todas as UFs da região terminaram', () => {
    const parcial = agregarPorRegiao(
      [
        linha('PR', { a: 10, b: 5, finalizada: true }),
        linha('SC', { a: 10, b: 5, finalizada: true }),
        linha('RS', { a: 10, b: 5, finalizada: false }),
      ],
      ['A', 'B'],
    );
    expect(parcial.find((r) => r.regiao === 'Sul')!.finalizada).toBe(false);

    const toda = agregarPorRegiao(
      [
        linha('PR', { a: 10, b: 5, finalizada: true }),
        linha('SC', { a: 10, b: 5, finalizada: true }),
        linha('RS', { a: 10, b: 5, finalizada: true }),
      ],
      ['A', 'B'],
    );
    expect(toda.find((r) => r.regiao === 'Sul')!.finalizada).toBe(true);
  });

  it('as cinco regiões aparecem mesmo sem dado nenhum', () => {
    const vazio = agregarPorRegiao([], ['A', 'B']);
    expect(vazio.map((r) => r.regiao)).toEqual(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']);
    expect(vazio.every((r) => r.lider === null && r.processado === 0)).toBe(true);
  });
});

describe('apuracao-layout: somarNaoValidos', () => {
  it('soma o que foi publicado e devolve null para o que ninguém publicou', () => {
    const totais = somarNaoValidos([
      linha('SP', { brancos: 10, nulos: 20 }),
      linha('RJ', { brancos: 5, nulos: 1, abstencoes: 3 }),
    ]);
    expect(totais).toEqual({ brancos: 15, nulos: 21, abstencoes: 3 });
  });

  it('zero não substitui ausência — null continua null', () => {
    expect(somarNaoValidos([linha('SP'), linha('RJ')])).toEqual({
      brancos: null,
      nulos: null,
      abstencoes: null,
    });
  });
});
