import '../styles/vote-estimate.css';
import brazilMapDados from '@svg-maps/brazil';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type { Partido } from '../../../../domain/party.js';
import { espectroDoPartido, type Espectro } from '../../../../domain/spectrum.js';
import type {
  BaseDaEstimativa,
  CandidatoEstimado,
  EstimativaVotos,
  OrigemVotoCandidato,
  UfOrigemVotos,
} from '../../../../domain/vote-estimate.js';
import {
  classificarConfianca,
  JANELA_DIAS_PADRAO,
  type NivelConfianca,
} from '../../../../domain/aggregate.js';
import { CONFRONTO_LULA_FLAVIO } from '../../../../domain/runoff.js';
import { mesmoCandidato } from '../../../../domain/candidate-identity.js';
import { formatarNumeroPt, formatarPct, formatarVantagem, pluralizar } from '../format.js';
import {
  bboxPath,
  criarEl,
  formatarData,
  listaEmPortugues,
  rotuloEspectro,
  rotuloRecorte,
  rotuloTurno,
  tokenFillEspectro,
  tokenSolidEspectro,
  type Turno,
} from './_shared.js';

/**
 * Painel "Votos estimados por agregação estadual": consome `casos.getVoteEstimate()`,
 * `casos.listParties()` e — só para datar e qualificar o dado de cada UF na
 * tabela (data da pesquisa fora da janela, margem de erro da UF) —
 * `casos.getPresidentialByState()`. Módulo independente — não importa nem
 * depende de nenhuma outra view (`presidential-states-view`, `senate-view`,
 * `timeline-chart`, `presidential-view`, `candidate-names`), cada uma delas em
 * desenvolvimento em paralelo por outro agente; só usa helpers estáveis e já
 * compartilhados (`_shared.ts`, `format.ts`) e sua própria folha de estilos
 * (`styles/vote-estimate.css`, prefixo `ve-`).
 *
 * "Nunca inventa dados": quando `getVoteEstimate()` retorna `null` (dados
 * insuficientes — ver `domain/vote-estimate.ts`), o painel mostra um aviso
 * textual em vez de qualquer número.
 *
 * O painel tem uma obrigação editorial além de desenhar barras: dizer se a
 * diferença entre o 1º e o 2º colocado cabe na margem de erro que ele mesmo
 * calcula. No 2º turno (Lula x Flávio Bolsonaro) a diferença é de ~1,3 pt
 * contra uma semi-margem agregada de ~2,2 pt — empate técnico pelo MESMO
 * critério do domínio (`classificarConfianca`/`empateTecnico` em
 * `domain/aggregate.ts`), reaproveitado aqui em vez de reinventado.
 */

/**
 * Renderiza o painel de votos estimados dentro de `container`, no `turno`
 * pedido (1 por padrão — o 2º turno usa o confronto padrão dos casos de uso,
 * Lula x Flávio Bolsonaro). O turno escolhido aparece no título e no método,
 * para a tabela nunca ficar ambígua sobre de que eleição ela fala.
 */
/**
 * O seletor de base — o botão que troca a régua da estimativa.
 *
 * Existe porque as duas leituras respondem perguntas diferentes e nenhuma das
 * duas é "a certa": o eleitorado total diz quantos eleitores do país estão com
 * cada candidato; os votos válidos ancorados dizem como ficaria o boletim se a
 * ida às urnas repetisse a de 4 de outubro. Deixar só uma esconderia metade.
 */
function criarSeletorDeBase(
  atual: BaseDaEstimativa,
  aoTrocar: (base: BaseDaEstimativa) => void,
): HTMLElement {
  const grupo = criarEl('div', {
    className: 've-base',
    attrs: { role: 'radiogroup', 'aria-label': 'Base de cálculo da estimativa' },
  });
  grupo.append(criarEl('span', { className: 've-base__rotulo', texto: 'Base de cálculo:' }));

  for (const base of ['validos-1o-turno', 'eleitorado'] as const) {
    const selecionado = base === atual;
    const botao = criarEl('button', {
      className: `ve-base__opcao${selecionado ? ' ve-base__opcao--ativa' : ''}`,
      texto: rotuloBase(base),
      attrs: {
        type: 'button',
        role: 'radio',
        'aria-checked': selecionado ? 'true' : 'false',
        ...(selecionado ? {} : { tabindex: '-1' }),
      },
    });
    if (!selecionado) botao.addEventListener('click', () => aoTrocar(base));
    grupo.append(botao);
  }
  return grupo;
}

/**
 * A base com que a aba abre. No 1º turno a eleição já aconteceu e a estimativa
 * é retrospectiva, então vale a base histórica; no 2º turno, que é o que está
 * em jogo, abre ancorada no 1º turno — é a leitura comparável com um boletim
 * de urna, e é a que o leitor quer ver primeiro.
 */
export function baseInicial(turno: Turno): BaseDaEstimativa {
  return turno === 2 ? 'validos-1o-turno' : 'eleitorado';
}

export function rotuloBase(base: BaseDaEstimativa): string {
  return base === 'validos-1o-turno'
    ? 'Votos válidos, ancorado no 1º turno'
    : 'Eleitorado total';
}

/** Unidade em que os percentuais daquela base são lidos. */
export function rotuloUnidadeDaBase(base: BaseDaEstimativa): string {
  return base === 'validos-1o-turno' ? '% dos votos válidos' : '% do eleitorado';
}

/**
 * A frase que torna a base ancorada auditável: quantos votos válidos ela
 * supõe, de onde sai a suposição e o que ela NÃO cobre. Sem isso o número
 * parece apuração.
 */
export function textoDaAncoragem(e: EstimativaVotos): string | null {
  if (e.base !== 'validos-1o-turno') return null;
  const partes: string[] = [
    `Os percentuais das pesquisas foram aplicados sobre ${formatarInteiro(e.baseTotal)} votos válidos ` +
      'estimados — os votos válidos que cada estado de fato registrou em 4 de outubro, que já descontam ' +
      'a abstenção e os brancos e nulos medidos ali.',
  ];
  if (e.comparecimento) {
    const taxa = (e.comparecimento.votos / e.comparecimento.eleitoresCobertos) * 100;
    const faltam = e.comparecimento.ufsSemDado;
    const cobertura = (e.comparecimento.eleitoresCobertos / e.eleitoradoTotal) * 100;
    if (faltam.length > 0) {
      partes.push(
        `A abstenção do 1º turno foi de ${formatarNumeroPt(100 - taxa)}% nas ${
          27 - faltam.length
        } UFs em que ela é conhecida (${formatarNumeroPt(cobertura)}% do eleitorado); faltam ${listaEmPortugues(
          faltam,
        )}.`,
      );
    } else {
      // Com as 27 UFs fechadas, o número passa a ser comparável com o que o
      // TSE divulga — e fica um pouco MENOR que ele. A diferença não é erro:
      // o total nacional do TSE inclui as seções do exterior, que não entram
      // em nenhuma UF. Dizer isso aqui evita que quem confira ache divergência.
      partes.push(
        `A abstenção do 1º turno foi de ${formatarNumeroPt(100 - taxa)}% nas 27 UFs, agora todas ` +
          'apuradas. O total que o TSE divulga é um pouco maior porque soma também as seções do ' +
          'exterior, que não pertencem a nenhum estado e por isso não entram neste mapa.',
      );
    }
  }
  if (e.ufsComAncoragemSubstituta.length > 0) {
    partes.push(
      `${listaEmPortugues([...e.ufsComAncoragemSubstituta])} não tem apuração presidencial de 1º turno: ` +
        'a âncora dessa UF foi estimada pela razão votos válidos/eleitorado das demais.',
    );
  }
  partes.push(
    'A suposição, por inteiro: o 2º turno terá a mesma abstenção e a mesma taxa de brancos e nulos do 1º. ' +
      'Historicamente a abstenção do 2º turno é um pouco MAIOR, então os votos absolutos tendem a ficar ' +
      'um pouco altos; a divisão percentual entre os dois quase não se mexe com isso.',
  );
  return partes.join(' ');
}

