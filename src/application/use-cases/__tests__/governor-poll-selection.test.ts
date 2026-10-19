import { describe, expect, it } from 'vitest';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../../../domain/poll.js';
import { disputaId, type Disputa } from '../../../domain/race.js';
import type { GovernadorUf } from '../../../domain/resultado.js';
import { criarApuracaoRepositoryJson } from '../../../adapters/outbound/json/apuracao-repository.js';
import type { Repositorios } from '../../ports.js';
import { RESULTADO_VAZIO } from './_resultado-fake.js';
import { selecionarPesquisasDeGovernador } from '../governor-poll-selection.js';

function pesquisa(
  dados: Partial<DadosPesquisa> & Pick<DadosPesquisa, 'id' | 'turno' | 'resultados'>,
): Pesquisa {
  return criarPesquisa({
    uf: 'SP',
    cargo: 'governador',
    instituto: 'Instituto Teste',
    registroTSE: 'SP-0001/2026',
    amostra: 1000,
    margem: 3,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    ...dados,
  });
}

function repos(pesquisas: Pesquisa[]): Repositorios {
  return {
    polls: {
      todas: () => pesquisas,
      porDisputa: (d: Disputa) => pesquisas.filter((p) => disputaId(p.disputa) === disputaId(d)),
    },
    parties: { todos: () => [], porSigla: () => undefined },
    senateSeats: { todas: () => [] },
    meta: { atualizadoEm: () => '2026-10-19' },
    electorate: { todos: () => [], porUf: () => undefined },
    apuracao: criarApuracaoRepositoryJson({ atualizadoEm: '2026-01-01T00:00:00Z', recortes: [] }),
    resultado: { dados: () => RESULTADO_VAZIO },
  };
}

const RESULTADOS = [
  { candidato: 'Candidato A', partido: 'PP', pct: 50 },
  { candidato: 'Candidato B', partido: 'PT', pct: 40 },
  { candidato: 'Brancos/nulos', partido: null, pct: 10 },
];

const T1_ANTES = pesquisa({
  id: 't1-antes',
  turno: 1,
  dataInicio: '2026-10-01',
  dataFim: '2026-10-03',
  resultados: RESULTADOS,
});
const T2_SIMULACAO_ANTES = pesquisa({
  id: 't2-simulacao-antes',
  turno: 2,
  dataInicio: '2026-09-20',
  dataFim: '2026-10-01',
  resultados: RESULTADOS,
});
const T2_DEPOIS = pesquisa({
  id: 't2-depois',
  turno: 2,
  dataInicio: '2026-10-10',
  dataFim: '2026-10-13',
  resultados: RESULTADOS,
});

const ELEITO: GovernadorUf = {
  uf: 'SP',
  situacao: 'eleito',
  eleito: { nome: 'Candidato A', partido: 'PP', pctValidos: 55 },
  finalistas: [],
};
const EM_SEGUNDO_TURNO: GovernadorUf = {
  uf: 'SP',
  situacao: 'segundo-turno',
  eleito: null,
  finalistas: [
    { nome: 'Candidato A', partido: 'PP', pctValidos: 45 },
    { nome: 'Candidato B', partido: 'PT', pctValidos: 35 },
  ],
};

describe('selecionarPesquisasDeGovernador', () => {
  /**
   * A regressão que o módulo existe para impedir: São Paulo foi decidido no 1º
   * turno, e a regra antiga mostrava ali a simulação de 2º turno medida antes
   * da eleição — um 2º turno que nunca aconteceu.
   */
  it('na UF decidida, ignora a simulação de 2º turno anterior à eleição', () => {
    const r = repos([T1_ANTES, T2_SIMULACAO_ANTES, T2_DEPOIS]);
    const ids = selecionarPesquisasDeGovernador(r, 'SP', ELEITO).map((p) => p.id);
    expect(ids).toEqual(['t1-antes']);
  });

  it('na UF em 2º turno, só entram as de campo posterior à eleição', () => {
    const r = repos([T1_ANTES, T2_SIMULACAO_ANTES, T2_DEPOIS]);
    const ids = selecionarPesquisasDeGovernador(r, 'SP', EM_SEGUNDO_TURNO).map((p) => p.id);
    expect(ids).toEqual(['t2-depois']);
  });

  it('na UF em 2º turno, descarta confronto que as urnas não confirmaram', () => {
    const outroPar = pesquisa({
      id: 't2-outro-par',
      turno: 2,
      dataInicio: '2026-10-10',
      dataFim: '2026-10-13',
      resultados: [
        { candidato: 'Candidato A', partido: 'PP', pct: 48 },
        { candidato: 'Quem não passou', partido: 'PL', pct: 42 },
        { candidato: 'Brancos/nulos', partido: null, pct: 10 },
      ],
    });
    const r = repos([outroPar]);
    expect(selecionarPesquisasDeGovernador(r, 'SP', EM_SEGUNDO_TURNO)).toHaveLength(0);
  });

  it('sem dado de resultado, mantém a regra antiga: 2º turno quando houver', () => {
    const r = repos([T1_ANTES, T2_SIMULACAO_ANTES]);
    const ids = selecionarPesquisasDeGovernador(r, 'SP', null).map((p) => p.id);
    expect(ids).toEqual(['t2-simulacao-antes']);
  });

  it('sem dado de resultado e sem 2º turno, cai no 1º turno', () => {
    const r = repos([T1_ANTES]);
    const ids = selecionarPesquisasDeGovernador(r, 'SP', null).map((p) => p.id);
    expect(ids).toEqual(['t1-antes']);
  });

  it('pesquisa com campo EXATAMENTE no dia da eleição conta como anterior', () => {
    const noDia = pesquisa({
      id: 't1-no-dia',
      turno: 1,
      dataInicio: '2026-10-02',
      dataFim: '2026-10-04',
      resultados: RESULTADOS,
    });
    const r = repos([noDia]);
    expect(selecionarPesquisasDeGovernador(r, 'SP', ELEITO).map((p) => p.id)).toEqual([
      't1-no-dia',
    ]);
    // E a mesma data NÃO conta como posterior do lado do 2º turno.
    const noDiaT2 = pesquisa({
      id: 't2-no-dia',
      turno: 2,
      dataInicio: '2026-10-02',
      dataFim: '2026-10-04',
      resultados: RESULTADOS,
    });
    expect(selecionarPesquisasDeGovernador(repos([noDiaT2]), 'SP', EM_SEGUNDO_TURNO)).toHaveLength(
      0,
    );
  });
});
