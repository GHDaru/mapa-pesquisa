import { beforeAll, describe, expect, it } from 'vitest';
import { criarEleitorado, type Eleitorado } from '../../../domain/electorate.js';
import { criarPartido, type Partido } from '../../../domain/party.js';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../../../domain/poll.js';
import { disputaId, type Disputa } from '../../../domain/race.js';
import { CONFRONTO_LULA_FLAVIO, FLAVIO_BOLSONARO, LULA } from '../../../domain/runoff.js';
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
import { usouPesquisaForaDaJanela } from '../get-presidential-by-state.js';

/**
 * 2º turno presidencial por estado, confronto Lula x Flávio Bolsonaro.
 *
 * O recorte é por CONFRONTO, não só por turno: na mesma disputa (`uf` +
 * `presidente` + `turno` 2) convivem cenários hipotéticos contra outros
 * candidatos (Cury no nacional, Caiado em GO nesta fixture, como nos dados
 * reais), que não podem entrar no mesmo agregado. A fixture reproduz também os
 * dois casos de borda dos dados reais: RO, cuja única pesquisa do confronto é
 * de julho (fora da janela de 45 dias), e uma UF sem nenhuma pesquisa estadual
 * do confronto (MG aqui), que cai no substituto nacional.
 */

function pollRepoFake(pesquisas: Pesquisa[]): PollRepository {
  return {
    todas: () => pesquisas,
    porDisputa: (disputa: Disputa) =>
      pesquisas.filter((p) => disputaId(p.disputa) === disputaId(disputa)),
  };
}

function partyRepoFake(partidos: Partido[]): PartyRepository {
  return { todos: () => partidos, porSigla: (sigla: string) => partidos.find((p) => p.sigla === sigla) };
}

const senateSeatRepoFake: SenateSeatRepository = { todas: () => [] };
const metaRepoFake: MetaRepository = { atualizadoEm: () => '2026-09-15' };

function electorateRepoFake(eleitorado: Eleitorado[]): EleitoradoRepository {
  return { todos: () => eleitorado, porUf: (uf: string) => eleitorado.find((e) => e.uf === uf) };
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
    dataInicio: '2026-09-05',
    dataFim: '2026-09-09',
    publicadoEm: '2026-09-10',
    amostra: 1000,
    margem: 2,
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.test' },
    ...dados,
  });
}

function eleitores(uf: string, quantidade: number): Eleitorado {
  return criarEleitorado({
    uf,
    eleitores: quantidade,
    referencia: '2026-07',
    fonte: { nome: 'TSE', url: 'https://exemplo.test' },
  });
}

// Eleitorado da fixture (só 4 UFs cadastradas).
const ELEITORES_SP = 34_000_000;
const ELEITORES_GO = 4_500_000;
const ELEITORES_RO = 1_200_000;
const ELEITORES_MG = 16_000_000;

let casos: CasosDeUso;

