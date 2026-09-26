import { describe, expect, it } from 'vitest';
import { carregarDados } from '../../../../outbound/json/carregar-dados.js';
import { criarCasosDeUso } from '../../../../../application/use-cases/index.js';
import {
  candidatosTracadosUf,
  glifosDaGrade,
  marcasDePesquisaUnica,
  notaDosGlifos,
  pesquisasSemAmostraDesenhadas,
} from '../presidential-states-view.js';

/**
 * O que a grade de miniaturas e o mapa DESENHAM, contra o que a tela AFIRMA em
 * palavras.
 *
 * Três defeitos travados aqui:
 *
 * 1. "Cada ponto é uma das pesquisas usadas" errava por um fator de 2. Cada
 *    pesquisa desenha um ponto POR CANDIDATO TRAÇADO, e o cartão traça sempre os
 *    dois primeiros do agregado. No 2º turno a tela dizia "3 delas não
 *    publicaram a amostra e aparecem como anel vazado" com 41 pesquisas, 82
 *    pontos e 6 anéis na tela; no 1º dizia 11, com 59 pesquisas, 118 pontos e 22
 *    anéis. O cartão de São Paulo no 1º turno declara 4 pesquisas e desenha 8
 *    discos.
 * 2. O marcador no fim de cada linha não é pesquisa nenhuma — é a média
 *    ponderada de hoje — e nada na tela dizia isso.
 * 3. A contagem de estados com asterisco na legenda é lida do dado, não do
 *    viewport: a 400px do 2º turno ela dizia "16 de 27 estados" enquanto o mapa
 *    desenhava 12, porque o asterisco era um `<tspan>` da sigla e a sigla de
 *    estado estreito some abaixo de 640px.
 */

const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-26T12:00:00Z') });

describe('glifos da grade: ponto não é pesquisa', () => {
  for (const turno of [1, 2] as const) {
    it(`${turno}º turno: são exatamente 2 pontos por pesquisa (um por candidato traçado)`, () => {
      const g = glifosDaGrade(casos.getPresidentialByState(turno));
      expect(g.pesquisas).toBeGreaterThan(0);
      expect((g.discos + g.aneis) / g.pesquisas).toBe(2);
      expect(g.aneis / g.pesquisasSemAmostra).toBe(2);
    });

    it(`${turno}º turno: a nota da seção afirma os números dos glifos, não os das pesquisas`, () => {
      const dados = casos.getPresidentialByState(turno);
      const g = glifosDaGrade(dados);
      const nota = notaDosGlifos(dados);
      expect(nota).toContain(`${g.pesquisas} pesquisas em ${g.discos + g.aneis} pontos`);
      expect(nota).toContain(`${g.aneis} anéis vazados`);
      expect(nota).toContain(`${g.discos} pontos são discos cheios`);
      // Item 6: o marcador de fim de linha é declarado, e declarado como média.
      expect(nota).toContain('não é pesquisa');
      expect(nota).toContain(`${g.marcadoresDeMedia} marcadores`);
    });
  }

  it('os números de hoje: 59 pesquisas/118 pontos/22 anéis no 1º turno, 41/82/6 no 2º', () => {
    const t1 = glifosDaGrade(casos.getPresidentialByState(1));
    expect([t1.pesquisas, t1.discos + t1.aneis, t1.aneis, t1.marcadoresDeMedia]).toEqual([
      59, 118, 22, 44,
    ]);
    const t2 = glifosDaGrade(casos.getPresidentialByState(2));
    expect([t2.pesquisas, t2.discos + t2.aneis, t2.aneis, t2.marcadoresDeMedia]).toEqual([
      41, 82, 6, 22,
    ]);
  });

  it('a contagem antiga de pesquisas sem amostra continua saindo do mesmo conjunto', () => {
    for (const turno of [1, 2] as const) {
      const dados = casos.getPresidentialByState(turno);
      expect(pesquisasSemAmostraDesenhadas(dados)).toBe(glifosDaGrade(dados).pesquisasSemAmostra);
    }
  });
});

describe('marca de pesquisa única: a contagem da legenda vale em qualquer largura', () => {
  for (const turno of [1, 2] as const) {
    it(`${turno}º turno: declaradas = desenhadas a 1280px = desenhadas a 400px`, () => {
      const m = marcasDePesquisaUnica(casos.getPresidentialByState(turno));
      expect(m.declaradas).toBe(m.desenhadasLargo);
      expect(m.declaradas).toBe(m.desenhadasEstreito);
    });
  }

  it('no 2º turno são 16 estados, 4 deles com a sigla escondida abaixo de 640px', () => {
    const m = marcasDePesquisaUnica(casos.getPresidentialByState(2));
    expect(m.declaradas).toBe(16);
    // RJ, RN, SC e SE: são estes os 4 que perdiam a marca a 400px, quando o
    // asterisco vivia dentro do `<tspan>` da sigla.
    expect(m.soltos).toBe(4);
    expect(m.desenhadasEstreito).toBe(16);
  });

  it('no 1º turno nenhum dos estados marcados é estreito, então nada mudou lá', () => {
    const m = marcasDePesquisaUnica(casos.getPresidentialByState(1));
    expect(m.declaradas).toBe(5);
    expect(m.soltos).toBe(0);
  });
});

describe('cartão da grade: quem são as duas linhas', () => {
  it('Goiás no 1º turno traça Flávio e Ronaldo Caiado — Lula não está no gráfico', () => {
    const dados = casos.getPresidentialByState(1);
    const go = dados.ufs.find((u) => u.uf === 'GO')!;
    expect(candidatosTracadosUf(go)).toEqual(['Flávio Bolsonaro', 'Ronaldo Caiado']);
    expect(go.agregado!.candidatos[2]!.candidato).toBe('Luiz Inácio Lula da Silva');
  });

  it('é o único cartão do 1º turno cujas duas linhas não são Lula e Flávio', () => {
    const dados = casos.getPresidentialByState(1);
    const fora = dados.ufs
      .filter((u) => !u.semDados && u.agregado?.lider)
      .filter((u) => !candidatosTracadosUf(u).includes('Luiz Inácio Lula da Silva'))
      .map((u) => u.uf);
    expect(fora).toEqual(['GO']);
  });

  it('no 2º turno o par é fechado por construção (filtrarPorConfronto)', () => {
    const dados = casos.getPresidentialByState(2);
    for (const uf of dados.ufs.filter((u) => !u.semDados && u.agregado?.lider)) {
      expect(candidatosTracadosUf(uf).sort()).toEqual(['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva']);
    }
  });
});
