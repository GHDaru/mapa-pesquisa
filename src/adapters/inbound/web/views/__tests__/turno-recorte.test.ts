import { describe, expect, it } from 'vitest';
import {
  avisoForaDaJanela,
  listaEmPortugues,
  rotuloConfronto,
  rotuloForaDaJanela,
  rotuloRecorte,
  rotuloTurno,
} from '../_shared.js';
import { CONFRONTO_LULA_FLAVIO } from '../../../../../domain/runoff.js';

/**
 * Textos do recorte de turno e da marca de recência usados pela tela
 * "Presidente por estado" (mapa, miniaturas, painel do estado) e pelo painel
 * "Votos estimados". São funções puras — é aqui que mora a regra de "nunca
 * inventar dado": sem confronto não há rótulo de confronto, sem data não há
 * data no aviso.
 */

describe('_shared/rotuloTurno', () => {
  it('nomeia o 1º e o 2º turno em português', () => {
    expect(rotuloTurno(1)).toBe('1º turno');
    expect(rotuloTurno(2)).toBe('2º turno');
  });
});

describe('_shared/rotuloConfronto', () => {
  it('usa o nome pelo qual cada candidato é conhecido', () => {
    expect(rotuloConfronto(CONFRONTO_LULA_FLAVIO)).toBe('Lula x Flávio Bolsonaro');
  });

  it('preserva a ordem dos nomes do confronto', () => {
    expect(rotuloConfronto(['Flávio Bolsonaro', 'Luiz Inácio Lula da Silva'])).toBe(
      'Flávio Bolsonaro x Lula',
    );
  });

  it('cai na regra genérica de sobrenome para candidato sem apelido cadastrado', () => {
    expect(rotuloConfronto(['Luiz Inácio Lula da Silva', 'Fulano Beltrano'])).toBe('Lula x Beltrano');
  });

  it('é null sem confronto (1º turno) — não há confronto a nomear', () => {
    expect(rotuloConfronto(null)).toBeNull();
    expect(rotuloConfronto(undefined)).toBeNull();
    expect(rotuloConfronto([])).toBeNull();
  });
});

describe('_shared/rotuloRecorte', () => {
  it('no 1º turno é só o turno', () => {
    expect(rotuloRecorte(1, null)).toBe('1º turno');
  });

  it('no 2º turno nomeia o confronto junto', () => {
    expect(rotuloRecorte(2, CONFRONTO_LULA_FLAVIO)).toBe('2º turno · Lula x Flávio Bolsonaro');
  });

  it('2º turno sem confronto informado não inventa um confronto', () => {
    expect(rotuloRecorte(2)).toBe('2º turno');
  });
});

describe('_shared/rotuloForaDaJanela', () => {
  it('diz a data da pesquisa usada e a janela que ela estourou', () => {
    expect(rotuloForaDaJanela('2026-07-15')).toBe('Pesquisa de 15/07/2026 — fora da janela de 45 dias');
  });

  it('aceita uma janela diferente da padrão', () => {
    expect(rotuloForaDaJanela('2026-07-15', 30)).toBe('Pesquisa de 15/07/2026 — fora da janela de 30 dias');
  });

  it('sem data conhecida, omite a data em vez de inventar uma', () => {
    expect(rotuloForaDaJanela(null)).toBe('Pesquisa fora da janela de 45 dias');
    expect(rotuloForaDaJanela(undefined)).toBe('Pesquisa fora da janela de 45 dias');
    expect(rotuloForaDaJanela('')).toBe('Pesquisa fora da janela de 45 dias');
  });
});

describe('_shared/listaEmPortugues', () => {
  it('enumera com vírgulas e "e" antes do último', () => {
    expect(listaEmPortugues([])).toBe('');
    expect(listaEmPortugues(['Rondônia'])).toBe('Rondônia');
    expect(listaEmPortugues(['Mato Grosso', 'Piauí'])).toBe('Mato Grosso e Piauí');
    expect(listaEmPortugues(['Acre', 'Bahia', 'Ceará'])).toBe('Acre, Bahia e Ceará');
  });
});

describe('_shared/avisoForaDaJanela', () => {
  it('sem UF fora da janela não há aviso nenhum', () => {
    expect(avisoForaDaJanela([])).toBeNull();
  });

  it('uma UF (caso de Rondônia no 2º turno): nomeia o estado, a data e o que foi feito', () => {
    const aviso = avisoForaDaJanela([{ nome: 'Rondônia', dataIso: '2026-07-15' }]);
    expect(aviso).toContain('Rondônia (15/07/2026)');
    expect(aviso).toContain('não tem pesquisa deste recorte nos últimos 45 dias');
    expect(aviso).toContain('a pesquisa mais recente disponível');
    expect(aviso).toContain('real, mas antigo');
    expect(aviso).toContain('no mapa "Quem lidera", no cartão de tendência e no painel do estado');
  });

  it('concorda o verbo no plural com mais de uma UF', () => {
    const aviso = avisoForaDaJanela([
      { nome: 'Mato Grosso', dataIso: '2026-06-10' },
      { nome: 'Piauí', dataIso: '2026-07-02' },
    ]);
    expect(aviso).toContain('Mato Grosso (10/06/2026) e Piauí (02/07/2026) não têm');
  });

  it('UF sem data conhecida aparece sem parênteses, nunca com data inventada', () => {
    expect(avisoForaDaJanela([{ nome: 'Rondônia' }])).toContain('Rondônia não tem pesquisa');
    expect(avisoForaDaJanela([{ nome: 'Rondônia' }])).not.toContain('(');
  });

  it('aponta o lugar da marca conforme a tela e aceita outra janela', () => {
    const aviso = avisoForaDaJanela([{ nome: 'RO' }], {
      onde: 'na coluna "Origem" da tabela por UF',
      janelaDias: 30,
    });
    expect(aviso).toContain('nos últimos 30 dias');
    expect(aviso).toContain('vem marcado na coluna "Origem" da tabela por UF.');
  });
});

describe('presidential-states-view/ufsComDadoForaDaJanela (dados reais)', () => {
  it('no 2º turno marca Rondônia, cuja única pesquisa do confronto é de julho', async () => {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const { ufsComDadoForaDaJanela } = await import('../presidential-states-view.js');

    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    const fora = ufsComDadoForaDaJanela(casos.getPresidentialByState(2));

    expect(fora.map((u) => u.nome)).toEqual(['Rondônia']);
    expect(fora[0]!.dataIso).toBe('2026-07-15');
    // O texto que a tela mostra ao leitor nomeia o estado e a data reais.
    expect(avisoForaDaJanela(fora)).toContain('Rondônia (15/07/2026)');
  });

  it('todas as 27 UFs têm dado de 2º turno — nenhuma fica "sem pesquisa estadual"', async () => {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');

    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-25T12:00:00Z') });
    const dados = casos.getPresidentialByState(2);

    expect(dados.ufs).toHaveLength(27);
    expect(dados.ufs.filter((u) => u.semDados)).toEqual([]);
    expect(rotuloRecorte(dados.turno, dados.confronto)).toBe('2º turno · Lula x Flávio Bolsonaro');
  });
});