beforeAll(() => {
  const pesquisas: Pesquisa[] = [
    // --- Nacional, 1º turno (para os testes de compatibilidade) ---
    p({
      id: 'br-t1',
      uf: 'BR',
      cargo: 'presidente',
      turno: 1,
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 40 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 32 },
        { candidato: 'Augusto Cury', partido: 'PODE', pct: 9 },
        { candidato: 'Brancos/nulos', partido: null, pct: 19 },
      ],
    }),
    // --- Nacional, 2º turno: duas do confronto (pct iguais, para a média
    // ponderada ser exatamente 46/45 independentemente dos pesos) ---
    p({
      id: 'br-t2-lula-flavio-1',
      uf: 'BR',
      cargo: 'presidente',
      turno: 2,
      dataInicio: '2026-08-28',
      dataFim: '2026-08-30',
      publicadoEm: '2026-08-31',
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 46 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 45 },
        { candidato: 'Brancos/nulos', partido: null, pct: 9 },
      ],
    }),
    p({
      id: 'br-t2-lula-flavio-2',
      uf: 'BR',
      cargo: 'presidente',
      turno: 2,
      dataInicio: '2026-09-06',
      dataFim: '2026-09-08',
      publicadoEm: '2026-09-09',
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 46 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 45 },
        { candidato: 'Brancos/nulos', partido: null, pct: 9 },
      ],
    }),
    // Cenário hipotético contra outro candidato, e o MAIS RECENTE do 2º turno
    // nacional — tem de ficar fora do recorte Lula x Flávio.
    p({
      id: 'br-t2-lula-cury',
      uf: 'BR',
      cargo: 'presidente',
      turno: 2,
      dataInicio: '2026-09-10',
      dataFim: '2026-09-12',
      publicadoEm: '2026-09-13',
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 52 },
        { candidato: 'Augusto Cury', partido: 'PODE', pct: 33 },
        { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 15 },
      ],
    }),
    // --- SP: 1º e 2º turno estaduais ---
    p({
      id: 'sp-t1',
      uf: 'SP',
      cargo: 'presidente',
      turno: 1,
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 38 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 36 },
      ],
    }),
    p({
      id: 'sp-t2',
      uf: 'SP',
      cargo: 'presidente',
      turno: 2,
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 47 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 48 },
        { candidato: 'Brancos/nulos', partido: null, pct: 5 },
      ],
    }),
    // --- GO: uma do confronto e uma contra Caiado (mais recente) ---
    p({
      id: 'go-t2-lula-flavio',
      uf: 'GO',
      cargo: 'presidente',
      turno: 2,
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 33 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 57 },
        { candidato: 'Brancos/nulos/não sabe', partido: null, pct: 10 },
      ],
    }),
    p({
      id: 'go-t2-lula-caiado',
      uf: 'GO',
      cargo: 'presidente',
      turno: 2,
      dataInicio: '2026-09-11',
      dataFim: '2026-09-13',
      publicadoEm: '2026-09-14',
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 25 },
        { candidato: 'Ronaldo Caiado', partido: 'União', pct: 68 },
      ],
    }),
    // --- RO: única pesquisa do confronto é de julho, fora da janela de 45 dias ---
    p({
      id: 'ro-t2-julho',
      uf: 'RO',
      cargo: 'presidente',
      turno: 2,
      dataInicio: '2026-07-14',
      dataFim: '2026-07-15',
      publicadoEm: '2026-07-16',
      resultados: [
        { candidato: LULA, partido: 'PT', pct: 24 },
        { candidato: FLAVIO_BOLSONARO, partido: 'PL', pct: 66 },
      ],
    }),
    // --- MG: tem eleitorado cadastrado, mas nenhuma pesquisa estadual de 2º turno ---
  ];

  const repos: Repositorios = {
    polls: pollRepoFake(pesquisas),
    parties: partyRepoFake(PARTIDOS),
    senateSeats: senateSeatRepoFake,
    meta: metaRepoFake,
    electorate: electorateRepoFake([
      eleitores('SP', ELEITORES_SP),
      eleitores('GO', ELEITORES_GO),
      eleitores('RO', ELEITORES_RO),
      eleitores('MG', ELEITORES_MG),
    ]),
  };

  casos = criarCasosDeUso(repos, CLOCK);
});

