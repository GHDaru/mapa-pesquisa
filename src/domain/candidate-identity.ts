import { normalizarNomeCandidato } from './runoff.js';

/**
 * Identidade de candidato entre fontes que o nomeiam de formas diferentes.
 *
 * O problema é real e apareceu na primeira comparação pesquisa x urna: em
 * Alagoas o resultado oficial traz "JHC" e as pesquisas traziam "João
 * Henrique Caldas (JHC)" — a MESMA pessoa, contada como erro de previsão
 * porque os nomes não batiam como texto. Um mapa que declarasse "as
 * pesquisas erraram em Alagoas" por causa disso estaria afirmando algo falso
 * sobre o mundo.
 *
 * A regra é deliberadamente ESTREITA: casa nome completo com nome completo, ou
 * o apelido entre parênteses de um com o nome do outro. NÃO faz casamento por
 * substring solta ("Zucco" dentro de "Zuccolotto" seria falso positivo) nem
 * por primeiro nome ("Ricardo" é dois candidatos diferentes no ES). Quando a
 * regra não tem certeza, ela devolve `false` e a divergência fica visível —
 * errar para o lado de declarar diferença é recuperável; fundir dois
 * candidatos distintos corromperia a comparação em silêncio.
 */

/** Captura o apelido entre parênteses no fim do nome: "João Henrique Caldas (JHC)" → "JHC". */
const APELIDO_ENTRE_PARENTESES = /\(([^)]+)\)\s*$/;

/**
 * Os nomes pelos quais um candidato pode aparecer: o nome como escrito (sem o
 * parêntese) e o apelido entre parênteses, quando existe. Todos normalizados.
 */
export function apelidosDoCandidato(nome: string): readonly string[] {
  const bruto = nome.trim();
  const casamento = APELIDO_ENTRE_PARENTESES.exec(bruto);
  const semParenteses = bruto.replace(APELIDO_ENTRE_PARENTESES, '').trim();
  const nomes = [semParenteses.length > 0 ? semParenteses : bruto];
  if (casamento?.[1]) nomes.push(casamento[1].trim());
  return nomes.map(normalizarNomeCandidato).filter((n) => n.length > 0);
}

/** Dois nomes designam o mesmo candidato? Ver a regra estreita no topo do módulo. */
export function mesmoCandidato(a: string, b: string): boolean {
  const deA = new Set(apelidosDoCandidato(a));
  if (deA.size === 0) return false;
  return apelidosDoCandidato(b).some((n) => deA.has(n));
}
