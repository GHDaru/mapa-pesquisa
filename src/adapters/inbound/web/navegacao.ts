/**
 * Qual item do menu está aceso.
 *
 * Existe porque dois itens passaram a apontar para a MESMA rota: "Presidente
 * por estado" e "Apuração ao vivo" são a mesma tela, em modos diferentes do
 * mapa (`#/presidente-estados` e `#/presidente-estados?mapa=apuracao`). A
 * comparação antiga descartava os parâmetros antes de comparar, então com a
 * apuração aberta o menu acendia "Presidente por estado" — apontando para um
 * lugar onde o leitor não está.
 *
 * A regra é genérica e não sabe nada sobre apuração: um item casa quando a
 * rota é a mesma E todos os parâmetros que ELE declara aparecem iguais no
 * endereço atual. Entre os que casam, vence o que declara mais parâmetros —
 * o mais específico. Assim um item sem parâmetro nenhum continua servindo de
 * padrão para a rota, e acender dois ao mesmo tempo deixa de ser possível.
 */

function partes(hash: string): { readonly rota: string; readonly params: URLSearchParams } {
  const corte = hash.indexOf('?');
  return corte < 0
    ? { rota: hash, params: new URLSearchParams() }
    : { rota: hash.slice(0, corte), params: new URLSearchParams(hash.slice(corte + 1)) };
}

/** `true` quando o item do menu descreve o endereço atual. */
export function itemCasaComEndereco(href: string, hashAtual: string): boolean {
  const item = partes(href);
  const atual = partes(hashAtual);
  if (item.rota !== atual.rota) return false;
  for (const [chave, valor] of item.params) {
    if (atual.params.get(chave) !== valor) return false;
  }
  return true;
}

/**
 * O href que deve acender, dentre os itens do menu, ou `null` se nenhum
 * descreve o endereço atual.
 */
export function linkAtivoDoMenu(hrefs: readonly string[], hashAtual: string): string | null {
  const candidatos = hrefs.filter((h) => itemCasaComEndereco(h, hashAtual));
  if (candidatos.length === 0) return null;
  // Mais parâmetros declarados = descrição mais específica do endereço.
  return candidatos.reduce((melhor, atual) =>
    [...partes(atual).params].length > [...partes(melhor).params].length ? atual : melhor,
  );
}
