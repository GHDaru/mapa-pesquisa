import { describe, expect, it } from 'vitest';
import { criarPesquisa, type DadosPesquisa, type Pesquisa } from '../../../../../domain/poll.js';
import {
  aplicarFiltros,
  contarPor,
  direcaoPadrao,
  ordenarPesquisas,
  sincronizarOpcoesCruzadas,
  type Filtros,
} from '../polls-database-view.js';

/**
 * Testes de lógica pura da tela "Base de pesquisas" — sem DOM (o ambiente de
 * teste é `node`, ver vite.config.ts; a verificação visual/DOM real do
 * corte de nomes e do contraste do selo fica para os scripts Playwright de
 * `docs/screenshots/rodada12/`, não para este arquivo).
 */

function pesquisa(dados: Partial<DadosPesquisa> & Pick<DadosPesquisa, 'id' | 'uf' | 'cargo' | 'turno' | 'instituto'>): Pesquisa {
  return criarPesquisa({
    dataFim: '2026-09-01',
    fonte: { nome: 'Fonte Teste', url: 'https://exemplo.org' },
    resultados: [{ candidato: 'Candidato A', partido: 'PT', pct: 40 }],
    ...dados,
  });
}

const FILTROS_PADRAO: Filtros = {
  cargo: 'todos',
  uf: 'todos',
  instituto: 'todos',
  turno: 'todos',
  busca: '',
  somenteComRegistro: false,
};

const BASE: Pesquisa[] = [
  pesquisa({ id: 'sp-quaest-1', uf: 'SP', cargo: 'governador', turno: 1, instituto: 'Quaest' }),
  pesquisa({ id: 'sp-quaest-2', uf: 'SP', cargo: 'governador', turno: 1, instituto: 'Quaest' }),
  pesquisa({ id: 'sp-datafolha-1', uf: 'SP', cargo: 'governador', turno: 1, instituto: 'Datafolha' }),
  pesquisa({ id: 'rj-quaest-1', uf: 'RJ', cargo: 'governador', turno: 1, instituto: 'Quaest' }),
  pesquisa({ id: 'rj-alfa-1', uf: 'RJ', cargo: 'senador', turno: 1, instituto: 'Alfa Inteligência' }),
  pesquisa({
    id: 'sp-quaest-sem-registro',
    uf: 'SP',
    cargo: 'governador',
    turno: 1,
    instituto: 'Quaest',
    registroTSE: null,
  }),
];

describe('polls-database-view: contarPor', () => {
  it('conta ocorrências por chave', () => {
    const contagem = contarPor(BASE, (p) => p.instituto);
    expect(contagem.get('Quaest')).toBe(4);
    expect(contagem.get('Datafolha')).toBe(1);
    expect(contagem.get('Alfa Inteligência')).toBe(1);
  });
});

describe('polls-database-view: sincronizarOpcoesCruzadas', () => {
  it('com UF=SP, só institutos que pesquisaram em SP aparecem na contagem (Alfa Inteligência fica de fora)', () => {
    const filtros: Filtros = { ...FILTROS_PADRAO, uf: 'SP' };
    const { contagemInstituto } = sincronizarOpcoesCruzadas(BASE, filtros);
    expect(contagemInstituto.get('Quaest')).toBe(3);
    expect(contagemInstituto.get('Datafolha')).toBe(1);
    expect(contagemInstituto.has('Alfa Inteligência')).toBe(false);
  });

  it('com Instituto=Alfa Inteligência, só UFs onde ela pesquisou aparecem na contagem (SP fica de fora)', () => {
    const filtros: Filtros = { ...FILTROS_PADRAO, instituto: 'Alfa Inteligência' };
    const { contagemUf } = sincronizarOpcoesCruzadas(BASE, filtros);
    expect(contagemUf.get('RJ')).toBe(1);
    expect(contagemUf.has('SP')).toBe(false);
  });

  it('reseta o instituto para "todos" quando a UF muda e a combinação anterior deixou de existir', () => {
    // Alfa Inteligência só pesquisou no RJ (senador); ao trocar a UF para SP,
    // a combinação UF=SP + Instituto=Alfa Inteligência não existe mais.
    const filtros: Filtros = { ...FILTROS_PADRAO, uf: 'SP', instituto: 'Alfa Inteligência' };
    sincronizarOpcoesCruzadas(BASE, filtros);
    expect(filtros.instituto).toBe('todos');
    expect(filtros.uf).toBe('SP');
  });

  it('reseta a UF para "todos" quando o usuário acabou de trocar o instituto e a combinação anterior deixou de existir', () => {
    // O 3º argumento é o campo que o usuário acabou de mexer: aqui é o
    // instituto, então é ele quem fica protegido — a UF (mais antiga) cede.
    const filtros: Filtros = { ...FILTROS_PADRAO, instituto: 'Datafolha', uf: 'RJ' };
    sincronizarOpcoesCruzadas(BASE, filtros, 'instituto');
    expect(filtros.uf).toBe('todos');
    expect(filtros.instituto).toBe('Datafolha');
  });

  it('sem indicar o campo recém-alterado (ex.: veio de uma mudança de Cargo), a checagem de Instituto roda primeiro', () => {
    // Documenta o comportamento padrão (sem 3º argumento): entre dois
    // filtros já mutuamente incompatíveis, o de Instituto cede primeiro.
    const filtros: Filtros = { ...FILTROS_PADRAO, instituto: 'Datafolha', uf: 'RJ' };
    sincronizarOpcoesCruzadas(BASE, filtros);
    expect(filtros.instituto).toBe('todos');
    expect(filtros.uf).toBe('RJ');
  });

  it('não mexe em filtros já consistentes (UF=SP + Instituto=Quaest, combinação real)', () => {
    const filtros: Filtros = { ...FILTROS_PADRAO, uf: 'SP', instituto: 'Quaest' };
    const { contagemInstituto, contagemUf } = sincronizarOpcoesCruzadas(BASE, filtros);
    expect(filtros.uf).toBe('SP');
    expect(filtros.instituto).toBe('Quaest');
    expect(contagemInstituto.get('Quaest')).toBe(3);
    expect(contagemUf.get('SP')).toBe(3);
  });

  it('cargo também entra no cruzamento: Alfa Inteligência (só senador) some da contagem quando cargo=governador', () => {
    const filtros: Filtros = { ...FILTROS_PADRAO, cargo: 'governador' };
    const { contagemInstituto } = sincronizarOpcoesCruzadas(BASE, filtros);
    expect(contagemInstituto.has('Alfa Inteligência')).toBe(false);
  });
});

