import '../styles/polls-database.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import { dataReferencia, type Pesquisa } from '../../../../domain/poll.js';
import type { Cargo } from '../../../../domain/race.js';
import { espectroDoPartido } from '../../../../domain/spectrum.js';
import {
  criarBadgePartido,
  criarEl,
  criarLinkFonte,
  formatarNumero,
  formatarPct,
  formatarPeriodo,
  formatarData,
} from './_shared.js';

/**
 * Base de pesquisas — tabela completa de todas as pesquisas conhecidas
 * (qualquer cargo/turno/UF), com filtros, ordenação e exportação CSV.
 * Vira lista de cards em ≤640px, mesmo princípio das tabelas de
 * presidente/partidos (ver docs/ux-spec.md e styles/views.css) — aqui com
 * um conjunto de estilos próprio, prefixo `db-`, em styles/polls-database.css.
 */

/** Número de colunas do `<thead>` de `criarTabela` — usado como `colspan` da linha de detalhes expandida. */
const NUM_COLUNAS_TABELA = 14;

const ROTULOS_CARGO: Readonly<Record<Cargo, string>> = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senador',
};

type FiltroCargo = 'todos' | Cargo;
type FiltroTurno = 'todos' | 1 | 2;
type CampoOrdenacao = 'data' | 'instituto' | 'uf';
type DirecaoOrdenacao = 'asc' | 'desc';

interface Filtros {
  cargo: FiltroCargo;
  uf: string; // 'todos' ou UF
  instituto: string; // 'todos' ou nome exato
  turno: FiltroTurno;
  busca: string;
  somenteComRegistro: boolean;
}

