# StyleStashSync

Gestão e presença online da **StyleStashHome** — loja de roupa premium em segunda mão
na Vinted (Ralph Lauren · Carhartt · Lacoste).

| Pasta | O que é |
|---|---|
| [`app/`](app/) | App de gestão (Next.js + SQLite): compras, vendas, análises, anúncios com IA, exportações. Corre localmente — ver [app/README.md](app/README.md). |
| [`site/`](site/) | Site público da loja (estático). A montra é gerada pela app com o botão "Atualizar site da loja" — ver [site/README.md](site/README.md). |

## Arrancar

```bash
# app de gestão → http://localhost:3000
cd app && npm install && npm run dev

# site da loja → http://localhost:4173
cd site && npx serve . -l 4173
```

Os dados do negócio vivem em `app/data/` (SQLite, fotos, credenciais) — **fora do git**.
Loja na Vinted: <https://www.vinted.pt/member/195656793>
