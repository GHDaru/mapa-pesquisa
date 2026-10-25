# Posts de divulgação — Mapa das Pesquisas 2026

Link: https://ghdaru.github.io/mapa-pesquisa/

Todos os números abaixo foram lidos da própria página em 25/10/2026 e são
verificáveis nela. Nada aqui é estimativa de marketing.

---

## Instagram (legenda)

As pesquisas disseram que o Lula ia na frente. As urnas disseram o contrário.

No 1º turno, a média das pesquisas dava Lula à frente por 2,2 pontos.
Em 4 de outubro, Flávio Bolsonaro terminou à frente por 1,9.

Quatro pontos de diferença.

Eu construí um site que não esconde isso — ele mede o erro, instituto por
instituto, e mostra quem acertou e quem não acertou.

Hoje é 2º turno. O que a média das pesquisas diz agora:

→ Flávio 47,7% x Lula 45,7%
→ 22 pesquisas, só as com campo DEPOIS do 1º turno
→ margem de ± 1,9 ponto

Leia de novo: a vantagem é do tamanho do próprio erro da medida.
Quem disser que sabe o resultado hoje, está chutando.

A partir das 17h, apuração ao vivo no mesmo site, lida direto do TSE:

• mapa do Brasil com quem lidera e quanto já foi apurado em cada estado
• projeção montada estado a estado — e não pelo % nacional, que engana
  enquanto a ordem em que os estados totalizam não fecha (foi o que aconteceu
  em 2022, quando a vantagem "encolheu" sem ninguém mudar de ideia)
• recorte por estado ou por região
• e você pode baixar tudo em CSV

865 pesquisas. 47 institutos. 27 estados. Atualizado todo dia, sozinho.

Link na bio. Abre no celular.

#eleicoes2026 #2turno #apuracao #dadosabertos #cienciadedados
#inteligenciaartificial #pesquisaeleitoral #engenhariadedados #python
#visualizacaodedados

---

## Instagram (versão curta, para Stories ou Reels)

As pesquisas erraram o 1º turno por 4 pontos.

Elas davam Lula +2,2. Deu Flávio +1,9.

Fiz um site que mostra isso — e que hoje apura ao vivo, direto do TSE,
estado por estado.

Hoje: 47,7% x 45,7%, com margem de ± 1,9.
A vantagem é do tamanho do erro.

Link na bio. 👆

---

## LinkedIn

**As pesquisas erraram o 1º turno por 4 pontos. Meu site mostra exatamente
onde.**

A média ponderada das pesquisas dava Lula à frente por 2,2 pontos. Em 4 de
outubro, as urnas deram Flávio Bolsonaro à frente por 1,9.

A parte interessante não é o erro — pesquisa tem margem, e isso é esperado.
A parte interessante é que quase nenhuma cobertura volta para medir o erro
depois. Eu voltei: o site compara cada instituto com o resultado oficial e
publica o ranking.

**Hoje é 2º turno, e o que eu construí está no ar:**

→ **Agregado nacional:** Flávio 47,7% x Lula 45,7%, sobre 22 pesquisas com
campo posterior ao 1º turno, margem de ± 1,9 ponto. A vantagem é do tamanho
do erro da medida: não é resultado, é empate dentro do ruído.

→ **Apuração ao vivo**, a partir das 17h, lendo os 27 arquivos oficiais do
TSE direto no navegador, sem intermediário.

**Três decisões de engenharia que fizeram diferença, e que valem para
qualquer projeto de dados:**

**1. A projeção é montada estado a estado, nunca pelo percentual nacional.**
O percentual nacional parcial é enviesado pela ORDEM em que os estados
totalizam, não pelo voto. Em 2022 o Nordeste totalizou primeiro e a vantagem
do líder "encolheu" à medida que São Paulo entrou — sem que um único eleitor
mudasse de ideia. Quem lê o parcial nacional sem essa ressalva lê a ordem de
apuração achando que está lendo o eleitorado.

**2. O sistema se recusa a inventar.** Estado sem seção apurada fica cinza e
fora da projeção — não é preenchido com pesquisa, nem com média nacional.
Pesquisa sem registro no TSE é marcada como tal. Quando duas fontes
discordam do número de registro, o campo fica nulo e o conflito é declarado.
Dado ausente é uma informação; zero é outra, e trocar um pelo outro é o erro
que mais aparece em painel corporativo.

**3. A ressalva fica na tela, não no commit.** Toda afirmação carrega a
condição que a qualifica, do lado dela e no mesmo peso visual. 50,6% com 3%
apurado e 50,6% com 97% apurado são afirmações de força completamente
diferente, e uma interface honesta não deixa as duas parecerem iguais.

**Números da base:** 865 pesquisas, 47 institutos, 27 estados, 81 cadeiras do
Senado, 85% com registro no TSE. Atualização diária por rotina automática.
Tudo exportável em CSV.

É software de produção: tipagem estrita, arquitetura hexagonal, quase mil
testes automatizados, deploy contínuo. O mesmo rigor que eu aplico quando
automatizo processo de cliente — a diferença é que aqui o erro fica público.

**Veja funcionando:** https://ghdaru.github.io/mapa-pesquisa/

Se a sua empresa tem decisão sendo tomada em cima de número que ninguém
audita, é exatamente esse o problema que eu resolvo.

Guilherme Daru — Dr. em Inteligência Artificial
Consultor em implantação e automatização de processos corporativos
ghdaru@ghdaru.com.br

#InteligenciaArtificial #CienciaDeDados #Eleicoes2026 #EngenhariaDeDados
#AutomacaoDeProcessos

---

## Observações sobre os números (para você conferir antes de publicar)

- **Lula +2,2 x Flávio +1,9:** está na aba Projeção, no bloco "1º turno — o que
  as pesquisas diziam antes de 4 de outubro".
- **47,7% x 45,7%:** aba Presidente, bloco "2º turno — o confronto definido".
  São 22 pesquisas; 6 ficaram fora da média por publicarem só votos válidos,
  e isso está declarado na própria página.
- **865 / 47 / 27 / 85%:** aba Início.
- **A margem de ± 1,9 ponto** é a margem de referência ponderada, não a margem
  de uma pesquisa específica.
- Os números do 2º turno mudam a cada ingestão. Se publicar depois de uma
  atualização, confira na página antes.
