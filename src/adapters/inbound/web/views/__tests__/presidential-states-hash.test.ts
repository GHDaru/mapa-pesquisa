import { describe, expect, it } from 'vitest';
import {
  hashDoTurno,
  rotaDoHash,
  ROTA_PRESIDENTE_ESTADOS,
  turnoDoHash,
} from '../presidential-states-layout.js';

/**
 * Turno no endereço da tela "Presidente por estado". Antes, clicar em
 * "2º turno" não mudava a URL: o mapa de 2º turno não tinha endereço próprio
 * (nada para compartilhar) e um reload devolvia o leitor ao 1º turno. As duas
 * leituras do hash — a rota, usada pelo roteador de main.ts, e o parâmetro,
 * usado pela tela na montagem — moram juntas para nunca divergirem.
 */

describe('presidential-states-layout: turnoDoHash', () => {
  it('lê o 2º turno do parâmetro', () => {
    expect(turnoDoHash('#/presidente-estados?turno=2')).toBe(2);
  });

  it('o 1º turno é o padrão e dispensa parâmetro', () => {
    expect(turnoDoHash('#/presidente-estados')).toBe(1);
    expect(turnoDoHash('#/presidente-estados?turno=1')).toBe(1);
  });

  it('não quebra a montagem com valor inesperado — cai no 1º turno', () => {
    expect(turnoDoHash('#/presidente-estados?turno=3')).toBe(1);
    expect(turnoDoHash('#/presidente-estados?turno=')).toBe(1);
    expect(turnoDoHash('#/presidente-estados?outro=2')).toBe(1);
    expect(turnoDoHash('')).toBe(1);
    expect(turnoDoHash('#/inicio')).toBe(1);
  });

  it('convive com outros parâmetros na mesma query', () => {
    expect(turnoDoHash('#/presidente-estados?aba=votos&turno=2')).toBe(2);
    expect(turnoDoHash('#/presidente-estados?turno=2&aba=votos')).toBe(2);
  });
});

describe('presidential-states-layout: hashDoTurno', () => {
  it('dá endereço próprio ao 2º turno e deixa o 1º na rota limpa', () => {
    expect(hashDoTurno(2)).toBe('#/presidente-estados?turno=2');
    expect(hashDoTurno(1)).toBe(ROTA_PRESIDENTE_ESTADOS);
  });

  it('é a volta exata de turnoDoHash (ida e volta)', () => {
    expect(turnoDoHash(hashDoTurno(1))).toBe(1);
    expect(turnoDoHash(hashDoTurno(2))).toBe(2);
  });
});

describe('presidential-states-layout: rotaDoHash (usada pelo roteador)', () => {
  it('descarta os parâmetros para a rota continuar sendo a mesma', () => {
    expect(rotaDoHash('#/presidente-estados?turno=2')).toBe('#/presidente-estados');
    expect(rotaDoHash(hashDoTurno(2))).toBe(ROTA_PRESIDENTE_ESTADOS);
  });

  it('não mexe em hash sem parâmetros', () => {
    expect(rotaDoHash('#/mapa')).toBe('#/mapa');
    expect(rotaDoHash('#/inicio')).toBe('#/inicio');
    expect(rotaDoHash('')).toBe('');
  });
});
