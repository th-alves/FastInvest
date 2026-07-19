# ⚡ Otimizações de Performance — v2.4.3 (proposta)

Mudanças aplicadas em cima da v2.4.2, sem alterar nenhuma funcionalidade.
Todo o código-fonte original continua no repo (`app.js`, `styles.css`,
`ativos-db.js`) — só foram criadas versões `.min` pra produção e ajustado
o `index.html` pra apontar pra elas.

## O que mudou

### 1. Favicon: 312KB → ~3.7KB
O `favicon.png` era na verdade um JPEG de 1024x1024 disfarçado com extensão
`.png`. Agora existem dois arquivos reais:
- `favicon-32.png` (352 bytes) — ícone da aba do navegador
- `favicon.png` (3.3KB, 180x180) — apple-touch-icon

### 2. Google Fonts: 7 pesos → 5 pesos
Cortados os pesos `300` e `900` da Inter, que não são usados em nenhuma
regra do CSS (confirmado por busca em todo o `styles.css`).

### 3. Scripts com `defer`
`supabase-js`, `supabase-config.js` e `app.min.js` agora carregam com
`defer`, sem bloquear o parsing do HTML.

### 4. `ativos-db.js` (base de ~440 tickers) virou lazy-load
Antes carregava sempre, pra todo mundo, mesmo quem nunca abre a aba
Ativos. Agora só é buscado quando a aba Ativos é aberta pela primeira vez,
via `ensureAtivosDbLoaded()` em `app.js`. Tem guard-clause tanto no preview
de ticker (`handleAtivoTickerInput`) quanto no salvar (`saveAtivo`), pro
caso raro de o usuário digitar/salvar antes do script terminar de chegar.

### 5. `transition: all` → propriedades explícitas
As 21 ocorrências de `transition: all` no CSS foram trocadas por listas
específicas (`color`, `background-color`, `border-color`, `transform`,
`box-shadow` — só o que cada elemento de fato anima no hover/active).
Menos trabalho de recálculo de estilo por frame.

### 6. Partículas do dashboard: 20 → 12
Reduzido só no container `dashboardParticles` (onde o usuário fica mais
tempo). Intro e tela de login continuam com 20, já que são telas rápidas.

### 7. Suporte a `prefers-reduced-motion`
Quem tem "reduzir movimento" ativado no sistema operacional agora tem as
partículas totalmente paradas e todas as animações/transições reduzidas
a praticamente zero, em vez de forçar o movimento decorativo.

### 8. Minificação
Geradas `app.min.js`, `styles.min.css` e `ativos-db.min.js` (via `terser`
e `clean-css`). É isso que o `index.html` carrega agora — os arquivos
`.js`/`.css` "normais" continuam sendo a fonte de verdade pra edição.

| Arquivo (o que o navegador baixa) | Antes | Depois |
|---|---|---|
| `app.js` → `app.min.js` | 100KB | 57KB |
| `ativos-db.js` → `ativos-db.min.js` (agora só se abrir a aba Ativos) | 51KB (sempre) | 40KB (sob demanda) |
| `styles.css` → `styles.min.css` | 100KB | 72KB |
| favicon | 312KB | ~3.7KB |

## ⚠️ Importante pro fluxo de trabalho

A partir de agora, **sempre que editar `app.js`, `styles.css` ou
`ativos-db.js`, é preciso regerar o `.min` correspondente** antes de subir
pro Vercel, senão a alteração não aparece no site (o HTML aponta pro
arquivo minificado, não pro original). Agora isso é um comando só:

```bash
npm run build
```

Esse comando roda os três minificadores de uma vez (`app.min.js`,
`ativos-db.min.js` e `styles.min.css`). Na primeiríssima vez que rodar em
uma máquina nova, o `npx` baixa os pacotes `terser` e `clean-css-cli` da
internet automaticamente — não precisa instalar nada manualmente antes,
só ter o Node.js instalado (`node -v` pra conferir).

Se quiser rodar cada minificador separado por algum motivo, também dá:
```bash
npm run build:js           # só o app.js
npm run build:ativos-db    # só o ativos-db.js
npm run build:css          # só o styles.css
```
