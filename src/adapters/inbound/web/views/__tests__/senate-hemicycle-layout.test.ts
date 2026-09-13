import { describe, expect, it } from 'vitest';
import { calcularLayoutHemiciclo, calcularNumeroFileiras } from '../senate-view.js';

describe('senate-view: calcularLayoutHemiciclo (geometria pura do hemiciclo)', () => {
  it('retorna exatamente 81 posições para 81 assentos', () => {
    const layout = calcularLayoutHemiciclo(81);
    expect(layout).toHaveLength(81);
  });

  it('distribui 81 assentos em 4 fileiras concêntricas, somando o total', () => {
    const layout = calcularLayoutHemiciclo(81);
    const fileiras = new Set(layout.map((p) => p.fileira));
    expect(fileiras.size).toBe(4);
    expect([...fileiras].sort()).toEqual([0, 1, 2, 3]);

    const porFileira = new Map<number, number>();
    for (const pos of layout) porFileira.set(pos.fileira, (porFileira.get(pos.fileira) ?? 0) + 1);
    const somaTotal = [...porFileira.values()].reduce((s, v) => s + v, 0);
    expect(somaTotal).toBe(81);
    // Fileiras mais externas (raio maior) recebem mais assentos (arco mais longo).
    expect(porFileira.get(3)!).toBeGreaterThan(porFileira.get(0)!);
  });

  it('usa 3 fileiras para hemiciclos pequenos e 4 a partir de 49 assentos', () => {
    expect(calcularNumeroFileiras(48)).toBe(3);
    expect(calcularNumeroFileiras(49)).toBe(4);
    expect(calcularNumeroFileiras(81)).toBe(4);
  });

  it('ordena da esquerda (ângulo maior) para a direita (ângulo menor), na ordem de entrada', () => {
    const layout = calcularLayoutHemiciclo(81);
    for (let i = 1; i < layout.length; i++) {
      expect(layout[i]!.anguloGraus).toBeLessThanOrEqual(layout[i - 1]!.anguloGraus);
    }
    // Extremos plausíveis: primeiro assento perto de 180°, último perto de 0°.
    expect(layout[0]!.anguloGraus).toBeGreaterThan(170);
    expect(layout[layout.length - 1]!.anguloGraus).toBeLessThan(10);
  });

  it('mantém todos os ângulos dentro do intervalo [0, 180]', () => {
    for (const total of [1, 5, 40, 81, 100]) {
      const layout = calcularLayoutHemiciclo(total);
      for (const pos of layout) {
        expect(pos.anguloGraus).toBeGreaterThanOrEqual(0);
        expect(pos.anguloGraus).toBeLessThanOrEqual(180);
      }
    }
  });

  it('assentos da mesma fileira compartilham o mesmo raio, e o raio cresce por fileira', () => {
    const layout = calcularLayoutHemiciclo(81);
    const raioPorFileira = new Map<number, Set<number>>();
    for (const pos of layout) {
      const raios = raioPorFileira.get(pos.fileira) ?? new Set<number>();
      raios.add(pos.raio);
      raioPorFileira.set(pos.fileira, raios);
    }
    for (const raios of raioPorFileira.values()) {
      expect(raios.size).toBe(1);
    }
    expect(raioPorFileira.get(0)!.values().next().value).toBeLessThan(raioPorFileira.get(3)!.values().next().value!);
  });

  it('funciona para totais diferentes de 81 (ex.: 40 assentos, 3 fileiras)', () => {
    const layout = calcularLayoutHemiciclo(40);
    expect(layout).toHaveLength(40);
    const fileiras = new Set(layout.map((p) => p.fileira));
    expect(fileiras.size).toBe(3);
  });

  it('retorna lista vazia para zero assentos', () => {
    expect(calcularLayoutHemiciclo(0)).toEqual([]);
  });

  it('calcula x/y consistentes com o ângulo (topo abre para cima, y <= 0)', () => {
    const layout = calcularLayoutHemiciclo(81);
    for (const pos of layout) {
      expect(pos.y).toBeLessThanOrEqual(1e-9);
      expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(pos.raio, 5);
    }
  });
});
