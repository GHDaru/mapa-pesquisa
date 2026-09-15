import { describe, expect, it } from 'vitest';
import { JANELA_NOVIDADES_DIAS, montarDigestDiario, TOTAL_CADEIRAS_SENADO } from '../digest.js';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../poll.js';

const ATUALIZADO_EM = '2026-09-15';

let contador = 0;
function pesquisa(sobrescritas: Partial<DadosPesquisa> = {}): Pesquisa {
  contador += 1;
  return criarPesquisa({
    id: `pesquisa-${contador}`,
    uf: 'BR',
    cargo: 'presidente',
    turno: 1,
    instituto: 'Instituto Teste',
    registroTSE: 'BR-0001/2026',
    dataFim: '2026-09-10',
    publicadoEm: '2026-09-10',
    amostra: 1000,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 50 }],
    ...sobrescritas,
  });
}

describe('domain/digest — montarDigestDiario', () => {
  it('conta o total de pesquisas e a data de atualização por extenso', () => {
    const digest = montarDigestDiario({
      pesquisas: [pesquisa(), pesquisa()],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    expect(digest.totalPesquisas).toBe(2);
    expect(digest.dataAtualizacao).toBe(ATUALIZADO_EM);
  });

  it('dataMaisRecente é a maior dataReferencia entre as pesquisas', () => {
    const digest = montarDigestDiario({
      pesquisas: [
        pesquisa({ dataFim: '2026-09-01', publicadoEm: '2026-09-01' }),
        pesquisa({ dataFim: '2026-09-12', publicadoEm: '2026-09-12' }),
        pesquisa({ dataFim: '2026-09-05', publicadoEm: '2026-09-05' }),
      ],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    expect(digest.dataMaisRecente).toBe('2026-09-12');
  });

  it('dataMaisRecente é null quando não há nenhuma pesquisa (nunca inventa)', () => {
    const digest = montarDigestDiario({
      pesquisas: [],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    expect(digest.dataMaisRecente).toBeNull();
    expect(digest.totalPesquisas).toBe(0);
    expect(digest.percentualComRegistro).toBe(0);
    expect(digest.novasNaUltimaAtualizacao.total).toBe(0);
  });

  it(`novasNaUltimaAtualizacao inclui pesquisas cuja publicação/fim de campo está nos últimos ${JANELA_NOVIDADES_DIAS} dias até a atualização, e exclui as mais antigas`, () => {
    const digest = montarDigestDiario({
      pesquisas: [
        pesquisa({ id: 'nova-1', publicadoEm: '2026-09-13', dataFim: '2026-09-12', uf: 'SP', cargo: 'governador', instituto: 'Instituto A' }),
        pesquisa({ id: 'nova-2', publicadoEm: '2026-09-15', dataFim: '2026-09-14', uf: 'RJ', cargo: 'senador', instituto: 'Instituto B' }),
        pesquisa({ id: 'antiga', publicadoEm: '2026-09-01', dataFim: '2026-08-30', uf: 'MG', cargo: 'governador', instituto: 'Instituto A' }),
      ],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    expect(digest.novasNaUltimaAtualizacao.total).toBe(2);
    expect(digest.novasNaUltimaAtualizacao.ufs).toEqual(['RJ', 'SP']);
    expect(digest.novasNaUltimaAtualizacao.institutos).toEqual(['Instituto A', 'Instituto B']);
    expect(digest.novasNaUltimaAtualizacao.porCargo).toMatchObject({ governador: 1, senador: 1, presidente: 0 });
  });

  it('novasNaUltimaAtualizacao usa dataFim quando a pesquisa não tem publicadoEm', () => {
    const digest = montarDigestDiario({
      pesquisas: [pesquisa({ id: 'sem-publicacao', publicadoEm: null, dataFim: '2026-09-14' })],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    expect(digest.novasNaUltimaAtualizacao.total).toBe(1);
  });

  it('ufsCobertas conta só governador e senador, exclui presidente e "BR"', () => {
    const digest = montarDigestDiario({
      pesquisas: [
        pesquisa({ uf: 'BR', cargo: 'presidente' }),
        pesquisa({ uf: 'SP', cargo: 'presidente' }),
        pesquisa({ uf: 'SP', cargo: 'governador' }),
        pesquisa({ uf: 'SP', cargo: 'senador' }),
        pesquisa({ uf: 'RJ', cargo: 'governador' }),
      ],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    // SP e RJ têm governador/senador; a pesquisa presidencial (BR e SP) não conta.
    expect(digest.ufsCobertas).toBe(2);
  });

  it('institutos conta institutos distintos (qualquer cargo) e comRegistroTSE/percentualComRegistro batem', () => {
    const digest = montarDigestDiario({
      pesquisas: [
        pesquisa({ instituto: 'Instituto A', registroTSE: 'BR-0001/2026' }),
        pesquisa({ instituto: 'Instituto A', registroTSE: 'BR-0002/2026' }),
        pesquisa({ instituto: 'Instituto B', registroTSE: null }),
        pesquisa({ instituto: 'Instituto C', registroTSE: null }),
      ],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 10,
      eleitoradoTotal: null,
    });
    expect(digest.institutos).toBe(3);
    expect(digest.comRegistroTSE).toBe(2);
    expect(digest.percentualComRegistro).toBeCloseTo(50, 6);
  });

  it('repassa partidos e eleitoradoTotal recebidos (não os calcula das pesquisas)', () => {
    const digest = montarDigestDiario({
      pesquisas: [pesquisa()],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 33,
      eleitoradoTotal: 150_000_000,
    });
    expect(digest.partidos).toBe(33);
    expect(digest.eleitoradoTotal).toBe(150_000_000);
  });

  it('eleitoradoTotal fica null quando não informado, sem inventar um valor', () => {
    const digest = montarDigestDiario({
      pesquisas: [pesquisa()],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 33,
      eleitoradoTotal: null,
    });
    expect(digest.eleitoradoTotal).toBeNull();
  });

  it('cadeirasSenado é a constante estrutural de 81 (27 UFs × 3 cadeiras), não um cálculo de resultado', () => {
    const digest = montarDigestDiario({
      pesquisas: [],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 0,
      eleitoradoTotal: null,
    });
    expect(digest.cadeirasSenado).toBe(81);
    expect(digest.cadeirasSenado).toBe(TOTAL_CADEIRAS_SENADO);
  });

  it('nunca expõe nome de candidato, partido ou percentual de resultado em nenhum campo', () => {
    const digest = montarDigestDiario({
      pesquisas: [pesquisa({ resultados: [{ candidato: 'Fulano da Silva', partido: 'PT', pct: 62 }] })],
      atualizadoEm: ATUALIZADO_EM,
      totalPartidos: 1,
      eleitoradoTotal: null,
    });
    const serializado = JSON.stringify(digest);
    expect(serializado).not.toContain('Fulano da Silva');
    expect(serializado).not.toMatch(/\b62\b/);
  });
});
