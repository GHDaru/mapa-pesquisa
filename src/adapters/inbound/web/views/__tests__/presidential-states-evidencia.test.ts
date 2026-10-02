import { describe, expect, it } from 'vitest';
import {
  datasDosPontos,
  degrauDaRazao,
  faixaVantagem,
  formaDoPonto,
  LIMIARES_VANTAGEM,
  marcaDeAreaDaFaixa,
  corDaFaixa,
  degrauDaFaixa,
  notaSomaDoPainel,
  pontosDaBase,
  PROXIMIDADE_BASE_50,
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

describe('presidential-states-layout: corDaFaixa e rotuloFaixaVantagem', () => {
  it('dá um degrau de tinta distinto a cada faixa de liderança, por matiz', () => {
    const faixas: readonly FaixaVantagem[] = ['lidera1', 'lidera2', 'lidera3', 'lidera4'];
    expect(faixas.map((f) => corDaFaixa('esquerda', f))).toEqual([
      'var(--ps-tinta-1-1)',
      'var(--ps-tinta-1-2)',
      'var(--ps-tinta-1-3)',
      'var(--ps-tinta-1-4)',
    ]);
    expect(faixas.map((f) => corDaFaixa('direita', f))).toEqual([
      'var(--ps-tinta-5-1)',
      'var(--ps-tinta-5-2)',
      'var(--ps-tinta-5-3)',
      'var(--ps-tinta-5-4)',
    ]);
  });

  it('o empate é o degrau 0 da rampa e "sem dados" fica fora dela', () => {
    expect(degrauDaFaixa('empate')).toBe(0);
    expect(corDaFaixa('esquerda', 'empate')).toBe('var(--ps-tinta-1-0)');
    expect(degrauDaFaixa('semDados')).toBeNull();
    expect(corDaFaixa('esquerda', 'semDados')).toBe('var(--confidence-sem-dados-fill)');
  });

  it('cada espectro tem sua própria rampa — a tinta nunca vem de dois matizes no mesmo token', () => {
    const espectros = ['esquerda', 'centro-esquerda', 'centro', 'centro-direita', 'direita', 'indefinido'] as const;
    const cores = espectros.map((e) => corDaFaixa(e, 'lidera4'));
    expect(new Set(cores).size).toBe(espectros.length);
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
      semDados: u.semDados,
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

  it('a tinta espalha mais que o canal de confiança que ela substituiu', async () => {
    // Medido em 26/09 com 788 pesquisas: o canal de `nivelConfianca` punha 19
    // das 27 UFs do 1º turno e 26 das 27 do 2º na opacidade cheia; a escala de
    // razão põe 12 e 14 na faixa mais forte. Esses números andam com a base
    // todo dia — o defeito que não pode voltar é a tinta colapsar num degrau.
    for (const turno of [1, 2] as const) {
      const us = await carregarUfs(turno);
      const onde = `${turno}º turno`;
      expect(new Set(us.map((u) => u.faixa)).size, onde).toBeGreaterThanOrEqual(3);
      const naMaisForte = us.filter((u) => u.faixa === 'lidera4').length;
      const naOpacidadeCheia = us.filter((u) => u.nivel === 'solid').length;
      expect(naMaisForte, onde).toBeLessThan(naOpacidadeCheia);
      // A UF de maior razão e a de menor razão acima da margem nunca
      // compartilham tinta: é o que a legenda promete ao numerar as faixas.
      const acima = us.filter((u) => !u.semDados && u.razao > 1);
      const maior = acima.reduce((a, b) => (b.razao > a.razao ? b : a));
      const menor = acima.reduce((a, b) => (b.razao < a.razao ? b : a));
      expect(maior.faixa, `${onde}: ${maior.uf} vs ${menor.uf}`).not.toBe(menor.faixa);
    }
  });

  it('a marca de pesquisa única marca exatamente as UFs de uma pesquisa só', async () => {
    // Medido em 26/09: 4 UFs no 1º turno (AC, MT, PI e RO) e 11 no 2º. A lista
    // muda sempre que um estado ganha a segunda pesquisa — fixá-la era fixar o
    // dado de um dia. O que precisa valer é a equivalência nos dois sentidos:
    // marca ⟺ tem dado e tem uma pesquisa só. Sem o segundo sentido, uma UF de
    // pesquisa única podia deixar de ser marcada sem o teste notar.
    for (const turno of [1, 2] as const) {
      const us = await carregarUfs(turno);
      for (const u of us) {
        expect(u.unica, `${turno}º turno, ${u.uf} (n=${u.n})`).toBe(!u.semDados && u.n === 1);
      }
      expect(
        us.some((u) => u.unica),
        `${turno}º turno: sem nenhuma UF marcada o teste não exerceria nada`,
      ).toBe(true);
    }
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

  it('o cartão vira ponto único exatamente quando desenha uma data só', async () => {
    // Medido em 26/09: 4 cartões no 1º turno e 11 no 2º. A contagem anda com a
    // base; a equivalência com o número de datas desenhadas, não.
    for (const turno of [1, 2] as const) {
      for (const u of await carregarUfs(turno)) {
        if (u.n === 0) continue;
        const datas = new Set(u.datasDesenhadas).size;
        expect(u.pontoUnico, `${turno}º turno, ${u.uf} (${datas} datas)`).toBe(datas === 1);
      }
    }
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
  /** Todas as UFs com agregado, para as propriedades que valem em todas. */
  async function agregadosDe(turno: 1 | 2) {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    return casos
      .getPresidentialByState(turno)
      .ufs.filter((u) => u.agregado && !u.semDados)
      .map((u) => ({ uf: u.uf, agregado: u.agregado! }));
  }

  async function agregadoDe(turno: 1 | 2, uf: string) {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    return casos.getPresidentialByState(turno).ufs.find((u) => u.uf === uf)!.agregado!;
  }

  /*
   * Não fixa mais "3 pesquisas": a base cresce todo dia e a contagem do Ceará
   * mudou quando a rodada do Datafolha de 26/09 entrou. O que precisa valer é
   * a propriedade — quando só parte das pesquisas publica a linha de
   * não-candidato, a soma passa de 100 e a tela declara de quantas pesquisas
   * aquela linha veio, em vez de deixar o leitor supor que veio de todas.
   */
  it('linha publicada por parte das pesquisas: a ressalva aparece em toda UF que esteja nessa condição', async () => {
    // Era o caso do Ceará no 2º turno, cuja soma passava de 100 porque a linha
    // de brancos vinha de 3 das pesquisas do recorte. A base cresceu, o Ceará
    // saiu da condição (hoje soma 99,75) e o teste ancorado nele quebrou sem
    // que nada na tela tivesse piorado. A propriedade vale em qualquer UF.
    let ressalvadas = 0;
    for (const turno of [1, 2] as const) {
      for (const { uf, agregado } of await agregadosDe(turno)) {
        const n = agregado.pesquisasUsadas.length;
        for (const o of agregado.outros) {
          const onde = `${turno}º turno, ${uf}, ${o.candidato} (${o.pesquisas} de ${n})`;
          if (o.pesquisas >= n) {
            expect(rotuloBaseParcial(o.pesquisas, n), onde).toBeNull();
            continue;
          }
          ressalvadas++;
          expect(rotuloBaseParcial(o.pesquisas, n), onde).toBe(
            `de ${o.pesquisas} de ${n} ${n === 1 ? 'pesquisa' : 'pesquisas'}`,
          );
        }
      }
    }
    // Se isto zerar, a condição desapareceu da base e o teste passaria sem
    // exercer o ramo que interessa — é falha, não sucesso.
    expect(ressalvadas, 'nenhuma linha de base parcial na base inteira').toBeGreaterThan(0);
  });

  it('a nota da soma corresponde à soma real de cada UF, nos dois turnos', async () => {
    // O Rio no 2º turno somava 90% e a nota tinha de dizer que o que falta não
    // é zero; hoje soma 103,28 e cai no outro ramo. Os três ramos da nota são
    // testados por fixture acima; aqui vale que o ramo emitido é o da soma
    // daquela UF — nenhuma tela recebe a ressalva errada.
    const vistos = { abaixo: 0, acima: 0, fecha: 0 };
    for (const turno of [1, 2] as const) {
      for (const { uf, agregado } of await agregadosDe(turno)) {
        const soma = [...agregado.candidatos, ...agregado.outros].reduce((t, c) => t + c.pct, 0);
        const onde = `${turno}º turno, ${uf} (soma ${soma.toFixed(2)})`;
        if (soma < 99.5) {
          vistos.abaixo++;
          expect(notaSomaDoPainel(soma), onde).toContain('não é zero');
        } else if (soma > 100.5) {
          vistos.acima++;
          expect(notaSomaDoPainel(soma), onde).toContain('só as pesquisas que publicaram aquela linha');
        } else {
          vistos.fecha++;
          expect(notaSomaDoPainel(soma), onde).toBeNull();
        }
      }
    }
    expect(vistos.abaixo + vistos.acima + vistos.fecha).toBeGreaterThan(0);
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

  it('o marcador de uma pesquisa só é anel exatamente quando a amostra não foi publicada', async () => {
    // Era ancorado no Rio no 2º turno, que tinha uma pesquisa só e sem amostra.
    // Hoje o Rio tem 4 pesquisas e saiu do caso. A propriedade vale em todas as
    // UFs de pesquisa única: anel ⟺ a fonte não publicou o tamanho da amostra.
    let unicas = 0;
    for (const turno of [1, 2] as const) {
      const ufs = (await dadosDe(turno)).ufs.filter(
        (u) => (u.agregado?.pesquisasUsadas.length ?? 0) === 1,
      );
      for (const u of ufs) {
        unicas++;
        // `Pesquisa.amostra` é `number | null | undefined` — o que importa é se
        // a fonte publicou, e é isso que `formaDoPonto` lê.
        const amostra = u.agregado!.pesquisasUsadas[0]!.amostra ?? null;
        expect(formaDoPonto([amostra]), `${turno}º turno, ${u.uf} (amostra ${amostra})`).toBe(
          amostra === null ? 'anel' : 'disco',
        );
      }
    }
    expect(unicas, 'nenhuma UF de pesquisa única na base').toBeGreaterThan(0);
  });

  it('a contagem da nota inclui os cartões de ponto único, que são os de UMA pesquisa', async () => {
    const { pesquisasSemAmostraDesenhadas } = await import('../presidential-states-view.js');
    // A conta anterior excluía os cartões de ponto único e dizia 2 no 2º turno,
    // deixando o Rio de fora. Fixar "3 e 11" trocou um erro por outro: os
    // números andam com a base. A contagem é conferida contra a soma lida do
    // dado, UF por UF, que é a definição que a nota promete ao leitor.
    for (const turno of [1, 2] as const) {
      const dados = await dadosDe(turno);
      const esperado = dados.ufs
        .filter((u) => !u.semDados && u.agregado?.lider)
        .reduce(
          (t, u) => t + u.agregado!.pesquisasUsadas.filter((p) => p.amostra == null).length,
          0,
        );
      expect(pesquisasSemAmostraDesenhadas(dados), `${turno}º turno`).toBe(esperado);
    }
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

/**
 * A linha de base em 50% custa resolução vertical, e antes ela era cobrada de
 * todo cartão, em qualquer turno.
 *
 * Medido sobre as 64 unidades de altura útil do mini-gráfico: no 1º turno o dado
 * ocupava em média 66,1% da altura, e 12 dos 22 cartões tinham o dado INTEIRO
 * abaixo de 50 — o Amapá, com dado entre 32,0 e 36,0 e domínio forçado a 30–52,
 * ficava com 18,2% (11,6 unidades de 64) para representar 2,6 pontos de vantagem,
 * com 14 pontos percentuais de domínio vazio em cima para caber uma linha que o
 * dado nunca toca. No 2º turno a linha é o limiar de vitória e paga o que custa
 * (78,4% de média), e é isso que o critério tem de preservar.
 */
describe('dados reais: a linha de 50% é condicional ao dado do cartão', () => {
  const ALTURA_UTIL = 64;

  async function cartoes(turno: 1 | 2) {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const { baselineDeCinquenta, calcularDominioY, escalaY } = await import(
      '../presidential-states-layout.js'
    );
    const { valoresPlotadosUf } = await import('../presidential-states-view.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-26T12:00:00Z') });
    const dados = casos.getPresidentialByState(turno);
    return {
      dados,
      cartoes: dados.ufs
        .filter((u) => !u.semDados && u.agregado?.lider && u.serie)
        .map((u) => {
          const valores = valoresPlotadosUf(u);
          const datas = new Set(
            u.serie!.pontos
              .filter((p) => new Set(u.agregado!.pesquisasUsadas.map((x) => x.id)).has(p.pollId))
              .map((p) => p.data),
          );
          const comLinha = baselineDeCinquenta(valores);
          const fracao = (dominio: { min: number; max: number }): number => {
            const ys = valores.map((v) => escalaY(v, dominio, ALTURA_UTIL));
            return (Math.max(...ys) - Math.min(...ys)) / ALTURA_UTIL;
          };
          return {
            uf: u.uf,
            serie: datas.size > 1,
            min: Math.min(...valores),
            max: Math.max(...valores),
            comLinha,
            fracaoAntes: fracao(calcularDominioY(valores, undefined, true)),
            fracaoDepois: fracao(calcularDominioY(valores, undefined, comLinha)),
          };
        })
        .filter((c) => c.serie),
    };
  }

  it('cartão só perde a linha de 50% quando nenhum valor plotado chega perto dela', async () => {
    // Este teste dizia "no 2º turno nenhum cartão perde a linha — ali ela é o
    // limiar de vitória". Nunca foi uma necessidade: era um fato do dado de
    // então. Hoje o Pará no 2º turno a perde com razão, porque os dois nomes
    // ficam entre 36 e 44 e o mais alto está a 6 pontos de 50, fora da
    // vizinhança de PROXIMIDADE_BASE_50. O que protege o leitor é que a linha
    // nunca sai de um cartão cujo desenho a alcance.
    let semLinha = 0;
    for (const turno of [1, 2] as const) {
      const { cartoes: cs } = await cartoes(turno);
      for (const c of cs) {
        if (c.comLinha) continue;
        semLinha++;
        const onde = `${turno}º turno, ${c.uf} (${c.min.toFixed(1)}–${c.max.toFixed(1)})`;
        expect(
          c.max < 50 - PROXIMIDADE_BASE_50 || c.min > 50 + PROXIMIDADE_BASE_50,
          onde,
        ).toBe(true);
      }
    }
    expect(semLinha, 'nenhum cartão sem linha: o ramo não foi exercido').toBeGreaterThan(0);
  });

  it('nenhum cartão perde resolução por causa da linha condicional', async () => {
    // Medido em 26/09: o pior cartão do 1º turno (Amapá) usava 18,2% da altura
    // com o domínio fixo de 0 a 50 e passou a usar 50,0%; a média dos cartões
    // foi de 66,1% para 79,6%. Os números andam com a base — a desigualdade,
    // cartão por cartão, é o que não pode regredir.
    for (const turno of [1, 2] as const) {
      const { cartoes: cs } = await cartoes(turno);
      for (const c of cs) {
        expect(c.fracaoDepois, `${turno}º turno, ${c.uf}`).toBeGreaterThanOrEqual(
          c.fracaoAntes - 1e-9,
        );
      }
      const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(media(cs.map((c) => c.fracaoDepois)), `${turno}º turno`).toBeGreaterThanOrEqual(
        media(cs.map((c) => c.fracaoAntes)) - 1e-9,
      );
    }
  });

  it('a nota da seção afirma a contagem que o desenho usa', async () => {
    const { linhasDeCinquenta } = await import('../presidential-states-view.js');
    for (const turno of [1, 2] as const) {
      const { dados, cartoes: cs } = await cartoes(turno);
      const l = linhasDeCinquenta(dados);
      expect(l.cartoes).toBe(cs.length);
      expect(l.comLinha).toBe(cs.filter((c) => c.comLinha).length);
    }
  });
});
