import type { Clock, Repositorios } from '../ports.js';
import { agregarPesquisas } from '../../domain/aggregate.js';
import {
  type CargoApuracao,
  type Projecao,
  projetarApuracao,
  semApuracao,
} from '../../domain/apuracao.js';
import { criarDisputa, UF_NACIONAL } from '../../domain/race.js';

/**
 * Comparação entre o que as pesquisas apontavam e o que a apuração projeta,
 * candidato por candidato.
 *
 * É a razão de esta tela existir dentro deste projeto: a base tem 819
 * pesquisas e agora existe o número real para confrontá-las. `erro` é em
 * pontos percentuais, positivo quando a pesquisa SUPERESTIMOU o candidato.
 *
 * **A comparação só é válida depois de igualar as bases.** As pesquisas da
 * base estão no corte do TOTAL (que inclui brancos, nulos e indecisos) —
 * foi a regra de ingestão do projeto inteiro, e o motivo de dezenas de fichas
 * terem sido recusadas. A apuração oficial publica percentual sobre VOTOS
 * VÁLIDOS, que excluem brancos e nulos. Subtrair um do outro direto embutiria
 * um erro sistemático do tamanho exato da fatia de brancos/nulos/indecisos,
 * uns dez pontos, e o chamaria de "erro das pesquisas".
 *
 * Por isso o agregado é renormalizado para a base de válidos antes da
 * comparação: cada candidato dividido pela soma dos candidatos do agregado.
 * Isso não inventa número nenhum — é a leitura de válidos dos mesmos valores
 * publicados, a mesma conta que o projeto usou o tempo todo para conferir
 * manchetes contra o corte do total.
 */
export interface ComparacaoPesquisaApuracao {
  readonly candidato: string;
  readonly partido: string | null;
  /**
   * Percentual do agregado de pesquisas **renormalizado para a base de votos
   * válidos**, para ser comparável com a apuração. Ver `pctValidosDasPesquisas`.
   * `null` quando o candidato não estava no agregado.
   */
  readonly pctPesquisas: number | null;
  readonly pctProjetado: number;
  /** `pctPesquisas - pctProjetado`, em pontos. Positivo = pesquisa superestimou. */
  readonly erro: number | null;
}

/**
 * Converte o agregado de pesquisas (base TOTAL) para a base de VOTOS VÁLIDOS,
 * que é a da apuração oficial: cada candidato dividido pela soma dos
 * candidatos, sem as linhas de brancos, nulos e indecisos.
 *
 * Exportada porque é a peça que torna a comparação legítima, e um erro aqui
 * se propaga para todo número da coluna de erro.
 */
export function pctValidosDasPesquisas(
  candidatos: readonly { readonly candidato: string; readonly pct: number }[],
): Map<string, number> {
  const soma = candidatos.reduce((t, c) => t + c.pct, 0);
  if (soma <= 0) return new Map();
  return new Map(candidatos.map((c) => [c.candidato, (c.pct / soma) * 100]));
}

export interface ProjecaoComparada {
  readonly projecao: Projecao;
  /** `true` quando não há nenhum recorte de apuração para o cargo/turno. */
  readonly semDados: boolean;
  /**
   * `true` quando existe o recorte nacional da fonte mas NENHUM recorte
   * estadual. Nesse estado o projeto **não emite projeção**: sem a composição
   * por estado não há como corrigir o viés de ordem de apuração, e o que a
   * tela pode mostrar é a contagem parcial, dita como contagem.
   */
  readonly apenasNacional: boolean;
  /** Instante da leitura da apuração (ISO), como o arquivo declara. */
  readonly apuracaoAtualizadaEm: string;
  /**
   * Comparação com o agregado de pesquisas do MESMO recorte, ordenada pelo
   * percentual projetado. Vazia quando não há apuração.
   */
  readonly comparacao: readonly ComparacaoPesquisaApuracao[];
  /**
   * Erro absoluto médio do agregado, em pontos, sobre os candidatos que
   * aparecem nas duas pontas. `null` quando não há par comparável — nunca 0,
   * que leria como "acertou na mosca".
   */
  readonly erroAbsolutoMedio: number | null;
  /** Fontes dos recortes usados, sem repetição. A tela é obrigada a citá-las. */
  readonly fontes: readonly { readonly nome: string; readonly url: string }[];
  /**
   * Ressalvas das fichas usadas. É onde fica registrado, por exemplo, que um
   * valor foi derivado de percentual em vez de publicado em absoluto — e isso
   * precisa aparecer na tela, não só no arquivo.
   */
  readonly observacoes: readonly string[];
}

