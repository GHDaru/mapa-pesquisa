import { dataReferencia, type Pesquisa } from './poll.js';
import { CARGOS_VALIDOS, type Cargo, UF_NACIONAL, UFS } from './race.js';

/**
 * Serviço de domínio: "resumo do dia" da base de pesquisas, para a capa
 * explicativa da home (`views/home-view.ts`). Puro — sem I/O, sem depender
 * de partidos/eleitorado (esses números chegam prontos de outros
 * repositórios, ver `application/use-cases/get-daily-digest.ts`).
 *
 * Deliberadamente NÃO carrega nome de candidato, percentual, projeção de
 * cadeira nem estimativa de votos — só metadados sobre a base em si
 * (quantidade, cobertura, proveniência), a decisão de produto por trás da
 * mudança de conteúdo da home (ver docs/briefing-landing-page.md).
 */

/** Janela de recência para "o que entrou na última atualização": 3 dias até `atualizadoEm`, inclusive. */
export const JANELA_NOVIDADES_DIAS = 3;

/** 27 UFs × 3 cadeiras cada — total de cadeiras do Senado que o site mapeia (fixas + projetadas), não um resultado. */
export const TOTAL_CADEIRAS_SENADO = UFS.length * 3;

export interface NovidadesUltimaAtualizacao {
  readonly total: number;
  readonly porCargo: Readonly<Record<Cargo, number>>;
  /** UFs distintas das pesquisas novas (pode incluir "BR"), ordem alfabética. */
  readonly ufs: readonly string[];
  /** Institutos distintos das pesquisas novas, ordem alfabética. */
  readonly institutos: readonly string[];
}

export interface DigestDiario {
  /** Data ISO (YYYY-MM-DD) da última atualização do site (`meta.atualizadoEm`). */
  readonly dataAtualizacao: string;
  /** Maior `dataReferencia` entre todas as pesquisas conhecidas; null se não houver pesquisa. */
  readonly dataMaisRecente: string | null;
  readonly novasNaUltimaAtualizacao: NovidadesUltimaAtualizacao;
  readonly totalPesquisas: number;
  /** UFs distintas com pesquisa de governador OU senador (exclui "BR" — presidente não conta aqui). */
  readonly ufsCobertas: number;
  /** Institutos distintos na base (qualquer cargo). */
  readonly institutos: number;
  readonly comRegistroTSE: number;
  /** 0..100; 0 quando não há nenhuma pesquisa. */
  readonly percentualComRegistro: number;
  /** Partidos cadastrados — vem de `PartyRepository`, não das pesquisas. */
  readonly partidos: number;
  /** Cadeiras do Senado mapeadas pelo site (constante estrutural, ver `TOTAL_CADEIRAS_SENADO`). */
  readonly cadeirasSenado: number;
  /** Soma do eleitorado cadastrado (TSE); null quando não há nenhuma UF com eleitorado conhecido. */
  readonly eleitoradoTotal: number | null;
}

export interface EntradaDigest {
  readonly pesquisas: readonly Pesquisa[];
  /** Data ISO (YYYY-MM-DD) de `meta.atualizadoEm`. */
  readonly atualizadoEm: string;
  readonly totalPartidos: number;
  readonly eleitoradoTotal: number | null;
}

/** Data de referência usada para decidir se uma pesquisa é "nova": publicação, com fallback para o fim de campo. */
function dataNovidade(p: Pesquisa): string | undefined {
  return p.publicadoEm ?? p.dataFim;
}

/** `dataIso` menos `dias` dias, em ISO (YYYY-MM-DD). Aritmética em UTC para não sofrer deslocamento de fuso. */
function dataMenosDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

function ordenarAlfabetico(valores: Iterable<string>): readonly string[] {
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Monta o resumo do dia a partir de todas as pesquisas conhecidas e da data
 * de atualização do site. Nunca inventa: quando não há pesquisa nenhuma,
 * `dataMaisRecente` fica null e todas as contagens ficam em zero.
 */
export function montarDigestDiario(entrada: EntradaDigest): DigestDiario {
  const { pesquisas, atualizadoEm, totalPartidos, eleitoradoTotal } = entrada;

  let dataMaisRecente: string | null = null;
  let comRegistroTSE = 0;
  const setInstitutos = new Set<string>();
  const setUfsGovSenador = new Set<string>();

  for (const p of pesquisas) {
    const referencia = dataReferencia(p);
    if (referencia && (dataMaisRecente == null || referencia > dataMaisRecente)) {
      dataMaisRecente = referencia;
    }
    if (!p.registroTSE.naoRegistrada) comRegistroTSE += 1;
    setInstitutos.add(p.instituto);
    if ((p.disputa.cargo === 'governador' || p.disputa.cargo === 'senador') && p.disputa.uf !== UF_NACIONAL) {
      setUfsGovSenador.add(p.disputa.uf);
    }
  }

  const limiteInferior = dataMenosDias(atualizadoEm, JANELA_NOVIDADES_DIAS);
  const novas = pesquisas.filter((p) => {
    const referencia = dataNovidade(p);
    return referencia != null && referencia >= limiteInferior && referencia <= atualizadoEm;
  });

  const porCargo = Object.fromEntries(CARGOS_VALIDOS.map((cargo) => [cargo, 0])) as Record<Cargo, number>;
  const ufsNovas = new Set<string>();
  const institutosNovos = new Set<string>();
  for (const p of novas) {
    porCargo[p.disputa.cargo] += 1;
    ufsNovas.add(p.disputa.uf);
    institutosNovos.add(p.instituto);
  }

  const totalPesquisas = pesquisas.length;
  const percentualComRegistro = totalPesquisas === 0 ? 0 : (comRegistroTSE / totalPesquisas) * 100;

  return {
    dataAtualizacao: atualizadoEm,
    dataMaisRecente,
    novasNaUltimaAtualizacao: {
      total: novas.length,
      porCargo,
      ufs: ordenarAlfabetico(ufsNovas),
      institutos: ordenarAlfabetico(institutosNovos),
    },
    totalPesquisas,
    ufsCobertas: setUfsGovSenador.size,
    institutos: setInstitutos.size,
    comRegistroTSE,
    percentualComRegistro,
    partidos: totalPartidos,
    cadeirasSenado: TOTAL_CADEIRAS_SENADO,
    eleitoradoTotal,
  };
}
