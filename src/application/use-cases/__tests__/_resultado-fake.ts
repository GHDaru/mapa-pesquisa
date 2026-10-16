import type { ResultadoRepository } from '../../ports.js';
import type { DadosResultado } from '../../../domain/resultado.js';

/**
 * Resultado vazio para os testes que não exercem a tela de fechamento. Não
 * passa por `criarResultado`: a validação de 27 UFs e do fechamento das
 * bancadas é testada no domínio, e repeti-la em cada fixture só obrigaria
 * todo teste a carregar 27 governadores que ele não usa.
 */
export const RESULTADO_VAZIO: DadosResultado = {
  eleicao: 2026,
  turno1: '2026-10-04',
  turno2: '2026-10-25',
  governadores: [],
  camara: { totalCadeiras: 0, bancadas: [] },
};

export const resultadoRepoFake: ResultadoRepository = { dados: () => RESULTADO_VAZIO };
