import { describe, expect, it } from 'vitest';
import {
  TOTAL_UFS,
  VAGAS_SENADO_POR_UF,
  composicaoSenado,
  contagemGovernadores,
  criarResultado,
  governadoresPorPartido,
  ResultadoInvalidoError,
  type DadosResultado,
} from '../resultado.js';
import type { DadosApuracao } from '../apuracao.js';
import type { CadeiraSenado } from '../senate.js';

const FONTE = { nome: 'fixture', url: 'https://exemplo.invalido' };

function govs(n: number): DadosResultado['governadores'] {
  return Array.from({ length: n }, (_, i) => ({
    uf: `U${String(i).padStart(2, '0')}`,
    situacao: 'eleito' as const,
    eleito: { nome: `Fulano ${i}`, partido: 'PL', pctValidos: 55 },
    finalistas: [],
  }));
}

function base(over: Partial<DadosResultado> = {}): DadosResultado {
  return {
    eleicao: 2026,
    turno1: '2026-10-04',
    turno2: '2026-10-25',
    governadores: govs(TOTAL_UFS),
    camara: { totalCadeiras: 10, bancadas: [{ partido: 'PL', cadeiras: 10 }] },
    ...over,
  };
}

describe('criarResultado', () => {
  it('aceita um resultado que fecha nas duas contas', () => {
    expect(() => criarResultado(base())).not.toThrow();
  });

  it('recusa quando falta UF — um buraco mudo no mapa é pior que um erro', () => {
    expect(() => criarResultado(base({ governadores: govs(26) }))).toThrow(ResultadoInvalidoError);
  });

  it('recusa UF repetida', () => {
    const g = [...govs(TOTAL_UFS)];
    g[1] = { ...g[0]! };
    expect(() => criarResultado(base({ governadores: g }))).toThrow(/repetida/);
  });

  it('recusa bancadas que não somam o total da Câmara', () => {
    expect(() =>
      criarResultado(
        base({ camara: { totalCadeiras: 513, bancadas: [{ partido: 'PL', cadeiras: 121 }] } }),
      ),
    ).toThrow(/somam 121/);
  });

  it("recusa UF 'eleito' que não nomeia o eleito", () => {
    const g = [...govs(TOTAL_UFS)];
    g[0] = { ...g[0]!, eleito: null };
    expect(() => criarResultado(base({ governadores: g }))).toThrow(/não nomeia/);
  });

  it('recusa 2º turno que não lista exatamente dois finalistas', () => {
    const g = [...govs(TOTAL_UFS)];
    g[0] = { uf: g[0]!.uf, situacao: 'segundo-turno', eleito: null, finalistas: [] };
    expect(() => criarResultado(base({ governadores: g }))).toThrow(/1 finalista|0 finalista/);
  });
});

describe('contagemGovernadores e governadoresPorPartido', () => {
  const dados = base({
    governadores: [
      { uf: 'SP', situacao: 'eleito', eleito: { nome: 'A', partido: 'PL', pctValidos: 60 }, finalistas: [] },
      { uf: 'RJ', situacao: 'eleito', eleito: { nome: 'B', partido: 'PL', pctValidos: 51 }, finalistas: [] },
      { uf: 'BA', situacao: 'eleito', eleito: { nome: 'C', partido: 'PT', pctValidos: 55 }, finalistas: [] },
      {
        uf: 'ES',
        situacao: 'segundo-turno',
        eleito: null,
        finalistas: [
          { nome: 'D', partido: 'MDB', pctValidos: 49 },
          { nome: 'E', partido: 'PT', pctValidos: 34 },
        ],
      },
    ],
  });

  it('conta eleitos e segundos turnos', () => {
    expect(contagemGovernadores(dados)).toEqual({ eleitos: 3, segundoTurno: 1 });
  });

  it('agrupa só os ELEITOS por partido — quem está em 2º turno não ganhou nada ainda', () => {
    const porPartido = governadoresPorPartido(dados);
    expect(porPartido).toEqual([
      { partido: 'PL', ufs: ['RJ', 'SP'] },
      { partido: 'PT', ufs: ['BA'] },
    ]);
    expect(porPartido.some((p) => p.partido === 'MDB')).toBe(false);
  });
});

