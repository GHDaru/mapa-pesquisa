import '../styles/projecao.css';
import type { CasosDeUso } from '../../../../application/use-cases/index.js';
import type {
  ComparacaoPesquisaApuracao,
  ProjecaoComparada,
} from '../../../../application/use-cases/get-projecao.js';
import type { MargemProjetada, Projecao } from '../../../../domain/apuracao.js';
import type { AcertoDoInstituto } from '../../../../domain/poll-accuracy.js';
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

/**
 * Frase do resultado final. Substitui a de contagem parcial quando a apuração
 * fecha: aí a palavra "provisório" sai, porque deixaria o leitor desconfiar de
 * número que já não vai mudar, e isso também é desinformar.
 */
/**
 * "1º turno" ou "2º turno". Existe porque o título do resultado final trazia
 * "1º turno" escrito à mão: a partir de 25/10 a tela passaria a rotular o
 * resultado do 2º turno como se fosse o do 1º, sem erro nenhum para avisar.
 */
export function rotuloTurno(turno: 1 | 2): string {
  return turno === 2 ? '2º turno' : '1º turno';
}

export function rotuloResultadoFinal(secoesTotalizadas: number): string {
  return (
    `Apuração encerrada, com ${formatarPct(secoesTotalizadas)} das seções totalizadas. ` +
    'Os percentuais são sobre os votos válidos, que excluem brancos e nulos — a base em ' +
    'que o resultado oficial é publicado. Não há mais projeção a fazer: o que está abaixo ' +
    'é contagem.'
  );
}

/**
 * Como ler o erro de um instituto, em palavras. Duas medidas, porque uma só
 * esconderia metade: o erro por candidato mede calibração, o erro na margem
 * mede o que a cobertura discute — quem está na frente e por quanto.
 *
 * **O rótulo diz SOBRE QUANTOS candidatos a média foi tirada, e isso não é
 * detalhe.** O erro médio por candidato só é comparável entre institutos quando
 * o número de candidatos é o mesmo: candidato pequeno é fácil de quase acertar
 * (errar 0,7 ponto num candidato de 0,27% é quase acertar), então uma média
 * sobre seis DILUI um erro grande nos dois primeiros, enquanto uma média sobre
 * dois não dilui nada. Medido na ficha nacional de 99,79%, que listava seis
 * candidatos: a maioria dos institutos era comparada sobre 6, o Instituto Veritá
 * sobre 3, PoderData e Palver sobre 2 — e o ranking, ordenado por esse número,
 * punia quem publicou menos candidatos. O Veritá aparecia como o pior do campo
 * (5,52) e passou a 2,91 quando a base virou uniforme. A ordenação era, em
 * parte, uma medida de quantos candidatos cada instituto divulgou.
 */
export function rotuloErroDoInstituto(i: AcertoDoInstituto): string {
  const partes = [
    `${formatarPct(i.erroMedioAbsoluto)} de erro médio sobre ` +
      (i.candidatosComparados === 1
        ? '1 candidato'
        : `${i.candidatosComparados} candidatos`),
  ];
  if (i.erroNaMargem != null) {
    const abs = formatarPct(Math.abs(i.erroNaMargem));
    partes.push(
      Math.abs(i.erroNaMargem) < 0.05
        ? 'margem exata'
        : i.erroNaMargem > 0
          ? `exagerou a margem do 1º em ${abs}`
          : `subestimou a margem do 1º em ${abs}`,
    );
  }
  if (!i.acertouOLider) partes.push('apontou outro candidato em primeiro');
  return partes.join(' · ');
}

/**
 * A ressalva de comparabilidade. Um instituto que foi a campo três semanas
 * antes não disputa em igualdade com quem fechou na véspera, e o ranking sem
 * essa informação é injusto — então ela anda junto do número, não em nota de pé.
 */
export function rotuloDistanciaDaEleicao(diasAntes: number): string {
  if (diasAntes <= 0) return 'campo encerrado no dia da eleição';
  if (diasAntes === 1) return 'campo encerrado 1 dia antes';
  return `campo encerrado ${diasAntes} dias antes`;
}

/**
 * A frase da direção do erro, e a mais importante desta seção.
 *
 * Um ranking convida a ler "o instituto X ganhou". Quando o erro de quase todo
 * o campo aponta para o mesmo lado, essa leitura é a errada: não houve um
 * instituto sortudo e outros azarados, houve algo que os desenhos de amostra
 * erraram juntos. Esta frase existe para dizer isso antes que a tabela diga
 * outra coisa.
 */
