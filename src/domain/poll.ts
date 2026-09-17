import { normalizarSigla } from './party.js';
import { type Cargo, type Disputa, criarDisputa } from './race.js';

/**
 * RegistroTSE — value object. Uma pesquisa sem registro TSE conhecido é
 * aceita (não é erro estrutural) mas fica marcada `naoRegistrada: true`.
 */
export type RegistroTSE =
  | { readonly naoRegistrada: false; readonly valor: string }
  | { readonly naoRegistrada: true };

export function criarRegistroTSE(valor: string | null | undefined): RegistroTSE {
  if (valor && valor.trim()) {
    return { naoRegistrada: false, valor: valor.trim() };
  }
  return { naoRegistrada: true };
}

export interface Fonte {
  readonly nome: string;
  readonly url: string;
}

export interface ResultadoCandidato {
  readonly candidato: string;
  readonly partido: string | null;
  readonly pct: number;
}

export interface DadosResultadoCandidato {
  candidato: string;
  partido?: string | null;
  /** null quando a fonte não informou o percentual; o resultado é descartado na validação. */
  pct: number | null;
}

export interface DadosPesquisa {
  id: string;
  uf: string;
  cargo: Cargo;
  turno: 1 | 2;
  instituto: string;
  registroTSE?: string | null;
  contratante?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  publicadoEm?: string | null;
  amostra?: number | null;
  margem?: number | null;
  cenario?: string | null;
  fonte: Fonte;
  resultados: DadosResultadoCandidato[];
  observacao?: string | null;
}

export interface Pesquisa {
  readonly id: string;
  readonly disputa: Disputa;
  readonly instituto: string;
  readonly registroTSE: RegistroTSE;
  readonly contratante?: string;
  readonly dataInicio?: string;
  readonly dataFim?: string;
  readonly publicadoEm?: string;
  readonly amostra?: number;
  readonly margem?: number;
  readonly cenario?: string;
  readonly fonte: Fonte;
  readonly resultados: readonly ResultadoCandidato[];
  readonly observacao?: string;
}

export class PesquisaInvalidaError extends Error {
  constructor(id: string, message: string) {
    super(`Pesquisa "${id}" inválida: ${message}`);
    this.name = 'PesquisaInvalidaError';
  }
}

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validarDataIso(id: string, campo: string, valor: string): void {
  if (!DATA_ISO_REGEX.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw new PesquisaInvalidaError(id, `campo "${campo}" deve ser uma data ISO (YYYY-MM-DD), recebido "${valor}".`);
  }
}

/** Data de referência da pesquisa para fins de recência: fim de campo ou, na ausência, publicação. */
export function dataReferencia(pesquisa: Pesquisa): string {
  // A validação garante que ao menos uma das datas existe.
  return pesquisa.dataFim ?? pesquisa.publicadoEm ?? pesquisa.dataInicio ?? '';
}

/**
 * Factory com validação completa de uma Pesquisa a partir de dados brutos
 * (ex.: linha de data/polls.json). Lança PesquisaInvalidaError com o id da
 * pesquisa na mensagem quando os dados são inválidos.
 */
