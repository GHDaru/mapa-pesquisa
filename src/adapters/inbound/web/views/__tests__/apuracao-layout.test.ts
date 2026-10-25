import { describe, expect, it } from 'vitest';
import {
  agregarPorRegiao,
  apuracaoRetida,
  faltaParaLiberar,
  margemApurada,
  montarCsv,
  montarDicaDaUf,
  nomeCurto,
  nomearUnidades,
  nomeDoArquivoCsv,
  ordenarLinhas,
  pctApuradoNaLinha,
  fracaoDaBarra,
  horaCurta,
  montarLinhas,
  notaDasFontes,
  notaDeFalhaDeLeitura,
  notaDoEstagio,
  regiaoDaUf,
  REGIOES,
  semDado,
  somarNaoValidos,
  vantagemEntreOsDois,
  type LinhaUf,
} from '../apuracao-layout.js';

const cand = (candidato: string, votosProjetados: number, pctProjetado: number) => ({
  candidato,
  partido: null,
  votosApurados: votosProjetados,
  votosProjetados,
  pctApurado: pctProjetado,
  pctProjetado,
});

describe('montarLinhas', () => {
  /**
   * `ProjecaoUf.candidatos` vem ordenada por votos, então ler a coluna de cima
   * a baixo saltaria entre um candidato e outro conforme a liderança muda de
   * estado. Uma tabela cuja terceira coluna troca de dono no meio da rolagem é
   * pior que inútil: é lida errado com confiança.
   */
  it('mantém a ordem fixa dos candidatos, mesmo onde a liderança inverte', () => {
    const porUf = [
      { uf: 'SP', secoesTotalizadas: 50, candidatos: [cand('A', 100, 60), cand('B', 66, 40)],
        validosApurados: 166, validosProjetados: 332, eleitores: 10, lider: 'A',
        brancos: 1, nulos: 2, abstencoes: 3, finalizada: false },
      { uf: 'BA', secoesTotalizadas: 50, candidatos: [cand('B', 90, 70), cand('A', 38, 30)],
        validosApurados: 128, validosProjetados: 256, eleitores: 20, lider: 'B',
        brancos: 4, nulos: 5, abstencoes: 6, finalizada: false },
    ];
    const linhas = montarLinhas(porUf, ['A', 'B']);
    for (const l of linhas) {
      expect(l.porCandidato.map((c) => c.candidato)).toEqual(['A', 'B']);
    }
    // E ordena por eleitorado, para a tabela abrir pelos estados que pesam.
    expect(linhas.map((l) => l.uf)).toEqual(['BA', 'SP']);
  });

  /** Candidato ausente de uma UF vira zero, nunca `undefined` na célula. */
  it('não deixa buraco quando a UF não traz um dos dois', () => {
    const linhas = montarLinhas(
      [{ uf: 'AC', secoesTotalizadas: 10, candidatos: [cand('A', 5, 100)],
         validosApurados: 5, validosProjetados: 50, eleitores: 1, lider: 'A',
         brancos: null, nulos: null, abstencoes: null, finalizada: false }],
      ['A', 'B'],
    );
    expect(linhas[0]!.porCandidato[1]).toMatchObject({ candidato: 'B', pct: 0, votosProjetados: 0 });
  });
});

describe('vantagemEntreOsDois', () => {
  it('mede a diferença entre os dois primeiros', () => {
    const v = vantagemEntreOsDois([cand('A', 100, 60), cand('B', 60, 40)])!;
    expect(v).toMatchObject({ lider: 'A', votos: 40, pontos: 20 });
  });

  /**
   * Com zero voto não há líder. A tela usa isto para não escrever "fulano à
   * frente por 0 votos" antes de a apuração começar — nomear liderança que
   * ninguém mediu é o mesmo erro que o mapa evita deixando as UFs cinza.
   */
  it('devolve vantagem zero no empate em zero, para a tela poder omitir', () => {
    const v = vantagemEntreOsDois([cand('A', 0, 0), cand('B', 0, 0)])!;
    expect(v.votos).toBe(0);
  });

  it('não inventa vantagem com um candidato só', () => {
    expect(vantagemEntreOsDois([cand('A', 10, 100)])).toBeNull();
  });
});

