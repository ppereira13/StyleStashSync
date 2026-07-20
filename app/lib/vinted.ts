export interface VintedListing {
  url: string;
  title: string;
  brand: string | null;
  price: number | null; // euros
  description: string | null;
  color: string | null;
  size: string | null;
  condition: string | null;
  image: string | null;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
};

const ITEM_URL = /^https:\/\/(www\.)?vinted\.[a-z.]+\/items\/\d+/;

export function isVintedItemUrl(url: string): boolean {
  return ITEM_URL.test(url.trim());
}

/** Lê os atributos "size" / "status" do HTML da página do anúncio. */
function domAttribute(html: string, testId: string): string | null {
  const anchor = html.indexOf(`"item-attributes-${testId}"`);
  if (anchor < 0) return null;
  const slice = html.slice(anchor, anchor + 2000);
  const m = slice.match(/bold">([^<]+)</);
  return m ? m[1].trim() : null;
}

export async function fetchVintedListing(url: string): Promise<VintedListing> {
  const clean = url.trim().split("?")[0];
  if (!isVintedItemUrl(clean)) {
    throw new Error("O link não parece ser de um anúncio Vinted (formato esperado: https://www.vinted.pt/items/…).");
  }

  const res = await fetch(clean, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`A Vinted respondeu com o estado ${res.status} — tenta outra vez daqui a uns segundos.`);
  }
  const html = await res.text();

  interface LdProduct {
    name?: string;
    description?: string;
    image?: string | string[];
    color?: string;
    brand?: { name?: string };
    offers?: { price?: number | string };
  }
  let ld: LdProduct = {};
  const ldMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (ldMatch) {
    try {
      ld = JSON.parse(ldMatch[1]) as LdProduct;
    } catch {
      // segue para os fallbacks de meta tags
    }
  }

  const og = (prop: string): string | null => {
    const m = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`));
    return m ? m[1] : null;
  };

  // Preço: JSON-LD → meta → DOM (data-testid="item-price") → dados embebidos
  let price: number | null = null;
  const priceRaw = ld.offers?.price ?? og("product:price:amount");
  if (priceRaw !== undefined && priceRaw !== null && Number.isFinite(Number(priceRaw))) {
    price = Number(priceRaw);
  }
  if (price === null) {
    const anchor = html.indexOf('data-testid="item-price"');
    if (anchor >= 0) {
      const m = html.slice(anchor, anchor + 400).match(/>([\d\s.]*\d,\d{2}|\d+)\s*€</);
      if (m) {
        const n = Number(m[1].replace(/[\s.]/g, "").replace(",", "."));
        if (Number.isFinite(n)) price = n;
      }
    }
  }
  if (price === null) {
    const m = html.match(/originalAskingAmount\\":\{\\"amount\\":\\"([\d.]+)/);
    if (m && Number.isFinite(Number(m[1]))) price = Number(m[1]);
  }

  // Marca: JSON-LD → dados embebidos (brand_dto)
  let brand = ld.brand?.name ?? null;
  if (!brand) {
    const m = html.match(/brand_dto\\":\{\\"id\\":\d+,\\"title\\":\\"([^\\"]+)/);
    if (m) brand = m[1];
  }

  const rawTitle = ld.name ?? og("og:title");
  if (!rawTitle) {
    throw new Error("Não consegui extrair os dados do anúncio — a página pode ter mudado ou o anúncio já não existe.");
  }
  const title = rawTitle.replace(/\s*\|\s*Vinted\s*$/i, "").trim();

  let description = ld.description ?? og("og:description");
  if (description && description.startsWith(`${title} - `)) {
    description = description.slice(title.length + 3);
  }

  return {
    url: clean,
    title,
    brand,
    price,
    description,
    color: ld.color ?? null,
    size: domAttribute(html, "size"),
    condition: domAttribute(html, "status"),
    image: Array.isArray(ld.image) ? (ld.image[0] ?? null) : (ld.image ?? og("og:image")),
  };
}
