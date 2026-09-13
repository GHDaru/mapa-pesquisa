import { beforeAll, describe, expect, it } from 'vitest';
import { criarPartido, type Partido } from '../../../domain/party.js';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../../../domain/poll.js';
import { disputaId, type Disputa } from '../../../domain/race.js';
import { criarCadeiraSenado, type CadeiraSenado } from '../../../domain/senate.js';
import type {
  Clock,
  MetaRepository,
  PartyRepository,
  PollRepository,
  Repositorios,
  SenateSeatRepository,
} from '../../ports.js';
import { criarCasosDeUso, type CasosDeUso } from '../index.js';

function pollRepoFake(pesquisas: Pesquisa[]): PollRepository {
  return {
    todas: () => pesquisas,
    porDisputa: (disputa: Disputa) =>
      pesquisas.filter((p) => disputaId(p.disputa) === disputaId(disputa)),
  };
}

function partyRepoFake(partidos: Partido[]): PartyRepository {
  return {
    todos: () => partidos,
    porSigla: (sigla: string) => partidos.find((p) => p.sigla === sigla),
  };
}

function senateSeatRepoFake(cadeiras: CadeiraSenado[]): SenateSeatRepository {
  return { todas: () => cadeiras };
}

function metaRepoFake(atualizadoEm: string): MetaRepository {
  return { atualizadoEm: () => atualizadoEm };
}

const CLOCK: Clock = { hoje: () => new Date('2026-09-15T00:00:00Z') };

const PARTIDOS = [
  criarPartido({ sigla: 'PT', nome: 'Partido dos Trabalhadores', numero: 13, espectro: 'esquerda' }),
  criarPartido({ sigla: 'PL', nome: 'Partido Liberal', numero: 22, espectro: 'direita' }),
];

function p(dados: Partial<DadosPesquisa> & Pick<DadosPesquisa, 'id' | 'uf' | 'cargo' | 'turno' | 'resultados'>): Pesquisa {
  return criarPesquisa({
    instituto: 'Instituto Teste',
    registroTSE: 'BR-0001/2026',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-10',
    publicadoEm: '2026-09-11',
    amostra: 1000,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    ...dados,
  });
}

let casos: CasosDeUso;

beforeAll(() => {
  const pesquisas: Pesquisa[] = [
    p({
      id: 'pres-t1',
      uf: 'BR',
      cargo: 'presidente',
      turno: 1,
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 45 },
        { candidato: 'Candidato B', partido: 'PL', pct: 40 },
        { candidato: 'Brancos/nulos', partido: null, pct: 15 },
      ],
    }),
    p({
      id: 'pres-t2-ab',
      uf: 'BR',
      cargo: 'presidente',
      turno: 2,
      cenario: 'A x B',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 52 },
        { candidato: 'Candidato B', partido: 'PL', pct: 48 },
      ],
    }),
    p({
      id: 'pres-t2-ac',
      uf: 'BR',
      cargo: 'presidente',
      turno: 2,
      cenario: 'A x C',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 55 },
        { candidato: 'Candidato C', partido: 'PL', pct: 45 },
      ],
    }),
    p({
      id: 'gov-sp-t1',
      uf: 'SP',
      cargo: 'governador',
      turno: 1,
      resultados: [
        { candidato: 'Candidato D', partido: 'PT', pct: 38 },
        { candidato: 'Candidato E', partido: 'PL', pct: 35 },
      ],
    }),
    p({
      id: 'gov-sp-t2',
      uf: 'SP',
      cargo: 'governador',
      turno: 2,
      resultados: [
        { candidato: 'Candidato D', partido: 'PT', pct: 53 },
        { candidato: 'Candidato E', partido: 'PL', pct: 47 },
      ],
    }),
    p({
      id: 'gov-rj-t1',
      uf: 'RJ',
      cargo: 'governador',
      turno: 1,
      resultados: [
        { candidato: 'Candidato F', partido: 'PT', pct: 44 },
        { candidato: 'Candidato G', partido: 'PL', pct: 40 },
      ],
    }),
    p({
      id: 'sen-sp-t1',
      uf: 'SP',
      cargo: 'senador',
      turno: 1,
      resultados: [
        { candidato: 'Candidata H', partido: 'PT', pct: 36 },
        { candidato: 'Candidato I', partido: 'PL', pct: 34 },
        { candidato: 'Candidato J', partido: 'PL', pct: 20 },
      ],
    }),
  ];

  const cadeiras: CadeiraSenado[] = [
    criarCadeiraSenado({
      uf: 'SP',
      senador: 'Fixo SP',
      partido: 'PL',
      mandatoInicio: 2023,
      mandatoFim: 2031,
      emDisputa2026: false,
      fonte: 'https://exemplo.test',
    }),
    criarCadeiraSenado({
      uf: 'SP',
      senador: 'Atual SP 1',
      partido: 'PT',
      mandatoInicio: 2019,
      mandatoFim: 2027,
      emDisputa2026: true,
      fonte: 'https://exemplo.test',
    }),
    criarCadeiraSenado({
      uf: 'SP',
      senador: 'Atual SP 2',
      partido: 'PL',
      mandatoInicio: 2019,
      mandatoFim: 2027,
      emDisputa2026: true,
      fonte: 'https://exemplo.test',
    }),
    criarCadeiraSenado({
      uf: 'RJ',
      senador: 'Fixo RJ',
      partido: 'PT',
      mandatoInicio: 2023,
      mandatoFim: 2031,
      emDisputa2026: false,
      fonte: 'https://exemplo.test',
    }),
    criarCadeiraSenado({
      uf: 'RJ',
      senador: 'Atual RJ 1',
      partido: 'PT',
      mandatoInicio: 2019,
      mandatoFim: 2027,
      emDisputa2026: true,
      fonte: 'https://exemplo.test',
    }),
    criarCadeiraSenado({
      uf: 'RJ',
      senador: 'Atual RJ 2',
      partido: 'PL',
      mandatoInicio: 2019,
      mandatoFim: 2027,
      emDisputa2026: true,
      fonte: 'https://exemplo.test',
    }),
  ];

  const repos: Repositorios = {
    polls: pollRepoFake(pesquisas),
    parties: partyRepoFake(PARTIDOS),
    senateSeats: senateSeatRepoFake(cadeiras),
    meta: metaRepoFake('2026-09-13'),
  };

  casos = criarCasosDeUso(repos, CLOCK);
});