describe('notaDoEstagio', () => {
  it('diz que não começou quando não há seção', () => {
    const t = notaDoEstagio({ processadoNacional: 0, ufsSemApuracao: [], definido: false });
    expect(t).toContain('ainda não começou');
  });

  /**
   * A armadilha clássica de noite de eleição: o percentual nacional parcial é
   * enviesado pela ORDEM em que os estados totalizam, não pelo voto.
   */
  it('avisa do viés de ordem enquanto a cobertura é baixa', () => {
    const t = notaDoEstagio({ processadoNacional: 12, ufsSemApuracao: [], definido: false });
    expect(t).toContain('ORDEM');
  });

  it('cala o aviso quando a cobertura já é alta', () => {
    const t = notaDoEstagio({ processadoNacional: 92, ufsSemApuracao: [], definido: false });
    expect(t).not.toContain('ORDEM');
  });

  it('nomeia quantas UFs ficaram de fora, concordando no singular', () => {
    expect(notaDoEstagio({ processadoNacional: 30, ufsSemApuracao: ['AC'], definido: false }))
      .toContain('1 estado ainda não tem');
    expect(notaDoEstagio({ processadoNacional: 30, ufsSemApuracao: ['AC', 'AP'], definido: false }))
      .toContain('2 estados ainda não têm');
  });

  it('declara quando a aritmética já fechou', () => {
    const t = notaDoEstagio({ processadoNacional: 80, ufsSemApuracao: [], definido: true });
    expect(t).toContain('matematicamente definido');
  });
});

describe('notaDasFontes', () => {
  it('conta as leituras e a hora', () => {
    const t = notaDasFontes([
      { ok: true, lidoEm: '2026-10-25T20:10:00.000Z' },
      { ok: true, lidoEm: '2026-10-25T20:10:01.000Z' },
    ]);
    expect(t).toContain('2 de 2');
  });

  /** Falha não some: UF que não respondeu encolhe a projeção e tem de ser dita. */
  it('declara as que falharam em vez de escondê-las', () => {
    const t = notaDasFontes([
      { ok: true, lidoEm: '2026-10-25T20:10:00.000Z' },
      { ok: false, lidoEm: '2026-10-25T20:10:00.000Z' },
    ]);
    expect(t).toContain('1 de 2');
    expect(t).toContain('ficou de fora');
  });
});

describe('fracaoDaBarra e semDado', () => {
  it('limita entre 0 e 1 e trata lixo', () => {
    expect(fracaoDaBarra(50)).toBe(0.5);
    expect(fracaoDaBarra(140)).toBe(1);
    expect(fracaoDaBarra(-5)).toBe(0);
    expect(fracaoDaBarra(Number.NaN)).toBe(0);
  });

  /** UF a 0% não pode ser pintada: seria liderança que ninguém mediu. */
  it('trata 0% como sem dado', () => {
    expect(semDado({ processado: 0 })).toBe(true);
    expect(semDado({ processado: 0.4 })).toBe(false);
  });
});

/* ───────────────────────────── por região ─────────────────────────────── */

function linha(
  uf: string,
  opcoes: {
    eleitores?: number | null;
    processado?: number;
    a?: number;
    b?: number;
    brancos?: number | null;
    nulos?: number | null;
    abstencoes?: number | null;
    finalizada?: boolean;
  } = {},
): LinhaUf {
  const a = opcoes.a ?? 0;
  const b = opcoes.b ?? 0;
  const fracao = (opcoes.processado ?? 100) / 100;
  return {
    uf,
    eleitores: opcoes.eleitores === undefined ? 1_000_000 : opcoes.eleitores,
    processado: opcoes.processado ?? 100,
    finalizada: opcoes.finalizada ?? false,
    lider: a === b ? null : a > b ? 'A' : 'B',
    porCandidato: [
      { candidato: 'A', pct: 0, votosApurados: Math.round(a * fracao), votosProjetados: a },
      { candidato: 'B', pct: 0, votosApurados: Math.round(b * fracao), votosProjetados: b },
    ],
    brancos: opcoes.brancos === undefined ? null : opcoes.brancos,
    nulos: opcoes.nulos === undefined ? null : opcoes.nulos,
    abstencoes: opcoes.abstencoes === undefined ? null : opcoes.abstencoes,
    validosApurados: Math.round((a + b) * fracao),
  };
}

