import { describe, expect, it } from 'vitest';
import { carregarDados } from '../../../../outbound/json/carregar-dados.js';
import { criarCasosDeUso } from '../../../../../application/use-cases/index.js';
import { psMontarConteudo } from '../presidential-states-view.js';
import { notaSomaDoPainel } from '../presidential-states-layout.js';
import { rotuloConfronto, rotuloRecorte, rotuloTurno } from '../_shared.js';

const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
const partidos = casos.listParties();

function painelDe(uf: string, turno: 1 | 2): { html: string; agregado: NonNullable<unknown> } {
  const dados = casos.getPresidentialByState(turno);
  const item = dados.ufs.find((u) => u.uf === uf);
  if (!item) throw new Error(`UF ${uf} ausente no recorte`);
  const recorte = {
    turno,
    rotulo: rotuloRecorte(turno, dados.confronto),
    turnoTexto: rotuloTurno(turno),
    confronto: rotuloConfronto(dados.confronto),
  };
  return { html: psMontarConteudo(item, uf, partidos, recorte), agregado: item.agregado! };
}

/** Percentuais das barras de candidato desenhadas no painel. */
function pctsCandidatos(html: string): number[] {
  return [...html.matchAll(/class="ps-bar-row__pct">([\d,]+)%</g)].map((m) =>
    Number(m[1]!.replace(',', '.')),
  );
}

/** Percentuais da linha "Outros:", que também entram na soma declarada. */
function pctsOutros(html: string): number[] {
  const bloco = html.match(/class="ps-panel__outros">([\s\S]*?)<\/p>/);
  if (!bloco) return [];
  return [...bloco[1]!.matchAll(/([\d,]+)%/g)].map((m) => Number(m[1]!.replace(',', '.')));
}

describe('nota de soma do painel fala das linhas que estão na tela', () => {
  // SP no 1º turno tem 7 candidatos. Com o corte em 6, Romeu Zema (3,0%) saía
  // do desenho mas continuava entrando na soma: a tela dizia 99,2% sobre
  // linhas que somavam 96,2%, e o leitor que fizesse 100 - 99,2 concluiria
  // que faltavam 0,8 ponto quando faltavam 3,8.
  it('não esconde candidato: SP no 1º turno desenha os 7', () => {
    const { html, agregado } = painelDe('SP', 1);
    const desenhados = pctsCandidatos(html);
    expect(desenhados).toHaveLength((agregado as { candidatos: unknown[] }).candidatos.length);
    expect(html).toContain('Romeu Zema');
  });

  it.each([
    ['SP', 1],
    ['CE', 1],
    ['RS', 1],
    ['MG', 1],
    ['SP', 2],
    ['CE', 2],
    ['AL', 2],
  ] as const)('a soma declarada bate com as linhas desenhadas em %s (turno %i)', (uf, turno) => {
    const { html } = painelDe(uf, turno);
    const m = html.match(/As linhas acima somam ([\d,]+)%/);
    if (!m) return; // recorte que fecha 100% não ganha nota nenhuma
    const declarada = Number(m[1]!.replace(',', '.'));
    const linhas = [...pctsCandidatos(html), ...pctsOutros(html)];
    const desenhadas = linhas.reduce((s, v) => s + v, 0);
    // Tolerância de 0,05 por linha: o HTML traz os valores já arredondados a
    // uma casa, enquanto a soma declarada vem dos valores exatos.
    expect(Math.abs(declarada - desenhadas)).toBeLessThan(0.05 * linhas.length + 0.06);
  });
});

describe('a explicação do que falta descreve o recorte certo', () => {
  // O 2º turno é filtrado por confronto: só entram pesquisas que testam
  // exatamente aqueles dois nomes. "Candidatos fora da lista divulgada" não
  // pode existir ali.
  it('no 2º turno não oferece candidatos fora da lista como explicação', () => {
    const texto = notaSomaDoPainel(94.3, undefined, 2)!;
    expect(texto).toContain('brancos, nulos e indecisos');
    expect(texto).not.toContain('fora da lista divulgada');
  });

  it('no 1º turno a explicação continua completa', () => {
    expect(notaSomaDoPainel(96.2, undefined, 1)!).toContain('fora da lista divulgada');
  });
});

describe('cada linha de candidato declara a própria base', () => {
  // Um candidato testado por 1 das 4 pesquisas era desenhado igual a outro
  // testado pelas 4, sob um selo que diz "4 PESQUISAS".
  it('marca a linha que vem de menos pesquisas que o recorte', () => {
    const { html } = painelDe('SP', 1);
    expect(html).toContain('ps-bar-row__parcial');
    expect(html).toMatch(/de \d+ de \d+ pesquisas/);
  });
});
