import { describe, expect, it } from 'vitest';
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
import { criarGetSenateByState } from '../get-senate-by-state.js';

/**
 * Reproduz o bug P0 de docs/revisao-senado.md: `assentosProjetados` (vindo
 * de `projecao.assentos`, ordenado GLOBALMENTE por espectro) era zipado por
 * índice com `agregado.candidatos` (ordenado por pct desc). Sempre que o 1º
 * e o 2º colocados das pesquisas de senador têm espectros diferentes, os
 * dois arrays ficam em ordens diferentes e o percentual (e o selo de
 * empate) migra para o candidato errado.
 */

function pollRepoFake(pesquisas: Pesquisa[]): PollRepository {
  return {
    todas: () => pesquisas,
    porDisputa: (disputa: Disputa) => pesquisas.filter((p) => disputaId(p.disputa) === disputaId(disputa)),
  };
}

function partyRepoFake(partidos: Partido[]): PartyRepository {
  return { todos: () => partidos, porSigla: (sigla: string) => partidos.find((p) => p.sigla === sigla) };
}

function senateSeatRepoFake(cadeiras: CadeiraSenado[]): SenateSeatRepository {
  return { todas: () => cadeiras };
}

const metaRepoFake: MetaRepository = { atualizadoEm: () => '2026-09-15' };
const electorateRepoFake: EleitoradoRepository = { todos: () => [], porUf: () => undefined };

const CLOCK: Clock = { hoje: () => new Date('2026-09-15T00:00:00Z') };

function p(dados: Partial<DadosPesquisa> & Pick<DadosPesquisa, 'id' | 'uf' | 'cargo' | 'turno' | 'resultados'>): Pesquisa {
  return criarPesquisa({
    instituto: 'Real Time Big Data',
    registroTSE: 'RS-05497/2026',
    dataInicio: '2026-09-05',
    dataFim: '2026-09-09',
    publicadoEm: '2026-09-10',
    amostra: 1600,
    margem: 2,
    fonte: { nome: 'Exame', url: 'https://exemplo.test/rs-senado' },
    ...dados,
  });
}

// Espectros deliberadamente diferentes entre o 1º e o 2º colocado — é essa
// diferença de espectro que dispara o `sort` por espectro em
// `projetarSenado` e destrava o bug do zip por índice.
const PARTIDOS: Partido[] = [
  criarPartido({ sigla: 'Novo', nome: 'Partido Novo', numero: 30, espectro: 'direita' }),
  criarPartido({ sigla: 'PSOL', nome: 'Partido Socialismo e Liberdade', numero: 50, espectro: 'esquerda' }),
];

function montarRepos(): Repositorios {
  const cadeiras: CadeiraSenado[] = [
    criarCadeiraSenado({
      uf: 'RS',
      senador: 'Hamilton Mourão',
      partido: 'Novo',
      mandatoInicio: 2023,
      mandatoFim: 2031,
      emDisputa2026: false,
      fonte: 'https://exemplo.test/fixo-rs',
    }),
    criarCadeiraSenado({
      uf: 'RS',
      senador: 'Paulo Paim',
      partido: 'PSOL',
      mandatoInicio: 2019,
      mandatoFim: 2027,
      emDisputa2026: true,
      fonte: 'https://exemplo.test/disputa1-rs',
    }),
    criarCadeiraSenado({
      uf: 'RS',
      senador: 'Luis Carlos Heinze',
      partido: 'Novo',
      mandatoInicio: 2019,
      mandatoFim: 2027,
      emDisputa2026: true,
      fonte: 'https://exemplo.test/disputa2-rs',
    }),
  ];

  // Dado real reportado em docs/revisao-senado.md: Van Hattem (Novo,
  // direita) 22% na frente de Manuela D'Ávila (PSOL, esquerda) 18% — que
  // por sua vez empata tecnicamente com Sanderson (18%) pela 2ª vaga.
  const pesquisas: Pesquisa[] = [
    p({
      id: '2026-09-10-real-time-big-data-rs-senador-t1',
      uf: 'RS',
      cargo: 'senador',
      turno: 1,
      cenario: 'estimulada, consolidado 1º e 2º voto (2 vagas em disputa)',
      resultados: [
        { candidato: 'Marcel Van Hattem', partido: 'Novo', pct: 22 },
        { candidato: "Manuela D'Ávila", partido: 'PSOL', pct: 18 },
        { candidato: 'Sanderson', partido: 'PL', pct: 18 },
        { candidato: 'Paulo Pimenta', partido: 'PT', pct: 16 },
      ],
    }),
  ];

  return {
    polls: pollRepoFake(pesquisas),
    parties: partyRepoFake(PARTIDOS),
    senateSeats: senateSeatRepoFake(cadeiras),
    meta: metaRepoFake,
    electorate: electorateRepoFake,
  };
}

describe('use-cases/getSenateByState — pareamento candidato x percentual (bug P0)', () => {
  it('mantém o percentual correto atrelado a cada candidato mesmo quando os espectros do 1º e 2º colocados diferem (caso RS)', () => {
    const getSenateByState = criarGetSenateByState(montarRepos(), CLOCK);
    const rs = getSenateByState().find((r) => r.uf === 'RS')!;

    expect(rs.projetadas).toHaveLength(2);

    const vanHattem = rs.projetadas.find((c) => c.candidato === 'Marcel Van Hattem');
    const manuela = rs.projetadas.find((c) => c.candidato === "Manuela D'Ávila");

    expect(vanHattem).toBeDefined();
    expect(manuela).toBeDefined();

    // Van Hattem lidera com 22%, não 18% — o dado bruto (data/polls.json)
    // nunca deve migrar para o outro candidato só porque os assentos são
    // reordenados por espectro para o desenho do hemiciclo.
    expect(vanHattem!.partido).toBe('Novo');
    expect(vanHattem!.pct).toBeCloseTo(22, 6);

    expect(manuela!.partido).toBe('PSOL');
    expect(manuela!.pct).toBeCloseTo(18, 6);

    // O selo de empate técnico (Manuela x Sanderson pela 2ª vaga) tem que
    // ficar preso ao nome certo, não migrar para Van Hattem.
    expect(manuela!.confianca).toBe('empate');
    expect(vanHattem!.confianca).not.toBe('empate');
  });

  it('não inverte a ordem visual: o painel/tabela pode listar em qualquer ordem, mas cada nome carrega o próprio pct', () => {
    const getSenateByState = criarGetSenateByState(montarRepos(), CLOCK);
    const rs = getSenateByState().find((r) => r.uf === 'RS')!;

    // Independentemente da posição no array (que segue a ordem de desenho
    // do hemiciclo, por espectro), cada entrada tem que ser internamente
    // consistente: o candidato de maior pct é sempre Van Hattem.
    const lider = [...rs.projetadas].sort((a, b) => b.pct - a.pct)[0]!;
    expect(lider.candidato).toBe('Marcel Van Hattem');
    expect(lider.pct).toBeCloseTo(22, 6);
  });
});
