# O histórico da apuração

O gráfico "Como a noite evoluiu", na apuração ao vivo, desenha duas coisas por
candidato ao longo do tempo: o percentual **apurado** (sobre os votos já
contados) e o **projetado** (a contagem de cada UF dividida pela fração
computada nela, somadas depois). Lado a lado, as duas curvas são o argumento
do site virando desenho — o apurado balança conforme os estados totalizam em
ordens diferentes, a projeção fica firme desde cedo, e as duas se encontram
quando a apuração fecha.

Para isso o gráfico precisa de histórico, e histórico precisa de alguém
amostrando.

## De onde vêm os pontos

São duas fontes, juntadas por balde de cinco minutos:

1. **O repositório** — `data/apuracao-serie.json`, versionado e embutido no
   bundle. É a base: toda visita já nasce com a noite inteira desenhada,
   inclusive para quem chegou às 22h e não estava aqui às 19h.
2. **O navegador de quem está olhando** — enquanto a página fica aberta, ela
   relê o TSE a cada cinco minutos e acrescenta pontos em `localStorage`. É o
   que cobre o intervalo entre a última publicação e agora.

No empate de balde, **o ponto local vence**: ele é mais recente. E o navegador
guarda apenas o que NÃO veio do repositório — gravar a série inteira
congelaria ali um retrato do histórico publicado, e uma correção feita depois
nunca chegaria a quem já tivesse visitado a página.

## Como gravar no repositório

```
npm run data:apuracao-serie
```

`ingest/amostrar-apuracao.ts` lê os 28 recortes oficiais do TSE (as 27 UFs
mais o exterior), projeta com o mesmo código do site e acrescenta um ponto.

Três propriedades que importam:

- **Idempotente dentro do balde de cinco minutos.** Rodar seis vezes no mesmo
  minuto não cria seis pontos: substitui o ponto daquele balde. A linha deve
  ganhar densidade onde houve apuração, não onde alguém rodou o script.
- **Leitura falha não vira ponto.** Se nenhum arquivo do TSE responder — e o
  429 é comum em noite de eleição —, o script sai com erro e não grava. Um
  ponto zerado seria um mergulho a 0% no meio do gráfico, que se lê como "a
  apuração voltou atrás".
- **Nomes canônicos.** O TSE publica `LULA` e `FLAVIO BOLSONARO`; a série é
  procurada pelo nome canônico. A tradução (`nomeCanonicoDaUrna`) é a MESMA
  que a tela usa, importada do mesmo módulo — duas cópias divergiriam, e a
  divergência apareceria só como uma linha sumida do gráfico.

## A granularidade, e o que ainda falta

A rotina diária do projeto roda **uma vez por dia**: ela garante que o
histórico exista e que o ponto final entre, mas não produz os cinco minutos.

Numa noite de apuração, os cinco minutos vêm de:

- a sessão que está acompanhando, rodando o script em laço; e
- os navegadores com a página aberta, que preenchem os buracos.

Para amostragem de cinco minutos **sem depender de ninguém acompanhando**,
faltaria um workflow agendado no GitHub Actions (`cron: '*/5 * * * *'`) que
rodasse o script e empurrasse o arquivo. Isso exige dar permissão de escrita
ao CI, o que é uma decisão do dono do repositório — e tem dois custos a
declarar: o cron do Actions atrasa sob carga e chega a pular disparos, e cada
amostra vira um commit. A junção por balde já tolera as duas coisas, então o
buraco é de granularidade, não de correção.
