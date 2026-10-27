import { describe, expect, it } from 'vitest';
import { criarCasosDeUso } from '../index.js';
import { carregarDados } from '../../../adapters/outbound/json/carregar-dados.js';
import { dataReferenciaDaPesquisa } from '../../../domain/poll-accuracy.js';

/**
 * O ranking do 2º turno só pontua pesquisa com campo POSTERIOR ao 1º turno.
 *
 * Antes de 04/10, "Lula x Flávio" media um 2º turno HIPOTÉTICO: o eleitor não
 * sabia quem passaria. Pontuar essas rodadas contra o resultado real é cobrar
 * de uma medição a resposta de outra pergunta, e distorce nos DOIS sentidos —
 * algumas "acertam" o líder por tabela, outras erram sem terem medido a
 * disputa que aconteceu.
 *
 * O agregado já respeitava essa descontinuidade desde 09/10; o ranking não.
 * A regra existia num lugar só, que é a assinatura deste defeito — a mesma de
 * 17/10, quando a guarda de base protegia o agregado e não a série.
 */
describe('ranking do 2º turno, nos dados reais', () => {
  const repos = carregarDados();
  const casos = criarCasosDeUso(repos, { hoje: () => new Date('2026-10-26T12:00:00Z') });
  const projecao = casos.getProjecao('presidente', 'auto') as unknown as {
    readonly acerto: {
      readonly institutos: readonly { readonly instituto: string; readonly dataReferencia: string }[];
      readonly margemReal: number | null;
    } | null;
  };

  it('mede o 2º turno e tem fichas para medir', () => {
    expect(projecao.acerto).not.toBeNull();
    expect(projecao.acerto!.institutos.length).toBeGreaterThan(0);
  });

  it('nenhuma ficha pontuada tem campo anterior ou igual ao dia do 1º turno', () => {
    const antigas = projecao.acerto!.institutos.filter((i) => i.dataReferencia <= '2026-10-04');
    expect(antigas.map((i) => `${i.instituto} ${i.dataReferencia}`)).toEqual([]);
  });

  it('a base AINDA CONTÉM rodadas de 2º turno anteriores a 04/10 — elas são excluídas, não inexistentes', () => {
    // Sem esta asserção, a de cima passaria num mundo onde a base
    // simplesmente não tem pesquisa antiga, e deixaria de provar a guarda.
    //
    // A régua é `dataReferenciaDaPesquisa`, a MESMA que a guarda usa: medir a
    // base com um critério e filtrar com outro deixaria a asserção passar sem
    // falar da guarda.
    const antigas = casos
      .getPresidentialAggregate()
      .todasAsPesquisas.filter(
        (p) => p.disputa.turno === 2 && dataReferenciaDaPesquisa(p) <= '2026-10-04',
      );
    expect(antigas.length).toBeGreaterThan(0);
  });

  it('a procedência não repete o mesmo rótulo 28 vezes, e cada arquivo segue citável', () => {
    // A tela imprimia 28 links com texto idêntico e 29 parágrafos de ressalva
    // idênticos. Repetição não é procedência: ela escondia a única linha que
    // difere, RR com a totalização ainda aberta (tf="n").
    const dados = casos.getProjecao('presidente', 'auto') as unknown as {
      readonly fontes: readonly {
        readonly nome: string;
        readonly recortes: readonly { readonly uf: string; readonly url: string }[];
      }[];
      readonly observacoes: readonly string[];
    };
    const rotulos = dados.fontes.map((f) => f.nome);
    expect(new Set(rotulos).size).toBe(rotulos.length);
    expect(new Set(dados.observacoes).size).toBe(dados.observacoes.length);

    // Nenhum arquivo foi perdido no agrupamento: a soma dos recortes de todos
    // os grupos é o número de URLs distintas.
    const urls = dados.fontes.flatMap((f) => f.recortes.map((r) => r.url));
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBeGreaterThanOrEqual(28);

    // E uma linha que difira continua ganhando grupo próprio. A versão
    // anterior desta asserção dizia "RR está sozinha sob o rótulo de
    // totalização aberta" — verdade em 26/10 às 04h, falsa às 23h, quando RR
    // declarou tf="s" e os 29 recortes passaram a ter o mesmo rótulo. Era o
    // defeito da casa num TESTE: estado do mundo escrito como invariante.
    // O que é invariante é o agrupamento ser POR RÓTULO, sem mesclar rótulos
    // diferentes nem partir um rótulo em dois grupos.
    const rotulosDistintos = new Set(
      repos.apuracao
        .dados()
        .recortes.filter((r) => r.cargo === 'presidente' && r.turno === 2)
        .map((r) => r.fonte.nome),
    );
    expect(dados.fontes.length).toBe(rotulosDistintos.size);
  });

  it('a tabela de comparação respeita a MESMA guarda do ranking', () => {
    // Era o terceiro lugar que precisava da regra, e ficou de fora: a
    // comparação agregava as 100 fichas do confronto, 71 com campo anterior a
    // 04/10, e publicava erro 0,38 ponto menor que o do agregado que a própria
    // página classifica. Dois números do mesmo projeto para a mesma pergunta.
    const dados = casos.getProjecao('presidente', 'auto') as unknown as {
      readonly comparacao: readonly {
        readonly candidato: string;
        readonly pctPesquisas: number | null;
        readonly pctProjetado: number;
      }[];
    };
    const porNome = new Map(dados.comparacao.map((c) => [c.candidato, c]));
    const lula = porNome.get('Luiz Inácio Lula da Silva')!;
    const flavio = porNome.get('Flávio Bolsonaro')!;

    // Renormalizado para válidos, o agregado com guarda dá Lula 48,9056 x
    // Flávio 51,0944. Sem guarda daria 49,0940 x 50,9060 — o teste distingue
    // os dois, que é o ponto.
    const soma = lula.pctPesquisas! + flavio.pctPesquisas!;
    expect((100 * lula.pctPesquisas!) / soma).toBeCloseTo(48.9056, 3);
    expect((100 * flavio.pctPesquisas!) / soma).toBeCloseTo(51.0944, 3);

    // E o erro na margem é o da guarda: −5,7592, não −5,3824.
    const margemPesquisas = (100 * (lula.pctPesquisas! - flavio.pctPesquisas!)) / soma;
    const margemReal = lula.pctProjetado - flavio.pctProjetado;
    expect(margemPesquisas - margemReal).toBeCloseTo(-5.7592, 3);
  });

  it('a margem real do 2º turno é a do 2º turno, não a do 1º', () => {
    // 1,865004 é a margem do 1º turno. Reusá-la foi erro previsto no
    // procedimento da rotina, e é o tipo de número que passa despercebido
    // porque tem a cara certa.
    expect(projecao.acerto!.margemReal).not.toBeCloseTo(1.865004, 4);
    expect(projecao.acerto!.margemReal).toBeGreaterThan(3);
  });
});
