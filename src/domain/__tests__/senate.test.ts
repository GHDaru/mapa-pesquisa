import { describe, expect, it } from 'vitest';
import type { Agregado } from '../aggregate.js';
import { criarPartido, type Partido } from '../party.js';
import { UFS } from '../race.js';
import {
  type CadeiraSenado,
  criarCadeiraSenado,
  posicaoHemiciclo,
  projetarSenado,
} from '../senate.js';

const PARTIDOS: Partido[] = [
  criarPartido({ sigla: 'PT', nome: 'PT', numero: 13, espectro: 'esquerda' }),
  criarPartido({ sigla: 'PDT', nome: 'PDT', numero: 12, espectro: 'centro-esquerda' }),
  criarPartido({ sigla: 'MDB', nome: 'MDB', numero: 15, espectro: 'centro' }),
  criarPartido({ sigla: 'PSDB', nome: 'PSDB', numero: 45, espectro: 'centro-direita' }),
  criarPartido({ sigla: 'PL', nome: 'PL', numero: 22, espectro: 'direita' }),
];
const CICLO_PARTIDOS = PARTIDOS.map((p) => p.sigla);

function montarCadeiras(): CadeiraSenado[] {
  const cadeiras: CadeiraSenado[] = [];
  UFS.forEach((uf, i) => {
    cadeiras.push(
      criarCadeiraSenado({
        uf,
        senador: `Fixo ${uf}`,
        partido: CICLO_PARTIDOS[i % CICLO_PARTIDOS.length]!,
        mandatoInicio: 2023,
        mandatoFim: 2031,
        emDisputa2026: false,
        fonte: 'https://exemplo.test/fixo',
      }),
      criarCadeiraSenado({
        uf,
        senador: `Disputa1 ${uf}`,
        partido: CICLO_PARTIDOS[(i + 1) % CICLO_PARTIDOS.length]!,
        mandatoInicio: 2019,
        mandatoFim: 2027,
        emDisputa2026: true,
        fonte: 'https://exemplo.test/disputa1',
      }),
      criarCadeiraSenado({
        uf,
        senador: `Disputa2 ${uf}`,
        partido: CICLO_PARTIDOS[(i + 2) % CICLO_PARTIDOS.length]!,
        mandatoInicio: 2019,
        mandatoFim: 2027,
        emDisputa2026: true,
        fonte: 'https://exemplo.test/disputa2',
      }),
    );
  });
  return cadeiras;
}

function agregadoFake(
  candidatos: { candidato: string; partido: string | null; pct: number }[],
  margemReferencia = 3,
): Agregado {
  return {
    candidatos: candidatos.map((c) => ({ ...c, pesquisas: 1 })),
    margemReferencia,
  } as unknown as Agregado;
}

describe('domain/senate — criarCadeiraSenado', () => {
  it('cria uma cadeira válida', () => {
    const cadeira = criarCadeiraSenado({
      uf: 'SP',
      senador: 'Fulano',
      partido: 'PL',
      mandatoInicio: 2023,
      mandatoFim: 2031,
      emDisputa2026: false,
      fonte: 'https://exemplo.test',
    });
    expect(cadeira.uf).toBe('SP');
  });

  it('rejeita UF inválida', () => {
    expect(() =>
      criarCadeiraSenado({
        uf: 'XX',
        senador: 'Fulano',
        partido: 'PL',
        mandatoInicio: 2023,
        mandatoFim: 2031,
        emDisputa2026: false,
        fonte: '',
      }),
    ).toThrow();
  });
});

