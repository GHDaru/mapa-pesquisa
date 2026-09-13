import { describe, expect, it } from 'vitest';
import { formatarMilhoes, montarSegmentosBarra } from '../vote-estimate-panel.js';

describe('vote-estimate-panel/formatarMilhoes', () => {
  it('formata votos em milhões com 1 casa decimal e vírgula pt-BR', () => {
    expect(formatarMilhoes(62_300_000)).toBe('62,3 milhões');
  });

  it('arredonda para 1 casa decimal', () => {
    expect(formatarMilhoes(1_234_567)).toBe('1,2 milhões');
  });

  it('formata zero como "0,0 milhões"', () => {
    expect(formatarMilhoes(0)).toBe('0,0 milhões');
  });

  it('formata valores menores que 1 milhão corretamente', () => {
    expect(formatarMilhoes(900_000)).toBe('0,9 milhões');
  });

  it('aceita número de casas decimais customizado', () => {
    expect(formatarMilhoes(62_345_000, 2)).toBe('62,35 milhões');
  });
});

describe('vote-estimate-panel/montarSegmentosBarra', () => {
  it('as 3 proporções somam 100 quando há votos', () => {
    const seg = montarSegmentosBarra({
      votos: 1_000_000,
      votosDeUfComPesquisa: 600_000,
      votosComplementoNacional: 150_000,
      votosDeUfSemPesquisa: 250_000,
    });
    expect(seg.pctEstadual + seg.pctComplemento + seg.pctSemPesquisa).toBeCloseTo(100, 6);
  });

  it('calcula a proporção correta de cada origem', () => {
    const seg = montarSegmentosBarra({
      votos: 1_000_000,
      votosDeUfComPesquisa: 600_000,
      votosComplementoNacional: 150_000,
      votosDeUfSemPesquisa: 250_000,
    });
    expect(seg.pctEstadual).toBeCloseTo(60, 6);
    expect(seg.pctComplemento).toBeCloseTo(15, 6);
    expect(seg.pctSemPesquisa).toBeCloseTo(25, 6);
  });

  it('quando só há uma origem, ela sozinha soma 100', () => {
    const seg = montarSegmentosBarra({
      votos: 500_000,
      votosDeUfComPesquisa: 500_000,
      votosComplementoNacional: 0,
      votosDeUfSemPesquisa: 0,
    });
    expect(seg).toEqual({ pctEstadual: 100, pctComplemento: 0, pctSemPesquisa: 0 });
  });

  it('candidato sem nenhum voto estimado (total 0) não divide por zero: os 3 segmentos ficam em 0', () => {
    const seg = montarSegmentosBarra({
      votos: 0,
      votosDeUfComPesquisa: 0,
      votosComplementoNacional: 0,
      votosDeUfSemPesquisa: 0,
    });
    expect(seg).toEqual({ pctEstadual: 0, pctComplemento: 0, pctSemPesquisa: 0 });
    expect(seg.pctEstadual + seg.pctComplemento + seg.pctSemPesquisa).toBe(0);
  });
});