export function renderVoteEstimate(
  container: HTMLElement,
  casos: CasosDeUso,
  turno: Turno = 1,
  base: BaseDaEstimativa = baseInicial(turno),
): void {
  container.innerHTML = '';

  const confronto = turno === 2 ? CONFRONTO_LULA_FLAVIO : null;
  const recorte = rotuloRecorte(turno, confronto);
  const titulo = `Votos estimados por agregação estadual — ${recorte}`;

  const raiz = criarEl('section', { className: 've-view', attrs: { 'aria-labelledby': 've-titulo' } });

  const seletor = criarSeletorDeBase(base, (nova) =>
    renderVoteEstimate(container, casos, turno, nova),
  );

  const estimativa = casos.getVoteEstimate(turno, { base });
  if (estimativa === null || estimativa.candidatos.length === 0) {
    raiz.append(
      criarEl('h1', { className: 've-title', texto: titulo, attrs: { id: 've-titulo' } }),
      seletor,
      criarEl('p', {
        className: 've-empty',
        texto:
          base === 'validos-1o-turno'
            ? `Ainda não há apuração de 1º turno suficiente para ancorar a estimativa de ${recorte}. ` +
              'Troque a base acima para ver a estimativa sobre o eleitorado total.'
            : `Ainda não há dados suficientes de ${recorte} (eleitorado cadastrado e pesquisas presidenciais, ` +
              'estaduais ou nacional) para calcular esta estimativa.',
      }),
    );
    container.append(raiz);
    return;
  }

  const partidos = casos.listParties();
  const origens = origensPresentes(estimativa.candidatos);
  const vantagem = calcularVantagemAgregada(estimativa.candidatos, estimativa.baseTotal, base);
  const dadosPorUf = coletarDadosAgregadosPorUf(casos, turno);
  // Referência honesta do salto dos não atribuídos no 2º turno: o número real
  // do 1º turno, não uma estimativa de quanto ele "deveria" ter subido.
  const turnoAnterior = turno === 2 ? estimativaDeReferencia(casos, 1) : null;

  const comAsterisco = temAsteriscoNaTabela(estimativa.porUf);

  raiz.append(criarCabecalho(estimativa, titulo, recorte, origens, comAsterisco, seletor));
  const ancoragem = textoDaAncoragem(estimativa);
  if (ancoragem) {
    raiz.append(
      criarEl('p', { className: 've-ancoragem', texto: ancoragem, attrs: { role: 'note' } }),
    );
  }
  raiz.append(criarSecaoComparacaoBarras(estimativa, partidos, vantagem, origens));
  // Na base ancorada não há resíduo: voto válido é voto em candidato, e
  // abstenção/brancos/nulos saíram da base em vez de virarem uma fatia de
  // "não atribuídos" que o leitor interpretaria como indecisão.
  if (estimativa.base !== 'validos-1o-turno') {
    raiz.append(criarBlocoNaoAtribuidos(estimativa, vantagem, turno, turnoAnterior));
  }
  raiz.append(criarSecaoComparacao(estimativa));
  const cadeia = montarCadeiaPorUf(estimativa);
  if (cadeia) raiz.append(criarSecaoCadeia(cadeia, partidos, estimativa));
  raiz.append(criarSecaoPorUf(estimativa, comAsterisco, dadosPorUf));

  container.append(raiz);
}


/* ============ Do eleitorado aos votos, estado a estado ============ */

/**
 * Tipagem local do `@svg-maps/brazil` — o `.d.ts` da lib referencia um pacote
 * de tipos que não está instalado. Mesma nota que map-view.ts e state-panel.ts.
 */
interface LocalidadeMapaVe {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}
interface MapaSvgVe {
  readonly viewBox: string;
  readonly locations: readonly LocalidadeMapaVe[];
}
const mapaBrasilVe = brazilMapDados as MapaSvgVe;

export interface CandidatoNaCadeia {
  readonly nome: string;
  readonly partido: string | null;
  readonly votos: number;
  /** % sobre os votos válidos estimados DA UF — normalizado para somar 100 no estado. */
  readonly pct: number;
  /**
   * % que o candidato teve nesta UF no 1º turno, sobre TODOS os votos válidos
   * de lá — a base em que o resultado foi publicado. `null` onde a UF não tem
   * apuração.
   *
   * **Não é comparável com `pct` por subtração**: no 1º turno a cédula tinha
   * mais nomes, e boa parte da diferença entre as duas colunas é a
   * redistribuição dos votos de quem não passou, não movimento de eleitor.
   */
  readonly pctPrimeiroTurno: number | null;
  /**
   * % que o candidato teve no 1º turno contando APENAS os votos dos dois que
   * foram ao 2º turno. Esta sim fica na mesma base de `pct`, e é a que mede
   * quanto a disputa andou desde 4 de outubro. `null` sem apuração na UF.
   */
  readonly pctPrimeiroTurnoEntreOsDois: number | null;
}

/**
 * A conta de uma UF, do eleitorado ao voto, com cada degrau visível.
 *
 * Existe porque o número final ("Lula 60,1 milhões") é o fim de uma cadeia de
 * quatro passos, e quem lê só o fim não consegue conferir nenhum deles. Aqui a
 * cadeia aparece inteira: quantos eleitores a UF tem, quantos não foram às
 * urnas em 4 de outubro, quantos votaram, quantos votos valeram e como a
 * pesquisa do estado divide esses votos válidos.
 */
export interface CadeiaUf {
  readonly uf: string;
  readonly eleitores: number;
  /**
   * Eleitores que não compareceram no 1º turno, como a apuração PUBLICOU —
   * não `eleitores - votantes`. `null` onde a UF não tem apuração.
   */
  readonly abstencao: number | null;
  /** Comparecimento do 1º turno — os que de fato foram votar. `null` junto com `abstencao`. */
  readonly votantes: number | null;
  /**
   * Base da TAXA de abstenção: os aptos nas seções daquela UF, como a apuração
   * os contou (`abstencao + votantes`). Não é `eleitores`, e é de propósito —
   * dividir a abstenção publicada pelo eleitorado registrado misturaria duas
   * contagens e daria uma taxa que não é a oficial. `null` sem apuração.
   */
  readonly aptosApuracao: number | null;
  /** Votos válidos estimados: a base sobre a qual os percentuais são aplicados. */
  readonly validos: number;
  /** true quando a âncora desta UF foi estimada pela razão nacional, não apurada. */
  readonly ancoraSubstituta: boolean;
  readonly candidatos: readonly CandidatoNaCadeia[];
}

/**
 * Monta a cadeia de todas as UFs, da maior para a menor.
 *
 * Devolve `null` fora da base ancorada: sem âncora não existem "abstenção do
 * 1º turno" nem "votos válidos estimados" para mostrar, e uma tabela com duas
 * colunas vazias afirmaria que o dado falta quando na verdade a pergunta é
 * que não se aplica.
 */
export function montarCadeiaPorUf(e: EstimativaVotos): readonly CadeiaUf[] | null {
  if (e.base !== 'validos-1o-turno') return null;
  const partidoPorNome = new Map(e.candidatos.map((c) => [c.candidato, c.partido]));
  const substitutas = new Set(e.ufsComAncoragemSubstituta);

  return [...e.porUf]
    .map((uf): CadeiaUf => {
      const votantes = uf.ancoragem?.comparecimentoPrimeiroTurno ?? null;
      const abstencao = uf.ancoragem?.abstencoesPrimeiroTurno ?? null;
      const ordenados = candidatosOrdenadosDaUf(uf);
      const votos1T = uf.ancoragem?.votosPrimeiroTurno ?? {};
      const validos1T = uf.ancoragem?.validosPrimeiroTurno ?? 0;
      // Casamento por `mesmoCandidato` e não por igualdade de texto: a
      // apuração e as pesquisas não são obrigadas a grafar o nome igual.
      const votosDe = (nome: string): number | null => {
        const achado = Object.entries(votos1T).find(([n]) => mesmoCandidato(n, nome));
        return achado ? achado[1] : null;
      };
      const votosDosDois = ordenados
        .map((c) => votosDe(c.nome))
        .filter((v): v is number => v !== null)
        .reduce((soma, v) => soma + v, 0);

      const candidatos = ordenados.map((c): CandidatoNaCadeia => {
        const v1 = votosDe(c.nome);
        return {
          nome: c.nome,
          partido: partidoPorNome.get(c.nome) ?? null,
          votos: c.votos,
          pct: uf.baseDeVotos > 0 ? (c.votos / uf.baseDeVotos) * 100 : 0,
          pctPrimeiroTurno: v1 !== null && validos1T > 0 ? (v1 / validos1T) * 100 : null,
          pctPrimeiroTurnoEntreOsDois:
            v1 !== null && votosDosDois > 0 ? (v1 / votosDosDois) * 100 : null,
        };
      });
      return {
        uf: uf.uf,
        eleitores: uf.eleitores,
        abstencao,
        votantes,
        aptosApuracao: abstencao !== null && votantes !== null ? abstencao + votantes : null,
        validos: uf.baseDeVotos,
        ancoraSubstituta: substitutas.has(uf.uf),
        candidatos,
      };
    })
    .sort((a, b) => b.eleitores - a.eleitores);
}

/** "3.740.385 · 22,8%" — o absoluto com a taxa ao lado; "—" quando a UF não tem o dado. */
export function rotuloAbstencao(abstencao: number | null, aptos: number | null): string {
  if (abstencao === null || aptos === null || !(aptos > 0)) return '—';
  return `${formatarInteiro(abstencao)} · ${formatarPct((abstencao / aptos) * 100)}`;
}

/**
 * Rótulo acessível de uma UF no mapa: a cadeia inteira em uma frase, porque
 * quem usa leitor de tela não tem a tabela ao lado para cruzar.
 */
export function ariaCadeiaUf(nomeEstado: string, c: CadeiaUf): string {
  const partes = [`${nomeEstado}: ${formatarInteiro(c.eleitores)} eleitores`];
  if (c.abstencao !== null && c.aptosApuracao !== null && c.aptosApuracao > 0) {
    partes.push(
      `abstenção de ${formatarPct((c.abstencao / c.aptosApuracao) * 100)} no 1º turno`,
      `${formatarInteiro(c.votantes ?? 0)} votantes estimados`,
    );
  }
  partes.push(`${formatarInteiro(c.validos)} votos válidos estimados`);
  for (const cand of c.candidatos.slice(0, 2)) {
    partes.push(`${cand.nome} ${formatarPct(cand.pct)}, ${formatarInteiro(cand.votos)} votos`);
  }
  if (c.ancoraSubstituta) partes.push('âncora estimada, não apurada');
  return `${partes.join('. ')}.`;
}


/**
 * A célula do 1º turno: o percentual como ele foi publicado (sobre TODOS os
 * válidos da UF) e, abaixo, o mesmo resultado recontado só entre os dois que
 * passaram — que é a leitura comparável com a coluna da estimativa ao lado.
 *
 * As duas aparecem juntas porque sozinhas enganam de maneiras opostas: a
 * primeira convida a subtrair bases diferentes ("Lula saiu de 38% para 46%,
 * cresceu 8 pontos" — não cresceu, herdou), e a segunda, sozinha, não é o
 * número que o leitor viu na noite da apuração.
 */
