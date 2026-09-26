import { describe, expect, it } from 'vitest';
import { criarPesquisa, dataReferencia, type DadosPesquisa } from '../poll.js';

function pesquisaBase(sobrescritas: Partial<DadosPesquisa> = {}): DadosPesquisa {
  return {
    id: 'teste-1',
    uf: 'SP',
    cargo: 'governador',
    turno: 1,
    instituto: 'Instituto Teste',
    registroTSE: 'SP-0001/2026',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-03',
    publicadoEm: '2026-09-05',
    amostra: 1000,
    margem: 2.5,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados: [
      { candidato: 'Candidato A', partido: 'PT', pct: 40 },
      { candidato: 'Candidato B', partido: 'PL', pct: 35 },
      { candidato: 'Brancos/nulos', partido: null, pct: 25 },
    ],
    ...sobrescritas,
  };
}

describe('domain/poll', () => {
  it('cria uma pesquisa válida', () => {
    const pesquisa = criarPesquisa(pesquisaBase());
    expect(pesquisa.id).toBe('teste-1');
    expect(pesquisa.disputa.uf).toBe('SP');
    expect(pesquisa.resultados).toHaveLength(3);
  });

  it('marca naoRegistrada quando registroTSE é null', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ registroTSE: null }));
    expect(pesquisa.registroTSE.naoRegistrada).toBe(true);
  });

  it('mantém registroTSE quando presente', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ registroTSE: 'SP-9999/2026' }));
    expect(pesquisa.registroTSE.naoRegistrada).toBe(false);
    if (!pesquisa.registroTSE.naoRegistrada) {
      expect(pesquisa.registroTSE.valor).toBe('SP-9999/2026');
    }
  });

  it('rejeita pct fora do intervalo 0..100', () => {
    expect(() =>
      criarPesquisa(
        pesquisaBase({
          resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 120 }],
        }),
      ),
    ).toThrowError(/teste-1/);
  });

  it('rejeita pct negativo', () => {
    expect(() =>
      criarPesquisa(
        pesquisaBase({
          resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: -1 }],
        }),
      ),
    ).toThrow();
  });

  it('rejeita data fora do formato ISO', () => {
    expect(() => criarPesquisa(pesquisaBase({ dataInicio: '01/09/2026' }))).toThrow();
  });

  it('rejeita disputa com UF inválida', () => {
    expect(() => criarPesquisa(pesquisaBase({ uf: 'XX' }))).toThrow();
  });

  it('rejeita resultados vazio', () => {
    expect(() => criarPesquisa(pesquisaBase({ resultados: [] }))).toThrow();
  });

  it('rejeita id vazio', () => {
    expect(() => criarPesquisa(pesquisaBase({ id: '' }))).toThrow();
  });

  it('dataReferencia usa dataFim quando presente', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ dataFim: '2026-09-03', publicadoEm: '2026-09-05' }));
    expect(dataReferencia(pesquisa)).toBe('2026-09-03');
  });

  it('dataReferencia recai em publicadoEm quando não há dataFim', () => {
    const pesquisa = criarPesquisa(pesquisaBase({ dataFim: null, publicadoEm: '2026-09-05' }));
    expect(dataReferencia(pesquisa)).toBe('2026-09-05');
  });
});


describe('normalizarCandidato', () => {
  it('unifica grafias do mesmo candidato', async () => {
    const { normalizarCandidato } = await import('../poll.js');
    expect(normalizarCandidato('Lula')).toBe('Luiz Inácio Lula da Silva');
    expect(normalizarCandidato('  lula ')).toBe('Luiz Inácio Lula da Silva');
    expect(normalizarCandidato('Flavio Bolsonaro')).toBe('Flávio Bolsonaro');
    expect(normalizarCandidato('Cury')).toBe('Augusto Cury');
  });

  it('mantém nomes desconhecidos como vieram', async () => {
    const { normalizarCandidato } = await import('../poll.js');
    expect(normalizarCandidato('  Fulano de Tal ')).toBe('Fulano de Tal');
    expect(normalizarCandidato('Brancos/nulos')).toBe('Brancos/nulos');
  });

  it('a pesquisa já nasce com o nome canônico, para a agregação não dividir o candidato', async () => {
    const { criarPesquisa } = await import('../poll.js');
    const p = criarPesquisa({
      id: 'teste-apelido',
      uf: 'BR',
      cargo: 'presidente',
      turno: 1,
      instituto: 'Teste',
      dataFim: '2026-09-17',
      fonte: { nome: 'Fonte', url: 'https://exemplo.org' },
      resultados: [{ candidato: 'Lula', partido: 'PT', pct: 39 }],
    });
    expect(p.resultados[0]?.candidato).toBe('Luiz Inácio Lula da Silva');
  });
});

