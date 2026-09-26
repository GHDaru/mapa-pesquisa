import { describe, expect, it } from 'vitest';
import {
  agregarPesquisas,
  classificarConfianca,
  ehLinhaNaoCandidato,
  MARGEM_REFERENCIA_PADRAO,
  serieTemporal,
} from '../aggregate.js';
import {
  CATEGORIA_BRANCOS_NULOS_NAO_SABE,
  CATEGORIA_OUTROS_CANDIDATOS,
  criarPesquisa,
  type DadosPesquisa,
  normalizarLinhaNaoCandidato,
} from '../poll.js';

const HOJE = new Date('2026-09-15T00:00:00Z');

let contador = 0;
function pesquisa(sobrescritas: Partial<DadosPesquisa> = {}) {
  contador += 1;
  return criarPesquisa({
    id: `pesquisa-${contador}`,
    uf: 'SP',
    cargo: 'governador',
    turno: 1,
    instituto: 'Instituto Teste',
    registroTSE: 'SP-0001/2026',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-10',
    publicadoEm: '2026-09-11',
    amostra: 1000,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    resultados: [
      { candidato: 'Candidato A', partido: 'PT', pct: 40 },
      { candidato: 'Candidato B', partido: 'PL', pct: 30 },
      { candidato: 'Brancos/nulos', partido: null, pct: 20 },
      { candidato: 'Não sabe', partido: null, pct: 10 },
    ],
    ...sobrescritas,
  });
}

