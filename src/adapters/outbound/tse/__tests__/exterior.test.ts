import { describe, expect, it } from 'vitest';
import { CONTINENTES, POSTOS_DO_EXTERIOR, urlDoPosto, type Continente } from '../exterior.js';
import oficial from '../../../../../data/exterior-postos-tse.json' with { type: 'json' };

/**
 * O mapeamento posto → continente é conhecimento geográfico escrito à mão: o
 * TSE publica o nome da cidade e nada mais. Então ele é conferido contra a
 * lista que o TSE publica, e a conferência é de IGUALDADE nos dois sentidos.
 *
 * Nos dois sentidos porque as duas falhas são silenciosas e opostas: um posto
 * que o TSE publica e nós não mapeamos some da soma por continente sem que
 * nada reclame — é voto que desaparece; e um posto que mapeamos e o TSE não
 * publica vira uma requisição 404 por rodada e uma linha que nunca enche.
 */
describe('exterior: o mapeamento cobre exatamente o que o TSE publica', () => {
  const codigosOficiais = new Set(oficial.postos.map((p) => p.codigo));
  const codigosMapeados = new Set(POSTOS_DO_EXTERIOR.map((p) => p.codigo));

  it('todo posto publicado pelo TSE está mapeado', () => {
    const faltando = [...codigosOficiais].filter((c) => !codigosMapeados.has(c));
    const nomes = faltando.map((c) => oficial.postos.find((p) => p.codigo === c)?.nome);
    expect({ faltando, nomes }).toEqual({ faltando: [], nomes: [] });
  });

  it('nenhum posto mapeado deixou de existir na lista do TSE', () => {
    const sobrando = [...codigosMapeados].filter((c) => !codigosOficiais.has(c));
    const nomes = sobrando.map((c) => POSTOS_DO_EXTERIOR.find((p) => p.codigo === c)?.nome);
    expect({ sobrando, nomes }).toEqual({ sobrando: [], nomes: [] });
  });

  it('nenhum posto aparece duas vezes', () => {
    expect(codigosMapeados.size).toBe(POSTOS_DO_EXTERIOR.length);
  });

  it('todo posto cai num dos continentes declarados', () => {
    const validos = new Set<Continente>(CONTINENTES);
    const fora = POSTOS_DO_EXTERIOR.filter((p) => !validos.has(p.continente));
    expect(fora).toEqual([]);
  });

  it('nenhum continente fica vazio — continente sem posto seria linha morta na tela', () => {
    for (const c of CONTINENTES) {
      expect(POSTOS_DO_EXTERIOR.filter((p) => p.continente === c).length).toBeGreaterThan(0);
    }
  });

  it('o nome bate com o do TSE, posto a posto', () => {
    const divergentes = POSTOS_DO_EXTERIOR.filter(
      (p) => oficial.postos.find((o) => o.codigo === p.codigo)?.nome !== p.nome,
    ).map((p) => p.nome);
    expect(divergentes).toEqual([]);
  });
});

describe('exterior: urlDoPosto', () => {
  it('monta o endereço do arquivo do posto, com a eleição com seis dígitos', () => {
    expect(urlDoPosto('30457', '0001', 6258)).toBe(
      'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz30457-c0001-e006258-u.json',
    );
  });
});

/* ─────────────────────── a soma por continente ─────────────────────────── */

import { agregarPorContinente, type LeituraDePosto } from '../exterior.js';

function posto(codigo: string, a: number, b: number, st: number, ts: number, te = 1000): LeituraDePosto {
  return {
    codigo,
    secoesTotalizadas: st,
    secoesTotal: ts,
    eleitores: te,
    candidatos: [
      { candidato: 'A', votos: a },
      { candidato: 'B', votos: b },
    ],
  };
}

describe('exterior: agregarPorContinente', () => {
  const ORDEM: readonly [string, string] = ['A', 'B'];

  it('soma os postos do continente certo', () => {
    // Lisboa e Madri são Europa; Tóquio é Ásia.
    const linhas = agregarPorContinente(
      [posto('29955', 100, 50, 5, 10), posto('30066', 200, 100, 5, 10), posto('30627', 7, 70, 2, 2)],
      ORDEM,
    );
    const europa = linhas.find((l) => l.continente === 'Europa')!;
    expect(europa.votos.find((v) => v.candidato === 'A')!.votos).toBe(300);
    expect(europa.lider).toBe('A');

    const asia = linhas.find((l) => l.continente === 'Ásia')!;
    expect(asia.votos.find((v) => v.candidato === 'B')!.votos).toBe(70);
    expect(asia.lider).toBe('B');
  });

  it('o percentual é seções totalizadas sobre seções existentes — soma por soma', () => {
    const linhas = agregarPorContinente([posto('29955', 1, 1, 3, 10), posto('30066', 1, 1, 7, 10)], ORDEM);
    expect(linhas.find((l) => l.continente === 'Europa')!.processado).toBeCloseTo(50, 5);
  });

  it('posto que não respondeu fica de fora da soma e aparece na contagem de lidos', () => {
    const linhas = agregarPorContinente([posto('30627', 10, 5, 1, 1)], ORDEM);
    const asia = linhas.find((l) => l.continente === 'Ásia')!;
    expect(asia.postosLidos).toBe(1);
    expect(asia.postos).toBeGreaterThan(1);
  });

  it('continente sem nenhum voto contado não ganha líder', () => {
    const linhas = agregarPorContinente([posto('30562', 0, 0, 0, 3)], ORDEM);
    const oceania = linhas.find((l) => l.continente === 'Oceania')!;
    expect(oceania.lider).toBeNull();
    expect(oceania.processado).toBe(0);
  });

  it('devolve os seis continentes mesmo sem leitura nenhuma', () => {
    const linhas = agregarPorContinente([], ORDEM);
    expect(linhas.map((l) => l.continente)).toEqual([...CONTINENTES]);
    expect(linhas.every((l) => l.lider === null && l.postosLidos === 0)).toBe(true);
  });
});
