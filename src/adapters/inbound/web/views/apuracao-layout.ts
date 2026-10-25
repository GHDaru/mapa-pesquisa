/**
 * A aritmética e as frases da tela de apuração ao vivo, separadas do DOM.
 *
 * A suíte roda em `environment: node` e não exercita render nenhum — então
 * tudo que dá para decidir sem `document` mora aqui e é testado. O que sobra
 * em `apuracao-view.ts` é invólucro.
 */

import type { ProjecaoUf, CandidatoProjetado } from '../../../../domain/apuracao.js';

/** Uma linha da tabela por estado, já com tudo que a célula precisa. */
export interface LinhaUf {
  readonly uf: string;
  readonly eleitores: number | null;
  readonly processado: number;
  readonly finalizada: boolean;
  readonly lider: string | null;
  /** Na ordem fixa dos dois finalistas, não na ordem de quem lidera. */
  readonly porCandidato: readonly {
    readonly candidato: string;
    readonly pct: number;
    readonly votosApurados: number;
    readonly votosProjetados: number;
  }[];
  readonly brancos: number | null;
  readonly nulos: number | null;
  readonly abstencoes: number | null;
  readonly validosApurados: number;
}

/**
 * Monta as linhas na ORDEM FIXA dos dois candidatos.
 *
 * A ordem fixa importa: `ProjecaoUf.candidatos` vem ordenada por votos, então
 * ler a coluna de cima a baixo saltaria entre um candidato e outro conforme a
 * liderança muda de estado. Uma tabela em que a terceira coluna troca de dono
 * no meio da rolagem é pior que inútil — ela é lida errado com confiança.
 */
export function montarLinhas(
  porUf: readonly ProjecaoUf[],
  ordem: readonly [string, string],
): readonly LinhaUf[] {
  return [...porUf]
    .map((u): LinhaUf => ({
      uf: u.uf,
      eleitores: u.eleitores,
      processado: u.secoesTotalizadas,
      finalizada: u.finalizada,
      lider: u.lider,
      porCandidato: ordem.map((nome) => {
        const c = u.candidatos.find((x) => x.candidato === nome);
        return {
          candidato: nome,
          pct: c?.pctProjetado ?? 0,
          votosApurados: c?.votosApurados ?? 0,
          votosProjetados: c?.votosProjetados ?? 0,
        };
      }),
      brancos: u.brancos,
      nulos: u.nulos,
      abstencoes: u.abstencoes,
      validosApurados: u.validosApurados,
    }))
    .sort((a, b) => (b.eleitores ?? 0) - (a.eleitores ?? 0));
}

/**
 * A frase do cabeçalho sobre o estágio da apuração.
 *
 * A armadilha que esta frase existe para desarmar: o percentual nacional
 * parcial é enviesado pela ORDEM em que os estados totalizam, não pelo voto.
 * Enquanto a cobertura é baixa, dizer o número sem dizer isso convida à
 * leitura errada — e é o erro clássico de noite de eleição.
 */
export function notaDoEstagio(opcoes: {
  readonly processadoNacional: number;
  readonly ufsSemApuracao: readonly string[];
  readonly definido: boolean;
}): string {
  if (opcoes.processadoNacional <= 0) {
    return 'A apuração ainda não começou. Os números aparecem aqui assim que o TSE publicar a primeira seção.';
  }
  if (opcoes.definido) {
    return 'A vantagem já é maior que todo o voto que ainda pode entrar: o resultado está matematicamente definido.';
  }
  const faltam =
    opcoes.ufsSemApuracao.length > 0
      ? ` ${opcoes.ufsSemApuracao.length} ${
          opcoes.ufsSemApuracao.length === 1 ? 'estado ainda não tem' : 'estados ainda não têm'
        } nenhuma seção apurada, e ${
          opcoes.ufsSemApuracao.length === 1 ? 'ele fica' : 'eles ficam'
        } de fora da projeção.`
      : '';
  const cautela =
    opcoes.processadoNacional < 60
      ? ' Com pouca seção apurada, o percentual nacional diz mais sobre a ORDEM em que os estados totalizam do que sobre o voto: a projeção aqui é montada estado a estado justamente para não cair nisso.'
      : '';
  return `${formatarPct(opcoes.processadoNacional)} das seções apuradas.${faltam}${cautela}`;
}

/**
 * Onde a barra de progresso de uma UF deve parar, em fração do bbox dela.
 *
 * Clampa em [0,1] e trata o caso de bbox degenerado. Um estado a 0% tem de
 * aparecer com a cor "sem dado", não com a cor do líder — senão o mapa pinta
 * uma liderança que ninguém mediu.
 */
