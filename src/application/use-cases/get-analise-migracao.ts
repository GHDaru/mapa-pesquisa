import type { AnaliseRepository } from '../ports.js';
import {
  comparecimentoNovoParaLula,
  deslocamentoDaMargem,
  margem1TDoisCandidatos,
  margem2T,
  margemVerdadeira,
  medidasDaArea,
  somarContagens,
  tetoDeX,
  xExigido,
  zerosCriadosPeloGerador,
  type AreaMedida,
  type DadosAnalise,
  type Malha,
  type SecaoZerada,
  type TaxaNacional,
} from '../../domain/migracao.js';

/** Um cenário contrafactual e o X que ele exigiria, com e sem o comparecimento novo. */
export interface CenarioDeX {
  readonly rotulo: string;
  readonly margemAlvo: number;
  readonly x: number;
  readonly xSemComparecimento: number;
}

/** Um valor de X e o que ele deixaria de pé. */
export interface TetoDeX {
  readonly rotulo: string;
  readonly x: number;
  readonly votosIntocados: number;
  readonly margemVerdadeira: number;
  readonly lider: 'Lula' | 'Flávio' | 'empate';
  readonly votosDeMargem: number;
  readonly pctDoDeslocamento: number;
  readonly zerosCriados: number;
  readonly pDosVotosIntocados: number;
}

export interface ResumoDoX {
  readonly teto: number;
  readonly minimo: number;
  readonly maximo: number;
  readonly mediaPonderada: number;
  readonly acimaDoTeto: number;
  readonly unidades: number;
  readonly correlacaoComFlavio: number;
  readonly deslocamento: number;
  readonly comparecimentoLiquido: number;
  readonly votosPorDoisPontos: number;
}

export interface AnaliseMigracao {
  readonly pais: AreaMedida;
  readonly estados: readonly AreaMedida[];
  readonly municipios: readonly AreaMedida[];
  readonly malha: Malha;
  readonly taxas: readonly TaxaNacional[];
  readonly cenarios: readonly CenarioDeX[];
  readonly tetos: readonly TetoDeX[];
  readonly zeradas: readonly SecaoZerada[];
  readonly resumoDoX: ResumoDoX;
  readonly municipiosSemArea: number;
  readonly votosSemArea: number;
}

function medir<T extends Parameters<typeof medidasDaArea>[0] & { cod: string | null; uf: string; nome: string }>(
  area: T,
): AreaMedida {
  return { ...area, ...medidasDaArea(area) };
}

