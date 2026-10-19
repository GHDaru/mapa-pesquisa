import { describe, expect, it } from 'vitest';
import type { MapaGovernadorUf } from '../../../../../application/use-cases/index.js';
import {
  ariaLabelUfMapa,
  rotuloAcertoDasPesquisas,
  rotuloSituacaoDoMapa,
  textoComparacao,
} from '../map-view.js';

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

const SEM_DADOS: MapaGovernadorUf = {
  uf: 'AM',
  situacao: 'sem-dados',
  espectro: 'indefinido',
  eleito: null,
  disputa: null,
  comparacao: null,
  observacao: null,
};

describe('rotuloSituacaoDoMapa', () => {
  it('diz quantos estados as urnas decidiram e quantos seguem em disputa', () => {
    expect(rotuloSituacaoDoMapa(21, 6)).toBe(
      '21 estados decididos nas urnas, 6 ainda vão ao 2º turno em 25 de outubro.',
    );
  });

  it('concorda no singular', () => {
    expect(rotuloSituacaoDoMapa(1, 1)).toBe(
      '1 estado decidido nas urnas, 1 ainda vai ao 2º turno em 25 de outubro.',
    );
  });

  /** Depois de 25/10 não sobra disputa nenhuma, e a frase não pode ficar truncada. */
  it('fecha a frase quando não há mais disputa aberta', () => {
    expect(rotuloSituacaoDoMapa(27, 0)).toBe(
      '27 estados decididos nas urnas. O mapa de governadores está fechado.',
    );
  });
});

describe('rotuloAcertoDasPesquisas', () => {
  it('dá o placar de acertos', () => {
    expect(rotuloAcertoDasPesquisas(18, 21)).toContain('18 dos 21');
  });

  it('não diz "18 de 18" quando acertou todos — afirma o acerto', () => {
    expect(rotuloAcertoDasPesquisas(21, 21)).toContain('em todos');
  });

  it('trata o caso de uma única UF comparável', () => {
    expect(rotuloAcertoDasPesquisas(1, 1)).toContain('único estado');
  });

  it('não afirma acerto quando não há nada para comparar', () => {
    expect(rotuloAcertoDasPesquisas(0, 0)).toContain('Nenhum estado');
  });
});

describe('ariaLabelUfMapa', () => {
  it('no estado decidido diz "eleito" antes dos números', () => {
    const rotulo = ariaLabelUfMapa('São Paulo', DECIDIDO);
    expect(rotulo).toContain('eleito governador no 1º turno');
    expect(rotulo).toContain('62,65% dos votos válidos');
  });

  it('no estado em disputa diz que é pesquisa e marca o empate técnico', () => {
    const rotulo = ariaLabelUfMapa('Rio Grande do Norte', EM_DISPUTA);
    expect(rotulo).toContain('2º turno em 25 de outubro');
    expect(rotulo).toContain('lidera as pesquisas');
    expect(rotulo).toContain('sobre Cadu de Lula');
    expect(rotulo).toContain('empate técnico');
    // Empate técnico não anuncia vantagem em pontos — seria afirmar demais.
    expect(rotulo).not.toContain('pontos');
  });

  it('anuncia a vantagem em pontos quando NÃO é empate', () => {
    const folgado: MapaGovernadorUf = {
      ...EM_DISPUTA,
      disputa: { ...EM_DISPUTA.disputa!, vantagem: 18.65, empateTecnico: false },
    };
    // Vantagem de pesquisa fica com UMA casa: a segunda é ruído amostral.
    expect(ariaLabelUfMapa('Distrito Federal', folgado)).toContain('por 18,6 pontos');
  });

  it('mantém as duas casas do resultado oficial, que é número exato', () => {
    expect(ariaLabelUfMapa('São Paulo', DECIDIDO)).toContain('62,65% dos votos válidos');
  });

  it('não inventa casas onde a fonte publicou inteiro', () => {
    const inteiro: MapaGovernadorUf = {
      ...DECIDIDO,
      eleito: { nome: 'Eduardo Braide', partido: 'PSD', pctValidos: 54 },
    };
    const rotulo = ariaLabelUfMapa('Maranhão', inteiro);
    expect(rotulo).toContain('54% dos votos válidos');
    expect(rotulo).not.toContain('54,00');
  });

  it('não deixa zero à direita quando a fonte publicou uma casa', () => {
    const umaCasa: MapaGovernadorUf = {
      ...DECIDIDO,
      eleito: { nome: 'Dr. Furlan', partido: 'PSD', pctValidos: 62.7 },
    };
    expect(ariaLabelUfMapa('Amapá', umaCasa)).toContain('62,7% dos votos válidos');
  });

  it('sinaliza a ressalva da UF para quem usa leitor de tela', () => {
    const comRessalva: MapaGovernadorUf = { ...DECIDIDO, observacao: 'Registro sub judice.' };
    expect(ariaLabelUfMapa('Amapá', comRessalva)).toContain('ressalva');
  });

  it('no estado sem pesquisa do confronto real, diz isso em vez de "sem dados"', () => {
    const rotulo = ariaLabelUfMapa('Amazonas', SEM_DADOS);
    expect(rotulo).toContain('sem pesquisa do confronto definido pelas urnas');
  });
});

describe('textoComparacao', () => {
  it('compara na mesma base e diz o sentido do erro', () => {
    const texto = textoComparacao(DECIDIDO)!;
    expect(texto).toContain('Datafolha');
    expect(texto).toContain('acertou o vencedor');
    expect(texto).toContain('59,8% dos válidos');
    expect(texto).toContain('62,65%');
    expect(texto).toContain('a pesquisa subestimou');
  });

  it('diz "superestimou" quando a pesquisa dava mais do que a urna deu', () => {
    const superestimado: MapaGovernadorUf = {
      ...DECIDIDO,
      comparacao: {
        ...DECIDIDO.comparacao!,
        pctEleitoNasPesquisasValidos: 73.9,
        pctValidosUrnas: 67.1,
        erroEmPontos: -6.8,
      },
    };
    expect(textoComparacao(superestimado)!).toContain('a pesquisa superestimou');
  });

  it('nomeia quem a pesquisa apontava quando ela errou', () => {
    const errou: MapaGovernadorUf = {
      ...DECIDIDO,
      eleito: { nome: 'Douglas Ruas', partido: 'PL', pctValidos: 50.88 },
      comparacao: {
        ...DECIDIDO.comparacao!,
        liderNasPesquisas: 'Eduardo Paes',
        acertouOLider: false,
      },
    };
    const texto = textoComparacao(errou)!;
    expect(texto).toContain('apontava Eduardo Paes');
    expect(texto).not.toContain('acertou');
  });

  it('não inventa comparação onde não há resultado', () => {
    expect(textoComparacao(EM_DISPUTA)).toBeNull();
    expect(textoComparacao(SEM_DADOS)).toBeNull();
  });

  it('sem percentual comparável, fica só na afirmação sobre o líder', () => {
    const semPct: MapaGovernadorUf = {
      ...DECIDIDO,
      comparacao: {
        ...DECIDIDO.comparacao!,
        pctEleitoNasPesquisasValidos: null,
        erroEmPontos: null,
      },
    };
    const texto = textoComparacao(semPct)!;
    expect(texto).toContain('acertou o vencedor');
    expect(texto).not.toContain('dos válidos');
  });
});