describe('domain/aggregate', () => {
  it('retorna null quando não há nenhuma pesquisa', () => {
    expect(agregarPesquisas([], {}, HOJE)).toBeNull();
  });

  it('ignora Brancos/nulos, Não sabe etc. no ranking mas mantém em outros', () => {
    const p = pesquisa();
    const agregado = agregarPesquisas([p], {}, HOJE)!;

    const nomesCandidatos = agregado.candidatos.map((c) => c.candidato);
    expect(nomesCandidatos).toEqual(['Candidato A', 'Candidato B']);

    // "Brancos/nulos" 20 e "Não sabe" 10 da MESMA pesquisa descrevem o mesmo
    // espaço: entram somados em uma categoria canônica, não como duas linhas.
    expect(agregado.outros.map((c) => c.candidato)).toEqual([CATEGORIA_BRANCOS_NULOS_NAO_SABE]);
    expect(agregado.outros[0]!.pct).toBeCloseTo(30, 6);
    expect(agregado.outros[0]!.pesquisas).toBe(1);
  });

  it('lider e segundo nunca são uma linha excluída, mesmo com pct mais alto', () => {
    const p = pesquisa({
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 20 },
        { candidato: 'Brancos/nulos', partido: null, pct: 60 },
        { candidato: 'Candidato B', partido: 'PL', pct: 20 },
      ],
    });
    const agregado = agregarPesquisas([p], {}, HOJE)!;
    expect(agregado.lider?.candidato).not.toBe('Brancos/nulos');
    expect(agregado.candidatos.map((c) => c.candidato)).toEqual(
      expect.not.arrayContaining(['Brancos/nulos']),
    );
  });

  it('pondera por recência: pesquisa mais recente pesa mais que a mais antiga', () => {
    const meiaVidaDias = 14;
    const recente = pesquisa({ id: 'recente', dataFim: '2026-09-14', resultados: [{ candidato: 'X', partido: 'PT', pct: 50 }] });
    const antiga = pesquisa({ id: 'antiga', dataFim: '2026-09-01', resultados: [{ candidato: 'X', partido: 'PT', pct: 30 }] });

    const agregado = agregarPesquisas([recente, antiga], { meiaVidaDias }, HOJE)!;

    const idadeRecente = 1; // 15 - 14
    const idadeAntiga = 14; // 15 - 1
    const pesoRecente = Math.exp((-Math.LN2 * idadeRecente) / meiaVidaDias) * Math.sqrt(1000);
    const pesoAntiga = Math.exp((-Math.LN2 * idadeAntiga) / meiaVidaDias) * Math.sqrt(1000);
    const esperado = (pesoRecente * 50 + pesoAntiga * 30) / (pesoRecente + pesoAntiga);

    expect(agregado.candidatos[0]!.pct).toBeCloseTo(esperado, 6);
    // Mais próximo do valor recente (50) do que do antigo (30).
    expect(agregado.candidatos[0]!.pct).toBeGreaterThan(40);
  });

  it('pondera por tamanho de amostra (raiz quadrada)', () => {
    const mesmaData = pesquisa({
      id: 'amostra-grande',
      amostra: 4000,
      dataFim: '2026-09-14',
      resultados: [{ candidato: 'X', partido: 'PT', pct: 60 }],
    });
    const outraMesmaData = pesquisa({
      id: 'amostra-pequena',
      amostra: 1000,
      dataFim: '2026-09-14',
      resultados: [{ candidato: 'X', partido: 'PT', pct: 20 }],
    });

    const agregado = agregarPesquisas([mesmaData, outraMesmaData], {}, HOJE)!;
    const pesoGrande = Math.sqrt(4000);
    const pesoPequena = Math.sqrt(1000);
    const esperado = (pesoGrande * 60 + pesoPequena * 20) / (pesoGrande + pesoPequena);
    expect(agregado.candidatos[0]!.pct).toBeCloseTo(esperado, 6);
  });

  it('normaliza cada candidato apenas pelo peso das pesquisas em que apareceu', () => {
    const p1 = pesquisa({
      id: 'p1',
      dataFim: '2026-09-14',
      amostra: 1000,
      resultados: [
        { candidato: 'Só na p1', partido: 'PT', pct: 80 },
        { candidato: 'Em ambas', partido: 'PL', pct: 20 },
      ],
    });
    const p2 = pesquisa({
      id: 'p2',
      dataFim: '2026-09-14',
      amostra: 1000,
      resultados: [{ candidato: 'Em ambas', partido: 'PL', pct: 40 }],
    });

    const agregado = agregarPesquisas([p1, p2], {}, HOJE)!;
    const soNaP1 = agregado.candidatos.find((c) => c.candidato === 'Só na p1')!;
    // Peso igual em ambas as pesquisas (mesma data e amostra) -> média simples 20 e 40 -> 30,
    // e "Só na p1" não é diluído pelo peso de p2 (onde não apareceu): fica em 80, não 40.
    expect(soNaP1.pct).toBeCloseTo(80, 6);
    const emAmbas = agregado.candidatos.find((c) => c.candidato === 'Em ambas')!;
    expect(emAmbas.pct).toBeCloseTo(30, 6);
  });

  it('calcula margemReferencia como média ponderada das margens informadas', () => {
    const p1 = pesquisa({ id: 'm1', dataFim: '2026-09-14', margem: 2, amostra: 1000 });
    const p2 = pesquisa({ id: 'm2', dataFim: '2026-09-14', margem: 4, amostra: 1000 });
    const agregado = agregarPesquisas([p1, p2], {}, HOJE)!;
    // Mesma data e amostra -> pesos iguais -> média simples.
    expect(agregado.margemReferencia).toBeCloseTo(3, 6);
  });

  it('usa margem padrão de 3.0 quando nenhuma pesquisa informa margem', () => {
    const p = pesquisa({ margem: null });
    const agregado = agregarPesquisas([p], {}, HOJE)!;
    expect(agregado.margemReferencia).toBe(MARGEM_REFERENCIA_PADRAO);
  });

  it('marca empateTecnico quando a vantagem é menor ou igual à margem de referência', () => {
    const p = pesquisa({
      margem: 5,
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 42 },
        { candidato: 'Candidato B', partido: 'PL', pct: 40 },
      ],
    });
    const agregado = agregarPesquisas([p], {}, HOJE)!;
    expect(agregado.vantagem).toBeCloseTo(2, 6);
    expect(agregado.empateTecnico).toBe(true);
  });

  it('não marca empateTecnico quando a vantagem supera a margem de referência', () => {
    const p = pesquisa({
      margem: 2,
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 55 },
        { candidato: 'Candidato B', partido: 'PL', pct: 30 },
      ],
    });
    const agregado = agregarPesquisas([p], {}, HOJE)!;
    expect(agregado.empateTecnico).toBe(false);
  });

  it('usa a pesquisa mais recente e marca foraDaJanela quando nenhuma está dentro da janela', () => {
    const antiga = pesquisa({ id: 'fora-da-janela', dataFim: '2026-01-01', publicadoEm: '2026-01-02' });
    const agregado = agregarPesquisas([antiga], { janelaDias: 45 }, HOJE)!;
    expect(agregado.foraDaJanela).toBe(true);
    expect(agregado.pesquisasUsadas).toHaveLength(1);
    expect(agregado.pesquisasUsadas[0]!.id).toBe('fora-da-janela');
  });

  it('não marca foraDaJanela quando há pesquisa dentro da janela', () => {
    const dentro = pesquisa({ id: 'dentro-da-janela', dataFim: '2026-09-01' });
    const agregado = agregarPesquisas([dentro], { janelaDias: 45 }, HOJE)!;
    expect(agregado.foraDaJanela).toBe(false);
  });

  it('exclui apenas as pesquisas fora da janela quando há pelo menos uma dentro', () => {
    const dentro = pesquisa({ id: 'dentro', dataFim: '2026-09-01' });
    const foraMuitoAntiga = pesquisa({ id: 'fora', dataFim: '2020-01-01', publicadoEm: '2020-01-02' });
    const agregado = agregarPesquisas([dentro, foraMuitoAntiga], { janelaDias: 45 }, HOJE)!;
    expect(agregado.pesquisasUsadas.map((p) => p.id)).toEqual(['dentro']);
  });

  it('sinaliza algumaNaoRegistrada quando ao menos uma pesquisa usada não tem registroTSE', () => {
    const semRegistro = pesquisa({ id: 'sem-registro', registroTSE: null });
    const agregado = agregarPesquisas([semRegistro], {}, HOJE)!;
    expect(agregado.algumaNaoRegistrada).toBe(true);
  });

  it('não sinaliza algumaNaoRegistrada quando todas as pesquisas usadas têm registroTSE', () => {
    const comRegistro = pesquisa({ id: 'com-registro', registroTSE: 'SP-1234/2026' });
    const agregado = agregarPesquisas([comRegistro], {}, HOJE)!;
    expect(agregado.algumaNaoRegistrada).toBe(false);
  });

  it('respeita lista configurável de candidatos excluídos', () => {
    // Rótulo que NÃO casa com nenhuma categoria canônica de não-candidato: sai
    // do ranking só por estar na lista, e mantém o rótulo original em outros.
    const p = pesquisa({
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 50 },
        { candidato: 'Voto Customizado', partido: null, pct: 50 },
      ],
    });
    const agregado = agregarPesquisas([p], { excluirCandidatos: ['voto customizado'] }, HOJE)!;
    expect(agregado.candidatos.map((c) => c.candidato)).toEqual(['Candidato A']);
    expect(agregado.outros.map((c) => c.candidato)).toEqual(['Voto Customizado']);
  });

  it('ultimaPesquisa é a mais recente entre as usadas', () => {
    const maisAntiga = pesquisa({ id: 'antiga-2', dataFim: '2026-09-01' });
    const maisRecente = pesquisa({ id: 'recente-2', dataFim: '2026-09-14' });
    const agregado = agregarPesquisas([maisAntiga, maisRecente], {}, HOJE)!;
    expect(agregado.ultimaPesquisa.id).toBe('recente-2');
  });
});


