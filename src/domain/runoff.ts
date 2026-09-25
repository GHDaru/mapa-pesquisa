import { ehLinhaNaoCandidato } from './aggregate.js';
import type { Pesquisa } from './poll.js';

/**
 * Value object `Confronto` — o conjunto de candidatos efetivamente testados
 * em uma pesquisa de 2º turno. Domínio puro — sem I/O.
 *
 * Por que existe: antes da definição oficial dos dois finalistas, os
 * institutos testam vários confrontos hipotéticos de 2º turno na MESMA
 * disputa (`uf` + `cargo` + `turno` 2). Filtrar só por `turno === 2` mistura
 * "Lula x Flávio Bolsonaro" com "Lula x Augusto Cury", "Lula x Ronaldo
 * Caiado", "Lula x Romeu Zema" e "Lula x Renan Santos" — números de eleições
 * diferentes somados no mesmo agregado. O recorte correto é o confronto.
 *
 * A comparação é feita sobre uma chave canônica (minúsculas, sem acento,
 * espaços colapsados, nomes em ordem alfabética), então a ordem dos nomes e
 * variações de grafia/acentuação entre institutos não criam confrontos
 * duplicados. Linhas que não são candidato (brancos, nulos, "não sabe",
 * "outros"...) nunca entram no confronto — `ehLinhaNaoCandidato` as descarta.
 */
export type Confronto = readonly string[];

/** Nome canônico do candidato do PT (ver data/polls.json). */
export const LULA = 'Luiz Inácio Lula da Silva';

/** Nome canônico do candidato do PL (ver data/polls.json). */
export const FLAVIO_BOLSONARO = 'Flávio Bolsonaro';

/**
 * O confronto de 2º turno presidencial acompanhado pelo site: Lula x Flávio
 * Bolsonaro. É o único cenário de 2º turno com pesquisa em todas as 27 UFs;
 * os demais (Cury, Caiado, Zema, Renan Santos) existem só no nacional (e um
 * caso estadual, Lula x Caiado em GO) e ficam fora deste recorte.
 */
export const CONFRONTO_LULA_FLAVIO: Confronto = Object.freeze([LULA, FLAVIO_BOLSONARO]);

/**
 * Forma canônica de um nome de candidato para comparação (nunca para
 * exibição): minúsculas, sem acentos, espaços colapsados.
 */
export function normalizarNomeCandidato(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave canônica de um confronto: nomes normalizados, sem repetição, em ordem
 * alfabética, unidos por " x ". É a identidade do confronto — "Lula x Flávio"
 * e "Flávio Bolsonaro x Luiz Inácio Lula da Silva" produzem chaves diferentes
 * (nomes diferentes), mas trocar a ORDEM dos mesmos nomes, ou perder um
 * acento, produz a mesma chave.
 */
export function chaveConfronto(confronto: Confronto): string {
  const nomes = confronto.map(normalizarNomeCandidato).filter((n) => n.length > 0);
  return [...new Set(nomes)].sort().join(' x ');
}

/**
 * O confronto testado por uma pesquisa: os nomes das linhas que são
 * candidato, na ordem em que aparecem na pesquisa (preserva a grafia
 * original, serve para exibição).
 */
export function confrontoDaPesquisa(pesquisa: Pesquisa): Confronto {
  return pesquisa.resultados
    .map((r) => r.candidato.trim())
    .filter((nome) => !ehLinhaNaoCandidato(nome, new Set<string>()));
}

/**
 * Verdadeiro quando a pesquisa testa EXATAMENTE o confronto informado — mesmo
 * conjunto de candidatos, nem a mais nem a menos. Uma pesquisa "Lula x Cury"
 * não é o confronto "Lula x Flávio"; uma pesquisa de 1º turno com Lula,
 * Flávio e mais oito nomes também não.
 */
export function ehConfronto(pesquisa: Pesquisa, confronto: Confronto): boolean {
  return chaveConfronto(confrontoDaPesquisa(pesquisa)) === chaveConfronto(confronto);
}

/**
 * Filtra as pesquisas que testam exatamente `confronto`, preservando a ordem
 * original da lista. Nunca completa nem inventa: se nenhuma pesquisa bater,
 * devolve lista vazia (e quem chama trata como "sem dado").
 */
export function filtrarPorConfronto(
  pesquisas: readonly Pesquisa[],
  confronto: Confronto,
): readonly Pesquisa[] {
  const chaveAlvo = chaveConfronto(confronto);
  return pesquisas.filter((p) => chaveConfronto(confrontoDaPesquisa(p)) === chaveAlvo);
}
