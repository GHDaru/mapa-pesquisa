import { describe, expect, it } from 'vitest';
import type { CandidatoEstimado, EstimativaVotos } from '../../../../../domain/vote-estimate.js';
import {
  baseInicial,
  calcularVantagemAgregada,
  rotuloBase,
  rotuloUnidadeDaBase,
  textoDaAncoragem,
} from '../vote-estimate-panel.js';

function candidato(
  nome: string,
  votos: number,
  pctDoEleitorado: number,
  pctDosVotosAtribuidos: number,
  margemVotos = 0,
): CandidatoEstimado {
  return {
    candidato: nome,
    partido: null,
    votos,
    votosMin: votos - margemVotos,
    votosMax: votos + margemVotos,
    pctDoEleitorado,
    pctDosVotosAtribuidos,
    votosDeUfComPesquisa: votos,
    votosDeUfSemPesquisa: 0,
    votosComplementoNacional: 0,
  };
}

const BASE_ANCORADA = {
  base: 'validos-1o-turno',
  baseTotal: 118_857_969,
  eleitoradoTotal: 157_827_925,
  comparecimento: { votos: 105_890_734, eleitoresCobertos: 133_555_544, ufsSemDado: ['MA', 'MG', 'PI'] },
  ufsComAncoragemSubstituta: ['PI'],
} as unknown as EstimativaVotos;

describe('baseInicial', () => {
  /** O 2º turno é o que está em jogo, e a leitura em votos válidos é a comparável com a urna. */
  it('abre o 2º turno ancorado e o 1º na base histórica', () => {
    expect(baseInicial(2)).toBe('validos-1o-turno');
    expect(baseInicial(1)).toBe('eleitorado');
  });
});

describe('rótulos da base', () => {
  it('nomeia as duas bases sem tratar nenhuma como "a normal"', () => {
    expect(rotuloBase('validos-1o-turno')).toContain('ancorado no 1º turno');
    expect(rotuloBase('eleitorado')).toContain('Eleitorado');
  });

  it('diz a unidade em que cada base é lida', () => {
    expect(rotuloUnidadeDaBase('validos-1o-turno')).toBe('% dos votos válidos');
    expect(rotuloUnidadeDaBase('eleitorado')).toBe('% do eleitorado');
  });
});

describe('textoDaAncoragem', () => {
  it('declara a base, a abstenção usada, a cobertura e as UFs que faltam', () => {
    const t = textoDaAncoragem(BASE_ANCORADA)!;
    expect(t).toContain('118.857.969 votos válidos');
    expect(t).toContain('4 de outubro');
    expect(t).toContain('20,7%');
    expect(t).toContain('24 UFs');
    expect(t).toContain('84,6% do eleitorado');
    expect(t).toContain('MA, MG e PI');
  });

  /**
   * Com as 27 UFs apuradas, a taxa fica comparável com a que o TSE divulga — e
   * um pouco menor, porque o total do TSE soma as seções do exterior. Sem essa
   * ressalva, quem confere acha divergência onde não há.
   */
  it('ressalva o exterior quando nenhuma UF falta', () => {
    const completo = {
      ...BASE_ANCORADA,
      comparecimento: {
        votos: 124_934_069,
        eleitoresCobertos: 157_827_925,
        ufsSemDado: [],
      },
      eleitoradoTotal: 157_827_925,
      ufsComAncoragemSubstituta: [],
    } as unknown as EstimativaVotos;
    const t = textoDaAncoragem(completo)!;
    expect(t).toContain('20,8% nas 27 UFs');
    expect(t).toContain('exterior');
    expect(t).not.toContain('faltam');
    expect(t).not.toContain('não tem apuração');
  });

  it('nomeia a UF cuja âncora foi estimada', () => {
    expect(textoDaAncoragem(BASE_ANCORADA)!).toContain('PI não tem apuração');
  });

  /** A suposição não pode ficar implícita: é ela que separa estimativa de apuração. */
  it('diz a suposição por inteiro, e para que lado ela erra', () => {
    const t = textoDaAncoragem(BASE_ANCORADA)!;
    expect(t).toContain('mesma abstenção');
    expect(t).toContain('MAIOR');
  });

  it('não emite texto nenhum na base do eleitorado', () => {
    expect(textoDaAncoragem({ ...BASE_ANCORADA, base: 'eleitorado' } as EstimativaVotos)).toBeNull();
  });
});

describe('calcularVantagemAgregada', () => {
  const lula = candidato('Lula', 60_145_672, 38.11, 50.6, 2_634_363);
  const flavio = candidato('Flávio', 58_712_296, 37.2, 49.4, 2_634_363);

  /**
   * A vantagem tem de sair na unidade que a tela mostra ao lado. Medir em
   * pontos do eleitorado na base ancorada encolheria a diferença em ~25% e
   * compararia com a margem de erro na régua errada.
   */
  it('na base ancorada mede em pontos de voto válido', () => {
    const v = calcularVantagemAgregada([lula, flavio], 118_857_969, 'validos-1o-turno')!;
    expect(v.pontos).toBeCloseTo(1.2, 6);
  });

  it('na base do eleitorado segue medindo em pontos do eleitorado', () => {
    const v = calcularVantagemAgregada([lula, flavio], 157_827_925, 'eleitorado')!;
    expect(v.pontos).toBeCloseTo(0.91, 6);
  });

  it('sem base explícita, mantém o comportamento antigo', () => {
    const v = calcularVantagemAgregada([lula, flavio], 157_827_925)!;
    expect(v.pontos).toBeCloseTo(0.91, 6);
  });

  it('a margem usa o total que lhe for passado', () => {
    const v = calcularVantagemAgregada([lula, flavio], 118_857_969, 'validos-1o-turno')!;
    expect(v.margemPontos).toBeCloseTo((2_634_363 / 118_857_969) * 100, 6);
    // 1,2 pt de vantagem contra ~2,2 pt de margem: empate técnico.
    expect(v.empateTecnico).toBe(true);
  });
});
