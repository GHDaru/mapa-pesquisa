import { describe, expect, it } from 'vitest';
import {
  LIMIAR_VAGA_APERTADA,
  rotuloCamara,
  rotuloFechamentoSenado,
  rotuloFolgaDesconhecida,
  rotuloGovernadores,
  rotuloVagasApertadas,
  textoGovernador,
} from '../resultado-view.js';
import type { ComposicaoSenado, SenadorEleito } from '../../../../../domain/resultado.js';

function eleito(uf: string, folga: number | null): SenadorEleito {
  return { uf, nome: `Sen ${uf}`, partido: 'PL', votos: 1, pctValidos: 1, folgaParaOTerceiro: folga };
}

describe('rotuloGovernadores', () => {
  it('o estado de hoje: 21 eleitos e 6 decidindo', () => {
    const t = rotuloGovernadores(21, 6);
    expect(t).toContain('21 das 27 unidades da federação já têm governador eleito');
    expect(t).toContain('As outras 6 decidem no 2º turno, em 25/10');
  });

  it('com uma só faltando, o verbo e o artigo vão ao singular', () => {
    const t = rotuloGovernadores(26, 1);
    expect(t).toContain('A que falta decide no 2º turno');
    expect(t).not.toContain('As outras 1');
    expect(t).not.toContain('decidem');
  });

  it('depois de 25/10, quando não sobra nenhuma, não imprime "0 ainda decidem"', () => {
    const t = rotuloGovernadores(27, 0);
    expect(t).toContain('O quadro está fechado.');
    expect(t).not.toContain('0');
    expect(t).not.toContain('2º turno');
  });
});

describe('rotuloFechamentoSenado', () => {
  it('declara a conta, porque 27 cadeiras do PL não são 27 vitórias de 2026', () => {
    const c = {
      totalCadeiras: 81,
      cadeirasEmDisputa: 54,
      cadeirasRemanescentes: 27,
    } as ComposicaoSenado;
    const t = rotuloFechamentoSenado(c);
    expect(t).toContain('81 cadeiras');
    expect(t).toContain('54 eleitas em 4 de outubro');
    expect(t).toContain('27 que seguem, eleitas em 2022');
  });
});

describe('rotuloVagasApertadas', () => {
  it('sem vaga apertada não há alerta nenhum', () => {
    expect(rotuloVagasApertadas([eleito('SP', 10), eleito('RJ', null)])).toBeNull();
  });

  it('uma só vaga: singular em sujeito e verbo', () => {
    const t = rotuloVagasApertadas([eleito('RN', 0.16), eleito('SP', 10)])!;
    expect(t).toContain('A segunda vaga de RN (0,16%) foi decidida');
    expect(t).not.toContain('As segundas vagas');
    expect(t).not.toContain('foram decididas');
  });

  it('várias vagas: plural, e ordenadas da mais apertada para a menos', () => {
    const t = rotuloVagasApertadas([eleito('AC', 1.35), eleito('RN', 0.16), eleito('PA', 0.19)])!;
    expect(t).toContain('As segundas vagas de');
    expect(t).toContain('foram decididas');
    expect(t.indexOf('RN')).toBeLessThan(t.indexOf('PA'));
    expect(t.indexOf('PA')).toBeLessThan(t.indexOf('AC'));
  });

  it('folga desconhecida (null) nunca entra como se fosse apertada', () => {
    expect(rotuloVagasApertadas([eleito('MG', null)])).toBeNull();
  });

  it('o limiar é de fato o corte', () => {
    expect(rotuloVagasApertadas([eleito('SP', LIMIAR_VAGA_APERTADA)])).toBeNull();
    expect(rotuloVagasApertadas([eleito('SP', LIMIAR_VAGA_APERTADA - 0.01)])).not.toBeNull();
  });
});

describe('rotuloFolgaDesconhecida', () => {
  it('sem UF incompleta não há nota', () => {
    expect(rotuloFolgaDesconhecida([])).toBeNull();
  });

  it('uma UF: tudo no singular', () => {
    const t = rotuloFolgaDesconhecida(['RJ'])!;
    expect(t).toContain('1 unidade da federação (RJ)');
    expect(t).toContain('a dupla é a publicada');
    expect(t).not.toContain('as duplas');
  });

  it('várias UFs: plural', () => {
    const t = rotuloFolgaDesconhecida(['AP', 'ES', 'GO'])!;
    expect(t).toContain('3 unidades da federação (AP, ES, GO)');
    expect(t).toContain('as duplas são as publicadas');
  });
});

describe('rotuloCamara', () => {
  it('nomeia a maior bancada e o peso dela na Casa', () => {
    const t = rotuloCamara(
      [
        { partido: 'PL', cadeiras: 121 },
        { partido: 'PT', cadeiras: 70 },
      ],
      513,
    );
    expect(t).toContain('513 cadeiras');
    expect(t).toContain('entre 2 partidos');
    expect(t).toContain('A maior bancada é a do PL, com 121');
    // 121/513 = 23,58%
    expect(t).toContain('23,6%');
  });

  it('sem bancada cadastrada diz isso, em vez de quebrar', () => {
    expect(rotuloCamara([], 513)).toContain('ainda não cadastrada');
  });
});

describe('textoGovernador', () => {
  it('eleito vira nome e partido', () => {
    expect(
      textoGovernador({
        uf: 'SP',
        situacao: 'eleito',
        eleito: { nome: 'Tarcísio de Freitas', partido: 'Republicanos', pctValidos: 62.65 },
        finalistas: [],
      }),
    ).toBe('Tarcísio de Freitas (Republicanos)');
  });

  it('2º turno vira o confronto, nunca só o primeiro colocado', () => {
    const t = textoGovernador({
      uf: 'ES',
      situacao: 'segundo-turno',
      eleito: null,
      finalistas: [
        { nome: 'Lorenzo Pazolini', partido: 'Republicanos', pctValidos: 49.65 },
        { nome: 'Ricardo Ferraço', partido: 'MDB', pctValidos: 34.06 },
      ],
    });
    expect(t).toBe('Lorenzo Pazolini (Republicanos) x Ricardo Ferraço (MDB)');
  });
});

describe('map-view/EXPLICACAO_MAPA_HIBRIDO', () => {
  it('declara as DUAS naturezas de dado que o mapa passou a misturar', async () => {
    const { EXPLICACAO_MAPA_HIBRIDO } = await import('../map-view.js');
    // O mapa deixou de ser só de pesquisa: tem de dizer que pinta resultado
    // onde a eleição foi decidida e pesquisa onde não foi, e que a segunda
    // coisa é estimativa.
    expect(EXPLICACAO_MAPA_HIBRIDO).toContain('RESULTADO');
    expect(EXPLICACAO_MAPA_HIBRIDO).toContain('PESQUISA');
    expect(EXPLICACAO_MAPA_HIBRIDO).toContain('4 de outubro');
    expect(EXPLICACAO_MAPA_HIBRIDO).toContain('25 de outubro');
    expect(EXPLICACAO_MAPA_HIBRIDO).toContain('estimativa');
  });
});