function correlacao(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  if (n < 2 || b.length !== n) return Number.NaN;
  const media = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = media(a);
  const mb = media(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = (a[i] as number) - ma;
    const db = (b[i] as number) - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : Number.NaN;
}

/**
 * Monta a análise a partir dos dados já carregados. Função pura — é aqui que
 * os testes entram, sem precisar do carregamento assíncrono.
 *
 * As margens do 1º turno usadas como alvo são sempre as de DOIS CANDIDATOS
 * (ver a nota de base em domain/migracao.ts). Misturar com a margem sobre
 * todos os válidos, que é a que se publica, dá um X menor e errado.
 */
export function montarAnalise(dados: DadosAnalise): AnaliseMigracao {
  const { estados, municipios, malha, gerador } = dados;
  const contagensDoPais = somarContagens(estados);
  const pais = medir({ ...contagensDoPais, cod: null, uf: 'BR', nome: 'O país' });

  const m2 = margem2T(contagensDoPais);
  const m1 = margem1TDoisCandidatos(contagensDoPais);
  if (m2 === null || m1 === null) {
    throw new Error('análise: o país ficou sem margem — data/analise/estados.json está vazio ou zerado.');
  }
  const desloc = (deslocamentoDaMargem(contagensDoPais) as number);

  // O canal do comparecimento, para a coluna "sem ele": quanto dos eleitores
  // novos foi para Lula, com a taxa de cada estado, e qual margem sobraria se
  // esse canal saísse da conta dos dois lados.
  const paraLula = comparecimentoNovoParaLula(estados);
  const paraFlavio = contagensDoPais.comparecimentoNovo - paraLula;
  const validosSem = contagensDoPais.validos2T - contagensDoPais.comparecimentoNovo;
  const m2Sem =
    validosSem > 0
      ? (100 * (contagensDoPais.lula2T - paraLula - (contagensDoPais.flavio2T - paraFlavio))) / validosSem
      : m2;

  const alvos: readonly { rotulo: string; alvo: number }[] = [
    { rotulo: 'O 2º turno era empate, 50 a 50', alvo: 0 },
    { rotulo: 'O 2º turno repetia o 1º, na base de dois candidatos', alvo: m1 },
    { rotulo: 'O 2º turno dava o que o agregado das pesquisas dizia', alvo: gerador.margemDoAgregadoDePesquisas },
  ];
  const cenarios: CenarioDeX[] = alvos.map(({ rotulo, alvo }) => ({
    rotulo,
    margemAlvo: alvo,
    x: xExigido(m2, alvo),
    xSemComparecimento: xExigido(m2Sem, alvo),
  }));

  const intocados2T = gerador.secoesZeradas.find((z) => z.caso === 'lula');
  const votos2T = intocados2T?.votosDoAdversario2T ?? 0;
  const votosDoisTurnos = votos2T + (intocados2T?.votosDoAdversario1T ?? 0);
  const teto = tetoDeX(votos2T, gerador.nivelDoTeto);

  const candidatos: readonly { rotulo: string; x: number; n: number }[] = [
    { rotulo: 'Teto das seções com Lula zerado, só o 2º turno', x: teto, n: votos2T },
    { rotulo: 'Teto das mesmas seções, somando os dois turnos', x: tetoDeX(votosDoisTurnos, gerador.nivelDoTeto), n: votosDoisTurnos },
    { rotulo: 'O X que empataria o 2º turno', x: xExigido(m2, 0), n: votos2T },
    { rotulo: 'O X que faria o agregado das pesquisas acertar', x: xExigido(m2, gerador.margemDoAgregadoDePesquisas), n: votos2T },
  ];
  const tetos: TetoDeX[] = candidatos.map(({ rotulo, x, n }) => {
    const verdadeira = margemVerdadeira(m2, x);
    return {
      rotulo,
      x,
      votosIntocados: n,
      margemVerdadeira: verdadeira,
      lider: verdadeira > 1e-9 ? 'Lula' : verdadeira < -1e-9 ? 'Flávio' : 'empate',
      votosDeMargem: Math.round((Math.abs(verdadeira) / 100) * contagensDoPais.validos2T),
      pctDoDeslocamento: (100 * (m2 - verdadeira)) / desloc,
      zerosCriados: zerosCriadosPeloGerador(gerador.flavioPorSecao, x),
      pDosVotosIntocados: Math.pow(1 - x / 100, n),
    };
  });

  const medidos = estados.map(medir);
  const comX = medidos.filter((e) => e.xExigido !== null && e.pctFlavio1TDoisCandidatos !== null);
  const xs = comX.map((e) => e.xExigido as number);
  const pesos = comX.reduce((a, e) => a + e.validos2T, 0);
  const resumoDoX: ResumoDoX = {
    teto,
    minimo: xs.length ? Math.min(...xs) : Number.NaN,
    maximo: xs.length ? Math.max(...xs) : Number.NaN,
    mediaPonderada: pesos > 0 ? comX.reduce((a, e) => a + (e.xExigido as number) * e.validos2T, 0) / pesos : Number.NaN,
    acimaDoTeto: xs.filter((v) => v > teto).length,
    unidades: xs.length,
    correlacaoComFlavio: correlacao(
      comX.map((e) => e.ganhoDoisCandidatos as number),
      comX.map((e) => e.pctFlavio1TDoisCandidatos as number),
    ),
    deslocamento: desloc,
    comparecimentoLiquido: (100 * (paraLula - paraFlavio)) / contagensDoPais.validos2T,
    votosPorDoisPontos: 0.02 * contagensDoPais.validos2T,
  };

  const comArea = new Set(malha.municipios.map((m) => m.cod));
  const semArea = municipios.filter((m) => m.uf !== 'ZZ' && (m.cod === null || !comArea.has(m.cod)));

  return {
    pais,
    estados: medidos,
    municipios: municipios.map(medir),
    malha,
    taxas: gerador.taxasNacionais,
    cenarios,
    tetos,
    zeradas: gerador.secoesZeradas,
    resumoDoX,
    municipiosSemArea: semArea.length,
    votosSemArea: semArea.reduce((a, m) => a + m.validos1T, 0),
  };
}

/**
 * Caso de uso assíncrono: os dados da análise são ~2 MB e só interessam a
 * quem abre a tela, então o repositório os carrega sob demanda e o resultado
 * fica em cache na primeira chamada.
 */
export function criarGetAnaliseMigracao(repo: AnaliseRepository): () => Promise<AnaliseMigracao> {
  let cache: AnaliseMigracao | null = null;
  return async (): Promise<AnaliseMigracao> => {
    if (cache === null) cache = montarAnalise(await repo.carregar());
    return cache;
  };
}