describe('normalizarInstituto', () => {
  it('unifica grafias do mesmo instituto', async () => {
    const { normalizarInstituto } = await import('../poll.js');
    expect(normalizarInstituto('Instituto Anova')).toBe('Anova');
    expect(normalizarInstituto('Anova (PB Agora)')).toBe('Anova');
    expect(normalizarInstituto('AtlasIntel/MeioNorte')).toBe('AtlasIntel');
    expect(normalizarInstituto('Veritá')).toBe('Instituto Veritá');
    expect(normalizarInstituto('  Quaest ')).toBe('Quaest');
  });
});

describe('normalizarLinhaNaoCandidato', () => {
  it('unifica todas as grafias de brancos/nulos/não sabe da base em uma categoria', async () => {
    const { normalizarLinhaNaoCandidato, CATEGORIA_BRANCOS_NULOS_NAO_SABE } = await import('../poll.js');
    // Rótulos que existem em data/polls.json.
    const rotulos = [
      'Brancos/nulos',
      'Não sabe',
      'Brancos/nulos/não sabe',
      'Não sabe/não respondeu',
      'Não sabe/Não respondeu',
      'Não sabe/indecisos',
      'Não sabe/indeciso',
      'Indecisos',
      'Nenhum',
      'Nenhum/Brancos/nulos',
      'Nenhum/branco/nulo',
      'Brancos/nulos/nenhum',
      'Brancos/nulos/não votaria',
      'Não sabe/indeciso (cenário espontâneo)',
    ];
    for (const rotulo of rotulos) {
      expect(normalizarLinhaNaoCandidato(rotulo)).toBe(CATEGORIA_BRANCOS_NULOS_NAO_SABE);
    }
  });

  it('mantém "outros candidatos" em categoria própria — são votos em candidato, não em ninguém', async () => {
    const { normalizarLinhaNaoCandidato, CATEGORIA_OUTROS_CANDIDATOS } = await import('../poll.js');
    expect(normalizarLinhaNaoCandidato('Outros')).toBe(CATEGORIA_OUTROS_CANDIDATOS);
    expect(normalizarLinhaNaoCandidato('outros candidatos')).toBe(CATEGORIA_OUTROS_CANDIDATOS);
    expect(
      normalizarLinhaNaoCandidato(
        'Outros candidatos (Danilo Soares, Ieri Braga, Serley Leal e Zé Batista, somados)',
      ),
    ).toBe(CATEGORIA_OUTROS_CANDIDATOS);
  });

  it('rótulo combinado cai no espaço de não-voto, que tem precedência', async () => {
    const { normalizarLinhaNaoCandidato, CATEGORIA_BRANCOS_NULOS_NAO_SABE } = await import('../poll.js');
    expect(normalizarLinhaNaoCandidato('Outros/brancos/nulos')).toBe(CATEGORIA_BRANCOS_NULOS_NAO_SABE);
  });

  it('retorna null para candidato de verdade — nada é forçado dentro de uma categoria', async () => {
    const { normalizarLinhaNaoCandidato } = await import('../poll.js');
    expect(normalizarLinhaNaoCandidato('Luiz Inácio Lula da Silva')).toBeNull();
    expect(normalizarLinhaNaoCandidato('Flávio Bolsonaro')).toBeNull();
    expect(normalizarLinhaNaoCandidato('Ronaldo Caiado')).toBeNull();
    expect(normalizarLinhaNaoCandidato('Sergio Moro')).toBeNull();
    // Nome de candidato que contém "Nenhum"/"branco" não existe na base; o que
    // existe são sobrenomes comuns — nenhum deles casa com os padrões.
    expect(normalizarLinhaNaoCandidato('Marina JHC')).toBeNull();
  });

  it('a pesquisa guarda o rótulo publicado pela fonte — a categoria é só da agregação', async () => {
    const { criarPesquisa } = await import('../poll.js');
    const p = criarPesquisa({
      id: 'teste-rotulo-nao-candidato',
      uf: 'AL',
      cargo: 'presidente',
      turno: 2,
      instituto: 'Real Time Big Data',
      dataFim: '2026-09-24',
      fonte: { nome: 'Fonte', url: 'https://exemplo.org' },
      resultados: [
        { candidato: 'Lula', partido: 'PT', pct: 53 },
        { candidato: 'Brancos/nulos', partido: null, pct: 5 },
        { candidato: 'Não sabe', partido: null, pct: 4 },
      ],
    });
    // A base de pesquisas (views/polls-database-view.ts) mostra a pesquisa como
    // ela foi publicada: duas linhas, com os nomes originais.
    expect(p.resultados.map((r) => r.candidato)).toEqual([
      'Luiz Inácio Lula da Silva',
      'Brancos/nulos',
      'Não sabe',
    ]);
  });
});
