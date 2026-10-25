/**
 * O voto fora do país.
 *
 * O TSE publica o exterior como se fosse uma UF, de código `zz`: 1.351 seções
 * e 916.683 eleitores aptos no 2º turno de 2026 — mais que onze das 27
 * unidades da federação. Ele estava faltando aqui, e uma projeção que soma 27
 * recortes e chama o resultado de nacional deixa de fora quase um milhão de
 * eleitores sem dizer.
 *
 * O exterior não tem polígono no mapa do Brasil, então ele não pode ser
 * pintado como estado. Mas ele tem geografia própria, e ela é informativa: no
 * 1º turno de 2026 o exterior votou ao contrário do país. Daí a quebra por
 * continente, que o TSE permite porque publica um arquivo por cidade — são
 * 186 postos, de Abidjã a Zurique.
 *
 * ## Por que a lista mora aqui, escrita à mão
 *
 * O TSE publica o nome da cidade e nada mais: não publica país nem
 * continente. A ligação cidade → continente é conhecimento geográfico, não
 * dado do TSE, então ela fica explícita, versionada e testada — e o teste
 * exige que TODA cidade publicada esteja mapeada, para que nenhuma caia
 * silenciosamente num "outros" que esconderia voto.
 *
 * O critério de fronteira é o geoesquema M49 da ONU, que resolve os casos
 * transcontinentais de um jeito só: Turquia, Chipre, Armênia, Azerbaijão e
 * Geórgia na Ásia; Rússia na Europa. Sem um critério declarado, Ancara e
 * Istambul acabariam em continentes diferentes.
 */

export type Continente =
  | 'América do Sul'
  | 'América do Norte e Central'
  | 'Europa'
  | 'África'
  | 'Ásia'
  | 'Oceania';

export const CONTINENTES: readonly Continente[] = [
  'América do Sul',
  'América do Norte e Central',
  'Europa',
  'África',
  'Ásia',
  'Oceania',
];

/** Cada posto do exterior, pelo código de município do TSE. */
export interface PostoExterior {
  readonly codigo: string;
  readonly nome: string;
  readonly continente: Continente;
}

const AMERICA_DO_SUL: readonly (readonly [string, string])[] = [
  ['29319', 'ARTIGAS'], ['29327', 'ASSUNÇÃO'], ['29408', 'BOGOTÁ'], ['29467', 'BUENOS AIRES'],
  ['29475', 'CAIENA'], ['29505', 'CARACAS'], ['29521', 'CHUY'], ['29556', 'CIUDAD DEL ESTE'],
  ['29564', 'CIUDAD GUAYANA'], ['99210', 'COBIJA'], ['29572', 'COCHABAMBA'], ['29580', 'CONCEPCIÓN'],
  ['29602', 'CÓRDOBA'], ['29670', 'ENCARNACIÓN'], ['29718', 'GEORGETOWN'], ['29823', 'IQUITOS'],
  ['29904', 'LA PAZ'], ['29947', 'LIMA'], ['39004', 'MENDOZA'], ['30147', 'MONTEVIDÉU'],
  ['30279', 'PARAMARIBO'], ['30295', 'PASO LOS LIBRES'], ['30309', 'PEDRO JUAN CABALLERO'],
  ['99155', 'PUERTO IGUAZÚ'], ['99236', 'PUERTO QUIJARRO'], ['30392', 'QUITO'],
  ['30430', 'RIO BRANCO'], ['99244', 'RIVERA'], ['30465', 'SALTO DEL GUAIRÁ'],
  ['30473', 'SANTA CRUZ DE LA SIERRA'], ['99279', 'SANTA ELENA DE UAIRÉN'], ['30481', 'SANTIAGO'],
  ['99333', 'ST GEORGES DE LOYAPOCK'],
];