export function rotuloDirecaoDoErro(
  subestimaram: number,
  superestimaram: number,
  total: number,
  lider: string | null,
): string | null {
  if (total === 0 || lider == null) return null;
  const maior = Math.max(subestimaram, superestimaram);
  const direcao = subestimaram >= superestimaram ? 'subestimaram' : 'superestimaram';
  if (maior < total * 0.7) {
    return (
      `O erro se espalhou nas duas direções: ${subestimaram} de ${total} institutos ` +
      `subestimaram a margem de ${lider} e ${superestimaram} a superestimaram. ` +
      'Erro em direções opostas é ruído de amostra, e cada instituto responde pelo seu.'
    );
  }
  return (
    `${maior} dos ${total} institutos ${direcao} a margem de ${lider}. ` +
    'Erro concentrado numa única direção não é ruído de amostra: é viés de campo — ' +
    'algo que os desenhos de amostra erraram juntos. A pergunta deixa de ser qual ' +
    'instituto foi melhor e passa a ser o que o método não captou.'
  );
}

/**
 * A frase para quando EXISTE dado estadual mas o recorte nacional cobre mais do
 * país. Aqui a tela não está escondendo o estadual: está dizendo por que o
 * número grande vem do outro lado, e o estadual segue visível na tabela por UF.
 */
