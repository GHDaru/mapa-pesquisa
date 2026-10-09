import type { Clock, Repositorios } from '../ports.js';
import { type Agregado, agregarPesquisas } from '../../domain/aggregate.js';
import { dataReferencia, type Pesquisa } from '../../domain/poll.js';
import { chaveConfronto, confrontoDaPesquisa } from '../../domain/runoff.js';
import { criarDisputa, UF_NACIONAL } from '../../domain/race.js';
import { finalistasDecididos } from '../../domain/apuracao.js';
import { DATA_PRIMEIRO_TURNO } from '../../domain/poll-accuracy.js';
import { dataReferencia as refDe } from '../../domain/poll.js';

const CENARIO_PADRAO = 'sem cenário';

export interface CenarioAgregado {
  readonly cenario: string;
  readonly agregado: Agregado;
  /**
   * Situação do cenário depois que o 1º turno é decidido.
   *
   * - `'vigente'`: é o confronto que vai de fato acontecer.
   * - `'superado'`: era hipótese antes do 1º turno e **não pode mais ocorrer**.
   * - `'indefinido'`: o 1º turno ainda não está apurado, e todos são hipótese.
   *
   * Existe porque até 08/10 a tela publicava os cinco cenários lado a lado como
   * se fossem igualmente possíveis — "Lula x Zema", "Lula x Caiado" e "Lula x
   * Renan Santos" entre eles, três disputas que o 1º turno de 04/10 tornou
   * impossíveis. Eram corretos enquanto ninguém sabia quem passaria; viraram
   * enganosos no instante em que a urna respondeu, e **nada no código notava a
   * diferença**. Os cenários superados NÃO são apagados: o que as pesquisas
   * diziam sobre um 2º turno que não houve é dado histórico legítimo. Só não
   * podem ser lidos como disputa viva.
   */
  readonly situacao: 'vigente' | 'superado' | 'indefinido';
  /**
   * De que janela de campo saiu este agregado.
   *
   * - `'pos-1o-turno'`: só pesquisas com campo POSTERIOR ao 1º turno.
   * - `'inclui-pre-1o-turno'`: a janela atravessa 04/10.
   *
   * **Por que isto existe, e é o defeito mais consequente que achei na semana.**
   * A janela de recência (45 dias, meia-vida de 14) foi desenhada quando não
   * havia descontinuidade dentro dela. O 1º turno de 04/10 pôs uma: antes dele
   * as pesquisas de "Lula x Flávio" mediam um 2º turno **hipotético**, com o
   * eleitor sem saber quem passaria; depois, medem a eleição marcada e com
   * finalistas conhecidos. São perguntas diferentes.
   *
   * Medido em 09/10, com as quatro primeiras pesquisas pós-eleição na base: a
   * janela tinha **55 pesquisas, 51 delas anteriores a 04/10**, e os pesos davam
   * **84,9% para as pré-eleição**. O agregado publicava Flávio 46,43 x Lula 45,00
   * com `empateTecnico: true` — enquanto as quatro pesquisas que de fato mediam
   * esta disputa davam Flávio 48,42 x Lula 44,83, vantagem de 3,59 pontos e
   * **fora do empate técnico**. A manchete era 85% a medição de uma corrida que
   * deixou de existir.
   */
  readonly janela: 'pos-1o-turno' | 'inclui-pre-1o-turno';
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

    /*
     * Quem de fato foi ao 2º turno, segundo a apuração — `null` enquanto o 1º
     * turno não está decidido. Vem do dado, nunca de constante: quem passou é
     * o que a contagem diz.
     */
    const finalistas = finalistasDecididos(repos.apuracao.dados());

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
      const vigente = finalistas != null && chave === chaveConfronto(finalistas);
      /*
       * No cenário VIGENTE, depois que o 1º turno decidiu, a manchete sai só das
       * pesquisas com campo posterior à eleição — ver `janela`. Os cenários
       * superados e o estado de 1º turno aberto seguem com a janela inteira: ali
       * não há descontinuidade a respeitar, e recortar não significaria nada.
       *
       * **Com fallback declarado:** se ainda não existe nenhuma pesquisa
       * pós-eleição (foi o estado de 05 a 07/10), usa a janela inteira e marca
       * `'inclui-pre-1o-turno'`. Sumir com o cartão por falta de dado novo seria
       * pior que mostrá-lo dizendo de quando ele fala.
       */
      const posEleicao = vigente
        ? grupo.filter((p) => refDe(p) > DATA_PRIMEIRO_TURNO)
        : [];
      const usarSoPos = vigente && posEleicao.length > 0;
      const agregado = agregarPesquisas(usarSoPos ? posEleicao : grupo, {}, hoje);
      if (agregado) {
        turno2.push({
          cenario: rotuloDoCenario(agregado.candidatos.map((c) => c.candidato), chave),
          agregado,
          situacao: finalistas == null ? 'indefinido' : vigente ? 'vigente' : 'superado',
          janela: usarSoPos ? 'pos-1o-turno' : 'inclui-pre-1o-turno',
        });
      }
    }
    /*
     * O confronto que vai acontecer vem primeiro; os superados ficam depois, na
     * ordem de recência de antes. Enquanto o 1º turno não está decidido todos
     * são `'indefinido'` e a ordenação é só por recência, como sempre foi.
     */
    const ordem = { vigente: 0, indefinido: 1, superado: 2 } as const;
    turno2.sort(
      (a, b) =>
        ordem[a.situacao] - ordem[b.situacao] ||
        dataReferencia(b.agregado.ultimaPesquisa).localeCompare(
          dataReferencia(a.agregado.ultimaPesquisa),
        ),
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