const AMERICA_DO_NORTE_E_CENTRAL: readonly (readonly [string, string])[] = [
  ['39080', 'ATLANTA'], ['38881', 'BELMOPAN'], ['29416', 'BOSTON'], ['29424', 'BRIDGETOWN'],
  ['99384', 'CASTRIES'], ['29513', 'CHICAGO'], ['98000', 'GUATEMALA'], ['30902', 'HARTFORD'],
  ['29777', 'HAVANA'], ['29807', 'HOUSTON'], ['99430', 'KINGSTON-JAMAICA'], ['29980', 'LOS ANGELES'],
  ['30074', 'MANÁGUA'], ['30104', 'MEXICO'], ['30112', 'MIAMI'], ['30155', 'MONTREAL'],
  ['99180', 'NASSAU'], ['30228', 'NOVA YORK'], ['99490', 'ORLANDO'], ['30252', 'OTTAWA'],
  ['30260', 'PANAMA'], ['30325', 'PORT OF SPAIN'], ['30333', 'PORTO PRÍNCIPE'],
  ['99147', 'SAINT JOHNS'], ['30490', 'SÃO DOMINGOS'], ['30503', 'SÃO FRANCISCO'],
  ['30511', 'SÃO JOSÉ'], ['30520', 'SÃO SALVADOR'], ['30600', 'TEGUCIGALPA'], ['30635', 'TORONTO'],
  ['39063', 'VANCOUVER'], ['30783', 'WASHINGTON'],
];

const EUROPA: readonly (readonly [string, string])[] = [
  ['30457', 'AMSTERDÃ'], ['29335', 'ATENAS'], ['29351', 'BARCELONA'], ['29378', 'BELGRADO'],
  ['29386', 'BERLIM'], ['39209', 'BRATISLAVA'], ['29432', 'BRUXELAS'], ['29440', 'BUCARESTE'],
  ['29459', 'BUDAPESTE'], ['29599', 'COPENHAGUE'], ['29661', 'DUBLIN'], ['99503', 'EDIMBURGO'],
  ['29688', 'ESTOCOLMO'], ['30961', 'FARO'], ['29696', 'FRANKFURT'], ['29700', 'GENEBRA'],
  ['29785', 'HELSINQUE'], ['29858', 'KIEV'], ['29955', 'LISBOA'], ['39160', 'LIUBLIANA'],
  ['29971', 'LONDRES'], ['30066', 'MADRI'], ['99511', 'MARSELHA'], ['30120', 'MILÃO'],
  ['30163', 'MOSCOU'], ['30180', 'MUNIQUE'], ['30244', 'OSLO'], ['30287', 'PARIS'],
  ['30341', 'PORTO'], ['30350', 'PRAGA'], ['30449', 'ROMA'], ['30988', 'SARAJEVO'],
  ['30546', 'SÓFIA'], ['99317', 'TALIN'], ['99139', 'TIRANA'], ['30740', 'VARSÓVIA'],
  ['30767', 'VIENA'], ['39020', 'ZAGREB'], ['30864', 'ZURIQUE'],
];

const AFRICA: readonly (readonly [string, string])[] = [
  ['29254', 'ABIDJÃ'], ['99198', 'ABUJA'], ['29270', 'ACCRA'], ['99325', 'ADIS ABEBA'],
  ['29300', 'ARGEL'], ['99350', 'BAMAKO'], ['29394', 'BISSAU'], ['39187', 'BRAZZAVILLE'],
  ['29483', 'CAIRO'], ['29530', 'CIDADE DO CABO'], ['38903', 'CONACRI'], ['38920', 'COTONOU'],
  ['29610', 'DACAR'], ['38962', 'DAR ES SALAAM'], ['30669', 'GABORONE'], ['29769', 'HARARE'],
  ['29815', 'IAUNDÊ'], ['29874', 'KINSHASA'], ['29912', 'LAGOS'], ['29939', 'LIBREVILLE'],
  ['99341', 'LILONGUE'], ['29963', 'LOMÉ'], ['29998', 'LUANDA'], ['99287', 'LUSACA'],
  ['39263', 'MALABO'], ['30090', 'MAPUTO'], ['30201', 'NAIRÓBI'], ['30368', 'PRAIA'],
  ['30376', 'PRETÓRIA'], ['30406', 'RABAT'], ['39225', 'SÃO TOMÉ'], ['30686', 'TRÍPOLI'],
  ['30708', 'TUNIS'], ['39284', 'UAGADUGU'], ['30821', 'WINDHOEK'],
];

