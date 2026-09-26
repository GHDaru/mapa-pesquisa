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

/**
 * Raio (px) de TODO ponto de pesquisa do mini-gráfico. Um valor só, de
 * propósito: a escala anterior era por tamanho de amostra e tinha dois
 * defeitos medidos.
 *
 * 1. Amostra não publicada caía numa referência de 1000 entrevistados e era
 *    desenhada do tamanho de uma pesquisa de mil — 11 dos 63 pontos do 1º
 *    turno. Era um número inventado para preencher o que a fonte não
 *    publicou, exatamente o que esta base não faz em nenhum outro lugar.
 * 2. Nos dados reais a escala variava de 6,31 a 7,24 px de raio (medido no
 *    DOM), diferença que ninguém lê, e nenhuma legenda da tela declarava
 *    esse canal. Um canal que não se lê nem se explica afirma sem informar.
 *
 * O que a amostra tem de informativo e legível — se foi publicada ou não —
 * passou para a FORMA do ponto (anel vazado quando não foi), não o tamanho.
 */
export const RAIO_PONTO = 6;

/**
 * Padding esquerdo do mini-gráfico: raio do ponto mais 2px de folga. Sem essa
 * reserva, o ponto mais antigo (o que `escalaX` mapeia para x=0 dentro da área
 * útil) fica com o centro do círculo exatamente na borda esquerda do `viewBox`
 * e metade dele é cortada — bug confirmado via DOM (`cx=0`) em 20 dos 27
 * mini-gráficos por estado.
 */
