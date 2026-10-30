import { beforeAll, describe, expect, it } from 'vitest';
import { criarAnaliseRepositoryJson, expandirMunicipios } from '../../../adapters/outbound/json/analise-repository.js';
import { montarAnalise, type AnaliseMigracao } from '../get-analise-migracao.js';
import { somarContagens, type DadosAnalise } from '../../../domain/migracao.js';

let dados: DadosAnalise;
let analise: AnaliseMigracao;

beforeAll(async () => {
  dados = await criarAnaliseRepositoryJson().carregar();
  analise = montarAnalise(dados);
});

describe('o adaptador colunar', () => {
  it('expande os municípios com as contagens tipadas', () => {
    expect(dados.municipios.length).toBe(5715);
    const primeiro = dados.municipios[0];
    expect(typeof primeiro?.cod).toBe('string');
    expect(typeof primeiro?.lula2T).toBe('number');
    expect(dados.estados.length).toBe(28);
  });

  it('acusa coluna faltando em vez de produzir undefined silencioso', () => {
    expect(() => expandirMunicipios({ campos: ['cod', 'uf'], linhas: [] })).toThrow(/faltam as colunas/);
  });

  it('acusa linha com número errado de valores', () => {
    const campos = [...(dados.municipios.length ? [] : []), 'cod', 'uf', 'nome', 'secoes', 'aptos1T',
      'aptos2T', 'comparecimento1T', 'comparecimento2T', 'validos1T', 'validos2T', 'lula1T',
      'flavio1T', 'lula2T', 'flavio2T', 'blocoEliminado1T', 'brancoNuloRecuperado',
      'comparecimentoNovo', 'cury1T', 'renan1T', 'caiado1T', 'zema1T', 'outrosEliminados1T',
      'deOutrasOrigens', 'travessiaLiquida'];
    expect(() => expandirMunicipios({ campos, linhas: [['1', 'AC', 'X']] })).toThrow(/valores para/);
  });

  it('a malha cobre quase todo município e sabe o nome de cada um', () => {
    expect(dados.malha.ufs.length).toBe(27);
    expect(dados.malha.municipios.length).toBeGreaterThan(5500);
    expect(dados.malha.municipios.every((m) => m.d.startsWith('M'))).toBe(true);
    expect(dados.malha.municipios.some((m) => m.nome !== m.cod)).toBe(true);
  });
});

describe('os cenários de X', () => {
  it('traz os três contrafactuais com o X de cada um', () => {
    expect(analise.cenarios).toHaveLength(3);
    const [empate, primeiroTurno, pesquisas] = analise.cenarios;
    expect(empate?.x).toBeCloseTo(3.5704, 3);
    expect(primeiroTurno?.x).toBeCloseTo(5.4824, 2);
    expect(pesquisas?.x).toBeCloseTo(5.6358, 3);
  });

  it('tirar o comparecimento novo BAIXA o X em todos os cenários', () => {
    // O canal do comparecimento rendeu pouco a Lula: sem ele sobra menos
    // margem para o gerador explicar, não mais. É contraintuitivo e é o que
    // esta asserção protege.
    for (const c of analise.cenarios) {
      expect(c.xSemComparecimento).toBeLessThan(c.x);
    }
    expect(analise.cenarios[0]?.xSemComparecimento).toBeCloseTo(2.9707, 2);
  });
});

describe('os tetos de X', () => {
  it('nos dois tetos que as seções permitem, Lula continua na frente', () => {
    const [so2T, doisTurnos] = analise.tetos;
    expect(so2T?.votosIntocados).toBe(296);
    expect(doisTurnos?.votosIntocados).toBe(586);
    expect(so2T?.lider).toBe('Lula');
    expect(doisTurnos?.lider).toBe('Lula');
    expect(so2T?.margemVerdadeira).toBeCloseTo(1.2935, 3);
    expect(so2T?.pctDoDeslocamento).toBeCloseTo(40.7, 0);
    expect(so2T?.votosDeMargem).toBeGreaterThan(1_500_000);
  });

  it('o X que empataria e o que salvaria as pesquisas são praticamente impossíveis', () => {
    const empata = analise.tetos.find((t) => t.lider === 'empate');
    const pesquisas = analise.tetos.find((t) => t.lider === 'Flávio');
    expect(empata?.x).toBeCloseTo(3.5704, 3);
    expect(empata?.pDosVotosIntocados).toBeLessThan(1e-4);
    expect(pesquisas?.x).toBeCloseTo(5.6358, 3);
    expect(pesquisas?.pDosVotosIntocados).toBeLessThan(1e-7);
  });

  it('nenhum X plausível cria as 106 seções zeradas de Flávio', () => {
    const observadas = analise.zeradas.find((z) => z.caso === 'flavio')?.secoes ?? 0;
    expect(observadas).toBe(106);
    for (const t of analise.tetos) {
      expect(t.zerosCriados).toBeLessThan(observadas / 10);
    }
  });
});

describe('o resumo do X por estado', () => {
  it('a previsão por estado COLA — a correlação tem o sinal que a hipótese exige', () => {
    expect(analise.resumoDoX.correlacaoComFlavio).toBeGreaterThan(0.6);
  });

  it('e o tamanho não cabe: todas as unidades exigem X acima do teto', () => {
    const r = analise.resumoDoX;
    expect(r.unidades).toBe(28);
    expect(r.acimaDoTeto).toBe(28);
    expect(r.minimo).toBeGreaterThan(r.teto);
    expect(r.minimo).toBeCloseTo(3.3865, 3);
    expect(r.maximo).toBeCloseTo(7.685, 3);
    expect(r.mediaPonderada).toBeGreaterThan(5);
  });

  it('declara o deslocamento comparável e o quanto o comparecimento rendeu', () => {
    expect(analise.resumoDoX.deslocamento).toBeCloseTo(5.5934, 2);
    expect(analise.resumoDoX.comparecimentoLiquido).toBeCloseTo(0.6706, 2);
    expect(analise.resumoDoX.votosPorDoisPontos).toBeCloseTo(2_481_645, -2);
  });
});

describe('o país e a cobertura do mapa', () => {
  it('o país é a soma das unidades, e fecha a identidade do ganho', () => {
    expect(analise.pais.cod).toBeNull();
    expect(analise.pais.uf).toBe('BR');
    const ganho = analise.pais.lula2T - analise.pais.lula1T;
    expect(ganho).toBe(10_376_696);
    expect(analise.pais.deOutrasOrigens + analise.pais.travessiaLiquida).toBe(ganho);
  });

  it('a soma dos municípios bate com a soma dos estados', () => {
    const porMunicipio = somarContagens(dados.municipios);
    expect(porMunicipio.lula2T).toBe(analise.pais.lula2T);
    expect(porMunicipio.validos2T).toBe(analise.pais.validos2T);
    expect(porMunicipio.aptos1T).toBe(analise.pais.aptos1T);
  });

  it('conta os municípios sem área desenhada em vez de escondê-los', () => {
    expect(analise.municipiosSemArea).toBeGreaterThan(0);
    expect(analise.municipiosSemArea).toBeLessThan(30);
    const pct = (100 * analise.votosSemArea) / analise.pais.validos1T;
    expect(pct).toBeLessThan(0.2);
  });
});

describe('montarAnalise', () => {
  it('recusa dados sem país em vez de desenhar zeros', () => {
    expect(() => montarAnalise({ ...dados, estados: [] })).toThrow(/sem margem/);
  });
});
