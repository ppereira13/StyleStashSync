# StyleStashHome — site da loja

Site estático da loja (montra pública). As vendas concluem-se sempre na Vinted:
<https://www.vinted.pt/member/195656793>

## Como funciona

- `index.html` + `styles.css` + `app.js` — o site em si, sem build nem dependências.
- `montra.json` — as peças em destaque. **Não editar à mão**: é gerado pelo botão
  **"Atualizar site da loja"** no dashboard da app de gestão (`../app`).
- `assets/pecas/` — fotos das peças, copiadas/descarregadas pela mesma exportação.
- `assets/logo.webp` — o logótipo (vindo do perfil Vinted, 310px). Se guardares aqui
  o original em maior resolução como `logo.webp`, o site usa-o automaticamente.

### Que peças entram na montra?

Artigos da app com estado **Em stock** ou **À venda** que tenham **foto** ou **link
do anúncio Vinted**. Se um artigo só tiver o link, a exportação vai buscar a foto e
o preço ao anúncio automaticamente (e guarda-os na app). Ou seja: para encher a
montra basta colar o link do anúncio em *Artigos → Editar… → Link do anúncio* e
carregar em "Atualizar site da loja".

## Ver localmente

```bash
npx serve . -l 4173
```

Abre <http://localhost:4173>.

## Publicar (grátis)

Qualquer alojamento estático serve — a pasta inteira é o site:

- **Netlify Drop** (mais fácil): <https://app.netlify.com/drop> → arrasta a pasta `site/`.
- **Vercel**: `npx vercel` dentro desta pasta.
- **GitHub Pages**: repositório com este conteúdo → Settings → Pages.

Para atualizar o site publicado: botão "Atualizar site da loja" na app → voltar a
publicar a pasta (no Netlify Drop é arrastar outra vez).