export function textosPrimeiroTurno(
  c: CandidatoNaCadeia,
): { readonly principal: string; readonly secundario: string | null } | null {
  if (c.pctPrimeiroTurno === null) return null;
  return {
    principal: formatarPct(c.pctPrimeiroTurno),
    secundario:
      c.pctPrimeiroTurnoEntreOsDois === null
        ? null
        : `${formatarPct(c.pctPrimeiroTurnoEntreOsDois)} entre os dois`,
  };
}

/** Monta a célula a partir dos textos acima. A conta está em `textosPrimeiroTurno`. */
export function celulaPrimeiroTurno(c: CandidatoNaCadeia): HTMLElement | string {
  const textos = textosPrimeiroTurno(c);
  if (textos === null) return '—';
  return criarEl('span', {}, [
    textos.principal,
    textos.secundario === null
      ? null
      : criarEl('span', { className: 've-cadeia-sub', texto: textos.secundario }),
  ]);
}


/**
 * Mapa da estimativa: cada UF pintada pelo espectro do partido de quem tem
 * MAIS votos válidos estimados ali.
 *
 * Não repete o mapa da outra aba, que mostra a liderança nas pesquisas em
 * pontos: este mostra onde os VOTOS estão, e seu `aria-label` carrega a cadeia
 * inteira da UF (eleitores, abstenção, votantes, válidos e votos por
 * candidato), que é o conteúdo da tabela logo abaixo.
 */
function criarMapaDaCadeia(cadeia: readonly CadeiaUf[], partidos: readonly Partido[]): HTMLElement {
  const porUf = new Map(cadeia.map((c) => [c.uf, c]));
  const nomePorUf = new Map(mapaBrasilVe.locations.map((l) => [l.id.toUpperCase(), l.name]));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', mapaBrasilVe.viewBox);
  svg.setAttribute('class', 've-mapa-svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa dos votos estimados por estado');

  for (const loc of mapaBrasilVe.locations) {
    const uf = loc.id.toUpperCase();
    const c = porUf.get(uf);
    const lider = c?.candidatos[0] ?? null;
    const espectro = resolverEspectro(lider?.partido ?? null, partidos);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', loc.path);
    path.setAttribute('class', 've-mapa-uf');
    path.style.fill = c ? tokenFillEspectro(espectro) : 'var(--spectrum-indefinido)';
    path.setAttribute(
      'aria-label',
      c
        ? ariaCadeiaUf(nomePorUf.get(uf) ?? uf, c)
        : `${nomePorUf.get(uf) ?? uf}: sem estimativa.`,
    );
    svg.append(path);

    const bbox = bboxPath(loc.path);
    const texto = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    texto.setAttribute('x', String((bbox.minX + bbox.maxX) / 2));
    texto.setAttribute('y', String((bbox.minY + bbox.maxY) / 2));
    texto.setAttribute('class', 've-mapa-sigla');
    texto.setAttribute('aria-hidden', 'true');
    texto.textContent = uf;
    svg.append(texto);
  }

  const wrap = criarEl('div', { className: 've-mapa-wrap' });
  wrap.append(svg);
  return wrap;
}

/** Legenda do mapa: um item por candidato que lidera em alguma UF. */
function criarLegendaDoMapa(
  cadeia: readonly CadeiaUf[],
  partidos: readonly Partido[],
): HTMLElement {
  const vistos = new Map<string, { partido: string | null; ufs: number }>();
  for (const c of cadeia) {
    const lider = c.candidatos[0];
    if (!lider) continue;
    const atual = vistos.get(lider.nome) ?? { partido: lider.partido, ufs: 0 };
    atual.ufs += 1;
    vistos.set(lider.nome, atual);
  }

  return criarEl(
    'p',
    { className: 've-bar-legend' },
    [...vistos.entries()]
      .sort((a, b) => b[1].ufs - a[1].ufs)
      .map(([nome, { partido, ufs }]) => {
        const swatch = criarEl('span', { className: 've-legend-swatch' });
        swatch.style.background = tokenFillEspectro(resolverEspectro(partido, partidos));
        return criarEl('span', { className: 've-bar-legend__item' }, [
          swatch,
          `${nome} à frente em ${ufs} ${ufs === 1 ? 'UF' : 'UFs'}`,
        ]);
      }),
  );
}

/**
 * A tabela que mostra a conta inteira, estado a estado. Uma coluna por degrau
 * da cadeia e, depois, duas colunas por candidato (percentual já normalizado
 * para 100 dentro da UF, e a quantidade de votos que ele representa).
 */
function criarSecaoCadeia(
  cadeia: readonly CadeiaUf[],
  partidos: readonly Partido[],
  e: EstimativaVotos,
): HTMLElement {
  // Os candidatos das colunas são os do agregado nacional, na ordem dele, para
  // que a tabela tenha as MESMAS colunas em todas as linhas.
  const colunasCandidato = e.candidatos.slice(0, 2).map((c) => c.candidato);

  const cabecalhos = [
    'UF',
    'Eleitores',
    'Abstenção 1º turno',
    'Votantes estimados',
    'Válidos estimados',
    ...colunasCandidato.flatMap((nome) => [
      `${nome} no 1º turno`,
      `${nome} %`,
      `${nome} votos`,
    ]),
  ];

  const linhas = cadeia.map((c) => {
    const porNome = new Map(c.candidatos.map((x) => [x.nome, x]));
    return criarEl('tr', {}, [
      criarEl('td', { attrs: { 'data-rotulo': 'UF' } }, [
        c.uf,
        c.ancoraSubstituta
          ? criarEl('span', {
              className: 've-uf-empate',
              texto: 'âncora estimada',
              attrs: {
                title:
                  'Esta UF não tem apuração presidencial de 1º turno: os votos válidos foram ' +
                  'estimados pela razão válidos/eleitorado das demais.',
              },
            })
          : null,
      ]),
      criarEl('td', {
        className: 've-col-num',
        texto: formatarInteiro(c.eleitores),
        attrs: { 'data-rotulo': 'Eleitores' },
      }),
      criarEl('td', {
        className: 've-col-num',
        texto: rotuloAbstencao(c.abstencao, c.aptosApuracao),
        attrs: { 'data-rotulo': 'Abstenção 1º turno' },
      }),
      criarEl('td', {
        className: 've-col-num',
        texto: c.votantes === null ? '—' : formatarInteiro(c.votantes),
        attrs: { 'data-rotulo': 'Votantes estimados' },
      }),
      criarEl('td', {
        className: 've-col-num',
        texto: formatarInteiro(c.validos),
        attrs: { 'data-rotulo': 'Válidos estimados' },
      }),
      ...colunasCandidato.flatMap((nome) => {
        const cand = porNome.get(nome);
        return [
          criarEl('td', { className: 've-col-num', attrs: { 'data-rotulo': `${nome} no 1º turno` } }, [
            cand ? celulaPrimeiroTurno(cand) : '—',
          ]),
          criarEl('td', {
            className: 've-col-num',
            texto: cand ? formatarPct(cand.pct) : '—',
            attrs: { 'data-rotulo': `${nome} %` },
          }),
          criarEl('td', {
            className: 've-col-num',
            texto: cand ? formatarInteiro(cand.votos) : '—',
            attrs: { 'data-rotulo': `${nome} votos` },
          }),
        ];
      }),
    ]);
  });

  const semComparecimento = cadeia.filter((c) => c.votantes === null).map((c) => c.uf);

  return criarEl('section', { attrs: { 'aria-labelledby': 've-cadeia-heading' } }, [
    criarEl('h2', {
      className: 've-section-title',
      texto: 'Do eleitorado aos votos, estado a estado',
      attrs: { id: 've-cadeia-heading' },
    }),
    criarEl('p', {
      className: 've-meta',
      texto:
        'Cada linha é a conta inteira de uma UF: do eleitorado apto, tira-se a abstenção MEDIDA no 1º turno; ' +
        'do comparecimento, tiram-se os brancos e nulos também medidos; e os votos válidos que sobram são ' +
        'divididos pelos percentuais da pesquisa daquele estado, renormalizados para somar 100 dentro da UF. ' +
        'Nenhum degrau é suposto — os dois primeiros vêm da apuração de 4 de outubro.',
    }),
    criarEl('p', {
      className: 've-meta',
      texto:
        'A coluna "eleitores" e a coluna "abstenção" vêm de duas contagens que não fecham por subtração, e ' +
        'ficam assim de propósito: "eleitores" é o eleitorado registrado no domicílio, e a abstenção é a que a ' +
        'apuração publicou, sobre os aptos NAS SEÇÕES daquela UF — base que inclui quem votou em trânsito para ' +
        'presidente. É por isso que a taxa ao lado do número não é a abstenção dividida pelos eleitores da ' +
        'primeira coluna. Preferimos a abstenção oficial com a base dela a uma subtração que daria um número ' +
        'que ninguém publicou: em São Paulo as duas contas diferem em mais de 18 mil eleitores.',
    }),
    criarEl('p', {
      className: 've-meta',
      texto:
        'A coluna "no 1º turno" traz o resultado real daquela UF em 4 de outubro, sobre TODOS os votos válidos ' +
        'de lá — a base em que ele foi publicado. Abaixo dela, em menor, o mesmo resultado recontado só entre ' +
        'os dois que passaram: é ESSA que está na mesma base da estimativa ao lado. Subtrair a primeira da ' +
        'estimativa mede sobretudo a herança dos votos de quem não foi ao 2º turno, não movimento de eleitor.',
    }),
    criarMapaDaCadeia(cadeia, partidos),
    criarLegendaDoMapa(cadeia, partidos),
    criarEl('div', { className: 've-table-wrap ve-stack-table-wrap ve-uf-table-wrap' }, [
      criarEl('table', { className: 've-table' }, [
        criarEl('thead', {}, [
          criarEl(
            'tr',
            {},
            cabecalhos.map((texto) => criarEl('th', { texto, attrs: { scope: 'col' } })),
          ),
        ]),
        criarEl('tbody', {}, linhas),
      ]),
    ]),
    semComparecimento.length > 0
      ? criarEl('p', {
          className: 've-meta',
          texto:
            `Abstenção e votantes aparecem como "—" em ${listaEmPortugues(semComparecimento)}: a apuração ` +
            'dessas UFs não publicou brancos e nulos, então o comparecimento do 1º turno não é conhecido. ' +
            'Os votos válidos, que são a base do cálculo, são conhecidos mesmo assim.',
        })
      : null,
  ]);
}

