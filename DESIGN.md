---
name: wok
description: Landing editorial em papel branco, serifa moderna e pinceladas roxas feitas à mão.
colors:
  primary: '#7446c4'
  primary-deep: '#56309a'
  primary-tint: '#efe9fb'
  leaf: '#6b7a2e'
  ink: '#221b2b'
  ink-soft: '#5f5868'
  line: '#e4e1e8'
  band: '#f4f3f6'
  paper: '#ffffff'
typography:
  display:
    fontFamily: 'Instrument Serif, Georgia, serif'
    fontSize: 'clamp(2.5rem, 5vw, 3.75rem)'
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Instrument Serif, Georgia, serif'
    fontSize: 'clamp(1.75rem, 3vw, 2.5rem)'
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: '-0.015em'
  title:
    fontFamily: 'Instrument Serif, Georgia, serif'
    fontSize: '1.375rem'
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: 'Figtree, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: 'Figtree, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: '4px'
  md: '8px'
spacing:
  xs: '8px'
  sm: '16px'
  md: '24px'
  lg: '48px'
  xl: '96px'
  section: '160px'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '12px 20px'
  button-primary-hover:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.paper}'
  nav-link:
    textColor: '{colors.ink}'
    typography: '{typography.label}'
  nav-link-hover:
    textColor: '{colors.primary}'
  page-card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '24px'
---

<!-- Derivado da imagem de referência (landing estilo LinkLetter) antes de haver implementação, com o acento laranja trocado por roxo. Rode /impeccable document de novo quando houver código para capturar os tokens reais. -->

# Design System: wok

## Overview

**Creative North Star: "A Carta Impressa"**

A página se comporta como papel: fundo branco, muito respiro, uma coluna central estreita e tipografia serifada moderna que conversa em vez de gritar. Sobre esse papel calmo entra um único gesto expressivo: tinta roxa aplicada à mão, em pinceladas largas e imperfeitas, que atravessa a página atrás do objeto principal e sublinha a palavra-chave do título.

O contraste entre os dois é o sistema. Tudo que é interface (navegação, botões, texto) é contido, pequeno e escuro. Tudo que é marca (pincelada, sublinhado, ilustrações) é grande, orgânico e roxo. Objetos físicos (envelope, folhas impressas, páginas) aparecem como fotografias ou renders realistas sobre o papel, nunca como ícones planos.

**Key Characteristics:**

- Papel branco e coluna central com respiro generoso entre seções
- Serifa moderna nos títulos, sans geométrica discreta no texto
- Um acento roxo, sempre com textura de pincel, nunca como bloco chapado de UI
- Botões e navegação em tinta escura, pequenos e sóbrios
- Objetos de papel com sombra leve como protagonistas visuais

## Colors

Papel branco, tinta quase preta com fundo de ameixa e um roxo de pincel; o verde-oliva entra só como tempero.

### Primary

- **Roxo Tinta** (`primary`): a pincelada grande do hero, o sublinhado à mão na palavra-chave do título, pequenas ilustrações e marcadores de lista. Passa 6:1 sobre o papel, então também serve para links.
- **Roxo Tinta Escuro** (`primary-deep`): hover do botão e de links; sombra interna das pinceladas.
- **Lavanda Papel** (`primary-tint`): fundos sutis de destaque e estados selecionados.

### Tertiary

- **Verde Folha** (`leaf`): só em detalhes ilustrados soltos (folhas, raminhos). Nunca em UI.

### Neutral

- **Tinta Ameixa** (`ink`): títulos, texto principal e o fundo do botão primário.
- **Tinta Diluída** (`ink-soft`): texto de apoio, legendas, rodapés de cartão.
- **Linha** (`line`): bordas finas e divisores.
- **Faixa** (`band`): faixa cinza-clara de largura total atrás do hero e da prova social.
- **Papel** (`paper`): fundo da página e dos cartões.

### Named Rules

**A Regra do Pincel.** O roxo aparece como tinta: pincelada, sublinhado, ilustração. O botão principal é tinta escura, não roxo.

**A Regra do Roxo.** O acento é roxo. O laranja da referência não entra em lugar nenhum.

## Typography

**Display Font:** Instrument Serif (com Georgia, serif)
**Body Font:** Figtree (com system-ui, sans-serif)

**Character:** uma serifa moderna, estreita e de traço fino, com cara de revista contemporânea, ao lado de uma sans neutra que fica fora do caminho.

### Hierarchy

