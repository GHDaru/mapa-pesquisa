import { describe, expect, it } from 'vitest';
import { pctValidosDasPesquisas } from '../../../../../application/use-cases/get-projecao.js';
import type { MargemProjetada, Projecao } from '../../../../../domain/apuracao.js';
import {
  formatarVotos,
  rotuloDefasagem,
  rotuloDirecaoDoErro,
  rotuloResultadoFinal,
  rotuloApenasNacional,
  rotuloCobertura,
  rotuloErroCandidato,
  rotuloErroDoInstituto,
  rotuloErroMedio,
  rotuloPorUf,
  rotuloTurno,
  rotuloVeredito,
  textoContrasteNacional,
} from '../projecao-view.js';

/**
 * O que esta tela afirma em palavras, contra o que os números permitem
 * afirmar.
 *
 * O teste mais importante do arquivo é o da base de comparação: as pesquisas
 * da base estão no corte do TOTAL e a apuração publica VOTOS VÁLIDOS. Subtrair
 * um do outro sem igualar as bases produz um erro sistemático do tamanho da
 * fatia de brancos, nulos e indecisos — e chamaria isso de "erro das
 * pesquisas". Era o estado da primeira versão deste caso de uso.
 */

function projecaoFake(parcial: Partial<Projecao> = {}): Projecao {
  return {
    cargo: 'presidente',
    turno: 1,
    candidatos: [],
    porUf: [],
    ufsSemApuracao: [],
    eleitoradoCoberto: 0,
    eleitoradoTotal: 0,
    secoesTotalizadasPonderada: 0,
    coberturaNacionalEfetiva: 0,
    validosApurados: 0,
    validosProjetados: 0,
    margem: null,
    nacionalCru: null,
    ...parcial,
  };
}

function candidato(nome: string, pctProjetado: number, pctApurado = pctProjetado) {
  return {
    candidato: nome,
    partido: null,
    votosApurados: pctApurado * 1000,
    votosProjetados: pctProjetado * 1000,
    pctApurado,
    pctProjetado,
  };
}

describe('igualar as bases antes de comparar pesquisa com apuração', () => {
  it('renormaliza o agregado do total para votos válidos', () => {
    // Agregado típico da base: candidatos somando 90, com 10 pontos de
    // brancos/nulos/indecisos que NÃO entram nos válidos.
    const m = pctValidosDasPesquisas([
      { candidato: 'A', pct: 45 },
      { candidato: 'B', pct: 36 },
      { candidato: 'C', pct: 9 },
    ]);
    expect(m.get('A')).toBeCloseTo(50, 6);
    expect(m.get('B')).toBeCloseTo(40, 6);
    expect(m.get('C')).toBeCloseTo(10, 6);
    // E a soma fecha 100 — é a definição de base de válidos.
    expect([...m.values()].reduce((t, v) => t + v, 0)).toBeCloseTo(100, 6);
  });

  it('a renormalização muda o resultado da comparação, e é por isso que existe', () => {
    // Sem renormalizar, um candidato com 45 no total pareceria estar 5 pontos
    // abaixo de uma apuração que lhe dá 50 em válidos. Renormalizado, ele bate
    // exatamente — o "erro" de 5 pontos era só diferença de base.
    const bruto = 45;
    const normalizado = pctValidosDasPesquisas([
      { candidato: 'A', pct: 45 },
      { candidato: 'B', pct: 36 },
      { candidato: 'C', pct: 9 },
    ]).get('A')!;
    const apuracao = 50;
    expect(Math.abs(bruto - apuracao)).toBeCloseTo(5, 6);
    expect(Math.abs(normalizado - apuracao)).toBeCloseTo(0, 6);
  });

  it('agregado vazio ou somando zero não produz divisão por zero', () => {
    expect(pctValidosDasPesquisas([]).size).toBe(0);
    expect(pctValidosDasPesquisas([{ candidato: 'A', pct: 0 }]).size).toBe(0);
  });
});

