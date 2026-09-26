/**
 * Funções puras de layout/escala/formatação para a tela "Presidente por
 * estado" (views/presidential-states-view.ts): quantis para o modo
 * "Eleitorado" do mapa, ordenação da grade de miniaturas e geometria do
 * mini-gráfico de tendência (escala x/y, path suavizado, raio por amostra).
 * Sem DOM, sem I/O — testável isoladamente (ver
 * __tests__/presidential-states-layout.test.ts).
 */

/** Campos mínimos para ordenar a grade de miniaturas por estado. */
export interface ItemEleitoral {
  readonly eleitores: number | null;
  readonly semDados: boolean;
}

/**
 * Ordena para a grade de miniaturas: estados com pesquisa primeiro
 * (maior eleitorado primeiro), estados sem pesquisa estadual sempre por
 * último (independente do eleitorado). Não muta o array de entrada.
 */
export function ordenarParaGrade<T extends ItemEleitoral>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.semDados !== b.semDados) return a.semDados ? 1 : -1;
    return (b.eleitores ?? -1) - (a.eleitores ?? -1);
  });
}

/**
 * Breakpoints de quantil (`classes - 1` valores crescentes) sobre uma
 * amostra de números, por interpolação linear entre os índices ordenados
 * (mesmo método usado por bibliotecas de estatística/d3.quantile).
 * `classes` deve ser >= 2. Retorna `[]` para amostra vazia.
 */
export function calcularQuantis(valores: readonly number[], classes = 5): number[] {
  if (valores.length === 0) return [];
  const ordenados = [...valores].sort((a, b) => a - b);
  const breakpoints: number[] = [];
  for (let i = 1; i < classes; i++) {
    const posicao = (i / classes) * (ordenados.length - 1);
    const inferior = Math.floor(posicao);
    const superior = Math.ceil(posicao);
    const valorInferior = ordenados[inferior]!;
    const valorSuperior = ordenados[superior]!;
    const valor =
      inferior === superior
        ? valorInferior
        : valorInferior + (valorSuperior - valorInferior) * (posicao - inferior);
    breakpoints.push(valor);
  }
  return breakpoints;
}

/**
 * Classifica um valor em uma das `breakpoints.length + 1` classes
 * (0-based), dados breakpoints crescentes de `calcularQuantis`.
 */
export function classificarPorQuantil(valor: number, breakpoints: readonly number[]): number {
  let classe = 0;
  for (const bp of breakpoints) {
    if (valor > bp) classe++;
    else break;
  }
  return classe;
}

