import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { carregarDados } from '../../../../outbound/json/carregar-dados.js';
import { criarCasosDeUso } from '../../../../../application/use-cases/index.js';
import { espectroDoPartido, type Espectro } from '../../../../../domain/spectrum.js';
import { MARGEM_REFERENCIA_PADRAO } from '../../../../../domain/aggregate.js';
import {
  corDaFaixa,
  degrauDaFaixa,
  faixaVantagem,
  type FaixaVantagem,
} from '../presidential-states-layout.js';

/**
 * A rampa de tinta do mapa "Quem lidera" tem de ser COMPARÁVEL ENTRE MATIZES.
 *
 * O defeito que estes testes travam: o degrau era uma opacidade
 * (`--ps-vantagem-*`: 0,58 / 0,72 / 0,86 / 1) aplicada ao `-fill` do espectro. A
 * mesma opacidade sobre duas cores de luminância base diferente não produz a
 * mesma tinta. Medido em aritmética sRGB sobre o fundo do painel claro
 * (`--color-surface-1`, #f5f6f7): o vermelho #eb5757 ia de L=0,2517 a L=0,5207 e
 * o azul #1f7cc4 de L=0,1869 a L=0,4903; o degrau DENTRO do vermelho valia
 * 0,0484 de luminância e a diferença ENTRE os matizes no mesmo degrau valia
 * 0,0648 — mais que um degrau inteiro. Resultado: todo estado vermelho da faixa
 * de topo saía mais claro que todo estado azul da faixa imediatamente abaixo, 40
 * pares de estados invertidos no 1º turno e 24 no 2º (227 e 201 no tema escuro,
 * onde a relação se inverte), e os chips da legenda repetiam a inversão.
 *
 * Os testes leem os hex REAIS do bloco de tokens de presidential-states.css e
 * recalculam a luminância relativa WCAG de cada um — não conferem contra uma
 * tabela copiada do gerador.
 */

const CSS = readFileSync(
  fileURLToPath(new URL('../../styles/presidential-states.css', import.meta.url)),
  'utf8',
);

const DEGRAUS = [4, 3, 2, 1, 0] as const;
const SUFIXOS: readonly string[] = ['1', '2', '3', '4', '5', 'indefinido'];

/**
 * Luminância relativa WCAG 2.x de uma cor `#rrggbb`. Implementada aqui, e não
 * importada da app, porque o que se quer verificar é o número que um medidor
 * externo leria da tela.
 */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Os três blocos em que os tokens `--ps-tinta-*` são declarados, na ordem do
 * arquivo: `:root` (tema escuro, o padrão), o bloco de
 * `prefers-color-scheme: light` e o `[data-theme='light']` manual.
 */
function blocosDeTinta(): string[][] {
  const DECLARACAO = /^--ps-tinta-[\w-]+-[0-4]:/;
  const blocos: string[][] = [];
  let atual: string[] | null = null;
  for (const bruta of CSS.split('\n')) {
    const linha = bruta.trim();
    if (DECLARACAO.test(linha)) {
      if (atual == null) {
        atual = [];
        blocos.push(atual);
      }
      atual.push(linha);
    } else if (atual != null && linha.length > 0) {
      atual = null;
    }
  }
  return blocos;
}

