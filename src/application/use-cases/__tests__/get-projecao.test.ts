import { describe, expect, it } from 'vitest';
import { criarGetProjecao, LIMIAR_APURACAO_ENCERRADA } from '../get-projecao.js';
import { criarApuracaoRepositoryJson } from '../../../adapters/outbound/json/apuracao-repository.js';
import { criarEleitoradoRepositoryJson } from '../../../adapters/outbound/json/electorate-repository.js';
import { criarMetaRepositoryJson } from '../../../adapters/outbound/json/meta-repository.js';
import { criarPartyRepositoryJson } from '../../../adapters/outbound/json/party-repository.js';
import { criarPollRepositoryJson } from '../../../adapters/outbound/json/poll-repository.js';
import { criarSenateSeatRepositoryJson } from '../../../adapters/outbound/json/senate-seat-repository.js';
import type { Clock, Repositorios } from '../../ports.js';
import type { DadosApuracao } from '../../../domain/apuracao.js';
import type { DadosPesquisa } from '../../../domain/poll.js';

/**
 * O caminho do "resultado final" não podia esperar o dado real para ser
 * exercido: ou ele é testado contra uma apuração fictícia fechada, ou só se
 * descobre que está quebrado na noite em que ele importa.
 *
 * Os nomes de candidato aqui são os CANÔNICOS, de propósito. `criarPesquisa`
 * passa cada rótulo por `normalizarCandidato`, que converte apelidos ("Lula",
 * "Flávio") na forma completa. A primeira versão destes testes usava apelidos
 * nos dois lados e o ranking voltava vazio: a chave da apuração não casava com
 * a chave normalizada da pesquisa. É a mesma armadilha que o arquivo de
 * apuração enfrenta, e a razão de o esquema exigir os nomes de polls.json.
 */

const FONTE = { nome: 'Fixture', url: 'https://exemplo.invalido' };
const CLOCK: Clock = { hoje: () => new Date('2026-10-04T23:30:00Z') };

const PARTIDOS = [
  {
    sigla: 'PT',
    nome: 'Partido dos Trabalhadores',
    numero: 13,
    espectro: 'esquerda',
    fonteClassificacao: 'https://exemplo.invalido',
    cor: null,
    federacao: null,
  },
  {
    sigla: 'PL',
    nome: 'Partido Liberal',
    numero: 22,
    espectro: 'direita',
    fonteClassificacao: 'https://exemplo.invalido',
    cor: null,
    federacao: null,
  },
];

function pesquisa(
  instituto: string,
  dataFim: string,
  resultados: readonly [string, number][],
): DadosPesquisa {
  return {
    id: `${dataFim}-${instituto.toLowerCase().replace(/\s+/g, '-')}-br-presidente-t1`,
    uf: 'BR',
    cargo: 'presidente',
    turno: 1,
    instituto,
    registroTSE: null,
    contratante: null,
    dataInicio: dataFim,
    dataFim,
    publicadoEm: dataFim,
    amostra: 2000,
    margem: 2,
    cenario: 'estimulada, 1º turno',
    fonte: FONTE,
    resultados: resultados.map(([candidato, pct]) => ({
      candidato,
      partido: candidato.includes('Lula') ? 'PT' : candidato.includes('Flávio') ? 'PL' : null,
      pct,
    })),
  } as unknown as DadosPesquisa;
}

function repos(apuracao: DadosApuracao, pesquisas: readonly DadosPesquisa[]): Repositorios {
  return {
    polls: criarPollRepositoryJson(pesquisas as DadosPesquisa[]),
    parties: criarPartyRepositoryJson(PARTIDOS as never),
    senateSeats: criarSenateSeatRepositoryJson([]),
    meta: criarMetaRepositoryJson({ atualizadoEm: '2026-10-04' } as never),
    electorate: criarEleitoradoRepositoryJson([
      { uf: 'SP', eleitores: 34_000_000, referencia: '2026-07', fonte: FONTE },
    ] as never),
    apuracao: criarApuracaoRepositoryJson(apuracao),
  };
}