/* ========================= Formatação ========================= */

/** Formata votos em milhões, 1 casa decimal, pt-BR: "62,3 milhões". */
export function formatarMilhoes(votos: number, casas = 1): string {
  const milhoes = votos / 1_000_000;
  return `${formatarNumeroPt(milhoes, casas)} milhões`;
}

/** Formata uma diferença em pontos percentuais, sem sinal: "1,3 pt". */
export function formatarPontos(pontos: number, casas = 1): string {
  return `${formatarNumeroPt(Math.abs(pontos), casas)} pt`;
}

/** Formata um inteiro com separador de milhar pt-BR: "1.234.567". */
function formatarInteiro(valor: number): string {
  return Math.round(valor).toLocaleString('pt-BR');
}

/* ==================== Barra empilhada (3 origens) ==================== */

export interface SegmentosBarra {
  /** % (0..100) dos votos vinda do percentual próprio da pesquisa estadual. */
  readonly pctEstadual: number;
  /** % (0..100) dos votos vinda do complemento nacional em UFs com pesquisa. */
  readonly pctComplemento: number;
  /** % (0..100) dos votos vinda de UFs sem pesquisa estadual. */
  readonly pctSemPesquisa: number;
}

/**
 * Calcula as proporções (0..100) dos 3 segmentos da barra empilhada de um
 * candidato a partir das 3 parcelas de voto já expostas por `estimarVotos`.
 * Soma sempre 100 (ou fica com os 3 em 0 quando o candidato não tem nenhum
 * voto estimado, para não dividir por zero).
 */
export function montarSegmentosBarra(
  candidato: Pick<CandidatoEstimado, 'votos' | 'votosDeUfComPesquisa' | 'votosComplementoNacional' | 'votosDeUfSemPesquisa'>,
): SegmentosBarra {
  const total = candidato.votos;
  if (!(total > 0)) {
    return { pctEstadual: 0, pctComplemento: 0, pctSemPesquisa: 0 };
  }
  return {
    pctEstadual: (candidato.votosDeUfComPesquisa / total) * 100,
    pctComplemento: (candidato.votosComplementoNacional / total) * 100,
    pctSemPesquisa: (candidato.votosDeUfSemPesquisa / total) * 100,
  };
}

/* ============ Quais origens de voto a tela realmente desenha ============ */

export interface OrigensPresentes {
  /** Algum candidato tem voto vindo da pesquisa estadual própria da UF. */
  readonly estadual: boolean;
  /** Algum candidato foi suprido pelo agregado nacional em UF que TEM pesquisa (o "*" da tabela). */
  readonly complemento: boolean;
  /** Algum candidato tem voto vindo de UF sem pesquisa estadual. */
  readonly semPesquisa: boolean;
}

/**
 * Origens de voto que de fato aparecem nas barras. No 2º turno (as duas
 * pesquisas estaduais testam exatamente os dois candidatos, e todas as 27 UFs
 * têm pesquisa) só existe a origem 'estadual' — e a tela não deve ensinar uma
 * legenda de 4 itens nem um rodapé de asterisco para segmentos que não
 * renderizam.
 */
export function origensPresentes(candidatos: readonly CandidatoEstimado[]): OrigensPresentes {
  return {
    estadual: candidatos.some((c) => c.votosDeUfComPesquisa > 0),
    complemento: candidatos.some((c) => c.votosComplementoNacional > 0),
    semPesquisa: candidatos.some((c) => c.votosDeUfSemPesquisa > 0),
  };
}

/** Quantas origens diferentes de voto existem — a barra só é "empilhada" a partir de 2. */
export function quantidadeDeOrigens(origens: OrigensPresentes): number {
  return [origens.estadual, origens.complemento, origens.semPesquisa].filter(Boolean).length;
}

/* ============ Vantagem entre 1º e 2º e empate técnico agregado ============ */

/**
 * Semi-margem de erro agregada de um candidato, convertida de votos
 * (`votosMax - votos`, propagada UF a UF por `estimarVotos`) para pontos do
 * eleitorado total — a mesma unidade em que a vantagem é medida.
 */
export function margemPontosDoCandidato(
  candidato: Pick<CandidatoEstimado, 'votos' | 'votosMax'>,
  eleitoradoTotal: number,
): number {
  if (!(eleitoradoTotal > 0)) return 0;
  return Math.max(0, ((candidato.votosMax - candidato.votos) / eleitoradoTotal) * 100);
}

export interface VantagemAgregada {
  readonly lider: string;
  readonly segundo: string;
  /** Diferença de votos estimados entre 1º e 2º colocado (nunca negativa). */
  readonly votos: number;
  /** A mesma diferença em pontos do eleitorado total. */
  readonly pontos: number;
  /** Semi-margem de erro agregada usada como critério: a maior entre os dois primeiros. */
  readonly margemPontos: number;
  /** Faixa de confiança da liderança pelo critério do domínio (`classificarConfianca`). */
  readonly nivel: NivelConfianca;
  /** true quando a vantagem cabe na margem — mesmo critério de `Agregado.empateTecnico`. */
  readonly empateTecnico: boolean;
}

/**
 * Vantagem do 1º sobre o 2º colocado da estimativa, em votos e em pontos, e
 * se ela cabe na margem de erro agregada. O critério NÃO é inventado aqui:
 * usa `classificarConfianca(vantagem, margem)` de `domain/aggregate.ts`, a
 * mesma função que decide `Agregado.empateTecnico` no resto do site — só com a
 * margem agregada do painel (propagada UF a UF) no lugar da margem de uma
 * pesquisa. Conservador de propósito: entre as duas semi-margens usa a maior.
 *
 * `null` quando não há dois candidatos para comparar (nada a dizer sobre
 * vantagem, em vez de um "empate" fabricado).
 */
export function calcularVantagemAgregada(
  candidatos: readonly CandidatoEstimado[],
  total: number,
  base: BaseDaEstimativa = 'eleitorado',
): VantagemAgregada | null {
  const primeiro = candidatos[0];
  const segundo = candidatos[1];
  if (!primeiro || !segundo) return null;

  const votos = Math.max(0, primeiro.votos - segundo.votos);
  // A vantagem tem de estar na MESMA unidade que a tela mostra ao lado dela.
  // Na base ancorada isso é ponto de voto VÁLIDO — a unidade do boletim do
  // TSE e dos 47,03% x 45,16% do 1º turno. Medi-la em pontos do eleitorado ali
  // encolheria a diferença em ~25% e faria a tela comparar com a margem de
  // erro na régua errada.
  const pontos =
    base === 'validos-1o-turno'
      ? Math.max(0, primeiro.pctDosVotosAtribuidos - segundo.pctDosVotosAtribuidos)
      : Math.max(0, primeiro.pctDoEleitorado - segundo.pctDoEleitorado);
  const margemPontos = Math.max(
    margemPontosDoCandidato(primeiro, total),
    margemPontosDoCandidato(segundo, total),
  );
  const nivel = classificarConfianca(pontos, margemPontos);

  return {
    lider: primeiro.candidato,
    segundo: segundo.candidato,
    votos,
    pontos,
    margemPontos,
    nivel,
    empateTecnico: nivel === 'empate',
  };
}

/** "Vantagem de Lula: 2,2 milhões de votos · 1,3 pt". */
export function rotuloVantagemAgregada(v: VantagemAgregada): string {
  return `Vantagem de ${v.lider}: ${formatarMilhoes(v.votos)} de votos · ${formatarPontos(v.pontos)}`;
}

/**
 * Veredito sobre a vantagem em relação à margem, nas 3 faixas de
 * `classificarConfianca`. É a frase que faltava na tela: sem ela, um empate
 * técnico desenhado como duas barras ordenadas é lido como liderança.
 */
export function rotuloVereditoMargem(v: VantagemAgregada): string {
  const margem = `±${formatarPontos(v.margemPontos)}`;
  switch (v.nivel) {
    case 'empate':
      return `dentro da margem de erro agregada (${margem}): empate técnico`;
    case 'acirrada':
      return `acima da margem de erro agregada (${margem}), mas abaixo do dobro dela: liderança apertada`;
    case 'folga':
      return `mais que o dobro da margem de erro agregada (${margem}): liderança com folga`;
  }
}

/** A frase completa da vantagem, para leitor de tela e para testes de conteúdo. */
export function textoVantagemAgregada(v: VantagemAgregada): string {
  return `${rotuloVantagemAgregada(v)} — ${rotuloVereditoMargem(v)}.`;
}

/**
 * Quantas vezes os votos não atribuídos cabem na vantagem entre os dois
 * primeiros — a proporção que explica por que o rodapé de "não atribuídos"
 * não é rodapé nenhum. `null` quando não há vantagem (empate exato ou um só
 * candidato), para não dividir por zero.
 */