describe('a cobertura é declarada, nunca implícita', () => {
  it('nomeia as UFs sem apuração e diz que elas não são completadas', () => {
    const texto = rotuloCobertura(
      projecaoFake({
        porUf: [
          {
            uf: 'AC',
            secoesTotalizadas: 100,
            candidatos: [],
            validosApurados: 0,
            validosProjetados: 0,
            eleitores: 600_000,
            lider: null,
          },
        ],
        ufsSemApuracao: ['SP', 'BA'],
        eleitoradoCoberto: 600_000,
        eleitoradoTotal: 45_600_000,
        secoesTotalizadasPonderada: 100,
      }),
    );
    expect(texto).toContain('SP, BA');
    expect(texto).toContain('não são completadas por estimativa');
    // E diz de quanto do eleitorado o percentual fala: 1,3% do país.
    expect(texto).toContain('1,3%');
  });

  it('quando todas as UFs têm apuração, diz isso em vez de omitir', () => {
    const texto = rotuloCobertura(
      projecaoFake({
        porUf: [
          {
            uf: 'AC',
            secoesTotalizadas: 50,
            candidatos: [],
            validosApurados: 0,
            validosProjetados: 0,
            eleitores: 100,
            lider: null,
          },
        ],
        eleitoradoCoberto: 100,
        eleitoradoTotal: 100,
        secoesTotalizadasPonderada: 50,
      }),
    );
    expect(texto).toContain('Todas as UFs têm apuração.');
  });
});

describe('o veredito é aritmético, não é chamada de eleição', () => {
  const base: MargemProjetada = {
    lider: 'A',
    segundo: 'B',
    vantagemVotos: 1000,
    vantagemPct: 2,
    votosRestantesTeto: 50_000,
    matematicamenteDefinido: false,
    acimaDeCinquenta: false,
  };

  it('com vantagem menor que o teto, diz que não está definido', () => {
    const texto = rotuloVeredito(base);
    expect(texto).toContain('não está aritmeticamente definido');
    expect(texto).not.toContain('fora de alcance');
  });

  it('com vantagem maior que o teto, diz que está fora de alcance', () => {
    const texto = rotuloVeredito({
      ...base,
      vantagemVotos: 90_000,
      votosRestantesTeto: 1000,
      matematicamenteDefinido: true,
    });
    expect(texto).toContain('fora de alcance');
  });

  it('nunca usa a palavra "vencedor" nem "eleito" em nenhum dos ramos', () => {
    for (const m of [base, { ...base, matematicamenteDefinido: true }]) {
      const texto = rotuloVeredito(m).toLowerCase();
      expect(texto).not.toContain('vencedor');
      expect(texto).not.toContain('eleito');
      expect(texto).not.toContain('ganhou');
    }
  });

  it('sem margem, diz que não há margem — não devolve vazio', () => {
    expect(rotuloVeredito(null)).toContain('não há margem');
  });
});

describe('o contraste com o parcial nacional explica o viés', () => {
  it('quando os líderes divergem, atribui a diferença à ordem de apuração', () => {
    const texto = textoContrasteNacional(
      projecaoFake({
        candidatos: [candidato('B', 55), candidato('A', 45)],
        nacionalCru: { secoesTotalizadas: 30, somaPctPublicada: 100, candidatos: [candidato('A', 52), candidato('B', 48)] },
      }),
    );
    expect(texto).toContain('não é voto mudando');
    expect(texto).toContain('ordem em que os');
  });

  it('sem recorte nacional, não inventa contraste', () => {
    expect(textoContrasteNacional(projecaoFake({ candidatos: [candidato('A', 50)] }))).toBeNull();
  });

  it('sem candidato na projeção, não inventa contraste', () => {
    expect(
      textoContrasteNacional(
        projecaoFake({
          nacionalCru: { secoesTotalizadas: 10, somaPctPublicada: 100, candidatos: [candidato('A', 50)] },
        }),
      ),
    ).toBeNull();
  });
});

describe('modo só-nacional: a tela se recusa a chamar contagem de projeção', () => {
  const texto = rotuloApenasNacional(47.26);

  it('diz que é contagem parcial, em maiúsculas, e que não projeta', () => {
    expect(texto).toContain('CONTAGEM PARCIAL');
    expect(texto).toContain('não projeta sem a composição por estado');
  });

  it('declara o percentual de seções e avisa que a ordem é provisória', () => {
    expect(texto).toContain('47,3%');
    expect(texto).toContain('provisória');
  });
});

