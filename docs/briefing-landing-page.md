# Briefing de design — landing page (síntese do diretor)

Baseado em 3 pareceres de especialistas (jornalismo de dados eleitorais, produto cívico brasileiro, identidade editorial). Decisões e porquês abaixo; escopo é `views/home-view.ts` + `styles/home.css` (tokens próprios, prefixo `--hm-`, não alterar `styles/tokens.css` global nem outras telas).

## Cor (tokens `--hm-*`, definidos em ambos os temas)
- `--hm-canvas`: `#0a0b0d` (escuro) / `#f7f6f2` (claro) — quase-preto/quase-papel, não o cinza puro da Linear.
- `--hm-surface`: `#17181b` / `#ffffff`
- `--hm-ink`: `#f2f0ea` / `#17181b` (tom levemente quente, não branco/preto puro)
- `--hm-ink-muted`: `#9a9ea5` / `#5c6066`
- `--hm-selo` (dourado institucional, cor do lacre da urna): `#d9a441` — ÚNICO acento de marca da landing. Usado em: olho editorial (eyebrow), link "como calculamos", selo "registrado no TSE" (contorno), hover de CTA. NUNCA em dado partidário.
- `--hm-verificado` (verde): `#2f9e52` — só no selo "registrado no TSE".
- Espectro político (vermelho/azul): reaproveitar os tokens globais `--spectrum-1-fill`/`--spectrum-5-fill` já validados — nunca repintar navegação, botões ou eyebrow com eles.
- Proibido: indigo `--color-accent` da Linear como destaque nesta página (ele seria uma marca genérica competindo com o próprio espectro que a página mostra); glassmorphism, blur, glow, gradiente.

## Tipografia
- Display: **Fraunces** (600 reto e 600 itálico), via Google Fonts — só para o número/percentual do líder e o nome do líder no hero. Peso reto = vantagem sólida; **itálico = empate técnico** (4º canal de acessibilidade, além de cor/opacidade/texto).
- UI/corpo: **Inter** (já em uso no site) — mantém a home contínua com o resto do produto.
- Dados: **JetBrains Mono**, tabular-nums, para todo percentual, timestamp e contagem.

## Estrutura do hero (mobile-first, sem rolar em 400px até o nome+%)
1. Eyebrow: "PRESIDENTE · 1º TURNO" + timestamp exato em JetBrains Mono ("atualizado em 14/09/2026 às 14:32", a partir de `meta.atualizadoEm`; se a hora não existir na fonte, usar só a data — nunca inventar hora).
2. Nome curto do líder (nomeCurto) em Fraunces gigante + badge do partido + percentual em Fraunces ao lado.
3. Logo abaixo, menor: 2º colocado (nome + %) e a vantagem: "+N,N pts" (Fraunces reto) ou "EMPATE TÉCNICO" (Fraunces itálico) — nunca só cor.
4. Faixa fina de margem de erro atrás/sob o número (reaproveitar o padrão visual já usado em `presidential-view.ts`, não reinventar).
5. Linha de confiança sempre visível perto do número: "média de N pesquisas" + link inline "como calculamos" (cor `--hm-selo`), não em rodapé.
6. Textura ambiente: hachura a 4–6% de opacidade atrás do hero (reaproveitar o padrão de "sem dados"/incerteza já usado no mapa e no hemiciclo) — sutil, nunca decorativa a ponto de sujar.

## Depois do hero (ordem)
Resumo do dia (estimativa de votos, Senado por espectro) em tiles quietos → prévia do mapa/hemiciclo como "prova" (não como abertura) com link para as telas completas → últimas pesquisas (manter os cards já existentes, com o badge de turno já corrigido) → "o que você encontra aqui" → "como funciona" → fontes e créditos.

## Regras que seguem valendo
Nada inventado (tudo vem dos casos de uso); sem scroll horizontal em 400px; foco visível; `prefers-reduced-motion`; nunca só cor; CTAs e links com alvo de toque ≥44px; tema claro com o mesmo cuidado do escuro.