describe('use-cases/getStateSummary', () => {
  it('usa o 2º turno de governador quando disponível', () => {
    const resumo = casos.getStateSummary('SP');
    expect(resumo.governador?.lider?.candidato).toBe('Candidato D');
    expect(resumo.governador?.lider?.pct).toBeCloseTo(53, 6);
  });

  it('recai no 1º turno de governador quando não há 2º turno', () => {
    const resumo = casos.getStateSummary('RJ');
    expect(resumo.governador?.lider?.candidato).toBe('Candidato F');
  });

  it('agrega senador (sem 2º turno) quando há pesquisa', () => {
    const resumo = casos.getStateSummary('SP');
    expect(resumo.senador?.lider?.candidato).toBe('Candidata H');
  });

  it('retorna null quando não há nenhuma pesquisa para a UF', () => {
    const resumo = casos.getStateSummary('AC');
    expect(resumo.governador).toBeNull();
    expect(resumo.senador).toBeNull();
  });

  it('retorna null apenas para senador quando não há pesquisa de senador na UF', () => {
    const resumo = casos.getStateSummary('RJ');
    expect(resumo.senador).toBeNull();
  });
});

describe('use-cases/getPresidentialAggregate', () => {
  it('agrega o 1º turno em um único resultado', () => {
    const { turno1 } = casos.getPresidentialAggregate();
    expect(turno1?.lider?.candidato).toBe('Candidato A');
    expect(turno1?.lider?.pct).toBeCloseTo(45, 6);
  });

  it('agrupa o 2º turno por cenário', () => {
    const { turno2 } = casos.getPresidentialAggregate();
    expect(turno2).toHaveLength(2);
    const cenarios = turno2.map((c) => c.cenario).sort();
    expect(cenarios).toEqual(['A x B', 'A x C']);
  });

  it('cada cenário do 2º turno tem seu próprio líder', () => {
    const { turno2 } = casos.getPresidentialAggregate();
    const ab = turno2.find((c) => c.cenario === 'A x B')!;
    expect(ab.agregado.lider?.pct).toBeCloseTo(52, 6);
    const ac = turno2.find((c) => c.cenario === 'A x C')!;
    expect(ac.agregado.lider?.pct).toBeCloseTo(55, 6);
  });
});

describe('use-cases/listParties', () => {
  it('lista todos os partidos do repositório', () => {
    const partidos = casos.listParties();
    expect(partidos.map((p2) => p2.sigla).sort()).toEqual(['PL', 'PT']);
  });
});

describe('use-cases/getMapOverview', () => {
  it('inclui as 27 UFs', () => {
    const visao = casos.getMapOverview();
    expect(visao).toHaveLength(27);
  });

  it('marca semDados quando não há pesquisa de governador na UF', () => {
    const visao = casos.getMapOverview();
    const ac = visao.find((v) => v.uf === 'AC')!;
    expect(ac.semDados).toBe(true);
  });

  it('resolve o espectro do partido líder', () => {
    const visao = casos.getMapOverview();
    const sp = visao.find((v) => v.uf === 'SP')!;
    expect(sp.semDados).toBe(false);
    expect(sp.liderGovernador).toBe('Candidato D');
    expect(sp.partido).toBe('PT');
    expect(sp.espectro).toBe('esquerda');
  });
});

describe('use-cases/projectSenate', () => {
  it('projeta os 2 primeiros do agregado de senador para as cadeiras em disputa', () => {
    const projecao = casos.projectSenate();
    const projetadasSp = projecao.assentos.filter((a) => a.uf === 'SP' && a.origem === 'projetada');
    expect(projetadasSp.map((a) => a.ocupante).sort()).toEqual(['Candidata H', 'Candidato I'].sort());
  });

  it('marca indefinida quando não há pesquisa de senador na UF', () => {
    const projecao = casos.projectSenate();
    const rj = projecao.assentos.filter((a) => a.uf === 'RJ' && a.origem !== 'fixa');
    expect(rj).toHaveLength(2);
    for (const a of rj) expect(a.origem).toBe('indefinida');
  });

  it('mantém a cadeira fixa de SP com o ocupante atual', () => {
    const projecao = casos.projectSenate();
    const fixaSp = projecao.assentos.find((a) => a.uf === 'SP' && a.origem === 'fixa')!;
    expect(fixaSp.ocupante).toBe('Fixo SP');
    expect(fixaSp.partido).toBe('PL');
  });
});

describe('getPresidentialAggregate — cenários de 2º turno', () => {
  it('agrupa o mesmo confronto mesmo com rótulos diferentes', async () => {
    const { carregarDados } = await import('../../../adapters/outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-13T12:00:00Z') });
    const chaves = casos.getPresidentialAggregate().turno2.map((c) =>
      c.agregado.candidatos.map((x) => x.candidato.toLowerCase()).sort().join('|'),
    );
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
