import { describe, expect, it } from 'vitest';
import { agregarPesquisas, classificarConfianca, MARGEM_REFERENCIA_PADRAO } from '../aggregate.js';
import { criarPesquisa, type DadosPesquisa } from '../poll.js';

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

    const nomesOutros = agregado.outros.map((c) => c.candidato);
    expect(nomesOutros.sort()).toEqual(['Brancos/nulos', 'Não sabe'].sort());
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
    const p = pesquisa({
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 50 },
        { candidato: 'Voto Nulo Customizado', partido: null, pct: 50 },
      ],
    });
    const agregado = agregarPesquisas([p], { excluirCandidatos: ['voto nulo customizado'] }, HOJE)!;
    expect(agregado.candidatos.map((c) => c.candidato)).toEqual(['Candidato A']);
    expect(agregado.outros.map((c) => c.candidato)).toEqual(['Voto Nulo Customizado']);
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
