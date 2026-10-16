import brazilMapDados from '@svg-maps/brazil';
import '../styles/resultado.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type {
  BancadaCamara,
  ComposicaoSenado,
  DadosResultado,
  GovernadorUf,
  SenadorEleito,
} from '../../../../domain/resultado.js';
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
import { corEspectro, corEspectroSolido, rotuloEspectro } from '../format.js';
import { criarEl, formatarPct, listaEmPortugues } from './_shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface LocalidadeMapa {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}
interface MapaSvg {
  readonly viewBox: string;
  readonly locations: readonly LocalidadeMapa[];
}
const brazilMap = brazilMapDados as MapaSvg;
const NOME_POR_UF = new Map(brazilMap.locations.map((l) => [l.id.toUpperCase(), l.name]));

/** Abaixo disso, a segunda vaga do Senado foi decidida no fio. */
export const LIMIAR_VAGA_APERTADA = 2;

/**
 * Quantas UFs já têm governador e quantas decidem em 25/10.
 *
 * Concordância: "1 estado decide" x "6 estados decidem", e o caso em que não
 * sobra nenhum, que vai acontecer depois de 25/10 e não pode imprimir
 * "0 ainda decidem".
 */
export function rotuloGovernadores(eleitos: number, segundoTurno: number): string {
  const base = `${eleitos} das ${eleitos + segundoTurno} unidades da federação já têm governador eleito`;
  if (segundoTurno === 0) return `${base}. O quadro está fechado.`;
  const resto =
    segundoTurno === 1
      ? 'A que falta decide no 2º turno, em 25/10'
      : `As outras ${segundoTurno} decidem no 2º turno, em 25/10`;
  return `${base}. ${resto}.`;
}

/**
 * O fechamento do Senado em uma frase. A conta é declarada em vez de só
 * mostrada porque é ela que distingue "as 54 cadeiras eleitas agora" da
 * "composição da Casa": quem lê 27 cadeiras do PL precisa saber que 8 delas
 * não estavam em disputa.
 */
export function rotuloFechamentoSenado(c: ComposicaoSenado): string {
  return (
    `${c.totalCadeiras} cadeiras: ${c.cadeirasEmDisputa} eleitas em 4 de outubro ` +
    `(duas por unidade da federação) e ${c.cadeirasRemanescentes} que seguem, eleitas em 2022 ` +
    'e não disputadas agora.'
  );
}

/**
 * As segundas vagas decididas no fio. Sem isso, uma cadeira ganha por 0,16
 * ponto aparece na tabela de bancadas com a mesma solidez de uma ganha por
 * 20. `null` quando nenhuma vaga entrou nessa faixa.
 */
export function rotuloVagasApertadas(
  eleitos: readonly SenadorEleito[],
  limiar = LIMIAR_VAGA_APERTADA,
): string | null {
  const apertadas = eleitos
    .filter((e) => e.folgaParaOTerceiro != null && e.folgaParaOTerceiro < limiar)
    .sort((a, b) => (a.folgaParaOTerceiro ?? 0) - (b.folgaParaOTerceiro ?? 0));
  if (apertadas.length === 0) return null;
  const lista = listaEmPortugues(
    apertadas.map((e) => `${e.uf} (${formatarPct(e.folgaParaOTerceiro ?? 0, 2)})`),
  );
  const verbo = apertadas.length === 1 ? 'foi decidida' : 'foram decididas';
  const sujeito = apertadas.length === 1 ? 'A segunda vaga de' : 'As segundas vagas de';
  return (
    `${sujeito} ${lista} ${verbo} por menos de ${limiar} pontos sobre o 3º colocado. ` +
    'A tabela de bancadas não mostra essa diferença, e ela é o que separa a cadeira do quase.'
  );
}

/**
 * As UFs cuja ficha de apuração lista só os dois eleitos: a dupla é certa, a
 * folga é que não pôde ser medida. Declarar isso é diferente de dizer que a
 * vaga foi folgada.
 */
export function rotuloFolgaDesconhecida(ufs: readonly string[]): string | null {
  if (ufs.length === 0) return null;
  const uma = ufs.length === 1;
  return (
    `Em ${uma ? '1 unidade da federação' : `${ufs.length} unidades da federação`} ` +
    `(${ufs.join(', ')}) a nossa ficha de apuração lista apenas os dois eleitos: ` +
    `${uma ? 'a dupla é a publicada' : 'as duplas são as publicadas'}, mas sem o 3º colocado ` +
    'não há contra quem medir a folga, e ela fica em branco em vez de estimada.'
  );
}

/** A Câmara em uma frase, pela maior bancada e pelo fechamento em 513. */
export function rotuloCamara(bancadas: readonly BancadaCamara[], total: number): string {
  const maior = [...bancadas].sort((a, b) => b.cadeiras - a.cadeiras)[0];
  if (!maior) return `${total} cadeiras — composição ainda não cadastrada.`;
  const pct = formatarPct((maior.cadeiras / total) * 100);
  return (
    `${total} cadeiras, distribuídas entre ${bancadas.length} partidos. ` +
    `A maior bancada é a do ${maior.partido}, com ${maior.cadeiras} (${pct} da Casa).`
  );
}