describe('polls-database-view: aplicarFiltros (combinação final continua correta após o cruzamento)', () => {
  it('UF=SP + Instituto=Quaest retorna só as 3 pesquisas dessa combinação', () => {
    const filtros: Filtros = { ...FILTROS_PADRAO, uf: 'SP', instituto: 'Quaest' };
    expect(aplicarFiltros(BASE, filtros).map((p) => p.id).sort()).toEqual(
      ['sp-quaest-1', 'sp-quaest-2', 'sp-quaest-sem-registro'].sort(),
    );
  });

  it('combinação impossível (UF=SP + Instituto=Alfa Inteligência) dá 0 resultados — é esse o caso que o botão "limpar filtros" cobre', () => {
    const filtros: Filtros = { ...FILTROS_PADRAO, uf: 'SP', instituto: 'Alfa Inteligência' };
    expect(aplicarFiltros(BASE, filtros)).toHaveLength(0);
  });
});

describe('ordenarPesquisas', () => {
  const LISTA: Pesquisa[] = [
    pesquisa({ id: 'gov-sp', uf: 'SP', cargo: 'governador', turno: 1, instituto: 'Quaest', dataFim: '2026-09-05', publicadoEm: '2026-09-07' }),
    pesquisa({ id: 'pres-br-2t', uf: 'BR', cargo: 'presidente', turno: 2, instituto: 'Datafolha', dataFim: '2026-09-01', publicadoEm: '2026-09-03' }),
    pesquisa({ id: 'sen-rj', uf: 'RJ', cargo: 'senador', turno: 1, instituto: 'Alfa', dataFim: '2026-09-10' }),
    pesquisa({ id: 'pres-br-1t', uf: 'BR', cargo: 'presidente', turno: 1, instituto: 'Quaest', dataFim: '2026-09-08', publicadoEm: '2026-09-09' }),
  ];
  const ids = (lista: Pesquisa[]) => lista.map((p) => p.id);

  it('publicada desc: mais recente primeiro e sem data de publicação sempre no fim', () => {
    expect(ids(ordenarPesquisas(LISTA, { campo: 'publicada', direcao: 'desc' }))).toEqual([
      'pres-br-1t',
      'gov-sp',
      'pres-br-2t',
      'sen-rj',
    ]);
    expect(ids(ordenarPesquisas(LISTA, { campo: 'publicada', direcao: 'asc' }))).toEqual([
      'pres-br-2t',
      'gov-sp',
      'pres-br-1t',
      'sen-rj',
    ]);
  });

  it('cargo: presidente → governador → senador, desempate por data de campo mais recente', () => {
    expect(ids(ordenarPesquisas(LISTA, { campo: 'cargo', direcao: 'asc' }))).toEqual([
      'pres-br-1t',
      'pres-br-2t',
      'gov-sp',
      'sen-rj',
    ]);
    expect(ids(ordenarPesquisas(LISTA, { campo: 'cargo', direcao: 'desc' }))).toEqual([
      'sen-rj',
      'gov-sp',
      'pres-br-1t',
      'pres-br-2t',
    ]);
  });

  it('turno: 1º turno antes do 2º em asc, desempate por data de campo mais recente', () => {
    expect(ids(ordenarPesquisas(LISTA, { campo: 'turno', direcao: 'asc' }))).toEqual([
      'sen-rj',
      'pres-br-1t',
      'gov-sp',
      'pres-br-2t',
    ]);
    expect(ids(ordenarPesquisas(LISTA, { campo: 'turno', direcao: 'desc' }))[0]).toBe('pres-br-2t');
  });

  it('não muta a lista original', () => {
    const copia = [...LISTA];
    ordenarPesquisas(LISTA, { campo: 'cargo', direcao: 'asc' });
    expect(LISTA).toEqual(copia);
  });

  it('direção padrão: datas descem, o resto sobe', () => {
    expect(direcaoPadrao('data')).toBe('desc');
    expect(direcaoPadrao('publicada')).toBe('desc');
    expect(direcaoPadrao('cargo')).toBe('asc');
    expect(direcaoPadrao('turno')).toBe('asc');
  });
});
