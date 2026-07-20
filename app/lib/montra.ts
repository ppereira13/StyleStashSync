import fs from "node:fs";
import path from "node:path";
import { getDb, Item } from "./db";
import { fetchVintedListing } from "./vinted";

// O site público vive em ../site (irmão da pasta app/)
const SITE_DIR = path.resolve(process.cwd(), "..", "site");
const PECAS_DIR = path.join(SITE_DIR, "assets", "pecas");

const VINTED_PROFILE = "https://www.vinted.pt/member/195656793";

interface MontraPeca {
  id: number;
  nome: string;
  marca: string | null;
  tamanho: string | null;
  estado: string | null;
  preco: number | null;
  foto: string;
  link: string | null;
  disponivel: boolean;
}

function extFromUrl(url: string): string {
  const m = url.match(/\.(webp|jpe?g|png|avif|gif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "webp";
}

/** Resolve uma foto para um ficheiro dentro de site/assets/pecas.
 *  Devolve o caminho relativo ao site, ou o URL remoto se o download falhar. */
async function resolvePhoto(item: Item, photo: string): Promise<string | null> {
  if (photo.startsWith("/api/photos/")) {
    const name = photo.slice("/api/photos/".length);
    if (!/^[\w.-]+$/.test(name)) return null;
    const src = path.join(process.cwd(), "data", "photos", name);
    if (!fs.existsSync(src)) return null;
    const dest = `peca-${item.id}${path.extname(name).toLowerCase() || ".jpg"}`;
    fs.copyFileSync(src, path.join(PECAS_DIR, dest));
    return `assets/pecas/${dest}`;
  }
  if (photo.startsWith("https://")) {
    const dest = `peca-${item.id}.${extFromUrl(photo)}`;
    const destPath = path.join(PECAS_DIR, dest);
    try {
      const res = await fetch(photo, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(String(res.status));
      fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
      return `assets/pecas/${dest}`;
    } catch {
      // sem download, o site usa o URL remoto diretamente
      return photo;
    }
  }
  return null;
}

/** Gera site/montra.json e copia as fotos das peças para o site. */
export async function exportMontra(): Promise<{ pecas: number; ficheiro: string }> {
  if (!fs.existsSync(SITE_DIR)) {
    throw new Error(`A pasta do site não existe (${SITE_DIR}).`);
  }
  fs.mkdirSync(PECAS_DIR, { recursive: true });

  const db = getDb();
  const items = db
    .prepare(
      `SELECT * FROM items
       WHERE status IN ('listed','in_stock')
         AND (photo IS NOT NULL OR listing_photo IS NOT NULL OR vinted_url IS NOT NULL)
       ORDER BY CASE status WHEN 'listed' THEN 0 ELSE 1 END,
                listed_at DESC, created_at DESC
       LIMIT 80`,
    )
    .all() as Item[];

  // Artigos com link do anúncio mas sem foto do anúncio: vamos buscá-la (e o
  // preço) à Vinted uma única vez, e fica guardada na base para o futuro.
  const setListingPhoto = db.prepare("UPDATE items SET listing_photo = ? WHERE id = ?");
  const setListedPrice = db.prepare(
    "UPDATE items SET listed_price_cents = ? WHERE id = ? AND listed_price_cents IS NULL",
  );
  for (const item of items) {
    if (item.listing_photo || !item.vinted_url) continue;
    try {
      const listing = await fetchVintedListing(item.vinted_url);
      if (listing.image) {
        setListingPhoto.run(listing.image, item.id);
        item.listing_photo = listing.image;
      }
      if (listing.price !== null && item.listed_price_cents === null) {
        setListedPrice.run(Math.round(listing.price * 100), item.id);
        item.listed_price_cents = Math.round(listing.price * 100);
      }
    } catch {
      // anúncio indisponível — usamos o que houver na base
    }
  }

  const soldCount = (
    db.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'sold'").get() as {
      n: number;
    }
  ).n;

  const pecas: MontraPeca[] = [];
  for (const item of items) {
    const fonte = item.listing_photo ?? item.photo;
    if (!fonte) continue;
    const foto = await resolvePhoto(item, fonte);
    if (!foto) continue;
    pecas.push({
      id: item.id,
      nome: item.name,
      marca: item.brand,
      tamanho: item.size,
      estado: item.condition,
      preco: item.listed_price_cents !== null ? item.listed_price_cents / 100 : null,
      foto,
      link: item.vinted_url,
      disponivel: item.status === "listed" && item.vinted_url !== null,
    });
  }

  const montra = {
    atualizado: new Date().toISOString(),
    loja: {
      nome: "StyleStashHome",
      username: "stylestashhome",
      vinted: VINTED_PROFILE,
      vendas: soldCount,
    },
    pecas,
  };

  const ficheiro = path.join(SITE_DIR, "montra.json");
  fs.writeFileSync(ficheiro, JSON.stringify(montra, null, 2));
  return { pecas: pecas.length, ficheiro };
}