function comVirgula(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

/**
 * Formata um total de eleitores em português: "157,8 milhões" a partir de 1
 * milhão, "614,6 mil" a partir de 1000, número puro abaixo disso. Usa
 * singular "milhão" quando o valor arredondado é exatamente 1,0.
 */
export function formatarEleitorado(eleitores: number): string {
  if (eleitores >= 1_000_000) {
    const formatado = comVirgula(eleitores / 1_000_000);
    return `${formatado} ${formatado === '1,0' ? 'milhão' : 'milhões'}`;
  }
  if (eleitores >= 1_000) {
    return `${comVirgula(eleitores / 1_000)} mil`;
  }
  return eleitores.toLocaleString('pt-BR');
}

/** Diferença em dias inteiros entre duas datas ISO (YYYY-MM-DD), pode ser negativa. */
export function diasEntreIso(deIso: string, paraIso: string): number {
  const de = Date.parse(`${deIso}T00:00:00Z`);
  const para = Date.parse(`${paraIso}T00:00:00Z`);
  return Math.round((para - de) / 86_400_000);
}

export interface DominioX {
  readonly minIso: string;
  readonly maxIso: string;
}

/**
 * Posição x (0..largura) de uma data ISO dentro do domínio temporal. Quando
 * o domínio é um único dia (`span <= 0`, ex.: só há 1 pesquisa), todo ponto
 * cai no centro em vez de dividir por zero.
 */
export function escalaX(dataIso: string, dominio: DominioX, largura: number): number {
  const span = diasEntreIso(dominio.minIso, dominio.maxIso);
  if (span <= 0) return largura / 2;
  const offset = diasEntreIso(dominio.minIso, dataIso);
  return (offset / span) * largura;
}

/** Um dia da série suave (`SerieTemporal.dias` de domain/aggregate.ts): 1 valor por candidato por data, sem duplicatas. */
export interface DiaValores {
  readonly data: string;
  readonly valores: Readonly<Record<string, number>>;
}

/**
 * Série (data, pct) de UM candidato a partir de `dias` (já suavizada,
 * garantidamente 1 valor por data — ver `serieTemporal` em
 * domain/aggregate.ts), restrita ao intervalo `[dominio.minIso,
 * dominio.maxIso]`. Usada para desenhar a LINHA do mini-gráfico em vez de
 * interpolar os pontos brutos de pesquisa: como pode haver 2+ pesquisas na
 * mesma data (mesmo x), interpolar os pontos brutos produz um laço quando
 * a suavização Catmull-Rom cruza consigo mesma; agregando por dia primeiro,
 * a sequência fica estritamente ordenada por x e nunca laça.
 */
export function serieCandidatoPorDia(
  dias: readonly DiaValores[],
  candidato: string,
  dominio: DominioX,
): Array<{ data: string; pct: number }> {
  const pontos: Array<{ data: string; pct: number }> = [];
  for (const dia of dias) {
    if (dia.data < dominio.minIso || dia.data > dominio.maxIso) continue;
    const pct = dia.valores[candidato];
    if (typeof pct === 'number') pontos.push({ data: dia.data, pct });
  }
  return pontos;
}

export interface DominioY {
  readonly min: number;
  readonly max: number;
}

/**
 * Domínio vertical do mini-gráfico: sempre inclui 50 (linha de empate
 * técnico/tossup, o único "eixo" do gráfico) e garante ao menos `folga * 2`
 * pontos percentuais de amplitude, para que a linha nunca vire um traço
 * reto colado nas bordas quando os valores estão muito próximos.
 */
export function calcularDominioY(valores: readonly number[], folga = 4): DominioY {
  if (valores.length === 0) return { min: 50 - folga, max: 50 + folga };
  let min = Math.min(...valores, 50);
  let max = Math.max(...valores, 50);
  if (max - min < folga * 2) {
    const centro = (max + min) / 2;
    min = centro - folga;
    max = centro + folga;
  } else {
    min -= folga / 2;
    max += folga / 2;
  }
  return { min: Math.max(0, min), max: Math.min(100, max) };
}

/** Posição y (0 = topo/maior pct) de um percentual dentro do domínio e da altura útil. */
export function escalaY(pct: number, dominio: DominioY, altura: number): number {
  const span = dominio.max - dominio.min || 1;
  const clamped = Math.min(dominio.max, Math.max(dominio.min, pct));
  return altura - ((clamped - dominio.min) / span) * altura;
}

export interface PontoXY {
  readonly x: number;
  readonly y: number;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0';
}

/**
 * Constrói o atributo `d` de um path SVG suavizado (Catmull-Rom convertido
 * para curvas de Bézier cúbicas) por uma sequência de pontos já em
 * coordenadas de tela, ordenados por x crescente. Menos de 2 pontos não tem
 * linha (retorna string vazia — o chamador desenha só os pontos); 2 pontos
 * viram um segmento reto (Catmull-Rom degenera para uma reta de qualquer
 * forma nesse caso).
 */
export function caminhoSuavizado(pontos: readonly PontoXY[]): string {
  if (pontos.length < 2) return '';
  if (pontos.length === 2) {
    return `M${fmt(pontos[0]!.x)},${fmt(pontos[0]!.y)} L${fmt(pontos[1]!.x)},${fmt(pontos[1]!.y)}`;
  }
  let d = `M${fmt(pontos[0]!.x)},${fmt(pontos[0]!.y)}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i]!;
    const p1 = pontos[i]!;
    const p2 = pontos[i + 1]!;
    const p3 = pontos[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }
  return d;
}

const RAIO_MIN = 3;
const RAIO_MAX = 9;
const AMOSTRA_REFERENCIA = 1000;

/**
 * Raio (px) de um ponto de pesquisa no mini-gráfico, numa escala de raiz
 * quadrada do tamanho da amostra (percepção de área ~ proporcional ao
 * valor), clampada a [3, 9]px. Amostra ausente usa a referência padrão de
 * agregação (1000, ver domain/aggregate.ts).
 */
export function raioAmostra(amostra: number | null): number {
  const base = amostra != null && amostra > 0 ? amostra : AMOSTRA_REFERENCIA;
  const raio = RAIO_MIN + Math.sqrt(base / AMOSTRA_REFERENCIA) * 3;
  return Math.min(RAIO_MAX, Math.max(RAIO_MIN, raio));
}

/**
 * Padding esquerdo do mini-gráfico: raio do maior ponto que será desenhado
 * (entre as amostras informadas) mais 2px de folga. Sem essa reserva, o
 * ponto mais antigo (o que `escalaX` mapeia para x=0 dentro da área útil)
 * fica com o centro do círculo exatamente na borda esquerda do `viewBox` e
 * metade dele é cortada — bug confirmado via DOM (`cx=0`) em 20 dos 27
 * mini-gráficos por estado. Lista vazia usa o raio mínimo como piso.
 */
export function padEsquerdoMiniChart(amostras: readonly (number | null)[]): number {
  const raioMax = amostras.length > 0 ? Math.max(...amostras.map(raioAmostra)) : RAIO_MIN;
  return raioMax + 2;
}

/**
 * Formata a vantagem de um título curto no estilo NYT: uma casa decimal só
 * quando o valor é menor que 10 (ex.: "+2,3"), inteiro a partir daí (ex.:
 * "+15") — casa decimal a mais não ajuda a leitura rápida de vantagens
 * grandes e só ocupa espaço que este rótulo não tem sobrando.
 */
export function formatarVantagemTitulo(vantagem: number): string {
  const absoluto = Math.abs(vantagem);
  const casas = absoluto < 10 ? 1 : 0;
  return `+${comVirgula(absoluto, casas)}`;
}

/**
 * Verdadeiro quando há pelo menos 2 datas distintas entre as pesquisas
 * plotadas no mini-gráfico — o critério correto para desenhar a linha de
 * tendência é "existe evolução real para suavizar", não quantas pesquisas
 * sobreviveram ao filtro de recência do agregado
 * (`agregado.pesquisasUsadas`, janela de 45 dias por padrão — ver
 * `domain/aggregate.ts`). `datas` deve vir da série real desenhada como
 * pontos (`serie.pontos`/`serie.dias`, não filtrados por janela), nunca de
 * `agregado.pesquisasUsadas` diretamente.
 *
 * Bug corrigido (P0 da revisão): Goiás, Acre e Rondônia têm 2 pesquisas de
 * datas bem distantes (ex.: GO — 2026-09-01 e 2026-05-12, 112 dias de
 * diferença), mas só 1 sobrevivia à janela de 45 dias de
 * `agregado.pesquisasUsadas`, escondendo a linha mesmo havendo os dois
 * pontos reais desenhados no gráfico (`serie.pontos` não é filtrado por
 * janela). O gate antigo (`agregado.pesquisasUsadas.length > 1`) confundia
 * "quantas pesquisas contam para a média ponderada" com "quantas datas
 * distintas foram desenhadas" — são perguntas diferentes.
 */
export function temEvolucaoParaLinha(datas: readonly string[]): boolean {
  return new Set(datas).size > 1;
}

/**
 * Rótulo curto do título de miniatura, estilo NYT: "Lula +2,3", "Harris +15"
 * ou "Empate técnico"/"Sem pesquisa estadual". `liderNome` já deve vir
 * abreviado pelo chamador (ver `nomeCurtissimo` em candidate-names.ts) —
 * esta função só formata a vantagem, não decide o nome de exibição.
 */
export function rotuloVantagemMini(
  liderNome: string | null,
  vantagem: number,
  empateTecnico: boolean,
): string {
  if (!liderNome) return 'Sem pesquisa estadual';
  if (empateTecnico) return 'Empate técnico';
  return `${liderNome} ${formatarVantagemTitulo(vantagem)}`;
}

/* ============ Força da evidência (tinta do mapa) ============ */

/**
 * Faixa de tinta de uma UF no mapa "Quem lidera". Substitui o uso direto de
 * `nivelConfianca` (que só olha vantagem × margem) como canal de opacidade,
 * por dois motivos medidos na revisão do 2º turno:
 *
 * 1. `nivelConfianca` ignora QUANTAS pesquisas sustentam o número. No 2º
 *    turno, 16 das 27 UFs rodam com uma única pesquisa, e o Rio de Janeiro
 *    (1 pesquisa, amostra não informada, +8,0) saía mais opaco — logo, mais
 *    confiável — que São Paulo (3 pesquisas, +5,6). Aqui uma UF com uma só
 *    pesquisa desce um degrau: a tela deixa de afirmar mais confiança do que
 *    o dado tem.
 * 2. Com 3 níveis, o canal ficava inerte: 25 das 27 UFs do 2º turno caíam em
 *    `solid` (opacidade cheia), então São Paulo (+5,6) tinha exatamente a
 *    mesma tinta de Roraima (+40,8). Os degraus são medidos em múltiplos da
 *    margem de erro (2×, 4×, 8×), o que devolve magnitude ao mapa.
 *
 * A escala é relativa à margem de erro DE CADA UF (que varia de ± 1,8 a
 * ± 3,0 pontos nos dados atuais) — é isso que explica a aparente
 * não-monotonicidade (Amapá +4,0 mais forte que o Distrito Federal +4,9) e é
 * o que a nota da legenda diz ao leitor em vez de deixá-lo achar que é bug.
 */
export type FaixaEvidencia = 'semDados' | 'empate' | 'lidera1' | 'lidera2' | 'lidera3' | 'lidera4';

/** Limiares dos degraus, em múltiplos da margem de erro do agregado. */
export const LIMIARES_EVIDENCIA = [2, 4, 8] as const;

export interface EntradaEvidencia {
  readonly vantagem: number;
  readonly margemReferencia: number;
  /** Quantas pesquisas o agregado usou (`Agregado.pesquisasUsadas.length`). */
  readonly nPesquisas: number;
  readonly semDados: boolean;
}

/**
 * Degrau de tinta do mapa. `semDados` tem prioridade; vantagem dentro da
 * margem é empate técnico (mesmo corte de `nivelConfianca`, para o texto do
 * selo e a tinta nunca se contradizerem); acima disso, o degrau vem da razão
 * vantagem/margem e cai um nível quando há uma única pesquisa (nunca abaixo
 * do primeiro degrau — uma pesquisa real ainda é mais que nenhuma).
 */
export function faixaEvidencia(entrada: EntradaEvidencia): FaixaEvidencia {
  if (entrada.semDados) return 'semDados';
  const margem = entrada.margemReferencia;
  if (entrada.vantagem <= 0) return 'empate';
  if (margem > 0 && entrada.vantagem <= margem) return 'empate';
  const razao = margem > 0 ? entrada.vantagem / margem : Infinity;
  const [p1, p2, p3] = LIMIARES_EVIDENCIA;
  let passo = razao < p1 ? 1 : razao < p2 ? 2 : razao < p3 ? 3 : 4;
  if (entrada.nPesquisas <= 1) passo = Math.max(1, passo - 1);
  return `lidera${passo}` as FaixaEvidencia;
}

/** Variável CSS de opacidade do degrau (tokens `--ps-evidencia-*` em presidential-states.css). */
export function opacidadeEvidencia(faixa: FaixaEvidencia): string {
  switch (faixa) {
    case 'semDados':
      return '1';
    case 'empate':
      return 'var(--confidence-empate-opacity)';
    case 'lidera1':
      return 'var(--ps-evidencia-1)';
    case 'lidera2':
      return 'var(--ps-evidencia-2)';
    case 'lidera3':
      return 'var(--ps-evidencia-3)';
    case 'lidera4':
      return 'var(--ps-evidencia-4)';
  }
}

/** Rótulo da faixa na legenda — diz o critério (múltiplos da margem), não só a cor. */
export function rotuloFaixaEvidencia(faixa: FaixaEvidencia): string {
  const [p1, p2, p3] = LIMIARES_EVIDENCIA;
  switch (faixa) {
    case 'semDados':
      return 'Sem dados';
    case 'empate':
      return 'Empate técnico (vantagem dentro da margem)';
    case 'lidera1':
      return `Lidera por até ${p1}× a margem`;
    case 'lidera2':
      return `Lidera por ${p1}× a ${p2}× a margem`;
    case 'lidera3':
      return `Lidera por ${p2}× a ${p3}× a margem`;
    case 'lidera4':
      return `Lidera por mais de ${p3}× a margem`;
  }
}

/* ============ Quantas pesquisas, e de quando ============ */

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

function partesData(dataIso: string): { ano: string; mes: string; dia: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!m) return null;
  return { ano: m[1]!, mes: m[2]!, dia: m[3]! };
}

function mesAbrev(mes: string): string {
  return MESES_ABREV[Number.parseInt(mes, 10) - 1] ?? mes;
}

/**
 * Período coberto por um conjunto de datas ISO, no espaço curto do cartão e
 * do tooltip: uma data vira "10/09/2026"; várias no mesmo mês, "set/2026";
 * várias no mesmo ano, "ago–set/2026"; anos diferentes, "dez/2025–set/2026".
 * `null` quando não há nenhuma data válida — nunca inventa período.
 */
export function rotuloPeriodoPesquisas(datasIso: readonly string[]): string | null {
  const validas = datasIso
    .map(partesData)
    .filter((p): p is { ano: string; mes: string; dia: string } => p != null)
    .sort((a, b) => `${a.ano}${a.mes}${a.dia}`.localeCompare(`${b.ano}${b.mes}${b.dia}`));
  if (validas.length === 0) return null;
  const primeira = validas[0]!;
  const ultima = validas[validas.length - 1]!;
  const mesmaData = primeira.ano === ultima.ano && primeira.mes === ultima.mes && primeira.dia === ultima.dia;
  if (mesmaData) return `${primeira.dia}/${primeira.mes}/${primeira.ano}`;
  if (primeira.ano === ultima.ano) {
    if (primeira.mes === ultima.mes) return `${mesAbrev(primeira.mes)}/${primeira.ano}`;
    return `${mesAbrev(primeira.mes)}–${mesAbrev(ultima.mes)}/${primeira.ano}`;
  }
  return `${mesAbrev(primeira.mes)}/${primeira.ano}–${mesAbrev(ultima.mes)}/${ultima.ano}`;
}

/** "1 pesquisa" / "3 pesquisas" — a contagem que sustenta o número, sem período. */
export function rotuloContagemPesquisas(n: number): string {
  return `${n} ${n === 1 ? 'pesquisa' : 'pesquisas'}`;
}

/**
 * Linha de procedência do cartão/tooltip: "1 pesquisa · 10/09/2026" ou
 * "3 pesquisas · ago–set/2026". É a informação que faltava na superfície: a
 * confiança era afirmada (selo, opacidade, tooltip) sem dizer sobre quantas
 * pesquisas, e o leitor só descobria abrindo o `<details>` do painel.
 */
export function rotuloPesquisasComPeriodo(n: number, datasIso: readonly string[]): string {
  const periodo = rotuloPeriodoPesquisas(datasIso);
  return periodo ? `${rotuloContagemPesquisas(n)} · ${periodo}` : rotuloContagemPesquisas(n);
}

/** Ponto de pesquisa desenhado no mini-gráfico (`SerieTemporal.pontos`). */
export interface PontoCandidatoData {
  readonly candidato: string;
  readonly data: string;
}

/**
 * Datas distintas (crescentes) desenhadas como pontos no mini-gráfico, ou
 * seja: as datas dos pontos dos candidatos que o cartão realmente plota (os
 * 2 primeiros do agregado). É a entrada de `temEvolucaoParaLinha` e o que
 * decide entre sparkline e marcador de ponto único — as duas leituras têm de
 * sair do MESMO cálculo, senão a contagem da seção e o desenho do cartão
 * divergem.
 */
export function datasDosPontos(
  pontos: readonly PontoCandidatoData[],
  candidatos: readonly string[],
): string[] {
  const nomes = new Set(candidatos);
  const datas = new Set<string>();
  for (const p of pontos) {
    if (nomes.has(p.candidato)) datas.add(p.data);
  }
  return [...datas].sort((a, b) => a.localeCompare(b));
}

/* ============ Turno no endereço (hash) ============ */

/** Rota desta tela, sem parâmetros. */
export const ROTA_PRESIDENTE_ESTADOS = '#/presidente-estados';

/**
 * Turno pedido pelo hash (`#/presidente-estados?turno=2`). O 1º turno é o
 * padrão e não precisa de parâmetro; qualquer valor inesperado cai no 1º
 * turno em vez de quebrar a montagem da tela.
 */
export function turnoDoHash(hash: string): 1 | 2 {
  const inicioQuery = hash.indexOf('?');
  if (inicioQuery < 0) return 1;
  const params = new URLSearchParams(hash.slice(inicioQuery + 1));
  return params.get('turno') === '2' ? 2 : 1;
}

/**
 * Hash canônico de um turno desta tela: o 2º turno ganha endereço próprio
 * (`#/presidente-estados?turno=2`, compartilhável e resistente a reload) e o
 * 1º turno fica na rota limpa, sem parâmetro redundante.
 */
export function hashDoTurno(turno: 1 | 2): string {
  return turno === 2 ? `${ROTA_PRESIDENTE_ESTADOS}?turno=2` : ROTA_PRESIDENTE_ESTADOS;
}

/** Parte de rota de um hash, sem os parâmetros: `#/presidente-estados?turno=2` → `#/presidente-estados`. */
export function rotaDoHash(hash: string): string {
  const inicioQuery = hash.indexOf('?');
  return inicioQuery < 0 ? hash : hash.slice(0, inicioQuery);
}

/* ============ Procedência de cada linha do painel e soma do recorte ============ */

/**
 * "de 1 de 3 pesquisas": de quantas das pesquisas usadas aquela linha do
 * painel realmente saiu. `null` quando a linha aparece em todas elas (aí não
 * há ressalva a fazer).
 *
 * Existe porque uma linha pode vir de menos pesquisas que as médias dos
 * candidatos — no Ceará (2º turno), das 3 pesquisas do confronto só 1 publica
 * brancos/nulos, e é por isso que a soma do recorte dá 102,4%. Completar para
 * fechar 100 seria estimar número que a fonte não publicou.
 */
export function rotuloBaseParcial(pesquisasDaLinha: number, pesquisasUsadas: number): string | null {
  if (pesquisasDaLinha >= pesquisasUsadas || pesquisasDaLinha <= 0) return null;
  return `de ${pesquisasDaLinha} de ${pesquisasUsadas} ${pesquisasUsadas === 1 ? 'pesquisa' : 'pesquisas'}`;
}

/**
 * Nota sobre a soma das linhas mostradas, quando ela NÃO fecha 100% — o que é
 * a regra, não a exceção: de 125 recortes auditados, só 32 somam entre 97% e
 * 103%. Abaixo de 100 porque a matéria só publicou os nomes da frente (o
 * resto não é zero: é o que não foi publicado); acima de 100 porque cada média
 * usa apenas as pesquisas que trazem aquela linha. `null` quando fecha dentro
 * da tolerância — aí não há nada a ressalvar.
 */
export function notaSomaDoPainel(soma: number, tolerancia = 0.5): string | null {
  const texto = `As linhas acima somam ${comVirgula(soma)}%`;
  if (soma < 100 - tolerancia) {
    return (
      `${texto} — o que falta não é zero: é o que as pesquisas deste recorte não publicaram ` +
      '(candidatos fora da lista divulgada, brancos, nulos e indecisos). Nada foi completado para fechar 100%.'
    );
  }
  if (soma > 100 + tolerancia) {
    return (
      `${texto} — cada média usa só as pesquisas que publicaram aquela linha, então elas não se somam a ` +
      '100%. Nada foi ajustado para fechar.'
    );
  }
  return null;
}