export function fracaoDaBarra(processado: number): number {
  if (!Number.isFinite(processado) || processado <= 0) return 0;
  return Math.min(1, processado / 100);
}

/** `true` quando a UF ainda não tem voto nenhum e não pode ser pintada. */
export function semDado(linha: { readonly processado: number }): boolean {
  return !(linha.processado > 0);
}

export function formatarInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('pt-BR');
}

export function formatarPct(n: number | null | undefined, casas = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(casas).replace('.', ',')}%`;
}

/**
 * O rótulo de hora de uma leitura. Curto porque fica repetido na tabela: numa
 * noite de apuração o que importa é o minuto, não o dia.
 */
export function horaCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * A frase de fonte: quantas leituras, quantas falharam, e quando.
 *
 * Falha não some. Uma UF que não respondeu aparece contada aqui, porque a
 * projeção fica menor sem ela e quem lê precisa saber que ficou.
 */
export function notaDasFontes(
  fontes: readonly { readonly ok: boolean; readonly lidoEm: string }[],
): string {
  if (fontes.length === 0) return 'Nenhuma leitura feita ainda.';
  const ok = fontes.filter((f) => f.ok).length;
  const falhas = fontes.length - ok;
  const ultima = fontes.map((f) => f.lidoEm).sort().at(-1) ?? null;
  const base = `${ok} de ${fontes.length} ${
    fontes.length === 1 ? 'arquivo lido' : 'arquivos lidos'
  } do TSE às ${horaCurta(ultima)}`;
  return falhas > 0
    ? `${base}. ${falhas} ${falhas === 1 ? 'não respondeu e ficou' : 'não responderam e ficaram'} de fora desta leitura.`
    : `${base}.`;
}

/** Diferença em votos entre os dois primeiros, para o big number da vantagem. */
export function vantagemEntreOsDois(
  candidatos: readonly CandidatoProjetado[],
): { readonly lider: string; readonly votos: number; readonly pontos: number } | null {
  if (candidatos.length < 2) return null;
  const [a, b] = candidatos;
  if (!a || !b) return null;
  return {
    lider: a.candidato,
    votos: a.votosProjetados - b.votosProjetados,
    pontos: a.pctProjetado - b.pctProjetado,
  };
}

/* ───────────────────────────── por região ─────────────────────────────── */

/**
 * As cinco regiões do IBGE.
 *
 * Elas existem aqui como visão AUXILIAR do mesmo dado por estado, não como
 * fonte nova: toda linha de região é a soma das UFs dela. A utilidade é que o
 * voto brasileiro tem geografia forte — Nordeste e Sul puxam para lados
 * opostos há três eleições —, e vinte e sete linhas escondem esse desenho que
 * cinco linhas mostram de primeira.
 */
export const REGIOES: readonly { readonly nome: string; readonly ufs: readonly string[] }[] = [
  { nome: 'Norte', ufs: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] },
  { nome: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { nome: 'Centro-Oeste', ufs: ['DF', 'GO', 'MS', 'MT'] },
  { nome: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  { nome: 'Sul', ufs: ['PR', 'RS', 'SC'] },
];

/** Região de uma UF, ou `null` para sigla desconhecida. */
export function regiaoDaUf(uf: string): string | null {
  const alvo = uf.toUpperCase();
  return REGIOES.find((r) => r.ufs.includes(alvo))?.nome ?? null;
}

/** Uma linha da tabela por região: mesma forma de `LinhaUf`, com as UFs dentro. */
export interface LinhaRegiao extends Omit<LinhaUf, 'uf'> {
  readonly regiao: string;
  readonly ufs: readonly string[];
  /** UFs da região que ainda não têm nenhuma seção apurada. */
  readonly ufsSemApuracao: readonly string[];
}

/**
 * Soma as UFs de cada região.
 *
 * Duas decisões que mudam o número:
 *
 * 1. O **% apurado da região é ponderado pelo eleitorado**, não a média das
 *    UFs. Sem isso, Roraima a 100% e São Paulo a 10% dariam "55% apurado" no
 *    Sudeste-equivalente — uma média de porcentagens entre bases de tamanhos
 *    diferentes, que é o erro aritmético mais comum desta tela inteira.
 * 2. **UF sem nenhuma apuração não entra na soma de votos**, mas é NOMEADA.
 *    Somar zero votos dela empurraria a região inteira para baixo como se ali
 *    ninguém tivesse votado; omiti-la sem dizer esconderia que a leitura da
 *    região está incompleta.
 *
 * Brancos, nulos e abstenções só somam onde a fonte publicou: se nenhuma UF da
 * região publicou, o campo fica `null` em vez de virar zero — zero é um número
 * e significaria "não houve", que é outra afirmação.
 */
export function agregarPorRegiao(
  linhas: readonly LinhaUf[],
  ordem: readonly [string, string],
): readonly LinhaRegiao[] {
  const porUf = new Map(linhas.map((l) => [l.uf, l]));

  return REGIOES.map((reg): LinhaRegiao => {
    const dentro = reg.ufs.map((uf) => porUf.get(uf)).filter((l): l is LinhaUf => l != null);
    const comDado = dentro.filter((l) => !semDado(l));
    const semApuracao = dentro.filter((l) => semDado(l)).map((l) => l.uf);

    const eleitores = dentro.reduce<number | null>(
      (acc, l) => (l.eleitores == null ? acc : (acc ?? 0) + l.eleitores),
      null,
    );

    // Ponderação pelo eleitorado DAS UFs COM DADO. O denominador tem de ser o
    // mesmo conjunto do numerador, senão a região parece mais atrasada do que
    // está só porque uma UF sem cadastro de eleitorado entrou no de baixo.
    const pesoTotal = comDado.reduce((s, l) => s + (l.eleitores ?? 0), 0);
    const processado =
      comDado.length === 0
        ? 0
        : pesoTotal > 0
          ? comDado.reduce((s, l) => s + l.processado * (l.eleitores ?? 0), 0) / pesoTotal
          : comDado.reduce((s, l) => s + l.processado, 0) / comDado.length;

    const somarCampo = (campo: 'brancos' | 'nulos' | 'abstencoes'): number | null =>
      comDado.reduce<number | null>(
        (acc, l) => (l[campo] == null ? acc : (acc ?? 0) + l[campo]),
        null,
      );

    const porCandidato = ordem.map((nome) => {
      const celulas = comDado.flatMap((l) => l.porCandidato.filter((c) => c.candidato === nome));
      const votosApurados = celulas.reduce((s, c) => s + c.votosApurados, 0);
      const votosProjetados = celulas.reduce((s, c) => s + c.votosProjetados, 0);
      return { candidato: nome, pct: 0, votosApurados, votosProjetados };
    });

    // O percentual da região sai da SOMA dos votos, nunca da média dos
    // percentuais das UFs: os estados têm tamanhos muito diferentes.
    const projetadoTotal = porCandidato.reduce((s, c) => s + c.votosProjetados, 0);
    const comPct = porCandidato.map((c) => ({
      ...c,
      pct: projetadoTotal > 0 ? (c.votosProjetados / projetadoTotal) * 100 : 0,
    }));

    const melhor = [...comPct].sort((a, b) => b.votosProjetados - a.votosProjetados)[0];

    return {
      regiao: reg.nome,
      ufs: reg.ufs,
      ufsSemApuracao: semApuracao,
      eleitores,
      processado,
      finalizada: comDado.length === dentro.length && dentro.length > 0 && dentro.every((l) => l.finalizada),
      // Sem voto nenhum não há líder: a região fica cinza, como a UF fica.
      lider: melhor && melhor.votosProjetados > 0 ? melhor.candidato : null,
      porCandidato: comPct,
      brancos: somarCampo('brancos'),
      nulos: somarCampo('nulos'),
      abstencoes: somarCampo('abstencoes'),
      validosApurados: comDado.reduce((s, l) => s + l.validosApurados, 0),
    };
  });
}

/**
 * Brancos, nulos e abstenções somados em todas as UFs com apuração.
 *
 * Vão para a tira discreta do topo, e discreta é a palavra certa: eles são
 * contagem crua do que já entrou, não projeção, então não podem ter o mesmo
 * peso visual dos percentuais dos candidatos — que são projetados — sem que a
 * tela passe a comparar duas coisas de natureza diferente lado a lado.
 */
export function somarNaoValidos(linhas: readonly LinhaUf[]): {
  readonly brancos: number | null;
  readonly nulos: number | null;
  readonly abstencoes: number | null;
} {
  const soma = (campo: 'brancos' | 'nulos' | 'abstencoes'): number | null =>
    linhas.reduce<number | null>((acc, l) => (l[campo] == null ? acc : (acc ?? 0) + l[campo]), null);
  return { brancos: soma('brancos'), nulos: soma('nulos'), abstencoes: soma('abstencoes') };
}
