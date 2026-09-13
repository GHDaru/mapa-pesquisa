/**
 * Junta os arquivos gravados por agentes de pesquisa em data/research/ nos
 * arquivos de dados consumidos pela aplicação em data/. Uso:
 *   node --import tsx ingest/merge-research.ts [--date YYYY-MM-DD]
 *
 * - data/research/polls-*.json -> mesclado em data/polls.json (dedupe por
 *   id; o arquivo processado por último vence; ordenado por dataFim desc).
 * - data/research/parties.json -> copiado para data/parties.json, se existir.
 * - data/research/senate-seats.json -> copiado para data/senate-seats.json, se existir.
 * - data/meta.json é reescrito com atualizadoEm = hoje (ou --date).
 *
 * Não valida pelo domínio (isso é responsabilidade de `npm run data:validate`,
 * que deve rodar em seguida).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const RESEARCH_DIR = path.join(DATA_DIR, 'research');

interface PesquisaBruta {
  id: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  publicadoEm?: string | null;
  resultados?: { pct?: number | null }[];
  [chave: string]: unknown;
}

function lerArg(nome: string): string | undefined {
  const args = process.argv.slice(2);
  const prefixo = `--${nome}=`;
  const comIgual = args.find((a) => a.startsWith(prefixo));
  if (comIgual) return comIgual.slice(prefixo.length);
  const idx = args.indexOf(`--${nome}`);
  if (idx !== -1 && args[idx + 1] !== undefined) return args[idx + 1];
  return undefined;
}

function hojeIso(): string {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(agora.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function escreverJson(caminho: string, dados: unknown): void {
  writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, 'utf-8');
}

function mesclarPolls(): number {
  const destino = path.join(DATA_DIR, 'polls.json');
  if (!existsSync(RESEARCH_DIR)) {
    console.log('data/research/ não existe — data/polls.json mantido como está.');
    return existsSync(destino) ? (JSON.parse(readFileSync(destino, 'utf-8')) as unknown[]).length : 0;
  }

  const arquivos = readdirSync(RESEARCH_DIR)
    .filter((f) => /^polls-.*\.json$/.test(f))
    .sort();

  if (arquivos.length === 0) {
    console.log('Nenhum arquivo data/research/polls-*.json encontrado — data/polls.json mantido como está.');
    return existsSync(destino) ? (JSON.parse(readFileSync(destino, 'utf-8')) as unknown[]).length : 0;
  }

  const porId = new Map<string, PesquisaBruta>();
  for (const arquivo of arquivos) {
    const caminho = path.join(RESEARCH_DIR, arquivo);
    const entradas = JSON.parse(readFileSync(caminho, 'utf-8')) as PesquisaBruta[];
    for (const entrada of entradas) {
      const temData = entrada.dataFim != null || entrada.publicadoEm != null || entrada.dataInicio != null;
      const temPct = Array.isArray(entrada.resultados) && entrada.resultados.some((r) => r.pct != null);
      if (!temData || !temPct) {
        console.log(`  descartada ${entrada.id}: ${!temData ? 'sem data' : 'sem percentuais'} (registro de pesquisa sem números na fonte)`);
        continue;
      }
      porId.set(entrada.id, entrada);
    }
    console.log(`  lido ${arquivo}: ${entradas.length} pesquisa(s)`);
  }

  const mescladas = [...porId.values()].sort((a, b) => {
    const dataA = a.dataFim ?? a.publicadoEm ?? a.dataInicio ?? '';
    const dataB = b.dataFim ?? b.publicadoEm ?? b.dataInicio ?? '';
    return dataB.localeCompare(dataA);
  });

  escreverJson(destino, mescladas);
  console.log(`data/polls.json escrito com ${mescladas.length} pesquisa(s) únicas (de ${arquivos.length} arquivo(s)).`);
  return mescladas.length;
}

function copiarSeExistir(nomeOrigem: string, nomeDestino: string): boolean {
  const origem = path.join(RESEARCH_DIR, nomeOrigem);
  if (!existsSync(origem)) {
    console.log(`data/research/${nomeOrigem} não encontrado — ${nomeDestino} mantido como está.`);
    return false;
  }
  const dados = JSON.parse(readFileSync(origem, 'utf-8')) as unknown;
  escreverJson(path.join(DATA_DIR, nomeDestino), dados);
  console.log(`${nomeDestino} atualizado a partir de data/research/${nomeOrigem}.`);
  return true;
}

function main(): void {
  console.log('=== Mesclando data/research/ em data/ ===\n');

  mesclarPolls();
  copiarSeExistir('parties.json', 'parties.json');
  copiarSeExistir('senate-seats.json', 'senate-seats.json');

  const data = lerArg('date') ?? hojeIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    console.error(`--date inválido: "${data}". Use o formato YYYY-MM-DD.`);
    process.exit(1);
  }
  escreverJson(path.join(DATA_DIR, 'meta.json'), { atualizadoEm: data });
  console.log(`\ndata/meta.json escrito com atualizadoEm = "${data}".`);
}

main();
