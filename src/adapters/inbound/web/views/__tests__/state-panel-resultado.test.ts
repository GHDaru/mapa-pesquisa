import { describe, expect, it } from 'vitest';
import type { MapaGovernadorUf } from '../../../../../application/use-cases/index.js';
import { blocoResultadoGovernador, tituloSecaoGovernador } from '../state-panel.js';

const DECIDIDO: MapaGovernadorUf = {
  uf: 'SP',
  situacao: 'decidido',
  espectro: 'centro-direita',
  eleito: { nome: 'Tarcísio de Freitas', partido: 'Republicanos', pctValidos: 62.65 },
  disputa: null,
  comparacao: {
    liderNasPesquisas: 'Tarcísio de Freitas',
    partidoNasPesquisas: 'Republicanos',
    instituto: 'Datafolha',
    dataReferencia: '2026-10-03',
    diasAntesDaEleicao: 1,
    amostra: 2520,
    acertouOLider: true,
    pctEleitoNasPesquisasValidos: 59.8,
    pctValidosUrnas: 62.65,
    erroEmPontos: 2.85,
  },
  observacao: null,
};

const EM_DISPUTA: MapaGovernadorUf = {
  uf: 'RN',
  situacao: 'em-disputa',
  espectro: 'centro-direita',
  eleito: null,
  disputa: {
    lider: 'Allyson Bezerra',
    partido: 'União Brasil',
    pct: 45,
    vantagem: 3,
    margemReferencia: 3,
    empateTecnico: true,
    pesquisas: 1,
    institutoUltima: 'Quaest',
    dataUltima: '2026-10-12',
    segundo: 'Cadu de Lula',
  },
  comparacao: null,
  observacao: null,
};

describe('blocoResultadoGovernador', () => {
  it('no estado decidido anuncia o eleito e o percentual com a precisão da fonte', () => {
    const html = blocoResultadoGovernador(DECIDIDO);
    expect(html).toContain('Resultado do 1º turno');
    expect(html).toContain('Tarcísio de Freitas');
    expect(html).toContain('62,65% dos votos válidos');
    expect(html).toContain('Datafolha');
  });

  it('no estado em disputa anuncia a data do 2º turno, não um vencedor', () => {
    const html = blocoResultadoGovernador(EM_DISPUTA);
    expect(html).toContain('2º turno em 25 de outubro');
    expect(html).toContain('Allyson Bezerra');
    expect(html).toContain('Cadu de Lula');
    expect(html).not.toContain('eleito');
    expect(html).not.toContain('Resultado do 1º turno');
  });

  it('não esconde a ressalva da UF', () => {
    const html = blocoResultadoGovernador({
      ...DECIDIDO,
      observacao: 'Registro sub judice: o julgamento está suspenso.',
    });
    expect(html).toContain('sub judice');
  });

  it('escapa o que vem dos dados', () => {
    const html = blocoResultadoGovernador({
      ...DECIDIDO,
      eleito: { nome: '<script>x</script>', partido: 'PP', pctValidos: 50 },
      comparacao: null,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sem pesquisa do confronto real, diz isso em vez de ficar em branco', () => {
    const html = blocoResultadoGovernador({
      uf: 'AM',
      situacao: 'sem-dados',
      espectro: 'indefinido',
      eleito: null,
      disputa: null,
      comparacao: null,
      observacao: null,
    });
    expect(html).toContain('Sem pesquisa do confronto definido pelas urnas');
  });

  it('sem item nenhum, não emite bloco', () => {
    expect(blocoResultadoGovernador(null)).toBe('');
  });
});

describe('tituloSecaoGovernador', () => {
  /**
   * O título carrega o mundo a que as pesquisas pertencem. Num estado
   * decidido, "Governador" sozinho sugere disputa em aberto.
   */
  it('diz que as pesquisas são anteriores à eleição no estado decidido', () => {
    expect(tituloSecaoGovernador(DECIDIDO)).toBe('Governador — pesquisas antes da eleição');
  });

  it('diz que são do 2º turno onde a disputa continua', () => {
    expect(tituloSecaoGovernador(EM_DISPUTA)).toBe('Governador — pesquisas do 2º turno');
  });

  it('fica no título simples quando não há dado', () => {
    expect(tituloSecaoGovernador(null)).toBe('Governador');
  });
});