describe('linhas que não são candidatos', () => {
  it('exclui indecisos, brancos/nulos e cenário espontâneo do ranking', async () => {
    const { ehLinhaNaoCandidato } = await import('../aggregate.js');
    const vazio = new Set<string>();
    expect(ehLinhaNaoCandidato('Não sabe/indeciso (cenário espontâneo)', vazio)).toBe(true);
    expect(ehLinhaNaoCandidato('Brancos e nulos', vazio)).toBe(true);
    expect(ehLinhaNaoCandidato('Indecisos', vazio)).toBe(true);
    expect(ehLinhaNaoCandidato('Nenhum/Não respondeu', vazio)).toBe(true);
    expect(ehLinhaNaoCandidato('Outros', vazio)).toBe(true);
    expect(ehLinhaNaoCandidato('Sergio Moro', vazio)).toBe(false);
    expect(ehLinhaNaoCandidato('Ronaldo Caiado', vazio)).toBe(false);
  });
});

describe('classificarConfianca — 3 faixas de docs/design-system.md', () => {
  it('classifica "empate" quando a vantagem é menor ou igual à margem', () => {
    expect(classificarConfianca(2, 3)).toBe('empate');
    expect(classificarConfianca(3, 3)).toBe('empate');
  });

  it('classifica "acirrada" quando a vantagem supera a margem mas é menor que o dobro dela', () => {
    expect(classificarConfianca(3.1, 3)).toBe('acirrada');
    expect(classificarConfianca(5.9, 3)).toBe('acirrada');
  });

  it('classifica "folga" quando a vantagem é igual ou maior que o dobro da margem', () => {
    expect(classificarConfianca(6, 3)).toBe('folga');
    expect(classificarConfianca(30, 3)).toBe('folga');
  });
});

