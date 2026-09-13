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

// Agregado nacional com um 3º candidato menor (C, 15%) — cenário real: uma
// pesquisa estadual que só testa os 2 primeiros colocados não deveria zerar
// esse candidato menor (ver PARTE 1 do enunciado, caso "Cury").
const NACIONAL_ABC = agregarPesquisas(
  [
    pesquisa({
      uf: 'BR',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 40 },
        { candidato: 'Candidato B', partido: 'PL', pct: 35 },
        { candidato: 'Candidato C', partido: 'PODE', pct: 15 },
        { candidato: 'Brancos/nulos', partido: null, pct: 10 },
      ],
    }),
  ],
  {},
  HOJE,
)!;

// Pesquisa estadual de MG só testa A e B (C nem aparece na lista de
// resultados) — sobra 20% de "espaço" na UF antes de somar o complemento
// nacional de C (15%), então a soma final (50+30+15=95) não passa de 100%.
const MG_AB = agregarPesquisas(
  [
    pesquisa({
      uf: 'MG',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 50 },
        { candidato: 'Candidato B', partido: 'PL', pct: 30 },
        { candidato: 'Brancos/nulos', partido: null, pct: 20 },
      ],
    }),
  ],
  {},
  HOJE,
)!;

// Pesquisa estadual de SP também só testa A e B, mas a soma de A+B (90) já é
// alta o bastante para que somar o complemento nacional de C (15%) estoure
// 100% (90+15=105) — força a normalização proporcional daquela UF.
const SP_AB_ESTOURA = agregarPesquisas(
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
    expect(rj.votosPorCandidato['Candidato A']!.votos).toBeCloseTo(1_000_000 * 0.4, 6);
    expect(rj.votosPorCandidato['Candidato A']!.origem).toBe('nacional');
    expect(estimativa.ufsSemPesquisa).toEqual(['RJ']);
    expect(estimativa.ufsComPesquisa).toEqual([]);
  });

  it('UF com pesquisa estadual usa os percentuais do agregado estadual, não do nacional', () => {
    const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP }];
    const estimativa = estimarVotos(porUf, NACIONAL);

    const sp = estimativa.porUf.find((u) => u.uf === 'SP')!;
    expect(sp.origem).toBe('estadual');
    expect(sp.votosPorCandidato['Candidato A']!.votos).toBeCloseTo(1_000_000 * 0.6, 6);
    expect(sp.votosPorCandidato['Candidato A']!.origem).toBe('estadual');
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

  describe('complemento nacional para candidatos ausentes da pesquisa estadual', () => {
    it('candidato do nacional ausente da pesquisa estadual recebe o percentual nacional aplicado ao eleitorado da UF', () => {
      const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'MG', eleitores: 1_000_000, agregado: MG_AB }];
      const estimativa = estimarVotos(porUf, NACIONAL_ABC);

      const c = estimativa.candidatos.find((cand) => cand.candidato === 'Candidato C')!;
      expect(c).toBeDefined();
      // C não aparece em MG_AB; 15% (pct nacional) de 1_000_000.
      expect(c.votos).toBeCloseTo(150_000, 6);
      expect(c.votosComplementoNacional).toBeCloseTo(150_000, 6);
      expect(c.votosDeUfComPesquisa).toBe(0);
      expect(c.votosDeUfSemPesquisa).toBe(0);

      const mg = estimativa.porUf.find((u) => u.uf === 'MG')!;
      expect(mg.origem).toBe('estadual'); // a UF TEM pesquisa estadual própria
      expect(mg.votosPorCandidato['Candidato C']!.origem).toBe('complemento-nacional');
      expect(mg.votosPorCandidato['Candidato C']!.votos).toBeCloseTo(150_000, 6);
    });

    it('não zera um candidato menor ausente das pesquisas estaduais (caso "Cury"): soma o complemento de várias UFs', () => {
      const porUf: EstimativaVotosUfEntrada[] = [
        { uf: 'MG', eleitores: 1_000_000, agregado: MG_AB },
        { uf: 'RS', eleitores: 500_000, agregado: null }, // sem pesquisa estadual: usa o nacional inteiro
      ];
      const estimativa = estimarVotos(porUf, NACIONAL_ABC);

      const c = estimativa.candidatos.find((cand) => cand.candidato === 'Candidato C')!;
      // MG: complemento 15% de 1_000_000 = 150_000. RS: nacional 15% de 500_000 = 75_000.
      expect(c.votos).toBeCloseTo(150_000 + 75_000, 6);
      expect(c.votosComplementoNacional).toBeCloseTo(150_000, 6);
      expect(c.votosDeUfSemPesquisa).toBeCloseTo(75_000, 6);
      // Sem a correção, C teria 0 em MG (pesquisa estadual não o testou) —
      // aqui o percentual sobre o eleitorado nunca cai a 0.
      expect(c.pctDoEleitorado).toBeGreaterThan(0);
    });

    it('candidato já presente na pesquisa estadual não recebe complemento (votosComplementoNacional fica em 0)', () => {
      const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'MG', eleitores: 1_000_000, agregado: MG_AB }];
      const estimativa = estimarVotos(porUf, NACIONAL_ABC);

      const a = estimativa.candidatos.find((cand) => cand.candidato === 'Candidato A')!;
      expect(a.votosComplementoNacional).toBe(0);
      expect(a.votosDeUfComPesquisa).toBeCloseTo(500_000, 6); // 50% de 1_000_000, pct próprio de MG

      const mg = estimativa.porUf.find((u) => u.uf === 'MG')!;
      expect(mg.votosPorCandidato['Candidato A']!.origem).toBe('estadual');
    });

    it('quando a soma dos percentuais de uma UF passa de 100%, normaliza proporcionalmente e registra a UF em ufsNormalizadas', () => {
      const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP_AB_ESTOURA }];
      const estimativa = estimarVotos(porUf, NACIONAL_ABC);

      // Bruto: A 60 + B 30 + C(complemento) 15 = 105% — estoura o eleitorado.
      expect(estimativa.ufsNormalizadas).toEqual(['SP']);

      const sp = estimativa.porUf.find((u) => u.uf === 'SP')!;
      const somaVotosUf = Object.values(sp.votosPorCandidato).reduce((soma, v) => soma + v.votos, 0);
      // A soma normalizada nunca ultrapassa o eleitorado da UF.
      expect(somaVotosUf).toBeCloseTo(1_000_000, 3);
      expect(somaVotosUf).toBeLessThanOrEqual(1_000_000 + 1e-6);

      // Proporção entre candidatos preservada: A ainda é o dobro de B (60 vs 30).
      const votosA = sp.votosPorCandidato['Candidato A']!.votos;
      const votosB = sp.votosPorCandidato['Candidato B']!.votos;
      expect(votosA / votosB).toBeCloseTo(2, 6);
    });

    it('naoAtribuidos nunca fica negativo, mesmo quando a UF precisou ser normalizada para caber no eleitorado', () => {
      const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'SP', eleitores: 1_000_000, agregado: SP_AB_ESTOURA }];
      const estimativa = estimarVotos(porUf, NACIONAL_ABC);

      // Toda a UF foi normalizada para 100%: nada sobra para "não atribuídos".
      expect(estimativa.naoAtribuidos.votos).toBeCloseTo(0, 3);
      expect(estimativa.naoAtribuidos.votos).toBeGreaterThanOrEqual(0);
      expect(estimativa.naoAtribuidos.pct).toBeGreaterThanOrEqual(0);
    });

    it('UF sem pesquisa estadual usa o nacional inteiro e nunca gera origem "complemento-nacional"', () => {
      const porUf: EstimativaVotosUfEntrada[] = [{ uf: 'RS', eleitores: 500_000, agregado: null }];
      const estimativa = estimarVotos(porUf, NACIONAL_ABC);

      const rs = estimativa.porUf.find((u) => u.uf === 'RS')!;
      expect(rs.origem).toBe('nacional');
      for (const v of Object.values(rs.votosPorCandidato)) {
        expect(v.origem).toBe('nacional');
      }
      expect(estimativa.ufsNormalizadas).toEqual([]);
    });
  });
});
