import { analiseRepoFake } from './_resultado-fake.js';
import { describe, expect, it } from 'vitest';
import { criarPartido } from '../../../domain/party.js';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../../../domain/poll.js';
import { disputaId, type Disputa } from '../../../domain/race.js';
import type { DadosResultado } from '../../../domain/resultado.js';
import { criarApuracaoRepositoryJson } from '../../../adapters/outbound/json/apuracao-repository.js';
import type { Clock, Repositorios } from '../../ports.js';
import { criarGetMapaGovernadores } from '../get-map-governadores.js';

const CLOCK: Clock = { hoje: () => new Date('2026-10-19T00:00:00Z') };

const PARTIDOS = [
  criarPartido({ sigla: 'PT', nome: 'Partido dos Trabalhadores', numero: 13, espectro: 'esquerda' }),
  criarPartido({ sigla: 'PL', nome: 'Partido Liberal', numero: 22, espectro: 'direita' }),
  criarPartido({ sigla: 'PP', nome: 'Progressistas', numero: 11, espectro: 'centro-direita' }),
];

function pesquisa(
  dados: Partial<DadosPesquisa> & Pick<DadosPesquisa, 'id' | 'uf' | 'turno' | 'resultados'>,
): Pesquisa {
  return criarPesquisa({
    cargo: 'governador',
    instituto: 'Instituto Teste',
    registroTSE: 'XX-0001/2026',
    amostra: 1000,
    margem: 3,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    ...dados,
  });
}

function repos(pesquisas: Pesquisa[], resultado: DadosResultado): Repositorios {
  return {
    polls: {
      todas: () => pesquisas,
      porDisputa: (d: Disputa) => pesquisas.filter((p) => disputaId(p.disputa) === disputaId(d)),
    },
    parties: {
      todos: () => PARTIDOS,
      porSigla: (sigla: string) => PARTIDOS.find((p) => p.sigla === sigla),
    },
    senateSeats: { todas: () => [] },
    meta: { atualizadoEm: () => '2026-10-19' },
    electorate: { todos: () => [], porUf: () => undefined },
    apuracao: criarApuracaoRepositoryJson({ atualizadoEm: '2026-01-01T00:00:00Z', recortes: [] }),
    resultado: { dados: () => resultado },
    analise: analiseRepoFake,
  };
}

function resultadoCom(governadores: DadosResultado['governadores']): DadosResultado {
  return {
    eleicao: 2026,
    turno1: '2026-10-04',
    turno2: '2026-10-25',
    governadores,
    camara: { totalCadeiras: 0, bancadas: [] },
  };
}

