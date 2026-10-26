/**
 * Grava uma amostra da apuração no repositório.
 *
 * O gráfico da noite é montado no navegador de quem olha, e por isso o
 * histórico dele começa quando a pessoa abre a página: quem chega às 22h não
 * vê as 19h. Este script resolve a outra metade — ele lê o TSE, projeta, e
 * acrescenta um ponto a `data/apuracao-serie.json`, que é versionado e vai no
 * bundle. Assim toda visita começa já com a noite inteira desenhada, e o
 * navegador só acrescenta o que aconteceu depois da última publicação.
 *
 * Rodar: `npm run data:apuracao-serie`
 *
 * Idempotente dentro do balde de cinco minutos: rodar seis vezes no mesmo
 * minuto não cria seis pontos, substitui o ponto daquele balde. É a mesma
 * regra do gráfico no navegador, e pelo mesmo motivo — a linha deve ganhar
 * densidade onde houve apuração, não onde alguém rodou o script.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { projetarApuracao } from '../src/domain/apuracao.js';
import type { Eleitorado } from '../src/domain/electorate.js';
import { buscarApuracao } from '../src/adapters/outbound/tse/tse-client.js';
import {
  acrescentarAmostra,
  baldeDeCincoMinutos,
  nomeCanonicoDaUrna,
  type AmostraDaNoite,
} from '../src/adapters/inbound/web/views/apuracao-layout.js';

const ARQUIVO = new URL('../data/apuracao-serie.json', import.meta.url);

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  'ZZ',
];

const ELEITORADO_EXTERIOR: Eleitorado = {
  uf: 'ZZ',
  eleitores: 916683,
  referencia: '2026-10',
  fonte: {
    nome: 'TSE — Divulgação de Resultados, arquivo oficial do exterior (campo "te"), 2º turno',
    url: 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz-c0001-e006258-u.json',
  },
};

interface ArquivoDaSerie {
  readonly observacao: string;
  readonly atualizadoEm: string;
  readonly amostras: readonly AmostraDaNoite[];
}

function lerArquivo(): ArquivoDaSerie {
  try {
    const bruto = JSON.parse(readFileSync(ARQUIVO, 'utf8')) as ArquivoDaSerie;
    return { ...bruto, amostras: bruto.amostras ?? [] };
  } catch {
    return { observacao: '', atualizadoEm: '', amostras: [] };
  }
}

async function principal(): Promise<void> {
  const eleitorado = [
    ...(JSON.parse(
      readFileSync(new URL('../data/electorate.json', import.meta.url), 'utf8'),
    ) as Eleitorado[]),
    ELEITORADO_EXTERIOR,
  ];

  const { dados, fontes } = await buscarApuracao((url) => fetch(url, { cache: 'no-store' }), {
    ufs: UFS,
    cargo: 'presidente',
    turno: 2,
    nomeCanonico: nomeCanonicoDaUrna,
  });

  const lidos = fontes.filter((f) => f.ok).length;
  if (lidos < fontes.length) {
    /*
     * Leitura INCOMPLETA não vira ponto — e não só a totalmente falha.
     *
     * Isto custou um ponto errado na série real: numa rodada o TSE devolveu
     * 26 dos 28 arquivos, e a amostra foi gravada como "98,34% apurado, Lula
     * 52,00%" quando o estado verdadeiro era 100,00% e 51,79%. As duas
     * unidades que faltaram não deixaram buraco visível: elas saíram da soma
     * E do denominador, então o resultado pareceu um número plausível, só que
     * de um país menor. No gráfico isso vira um degrau que não aconteceu.
     *
     * É o mesmo defeito que a tela já declara ("N de 28 não responderam, os
     * números estão incompletos"), e que aqui era pior, porque o arquivo é
     * versionado: o degrau ficaria no histórico para sempre.
     */
    const faltaram = fontes.filter((f) => !f.ok).map((f) => f.uf).join(', ');
    console.error(
      `Leitura incompleta: ${lidos} de ${fontes.length} arquivos. Faltaram: ${faltaram}. Nada gravado — amostra parcial viraria um degrau falso no gráfico.`,
    );
    process.exitCode = 1;
    return;
  }

  const projecao = projetarApuracao(dados, 'presidente', 2, eleitorado);
  if (projecao.validosApurados <= 0) {
    console.log('Ainda não há voto apurado. Nada gravado.');
    return;
  }

  const anterior = lerArquivo();
  const amostras = acrescentarAmostra(
    anterior.amostras,
    {
      em: baldeDeCincoMinutos(new Date()),
      processado: projecao.coberturaNacionalEfetiva,
      porCandidato: projecao.candidatos.map((c) => ({
        candidato: c.candidato,
        pctApurado: c.pctApurado,
        pctProjetado: c.pctProjetado,
      })),
    },
    2000,
  );

  const saida: ArquivoDaSerie = {
    observacao:
      'Histórico da apuração do 2º turno, amostrado de cinco em cinco minutos. Cada ponto traz, por candidato, o percentual APURADO (sobre os votos já contados) e o PROJETADO (contagem de cada UF dividida pela fração computada nela, somadas depois). Gravado por ingest/amostrar-apuracao.ts, lendo os arquivos oficiais da divulgação do TSE. Leitura falha ou sem voto não vira ponto: seria um mergulho a zero que nunca aconteceu.',
    atualizadoEm: new Date().toISOString(),
    amostras,
  };
  writeFileSync(ARQUIVO, `${JSON.stringify(saida, null, 2)}\n`, 'utf8');

  const ultimo = amostras[amostras.length - 1]!;
  console.log(
    `${amostras.length} amostras. Última (${ultimo.em}, ${ultimo.processado.toFixed(2)}% apurado, ${lidos}/${fontes.length} arquivos): ` +
      ultimo.porCandidato
        .map((c) => `${c.candidato} ${c.pctApurado.toFixed(2)}% apurado / ${c.pctProjetado.toFixed(2)}% projetado`)
        .join(' · '),
  );
}

await principal();
