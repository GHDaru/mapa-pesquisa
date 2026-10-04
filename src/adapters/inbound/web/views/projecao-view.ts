import '../styles/projecao.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type {
  ComparacaoPesquisaApuracao,
  ProjecaoComparada,
} from '../../../../application/use-cases/get-projecao.js';
import type { MargemProjetada, Projecao } from '../../../../domain/apuracao.js';
import { criarEl, formatarNumero, formatarPct } from './_shared.js';

/**
 * Tela de projeção da apuração.
 *
 * A regra que organiza esta tela é a mesma do resto do projeto: **todo número
 * declara a sua base**. Aqui isso significa que nenhum percentual aparece sem
 * o percentual de seções totalizadas ao lado, e que a palavra "projeção" nunca
 * é usada para o que é contagem.
 *
 * Três coisas que esta tela se recusa a fazer:
 *
 * 1. Mostrar gráfico de zeros quando não há apuração. Sem dado, ela diz que
 *    não há dado.
 * 2. Chamar de nacional uma projeção que cobre parte do eleitorado. A
 *    cobertura e as UFs ausentes aparecem nomeadas.
 * 3. Declarar vencedor. O único veredito que ela emite é aritmético — a
 *    vantagem do líder excede ou não tudo o que ainda pode ser contado.
 */

/** Formata um total de votos de forma legível, sem casas decimais. */
export function formatarVotos(votos: number): string {
  return Math.round(votos).toLocaleString('pt-BR');
}

/**
 * A frase de cobertura. Nunca diz só "x% totalizado": diz de quanto do
 * eleitorado esse percentual fala, porque uma UF pequena a 100% não informa
 * nada sobre o país.
 */
export function rotuloCobertura(projecao: Projecao): string {
  const pctEleitorado =
    projecao.eleitoradoTotal > 0
      ? (projecao.eleitoradoCoberto / projecao.eleitoradoTotal) * 100
      : 0;
  const base =
    `${formatarPct(projecao.secoesTotalizadasPonderada)} das seções totalizadas, ` +
    `média ponderada pelo eleitorado de ${projecao.porUf.length} ` +
    `${projecao.porUf.length === 1 ? 'estado' : 'estados'} ` +
    `(${formatarPct(pctEleitorado)} do eleitorado do país)`;
  if (projecao.ufsSemApuracao.length === 0) return `${base}. Todas as UFs têm apuração.`;
  return (
    `${base}. Sem nenhuma apuração: ${projecao.ufsSemApuracao.join(', ')} — ` +
    'essas UFs ficam fora da projeção, não são completadas por estimativa.'
  );
}

/**
 * O veredito aritmético. Não é chamada de eleição: é a única afirmação que não
 * depende de a projeção estar certa.
 */
export function rotuloVeredito(margem: MargemProjetada | null): string {
  if (!margem) return 'Sem dois candidatos apurados, não há margem a calcular.';
  const vantagem =
    `${margem.lider} está ${formatarVotos(margem.vantagemVotos)} votos à frente de ` +
    `${margem.segundo} na contagem (${formatarPct(Math.abs(margem.vantagemPct))} na projeção)`;
  if (margem.matematicamenteDefinido) {
    return (
      `${vantagem}. Essa vantagem é maior que todo o voto que ainda pode entrar ` +
      `(teto de ${formatarVotos(margem.votosRestantesTeto)}), então a liderança está ` +
      'aritmeticamente fora de alcance.'
    );
  }
  return (
    `${vantagem}. Ainda podem entrar até ${formatarVotos(margem.votosRestantesTeto)} votos, ` +
    'mais que a vantagem — o resultado não está aritmeticamente definido.'
  );
}

/**
 * O contraste entre a projeção por estado e o percentual nacional cru. Essa
 * diferença é o viés de ordem de apuração, e mostrá-la é o ponto: foi o que
 * fez a vantagem "encolher" em 2022 sem ninguém mudar de voto.
 */
