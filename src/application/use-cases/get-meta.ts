import type { Repositorios } from '../ports.js';

export interface MetaInfo {
  /** Data ISO (YYYY-MM-DD) da última atualização dos dados (data/meta.json). */
  readonly atualizadoEm: string;
}

/**
 * Caso de uso: metadados de publicação do site — hoje só a data da última
 * atualização, lida de `data/meta.json` via `MetaRepository`. Usado pela
 * tela inicial (`views/home-view.ts`) para o selo "Atualizado em ..." do
 * hero, que já aparece no cabeçalho global (`main.ts`) mas precisa também
 * ser lido a partir de um caso de uso — nenhuma view lê repositórios
 * diretamente (ver docs/architecture.md).
 */
export function criarGetMeta(repos: Repositorios) {
  return function getMeta(): MetaInfo {
    return { atualizadoEm: repos.meta.atualizadoEm() };
  };
}