export function rotuloNacionalVenceEstadual(
  secoesNacional: number,
  coberturaEstadual: number,
  ufsComDado: number,
): string {
  return (
    `O número em destaque vem da contagem nacional da fonte, com ` +
    `${formatarPct(secoesNacional)} das seções totalizadas. Há apuração em ` +
    `${ufsComDado} ${ufsComDado === 1 ? 'estado' : 'estados'}, mas ela cobre ` +
    `${formatarPct(coberturaEstadual)} do eleitorado do país — menos que a contagem ` +
    'nacional —, então somar os estados daria um retrato mais estreito, não mais fino. ' +
    'Os estados aparecem na tabela por UF, e passam a comandar quando cobrirem mais.'
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
  const final = dados.apuracaoEncerrada;
  const contagem = dados.destaque === 'nacional' && !final;
  const rotuloColuna = final ? 'Resultado' : contagem ? 'Contagem parcial' : 'Projeção da apuração';
  const titulo = final
    ? 'O que as pesquisas diziam, e o que deu'
    : contagem
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

/**
 * A nota da tabela por estado, que **tem de seguir `destaque`**.
 *
 * Ela afirmava, fixo no código, "é a soma destas linhas que forma a projeção
 * acima". Isso só é verdade no modo estadual. Em 06/10 passou a ser falso no ar:
 * com 10 das 27 UFs no arquivo, o destaque é a contagem nacional de 100% das
 * seções, e a tabela logo abaixo dizia ao leitor que aquele número vinha da soma
 * de 10 estados. Duas grandezas diferentes na mesma tela, com uma frase ligando
 * a errada.
 *
 * É o mesmo defeito que `baseComparacao` tinha: texto escrito quando só existia
 * um modo. A nota agora diz o que a tabela é em cada caso, e **declara quantas
 * UFs faltam** — sem isso, uma tabela de 10 linhas parece o país.
 */
export function rotuloPorUf(
  destaque: 'nacional' | 'estadual',
  comApuracao: number,
  semApuracao: number,
): string {
  const total = comApuracao + semApuracao;
  const cobertura =
    semApuracao === 0
      ? `Todas as ${total} unidades da federação têm apuração.`
      : `São ${comApuracao} de ${total} unidades da federação: ` +
        `${semApuracao} ainda sem nenhuma apuração, e elas NÃO são completadas por estimativa.`;
  const relacao =
    destaque === 'nacional'
      ? 'O destaque acima é a contagem nacional da fonte, não a soma destas linhas — ' +
        'esta tabela é o detalhamento do que já foi totalizado estado por estado, ' +
        'e somá-la daria um resultado enviesado para as UFs que aqui estão.'
      : 'Cada estado é projetado pelo que falta totalizar nele, e é a soma destas ' +
        'linhas que forma a projeção acima.';
  return `${relacao} ${cobertura}`;
}

function montarPorUf(projecao: Projecao, destaque: 'nacional' | 'estadual'): HTMLElement {
  return criarEl('section', { className: 'pj-secao' }, [
    criarEl('h2', { texto: 'Por estado' }),
    criarEl('p', {
      className: 'pj-nota',
      texto: rotuloPorUf(destaque, projecao.porUf.length, projecao.ufsSemApuracao.length),
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

/**
 * Tabela de acerto por instituto. É a conta que o projeto existe para fazer e
 * que só pode ser feita uma vez por eleição — e também a mais fácil de tornar
 * injusta, então cada linha carrega a data do campo e a amostra ao lado do
 * erro, e institutos sob ressalva aparecem marcados em vez de removidos.
 */
function montarAcerto(dados: ProjecaoComparada): HTMLElement | null {
  const a = dados.acerto;
  if (!a || a.institutos.length === 0) return null;
  const linhas = a.institutos.map((i) =>
    criarEl('tr', i.alerta ? { className: 'pj-linha-alerta' } : {}, [
      criarEl('td', {}, [
        criarEl('span', { className: 'pj-instituto', texto: i.instituto }),
        i.alerta
          ? criarEl('span', {
              className: 'pj-selo-alerta',
              texto: 'sob ressalva',
              attrs: { title: i.alerta },
            })
          : null,
      ]),
      criarEl('td', { texto: rotuloDistanciaDaEleicao(i.diasAntes) }),
      criarEl('td', { texto: i.amostra == null ? '—' : formatarVotos(i.amostra) }),
      criarEl('td', { texto: rotuloErroDoInstituto(i) }),
    ]),
  );
  const mediana = a.erroMedianoDoCampo;
  const direcao = rotuloDirecaoDoErro(
    a.subestimaramAMargem,
    a.superestimaramAMargem,
    a.institutos.length,
    a.primeiroESegundo?.[0] ?? null,
  );
  return criarEl('section', { className: 'pj-secao' }, [
    criarEl('h2', { texto: 'Quem chegou mais perto' }),
    // A direção do erro vem ANTES da tabela: sem ela o leitor conclui que um
    // instituto acertou e os outros erraram, quando o que houve foi erro
    // conjunto numa só direção.
    direcao ? criarEl('p', { className: 'pj-vies', texto: direcao }) : null,
    criarEl('p', {
      className: 'pj-nota',
      texto:
        'Uma pesquisa por instituto: a última de cada um, renormalizada para a base de ' +
        'votos válidos. A data do campo está ao lado porque quem foi a campo três semanas ' +
        'antes não disputa em igualdade com quem fechou na véspera — e um ranking que ' +
        'esconde isso é injusto. O erro médio por candidato mede calibração; o erro na ' +
        'margem mede o que a cobertura discute, quem está na frente e por quanto.',
    }),
    criarEl('table', { className: 'pj-tabela pj-tabela--acerto' }, [
      criarEl('thead', {}, [
        criarEl('tr', {}, [
          criarEl('th', { texto: 'Instituto' }),
          criarEl('th', { texto: 'Quando' }),
          criarEl('th', { texto: 'Amostra' }),
          criarEl('th', { texto: 'Erro' }),
        ]),
      ]),
      criarEl('tbody', {}, linhas),
    ]),
    mediana == null
      ? null
      : criarEl('p', {
          className: 'pj-nota pj-nota--destaque',
          texto:
            `Erro médio do campo (mediana): ${formatarPct(mediana)}. ` +
            `${a.acertaramOLider} de ${a.institutos.length} ` +
            `${a.institutos.length === 1 ? 'instituto apontou' : 'institutos apontaram'} ` +
            'em primeiro quem de fato ficou em primeiro.' +
            (a.margemReal != null && a.primeiroESegundo
              ? ` A margem real entre ${a.primeiroESegundo[0]} e ${a.primeiroESegundo[1]} ` +
                `foi de ${formatarPct(a.margemReal)}.`
              : ''),
        }),
    criarEl('p', {
      className: 'pj-nota',
      texto:
        'Mediana, e não média, no resumo do campo: um instituto muito fora puxaria a ' +
        'média e faria o conjunto parecer pior do que foi.',
    }),
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

  if (dados.destaque === 'nacional' && projecao.nacionalCru) {
    const cru = projecao.nacionalCru!;
    raiz.appendChild(
      criarEl('p', {
        className: dados.apuracaoEncerrada ? 'pj-final' : 'pj-cobertura',
        texto: dados.apuracaoEncerrada
          ? rotuloResultadoFinal(cru.secoesTotalizadas)
          : dados.apenasNacional
            ? rotuloApenasNacional(cru.secoesTotalizadas)
            : rotuloNacionalVenceEstadual(
                cru.secoesTotalizadas,
                projecao.coberturaNacionalEfetiva,
                projecao.porUf.length,
              ),
      }),
    );
    const maior = cru.candidatos[0]?.pctApurado ?? 0;
    raiz.appendChild(
      criarEl('section', { className: 'pj-secao' }, [
        criarEl('h2', {
          texto: dados.apuracaoEncerrada
            ? `Resultado final — ${rotuloTurno(projecao.turno)}`
            : 'Contagem parcial nacional',
        }),
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

  const acerto = montarAcerto(dados);
  if (acerto) raiz.appendChild(acerto);

  if (projecao.porUf.length > 0) raiz.appendChild(montarPorUf(projecao, dados.destaque));

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
  container.appendChild(pjMontarConteudo(casos.getProjecao('presidente')));
}
