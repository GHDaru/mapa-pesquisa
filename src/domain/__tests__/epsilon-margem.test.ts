import { describe, expect, it } from 'vitest';
import { EPSILON_MARGEM, classificarConfianca } from '../aggregate.js';
import { nivelConfianca } from '../../adapters/inbound/web/format.js';
import { faixaVantagem } from '../../adapters/inbound/web/views/presidential-states-layout.js';

/**
 * A margem de referência é média ponderada, e (3·peso)/peso não devolve 3
 * exato em binário. Este é o valor que a conta real produz para uma pesquisa
 * de margem 3 — o teste usa o número que machuca, não um 3 redondo.
 */
const MARGEM_COM_RESIDUO = 2.9999999999999996;

describe('EPSILON_MARGEM — as cinco comparações contra a margem concordam', () => {
  it('o resíduo binário existe mesmo: a margem calculada é menor que 3', () => {
    expect(MARGEM_COM_RESIDUO).toBeLessThan(3);
    expect(3 <= MARGEM_COM_RESIDUO).toBe(false);
  });

  it('classificarConfianca chama de empate a vantagem igual à margem', () => {
    expect(classificarConfianca(3, MARGEM_COM_RESIDUO)).toBe('empate');
  });

  it('nivelConfianca, na camada de apresentação, concorda com o domínio', () => {
    expect(nivelConfianca(3, MARGEM_COM_RESIDUO, false)).toBe('empate');
  });

  it('faixaVantagem, que pinta o mapa presidencial, concorda também', () => {
    expect(
      faixaVantagem({ vantagem: 3, margemReferencia: MARGEM_COM_RESIDUO, semDados: false }),
    ).toBe('empate');
  });

  /**
   * O epsilon é de tolerância binária, não de arredondamento político: tem de
   * ser pequeno demais para mover qualquer leitura real. Um décimo de ponto
   * acima da margem continua sendo liderança.
   */
  it('o epsilon não alarga o empate: 0,1 ponto acima da margem não é empate', () => {
    expect(classificarConfianca(3.1, 3)).not.toBe('empate');
    expect(nivelConfianca(3.1, 3, false)).not.toBe('empate');
    expect(EPSILON_MARGEM).toBeLessThan(1e-6);
  });

  it('vantagem claramente abaixo da margem continua empate, como antes', () => {
    expect(classificarConfianca(1, 3)).toBe('empate');
    expect(nivelConfianca(1, 3, false)).toBe('empate');
  });

  it('vantagem muito acima da margem continua folga, como antes', () => {
    expect(classificarConfianca(20, 3)).toBe('folga');
    expect(nivelConfianca(20, 3, false)).toBe('solid');
  });
});
