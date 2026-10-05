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
