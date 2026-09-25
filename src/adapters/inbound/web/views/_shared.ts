import { JANELA_DIAS_PADRAO } from '../../../../domain/aggregate.js';
import type { Espectro } from '../../../../domain/spectrum.js';
import type { Fonte } from '../../../../domain/poll.js';
import { nomeCurto } from './candidate-names.js';

/**
 * Helpers locais e específicos das views que este módulo possui (presidential,
 * senate, parties). Não são compartilhados com as views de outro adaptador —
 * ver docs/design-system.md para os tokens de cor/espectro consumidos aqui.
 */

/** Formata um número com vírgula decimal (padrão pt-BR), casas fixas. */
export function formatarNumero(valor: number, casasDecimais = 1): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  });
}

/** Formata um percentual (0..100) com vírgula decimal e símbolo "%". */
export function formatarPct(valor: number, casasDecimais = 1): string {
  return `${formatarNumero(valor, casasDecimais)}%`;
}

/** Formata uma data ISO (YYYY-MM-DD) como dd/mm/aaaa. "—" quando ausente/ inválida. */
export function formatarData(dataIso: string | null | undefined): string {
  if (!dataIso) return '—';
  const [ano, mes, dia] = dataIso.split('-');
  if (!ano || !mes || !dia) return '—';
  return `${dia}/${mes}/${ano}`;
}

/** Formata um período de campo (dataInicio–dataFim), com fallback para uma única data. */
export function formatarPeriodo(dataInicio: string | undefined, dataFim: string | undefined): string {
  if (dataInicio && dataFim && dataInicio !== dataFim) {
    return `${formatarData(dataInicio)}–${formatarData(dataFim)}`;
  }
  return formatarData(dataFim ?? dataInicio);
}

const ROTULOS_ESPECTRO: Readonly<Record<Espectro, string>> = {
  esquerda: 'Esquerda',
  'centro-esquerda': 'Centro-esquerda',
  centro: 'Centro',
  'centro-direita': 'Centro-direita',
  direita: 'Direita',
  indefinido: 'Não classificado',
};

/** Rótulo textual do espectro — nunca depender só da cor (ver docs/ux-spec.md §3). */
export function rotuloEspectro(espectro: Espectro): string {
  return ROTULOS_ESPECTRO[espectro];
}

/** Sigla curta do espectro (E/CE/C/CD/D), usada em espaços apertados (ex. badge). */
const SIGLAS_ESPECTRO: Readonly<Record<Espectro, string>> = {
  esquerda: 'E',
  'centro-esquerda': 'CE',
  centro: 'C',
  'centro-direita': 'CD',
  direita: 'D',
  indefinido: '?',
};

export function siglaEspectro(espectro: Espectro): string {
  return SIGLAS_ESPECTRO[espectro];
}

/** Nível numérico (1..5) da escala de espectro de design-system.md, ou 'indefinido'. */
export function nivelEspectro(espectro: Espectro): 1 | 2 | 3 | 4 | 5 | 'indefinido' {
  switch (espectro) {
    case 'esquerda':
      return 1;
    case 'centro-esquerda':
      return 2;
    case 'centro':
      return 3;
    case 'centro-direita':
      return 4;
    case 'direita':
      return 5;
    default:
      return 'indefinido';
  }
}

/** Classe CSS `espectro-<nivel>` (espectro-1..espectro-5, espectro-indefinido). */
export function classeEspectro(espectro: Espectro): string {
  return `espectro-${nivelEspectro(espectro)}`;
}

/** Referência var() do token `-fill` (vívido, sem texto por cima) do espectro. */
export function tokenFillEspectro(espectro: Espectro): string {
  const nivel = nivelEspectro(espectro);
  return nivel === 'indefinido' ? 'var(--spectrum-indefinido)' : `var(--spectrum-${nivel}-fill)`;
}

