import type { ApuracaoRepository } from '../../../application/ports.js';
import type { DadosApuracao } from '../../../domain/apuracao.js';

/**
 * ApuracaoRepository em memória, a partir de data/apuracao.json.
 *
 * Tolera `recortes: []` de propósito: na maior parte do ciclo não há apuração
 * nenhuma, e durante a noite de eleição o arquivo é preenchido aos poucos. A
 * tela é obrigada a tratar o vazio — nunca este adaptador a inventar um
 * recorte para "ter o que mostrar".
 */
export function criarApuracaoRepositoryJson(dados: DadosApuracao): ApuracaoRepository {
  const recortes = dados.recortes ?? [];
  return {
    dados(): DadosApuracao {
      return { atualizadoEm: dados.atualizadoEm, recortes };
    },
    atualizadoEm(): string {
      return dados.atualizadoEm;
    },
    vazia(): boolean {
      return recortes.length === 0;
    },
  };
}
