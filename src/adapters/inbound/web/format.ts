import type { Espectro } from '../../../domain/spectrum.js';

/**
 * Helpers de formatação e de mapeamento para tokens CSS, usados pela UI
 * (adapters/inbound/web). Não têm I/O e não dependem de DOM — puros o
 * suficiente para testar sem jsdom.
 */

/** Nível de confiança da liderança, ver docs/design-system.md. */
export type NivelConfianca = 'solid' | 'lean' | 'empate' | 'semDados';

const INDICE_ESPECTRO: Record<Exclude<Espectro, 'indefinido'>, 1 | 2 | 3 | 4 | 5> = {
  esquerda: 1,
  'centro-esquerda': 2,
  centro: 3,
  'centro-direita': 4,
  direita: 5,
};

const ROTULOS_ESPECTRO: Record<Espectro, string> = {
  esquerda: 'Esquerda',
  'centro-esquerda': 'Centro-esquerda',
  centro: 'Centro',
  'centro-direita': 'Centro-direita',
  direita: 'Direita',
  indefinido: 'Não classificado',
};

/** Formata um número com vírgula decimal (padrão pt-BR), N casas (padrão 1). */
export function formatarNumeroPt(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

/** Formata um percentual com 1 casa decimal e vírgula: "42,3%". */
export function formatarPct(valor: number, casas = 1): string {
  return `${formatarNumeroPt(valor, casas)}%`;
}

/**
 * Formata uma data ISO (YYYY-MM-DD, com ou sem hora) para o formato curto
 * pt-BR "dd/mm/aaaa". Faz o parsing manual (sem `new Date`) para não sofrer
 * deslocamento de fuso horário quando a entrada não tem componente de hora.
 */
export function formatarData(dataIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!m) return dataIso;
  const [, ano, mes, dia] = m;
  return `${dia}/${mes}/${ano}`;
}

/** Formata a vantagem em pontos entre 1º e 2º colocado: "+5,2 pts". */
export function formatarVantagem(vantagem: number, casas = 1): string {
  const sinal = vantagem < 0 ? '−' : '+';
  return `${sinal}${formatarNumeroPt(Math.abs(vantagem), casas)} pts`;
}

/** Rótulo textual do espectro ideológico — nunca só a cor (WCAG 1.4.1). */
export function rotuloEspectro(espectro: Espectro): string {
  return ROTULOS_ESPECTRO[espectro];
}

/**
 * Classifica a confiança da liderança a partir da vantagem (pontos) e da
 * margem de referência ponderada do agregado, seguindo as 3 faixas de
 * docs/design-system.md. `semDados` tem prioridade sobre o cálculo.
 */
export function nivelConfianca(
  vantagem: number,
  margemReferencia: number,
  semDados: boolean,
): NivelConfianca {
  if (semDados) return 'semDados';
  if (vantagem <= margemReferencia) return 'empate';
  if (vantagem < margemReferencia * 2) return 'lean';
  return 'solid';
}

/**
 * Variável CSS de preenchimento (`-fill`) para o espectro do partido líder.
 * Quando não há dados suficientes, ignora o espectro e devolve o cinza
 * neutro de "sem dados" (nunca implica liderança inexistente com cor de
 * partido).
 */
export function corEspectro(espectro: Espectro, confianca: NivelConfianca): string {
  if (confianca === 'semDados') return 'var(--confidence-sem-dados-fill)';
  if (espectro === 'indefinido') return 'var(--spectrum-indefinido)';
  return `var(--spectrum-${INDICE_ESPECTRO[espectro]}-fill)`;
}

/** Variável CSS de preenchimento sólido (`-solid`, contraste ≥ 4.5:1 com texto branco) para badges. */
export function corEspectroSolido(espectro: Espectro): string {
  if (espectro === 'indefinido') return 'var(--spectrum-indefinido)';
  return `var(--spectrum-${INDICE_ESPECTRO[espectro]}-solid)`;
}

/** Variável CSS de opacidade de confiança correspondente ao nível. */
export function opacidadeConfianca(confianca: NivelConfianca): string {
  switch (confianca) {
    case 'solid':
      return 'var(--confidence-solid-opacity)';
    case 'lean':
      return 'var(--confidence-lean-opacity)';
    case 'empate':
      return 'var(--confidence-empate-opacity)';
    case 'semDados':
      return '1';
  }
}

/** Rótulo textual curto do nível de confiança — reforço não-cromático. */
export function rotuloConfianca(confianca: NivelConfianca): string {
  switch (confianca) {
    case 'solid':
      return 'Lidera com folga';
    case 'lean':
      return 'Lidera, corrida acirrada';
    case 'empate':
      return 'Empate técnico';
    case 'semDados':
      return 'Sem dados';
  }
}
