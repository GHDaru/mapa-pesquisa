import { describe, expect, it } from 'vitest';
import { itemCasaComEndereco, linkAtivoDoMenu } from '../navegacao.js';

const MENU = [
  '#/inicio',
  '#/presidente-estados?mapa=apuracao',
  '#/presidente-estados',
  '#/pesquisas',
];

describe('navegacao: itemCasaComEndereco', () => {
  it('casa a rota simples', () => {
    expect(itemCasaComEndereco('#/inicio', '#/inicio')).toBe(true);
    expect(itemCasaComEndereco('#/inicio', '#/pesquisas')).toBe(false);
  });

  it('item sem parâmetro casa com qualquer parâmetro da mesma rota', () => {
    expect(itemCasaComEndereco('#/presidente-estados', '#/presidente-estados?turno=2')).toBe(true);
  });

  it('item com parâmetro só casa quando o parâmetro bate', () => {
    expect(
      itemCasaComEndereco('#/presidente-estados?mapa=apuracao', '#/presidente-estados?mapa=apuracao'),
    ).toBe(true);
    expect(itemCasaComEndereco('#/presidente-estados?mapa=apuracao', '#/presidente-estados')).toBe(false);
    expect(
      itemCasaComEndereco('#/presidente-estados?mapa=apuracao', '#/presidente-estados?mapa=eleitorado'),
    ).toBe(false);
  });
});

describe('navegacao: linkAtivoDoMenu', () => {
  it('com a apuração aberta acende a apuração, não o mapa de pesquisas', () => {
    expect(linkAtivoDoMenu(MENU, '#/presidente-estados?mapa=apuracao')).toBe(
      '#/presidente-estados?mapa=apuracao',
    );
  });

  it('a apuração com turno junto continua acendendo a apuração', () => {
    expect(linkAtivoDoMenu(MENU, '#/presidente-estados?turno=2&mapa=apuracao')).toBe(
      '#/presidente-estados?mapa=apuracao',
    );
  });

  it('sem o parâmetro, acende o item genérico da rota', () => {
    expect(linkAtivoDoMenu(MENU, '#/presidente-estados')).toBe('#/presidente-estados');
    expect(linkAtivoDoMenu(MENU, '#/presidente-estados?turno=2')).toBe('#/presidente-estados');
    expect(linkAtivoDoMenu(MENU, '#/presidente-estados?mapa=eleitorado')).toBe('#/presidente-estados');
  });

  it('nunca acende dois: o resultado é um href só, ou nenhum', () => {
    expect(linkAtivoDoMenu(MENU, '#/senado')).toBeNull();
  });
});
