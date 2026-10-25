/**
 * Leitura da divulgação oficial do TSE, direto do browser.
 *
 * A divulgação é JSON estático e **manda CORS com a nossa origem** — conferido
 * em 25/10 contra `https://ghdaru.github.io`, que é de onde o site é servido.
 * Então o botão atualizar busca o dado real no cliente, sem proxy e sem
 * intermediário que pudesse alterar o número no caminho.
 *
 * O que esta camada NÃO faz: interpretar. Ela traduz o JSON do TSE para
 * `DadosApuracaoRecorte` e para. Projeção, cobertura e veredito são do
 * domínio (`projetarApuracao`), que já existe e já é testado.
 *
 * ## As duas armadilhas da fonte
 *
 * 1. **`s.pst` a 100 não é totalização encerrada.** No 1º turno, doze recortes
 *    já em 100% ainda diferiam de 3 a 280 votos do definitivo. O campo que
 *    fecha é `tf === 's'`, e é ele que vai para `finalizada`.
 * 2. **O eleitorado federal de uma UF é MAIOR que o estadual**, por causa do
 *    voto em trânsito. Nunca cruze `e.te` de cargos diferentes.
 *
 * E `comparecimento + abstenções = e.esa` (aptos nas seções INSTALADAS), não
 * `e.te`.
 */

import type { CargoApuracao, DadosApuracao, DadosApuracaoRecorte } from '../../../domain/apuracao.js';

/** Códigos de eleição de 2026, por turno e esfera. */
export const ELEICOES = {
  federal: { 1: 6257, 2: 6258 },
  estadual: { 1: 6259, 2: 6260 },
} as const;

/** Códigos de cargo, como o nome do arquivo os escreve (4 dígitos). */
export const CARGOS: Readonly<Record<CargoApuracao, string>> = {
  presidente: '0001',
  governador: '0003',
  senador: '0005',
};

export const BASE_TSE = 'https://resultados.tse.jus.br/oficial';

/**
 * O endereço de um recorte.
 *
 * O código da eleição vai **zero-preenchido em seis dígitos** (`e006258`, não
 * `e06258`) — errar isso devolve 404, e foi o primeiro erro que cometi contra
 * esta fonte.
 */
export function urlDoRecorte(uf: string, cargo: CargoApuracao, eleicao: number): string {
  const u = uf.toLowerCase();
  const e = String(eleicao).padStart(6, '0');
  return `${BASE_TSE}/ele2026/${eleicao}/dados/${u}/${u}-c${CARGOS[cargo]}-e${e}-u.json`;
}

/** Uma leitura declarada: o que a página mostra para o número ser conferível. */
export interface FonteLida {
  readonly url: string;
  readonly uf: string;
  readonly lidoEm: string;
  readonly ok: boolean;
  /** Mensagem curta quando `ok` é falso — nunca silencioso. */
  readonly erro?: string;
}

const num = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

interface CandidatoTse {
  readonly nm?: string;
  readonly nmu?: string;
  readonly vap?: string;
}
interface PartidoTse {
  readonly sg?: string;
  readonly n?: string;
  readonly cand?: readonly CandidatoTse[];
}
interface JsonTse {
  readonly tf?: string;
  readonly s?: { readonly pst?: string };
  readonly e?: { readonly te?: string; readonly esa?: string; readonly c?: string; readonly a?: string };
  readonly v?: { readonly vv?: string; readonly vb?: string; readonly tvn?: string };
  readonly carg?: readonly { readonly agr?: readonly { readonly par?: readonly PartidoTse[] }[] }[];
}

/**
 * Traduz um arquivo do TSE para um recorte do domínio.
 *
 * `nomeCanonico` existe porque a fonte usa **nome de urna** ("FLAVIO
 * BOLSONARO", "LULA") e o ranking de institutos casa pesquisa com apuração
 * **por nome**. Gravar o nome de urna quebraria `margemReal` e a contagem de
 * acertos — então quem chama passa o dicionário e esta função não inventa.
 */