describe('getMapaGovernadores', () => {
  it('pinta o RESULTADO onde a eleição foi decidida, ignorando as pesquisas para a cor', () => {
    const casos = criarGetMapaGovernadores(
      repos(
        [
          // A pesquisa dava o candidato do PT; as urnas elegeram o do PL. A cor
          // tem de seguir as urnas.
          pesquisa({
            id: 'p1',
            uf: 'SP',
            turno: 1,
            dataInicio: '2026-10-01',
            dataFim: '2026-10-03',
            resultados: [
              { candidato: 'Candidata PT', partido: 'PT', pct: 45 },
              { candidato: 'Candidato PL', partido: 'PL', pct: 40 },
              { candidato: 'Brancos/nulos', partido: null, pct: 15 },
            ],
          }),
        ],
        resultadoCom([
          {
            uf: 'SP',
            situacao: 'eleito',
            eleito: { nome: 'Candidato PL', partido: 'PL', pctValidos: 55 },
            finalistas: [],
          },
        ]),
      ),
      CLOCK,
    )();

    const sp = casos.find((x) => x.uf === 'SP')!;
    expect(sp.situacao).toBe('decidido');
    expect(sp.espectro).toBe('direita');
    expect(sp.eleito?.nome).toBe('Candidato PL');
    expect(sp.disputa).toBeNull();
    expect(sp.comparacao?.acertouOLider).toBe(false);
    expect(sp.comparacao?.liderNasPesquisas).toBe('Candidata PT');
  });

  it('converte o percentual da pesquisa para válidos antes de comparar com a urna', () => {
    const casos = criarGetMapaGovernadores(
      repos(
        [
          pesquisa({
            id: 'p1',
            uf: 'SP',
            turno: 1,
            dataInicio: '2026-10-01',
            dataFim: '2026-10-03',
            resultados: [
              { candidato: 'Eleita', partido: 'PT', pct: 45 },
              { candidato: 'Perdedor', partido: 'PL', pct: 45 },
              // 10 pontos de não-candidato: em válidos a eleita vale 50, não 45.
              { candidato: 'Brancos/nulos', partido: null, pct: 10 },
            ],
          }),
        ],
        resultadoCom([
          {
            uf: 'SP',
            situacao: 'eleito',
            eleito: { nome: 'Eleita', partido: 'PT', pctValidos: 52 },
            finalistas: [],
          },
        ]),
      ),
      CLOCK,
    )();

    const c = casos.find((x) => x.uf === 'SP')!.comparacao!;
    expect(c.pctEleitoNasPesquisasValidos).toBeCloseTo(50, 10);
    expect(c.pctValidosUrnas).toBe(52);
    // Erro medido na MESMA base: 52 - 50 = 2, e não 52 - 45 = 7.
    expect(c.erroEmPontos).toBeCloseTo(2, 10);
  });

  it('casa o eleito com a pesquisa mesmo quando as fontes o nomeiam diferente', () => {
    const casos = criarGetMapaGovernadores(
      repos(
        [
          pesquisa({
            id: 'p1',
            uf: 'AL',
            turno: 1,
            dataInicio: '2026-09-26',
            dataFim: '2026-09-29',
            resultados: [
              { candidato: 'João Henrique Caldas (JHC)', partido: 'PP', pct: 52 },
              { candidato: 'Outro', partido: 'PT', pct: 38 },
              { candidato: 'Brancos/nulos', partido: null, pct: 10 },
            ],
          }),
        ],
        resultadoCom([
          {
            uf: 'AL',
            situacao: 'eleito',
            eleito: { nome: 'JHC', partido: 'PP', pctValidos: 52.09 },
            finalistas: [],
          },
        ]),
      ),
      CLOCK,
    )();

    const c = casos.find((x) => x.uf === 'AL')!.comparacao!;
    expect(c.acertouOLider).toBe(true);
    expect(c.pctEleitoNasPesquisasValidos).not.toBeNull();
  });

  it('pinta a PESQUISA do 2º turno onde a disputa continua', () => {
    const casos = criarGetMapaGovernadores(
      repos(
        [
          pesquisa({
            id: 'p1',
            uf: 'DF',
            turno: 2,
            dataInicio: '2026-10-08',
            dataFim: '2026-10-11',
            resultados: [
              { candidato: 'Líder PP', partido: 'PP', pct: 53 },
              { candidato: 'Segunda PT', partido: 'PT', pct: 33 },
              { candidato: 'Brancos/nulos', partido: null, pct: 14 },
            ],
          }),
        ],
        resultadoCom([
          {
            uf: 'DF',
            situacao: 'segundo-turno',
            eleito: null,
            finalistas: [
              { nome: 'Líder PP', partido: 'PP', pctValidos: 49.93 },
              { nome: 'Segunda PT', partido: 'PT', pctValidos: 34.47 },
            ],
          },
        ]),
      ),
      CLOCK,
    )();

    const df = casos.find((x) => x.uf === 'DF')!;
    expect(df.situacao).toBe('em-disputa');
    expect(df.espectro).toBe('centro-direita');
    expect(df.disputa?.lider).toBe('Líder PP');
    expect(df.disputa?.segundo).toBe('Segunda PT');
    expect(df.eleito).toBeNull();
    // Onde não houve resultado não há o que comparar.
    expect(df.comparacao).toBeNull();
  });

  /**
   * A regra que mais muda o mapa: a base guarda simulações de 2º turno feitas
   * ANTES da eleição, com pares que as urnas não confirmaram. Elas estão
   * marcadas como turno 2 e passariam pelo filtro ingênuo.
   */
  it('descarta simulação de 2º turno anterior à eleição e confronto que as urnas não confirmaram', () => {
    const finalistas = [
      { nome: 'Finalista A', partido: 'PP', pctValidos: 40 },
      { nome: 'Finalista B', partido: 'PT', pctValidos: 30 },
    ];
    const casos = criarGetMapaGovernadores(
      repos(
        [
          // Campo ANTES de 4/10, ainda que teste o par certo.
          pesquisa({
            id: 'antes',
            uf: 'TO',
            turno: 2,
            dataInicio: '2026-09-20',
            dataFim: '2026-10-01',
            resultados: [
              { candidato: 'Finalista A', partido: 'PP', pct: 50 },
              { candidato: 'Finalista B', partido: 'PT', pct: 40 },
              { candidato: 'Brancos/nulos', partido: null, pct: 10 },
            ],
          }),
          // Campo depois, mas de um confronto que não aconteceu.
          pesquisa({
            id: 'outro-par',
            uf: 'TO',
            turno: 2,
            dataInicio: '2026-10-10',
            dataFim: '2026-10-13',
            resultados: [
              { candidato: 'Finalista A', partido: 'PP', pct: 48 },
              { candidato: 'Quem não passou', partido: 'PL', pct: 42 },
              { candidato: 'Brancos/nulos', partido: null, pct: 10 },
            ],
          }),
        ],
        resultadoCom([{ uf: 'TO', situacao: 'segundo-turno', eleito: null, finalistas }]),
      ),
      CLOCK,
    )();

    const to = casos.find((x) => x.uf === 'TO')!;
    expect(to.situacao).toBe('sem-dados');
    expect(to.disputa).toBeNull();
    expect(to.espectro).toBe('indefinido');
  });

  it('entrega as 27 UFs mesmo sem resultado nem pesquisa', () => {
    const casos = criarGetMapaGovernadores(repos([], resultadoCom([])), CLOCK)();
    expect(casos).toHaveLength(27);
    expect(casos.every((x) => x.situacao === 'sem-dados')).toBe(true);
  });

  it('leva a ressalva da UF adiante — sub judice e retotalização não podem sumir', () => {
    const casos = criarGetMapaGovernadores(
      repos(
        [],
        resultadoCom([
          {
            uf: 'AP',
            situacao: 'eleito',
            eleito: { nome: 'Eleito AP', partido: 'PL', pctValidos: 62.7 },
            finalistas: [],
            observacao: 'Registro sub judice.',
          },
        ]),
      ),
      CLOCK,
    )();
    expect(casos.find((x) => x.uf === 'AP')!.observacao).toBe('Registro sub judice.');
  });

  it('sem pesquisa anterior à eleição, a UF decidida fica sem comparação em vez de inventar uma', () => {
    const casos = criarGetMapaGovernadores(
      repos(
        [],
        resultadoCom([
          {
            uf: 'RR',
            situacao: 'eleito',
            eleito: { nome: 'Eleito RR', partido: 'PL', pctValidos: 69.13 },
            finalistas: [],
          },
        ]),
      ),
      CLOCK,
    )();
    const rr = casos.find((x) => x.uf === 'RR')!;
    expect(rr.situacao).toBe('decidido');
    expect(rr.comparacao).toBeNull();
  });
});
