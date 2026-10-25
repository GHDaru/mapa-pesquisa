/**
 * Simulador de apuração em andamento.
 *
 * A apuração do 2º turno só começa às 17h, e a página precisa ser testada
 * antes disso. Este simulador gera recortes parciais a partir do resultado
 * **real e completo do 1º turno** (`data/apuracao.json`, 82 recortes a 100%,
 * lidos da fonte oficial), recontando os dois finalistas entre si — que é o
 * confronto que a página mede.
 *
 * Isso dá uma propriedade que um mock inventado não teria: **o estado final é
 * conhecido**. Então a afirmação central da tela — "a projeção converge para o
 * resultado conforme o processado vai a 100" — deixa de ser promessa e vira
 * asserção verificável, com o resultado de 4 de outubro como gabarito.
 *
 * ## O viés de ordem de apuração, de propósito
 *
 * O simulador não distribui os votos de forma uniforme. Cada UF recebe um
 * desvio que **decai até zero** conforme ela totaliza, reproduzindo o
 * fenômeno que a doc de `domain/apuracao.ts` descreve: em 2022 o Nordeste
 * totalizou primeiro e a vantagem do líder encolheu à medida que São Paulo
 * entrou, sem que um eleitor mudasse de ideia.
 *
 * Isso é deliberado. Um simulador sem viés testaria só se a página soma; com
 * viés, ele testa se a página **engana** durante o parcial — que é o risco de
 * verdade numa noite de apuração, e o que o percentual nacional parcial faz
 * com quem o lê sem ressalva.
 *
 * Como o desvio é multiplicado por `(1 - fração)`, ele some exatamente em
 * 100%: a convergência é exata, não aproximada.
 */

import type {
  DadosApuracao,
  DadosApuracaoRecorte,
} from '../../../domain/apuracao.js';
import { mesmoCandidato } from '../../../domain/candidate-identity.js';

/** Gerador determinístico: a mesma semente dá a mesma simulação. */
function rng(semente: number): () => number {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

export interface OpcoesSimulacao {
  /** 0 = nada apurado; 1 = tudo apurado e igual ao gabarito. */
  readonly avanco: number;
  readonly semente?: number;
  /**
   * Tamanho máximo do desvio de ordem de apuração, em pontos de participação
   * (0,08 = até 8 pontos). Zero desliga o viés e deixa a simulação uniforme.
   */
  readonly viesMaximo?: number;
  readonly turno?: 1 | 2;
}

/**
 * Monta uma apuração parcial dos dois finalistas a partir do 1º turno real.
 *
 * `finalistas` são os nomes canônicos — casados com `mesmoCandidato`, porque a
 * apuração e as pesquisas não são obrigadas a grafar igual.
 */
export function simularApuracao(
  real: DadosApuracao,
  finalistas: readonly [string, string],
  opcoes: OpcoesSimulacao,
): { dados: DadosApuracao; gabarito: DadosApuracao } {
  const avanco = Math.max(0, Math.min(1, opcoes.avanco));
  const viesMax = opcoes.viesMaximo ?? 0.08;
  const turno = opcoes.turno ?? 2;
  const r = rng(opcoes.semente ?? 20261025);

  const base = real.recortes.filter(
    (x) => x.cargo === 'presidente' && x.turno === 1 && x.uf != null && x.uf !== 'BR',
  );

  const parciais: DadosApuracaoRecorte[] = [];
  const gabaritos: DadosApuracaoRecorte[] = [];

  for (const recorte of base) {
    const votosDe = (nome: string): number => {
      const achado = recorte.candidatos.find((c) => mesmoCandidato(c.candidato, nome));
      return achado?.votos ?? 0;
    };
    const vA = votosDe(finalistas[0]);
    const vB = votosDe(finalistas[1]);
    const validosFinais = vA + vB;
    if (validosFinais <= 0) continue;

    const partidoDe = (nome: string): string | null =>
      recorte.candidatos.find((c) => mesmoCandidato(c.candidato, nome))?.partido ?? null;

    // Velocidade e viés próprios da UF: é isso que cria a ordem de apuração.
    //
    // A velocidade é SEMPRE >= 1 de propósito. Ela escalona o CAMINHO, não o
    // destino: com velocidade abaixo de 1, `avanco: 1` deixava UFs lentas sem
    // terminar, o desvio de ordem de apuração sobrevivia no fim e a projeção
    // errava o gabarito em 83 mil votos. `avanco: 1` tem de significar
    // apuração encerrada em toda UF, senão o parâmetro mente.
    const velocidade = 1 + r() * 0.9;
    const vies = (r() * 2 - 1) * viesMax;

    const fracao = Math.max(0, Math.min(1, avanco * velocidade));
    const pst = fracao * 100;

    const shareFinalA = vA / validosFinais;
    // O desvio decai com `(1 - fracao)` e zera em 100% — convergência exata.
    const shareParcialA = Math.max(0, Math.min(1, shareFinalA + vies * (1 - fracao)));

    const validosParciais = Math.round(validosFinais * fracao);
    const parcialA = Math.round(validosParciais * shareParcialA);
    const parcialB = validosParciais - parcialA;

    const escalar = (v: number | null | undefined): number | null =>
      v == null ? null : Math.round(v * fracao);

    const candidatosParciais = [
      { candidato: finalistas[0], partido: partidoDe(finalistas[0]), votos: parcialA },
      { candidato: finalistas[1], partido: partidoDe(finalistas[1]), votos: parcialB },
    ].sort((a, b) => b.votos - a.votos);

    const fonte = {
      nome: 'Simulação a partir do 1º turno real',
      url: recorte.fonte.url,
    };

    parciais.push({
      cargo: 'presidente',
      uf: recorte.uf,
      turno,
      secoesTotalizadas: pst,
      candidatos: candidatosParciais,
      validosTotal: validosParciais > 0 ? validosParciais : null,
      brancos: escalar(recorte.brancos),
      nulos: escalar(recorte.nulos),
      abstencoes: escalar(recorte.abstencoes),
      fonte,
      observacao:
        'SIMULAÇÃO. Parcial gerada a partir do resultado real do 1º turno, com desvio de ordem de apuração que decai até zero em 100%.',
    });

    gabaritos.push({
      cargo: 'presidente',
      uf: recorte.uf,
      turno,
      secoesTotalizadas: 100,
      candidatos: [
        { candidato: finalistas[0], partido: partidoDe(finalistas[0]), votos: vA },
        { candidato: finalistas[1], partido: partidoDe(finalistas[1]), votos: vB },
      ].sort((a, b) => b.votos - a.votos),
      validosTotal: validosFinais,
      brancos: recorte.brancos ?? null,
      nulos: recorte.nulos ?? null,
      abstencoes: recorte.abstencoes ?? null,
      fonte,
    });
  }

  return {
    dados: { atualizadoEm: new Date().toISOString(), recortes: parciais },
    gabarito: { atualizadoEm: real.atualizadoEm, recortes: gabaritos },
  };
}