/** Resultado nacional fechado: Flávio 52, Lula 48 em válidos. */
function apuracaoFinal(secoes: number): DadosApuracao {
  return {
    atualizadoEm: '2026-10-04T23:25:00Z',
    recortes: [
      {
        cargo: 'presidente',
        uf: null,
        turno: 1,
        secoesTotalizadas: secoes,
        validosTotal: 100_000_000,
        candidatos: [
          { candidato: 'Flávio Bolsonaro', partido: 'PL', votos: 52_000_000 },
          { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', votos: 48_000_000 },
        ],
        fonte: FONTE,
        observacao: 'ENCERRADA (fixture).',
      },
    ],
  };
}

describe('o modo "resultado final" liga pelo próprio dado', () => {
  const pesquisas = [pesquisa('Preciso', '2026-10-02', [['Flávio Bolsonaro', 52], ['Luiz Inácio Lula da Silva', 48]])];

  it(`abaixo de ${LIMIAR_APURACAO_ENCERRADA}% não é final, e não há ranking de institutos`, () => {
    const r = criarGetProjecao(repos(apuracaoFinal(64.81), pesquisas), CLOCK)('presidente', 1);
    expect(r.apuracaoEncerrada).toBe(false);
    // O ranking fica null de propósito: contra parcial ele mediria o viés de
    // ordem de apuração e o atribuiria aos institutos.
    expect(r.acerto).toBeNull();
  });

  it('no limiar ou acima, é final e o ranking aparece', () => {
    const r = criarGetProjecao(repos(apuracaoFinal(100), pesquisas), CLOCK)('presidente', 1);
    expect(r.apuracaoEncerrada).toBe(true);
    expect(r.acerto).not.toBeNull();
    expect(r.acerto!.institutos).toHaveLength(1);
    expect(r.acerto!.primeiroESegundo).toEqual(['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva']);
    expect(r.acerto!.margemReal).toBeCloseTo(4, 6);
  });

  it('o limiar não é 100: a totalização fecha com frações residuais', () => {
    const r = criarGetProjecao(repos(apuracaoFinal(99.7), pesquisas), CLOCK)('presidente', 1);
    expect(r.apuracaoEncerrada).toBe(true);
  });
});

describe('o ranking mede contra o resultado, na base de válidos', () => {
  const resultado = apuracaoFinal(100);

  it('ordena por erro e marca quem errou o líder', () => {
    const r = criarGetProjecao(
      repos(resultado, [
        // Exato depois de renormalizar (candidatos somam 100).
        pesquisa('Exato', '2026-10-02', [['Flávio Bolsonaro', 52], ['Luiz Inácio Lula da Silva', 48]]),
        // Erra 6 pontos em cada e inverte a ordem.
        pesquisa('Invertido', '2026-10-01', [['Flávio Bolsonaro', 46], ['Luiz Inácio Lula da Silva', 54]]),
      ]),
      CLOCK,
    )('presidente', 1);

    const nomes = r.acerto!.institutos.map((i) => i.instituto);
    expect(nomes).toEqual(['Exato', 'Invertido']);
    expect(r.acerto!.institutos[0]!.erroMedioAbsoluto).toBeCloseTo(0, 6);
    expect(r.acerto!.institutos[0]!.acertouOLider).toBe(true);
    expect(r.acerto!.institutos[1]!.acertouOLider).toBe(false);
    expect(r.acerto!.acertaramOLider).toBe(1);
  });

  it('renormaliza a pesquisa do corte do total antes de comparar', () => {
    // Pesquisa no corte do total: candidatos somam 90, com 10 de brancos e
    // indecisos. Em válidos é exatamente 52 x 48 — erro zero. Sem
    // renormalizar, o erro apareceria como ~5 pontos em cada.
    const r = criarGetProjecao(
      repos(resultado, [
        pesquisa('Total', '2026-10-02', [
          ['Flávio Bolsonaro', 46.8],
          ['Luiz Inácio Lula da Silva', 43.2],
          ['Brancos/nulos', 6],
          ['Indecisos', 4],
        ]),
      ]),
      CLOCK,
    )('presidente', 1);
    expect(r.acerto!.institutos[0]!.erroMedioAbsoluto).toBeCloseTo(0, 4);
  });

  it('usa a última pesquisa de cada instituto e declara a distância da eleição', () => {
    const r = criarGetProjecao(
      repos(resultado, [
        pesquisa('X', '2026-08-01', [['Flávio Bolsonaro', 10], ['Luiz Inácio Lula da Silva', 90]]),
        pesquisa('X', '2026-09-27', [['Flávio Bolsonaro', 52], ['Luiz Inácio Lula da Silva', 48]]),
      ]),
      CLOCK,
    )('presidente', 1);
    expect(r.acerto!.institutos).toHaveLength(1);
    expect(r.acerto!.institutos[0]!.dataReferencia).toBe('2026-09-27');
    expect(r.acerto!.institutos[0]!.diasAntes).toBe(7);
  });
});

describe('sem apuração, nada é afirmado', () => {
  it('arquivo vazio devolve semDados e nenhum ranking', () => {
    const r = criarGetProjecao(
      repos({ atualizadoEm: '2026-10-04T00:00:00Z', recortes: [] }, []),
      CLOCK,
    )('presidente', 1);
    expect(r.semDados).toBe(true);
    expect(r.apuracaoEncerrada).toBe(false);
    expect(r.acerto).toBeNull();
    expect(r.comparacao).toEqual([]);
  });
});

describe('precedência: vence o recorte que cobre mais do país', () => {
  /*
   * O bug que isto tranca: a versão anterior preferia o agregado estadual
   * sempre que existisse QUALQUER UF, e comparava o nacional com a média
   * ponderada — que é ponderada só pelas UFs COM dado, e por isso dizia ~100%
   * com três estados. Ingerir um recorte estadual correto derrubava
   * `apuracaoEncerrada`, apagava o ranking de institutos e trocava uma contagem
   * nacional de 99,79% por uma soma de uma fração do eleitorado.
   */
  function comNacionalEEstadual(secoesNacional: number, ufs: readonly [string, number][]) {
    const base = apuracaoFinal(secoesNacional);
    return {
      atualizadoEm: base.atualizadoEm,
      recortes: [
        ...base.recortes,
        ...ufs.map(([uf, secoes]) => ({
          cargo: 'presidente' as const,
          uf,
          turno: 1 as const,
          secoesTotalizadas: secoes,
          validosTotal: 1_000_000,
          candidatos: [
            { candidato: 'Flávio Bolsonaro', partido: 'PL', votos: 520_000 },
            { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', votos: 480_000 },
          ],
          fonte: FONTE,
        })),
      ],
    };
  }

  function reposComUfs(apuracao: ReturnType<typeof comNacionalEEstadual>) {
    return {
      ...repos(apuracao as never, [
        pesquisa('X', '2026-10-02', [['Flávio Bolsonaro', 52], ['Luiz Inácio Lula da Silva', 48]]),
      ]),
      electorate: criarEleitoradoRepositoryJson([
        { uf: 'SP', eleitores: 34_000_000, referencia: '2026-07', fonte: FONTE },
        { uf: 'AC', eleitores: 600_000, referencia: '2026-07', fonte: FONTE },
      ] as never),
    };
  }

  it('UMA UF pequena a 100% NÃO toma o destaque de uma contagem nacional de 99,8%', () => {
    const r = criarGetProjecao(reposComUfs(comNacionalEEstadual(99.8, [['AC', 100]])), CLOCK)(
      'presidente',
      1,
    );
    // O Acre a 100% cobre ~1,7% do eleitorado: muito menos que 99,8% do país.
    expect(r.destaque).toBe('nacional');
    expect(r.apuracaoEncerrada).toBe(true);
    // E o ranking continua de pé, que era o que desaparecia.
    expect(r.acerto).not.toBeNull();
  });

  it('a cobertura estadual efetiva desconta o eleitorado que falta', () => {
    const r = criarGetProjecao(reposComUfs(comNacionalEEstadual(10, [['AC', 100]])), CLOCK)(
      'presidente',
      1,
    );
    // Ponderada sobre as UFs com dado seria 100; efetiva é ~1,7.
    expect(r.projecao.secoesTotalizadasPonderada).toBeCloseTo(100, 6);
    expect(r.projecao.coberturaNacionalEfetiva).toBeLessThan(2);
  });

  it('quando o estadual cobre mais, ELE comanda', () => {
    // SP e AC totalizados cobrem quase todo o eleitorado da fixture, contra um
    // nacional de só 20%.
    const r = criarGetProjecao(
      reposComUfs(comNacionalEEstadual(20, [['SP', 100], ['AC', 100]])),
      CLOCK,
    )('presidente', 1);
    expect(r.destaque).toBe('estadual');
    expect(r.projecao.coberturaNacionalEfetiva).toBeGreaterThan(99);
  });

  it('sem UF nenhuma, o destaque é nacional e apenasNacional é true', () => {
    const r = criarGetProjecao(repos(apuracaoFinal(99.8), []), CLOCK)('presidente', 1);
    expect(r.destaque).toBe('nacional');
    expect(r.apenasNacional).toBe(true);
  });

  it('apuracaoEncerrada usa a MAIOR das duas coberturas, nunca a menor', () => {
    const r = criarGetProjecao(reposComUfs(comNacionalEEstadual(99.8, [['AC', 50]])), CLOCK)(
      'presidente',
      1,
    );
    // O Acre a 50% cobre ~0,8%; a nacional a 99,8% é que decide.
    expect(r.apuracaoEncerrada).toBe(true);
  });
});

describe('25/10: a tela escolhe o turno pelo dado, não pelo código', () => {
  /**
   * A chamada da aba era `getProjecao('presidente', 1)` — o turno fixo no
   * código. Enquanto só havia 1º turno isso estava certo e era invisível. Com a
   * ficha do 2º turno no arquivo, a aba continuaria publicando o resultado de
   * 04/10 como se fosse o atual, e **sem dar erro nenhum** — por isso o caso
   * precisa de teste antes de 25/10, não depois.
   */
  const pesquisasT2 = [
    {
      ...pesquisa('Preciso', '2026-10-23', [
        ['Luiz Inácio Lula da Silva', 51],
        ['Flávio Bolsonaro', 49],
      ]),
      id: '2026-10-23-preciso-br-presidente-t2',
      turno: 2,
      cenario: 'estimulada, 2º turno: Lula x Flávio Bolsonaro',
    } as unknown as DadosPesquisa,
  ];

  /** Ficha do 2º turno onde Lula vira o líder — ordem oposta à do 1º turno. */
  const segundoTurno: DadosApuracao = {
    atualizadoEm: '2026-10-25T23:40:00Z',
    recortes: [
      ...apuracaoFinal(99.9).recortes,
      {
        cargo: 'presidente',
        uf: null,
        turno: 2,
        secoesTotalizadas: 99.9,
        validosTotal: 100_000_000,
        candidatos: [
          { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', votos: 51_000_000 },
          { candidato: 'Flávio Bolsonaro', partido: 'PL', votos: 49_000_000 },
        ],
        fonte: FONTE,
        observacao: '2º turno (fixture).',
      },
    ],
  };

  it('com só o 1º turno no arquivo, nada muda', () => {
    const r = criarGetProjecao(repos(apuracaoFinal(99.9), []), CLOCK)('presidente');
    expect(r.projecao.turno).toBe(1);
  });

  it('com o 2º turno no arquivo, é ele que vai ao ar', () => {
    const r = criarGetProjecao(repos(segundoTurno, pesquisasT2), CLOCK)('presidente');
    expect(r.projecao.turno).toBe(2);
    // E o líder é o do 2º turno, não o do 1º: é o erro que ninguém veria.
    expect(r.projecao.nacionalCru!.candidatos[0]!.candidato).toBe('Luiz Inácio Lula da Silva');
  });

  it('o ranking de institutos passa a medir o 2º turno, com as pesquisas do 2º turno', () => {
    const r = criarGetProjecao(repos(segundoTurno, pesquisasT2), CLOCK)('presidente');
    expect(r.apuracaoEncerrada).toBe(true);
    expect(r.acerto).not.toBeNull();
    expect(r.acerto!.primeiroESegundo).toEqual([
      'Luiz Inácio Lula da Silva',
      'Flávio Bolsonaro',
    ]);
    expect(r.acerto!.margemReal).toBeCloseTo(2, 6);
  });

  it('pedir um turno explicitamente continua valendo — é como se olha o 1º turno depois de 25/10', () => {
    const r = criarGetProjecao(repos(segundoTurno, pesquisasT2), CLOCK)('presidente', 1);
    expect(r.projecao.turno).toBe(1);
    expect(r.projecao.nacionalCru!.candidatos[0]!.candidato).toBe('Flávio Bolsonaro');
  });
});

describe('2º turno: confrontos hipotéticos não entram no agregado nem no ranking', () => {
  /**
   * Antes da definição dos finalistas os institutos testam vários confrontos de
   * 2º turno na MESMA disputa (`BR` + presidente + turno 2). A base tem 116
   * pesquisas nacionais de 2º turno e entre elas Lula x Augusto Cury, Lula x
   * Ronaldo Caiado, Lula x Romeu Zema e Lula x Renan Santos — eleições que não
   * aconteceram.
   *
   * Este caso de uso filtrava só por turno, e por isso somaria todas. Enquanto
   * a tela fixava turno 1 no código o defeito era inalcançável; passar a
   * escolher o turno pelo dado o tornaria ativo em 25/10. O recorte vem do
   * confronto da própria ficha de apuração — ver `domain/runoff.ts`.
   */
  const apuracaoT2: DadosApuracao = {
    atualizadoEm: '2026-10-25T23:40:00Z',
    recortes: [
      {
        cargo: 'presidente',
        uf: null,
        turno: 2,
        secoesTotalizadas: 99.9,
        validosTotal: 100_000_000,
        candidatos: [
          { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', votos: 51_000_000 },
          { candidato: 'Flávio Bolsonaro', partido: 'PL', votos: 49_000_000 },
        ],
        fonte: FONTE,
        observacao: '2º turno (fixture).',
      },
    ],
  };

  function t2(
    instituto: string,
    resultados: readonly [string, number][],
    id: string,
  ): DadosPesquisa {
    return {
      ...pesquisa(instituto, '2026-10-23', resultados),
      id,
      turno: 2,
      cenario: 'estimulada, 2º turno',
    } as unknown as DadosPesquisa;
  }

  const real = t2(
    'Confronto Real',
    [
      ['Luiz Inácio Lula da Silva', 51],
      ['Flávio Bolsonaro', 49],
    ],
    '2026-10-23-real-br-presidente-t2-lula-flavio',
  );
  // Confronto que nunca foi submetido a voto, na MESMA disputa, com números
  // muito distantes — se entrar, ele move o agregado e aparece no ranking.
  const hipotetico = t2(
    'Confronto Hipotetico',
    [
      ['Luiz Inácio Lula da Silva', 70],
      ['Augusto Cury', 30],
    ],
    '2026-10-23-hipotetico-br-presidente-t2-lula-cury',
  );

  it('o ranking só traz o instituto que mediu o confronto que aconteceu', () => {
    const r = criarGetProjecao(repos(apuracaoT2, [real, hipotetico]), CLOCK)('presidente');
    expect(r.acerto).not.toBeNull();
    expect(r.acerto!.institutos.map((i) => i.instituto)).toEqual(['Confronto Real']);
  });

  it('o agregado comparado não é contaminado pelo confronto hipotético', () => {
    const r = criarGetProjecao(repos(apuracaoT2, [real, hipotetico]), CLOCK)('presidente');
    const lula = r.comparacao.find((c) => c.candidato === 'Luiz Inácio Lula da Silva')!;
    // Só o confronto real: 51 em base de válidos, erro zero contra os 51% apurados.
    expect(lula.pctPesquisas).toBeCloseTo(51, 6);
    expect(lula.erro).toBeCloseTo(0, 6);
    // Augusto Cury não aparece: ele não estava na eleição de 2º turno.
    expect(r.comparacao.map((c) => c.candidato)).not.toContain('Augusto Cury');
  });

  it('sem nenhuma pesquisa do confronto real, não há ranking — e não há erro zero fingido', () => {
    const r = criarGetProjecao(repos(apuracaoT2, [hipotetico]), CLOCK)('presidente');
    expect(r.acerto!.institutos).toHaveLength(0);
    expect(r.comparacao.every((c) => c.erro === null)).toBe(true);
    expect(r.erroAbsolutoMedio).toBeNull();
  });

  it('no 1º turno nada é filtrado: não há confronto a recortar', () => {
    const muitos = [
      pesquisa('Preciso', '2026-10-02', [
        ['Flávio Bolsonaro', 52],
        ['Luiz Inácio Lula da Silva', 48],
      ]),
    ];
    const r = criarGetProjecao(repos(apuracaoFinal(99.9), muitos), CLOCK)('presidente', 1);
    expect(r.acerto!.institutos.map((i) => i.instituto)).toEqual(['Preciso']);
  });
});

describe('ingerir UF não pode mudar contra o que os institutos são medidos', () => {
  /**
   * Isto foi ao ar em 06/10 e é o defeito mais caro da rodada. `destaque` já
   * tinha sido consertado para escolher por cobertura (commit 0cf1d45), mas
   * `baseComparacao` — que alimenta a tabela de comparação E o ranking de
   * institutos — continuava preferindo a soma por estado sempre que existisse
   * qualquer UF. Com 10 das 27 UFs no arquivo, cobrindo 72,9% do eleitorado e
   * pesadas para Sul e Sudeste, a tela mostrava o nacional de 100% enquanto o
   * ranking media os institutos contra a soma dos 10 estados: margem de 5,89
   * pontos no lugar de 1,87.
   *
   * O teste trava a propriedade que importa: **acrescentar UF não muda o
   * resultado contra o qual os institutos são medidos**, enquanto o nacional
   * cobrir mais do país.
   */
  const pesquisas = [
    pesquisa('Preciso', '2026-10-02', [
      ['Flávio Bolsonaro', 52],
      ['Luiz Inácio Lula da Silva', 48],
    ]),
  ];

  /** UF onde a ordem é oposta à nacional e a margem é enorme. */
  function comUf(): DadosApuracao {
    const base = apuracaoFinal(100);
    return {
      ...base,
      recortes: [
        ...base.recortes,
        {
          cargo: 'presidente',
          uf: 'SP',
          turno: 1,
          secoesTotalizadas: 100,
          validosTotal: 20_000_000,
          candidatos: [
            { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', votos: 14_000_000 },
            { candidato: 'Flávio Bolsonaro', partido: 'PL', votos: 6_000_000 },
          ],
          fonte: FONTE,
          observacao: 'UF (fixture).',
        },
      ],
    };
  }

  it('o nacional segue comandando a comparação, e a margem não se move', () => {
    const semUf = criarGetProjecao(repos(apuracaoFinal(100), pesquisas), CLOCK)('presidente');
    const comUma = criarGetProjecao(repos(comUf(), pesquisas), CLOCK)('presidente');

    expect(semUf.destaque).toBe('nacional');
    expect(comUma.destaque).toBe('nacional');
    // 52 x 48 no nacional: 4 pontos. A UF diria 40 pontos ao contrário.
    expect(semUf.acerto!.margemReal).toBeCloseTo(4, 6);
    expect(comUma.acerto!.margemReal).toBeCloseTo(4, 6);
    expect(comUma.acerto!.primeiroESegundo).toEqual([
      'Flávio Bolsonaro',
      'Luiz Inácio Lula da Silva',
    ]);
  });

  it('a tabela de comparação também fica no nacional, não na soma de uma UF', () => {
    const r = criarGetProjecao(repos(comUf(), pesquisas), CLOCK)('presidente');
    const flavio = r.comparacao.find((c) => c.candidato === 'Flávio Bolsonaro')!;
    expect(flavio.pctProjetado).toBeCloseTo(52, 6);
  });

  it('o ranking inteiro é idêntico com e sem a UF', () => {
    const semUf = criarGetProjecao(repos(apuracaoFinal(100), pesquisas), CLOCK)('presidente');
    const comUma = criarGetProjecao(repos(comUf(), pesquisas), CLOCK)('presidente');
    expect(comUma.acerto!.institutos.map((i) => [i.instituto, i.erroMedioAbsoluto])).toEqual(
      semUf.acerto!.institutos.map((i) => [i.instituto, i.erroMedioAbsoluto]),
    );
  });

  it('quando o estadual cobre MAIS que o nacional, é ele que comanda', () => {
    // A outra ponta: a precedência é por cobertura, não uma preferência fixa
    // pelo nacional. Com o nacional em 20% das seções e a UF em 100%, o
    // estadual vence — e aí a comparação tem de segui-lo.
    const base = apuracaoFinal(20);
    const dados: DadosApuracao = {
      ...base,
      recortes: [
        ...base.recortes,
        {
          cargo: 'presidente',
          uf: 'SP',
          turno: 1,
          secoesTotalizadas: 100,
          validosTotal: 20_000_000,
          candidatos: [
            { candidato: 'Luiz Inácio Lula da Silva', partido: 'PT', votos: 14_000_000 },
            { candidato: 'Flávio Bolsonaro', partido: 'PL', votos: 6_000_000 },
          ],
          fonte: FONTE,
          observacao: 'UF (fixture).',
        },
      ],
    };
    const r = criarGetProjecao(repos(dados, pesquisas), CLOCK)('presidente');
    expect(r.destaque).toBe('estadual');
    expect(r.comparacao[0]!.candidato).toBe('Luiz Inácio Lula da Silva');
  });
});