describe('apuracao-layout: regiões', () => {
  it('mapeia as 27 unidades da federação, sem sobra nem repetição', () => {
    const todas = REGIOES.flatMap((r) => r.ufs);
    expect(todas).toHaveLength(27);
    expect(new Set(todas).size).toBe(27);
    expect(regiaoDaUf('SP')).toBe('Sudeste');
    expect(regiaoDaUf('DF')).toBe('Centro-Oeste');
    expect(regiaoDaUf('ba')).toBe('Nordeste');
    expect(regiaoDaUf('XX')).toBeNull();
  });

  it('soma os votos das UFs da região', () => {
    const regioes = agregarPorRegiao(
      [
        linha('SP', { a: 600, b: 400 }),
        linha('RJ', { a: 100, b: 300 }),
        linha('MG', { a: 300, b: 200 }),
        linha('ES', { a: 0, b: 100 }),
      ],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.porCandidato.find((c) => c.candidato === 'A')!.votosProjetados).toBe(1000);
    expect(sudeste.porCandidato.find((c) => c.candidato === 'B')!.votosProjetados).toBe(1000);
    expect(sudeste.eleitores).toBe(4_000_000);
  });

  it('o percentual da região sai da soma dos votos, não da média dos percentuais das UFs', () => {
    // Uma UF enorme 90/10 e uma minúscula 10/90. A média das porcentagens
    // daria 50/50; a soma dos votos diz quase 90/10 — e é esta que é verdade.
    const regioes = agregarPorRegiao(
      [linha('SP', { a: 900_000, b: 100_000 }), linha('ES', { a: 10, b: 90 })],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.porCandidato.find((c) => c.candidato === 'A')!.pct).toBeCloseTo(89.99, 1);
    expect(sudeste.lider).toBe('A');
  });

  it('o % apurado é apurado sobre total da região — soma dividida por soma', () => {
    // SP com 20 milhões de votos a 10% apurado e ES com 2 milhões a 100%:
    // 2M + 2M contados de 22M = 18,2%. A média das porcentagens diria 55%,
    // falso por três vezes. A divisão da soma pela soma já pesa cada UF pelo
    // tamanho do voto dela — não precisa de ponderação nenhuma por fora.
    const regioes = agregarPorRegiao(
      [
        linha('SP', { processado: 10, a: 10_000_000, b: 10_000_000 }),
        linha('ES', { processado: 100, a: 1_000_000, b: 1_000_000 }),
      ],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.processado).toBeCloseTo(18.18, 1);
  });

  it('a projeção da região é a soma da projeção dos estados, exatamente', () => {
    const linhas = [
      linha('SP', { processado: 40, a: 9_000_000, b: 7_000_000 }),
      linha('MG', { processado: 70, a: 4_000_000, b: 3_000_000 }),
      linha('RJ', { processado: 55, a: 3_000_000, b: 4_000_000 }),
      linha('ES', { processado: 90, a: 1_000_000, b: 900_000 }),
    ];
    const sudeste = agregarPorRegiao(linhas, ['A', 'B']).find((r) => r.regiao === 'Sudeste')!;
    for (const nome of ['A', 'B'] as const) {
      const soma = linhas.reduce(
        (s, l) => s + l.porCandidato.find((c) => c.candidato === nome)!.votosProjetados,
        0,
      );
      expect(sudeste.porCandidato.find((c) => c.candidato === nome)!.votosProjetados).toBe(soma);
    }
  });

  it('UF sem nenhuma apuração não entra na soma, mas é nomeada', () => {
    const regioes = agregarPorRegiao(
      [
        linha('SP', { a: 600, b: 400, processado: 50 }),
        linha('RJ', { a: 0, b: 0, processado: 0 }),
      ],
      ['A', 'B'],
    );
    const sudeste = regioes.find((r) => r.regiao === 'Sudeste')!;
    expect(sudeste.ufsSemApuracao).toEqual(['RJ']);
    expect(sudeste.porCandidato.find((c) => c.candidato === 'A')!.votosProjetados).toBe(600);
    // Só SP entra na soma, e SP está a 50%: 500 contados de 1.000 projetados.
    expect(sudeste.processado).toBeCloseTo(50, 5);
  });

  it('região sem nenhum voto não ganha líder', () => {
    const regioes = agregarPorRegiao([linha('SP', { a: 0, b: 0, processado: 0 })], ['A', 'B']);
    expect(regioes.find((r) => r.regiao === 'Sudeste')!.lider).toBeNull();
  });

  it('brancos/nulos/abstenções ficam null quando ninguém publicou, e somam quando alguém publica', () => {
    const semNada = agregarPorRegiao([linha('SP', { a: 10, b: 5 })], ['A', 'B']);
    expect(semNada.find((r) => r.regiao === 'Sudeste')!.brancos).toBeNull();

    const comUm = agregarPorRegiao(
      [linha('SP', { a: 10, b: 5, brancos: 7 }), linha('RJ', { a: 1, b: 1 })],
      ['A', 'B'],
    );
    expect(comUm.find((r) => r.regiao === 'Sudeste')!.brancos).toBe(7);
  });

  it('só é finalizada quando todas as UFs da região terminaram', () => {
    const parcial = agregarPorRegiao(
      [
        linha('PR', { a: 10, b: 5, finalizada: true }),
        linha('SC', { a: 10, b: 5, finalizada: true }),
        linha('RS', { a: 10, b: 5, finalizada: false }),
      ],
      ['A', 'B'],
    );
    expect(parcial.find((r) => r.regiao === 'Sul')!.finalizada).toBe(false);

    const toda = agregarPorRegiao(
      [
        linha('PR', { a: 10, b: 5, finalizada: true }),
        linha('SC', { a: 10, b: 5, finalizada: true }),
        linha('RS', { a: 10, b: 5, finalizada: true }),
      ],
      ['A', 'B'],
    );
    expect(toda.find((r) => r.regiao === 'Sul')!.finalizada).toBe(true);
  });

  it('as cinco regiões aparecem mesmo sem dado nenhum', () => {
    const vazio = agregarPorRegiao([], ['A', 'B']);
    expect(vazio.map((r) => r.regiao)).toEqual(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']);
    expect(vazio.every((r) => r.lider === null && r.processado === 0)).toBe(true);
  });
});

describe('apuracao-layout: somarNaoValidos', () => {
  it('soma o que foi publicado e devolve null para o que ninguém publicou', () => {
    const totais = somarNaoValidos([
      linha('SP', { brancos: 10, nulos: 20 }),
      linha('RJ', { brancos: 5, nulos: 1, abstencoes: 3 }),
    ]);
    expect(totais).toEqual({ brancos: 15, nulos: 21, abstencoes: 3 });
  });

  it('zero não substitui ausência — null continua null', () => {
    expect(somarNaoValidos([linha('SP'), linha('RJ')])).toEqual({
      brancos: null,
      nulos: null,
      abstencoes: null,
    });
  });
});

/* ───────────────── margem apurada, ordenação e exportação ──────────────── */

describe('apuracao-layout: margemApurada', () => {
  it('sai dos votos JÁ CONTADOS, não da projeção', () => {
    // 20% apurado: contados 600 x 400 (60/40). Projetado 3.000 x 2.000.
    // A margem tem de dizer 20 pontos a partir dos 1.000 contados.
    const l = linha('SP', { processado: 20, a: 3000, b: 2000 });
    const m = margemApurada(l);
    expect(m.lider).toBe('A');
    expect(m.votos).toBe(200);
    expect(m.pontos).toBeCloseTo(20, 5);
  });

  it('"ainda pode virar" é o teste exato: vantagem menor que o que falta entrar', () => {
    // Vantagem de 200 votos, faltam 4.000: pode virar.
    expect(margemApurada(linha('SP', { processado: 20, a: 3000, b: 2000 })).podeVirar).toBe(true);
    // Tudo contado: não falta nada, não vira.
    expect(margemApurada(linha('SP', { processado: 100, a: 3000, b: 2000 })).podeVirar).toBe(false);
  });

  it('sem voto contado não há líder nem margem', () => {
    const m = margemApurada(linha('SP', { processado: 0, a: 1000, b: 500 }));
    expect(m.lider).toBeNull();
    expect(m.pontos).toBe(0);
    expect(m.podeVirar).toBe(true);
  });

  it('empate exato não nomeia líder', () => {
    expect(margemApurada(linha('SP', { processado: 100, a: 500, b: 500 })).lider).toBeNull();
  });
});

describe('apuracao-layout: pctApuradoNaLinha', () => {
  it('divide pelos válidos APURADOS, não pelos projetados', () => {
    const l = linha('SP', { processado: 50, a: 600, b: 400 });
    expect(pctApuradoNaLinha(l, 'A')).toBeCloseTo(60, 5);
    expect(pctApuradoNaLinha(l, 'B')).toBeCloseTo(40, 5);
  });

  it('devolve null sem voto contado — e não zero, que seria uma afirmação', () => {
    expect(pctApuradoNaLinha(linha('SP', { processado: 0, a: 10, b: 10 }), 'A')).toBeNull();
  });
});

describe('apuracao-layout: ordenarLinhas', () => {
  const linhas = [
    linha('SP', { eleitores: 34_000_000, processado: 20, a: 600, b: 400 }),
    linha('RR', { eleitores: 350_000, processado: 100, a: 900, b: 100 }),
    linha('BA', { eleitores: 11_000_000, processado: 60, a: 400, b: 600 }),
  ];

  it('não altera o arranjo recebido', () => {
    const antes = linhas.map((l) => l.uf);
    ordenarLinhas(linhas, 'alfabetica');
    expect(linhas.map((l) => l.uf)).toEqual(antes);
  });

  it('ordena por eleitorado, alfabética e pelos dois sentidos de apuração', () => {
    expect(ordenarLinhas(linhas, 'eleitorado').map((l) => l.uf)).toEqual(['SP', 'BA', 'RR']);
    expect(ordenarLinhas(linhas, 'alfabetica').map((l) => l.uf)).toEqual(['BA', 'RR', 'SP']);
    expect(ordenarLinhas(linhas, 'menos-apurados').map((l) => l.uf)).toEqual(['SP', 'BA', 'RR']);
    expect(ordenarLinhas(linhas, 'mais-apurados').map((l) => l.uf)).toEqual(['RR', 'BA', 'SP']);
  });

  it('por margem usa o módulo: o maior é o mais desequilibrado, de qualquer lado', () => {
    expect(ordenarLinhas(linhas, 'margem').map((l) => l.uf)).toEqual(['RR', 'SP', 'BA']);
  });
});

describe('apuracao-layout: montarCsv', () => {
  const base = {
    linhas: [linha('SP', { eleitores: 34_104_226, processado: 63, a: 1000, b: 600, brancos: 50 })],
    candidatos: ['A', 'B'] as [string, string],
    lidoEm: '2026-10-25T21:49:12.000Z',
    apuradoNacional: 37.25,
    simulacao: false,
    recorte: 'estados' as const,
  };

  it('abre com BOM e separa por ponto e vírgula, para o Excel pt-BR', () => {
    const csv = montarCsv(base);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')[0]!.split(';').length).toBeGreaterThan(20);
  });

  it('NÃO usa separador de milhar — é o que estraga o número na planilha', () => {
    const csv = montarCsv(base);
    expect(csv).toContain(';34104226;');
    expect(csv).not.toContain('34.104.226');
  });

  it('usa vírgula como decimal', () => {
    expect(montarCsv(base)).toContain(';63,0;');
  });

  it('a data e hora saem sem vírgula, senão o Excel não a lê como data', () => {
    const csv = montarCsv(base);
    const primeiroCampo = csv.trimEnd().split('\r\n')[1]!.split(';')[0]!;
    expect(primeiroCampo).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    expect(primeiroCampo).not.toContain(',');
  });

  it('a hora e o percentual apurado viajam DENTRO do arquivo, em toda linha', () => {
    const csv = montarCsv(base);
    const linhasCsv = csv.trimEnd().split('\r\n');
    expect(linhasCsv[0]).toContain('lido_em_iso');
    expect(linhasCsv[0]).toContain('margem_pontos_a_menos_b');
    expect(linhasCsv[0]).toContain('apurado_br_pct');
    for (const l of linhasCsv.slice(1)) {
      expect(l).toContain('2026-10-25T21:49:12.000Z');
      expect(l).toContain(';37,3;');
    }
  });

  it('o modo simulação fica marcado em toda linha, não só na tela', () => {
    const csv = montarCsv({ ...base, simulacao: true });
    for (const l of csv.trimEnd().split('\r\n').slice(1)) expect(l).toContain(';SIMULACAO;');
  });

  it('os percentuais do CSV são os APURADOS, iguais aos da tela', () => {
    // 63% de 1.600 projetados: 630 x 378 contados → 62,5% x 37,5%.
    const csv = montarCsv(base);
    const dados = csv.trimEnd().split('\r\n')[1]!.split(';');
    const cab = csv.split('\r\n')[0]!.split(';');
    expect(dados[cab.indexOf('pct_apurado_a')]).toBe('62,50');
    expect(dados[cab.indexOf('pct_apurado_b')]).toBe('37,50');
  });

  it('escapa o ponto e vírgula que aparece DENTRO de um campo', () => {
    // O nome do candidato chega ao arquivo pela coluna do líder. Sem aspas,
    // um ponto e vírgula ali partiria a linha em duas colunas e desalinharia
    // tudo o que vem depois.
    const comPontoEVirgula: LinhaUf = {
      uf: 'SP',
      eleitores: 100,
      processado: 100,
      finalizada: true,
      lider: 'Fulano; o segundo',
      porCandidato: [
        { candidato: 'Fulano; o segundo', pct: 0, votosApurados: 10, votosProjetados: 10 },
        { candidato: 'Beltrano', pct: 0, votosApurados: 5, votosProjetados: 5 },
      ],
      brancos: null,
      nulos: null,
      abstencoes: null,
      validosApurados: 15,
    };
    const csv = montarCsv({
      ...base,
      linhas: [comPontoEVirgula],
      candidatos: ['Fulano; o segundo', 'Beltrano'],
    });
    expect(csv).toContain('"Fulano; o segundo"');
    // E a linha continua com o mesmo número de colunas do cabeçalho.
    const linhasCsv = csv.trimEnd().split('\r\n');
    const colunas = (l: string): number => l.split(';').length;
    expect(colunas(linhasCsv[1]!)).toBe(colunas(linhasCsv[0]!) + 1); // +1 do ; dentro das aspas
    expect(linhasCsv[1]!.match(/"/g)).toHaveLength(2);
  });

  it('campo ausente sai vazio, nunca zero: zero é uma afirmação', () => {
    const csv = montarCsv({ ...base, linhas: [linha('SP', { a: 10, b: 5 })] });
    const cab = csv.split('\r\n')[0]!.split(';');
    const dados = csv.trimEnd().split('\r\n')[1]!.split(';');
    expect(dados[cab.indexOf('brancos')]).toBe('');
  });

  it('troca o nome da coluna de unidade conforme o recorte', () => {
    expect(montarCsv(base).split(';')[2]).toBe('uf');
    expect(montarCsv({ ...base, recorte: 'regioes' }).split(';')[2]).toBe('regiao');
  });
});

describe('apuracao-layout: nomeDoArquivoCsv', () => {
  it('carrega o percentual apurado, para dizer qual download é o mais completo', () => {
    const nome = nomeDoArquivoCsv({
      lidoEm: '2026-10-25T21:49:12.000Z',
      apuradoNacional: 37.2,
      simulacao: false,
      recorte: 'estados',
      turno: 2,
    });
    expect(nome).toContain('37-2pc');
    expect(nome.endsWith('.csv')).toBe(true);
  });

  it('simulação é declarada no nome: a tarja da tela não viaja no arquivo', () => {
    const nome = nomeDoArquivoCsv({
      lidoEm: null,
      apuradoNacional: 0,
      simulacao: true,
      recorte: 'regioes',
      turno: 2,
    });
    expect(nome.startsWith('SIMULACAO-')).toBe(true);
    expect(nome).toContain('regioes');
  });
});

describe('apuracao-layout: nomeCurto', () => {
  it('usa o apelido consagrado quando ele está dentro do nome', () => {
    expect(nomeCurto('Luiz Inácio Lula da Silva')).toBe('Lula');
  });

  it('cai no primeiro nome para qualquer outro candidato', () => {
    expect(nomeCurto('Flávio Bolsonaro')).toBe('Flávio');
    expect(nomeCurto('Ratinho Júnior')).toBe('Ratinho');
    expect(nomeCurto('Simone Tebet')).toBe('Simone');
  });

  it('não quebra com nome de uma palavra só nem com espaços sobrando', () => {
    expect(nomeCurto('Tiririca')).toBe('Tiririca');
    expect(nomeCurto('  Fernando  Haddad ')).toBe('Fernando');
  });
});

describe('apuracao-layout: o exterior no recorte por região', () => {
  it('ganha linha própria em vez de sumir — ele não pertence a região nenhuma', () => {
    const linhas = [
      linha('SP', { a: 600, b: 400 }),
      linha('ZZ', { a: 100, b: 200, eleitores: 916_683 }),
    ];
    const regioes = agregarPorRegiao(linhas, ['A', 'B']);
    const ext = regioes.find((r) => r.regiao === 'Exterior');
    expect(ext).toBeDefined();
    expect(ext!.porCandidato.find((c) => c.candidato === 'B')!.votosProjetados).toBe(200);
    expect(ext!.lider).toBe('B');
    expect(ext!.eleitores).toBe(916_683);
  });

  it('o voto do exterior NÃO é somado a nenhuma região do IBGE', () => {
    const regioes = agregarPorRegiao(
      [linha('SP', { a: 600, b: 400 }), linha('ZZ', { a: 1_000_000, b: 1 })],
      ['A', 'B'],
    );
    for (const r of regioes.filter((x) => x.regiao !== 'Exterior')) {
      expect(r.porCandidato.find((c) => c.candidato === 'A')!.votosProjetados).toBeLessThan(1_000_000);
    }
  });

  it('sem exterior na base, a tabela continua com as cinco regiões e nada mais', () => {
    const regioes = agregarPorRegiao([linha('SP', { a: 1, b: 1 })], ['A', 'B']);
    expect(regioes.map((r) => r.regiao)).toEqual([
      'Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul',
    ]);
  });
});

describe('apuracao-layout: horaCurta', () => {
  it('mostra sempre o horário de Brasília, não o de quem está olhando', () => {
    // 19:30 em Brasília é 22:30 UTC. Sem fixar o fuso, um leitor fora do país
    // via a hora do relógio dele ao lado de marcos de Brasília ("as urnas
    // fecham às 17h") e concluía que a página estava horas fora.
    expect(horaCurta('2026-10-25T22:30:00Z')).toBe('19:30:00');
    expect(horaCurta('2026-10-25T19:30:00-03:00')).toBe('19:30:00');
  });

  it('não quebra com valor ausente ou inválido', () => {
    expect(horaCurta(null)).toBe('—');
    expect(horaCurta('não é data')).toBe('—');
  });
});

describe('apuracao-layout: montarDicaDaUf', () => {
  const ORDEM: readonly [string, string] = ['A', 'B'];

  it('mostra os percentuais do MOMENTO, não os projetados', () => {
    // 50% apurado: contados 300 x 200, dos projetados 600 x 400.
    const dica = montarDicaDaUf({
      nome: 'São Paulo',
      linha: linha('SP', { processado: 50, a: 600, b: 400 }),
      ordem: ORDEM,
      regiao: null,
    });
    expect(dica.titulo).toBe('São Paulo');
    expect(dica.processado).toBe('50,0% computado');
    expect(dica.candidatos.map((c) => `${c.nome} ${c.pct}`)).toEqual(['A 60,0%', 'B 40,0%']);
    expect(dica.candidatos.map((c) => c.votos)).toEqual(['300', '200']);
  });

  it('mantém a ordem fixa dos candidatos, mesmo quando o segundo lidera', () => {
    const dica = montarDicaDaUf({
      nome: 'Bahia',
      linha: linha('BA', { processado: 100, a: 100, b: 900 }),
      ordem: ORDEM,
      regiao: null,
    });
    expect(dica.candidatos.map((c) => c.nome)).toEqual(['A', 'B']);
  });

  it('estado sem seção não recebe percentual nenhum — nem zero', () => {
    const dica = montarDicaDaUf({
      nome: 'Roraima',
      linha: linha('RR', { processado: 0, a: 10, b: 10 }),
      ordem: ORDEM,
      regiao: null,
    });
    expect(dica.processado).toBe('nenhuma seção apurada');
    expect(dica.candidatos).toEqual([]);
  });

  it('estado que ainda não apareceu na leitura também não inventa número', () => {
    const dica = montarDicaDaUf({ nome: 'Acre', linha: null, ordem: ORDEM, regiao: null });
    expect(dica.candidatos).toEqual([]);
  });

  it('diz quando a apuração do estado encerrou', () => {
    const dica = montarDicaDaUf({
      nome: 'Sergipe',
      linha: linha('SE', { processado: 100, a: 10, b: 5, finalizada: true }),
      ordem: ORDEM,
      regiao: null,
    });
    expect(dica.processado).toContain('apuração encerrada');
  });

  it('no recorte por região, traz o estado E o bloco a que ele pertence', () => {
    const dica = montarDicaDaUf({
      nome: 'São Paulo',
      linha: linha('SP', { processado: 50, a: 600, b: 400 }),
      ordem: ORDEM,
      regiao: { nome: 'Sudeste', processado: 44.9, lider: 'A' },
    });
    expect(dica.candidatos).toHaveLength(2);
    expect(dica.nota).toBe('Região Sudeste: 44,9% apurado, A à frente.');
  });
});

describe('apuracao-layout: a espera até as 19h', () => {
  it('retém antes da hora e libera a partir dela, no horário de Brasília', () => {
    expect(apuracaoRetida(new Date('2026-10-25T18:59:00-03:00'))).toBe(true);
    expect(apuracaoRetida(new Date('2026-10-25T19:00:00-03:00'))).toBe(false);
    expect(apuracaoRetida(new Date('2026-10-25T21:30:00-03:00'))).toBe(false);
  });

  it('a hora é a de Brasília mesmo para quem abre de outro fuso', () => {
    // 21:59 UTC é 18:59 em Brasília: ainda retido, mesmo que o relógio de
    // quem olha já tenha passado das 19h.
    expect(apuracaoRetida(new Date('2026-10-25T21:59:00Z'))).toBe(true);
    expect(apuracaoRetida(new Date('2026-10-25T22:00:00Z'))).toBe(false);
  });

  it('conta quanto falta, e zera depois da hora', () => {
    const umaHora = 3600 * 1000;
    expect(faltaParaLiberar(new Date('2026-10-25T18:00:00-03:00'))).toBe(umaHora);
    expect(faltaParaLiberar(new Date('2026-10-25T19:00:00-03:00'))).toBe(0);
    expect(faltaParaLiberar(new Date('2026-10-25T23:00:00-03:00'))).toBe(0);
  });

  it('conta com precisão de segundo — não arredondando para o minuto', () => {
    // Sem os segundos, 18h59m55 era lido como 18h59m00 e o despertador da
    // liberação ia para 60 segundos adiante em vez de 5: a página passava um
    // minuto inteiro depois das 19h ainda zerada, parecendo travada.
    expect(faltaParaLiberar(new Date('2026-10-25T18:59:55-03:00'))).toBe(5000);
    expect(faltaParaLiberar(new Date('2026-10-25T18:59:30-03:00'))).toBe(30000);
    expect(faltaParaLiberar(new Date('2026-10-25T18:30:00-03:00'))).toBe(30 * 60 * 1000);
  });

  it('o limite é parâmetro, não número solto no código', () => {
    expect(apuracaoRetida(new Date('2026-10-25T17:30:00-03:00'), 17)).toBe(false);
    expect(apuracaoRetida(new Date('2026-10-25T17:30:00-03:00'), 18)).toBe(true);
  });
});

describe('apuracao-layout: nomearUnidades', () => {
  it('conta estados quando só há estados', () => {
    expect(nomearUnidades(['SP', 'RJ'])).toBe('2 estados');
    expect(nomearUnidades(['SP'])).toBe('1 estado');
  });

  it('não chama o exterior de estado', () => {
    expect(nomearUnidades(['SP', 'RJ', 'ZZ'])).toBe('2 estados e o exterior');
    expect(nomearUnidades(['SP', 'ZZ'])).toBe('1 estado e o exterior');
    expect(nomearUnidades(['ZZ'])).toBe('o exterior');
  });

  it('as 28 unidades viram "27 estados e o exterior"', () => {
    const todas = [
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
      'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','ZZ',
    ];
    expect(nomearUnidades(todas)).toBe('27 estados e o exterior');
  });
});

describe('apuracao-layout: notaDeFalhaDeLeitura', () => {
  const ok = (n: number) => Array.from({ length: n }, () => ({ ok: true }));
  const falha = (n: number) => Array.from({ length: n }, () => ({ ok: false }));

  it('não avisa quando está tudo lido', () => {
    expect(notaDeFalhaDeLeitura(ok(28))).toBeNull();
  });

  it('não avisa quando não houve leitura nenhuma ainda', () => {
    expect(notaDeFalhaDeLeitura([])).toBeNull();
  });

  it('falha total é declarada como falha, não como apuração não começada', () => {
    const nota = notaDeFalhaDeLeitura(falha(28));
    expect(nota?.total).toBe(true);
    expect(nota?.texto).toContain('não porque a apuração não começou');
  });

  it('falha parcial avisa que o total está menor do que é', () => {
    const nota = notaDeFalhaDeLeitura([...ok(25), ...falha(3)]);
    expect(nota?.total).toBe(false);
    expect(nota?.texto).toContain('3 de 28');
    expect(nota?.texto).toContain('INCOMPLETOS');
  });
});