describe('serieTemporal', () => {
  it('retorna listas vazias quando não há nenhuma pesquisa', () => {
    const serie = serieTemporal([], {}, HOJE);
    expect(serie.dias).toEqual([]);
    expect(serie.pontos).toEqual([]);
    expect(serie.candidatos).toEqual([]);
  });

  it('a linha (média diária) passa perto dos pontos de uma única pesquisa', () => {
    const p = pesquisa({
      dataInicio: '2026-09-01',
      dataFim: '2026-09-01',
      publicadoEm: '2026-09-02',
    });
    const serie = serieTemporal([p], {}, new Date('2026-09-01T00:00:00Z'));

    expect(serie.dias).toHaveLength(1);
    expect(serie.dias[0]!.data).toBe('2026-09-01');
    // Com uma única pesquisa no dia, a média ponderada é exatamente o valor da pesquisa.
    expect(serie.dias[0]!.valores['Candidato A']).toBeCloseTo(40, 6);
    expect(serie.dias[0]!.valores['Candidato B']).toBeCloseTo(30, 6);

    const pontoA = serie.pontos.find((pt) => pt.candidato === 'Candidato A');
    expect(pontoA?.pct).toBeCloseTo(40, 6);
    expect(pontoA?.data).toBe('2026-09-01');
    expect(pontoA?.instituto).toBe('Instituto Teste');
  });

  it('a linha do dia mais recente aproxima-se do valor da pesquisa mais recente (decaimento por recência)', () => {
    const antiga = pesquisa({
      dataInicio: '2026-08-01',
      dataFim: '2026-08-01',
      publicadoEm: '2026-08-02',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 20 },
        { candidato: 'Candidato B', partido: 'PL', pct: 50 },
      ],
    });
    const recente = pesquisa({
      dataInicio: '2026-09-10',
      dataFim: '2026-09-10',
      publicadoEm: '2026-09-11',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 60 },
        { candidato: 'Candidato B', partido: 'PL', pct: 20 },
      ],
    });
    const hoje = new Date('2026-09-10T00:00:00Z');
    const serie = serieTemporal([antiga, recente], { meiaVidaDias: 14, janelaDias: 90 }, hoje);

    const ultimoDia = serie.dias[serie.dias.length - 1]!;
    expect(ultimoDia.data).toBe('2026-09-10');
    // O peso da pesquisa recente domina no último dia — fica bem mais perto de 60 que de 20.
    expect(ultimoDia.valores['Candidato A']!).toBeGreaterThan(45);
  });

  it('ordena candidatos pela média final (hoje), líder primeiro', () => {
    const p = pesquisa({
      dataInicio: '2026-09-01',
      dataFim: '2026-09-01',
      publicadoEm: '2026-09-02',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 30 },
        { candidato: 'Candidato B', partido: 'PL', pct: 45 },
        { candidato: 'Brancos/nulos', partido: null, pct: 25 },
      ],
    });
    const serie = serieTemporal([p], {}, new Date('2026-09-01T00:00:00Z'));
    expect(serie.candidatos).toEqual(['Candidato B', 'Candidato A']);
  });

  it('nunca gera NaN, mesmo nos primeiros dias da série', () => {
    const p = pesquisa({
      dataInicio: '2026-09-01',
      dataFim: '2026-09-01',
      publicadoEm: '2026-09-02',
    });
    const serie = serieTemporal([p], {}, new Date('2026-09-10T00:00:00Z'));

    expect(serie.dias.length).toBeGreaterThan(1);
    for (const dia of serie.dias) {
      for (const valor of Object.values(dia.valores)) {
        expect(Number.isNaN(valor)).toBe(false);
        expect(Number.isFinite(valor)).toBe(true);
      }
    }
  });

  it('respeita passoDias para espaçar os pontos da série, sempre incluindo hoje', () => {
    const p = pesquisa({
      dataInicio: '2026-09-01',
      dataFim: '2026-09-01',
      publicadoEm: '2026-09-02',
    });
    const hoje = new Date('2026-09-08T00:00:00Z');
    const serie = serieTemporal([p], { passoDias: 3 }, hoje);

    const datas = serie.dias.map((d) => d.data);
    expect(datas[0]).toBe('2026-09-01');
    expect(datas[datas.length - 1]).toBe('2026-09-08');
  });

  it('pontos incluem apenas linhas de candidato (exclui brancos/nulos/não sabe)', () => {
    const p = pesquisa();
    const serie = serieTemporal([p], {}, HOJE);
    const nomes = serie.pontos.map((pt) => pt.candidato).sort();
    expect(nomes).toEqual(['Candidato A', 'Candidato B']);
  });
});