/**
 * Caso de uso: projeção da apuração, com a comparação contra as pesquisas.
 *
 * A projeção vem do domínio (`projetarApuracao`), que soma UF por UF em vez
 * de extrapolar o percentual nacional — ver a explicação do viés de ordem de
 * apuração em `domain/apuracao.ts`. Aqui se acrescenta apenas o confronto com
 * o agregado de pesquisas, que é dado de outra fonte e por isso não entra no
 * domínio da apuração.
 *
 * Nunca devolve `null`: com o arquivo vazio, devolve `semDados: true` e a
 * projeção zerada, para que a tela diga que não há apuração em vez de
 * desenhar um gráfico de zeros como se fosse resultado.
 */
export function criarGetProjecao(repos: Repositorios, clock: Clock) {
  return function getProjecao(
    cargo: CargoApuracao = 'presidente',
    turno: 1 | 2 = 1,
  ): ProjecaoComparada {
    const projecao = projetarApuracao(
      repos.apuracao.dados(),
      cargo,
      turno,
      repos.electorate.todos(),
    );
    const semDados = semApuracao(projecao);

    // O agregado de pesquisas do mesmo recorte, só para presidente nacional —
    // é o único recorte em que a comparação tem um par bem definido sem
    // escolher confronto de 2º turno nem UF.
    let pctPorCandidato = new Map<string, number>();
    if (!semDados && cargo === 'presidente') {
      const disputa = criarDisputa(UF_NACIONAL, 'presidente', turno);
      const agregado = agregarPesquisas(repos.polls.porDisputa(disputa), {}, clock.hoje());
      // Sem pesquisa do recorte não há comparação a fazer — o mapa fica vazio e
      // cada `erro` sai `null`, em vez de 0, que leria como acerto exato.
      if (agregado) pctPorCandidato = pctValidosDasPesquisas(agregado.candidatos);
    }

    // Em modo só-nacional a projeção por estado está vazia, e a comparação
    // passa a usar o recorte nacional da fonte — que é contagem parcial, não
    // projeção. A tela é obrigada a dizer isso; ver `apenasNacional`.
    const baseComparacao =
      projecao.candidatos.length > 0
        ? projecao.candidatos
        : (projecao.nacionalCru?.candidatos ?? []);

    const comparacao: ComparacaoPesquisaApuracao[] = semDados
      ? []
      : baseComparacao.map((c) => {
          const pctPesquisas = pctPorCandidato.get(c.candidato) ?? null;
          return {
            candidato: c.candidato,
            partido: c.partido,
            pctPesquisas,
            pctProjetado: c.pctProjetado,
            erro: pctPesquisas == null ? null : pctPesquisas - c.pctProjetado,
          };
        });

    // Fontes e ressalvas dos recortes do cargo/turno em questão.
    const usados = repos.apuracao
      .dados()
      .recortes.filter((r) => r.cargo === cargo && r.turno === turno);
    const fontes = [...new Map(usados.map((r) => [r.fonte.url, r.fonte])).values()];
    const observacoes = usados
      .map((r) => r.observacao)
      .filter((o): o is string => typeof o === 'string' && o.trim().length > 0);

    const erros = comparacao.map((c) => c.erro).filter((e): e is number => e != null);
    const erroAbsolutoMedio =
      erros.length > 0 ? erros.reduce((t, e) => t + Math.abs(e), 0) / erros.length : null;

    return {
      projecao,
      semDados,
      apenasNacional: projecao.porUf.length === 0 && projecao.nacionalCru !== null,
      apuracaoAtualizadaEm: repos.apuracao.atualizadoEm(),
      comparacao,
      erroAbsolutoMedio,
      fontes,
      observacoes,
    };
  };
}
