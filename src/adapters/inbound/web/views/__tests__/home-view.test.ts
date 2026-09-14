import { describe, expect, it } from 'vitest';
import { agregarPesquisas, type Agregado } from '../../../../../domain/aggregate.js';
import { criarPesquisa, type Pesquisa } from '../../../../../domain/poll.js';
import type { CandidatoEstimado, EstimativaVotos } from '../../../../../domain/vote-estimate.js';
import type { Espectro } from '../../../../../domain/spectrum.js';
import { montarResumoDoDia } from '../home-view.js';

const HOJE = new Date('2026-09-14T12:00:00Z');

function pesquisaFake(id: string, resultados: { candidato: string; partido: string | null; pct: number }[]): Pesquisa {
  return criarPesquisa({
    id,
    uf: 'BR',
    cargo: 'presidente',
    turno: 1,
    instituto: 'Instituto Teste',
    registroTSE: 'BR-0001/2026',
    dataFim: '2026-09-10',
    amostra: 2000,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados,
  });
}

function agregadoComLider(): Agregado {
  const pesquisas = [
    pesquisaFake('p1', [
      { candidato: 'Fulano da Silva', partido: 'PT', pct: 45 },
      { candidato: 'Ciclana Souza', partido: 'PL', pct: 40 },
      { candidato: 'Brancos/nulos', partido: null, pct: 15 },
    ]),
  ];
  const agregado = agregarPesquisas(pesquisas, {}, HOJE);
  if (!agregado) throw new Error('fixture inválida: esperava um agregado.');
  return agregado;
}

/** Agregado onde só há linhas não-candidato (brancos/nulos) — `lider` fica null. */
function agregadoSemLider(): Agregado {
  const pesquisas = [pesquisaFake('p2', [{ candidato: 'Brancos/nulos', partido: null, pct: 100 }])];
  const agregado = agregarPesquisas(pesquisas, {}, HOJE);
  if (!agregado) throw new Error('fixture inválida: esperava um agregado.');
  return agregado;
}

function estimativaFake(
  candidatos: readonly { candidato: string; partido: string | null; votos: number; pctDoEleitorado: number }[],
): EstimativaVotos {
  const candidatosCompletos: CandidatoEstimado[] = candidatos.map((c) => ({
    candidato: c.candidato,
    partido: c.partido,
    votos: c.votos,
    votosMin: c.votos,
    votosMax: c.votos,
    pctDoEleitorado: c.pctDoEleitorado,
    pctDosVotosAtribuidos: c.pctDoEleitorado,
    votosDeUfComPesquisa: c.votos,
    votosDeUfSemPesquisa: 0,
    votosComplementoNacional: 0,
  }));
  return {
    candidatos: candidatosCompletos,
    naoAtribuidos: { votos: 0, pct: 0 },
    eleitoradoTotal: 0,
    eleitoradoComPesquisaEstadual: 0,
    ufsComPesquisa: [],
    ufsSemPesquisa: [],
    porUf: [],
    comparacaoNacional: [],
    ufsNormalizadas: [],
  };
}

const TOTAL_POR_ESPECTRO_COMPLETO: Readonly<Record<Espectro, number>> = {
  esquerda: 10,
  'centro-esquerda': 5,
  centro: 4,
  'centro-direita': 6,
  direita: 12,
  indefinido: 0,
};

describe('home-view/montarResumoDoDia', () => {
  it('monta os 3 números do resumo quando há dados completos', () => {
    const resumo = montarResumoDoDia(
      agregadoComLider(),
      estimativaFake([
        { candidato: 'Fulano da Silva', partido: 'PT', votos: 60_000_000, pctDoEleitorado: 40 },
        { candidato: 'Ciclana Souza', partido: 'PL', votos: 52_000_000, pctDoEleitorado: 34 },
      ]),
      TOTAL_POR_ESPECTRO_COMPLETO,
    );

    expect(resumo.presidencial).not.toBeNull();
    expect(resumo.presidencial?.lider).toBe('Fulano da Silva');
    expect(resumo.presidencial?.partido).toBe('PT');
    expect(resumo.presidencial?.vantagem).toBeCloseTo(5, 6);
    expect(resumo.presidencial?.empateTecnico).toBe(false);
    expect(resumo.presidencial?.segundo).toEqual({ candidato: 'Ciclana Souza', partido: 'PL', pct: 40 });
    expect(resumo.presidencial?.margemReferencia).toBeGreaterThan(0);
    expect(resumo.presidencial?.pesquisasUsadas).toBe(1);

    expect(resumo.votos).not.toBeNull();
    expect(resumo.votos?.primeiro.candidato).toBe('Fulano da Silva');
    expect(resumo.votos?.segundo?.candidato).toBe('Ciclana Souza');

    // esquerda = esquerda(10) + centro-esquerda(5); direita = centro-direita(6) + direita(12); centro = centro(4) + indefinido(0)
    expect(resumo.senado).toEqual({ esquerda: 15, centro: 4, direita: 18, total: 37 });
  });

  it('presidencial fica null quando não há agregado presidencial (turno1 ainda sem pesquisa)', () => {
    const resumo = montarResumoDoDia(null, null, TOTAL_POR_ESPECTRO_COMPLETO);
    expect(resumo.presidencial).toBeNull();
  });

  it('presidencial fica null quando o agregado existe mas não tem líder (só brancos/nulos)', () => {
    const resumo = montarResumoDoDia(agregadoSemLider(), null, TOTAL_POR_ESPECTRO_COMPLETO);
    expect(resumo.presidencial).toBeNull();
  });

  it('presidencial.segundo fica null quando só há 1 candidato no agregado', () => {
    const pesquisas = [
      pesquisaFake('p3', [
        { candidato: 'Único Candidato', partido: 'PT', pct: 60 },
        { candidato: 'Brancos/nulos', partido: null, pct: 40 },
      ]),
    ];
    const agregado = agregarPesquisas(pesquisas, {}, HOJE);
    if (!agregado) throw new Error('fixture inválida: esperava um agregado.');
    const resumo = montarResumoDoDia(agregado, null, TOTAL_POR_ESPECTRO_COMPLETO);
    expect(resumo.presidencial?.segundo).toBeNull();
  });

  it('votos fica null quando a estimativa de votos é null (eleitorado insuficiente)', () => {
    const resumo = montarResumoDoDia(agregadoComLider(), null, TOTAL_POR_ESPECTRO_COMPLETO);
    expect(resumo.votos).toBeNull();
  });

  it('votos.segundo fica null quando a estimativa só tem 1 candidato', () => {
    const resumo = montarResumoDoDia(
      agregadoComLider(),
      estimativaFake([{ candidato: 'Único Candidato', partido: 'PT', votos: 1000, pctDoEleitorado: 100 }]),
      TOTAL_POR_ESPECTRO_COMPLETO,
    );
    expect(resumo.votos?.primeiro.candidato).toBe('Único Candidato');
    expect(resumo.votos?.segundo).toBeNull();
  });

  it('bucket "indefinido" do Senado entra em "centro", e a soma dos 3 blocos bate com o total', () => {
    const resumo = montarResumoDoDia(null, null, {
      esquerda: 3,
      centro: 2,
      direita: 1,
      indefinido: 5,
    });
    expect(resumo.senado).toEqual({ esquerda: 3, centro: 7, direita: 1, total: 11 });
  });

  it('espectros ausentes de totalPorEspectro contam como zero (não quebra)', () => {
    const resumo = montarResumoDoDia(null, null, { esquerda: 2 });
    expect(resumo.senado).toEqual({ esquerda: 2, centro: 0, direita: 0, total: 2 });
  });
});
