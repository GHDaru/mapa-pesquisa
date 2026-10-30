import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { AnaliseMigracao, TetoDeX } from '../../../../application/use-cases/get-analise-migracao.js';
import type { AreaMedida, ContornoDaArea } from '../../../../domain/migracao.js';
import { origensDeVoto } from '../../../../domain/migracao.js';
import { formatarNumero, formatarPct } from './_shared.js';
import {
  chaveDaArea,
  escalaDaMedida,
  faixaDoValor,
  FAIXAS,
  hashDaAnalise,
  MEDIDAS,
  MINIMO_DE_VALIDOS_NO_RANKING,
  medidaPorChave,
  nomeDaArea,
  paraRanking,
  parametrosDoHash,
  probabilidade,
  valorDaMedida,
  type Escala,
  type Medida,
  type Nivel,
  type ParametrosDaAnalise,
} from './analise-layout.js';

/**
 * A tela de análise: o que sobrou dos dois turnos, medido.
 *
 * Três coisas convivem aqui, e a tela as separa de propósito: as CONTAGENS
 * (votos, abstenção, deslocamento — direto dos arquivos), a ESTIMATIVA (as
 * taxas de transferência, de regressão dentro de cada município) e a HIPÓTESE
 * (o gerador de números aleatórios, com o X que ele exigiria). Misturar as
 * três num número só foi o erro que a seção de método desta página existe
 * para não repetir.
 *
 * O desenho é todo redesenhado a cada mudança de controle, e o endereço é
 * atualizado com `replaceState` — que não dispara `hashchange` e portanto não
 * passa pelo roteador. Assim o endereço continua compartilhável (um município
 * específico numa medida específica abre direto) sem que cada clique no mapa
 * jogue a rolagem para o topo.
 */

const ZERO_CORTES = FAIXAS - 1;

function sinal(valor: number | null, casas = 2): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  const sufixo = formatarNumero(Math.abs(valor), casas);
  return `${valor < 0 ? '−' : '+'}${sufixo}`;
}

function inteiro(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  return Math.round(valor).toLocaleString('pt-BR');
}

function compacto(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  if (Math.abs(valor) < 10_000) return inteiro(valor);
  return valor.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
}

