import type { Clock, Repositorios } from '../ports.js';
import { agregarPesquisas, ehLinhaNaoCandidato } from '../../domain/aggregate.js';
import {
  type AcertoDasPesquisas,
  DATA_PRIMEIRO_TURNO,
  dataReferenciaDaPesquisa,
  medirAcertoDasPesquisas,
  pctValidosDaPesquisa,
} from '../../domain/poll-accuracy.js';
import type { Pesquisa } from '../../domain/poll.js';
import {
  type CargoApuracao,
  type Projecao,
  projetarApuracao,
  semApuracao,
  turnoMaisAvancado,
} from '../../domain/apuracao.js';
import { criarDisputa, UF_NACIONAL } from '../../domain/race.js';
import { filtrarPorConfronto } from '../../domain/runoff.js';

/**
 * Comparação entre o que as pesquisas apontavam e o que a apuração projeta,
 * candidato por candidato.
 *
 * É a razão de esta tela existir dentro deste projeto: a base tem 819
 * pesquisas e agora existe o número real para confrontá-las. `erro` é em
 * pontos percentuais, positivo quando a pesquisa SUPERESTIMOU o candidato.
 *
 * **As bases têm de ser igualadas, mas o ajuste é menor do que parece.** As
 * pesquisas da base estão no corte do TOTAL e a apuração publica VOTOS
 * VÁLIDOS, o que à primeira vista sugere um erro sistemático do tamanho da
 * fatia de brancos/nulos/indecisos — uns dez pontos. **Não é o caso aqui, e
 * vale registrar para não repetir o erro:** `Agregado.candidatos` já exclui as
 * linhas de não-candidato, que vão para `Agregado.outros`, então esse ranking
 * já soma perto de 100 por construção (medido em 04/10: 100,17).
 *
 * A renormalização continua certa, porque torna a base **exata** em vez de
 * incidental — e porque aquele 100,17 é artefato: cada candidato é uma média
 * ponderada sobre as pesquisas que o publicaram, e candidatos menores aparecem
 * em poucas pesquisas. Mas o efeito é de centésimos, não de dez pontos: o
 * primeiro colocado foi de 38,37 para 38,31. Não inventa número nenhum.
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
/**
 * A partir de quantos por cento de seções totalizadas o resultado é tratado
 * como final. Não é 100 porque a totalização fecha com frações residuais
 * (seções no exterior, urnas em trânsito) que não movem o resultado — mas é
 * alto o bastante para que o viés de ordem de apuração já tenha se esgotado.
 */
export const LIMIAR_APURACAO_ENCERRADA = 99.5;

export function pctValidosDasPesquisas(
  candidatos: readonly { readonly candidato: string; readonly pct: number }[],
): Map<string, number> {
  const soma = candidatos.reduce((t, c) => t + c.pct, 0);
  if (soma <= 0) return new Map();
  return new Map(candidatos.map((c) => [c.candidato, (c.pct / soma) * 100]));
}

/**
 * Quantas fichas a guarda do 2º turno considerou, pontuou e excluiu — contado
 * do dado, para a tela nunca mais guardar essa contagem à mão. `null` no 1º
 * turno, onde não há recorte a declarar.
 */
export interface RecorteDoRanking {
  readonly consideradas: number;
  readonly pontuadas: number;
  readonly excluidas: number;
  /** Das excluídas, quantas apontavam em 1º quem de fato venceu. */
  readonly excluidasQueAcertaramOLider: number;
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
  /**
   * Qual recorte comanda o destaque: `'nacional'` (a contagem que a fonte
   * publica para o país) ou `'estadual'` (a soma projetada por estado). Vence o
   * que cobre mais do eleitorado do país — ver o comentário no corpo da função.
   */
  readonly destaque: 'nacional' | 'estadual';
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
  readonly fontes: readonly {
    readonly nome: string;
    /** O primeiro arquivo do grupo — mantido para quem só quer um link. */
    readonly url: string;
    /** Todos os arquivos com este MESMO rótulo, um por recorte, ordenados por UF. */
    readonly recortes: readonly { readonly uf: string; readonly url: string }[];
  }[];
  /**
   * Ressalvas das fichas usadas. É onde fica registrado, por exemplo, que um
   * valor foi derivado de percentual em vez de publicado em absoluto — e isso
   * precisa aparecer na tela, não só no arquivo.
   */
  readonly observacoes: readonly string[];

