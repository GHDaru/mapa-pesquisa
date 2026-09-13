import type { Clock, Repositorios } from '../ports.js';
import { serieTemporal, type SerieTemporal } from '../../domain/aggregate.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import { criarDisputa, UF_NACIONAL } from '../../domain/race.js';
import { chaveDoCenario } from './get-presidential-aggregate.js';

/**
 * Aceita tanto a chave interna do cenário (nomes ordenados, ex.: "candidato a x candidato b")
 * quanto o rótulo exibido em getPresidentialAggregate (ex.: "2º turno: Candidato A x Candidato B").
 */
function normalizarCenario(cenario: string): string {
  return cenario.replace(/^2º turno:\s*/i, '').trim().toLowerCase();
}

/**
 * Caso de uso: série temporal nacional (uf "BR") da disputa presidencial —
 * 1º turno, ou um cenário específico do 2º turno. Usa o serviço de domínio
 * `serieTemporal`, com o mesmo kernel de recência/amostra do agregado
 * pontual (`getPresidentialAggregate`).
 *
 * No 2º turno, quando `cenario` não é informado, usa o cenário com a
 * pesquisa mais recente (mesmo critério de desempate de
 * `getPresidentialAggregate`, que ordena os cenários por essa mesma data).
 */
export function criarGetPresidentialTimeline(repos: Repositorios, clock: Clock) {
  return function getPresidentialTimeline(turno: 1 | 2 = 1, cenario?: string): SerieTemporal {
    const hoje = clock.hoje();
    const polls = repos.polls.porDisputa(criarDisputa(UF_NACIONAL, 'presidente', turno));

    if (turno === 1) {
      return serieTemporal(polls, {}, hoje);
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
    if (cenario != null) {
      grupoAlvo = porCenario.get(normalizarCenario(cenario));
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
