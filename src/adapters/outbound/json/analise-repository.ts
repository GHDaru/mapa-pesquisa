import type { AnaliseRepository } from '../../../application/ports.js';
import type {
  AreaDaAnalise,
  ConstantesDoGerador,
  ContornoDaArea,
  DadosAnalise,
  EstadoDaAnalise,
  Malha,
} from '../../../domain/migracao.js';

/**
 * Formato colunar de data/analise/municipios.json: `campos` nomeia as colunas
 * e cada linha é um array na mesma ordem. São 5.715 linhas — repetir 24 nomes
 * de campo em cada uma custava 4,6 MB contra 0,7 MB assim, e o arquivo vai no
 * repositório.
 */
interface TabelaColunar {
  readonly campos: readonly string[];
  readonly linhas: readonly (readonly (string | number)[])[];
}

interface MalhaJson {
  readonly largura: number;
  readonly altura: number;
  readonly ufs: readonly { readonly uf: string; readonly nome: string; readonly d: string }[];
  readonly municipios: TabelaColunar;
}

const CAMPOS_DE_CONTAGEM = [
  'secoes', 'aptos1T', 'aptos2T', 'comparecimento1T', 'comparecimento2T',
  'validos1T', 'validos2T', 'lula1T', 'flavio1T', 'lula2T', 'flavio2T',
  'blocoEliminado1T', 'brancoNuloRecuperado', 'comparecimentoNovo',
  'cury1T', 'renan1T', 'caiado1T', 'zema1T', 'outrosEliminados1T',
  'deOutrasOrigens', 'travessiaLiquida',
] as const;

/**
 * Expande a tabela colunar em objetos, conferindo o cabeçalho contra os
 * campos que o domínio espera. Um arquivo regenerado com uma coluna a menos
 * (ou em outra ordem) falha aqui, com o nome do campo que faltou, em vez de
 * produzir uma tela de `undefined` silenciosos.
 */
export function expandirMunicipios(tabela: TabelaColunar): readonly AreaDaAnalise[] {
  const esperados = ['cod', 'uf', 'nome', ...CAMPOS_DE_CONTAGEM];
  const faltando = esperados.filter((c) => !tabela.campos.includes(c));
  if (faltando.length > 0) {
    throw new Error(
      `analise/municipios.json inválido: faltam as colunas ${faltando.join(', ')}.`,
    );
  }
  const indice = new Map(tabela.campos.map((campo, i) => [campo, i]));
  const posicao = (campo: string): number => indice.get(campo) as number;
  const iCod = posicao('cod');
  const iUf = posicao('uf');
  const iNome = posicao('nome');
  const posicoes = CAMPOS_DE_CONTAGEM.map((campo) => [campo, posicao(campo)] as const);

  return tabela.linhas.map((linha, n) => {
    if (linha.length !== tabela.campos.length) {
      throw new Error(
        `analise/municipios.json inválido: linha ${n} tem ${linha.length} valores para ${tabela.campos.length} colunas.`,
      );
    }
    const area: Record<string, string | number | null> = {
      cod: String(linha[iCod]),
      uf: String(linha[iUf]),
      nome: String(linha[iNome]),
    };
    for (const [campo, i] of posicoes) {
      const valor = linha[i];
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        throw new Error(
          `analise/municipios.json inválido: "${campo}" da linha ${n} não é número (${String(valor)}).`,
        );
      }
      area[campo] = valor;
    }
    return area as unknown as AreaDaAnalise;
  });
}

function montarMalha(json: MalhaJson, nomePorCod: ReadonlyMap<string, string>): Malha {
  const municipios: ContornoDaArea[] = [];
  const indice = new Map(json.municipios.campos.map((campo, i) => [campo, i]));
  const iCod = indice.get('cod');
  const iUf = indice.get('uf');
  const iD = indice.get('d');
  if (iCod === undefined || iUf === undefined || iD === undefined) {
    throw new Error('analise/malha.json inválido: a tabela de municípios precisa das colunas cod, uf e d.');
  }
  for (const linha of json.municipios.linhas) {
    const cod = String(linha[iCod]);
    municipios.push({
      cod,
      uf: String(linha[iUf]),
      nome: nomePorCod.get(cod) ?? cod,
      d: String(linha[iD]),
    });
  }
  return {
    largura: json.largura,
    altura: json.altura,
    ufs: json.ufs.map((u) => ({ cod: u.uf, uf: u.uf, nome: u.nome, d: u.d })),
    municipios,
  };
}

/**
 * AnaliseRepository que importa data/analise/*.json sob demanda. Os quatro
 * `import()` ficam dentro de `carregar` de propósito: é o que faz o Vite
 * separá-los num chunk próprio, fora do bundle inicial.
 */
export function criarAnaliseRepositoryJson(): AnaliseRepository {
  return {
    async carregar(): Promise<DadosAnalise> {
      const [estadosMod, municipiosMod, malhaMod, geradorMod] = await Promise.all([
        import('../../../../data/analise/estados.json'),
        import('../../../../data/analise/municipios.json'),
        import('../../../../data/analise/malha.json'),
        import('../../../../data/analise/gerador.json'),
      ]);
      const estados = estadosMod.default as unknown as readonly EstadoDaAnalise[];
      if (!Array.isArray(estados) || estados.length === 0) {
        throw new Error('analise/estados.json inválido: esperava uma lista de unidades da federação.');
      }
      const municipios = expandirMunicipios(municipiosMod.default as unknown as TabelaColunar);
      const nomePorCod = new Map(municipios.map((m) => [m.cod as string, m.nome]));
      return {
        estados,
        municipios,
        malha: montarMalha(malhaMod.default as unknown as MalhaJson, nomePorCod),
        gerador: geradorMod.default as unknown as ConstantesDoGerador,
      };
    },
  };
}
