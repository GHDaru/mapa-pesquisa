import { describe, expect, it } from 'vitest';
import { calcularEscalaBarraComparacao, formatarMilhoes, montarSegmentosBarra } from '../vote-estimate-panel.js';

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
    expect(formatarMilhoes(62_400_000, 2)).toBe('62,40 milhões');
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

describe('vote-estimate-panel/calcularEscalaBarraComparacao', () => {
  it('calcula a posição da barra e da faixa de incerteza relativas à maior votosMax da tela', () => {
    const escala = calcularEscalaBarraComparacao(
      { votos: 60_000_000, votosMin: 58_000_000, votosMax: 62_000_000 },
      100_000_000,
    );
    expect(escala.pctBarra).toBeCloseTo(60, 6);
    expect(escala.pctMin).toBeCloseTo(58, 6);
    expect(escala.pctMax).toBeCloseTo(62, 6);
  });

  it('candidato líder (maior votosMax da tela) nunca extrapola 100% da escala', () => {
    const candidato = { votos: 62_000_000, votosMin: 60_000_000, votosMax: 64_000_000 };
    const escala = calcularEscalaBarraComparacao(candidato, candidato.votosMax);
    expect(escala.pctMax).toBeCloseTo(100, 6);
    expect(escala.pctBarra).toBeLessThanOrEqual(100);
  });

  it('candidato pequeno tem barra e faixa proporcionalmente muito menores que o líder', () => {
    const maiorVotosMax = 64_000_000; // votosMax do líder
    const pequeno = calcularEscalaBarraComparacao({ votos: 200_000, votosMin: 150_000, votosMax: 250_000 }, maiorVotosMax);
    const lider = calcularEscalaBarraComparacao({ votos: 62_000_000, votosMin: 60_000_000, votosMax: 64_000_000 }, maiorVotosMax);
    expect(pequeno.pctBarra).toBeLessThan(1);
    expect(lider.pctBarra).toBeGreaterThan(90);
  });

  it('sempre pctMin <= pctBarra <= pctMax (a faixa contém o ponto estimado)', () => {
    const casos = [
      { votos: 62_000_000, votosMin: 60_000_000, votosMax: 64_000_000 },
      { votos: 200_000, votosMin: 100_000, votosMax: 300_000 },
      { votos: 0, votosMin: 0, votosMax: 0 },
    ];
    for (const c of casos) {
      const escala = calcularEscalaBarraComparacao(c, 64_000_000);
      expect(escala.pctMin).toBeLessThanOrEqual(escala.pctBarra + 1e-9);
      expect(escala.pctBarra).toBeLessThanOrEqual(escala.pctMax + 1e-9);
    }
  });

  it('retorna os 3 valores em 0 quando a maior votosMax da tela é 0 (sem dividir por zero)', () => {
    const escala = calcularEscalaBarraComparacao({ votos: 0, votosMin: 0, votosMax: 0 }, 0);
    expect(escala).toEqual({ pctBarra: 0, pctMin: 0, pctMax: 0 });
  });
});