describe('erro do agregado: sinal explicado em palavras, nunca só o número', () => {
  it('distingue superestimar de subestimar', () => {
    expect(
      rotuloErroCandidato({ candidato: 'A', partido: null, pctPesquisas: 50, pctProjetado: 45, erro: 5 }),
    ).toContain('superestimaram');
    expect(
      rotuloErroCandidato({ candidato: 'A', partido: null, pctPesquisas: 40, pctProjetado: 45, erro: -5 }),
    ).toContain('subestimaram');
  });

  it('candidato ausente do agregado é dito ausente, não tratado como erro zero', () => {
    const texto = rotuloErroCandidato({
      candidato: 'Z',
      partido: null,
      pctPesquisas: null,
      pctProjetado: 3,
      erro: null,
    });
    expect(texto).toBe('não estava no agregado');
  });

  it('erro médio sem par comparável é null, não "0,0%"', () => {
    expect(rotuloErroMedio(null, 0)).toBeNull();
    expect(rotuloErroMedio(2.5, 0)).toBeNull();
    expect(rotuloErroMedio(2.5, 3)).toContain('2,5%');
  });
});

describe('formatação de votos', () => {
  it('usa separador de milhar do pt-BR e não mostra casa decimal', () => {
    expect(formatarVotos(27_484_298)).toBe('27.484.298');
    expect(formatarVotos(1_620_578.4)).toBe('1.620.578');
  });
});

describe('defasagem: a página é estática e a apuração não é', () => {
  const leitura = '2026-10-04T21:55:00Z';

  it('abaixo de 10 minutos não alarma', () => {
    expect(rotuloDefasagem(leitura, new Date('2026-10-04T22:04:00Z'))).toBeNull();
  });

  it('em minutos, diz quantos e que a página é estática', () => {
    const texto = rotuloDefasagem(leitura, new Date('2026-10-04T22:40:00Z'))!;
    expect(texto).toContain('45 minutos');
    expect(texto).toContain('página é estática');
    expect(texto).toContain('não o estado atual');
  });

  it('acima de uma hora, muda para horas e minutos', () => {
    const texto = rotuloDefasagem(leitura, new Date('2026-10-05T00:10:00Z'))!;
    expect(texto).toContain('2 h 15 min');
  });

  it('leitura no futuro não produz aviso absurdo', () => {
    expect(rotuloDefasagem(leitura, new Date('2026-10-04T21:00:00Z'))).toBeNull();
  });

  it('data ilegível não inventa defasagem', () => {
    expect(rotuloDefasagem('não é data', new Date('2026-10-04T22:40:00Z'))).toBeNull();
  });
});

describe('a direção do erro enquadra a leitura do ranking', () => {
  it('erro concentrado numa direção é chamado de viés de campo, não de ruído', () => {
    const t = rotuloDirecaoDoErro(15, 1, 16, 'Flávio Bolsonaro')!;
    expect(t).toContain('15 dos 16');
    expect(t).toContain('viés de campo');
    expect(t).toContain('não é ruído de amostra');
    // E redireciona a pergunta, em vez de deixar a tabela sugerir um vencedor.
    expect(t).toContain('o que o método não captou');
  });

  it('erro espalhado nas duas direções é chamado de ruído', () => {
    const t = rotuloDirecaoDoErro(8, 8, 16, 'Flávio Bolsonaro')!;
    expect(t).toContain('nas duas direções');
    expect(t).toContain('ruído de amostra');
    expect(t).not.toContain('viés de campo');
  });

  it('sem institutos ou sem líder, não afirma nada', () => {
    expect(rotuloDirecaoDoErro(0, 0, 0, 'A')).toBeNull();
    expect(rotuloDirecaoDoErro(5, 1, 6, null)).toBeNull();
  });
});

describe('modo resultado final', () => {
  it('diz que a apuração encerrou e que não há projeção a fazer', () => {
    const t = rotuloResultadoFinal(100);
    expect(t).toContain('Apuração encerrada');
    expect(t).toContain('projeção a fazer');
    expect(t).toContain('votos válidos');
  });

  it('não usa a palavra provisório, que faria desconfiar de número que não muda mais', () => {
    expect(rotuloResultadoFinal(100).toLowerCase()).not.toContain('provisóri');
  });
});

