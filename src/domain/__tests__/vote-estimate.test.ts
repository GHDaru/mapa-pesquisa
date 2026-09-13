import { describe, expect, it } from 'vitest';
import { agregarPesquisas } from '../aggregate.js';
import { criarPesquisa, type DadosPesquisa } from '../poll.js';
import { estimarVotos, EstimativaVotosError, type EstimativaVotosUfEntrada } from '../vote-estimate.js';

const HOJE = new Date('2026-09-15T00:00:00Z');

let contador = 0;
function pesquisa(sobrescritas: Partial<DadosPesquisa> = {}) {
  contador += 1;
  return criarPesquisa({
    id: `pesquisa-${contador}`,
    uf: 'BR',
    cargo: 'presidente',
    turno: 1,
    instituto: 'Instituto Teste',
    registroTSE: 'BR-0001/2026',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-10',
    publicadoEm: '2026-09-11',
    amostra: 1000,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados: [
      { candidato: 'Candidato A', partido: 'PT', pct: 40 },
      { candidato: 'Candidato B', partido: 'PL', pct: 35 },
      { candidato: 'Brancos/nulos', partido: null, pct: 15 },
      { candidato: 'Não sabe', partido: null, pct: 10 },
    ],
    ...sobrescritas,
  });
}

// Agregado nacional: A 40%, B 35%, resto (15) não atribuído.
const NACIONAL = agregarPesquisas([pesquisa({ uf: 'BR' })], {}, HOJE)!;

// Agregado estadual de SP: A 60%, B 30%, resto (10) não atribuído — bem
// diferente do nacional, para os testes distinguirem qual foi usado.
const SP = agregarPesquisas(
  [
    pesquisa({
      uf: 'SP',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 60 },
        { candidato: 'Candidato B', partido: 'PL', pct: 30 },
        { candidato: 'Brancos/nulos', partido: null, pct: 10 },
      ],
    }),
  ],
  {},
  HOJE,
)!;

describe('domain/vote-estimate', () => {
  it('UF sem pesquisa estadual usa os percentuais do agregado nacional', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'RJ', eleitores: 1_000_000, agregado: null }];
    const estimativa = estimarVotos(porUf, NACIONAL);

    const rj = estimativa.porUf.find((u) => u.uf === 'RJ')!;
    expect(rj.origem).toBe('nacional');
    expect(rj.votosPorCandidato['Candidato A']).toBeCloseTo(1_000_000 * 0.4, 6);
    expect(estimativa.ufsSemPesquisa).toEqual(['RJ']);
    expect(estimativa.ufsComPesquisa).toEqual([]);
  });

  it('UF com pesquisa estadual usa os percentuais do agregado estadual, não do nacional', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP }];
    const estimativa = estimarVotos(porUf, NACIONAL);

    const sp = estimativa.porUf.find((u) => u.uf === 'SP')!;
    expect(sp.origem).toBe('estadual');
    expect(sp.votosPorCandidato['Candidato A']).toBeCloseTo(1_000_000 * 0.6, 6);
    expect(estimativa.ufsComPesquisa).toEqual(['SP']);
  });

  it('soma os votos de várias UFs por candidato corretamente', () => {
    const porUf: EstimativaVotosUfEntrada[] = [
      { uf: 'SP', eleitores: 1_000_000, agregado: SP }, // A: 600_000
      { uf: 'RJ', eleitores: 500_000, agregado: null }, // A: 200_000 (nacional 40%)
    ];
    const estimativa = estimarVotos(porUf, NACIONAL);

    const a = estimativa.candidatos.find((c) => c.candidato === 'Candidato A')!;
    expect(a.votos).toBeCloseTo(600_000 + 200_000, 6);
    expect(a.votosDeUfComPesquisa).toBeCloseTo(600_000, 6);
    expect(a.votosDeUfSemPesquisa).toBeCloseTo(200_000, 6);
  });

  it('ordena candidatos por votos desc', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP }];
    const estimativa = estimarVotos(porUf, NACIONAL);

    expect(estimativa.candidatos.map((c) => c.candidato)).toEqual(['Candidato A', 'Candidato B']);
    expect(estimativa.candidatos[0]!.votos).toBeGreaterThan(estimativa.candidatos[1]!.votos);
  });

  it('lança EstimativaVotosError quando falta agregado estadual em alguma UF e não há agregado nacional', () => {
    const porUf: EstimativaVotosUfEntrada[] = [
      { uf: 'SP', eleitores: 1_000_000, agregado: SP },
      { uf: 'RJ', eleitores: 500_000, agregado: null },
    ];
    expect(() => estimarVotos(porUf, null)).toThrow(EstimativaVotosError);
    expect(() => estimarVotos(porUf, null)).toThrow(/RJ/);
  });

  it('não lança erro quando o nacional é null mas todas as UFs têm agregado estadual próprio', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP }];
    expect(() => estimarVotos(porUf, null)).not.toThrow();
    const estimativa = estimarVotos(porUf, null);
    expect(estimativa.comparacaoNacional).toEqual([]);
  });

  it('pctDoEleitorado e pctDosVotosAtribuidos nunca passam de 100', () => {
    const porUf: EstimativaVotosUfEntrada[] = [
      { uf: 'SP', eleitores: 1_000_000, agregado: SP },
      { uf: 'RJ', eleitores: 500_000, agregado: null },
    ];
    const estimativa = estimarVotos(porUf, NACIONAL);
    for (const c of estimativa.candidatos) {
      expect(c.pctDoEleitorado).toBeLessThanOrEqual(100);
      expect(c.pctDosVotosAtribuidos).toBeLessThanOrEqual(100);
    }
    expect(estimativa.naoAtribuidos.pct).toBeLessThanOrEqual(100);
  });

  it('naoAtribuidos captura a parcela do eleitorado sem candidato (brancos/nulos/indecisos)', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP }];
    const estimativa = estimarVotos(porUf, NACIONAL);
    // SP: A 60% + B 30% = 90%, resto 10% não atribuído.
    expect(estimativa.naoAtribuidos.votos).toBeCloseTo(100_000, 6);
    expect(estimativa.naoAtribuidos.pct).toBeCloseTo(10, 6);
  });

  it('eleitoradoTotal e eleitoradoComPesquisaEstadual somam corretamente', () => {
    const porUf: EstimativaVotosUfEntrada[] = [
      { uf: 'SP', eleitores: 1_000_000, agregado: SP },
      { uf: 'RJ', eleitores: 500_000, agregado: null },
    ];
    const estimativa = estimarVotos(porUf, NACIONAL);
    expect(estimativa.eleitoradoTotal).toBe(1_500_000);
    expect(estimativa.eleitoradoComPesquisaEstadual).toBe(1_000_000);
  });

  it('comparacaoNacional compara pct nacional com o pct estimado por candidato', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP }];
    const estimativa = estimarVotos(porUf, NACIONAL);
    const a = estimativa.comparacaoNacional.find((c) => c.candidato === 'Candidato A')!;
    expect(a.pctNacional).toBeCloseTo(40, 6);
    expect(a.pctEstimado).toBeCloseTo(60, 6); // só há SP nesse cenário, então o estimado é o próprio pct estadual
  });

  it('retorna listas vazias/estimativa neutra quando porUf está vazio', () => {
    const estimativa = estimarVotos([], NACIONAL);
    expect(estimativa.candidatos).toEqual([]);
    expect(estimativa.eleitoradoTotal).toBe(0);
    expect(estimativa.naoAtribuidos.votos).toBe(0);
    expect(estimativa.naoAtribuidos.pct).toBe(0);
  });
});