const ASIA: readonly (readonly [string, string])[] = [
  ['29262', 'ABU DHABI'], ['29289', 'AMÃ'], ['29297', 'ANCARA'], ['39241', 'ASTANA'],
  ['99171', 'BAGDÁ'], ['39128', 'BAKU'], ['29343', 'BANGKOK'], ['99473', 'BAREIN'],
  ['29360', 'BEIRUTE'], ['30651', 'CANTÃO'], ['30929', 'COLOMBO'], ['29629', 'DACCA'],
  ['29637', 'DAMASCO'], ['29653', 'DOHA'], ['29645', 'DÍLI'], ['29742', 'HAMAMATSU'],
  ['29750', 'HANÓI'], ['29793', 'HONG KONG'], ['38989', 'IEREVAN'], ['29831', 'ISLAMABADE'],
  ['39306', 'ISTAMBUL'], ['29840', 'JACARTA'], ['29173', 'KATMANDU'], ['29882', 'KUAITE'],
  ['29890', 'KUALA LUMPUR'], ['30082', 'MANILA'], ['39102', 'MASCATE'], ['30171', 'MUMBAI'],
  ['30198', 'NAGÓIA'], ['39322', 'NICOSIA'], ['30210', 'NOVA DELHI'], ['30317', 'PEQUIM'],
  ['99295', 'PYONGYANG'], ['30414', 'RAMALLAH'], ['30422', 'RIADE'], ['30538', 'SEUL'],
  ['29548', 'SINGAPURA'], ['30570', 'TAIPÉ'], ['99104', 'TBILISI'], ['30597', 'TEERÃ'],
  ['30619', 'TEL AVIV'], ['30627', 'TÓQUIO'], ['30848', 'XANGAI'], ['99376', 'YANGON'],
];

const OCEANIA: readonly (readonly [string, string])[] = [
  ['29491', 'CAMBERRA'], ['30562', 'SYDNEY'], ['30805', 'WELLINGTON'],
];

export const POSTOS_DO_EXTERIOR: readonly PostoExterior[] = [
  ...AMERICA_DO_SUL.map(([codigo, nome]) => ({ codigo, nome, continente: 'América do Sul' as const })),
  ...AMERICA_DO_NORTE_E_CENTRAL.map(([codigo, nome]) => ({ codigo, nome, continente: 'América do Norte e Central' as const })),
  ...EUROPA.map(([codigo, nome]) => ({ codigo, nome, continente: 'Europa' as const })),
  ...AFRICA.map(([codigo, nome]) => ({ codigo, nome, continente: 'África' as const })),
  ...ASIA.map(([codigo, nome]) => ({ codigo, nome, continente: 'Ásia' as const })),
  ...OCEANIA.map(([codigo, nome]) => ({ codigo, nome, continente: 'Oceania' as const })),
];

/** URL do arquivo de um posto do exterior na divulgação do TSE. */
export function urlDoPosto(codigo: string, cargo: '0001', eleicao: number): string {
  const e = String(eleicao).padStart(6, '0');
  return `https://resultados.tse.jus.br/oficial/ele2026/${eleicao}/dados/zz/zz${codigo}-c${cargo}-e${e}-u.json`;
}

/* ──────────────── a leitura de cada posto e a soma por continente ──────── */

/** O que importa do arquivo de um posto, em números crus. */
export interface LeituraDePosto {
  readonly codigo: string;
  readonly secoesTotalizadas: number;
  readonly secoesTotal: number;
  readonly eleitores: number;
  readonly candidatos: readonly { readonly candidato: string; readonly votos: number }[];
}

export interface LinhaContinente {
  readonly continente: Continente;
  readonly postos: number;
  /** Postos cujo arquivo respondeu. Falha não some: ela aparece como lacuna. */
  readonly postosLidos: number;
  readonly eleitores: number;
  readonly secoesTotalizadas: number;
  readonly secoesTotal: number;
  /** Seções totalizadas sobre seções existentes, em percentual. Soma / soma. */
  readonly processado: number;
  readonly votos: readonly { readonly candidato: string; readonly votos: number }[];
  readonly lider: string | null;
}

/**
 * Soma os postos de cada continente.
 *
 * Como no recorte por região, a regra é soma pura: o percentual apurado é
 * seções totalizadas sobre seções existentes, e a divisão da soma pela soma
 * já pesa cada posto pelo tamanho dele. Média de percentuais entre Tóquio e
 * Artigas seria outro número, e errado.
 *
 * Aqui NÃO há projeção. O exterior inteiro já entra na projeção nacional pelo
 * recorte `zz`, que o TSE publica fechado; esta quebra é descritiva — ela diz
 * onde o voto de fora está sendo contado e para quem está indo, não estima o
 * que falta. Projetar por continente exigiria tratar cada continente como
 * unidade de totalização, que ele não é.
 */