describe('getPresidentialByState — 2º turno Lula x Flávio', () => {
  it('mantém as 27 UFs e identifica o turno e o confronto do recorte', () => {
    const dados = casos.getPresidentialByState(2);
    expect(dados.ufs).toHaveLength(27);
    expect(dados.turno).toBe(2);
    expect(dados.confronto).toEqual(CONFRONTO_LULA_FLAVIO);
  });

  it('agrega a pesquisa estadual do confronto com líder, vantagem e empate técnico', () => {
    const sp = casos.getPresidentialByState(2).ufs.find((u) => u.uf === 'SP')!;
    expect(sp.semDados).toBe(false);
    expect(sp.lider).toBe(FLAVIO_BOLSONARO);
    expect(sp.partido).toBe('PL');
    expect(sp.agregado!.candidatos.map((c) => c.candidato)).toEqual([FLAVIO_BOLSONARO, LULA]);
    expect(sp.agregado!.lider!.pct).toBeCloseTo(48, 6);
    expect(sp.vantagem).toBeCloseTo(1, 6);
    // Vantagem de 1 ponto com margem de 2: empate técnico.
    expect(sp.empateTecnico).toBe(true);
    expect(sp.ultimaPesquisa?.id).toBe('sp-t2');
    expect(sp.eleitores).toBe(ELEITORES_SP);
  });

  it('tem série temporal própria do confronto na UF', () => {
    const sp = casos.getPresidentialByState(2).ufs.find((u) => u.uf === 'SP')!;
    expect(sp.serie).not.toBeNull();
    expect(sp.serie!.candidatos).toEqual([FLAVIO_BOLSONARO, LULA]);
    const ultimoDia = sp.serie!.dias.at(-1)!;
    expect(ultimoDia.data).toBe('2026-09-15');
    expect(ultimoDia.valores[FLAVIO_BOLSONARO]).toBeCloseTo(48, 6);
  });

  it('descarta o cenário de 2º turno contra outro candidato na mesma UF (Caiado em GO)', () => {
    const go = casos.getPresidentialByState(2).ufs.find((u) => u.uf === 'GO')!;
    expect(go.agregado!.pesquisasUsadas.map((x) => x.id)).toEqual(['go-t2-lula-flavio']);
    expect(go.agregado!.candidatos.map((c) => c.candidato)).toEqual([FLAVIO_BOLSONARO, LULA]);
    expect(go.agregado!.candidatos.map((c) => c.candidato)).not.toContain('Ronaldo Caiado');
    expect(go.lider).toBe(FLAVIO_BOLSONARO);
    expect(go.vantagem).toBeCloseTo(24, 6);
    expect(go.empateTecnico).toBe(false);
  });

  it('UF só com pesquisa de julho usa a mais recente e fica marcada como fora da janela', () => {
    const dados = casos.getPresidentialByState(2);
    const ro = dados.ufs.find((u) => u.uf === 'RO')!;
    expect(ro.semDados).toBe(false);
    expect(ro.agregado!.foraDaJanela).toBe(true);
    expect(usouPesquisaForaDaJanela(ro)).toBe(true);
    expect(ro.ultimaPesquisa?.id).toBe('ro-t2-julho');
    expect(ro.lider).toBe(FLAVIO_BOLSONARO);
    expect(dados.ufsForaDaJanela).toEqual(['RO']);
  });

  it('UFs dentro da janela não são marcadas como fora da janela', () => {
    const dados = casos.getPresidentialByState(2);
    for (const uf of ['SP', 'GO']) {
      expect(usouPesquisaForaDaJanela(dados.ufs.find((u) => u.uf === uf)!)).toBe(false);
    }
  });

  it('UF sem pesquisa do confronto fica semDados, mas mantém o eleitorado', () => {
    const mg = casos.getPresidentialByState(2).ufs.find((u) => u.uf === 'MG')!;
    expect(mg.semDados).toBe(true);
    expect(mg.agregado).toBeNull();
    expect(mg.serie).toBeNull();
    expect(mg.vantagem).toBe(0);
    expect(mg.empateTecnico).toBe(false);
    expect(mg.eleitores).toBe(ELEITORES_MG);
  });

  it('eleitoradoComPesquisa soma apenas as UFs com pesquisa do confronto', () => {
    const dados = casos.getPresidentialByState(2);
    expect(dados.eleitoradoComPesquisa).toBe(ELEITORES_SP + ELEITORES_GO + ELEITORES_RO);
    expect(dados.eleitoradoNacional).toBe(ELEITORES_SP + ELEITORES_GO + ELEITORES_RO + ELEITORES_MG);
  });

  it('a assinatura sem argumento continua sendo o 1º turno (compatibilidade da UI)', () => {
    const semArgumento = casos.getPresidentialByState();
    expect(semArgumento.turno).toBe(1);
    expect(semArgumento.confronto).toBeNull();
    expect(semArgumento.ufsForaDaJanela).toEqual([]);

    const sp = semArgumento.ufs.find((u) => u.uf === 'SP')!;
    expect(sp.ultimaPesquisa?.id).toBe('sp-t1');
    expect(sp.agregado!.lider!.pct).toBeCloseTo(38, 6);
    expect(sp.lider).toBe(LULA);

    // Nenhuma pesquisa de 2º turno vaza para o 1º turno.
    const go = semArgumento.ufs.find((u) => u.uf === 'GO')!;
    expect(go.semDados).toBe(true);
  });

  it('aceita um confronto alternativo explícito', () => {
    const dados = casos.getPresidentialByState(2, { confronto: [LULA, 'Ronaldo Caiado'] });
    const go = dados.ufs.find((u) => u.uf === 'GO')!;
    expect(go.agregado!.pesquisasUsadas.map((x) => x.id)).toEqual(['go-t2-lula-caiado']);
    expect(go.lider).toBe('Ronaldo Caiado');
    const sp = dados.ufs.find((u) => u.uf === 'SP')!;
    expect(sp.semDados).toBe(true);
  });
});

