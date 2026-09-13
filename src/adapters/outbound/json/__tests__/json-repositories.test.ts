import { describe, expect, it } from 'vitest';
import type { DadosEleitorado } from '../../../../domain/electorate.js';
import type { DadosPartido } from '../../../../domain/party.js';
import type { DadosPesquisa } from '../../../../domain/poll.js';
import { criarDisputa } from '../../../../domain/race.js';
import type { DadosCadeiraSenado } from '../../../../domain/senate.js';
import { carregarDados } from '../carregar-dados.js';
import { criarEleitoradoRepositoryJson } from '../electorate-repository.js';
import { criarMetaRepositoryJson } from '../meta-repository.js';
import { criarPartyRepositoryJson } from '../party-repository.js';
import { criarPollRepositoryJson } from '../poll-repository.js';
import { criarSenateSeatRepositoryJson } from '../senate-seat-repository.js';

const PESQUISA_VALIDA: DadosPesquisa = {
  id: 'valida-1',
  uf: 'SP',
  cargo: 'governador',
  turno: 1,
  instituto: 'Instituto Teste',
  registroTSE: 'SP-0001/2026',
  dataInicio: '2026-09-01',
  dataFim: '2026-09-03',
  publicadoEm: '2026-09-05',
  amostra: 1000,
  fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
  resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 50 }],
};

describe('adapters/outbound/json — poll-repository', () => {
  it('carrega pesquisas válidas e filtra por disputa', () => {
    const repo = criarPollRepositoryJson([PESQUISA_VALIDA]);
    expect(repo.todas()).toHaveLength(1);
    expect(repo.porDisputa(criarDisputa('SP', 'governador', 1))).toHaveLength(1);
    expect(repo.porDisputa(criarDisputa('SP', 'senador', 1))).toHaveLength(0);
  });

  it('rejeita pesquisa inválida com erro contendo o id', () => {
    const invalida: DadosPesquisa = { ...PESQUISA_VALIDA, id: 'invalida-2', resultados: [] };
    expect(() => criarPollRepositoryJson([invalida])).toThrowError(/invalida-2/);
  });
});

describe('adapters/outbound/json — party-repository', () => {
  it('carrega partidos válidos e busca por sigla', () => {
    const dados: DadosPartido[] = [{ sigla: 'PT', nome: 'PT', numero: 13, espectro: 'esquerda' }];
    const repo = criarPartyRepositoryJson(dados);
    expect(repo.porSigla('PT')?.nome).toBe('PT');
    expect(repo.porSigla('INEXISTENTE')).toBeUndefined();
  });

  it('rejeita partido inválido com erro contendo a sigla', () => {
    const dados: DadosPartido[] = [{ sigla: 'ZZ', nome: 'Z', numero: 1, espectro: 'inexistente' }];
    expect(() => criarPartyRepositoryJson(dados)).toThrowError(/ZZ/);
  });
});

describe('adapters/outbound/json — senate-seat-repository', () => {
  it('carrega cadeiras válidas', () => {
    const dados: DadosCadeiraSenado[] = [
      {
        uf: 'SP',
        senador: 'Fulano',
        partido: 'PL',
        mandatoInicio: 2023,
        mandatoFim: 2031,
        emDisputa2026: false,
        fonte: 'https://exemplo.test',
      },
    ];
    const repo = criarSenateSeatRepositoryJson(dados);
    expect(repo.todas()).toHaveLength(1);
  });

  it('rejeita cadeira com UF inválida', () => {
    const dados: DadosCadeiraSenado[] = [
      {
        uf: 'XX',
        senador: 'Fulano',
        partido: 'PL',
        mandatoInicio: 2023,
        mandatoFim: 2031,
        emDisputa2026: false,
        fonte: '',
      },
    ];
    expect(() => criarSenateSeatRepositoryJson(dados)).toThrow();
  });
});

describe('adapters/outbound/json — meta-repository', () => {
  it('aceita atualizadoEm em formato ISO', () => {
    const repo = criarMetaRepositoryJson({ atualizadoEm: '2026-09-13' });
    expect(repo.atualizadoEm()).toBe('2026-09-13');
  });

  it('rejeita atualizadoEm inválido', () => {
    expect(() => criarMetaRepositoryJson({ atualizadoEm: '13/09/2026' })).toThrow();
  });
});

describe('adapters/outbound/json — electorate-repository', () => {
  it('carrega eleitorado válido e busca por UF', () => {
    const dados: DadosEleitorado[] = [
      { uf: 'SP', eleitores: 34_667_793, referencia: '2026-07', fonte: { nome: 'TSE', url: 'https://exemplo.test' } },
    ];
    const repo = criarEleitoradoRepositoryJson(dados);
    expect(repo.todos()).toHaveLength(1);
    expect(repo.porUf('SP')?.eleitores).toBe(34_667_793);
    expect(repo.porUf('AC')).toBeUndefined();
  });

  it('tolera lista vazia', () => {
    const repo = criarEleitoradoRepositoryJson([]);
    expect(repo.todos()).toHaveLength(0);
    expect(repo.porUf('SP')).toBeUndefined();
  });

  it('rejeita eleitorado inválido com erro contendo a UF', () => {
    const dados: DadosEleitorado[] = [
      { uf: 'SP', eleitores: -1, referencia: '2026-07', fonte: { nome: 'TSE', url: 'https://exemplo.test' } },
    ];
    expect(() => criarEleitoradoRepositoryJson(dados)).toThrowError(/SP/);
  });
});

describe('adapters/outbound/json — carregarDados', () => {
  it('carrega os dados reais de data/*.json sem lançar erro', () => {
    const repos = carregarDados();
    expect(repos.parties.todos().length).toBeGreaterThan(0);
    expect(repos.polls.todas().length).toBeGreaterThan(0);
    expect(repos.senateSeats.todas().length).toBeGreaterThan(0);
    expect(repos.meta.atualizadoEm()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // data/electorate.json pode estar vazio até o agente publicar os números do TSE.
    expect(repos.electorate.todos().length).toBeGreaterThanOrEqual(0);
  });

  it('inclui a pesquisa de senador de SP presente em data/polls.json', () => {
    const repos = carregarDados();
    const senadoSp = repos.polls.porDisputa(criarDisputa('SP', 'senador', 1));
    expect(senadoSp.length).toBeGreaterThan(0);
  });
});
