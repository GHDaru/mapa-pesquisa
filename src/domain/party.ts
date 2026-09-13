import { type Espectro, ehEspectroValido } from './spectrum.js';

/**
 * Entidade Partido. Identidade = sigla (única no contexto).
 */
export interface Partido {
  readonly sigla: string;
  readonly nome: string;
  readonly numero: number;
  readonly espectro: Espectro;
  readonly federacao?: string;
  readonly cor?: string;
  readonly fonteClassificacao?: string;
  readonly observacao?: string;
}

export interface DadosPartido {
  sigla: string;
  nome: string;
  numero: number;
  espectro: string;
  federacao?: string | null;
  cor?: string | null;
  fonteClassificacao?: string | null;
  observacao?: string | null;
}

export class PartidoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PartidoInvalidoError';
  }
}

/**
 * Factory com validação. Lança PartidoInvalidoError com uma mensagem clara
 * identificando o partido problemático quando os dados são inválidos.
 */
export function criarPartido(dados: DadosPartido): Partido {
  const sigla = dados.sigla?.trim();
  if (!sigla) {
    throw new PartidoInvalidoError('Partido inválido: sigla não pode ser vazia.');
  }
  if (!dados.nome || !dados.nome.trim()) {
    throw new PartidoInvalidoError(`Partido "${sigla}" inválido: nome não pode ser vazio.`);
  }
  if (!Number.isFinite(dados.numero) || dados.numero <= 0) {
    throw new PartidoInvalidoError(`Partido "${sigla}" inválido: número deve ser positivo.`);
  }
  if (!ehEspectroValido(dados.espectro)) {
    throw new PartidoInvalidoError(
      `Partido "${sigla}" inválido: espectro "${dados.espectro}" não é reconhecido.`,
    );
  }

  const partido: Partido = {
    sigla,
    nome: dados.nome.trim(),
    numero: dados.numero,
    espectro: dados.espectro,
    ...(dados.federacao ? { federacao: dados.federacao } : {}),
    ...(dados.cor ? { cor: dados.cor } : {}),
    ...(dados.fonteClassificacao ? { fonteClassificacao: dados.fonteClassificacao } : {}),
    ...(dados.observacao ? { observacao: dados.observacao } : {}),
  };
  return partido;
}


/** Apelidos de siglas encontrados em fontes de imprensa → sigla canônica do cadastro. */
const APELIDOS_SIGLA: Readonly<Record<string, string>> = {
  'UNIÃO': 'União Brasil',
  'UNIAO': 'União Brasil',
  'UNIÃO BRASIL': 'União Brasil',
  'DEMOCRACIA CRISTÃ': 'DC',
  'PODE': 'Podemos',
  'PODEMOS': 'Podemos',
  'REPUBLICANOS': 'Republicanos',
  'SOLIDARIEDADE': 'Solidariedade',
  'SD': 'Solidariedade',
  'CIDADANIA': 'Cidadania',
  'AVANTE': 'Avante',
  'NOVO': 'Novo',
  'REDE': 'Rede',
  'MISSÃO': 'Missão',
  'MISSAO': 'Missão',
  'MOBILIZA': 'Mobiliza',
  'AGIR': 'Agir',
  'PC DO B': 'PCdoB',
  'PCDOB': 'PCdoB',
  'SEM PARTIDO': 'Sem Partido',
  'S/PARTIDO': 'Sem Partido',
};

/** Normaliza a sigla de partido vinda de fontes externas; null/vazio permanece null. */
export function normalizarSigla(sigla: string | null | undefined): string | null {
  if (sigla == null) return null;
  const limpa = sigla.trim();
  if (!limpa) return null;
  return APELIDOS_SIGLA[limpa.toUpperCase()] ?? limpa;
}