  /**
   * `true` quando a apuração do recorte está encerrada (ou a tão poucos
   * décimos do fim que o resultado não muda mais). Vira o enquadramento da
   * tela de "contagem parcial" para "resultado final", e é o que autoriza
   * tratar a comparação com as pesquisas como veredito em vez de provisório.
   */
  readonly apuracaoEncerrada: boolean;
  /**
   * Acerto de cada instituto contra o resultado. `null` enquanto a apuração
   * não está encerrada: ranquear institutos contra um parcial enviesado pela
   * ordem de apuração produziria um ranking falso, e publicá-lo seria pior que
   * não publicar nada.
   */
  readonly acerto: AcertoDasPesquisas | null;
  readonly recorteDoRanking: RecorteDoRanking | null;
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
    turnoPedido: 1 | 2 | 'auto' = 'auto',
  ): ProjecaoComparada {
    const dados = repos.apuracao.dados();
    /*
     * `'auto'` (o padrão) mostra o turno MAIS AVANÇADO que tem dado — ver
     * `turnoMaisAvancado`. A tela fixava turno 1 no código, o que estava certo
     * enquanto só o 1º turno existia e passaria a publicar o resultado de 04/10
     * como se fosse o atual depois de 25/10, sem erro nenhum para avisar.
     * Chamadas com turno explícito continuam valendo, e é como os testes pedem
     * um turno específico.
     */
    const turno = turnoPedido === 'auto' ? turnoMaisAvancado(dados, cargo) : turnoPedido;
    const projecao = projetarApuracao(dados, cargo, turno, repos.electorate.todos());
    const semDados = semApuracao(projecao);

    /*
     * Qual recorte comanda o destaque da tela: o nacional da fonte ou a soma
     * por estado. Vence o que cobre MAIS do país.
     *
     * A versão anterior preferia o estadual sempre que existisse qualquer UF, e
     * comparava o nacional com `secoesTotalizadasPonderada` — que é ponderada
     * só pelas UFs COM dado e por isso dizia ~100% com três estados. O efeito
     * era perverso: ingerir um recorte estadual correto derrubava
     * `apuracaoEncerrada`, apagava o ranking de institutos e trocava uma
     * contagem nacional de 99,79% por uma soma de 8% do eleitorado. Dado novo
     * piorava a página, e a saída era avisar todo agente para não ingerir —
     * remendo no lugar do conserto.
     */
    const secoesNacional = projecao.nacionalCru?.secoesTotalizadas ?? 0;
    const coberturaEstadual = projecao.coberturaNacionalEfetiva;
    const destaque: 'nacional' | 'estadual' =
      projecao.porUf.length === 0 || secoesNacional >= coberturaEstadual
        ? 'nacional'
        : 'estadual';
    const secoesDoRecorte = Math.max(secoesNacional, coberturaEstadual);
    const apuracaoEncerrada = !semDados && secoesDoRecorte >= LIMIAR_APURACAO_ENCERRADA;

    /*
     * A base da comparação e do ranking **segue `destaque`**, e precisa seguir.
     *
     * Ela preferia a soma por estado sempre que existisse qualquer UF — o mesmo
     * defeito que `destaque` já tinha, deixado para trás numa variável que o
     * conserto de `destaque` não alcançou. Em 06/10 isso foi ao ar: com 10 das 27
     * UFs de presidente no arquivo, cobrindo 72,9% do eleitorado e pesadas para o
     * Sul e o Sudeste, a tela mostrava corretamente o nacional de 100% enquanto o
     * ranking de institutos media o erro deles contra a soma dos 10 estados —
     * margem de 5,89 pontos no lugar de 1,87. Era exatamente o "ranking falso"
     * contra o qual o comentário do próprio ranking adverte, e ingerir dado
     * correto voltava a piorar a página.
     *
     * No modo só-nacional a projeção por estado está vazia e a comparação usa o
     * recorte nacional da fonte — que é contagem parcial, não projeção. A tela é
     * obrigada a dizer isso; ver `apenasNacional`.
     */
    const baseComparacao =
      destaque === 'nacional' && projecao.nacionalCru
        ? projecao.nacionalCru.candidatos
        : projecao.candidatos.length > 0
          ? projecao.candidatos
          : (projecao.nacionalCru?.candidatos ?? []);

    /*
     * As pesquisas do mesmo recorte, só para presidente nacional — é o único
     * recorte em que a comparação tem um par bem definido sem escolher UF.
     *
     * **No 2º turno, filtrar só por `turno === 2` é um erro grosseiro**, e o
     * projeto já tinha a peça para evitá-lo em `domain/runoff.ts`: antes da
     * definição dos finalistas os institutos testam vários confrontos
     * hipotéticos na MESMA disputa. A base tem 116 pesquisas nacionais de 2º
     * turno, e entre elas Lula x Augusto Cury, Lula x Ronaldo Caiado, Lula x
     * Romeu Zema e Lula x Renan Santos — eleições que não aconteceram. Somadas
     * ao confronto real, elas produziriam um agregado de números de disputas
     * diferentes e um ranking de institutos medindo o erro deles contra um
     * resultado que nunca foi submetido a voto.
     *
     * O confronto vem da PRÓPRIA FICHA de apuração, não de uma constante: quem
     * foi ao 2º turno é o que a contagem diz, e `filtrarPorConfronto` exige
     * conjunto de candidatos exatamente igual — nem a mais, nem a menos. No 1º
     * turno não há confronto a recortar e a lista passa inteira.
     */
    const todasDoRecorte =
      !semDados && cargo === 'presidente'
        ? repos.polls.porDisputa(criarDisputa(UF_NACIONAL, 'presidente', turno))
        : [];
    const pesquisasDoRecorte =
      turno === 2
        ? filtrarPorConfronto(
            todasDoRecorte,
            baseComparacao.map((c) => c.candidato),
          )
        : todasDoRecorte;

    /*
     * **A guarda de 04/10 vale para TUDO que compara pesquisa com resultado**,
     * não só para o ranking.
     *
     * Terceira aparição do mesmo defeito, e a mais embaraçosa, porque fui eu
     * que deixei: em 09/10 a regra entrou no agregado da manchete, em 26/10 no
     * ranking de institutos, e a tabela "o que as pesquisas diziam, e o que
     * deu" ficou de fora. Ela agregava as 100 fichas do confronto, **71 delas
     * com campo anterior a 04/10** — quando "Lula x Flávio" era um 2º turno
     * hipotético e o eleitor não sabia quem passaria. Com 38,9% do peso vindo
     * dali, o erro publicado saía 0,38 ponto menor do que o do agregado que a
     * própria página classifica: −5,3824 em vez de −5,7592 na margem.
     *
     * Dois números do mesmo projeto para a mesma pergunta, e o mais favorável
     * era o publicado. A lição de 17/10 escrita de novo: **regra de recorte
     * tem de nascer perguntando quantos lugares precisam dela** — aqui eram
     * três, e eu só achei dois.
     */
    const paraComparar =
      turno === 2
        ? pesquisasDoRecorte.filter((p) => dataReferenciaDaPesquisa(p) > DATA_PRIMEIRO_TURNO)
        : pesquisasDoRecorte;

    let pctPorCandidato = new Map<string, number>();
    if (paraComparar.length > 0) {
      const agregado = agregarPesquisas(paraComparar, {}, clock.hoje());
      // Sem pesquisa do recorte não há comparação a fazer — o mapa fica vazio e
      // cada `erro` sai `null`, em vez de 0, que leria como acerto exato.
      if (agregado) pctPorCandidato = pctValidosDasPesquisas(agregado.candidatos);
    }

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

    /*
     * Fontes e ressalvas dos recortes do cargo/turno em questão.
     *
     * **Agrupadas por rótulo, e a ressalva deduplicada.** No fechamento do 2º
     * turno os 29 recortes trazem 28 arquivos distintos com o MESMO rótulo e a
     * MESMA ressalva, e a tela imprimia 28 links idênticos seguidos de 29
     * parágrafos idênticos. Cada arquivo continua citável — é o que torna a
     * conta conferível —, mas repetir a mesma frase 29 vezes não acrescenta
     * procedência: esconde a única linha que difere, que é RR com a
     * totalização ainda aberta.
     */
    const usados = dados.recortes.filter((r) => r.cargo === cargo && r.turno === turno);
    const porUrl = [...new Map(usados.map((r) => [r.fonte.url, r] as const)).values()];
    const grupos = new Map<string, { nome: string; itens: { uf: string; url: string }[] }>();
    for (const r of porUrl) {
      const grupo = grupos.get(r.fonte.nome);
      const item = { uf: r.uf ?? 'BR', url: r.fonte.url };
      if (grupo) grupo.itens.push(item);
      else grupos.set(r.fonte.nome, { nome: r.fonte.nome, itens: [item] });
    }
    const fontes = [...grupos.values()].map((g) => ({
      nome: g.nome,
      url: g.itens[0]!.url,
      recortes: g.itens.sort((a, b) => a.uf.localeCompare(b.uf)),
    }));
    const observacoes = [
      ...new Set(
        usados
          .map((r) => r.observacao)
          .filter((o): o is string => typeof o === 'string' && o.trim().length > 0),
      ),
    ];

    const erros = comparacao.map((c) => c.erro).filter((e): e is number => e != null);
    const erroAbsolutoMedio =
      erros.length > 0 ? erros.reduce((t, e) => t + Math.abs(e), 0) / erros.length : null;

    // O ranking de institutos só sai com a apuração encerrada. Contra parcial,
    // ele mediria o viés de ordem de apuração e o atribuiria aos institutos.
    let acerto: AcertoDasPesquisas | null = null;
    let recorteDoRanking: RecorteDoRanking | null = null;
    if (apuracaoEncerrada && cargo === 'presidente') {
      const pctResultado = new Map(
        baseComparacao.map((c) => [c.candidato, c.pctProjetado] as const),
      );
      /*
       * No 2º turno, só pontua pesquisa com campo POSTERIOR ao 1º turno.
       *
       * É a mesma descontinuidade que o agregado já respeita, e que aqui
       * estava sendo ignorada: antes de 04/10 as rodadas de "Lula x Flávio"
       * mediam um 2º turno HIPOTÉTICO, com o eleitor sem saber quem passaria.
       * Pontuar essas contra o resultado real é cobrar de uma medição a
       * resposta de outra pergunta — e distorce nos DOIS sentidos. Medido no
       * fechamento de 25/10: das 20 fichas que entravam, 6 eram de setembro;
       * três delas "acertaram" o líder por tabela e inflavam o placar, outras
       * três erraram e inflavam o erro. Com a guarda, o recorte honesto são
       * as 14 de campo posterior.
       *
       * É o mesmo defeito que já apareceu em 17/10, quando a guarda de base
       * protegia o agregado e não a série: a regra existia num lugar só.
       */
      // Mesma lista que alimenta a comparação, de propósito: duas filtragens
      // com a mesma intenção são duas que podem divergir.
      const paraPontuar = paraComparar;

      /*
       * Quantas fichas a guarda tira, CONTADO DO DADO.
       *
       * A frase da tela trazia "das 20 fichas que entravam, 6 eram de
       * setembro" escrito à mão. Em 26/10 a ingestão da Palver de 18–20/10 deu
       * àquele instituto uma ficha pós-eleição, e ele saiu do conjunto
       * excluído: viraram 5. A tela passou a publicar um número errado, e
       * nenhum teste quebrou, porque o número era prosa. É o mesmo defeito que
       * este projeto cataloga desde 06/10, agora causado pela nossa própria
       * ingestão — a correção não é trocar 6 por 5, é a tela parar de guardar
       * contagem à mão.
       *
       * Conta sobre a ÚLTIMA ficha de cada instituto, que é a unidade do
       * ranking: contar rodadas daria outro número, maior, e não seria o que a
       * frase afirma.
       */
      const ultimaPorInstituto = (lista: readonly Pesquisa[]): Map<string, Pesquisa> => {
        const m = new Map<string, Pesquisa>();
        for (const p of lista) {
          const atual = m.get(p.instituto);
          if (!atual || dataReferenciaDaPesquisa(p) > dataReferenciaDaPesquisa(atual)) {
            m.set(p.instituto, p);
          }
        }
        return m;
      };
      if (turno === 2) {
        const semGuarda = ultimaPorInstituto(pesquisasDoRecorte);
        const comGuarda = ultimaPorInstituto(paraPontuar);
        const excluidas = [...semGuarda.entries()].filter(([i]) => !comGuarda.has(i));
        const liderReal = [...baseComparacao]
          .sort((a, b) => b.pctProjetado - a.pctProjetado)[0]?.candidato;
        const acertaram = excluidas.filter(([, p]) => {
          const pct = pctValidosDaPesquisa(p, (rotulo) =>
            ehLinhaNaoCandidato(rotulo, new Set<string>()),
          );
          const lider = [...pct.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          return lider != null && lider === liderReal;
        }).length;
        recorteDoRanking = {
          consideradas: semGuarda.size,
          pontuadas: comGuarda.size,
          excluidas: excluidas.length,
          excluidasQueAcertaramOLider: acertaram,
        };
      }

      /*
       * A eleição contra a qual a distância do campo é medida é a do TURNO
       * medido. `medirAcertoDasPesquisas` tem `DATA_PRIMEIRO_TURNO` como
       * padrão, e com ele uma pesquisa de 22/10 dava `diasAntes` = -18, que
       * `rotuloDistanciaDaEleicao` lê como "campo encerrado no dia da
       * eleição": as 14 fichas do 2º turno sairiam com essa frase, falsa nas
       * 14, e sem nada que apontasse o erro — o número tem a cara certa. A
       * data vem do arquivo de resultado, não de constante, porque data de
       * eleição é dado.
       */
      const datas = repos.resultado.dados();
      acerto = medirAcertoDasPesquisas(
        paraPontuar,
        pctResultado,
        (rotulo) => ehLinhaNaoCandidato(rotulo, new Set<string>()),
        turno === 2 ? datas.turno2 : datas.turno1,
      );
    }

    return {
      projecao,
      semDados,
      apuracaoEncerrada,
      acerto,
      recorteDoRanking,
      apenasNacional: projecao.porUf.length === 0 && projecao.nacionalCru !== null,
      destaque,
      apuracaoAtualizadaEm: repos.apuracao.atualizadoEm(),
      comparacao,
      erroAbsolutoMedio,
      fontes,
      observacoes,
    };
  };
}
