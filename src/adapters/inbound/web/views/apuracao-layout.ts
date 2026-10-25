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
/**
 * Como nomear um conjunto de unidades sem apuração.
 *
 * O exterior está entre elas e não é um estado: dizer "28 estados" erra por
 * uma palavra, e numa tela cujo argumento inteiro é não afirmar o que não se
 * mediu, errar por uma palavra também conta.
 */
export function nomearUnidades(ufs: readonly string[]): string {
  const temExterior = ufs.includes('ZZ');
  const estados = ufs.filter((uf) => uf !== 'ZZ').length;
  if (!temExterior) {
    return `${estados} ${estados === 1 ? 'estado' : 'estados'}`;
  }
  if (estados === 0) return 'o exterior';
  return `${estados} ${estados === 1 ? 'estado' : 'estados'} e o exterior`;
}

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
      ? ` ${nomearUnidades(opcoes.ufsSemApuracao)} ainda ${
          opcoes.ufsSemApuracao.length === 1 ? 'não tem' : 'não têm'
        } nenhuma seção apurada, e ${
          opcoes.ufsSemApuracao.length === 1 ? 'fica' : 'ficam'
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
 * O rótulo de hora de uma leitura, SEMPRE em horário de Brasília.
 *
 * Sem fixar o fuso, `toLocaleTimeString` usa o relógio de quem está olhando:
 * um leitor em Lisboa via "00:35" onde a captura dizia 19:30, e um em Tóquio
 * veria outra coisa ainda. Numa noite de eleição brasileira todos os marcos
 * são de Brasília — as urnas fecham às 17h, o TSE publica a partir dali —, e
 * uma hora em outro fuso ao lado desses marcos não é só confusa: ela faz o
 * leitor concluir que a página está adiantada ou atrasada em horas.
 *
 * Curto porque fica repetido na tela: numa apuração importa o minuto, não o
 * dia.
 */
export const FUSO_DE_BRASILIA = 'America/Sao_Paulo';

export function horaCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: FUSO_DE_BRASILIA,
  });
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
 * A regra é soma: tudo que a região tem, somado, e o percentual sai direto da
 * divisão do que foi apurado pelo total da região — sem ponderar nada. A
 * ponderação some porque ela era conta a mais fazendo o mesmo serviço: dividir
 * a soma pela soma JÁ pesa cada UF pelo tamanho dela, e pesa pelo voto que
 * realmente apareceu, não pelo eleitorado cadastrado em julho. O que ela
 * continua impedindo é a média das porcentagens, que com estados de tamanhos
 * tão diferentes seria outro número e estaria errado.
 *
 * Uma decisão fica: **UF sem nenhuma apuração não entra na soma de votos**,
 * mas é NOMEADA. Somar zero votos dela empurraria a região para baixo como se
 * ali ninguém tivesse votado; omiti-la sem dizer esconderia que a leitura da
 * região está incompleta.
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
  const blocos: readonly { readonly nome: string; readonly ufs: readonly string[] }[] =
    porUf.has('ZZ') ? [...REGIOES, { nome: 'Exterior', ufs: ['ZZ'] }] : REGIOES;

  return blocos.map((reg): LinhaRegiao => {
    const dentro = reg.ufs.map((uf) => porUf.get(uf)).filter((l): l is LinhaUf => l != null);
    const comDado = dentro.filter((l) => !semDado(l));
    const semApuracao = dentro.filter((l) => semDado(l)).map((l) => l.uf);

    const eleitores = dentro.reduce<number | null>(
      (acc, l) => (l.eleitores == null ? acc : (acc ?? 0) + l.eleitores),
      null,
    );

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

    // O percentual apurado da região: o que já foi contado dividido pelo total
    // da região. Soma sobre soma, sem peso nenhum — a divisão já pesa cada UF
    // pelo tamanho do voto que ela tem.
    const apuradoTotal = comPct.reduce((s, c) => s + c.votosApurados, 0);
    const processado = projetadoTotal > 0 ? (apuradoTotal / projetadoTotal) * 100 : 0;

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

/* ──────────────────── a leitura de cada linha da tabela ────────────────── */

/**
 * A margem COMO APURADA, e se o que falta ainda pode virar a linha.
 *
 * O ponto da função é que a tabela mostrava `pctProjetado` sob um cabeçalho
 * que dizia "% Fulano". Projeção com rótulo de contagem é o erro clássico de
 * noite de eleição impresso na célula: um estado com 20% apurado exibia
 * "63,61%" com duas casas, tipograficamente idêntico a um com 95%, e quem lê
 * entende "63,61% das urnas contadas disseram isso". Aqui a margem sai dos
 * votos JÁ CONTADOS, e a projeção continua existindo em coluna que se chama
 * projeção.
 *
 * `podeVirar` é um teste binário e exato, sem modelo nenhum: a vantagem atual
 * em votos é menor que o total que ainda pode entrar naquela linha? Se for,
 * aquele estado ainda pode mudar de lado; se não for, está decidido ali.
 */
export interface MargemDaLinha {
  readonly lider: string | null;
  readonly pontos: number;
  readonly votos: number;
  readonly restantes: number;
  readonly podeVirar: boolean;
}

export function margemApurada(l: Pick<LinhaUf, 'porCandidato'>): MargemDaLinha {
  const [a, b] = l.porCandidato;
  if (!a || !b) return { lider: null, pontos: 0, votos: 0, restantes: 0, podeVirar: true };

  const apurados = a.votosApurados + b.votosApurados;
  const projetados = a.votosProjetados + b.votosProjetados;
  const restantes = Math.max(0, projetados - apurados);
  if (apurados <= 0) return { lider: null, pontos: 0, votos: 0, restantes, podeVirar: true };

  const saldo = a.votosApurados - b.votosApurados;
  return {
    lider: saldo === 0 ? null : saldo > 0 ? a.candidato : b.candidato,
    pontos: (saldo / apurados) * 100,
    votos: saldo,
    restantes,
    podeVirar: Math.abs(saldo) <= restantes,
  };
}

/** Percentual APURADO de um candidato na linha — contagem, não projeção. */
export function pctApuradoNaLinha(
  l: Pick<LinhaUf, 'porCandidato'>,
  candidato: string,
): number | null {
  const total = l.porCandidato.reduce((s, c) => s + c.votosApurados, 0);
  if (total <= 0) return null;
  const c = l.porCandidato.find((x) => x.candidato === candidato);
  return c ? (c.votosApurados / total) * 100 : null;
}

export type Ordenacao = 'eleitorado' | 'alfabetica' | 'mais-apurados' | 'menos-apurados' | 'margem';

export const ORDENACOES: readonly { readonly valor: Ordenacao; readonly rotulo: string }[] = [
  { valor: 'eleitorado', rotulo: 'Eleitorado' },
  { valor: 'alfabetica', rotulo: 'Alfabética' },
  { valor: 'menos-apurados', rotulo: 'Menos apurados' },
  { valor: 'mais-apurados', rotulo: 'Mais apurados' },
  { valor: 'margem', rotulo: 'Maior margem' },
];

/**
 * Reordena sem mexer na ordem FIXA das colunas de candidato.
 *
 * "Menos apurados" existe porque responde sozinha a pergunta que a tabela não
 * respondia de jeito nenhum — quais estados ainda não terminaram —, e que na
 * ordem por eleitorado exige varrer 27 barrinhas de 4px.
 */
export function ordenarLinhas<T extends LinhaUf | LinhaRegiao>(
  linhas: readonly T[],
  ordem: Ordenacao,
): readonly T[] {
  const chave = (l: T): string => ('regiao' in l ? l.regiao : l.uf);
  const copia = [...linhas];
  switch (ordem) {
    case 'alfabetica':
      return copia.sort((a, b) => chave(a).localeCompare(chave(b), 'pt-BR'));
    case 'mais-apurados':
      return copia.sort((a, b) => b.processado - a.processado);
    case 'menos-apurados':
      return copia.sort((a, b) => a.processado - b.processado);
    case 'margem':
      return copia.sort(
        (a, b) => Math.abs(margemApurada(b).pontos) - Math.abs(margemApurada(a).pontos),
      );
    case 'eleitorado':
    default:
      return copia.sort((a, b) => (b.eleitores ?? 0) - (a.eleitores ?? 0));
  }
}

/* ──────────────────────────── exportação em CSV ────────────────────────── */

/**
 * O CSV da leitura.
 *
 * Duas regras de dialeto, as duas para o arquivo abrir certo no Excel em
 * português do Brasil, que é onde ele vai ser aberto:
 *
 * - separador `;` e decimal com vírgula. Com decimal vírgula, separar por
 *   vírgula faria cada número virar duas colunas;
 * - **nenhum separador de milhar**. `formatarInt` usa `toLocaleString('pt-BR')`
 *   e devolve `34.104.226`; numa célula de planilha isso é texto, ou pior, um
 *   número errado. Aqui vai `34104226`.
 *
 * E uma regra que não é de dialeto, é de honestidade: a hora da leitura e o
 * percentual apurado viajam DENTRO do arquivo, em toda linha. Um CSV de
 * apuração sem isso é uma armadilha — daqui a uma hora ele está errado e nada
 * no arquivo diz a partir de quando.
 */
export interface OpcoesCsv {
  readonly linhas: readonly (LinhaUf | LinhaRegiao)[];
  readonly candidatos: readonly [string, string];
  readonly lidoEm: string | null;
  readonly apuradoNacional: number;
  readonly simulacao: boolean;
  readonly recorte: 'estados' | 'regioes';
}

function campoCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function inteiroCsv(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '' : String(Math.round(n));
}

function decimalCsv(n: number | null | undefined, casas = 2): string {
  return n == null || !Number.isFinite(n) ? '' : n.toFixed(casas).replace('.', ',');
}

/** Chave da coluna de candidato, sem acento e sem espaço. */
function chaveDe(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function montarCsv(o: OpcoesCsv): string {
  const [a, b] = o.candidatos;
  const ka = chaveDe(a);
  const kb = chaveDe(b);
  const unidade = o.recorte === 'regioes' ? 'regiao' : 'uf';

  const cabecalho = [
    'lido_em_local',
    'modo',
    unidade,
    'eleitores',
    'secoes_apuradas_pct',
    'finalizada',
    'lider',
    // O sinal é sempre em relação ao PRIMEIRO candidato: positivo é vantagem
    // dele, negativo é do segundo. Uma coluna "margem" sem dono no nome
    // obriga quem abre a planilha a adivinhar o referencial, e metade vai
    // adivinhar errado.
    `margem_pontos_${ka}_menos_${kb}`,
    `margem_votos_${ka}_menos_${kb}`,
    'ainda_pode_virar',
    `pct_apurado_${ka}`,
    `votos_apurados_${ka}`,
    `votos_projetados_${ka}`,
    `pct_apurado_${kb}`,
    `votos_apurados_${kb}`,
    `votos_projetados_${kb}`,
    'validos_apurados',
    'brancos',
    'nulos',
    'abstencoes',
    'apurado_br_pct',
    'lido_em_iso',
  ];

  // `toLocaleString('pt-BR')` devolve "25/10/2026, 14:07:09" — com vírgula, e
  // a vírgula impede o Excel de reconhecer a célula como data e hora. Aqui o
  // carimbo sai no formato que ele lê.
  const hora = o.lidoEm ? new Date(o.lidoEm) : null;
  const dois = (n: number): string => String(n).padStart(2, '0');
  const local =
    hora && !Number.isNaN(hora.getTime())
      ? `${dois(hora.getDate())}/${dois(hora.getMonth() + 1)}/${hora.getFullYear()} ${dois(hora.getHours())}:${dois(hora.getMinutes())}:${dois(hora.getSeconds())}`
      : '';
  const iso = o.lidoEm ?? '';
  const modo = o.simulacao ? 'SIMULACAO' : 'apuracao-tse';

  const linhas = o.linhas.map((l) => {
    const m = margemApurada(l);
    const ca = l.porCandidato.find((c) => c.candidato === a);
    const cb = l.porCandidato.find((c) => c.candidato === b);
    const vazia = semDado(l);
    return [
      local,
      modo,
      'regiao' in l ? l.regiao : l.uf,
      inteiroCsv(l.eleitores),
      decimalCsv(l.processado, 1),
      l.finalizada ? 'sim' : 'nao',
      m.lider ?? '',
      vazia ? '' : decimalCsv(m.pontos),
      vazia ? '' : inteiroCsv(m.votos),
      vazia ? '' : m.podeVirar ? 'sim' : 'nao',
      decimalCsv(pctApuradoNaLinha(l, a)),
      inteiroCsv(ca?.votosApurados),
      inteiroCsv(ca?.votosProjetados),
      decimalCsv(pctApuradoNaLinha(l, b)),
      inteiroCsv(cb?.votosApurados),
      inteiroCsv(cb?.votosProjetados),
      inteiroCsv(l.validosApurados),
      inteiroCsv(l.brancos),
      inteiroCsv(l.nulos),
      inteiroCsv(l.abstencoes),
      decimalCsv(o.apuradoNacional, 1),
      iso,
    ];
  });

  // BOM: sem ele o Excel estraga "Abstenções" e "Inácio". CRLF por RFC 4180.
  return (
    '﻿' +
    [cabecalho, ...linhas].map((campos) => campos.map(campoCsv).join(';')).join('\r\n') +
    '\r\n'
  );
}

/**
 * O nome do arquivo carrega a hora E o percentual apurado.
 *
 * Com dois downloads na mesma pasta numa noite de apuração, é o que diz qual
 * é o mais completo sem abrir os dois. E em simulação o nome começa por
 * `SIMULACAO-`: a tarja de aviso da tela não viaja dentro do arquivo, o nome
 * viaja — um CSV simulado solto numa redação é exatamente a armadilha.
 */
export function nomeDoArquivoCsv(o: {
  readonly lidoEm: string | null;
  readonly apuradoNacional: number;
  readonly simulacao: boolean;
  readonly recorte: 'estados' | 'regioes';
  readonly turno: 1 | 2;
}): string {
  const d = o.lidoEm ? new Date(o.lidoEm) : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const dois = (n: number): string => String(n).padStart(2, '0');
  const carimbo = `${base.getFullYear()}-${dois(base.getMonth() + 1)}-${dois(base.getDate())}-${dois(base.getHours())}${dois(base.getMinutes())}`;
  const pct = `${o.apuradoNacional.toFixed(1).replace('.', '-')}pc`;
  return `${o.simulacao ? 'SIMULACAO-' : ''}apuracao-presidente-${o.turno}t-${o.recorte}-${carimbo}-${pct}.csv`;
}

/**
 * O nome curto para caber em cabeçalho de coluna e em rótulo de barra.
 *
 * Numa tela de 390px, "% Luiz Inácio Lula da Silva" quebra em quatro linhas e
 * empurra o resto da tabela para fora. A regra é a do uso corrente: o nome
 * pelo qual a pessoa é chamada, que em português é o primeiro nome — exceto
 * quando há um apelido consagrado no meio do nome completo, e aí é ele.
 *
 * A lista de apelidos não é hard-code de uma eleição: ela só reconhece
 * palavras que já estão DENTRO do nome recebido. Se o nome não traz nenhuma,
 * cai no primeiro nome, que funciona para qualquer candidato.
 */
const APELIDOS_CONSAGRADOS = ['lula', 'ciro', 'dilma', 'tiririca', 'pelé'];

export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return nome;
  const semAcento = (t: string): string =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const apelido = partes.find((pt) => APELIDOS_CONSAGRADOS.includes(semAcento(pt)));
  return apelido ?? partes[0] ?? nome;
}

/* ───────────────────── o que o mouse mostra num estado ─────────────────── */

/**
 * O conteúdo da dica que aparece ao passar o mouse num estado.
 *
 * Tudo aqui é do MOMENTO: percentual sobre os votos já contados, e não sobre
 * a projeção. É o que a pergunta "como está esse estado agora" quer dizer, e
 * é o único número do estado que não depende de premissa nenhuma.
 *
 * Estado sem seção apurada não ganha percentual — nem zero, que seria uma
 * afirmação sobre o voto de lá. Ele diz que não começou, e pronto.
 */
export interface DicaDaUf {
  readonly titulo: string;
  readonly processado: string;
  readonly candidatos: readonly { readonly nome: string; readonly pct: string; readonly votos: string }[];
  readonly nota: string | null;
}

export function montarDicaDaUf(opcoes: {
  readonly nome: string;
  readonly linha: LinhaUf | null;
  readonly ordem: readonly [string, string];
  /** Região do estado, quando o mapa está no recorte por região. */
  readonly regiao: { readonly nome: string; readonly processado: number; readonly lider: string | null } | null;
}): DicaDaUf {
  const { linha, regiao } = opcoes;

  if (linha == null || semDado(linha)) {
    return {
      titulo: opcoes.nome,
      processado: 'nenhuma seção apurada',
      candidatos: [],
      nota:
        regiao == null
          ? null
          : `Região ${regiao.nome}: ${formatarPct(regiao.processado)} apurado${
              regiao.lider ? `, ${nomeCurto(regiao.lider)} à frente` : ''
            }.`,
    };
  }

  return {
    titulo: opcoes.nome,
    processado: `${formatarPct(linha.processado)} computado${linha.finalizada ? ' · apuração encerrada' : ''}`,
    candidatos: opcoes.ordem.map((nome) => {
      const c = linha.porCandidato.find((x) => x.candidato === nome);
      return {
        nome: nomeCurto(nome),
        pct: formatarPct(pctApuradoNaLinha(linha, nome), 1),
        votos: formatarInt(c?.votosApurados),
      };
    }),
    nota:
      regiao == null
        ? null
        : `Região ${regiao.nome}: ${formatarPct(regiao.processado)} apurado${
            regiao.lider ? `, ${nomeCurto(regiao.lider)} à frente` : ''
          }.`,
  };
}

/* ─────────────────────── a espera até as 19h ───────────────────────────── */

/**
 * A apuração fica zerada até a hora combinada.
 *
 * É uma decisão de quem publica a página, não uma limitação técnica: os
 * arquivos do TSE já estão no ar e a página já sabe lê-los. Por isso a tela
 * precisa DIZER que está segurando, com a hora, em vez de mostrar zeros
 * calados — zero calado se lê como "ninguém votou" ou "o site quebrou", e as
 * duas leituras são falsas.
 *
 * A comparação é feita em horário de Brasília, pelo mesmo motivo que o resto
 * da tela: "19h" aqui é 19h de Brasília para todo mundo, inclusive para quem
 * abre a página de outro fuso.
 */
export function horaDeBrasilia(agora: Date): number {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_DE_BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
    // Os SEGUNDOS entram porque sem eles a conta de quanto falta erra por até
    // um minuto inteiro: às 18h59m55 a hora era lida como 18,9833 (ou seja,
    // 18h59m00) e o despertador da liberação era marcado para 60 segundos
    // adiante em vez de 5. Numa liberação marcada na hora cheia, atrasar um
    // minuto é a diferença entre virar na hora e parecer travado.
    second: '2-digit',
    hour12: false,
  }).formatToParts(agora);
  const campo = (tipo: string): number =>
    Number(partes.find((p) => p.type === tipo)?.value ?? '0');
  return campo('hour') + campo('minute') / 60 + campo('second') / 3600;
}

/** `true` enquanto a apuração deve aparecer zerada. */
export function apuracaoRetida(agora: Date, liberaAs = 19): boolean {
  return horaDeBrasilia(agora) < liberaAs;
}

/** Quantos milissegundos faltam para a liberação, ou 0 se já passou. */
export function faltaParaLiberar(agora: Date, liberaAs = 19): number {
  const horas = liberaAs - horaDeBrasilia(agora);
  return horas <= 0 ? 0 : Math.ceil(horas * 3600 * 1000);
}

/* ──────────────── quando o TSE não responde ───────────────────────────── */

/**
 * O aviso de leitura falha, no topo e não no rodapé.
 *
 * Numa noite de apuração o TSE responde 429 (excesso de requisições) com
 * facilidade, e quando isso acontece com TODAS as UFs a tela fica com zeros e
 * sem os cartões dos candidatos — que é indistinguível de "a apuração não
 * começou". O motivo existia, mas no rodapé, depois do mapa e da tabela: quem
 * olha o topo e vê zero não desce para descobrir por quê, conclui que o site
 * quebrou, e vai embora.
 *
 * `null` quando não há o que avisar. Falha parcial também avisa: a projeção
 * fica menor sem as UFs que faltaram, e isso muda o número do topo.
 */
export interface FalhaDeLeitura {
  readonly total: boolean;
  readonly texto: string;
}

export function notaDeFalhaDeLeitura(
  fontes: readonly { readonly ok: boolean }[],
): FalhaDeLeitura | null {
  if (fontes.length === 0) return null;
  const falhas = fontes.filter((f) => !f.ok).length;
  if (falhas === 0) return null;

  if (falhas === fontes.length) {
    return {
      total: true,
      texto:
        'Não consegui ler nenhum arquivo do TSE nesta tentativa. Os números abaixo estão zerados por isso, e não porque a apuração não começou. Em noite de eleição o servidor do TSE recusa requisições demais vindas do mesmo lugar: esperar alguns segundos e usar o botão Atualizar costuma resolver.',
    };
  }
  return {
    total: false,
    texto: `${falhas} de ${fontes.length} arquivos do TSE não responderam nesta leitura. Os números abaixo estão INCOMPLETOS: as unidades que faltaram ficam de fora da soma e da projeção, então o total aparece menor do que é. O botão Atualizar tenta de novo.`,
  };
}

/* ───────────────── a série da noite, de 5 em 5 minutos ─────────────────── */

/**
 * O histórico da apuração, amostrado de cinco em cinco minutos.
 *
 * Ele existe para mostrar a tese da tela acontecendo: o percentual APURADO
 * balança a noite toda conforme os estados vão totalizando em ordens
 * diferentes, enquanto a PROJEÇÃO, montada estado a estado, fica firme desde
 * cedo. Lado a lado, as duas curvas provam o argumento melhor do que qualquer
 * parágrafo — e quando elas se encontram no fim, a projeção fica verificada
 * contra o resultado.
 *
 * A série é do NAVEGADOR de quem olha, e isso precisa ser dito na tela: ela
 * começa quando a pessoa abre a página e vive só ali. Não há servidor nosso
 * guardando nada, e quem abrir às 22h não verá as 19h de quem ficou a noite
 * toda. Prometer um histórico que não existe seria pior do que declarar o que
 * ele é.
 */
export interface AmostraDaNoite {
  /** Início do balde de 5 minutos, em ISO. É a chave da amostra. */
  readonly em: string;
  readonly processado: number;
  readonly porCandidato: readonly {
    readonly candidato: string;
    readonly pctApurado: number;
    readonly pctProjetado: number;
  }[];
}

/** O balde de cinco minutos a que um instante pertence. */
export function baldeDeCincoMinutos(quando: Date, minutos = 5): string {
  const ms = minutos * 60 * 1000;
  return new Date(Math.floor(quando.getTime() / ms) * ms).toISOString();
}

/**
 * Acrescenta uma amostra à série.
 *
 * Duas regras, e as duas existem para a curva não mentir:
 *
 * 1. **Uma amostra por balde.** Quem aperta Atualizar seis vezes no mesmo
 *    minuto não cria seis pontos: o balde é substituído pelo valor mais
 *    recente. Sem isso a linha ganharia densidade onde houve cliques, e não
 *    onde houve apuração.
 * 2. **Leitura sem voto não entra.** Uma falha de rede que devolve zero viraria
 *    um mergulho a 0% no meio do gráfico, que se lê como "a apuração voltou
 *    atrás" — coisa que não acontece.
 */
export function acrescentarAmostra(
  serie: readonly AmostraDaNoite[],
  nova: AmostraDaNoite,
  limite = 400,
): readonly AmostraDaNoite[] {
  if (nova.processado <= 0) return serie;

  const semOBalde = serie.filter((a) => a.em !== nova.em);
  return [...semOBalde, nova].sort((a, b) => a.em.localeCompare(b.em)).slice(-limite);
}

/** Pontos de uma série para desenhar, já em fração de 0 a 1 dos eixos. */
export interface PontoDaSerie {
  readonly x: number;
  readonly y: number;
}

/**
 * Converte a série em pontos, com o eixo Y preso a uma janela fixa.
 *
 * A janela é FIXA (padrão de 30 a 70) e não ajustada aos dados: num gráfico
 * que se redesenha a cada cinco minutos, eixo elástico faz a curva mudar de
 * forma sem o dado ter mudado de valor, e quem olha duas vezes vê movimento
 * que não houve. O preço é que um valor fora da janela fica achatado na
 * borda, e por isso ele é clampado de propósito, não escondido.
 */
export function pontosDaSerie(
  serie: readonly AmostraDaNoite[],
  candidato: string,
  campo: 'pctApurado' | 'pctProjetado',
  janela: { readonly min: number; readonly max: number } = { min: 30, max: 70 },
): readonly PontoDaSerie[] {
  if (serie.length === 0) return [];
  const t0 = new Date(serie[0]!.em).getTime();
  const t1 = new Date(serie[serie.length - 1]!.em).getTime();
  const span = Math.max(1, t1 - t0);

  return serie
    .map((a) => {
      const c = a.porCandidato.find((x) => x.candidato === candidato);
      if (!c) return null;
      const valor = Math.max(janela.min, Math.min(janela.max, c[campo]));
      return {
        x: (new Date(a.em).getTime() - t0) / span,
        y: 1 - (valor - janela.min) / (janela.max - janela.min),
      };
    })
    .filter((p): p is PontoDaSerie => p != null);
}

/** As horas a marcar no eixo X, uma por hora cheia dentro da série. */
export function marcasDeHora(serie: readonly AmostraDaNoite[]): readonly { readonly x: number; readonly rotulo: string }[] {
  if (serie.length < 2) return [];
  const t0 = new Date(serie[0]!.em).getTime();
  const t1 = new Date(serie[serie.length - 1]!.em).getTime();
  const span = Math.max(1, t1 - t0);

  const marcas: { x: number; rotulo: string }[] = [];
  const primeira = new Date(t0);
  primeira.setMinutes(0, 0, 0);
  for (let t = primeira.getTime(); t <= t1; t += 3600 * 1000) {
    if (t < t0) continue;
    marcas.push({
      x: (t - t0) / span,
      rotulo: new Date(t).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: FUSO_DE_BRASILIA,
      }),
    });
  }
  return marcas;
}

/* ─────────────────── nomes de urna e nomes canônicos ──────────────────── */

/** Os dois finalistas do 2º turno, na ordem fixa usada por toda a tela. */
export const FINALISTAS_2T: readonly [string, string] = [
  'Flávio Bolsonaro',
  'Luiz Inácio Lula da Silva',
];

/**
 * O nome de urna da fonte oficial traduzido para o nome canônico da base.
 *
 * O TSE publica "FLAVIO BOLSONARO" e "LULA". Gravar o nome de urna quebraria
 * duas coisas de uma vez: o ranking de institutos, que casa pesquisa com
 * apuração POR NOME, e o gráfico da noite, cujas séries são procuradas pelo
 * nome canônico — uma série gravada como "LULA" simplesmente não apareceria.
 *
 * Mora aqui, e não dentro da view, porque o script que grava o histórico no
 * repositório precisa da MESMA tradução. Duas cópias divergiriam, e a
 * divergência só apareceria como uma linha que some do gráfico.
 */
export function nomeCanonicoDaUrna(nomeDeUrna: string): string {
  const n = nomeDeUrna.toUpperCase();
  if (n.includes('FLAVIO') || n.includes('FLÁVIO')) return FINALISTAS_2T[0];
  if (n.includes('LULA') || n.includes('INACIO') || n.includes('INÁCIO')) return FINALISTAS_2T[1];
  return nomeDeUrna;
}
