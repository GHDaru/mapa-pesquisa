import type { Clock, Repositorios } from '../ports.js';
import { serieTemporal, type SerieTemporal } from '../../domain/aggregate.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import { criarDisputa, UF_NACIONAL } from '../../domain/race.js';
import { chaveConfronto, type Confronto, filtrarPorConfronto } from '../../domain/runoff.js';
import { chaveDoCenario } from './get-presidential-aggregate.js';

/** Opções do recorte da série temporal presidencial. */
export interface OpcoesTimelinePresidencial {
  /** UF da disputa: `"BR"` (padrão, disputa nacional) ou a sigla de um estado. */
  readonly uf?: string;
  /**
   * Cenário de 2º turno, aceitando a chave interna ou o rótulo exibido por
   * `getPresidentialAggregate` ("2º turno: A x B"). A ordem dos nomes e os
   * acentos não importam. Ignorado no 1º turno.
   */
  readonly cenario?: string;
  /**
   * Confronto de 2º turno (ex.: `CONFRONTO_LULA_FLAVIO`), a forma tipada e
   * explícita de pedir um cenário. Tem precedência sobre `cenario`. Ignorado
   * no 1º turno.
   */
  readonly confronto?: Confronto;
}

/**
 * Aceita tanto a chave interna do cenário (nomes ordenados, ex.: "candidato a x candidato b")
 * quanto o rótulo exibido em getPresidentialAggregate (ex.: "2º turno: Candidato A x Candidato B"),
 * em qualquer ordem de nomes e com ou sem acentos — normaliza para a mesma
 * chave canônica de confronto usada por `chaveDoCenario`.
 */
function normalizarCenario(cenario: string): string {
  const semPrefixo = cenario.replace(/^\s*\d?\s*[ºo°]?\s*turno:\s*/i, '').trim();
  return chaveConfronto(semPrefixo.split(/\s+x\s+/i));
}

/**
 * Caso de uso: série temporal da disputa presidencial — nacional (uf "BR",
 * padrão) ou de um estado, no 1º turno ou em um cenário do 2º turno. Usa o
 * serviço de domínio `serieTemporal`, com o mesmo kernel de recência/amostra
 * do agregado pontual (`getPresidentialAggregate`).
 *
 * No 2º turno o recorte é por confronto, não só por turno: passe
 * `{ confronto: CONFRONTO_LULA_FLAVIO }` (ou o rótulo equivalente em
 * `cenario`) para não misturar cenários hipotéticos diferentes. Quando nem
 * `confronto` nem `cenario` são informados, usa o cenário com a pesquisa mais
 * recente (mesmo critério de desempate de `getPresidentialAggregate`, que
 * ordena os cenários por essa mesma data).
 *
 * O 2º parâmetro aceita, por compatibilidade, a string do cenário — equivale
 * a `{ cenario }`.
 */
export function criarGetPresidentialTimeline(repos: Repositorios, clock: Clock) {
  return function getPresidentialTimeline(
    turno: 1 | 2 = 1,
    cenarioOuOpcoes?: string | OpcoesTimelinePresidencial,
  ): SerieTemporal {
    const hoje = clock.hoje();
    const opcoes: OpcoesTimelinePresidencial =
      typeof cenarioOuOpcoes === 'string' ? { cenario: cenarioOuOpcoes } : (cenarioOuOpcoes ?? {});
    const uf = opcoes.uf ?? UF_NACIONAL;
    const polls = repos.polls.porDisputa(criarDisputa(uf, 'presidente', turno));

    if (turno === 1) {
      return serieTemporal(polls, {}, hoje);
    }

    if (opcoes.confronto) {
      return serieTemporal(filtrarPorConfronto(polls, opcoes.confronto), {}, hoje);
    }

    const porCenario = new Map<string, Pesquisa[]>();
    for (const p of polls) {
      const chave = chaveDoCenario(p);
      const grupo = porCenario.get(chave);
      if (grupo) {
        grupo.push(p);
      } else {
        porCenario.set(chave, [p]);
      }
    }

    let grupoAlvo: readonly Pesquisa[] | undefined;
    if (opcoes.cenario != null) {
      grupoAlvo = porCenario.get(normalizarCenario(opcoes.cenario));
    } else {
      let melhorData = '';
      for (const grupo of porCenario.values()) {
        const maisRecente = grupo.map((p) => dataReferencia(p)).sort().at(-1) ?? '';
        if (maisRecente > melhorData) {
          melhorData = maisRecente;
          grupoAlvo = grupo;
        }
      }
    }

    return serieTemporal(grupoAlvo ?? [], {}, hoje);
  };
}
