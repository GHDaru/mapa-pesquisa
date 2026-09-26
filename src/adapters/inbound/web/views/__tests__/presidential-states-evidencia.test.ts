import { describe, expect, it } from 'vitest';
import {
  datasDosPontos,
  degrauDaRazao,
  faixaVantagem,
  formaDoPonto,
  LIMIARES_VANTAGEM,
  marcaDeAreaDaFaixa,
  notaSomaDoPainel,
  opacidadeVantagem,
  pontosDaBase,
  razaoVantagem,
  rotuloBaseParcial,
  rotuloContagemPesquisas,
  rotuloFaixaVantagem,
  rotuloPeriodoPesquisas,
  rotuloPesquisasComPeriodo,
  temEvolucaoParaLinha,
  temPesquisaUnica,
  type FaixaVantagem,
} from '../presidential-states-layout.js';
import { nivelConfianca } from '../../format.js';

/**
 * Tinta do mapa "Quem lidera" e procedência do número ("1 pesquisa ·
 * 10/09/2026") na tela "Presidente por estado".
 *
 * O defeito que estes testes travam: o cabeçalho prometia que "a opacidade
 * indica a força da evidência", a legenda rotulava as faixas por razão
 * vantagem/margem ("Lidera por 4× a 8× a margem") e o cálculo descia um degrau
 * nas UFs de pesquisa única. Resultado medido nos dados reais: 15 das 27 UFs do
 * 2º turno e 4 das 27 do 1º ficavam pintadas numa faixa cujo rótulo era
 * factualmente falso sobre elas — Rondônia lidera por 21,0× a margem e saía na
 * faixa "4× a 8×". Agora a tinta codifica SÓ a vantagem em margens de erro, e
 * as ressalvas de evidência (pesquisa única, dado fora da janela) são marcas
 * não-cromáticas com item próprio na legenda.
 */

const MARGEM = 2;

function faixa(vantagem: number, margemReferencia = MARGEM): FaixaVantagem {
  return faixaVantagem({ vantagem, margemReferencia, semDados: false });
}

