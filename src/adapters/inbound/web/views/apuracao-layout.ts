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