export function textoContrasteNacional(projecao: Projecao): string | null {
  const cru = projecao.nacionalCru;
  if (!cru || cru.candidatos.length === 0 || projecao.candidatos.length === 0) return null;
  const liderProjetado = projecao.candidatos[0]!;
  const liderCru = cru.candidatos[0]!;
  if (liderProjetado.candidato !== liderCru.candidato) {
    return (
      `O recorte nacional publicado pela fonte, com ${formatarPct(cru.secoesTotalizadas)} ` +
      `totalizado, tem ${liderCru.candidato} na frente; a projeção somada por estado tem ` +
      `${liderProjetado.candidato}. A diferença não é voto mudando: é a ordem em que os ` +
      'estados totalizam, e é por isso que esta tela projeta por estado.'
    );
  }
  const difPontos =
    (cru.candidatos.find((c) => c.candidato === liderProjetado.candidato)?.pctApurado ?? 0) -
    liderProjetado.pctProjetado;
  return (
    `O recorte nacional publicado pela fonte, com ${formatarPct(cru.secoesTotalizadas)} ` +
    `totalizado, dá a ${liderProjetado.candidato} ${formatarPct(Math.abs(difPontos))} ` +
    `${difPontos >= 0 ? 'mais' : 'menos'} que a projeção somada por estado. A diferença é ` +
    'a ordem em que os estados totalizam, não voto mudando.'
  );
}

/** A frase do erro médio do agregado. `null` sem par comparável — nunca "0,0". */
export function rotuloErroMedio(erro: number | null, pares: number): string | null {
  if (erro == null || pares === 0) return null;
  return (
    `Erro absoluto médio do agregado de pesquisas: ${formatarPct(erro)} em ` +
    `${pares} ${pares === 1 ? 'candidato' : 'candidatos'} comparáveis.`
  );
}

/** Rótulo do erro de um candidato, com o sinal explicado em palavras. */
export function rotuloErroCandidato(c: ComparacaoPesquisaApuracao): string {
  if (c.erro == null) return 'não estava no agregado';
  if (Math.abs(c.erro) < 0.05) return 'igual ao agregado';
  return c.erro > 0
    ? `pesquisas superestimaram em ${formatarPct(Math.abs(c.erro))}`
    : `pesquisas subestimaram em ${formatarPct(Math.abs(c.erro))}`;
}