export function padEsquerdoMiniChart(): number {
  return RAIO_PONTO + 2;
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
 * plotadas no mini-gráfico — o critério para desenhar a linha de tendência é
 * "existe evolução real para suavizar".
 *
 * `datas` deve vir da série efetivamente desenhada como pontos, que é a
 * MESMA base que o rótulo de procedência do cartão declara
 * (`agregado.pesquisasUsadas`, via `pontosDaBase`). Os dois têm de sair do
 * mesmo conjunto: enquanto os pontos vinham de `serie.pontos` inteiro (não
 * filtrado pela janela de recência) e o rótulo de `pesquisasUsadas`, o cartão
 * afirmava uma base e desenhava outra — Piauí no 2º turno dizia "1 pesquisa ·
 * 16/09/2026" e traçava uma tendência entre 21/06 e 16/09, 87 dias de vão.
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

/* ============ Vantagem do líder em margens de erro (tinta do mapa) ============ */

/**
 * Faixa de tinta de uma UF no mapa "Quem lidera". Codifica UMA coisa só: o
 * tamanho da vantagem do líder sobre o 2º colocado, medido em múltiplos da
 * margem de erro daquele estado (2×, 4×, 8×). Nada mais entra aqui — nem
 * quantas pesquisas sustentam o número, nem a idade delas.
 *
 * Por que o desconto de pesquisa única SAIU deste cálculo: enquanto ele
 * existia, a legenda rotulava as faixas por razão ("Lidera por 4× a 8× a
 * margem") e o degrau vinha de razão MENOS um passo, então o rótulo era
 * factualmente falso sobre a UF pintada. Medido nos dados reais: 15 das 27 UFs
 * do 2º turno e 4 das 27 do 1º caíam numa faixa cujo rótulo não descrevia sua
 * razão — Rondônia lidera por 21,0× a margem e era pintada na faixa "4× a 8×".
 * Pior, o canal se invertia justamente onde importava: a razão movia o degrau
 * em até 3 passos e a contagem de pesquisas em 1, então Rondônia (uma pesquisa,
 * de 15/07, fora da janela de recência) saía em opacidade 0,86 e São Paulo
 * (três pesquisas em 19 dias) em 0,72 — a tinta passava a significar "vantagem
 * grande" enquanto o cabeçalho prometia "força da evidência".
 *
 * As ressalvas de evidência que a tinta NÃO carrega são marcadas no mapa por
 * canais que não cobrem área, cada um com seu item de legenda: pesquisa única
 * (asterisco na sigla, ver `temPesquisaUnica` e `marcaDeAreaDaFaixa`) e dado
 * fora da janela de recência (contorno tracejado + âncora). Assim os rótulos de
 * razão voltam a ser verdadeiros sem que a evidência fraca fique invisível.
 *
 * A escala é relativa à margem de erro DE CADA UF (que varia de ± 1,8 a ± 3,0
 * pontos nos dados atuais) — é isso que explica a aparente
 * não-monotonicidade (Amapá +4,0 mais forte que o Distrito Federal +4,9) e é
 * o que a nota da legenda diz ao leitor em vez de deixá-lo achar que é bug.
 */
export type FaixaVantagem = 'semDados' | 'empate' | 'lidera1' | 'lidera2' | 'lidera3' | 'lidera4';

/** Limiares dos degraus, em múltiplos da margem de erro do agregado. */
export const LIMIARES_VANTAGEM = [2, 4, 8] as const;

export interface EntradaVantagem {
  readonly vantagem: number;
  readonly margemReferencia: number;
  readonly semDados: boolean;
}

/**
 * Degrau de tinta do mapa. `semDados` tem prioridade; vantagem dentro da
 * margem é empate técnico (mesmo corte de `nivelConfianca`, para o texto do
 * selo e a tinta nunca se contradizerem); acima disso, o degrau é SÓ a razão
 * vantagem/margem — o que garante que o rótulo da faixa na legenda seja
 * verdadeiro sobre toda UF pintada nela.
 */
export function faixaVantagem(entrada: EntradaVantagem): FaixaVantagem {
  if (entrada.semDados) return 'semDados';
  const margem = entrada.margemReferencia;
  if (entrada.vantagem <= 0) return 'empate';
  if (margem > 0 && entrada.vantagem <= margem) return 'empate';
  return `lidera${degrauDaRazao(razaoVantagem(entrada.vantagem, margem))}` as FaixaVantagem;
}

/**
 * Razão vantagem/margem de uma UF — o número que os rótulos da legenda
 * afirmam. `Infinity` quando a margem não foi informada (margem 0): não há
 * divisão por zero, e a UF cai no degrau mais alto.
 */
export function razaoVantagem(vantagem: number, margemReferencia: number): number {
  return margemReferencia > 0 ? vantagem / margemReferencia : Infinity;
}

/** Degrau (1..4) de uma razão vantagem/margem, pelos limiares de `LIMIARES_VANTAGEM`. */
export function degrauDaRazao(razao: number): 1 | 2 | 3 | 4 {
  const [p1, p2, p3] = LIMIARES_VANTAGEM;
  return razao < p1 ? 1 : razao < p2 ? 2 : razao < p3 ? 3 : 4;
}

/**
 * Verdadeiro quando o número da UF vem de UMA pesquisa só — a ressalva de
 * evidência que saiu do canal de cor. Ela NÃO pode voltar como marca de área
 * (ver `marcaDeAreaDaFaixa`): sai como asterisco na sigla do estado, que não
 * cobre área nenhuma. UF sem dados não entra: ali não há pesquisa para
 * ressalvar, e a hachura de "sem dados" já fala.
 */
export function temPesquisaUnica(nPesquisas: number, semDados: boolean): boolean {
  return !semDados && nPesquisas === 1;
}

/* ============ Quais marcas podem cobrir área do polígono ============ */

/**
 * Se a faixa de tinta de uma UF leva hachura sobre o preenchimento, e de qual
 * "lado" da rampa essa hachura empurra a luminância. `null` = nenhuma marca de
 * área.
 *
 * A regra que este tipo existe para travar, medida na tela a 1280px com
 * luminância relativa WCAG por área interna de cada UF:
 *
 * TODA marca de área desloca a luminância média do estado — ou seja, escreve no
 * MESMO canal que a legenda reserva só para o tamanho da vantagem. Então uma
 * marca de área só é admissível quando a categoria que ela marca já é uma ponta
 * da rampa, porque aí o deslocamento não pode reordenar nada:
 *
 * - `empate` é o degrau mais baixo. Hachura na cor do FUNDO subtrai tinta, o que
 *   sempre empurra na direção do fundo — o zero da rampa — nos dois temas. Antes
 *   a hachura de empate era `corEspectroSolido` (espectro em saturação cheia)
 *   sobre preenchimento a 0,45: tirava 0,118 de luminância e punha o empate
 *   ABAIXO de quem lidera. Medido no 1º turno: Amazonas (empate, 0,16× a margem)
 *   saía em L=0,4324 e Tocantins (empate, 0,30×) em L=0,4332, contra Minas
 *   (lidera por 1,91×) em L=0,4349 e Amapá (1,29×) em L=0,4362 — os dois empates
 *   mais escuros que dois estados que lideram.
 * - `semDados` está fora da rampa (cinza, sem matiz de espectro), então sua
 *   hachura cinza não compete com degrau nenhum.
 * - Pesquisa única e dado fora da janela são ORTOGONAIS à rampa: qualquer marca
 *   de área ali move o estado ao longo do canal da vantagem sem que a vantagem
 *   tenha mudado. Foi o que a hachura de poros (8,5% de cobertura na cor do
 *   fundo) fez: no 2º turno ela clareava 16 UFs — 70,6% da área de terra — em
 *   até +0,052 de luminância, mais que um degrau inteiro da rampa naquele matiz.
 *   Por isso elas não aparecem aqui: são marca fora do polígono.
 */
export type MarcaDeArea = 'fundo' | 'cinzaNeutro';

/**
 * Marca de área admissível para a faixa de tinta da UF — a única porta por onde
 * uma textura pode cobrir o polígono no mapa "Quem lidera". Ver `MarcaDeArea`
 * para por que só `empate` e `semDados` passam.
 */
export function marcaDeAreaDaFaixa(faixa: FaixaVantagem): MarcaDeArea | null {
  if (faixa === 'empate') return 'fundo';
  if (faixa === 'semDados') return 'cinzaNeutro';
  return null;
}

/**
 * Forma do glifo de uma pesquisa no mini-gráfico e no marcador de ponto único:
 * `anel` (vazado) quando a fonte NÃO publicou o tamanho da amostra, `disco`
 * (cheio) quando publicou.
 *
 * Existe como função pura porque o marcador de ponto único não tinha esse ramo:
 * `construirMarcadorUnico` pintava `fill` incondicionalmente, então o Rio de
 * Janeiro no 2º turno — uma pesquisa só, Datafolha de 10/09, `amostra: null` —
 * desenhava disco cheio, o glifo que em todo o resto da tela significa "amostra
 * publicada". O sparkline já tinha o ramo; os dois passam a sair daqui.
 *
 * `amostras` são as amostras das pesquisas que o glifo representa (uma só, no
 * caso normal; mais de uma quando dois institutos publicaram na MESMA data e o
 * cartão virou ponto único). Só é `anel` quando nenhuma delas foi publicada:
 * com uma publicada e outra não, o glifo cheio não é falso, e a ressalva fica
 * na nota e na lista de pesquisas do painel.
 */
export function formaDoPonto(amostras: readonly (number | null)[]): 'disco' | 'anel' {
  if (amostras.length === 0) return 'anel';
  return amostras.every((a) => a == null) ? 'anel' : 'disco';
}

/** Variável CSS de opacidade do degrau (tokens `--ps-vantagem-*` em presidential-states.css). */
export function opacidadeVantagem(faixa: FaixaVantagem): string {
  switch (faixa) {
    case 'semDados':
      return '1';
    case 'empate':
      return 'var(--confidence-empate-opacity)';
    case 'lidera1':
      return 'var(--ps-vantagem-1)';
    case 'lidera2':
      return 'var(--ps-vantagem-2)';
    case 'lidera3':
      return 'var(--ps-vantagem-3)';
    case 'lidera4':
      return 'var(--ps-vantagem-4)';
  }
}

/** Rótulo da faixa na legenda — diz o critério (múltiplos da margem), não só a cor. */
export function rotuloFaixaVantagem(faixa: FaixaVantagem): string {
  const [p1, p2, p3] = LIMIARES_VANTAGEM;
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

/**
 * Percentual de cobertura para o cabeçalho: sem casa decimal quando o valor é
 * exato ("100%"), com uma casa quando não é ("99,2%"). Imprimir "100,0%" ao
 * lado de uma ressalva que diz que uma UF está fora da janela é precisão
 * falsa: a casa decimal sugere uma medida fina de algo que a ressalva
 * desmente duas linhas abaixo.
 */
export function pctCobertura(parte: number, total: number): string {
  if (total <= 0) return '0%';
  const pct = (parte / total) * 100;
  const arredondado = Math.round(pct * 10) / 10;
  return Number.isInteger(arredondado)
    ? `${arredondado.toLocaleString('pt-BR')}%`
    : `${comVirgula(arredondado)}%`;
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

/** Ponto de série que sabe de qual pesquisa veio (`PontoSerieTemporal.pollId`). */
export interface PontoComPesquisa {
  readonly pollId: string;
}

/**
 * Restringe os pontos de uma série às pesquisas que o agregado realmente usou
 * (`Agregado.pesquisasUsadas`) — a base que o cartão, o tooltip e o painel
 * DECLARAM em "1 pesquisa · 16/09/2026".
 *
 * `SerieTemporal.pontos` traz TODAS as pesquisas da disputa, inclusive as que
 * a janela de recência de 45 dias descartou, então o cartão desenhava mais
 * pesquisas do que dizia ter: medido nos dados reais, 4 UFs no 1º turno (AC,
 * GO, RO, SE) e 3 no 2º (AC, PI, SE). Em Sergipe, o rótulo dizia "1 pesquisa ·
 * 21/09/2026" e o gráfico traçava 01/08 → 21/09; no Piauí, "1 pesquisa ·
 * 16/09/2026" com pontos em 21/06 e 16/09. Sem eixo x, não havia como o leitor
 * descobrir. Filtrando aqui, o que é desenhado e o que é declarado saem do
 * mesmo conjunto — o mesmo princípio que já vale para a contagem de "uma só
 * data".
 */
export function pontosDaBase<T extends PontoComPesquisa>(
  pontos: readonly T[],
  idsUsados: ReadonlySet<string>,
): T[] {
  return pontos.filter((p) => idsUsados.has(p.pollId));
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
export function notaSomaDoPainel(soma: number, tolerancia = 0.5, turno: 1 | 2 = 1): string | null {
  const texto = `As linhas acima somam ${comVirgula(soma)}%`;
  if (soma < 100 - tolerancia) {
    // No 2º turno o recorte é filtrado por confronto (`filtrarPorConfronto`),
    // então só entram pesquisas que testam exatamente aqueles dois nomes:
    // "candidatos fora da lista divulgada" não pode existir ali, e oferecer
    // essa explicação seria descrever o recorte errado.
    const faltante =
      turno === 2
        ? 'brancos, nulos e indecisos'
        : 'candidatos fora da lista divulgada, brancos, nulos e indecisos';
    return (
      `${texto} — o que falta não é zero: é o que as pesquisas deste recorte não publicaram ` +
      `(${faltante}). Nada foi completado para fechar 100%.`
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
