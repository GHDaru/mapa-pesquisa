import { describe, expect, it } from 'vitest';
import {
  hashDoMapa,
  hashDoTurno,
  mapaDoHash,
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

/**
 * Modo de mapa no endereço. A apuração ao vivo é mais um modo DESTA tela, e
 * não uma página: foi o pedido explícito — "é mais uma no mapa, não criar
 * outra página". Mas um modo sem endereço não é compartilhável e não sobrevive
 * ao reload, que numa noite de apuração é o gesto mais frequente que existe.
 * Daí o parâmetro, com a mesma regra do turno: o padrão não aparece na URL.
 */
describe('presidential-states-layout: mapaDoHash', () => {
  it('lê o modo pedido', () => {
    expect(mapaDoHash('#/presidente-estados?mapa=apuracao')).toBe('apuracao');
    expect(mapaDoHash('#/presidente-estados?mapa=eleitorado')).toBe('eleitorado');
  });

  it('"quem lidera" é o padrão e dispensa parâmetro', () => {
    expect(mapaDoHash('#/presidente-estados')).toBe('lideranca');
    expect(mapaDoHash('#/presidente-estados?mapa=lideranca')).toBe('lideranca');
    expect(mapaDoHash('')).toBe('lideranca');
  });

  it('valor desconhecido não impede a tela de montar', () => {
    expect(mapaDoHash('#/presidente-estados?mapa=inexistente')).toBe('lideranca');
    expect(mapaDoHash('#/presidente-estados?mapa=')).toBe('lideranca');
  });

  it('turno e modo convivem na mesma query, em qualquer ordem', () => {
    expect(mapaDoHash('#/presidente-estados?turno=2&mapa=apuracao')).toBe('apuracao');
    expect(mapaDoHash('#/presidente-estados?mapa=apuracao&turno=2')).toBe('apuracao');
    expect(turnoDoHash('#/presidente-estados?mapa=apuracao&turno=2')).toBe(2);
  });
});

describe('presidential-states-layout: hashDoMapa', () => {
  it('omite o que é padrão e escreve só o que foge dele', () => {
    expect(hashDoMapa(1, 'lideranca')).toBe(ROTA_PRESIDENTE_ESTADOS);
    expect(hashDoMapa(2, 'lideranca')).toBe('#/presidente-estados?turno=2');
    expect(hashDoMapa(1, 'apuracao')).toBe('#/presidente-estados?mapa=apuracao');
    expect(hashDoMapa(2, 'apuracao')).toBe('#/presidente-estados?turno=2&mapa=apuracao');
  });

  it('concorda com hashDoTurno quando o mapa é o padrão', () => {
    expect(hashDoMapa(1, 'lideranca')).toBe(hashDoTurno(1));
    expect(hashDoMapa(2, 'lideranca')).toBe(hashDoTurno(2));
  });

  it('é a volta exata das duas leituras (ida e volta)', () => {
    for (const turno of [1, 2] as const) {
      for (const mapa of ['lideranca', 'eleitorado', 'apuracao'] as const) {
        const hash = hashDoMapa(turno, mapa);
        expect(turnoDoHash(hash)).toBe(turno);
        expect(mapaDoHash(hash)).toBe(mapa);
      }
    }
  });

  it('o roteador continua enxergando a mesma rota', () => {
    expect(rotaDoHash(hashDoMapa(2, 'apuracao'))).toBe(ROTA_PRESIDENTE_ESTADOS);
  });
});