- **Display** (400, `clamp(2.5rem, 5vw, 3.75rem)`, 1.05): título do hero, centralizado, em duas linhas curtas, com uma palavra sublinhada à mão.
- **Headline** (400, `clamp(1.75rem, 3vw, 2.5rem)`, 1.15): títulos de seção, alinhados à esquerda, com no máximo ~22 caracteres por linha.
- **Title** (400, 1.375rem, 1.3): títulos de cartão e de item.
- **Body** (400, 1rem, 1.6): parágrafos, no máximo 65ch; o subtítulo do hero fica em ~45ch.
- **Label** (500, 0.875rem, 1.2): navegação, botões, microcopy abaixo do CTA. Sem caixa alta.

### Named Rules

**A Regra do Peso Leve.** Títulos ficam sempre em 400, o único peso da Instrument Serif; nada de negrito sintético. A presença vem do tamanho e do respiro, não do negrito.

## Layout

Coluna central com largura máxima de 1120px e margem lateral de 24px (16px no celular). O hero é centralizado e estreito (~640px de texto): título, uma frase, um botão, uma linha de microcopy. Logo abaixo, o objeto principal fica sobre a pincelada e invade a faixa cinza de largura total, quebrando a fronteira entre as seções.

Seções seguintes alternam alinhamento à esquerda e elementos que sangram para fora da tela (uma fileira de páginas cortada nas bordas). O espaço entre seções é grande (`section`); dentro delas o ritmo é `md` e `lg`. No celular a fileira vira rolagem horizontal e listas de duas colunas viram uma.

## Elevation & Depth

Plano por padrão. A profundidade pertence aos objetos de papel: folhas, cartões de página e o envelope têm sombra suave, como se estivessem pousados na mesa. Elementos de interface não têm sombra.

### Shadow Vocabulary

- **Papel pousado** (`box-shadow: 0 1px 2px rgba(34,27,43,.06), 0 8px 24px rgba(34,27,43,.08)`): cartões de página e folhas.
- **Objeto em destaque** (`box-shadow: 0 24px 48px rgba(34,27,43,.14)`): o objeto principal do hero.

## Shapes

Cantos quase retos, como papel cortado: 4px em folhas e cartões, 8px em botões. Nada de pílulas. O contraponto são as formas orgânicas: pinceladas de borda irregular e sublinhados tortos, sempre como SVG ou imagem, nunca aproximados com `border-radius`.

## Components

### Buttons

- **Shape:** retângulo de cantos suaves (8px).
- **Primary:** fundo Tinta Ameixa, texto Papel, label 500, padding 12px 20px, ícone pequeno opcional à esquerda.
- **Hover / Focus:** fundo passa para Roxo Tinta Escuro em 150ms; foco com anel de 2px em Roxo Tinta e 2px de afastamento.

### Cards / Containers

- **Cartão de página:** papel branco, 4px de raio, sombra "Papel pousado", sem borda, padding interno de 24px. Proporção de folha (aprox. 1:1.3).

### Navigation

- Logo à esquerda, links no centro em label Tinta Ameixa (hover em Roxo Tinta), botão primário à direita. Fundo transparente sobre o papel, sem borda nem sombra. No celular os links recolhem em um menu.

### Pincelada (assinatura)

- Mancha larga em Roxo Tinta, com bordas de pincel seco, atravessando o hero atrás do objeto principal e cruzando a fronteira com a faixa cinza. Uma por página.

### Sublinhado à mão (assinatura)

- Traço de pincel em Roxo Tinta sob uma única palavra do título do hero. Fica abaixo da linha de base, sem cobrir as letras.

### Marcador de lista

- Pequeno ícone ilustrado em Roxo Tinta no lugar de bullets, seguido de uma frase em body.

## Do's and Don'ts

### Do:

- **Do** manter o roxo como tinta de pincel e o botão principal em Tinta Ameixa.
- **Do** dar ao hero um título, uma frase, um botão e uma linha de microcopy, nada mais.
- **Do** deixar o objeto principal cruzar a fronteira entre o papel branco e a faixa cinza.
- **Do** usar sombra só em objetos de papel.

### Don't:

- **Don't** usar laranja; o acento deste sistema é roxo.
- **Don't** reutilizar nome, logo do pássaro ou ilustrações da referência; ela define o estilo, não os ativos.
- **Don't** pôr mais de uma pincelada grande por página.
- **Don't** usar títulos em negrito ou em caixa alta.