export function razaoNaoAtribuidosSobreVantagem(
  naoAtribuidosVotos: number,
  vantagemVotos: number,
): number | null {
  if (!(vantagemVotos > 0)) return null;
  return naoAtribuidosVotos / vantagemVotos;
}

/* ========================= Cabeçalho ========================= */

function criarCabecalho(
  e: EstimativaVotos,
  titulo: string,
  recorte: string,
  origens: OrigensPresentes,
  comAsterisco: boolean,
  seletor: HTMLElement,
): HTMLElement {
  const parcela = e.eleitoradoTotal > 0 ? (e.eleitoradoComPesquisaEstadual / e.eleitoradoTotal) * 100 : 0;

  return criarEl('header', { className: 've-header' }, [
    criarEl('h1', { className: 've-title', texto: titulo, attrs: { id: 've-titulo' } }),
    // Antes do método e das estatísticas: os dois já dependem da base, e ler
    // "157,8 milhões" sem saber qual régua está ativa é ler o número errado.
    seletor,
    criarEl('p', {
      className: 've-method',
      texto:
        e.base === 'validos-1o-turno'
          ? 'Método em uma frase: cada UF contribui com os VOTOS VÁLIDOS que de fato registrou em 4 de outubro — ' +
            'abstenção, brancos e nulos já descontados pela apuração, não supostos — multiplicados pelo percentual ' +
            `da própria pesquisa presidencial estadual de ${recorte}, renormalizado para a base de válidos, ou pelo ` +
            'percentual do agregado nacional do mesmo recorte quando falta pesquisa estadual.'
          : `Método em uma frase: cada UF contribui com o seu eleitorado apto — o total de eleitores registrados no ` +
            'TSE, sem descontar abstenção (em 2022 o comparecimento nacional foi de cerca de 79%) — multiplicado pelo ' +
            `percentual da própria pesquisa presidencial estadual de ${recorte}, ou pelo percentual do agregado ` +
            'nacional do mesmo recorte quando falta pesquisa estadual.',
    }),
    // Só explica o complemento nacional quando ele existe de fato nesta tela
    // (no 2º turno nenhuma parcela vem dele), e só aponta para o "*" quando a
    // tabela por UF realmente traz algum.
    origens.complemento
      ? criarEl('p', {
          className: 've-meta',
          texto:
            'Candidatos que não aparecem na pesquisa estadual de uma UF (comum quando a pesquisa testa só os primeiros ' +
            'colocados) recebem o percentual do agregado nacional aplicado ao eleitorado dessa UF, para não zerar ' +
            'candidatos menores' +
            (comAsterisco ? ' — marcado com "*" na tabela por UF, ao final da página.' : '.'),
        })
      : null,
    criarEstatisticas(e, parcela),
  ]);
}

function criarEstatisticas(e: EstimativaVotos, parcela: number): HTMLElement {
  const item = (rotulo: string, valor: string): HTMLElement =>
    criarEl('div', { className: 've-stat' }, [
      criarEl('dt', { className: 've-stat__rotulo', texto: rotulo }),
      criarEl('dd', { className: 've-stat__valor', texto: valor }),
    ]);

  return criarEl('dl', { className: 've-stats' }, [
    e.base === 'validos-1o-turno'
      ? item('Votos válidos estimados', formatarInteiro(e.baseTotal))
      : null,
    item('Eleitorado total', formatarInteiro(e.eleitoradoTotal)),
    item('Coberto por pesquisa estadual', `${formatarPct(parcela)} · ${formatarInteiro(e.eleitoradoComPesquisaEstadual)}`),
    item('UFs com pesquisa estadual', `${e.ufsComPesquisa.length} de ${e.ufsComPesquisa.length + e.ufsSemPesquisa.length}`),
    item('UFs sem pesquisa estadual', String(e.ufsSemPesquisa.length)),
  ]);
}

/* ========================= Cartões por candidato ========================= */

function resolverEspectro(partido: string | null, partidos: readonly Partido[]): Espectro {
  return espectroDoPartido(partido, partidos);
}

function criarBadgePartido(partido: string | null, espectro: Espectro): HTMLElement {
  const rotulo = partido?.trim() || 'Sem partido';
  return criarEl(
    'span',
    {
      className: 've-badge-partido',
      texto: rotulo,
      attrs: {
        style: `background:${tokenSolidEspectro(espectro)}`,
        title: `${rotulo} — ${rotuloEspectro(espectro)}`,
      },
    },
    [criarEl('span', { className: 've-sr-only', texto: ` (${rotuloEspectro(espectro)})` })],
  );
}

export interface ItemLegenda {
  /** Classe extra do swatch (`null` = o swatch cheio, cor sólida do candidato). */
  readonly classe: string | null;
  readonly texto: string;
}

/**
 * Itens da legenda do gráfico — só o que a tela desenha. As 3 origens de voto
 * só entram quando a barra é realmente empilhada (2+ origens presentes); com
 * uma única origem, a cor não codifica nada e a legenda mentiria sobre a
 * chave visual. A faixa de incerteza e a marca de 50% entram quando
 * desenhadas.
 */
export function montarItensLegenda(
  origens: OrigensPresentes,
  comFaixa: boolean,
  metadeEleitorado: number | null,
  base: BaseDaEstimativa = 'eleitorado',
): ItemLegenda[] {
  const itens: ItemLegenda[] = [];
  if (quantidadeDeOrigens(origens) > 1) {
    if (origens.estadual) itens.push({ classe: null, texto: 'Votos de UFs com pesquisa estadual' });
    if (origens.complemento) {
      itens.push({
        classe: 've-legend-swatch--complemento',
        texto: 'Complemento nacional em UFs com pesquisa',
      });
    }
    if (origens.semPesquisa) {
      itens.push({ classe: 've-legend-swatch--sem-pesquisa', texto: 'Votos de UFs sem pesquisa estadual' });
    }
  }
  if (comFaixa) {
    itens.push({ classe: 've-legend-swatch--faixa', texto: 'Faixa = margem de erro agregada' });
  }
  if (metadeEleitorado != null) {
    itens.push({
      classe: 've-legend-swatch--referencia',
      texto:
        base === 'validos-1o-turno'
          ? `Linha tracejada = 50% dos votos válidos — a marca da vitória (${formatarMilhoes(
              metadeEleitorado,
            )} de votos)`
          : `Linha tracejada = 50% do eleitorado (${formatarMilhoes(metadeEleitorado)} de votos)`,
    });
  }
  return itens;
}

function criarLegendaBarra(itens: readonly ItemLegenda[]): HTMLElement | null {
  if (itens.length === 0) return null;
  return criarEl(
    'p',
    { className: 've-bar-legend' },
    itens.map((item) =>
      criarEl('span', { className: 've-bar-legend__item' }, [
        criarEl('span', { className: item.classe ? `ve-legend-swatch ${item.classe}` : 've-legend-swatch' }),
        item.texto,
      ]),
    ),
  );
}

/** Constrói os 3 `<span>` de segmento (estadual/complemento/sem-pesquisa) de um candidato, sem o track/wrapper. */
function criarSegmentosBarra(candidato: CandidatoEstimado, espectro: Espectro): HTMLElement[] {
  const seg = montarSegmentosBarra(candidato);
  const corFill = tokenFillEspectro(espectro);

  const segmento = (pct: number, classe: string): HTMLElement | null => {
    if (pct <= 0) return null;
    return criarEl('span', {
      className: `ve-bar-seg ${classe}`,
      attrs: { style: `width:${pct}%; --ve-cor-seg:${corFill};` },
    });
  };

  return [
    segmento(seg.pctEstadual, 've-bar-seg--estadual'),
    segmento(seg.pctComplemento, 've-bar-seg--complemento'),
    segmento(seg.pctSemPesquisa, 've-bar-seg--sem-pesquisa'),
  ].filter((el): el is HTMLElement => el !== null);
}

/* ============ Gráfico de comparação: barras proporcionais + faixa de incerteza ============ */

export interface EscalaBarraComparacao {
  /** % (0..100, relativo à maior `votosMax` entre os candidatos) do comprimento da barra sólida (`votos`). */
  readonly pctBarra: number;
  /** % (0..100) da posição do extremo inferior da faixa de incerteza (`votosMin`). */
  readonly pctMin: number;
  /** % (0..100) da posição do extremo superior da faixa de incerteza (`votosMax`). */
  readonly pctMax: number;
}

/**
 * Calcula, para uma escala única compartilhada por todos os candidatos
 * (0 até `maiorVotosMax`), as posições (0..100%) do comprimento da barra e
 * dos dois extremos da faixa de incerteza. `maiorVotosMax` deve ser o maior
 * `votosMax` entre todos os candidatos exibidos, para que a faixa de
 * ninguém extrapole a escala.
 */
export function calcularEscalaBarraComparacao(
  candidato: Pick<CandidatoEstimado, 'votos' | 'votosMin' | 'votosMax'>,
  maiorVotosMax: number,
): EscalaBarraComparacao {
  if (!(maiorVotosMax > 0)) {
    return { pctBarra: 0, pctMin: 0, pctMax: 0 };
  }
  return {
    pctBarra: (candidato.votos / maiorVotosMax) * 100,
    pctMin: (candidato.votosMin / maiorVotosMax) * 100,
    pctMax: (candidato.votosMax / maiorVotosMax) * 100,
  };
}

/**
 * Folga da escala para a marca de 50% do eleitorado não ficar colada na borda
 * direita da pista. Só afeta a escala do desenho — nenhum número exibido.
 */
const FOLGA_ESCALA_REFERENCIA = 1.04;