/** Data/hora da leitura da apuração, em horário de Brasília quando parseável. */
export function rotuloInstante(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A ressalva do modo só-nacional, que é o estado mais provável no início da
 * noite: existe o parcial nacional da fonte e nenhum recorte por estado.
 *
 * Aqui o projeto se recusa a chamar o número de projeção. Sem a composição por
 * estado não há como corrigir o viés de ordem de apuração, e esse viés não é
 * pequeno: estados com perfis eleitorais opostos terminam de totalizar em
 * momentos diferentes, e o percentual nacional parcial se move sozinho por
 * causa disso, sem nenhum eleitor mudar de voto.
 */
export function rotuloApenasNacional(secoesTotalizadas: number): string {
  return (
    `A fonte publicou só o agregado nacional, com ${formatarPct(secoesTotalizadas)} das seções ` +
    'totalizadas, e nenhum recorte por estado. Os números abaixo são CONTAGEM PARCIAL, ' +
    'não projeção: esta tela não projeta sem a composição por estado, porque o percentual ' +
    'nacional parcial se move conforme os estados terminam de totalizar — e estados com ' +
    'perfis eleitorais opostos terminam em momentos diferentes. Trate a ordem atual como ' +
    'provisória até a apuração avançar.'
  );
}

/**
 * Aviso de defasagem da leitura.
 *
 * É a ressalva mais importante desta tela na noite de eleição. A página é
 * estática: os números são congelados no momento do deploy, enquanto a
 * apuração continua andando. Sem este aviso, um parcial de uma hora atrás é
 * lido como "o agora" — e numa noite em que a ordem dos candidatos muda
 * conforme os estados terminam, isso não é um detalhe, é o erro principal.
 *
 * O `agora` entra por parâmetro para o teste ser determinístico; a tela passa
 * o relógio do leitor, de modo que o aviso envelhece sozinho enquanto a aba
 * fica aberta.
 */
export function rotuloDefasagem(isoLeitura: string, agora: Date): string | null {
  const ms = Date.parse(isoLeitura);
  if (Number.isNaN(ms)) return null;
  const minutos = Math.floor((agora.getTime() - ms) / 60_000);
  if (minutos < 0) return null;
  if (minutos < 10) return null;
  const quanto =
    minutos < 60
      ? `${minutos} minutos`
      : `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
  return (
    `Esta leitura tem ${quanto} e a página é estática: a apuração avançou desde então. ` +
    'Os números abaixo são o que havia no instante da leitura, não o estado atual da ' +
    'contagem. Para o número de agora, vá à fonte oficial.'
  );
}

/** Estado vazio: diz o que falta, em vez de desenhar resultado que não existe. */
function montarVazio(): HTMLElement {
  return criarEl('section', { className: 'pj-vazio' }, [
    criarEl('h2', { texto: 'Ainda não há apuração carregada' }),
    criarEl('p', {
      texto:
        'Esta tela mostra a projeção do resultado a partir da apuração oficial. ' +
        'Enquanto o arquivo data/apuracao.json não tiver recortes, ela não mostra ' +
        'número nenhum — nem zerado, nem estimado a partir das pesquisas.',
    }),
    criarEl('p', {
      texto:
        'A projeção é montada somando estado por estado, cada um escalado pelo que ' +
        'falta totalizar nele, e não extrapolando o percentual nacional parcial. ' +
        'Esse percentual é enviesado pela ordem em que os estados apuram: em 2022 a ' +
        'vantagem do primeiro colocado encolheu ao longo da noite porque São Paulo ' +
        'totalizou depois do Nordeste, sem que um único eleitor mudasse de voto.',
    }),
  ]);
}

function montarBarraCandidato(
  c: ProjecaoComparada['projecao']['candidatos'][number],
  maiorPct: number,
  /**
   * Em modo só-nacional não existe projeção: o número grande passa a ser o
   * APURADO, e a linha de projeção desaparece em vez de repetir o mesmo valor
   * com outro nome — repetir faria o leitor crer que duas contas concordam.
   */
  apenasContagem = false,
): HTMLElement {
  const pctPrincipal = apenasContagem ? c.pctApurado : c.pctProjetado;
  const largura = maiorPct > 0 ? (pctPrincipal / maiorPct) * 100 : 0;
  return criarEl('li', { className: 'pj-barra' }, [
    criarEl('div', { className: 'pj-barra__rotulo' }, [
      criarEl('span', { className: 'pj-barra__nome', texto: c.candidato }),
      c.partido ? criarEl('span', { className: 'pj-barra__partido', texto: c.partido }) : null,
    ]),
    criarEl('div', { className: 'pj-barra__trilha' }, [
      criarEl('div', {
        className: 'pj-barra__preenchimento',
        attrs: { style: `width: ${largura.toFixed(2)}%` },
      }),
    ]),
    criarEl('div', { className: 'pj-barra__numeros' }, [
      criarEl('strong', {
        className: 'pj-barra__projetado',
        texto: formatarPct(pctPrincipal),
        attrs: {
          title: apenasContagem
            ? 'Percentual sobre os votos válidos já contados'
            : 'Percentual sobre os votos válidos projetados',
        },
      }),
      apenasContagem
        ? null
        : criarEl('span', {
            className: 'pj-barra__apurado',
            texto: `${formatarPct(c.pctApurado)} apurado`,
            attrs: { title: 'Percentual sobre os votos válidos já contados' },
          }),
      criarEl('span', {
        className: 'pj-barra__votos',
        texto: `${formatarVotos(c.votosApurados)} votos contados`,
      }),
    ]),
  ]);
}

function montarComparacao(dados: ProjecaoComparada): HTMLElement | null {
  const pares = dados.comparacao.filter((c) => c.erro != null);
  if (pares.length === 0) return null;
  // Em modo só-nacional a coluna da direita é CONTAGEM, não projeção. Dizer
  // "projeção" aqui contradiria o aviso que está logo acima na mesma tela.
  const contagem = dados.apenasNacional;
  const rotuloColuna = contagem ? 'Contagem parcial' : 'Projeção da apuração';
  const titulo = contagem
    ? 'O que as pesquisas diziam, e o que a contagem parcial mostra'
    : 'O que as pesquisas diziam, e o que a apuração projeta';
  const tabela = criarEl('table', { className: 'pj-tabela' }, [
    criarEl('thead', {}, [
      criarEl('tr', {}, [
        criarEl('th', { texto: 'Candidato' }),
        criarEl('th', { texto: 'Agregado de pesquisas' }),
        criarEl('th', { texto: rotuloColuna }),
        criarEl('th', { texto: 'Diferença' }),
      ]),
    ]),
    criarEl(
      'tbody',
      {},
      dados.comparacao.map((c) =>
        criarEl('tr', {}, [
          criarEl('td', { texto: c.candidato }),
          criarEl('td', { texto: c.pctPesquisas == null ? '—' : formatarPct(c.pctPesquisas) }),
          criarEl('td', { texto: formatarPct(c.pctProjetado) }),
          criarEl('td', { texto: rotuloErroCandidato(c) }),
        ]),
      ),
    ),
  ]);
  const media = rotuloErroMedio(dados.erroAbsolutoMedio, pares.length);
  return criarEl('section', { className: 'pj-secao' }, [
    criarEl('h2', { texto: titulo }),
    criarEl('p', {
      className: 'pj-nota',
      texto:
        'A coluna de pesquisas é o agregado ponderado por recência e amostra do mesmo ' +
        'recorte, renormalizado para somar 100 entre os candidatos — a mesma base em que ' +
        'a apuração publica. O ranking do agregado já não inclui brancos, nulos e ' +
        'indecisos, que são contados em separado, então a renormalização move pouco: ela ' +
        'torna a base exata em vez de aproximada.' +
        (contagem
          ? ' A comparação aqui é contra uma CONTAGEM PARCIAL e é provisória: a ordem ' +
            'dos candidatos pode mudar conforme os estados terminam de totalizar.'
          : ''),
    }),
    tabela,
    media ? criarEl('p', { className: 'pj-nota pj-nota--destaque', texto: media }) : null,
  ]);
}

function montarPorUf(projecao: Projecao): HTMLElement {
  return criarEl('section', { className: 'pj-secao' }, [
    criarEl('h2', { texto: 'Por estado' }),
    criarEl('p', {
      className: 'pj-nota',
      texto:
        'Cada estado é projetado pelo que falta totalizar nele. É a soma destas linhas ' +
        'que forma a projeção acima.',
    }),
    criarEl('table', { className: 'pj-tabela' }, [
      criarEl('thead', {}, [
        criarEl('tr', {}, [
          criarEl('th', { texto: 'UF' }),
          criarEl('th', { texto: 'Seções totalizadas' }),
          criarEl('th', { texto: 'Líder' }),
          criarEl('th', { texto: 'Votos contados' }),
        ]),
      ]),
      criarEl(
        'tbody',
        {},
        projecao.porUf.map((u) =>
          criarEl('tr', {}, [
            criarEl('td', { texto: u.uf }),
            criarEl('td', { texto: formatarPct(u.secoesTotalizadas) }),
            criarEl('td', { texto: u.lider ?? '—' }),
            criarEl('td', { texto: formatarVotos(u.validosApurados) }),
          ]),
        ),
      ),
    ]),
  ]);
}

/** Monta o conteúdo completo da tela. Exportada para teste. */
export function pjMontarConteudo(dados: ProjecaoComparada, agora: Date = new Date()): HTMLElement {
  const raiz = criarEl('div', { className: 'pj-raiz' });
  raiz.appendChild(
    criarEl('header', { className: 'pj-cabecalho' }, [
      criarEl('h1', { texto: 'Projeção' }),
      criarEl('p', {
        className: 'pj-nota',
        texto: `Leitura da apuração em ${rotuloInstante(dados.apuracaoAtualizadaEm)}.`,
      }),
    ]),
  );

  if (dados.semDados) {
    raiz.appendChild(montarVazio());
    return raiz;
  }

  const defasagem = rotuloDefasagem(dados.apuracaoAtualizadaEm, agora);
  if (defasagem) {
    raiz.appendChild(criarEl('p', { className: 'pj-defasagem', texto: defasagem }));
  }

  const { projecao } = dados;

  if (dados.apenasNacional) {
    const cru = projecao.nacionalCru!;
    raiz.appendChild(
      criarEl('p', {
        className: 'pj-cobertura',
        texto: rotuloApenasNacional(cru.secoesTotalizadas),
      }),
    );
    const maior = cru.candidatos[0]?.pctApurado ?? 0;
    raiz.appendChild(
      criarEl('section', { className: 'pj-secao' }, [
        criarEl('h2', { texto: 'Contagem parcial nacional' }),
        criarEl(
          'ul',
          { className: 'pj-barras' },
          cru.candidatos.map((c) => montarBarraCandidato(c, maior, true)),
        ),
        criarEl('p', {
          className: 'pj-nota',
          texto:
            'Percentuais sobre os votos válidos, que excluem brancos e nulos — é a base em ' +
            'que a apuração oficial publica.' +
            (cru.somaPctPublicada < 99.5
              ? ` Os candidatos acima somam ${formatarPct(cru.somaPctPublicada)} dos válidos: ` +
                'a fonte não publicou os demais nesta leitura, e eles não foram completados.'
              : ''),
        }),
      ]),
    );
  } else {
    raiz.appendChild(
      criarEl('p', { className: 'pj-cobertura', texto: rotuloCobertura(projecao) }),
    );

    const maiorPct = projecao.candidatos[0]?.pctProjetado ?? 0;
    raiz.appendChild(
      criarEl('section', { className: 'pj-secao' }, [
        criarEl('h2', { texto: 'Projeção somada por estado' }),
        criarEl(
          'ul',
          { className: 'pj-barras' },
          projecao.candidatos.map((c) => montarBarraCandidato(c, maiorPct)),
        ),
      ]),
    );

    raiz.appendChild(
      criarEl('section', { className: 'pj-secao pj-veredito' }, [
        criarEl('h2', { texto: 'O que já está decidido pela aritmética' }),
        criarEl('p', { texto: rotuloVeredito(projecao.margem) }),
      ]),
    );

    const contraste = textoContrasteNacional(projecao);
    if (contraste) {
      raiz.appendChild(
        criarEl('section', { className: 'pj-secao pj-contraste' }, [
          criarEl('h2', { texto: 'Por que o percentual nacional parcial engana' }),
          criarEl('p', { texto: contraste }),
        ]),
      );
    }
  }

  const comparacao = montarComparacao(dados);
  if (comparacao) raiz.appendChild(comparacao);

  if (projecao.porUf.length > 0) raiz.appendChild(montarPorUf(projecao));

  if (dados.fontes.length > 0 || dados.observacoes.length > 0) {
    raiz.appendChild(
      criarEl('section', { className: 'pj-secao pj-procedencia' }, [
        criarEl('h2', { texto: 'Procedência dos números' }),
        criarEl(
          'ul',
          { className: 'pj-fontes' },
          dados.fontes.map((f) =>
            criarEl('li', {}, [
              criarEl('a', {
                texto: f.nome,
                attrs: { href: f.url, target: '_blank', rel: 'noopener noreferrer' },
              }),
            ]),
          ),
        ),
        // As ressalvas das fichas vão para a tela, não só para o arquivo: é
        // nelas que fica dito, por exemplo, que um valor foi derivado de
        // percentual em vez de publicado como voto absoluto.
        ...dados.observacoes.map((o) => criarEl('p', { className: 'pj-nota', texto: o })),
      ]),
    );
  }

  return raiz;
}

/** Ponto de entrada da rota `#/projecao`. */
export function renderProjecao(container: HTMLElement, casos: CasosDeUso): void {
  container.innerHTML = '';
  container.appendChild(pjMontarConteudo(casos.getProjecao('presidente', 1)));
}