describe('getVoteEstimate — 2º turno Lula x Flávio', () => {
  it('estima votos por UF com percentual estadual × eleitorado', () => {
    const estimativa = casos.getVoteEstimate(2)!;
    expect(estimativa).not.toBeNull();

    const sp = estimativa.porUf.find((u) => u.uf === 'SP')!;
    expect(sp.origem).toBe('estadual');
    expect(sp.votosPorCandidato[LULA]!.votos).toBeCloseTo(ELEITORES_SP * 0.47, 3);
    expect(sp.votosPorCandidato[FLAVIO_BOLSONARO]!.votos).toBeCloseTo(ELEITORES_SP * 0.48, 3);
    expect(sp.votosPorCandidato[LULA]!.origem).toBe('estadual');
  });

  it('usa o agregado nacional do MESMO confronto como fallback na UF sem pesquisa estadual', () => {
    const estimativa = casos.getVoteEstimate(2)!;
    expect(estimativa.ufsSemPesquisa).toEqual(['MG']);

    const mg = estimativa.porUf.find((u) => u.uf === 'MG')!;
    expect(mg.origem).toBe('nacional');
    // 46/45 do confronto Lula x Flávio — não os 52% do cenário contra Cury.
    expect(mg.votosPorCandidato[LULA]!.votos).toBeCloseTo(ELEITORES_MG * 0.46, 3);
    expect(mg.votosPorCandidato[FLAVIO_BOLSONARO]!.votos).toBeCloseTo(ELEITORES_MG * 0.45, 3);
    expect(Object.keys(mg.votosPorCandidato).sort()).toEqual([FLAVIO_BOLSONARO, LULA].sort());
  });

  it('nenhum candidato de outro cenário de 2º turno entra na estimativa', () => {
    const estimativa = casos.getVoteEstimate(2)!;
    expect(estimativa.candidatos.map((c) => c.candidato).sort()).toEqual(
      [FLAVIO_BOLSONARO, LULA].sort(),
    );
    for (const uf of estimativa.porUf) {
      expect(Object.keys(uf.votosPorCandidato)).not.toContain('Augusto Cury');
      expect(Object.keys(uf.votosPorCandidato)).not.toContain('Ronaldo Caiado');
    }
  });

  it('soma os votos das 4 UFs com eleitorado cadastrado', () => {
    const estimativa = casos.getVoteEstimate(2)!;
    const lulaEsperado =
      ELEITORES_SP * 0.47 + ELEITORES_GO * 0.33 + ELEITORES_RO * 0.24 + ELEITORES_MG * 0.46;
    const flavioEsperado =
      ELEITORES_SP * 0.48 + ELEITORES_GO * 0.57 + ELEITORES_RO * 0.66 + ELEITORES_MG * 0.45;

    const lula = estimativa.candidatos.find((c) => c.candidato === LULA)!;
    const flavio = estimativa.candidatos.find((c) => c.candidato === FLAVIO_BOLSONARO)!;
    expect(lula.votos).toBeCloseTo(lulaEsperado, 3);
    expect(flavio.votos).toBeCloseTo(flavioEsperado, 3);
    expect(estimativa.candidatos[0]!.candidato).toBe(FLAVIO_BOLSONARO);

    expect(estimativa.eleitoradoTotal).toBe(
      ELEITORES_SP + ELEITORES_GO + ELEITORES_RO + ELEITORES_MG,
    );
    expect(estimativa.eleitoradoComPesquisaEstadual).toBe(
      ELEITORES_SP + ELEITORES_GO + ELEITORES_RO,
    );
  });

  it('marca a UF cuja pesquisa está fora da janela, sem trocá-la pelo nacional', () => {
    const estimativa = casos.getVoteEstimate(2)!;
    expect(estimativa.ufsForaDaJanela).toEqual(['RO']);
    const ro = estimativa.porUf.find((u) => u.uf === 'RO')!;
    expect(ro.origem).toBe('estadual');
    expect(ro.foraDaJanela).toBe(true);
    expect(ro.votosPorCandidato[FLAVIO_BOLSONARO]!.votos).toBeCloseTo(ELEITORES_RO * 0.66, 3);
  });

  it('no 2º turno nenhuma UF precisa de complemento nacional nem de normalização', () => {
    const estimativa = casos.getVoteEstimate(2)!;
    expect(estimativa.ufsNormalizadas).toEqual([]);
    for (const c of estimativa.candidatos) {
      expect(c.votosComplementoNacional).toBe(0);
    }
  });

  it('a assinatura sem argumento continua sendo o 1º turno (compatibilidade da UI)', () => {
    const estimativa = casos.getVoteEstimate()!;
    expect(estimativa).not.toBeNull();
    // 1º turno nacional tem 3 candidatos (inclui Cury); SP só testou 2, o
    // terceiro entra por complemento nacional.
    expect(estimativa.candidatos.map((c) => c.candidato).sort()).toEqual(
      [LULA, FLAVIO_BOLSONARO, 'Augusto Cury'].sort(),
    );
    expect(estimativa.ufsComPesquisa).toEqual(['SP']);
    // Ordem das UFs vem da constante UFS do domínio.
    expect(estimativa.ufsSemPesquisa).toEqual(['GO', 'MG', 'RO']);
  });

  it('retorna null quando nenhuma UF com eleitorado tem pesquisa e não há nacional do confronto', () => {
    const repos: Repositorios = {
      polls: pollRepoFake([
        p({
          id: 'br-t2-so-cury',
          uf: 'BR',
          cargo: 'presidente',
          turno: 2,
          resultados: [
            { candidato: LULA, partido: 'PT', pct: 52 },
            { candidato: 'Augusto Cury', partido: 'PODE', pct: 33 },
          ],
        }),
      ]),
      parties: partyRepoFake(PARTIDOS),
      senateSeats: senateSeatRepoFake,
      meta: metaRepoFake,
      electorate: electorateRepoFake([eleitores('SP', ELEITORES_SP)]),
    };
    // Só existe cenário contra Cury: no recorte Lula x Flávio não há nem
    // agregado estadual nem nacional — estimativa impossível, retorna null.
    expect(criarCasosDeUso(repos, CLOCK).getVoteEstimate(2)).toBeNull();
  });
});