describe('serieTemporal — suavização bilateral', () => {
  it('interpola sem degraus entre duas pesquisas e termina perto da mais recente', async () => {
    const { serieTemporal } = await import('../aggregate.js');
    const { criarPesquisa } = await import('../poll.js');
    const base = { uf: 'BR', cargo: 'presidente' as const, turno: 1 as const, instituto: 'X', amostra: 2000, fonte: { nome: 'f', url: 'https://f' } };
    const a = criarPesquisa({ ...base, id: 'a', dataFim: '2026-08-01', publicadoEm: '2026-08-01', resultados: [{ candidato: 'A', partido: 'PT', pct: 40 }, { candidato: 'B', partido: 'PL', pct: 30 }] });
    const b = criarPesquisa({ ...base, id: 'b', dataFim: '2026-08-31', publicadoEm: '2026-08-31', resultados: [{ candidato: 'A', partido: 'PT', pct: 50 }, { candidato: 'B', partido: 'PL', pct: 30 }] });
    const serie = serieTemporal([a, b], {}, new Date('2026-08-31T12:00:00Z'));
    const valoresA = serie.dias.map((d) => d.valores['A'] ?? NaN);
    expect(valoresA.every((v) => Number.isFinite(v))).toBe(true);
    for (let i = 1; i < valoresA.length; i++) {
      expect(valoresA[i]! + 1e-9).toBeGreaterThanOrEqual(valoresA[i - 1]!);
      expect(valoresA[i]! - valoresA[i - 1]!).toBeLessThan(2);
    }
    expect(valoresA.at(-1)!).toBeGreaterThan(47);
  });
});