export function criarPesquisa(dados: DadosPesquisa): Pesquisa {
  const id = dados.id?.trim();
  if (!id) {
    throw new PesquisaInvalidaError(dados.id ?? '(sem id)', 'id não pode ser vazio.');
  }

  const disputa = criarDisputa(dados.uf, dados.cargo, dados.turno);

  if (!dados.instituto || !dados.instituto.trim()) {
    throw new PesquisaInvalidaError(id, 'instituto não pode ser vazio.');
  }

  if (dados.dataInicio != null) validarDataIso(id, 'dataInicio', dados.dataInicio);
  if (dados.publicadoEm != null) validarDataIso(id, 'publicadoEm', dados.publicadoEm);
  if (dados.dataFim != null) validarDataIso(id, 'dataFim', dados.dataFim);
  if (dados.dataFim == null && dados.publicadoEm == null && dados.dataInicio == null) {
    throw new PesquisaInvalidaError(id, 'a pesquisa precisa de ao menos uma data (dataFim, publicadoEm ou dataInicio).');
  }

  if (!dados.fonte || !dados.fonte.nome?.trim() || !dados.fonte.url?.trim()) {
    throw new PesquisaInvalidaError(id, 'fonte deve ter nome e url preenchidos.');
  }

  if (dados.amostra != null) {
    if (!Number.isFinite(dados.amostra) || dados.amostra <= 0) {
      throw new PesquisaInvalidaError(id, `amostra deve ser um número positivo, recebido "${dados.amostra}".`);
    }
  }

  if (dados.margem != null) {
    if (!Number.isFinite(dados.margem) || dados.margem < 0) {
      throw new PesquisaInvalidaError(id, `margem deve ser um número não negativo, recebido "${dados.margem}".`);
    }
  }

  if (!Array.isArray(dados.resultados) || dados.resultados.length === 0) {
    throw new PesquisaInvalidaError(id, 'resultados não pode ser vazio.');
  }

  const resultados: ResultadoCandidato[] = dados.resultados.flatMap((r, idx): ResultadoCandidato[] => {
    if (!r.candidato || !r.candidato.trim()) {
      throw new PesquisaInvalidaError(id, `resultados[${idx}].candidato não pode ser vazio.`);
    }
    // Percentual não informado pela fonte: o candidato é descartado, nunca inventado.
    if (r.pct == null) return [];
    if (!Number.isFinite(r.pct) || r.pct < 0 || r.pct > 100) {
      throw new PesquisaInvalidaError(
        id,
        `resultados[${idx}].pct deve estar entre 0 e 100, recebido "${r.pct}" (${r.candidato}).`,
      );
    }
    return [{
      candidato: normalizarCandidato(r.candidato),
      partido: normalizarSigla(r.partido),
      pct: r.pct,
    }];
  });
  if (resultados.length === 0) {
    throw new PesquisaInvalidaError(id, 'nenhum resultado com percentual informado.');
  }

  const pesquisa: Pesquisa = {
    id,
    disputa,
    instituto: normalizarInstituto(dados.instituto),
    registroTSE: criarRegistroTSE(dados.registroTSE),
    fonte: { nome: dados.fonte.nome.trim(), url: dados.fonte.url.trim() },
    resultados,
    ...(dados.dataInicio != null ? { dataInicio: dados.dataInicio } : {}),
    ...(dados.publicadoEm != null ? { publicadoEm: dados.publicadoEm } : {}),
    ...(dados.dataFim != null ? { dataFim: dados.dataFim } : {}),
    ...(dados.contratante ? { contratante: dados.contratante } : {}),
    ...(dados.amostra != null ? { amostra: dados.amostra } : {}),
    ...(dados.margem != null ? { margem: dados.margem } : {}),
    ...(dados.cenario ? { cenario: dados.cenario } : {}),
    ...(dados.observacao ? { observacao: dados.observacao } : {}),
  };

  return pesquisa;
}


/** Grafias diferentes do mesmo instituto encontradas nas fontes → nome canônico. */
const APELIDOS_INSTITUTO: Readonly<Record<string, string>> = {
  'instituto veritá': 'Instituto Veritá',
  'veritá': 'Instituto Veritá',
  'instituto anova': 'Anova',
  'anova (pb agora)': 'Anova',
  'anova': 'Anova',
  'instituto brasil dados': 'Brasil Dados',
  'brasil dados': 'Brasil Dados',
  'instituto ranking brasil inteligência': 'Ranking Brasil Inteligência',
  'ranking brasil inteligência': 'Ranking Brasil Inteligência',
  'ideia (meio/ideia)': 'Ideia',
  'ideia': 'Ideia',
  'futura/100% cidades': 'Futura Inteligência',
  'futura inteligência': 'Futura Inteligência',
  'atlasintel/meionorte': 'AtlasIntel',
  'atlasintel': 'AtlasIntel',
};

/** Normaliza o nome do instituto; mantém o original (aparado) quando não há apelido conhecido. */
export function normalizarInstituto(instituto: string): string {
  const limpo = instituto.trim();
  return APELIDOS_INSTITUTO[limpo.toLowerCase()] ?? limpo;
}

/**
 * Grafias diferentes do mesmo candidato → nome canônico.
 *
 * A agregação em `aggregate.ts` agrupa por `candidato.toLowerCase().trim()`,
 * então "Lula" e "Luiz Inácio Lula da Silva" virariam dois candidatos e a
 * média de cada um sairia errada (foi o que quase aconteceu com a Datafolha
 * de 17/09). Só entram aqui grafias que a imprensa usa de fato.
 */
const APELIDOS_CANDIDATO: Readonly<Record<string, string>> = {
  'lula': 'Luiz Inácio Lula da Silva',
  'luiz inacio lula da silva': 'Luiz Inácio Lula da Silva',
  'luiz inácio lula da silva (lula)': 'Luiz Inácio Lula da Silva',
  'presidente lula': 'Luiz Inácio Lula da Silva',
  'flávio': 'Flávio Bolsonaro',
  'flavio bolsonaro': 'Flávio Bolsonaro',
  'senador flávio bolsonaro': 'Flávio Bolsonaro',
  'cury': 'Augusto Cury',
  'caiado': 'Ronaldo Caiado',
  'zema': 'Romeu Zema',
  'renan': 'Renan Santos',
};

/** Normaliza o nome do candidato; mantém o original (aparado) quando não há apelido conhecido. */
export function normalizarCandidato(candidato: string): string {
  const limpo = candidato.trim();
  return APELIDOS_CANDIDATO[limpo.toLowerCase()] ?? limpo;
}