function espectroDe(partido: string, casos: CasosDeUso): Espectro | null {
  return espectroDoPartido(partido, casos.listParties());
}

/** Linha "Fulano (PARTIDO)", ou o par do 2º turno separado por "x". */
export function textoGovernador(g: GovernadorUf): string {
  if (g.situacao === 'eleito' && g.eleito) return `${g.eleito.nome} (${g.eleito.partido})`;
  return g.finalistas.map((f) => `${f.nome} (${f.partido})`).join(' x ');
}

function criarMapaGovernadores(dados: DadosResultado, casos: CasosDeUso): SVGSVGElement {
  const porUf = new Map(dados.governadores.map((g) => [g.uf, g]));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', brazilMap.viewBox);
  svg.setAttribute('class', 'rv-mapa');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    'Mapa do Brasil com o governador eleito em cada unidade da federação; ' +
      'as que decidem no 2º turno aparecem hachuradas.',
  );

  // Hachura para o 2º turno: o estado TEM dado, mas não tem eleito — pintá-lo
  // de cinza o confundiria com ausência de informação, e pintá-lo da cor do
  // primeiro colocado afirmaria uma vitória que não aconteceu.
  const defs = document.createElementNS(SVG_NS, 'defs');
  const padrao = document.createElementNS(SVG_NS, 'pattern');
  padrao.setAttribute('id', 'rv-hachura');
  padrao.setAttribute('width', '6');
  padrao.setAttribute('height', '6');
  padrao.setAttribute('patternUnits', 'userSpaceOnUse');
  padrao.setAttribute('patternTransform', 'rotate(45)');
  const linha = document.createElementNS(SVG_NS, 'line');
  linha.setAttribute('x1', '0');
  linha.setAttribute('y1', '0');
  linha.setAttribute('x2', '0');
  linha.setAttribute('y2', '6');
  linha.setAttribute('stroke', 'var(--color-text-tertiary)');
  linha.setAttribute('stroke-width', '3');
  padrao.appendChild(linha);
  defs.appendChild(padrao);
  svg.appendChild(defs);

  for (const loc of brazilMap.locations) {
    const uf = loc.id.toUpperCase();
    const g = porUf.get(uf);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', loc.path);
    path.setAttribute('class', 'rv-uf');
    if (g?.situacao === 'eleito' && g.eleito) {
      const esp = espectroDe(g.eleito.partido, casos);
      path.style.fill = esp ? corEspectro(esp, 'solid') : 'var(--color-text-tertiary)';
    } else if (g?.situacao === 'segundo-turno') {
      path.style.fill = 'url(#rv-hachura)';
    } else {
      path.style.fill = 'var(--color-surface-2)';
    }
    const titulo = document.createElementNS(SVG_NS, 'title');
    titulo.textContent = g
      ? `${NOME_POR_UF.get(uf) ?? uf}: ${textoGovernador(g)}${g.situacao === 'segundo-turno' ? ' — 2º turno em 25/10' : ''}`
      : (NOME_POR_UF.get(uf) ?? uf);
    path.appendChild(titulo);
    svg.appendChild(path);
  }
  return svg;
}

function criarTabela(
  cabecalhos: readonly string[],
  linhas: readonly (readonly (string | Node)[])[],
): HTMLTableElement {
  const thead = criarEl('thead', {}, [
    criarEl(
      'tr',
      {},
      cabecalhos.map((h) => criarEl('th', { texto: h, attrs: { scope: 'col' } })),
    ),
  ]);
  const tbody = criarEl(
    'tbody',
    {},
    linhas.map((l) =>
      criarEl(
        'tr',
        {},
        l.map((c) => criarEl('td', typeof c === 'string' ? { texto: c } : {}, typeof c === 'string' ? [] : [c])),
      ),
    ),
  );
  return criarEl('table', { className: 'rv-tabela' }, [thead, tbody]);
}

function barraPartido(partido: string, cadeiras: number, maximo: number, casos: CasosDeUso): HTMLElement {
  const esp = espectroDe(partido, casos);
  const barra = criarEl('span', { className: 'rv-barra' });
  barra.style.width = `${Math.max(2, (cadeiras / maximo) * 100)}%`;
  barra.style.background = esp ? corEspectroSolido(esp) : 'var(--color-text-tertiary)';
  return criarEl('span', { className: 'rv-barra-host' }, [barra]);
}

