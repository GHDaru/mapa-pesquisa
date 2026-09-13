/**
 * Valida data/*.json pelo domínio e imprime um resumo. Uso:
 *   node --import tsx ingest/validate.ts
 * Sai com código 1 quando há erro estrutural (dado que falha na validação do
 * domínio). Lacunas de cobertura (UF sem pesquisa, partido não cadastrado)
 * são informativas e não causam falha.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type DadosEleitorado, type Eleitorado, criarEleitorado } from '../src/domain/electorate.js';
import { type DadosPartido, type Partido, criarPartido } from '../src/domain/party.js';
import { type DadosPesquisa, type Pesquisa, criarPesquisa } from '../src/domain/poll.js';
import { UFS } from '../src/domain/race.js';
import { type DadosCadeiraSenado, criarCadeiraSenado } from '../src/domain/senate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

interface ErroValidacao {
  arquivo: string;
  mensagem: string;
}

function lerJson<T>(nomeArquivo: string): T {
  const caminho = path.join(DATA_DIR, nomeArquivo);
  const conteudo = readFileSync(caminho, 'utf-8');
  return JSON.parse(conteudo) as T;
}

function main(): void {
  const erros: ErroValidacao[] = [];

  const pollsRaw = lerJson<DadosPesquisa[]>('polls.json');
  const partiesRaw = lerJson<DadosPartido[]>('parties.json');
  const seatsRaw = lerJson<DadosCadeiraSenado[]>('senate-seats.json');
  const metaRaw = lerJson<{ atualizadoEm?: string }>('meta.json');
  const electorateRaw = lerJson<DadosEleitorado[]>('electorate.json');

  const partidos: Partido[] = [];
  for (const dados of partiesRaw) {
    try {
      partidos.push(criarPartido(dados));
    } catch (e) {
      erros.push({ arquivo: 'parties.json', mensagem: (e as Error).message });
    }
  }

  const pesquisas: Pesquisa[] = [];
  for (const dados of pollsRaw) {
    try {
      pesquisas.push(criarPesquisa(dados));
    } catch (e) {
      erros.push({ arquivo: 'polls.json', mensagem: (e as Error).message });
    }
  }

  for (const dados of seatsRaw) {
    try {
      criarCadeiraSenado(dados);
    } catch (e) {
      erros.push({ arquivo: 'senate-seats.json', mensagem: (e as Error).message });
    }
  }

  const eleitorado: Eleitorado[] = [];
  for (const dados of electorateRaw) {
    try {
      eleitorado.push(criarEleitorado(dados));
    } catch (e) {
      erros.push({ arquivo: 'electorate.json', mensagem: (e as Error).message });
    }
  }

  const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !metaRaw?.atualizadoEm ||
    !DATA_ISO_REGEX.test(metaRaw.atualizadoEm) ||
    Number.isNaN(Date.parse(metaRaw.atualizadoEm))
  ) {
    erros.push({
      arquivo: 'meta.json',
      mensagem: `campo "atualizadoEm" ausente ou inválido: "${metaRaw?.atualizadoEm}".`,
    });
  }

  console.log('=== Resumo dos dados (data/*.json) ===\n');

  const porCargo: Record<string, number> = {};
  for (const p of pesquisas) {
    porCargo[p.disputa.cargo] = (porCargo[p.disputa.cargo] ?? 0) + 1;
  }
  console.log(`Pesquisas válidas: ${pesquisas.length}`);
  for (const cargo of ['presidente', 'governador', 'senador']) {
    console.log(`  - ${cargo}: ${porCargo[cargo] ?? 0}`);
  }

  const ufsComGovernador = new Set(
    pesquisas.filter((p) => p.disputa.cargo === 'governador').map((p) => p.disputa.uf),
  );
  const ufsComSenador = new Set(
    pesquisas.filter((p) => p.disputa.cargo === 'senador').map((p) => p.disputa.uf),
  );
  const ufsSemGovernador = UFS.filter((uf) => !ufsComGovernador.has(uf));
  const ufsSemSenador = UFS.filter((uf) => !ufsComSenador.has(uf));

  console.log(`\nUFs sem nenhuma pesquisa de governador (${ufsSemGovernador.length}/${UFS.length}):`);
  console.log(ufsSemGovernador.length > 0 ? `  ${ufsSemGovernador.join(', ')}` : '  (nenhuma)');

  console.log(`\nUFs sem nenhuma pesquisa de senador (${ufsSemSenador.length}/${UFS.length}):`);
  console.log(ufsSemSenador.length > 0 ? `  ${ufsSemSenador.join(', ')}` : '  (nenhuma)');

  const semRegistro = pesquisas.filter((p) => p.registroTSE.naoRegistrada);
  console.log(`\nPesquisas sem registro TSE: ${semRegistro.length}`);
  for (const p of semRegistro) console.log(`  - ${p.id}`);

  const siglasConhecidas = new Set(partidos.map((p) => p.sigla));
  const siglasCitadas = new Set<string>();
  for (const p of pesquisas) {
    for (const r of p.resultados) {
      if (r.partido) siglasCitadas.add(r.partido);
    }
  }
  const siglasFaltantes = [...siglasCitadas].filter((s) => !siglasConhecidas.has(s)).sort();
  console.log(`\nPartidos citados em pesquisas mas ausentes de parties.json: ${siglasFaltantes.length}`);
  for (const s of siglasFaltantes) console.log(`  - ${s}`);

  const ufsComEleitorado = new Set(eleitorado.map((e) => e.uf));
  const ufsSemEleitorado = UFS.filter((uf) => !ufsComEleitorado.has(uf));
  const ufsComPresidencialEstadual = new Set(
    pesquisas.filter((p) => p.disputa.cargo === 'presidente' && p.disputa.uf !== 'BR').map((p) => p.disputa.uf),
  );
  console.log(`\nEleitorado (data/electorate.json): ${eleitorado.length}/${UFS.length} UFs cadastradas.`);
  if (ufsSemEleitorado.length > 0) {
    console.log(`  UFs sem eleitorado cadastrado: ${ufsSemEleitorado.join(', ')}`);
  }
  console.log(`Pesquisas presidenciais estaduais (uf !== "BR"): ${ufsComPresidencialEstadual.size}/${UFS.length} UFs.`);

  if (erros.length > 0) {
    console.log(`\n=== Erros estruturais (${erros.length}) ===`);
    for (const erro of erros) console.log(`  [${erro.arquivo}] ${erro.mensagem}`);
    console.log('\nValidação FALHOU.');
    process.exit(1);
  }

  console.log('\nValidação OK — nenhum erro estrutural.');
}

main();