describe('getPresidentialTimeline — por estado e por confronto', () => {
  it('série do confronto em uma UF', () => {
    const serie = casos.getPresidentialTimeline(2, { uf: 'SP', confronto: CONFRONTO_LULA_FLAVIO });
    expect(serie.candidatos).toEqual([FLAVIO_BOLSONARO, LULA]);
    expect(serie.pontos.map((pt) => pt.candidato).sort()).toEqual([FLAVIO_BOLSONARO, LULA].sort());
    const ultimoDia = serie.dias.at(-1)!;
    expect(ultimoDia.data).toBe('2026-09-15');
    expect(ultimoDia.valores[FLAVIO_BOLSONARO]).toBeCloseTo(48, 6);
    expect(ultimoDia.valores[LULA]).toBeCloseTo(47, 6);
  });

  it('o confronto exclui o cenário contra outro candidato na mesma UF', () => {
    const serie = casos.getPresidentialTimeline(2, { uf: 'GO', confronto: CONFRONTO_LULA_FLAVIO });
    expect(serie.candidatos).toEqual([FLAVIO_BOLSONARO, LULA]);
    expect(serie.pontos).toHaveLength(2);
    expect(serie.pontos.map((pt) => pt.candidato)).not.toContain('Ronaldo Caiado');
  });

  it('série vazia quando a UF não tem pesquisa do confronto', () => {
    const serie = casos.getPresidentialTimeline(2, { uf: 'MG', confronto: CONFRONTO_LULA_FLAVIO });
    expect(serie.dias).toEqual([]);
    expect(serie.pontos).toEqual([]);
    expect(serie.candidatos).toEqual([]);
  });

  it('série nacional do confronto ignora o cenário mais recente contra outro candidato', () => {
    const serie = casos.getPresidentialTimeline(2, { confronto: CONFRONTO_LULA_FLAVIO });
    expect(serie.candidatos).toEqual([LULA, FLAVIO_BOLSONARO]);
    expect(serie.pontos.map((pt) => pt.pollId).sort()).toEqual([
      'br-t2-lula-flavio-1',
      'br-t2-lula-flavio-1',
      'br-t2-lula-flavio-2',
      'br-t2-lula-flavio-2',
    ]);
  });

  it('sem confronto nem cenário, mantém o comportamento antigo (cenário mais recente)', () => {
    const serie = casos.getPresidentialTimeline(2);
    expect([...serie.candidatos].sort()).toEqual([LULA, 'Augusto Cury'].sort());
  });

  it('aceita o rótulo do cenário em qualquer ordem de nomes', () => {
    const comRotulo = casos.getPresidentialTimeline(2, `2º turno: ${FLAVIO_BOLSONARO} x ${LULA}`);
    const invertido = casos.getPresidentialTimeline(2, `${LULA} x ${FLAVIO_BOLSONARO}`);
    expect(comRotulo.candidatos).toEqual([LULA, FLAVIO_BOLSONARO]);
    expect(invertido.candidatos).toEqual(comRotulo.candidatos);
    expect(invertido.pontos).toHaveLength(4);
  });

  it('a 2ª posição ainda aceita a string do cenário (compatibilidade) e o 1º turno segue igual', () => {
    const t1 = casos.getPresidentialTimeline(1);
    expect(t1.candidatos).toEqual([LULA, FLAVIO_BOLSONARO, 'Augusto Cury']);
    const t1Sp = casos.getPresidentialTimeline(1, { uf: 'SP' });
    expect(t1Sp.candidatos).toEqual([LULA, FLAVIO_BOLSONARO]);
    expect(t1Sp.dias.at(-1)!.valores[LULA]).toBeCloseTo(38, 6);
  });
});

