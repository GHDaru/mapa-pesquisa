import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas } from '../../domain/aggregate.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import { chaveConfronto, confrontoDaPesquisa } from '../../domain/runoff.js';
import { criarDisputa, UF_NACIONAL } from '../../domain/race.js';

const CENARIO_PADRAO = 'sem cenário';

export interface CenarioAgregado {
  readonly cenario: string;
  readonly agregado: Agregado;
}

export interface AgregadoPresidencial {
  readonly turno1: Agregado | null;
  /** Um agregado por cenário de 2º turno (ex.: "Fulano x Ciclana"), mais recente primeiro. */
  readonly turno2: readonly CenarioAgregado[];
  /**
   * Todas as pesquisas presidenciais conhecidas (1º e 2º turno juntos), não
   * só as usadas nos agregados acima (que só olham a janela de recência) —
   * para telas que listam o histórico completo. Mais recente primeiro.
   */
  readonly todasAsPesquisas: readonly Pesquisa[];
}

/**
 * Caso de uso: agregados da disputa presidencial. 1º turno tem candidato
 * único por instituto; 2º turno é agrupado por `cenario` (institutos testam
 * cenários hipotéticos diferentes antes da definição oficial dos 2 finalistas).
 */
export function criarGetPresidentialAggregate(repos: Repositorios, clock: Clock) {
  return function getPresidentialAggregate(): AgregadoPresidencial {
    const hoje = clock.hoje();

    const pollsTurno1 = repos.polls.porDisputa(criarDisputa(UF_NACIONAL, 'presidente', 1));
    const turno1 = agregarPesquisas(pollsTurno1, {}, hoje);

    const pollsTurno2 = repos.polls.porDisputa(criarDisputa(UF_NACIONAL, 'presidente', 2));
    const porCenario = new Map<string, Pesquisa[]>();
    for (const p of pollsTurno2) {
      const chave = chaveDoCenario(p);
      const grupo = porCenario.get(chave);
      if (grupo) {
        grupo.push(p);
      } else {
        porCenario.set(chave, [p]);
      }
    }

    const turno2: CenarioAgregado[] = [];
    for (const [chave, grupo] of porCenario) {
      const agregado = agregarPesquisas(grupo, {}, hoje);
      if (agregado) turno2.push({ cenario: rotuloDoCenario(agregado.candidatos.map((c) => c.candidato), chave), agregado });
    }
    turno2.sort((a, b) =>
      dataReferencia(b.agregado.ultimaPesquisa).localeCompare(dataReferencia(a.agregado.ultimaPesquisa)),
    );

    const todasAsPesquisas = [...pollsTurno1, ...pollsTurno2].sort((a, b) =>
      dataReferencia(b).localeCompare(dataReferencia(a)),
    );

    return { turno1, turno2, todasAsPesquisas };
  };
}


/**
 * Chave de agrupamento do 2º turno: a chave canônica do confronto testado
 * pela pesquisa (`domain/runoff.ts` — conjunto de candidatos normalizado e em
 * ordem alfabética), para que "Lula x Flávio" e "Flávio x Lula" caiam no
 * mesmo cenário mesmo com rótulos diferentes entre institutos.
 * Exportada para reúso em get-presidential-timeline.ts.
 */
export function chaveDoCenario(p: Pesquisa): string {
  const chave = chaveConfronto(confrontoDaPesquisa(p));
  return chave.length > 0 ? chave : (p.cenario ?? CENARIO_PADRAO);
}

function rotuloDoCenario(candidatosOrdenados: readonly string[], fallback: string): string {
  return candidatosOrdenados.length >= 2 ? `2º turno: ${candidatosOrdenados.join(' x ')}` : fallback;
}
