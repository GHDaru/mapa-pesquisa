import { describe, expect, it } from 'vitest';
import { criarPesquisa, dataReferencia, type DadosPesquisa } from '../poll.js';

function pesquisaBase(sobrescritas: Partial<DadosPesquisa> = {}): DadosPesquisa {
  return {
    id: 'teste-1',
    uf: 'SP',
    cargo: 'governador',
    turno: 1,
    instituto: 'Instituto Teste',
    registroTSE: 'SP-0001/2026',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-03',
    publicadoEm: '2026-09-05',
    amostra: 1000,
    margem: 2.5,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados: [
      { candidato: 'Candidato A', partido: 'PT', pct: 40 },
      { candidato: 'Candidato B', partido: 'PL', pct: 35 },
      { candidato: 'Brancos/nulos', partido: null, pct: 25 },
    ],
    ...sobrescritas,
  };
}

describe('domain/poll', () => {
  it('cria uma pesquisa válida', () => {
    const pesquisa = criarPesquisa(pesquisaBase());
    expect(pesquisa.id).toBe('teste-1');
    expect(pesquisa.disputa.uf).toBe('SP');
    expect(pesquisa.resultados).toHaveLength(3);
  });

  it('marca naoRegistrada quando registroTSE é null', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ registroTSE: null }));
    expect(pesquisa.registroTSE.naoRegistrada).toBe(true);
  });

  it('mantém registroTSE quando presente', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ registroTSE: 'SP-9999/2026' }));
    expect(pesquisa.registroTSE.naoRegistrada).toBe(false);
    if (!pesquisa.registroTSE.naoRegistrada) {
      expect(pesquisa.registroTSE.valor).toBe('SP-9999/2026');
    }
  });

  it('rejeita pct fora do intervalo 0..100', () => {
    expect(() =>
      criarPesquisa(
        pesquisaBase({
          resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 120 }],
        }),
      ),
    ).toThrowError(/teste-1/);
  });

  it('rejeita pct negativo', () => {
    expect(() =>
      criarPesquisa(
        pesquisaBase({
          resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: -1 }],
        }),
      ),
    ).toThrow();
  });

  it('rejeita data fora do formato ISO', () => {
    expect(() => criarPesquisa(pesquisaBase({ dataInicio: '01/09/2026' }))).toThrow();
  });

  it('rejeita disputa com UF inválida', () => {
    expect(() => criarPesquisa(pesquisaBase({ uf: 'XX' }))).toThrow();
  });

  it('rejeita resultados vazio', () => {
    expect(() => criarPesquisa(pesquisaBase({ resultados: [] }))).toThrow();
  });

  it('rejeita id vazio', () => {
    expect(() => criarPesquisa(pesquisaBase({ id: '' }))).toThrow();
  });

  it('dataReferencia usa dataFim quando presente', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ dataFim: '2026-09-03', publicadoEm: '2026-09-05' }));
    expect(dataReferencia(pesquisa)).toBe('2026-09-03');
  });

  it('dataReferencia recai em publicadoEm quando não há dataFim', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ dataFim: null, publicadoEm: '2026-09-05' }));
    expect(dataReferencia(pesquisa)).toBe('2026-09-05');
  });
});