/** Renderiza a tela "Resultados" — o fechamento do 1º turno, sem pesquisa nenhuma. */
export function renderResultado(container: HTMLElement, casos: CasosDeUso): void {
  const f = casos.getResultado();
  container.replaceChildren();

  container.appendChild(
    criarEl('header', { className: 'rv-header' }, [
      criarEl('h1', { texto: 'Resultados do 1º turno' }),
      criarEl('p', {
        className: 'rv-intro',
        texto:
          'Esta tela não tem pesquisa nenhuma: é o que as urnas decidiram em 4 de outubro. ' +
          'O Senado é derivado da nossa apuração, que cobre as 27 unidades da federação; ' +
          'governadores e Câmara vêm do resultado publicado. Para a comparação entre as ' +
          'pesquisas e esse resultado, veja a aba Projeção.',
      }),
    ]),
  );

  // --- Governadores -------------------------------------------------------
  const secaoGov = criarEl('section', { className: 'rv-secao' }, [
    criarEl('h2', { texto: 'Governadores' }),
    criarEl('p', { className: 'rv-linha', texto: rotuloGovernadores(f.governadores.eleitos, f.governadores.segundoTurno) }),
  ]);
  secaoGov.appendChild(criarMapaGovernadores(f.dados, casos));
  secaoGov.appendChild(
    criarEl('p', {
      className: 'rv-nota',
      texto:
        'A cor é o espectro do partido do eleito. As unidades hachuradas não têm eleito: ' +
        'decidem no 2º turno, e pintá-las da cor de quem está à frente afirmaria uma ' +
        'vitória que não aconteceu.',
    }),
  );
  const maxUfs = Math.max(...f.governadoresPorPartido.map((p) => p.ufs.length), 1);
  secaoGov.appendChild(
    criarTabela(
      ['Partido', 'Governos', '', 'Unidades da federação'],
      f.governadoresPorPartido.map((p) => [
        p.partido,
        String(p.ufs.length),
        barraPartido(p.partido, p.ufs.length, maxUfs, casos),
        p.ufs.join(', '),
      ]),
    ),
  );
  const emDisputa = f.dados.governadores.filter((g) => g.situacao === 'segundo-turno');
  if (emDisputa.length > 0) {
    secaoGov.appendChild(criarEl('h3', { texto: 'Ainda em disputa, 25 de outubro' }));
    secaoGov.appendChild(
      criarTabela(
        ['UF', 'Confronto'],
        emDisputa.map((g) => [g.uf, textoGovernador(g)]),
      ),
    );
  }
  container.appendChild(secaoGov);

  // --- Senado -------------------------------------------------------------
  const s = f.senado;
  const maxSen = Math.max(...s.bancadas.map((b) => b.total), 1);
  const secaoSen = criarEl('section', { className: 'rv-secao' }, [
    criarEl('h2', { texto: 'Senado' }),
    criarEl('p', { className: 'rv-linha', texto: rotuloFechamentoSenado(s) }),
  ]);
  secaoSen.appendChild(
    criarTabela(
      ['Partido', 'Total', '', 'Eleitas em 2026', 'De 2022'],
      s.bancadas.map((b) => [
        b.partido,
        String(b.total),
        barraPartido(b.partido, b.total, maxSen, casos),
        String(b.eleitas2026),
        String(b.remanescentes),
      ]),
    ),
  );
  const apertadas = rotuloVagasApertadas(s.eleitos);
  if (apertadas) secaoSen.appendChild(criarEl('p', { className: 'rv-alerta', texto: apertadas }));
  const semFolga = rotuloFolgaDesconhecida(s.ufsIncompletas);
  if (semFolga) secaoSen.appendChild(criarEl('p', { className: 'rv-nota', texto: semFolga }));
  container.appendChild(secaoSen);

  // --- Câmara -------------------------------------------------------------
  const maxCam = Math.max(...f.dados.camara.bancadas.map((b) => b.cadeiras), 1);
  const secaoCam = criarEl('section', { className: 'rv-secao' }, [
    criarEl('h2', { texto: 'Câmara dos Deputados' }),
    criarEl('p', {
      className: 'rv-linha',
      texto: rotuloCamara(f.dados.camara.bancadas, f.dados.camara.totalCadeiras),
    }),
  ]);
  secaoCam.appendChild(
    criarTabela(
      ['Partido', 'Cadeiras', ''],
      [...f.dados.camara.bancadas]
        .sort((a, b) => b.cadeiras - a.cadeiras)
        .map((b) => [b.partido, String(b.cadeiras), barraPartido(b.partido, b.cadeiras, maxCam, casos)]),
    ),
  );
  secaoCam.appendChild(
    criarEl('p', {
      className: 'rv-nota',
      texto:
        'Bancadas por partido, não por federação: PT, PCdoB e PV aparecem separados, ' +
        'assim como União Brasil e PP. As cadeiras somam exatamente 513 — é essa conta ' +
        'que garante que a lista está completa, e não só plausível.',
    }),
  );
  container.appendChild(secaoCam);

  // --- Legenda de espectro ------------------------------------------------
  const espectros: Espectro[] = ['esquerda', 'centro-esquerda', 'centro', 'centro-direita', 'direita'];
  const legenda = criarEl('section', { className: 'rv-legenda' }, [
    criarEl('h2', { texto: 'Como ler as cores' }),
  ]);
  const ul = criarEl('ul', { className: 'rv-legenda-lista' });
  for (const e of espectros) {
    const amostra = criarEl('span', { className: 'rv-amostra' });
    amostra.style.background = corEspectroSolido(e);
    ul.appendChild(criarEl('li', {}, [amostra, rotuloEspectro(e)]));
  }
  legenda.appendChild(ul);
  container.appendChild(legenda);
}