describe('composicaoSenado', () => {
  function recorteSenador(uf: string, cands: readonly (readonly [string, string, number])[]) {
    return {
      cargo: 'senador' as const,
      uf,
      turno: 1,
      secoesTotalizadas: 100,
      validosTotal: 1000,
      candidatos: cands.map(([candidato, partido, votos]) => ({ candidato, partido, votos })),
      fonte: FONTE,
    };
  }

  const cadeiras: CadeiraSenado[] = [
    { uf: 'SP', senador: 'Velho A', partido: 'MDB', mandatoInicio: 2023, mandatoFim: 2031, emDisputa2026: false, fonte: 'x' },
    { uf: 'SP', senador: 'Velho B', partido: 'PL', mandatoInicio: 2019, mandatoFim: 2027, emDisputa2026: true, fonte: 'x' },
  ] as unknown as CadeiraSenado[];

  const apuracao = {
    atualizadoEm: '2026-10-05',
    recortes: [
      recorteSenador('SP', [
        ['Primeiro', 'PL', 400],
        ['Segundo', 'PT', 300],
        ['Terceiro', 'PSD', 298],
      ]),
      recorteSenador('RJ', [
        ['Um', 'PL', 350],
        ['Dois', 'PL', 340],
      ]),
    ],
  } as unknown as DadosApuracao;

  it('elege os dois mais votados de cada UF', () => {
    const c = composicaoSenado(apuracao, cadeiras);
    expect(c.cadeirasEmDisputa).toBe(2 * VAGAS_SENADO_POR_UF);
    expect(c.eleitos.filter((e) => e.uf === 'SP').map((e) => e.nome)).toEqual(['Primeiro', 'Segundo']);
    expect(c.eleitos.some((e) => e.nome === 'Terceiro')).toBe(false);
  });

  it('a folga é do 2º para o 3º, e só dele — o 1º não tinha vaga em jogo', () => {
    const c = composicaoSenado(apuracao, cadeiras);
    const sp = c.eleitos.filter((e) => e.uf === 'SP');
    expect(sp[0]!.folgaParaOTerceiro).toBeNull();
    // (300 - 298) / 1000 = 0,2 ponto
    expect(sp[1]!.folgaParaOTerceiro).toBeCloseTo(0.2, 10);
  });

  it('sem 3º colocado a folga é null e a UF é declarada incompleta, nunca folgada', () => {
    const c = composicaoSenado(apuracao, cadeiras);
    expect(c.ufsIncompletas).toEqual(['RJ']);
    expect(c.eleitos.find((e) => e.nome === 'Dois')!.folgaParaOTerceiro).toBeNull();
  });

  it('soma as remanescentes de 2022 e ignora as que estavam em disputa', () => {
    const c = composicaoSenado(apuracao, cadeiras);
    expect(c.cadeirasRemanescentes).toBe(1);
    expect(c.totalCadeiras).toBe(5);
    const mdb = c.bancadas.find((b) => b.partido === 'MDB')!;
    expect(mdb).toEqual({ partido: 'MDB', eleitas2026: 0, remanescentes: 1, total: 1 });
    // A cadeira de 2026 do PL em SP é a do eleito, não a do ocupante anterior.
    const pl = c.bancadas.find((b) => b.partido === 'PL')!;
    expect(pl.eleitas2026).toBe(3);
    expect(pl.remanescentes).toBe(0);
  });
});

describe('composicaoSenado com dados reais', () => {
  it('fecha em 81 = 54 eleitas + 27 remanescentes', async () => {
    const { carregarDados } = await import('../../adapters/outbound/json/carregar-dados.js');
    const repos = carregarDados();
    const c = composicaoSenado(repos.apuracao.dados(), repos.senateSeats.todas());
    expect(c.cadeirasEmDisputa).toBe(54);
    expect(c.cadeirasRemanescentes).toBe(27);
    expect(c.totalCadeiras).toBe(81);
    expect(c.bancadas.reduce((t, b) => t + b.total, 0)).toBe(81);
  });
});