/**
 * Regressões da soma impressa no painel: as linhas que não são candidato são
 * reduzidas a categorias canônicas e somadas DENTRO de cada pesquisa antes de
 * entrar na média entre pesquisas. Sem isso, "Brancos/nulos/não sabe" (junto),
 * "Brancos/nulos" e "Não sabe" (separados) viravam três linhas independentes.
 */
describe('categorias canônicas das linhas que não são candidato', () => {
  const NAO_SABE = CATEGORIA_BRANCOS_NULOS_NAO_SABE;

  function pesquisaT2(
    id: string,
    uf: string,
    instituto: string,
    dataFim: string,
    amostra: number,
    resultados: DadosPesquisa['resultados'],
  ) {
    return criarPesquisa({
      id,
      uf,
      cargo: 'presidente',
      turno: 2,
      instituto,
      dataFim,
      publicadoEm: dataFim,
      amostra,
      margem: 2,
      fonte: { nome: 'Fonte', url: 'https://exemplo.test' },
      resultados,
    });
  }

  it('soma as linhas separadas DENTRO da pesquisa, não tira média entre elas', () => {
    const p = pesquisaT2('uma', 'SP', 'Instituto Teste', '2026-09-14', 1000, [
      { candidato: 'Candidato A', partido: 'PT', pct: 45 },
      { candidato: 'Candidato B', partido: 'PL', pct: 45 },
      { candidato: 'Brancos/nulos', partido: null, pct: 6 },
      { candidato: 'Não sabe', partido: null, pct: 4 },
    ]);
    const agregado = agregarPesquisas([p], {}, HOJE)!;
    expect(agregado.outros).toHaveLength(1);
    expect(agregado.outros[0]!.candidato).toBe(NAO_SABE);
    expect(agregado.outros[0]!.pct).toBeCloseTo(10, 6);
    // Uma pesquisa, não duas: a categoria não conta a mesma pesquisa duas vezes.
    expect(agregado.outros[0]!.pesquisas).toBe(1);
  });

  it('quebra separada e linha combinada entram como um único valor comparável', () => {
    // Mesma data e amostra -> pesos iguais -> média simples.
    const separada = pesquisaT2('separada', 'SP', 'Real Time Big Data', '2026-09-14', 1000, [
      { candidato: 'Candidato A', partido: 'PT', pct: 45 },
      { candidato: 'Candidato B', partido: 'PL', pct: 45 },
      { candidato: 'Brancos/nulos', partido: null, pct: 5 },
      { candidato: 'Não sabe', partido: null, pct: 5 },
    ]);
    const combinada = pesquisaT2('combinada', 'SP', 'AtlasIntel', '2026-09-14', 1000, [
      { candidato: 'Candidato A', partido: 'PT', pct: 44 },
      { candidato: 'Candidato B', partido: 'PL', pct: 44 },
      { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 12 },
    ]);
    const agregado = agregarPesquisas([separada, combinada], {}, HOJE)!;
    expect(agregado.outros).toHaveLength(1);
    expect(agregado.outros[0]!.pct).toBeCloseTo(11, 6);
    expect(agregado.outros[0]!.pesquisas).toBe(2);
    const soma =
      agregado.candidatos.reduce((s, c) => s + c.pct, 0) +
      agregado.outros.reduce((s, o) => s + o.pct, 0);
    expect(soma).toBeCloseTo(100, 6);
  });

  it('"Outros" (candidatos não itemizados) não é misturado com brancos/nulos', () => {
    const p = pesquisaT2('com-outros', 'SE', 'Instituto Teste', '2026-09-14', 1000, [
      { candidato: 'Candidato A', partido: 'PT', pct: 50 },
      { candidato: 'Candidato B', partido: 'PL', pct: 42 },
      { candidato: 'Brancos/nulos', partido: null, pct: 4 },
      { candidato: 'Não sabe', partido: null, pct: 3 },
      { candidato: 'Outros', partido: null, pct: 1 },
    ]);
    const agregado = agregarPesquisas([p], {}, HOJE)!;
    const porCategoria = new Map(agregado.outros.map((o) => [o.candidato, o.pct]));
    expect([...porCategoria.keys()].sort()).toEqual(
      [CATEGORIA_BRANCOS_NULOS_NAO_SABE, CATEGORIA_OUTROS_CANDIDATOS].sort(),
    );
    expect(porCategoria.get(NAO_SABE)).toBeCloseTo(7, 6);
    expect(porCategoria.get(CATEGORIA_OUTROS_CANDIDATOS)).toBeCloseTo(1, 6);
  });

  it('Alagoas, 2º turno: a soma do painel volta a 100 (era 109,3)', () => {
    const hoje = new Date('2026-09-25T00:00:00Z');
    // data/polls.json, recorte presidente/AL/2º turno (Lula x Flávio).
    const rtbd = pesquisaT2(
      '2026-09-25-realtimebigdata-al-presidente-t2-lula-flavio',
      'AL',
      'Real Time Big Data',
      '2026-09-24',
      1600,
      [
        { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', pct: 53 },
        { candidato: 'Flávio Bolsonaro', partido: 'PL', pct: 38 },
        { candidato: 'Brancos/nulos', partido: null, pct: 5 },
        { candidato: 'Não sabe', partido: null, pct: 4 },
      ],
    );
    const atlas = pesquisaT2(
      '2026-09-10-atlasintel-al-presidente-t2-lula-flavio',
      'AL',
      'AtlasIntel',
      '2026-09-09',
      1208,
      [
        { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', pct: 50.6 },
        { candidato: 'Flávio Bolsonaro', partido: 'PL', pct: 40 },
        { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 9.4 },
      ],
    );

    const agregado = agregarPesquisas([rtbd, atlas], {}, hoje)!;

    // Uma única linha de não-candidato: no máximo 9,4 pontos existem no recorte.
    expect(agregado.outros).toHaveLength(1);
    expect(agregado.outros[0]!.candidato).toBe(NAO_SABE);
    expect(agregado.outros[0]!.pct).toBeGreaterThan(9);
    expect(agregado.outros[0]!.pct).toBeLessThan(9.4);
    expect(agregado.outros[0]!.pesquisas).toBe(2);

    const soma =
      agregado.candidatos.reduce((s, c) => s + c.pct, 0) +
      agregado.outros.reduce((s, o) => s + o.pct, 0);
    expect(soma).toBeCloseTo(100, 6);

    // O ranking não muda: Lula lidera, Flávio é o segundo.
    expect(agregado.candidatos.map((c) => c.candidato)).toEqual([
      'Luiz Inácio Lula da Silva',
      'Flávio Bolsonaro',
    ]);
  });

  it('Ceará, 2º turno: uma linha só, com a cobertura de quantas pesquisas a publicam', () => {
    const hoje = new Date('2026-09-25T00:00:00Z');
    // data/polls.json, recorte presidente/CE/2º turno (Lula x Flávio): das três
    // pesquisas, só a Real Time Big Data de 17/09 publica a quebra.
    const atlas = pesquisaT2(
      '2026-09-21-atlasintel-ce-presidente-t2-lula-flavio',
      'CE',
      'AtlasIntel',
      '2026-09-20',
      1815,
      [
        { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', pct: 57.7 },
        { candidato: 'Flávio Bolsonaro', partido: 'PL', pct: 38.3 },
      ],
    );
    const rtbd = pesquisaT2(
      '2026-09-18-real-time-big-data-ce-presidente-t2-lula-flavio',
      'CE',
      'Real Time Big Data',
      '2026-09-17',
      1600,
      [
        { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', pct: 64 },
        { candidato: 'Flávio Bolsonaro', partido: 'PL', pct: 27 },
        { candidato: 'Brancos/nulos', partido: null, pct: 4 },
        { candidato: 'Não sabe', partido: null, pct: 5 },
      ],
    );
    const rtbdAntiga = pesquisaT2(
      '2026-09-08-realtimebigdata-ce-presidente-t2',
      'CE',
      'Real Time Big Data',
      '2026-09-07',
      1600,
      [
        { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', pct: 65 },
        { candidato: 'Flávio Bolsonaro', partido: 'PL', pct: 27 },
      ],
    );

    const agregado = agregarPesquisas([atlas, rtbd, rtbdAntiga], {}, hoje)!;

    // Duas linhas ("Não sabe 5,0" e "Brancos/nulos 4,0") viram uma, com os
    // 9 pontos que a pesquisa publicou — nem mais, nem divididos.
    expect(agregado.outros).toHaveLength(1);
    expect(agregado.outros[0]!.candidato).toBe(NAO_SABE);
    expect(agregado.outros[0]!.pct).toBeCloseTo(9, 6);
    // 1 das 3 pesquisas usadas: as outras duas não publicam a quebra e NADA é
    // estimado para completar. É essa cobertura que a tela precisa dizer — a
    // soma candidatos + outros não fecha 100 aqui, e não é dado que falta, é
    // dado que o instituto não publicou.
    expect(agregado.outros[0]!.pesquisas).toBe(1);
    expect(agregado.pesquisasUsadas).toHaveLength(3);
    expect(agregado.candidatos.map((c) => c.candidato)).toEqual([
      'Luiz Inácio Lula da Silva',
      'Flávio Bolsonaro',
    ]);
  });

  it('1º turno: combinações diferentes de linhas em cada pesquisa não se multiplicam', () => {
    const base = {
      uf: 'MG',
      cargo: 'governador' as const,
      turno: 1 as const,
      dataFim: '2026-09-14',
      publicadoEm: '2026-09-14',
      amostra: 1000,
      fonte: { nome: 'Fonte', url: 'https://exemplo.test' },
    };
    const p1 = criarPesquisa({
      ...base,
      id: 't1-a',
      instituto: 'A',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 40 },
        { candidato: 'Candidato B', partido: 'PL', pct: 30 },
        { candidato: 'Brancos/nulos', partido: null, pct: 6 },
        { candidato: 'Não sabe', partido: null, pct: 4 },
      ],
    });
    const p2 = criarPesquisa({
      ...base,
      id: 't1-b',
      instituto: 'B',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 41 },
        { candidato: 'Candidato B', partido: 'PL', pct: 29 },
        { candidato: 'Nenhum/Brancos/nulos', partido: null, pct: 6 },
        { candidato: 'Não sabe/não respondeu', partido: null, pct: 4 },
      ],
    });
    const p3 = criarPesquisa({
      ...base,
      id: 't1-c',
      instituto: 'C',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 39 },
        { candidato: 'Candidato B', partido: 'PL', pct: 31 },
        { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 10 },
      ],
    });

    const agregado = agregarPesquisas([p1, p2, p3], {}, HOJE)!;
    expect(agregado.outros).toHaveLength(1);
    expect(agregado.outros[0]!.candidato).toBe(NAO_SABE);
    expect(agregado.outros[0]!.pct).toBeCloseTo(10, 6);
    expect(agregado.outros[0]!.pesquisas).toBe(3);
    expect(agregado.candidatos.map((c) => c.candidato)).toEqual(['Candidato A', 'Candidato B']);
  });

  it('ehLinhaNaoCandidato segue excluindo do ranking tudo que tem categoria', () => {
    const vazio = new Set<string>();
    for (const rotulo of [
      'Brancos/nulos',
      'Brancos/nulos/não sabe',
      'Nenhum/branco/nulo',
      'Não sabe/indeciso (cenário espontâneo)',
      'Outros',
      'outros candidatos',
    ]) {
      expect(ehLinhaNaoCandidato(rotulo, vazio)).toBe(true);
      expect(normalizarLinhaNaoCandidato(rotulo)).not.toBeNull();
    }
    for (const nome of ['Luiz Inácio Lula da Silva', 'Ciro Gomes', 'Elmano de Freitas']) {
      expect(ehLinhaNaoCandidato(nome, vazio)).toBe(false);
      expect(normalizarLinhaNaoCandidato(nome)).toBeNull();
    }
  });
});
