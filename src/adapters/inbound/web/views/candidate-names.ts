/**
 * Nome de exibição curto dos candidatos presidenciais de 2026 — barra de
 * qualidade: NYT usa o nome pelo qual o candidato é conhecido ("Harris +1",
 * "Trump +3"), nunca o nome completo nem sempre o 1º nome (que para "Luiz
 * Inácio Lula da Silva" seria "Luiz", errado). Usado em qualquer rótulo
 * apertado (fim de linha do gráfico temporal, título de miniatura, cartão de
 * 2º turno); o nome completo continua disponível via `title`/`aria-label`
 * nos locais que o exibem (ver views/timeline-chart.ts, views/
 * presidential-states-view.ts).
 */

interface Apelido {
  /** Rótulo curto para espaços "normais" (legenda, fim de linha, cartão de 2º turno). */
  readonly curto: string;
  /** Rótulo ainda mais curto para espaços muito apertados (miniatura por estado). */
  readonly curtissimo?: string;
}

/** Chaves em minúsculas/trim — ver `normalizar`. */
const APELIDOS: Readonly<Record<string, Apelido>> = {
  'luiz inácio lula da silva': { curto: 'Lula' },
  lula: { curto: 'Lula' },
  'flávio bolsonaro': { curto: 'Flávio Bolsonaro', curtissimo: 'Flávio' },
  'augusto cury': { curto: 'Cury' },
  'ronaldo caiado': { curto: 'Caiado' },
  'romeu zema': { curto: 'Zema' },
  'renan santos': { curto: 'Renan Santos' },
  'pablo marçal': { curto: 'Marçal' },
};

/** Partículas nobiliárquicas/preposições ignoradas ao achar o último sobrenome. */
const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das']);

/**
 * Sobrenomes comuns o bastante para que o sobrenome sozinho seja ambíguo
 * entre vários candidatos/pessoas públicas — nesses casos mantemos o
 * primeiro nome junto (ex.: "Renan Santos", não só "Santos").
 */
const SOBRENOMES_AMBIGUOS = new Set([
  'silva',
  'santos',
  'oliveira',
  'souza',
  'pereira',
  'lima',
  'costa',
]);

function normalizar(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Regra genérica (sem apelido cadastrado): último sobrenome, ignorando
 * partículas ("de/da/do/dos/das") — com o primeiro nome na frente quando
 * esse sobrenome é ambíguo demais para identificar sozinho (ver
 * `SOBRENOMES_AMBIGUOS`). Nome de um único token retorna o próprio nome.
 */
function nomeCurtoGenerico(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().replace(/\s+/g, ' ').split(' ');
  if (partes.length <= 1) return partes[0] ?? nomeCompleto;

  let idx = partes.length - 1;
  while (idx > 0 && PARTICULAS.has(partes[idx]!.toLowerCase())) idx--;
  const sobrenome = partes[idx]!;
  const primeiroNome = partes[0]!;

  return SOBRENOMES_AMBIGUOS.has(sobrenome.toLowerCase()) ? `${primeiroNome} ${sobrenome}` : sobrenome;
}

/**
 * Nome curto de exibição de um candidato: o apelido pelo qual é conhecido
 * quando cadastrado em `APELIDOS`, senão a regra genérica de sobrenome (ver
 * `nomeCurtoGenerico`). Uso: rótulo de fim de linha e legenda do gráfico
 * temporal, título dos cartões de 2º turno.
 */
export function nomeCurto(candidato: string): string {
  const entrada = APELIDOS[normalizar(candidato)];
  return entrada ? entrada.curto : nomeCurtoGenerico(candidato);
}

/**
 * Nome ainda mais curto para espaços muito apertados (título de miniatura
 * "Minas Gerais › Lula +4"): igual a `nomeCurto` para a maioria dos
 * candidatos, mas usa o apelido `curtissimo` quando cadastrado (ex.:
 * "Flávio Bolsonaro" -> "Flávio", para não competir por espaço com o nome do
 * estado e a vantagem numérica).
 */
export function nomeCurtissimo(candidato: string): string {
  const entrada = APELIDOS[normalizar(candidato)];
  if (entrada) return entrada.curtissimo ?? entrada.curto;
  return nomeCurtoGenerico(candidato);
}
