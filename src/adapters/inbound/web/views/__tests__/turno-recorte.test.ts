import { describe, expect, it } from 'vitest';
import {
  avisoForaDaJanela,
  avisoJanelaDoTurno2,
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

describe('_shared/avisoJanelaDoTurno2', () => {
  const D = '04/10/2026';

  it('no 1º turno (comDado 0, a pergunta não cabe) não há aviso', () => {
    expect(avisoJanelaDoTurno2({ apos: [], comDado: 0, dataPrimeiroTurno: D })).toBeNull();
  });

  it('com TODAS as UFs medidas depois do 1º turno o aviso seria falso, e não sai', () => {
    expect(
      avisoJanelaDoTurno2({ apos: ['Acre', 'Bahia'], comDado: 2, dataPrimeiroTurno: D }),
    ).toBeNull();
  });

  it('o estado até 12/10: nenhuma UF do outro lado da eleição', () => {
    const aviso = avisoJanelaDoTurno2({ apos: [], comDado: 27, dataPrimeiroTurno: D });
    expect(aviso).toContain('Nenhuma das 27 UFs com dado neste mapa foi medida depois do 1º turno');
    expect(aviso).toContain('Todas as 27 medem');
    expect(aviso).toContain('antes de 04/10/2026');
    expect(aviso).toContain('uma hipótese');
    // Não promete marca visual que a tela não tem.
    expect(aviso).not.toContain('marcad');
  });

  it('o estado de 12/10: só o Distrito Federal, no singular em todos os pontos', () => {
    const aviso = avisoJanelaDoTurno2({
      apos: ['Distrito Federal'],
      comDado: 27,
      dataPrimeiroTurno: D,
    });
    expect(aviso).toContain('Das 27 UFs com dado neste mapa, só Distrito Federal tem leitura');
    expect(aviso).toContain('As outras 26 medem');
    expect(aviso).not.toContain('têm leitura');
    expect(aviso).not.toContain('A outra mede');
  });

  it('concorda no plural quando mais de uma UF já foi medida depois', () => {
    const aviso = avisoJanelaDoTurno2({
      apos: ['Distrito Federal', 'Rio de Janeiro'],
      comDado: 27,
      dataPrimeiroTurno: D,
    });
    expect(aviso).toContain('apenas Distrito Federal e Rio de Janeiro têm leitura');
    expect(aviso).toContain('As outras 25 medem');
    expect(aviso).not.toContain('só Distrito Federal');
  });

  it('quando falta UMA, o verbo e o artigo vão para o singular', () => {
    const aviso = avisoJanelaDoTurno2({
      apos: ['Distrito Federal', 'Rio de Janeiro'],
      comDado: 3,
      dataPrimeiroTurno: D,
    });
    expect(aviso).toContain('A outra mede');
    expect(aviso).not.toContain('As outras 1');
  });
});

describe('presidential-states-view/janelaDoTurno2 (dados reais)', () => {
  async function montar(hoje: string) {
    const { carregarDados } = await import('../../../../outbound/json/carregar-dados.js');
    const { criarCasosDeUso } = await import('../../../../../application/use-cases/index.js');
    const { janelaDoTurno2 } = await import('../presidential-states-view.js');
    const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date(hoje) });
    return { casos, janelaDoTurno2 };
  }

  it('o Distrito Federal é a única UF cuja leitura de 2º turno é posterior ao 1º turno', async () => {
    const { casos, janelaDoTurno2 } = await montar('2026-10-12T12:00:00Z');
    const dados = casos.getPresidentialByState(2);

    expect(dados.ufsAntesDoPrimeiroTurno).toHaveLength(26);
    expect(dados.ufsAntesDoPrimeiroTurno).not.toContain('DF');
    expect(janelaDoTurno2(dados)).toEqual({ apos: ['Distrito Federal'], comDado: 27 });

    const aviso = avisoJanelaDoTurno2({
      ...janelaDoTurno2(dados),
      dataPrimeiroTurno: '04/10/2026',
    });
    expect(aviso).toContain('só Distrito Federal tem leitura posterior ao 1º turno');
    expect(aviso).toContain('As outras 26 medem');
  });

  it('no 1º turno a pergunta não cabe e o aviso não sai, por mais UFs que haja', async () => {
    const { casos, janelaDoTurno2 } = await montar('2026-10-12T12:00:00Z');
    const dados = casos.getPresidentialByState(1);

    expect(dados.ufsAntesDoPrimeiroTurno).toEqual([]);
    expect(dados.ufs.every((u) => u.medidaAposOPrimeiroTurno === null)).toBe(true);
    expect(
      avisoJanelaDoTurno2({ ...janelaDoTurno2(dados), dataPrimeiroTurno: '04/10/2026' }),
    ).toBeNull();
  });

  it('ingerir a primeira estadual pós-eleição não pode mexer no recorte das outras 26', async () => {
    // Guarda contra o acidente de 06/10 em outra roupa: um dado novo numa UF
    // mudando o que a tela afirma sobre as demais. O DF sai do grupo "antes";
    // nenhuma outra UF pode sair junto.
    const { casos } = await montar('2026-10-12T12:00:00Z');
    const dados = casos.getPresidentialByState(2);
    const comDado = dados.ufs.filter((u) => !u.semDados).map((u) => u.uf);

    expect(comDado).toHaveLength(27);
    expect([...dados.ufsAntesDoPrimeiroTurno].sort()).toEqual(
      comDado.filter((uf) => uf !== 'DF').sort(),
    );
  });
});
