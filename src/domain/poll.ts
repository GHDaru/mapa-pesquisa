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
  pct: number;
}

export interface DadosPesquisa {
  id: string;
  uf: string;
  cargo: Cargo;
  turno: 1 | 2;
  instituto: string;
  registroTSE?: string | null;
  contratante?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  publicadoEm: string;
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
  readonly dataInicio: string;
  readonly dataFim?: string;
  readonly publicadoEm: string;
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
  return pesquisa.dataFim ?? pesquisa.publicadoEm;
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

  validarDataIso(id, 'dataInicio', dados.dataInicio);
  validarDataIso(id, 'publicadoEm', dados.publicadoEm);
  if (dados.dataFim != null) {
    validarDataIso(id, 'dataFim', dados.dataFim);
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

  const resultados: ResultadoCandidato[] = dados.resultados.map((r, idx) => {
    if (!r.candidato || !r.candidato.trim()) {
      throw new PesquisaInvalidaError(id, `resultados[${idx}].candidato não pode ser vazio.`);
    }
    if (!Number.isFinite(r.pct) || r.pct < 0 || r.pct > 100) {
      throw new PesquisaInvalidaError(
        id,
        `resultados[${idx}].pct deve estar entre 0 e 100, recebido "${r.pct}" (${r.candidato}).`,
      );
    }
    return {
      candidato: r.candidato.trim(),
      partido: r.partido ?? null,
      pct: r.pct,
    };
  });

  const pesquisa: Pesquisa = {
    id,
    disputa,
    instituto: dados.instituto.trim(),
    registroTSE: criarRegistroTSE(dados.registroTSE),
    dataInicio: dados.dataInicio,
    publicadoEm: dados.publicadoEm,
    fonte: { nome: dados.fonte.nome.trim(), url: dados.fonte.url.trim() },
    resultados,
    ...(dados.dataFim != null ? { dataFim: dados.dataFim } : {}),
    ...(dados.contratante ? { contratante: dados.contratante } : {}),
    ...(dados.amostra != null ? { amostra: dados.amostra } : {}),
    ...(dados.margem != null ? { margem: dados.margem } : {}),
    ...(dados.cenario ? { cenario: dados.cenario } : {}),
    ...(dados.observacao ? { observacao: dados.observacao } : {}),
  };

  return pesquisa;
}
