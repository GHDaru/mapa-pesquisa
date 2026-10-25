import { describe, expect, it } from 'vitest';
import {
  fracaoDaBarra,
  montarLinhas,
  notaDasFontes,
  notaDoEstagio,
  semDado,
  vantagemEntreOsDois,
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