export function agregarPorContinente(
  leituras: readonly LeituraDePosto[],
  ordem: readonly [string, string],
): readonly LinhaContinente[] {
  const porCodigo = new Map(leituras.map((l) => [l.codigo, l]));

  return CONTINENTES.map((continente): LinhaContinente => {
    const postos = POSTOS_DO_EXTERIOR.filter((p) => p.continente === continente);
    const lidos = postos.map((p) => porCodigo.get(p.codigo)).filter((l): l is LeituraDePosto => l != null);

    const votos = ordem.map((candidato) => ({
      candidato,
      votos: lidos.reduce(
        (s, l) => s + (l.candidatos.find((c) => c.candidato === candidato)?.votos ?? 0),
        0,
      ),
    }));
    const melhor = [...votos].sort((a, b) => b.votos - a.votos)[0];
    const secoesTotalizadas = lidos.reduce((s, l) => s + l.secoesTotalizadas, 0);
    const secoesTotal = lidos.reduce((s, l) => s + l.secoesTotal, 0);

    return {
      continente,
      postos: postos.length,
      postosLidos: lidos.length,
      eleitores: lidos.reduce((s, l) => s + l.eleitores, 0),
      secoesTotalizadas,
      secoesTotal,
      processado: secoesTotal > 0 ? (secoesTotalizadas / secoesTotal) * 100 : 0,
      votos,
      // Sem voto contado não há líder: um empate em zero não é uma medida.
      lider: melhor && melhor.votos > 0 ? melhor.candidato : null,
    };
  });
}

/**
 * Lê os 186 postos e devolve a soma por continente.
 *
 * São 186 arquivos estáticos, buscados em paralelo. É muita requisição para
 * uma tela de apuração, então quem chama só deve chamar quando o painel do
 * exterior estiver aberto — a quebra por continente é visão auxiliar, e o
 * total do exterior já vem de graça no recorte `zz`.
 *
 * Posto que não responde NÃO derruba a leitura: ele fica de fora da soma e é
 * contado em `postosLidos`, para a tela poder dizer que a leitura do
 * continente está incompleta em vez de mostrar um total menor sem avisar.
 */
export async function buscarExterior(
  buscar: (url: string) => Promise<Response>,
  opcoes: {
    readonly eleicao: number;
    readonly ordem: readonly [string, string];
    readonly nomeCanonico?: (nomeDeUrna: string) => string;
  },
): Promise<{ linhas: readonly LinhaContinente[]; lidos: number; falhas: number }> {
  const canonico = opcoes.nomeCanonico ?? ((n: string) => n);

  const leituras = await Promise.all(
    POSTOS_DO_EXTERIOR.map(async (posto): Promise<LeituraDePosto | null> => {
      try {
        const resp = await buscar(urlDoPosto(posto.codigo, '0001', opcoes.eleicao));
        if (!resp.ok) return null;
        const json = (await resp.json()) as {
          s?: { st?: string; ts?: string };
          e?: { te?: string };
          carg?: readonly {
            agr?: readonly { par?: readonly { cand?: readonly { nm?: string; nmu?: string; vap?: string }[] }[] }[];
          }[];
        };
        const numero = (t: string | undefined): number => {
          const n = Number(String(t ?? '0').replace(/\./g, '').replace(',', '.'));
          return Number.isFinite(n) ? n : 0;
        };
        const candidatos: { candidato: string; votos: number }[] = [];
        for (const cargo of json.carg ?? []) {
          for (const agr of cargo.agr ?? []) {
            for (const par of agr.par ?? []) {
              for (const c of par.cand ?? []) {
                const nome = (c.nmu ?? c.nm ?? '').trim();
                if (nome === '') continue;
                candidatos.push({ candidato: canonico(nome), votos: numero(c.vap) });
              }
            }
          }
        }
        return {
          codigo: posto.codigo,
          secoesTotalizadas: numero(json.s?.st),
          secoesTotal: numero(json.s?.ts),
          eleitores: numero(json.e?.te),
          candidatos,
        };
      } catch {
        return null;
      }
    }),
  );

  const ok = leituras.filter((l): l is LeituraDePosto => l != null);
  return {
    linhas: agregarPorContinente(ok, opcoes.ordem),
    lidos: ok.length,
    falhas: leituras.length - ok.length,
  };
}