function tabelaDoBloco(bloco: readonly string[]): Map<string, string> {
  const tabela = new Map<string, string>();
  for (const linha of bloco) {
    const m = /^--ps-tinta-([\w-]+)-([0-4]):\s*(#[0-9a-f]{6});$/.exec(linha);
    expect(m, `declaração inesperada: ${linha}`).not.toBeNull();
    tabela.set(`${m![1]}-${m![2]}`, m![3]!);
  }
  return tabela;
}

const BLOCOS = blocosDeTinta();
const TEMAS = [
  { nome: 'escuro (:root)', tabela: tabelaDoBloco(BLOCOS[0] ?? []), fundo: '#0f1011' },
  { nome: 'claro (prefers-color-scheme)', tabela: tabelaDoBloco(BLOCOS[1] ?? []), fundo: '#f5f6f7' },
  { nome: "claro ([data-theme='light'])", tabela: tabelaDoBloco(BLOCOS[2] ?? []), fundo: '#f5f6f7' },
] as const;

/** Distância de luminância até o fundo — quanto de tinta o leitor vê, nos dois temas. */
function tinta(hex: string, fundo: string): number {
  return Math.abs(luminancia(hex) - luminancia(fundo));
}

describe('rampa de tinta: a folha de estilos declara os 3 blocos completos', () => {
  it('são três blocos (escuro, claro por preferência, claro manual) de 30 tokens cada', () => {
    expect(BLOCOS).toHaveLength(3);
    for (const tema of TEMAS) {
      expect(tema.tabela.size, tema.nome).toBe(SUFIXOS.length * DEGRAUS.length);
    }
  });

  it('os dois blocos de tema claro declaram exatamente os mesmos valores', () => {
    expect([...TEMAS[2].tabela.entries()].sort()).toEqual([...TEMAS[1].tabela.entries()].sort());
  });

  it('todo token que `corDaFaixa` referencia existe na folha de estilos', () => {
    const espectros: readonly Espectro[] = [
      'esquerda',
      'centro-esquerda',
      'centro',
      'centro-direita',
      'direita',
      'indefinido',
    ];
    const faixas: readonly FaixaVantagem[] = ['empate', 'lidera1', 'lidera2', 'lidera3', 'lidera4'];
    for (const espectro of espectros) {
      for (const faixa of faixas) {
        const ref = corDaFaixa(espectro, faixa);
        const nome = /^var\(--ps-tinta-(.+)\)$/.exec(ref)?.[1];
        expect(nome, ref).toBeDefined();
        for (const tema of TEMAS) {
          expect(tema.tabela.has(nome!), `${tema.nome}: ${ref}`).toBe(true);
        }
      }
    }
  });
});

describe('rampa de tinta: equiluminante dentro de cada degrau', () => {
  for (const tema of TEMAS) {
    it(`${tema.nome}: os matizes de um degrau não diferem mais que 0,006 de luminância`, () => {
      for (const degrau of DEGRAUS) {
        const ls = SUFIXOS.map((s) => luminancia(tema.tabela.get(`${s}-${degrau}`)!));
        const amplitude = Math.max(...ls) - Math.min(...ls);
        expect(amplitude, `degrau ${degrau}: ${ls.map((l) => l.toFixed(4)).join(', ')}`).toBeLessThan(
          0.006,
        );
      }
    });

    it(`${tema.nome}: degraus vizinhos ficam a pelo menos 0,03 de tinta, no pior par`, () => {
      for (let i = 0; i + 1 < DEGRAUS.length; i++) {
        // `acima` é o degrau de vantagem MAIOR: mais tinta, portanto mais longe
        // do fundo nos dois temas. A separação é medida no PIOR par possível
        // entre os dois degraus — é ela que impede qualquer inversão entre
        // matizes, porque a amplitude dentro de um degrau é muito menor.
        const acima = SUFIXOS.map((s) => tinta(tema.tabela.get(`${s}-${DEGRAUS[i]!}`)!, tema.fundo));
        const abaixo = SUFIXOS.map((s) =>
          tinta(tema.tabela.get(`${s}-${DEGRAUS[i + 1]!}`)!, tema.fundo),
        );
        const separacao = Math.min(...acima) - Math.max(...abaixo);
        expect(
          separacao,
          `degraus ${DEGRAUS[i]}→${DEGRAUS[i + 1]}: ${separacao.toFixed(4)}`,
        ).toBeGreaterThan(0.03);
      }
    });
  }
});

describe('rampa de tinta: nenhum par de estados reais fica invertido', () => {
  const casos = criarCasosDeUso(carregarDados(), { hoje: () => new Date('2026-09-26T12:00:00Z') });
  const partidos = casos.listParties();

  for (const tema of TEMAS) {
    for (const turno of [1, 2] as const) {
      it(`${tema.nome}, ${turno}º turno: vantagem maior nunca sai com menos tinta`, () => {
        const dados = casos.getPresidentialByState(turno);
        const pintadas = dados.ufs
          .filter((u) => !u.semDados && u.lider)
          .map((u) => {
            const espectro = espectroDoPartido(u.partido, partidos);
            const faixa = faixaVantagem({
              vantagem: u.vantagem,
              margemReferencia: u.agregado?.margemReferencia ?? MARGEM_REFERENCIA_PADRAO,
              semDados: u.semDados,
            });
            const degrau = degrauDaFaixa(faixa)!;
            const nome = /^var\(--ps-tinta-(.+)\)$/.exec(corDaFaixa(espectro, faixa))![1]!;
            return { uf: u.uf, degrau, tinta: tinta(tema.tabela.get(nome)!, tema.fundo) };
          });
        expect(pintadas.length).toBe(27);
        const invertidos = pintadas.flatMap((a) =>
          pintadas
            .filter((b) => a.degrau > b.degrau && a.tinta <= b.tinta)
            .map((b) => `${a.uf}(degrau ${a.degrau}) <= ${b.uf}(degrau ${b.degrau})`),
        );
        expect(invertidos).toEqual([]);
      });
    }
  }
});