describe('o rótulo do turno segue o dado, não o código', () => {
  it('nomeia cada turno', () => {
    expect(rotuloTurno(1)).toBe('1º turno');
    expect(rotuloTurno(2)).toBe('2º turno');
  });

  it('o título do resultado final usa o turno da projeção', () => {
    // O título trazia "1º turno" escrito à mão. Em 25/10 isso rotularia o
    // resultado do 2º turno como se fosse o do 1º, sem erro nenhum para avisar.
    expect(`Resultado final — ${rotuloTurno(projecaoFake({ turno: 2 }).turno)}`).toBe(
      'Resultado final — 2º turno',
    );
  });
});

describe('o erro médio só é comparável se a tela disser sobre quantos candidatos', () => {
  function instituto(erro: number, candidatosComparados: number) {
    return {
      instituto: 'X',
      pollId: 'p',
      dataReferencia: '2026-10-01',
      diasAntes: 3,
      amostra: 2000,
      margemDeclarada: 2,
      candidatosComparados,
      erroMedioAbsoluto: erro,
      erroPorCandidato: [],
      erroNaMargem: null,
      acertouOLider: true,
      alerta: null,
    };
  }

  it('declara o número de candidatos da média', () => {
    expect(rotuloErroDoInstituto(instituto(2.4, 6))).toContain('sobre 6 candidatos');
    expect(rotuloErroDoInstituto(instituto(2.4, 2))).toContain('sobre 2 candidatos');
  });

  it('não escreve "1 candidatos"', () => {
    expect(rotuloErroDoInstituto(instituto(1, 1))).toContain('sobre 1 candidato');
    expect(rotuloErroDoInstituto(instituto(1, 1))).not.toContain('1 candidatos');
  });

  it('o mesmo erro sobre bases diferentes não é apresentado como o mesmo número', () => {
    // É o defeito que o rótulo antigo escondia: "2,4% de erro médio por
    // candidato" sobre 6 candidatos e sobre 2 liam igual, e o ranking ordenava
    // os dois lado a lado. Candidato pequeno é fácil de quase acertar, então a
    // média sobre 6 dilui o erro nos dois primeiros e a média sobre 2 não.
    expect(rotuloErroDoInstituto(instituto(2.4, 6))).not.toBe(
      rotuloErroDoInstituto(instituto(2.4, 2)),
    );
  });
});

describe('a tabela por estado não pode dizer que forma um número que não forma', () => {
  /**
   * A nota afirmava, fixo no código, "é a soma destas linhas que forma a
   * projeção acima". Com 10 das 27 UFs no arquivo e o destaque na contagem
   * nacional de 100% das seções, isso passou a ser falso no ar: duas grandezas
   * diferentes na mesma tela, com uma frase ligando a errada.
   */
  it('no modo nacional, nega explicitamente que a soma das linhas seja o destaque', () => {
    const t = rotuloPorUf('nacional', 10, 17);
    expect(t).toContain('não a soma destas linhas');
    expect(t).toContain('contagem nacional da fonte');
    // E avisa que somar daria número enviesado, que é o erro que o leitor faria.
    expect(t).toContain('enviesado');
  });

  it('no modo estadual, afirma a relação — ali ela é verdadeira', () => {
    const t = rotuloPorUf('estadual', 27, 0);
    expect(t).toContain('é a soma destas linhas que forma a projeção acima');
    expect(t).not.toContain('não a soma destas linhas');
  });

  it('declara quantas UFs faltam, porque 10 linhas parecem o país', () => {
    const t = rotuloPorUf('nacional', 10, 17);
    expect(t).toContain('10 de 27');
    expect(t).toContain('17 ainda sem nenhuma apuração');
    expect(t).toContain('NÃO são completadas por estimativa');
  });

  it('com as 27 completas, diz isso em vez de omitir', () => {
    const t = rotuloPorUf('estadual', 27, 0);
    expect(t).toContain('Todas as 27 unidades da federação têm apuração.');
    expect(t).not.toContain('sem nenhuma apuração');
  });

  it('as duas frases de relação são mutuamente exclusivas', () => {
    expect(rotuloPorUf('nacional', 10, 17)).not.toBe(rotuloPorUf('estadual', 10, 17));
  });
});