export function recorteDoJsonTse(
  json: JsonTse,
  opcoes: {
    readonly uf: string | null;
    readonly cargo: CargoApuracao;
    readonly turno: 1 | 2;
    readonly url: string;
    readonly nomeCanonico?: (nomeDeUrna: string) => string;
  },
): DadosApuracaoRecorte & { readonly finalizada: boolean } {
  const canonico = opcoes.nomeCanonico ?? ((n: string) => n);
  const candidatos: { candidato: string; partido: string | null; votos: number }[] = [];
  for (const cargo of json.carg ?? []) {
    for (const agr of cargo.agr ?? []) {
      for (const par of agr.par ?? []) {
        for (const c of par.cand ?? []) {
          const nomeDeUrna = (c.nmu ?? c.nm ?? '').trim();
          if (nomeDeUrna === '') continue;
          candidatos.push({
            candidato: canonico(nomeDeUrna),
            partido: par.sg ?? null,
            votos: num(c.vap),
          });
        }
      }
    }
  }
  candidatos.sort((a, b) => b.votos - a.votos);

  const validos = num(json.v?.vv);
  return {
    cargo: opcoes.cargo,
    uf: opcoes.uf,
    turno: opcoes.turno,
    secoesTotalizadas: num(json.s?.pst),
    candidatos,
    validosTotal: validos > 0 ? validos : null,
    brancos: num(json.v?.vb),
    nulos: num(json.v?.tvn),
    abstencoes: num(json.e?.a),
    // `tf` é o que fecha de verdade; `s.pst` a 100 não basta.
    finalizada: json.tf === 's',
    fonte: { nome: 'TSE — divulgação oficial', url: opcoes.url },
  };
}

/**
 * Busca um conjunto de UFs e devolve os dados **junto com as fontes lidas**.
 *
 * As fontes voltam sempre, inclusive as que falharam: a página declara de onde
 * veio cada número, e uma UF que não respondeu tem de aparecer como não lida,
 * não sumir. Uma leitura parcial é melhor que nenhuma — a projeção do domínio
 * já sabe trabalhar com UF faltando e nomeia as que faltam.
 */
export async function buscarApuracao(
  buscar: (url: string) => Promise<Response>,
  opcoes: {
    readonly ufs: readonly string[];
    readonly cargo: CargoApuracao;
    readonly turno: 1 | 2;
    readonly esfera?: 'federal' | 'estadual';
    readonly nomeCanonico?: (nomeDeUrna: string) => string;
    readonly agora?: () => Date;
  },
): Promise<{ dados: DadosApuracao; fontes: readonly FonteLida[] }> {
  const agora = opcoes.agora ?? (() => new Date());
  const esfera = opcoes.esfera ?? (opcoes.cargo === 'presidente' ? 'federal' : 'estadual');
  const eleicao = ELEICOES[esfera][opcoes.turno];

  const leituras = await Promise.all(
    opcoes.ufs.map(async (uf) => {
      const url = urlDoRecorte(uf, opcoes.cargo, eleicao);
      const lidoEm = agora().toISOString();
      try {
        const resp = await buscar(url);
        if (!resp.ok) {
          return { fonte: { url, uf, lidoEm, ok: false, erro: `HTTP ${resp.status}` }, recorte: null };
        }
        const json = (await resp.json()) as JsonTse;
        const recorte = recorteDoJsonTse(json, {
          uf: uf === 'BR' ? null : uf,
          cargo: opcoes.cargo,
          turno: opcoes.turno,
          url,
          ...(opcoes.nomeCanonico ? { nomeCanonico: opcoes.nomeCanonico } : {}),
        });
        return { fonte: { url, uf, lidoEm, ok: true }, recorte };
      } catch (e) {
        const erro = e instanceof Error ? e.message : String(e);
        return { fonte: { url, uf, lidoEm, ok: false, erro }, recorte: null };
      }
    }),
  );

  return {
    dados: {
      atualizadoEm: agora().toISOString(),
      recortes: leituras
        .map((l) => l.recorte)
        .filter((r): r is DadosApuracaoRecorte & { finalizada: boolean } => r != null),
    },
    fontes: leituras.map((l) => l.fonte),
  };
}
