import { describe, expect, it } from 'vitest';
import {
  datasDosPontos,
  faixaEvidencia,
  LIMIARES_EVIDENCIA,
  notaSomaDoPainel,
  opacidadeEvidencia,
  rotuloBaseParcial,
  rotuloContagemPesquisas,
  rotuloFaixaEvidencia,
  rotuloPeriodoPesquisas,
  rotuloPesquisasComPeriodo,
  temEvolucaoParaLinha,
  type FaixaEvidencia,
} from '../presidential-states-layout.js';
import { nivelConfianca } from '../../format.js';

/**
 * Força da evidência (tinta do mapa "Quem lidera") e procedência do número
 * ("1 pesquisa · 10/09/2026") na tela "Presidente por estado".
 *
 * Os dois defeitos que estes testes travam foram medidos no 2º turno:
 *
 * 1. `nivelConfianca` (vantagem × margem, sem contar pesquisas) fazia o Rio de
 *    Janeiro — 1 pesquisa, +8,0 — sair MAIS opaco, isto é mais confiável, que
 *    São Paulo — 3 pesquisas, +5,6.
 * 2. Com 3 níveis, 25 das 27 UFs caíam na opacidade cheia: São Paulo (+5,6)
 *    tinha exatamente a mesma tinta de Roraima (+40,8), e a intro prometia um
 *    canal inerte.
 */

const MARGEM = 2;

function faixa(vantagem: number, nPesquisas: number, margemReferencia = MARGEM): FaixaEvidencia {
  return faixaEvidencia({ vantagem, margemReferencia, nPesquisas, semDados: false });
}

