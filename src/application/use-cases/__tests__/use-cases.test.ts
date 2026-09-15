import { beforeAll, describe, expect, it } from 'vitest';
import { criarEleitorado, type Eleitorado } from '../../../domain/electorate.js';
import { criarPartido, type Partido } from '../../../domain/party.js';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../../../domain/poll.js';
import { disputaId, type Disputa } from '../../../domain/race.js';
import { criarCadeiraSenado, type CadeiraSenado } from '../../../domain/senate.js';
import type {
  Clock,
  EleitoradoRepository,
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

function electorateRepoFake(eleitorado: Eleitorado[]): EleitoradoRepository {
  return {
    todos: () => eleitorado,
    porUf: (uf: string) => eleitorado.find((e) => e.uf === uf),
  };
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
    p({
      id: 'pres-sp-t1',
      uf: 'SP',
      cargo: 'presidente',
      turno: 1,
      dataInicio: '2026-09-05',
      dataFim: '2026-09-08',
      publicadoEm: '2026-09-09',
      resultados: [
        { candidato: 'Candidato A', partido: 'PT', pct: 41 },
        { candidato: 'Candidato B', partido: 'PL', pct: 39 },
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

  const eleitorado: Eleitorado[] = [
    criarEleitorado({
      uf: 'SP',
      eleitores: 34_000_000,
      referencia: '2026-07',
      fonte: { nome: 'TSE', url: 'https://exemplo.test' },
    }),
    criarEleitorado({
      uf: 'RJ',
      eleitores: 12_000_000,
      referencia: '2026-07',
      fonte: { nome: 'TSE', url: 'https://exemplo.test' },
    }),
  ];

  const repos: Repositorios = {
    polls: pollRepoFake(pesquisas),
    parties: partyRepoFake(PARTIDOS),
    senateSeats: senateSeatRepoFake(cadeiras),
    meta: metaRepoFake('2026-09-13'),
    electorate: electorateRepoFake(eleitorado),
  };

  casos = criarCasosDeUso(repos, CLOCK);
});

describe('use-cases/getMeta', () => {
  it('devolve a data de atualização do MetaRepository', () => {
    expect(casos.getMeta().atualizadoEm).toBe('2026-09-13');
  });
});

describe('use-cases/getDailyDigest', () => {
  it('combina pesquisas, partidos e eleitorado dos repositórios num único resumo', () => {
    const digest = casos.getDailyDigest();
    expect(digest.dataAtualizacao).toBe('2026-09-13');
    expect(digest.totalPesquisas).toBe(8);
    expect(digest.partidos).toBe(2);
    expect(digest.eleitoradoTotal).toBe(34_000_000 + 12_000_000);
    expect(digest.cadeirasSenado).toBe(81);
  });
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
    expect(cenarios).toEqual(['2º turno: Candidato A x Candidato B', '2º turno: Candidato A x Candidato C']);
  });

  it('cada cenário do 2º turno tem seu próprio líder', () => {
    const { turno2 } = casos.getPresidentialAggregate();
    const ab = turno2.find((c) => c.cenario === '2º turno: Candidato A x Candidato B')!;
    expect(ab.agregado.lider?.pct).toBeCloseTo(52, 6);
    const ac = turno2.find((c) => c.cenario === '2º turno: Candidato A x Candidato C')!;
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

describe('use-cases/getPresidentialTimeline', () => {
  it('retorna série nacional do 1º turno com a mesma média do agregado pontual', () => {
    const serie = casos.getPresidentialTimeline(1);
    expect(serie.dias.length).toBeGreaterThan(0);
    expect(serie.candidatos[0]).toBe('Candidato A');
    const ultimoDia = serie.dias[serie.dias.length - 1]!;
    expect(ultimoDia.data).toBe('2026-09-15');
    expect(ultimoDia.valores['Candidato A']).toBeCloseTo(45, 6);
  });

  it('filtra o 2º turno por cenário, aceitando o rótulo de getPresidentialAggregate', () => {
    const serie = casos.getPresidentialTimeline(2, '2º turno: Candidato A x Candidato B');
    const ultimoDia = serie.dias[serie.dias.length - 1]!;
    expect(ultimoDia.valores['Candidato A']).toBeCloseTo(52, 6);
    expect(serie.candidatos).toEqual(expect.arrayContaining(['Candidato A', 'Candidato B']));
    expect(serie.candidatos).not.toContain('Candidato C');
  });

  it('usa o cenário mais recente do 2º turno quando nenhum é informado', () => {
    const serie = casos.getPresidentialTimeline(2);
    expect(serie.candidatos).toEqual(expect.arrayContaining(['Candidato A', 'Candidato B']));
  });

  it('retorna série vazia quando o cenário pedido não existe', () => {
    const serie = casos.getPresidentialTimeline(2, 'inexistente x nunca visto');
    expect(serie.dias).toEqual([]);
    expect(serie.candidatos).toEqual([]);
  });
});

describe('use-cases/getPresidentialByState', () => {
  it('inclui as 27 UFs', () => {
    expect(casos.getPresidentialByState().ufs).toHaveLength(27);
  });

  it('agrega a pesquisa presidencial estadual de SP e usa o eleitorado cadastrado', () => {
    const { ufs, eleitoradoNacional, eleitoradoComPesquisa } = casos.getPresidentialByState();
    const sp = ufs.find((u) => u.uf === 'SP')!;
    expect(sp.semDados).toBe(false);
    expect(sp.lider).toBe('Candidato A');
    expect(sp.partido).toBe('PT');
    expect(sp.vantagem).toBeCloseTo(2, 6);
    expect(sp.empateTecnico).toBe(true);
    expect(sp.eleitores).toBe(34_000_000);
    expect(sp.serie).not.toBeNull();
    expect(sp.ultimaPesquisa?.id).toBe('pres-sp-t1');
    expect(eleitoradoNacional).toBe(34_000_000 + 12_000_000);
    expect(eleitoradoComPesquisa).toBe(34_000_000);
  });

  it('marca semDados e serie null para UF sem pesquisa presidencial estadual, mas mantém o eleitorado', () => {
    const { ufs } = casos.getPresidentialByState();
    const rj = ufs.find((u) => u.uf === 'RJ')!;
    expect(rj.semDados).toBe(true);
    expect(rj.agregado).toBeNull();
    expect(rj.serie).toBeNull();
    expect(rj.eleitores).toBe(12_000_000);
  });

  it('eleitores é null quando a UF não está em data/electorate.json', () => {
    const { ufs } = casos.getPresidentialByState();
    const ac = ufs.find((u) => u.uf === 'AC')!;
    expect(ac.eleitores).toBeNull();
    expect(ac.semDados).toBe(true);
  });
});

describe('use-cases/getSenateByState', () => {
  it('inclui as 27 UFs', () => {
    expect(casos.getSenateByState()).toHaveLength(27);
  });

  it('traz a cadeira fixa e os 2 ocupantes atuais das cadeiras em disputa em SP', () => {
    const sp = casos.getSenateByState().find((r) => r.uf === 'SP')!;
    expect(sp.cadeiraFixa).toEqual({ senador: 'Fixo SP', partido: 'PL', mandatoFim: 2031 });
    expect(sp.cadeirasAtuaisEmDisputa.map((o) => o.senador).sort()).toEqual(
      ['Atual SP 1', 'Atual SP 2'].sort(),
    );
  });

  it('projeta os 2 primeiros colocados do agregado com percentual e confiança', () => {
    const sp = casos.getSenateByState().find((r) => r.uf === 'SP')!;
    expect(sp.projetadas).toHaveLength(2);
    expect(sp.projetadas[0]).toMatchObject({ candidato: 'Candidata H', partido: 'PT' });
    expect(sp.projetadas[0]!.pct).toBeCloseTo(36, 6);
    expect(sp.projetadas[1]).toMatchObject({ candidato: 'Candidato I', partido: 'PL' });
    expect(sp.projetadas[1]!.pct).toBeCloseTo(34, 6);
    expect(sp.fonte?.nome).toBe('Fonte Teste');
  });

  it('marca empate quando a vantagem entre o 1º e o 2º colocado é pequena', () => {
    const sp = casos.getSenateByState().find((r) => r.uf === 'SP')!;
    expect(sp.empate).toBe(true);
  });

  it('projetadas vazio e fonte null quando não há pesquisa de senador na UF', () => {
    const rj = casos.getSenateByState().find((r) => r.uf === 'RJ')!;
    expect(rj.projetadas).toEqual([]);
    expect(rj.fonte).toBeNull();
    expect(rj.empate).toBe(false);
    expect(rj.cadeirasAtuaisEmDisputa.map((o) => o.senador).sort()).toEqual(
      ['Atual RJ 1', 'Atual RJ 2'].sort(),
    );
  });
});

describe('use-cases/getPollsDatabase', () => {
  it('total conta todas as pesquisas de todos os cargos/turnos', () => {
    expect(casos.getPollsDatabase().totais.total).toBe(8);
  });

  it('porCargo separa presidente/governador/senador corretamente', () => {
    const { porCargo } = casos.getPollsDatabase().totais;
    expect(porCargo.presidente).toBe(4);
    expect(porCargo.governador).toBe(3);
    expect(porCargo.senador).toBe(1);
  });

  it('porInstituto conta pesquisas por instituto', () => {
    const { porInstituto } = casos.getPollsDatabase().totais;
    expect(porInstituto['Instituto Teste']).toBe(8);
  });

  it('todas as pesquisas de teste têm registro TSE', () => {
    const { comRegistroTSE, semRegistroTSE } = casos.getPollsDatabase().totais;
    expect(comRegistroTSE).toBe(8);
    expect(semRegistroTSE).toBe(0);
  });

  it('ufsCobertas conta UFs distintas (inclui BR)', () => {
    expect(casos.getPollsDatabase().totais.ufsCobertas).toBe(3);
  });

  it('institutos e ufs vêm em ordem alfabética, sem duplicatas', () => {
    const { institutos, ufs } = casos.getPollsDatabase();
    expect(institutos).toEqual(['Instituto Teste']);
    expect(ufs).toEqual(['BR', 'RJ', 'SP']);
  });

  it('pesquisas vêm ordenadas por data de referência desc', () => {
    const { pesquisas } = casos.getPollsDatabase();
    expect(pesquisas).toHaveLength(8);
    expect(pesquisas[0]!.id).toBe('pres-t1');
    expect(pesquisas.at(-1)!.id).toBe('pres-sp-t1');
  });
});

describe('use-cases/getVoteEstimate', () => {
  it('estima votos usando pesquisa estadual de SP e o nacional como substituto em RJ', () => {
    const estimativa = casos.getVoteEstimate();
    expect(estimativa).not.toBeNull();
    expect(estimativa!.ufsComPesquisa).toEqual(['SP']);
    expect(estimativa!.ufsSemPesquisa).toEqual(['RJ']);

    const a = estimativa!.candidatos.find((c) => c.candidato === 'Candidato A')!;
    // SP: 34_000_000 * 0.41 = 13_940_000 (pesquisa estadual)
    // RJ: 12_000_000 * 0.45 = 5_400_000 (substituto nacional)
    expect(a.votos).toBeCloseTo(13_940_000 + 5_400_000, 3);
    expect(a.votosDeUfComPesquisa).toBeCloseTo(13_940_000, 3);
    expect(a.votosDeUfSemPesquisa).toBeCloseTo(5_400_000, 3);
  });

  it('candidatos vêm ordenados por votos desc e a soma do eleitorado bate', () => {
    const estimativa = casos.getVoteEstimate()!;
    expect(estimativa.candidatos[0]!.candidato).toBe('Candidato A');
    expect(estimativa.eleitoradoTotal).toBe(34_000_000 + 12_000_000);
  });

  it('retorna null quando não há eleitorado cadastrado para nenhuma UF', () => {
    const reposSemEleitorado: Repositorios = {
      polls: pollRepoFake([
        p({
          id: 'pres-br-solo',
          uf: 'BR',
          cargo: 'presidente',
          turno: 1,
          resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 50 }],
        }),
      ]),
      parties: partyRepoFake(PARTIDOS),
      senateSeats: senateSeatRepoFake([]),
      meta: metaRepoFake('2026-09-13'),
      electorate: electorateRepoFake([]),
    };
    const casosSemEleitorado = criarCasosDeUso(reposSemEleitorado, CLOCK);
    expect(casosSemEleitorado.getVoteEstimate()).toBeNull();
  });

  it('retorna null quando falta agregado nacional e alguma UF com eleitorado não tem pesquisa estadual', () => {
    const reposSemNacional: Repositorios = {
      polls: pollRepoFake([
        p({
          id: 'pres-sp-solo',
          uf: 'SP',
          cargo: 'presidente',
          turno: 1,
          resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 50 }],
        }),
      ]),
      parties: partyRepoFake(PARTIDOS),
      senateSeats: senateSeatRepoFake([]),
      meta: metaRepoFake('2026-09-13'),
      electorate: electorateRepoFake([
        criarEleitorado({ uf: 'SP', eleitores: 34_000_000, referencia: '2026-07', fonte: { nome: 'TSE', url: 'https://exemplo.test' } }),
        criarEleitorado({ uf: 'RJ', eleitores: 12_000_000, referencia: '2026-07', fonte: { nome: 'TSE', url: 'https://exemplo.test' } }),
      ]),
    };
    const casosSemNacional = criarCasosDeUso(reposSemNacional, CLOCK);
    // SP tem pesquisa estadual, mas RJ não tem — e não há agregado nacional para suprir RJ.
    expect(casosSemNacional.getVoteEstimate()).toBeNull();
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
