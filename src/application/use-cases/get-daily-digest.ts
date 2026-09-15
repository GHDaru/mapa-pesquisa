import type { Repositorios } from '../ports.js';
import { montarDigestDiario, type DigestDiario } from '../../domain/digest.js';

export type { DigestDiario } from '../../domain/digest.js';

/**
 * Caso de uso: resumo do dia para a capa explicativa da home
 * (`views/home-view.ts`) — quantidade, cobertura e proveniência da base de
 * pesquisas, sem nenhum nome de candidato, percentual, projeção de cadeira
 * ou estimativa de votos (ver docs/briefing-landing-page.md, "mudança de
 * conteúdo"). A lógica de fato mora no serviço de domínio puro
 * `montarDigestDiario` (`domain/digest.ts`); este caso de uso só busca as
 * pesquisas, o total de partidos e o eleitorado total nos repositórios.
 */
export function criarGetDailyDigest(repos: Repositorios) {
  return function getDailyDigest(): DigestDiario {
    const pesquisas = repos.polls.todas();
    const atualizadoEm = repos.meta.atualizadoEm();
    const totalPartidos = repos.parties.todos().length;

    const eleitorado = repos.electorate.todos();
    const eleitoradoTotal = eleitorado.length > 0 ? eleitorado.reduce((soma, e) => soma + e.eleitores, 0) : null;

    return montarDigestDiario({ pesquisas, atualizadoEm, totalPartidos, eleitoradoTotal });
  };
}
