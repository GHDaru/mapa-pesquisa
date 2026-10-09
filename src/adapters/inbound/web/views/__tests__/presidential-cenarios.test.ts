import { describe, expect, it } from 'vitest';
import { rotuloJanelaCenario, rotuloSituacaoCenario } from '../presidential-view.js';

/**
 * Os cartões de cenário de 2º turno, depois que as urnas decidiram quem passou.
 *
 * Até 08/10 a tela publicava os cinco cenários com a mesma aparência: o
 * confronto real e "Lula x Romeu Zema", "Lula x Ronaldo Caiado" e "Lula x Renan
 * Santos", três disputas que o 1º turno de 04/10 tornou impossíveis. Eram
 * corretos enquanto ninguém sabia quem passaria, e viraram enganosos no instante
 * em que a urna respondeu.
 *
 * Ordenar o superado para o fim não bastaria: o cartão tem de DIZER o que ele é.
 */
describe('rótulo de situação do cenário de 2º turno', () => {
  it('o cenário superado diz que a disputa não vai acontecer', () => {
    const t = rotuloSituacaoCenario('superado')!;
    expect(t).toContain('SUPERADO');
    expect(t).toContain('não vai acontecer');
    // E explica por que continua no ar, em vez de parecer um bug.
    expect(t).toContain('registro do que as pesquisas');
  });

  it('o cenário vigente diz que é este o 2º turno, e credita as urnas', () => {
    const t = rotuloSituacaoCenario('vigente')!;
    expect(t).toContain('É este o 2º turno');
    expect(t).toContain('04/10');
    expect(t).not.toContain('SUPERADO');
  });

  it('enquanto o 1º turno não decide, não rotula nada', () => {
    // Antes de 04/10 todos os cenários eram hipótese legítima, e dizer isso em
    // cada cartão seria ruído.
    expect(rotuloSituacaoCenario('indefinido')).toBeNull();
  });

  it('os dois rótulos são distinguíveis, não variações do mesmo texto', () => {
    expect(rotuloSituacaoCenario('superado')).not.toBe(rotuloSituacaoCenario('vigente'));
  });
});

describe('de quando fala o número do cartão de 2º turno', () => {
  it('a janela pós-eleição diz quantas pesquisas e por que as antigas saíram', () => {
    const t = rotuloJanelaCenario('pos-1o-turno', 'vigente', 4)!;
    expect(t).toContain('4 pesquisas');
    expect(t).toContain('POSTERIOR ao 1º turno');
    expect(t).toContain('hipotético');
    // E diz que o dado antigo não foi destruído.
    expect(t).toContain('seguem na base');
  });

  it('a janela que atravessa 04/10 é AVISO, não nota neutra', () => {
    const t = rotuloJanelaCenario('inclui-pre-1o-turno', 'vigente', 55)!;
    expect(t).toContain('ATENÇÃO');
    expect(t).toContain('ATRAVESSA');
    expect(t).toContain('não sobre a disputa marcada');
  });

  it('singular quando é uma só pesquisa', () => {
    expect(rotuloJanelaCenario('pos-1o-turno', 'vigente', 1)).toContain('Só 1 pesquisa ');
    expect(rotuloJanelaCenario('pos-1o-turno', 'vigente', 1)).not.toContain('1 pesquisas');
  });

  it('cenário superado e indefinido não recebem rótulo de janela', () => {
    // No superado o recorte não significaria nada, e antes de 04/10 todos são
    // hipótese — dizer isso em cada cartão seria ruído.
    expect(rotuloJanelaCenario('inclui-pre-1o-turno', 'superado', 11)).toBeNull();
    expect(rotuloJanelaCenario('inclui-pre-1o-turno', 'indefinido', 55)).toBeNull();
  });
});
