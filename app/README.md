# Vinted Reseller

App local de gestão do negócio de revenda na Vinted.

## Correr

```bash
cd app
npm install
npm run dev
```

Abre <http://localhost:3000>.

## O que faz (Fase 1)

- **Dashboard** — lucro líquido, receita, investido, stock, ROI, tempo médio até venda, gráfico de lucro mensal e últimas vendas.
- **Compras** — regista uma compra (ou lote) com vários artigos; se não indicares o custo individual, o total + portes é dividido igualmente pelos artigos.
- **Artigos** — lista com filtros (em stock / à venda / vendidos) e pesquisa; ações por artigo: pôr à venda, registar venda, anular venda, apagar.
- **Despesas** — custos gerais do negócio (material de envio, destaques, etc.), descontados ao lucro líquido.

- **Importar do link (Fase 2)** — na página Compras, cola o link de um anúncio Vinted e a app preenche nome, marca, tamanho, estado, preço e foto automaticamente.
- **Anúncio IA (Fase 3)** — em cada artigo em stock, "Anúncio IA…" gera título e descrição prontos para a Vinted (usa os dados + a foto da peça; declara defeitos das notas). Editável e com botões de copiar.
- **Análises** — lucro por marca e por categoria (vendas, margem, dias até vender) e lista de stock parado com sugestões.
- **Fotos e comentários por artigo** — em cada artigo podes carregar uma foto (ficheiro) ou usar a do anúncio, e escrever comentários (defeitos, medidas…). As fotos locais ficam em `data/photos/`.
- **Editar artigos** — qualquer campo (datas, preços, nomes) é editável na página Artigos via "Editar…".
- **Exportar** — botões no Dashboard: CSV (download imediato) e Google Sheets (abas "App Artigos" / "App Despesas" na folha original).
- **Atualizar site da loja** — botão no Dashboard que gera a montra do site público (`../site`): exporta artigos em stock/à venda com foto ou link de anúncio; se só houver link, vai buscar a foto e o preço ao anúncio automaticamente. Ver `../site/README.md`.

Os dados ficam em `data/vinted.db` (SQLite, fora do git). Para backup basta copiar esse ficheiro.

## Configurar a exportação para Google Sheets

1. Em <https://console.cloud.google.com> cria (ou usa) um projeto, ativa a **Google Sheets API** e cria uma **service account** (IAM e administrador → Contas de serviço).
2. Nessa conta, cria uma chave JSON (Chaves → Adicionar chave → JSON) e guarda o ficheiro como `data/google-credentials.json` (a pasta `data/` está fora do git).
3. Abre a folha no Google Sheets e partilha-a (Editor) com o email da service account (algo como `nome@projeto.iam.gserviceaccount.com`).
4. (Opcional) define `GOOGLE_SHEET_ID` em `.env.local` para exportar para outra folha; por omissão usa a folha original.

## Configurar o Anúncio IA (chave da Anthropic)

1. Cria uma chave em <https://console.anthropic.com> (Settings → API Keys).
2. Cria o ficheiro `.env.local` nesta pasta com: `ANTHROPIC_API_KEY=sk-ant-…`
3. Reinicia o servidor (`npm run dev`). Cada geração custa poucos cêntimos.

## Fases seguintes (planeado)

3. (resto) Melhoria de fotos com IA (fundo, luz).
4. Preparação semi-automática de anúncios (Playwright).
