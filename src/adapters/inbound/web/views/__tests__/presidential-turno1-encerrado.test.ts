import { describe, expect, it } from 'vitest';
import { notaPrimeiroTurnoEncerrado } from '../presidential-view.js';

describe('notaPrimeiroTurnoEncerrado', () => {
  /**
   * O caso real: a média das pesquisas de 1º turno dava Lula na frente, e as
   * urnas deram Flávio por 1,87 ponto. O cartão anunciava "Líder: Lula" numa
   * eleição decidida ao contrário.
   */
  it('diz que as urnas decidiram ao contrário quando o líder das pesquisas perdeu', () => {
    const nota = notaPrimeiroTurnoEncerrado(
      'Luiz Inácio Lula da Silva',
      ['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva'],
      1.8672558977565146,
    )!;
    expect(nota).toContain('As urnas decidiram ao contrário');
    expect(nota).toContain('Flávio Bolsonaro terminou à frente');
    expect(nota).toContain('1,9 pontos');
    expect(nota).toContain('4 de outubro');
  });

  it('diz que as urnas confirmaram quando o líder das pesquisas venceu', () => {
    const nota = notaPrimeiroTurnoEncerrado(
      'Flávio Bolsonaro',
      ['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva'],
      1.87,
    )!;
    expect(nota).toContain('As urnas confirmaram');
    expect(nota).not.toContain('ao contrário');
  });

  /** Reusa `mesmoCandidato`: grafias diferentes do mesmo nome não viram "erro". */
  it('casa nomes grafados de formas diferentes', () => {
    const nota = notaPrimeiroTurnoEncerrado('JHC', ['João Henrique Caldas (JHC)', 'Outro'], 2)!;
    expect(nota).toContain('As urnas confirmaram');
  });

  it('concorda no singular', () => {
    expect(notaPrimeiroTurnoEncerrado('A', ['A', 'B'], 1)!).toContain('1,0 ponto');
  });

  it('omite a margem quando ela não é conhecida, em vez de inventar', () => {
    const nota = notaPrimeiroTurnoEncerrado('A', ['A', 'B'], null)!;
    expect(nota).toContain('terminou à frente de B.');
    expect(nota).not.toContain('pontos');
  });

  it('sem resultado oficial, não emite nota nenhuma', () => {
    expect(notaPrimeiroTurnoEncerrado('A', null, 1.5)).toBeNull();
  });
});