describe('presidential-states-layout: faixaEvidencia', () => {
  it('sem dados tem prioridade sobre qualquer vantagem', () => {
    expect(faixaEvidencia({ vantagem: 30, margemReferencia: 2, nPesquisas: 3, semDados: true })).toBe('semDados');
  });

  it('vantagem dentro da margem é empate técnico, no mesmo corte de nivelConfianca', () => {
    expect(faixa(1.9, 3)).toBe('empate');
    expect(faixa(2, 3)).toBe('empate');
    expect(nivelConfianca(2, MARGEM, false)).toBe('empate');
    // Vantagem zero/negativa (sem segundo colocado, ou empate exato) nunca
    // vira liderança pintada.
    expect(faixa(0, 3)).toBe('empate');
  });

  it('escalona os degraus por múltiplos da margem de erro', () => {
    expect(LIMIARES_EVIDENCIA).toEqual([2, 4, 8]);
    expect(faixa(3, 3)).toBe('lidera1'); // 1,5×
    expect(faixa(5, 3)).toBe('lidera2'); // 2,5×
    expect(faixa(10, 3)).toBe('lidera3'); // 5×
    expect(faixa(20, 3)).toBe('lidera4'); // 10×
  });

  it('desce um degrau quando o estado tem uma única pesquisa', () => {
    expect(faixa(20, 3)).toBe('lidera4');
    expect(faixa(20, 1)).toBe('lidera3');
    expect(faixa(10, 1)).toBe('lidera2');
    expect(faixa(5, 1)).toBe('lidera1');
  });

  it('nunca desce abaixo do primeiro degrau — uma pesquisa real ainda é mais que nenhuma', () => {
    expect(faixa(3, 1)).toBe('lidera1');
    expect(faixa(2.5, 1)).toBe('lidera1');
  });

  it('não dá bônus por muitas pesquisas: o degrau extra é só o desconto da pesquisa única', () => {
    expect(faixa(20, 2)).toBe('lidera4');
    expect(faixa(20, 8)).toBe('lidera4');
  });

  it('é monotônica na vantagem quando a margem e o nº de pesquisas são iguais', () => {
    const ordem: readonly FaixaEvidencia[] = ['empate', 'lidera1', 'lidera2', 'lidera3', 'lidera4'];
    const vantagens = [1, 3, 5, 10, 20, 40];
    const indices = vantagens.map((v) => ordem.indexOf(faixa(v, 3)));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('margem não informada/zero não vira divisão por zero', () => {
    expect(faixaEvidencia({ vantagem: 5, margemReferencia: 0, nPesquisas: 3, semDados: false })).toBe('lidera4');
    expect(faixaEvidencia({ vantagem: 0, margemReferencia: 0, nPesquisas: 3, semDados: false })).toBe('empate');
  });
});

describe('presidential-states-layout: opacidadeEvidencia e rotuloFaixaEvidencia', () => {
  it('dá 4 opacidades distintas e crescentes aos degraus de liderança', () => {
    const faixas: readonly FaixaEvidencia[] = ['lidera1', 'lidera2', 'lidera3', 'lidera4'];
    const vars = faixas.map(opacidadeEvidencia);
    expect(new Set(vars).size).toBe(4);
    expect(vars).toEqual([
      'var(--ps-evidencia-1)',
      'var(--ps-evidencia-2)',
      'var(--ps-evidencia-3)',
      'var(--ps-evidencia-4)',
    ]);
  });

  it('reaproveita a opacidade de empate e não apaga a hachura de sem dados', () => {
    expect(opacidadeEvidencia('empate')).toBe('var(--confidence-empate-opacity)');
    expect(opacidadeEvidencia('semDados')).toBe('1');
  });

  it('a legenda diz o critério (múltiplos da margem), não só a cor', () => {
    expect(rotuloFaixaEvidencia('lidera1')).toBe('Lidera por até 2× a margem');
    expect(rotuloFaixaEvidencia('lidera2')).toBe('Lidera por 2× a 4× a margem');
    expect(rotuloFaixaEvidencia('lidera3')).toBe('Lidera por 4× a 8× a margem');
    expect(rotuloFaixaEvidencia('lidera4')).toBe('Lidera por mais de 8× a margem');
    expect(rotuloFaixaEvidencia('empate')).toContain('dentro da margem');
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

async function carregarUfs(turno: 1 | 2) {
  const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
  const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
  const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
  return casos.getPresidentialByState(turno).ufs.map((u) => {
    const n = u.agregado?.pesquisasUsadas.length ?? 0;
    const datas =
      u.agregado && u.serie
        ? datasDosPontos(
            u.serie.pontos,
            u.agregado.candidatos.slice(0, 2).map((c) => c.candidato),
          )
        : [];
    return {
      uf: u.uf,
      n,
      vantagem: u.vantagem,
      faixa: faixaEvidencia({
        vantagem: u.vantagem,
        margemReferencia: u.agregado?.margemReferencia ?? 3,
        nPesquisas: n,
        semDados: u.semDados,
      }),
      nivel: nivelConfianca(u.vantagem, u.agregado?.margemReferencia ?? 3, u.semDados),
      pontoUnico: !temEvolucaoParaLinha(datas),
    };
  });
}

describe('dados reais: a tinta do mapa deixa de inverter a confiança (2º turno)', () => {
  it('Rio de Janeiro (1 pesquisa, +8,0) não sai mais opaco que São Paulo (3 pesquisas, +5,6)', async () => {
    const ufs = await carregarUfs(2);
    const rj = ufs.find((u) => u.uf === 'RJ')!;
    const sp = ufs.find((u) => u.uf === 'SP')!;
    // O bug: os dois caíam em `solid`, e o RJ, com vantagem nominal maior,
    // ficava na opacidade cheia com uma pesquisa de amostra não informada.
    expect(rj.nivel).toBe('solid');
    expect(sp.nivel).toBe('solid');
    expect(rj.n).toBe(1);
    expect(sp.n).toBe(3);
    expect(rj.faixa).toBe('lidera1');
    expect(sp.faixa).toBe('lidera2');
  });

  it('nenhuma UF de uma só pesquisa fica na opacidade cheia', async () => {
    const ufs = await carregarUfs(2);
    expect(ufs.filter((u) => u.n === 1)).toHaveLength(16);
    expect(ufs.filter((u) => u.n === 1 && u.faixa === 'lidera4')).toEqual([]);
  });

  it('o canal de opacidade volta a ter magnitude: 5 de 27 na tinta cheia, não 25', async () => {
    const ufs = await carregarUfs(2);
    expect(ufs.filter((u) => u.nivel === 'solid')).toHaveLength(25);
    expect(ufs.filter((u) => u.faixa === 'lidera4')).toHaveLength(5);
    // São Paulo (+5,6) e Roraima (+40,8) deixam de ter exatamente a mesma tinta.
    const sp = ufs.find((u) => u.uf === 'SP')!;
    const rr = ufs.find((u) => u.uf === 'RR')!;
    expect(sp.faixa).not.toBe(rr.faixa);
  });

  it('o 1º turno continua espalhado pelos degraus (o canal não foi perdido)', async () => {
    const ufs = await carregarUfs(1);
    const cheia = ufs.filter((u) => u.faixa === 'lidera4').length;
    expect(cheia).toBe(9);
    expect(new Set(ufs.map((u) => u.faixa)).size).toBe(5);
  });
});

describe('dados reais: cartões de ponto único', () => {
  it('2º turno: 13 dos 27 estados têm pesquisa de uma só data', async () => {
    const ufs = await carregarUfs(2);
    expect(ufs.filter((u) => u.pontoUnico).map((u) => u.uf)).toEqual([
      'AP',
      'AM',
      'BA',
      'DF',
      'MA',
      'MT',
      'PA',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
    ]);
  });

  it('1º turno: 3 estados (o gate não mudou para quem tem série de verdade)', async () => {
    const ufs = await carregarUfs(1);
    expect(ufs.filter((u) => u.pontoUnico).map((u) => u.uf)).toEqual(['MT', 'PI', 'RS']);
  });

  it('estado com 1 pesquisa mas 2 datas na série continua com linha (Piauí, 2º turno)', async () => {
    const ufs = await carregarUfs(2);
    const pi = ufs.find((u) => u.uf === 'PI')!;
    expect(pi.n).toBe(1);
    expect(pi.pontoUnico).toBe(false);
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