/**
 * Até quanto além da maior faixa de incerteza a marca de 50% pode ficar antes
 * de a tela desistir dela. A referência só ganha o seu lugar quando alguém
 * está perto de alcançá-la: no 2º turno a faixa do líder chega a 76,6 milhões
 * contra 78,9 milhões de metade do eleitorado (3% de distância) e a marca
 * entra; no 1º turno, com o líder na casa dos 40% e vários candidatos
 * pequenos, ela ficaria 19% além da escala e comprimiria todas as barras —
 * então não é desenhada, e a escala do 1º turno segue sendo a maior faixa de
 * incerteza, como antes.
 */
const LIMITE_ESCALA_REFERENCIA = 1.1;

export interface EscalaGrafico {
  /** Votos que correspondem a 100% da pista, compartilhados por todas as linhas. */
  readonly max: number;
  /** Votos correspondentes a 50% do eleitorado total. */
  readonly metadeEleitorado: number;
  /** Posição (0..100) da marca de 50% do eleitorado, ou `null` quando ela não cabe na escala. */
  readonly pctMetadeEleitorado: number | null;
}

/**
 * Escala compartilhada do gráfico. Além de acomodar a maior faixa de
 * incerteza, tenta acomodar a marca de 50% do eleitorado — a referência que
 * mostra que, com 8,7% de votos não atribuídos, nenhum dos dois candidatos do
 * 2º turno a alcança.
 */
export function calcularEscalaGrafico(
  candidatos: readonly Pick<CandidatoEstimado, 'votosMax'>[],
  eleitoradoTotal: number,
): EscalaGrafico {
  const maiorVotosMax = candidatos.reduce((max, c) => Math.max(max, c.votosMax), 0);
  const metadeEleitorado = Math.max(0, eleitoradoTotal) / 2;

  const cabe =
    metadeEleitorado > 0 &&
    maiorVotosMax > 0 &&
    metadeEleitorado <= maiorVotosMax * LIMITE_ESCALA_REFERENCIA;
  if (!cabe) {
    return { max: maiorVotosMax, metadeEleitorado, pctMetadeEleitorado: null };
  }

  const max = Math.max(maiorVotosMax, metadeEleitorado * FOLGA_ESCALA_REFERENCIA);
  return { max, metadeEleitorado, pctMetadeEleitorado: (metadeEleitorado / max) * 100 };
}

function criarLinhaComparacaoBarra(
  candidato: CandidatoEstimado,
  partidos: readonly Partido[],
  escalaGrafico: EscalaGrafico,
  base: BaseDaEstimativa,
): HTMLElement {
  const espectro = resolverEspectro(candidato.partido, partidos);
  const seg = montarSegmentosBarra(candidato);
  const escala = calcularEscalaBarraComparacao(candidato, escalaGrafico.max);

  const referenciaAria =
    escalaGrafico.pctMetadeEleitorado == null
      ? ''
      : ` Referência de 50% ${
          base === 'validos-1o-turno' ? 'dos votos válidos' : 'do eleitorado'
        }: ${formatarMilhoes(escalaGrafico.metadeEleitorado)} de votos.`;

  const rotuloAria =
    `${candidato.candidato}: ${formatarMilhoes(candidato.votos)} de votos estimados, ` +
    `${formatarPct(
      base === 'validos-1o-turno' ? candidato.pctDosVotosAtribuidos : candidato.pctDoEleitorado,
    )} ${base === 'validos-1o-turno' ? 'dos votos válidos' : 'do eleitorado'}. ` +
    `Faixa de incerteza (margem de erro agregada): ${formatarMilhoes(candidato.votosMin)} a ` +
    `${formatarMilhoes(candidato.votosMax)}. Composição: ${formatarPct(seg.pctEstadual)} de UFs com pesquisa ` +
    `estadual, ${formatarPct(seg.pctComplemento)} de complemento nacional em UFs com pesquisa, ` +
    `${formatarPct(seg.pctSemPesquisa)} de UFs sem pesquisa estadual.${referenciaAria}`;

  const barra = criarEl('div', {
    className: 've-chart-bar',
    attrs: { style: `width:${escala.pctBarra}%` },
  });
  if (candidato.votos > 0) {
    barra.append(...criarSegmentosBarra(candidato, espectro));
  } else {
    barra.classList.add('ve-chart-bar--sem-dados');
  }

  const whisker = criarEl('div', {
    className: 've-chart-whisker',
    attrs: { style: `left:${escala.pctMin}%; width:${Math.max(0, escala.pctMax - escala.pctMin)}%` },
  });

  const referencia =
    escalaGrafico.pctMetadeEleitorado == null
      ? null
      : criarEl('div', {
          className: 've-chart-ref',
          attrs: { style: `left:${escalaGrafico.pctMetadeEleitorado}%`, 'aria-hidden': 'true' },
        });

  const track = criarEl(
    'div',
    { className: 've-chart-track', attrs: { role: 'img', 'aria-label': rotuloAria } },
    [barra, whisker, referencia],
  );

  const valor = criarEl('span', {
    className: 've-chart-value',
    // O percentual VISÍVEL tem de ser o mesmo que o aria-label anuncia e o
    // mesmo em que a vantagem é medida: na base ancorada, voto válido.
    texto: `${formatarMilhoes(candidato.votos)} · ${formatarPct(
      base === 'validos-1o-turno' ? candidato.pctDosVotosAtribuidos : candidato.pctDoEleitorado,
    )}`,
  });

  return criarEl('div', { className: 've-chart-row' }, [
    criarEl('div', { className: 've-chart-row__head' }, [
      criarBadgePartido(candidato.partido, espectro),
      criarEl('span', { className: 've-chart-row__nome', texto: candidato.candidato, attrs: { title: candidato.candidato } }),
    ]),
    criarEl('div', { className: 've-chart-row__bar-line' }, [track, valor]),
  ]);
}

/**
 * A linha de vantagem, logo abaixo das barras e no mesmo cartão: diz de quanto
 * é a diferença (votos e pontos) e se ela cabe na margem. Sem ela, a
 * ordenação das barras é lida como liderança mesmo quando a matemática da
 * própria página diz empate técnico.
 */
function criarLinhaVantagem(v: VantagemAgregada): HTMLElement {
  const classeVeredito = v.empateTecnico
    ? 've-chart-delta__veredito ve-chart-delta__veredito--empate'
    : 've-chart-delta__veredito';

  return criarEl('div', { className: 've-chart-delta' }, [
    criarEl('p', { className: 've-chart-delta__linha' }, [
      criarEl('strong', { className: 've-chart-delta__valor', texto: rotuloVantagemAgregada(v) }),
      criarEl('span', { texto: ' — ', attrs: { 'aria-hidden': 'true' } }),
      criarEl('span', { className: classeVeredito, texto: `${rotuloVereditoMargem(v)}.` }),
    ]),
    criarEl('p', {
      className: 've-chart-delta__nota',
      texto:
        'A margem agregada é a soma das margens amostrais declaradas de cada UF, não um intervalo de ' +
        'confiança: somar em vez de propagar em quadratura é o pior caso para o erro de amostragem. Mas ' +
        'ela não cobre o que provavelmente pesa mais aqui — diferença sistemática entre institutos (um só ' +
        'responde pela maior parte das pesquisas usadas), pesquisas antigas carregadas a peso cheio, UFs ' +
        'que rodam com uma pesquisa só, e o fato de os percentuais serem aplicados sobre o eleitorado ' +
        'apto sem nenhum ajuste de comparecimento. Não dá para dizer se a faixa é larga ou estreita ' +
        'demais. Vantagem e margem saem dos valores exatos (não arredondados) e podem divergir em até ' +
        '0,1 pt da subtração direta dos dois rótulos acima, já arredondados para exibição.',
    }),
  ]);
}

function criarSecaoComparacaoBarras(
  e: EstimativaVotos,
  partidos: readonly Partido[],
  vantagem: VantagemAgregada | null,
  origens: OrigensPresentes,
): HTMLElement {
  const candidatos = e.candidatos; // já ordenados por votos desc.
  const escala = calcularEscalaGrafico(candidatos, e.baseTotal);

  const chart = criarEl('div', { className: 've-chart' }, [
    ...candidatos.map((c) => criarLinhaComparacaoBarra(c, partidos, escala, e.base)),
    vantagem ? criarLinhaVantagem(vantagem) : null,
  ]);

  return criarEl('section', { attrs: { 'aria-labelledby': 've-chart-heading' } }, [
    criarEl('h2', {
      className: 've-section-title',
      texto: 'Comparação entre candidatos',
      attrs: { id: 've-chart-heading' },
    }),
    criarLegendaBarra(
      montarItensLegenda(
        origens,
        true,
        escala.pctMetadeEleitorado == null ? null : escala.metadeEleitorado,
        e.base,
      ),
    ),
    chart,
  ]);
}

/* ============ Comparação: agregação estadual × média nacional ============ */

