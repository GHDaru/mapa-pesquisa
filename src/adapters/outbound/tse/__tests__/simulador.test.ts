import { describe, expect, it } from 'vitest';
import { carregarDados } from '../../json/carregar-dados.js';
import { projetarApuracao } from '../../../../domain/apuracao.js';
import { simularApuracao } from '../simulador.js';

const FINALISTAS: readonly [string, string] = ['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva'];

function projetar(dados: ReturnType<typeof simularApuracao>['dados'], eleitorado: never[] | unknown) {
  return projetarApuracao(dados, 'presidente', 2, eleitorado as never);
}

describe('simulador de apuração — a metade mensurável', () => {
  const repos = carregarDados();
  const real = repos.apuracao.dados();
  const eleitorado = repos.electorate.todos();

  /**
   * A afirmação central da tela. Se isto não valer, a página mente durante a
   * noite inteira e só se descobre no fim.
   */
  it('em 100% apurado, a projeção BATE com o resultado real de 4 de outubro', () => {
    const { dados, gabarito } = simularApuracao(real, FINALISTAS, { avanco: 1 });
    const proj = projetar(dados, eleitorado);

    const esperado = new Map<string, number>();
    for (const r of gabarito.recortes) {
      for (const c of r.candidatos) {
        esperado.set(c.candidato, (esperado.get(c.candidato) ?? 0) + c.votos);
      }
    }
    for (const c of proj.candidatos) {
      // Exato ao voto: em 100% o desvio de ordem de apuração vale zero.
      expect(Math.round(c.votosProjetados), c.candidato).toBe(esperado.get(c.candidato));
    }
  });

  /** O que a tela promete no topo: projetados somam os válidos projetados. */
  it('a soma das projeções fecha com os válidos projetados, em qualquer avanço', () => {
    for (const avanco of [0.05, 0.2, 0.5, 0.8, 1]) {
      const { dados } = simularApuracao(real, FINALISTAS, { avanco, semente: 7 });
      const proj = projetar(dados, eleitorado);
      const soma = proj.candidatos.reduce((t, c) => t + c.votosProjetados, 0);
      expect(soma, `avanço ${avanco}`).toBeCloseTo(proj.validosProjetados, 4);
    }
  });

  /**
   * Convergência monotônica NÃO é garantida e seria errado exigir: o viés de
   * ordem de apuração faz a projeção oscilar no caminho, que é exatamente o
   * fenômeno real. O que tem de valer é que o erro ENCOLHE no agregado conforme
   * a apuração avança.
   */
  it('o erro da projeção encolhe conforme a apuração avança', () => {
    const { gabarito } = simularApuracao(real, FINALISTAS, { avanco: 1 });
    const projFinal = projetar(gabarito, eleitorado);
    const alvo = new Map(projFinal.candidatos.map((c) => [c.candidato, c.pctProjetado]));

    const erroEm = (avanco: number): number => {
      const { dados } = simularApuracao(real, FINALISTAS, { avanco, semente: 99 });
      const p = projetar(dados, eleitorado);
      return Math.max(
        ...p.candidatos.map((c) => Math.abs(c.pctProjetado - (alvo.get(c.candidato) ?? 0))),
      );
    };

    const cedo = erroEm(0.1);
    const meio = erroEm(0.5);
    const tarde = erroEm(0.95);
    expect(tarde).toBeLessThan(meio);
    expect(meio).toBeLessThan(cedo);
    expect(tarde).toBeLessThan(0.5);
  });

  /**
   * O viés tem de existir de verdade, senão o simulador não testa o risco que
   * importa. Com viés ligado, a leitura cedo erra o bastante para a tela
   * precisar declarar a ressalva.
   */
  it('o viés de ordem de apuração produz erro real no começo e some no fim', () => {
    const { gabarito } = simularApuracao(real, FINALISTAS, { avanco: 1 });
    const alvo = projetar(gabarito, eleitorado).candidatos[0]!;

    const { dados: cedo } = simularApuracao(real, FINALISTAS, {
      avanco: 0.08,
      semente: 3,
      viesMaximo: 0.08,
    });
    const pCedo = projetar(cedo, eleitorado).candidatos.find((c) => c.candidato === alvo.candidato)!;
    expect(Math.abs(pCedo.pctProjetado - alvo.pctProjetado)).toBeGreaterThan(0.3);

    const { dados: semVies } = simularApuracao(real, FINALISTAS, {
      avanco: 0.08,
      semente: 3,
      viesMaximo: 0,
    });
    const pSem = projetar(semVies, eleitorado).candidatos.find(
      (c) => c.candidato === alvo.candidato,
    )!;
    expect(Math.abs(pSem.pctProjetado - alvo.pctProjetado)).toBeLessThan(0.0001);
  });

  /** Determinismo: mesma semente, mesma simulação — senão nada é reprodutível. */
  it('a mesma semente dá a mesma simulação', () => {
    const a = simularApuracao(real, FINALISTAS, { avanco: 0.4, semente: 42 }).dados;
    const b = simularApuracao(real, FINALISTAS, { avanco: 0.4, semente: 42 }).dados;
    expect(a.recortes.map((r) => r.candidatos.map((c) => c.votos))).toEqual(
      b.recortes.map((r) => r.candidatos.map((c) => c.votos)),
    );
  });

  /** Avanço zero é "ainda não começou": nenhuma seção, nenhum voto. */
  it('em avanço zero não inventa voto nenhum', () => {
    const { dados } = simularApuracao(real, FINALISTAS, { avanco: 0 });
    for (const r of dados.recortes) {
      expect(r.secoesTotalizadas).toBe(0);
      expect(r.candidatos.reduce((t, c) => t + c.votos, 0)).toBe(0);
    }
  });

  /**
   * Nenhum recorte pode sumir no caminho: recorte ausente vira cobertura
   * silenciosamente menor, que é o defeito mais difícil de notar numa tela de
   * apuração — o total simplesmente fica menor e nada reclama.
   *
   * A asserção é contra o PRÓPRIO dado de entrada, e não contra o número 27.
   * Ela travava 27 e quebrou quando o exterior entrou na base — o código
   * estava certo e o teste é que descrevia o mundo antigo. Hoje são 28
   * unidades (as 27 UFs mais o exterior, que o TSE publica como "ZZ"), e
   * amanhã o invariante continua valendo sem ninguém ter de vir aqui.
   */
  it('cobre todas as unidades que existem no 1º turno, inclusive o exterior', () => {
    const { dados } = simularApuracao(real, FINALISTAS, { avanco: 0.5 });
    const esperadas = new Set(
      real.recortes
        .filter((r) => r.cargo === 'presidente' && r.turno === 1 && r.uf != null && r.uf !== 'BR')
        .map((r) => r.uf),
    );
    expect(new Set(dados.recortes.map((r) => r.uf))).toEqual(esperadas);
    expect(esperadas.has('ZZ')).toBe(true);
  });
});
