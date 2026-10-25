# Mensagem para os alunos

Link: https://ghdaru.github.io/mapa-pesquisa/#/presidente-estados?mapa=apuracao

---

## Versão curta (WhatsApp / Telegram)

Pessoal, deixei no ar a apuração ao vivo com uma coisa que vale a aula de hoje:

https://ghdaru.github.io/mapa-pesquisa/#/presidente-estados?mapa=apuracao

Todo site de notícia mostra o percentual nacional parcial. **Esse número
engana** — e não é por má-fé, é matemática.

O site faz diferente: ele pega **cada estado separado**, vê quanto já foi
apurado ali, e projeta aquele estado para 100%. Só depois soma os 27 estados
(mais o exterior).

Passem o mouse num estado — ou cliquem, que a leitura fica presa — para ver os
números dele. E comparem a linha "Contado" com a linha "Projeção" nos cartões
de cima: quando as duas discordam, é exatamente o fenômeno que vou explicar.

---

## Versão explicada (para mandar junto, ou colar no mural da turma)

### O problema: o percentual nacional parcial mente

Imagine que o Brasil só tivesse dois estados:

| Estado | Eleitores | Quem ganha lá |
|---|---|---|
| Alfa | 1 milhão | Candidato A, com 80% |
| Beta | 9 milhões | Candidato B, com 60% |

Quem ganha o país? O B, com folga: ele faz 5,4 milhões de votos contra 3,6
milhões do A.

Agora a apuração começa. Alfa é pequeno e termina rápido: às 17h30 já está com
100% apurado. Beta é grande e está com 10%.

O que o percentual nacional mostra nesse instante?

- De Alfa vieram 1 milhão de votos: 800 mil para A, 200 mil para B.
- De Beta vieram 900 mil votos (10% de 9 milhões): 360 mil para A, 540 mil
  para B.
- **Total parcial: A com 1.160.000 e B com 740.000.**

O placar na tela diz **A 61% × B 39%**. O A parece estar atropelando.

Mas nada disso aconteceu. O A não ganhou voto nenhum a mais. O que aconteceu é
que a contagem estava **cheia de Alfa e vazia de Beta** — e Alfa é terra do A.
Conforme Beta for entrando, o placar vai virar sozinho, e no fim o B ganha com
56%.

**Isso não é hipótese.** Foi o que aconteceu em 2022: o Nordeste totalizou
primeiro, a vantagem de um dos candidatos encolheu a noite toda conforme São
Paulo entrava, e muita gente achou que estava assistindo a uma virada. Não
estava. Estava assistindo à ordem de chegada dos estados.

### A solução: projetar estado por estado

O site não extrapola o número nacional. Ele faz assim:

1. Olha **um estado de cada vez**.
2. Vê quanto daquele estado já foi contado. Digamos 40%.
3. Multiplica os votos de lá por `1 ÷ 0,40` — ou seja, por 2,5. É o "gerar os
   100%" daquele estado.
4. Faz isso para os 27 estados **e para o exterior**, cada um com o fator dele.
5. **Só então soma tudo.**

No exemplo acima: Alfa está a 100%, então fica como está (800 mil × 1 e 200 mil
× 1). Beta está a 10%, então multiplica por 10: 3,6 milhões para A e 5,4
milhões para B. Somando: **A 4,4 milhões × B 5,6 milhões**. O B na frente,
como de fato vai terminar — e isso já com 10% de Beta apurado, horas antes.

A conta é a mesma aritmética da regra de três que vocês aprenderam na sétima
série. O que muda tudo é **onde** você aplica ela: dentro de cada estado, e não
no país inteiro de uma vez.

### A premissa — e por que isso se chama projeção, não contagem

Multiplicar por 2,5 assume uma coisa: **que as seções que faltam naquele estado
se parecem com as que já foram contadas lá.** Isso costuma valer bem, porque
dentro de um estado as urnas vão chegando sem ordem política nenhuma. Mas é uma
premissa, não um fato.

É por isso que o site separa os dois números e nunca os mistura:

- **Contado** é fato. São os votos que já entraram. Não tem incerteza.
- **Projeção** é inferência sobre o que falta. Tem premissa embutida.

E é por isso que o painel de projeção carrega o selo "estimativa, não
contagem". Quando a vantagem fica maior do que todo o voto que ainda pode
aparecer, aí sim o selo muda: deixou de ser estimativa e virou aritmética
fechada.

### O que o site se recusa a fazer (e isso também é conteúdo de aula)

- **Estado sem nenhuma seção apurada fica cinza e fora da conta.** Não é
  preenchido com pesquisa, nem com média nacional, nem com o resultado do 1º
  turno. Ele aparece nomeado como ausente. Preencher buraco com chute é como se
  fabrica um número confiante e errado.
- **Zero e "não tem dado" são coisas diferentes.** Um estado com 0% apurado não
  mostra "0% para cada um" — mostra "nenhuma seção apurada". Zero é uma
  afirmação sobre o voto de lá; ausência não é.
- **A condição de leitura anda junto do número.** 50,6% com 3% apurado e 50,6%
  com 97% apurado são afirmações de forças completamente diferentes, então os
  dois ficam lado a lado e do mesmo tamanho.

### O que explorar no site

1. Passem o mouse num estado (ou cliquem, que a leitura fica presa). Aparecem
   os dois percentuais **do momento** e quanto já foi computado ali.
2. Comparem, nos cartões do topo, a coluna **Contado** com a coluna
   **Projeção**. Nas primeiras horas elas discordam — e a discordância é
   exatamente o tamanho do viés de ordem de apuração.
3. Troquem o recorte para **Regiões**. O voto brasileiro tem geografia forte, e
   cinco linhas mostram o desenho que vinte e sete escondem.
4. Usem o modo **Simulação** com o cursor de avanço. Ele gera parciais a partir
   do resultado **real** do 1º turno, então o final é conhecido: dá para
   arrastar de 0% a 100% e ver a projeção convergir para o resultado que de
   fato aconteceu. É a prova de que o método funciona, não uma promessa.
5. Desçam até **Baixar CSV** e abram a planilha. Dá para refazer todas as
   contas por conta própria — que é o único jeito honesto de acreditar em
   número de terceiro.

### Aviso

O resultado oficial é o do TSE. Este site lê os arquivos públicos da
divulgação oficial e faz contas em cima deles, à vista: tudo que ele mostra
pode ser conferido na fonte, e os endereços lidos ficam listados no rodapé da
própria apuração.

---

Gilsiley Henrique Daru — Dr. em Inteligência Artificial
ghdaru@ghdaru.com.br