function criarSecaoComparacao(e: EstimativaVotos): HTMLElement {
  const linhas = [...e.comparacaoNacional]
    .sort((a, b) => b.pctEstimado - a.pctEstimado)
    .map((c) => {
      const diferenca = c.pctEstimado - c.pctNacional;
      return criarEl('tr', {}, [
        criarEl('td', { texto: c.candidato, attrs: { 'data-rotulo': 'Candidato' } }),
        criarEl('td', {
          className: 've-col-num',
          texto: formatarPct(c.pctEstimado),
          attrs: { 'data-rotulo': '% estimado por estados' },
        }),
        criarEl('td', {
          className: 've-col-num',
          texto: formatarPct(c.pctNacional),
          attrs: { 'data-rotulo': '% média nacional' },
        }),
        criarEl('td', {
          className: 've-col-num',
          texto: formatarVantagem(diferenca),
          attrs: { 'data-rotulo': 'Diferença' },
        }),
      ]);
    });

  const wrap = criarEl('div', { className: 've-table-wrap ve-stack-table-wrap' }, [
    criarEl('table', { className: 've-table' }, [
      criarEl('thead', {}, [
        criarEl('tr', {}, [
          criarEl('th', { texto: 'Candidato', attrs: { scope: 'col' } }),
          criarEl('th', { className: 've-col-num', texto: '% estimado por estados', attrs: { scope: 'col' } }),
          criarEl('th', { className: 've-col-num', texto: '% média nacional', attrs: { scope: 'col' } }),
          criarEl('th', { className: 've-col-num', texto: 'Diferença', attrs: { scope: 'col' } }),
        ]),
      ]),
      criarEl('tbody', {}, linhas),
    ]),
  ]);

  return criarEl('section', { attrs: { 'aria-labelledby': 've-compare-heading' } }, [
    criarEl('h2', {
      className: 've-section-title',
      texto: 'Agregação estadual × média nacional',
      attrs: { id: 've-compare-heading' },
    }),
    wrap,
    criarEl('p', {
      className: 've-meta',
      texto:
        'Diferença calculada sobre os valores exatos (não arredondados) de cada percentual — por isso pode ' +
        'divergir em até 0,1 pt da subtração direta das duas colunas ao lado, já arredondadas para exibição.',
    }),
  ]);
}

/* ========================= Não atribuídos ========================= */

/** Só os campos de `EstimativaVotos.naoAtribuidos` que o bloco precisa. */
export interface NaoAtribuidos {
  readonly votos: number;
  readonly pct: number;
  readonly declarados: { readonly votos: number; readonly pct: number };
  readonly semLinhaPublicada: { readonly votos: number; readonly pct: number };
}

/**
 * Frase do salto dos não atribuídos entre dois recortes (o 1º turno como
 * referência do 2º). Sempre com os números reais dos dois recortes; `null`
 * quando não há recorte anterior calculável.
 *
 * Só descreve o tamanho da diferença. **Não** explica a causa: dois terços do
 * resíduo do 2º turno são percentual que fonte nenhuma publicou, então
 * atribuir o salto ao eleitor que "não tem para onde ir" seria inventar um
 * achado político a partir de lacuna de divulgação.
 */
export function textoSaltoNaoAtribuidos(
  atual: NaoAtribuidos,
  anterior: NaoAtribuidos | null,
  rotuloAnterior: string,
): string | null {
  if (anterior === null) return null;
  const salto =
    anterior.votos > 0
      ? ` — agora são ${formatarNumeroPt(atual.votos / anterior.votos)} vezes esse volume`
      : '';
  return `No ${rotuloAnterior} eram ${formatarMilhoes(anterior.votos)} (${formatarPct(anterior.pct)})${salto}.`;
}

/**
 * Quebra do resíduo entre a linha que as pesquisas publicaram e a parcela que
 * nenhuma linha cobre. É a informação que impede a leitura errada do número
 * grande: no 2º turno a maior parte não é voto em branco, é dado que a fonte
 * não divulgou. `null` quando tudo está coberto por linha publicada.
 */
export function textoQuebraNaoAtribuidos(na: NaoAtribuidos): string | null {
  if (na.semLinhaPublicada.votos <= 0) return null;
  const fatia = na.votos > 0 ? (na.semLinhaPublicada.votos / na.votos) * 100 : 0;
  return (
    `Destes, ${formatarMilhoes(na.declarados.votos)} (${formatarPct(na.declarados.pct)} do eleitorado) ` +
    'são a linha de brancos, nulos e indecisos que as pesquisas publicaram. Os outros ' +
    `${formatarMilhoes(na.semLinhaPublicada.votos)} (${formatarPct(na.semLinhaPublicada.pct)}) são ` +
    `percentual que nenhuma fonte divulgou — ${formatarPct(fatia)} do total desta caixa: a matéria deu só ` +
    'os primeiros nomes. Não é voto em branco, é lacuna de divulgação, e não deve ser lida como escolha ' +
    'do eleitor.'
  );
}

function criarBlocoNaoAtribuidos(
  e: EstimativaVotos,
  vantagem: VantagemAgregada | null,
  turno: Turno,
  anterior: NaoAtribuidos | null,
): HTMLElement {
  // O rótulo não enumera a composição: no 2º turno a maior parte do resíduo é
  // percentual não divulgado, não voto em branco. A quebra abaixo é que diz.
  const rotulo = 'Não atribuídos a nenhum dos candidatos';

  const razao = vantagem ? razaoNaoAtribuidosSobreVantagem(e.naoAtribuidos.votos, vantagem.votos) : null;
  // A razão só diz alguma coisa quando o resíduo supera a vantagem ("6,2 vezes"
  // pesa; "0,5 vezes" é ruído impresso com ar de argumento).
  const comparacao =
    razao != null && razao >= 1 && vantagem
      ? `${formatarNumeroPt(razao)} vezes a vantagem entre os dois primeiros ` +
        `(${formatarMilhoes(vantagem.votos)} de votos).`
      : null;

  const salto = textoSaltoNaoAtribuidos(e.naoAtribuidos, anterior, rotuloTurno(1));
  const quebra = textoQuebraNaoAtribuidos(e.naoAtribuidos);

  return criarEl('section', { className: 've-nao-atribuidos', attrs: { 'aria-labelledby': 've-na-heading' } }, [
    criarEl('h2', { className: 've-nao-atribuidos__rotulo', texto: rotulo, attrs: { id: 've-na-heading' } }),
    criarEl('p', {
      className: 've-nao-atribuidos__valor',
      texto: `${formatarMilhoes(e.naoAtribuidos.votos)} · ${formatarPct(e.naoAtribuidos.pct)} do eleitorado`,
    }),
    quebra ? criarEl('p', { className: 've-nao-atribuidos__quebra', texto: quebra }) : null,
    comparacao ? criarEl('p', { className: 've-nao-atribuidos__nota', texto: comparacao }) : null,
    salto ? criarEl('p', { className: 've-nao-atribuidos__nota', texto: salto }) : null,
    criarEl('p', {
      className: 've-nao-atribuidos__rodape',
      texto:
        'Não é estimativa de abstenção: nenhum ajuste de comparecimento foi feito em lugar nenhum desta ' +
        'página. Os percentuais das pesquisas são aplicados sobre o eleitorado apto, então nem esta caixa ' +
        'mede quem deixará de votar — a abstenção de 2022 foi de cerca de 21%, muito acima dela — nem os ' +
        'percentuais dos candidatos são fatias do comparecimento (ver "Método em uma frase" no topo).',
    }),
  ]);
}

/* ========================= Tabela por UF ========================= */

interface CandidatoNaUf {
  readonly nome: string;
  readonly votos: number;
  readonly origem: OrigemVotoCandidato;
}

function candidatosOrdenadosDaUf(uf: UfOrigemVotos): CandidatoNaUf[] {
  return Object.entries(uf.votosPorCandidato)
    .map(([nome, v]) => ({ nome, votos: v.votos, origem: v.origem }))
    .sort((a, b) => b.votos - a.votos);
}

/**
 * true quando alguma célula VISÍVEL da tabela (1º ou 2º colocado de alguma UF)
 * leva o marcador "*" de parcela suprida pelo agregado nacional. O complemento
 * nacional pode existir na estimativa sem aparecer com "*" na tabela — é o que
 * acontece no 1º turno, onde os candidatos complementados ficam todos fora dos
 * dois primeiros de cada UF, e no 2º turno, onde ele não existe. Em nenhum dos
 * dois casos a página deve trazer o rodapé explicando um asterisco que não
 * está lá.
 */
export function temAsteriscoNaTabela(porUf: readonly UfOrigemVotos[]): boolean {
  return porUf.some((uf) =>
    candidatosOrdenadosDaUf(uf)
      .slice(0, 2)
      .some((c) => c.origem === 'complemento-nacional'),
  );
}

/**
 * true quando alguma UF tem um 3º nome com voto estimado — a única situação em
 * que a coluna "Outros" carrega informação. No 2º turno só existem dois nomes
 * em toda UF e a coluna seria 27 linhas de "—", ocupando espaço que a margem
 * de erro por UF usa melhor.
 */
export function temColunaOutros(porUf: readonly UfOrigemVotos[]): boolean {
  return porUf.some((uf) =>
    candidatosOrdenadosDaUf(uf)
      .slice(2)
      .some((c) => c.votos > 0),
  );
}

/** Dado de recência/precisão de uma UF, vindo do agregado estadual daquele recorte. */
interface DadoAgregadoUf {
  /** Margem de erro de referência da UF (pontos), ou null quando nenhuma pesquisa usada declarou margem. */
  readonly margemPct: number | null;
  /** Data (ISO) da pesquisa mais recente usada nessa UF, ou null quando desconhecida. */
  readonly dataIso: string | null;
}

/**
 * Margem de erro e data da pesquisa de cada UF, do MESMO recorte da
 * estimativa. `EstimativaVotos` não carrega esses dois campos por UF, e eles
 * são justamente o que falta na tabela: a data do selo "fora da janela" (que
 * no mobile fica a telas de distância do aviso do topo) e a precisão de cada
 * pesquisa estadual. Falha fechada: qualquer erro devolve mapa vazio e a
 * tabela simplesmente omite as colunas/dados, sem inventar nada.
 */