/** Referência var() do token `-solid` (mais escuro, fundo de badge com texto) do espectro. */
export function tokenSolidEspectro(espectro: Espectro): string {
  const nivel = nivelEspectro(espectro);
  return nivel === 'indefinido' ? 'var(--spectrum-indefinido)' : `var(--spectrum-${nivel}-solid)`;
}

export interface OpcoesElemento {
  className?: string;
  texto?: string;
  html?: string;
  attrs?: Readonly<Record<string, string>>;
}

/** Pequeno builder de elementos DOM para reduzir boilerplate nas views. */
export function criarEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opcoes: OpcoesElemento = {},
  filhos: readonly (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (opcoes.className) el.className = opcoes.className;
  if (opcoes.texto != null) el.textContent = opcoes.texto;
  if (opcoes.html != null) el.innerHTML = opcoes.html;
  if (opcoes.attrs) {
    for (const [chave, valor] of Object.entries(opcoes.attrs)) el.setAttribute(chave, valor);
  }
  for (const filho of filhos) {
    if (filho == null) continue;
    el.append(filho);
  }
  return el;
}

/** Badge de sigla de partido, colorida pelo espectro (token -solid + texto branco). */
export function criarBadgePartido(sigla: string, espectro: Espectro): HTMLSpanElement {
  return criarEl(
    'span',
    {
      className: `pv-badge-partido ${classeEspectro(espectro)}`,
      texto: sigla,
      attrs: { title: `${sigla} — ${rotuloEspectro(espectro)}` },
    },
    [criarEl('span', { className: 'pv-sr-only', texto: ` (${rotuloEspectro(espectro)})` })],
  );
}

/** Link externo acessível: nova aba, `rel="noopener noreferrer"` e aviso para leitor de tela. */
export function criarLinkFonte(fonte: Fonte, texto?: string): HTMLAnchorElement {
  return criarEl(
    'a',
    {
      className: 'pv-link-fonte',
      attrs: { href: fonte.url, target: '_blank', rel: 'noopener noreferrer' },
    },
    [texto ?? fonte.nome, criarEl('span', { className: 'pv-sr-only', texto: ' (abre em nova aba)' })],
  );
}

/** Selo textual "EMPATE TÉCNICO" (nunca só cor — texto + classe de destaque). */
export function criarSeloEmpateTecnico(): HTMLSpanElement {
  return criarEl('span', { className: 'pv-selo pv-selo-empate', texto: 'Empate técnico' });
}

export interface FaixaIncerteza {
  /** Início da faixa na escala 0..100. */
  readonly esquerda: number;
  /** Largura da faixa na escala 0..100. */
  readonly largura: number;
}

/**
 * Faixa de incerteza (±`margemReferencia`) centrada em `pct`, recortada na
 * escala 0..100 — usada atrás da barra do candidato em `presidential-view.ts`
 * e atrás do número do líder no hero de `home-view.ts`. Função pura (sem
 * DOM), extraída para as duas views consumirem o mesmo cálculo em vez de
 * duplicar a lógica (ver docs/ux-spec.md §2(c)).
 */
export function calcularFaixaIncerteza(pct: number, margemReferencia: number): FaixaIncerteza {
  const pctLimitado = Math.max(0, Math.min(100, pct));
  const esquerda = Math.max(0, pctLimitado - margemReferencia);
  const direita = Math.min(100, pctLimitado + margemReferencia);
  return { esquerda, largura: Math.max(0, direita - esquerda) };
}

/* ============ Recorte de turno (1º/2º) e recência do dado ============ */

/**
 * Turno da disputa presidencial exibido pelas telas. É o mesmo domínio dos
 * casos de uso (`getPresidentialByState(turno)`, `getVoteEstimate(turno)`),
 * repetido aqui só para as views não dependerem do tipo inline deles.
 */
export type Turno = 1 | 2;

/** Rótulo curto do turno: "1º turno" / "2º turno". */
export function rotuloTurno(turno: Turno): string {
  return `${turno}º turno`;
}