interface Ordenacao {
  campo: CampoOrdenacao;
  direcao: DirecaoOrdenacao;
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function pesquisaCasaComBusca(p: Pesquisa, buscaNormalizada: string): boolean {
  if (!buscaNormalizada) return true;
  if (semAcento(p.instituto).includes(buscaNormalizada)) return true;
  if (!p.registroTSE.naoRegistrada && semAcento(p.registroTSE.valor).includes(buscaNormalizada)) return true;
  return p.resultados.some((r) => semAcento(r.candidato).includes(buscaNormalizada));
}

function aplicarFiltros(pesquisas: readonly Pesquisa[], filtros: Filtros): Pesquisa[] {
  const buscaNormalizada = semAcento(filtros.busca.trim());
  return pesquisas.filter((p) => {
    if (filtros.cargo !== 'todos' && p.disputa.cargo !== filtros.cargo) return false;
    if (filtros.uf !== 'todos' && p.disputa.uf !== filtros.uf) return false;
    if (filtros.instituto !== 'todos' && p.instituto !== filtros.instituto) return false;
    if (filtros.turno !== 'todos' && p.disputa.turno !== filtros.turno) return false;
    if (filtros.somenteComRegistro && p.registroTSE.naoRegistrada) return false;
    if (!pesquisaCasaComBusca(p, buscaNormalizada)) return false;
    return true;
  });
}

function ordenarPesquisas(pesquisas: readonly Pesquisa[], ordenacao: Ordenacao): Pesquisa[] {
  const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
  return [...pesquisas].sort((a, b) => {
    switch (ordenacao.campo) {
      case 'instituto':
        return sinal * a.instituto.localeCompare(b.instituto, 'pt-BR');
      case 'uf':
        return sinal * a.disputa.uf.localeCompare(b.disputa.uf, 'pt-BR');
      case 'data':
      default:
        return sinal * dataReferencia(a).localeCompare(dataReferencia(b));
    }
  });
}

function contarPor<T extends string>(pesquisas: readonly Pesquisa[], chave: (p: Pesquisa) => T): Map<T, number> {
  const mapa = new Map<T, number>();
  for (const p of pesquisas) {
    const v = chave(p);
    mapa.set(v, (mapa.get(v) ?? 0) + 1);
  }
  return mapa;
}

interface OpcoesCruzadas {
  readonly contagemInstituto: ReadonlyMap<string, number>;
  readonly contagemUf: ReadonlyMap<string, number>;
}

/**
 * Filtros cruzados: as opções de Instituto refletem Cargo/UF/Turno/busca já
 * escolhidos (e vice-versa para UF) — cada `<select>` é recalculado a
 * partir de todos os *outros* filtros ativos, nunca do próprio. Se a opção
 * hoje selecionada deixou de ter qualquer pesquisa nesse cruzamento (ex.:
 * trocou a UF e o instituto escolhido não pesquisou lá), o filtro volta
 * para "todos" em vez de deixar `filtros` e o `<select>` dessincronizados
 * (o navegador ignoraria em silêncio um `<option>` que não existe mais).
 */
function sincronizarOpcoesCruzadas(pesquisas: readonly Pesquisa[], filtros: Filtros): OpcoesCruzadas {
  let subsetInstituto = aplicarFiltros(pesquisas, { ...filtros, instituto: 'todos' });
  let contagemInstituto = contarPor(subsetInstituto, (p) => p.instituto);
  if (filtros.instituto !== 'todos' && !contagemInstituto.has(filtros.instituto)) {
    filtros.instituto = 'todos';
    subsetInstituto = aplicarFiltros(pesquisas, { ...filtros, instituto: 'todos' });
    contagemInstituto = contarPor(subsetInstituto, (p) => p.instituto);
  }

  let subsetUf = aplicarFiltros(pesquisas, { ...filtros, uf: 'todos' });
  let contagemUf = contarPor(subsetUf, (p) => p.disputa.uf);
  if (filtros.uf !== 'todos' && !contagemUf.has(filtros.uf)) {
    filtros.uf = 'todos';
    subsetUf = aplicarFiltros(pesquisas, { ...filtros, uf: 'todos' });
    contagemUf = contarPor(subsetUf, (p) => p.disputa.uf);
    // A UF mudou (foi limpa) — o cruzamento de Instituto depende dela, recalcula.
    subsetInstituto = aplicarFiltros(pesquisas, { ...filtros, instituto: 'todos' });
    contagemInstituto = contarPor(subsetInstituto, (p) => p.instituto);
  }

  return { contagemInstituto, contagemUf };
}

/** Repopula um `<select>` com "Todos"/rótuloTodos + só as chaves com pesquisa no cruzamento atual, contagem no rótulo. */
function preencherOpcoesComContagem(
  select: HTMLSelectElement,
  todasAsChaves: readonly string[],
  contagem: ReadonlyMap<string, number>,
  rotuloTodos: string,
  valorAtual: string,
): void {
  select.innerHTML = '';
  select.append(criarEl('option', { texto: rotuloTodos, attrs: { value: 'todos' } }));
  for (const chave of todasAsChaves) {
    const n = contagem.get(chave);
    if (!n) continue;
    select.append(criarEl('option', { texto: `${chave} (${n})`, attrs: { value: chave } }));
  }
  select.value = valorAtual;
}

function formatarRegistroCurto(p: Pesquisa): string {
  return p.registroTSE.naoRegistrada ? '—' : p.registroTSE.valor;
}

/** Escapa um campo para CSV (RFC 4180): aspas duplicadas, envolve em aspas se tiver vírgula/quebra/aspas. */
function csvCampo(valor: string | number | null | undefined): string {
  const texto = valor == null ? '' : String(valor);
  if (/[",\n;]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

const CABECALHO_CSV = [
  'id',
  'cargo',
  'uf',
  'turno',
  'instituto',
  'contratante',
  'dataInicio',
  'dataFim',
  'publicadoEm',
  'amostra',
  'margem',
  'cenario',
  'registroTSE',
  'resultados',
  'fonteNome',
  'fonteUrl',
  'observacao',
];

function gerarLinhaCsv(p: Pesquisa): string {
  const resultados = p.resultados
    .map((r) => `${r.candidato} (${r.partido ?? 's/partido'}): ${formatarNumero(r.pct)}%`)
    .join(' | ');
  const campos = [
    p.id,
    p.disputa.cargo,
    p.disputa.uf,
    p.disputa.turno,
    p.instituto,
    p.contratante ?? '',
    p.dataInicio ?? '',
    p.dataFim ?? '',
    p.publicadoEm ?? '',
    p.amostra ?? '',
    p.margem ?? '',
    p.cenario ?? '',
    formatarRegistroCurto(p),
    resultados,
    p.fonte.nome,
    p.fonte.url,
    p.observacao ?? '',
  ];
  return campos.map(csvCampo).join(',');
}

function gerarCsv(pesquisas: readonly Pesquisa[]): string {
  const linhas = [CABECALHO_CSV.join(','), ...pesquisas.map(gerarLinhaCsv)];
  return linhas.join('\r\n');
}

function baixarCsv(pesquisas: readonly Pesquisa[]): void {
  const csv = '﻿' + gerarCsv(pesquisas); // BOM para UTF-8 abrir corretamente no Excel.
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const hoje = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `pesquisas-${hoje}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function renderPollsDatabase(container: HTMLElement, casos: CasosDeUso): void {
  const base = casos.getPollsDatabase();
  const partidos = casos.listParties();

  container.innerHTML = '';
  const raiz = criarEl('section', { className: 'db-view', attrs: { 'aria-labelledby': 'pesquisas-titulo' } });

  raiz.append(criarCabecalho(base));

  const filtros: Filtros = {
    cargo: 'todos',
    uf: 'todos',
    instituto: 'todos',
    turno: 'todos',
    busca: '',
    somenteComRegistro: false,
  };
  const ordenacao: Ordenacao = { campo: 'data', direcao: 'desc' };

  const contador = criarEl('p', { className: 'db-contador', attrs: { 'aria-live': 'polite' } });
  const tabelaWrap = criarEl('div', {});

  const barraFiltros = criarBarraFiltros(filtros, () => atualizar());

  function limparFiltros(): void {
    filtros.cargo = 'todos';
    filtros.uf = 'todos';
    filtros.instituto = 'todos';
    filtros.turno = 'todos';
    filtros.busca = '';
    filtros.somenteComRegistro = false;
    barraFiltros.selectCargo.value = 'todos';
    barraFiltros.selectTurno.value = 'todos';
    barraFiltros.inputBusca.value = '';
    barraFiltros.checkboxRegistro.checked = false;
    atualizar();
  }

  function atualizar(): void {
    const { contagemInstituto, contagemUf } = sincronizarOpcoesCruzadas(base.pesquisas, filtros);
    preencherOpcoesComContagem(
      barraFiltros.selectInstituto,
      base.institutos,
      contagemInstituto,
      'Todos os institutos',
      filtros.instituto,
    );
    preencherOpcoesComContagem(barraFiltros.selectUf, base.ufs, contagemUf, 'Todas as UFs', filtros.uf);

    const filtradas = ordenarPesquisas(aplicarFiltros(base.pesquisas, filtros), ordenacao);
    contador.textContent = `${filtradas.length} de ${base.pesquisas.length} pesquisas`;
    tabelaWrap.innerHTML = '';
    if (filtradas.length === 0) {
      tabelaWrap.append(criarEstadoVazio(limparFiltros));
    } else {
      tabelaWrap.append(criarTabela(filtradas, partidos, ordenacao, (campo) => {
        if (ordenacao.campo === campo) {
          ordenacao.direcao = ordenacao.direcao === 'asc' ? 'desc' : 'asc';
        } else {
          ordenacao.campo = campo;
          ordenacao.direcao = campo === 'data' ? 'desc' : 'asc';
        }
        atualizar();
      }));
    }
  }

  raiz.append(
    barraFiltros.elemento,
    criarEl('div', { className: 'db-toolbar' }, [
      contador,
      criarBotaoCsv(() => baixarCsv(ordenarPesquisas(aplicarFiltros(base.pesquisas, filtros), ordenacao))),
    ]),
    tabelaWrap,
  );

  atualizar();
  container.append(raiz);
}

/** Mensagem de zero resultados + botão para voltar todos os filtros ao padrão. */
function criarEstadoVazio(aoLimpar: () => void): HTMLElement {
  const btnLimpar = criarEl('button', {
    className: 'db-btn-limpar',
    texto: 'Limpar filtros',
    attrs: { type: 'button' },
  }) as HTMLButtonElement;
  btnLimpar.addEventListener('click', aoLimpar);

  return criarEl('div', { className: 'db-vazio' }, [
    criarEl('p', { className: 'db-vazio-texto', texto: 'Nenhuma pesquisa encontrada com os filtros atuais.' }),
    btnLimpar,
  ]);
}

function criarCabecalho(base: ReturnType<CasosDeUso['getPollsDatabase']>): HTMLElement {
  const { totais } = base;
  const maisRecente = base.pesquisas[0] ? dataReferencia(base.pesquisas[0]) : null;

  const chips = criarEl('div', { className: 'db-summary-bar', attrs: { role: 'list', 'aria-label': 'Totais da base de pesquisas' } }, [
    criarChip('Total de pesquisas', String(totais.total)),
    criarChip('Presidente', String(totais.porCargo.presidente)),
    criarChip('Governador', String(totais.porCargo.governador)),
    criarChip('Senador', String(totais.porCargo.senador)),
    criarChip('Com registro TSE', String(totais.comRegistroTSE)),
    criarChip('Sem registro TSE', String(totais.semRegistroTSE)),
    criarChip('Institutos', String(base.institutos.length)),
    criarChip('UFs cobertas', String(totais.ufsCobertas)),
  ]);

  const meta = criarEl('p', {
    className: 'db-meta',
    texto: maisRecente
      ? `Pesquisa mais recente com data de referência em ${formatarData(maisRecente)}.`
      : 'Nenhuma pesquisa cadastrada ainda.',
  });

  return criarEl('header', { className: 'db-header' }, [
    criarEl('h1', { className: 'db-title', texto: 'Base de pesquisas', attrs: { id: 'pesquisas-titulo' } }),
    criarEl('p', {
      className: 'db-subtitle',
      texto: 'Todas as pesquisas eleitorais conhecidas (presidente, governador e senador), com filtros e exportação.',
    }),
    chips,
    meta,
  ]);
}

function criarChip(rotulo: string, valor: string): HTMLElement {
  return criarEl('span', { className: 'db-summary-chip', attrs: { role: 'listitem' } }, [
    criarEl('span', { className: 'db-summary-chip-valor', texto: valor }),
    criarEl('span', { className: 'db-summary-chip-rotulo', texto: rotulo }),
  ]);
}

function criarCampo(rotulo: string, id: string, controle: HTMLElement): HTMLElement {
  controle.id = id;
  const label = criarEl('label', { className: 'db-field-label', texto: rotulo, attrs: { for: id } });
  return criarEl('div', { className: 'db-field' }, [label, controle]);
}

function criarSelect(
  opcoes: readonly { valor: string; rotulo: string }[],
  valorAtual: string,
  aoMudar: (valor: string) => void,
): HTMLSelectElement {
  const select = criarEl(
    'select',
    { className: 'db-select' },
    opcoes.map((o) => criarEl('option', { texto: o.rotulo, attrs: { value: o.valor } })),
  );
  select.value = valorAtual;
  select.addEventListener('change', () => aoMudar(select.value));
  return select;
}

interface BarraFiltrosRefs {
  readonly elemento: HTMLElement;
  readonly selectCargo: HTMLSelectElement;
  readonly selectUf: HTMLSelectElement;
  readonly selectInstituto: HTMLSelectElement;
  readonly selectTurno: HTMLSelectElement;
  readonly inputBusca: HTMLInputElement;
  readonly checkboxRegistro: HTMLInputElement;
}

/**
 * Monta a barra de filtros. UF e Instituto começam sem `<option>` própria
 * (além de "todos"): quem as popula, a cada mudança, é
 * `preencherOpcoesComContagem` chamada por `atualizar()` em
 * `renderPollsDatabase` — é o que faz os dois `<select>` refletirem um ao
 * outro (e Cargo/Turno/busca) em vez da lista fixa e global de antes.
 */
function criarBarraFiltros(filtros: Filtros, aoMudar: () => void): BarraFiltrosRefs {
  const selectCargo = criarSelect(
    [
      { valor: 'todos', rotulo: 'Todos os cargos' },
      { valor: 'presidente', rotulo: 'Presidente' },
      { valor: 'governador', rotulo: 'Governador' },
      { valor: 'senador', rotulo: 'Senador' },
    ],
    filtros.cargo,
    (v) => {
      filtros.cargo = v as FiltroCargo;
      aoMudar();
    },
  );

  const selectUf = criarSelect([{ valor: 'todos', rotulo: 'Todas as UFs' }], filtros.uf, (v) => {
    filtros.uf = v;
    aoMudar();
  });

  const selectInstituto = criarSelect([{ valor: 'todos', rotulo: 'Todos os institutos' }], filtros.instituto, (v) => {
    filtros.instituto = v;
    aoMudar();
  });

  const selectTurno = criarSelect(
    [
      { valor: 'todos', rotulo: 'Todos os turnos' },
      { valor: '1', rotulo: '1º turno' },
      { valor: '2', rotulo: '2º turno' },
    ],
    String(filtros.turno),
    (v) => {
      filtros.turno = v === 'todos' ? 'todos' : (Number(v) as 1 | 2);
      aoMudar();
    },
  );

  const inputBusca = criarEl('input', {
    className: 'db-input',
    attrs: { type: 'search', placeholder: 'Candidato, instituto ou registro TSE…' },
  }) as HTMLInputElement;
  inputBusca.value = filtros.busca;
  inputBusca.addEventListener('input', () => {
    filtros.busca = inputBusca.value;
    aoMudar();
  });

  const checkboxRegistro = criarEl('input', {
    attrs: { type: 'checkbox', id: 'pesquisas-so-registro-tse' },
  }) as HTMLInputElement;
  checkboxRegistro.checked = filtros.somenteComRegistro;
  checkboxRegistro.addEventListener('change', () => {
    filtros.somenteComRegistro = checkboxRegistro.checked;
    aoMudar();
  });
  const campoCheckbox = criarEl('label', { className: 'db-checkbox-field', attrs: { for: 'pesquisas-so-registro-tse' } }, [
    checkboxRegistro,
    'Só com registro TSE',
  ]);

  const elemento = criarEl(
    'div',
    { className: 'db-filters-row', attrs: { role: 'search', 'aria-label': 'Filtros da base de pesquisas' } },
    [
      criarCampo('Cargo', 'pesquisas-filtro-cargo', selectCargo),
      criarCampo('UF', 'pesquisas-filtro-uf', selectUf),
      criarCampo('Instituto', 'pesquisas-filtro-instituto', selectInstituto),
      criarCampo('Turno', 'pesquisas-filtro-turno', selectTurno),
      criarCampo('Buscar', 'pesquisas-filtro-busca', inputBusca),
      campoCheckbox,
    ],
  );

  return { elemento, selectCargo, selectUf, selectInstituto, selectTurno, inputBusca, checkboxRegistro };
}

function criarBotaoCsv(aoClicar: () => void): HTMLButtonElement {
  const btn = criarEl('button', {
    className: 'db-btn-csv',
    texto: 'Baixar CSV',
    attrs: { type: 'button' },
  }) as HTMLButtonElement;
  btn.addEventListener('click', aoClicar);
  return btn;
}

function criarThOrdenavel(
  rotulo: string,
  campo: CampoOrdenacao,
  ordenacao: Ordenacao,
  aoOrdenar: (campo: CampoOrdenacao) => void,
): HTMLElement {
  const ativo = ordenacao.campo === campo;
  const btn = criarEl('button', {
    className: 'db-table-sort-btn',
    texto: rotulo,
    attrs: { type: 'button', 'aria-label': `Ordenar por ${rotulo}` },
  });
  btn.addEventListener('click', () => aoOrdenar(campo));
  return criarEl('th', {
    attrs: { scope: 'col', 'aria-sort': ativo ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none' },
  }, [btn]);
}

function criarTabela(
  pesquisas: readonly Pesquisa[],
  partidos: ReturnType<CasosDeUso['listParties']>,
  ordenacao: Ordenacao,
  aoOrdenar: (campo: CampoOrdenacao) => void,
): HTMLElement {
  const wrap = criarEl('div', { className: 'db-table-wrap' });
  const table = criarEl('table', { className: 'db-table' });

  table.append(
    criarEl('thead', {}, [
      criarEl('tr', {}, [
        criarThOrdenavel('Data de campo', 'data', ordenacao, aoOrdenar),
        criarEl('th', { texto: 'Publicada', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Cargo', attrs: { scope: 'col' } }),
        criarThOrdenavel('UF', 'uf', ordenacao, aoOrdenar),
        criarEl('th', { texto: 'Turno', attrs: { scope: 'col' } }),
        criarThOrdenavel('Instituto', 'instituto', ordenacao, aoOrdenar),
        criarEl('th', { texto: 'Contratante', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Amostra', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Margem', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Registro TSE', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Cenário', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Principais colocados', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Fonte', attrs: { scope: 'col' } }),
        criarEl('th', { texto: 'Detalhes', attrs: { scope: 'col' } }),
      ]),
    ]),
  );

  table.append(criarEl('tbody', {}, pesquisas.flatMap((p) => criarLinhaPesquisa(p, partidos))));
  wrap.append(table);
  return wrap;
}

function criarCelulaTop3(p: Pesquisa, partidos: ReturnType<CasosDeUso['listParties']>): HTMLElement {
  const top3 = [...p.resultados].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const lista = criarEl('ol', { className: 'db-top3-list' },
    top3.map((r) => {
      const espectro = espectroDoPartido(r.partido, partidos);
      return criarEl('li', { className: 'db-top3-item' }, [
        criarEl('span', { className: 'db-top3-nome', texto: r.candidato }),
        r.partido ? criarBadgePartido(r.partido, espectro) : criarEl('span', { className: 'db-meta', texto: '—' }),
        criarEl('span', { className: 'db-top3-pct', texto: formatarPct(r.pct) }),
      ]);
    }),
  );
  return criarEl('td', { attrs: { 'data-rotulo': 'Principais colocados' } }, [lista]);
}

/**
 * Uma pesquisa vira 2 `<tr>`: a linha principal (todas as colunas
 * resumidas) e uma linha de detalhes, oculta por padrão, com uma única
 * célula de `colspan` completo. Antes, "Detalhes" era um `<details>`
 * aninhado na última célula — ao abrir, o navegador rolava
 * `.db-table-wrap` horizontalmente sozinho para trazer o `<summary>`
 * focado para a viewport, escondendo Data/Cargo/UF/Instituto (a própria
 * linha que o usuário queria ver melhor). Um botão simples que só
 * alterna a visibilidade de uma linha-irmã abaixo (sem `scrollIntoView`)
 * nunca precisa mexer no `scrollLeft` da tabela.
 */
function criarLinhaPesquisa(p: Pesquisa, partidos: ReturnType<CasosDeUso['listParties']>): HTMLElement[] {
  const celulaRegistro = p.registroTSE.naoRegistrada
    ? criarEl('td', { attrs: { 'data-rotulo': 'Registro TSE' } }, [
        criarEl('span', { className: 'db-selo db-selo-sem-registro', texto: 'Sem registro' }),
      ])
    : criarEl('td', { className: 'db-num', texto: p.registroTSE.valor, attrs: { 'data-rotulo': 'Registro TSE' } });

  const idDetalhes = `pesquisa-detalhes-${p.id}`;
  const linhaDetalhes = criarEl('tr', { className: 'db-detalhes-row', attrs: { id: idDetalhes } }, [
    criarEl('td', { attrs: { colspan: String(NUM_COLUNAS_TABELA) } }, [criarBlocoDetalhes(p, partidos)]),
  ]);
  linhaDetalhes.hidden = true;

  const btnDetalhes = criarEl('button', {
    className: 'db-detalhes-btn',
    texto: 'Detalhes',
    attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': idDetalhes },
  }) as HTMLButtonElement;
  btnDetalhes.addEventListener('click', () => {
    const vaiAbrir = linhaDetalhes.hidden;
    linhaDetalhes.hidden = !vaiAbrir;
    btnDetalhes.setAttribute('aria-expanded', String(vaiAbrir));
    btnDetalhes.textContent = vaiAbrir ? 'Ocultar' : 'Detalhes';
  });

  const linha = criarEl('tr', {}, [
    criarEl('td', {
      texto: formatarPeriodo(p.dataInicio, p.dataFim),
      className: 'db-col-wrap',
      attrs: { 'data-rotulo': 'Data de campo' },
    }),
    criarEl('td', { texto: formatarData(p.publicadoEm), attrs: { 'data-rotulo': 'Publicada' } }),
    criarEl('td', { texto: ROTULOS_CARGO[p.disputa.cargo], attrs: { 'data-rotulo': 'Cargo' } }),
    criarEl('td', { texto: p.disputa.uf, attrs: { 'data-rotulo': 'UF' } }),
    criarEl('td', { texto: `${p.disputa.turno}º turno`, attrs: { 'data-rotulo': 'Turno' } }),
    criarEl('td', { texto: p.instituto, className: 'db-col-wrap', attrs: { 'data-rotulo': 'Instituto' } }),
    criarEl('td', { texto: p.contratante ?? '—', className: 'db-col-wrap', attrs: { 'data-rotulo': 'Contratante' } }),
    criarEl('td', {
      className: 'db-num',
      texto: p.amostra != null ? p.amostra.toLocaleString('pt-BR') : '—',
      attrs: { 'data-rotulo': 'Amostra' },
    }),
    criarEl('td', {
      className: 'db-num',
      texto: p.margem != null ? `±${formatarPct(p.margem)}` : '—',
      attrs: { 'data-rotulo': 'Margem' },
    }),
    celulaRegistro,
    criarEl('td', { texto: p.cenario ?? '—', className: 'db-col-wrap', attrs: { 'data-rotulo': 'Cenário' } }),
    criarCelulaTop3(p, partidos),
    criarEl('td', { attrs: { 'data-rotulo': 'Fonte' } }, [criarLinkFonte(p.fonte)]),
    criarEl('td', { attrs: { 'data-rotulo': 'Detalhes' } }, [btnDetalhes]),
  ]);

  return [linha, linhaDetalhes];
}

function criarBlocoDetalhes(p: Pesquisa, partidos: ReturnType<CasosDeUso['listParties']>): HTMLElement {
  const todos = [...p.resultados].sort((a, b) => b.pct - a.pct);
  const lista = criarEl('ul', { className: 'db-detalhes-lista' },
    todos.map((r) => {
      const espectro = espectroDoPartido(r.partido, partidos);
      return criarEl('li', { className: 'db-detalhes-item' }, [
        criarEl('span', { className: 'db-detalhes-nome', texto: r.candidato }),
        r.partido ? criarBadgePartido(r.partido, espectro) : null,
        criarEl('span', { className: 'db-detalhes-pct', texto: formatarPct(r.pct) }),
      ]);
    }),
  );

  const partes: (Node | string)[] = [lista];
  if (p.observacao) {
    partes.push(criarEl('p', { className: 'db-detalhes-obs' }, [
      criarEl('strong', { texto: 'Observação: ' }),
      p.observacao,
    ]));
  }
  partes.push(criarEl('p', { className: 'db-detalhes-id', texto: `ID: ${p.id}` }));

  return criarEl('div', { className: 'db-detalhes-conteudo' }, partes);
}