function valorFormatado(valor: number | null, medida: Medida): string {
  if (valor === null) return '—';
  if (medida.chave === 'ganhoLula') return inteiro(valor);
  if (medida.comSinal) return sinal(valor, medida.casas);
  return formatarPct(valor, medida.casas);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (classe !== undefined) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function cartao(titulo: string, id?: string): HTMLElement {
  const secao = el('section', 'analise-cartao');
  const h = el('h3', 'analise-cartao__titulo', titulo);
  if (id !== undefined) h.id = id;
  secao.appendChild(h);
  return secao;
}

function nota(texto: string): HTMLParagraphElement {
  return el('p', 'analise-nota', texto);
}

function corDaFaixa(indice: number | null, medida: Medida): string {
  if (indice === null) return 'var(--analise-sem-dado)';
  const familia =
    medida.tipo === 'divergente' ? 'div' : medida.chave === 'pctBlocoEliminado' ? 'seq2' : 'seq';
  return `var(--analise-${familia}-${indice + 1})`;
}

function tabela(cabecalhos: readonly string[], linhas: readonly (readonly string[])[]): HTMLElement {
  const caixa = el('div', 'analise-tabela-caixa');
  const t = el('table', 'analise-tabela');
  const thead = el('thead');
  const trh = el('tr');
  for (const c of cabecalhos) trh.appendChild(el('th', undefined, c));
  thead.appendChild(trh);
  const tbody = el('tbody');
  for (const linha of linhas) {
    const tr = el('tr');
    for (const celula of linha) tr.appendChild(el('td', undefined, celula));
    tbody.appendChild(tr);
  }
  t.append(thead, tbody);
  caixa.appendChild(t);
  return caixa;
}

/**
 * Uma fila de rótulo + barra + valor, usada nas taxas e nos rankings. Devolve
 * os três filhos soltos, não um invólucro: o pai é a grade de três colunas, e
 * um invólucro só funcionaria com `subgrid`, que nem todo navegador tem.
 */
function fila(
  rotulo: string,
  largura: number,
  deslocamento: number,
  cor: string,
  valor: string,
  aoClicar?: () => void,
): DocumentFragment {
  const linha = document.createDocumentFragment();
  const nome = aoClicar ? el('button', 'analise-fila__rotulo', rotulo) : el('span', 'analise-fila__rotulo', rotulo);
  if (aoClicar) {
    (nome as HTMLButtonElement).type = 'button';
    nome.addEventListener('click', aoClicar);
  }
  const trilho = el('span', 'analise-fila__trilho');
  const preenchido = el('span', 'analise-fila__barra');
  preenchido.style.left = `${deslocamento}%`;
  preenchido.style.width = `${Math.max(largura, 0.6)}%`;
  preenchido.style.background = cor;
  trilho.appendChild(preenchido);
  linha.append(nome, trilho, el('span', 'analise-fila__valor', valor));
  return linha;
}

interface Contexto {
  readonly analise: AnaliseMigracao;
  parametros: ParametrosDaAnalise;
  readonly aplicar: (mudanca: Partial<ParametrosDaAnalise>) => void;
}

function areasDoNivel(ctx: Contexto): readonly AreaMedida[] {
  return ctx.parametros.nivel === 'municipios' ? ctx.analise.municipios : ctx.analise.estados;
}

function areaEscolhida(ctx: Contexto): AreaMedida {
  const { area, nivel } = ctx.parametros;
  if (area === null) return ctx.analise.pais;
  return areasDoNivel(ctx).find((a) => chaveDaArea(a, nivel) === area) ?? ctx.analise.pais;
}

/* ============================ o mapa ============================ */

function desenharMapa(ctx: Contexto, escala: Escala | null): HTMLElement {
  const { analise, parametros } = ctx;
  const { nivel, medida, area: escolhida } = parametros;
  const wrap = el('div', 'analise-mapa');
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', `0 0 ${analise.malha.largura} ${analise.malha.altura}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Mapa do Brasil colorido por ${medida.rotulo.toLowerCase()}`);

  const porChave = new Map(areasDoNivel(ctx).map((a) => [chaveDaArea(a, nivel), a]));
  const contornos: readonly ContornoDaArea[] =
    nivel === 'municipios' ? analise.malha.municipios : analise.malha.ufs;

  const grupo = svgEl('g');
  for (const contorno of contornos) {
    const area = porChave.get(contorno.cod);
    const valor = area ? valorDaMedida(area, medida) : null;
    const path = svgEl('path');
    path.setAttribute('d', contorno.d);
    path.setAttribute('fill', corDaFaixa(faixaDoValor(escala, valor), medida));
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    const ativa = escolhida !== null && contorno.cod === escolhida;
    path.setAttribute('class', ativa ? 'analise-area analise-area--ativa' : 'analise-area');
    if (area) {
      path.dataset.chave = contorno.cod;
      path.dataset.rotulo = nomeDaArea(area, nivel);
      path.dataset.valor = valorFormatado(valor, medida);
      path.dataset.validos = inteiro(area.validos2T);
    }
    grupo.appendChild(path);
  }
  svg.appendChild(grupo);

  // Contorno dos estados por cima, para o mapa municipal não virar mancha.
  if (nivel === 'municipios') {
    const bordas = svgEl('g');
    bordas.setAttribute('class', 'analise-bordas');
    for (const uf of analise.malha.ufs) {
      const path = svgEl('path');
      path.setAttribute('d', uf.d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      bordas.appendChild(path);
    }
    svg.appendChild(bordas);
  }

  const dica = el('div', 'analise-dica');
  dica.hidden = true;
  wrap.append(svg, dica);

  const alvoDoEvento = (evento: Event): HTMLElement | null => {
    const alvo = evento.target;
    return alvo instanceof Element ? alvo.closest<HTMLElement>('path[data-chave]') : null;
  };

  svg.addEventListener('pointermove', (evento) => {
    const path = alvoDoEvento(evento);
    if (!path) {
      dica.hidden = true;
      return;
    }
    dica.replaceChildren(
      el('span', 'analise-dica__nome', path.dataset.rotulo ?? ''),
      el('span', 'analise-dica__valor', `${path.dataset.valor ?? '—'} ${medida.unidade}`),
      el('span', 'analise-dica__nome', `${path.dataset.validos ?? '—'} válidos no 2º turno`),
    );
    dica.hidden = false;
    const caixa = wrap.getBoundingClientRect();
    const x = evento.clientX - caixa.left + 14;
    const y = evento.clientY - caixa.top + 14;
    dica.style.left = `${Math.max(0, Math.min(x, caixa.width - dica.offsetWidth))}px`;
    dica.style.top = `${Math.max(0, Math.min(y, caixa.height - dica.offsetHeight))}px`;
  });
  svg.addEventListener('pointerleave', () => {
    dica.hidden = true;
  });
  svg.addEventListener('click', (evento) => {
    const path = alvoDoEvento(evento);
    if (path?.dataset.chave !== undefined) ctx.aplicar({ area: path.dataset.chave });
  });
  return wrap;
}

function desenharLegenda(medida: Medida, escala: Escala | null): HTMLElement {
  const legenda = el('div', 'analise-legenda');
  legenda.appendChild(el('span', 'analise-legenda__titulo', `${medida.rotulo}, em ${medida.unidade}`));
  if (escala === null) return legenda;
  for (let i = 0; i < FAIXAS; i += 1) {
    const item = el('span', 'analise-legenda__item');
    const amostra = el('span', 'analise-legenda__cor');
    amostra.style.background = corDaFaixa(i, medida);
    const antes = escala.cortes[i - 1];
    const depois = escala.cortes[i];
    const texto =
      i === 0
        ? `até ${valorFormatado(escala.cortes[0] as number, medida)}`
        : i === ZERO_CORTES
          ? `${valorFormatado(antes as number, medida)} ou mais`
          : `${valorFormatado(antes as number, medida)} a ${valorFormatado(depois as number, medida)}`;
    item.append(amostra, el('span', undefined, texto));
    legenda.appendChild(item);
  }
  return legenda;
}

/* ====================== o painel da área ====================== */

function desenharPainel(ctx: Contexto): HTMLElement {
  const area = areaEscolhida(ctx);
  const doPais = ctx.parametros.area === null;
  const painel = cartao('A área escolhida');
  painel.appendChild(el('p', 'analise-painel__nome', doPais ? 'O país' : nomeDaArea(area, ctx.parametros.nivel)));
  painel.appendChild(
    nota(
      doPais
        ? 'Nenhuma área escolhida: os números abaixo são do país inteiro.'
        : 'Contagens da área escolhida. Clique em outra no mapa para trocar.',
    ),
  );

  const lista = el('dl', 'analise-kv');
  const pares: readonly (readonly [string, string])[] = [
    ['Lula no 1º turno', formatarPct(area.pctLula1T ?? Number.NaN, 2)],
    ['Lula no 2º turno', formatarPct(area.pctLula2T ?? Number.NaN, 2)],
    ['Deslocamento', `${sinal(area.deslocamento)} p.p.`],
    ['Ganho de Lula', `${inteiro(area.lula2T - area.lula1T)} votos`],
    ['De outras origens', `${inteiro(area.deOutrasOrigens)} votos`],
    ['Travessia líquida', `${inteiro(area.travessiaLiquida)} votos`],
    ['Travessia sobre a base de Flávio', formatarPct(area.pctTravessia ?? Number.NaN, 2)],
    ['Bloco eliminado no 1º turno', `${inteiro(area.blocoEliminado1T)} votos`],
    ['Abstenção no 1º turno', formatarPct(area.abstencao1T ?? Number.NaN, 2)],
    ['Abstenção no 2º turno', formatarPct(area.abstencao2T ?? Number.NaN, 2)],
    ['Válidos no 2º turno', inteiro(area.validos2T)],
    ['X exigido por um gerador único', area.xExigido === null ? '—' : formatarPct(area.xExigido, 3)],
  ];
  for (const [chave, valor] of pares) {
    lista.append(el('dt', undefined, chave), el('dd', undefined, valor));
  }
  painel.appendChild(lista);

  painel.appendChild(el('h4', 'analise-subtitulo', 'De onde vieram os votos sem dono'));
  painel.appendChild(nota('Tamanho de cada origem no 1º turno. São contagens, não estimativas.'));
  const origens = origensDeVoto(area);
  const total = origens.reduce((a, o) => a + o.votos, 0);
  if (total === 0) {
    painel.appendChild(
      nota('Nesta área nenhuma origem cresceu: o comparecimento caiu e o branco e o nulo aumentaram.'),
    );
    return painel;
  }
  const barra = el('div', 'analise-barra');
  origens.forEach((origem, i) => {
    if (origem.votos === 0) return;
    const parte = origem.votos / total;
    const bloco = el('span', 'analise-barra__parte');
    bloco.style.flex = `${parte} 1 0`;
    bloco.style.background = `var(--analise-origem-${i + 1})`;
    bloco.title = `${origem.rotulo}: ${inteiro(origem.votos)} votos`;
    if (parte > 0.12) bloco.textContent = `${Math.round(parte * 100)}%`;
    barra.appendChild(bloco);
  });
  const chaves = el('div', 'analise-chaves');
  origens.forEach((origem, i) => {
    const item = el('span', 'analise-chave');
    const cor = el('span', 'analise-chave__cor');
    cor.style.background = `var(--analise-origem-${i + 1})`;
    item.append(cor, el('span', undefined, origem.rotulo));
    chaves.appendChild(item);
  });
  painel.append(barra, chaves, nota(`${inteiro(total)} votos sem dono, somando as origens que cresceram.`));
  return painel;
}

/* ================= taxas, rankings e tabela ================= */

function desenharTaxas(ctx: Contexto): HTMLElement {
  const secao = cartao('Quanto de cada origem foi para Lula', 'analise-taxas');
  secao.appendChild(
    nota(
      'Estimado por regressão dentro de cada município, com as taxas presas entre 0 e 100%. ' +
        'Zema aparece no limite inferior: o estimador encostou nele, o que se lê como “praticamente nada”, não como medida exata.',
    ),
  );
  const grade = el('div', 'analise-filas');
  ctx.analise.taxas.forEach((taxa, i) => {
    grade.appendChild(
      fila(
        taxa.origem,
        Math.max(taxa.pctParaLula, 0),
        0,
        `var(--analise-origem-${i + 1})`,
        `${formatarPct(taxa.pctParaLula, 1)} de ${compacto(taxa.votosDisponiveis)}`,
      ),
    );
  });
  secao.appendChild(grade);
  return secao;
}

function desenharRanking(ctx: Contexto, escala: Escala | null, altos: boolean): HTMLElement {
  const { nivel, medida } = ctx.parametros;
  const secao = cartao(altos ? 'Os doze maiores' : 'Os doze menores');
  secao.appendChild(
    nota(
      nivel === 'municipios'
        ? `Pela medida escolhida. Entram só os municípios com ${inteiro(MINIMO_DE_VALIDOS_NO_RANKING)} válidos ou mais no 2º turno, para o ranking não ficar com lugares pequenos demais. Clique num nome para escolher a área.`
        : 'Pela medida escolhida, com as 28 unidades. Clique num nome para escolher a área.',
    ),
  );
  const elegiveis = [...paraRanking(areasDoNivel(ctx), nivel, medida)].sort(
    (a, b) => (valorDaMedida(b, medida) as number) - (valorDaMedida(a, medida) as number),
  );
  if (elegiveis.length === 0) {
    secao.appendChild(nota('Nenhuma área tem valor nesta medida.'));
    return secao;
  }
  const corte = altos ? elegiveis.slice(0, 12) : elegiveis.slice(-12).reverse();
  const valores = corte.map((a) => valorDaMedida(a, medida) as number);
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores);
  const amplitude = maximo - minimo || 1;
  const grade = el('div', 'analise-filas');
  for (const area of corte) {
    const valor = valorDaMedida(area, medida) as number;
    grade.appendChild(
      fila(
        nomeDaArea(area, nivel),
        (100 * Math.abs(valor)) / amplitude,
        (100 * (Math.min(valor, 0) - minimo)) / amplitude,
        corDaFaixa(faixaDoValor(escala, valor), medida),
        valorFormatado(valor, medida),
        () => ctx.aplicar({ area: chaveDaArea(area, nivel) }),
      ),
    );
  }
  secao.appendChild(grade);
  return secao;
}

const TETO_DA_TABELA = 400;

function desenharTabela(ctx: Contexto, busca: string): HTMLElement {
  const { nivel } = ctx.parametros;
  const secao = cartao('Linha por linha', 'analise-tabela');
  const alvo = busca.trim().toLowerCase();
  const todas = areasDoNivel(ctx);
  const filtradas = alvo === ''
    ? todas
    : todas.filter((a) => `${a.nome} ${a.uf}`.toLowerCase().includes(alvo));
  const ordenadas = [...filtradas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const mostradas = ordenadas.slice(0, TETO_DA_TABELA);
  secao.appendChild(
    nota(
      `Mostrando ${inteiro(mostradas.length)} de ${inteiro(ordenadas.length)} linhas, de ${inteiro(todas.length)} áreas. ` +
        'Use a busca acima para estreitar. Clique numa linha para escolher a área.',
    ),
  );
  const caixa = tabela(
    [
      nivel === 'municipios' ? 'Município' : 'Estado',
      'UF',
      'Válidos 2º t.',
      'Lula 1º t.',
      'Lula 2º t.',
      'Deslocamento',
      'Bloco elim.',
      'Travessia',
      'Δ abstenção',
      'X exigido',
    ],
    mostradas.map((a) => [
      a.nome,
      a.uf,
      inteiro(a.validos2T),
      formatarPct(a.pctLula1T ?? Number.NaN, 2),
      formatarPct(a.pctLula2T ?? Number.NaN, 2),
      sinal(a.deslocamento),
      formatarPct(a.pctBlocoEliminado ?? Number.NaN, 2),
      formatarPct(a.pctTravessia ?? Number.NaN, 2),
      sinal(a.deltaAbstencao),
      a.xExigido === null ? '—' : formatarPct(a.xExigido, 3),
    ]),
  );
  const corpo = caixa.querySelector('tbody');
  if (corpo) {
    mostradas.forEach((area, i) => {
      const linha = corpo.children[i];
      if (!(linha instanceof HTMLElement)) return;
      linha.dataset.chave = chaveDaArea(area, nivel);
      linha.classList.add('analise-tabela__linha');
      if (ctx.parametros.area === chaveDaArea(area, nivel)) linha.classList.add('analise-tabela__linha--ativa');
      linha.addEventListener('click', () => ctx.aplicar({ area: chaveDaArea(area, nivel) }));
    });
  }
  secao.appendChild(caixa);
  return secao;
}

/* ================= a hipótese do gerador ================= */

function dispersaoDoX(ctx: Contexto): HTMLElement {
  const { analise } = ctx;
  const pontos = analise.estados.filter(
    (e) => e.ganhoDoisCandidatos !== null && e.pctFlavio1TDoisCandidatos !== null,
  );
  const wrap = el('div', 'analise-dispersao');
  const largura = 640;
  const altura = 330;
  const margem = { topo: 18, direita: 20, baixo: 46, esquerda: 54 };
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    'Ganho de Lula por estado contra a força de Flávio no 1º turno, com a reta que um gerador de taxa única preveria',
  );
  if (pontos.length === 0) return wrap;

  const xs = pontos.map((p) => p.pctFlavio1TDoisCandidatos as number);
  const ys = pontos.map((p) => p.ganhoDoisCandidatos as number);
  const xMin = Math.min(...xs) - 3;
  const xMax = Math.max(...xs) + 3;
  const yMax = Math.max(...ys) * 1.1;
  const px = (v: number): number =>
    margem.esquerda + ((v - xMin) / (xMax - xMin)) * (largura - margem.esquerda - margem.direita);
  const py = (v: number): number =>
    altura - margem.baixo - (v / yMax) * (altura - margem.topo - margem.baixo);

  const eixos = svgEl('g');
  eixos.setAttribute('class', 'analise-eixo');
  for (const v of [0, 25, 50, 75, 100].filter((t) => t >= xMin && t <= xMax)) {
    const marca = svgEl('text');
    marca.setAttribute('x', String(px(v)));
    marca.setAttribute('y', String(altura - margem.baixo + 18));
    marca.setAttribute('text-anchor', 'middle');
    marca.textContent = formatarPct(v, 0);
    eixos.appendChild(marca);
  }
  for (let k = 0; k <= 4; k += 1) {
    const v = (yMax * k) / 4;
    const linha = svgEl('line');
    linha.setAttribute('x1', String(margem.esquerda));
    linha.setAttribute('x2', String(largura - margem.direita));
    linha.setAttribute('y1', String(py(v)));
    linha.setAttribute('y2', String(py(v)));
    linha.setAttribute('class', 'analise-grade');
    eixos.appendChild(linha);
    const marca = svgEl('text');
    marca.setAttribute('x', String(margem.esquerda - 8));
    marca.setAttribute('y', String(py(v) + 4));
    marca.setAttribute('text-anchor', 'end');
    marca.textContent = sinal(v, 1);
    eixos.appendChild(marca);
  }
  const rotuloX = svgEl('text');
  rotuloX.setAttribute('x', String((margem.esquerda + largura - margem.direita) / 2));
  rotuloX.setAttribute('y', String(altura - 8));
  rotuloX.setAttribute('text-anchor', 'middle');
  rotuloX.setAttribute('class', 'analise-eixo__rotulo');
  rotuloX.textContent = 'Flávio no 1º turno, só Lula x Flávio';
  const rotuloY = svgEl('text');
  rotuloY.setAttribute('x', String(margem.esquerda));
  rotuloY.setAttribute('y', String(margem.topo - 4));
  rotuloY.setAttribute('class', 'analise-eixo__rotulo');
  rotuloY.textContent = 'Ganho de Lula no 2º turno (p.p.)';
  svg.append(eixos, rotuloX, rotuloY);

  // A reta que a hipótese prevê: ganho = X médio × share de Flávio.
  const media = ctx.analise.resumoDoX.mediaPonderada / 100;
  const reta = svgEl('line');
  reta.setAttribute('x1', String(px(xMin)));
  reta.setAttribute('y1', String(py(media * xMin)));
  reta.setAttribute('x2', String(px(xMax)));
  reta.setAttribute('y2', String(py(media * xMax)));
  reta.setAttribute('class', 'analise-previsao');
  svg.appendChild(reta);

  const extremos = new Set(
    [
      pontos.reduce((a, p) => ((p.pctFlavio1TDoisCandidatos as number) > (a.pctFlavio1TDoisCandidatos as number) ? p : a)),
      pontos.reduce((a, p) => ((p.pctFlavio1TDoisCandidatos as number) < (a.pctFlavio1TDoisCandidatos as number) ? p : a)),
      pontos.reduce((a, p) => ((p.ganhoDoisCandidatos as number) > (a.ganhoDoisCandidatos as number) ? p : a)),
    ].map((p) => p.uf),
  );
  for (const ponto of pontos) {
    const x = px(ponto.pctFlavio1TDoisCandidatos as number);
    const y = py(ponto.ganhoDoisCandidatos as number);
    const bolinha = svgEl('circle');
    bolinha.setAttribute('cx', String(x));
    bolinha.setAttribute('cy', String(y));
    bolinha.setAttribute('r', '5');
    bolinha.setAttribute('class', 'analise-ponto');
    const titulo = svgEl('title');
    titulo.textContent = `${ponto.nome}: X exigido ${formatarPct(ponto.xExigido ?? Number.NaN, 3)}, ganho ${sinal(ponto.ganhoDoisCandidatos)} p.p.`;
    bolinha.appendChild(titulo);
    svg.appendChild(bolinha);
    if (extremos.has(ponto.uf)) {
      const sigla = svgEl('text');
      sigla.setAttribute('x', String(x + 9));
      sigla.setAttribute('y', String(y + 4));
      sigla.setAttribute('class', 'analise-ponto__rotulo');
      sigla.textContent = ponto.uf;
      svg.appendChild(sigla);
    }
  }
  wrap.appendChild(svg);
  return wrap;
}

function rotuloDoLider(teto: TetoDeX): string {
  return teto.lider === 'empate' ? 'empate' : `${teto.lider} na frente`;
}

function desenharGerador(ctx: Contexto): HTMLElement {
  const { analise } = ctx;
  const r = analise.resumoDoX;
  const secao = cartao('A hipótese do gerador de números aleatórios', 'analise-gerador');
  secao.appendChild(
    nota(
      'Suponha que a urna sorteasse um número a cada voto e, se menor que X, trocasse o voto para um candidato fixo. ' +
        'Esta seção mede de quanto X teria de ser, se um X único dá conta do padrão por estado, e o que as seções permitem. ' +
        'No seletor de medida acima, “X exigido por um gerador de taxa única” põe essa conta no mapa.',
    ),
  );

  secao.appendChild(el('h4', 'analise-subtitulo', 'De quanto teria de ser o X do Brasil'));
  secao.appendChild(
    nota(
      'A conta é fechada: X = (margem observada − margem verdadeira) ÷ (1 − margem verdadeira). ' +
        `Tirar o comparecimento novo BAIXA o X, porque aquele canal rendeu a Lula um líquido de só ${sinal(r.comparecimentoLiquido)} dos ${sinal(r.deslocamento)} pontos de deslocamento.`,
    ),
  );
  secao.appendChild(
    tabela(
      ['Para o resultado verdadeiro ter sido', 'X necessário', 'Sem o comparecimento novo'],
      analise.cenarios.map((c) => [c.rotulo, formatarPct(c.x, 4), formatarPct(c.xSemComparecimento, 4)]),
    ),
  );

  secao.appendChild(el('h4', 'analise-subtitulo', 'X por estado: a previsão cola, o tamanho não'));
  secao.appendChild(
    nota(
      'Um X único faz uma previsão por estado: o ganho de Lula tem de ser proporcional à força local de Flávio, ' +
        `porque o gerador só pode tirar voto de quem o tinha. A correlação medida é ${sinal(r.correlacaoComFlavio, 3)}, ` +
        'forte e positiva como a hipótese exige, e a reta tracejada é a previsão — este teste ela passa. ' +
        `O que não passa é a magnitude: os X exigidos vão de ${formatarPct(r.minimo, 4)} a ${formatarPct(r.maximo, 4)}, ` +
        `e ${inteiro(r.acimaDoTeto)} das ${inteiro(r.unidades)} unidades ficam acima do teto de ${formatarPct(r.teto, 4)} que as seções permitem.`,
    ),
  );
  secao.appendChild(dispersaoDoX(ctx));

  secao.appendChild(el('h4', 'analise-subtitulo', 'O teto, e o que ele deixaria de pé'));
  const zeradaDeLula = analise.zeradas.find((z) => z.caso === 'lula');
  secao.appendChild(
    nota(
      `${inteiro(zeradaDeLula?.secoes ?? null)} seções tiveram zero voto para Lula no 2º turno, com ` +
        `${inteiro(zeradaDeLula?.votosDoAdversario2T ?? null)} votos de Flávio nelas que nenhum sorteio tocou; ` +
        'e Lula tinha zero ali no 1º turno também, somando ' +
        `${inteiro((zeradaDeLula?.votosDoAdversario2T ?? 0) + (zeradaDeLula?.votosDoAdversario1T ?? 0))} votos intocados nos dois turnos. É isso que limita X.`,
    ),
  );
  secao.appendChild(
    tabela(
      ['Se X fosse', 'X', 'Margem verdadeira', 'Quem venceria', 'Do deslocamento', 'Zeros de Flávio criados', 'P dos votos intocados'],
      analise.tetos.map((t) => [
        t.rotulo,
        formatarPct(t.x, 4),
        `${sinal(t.margemVerdadeira)} p.p.`,
        rotuloDoLider(t),
        formatarPct(t.pctDoDeslocamento, 1),
        formatarNumero(t.zerosCriados, 1),
        probabilidade(t.pDosVotosIntocados),
      ]),
    ),
  );

  secao.appendChild(el('h4', 'analise-subtitulo', 'As urnas zeradas, pareadas entre os turnos'));
  secao.appendChild(
    nota(
      'Um gerador a favor de Lula PRODUZ zeros de Flávio, porque converte os votos dele. ' +
        'O teste é parear: o que cada um tirou nas mesmas seções no 1º turno. Compare com os zeros criados na tabela acima.',
    ),
  );
  secao.appendChild(
    tabela(
      ['Caso', 'Seções', 'Votos do adversário, 2º t.', 'Votos próprios, 1º t.', 'Já zeradas no 1º t.', 'Comparecimento, 1º t.'],
      analise.zeradas.map((z) => [
        z.rotulo,
        inteiro(z.secoes),
        inteiro(z.votosDoAdversario2T),
        inteiro(z.votosProprios1T),
        inteiro(z.jaZeradasNo1T),
        inteiro(z.comparecimento1T),
      ]),
    ),
  );
  secao.appendChild(
    nota(
      'Sobre a margem de erro: dois pontos de pesquisa são incerteza de AMOSTRA, simétrica e sorteada a cada rodada. ' +
        `Um X é viés na CONTAGEM e move a margem sempre na mesma direção. Dois pontos valem ${inteiro(r.votosPorDoisPontos)} votos do 2º turno.`,
    ),
  );
  return secao;
}

/* ================= cabeçalho, controles, método ================= */

function desenharCabecalho(analise: AnaliseMigracao): HTMLElement {
  const pais = analise.pais;
  const ganho = pais.lula2T - pais.lula1T;
  const bloco = el('header', 'analise-cabecalho');
  bloco.appendChild(el('h2', undefined, 'Migração do 1º para o 2º turno'));
  bloco.appendChild(
    el(
      'p',
      'analise-lede',
      `Entre os dois turnos Lula ganhou ${inteiro(ganho)} votos. ${inteiro(pais.deOutrasOrigens)} vieram de quem ` +
        'não tinha mais candidato, de quem deixou de anular e de quem apareceu só no 2º turno. ' +
        `${inteiro(pais.travessiaLiquida)} vieram da base de Flávio, o equivalente a ` +
        `${formatarPct(pais.pctTravessia ?? Number.NaN, 2)} dela.`,
    ),
  );
  const tiles = el('div', 'analise-tiles');
  const dados: readonly (readonly [string, string, string])[] = [
    ['Ganho de Lula', compacto(ganho), 'votos a mais que no 1º turno'],
    ['De outras origens', compacto(pais.deOutrasOrigens), 'eliminados, branco e nulo, comparecimento novo'],
    ['Travessia líquida', compacto(pais.travessiaLiquida), `de uma base de ${inteiro(pais.flavio1T)} votos`],
    [
      'Abstenção no 2º turno',
      formatarPct(pais.abstencao2T ?? Number.NaN, 2),
      `contra ${formatarPct(pais.abstencao1T ?? Number.NaN, 2)} no 1º turno`,
    ],
  ];
  for (const [rotulo, numero, sub] of dados) {
    const tile = el('div', 'analise-tile');
    tile.append(
      el('span', 'analise-tile__rotulo', rotulo),
      el('span', 'analise-tile__numero', numero),
      el('span', 'analise-tile__sub', sub),
    );
    tiles.appendChild(tile);
  }
  bloco.appendChild(tiles);
  return bloco;
}

function desenharControles(
  ctx: Contexto,
  busca: string,
  aoBuscar: (valor: string) => void,
): HTMLElement {
  const { nivel, medida, area } = ctx.parametros;
  const barra = el('div', 'analise-controles');

  const grupo = el('div', 'analise-segmentado');
  grupo.setAttribute('role', 'group');
  grupo.setAttribute('aria-label', 'Nível geográfico');
  for (const opcao of ['estados', 'municipios'] as const) {
    const botao = el('button', 'analise-segmentado__botao', opcao === 'estados' ? 'Estados' : 'Municípios');
    botao.type = 'button';
    botao.setAttribute('aria-pressed', String(nivel === opcao));
    botao.addEventListener('click', () => ctx.aplicar({ nivel: opcao, area: null }));
    grupo.appendChild(botao);
  }

  const seletor = el('select', 'analise-seletor');
  seletor.setAttribute('aria-label', 'Medida mostrada no mapa');
  for (const m of MEDIDAS) {
    const opcao = el('option', undefined, `${m.rotulo} (${m.unidade})`);
    opcao.value = m.chave;
    if (m.chave === medida.chave) opcao.selected = true;
    seletor.appendChild(opcao);
  }
  seletor.addEventListener('change', () => ctx.aplicar({ medida: medidaPorChave(seletor.value) }));

  const campo = el('input', 'analise-busca');
  campo.type = 'search';
  campo.placeholder = 'Procurar estado ou município';
  campo.setAttribute('aria-label', 'Procurar estado ou município');
  campo.value = busca;
  campo.addEventListener('input', () => aoBuscar(campo.value));

  barra.append(grupo, seletor, campo);
  if (area !== null) {
    const limpar = el('button', 'analise-chip', 'Limpar seleção');
    limpar.type = 'button';
    limpar.addEventListener('click', () => ctx.aplicar({ area: null }));
    barra.appendChild(limpar);
  }
  return barra;
}

function desenharMetodo(analise: AnaliseMigracao): HTMLElement {
  const secao = cartao('Como estes números foram feitos', 'analise-metodo');
  const pais = analise.pais;
  const paragrafos: readonly (readonly [string, string])[] = [
    [
      'A base.',
      'Votação por seção eleitoral nos dois turnos, dos dados abertos do TSE, pareada pela chave estado, ' +
        'município, zona e seção; aptos e comparecimento vêm do arquivo de detalhe por seção. Tudo aqui é soma ' +
        `dessas seções: ${inteiro(pais.secoes)} seções, em ${inteiro(analise.municipios.length)} municípios e no exterior.`,
    ],
    [
      'O que é contagem.',
      'Votos, válidos, aptos, comparecimento, abstenção, deslocamento e o tamanho de cada origem de voto são ' +
        'contagens dos arquivos. Não há modelo nenhum nesses campos.',
    ],
    [
      'O que é estimativa.',
      'As taxas de transferência são estimadas por regressão dentro de cada município, com os coeficientes presos ' +
        'entre 0 e 100%. Estimar no país inteiro devolvia taxas impossíveis — viés de agregação, o erro clássico ' +
        'desta família de contas. Num município isolado a taxa local não é identificável, então “de outras origens” ' +
        'aplica a cada município as taxas do seu estado, e a “travessia líquida” é o que sobra do ganho de Lula ' +
        'depois disso. É decomposição, não medida local.',
    ],
    [
      'O que a travessia não distingue.',
      'Ela é líquida: quem saiu de Flávio para Lula menos quem fez o caminho contrário. Os dois fluxos existem e ' +
        'esta conta só vê a diferença.',
    ],
    [
      'As duas bases do 1º turno.',
      'A margem que se publica (Flávio +1,8650) é sobre todos os válidos, inclusive os dos eliminados; a do 2º turno ' +
        'é sobre dois candidatos. O X da hipótese usa a margem de dois candidatos (Flávio +2,0230), porque subtrair ' +
        'uma da outra mistura bases — e a diferença entre as duas é exatamente o bloco dos eliminados.',
    ],
    [
      'Uma validação que não é nossa.',
      'A estimativa dá 45,3% do eleitor de Caiado para Lula, ou seja 54,7% para Flávio; a pesquisa que mediu essa ' +
        'transferência por entrevista apontou 54% para Flávio. Dois métodos independentes, menos de um ponto de distância.',
    ],
    [
      'Duas ressalvas de contagem.',
      'Os votos de um candidato cujo registro foi indeferido entram aqui como válidos e, no agregado oficial do 1º ' +
        'turno, como nulos; o efeito no share nacional é de quatro milésimos de ponto. E uma seção do exterior existe ' +
        'no 1º turno e não no 2º, com dois votos: por isso o ganho somado das áreas passa em dois votos o ganho do ' +
        'agregado nacional.',
    ],
    [
      'O mapa.',
      'A malha municipal é a do IBGE e não traz municípios criados depois dela: ' +
        `${inteiro(analise.municipiosSemArea)} municípios ficam sem área desenhada, ` +
        `${formatarPct((100 * analise.votosSemArea) / pais.validos1T, 3)} dos votos válidos do 1º turno. ` +
        'Eles estão na tabela, como o exterior.',
    ],
  ];
  for (const [titulo, texto] of paragrafos) {
    const p = el('p', 'analise-metodo__item');
    p.append(el('strong', undefined, titulo), document.createTextNode(` ${texto}`));
    secao.appendChild(p);
  }
  return secao;
}

/* ============================ montagem ============================ */

function montar(ctx: Contexto, busca: string, aoBuscar: (valor: string) => void): DocumentFragment {
  const { medida } = ctx.parametros;
  const valores = areasDoNivel(ctx)
    .map((a) => valorDaMedida(a, medida))
    .filter((v): v is number => v !== null);
  const escala = escalaDaMedida(valores, medida);

  const frag = document.createDocumentFragment();
  frag.appendChild(desenharCabecalho(ctx.analise));
  frag.appendChild(desenharControles(ctx, busca, aoBuscar));

  const duplo = el('div', 'analise-duplo');
  const mapa = cartao('O mapa', 'analise-mapa-cartao');
  mapa.appendChild(
    nota(
      'Cada área recebe a cor da medida escolhida. Passe o ponteiro para ler o valor, clique para fixar a área no ' +
        'painel ao lado. O exterior não tem área no mapa e aparece na tabela.',
    ),
  );
  mapa.append(desenharMapa(ctx, escala), desenharLegenda(medida, escala));
  duplo.append(mapa, desenharPainel(ctx));
  frag.appendChild(duplo);

  frag.appendChild(desenharTaxas(ctx));
  const rankings = el('div', 'analise-duplo');
  rankings.append(desenharRanking(ctx, escala, true), desenharRanking(ctx, escala, false));
  frag.appendChild(rankings);
  frag.appendChild(desenharTabela(ctx, busca));
  frag.appendChild(desenharGerador(ctx));
  frag.appendChild(desenharMetodo(ctx.analise));
  return frag;
}

/**
 * Entrada da tela. Os dados são carregados sob demanda, então há um estado de
 * espera de verdade — e, se o carregamento falhar, a tela diz isso em vez de
 * ficar em branco.
 */
export async function renderAnalise(main: HTMLElement, casos: CasosDeUso): Promise<void> {
  const raiz = el('div', 'analise');
  raiz.appendChild(el('p', 'analise-nota', 'Carregando a análise por seção…'));
  main.appendChild(raiz);

  let analise: AnaliseMigracao;
  try {
    analise = await casos.getAnaliseMigracao();
  } catch (erro) {
    console.error('Falha ao carregar a análise da migração:', erro);
    raiz.replaceChildren(
      el('h2', undefined, 'Análise'),
      nota('Não foi possível carregar os dados da análise. Recarregue a página para tentar de novo.'),
    );
    return;
  }

  let busca = '';
  const ctx: Contexto = {
    analise,
    parametros: parametrosDoHash(window.location.hash),
    aplicar: (mudanca) => {
      ctx.parametros = { ...ctx.parametros, ...mudanca };
      // `replaceState` não dispara `hashchange`, então o roteador não entra e
      // a rolagem fica onde está — mas o endereço continua compartilhável.
      window.history.replaceState(null, '', hashDaAnalise(ctx.parametros));
      redesenhar();
    },
  };
  const redesenhar = (): void => {
    raiz.replaceChildren(montar(ctx, busca, aoBuscar));
  };
  const aoBuscar = (valor: string): void => {
    busca = valor;
    const tabelaAntiga = raiz.querySelector('#analise-tabela')?.closest('.analise-cartao');
    const nova = desenharTabela(ctx, busca);
    if (tabelaAntiga) tabelaAntiga.replaceWith(nova);
    else redesenhar();
  };
  redesenhar();
}