function coletarDadosAgregadosPorUf(casos: CasosDeUso, turno: Turno): Map<string, DadoAgregadoUf> {
  const mapa = new Map<string, DadoAgregadoUf>();
  let ufs: ReturnType<CasosDeUso['getPresidentialByState']>['ufs'];
  try {
    ufs = casos.getPresidentialByState(turno).ufs;
  } catch {
    return mapa;
  }

  for (const item of ufs) {
    const agregado = item.agregado;
    if (agregado == null) continue;
    // Só mostra margem quando ela vem declarada em alguma pesquisa usada —
    // `margemReferencia` cai num padrão do domínio quando nenhuma declara, e
    // exibi-lo seria apresentar um default como dado da pesquisa.
    const declarada = agregado.pesquisasUsadas.some((p) => p.margem != null);
    const p = item.ultimaPesquisa;
    mapa.set(item.uf, {
      margemPct: declarada ? agregado.margemReferencia : null,
      dataIso: p ? (p.dataFim ?? p.publicadoEm ?? p.dataInicio ?? null) : null,
    });
  }
  return mapa;
}

function criarBadgeOrigem(origem: 'estadual' | 'nacional'): HTMLElement {
  const rotulo = origem === 'estadual' ? 'Estadual' : 'Nacional';
  return criarEl('span', { className: `ve-badge-origem ve-badge-origem--${origem}`, texto: rotulo });
}

/**
 * Selo de recência com a DATA dentro dele: no mobile a tabela fica a várias
 * telas do aviso do topo, e `title` não abre no toque — sem a data no próprio
 * selo, "fora da janela" não diz de quando é o número.
 */
function criarBadgeRecencia(dataIso: string | null): HTMLElement {
  const data = dataIso ? formatarData(dataIso) : '—';
  const temData = data !== '—';
  return criarEl('span', {
    className: 've-badge-recencia',
    texto: temData ? `fora da janela · ${data}` : 'fora da janela',
    attrs: {
      title: temData
        ? `Pesquisa de ${data}: nenhuma deste recorte nos últimos ${JANELA_DIAS_PADRAO} dias — usou a mais recente disponível.`
        : `Sem pesquisa deste recorte nos últimos ${JANELA_DIAS_PADRAO} dias: usou a mais recente disponível.`,
    },
  });
}

/** Célula com nome + votos de um candidato na UF; marca com "*" quando a parcela veio do complemento nacional. */
function celulaCandidatoUf(c: CandidatoNaUf): HTMLElement {
  const marcador = c.origem === 'complemento-nacional' ? ' *' : '';
  return criarEl('span', {}, [
    `${c.nome}${marcador} `,
    criarEl('span', { className: 've-uf-candidato__votos', texto: formatarInteiro(c.votos) }),
  ]);
}

interface ColunasUf {
  readonly margem: boolean;
  readonly outros: boolean;
}

/**
 * A UF é empate técnico quando a diferença entre os dois primeiros, medida em
 * pontos do eleitorado da UF, cabe na margem declarada daquele recorte — o
 * mesmo `classificarConfianca` que a página usa em todo lugar. `null` quando
 * falta margem ou segundo colocado, para não afirmar nada sem base.
 *
 * Sem isso a tabela resolvia um vencedor exatamente onde a evidência não
 * sustenta: Minas Gerais no 2º turno, o segundo maior colégio do país,
 * aparecia com 270 mil votos de diferença (1,7 pt) contra margem de ±2,3 pt,
 * sem marca nenhuma, na mesma página que declara empate técnico nacional.
 */
export function ufEmEmpateTecnico(
  votos1: number | undefined,
  votos2: number | undefined,
  eleitores: number,
  margemPct: number | null | undefined,
): boolean | null {
  if (votos1 == null || votos2 == null || margemPct == null || !(eleitores > 0)) return null;
  const pontos = Math.abs(votos1 - votos2) / eleitores * 100;
  return classificarConfianca(pontos, margemPct) === 'empate';
}

function criarLinhaUf(uf: UfOrigemVotos, dado: DadoAgregadoUf | undefined, colunas: ColunasUf): HTMLElement {
  const candidatos = candidatosOrdenadosDaUf(uf);
  const [c1, c2] = candidatos;
  const outros = candidatos.slice(2);
  const somaOutros = outros.reduce((soma, c) => soma + c.votos, 0);
  const empate = ufEmEmpateTecnico(c1?.votos, c2?.votos, uf.eleitores, dado?.margemPct);

  return criarEl('tr', {}, [
    criarEl('td', { texto: uf.uf, attrs: { 'data-rotulo': 'UF' } }),
    criarEl('td', { className: 've-col-num', texto: formatarInteiro(uf.eleitores), attrs: { 'data-rotulo': 'Eleitores' } }),
    criarEl('td', { attrs: { 'data-rotulo': 'Origem' } }, [
      criarBadgeOrigem(uf.origem),
      uf.foraDaJanela ? criarBadgeRecencia(dado?.dataIso ?? null) : null,
    ]),
    colunas.margem
      ? criarEl('td', { className: 've-col-num', attrs: { 'data-rotulo': 'Margem' } }, [
          dado?.margemPct != null
            ? `±${formatarPontos(dado.margemPct)}`
            : criarEl('span', { className: 've-meta-inline', texto: '—' }),
        ])
      : null,
    criarEl('td', { attrs: { 'data-rotulo': '1º colocado' } }, [
      c1 ? celulaCandidatoUf(c1) : '—',
      empate
        ? criarEl('span', {
            className: 've-uf-empate',
            texto: 'empate técnico',
            attrs: {
              title:
                'A diferença entre os dois cabe na margem de erro declarada para esta UF — a ordem ' +
                'entre eles não é distinguível.',
            },
          })
        : null,
    ]),
    criarEl('td', { attrs: { 'data-rotulo': '2º colocado' } }, [c2 ? celulaCandidatoUf(c2) : '—']),
    colunas.outros
      ? criarEl('td', { attrs: { 'data-rotulo': 'Outros' } }, [
          outros.length > 0
            ? `${outros.length} candidato${outros.length > 1 ? 's' : ''} · ${formatarInteiro(somaOutros)}`
            : criarEl('span', { className: 've-meta-inline', texto: '—' }),
        ])
      : null,
  ]);
}

function criarSecaoPorUf(
  e: EstimativaVotos,
  comAsterisco: boolean,
  dadosPorUf: Map<string, DadoAgregadoUf>,
): HTMLElement {
  const colunas: ColunasUf = {
    margem: [...dadosPorUf.values()].some((d) => d.margemPct != null),
    outros: temColunaOutros(e.porUf),
  };

  const cabecalhos = [
    'UF',
    'Eleitores',
    'Origem',
    ...(colunas.margem ? ['Margem'] : []),
    '1º colocado',
    '2º colocado',
    ...(colunas.outros ? ['Outros'] : []),
  ];

  const linhas = [...e.porUf]
    .sort((a, b) => b.eleitores - a.eleitores)
    .map((uf) => criarLinhaUf(uf, dadosPorUf.get(uf.uf), colunas));

  const wrap = criarEl('div', { className: 've-table-wrap ve-stack-table-wrap ve-uf-table-wrap' }, [
    criarEl('table', { className: 've-table' }, [
      criarEl('thead', {}, [
        criarEl(
          'tr',
          {},
          cabecalhos.map((texto) => criarEl('th', { texto, attrs: { scope: 'col' } })),
        ),
      ]),
      criarEl('tbody', {}, linhas),
    ]),
  ]);

  const ufsForaDaJanela = [...e.ufsForaDaJanela].map((uf) => {
    const data = dadosPorUf.get(uf)?.dataIso;
    const formatada = data ? formatarData(data) : '—';
    return formatada === '—' ? uf : `${uf} (pesquisa de ${formatada})`;
  });

  return criarEl('section', { attrs: { 'aria-labelledby': 've-uf-heading' } }, [
    criarEl('h2', { className: 've-section-title', texto: 'Detalhe por UF', attrs: { id: 've-uf-heading' } }),
    // O rodapé do "*" só existe quando a tabela tem algum "*".
    comAsterisco
      ? criarEl('p', {
          className: 've-meta',
          texto: '* candidato ausente da pesquisa estadual dessa UF — parcela suprida pelo percentual do agregado nacional.',
        })
      : null,
    colunas.margem
      ? criarEl('p', {
          className: 've-meta',
          texto:
            '"Margem" é a margem de erro declarada das pesquisas usadas naquela UF (média ponderada quando há mais ' +
            'de uma) — é dela que sai a faixa de incerteza do gráfico no topo da página.',
        })
      : null,
    ufsForaDaJanela.length > 0
      ? criarEl('p', {
          className: 've-meta',
          texto:
            `"Fora da janela" em ${listaEmPortugues(ufsForaDaJanela)}: ` +
            `${pluralizar(ufsForaDaJanela.length, 'a UF tem', 'as UFs têm')} pesquisa própria deste recorte, ` +
            `mas nenhuma nos últimos ${JANELA_DIAS_PADRAO} dias — vale a mais recente que existe, sem nada estimado no lugar.`,
        })
      : null,
    wrap,
  ]);
}

/* ================= Recorte de referência (1º turno) ================= */

/**
 * Não atribuídos de outro turno, para a comparação do bloco de não
 * atribuídos. Falha fechada: sem estimativa daquele turno, devolve `null` e a
 * frase de comparação simplesmente não aparece.
 */
function estimativaDeReferencia(casos: CasosDeUso, turno: Turno): NaoAtribuidos | null {
  try {
    const estimativa = casos.getVoteEstimate(turno);
    return estimativa ? estimativa.naoAtribuidos : null;
  } catch {
    return null;
  }
}