/**
 * Contra os dados reais (`data/polls.json` + `data/electorate.json`): garante
 * que o recorte do 2º turno Lula x Flávio realmente cobre as 27 UFs e não
 * contamina o agregado com outros cenários. Assertivas propositalmente
 * estruturais (não fixam números nem UFs específicas), já que a base cresce
 * todo dia pela Routine.
 */
describe('2º turno Lula x Flávio nos dados reais', () => {
  const HOJE_REAL = new Date('2026-09-25T12:00:00Z');

  async function casosReais(): Promise<CasosDeUso> {
    const { carregarDados } = await import('../../../adapters/outbound/json/carregar-dados.js');
    return criarCasosDeUso(carregarDados(), { hoje: () => HOJE_REAL });
  }

  it('as 27 UFs têm agregado do confronto e só os dois candidatos aparecem', async () => {
    const dados = (await casosReais()).getPresidentialByState(2);
    expect(dados.ufs.filter((u) => u.semDados).map((u) => u.uf)).toEqual([]);
    for (const uf of dados.ufs) {
      expect(uf.agregado!.candidatos.map((c) => c.candidato).sort()).toEqual(
        [FLAVIO_BOLSONARO, LULA].sort(),
      );
      expect(uf.lider === LULA || uf.lider === FLAVIO_BOLSONARO).toBe(true);
      expect(uf.serie).not.toBeNull();
    }
  });

  it('UF marcada fora da janela realmente só tem pesquisa antiga (nada inventado)', async () => {
    const dados = (await casosReais()).getPresidentialByState(2);
    const limiteMs = HOJE_REAL.getTime() - 45 * 86_400_000;
    for (const sigla of dados.ufsForaDaJanela) {
      const uf = dados.ufs.find((u) => u.uf === sigla)!;
      expect(usouPesquisaForaDaJanela(uf)).toBe(true);
      const ultima = uf.agregado!.ultimaPesquisa;
      const data = ultima.dataFim ?? ultima.publicadoEm ?? ultima.dataInicio!;
      expect(Date.parse(`${data}T00:00:00Z`)).toBeLessThan(limiteMs);
      expect(uf.agregado!.pesquisasUsadas).toHaveLength(1);
    }
  });

  it('a estimativa de votos do 2º turno cobre todo o eleitorado, só com Lula e Flávio', async () => {
    const estimativa = (await casosReais()).getVoteEstimate(2)!;
    expect(estimativa).not.toBeNull();
    expect(estimativa.candidatos.map((c) => c.candidato).sort()).toEqual(
      [FLAVIO_BOLSONARO, LULA].sort(),
    );
    expect(estimativa.ufsComPesquisa).toHaveLength(27);
    expect(estimativa.ufsSemPesquisa).toEqual([]);
    expect(estimativa.eleitoradoComPesquisaEstadual).toBe(estimativa.eleitoradoTotal);
    const somaVotos = estimativa.candidatos.reduce((s, c) => s + c.votos, 0);
    expect(somaVotos + estimativa.naoAtribuidos.votos).toBeCloseTo(estimativa.eleitoradoTotal, 3);
    for (const c of estimativa.candidatos) {
      expect(c.votosComplementoNacional).toBe(0);
      expect(c.votosDeUfSemPesquisa).toBe(0);
      expect(c.votos).toBeGreaterThan(0);
    }
  });
});
