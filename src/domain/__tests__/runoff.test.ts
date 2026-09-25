import { describe, expect, it } from 'vitest';
import { criarPesquisa, type DadosPesquisa } from '../poll.js';
import {
  chaveConfronto,
  confrontoDaPesquisa,
  CONFRONTO_LULA_FLAVIO,
  ehConfronto,
  filtrarPorConfronto,
  FLAVIO_BOLSONARO,
  LULA,
  normalizarNomeCandidato,
} from '../runoff.js';

let contador = 0;
function pesquisa(sobrescritas: Partial<DadosPesquisa> = {}) {
  contador += 1;
  return criarPesquisa({
    id: `pesquisa-${contador}`,
    uf: 'BR',
    cargo: 'presidente',
    turno: 2,
    instituto: 'Instituto Teste',
    registroTSE: 'BR-0001/2026',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-10',
    publicadoEm: '2026-09-11',
    amostra: 1000,
    margem: 2,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados: [
      { candidato: LULA, partido: 'PT', pct: 46 },
      { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 44 },
      { candidato: 'Brancos/nulos', partido: null, pct: 6 },
      { candidato: 'Não sabe', partido: null, pct: 4 },
    ],
    ...sobrescritas,
  });
}

describe('domain/runoff — normalizarNomeCandidato', () => {
  it('remove acentos, baixa a caixa e colapsa espaços', () => {
    expect(normalizarNomeCandidato('  Flávio   BOLSONARO ')).toBe('flavio bolsonaro');
  });

  it('é idempotente', () => {
    const uma = normalizarNomeCandidato(LULA);
    expect(normalizarNomeCandidato(uma)).toBe(uma);
  });
});

describe('domain/runoff — chaveConfronto', () => {
  it('não depende da ordem dos nomes', () => {
    expect(chaveConfronto([LULA, FLAVIO_BOLSONARO])).toBe(chaveConfronto([FLAVIO_BOLSONARO, LULA]));
  });

  it('não depende de acentos nem de caixa', () => {
    expect(chaveConfronto(['flavio bolsonaro', 'luiz inacio lula da silva'])).toBe(
      chaveConfronto(CONFRONTO_LULA_FLAVIO),
    );
  });

  it('confrontos diferentes têm chaves diferentes', () => {
    expect(chaveConfronto([LULA, 'Augusto Cury'])).not.toBe(chaveConfronto(CONFRONTO_LULA_FLAVIO));
  });

  it('ignora nomes repetidos e vazios', () => {
    expect(chaveConfronto([LULA, ' ', FLAVIO_BOLSONARO, LULA])).toBe(chaveConfronto(CONFRONTO_LULA_FLAVIO));
  });

  it('confronto vazio tem chave vazia', () => {
    expect(chaveConfronto([])).toBe('');
  });
});

describe('domain/runoff — confrontoDaPesquisa', () => {
  it('lista só os candidatos, descartando brancos/nulos e não sabe', () => {
    expect(confrontoDaPesquisa(pesquisa())).toEqual([LULA, FLAVIO_BOLSONARO]);
  });

  it('descarta também a linha combinada "Brancos/nulos/não sabe"', () => {
    const p = pesquisa({
      resultados: [
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 47 },
        { candidato: LULA, partido: 'PT', pct: 45 },
        { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 8 },
      ],
    });
    expect(confrontoDaPesquisa(p)).toEqual([FLAVIO_BOLSONARO, LULA]);
  });

  it('preserva a grafia original dos nomes (serve para exibição)', () => {
    const p = pesquisa({
      resultados: [
        { candidato: '  Flávio Bolsonaro  ', partido: 'PL', pct: 50 },
        { candidato: LULA, partido: 'PT', pct: 45 },
      ],
    });
    expect(confrontoDaPesquisa(p)).toEqual(['Flávio Bolsonaro', LULA]);
  });
});

describe('domain/runoff — ehConfronto', () => {
  it('reconhece o confronto Lula x Flávio em qualquer ordem', () => {
    expect(ehConfronto(pesquisa(), CONFRONTO_LULA_FLAVIO)).toBe(true);
    const invertida = pesquisa({
      resultados: [
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 48 },
        { candidato: LULA, partido: 'PT', pct: 44 },
      ],
    });
    expect(ehConfronto(invertida, CONFRONTO_LULA_FLAVIO)).toBe(true);
  });

  it('recusa um 2º turno contra outro candidato (Cury, Caiado, Zema, Renan Santos)', () => {
    for (const adversario of ['Augusto Cury', 'Ronaldo Caiado', 'Romeu Zema', 'Renan Santos']) {
      const p = pesquisa({
        resultados: [
          { candidato: LULA, partido: 'PT', pct: 48 },
          { candidato: adversario, partido: 'PL', pct: 40 },
          { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 12 },
        ],
      });
      expect(ehConfronto(p, CONFRONTO_LULA_FLAVIO)).toBe(false);
    }
  });

  it('recusa uma pesquisa com um terceiro candidato além dos dois do confronto', () => {
    const p = pesquisa({
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 40 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 35 },
        { candidato: 'Augusto Cury', partido: 'PODE', pct: 10 },
      ],
    });
    expect(ehConfronto(p, CONFRONTO_LULA_FLAVIO)).toBe(false);
  });

  it('recusa uma pesquisa com apenas um dos dois candidatos', () => {
    const p = pesquisa({
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 48 },
        { candidato: 'Brancos/nulos', partido: null, pct: 52 },
      ],
    });
    expect(ehConfronto(p, CONFRONTO_LULA_FLAVIO)).toBe(false);
  });

  it('tolera variação de acento/caixa nos nomes vindos da fonte', () => {
    const p = pesquisa({
      resultados: [
        { candidato: 'LUIZ INACIO LULA DA SILVA', partido: 'PT', pct: 46 },
        { candidato: 'Flavio Bolsonaro', partido: 'PL', pct: 44 },
      ],
    });
    expect(ehConfronto(p, CONFRONTO_LULA_FLAVIO)).toBe(true);
  });
});

describe('domain/runoff — filtrarPorConfronto', () => {
  it('mantém só as pesquisas do confronto, na ordem original', () => {
    const lulaFlavio1 = pesquisa();
    const lulaCury = pesquisa({
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 48 },
        { candidato: 'Augusto Cury', partido: 'PODE', pct: 38 },
      ],
    });
    const lulaFlavio2 = pesquisa({
      resultados: [
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 49 },
        { candidato: LULA, partido: 'PT', pct: 45 },
      ],
    });
    const filtradas = filtrarPorConfronto([lulaFlavio1, lulaCury, lulaFlavio2], CONFRONTO_LULA_FLAVIO);
    expect(filtradas.map((p) => p.id)).toEqual([lulaFlavio1.id, lulaFlavio2.id]);
  });

  it('devolve lista vazia quando nenhuma pesquisa testa o confronto (nunca completa)', () => {
    const lulaZema = pesquisa({
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 47 },
        { candidato: 'Romeu Zema', partido: 'Novo', pct: 41 },
      ],
    });
    expect(filtrarPorConfronto([lulaZema], CONFRONTO_LULA_FLAVIO)).toEqual([]);
    expect(filtrarPorConfronto([], CONFRONTO_LULA_FLAVIO)).toEqual([]);
  });
});