describe('domain/senate — projetarSenado', () => {
  const cadeiras = montarCadeiras();

  it('produz 81 assentos no total (27 fixas + 54 em disputa)', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    expect(projecao.assentos).toHaveLength(81);
  });

  it('mantém as 27 cadeiras não disputadas como origem "fixa" com o ocupante atual', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const fixas = projecao.assentos.filter((a) => a.origem === 'fixa');
    expect(fixas).toHaveLength(27);
    for (const uf of UFS) {
      const cadeiraFixa = cadeiras.find((c) => c.uf === uf && !c.emDisputa2026)!;
      const assento = fixas.find((a) => a.uf === uf)!;
      expect(assento.ocupante).toBe(cadeiraFixa.senador);
      expect(assento.partido).toBe(cadeiraFixa.partido);
    }
  });

  it('projeta as 2 cadeiras em disputa com os 2 primeiros do agregado de senador', () => {
    const agregadosPorUf = {
      SP: agregadoFake([
        { candidato: 'Candidata E', partido: 'PT', pct: 38 },
        { candidato: 'Candidato F', partido: 'PL', pct: 34 },
      ]),
    };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const assentosSp = projecao.assentos.filter((a) => a.uf === 'SP' && a.origem === 'projetada');
    expect(assentosSp).toHaveLength(2);
    expect(assentosSp.map((a) => a.ocupante).sort()).toEqual(['Candidata E', 'Candidato F'].sort());
  });

  it('marca as duas cadeiras como "indefinida" quando não há agregado para a UF', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const assentosAc = projecao.assentos.filter((a) => a.uf === 'AC' && a.origem !== 'fixa');
    expect(assentosAc).toHaveLength(2);
    for (const a of assentosAc) {
      expect(a.origem).toBe('indefinida');
      expect(a.ocupante).toBeNull();
      expect(a.partido).toBeNull();
      expect(a.espectro).toBe('indefinido');
    }
  });

  it('marca apenas a segunda cadeira como "indefinida" quando o agregado só tem 1 candidato', () => {
    const agregadosPorUf = { BA: agregadoFake([{ candidato: 'Único Candidato', partido: 'MDB', pct: 45 }]) };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const assentosBa = projecao.assentos.filter((a) => a.uf === 'BA' && a.origem !== 'fixa');
    expect(assentosBa).toHaveLength(2);
    const projetada = assentosBa.find((a) => a.origem === 'projetada')!;
    const indefinida = assentosBa.find((a) => a.origem === 'indefinida')!;
    expect(projetada.ocupante).toBe('Único Candidato');
    expect(indefinida.ocupante).toBeNull();
  });

  it('nunca inventa um vencedor: sem pesquisa, a cadeira fica indefinida (não "fixa" nem preenchida)', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const semDados = projecao.assentos.filter((a) => a.origem === 'indefinida');
    // Todas as 54 cadeiras em disputa ficam indefinidas quando não há nenhum agregado.
    expect(semDados).toHaveLength(54);
  });

  it('marca empateTecnico no primeiro assento em disputa quando a diferença para o 2º é pequena', () => {
    const agregadosPorUf = {
      SP: agregadoFake(
        [
          { candidato: 'Candidata E', partido: 'PT', pct: 36 },
          { candidato: 'Candidato F', partido: 'PL', pct: 34 },
        ],
        3,
      ),
    };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const primeiro = projecao.assentos.find((a) => a.uf === 'SP' && a.ocupante === 'Candidata E')!;
    expect(primeiro.empateTecnico).toBe(true);
  });

  it('confianca é null para cadeiras fixas e indefinidas', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const fixas = projecao.assentos.filter((a) => a.origem === 'fixa');
    const indefinidas = projecao.assentos.filter((a) => a.origem === 'indefinida');
    expect(fixas.length).toBeGreaterThan(0);
    expect(indefinidas.length).toBeGreaterThan(0);
    for (const a of [...fixas, ...indefinidas]) expect(a.confianca).toBeNull();
  });

  it('confianca é "empate" quando a vantagem para o próximo colocado está dentro da margem', () => {
    const agregadosPorUf = {
      SP: agregadoFake(
        [
          { candidato: 'Candidata E', partido: 'PT', pct: 36 },
          { candidato: 'Candidato F', partido: 'PL', pct: 34 },
        ],
        3,
      ),
    };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const primeiro = projecao.assentos.find((a) => a.uf === 'SP' && a.ocupante === 'Candidata E')!;
    expect(primeiro.confianca).toBe('empate');
  });

  it('confianca é "acirrada" quando a vantagem supera a margem mas é menor que o dobro dela', () => {
    const agregadosPorUf = {
      SP: agregadoFake(
        [
          { candidato: 'Candidata E', partido: 'PT', pct: 40 },
          { candidato: 'Candidato F', partido: 'PL', pct: 35 },
        ],
        3,
      ),
    };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const primeiro = projecao.assentos.find((a) => a.uf === 'SP' && a.ocupante === 'Candidata E')!;
    expect(primeiro.confianca).toBe('acirrada');
  });

  it('confianca é "folga" quando a vantagem é igual ou maior que o dobro da margem', () => {
    const agregadosPorUf = {
      SP: agregadoFake(
        [
          { candidato: 'Candidata E', partido: 'PT', pct: 50 },
          { candidato: 'Candidato F', partido: 'PL', pct: 20 },
        ],
        3,
      ),
    };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const primeiro = projecao.assentos.find((a) => a.uf === 'SP' && a.ocupante === 'Candidata E')!;
    expect(primeiro.confianca).toBe('folga');
  });

  it('confianca é null quando não há um próximo colocado para comparar (só 1 candidato no agregado)', () => {
    const agregadosPorUf = { BA: agregadoFake([{ candidato: 'Único Candidato', partido: 'MDB', pct: 45 }]) };
    const projecao = projetarSenado(cadeiras, agregadosPorUf, PARTIDOS);
    const projetada = projecao.assentos.find((a) => a.uf === 'BA' && a.origem === 'projetada')!;
    expect(projetada.confianca).toBeNull();
  });

  it('ordena os assentos da esquerda para a direita, com indefinido no centro', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const posicoes = projecao.assentos.map((a) => posicaoHemiciclo(a.espectro));
    for (let i = 1; i < posicoes.length; i++) {
      expect(posicoes[i]!).toBeGreaterThanOrEqual(posicoes[i - 1]!);
    }
    // 'indefinido' não deve estar na primeira nem na última posição do hemiciclo,
    // já que há partidos de esquerda e de direita presentes.
    const espectrosPresentes = new Set(projecao.assentos.map((a) => a.espectro));
    expect(espectrosPresentes.has('esquerda')).toBe(true);
    expect(espectrosPresentes.has('direita')).toBe(true);
    const primeiroEspectro = projecao.assentos[0]!.espectro;
    const ultimoEspectro = projecao.assentos.at(-1)!.espectro;
    expect(primeiroEspectro).not.toBe('indefinido');
    expect(ultimoEspectro).not.toBe('indefinido');
  });

  it('soma totalPorPartido e totalPorEspectro batem com a quantidade de assentos', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const somaPartido = Object.values(projecao.totalPorPartido).reduce((s, n) => s + n, 0);
    const somaEspectro = Object.values(projecao.totalPorEspectro).reduce(
      (s, n) => s + (n as number),
      0,
    );
    expect(somaEspectro).toBe(81);
    // totalPorPartido só conta assentos com partido definido (exclui indefinida).
    expect(somaPartido).toBe(81 - 54);
  });

  it('composicaoAtual reflete os 81 ocupantes de hoje, independente da projeção', () => {
    const projecao = projetarSenado(cadeiras, {}, PARTIDOS);
    const soma = Object.values(projecao.composicaoAtual.totalPorPartido).reduce((s, n) => s + n, 0);
    expect(soma).toBe(81);
  });
});
