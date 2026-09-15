import { describe, expect, it } from 'vitest';
import type { DigestDiario } from '../../../../../application/use-cases/index.js';
import { montarBigNumbers } from '../home-view.js';

function digestFake(sobrescritas: Partial<DigestDiario> = {}): DigestDiario {
  return {
    dataAtualizacao: '2026-09-14',
    dataMaisRecente: '2026-09-13',
    novasNaUltimaAtualizacao: {
      total: 3,
      porCargo: { presidente: 1, governador: 2, senador: 0 },
      ufs: ['RJ', 'SP'],
      incluiNacional: false,
      institutos: ['Datafolha', 'Quaest'],
    },
    totalPesquisas: 1234,
    ufsCobertas: 20,
    institutos: 7,
    comRegistroTSE: 1111,
    percentualComRegistro: 90.05,
    partidos: 29,
    cadeirasSenado: 81,
    eleitoradoTotal: 150_000_000,
    ...sobrescritas,
  };
}

describe('home-view/montarBigNumbers', () => {
  it('monta 6 tiles, um por número geral do briefing (a data fica na notícia do dia)', () => {
    const tiles = montarBigNumbers(digestFake());
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.id)).toEqual([
      'pesquisas',
      'estados',
      'institutos',
      'registro-tse',
      'partidos',
      'senado',
    ]);
  });

  it('formata os valores com separador de milhar em pt-BR e sem casas decimais', () => {
    const tiles = montarBigNumbers(digestFake({ totalPesquisas: 1234 }));
    const pesquisas = tiles.find((t) => t.id === 'pesquisas')!;
    expect(pesquisas.valor).toBe('1.234');
  });

  it('o tile de pesquisas aponta para a base de pesquisas', () => {
    const tiles = montarBigNumbers(digestFake());
    expect(tiles.find((t) => t.id === 'pesquisas')!.href).toBe('#/pesquisas');
  });

  it('o tile de estados mostra a cobertura de governador/senador sobre as 27 UFs', () => {
    const tiles = montarBigNumbers(digestFake({ ufsCobertas: 20 }));
    const estados = tiles.find((t) => t.id === 'estados')!;
    expect(estados.valor).toBe('20');
    expect(estados.detalhe).toBe('de 27 estados — governador e senador');
    expect(estados.href).toBe('#/mapa');
  });

  it('o tile de registro no TSE é o único com o selo, e mostra o percentual arredondado', () => {
    const tiles = montarBigNumbers(digestFake({ percentualComRegistro: 90.05, comRegistroTSE: 1111, totalPesquisas: 1234 }));
    const tse = tiles.find((t) => t.id === 'registro-tse')!;
    expect(tse.valor).toBe('90%');
    expect(tse.detalhe).toBe('1.111 de 1.234 pesquisas');
    expect(tse.seloTse).toBe(true);
    expect(tiles.filter((t) => t.seloTse)).toHaveLength(1);
  });

  it('o tile de partidos e o de assentos do Senado repassam os números do digest sem alterar', () => {
    const tiles = montarBigNumbers(digestFake({ partidos: 29, cadeirasSenado: 81 }));
    expect(tiles.find((t) => t.id === 'partidos')!.valor).toBe('29');
    expect(tiles.find((t) => t.id === 'partidos')!.href).toBe('#/partidos');
    expect(tiles.find((t) => t.id === 'senado')!.valor).toBe('81');
    expect(tiles.find((t) => t.id === 'senado')!.href).toBe('#/senado');
  });

  it('não há tile "Atualizado em" (a data vive na notícia do dia, evitando tile órfão)', () => {
    const tiles = montarBigNumbers(digestFake({ dataAtualizacao: '2026-09-14' }));
    expect(tiles.find((t) => t.id === 'atualizado')).toBeUndefined();
  });

  it('nenhum tile carrega nome de candidato, partido de candidato ou percentual de resultado — só metadados da base', () => {
    const tiles = montarBigNumbers(digestFake());
    const serializado = JSON.stringify(tiles);
    expect(serializado).not.toMatch(/lula|bolsonaro/i);
  });

  it('zero pesquisas produz tiles coerentes (0%, sem detalhe negativo, sem quebrar)', () => {
    const tiles = montarBigNumbers(
      digestFake({ totalPesquisas: 0, comRegistroTSE: 0, percentualComRegistro: 0, ufsCobertas: 0, institutos: 0 }),
    );
    expect(tiles.find((t) => t.id === 'pesquisas')!.valor).toBe('0');
    expect(tiles.find((t) => t.id === 'registro-tse')!.valor).toBe('0%');
    expect(tiles.find((t) => t.id === 'registro-tse')!.detalhe).toBe('0 de 0 pesquisas');
  });
});