describe('presidential-states-layout: faixaVantagem', () => {
  it('sem dados tem prioridade sobre qualquer vantagem', () => {
    expect(faixaVantagem({ vantagem: 30, margemReferencia: 2, semDados: true })).toBe('semDados');
  });

  it('vantagem dentro da margem é empate técnico, no mesmo corte de nivelConfianca', () => {
    expect(faixa(1.9)).toBe('empate');
    expect(faixa(2)).toBe('empate');
    expect(nivelConfianca(2, MARGEM, false)).toBe('empate');
    // Vantagem zero/negativa (sem segundo colocado, ou empate exato) nunca
    // vira liderança pintada.
    expect(faixa(0)).toBe('empate');
  });

  it('escalona os degraus por múltiplos da margem de erro', () => {
    expect(LIMIARES_VANTAGEM).toEqual([2, 4, 8]);
    expect(faixa(3)).toBe('lidera1'); // 1,5×
    expect(faixa(5)).toBe('lidera2'); // 2,5×
    expect(faixa(10)).toBe('lidera3'); // 5×
    expect(faixa(20)).toBe('lidera4'); // 10×
  });

  it('a contagem de pesquisas NÃO entra na tinta: é o que tornava os rótulos falsos', () => {
    // 21× a margem com uma pesquisa (caso de Rondônia no 2º turno) tem de cair
    // na faixa rotulada "mais de 8×", porque é isso que a razão diz. A ressalva
    // de pesquisa única vai para `temPesquisaUnica`, não para a cor.
    expect(faixa(42, 2)).toBe('lidera4');
    expect(faixaVantagem({ vantagem: 42, margemReferencia: 2, semDados: false })).toBe('lidera4');
  });

  it('acima da margem, o degrau é exatamente o degrau da razão, sempre', () => {
    for (const vantagem of [2.1, 3.9, 4.1, 7.9, 8.1, 16, 40]) {
      expect(faixa(vantagem)).toBe(`lidera${degrauDaRazao(razaoVantagem(vantagem, MARGEM))}`);
    }
    // Dentro da margem não existe degrau de razão a respeitar: é empate.
    expect(faixa(0.5)).toBe('empate');
  });

  it('é monotônica na vantagem quando a margem é igual', () => {
    const ordem: readonly FaixaVantagem[] = ['empate', 'lidera1', 'lidera2', 'lidera3', 'lidera4'];
    const vantagens = [1, 3, 5, 10, 20, 40];
    const indices = vantagens.map((v) => ordem.indexOf(faixa(v)));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('margem não informada/zero não vira divisão por zero', () => {
    expect(faixaVantagem({ vantagem: 5, margemReferencia: 0, semDados: false })).toBe('lidera4');
    expect(faixaVantagem({ vantagem: 0, margemReferencia: 0, semDados: false })).toBe('empate');
    expect(razaoVantagem(5, 0)).toBe(Infinity);
  });
});

describe('presidential-states-layout: temPesquisaUnica', () => {
  it('marca só quem tem exatamente uma pesquisa e tem dado', () => {
    expect(temPesquisaUnica(1, false)).toBe(true);
    expect(temPesquisaUnica(2, false)).toBe(false);
    expect(temPesquisaUnica(0, false)).toBe(false);
  });

  it('UF sem dados não ganha a marca — a hachura de "sem dados" já fala por ela', () => {
    expect(temPesquisaUnica(1, true)).toBe(false);
    expect(temPesquisaUnica(0, true)).toBe(false);
  });
});

describe('presidential-states-layout: opacidadeVantagem e rotuloFaixaVantagem', () => {
  it('dá 4 opacidades distintas e crescentes aos degraus de liderança', () => {
    const faixas: readonly FaixaVantagem[] = ['lidera1', 'lidera2', 'lidera3', 'lidera4'];
    const vars = faixas.map(opacidadeVantagem);
    expect(new Set(vars).size).toBe(4);
    expect(vars).toEqual([
      'var(--ps-vantagem-1)',
      'var(--ps-vantagem-2)',
      'var(--ps-vantagem-3)',
      'var(--ps-vantagem-4)',
    ]);
  });

  it('reaproveita a opacidade de empate e não apaga a hachura de sem dados', () => {
    expect(opacidadeVantagem('empate')).toBe('var(--confidence-empate-opacity)');
    expect(opacidadeVantagem('semDados')).toBe('1');
  });

  it('a legenda diz o critério (múltiplos da margem), não só a cor', () => {
    expect(rotuloFaixaVantagem('lidera1')).toBe('Lidera por até 2× a margem');
    expect(rotuloFaixaVantagem('lidera2')).toBe('Lidera por 2× a 4× a margem');
    expect(rotuloFaixaVantagem('lidera3')).toBe('Lidera por 4× a 8× a margem');
    expect(rotuloFaixaVantagem('lidera4')).toBe('Lidera por mais de 8× a margem');
    expect(rotuloFaixaVantagem('empate')).toContain('dentro da margem');
  });
});

describe('presidential-states-layout: procedência (quantas pesquisas, de quando)', () => {
  it('concorda o número com o substantivo', () => {
    expect(rotuloContagemPesquisas(1)).toBe('1 pesquisa');
    expect(rotuloContagemPesquisas(3)).toBe('3 pesquisas');
  });

  it('uma data vira a data completa', () => {
    expect(rotuloPeriodoPesquisas(['2026-09-10'])).toBe('10/09/2026');
    expect(rotuloPeriodoPesquisas(['2026-09-10', '2026-09-10'])).toBe('10/09/2026');
  });

  it('várias datas do mesmo mês viram mês/ano; de meses diferentes, um intervalo curto', () => {
    expect(rotuloPeriodoPesquisas(['2026-09-01', '2026-09-20'])).toBe('set/2026');
    expect(rotuloPeriodoPesquisas(['2026-09-20', '2026-08-05'])).toBe('ago–set/2026');
    expect(rotuloPeriodoPesquisas(['2026-02-10', '2025-12-01'])).toBe('dez/2025–fev/2026');
  });

  it('sem data válida não inventa período', () => {
    expect(rotuloPeriodoPesquisas([])).toBeNull();
    expect(rotuloPeriodoPesquisas([''])).toBeNull();
    expect(rotuloPesquisasComPeriodo(1, [''])).toBe('1 pesquisa');
  });

  it('monta a linha que o cartão, o tooltip e o painel mostram', () => {
    expect(rotuloPesquisasComPeriodo(1, ['2026-09-10'])).toBe('1 pesquisa · 10/09/2026');
    expect(rotuloPesquisasComPeriodo(3, ['2026-08-05', '2026-09-19', '2026-09-01'])).toBe(
      '3 pesquisas · ago–set/2026',
    );
  });
});

describe('presidential-states-layout: datasDosPontos', () => {
  const pontos = [
    { candidato: 'Lula', data: '2026-09-10' },
    { candidato: 'Flávio Bolsonaro', data: '2026-09-10' },
    { candidato: 'Ciro Gomes', data: '2026-07-01' },
    { candidato: 'Lula', data: '2026-08-01' },
  ];

  it('só conta as datas dos candidatos realmente plotados, sem duplicar', () => {
    expect(datasDosPontos(pontos, ['Lula', 'Flávio Bolsonaro'])).toEqual(['2026-08-01', '2026-09-10']);
  });

  it('uma única data distinta não é evolução para traçar linha', () => {
    const umaData = [
      { candidato: 'Lula', data: '2026-09-10' },
      { candidato: 'Flávio Bolsonaro', data: '2026-09-10' },
    ];
    expect(temEvolucaoParaLinha(datasDosPontos(umaData, ['Lula', 'Flávio Bolsonaro']))).toBe(false);
    expect(temEvolucaoParaLinha(datasDosPontos(pontos, ['Lula', 'Flávio Bolsonaro']))).toBe(true);
  });

  it('ignora candidato que não está no gráfico', () => {
    expect(datasDosPontos(pontos, ['Ciro Gomes'])).toEqual(['2026-07-01']);
    expect(datasDosPontos(pontos, [])).toEqual([]);
  });
});

/* ===== Regressões com os dados reais (relógio fixo, como turno-recorte.test.ts) ===== */

async function recorteReal(turno: 1 | 2) {
  const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
  const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
  const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
  return casos.getPresidentialByState(turno);
}

async function carregarUfs(turno: 1 | 2) {
  const { datasDesenhadasUf } = await import('../presidential-states-view.js');
  const dados = await recorteReal(turno);
  return dados.ufs.map((u) => {
    const n = u.agregado?.pesquisasUsadas.length ?? 0;
    const margem = u.agregado?.margemReferencia ?? 3;
    const datasDesenhadas = datasDesenhadasUf(u);
    const datasDeclaradas = (u.agregado?.pesquisasUsadas ?? []).map(
      (p) => p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '',
    );
    return {
      uf: u.uf,
      n,
      vantagem: u.vantagem,
      margem,
      razao: razaoVantagem(u.vantagem, margem),
      faixa: faixaVantagem({ vantagem: u.vantagem, margemReferencia: margem, semDados: u.semDados }),
      nivel: nivelConfianca(u.vantagem, margem, u.semDados),
      unica: temPesquisaUnica(n, u.semDados),
      datasDesenhadas,
      datasDeclaradas: [...new Set(datasDeclaradas)].sort(),
      pontoUnico: !temEvolucaoParaLinha(datasDesenhadas),
    };
  });
}

describe('dados reais: o rótulo da faixa é verdadeiro sobre toda UF pintada nela', () => {
  for (const turno of [1, 2] as const) {
    it(`${turno}º turno: nenhuma UF cai numa faixa que sua razão vantagem/margem desminta`, async () => {
      const { ufsComRotuloDeFaixaFalso } = await import('../presidential-states-view.js');
      const dados = await recorteReal(turno);
      // Antes: 4 UFs no 1º turno e 15 no 2º. Este é o invariante da tela — se
      // o rótulo diz "4× a 8×", tem de ser 4× a 8×.
      expect(ufsComRotuloDeFaixaFalso(dados)).toEqual([]);
    });
  }

  it('Rondônia (2º turno, 21,0× a margem) sai da faixa "4× a 8×" e vai para "mais de 8×"', async () => {
    const ufs = await carregarUfs(2);
    const ro = ufs.find((u) => u.uf === 'RO')!;
    expect(ro.n).toBe(1);
    expect(ro.razao).toBeCloseTo(21, 1);
    expect(ro.faixa).toBe('lidera4');
    expect(rotuloFaixaVantagem(ro.faixa)).toBe('Lidera por mais de 8× a margem');
    // E a ressalva que a tinta deixou de carregar não desapareceu: vira marca
    // não-cromática no mapa (pesquisa única) — somada ao contorno tracejado de
    // "fora da janela", que RO também tem.
    expect(ro.unica).toBe(true);
  });

  it('o canal de opacidade continua espalhado pelos 5 degraus nos dois turnos', async () => {
    const t1 = await carregarUfs(1);
    const t2 = await carregarUfs(2);
    expect(new Set(t1.map((u) => u.faixa)).size).toBe(5);
    expect(new Set(t2.map((u) => u.faixa)).size).toBe(5);
    // Com os 3 níveis de `nivelConfianca`, 25 das 27 UFs do 2º turno caíam na
    // opacidade cheia; com a escala de razão, 14.
    expect(t2.filter((u) => u.nivel === 'solid')).toHaveLength(25);
    expect(t2.filter((u) => u.faixa === 'lidera4')).toHaveLength(14);
    expect(t1.filter((u) => u.faixa === 'lidera4')).toHaveLength(10);
    // São Paulo (+5,6) e Roraima (+40,8) continuam com tintas diferentes.
    expect(t2.find((u) => u.uf === 'SP')!.faixa).not.toBe(t2.find((u) => u.uf === 'RR')!.faixa);
  });

  it('a marca de pesquisa única cobre as UFs que a tinta não distingue mais', async () => {
    const t1 = await carregarUfs(1);
    const t2 = await carregarUfs(2);
    expect(t1.filter((u) => u.unica).map((u) => u.uf)).toEqual(['AC', 'MT', 'PI', 'RS', 'RO']);
    expect(t2.filter((u) => u.unica)).toHaveLength(16);
    // Toda UF marcada tem mesmo uma pesquisa só — a marca não é decorativa.
    for (const u of [...t1, ...t2].filter((x) => x.unica)) expect(u.n).toBe(1);
  });
});

describe('dados reais: o cartão desenha a base que declara', () => {
  for (const turno of [1, 2] as const) {
    it(`${turno}º turno: as datas plotadas são as datas das pesquisas usadas, em toda UF`, async () => {
      const ufs = await carregarUfs(turno);
      // Antes, `serie.pontos` não era filtrado pela janela de recência e o
      // cartão desenhava mais pesquisas do que dizia ter: 4 UFs no 1º turno
      // (AC, GO, RO, SE) e 3 no 2º (AC, PI, SE) — Piauí declarava "1 pesquisa ·
      // 16/09/2026" e traçava uma tendência entre 21/06 e 16/09.
      for (const u of ufs) {
        expect(u.datasDesenhadas).toEqual(u.n > 0 ? u.datasDeclaradas : []);
      }
    });
  }

  it('Piauí (2º turno) para de traçar tendência sobre um vão de 87 dias', async () => {
    const ufs = await carregarUfs(2);
    const pi = ufs.find((u) => u.uf === 'PI')!;
    expect(pi.n).toBe(1);
    expect(pi.datasDeclaradas).toEqual(['2026-09-16']);
    expect(pi.datasDesenhadas).toEqual(['2026-09-16']);
    expect(pi.pontoUnico).toBe(true);
  });

  it('Sergipe (2º turno) para de desenhar 01/08 sob o rótulo "1 pesquisa · 21/09/2026"', async () => {
    const ufs = await carregarUfs(2);
    const se = ufs.find((u) => u.uf === 'SE')!;
    expect(se.n).toBe(1);
    expect(se.datasDesenhadas).toEqual(['2026-09-21']);
  });

  it('Goiás (1º turno) desenhava 3 datas sob o rótulo "2 pesquisas · set/2026"', async () => {
    // Medido no DOM antes da correção: cx distintos 8,8 / 177,8 / 208 —
    // 12/05, 01/09 e 21/09. O ponto de 12/05 existia só para o 2º colocado, e é
    // por isso que contar os pontos do LÍDER dava 2 e o cartão mostrava 3.
    const ufs = await carregarUfs(1);
    const go = ufs.find((u) => u.uf === 'GO')!;
    expect(go.n).toBe(2);
    expect(go.datasDesenhadas).toEqual(['2026-09-01', '2026-09-21']);
  });

  it('estado que perdeu pontos não perdeu a linha quando ainda tem 2 datas reais', async () => {
    const ufs = await carregarUfs(1);
    // Goiás mantém a sparkline (2 datas usadas); Acre e Rondônia passam a
    // marcador de ponto único, que é o que o rótulo deles sempre disse.
    expect(ufs.find((u) => u.uf === 'GO')!.pontoUnico).toBe(false);
    expect(ufs.find((u) => u.uf === 'AC')!.pontoUnico).toBe(true);
    expect(ufs.find((u) => u.uf === 'RO')!.pontoUnico).toBe(true);
  });

  it('cartões de ponto único: 5 estados no 1º turno, 16 no 2º', async () => {
    const t1 = await carregarUfs(1);
    const t2 = await carregarUfs(2);
    expect(t1.filter((u) => u.pontoUnico).map((u) => u.uf)).toEqual(['AC', 'MT', 'PI', 'RS', 'RO']);
    expect(t2.filter((u) => u.pontoUnico)).toHaveLength(16);
  });
});

describe('dados reais: cobertura do eleitorado no cabeçalho', () => {
  it('separa "tem alguma pesquisa" de "tem pesquisa dentro da janela"', async () => {
    const { eleitoradoDentroDaJanela } = await import('../presidential-states-view.js');
    const { pctCobertura } = await import('../presidential-states-layout.js');
    for (const [turno, esperado] of [
      [1, '96,6%'],
      [2, '99,2%'],
    ] as const) {
      const dados = await recorteReal(turno);
      const total = dados.eleitoradoNacional!;
      // O cabeçalho anunciava só esta primeira linha, com uma casa decimal
      // ("cobre 100,0%"), duas linhas acima da ressalva que dizia que uma UF
      // está fora da janela.
      expect(pctCobertura(dados.eleitoradoComPesquisa, total)).toBe('100%');
      expect(pctCobertura(eleitoradoDentroDaJanela(dados), total)).toBe(esperado);
      expect(eleitoradoDentroDaJanela(dados)).toBeLessThan(dados.eleitoradoComPesquisa);
    }
  });
});

/* ===== Procedência de cada linha do painel e soma do recorte ===== */

describe('presidential-states-layout: rotuloBaseParcial', () => {
  it('diz de quantas pesquisas a linha saiu quando não saiu de todas', () => {
    expect(rotuloBaseParcial(1, 3)).toBe('de 1 de 3 pesquisas');
    expect(rotuloBaseParcial(2, 4)).toBe('de 2 de 4 pesquisas');
  });

  it('não ressalva nada quando a linha aparece em todas as pesquisas usadas', () => {
    expect(rotuloBaseParcial(3, 3)).toBeNull();
    expect(rotuloBaseParcial(1, 1)).toBeNull();
    expect(rotuloBaseParcial(0, 3)).toBeNull();
  });
});

describe('presidential-states-layout: notaSomaDoPainel', () => {
  it('não ressalva quando o recorte fecha 100%', () => {
    expect(notaSomaDoPainel(100)).toBeNull();
    expect(notaSomaDoPainel(99.7)).toBeNull();
    expect(notaSomaDoPainel(100.4)).toBeNull();
  });

  it('abaixo de 100, diz que o que falta não é zero — é o que não foi publicado', () => {
    const nota = notaSomaDoPainel(90);
    expect(nota).toContain('90,0%');
    expect(nota).toContain('não é zero');
    expect(nota).toContain('Nada foi completado para fechar 100%.');
  });

  it('acima de 100, explica a assimetria entre as linhas (caso do Ceará)', () => {
    const nota = notaSomaDoPainel(102.39);
    expect(nota).toContain('102,4%');
    expect(nota).toContain('só as pesquisas que publicaram aquela linha');
    expect(nota).toContain('Nada foi ajustado para fechar.');
  });
});

describe('dados reais: soma dos recortes no painel do estado', () => {
  async function agregadoDe(turno: 1 | 2, uf: string) {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    return casos.getPresidentialByState(turno).ufs.find((u) => u.uf === uf)!.agregado!;
  }

  it('Ceará (2º turno) soma acima de 100 porque só 1 das 3 pesquisas publica brancos/nulos', async () => {
    const ce = await agregadoDe(2, 'CE');
    expect(ce.pesquisasUsadas).toHaveLength(3);
    const brancos = ce.outros.find((o) => o.candidato.includes('rancos'))!;
    expect(brancos.pesquisas).toBe(1);
    expect(rotuloBaseParcial(brancos.pesquisas, ce.pesquisasUsadas.length)).toBe('de 1 de 3 pesquisas');
    const soma = [...ce.candidatos, ...ce.outros].reduce((t, c) => t + c.pct, 0);
    expect(soma).toBeGreaterThan(102);
    expect(notaSomaDoPainel(soma)).toContain('só as pesquisas que publicaram aquela linha');
  });

  it('Rio de Janeiro (2º turno) soma 90% — a nota não deixa o leitor supor que o resto é zero', async () => {
    const rj = await agregadoDe(2, 'RJ');
    const soma = [...rj.candidatos, ...rj.outros].reduce((t, c) => t + c.pct, 0);
    expect(soma).toBeCloseTo(90, 1);
    expect(notaSomaDoPainel(soma)).toContain('não é zero');
  });

  it('Alagoas (2º turno) fecha 100% e não ganha ressalva nenhuma', async () => {
    const al = await agregadoDe(2, 'AL');
    const soma = [...al.candidatos, ...al.outros].reduce((t, c) => t + c.pct, 0);
    expect(soma).toBeCloseTo(100, 1);
    expect(notaSomaDoPainel(soma)).toBeNull();
    const brancos = al.outros.find((o) => o.candidato.includes('rancos'))!;
    expect(rotuloBaseParcial(brancos.pesquisas, al.pesquisasUsadas.length)).toBeNull();
  });
});

/**
 * Onde cada ressalva pode ser escrita na tela.
 *
 * O defeito que estes testes travam: a ressalva de pesquisa única saiu do canal
 * de cor e voltou por dentro dele como hachura de poros — uma marca de ÁREA na
 * cor do fundo. Medido a 1280px com luminância relativa WCAG por área interna de
 * cada UF, ela clareava o estado em até +0,052 (mais que um degrau inteiro da
 * rampa de vantagem naquele matiz) e cobria 70,6% da área de terra no 2º turno.
 * No mesmo canal, a hachura de empate em `corEspectroSolido` escurecia 0,118 e
 * punha os dois maiores empates do 1º turno abaixo de dois estados que lideram.
 */
describe('presidential-states-layout: marcaDeAreaDaFaixa', () => {
  it('nenhum degrau de liderança pode carregar marca de área', () => {
    for (const faixa of ['lidera1', 'lidera2', 'lidera3', 'lidera4'] as const) {
      expect(marcaDeAreaDaFaixa(faixa)).toBeNull();
    }
  });

  it('empate marca com a cor do FUNDO — subtrair tinta só pode empurrar para o zero da rampa', () => {
    expect(marcaDeAreaDaFaixa('empate')).toBe('fundo');
  });

  it('"sem dados" marca em cinza neutro, fora da rampa de espectro', () => {
    expect(marcaDeAreaDaFaixa('semDados')).toBe('cinzaNeutro');
  });

  it('a ressalva de pesquisa única não tem porta nenhuma para o canal de área', async () => {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    for (const turno of [1, 2] as const) {
      const dados = casos.getPresidentialByState(turno);
      const unicas = dados.ufs.filter((u) =>
        temPesquisaUnica(u.agregado?.pesquisasUsadas.length ?? 0, u.semDados),
      );
      expect(unicas.length).toBeGreaterThan(0);
      for (const u of unicas) {
        const faixa = faixaVantagem({
          vantagem: u.vantagem,
          margemReferencia: u.agregado?.margemReferencia ?? 2,
          semDados: u.semDados,
        });
        // A UF de pesquisa única só ganha marca de área se ela CAIR numa das
        // duas faixas que podem ter uma — nunca por ser de pesquisa única.
        expect(marcaDeAreaDaFaixa(faixa)).toBe(faixa === 'empate' ? 'fundo' : faixa === 'semDados' ? 'cinzaNeutro' : null);
      }
    }
  });
});

describe('presidential-states-layout: formaDoPonto', () => {
  it('amostra não publicada vira anel vazado', () => {
    expect(formaDoPonto([null])).toBe('anel');
    expect(formaDoPonto([null, null])).toBe('anel');
  });

  it('amostra publicada vira disco cheio', () => {
    expect(formaDoPonto([1000])).toBe('disco');
  });

  it('com uma publicada e outra não, o disco cheio não é falso', () => {
    expect(formaDoPonto([null, 1200])).toBe('disco');
  });

  it('sem pesquisa nenhuma não afirma amostra', () => {
    expect(formaDoPonto([])).toBe('anel');
  });
});

describe('dados reais: glifos de amostra na grade', () => {
  async function dadosDe(turno: 1 | 2) {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    return casos.getPresidentialByState(turno);
  }

  it('o marcador de ponto único do Rio de Janeiro (2º turno) é anel: a fonte não publicou a amostra', async () => {
    const rj = (await dadosDe(2)).ufs.find((u) => u.uf === 'RJ')!;
    expect(rj.agregado!.pesquisasUsadas).toHaveLength(1);
    // `Pesquisa.amostra` é `number | null | undefined` — o que importa é que a
    // fonte não publicou, e é isso que `formaDoPonto` lê.
    expect(rj.agregado!.pesquisasUsadas[0]!.amostra ?? null).toBeNull();
    expect(formaDoPonto(rj.agregado!.pesquisasUsadas.map((p) => p.amostra ?? null))).toBe('anel');
  });

  it('a contagem da nota inclui os cartões de ponto único, que são os de UMA pesquisa', async () => {
    const { pesquisasSemAmostraDesenhadas } = await import('../presidential-states-view.js');
    // 2º turno: Goiás, Mato Grosso do Sul e Rio de Janeiro. A conta anterior
    // excluía os cartões de ponto único e dizia 2, deixando o Rio de fora.
    expect(pesquisasSemAmostraDesenhadas(await dadosDe(2))).toBe(3);
    expect(pesquisasSemAmostraDesenhadas(await dadosDe(1))).toBe(11);
  });
});

describe('dados reais: a série sai da mesma base que o cartão declara', () => {
  it('nem ponto nem linha usam pesquisa fora de `pesquisasUsadas`, nos dois turnos', async () => {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    for (const turno of [1, 2] as const) {
      for (const u of casos.getPresidentialByState(turno).ufs) {
        if (!u.agregado || !u.serie) continue;
        const ids = new Set(u.agregado.pesquisasUsadas.map((p) => p.id));
        // Pontos: nenhum de fora da base.
        expect(u.serie.pontos.filter((p) => !ids.has(p.pollId))).toEqual([]);
        // Linha: `serieTemporal` pondera TODAS as pesquisas que recebe por
        // distância no tempo, então uma pesquisa fora da base ainda moldaria a
        // curva mesmo sem virar ponto. O primeiro dia da série é a primeira data
        // da base — antes, Sergipe (1º turno, "2 pesquisas · ago–set/2026")
        // começava em 01/08 e Goiás em 12/05.
        const primeiraDaBase = u.agregado.pesquisasUsadas
          .map((p) => p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? '')
          .sort()[0]!;
        expect(u.serie.dias[0]!.data).toBe(primeiraDaBase);
      }
    }
  });
});