/**
 * Rótulo de um confronto de 2º turno pelos nomes com que os candidatos são
 * conhecidos ("Lula x Flávio Bolsonaro"), preservando a ordem do confronto.
 * `null` no 1º turno (confronto ausente/vazio), onde não há confronto a
 * nomear — nunca inventa um rótulo.
 */
export function rotuloConfronto(confronto: readonly string[] | null | undefined): string | null {
  if (confronto == null || confronto.length === 0) return null;
  return confronto.map(nomeCurto).join(' x ');
}

/**
 * Nome completo do recorte que a tela está mostrando, para cabeçalho,
 * tooltip, cartão e painel do estado: "1º turno" ou
 * "2º turno · Lula x Flávio Bolsonaro". É o texto que torna o turno
 * escolhido explícito em cada peça da tela, em vez de deixar o leitor
 * deduzir pelos números.
 */
export function rotuloRecorte(turno: Turno, confronto?: readonly string[] | null): string {
  const confrontoTexto = rotuloConfronto(confronto);
  return confrontoTexto ? `${rotuloTurno(turno)} · ${confrontoTexto}` : rotuloTurno(turno);
}

/**
 * Marca curta de um agregado que usou pesquisa fora da janela de recência
 * (`Agregado.foraDaJanela` — nenhuma pesquisa do recorte nos últimos
 * `janelaDias` dias, então a mais recente disponível foi usada mesmo
 * assim). Ex.: "Pesquisa de 15/07/2026 — fora da janela de 45 dias".
 * Sem data conhecida, omite a data em vez de inventar uma.
 */
export function rotuloForaDaJanela(
  dataIso: string | null | undefined,
  janelaDias: number = JANELA_DIAS_PADRAO,
): string {
  const data = formatarData(dataIso);
  return data === '—'
    ? `Pesquisa fora da janela de ${janelaDias} dias`
    : `Pesquisa de ${data} — fora da janela de ${janelaDias} dias`;
}

/** Enumeração em português: "A", "A e B", "A, B e C". Lista vazia vira "". */
export function listaEmPortugues(itens: readonly string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0]!;
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]!}`;
}

/** Uma UF cujo agregado usou pesquisa fora da janela, com a data dessa pesquisa. */
export interface UfForaDaJanela {
  /** Nome por extenso do estado (ex.: "Rondônia"). */
  readonly nome: string;
  /** Data (ISO) da pesquisa efetivamente usada, quando conhecida. */
  readonly dataIso?: string | null;
}

/**
 * Aviso de página sobre as UFs cujo dado é real mas antigo — o caso de
 * Rondônia no 2º turno, cuja única pesquisa do confronto Lula x Flávio é de
 * julho. Diz o que é e o que foi feito, sem esconder nem fingir recência.
 * `null` quando nenhuma UF está nessa situação (a tela então não mostra
 * aviso nenhum).
 */
export interface OpcoesAvisoForaDaJanela {
  /** Onde o leitor vai ver a marca, para o aviso apontar o lugar certo em cada tela. */
  readonly onde?: string;
  readonly janelaDias?: number;
}

export function avisoForaDaJanela(
  ufs: readonly UfForaDaJanela[],
  opcoes: OpcoesAvisoForaDaJanela = {},
): string | null {
  if (ufs.length === 0) return null;
  const janelaDias = opcoes.janelaDias ?? JANELA_DIAS_PADRAO;
  const onde = opcoes.onde ?? 'no mapa "Quem lidera", no cartão de tendência e no painel do estado';
  const lista = listaEmPortugues(
    ufs.map((u) => {
      const data = formatarData(u.dataIso);
      return data === '—' ? u.nome : `${u.nome} (${data})`;
    }),
  );
  const verbo = ufs.length === 1 ? 'não tem' : 'não têm';
  return (
    `${lista} ${verbo} pesquisa deste recorte nos últimos ${janelaDias} dias. ` +
    `Em vez de estimar, usamos a pesquisa mais recente disponível: o número é real, mas antigo — e vem marcado ${onde}.`
  );
}
