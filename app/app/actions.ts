"use server";

import { revalidatePath } from "next/cache";
import { getDb, Item } from "@/lib/db";
import { parseMoney, text, todayISO, money } from "@/lib/format";
import { savePhoto } from "@/lib/photos";
import { fetchVintedListing } from "@/lib/vinted";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/artigos");
  revalidatePath("/compras");
  revalidatePath("/despesas");
}

/** Cria uma compra (lote) com os seus artigos. Se os artigos não tiverem
 *  custo individual, o total (+ portes) é dividido igualmente entre eles. */
export async function addPurchase(formData: FormData) {
  const db = getDb();

  const date = text(formData.get("date")) ?? todayISO();
  const source = text(formData.get("source")) ?? "vinted";
  const description = text(formData.get("description")) ?? "Compra";
  const totalCents = parseMoney(formData.get("total")) ?? 0;
  const shippingCents = parseMoney(formData.get("shipping")) ?? 0;
  const notes = text(formData.get("notes"));

  const names = formData.getAll("item_name").map((v) => String(v).trim());
  const brands = formData.getAll("item_brand");
  const categories = formData.getAll("item_category");
  const sizes = formData.getAll("item_size");
  const conditions = formData.getAll("item_condition");
  const costs = formData.getAll("item_cost");
  const urls = formData.getAll("item_url");
  const itemNotes = formData.getAll("item_notes");
  const photoUrls = formData.getAll("item_photo_url");
  const photoFiles = formData.getAll("item_photo");

  const rows = await Promise.all(
    names.map(async (name, idx) => ({
      name,
      brand: text(brands[idx] ?? null),
      category: text(categories[idx] ?? null),
      size: text(sizes[idx] ?? null),
      condition: text(conditions[idx] ?? null),
      costCents: parseMoney(costs[idx] ?? null),
      url: text(urls[idx] ?? null),
      notes: text(itemNotes[idx] ?? null),
      photo: (await savePhoto(photoFiles[idx])) ?? text(photoUrls[idx] ?? null),
    })),
  ).then((all) => all.filter((r) => r.name.length > 0));

  const insertPurchase = db.prepare(
    `INSERT INTO purchases (date, source, description, total_cents, shipping_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertItem = db.prepare(
    `INSERT INTO items (purchase_id, name, brand, category, size, condition, cost_cents, vinted_url, notes, photo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    const purchaseId = insertPurchase.run(
      date,
      source,
      description,
      totalCents,
      shippingCents,
      notes,
    ).lastInsertRowid;

    const missing = rows.filter((r) => r.costCents === null).length;
    const allocated = rows.reduce((a, r) => a + (r.costCents ?? 0), 0);
    const remainder = Math.max(0, totalCents + shippingCents - allocated);
    const share = missing > 0 ? Math.round(remainder / missing) : 0;

    for (const r of rows) {
      insertItem.run(
        purchaseId,
        r.name,
        r.brand,
        r.category,
        r.size,
        r.condition,
        r.costCents ?? share,
        r.url,
        r.notes,
        r.photo,
        date + " 12:00:00",
      );
    }
  })();

  revalidateAll();
}

/** Associa o anúncio Vinted a um artigo: guarda o link e importa foto, preço
 *  e dados em falta diretamente do anúncio; marca o artigo como "À venda". */
export async function attachListing(
  itemId: number,
  url: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as
      | Item
      | undefined;
    if (!item) return { ok: false, message: "Artigo não encontrado." };
    if (item.status === "sold") {
      return { ok: false, message: "Este artigo já está vendido." };
    }

    const listing = await fetchVintedListing(url);

    const priceCents =
      listing.price !== null ? Math.round(listing.price * 100) : item.listed_price_cents;

    db.prepare(
      `UPDATE items SET
         vinted_url = ?,
         photo = COALESCE(photo, ?),
         listed_price_cents = ?,
         brand = COALESCE(brand, ?),
         size = COALESCE(size, ?),
         condition = COALESCE(condition, ?),
         status = 'listed',
         listed_at = COALESCE(listed_at, ?)
       WHERE id = ?`,
    ).run(
      listing.url,
      listing.image,
      priceCents,
      listing.brand,
      listing.size,
      listing.condition,
      todayISO(),
      itemId,
    );

    revalidateAll();
    const gotPhoto = !item.photo && listing.image !== null;
    const gotPrice = priceCents !== null;
    const extras =
      gotPhoto && gotPrice
        ? ` — foto e preço (${money(priceCents!)}) importados`
        : gotPhoto
          ? " — foto importada"
          : gotPrice
            ? ` — preço (${money(priceCents!)}) importado`
            : "";
    return {
      ok: true,
      message: `Anúncio associado${extras}. Artigo marcado "À venda".`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Erro ao associar o anúncio.",
    };
  }
}

/** Edição completa de um artigo (correção de dados importados, datas, preços…). */
export async function updateItem(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get("id"));
  const purchaseDate = text(formData.get("purchase_date"));
  const soldAt = text(formData.get("sold_at"));
  const photo = (await savePhoto(formData.get("photo_file"))) ?? text(formData.get("photo"));

  db.prepare(
    `UPDATE items SET
       name = ?, brand = ?, category = ?, size = ?, condition = ?,
       cost_cents = ?, extra_cents = ?,
       listed_price_cents = ?, vinted_url = ?, photo = ?,
       sold_price_cents = CASE WHEN status = 'sold' THEN ? ELSE sold_price_cents END,
       sold_fees_cents = ?, sold_shipping_cents = ?,
       sold_at = CASE WHEN status = 'sold' THEN COALESCE(?, sold_at) ELSE sold_at END,
       created_at = COALESCE(?, created_at),
       notes = ?
     WHERE id = ?`,
  ).run(
    text(formData.get("name")) ?? "Artigo",
    text(formData.get("brand")),
    text(formData.get("category")),
    text(formData.get("size")),
    text(formData.get("condition")),
    parseMoney(formData.get("cost")) ?? 0,
    parseMoney(formData.get("extra")) ?? 0,
    parseMoney(formData.get("listed_price")),
    text(formData.get("vinted_url")),
    photo,
    parseMoney(formData.get("sold_price")) ?? 0,
    parseMoney(formData.get("sold_fees")) ?? 0,
    parseMoney(formData.get("sold_shipping")) ?? 0,
    soldAt,
    purchaseDate ? purchaseDate + " 12:00:00" : null,
    text(formData.get("notes")),
    id,
  );
  revalidateAll();
}

export async function markListed(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get("id"));
  const price = parseMoney(formData.get("listed_price"));
  const url = text(formData.get("vinted_url"));
  db.prepare(
    `UPDATE items SET status = 'listed', listed_price_cents = ?, listed_at = ?,
     vinted_url = COALESCE(?, vinted_url) WHERE id = ?`,
  ).run(price, todayISO(), url, id);
  revalidateAll();
}

export async function markSold(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get("id"));
  const price = parseMoney(formData.get("sold_price")) ?? 0;
  const fees = parseMoney(formData.get("sold_fees")) ?? 0;
  const shipping = parseMoney(formData.get("sold_shipping")) ?? 0;
  const date = text(formData.get("sold_at")) ?? todayISO();
  const platform = text(formData.get("platform")) ?? "vinted";
  db.prepare(
    `UPDATE items SET status = 'sold', sold_price_cents = ?, sold_fees_cents = ?,
     sold_shipping_cents = ?, sold_at = ?, platform = ? WHERE id = ?`,
  ).run(price, fees, shipping, date, platform, id);
  revalidateAll();
}

export async function undoSale(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get("id"));
  db.prepare(
    `UPDATE items SET status = CASE WHEN listed_at IS NULL THEN 'in_stock' ELSE 'listed' END,
     sold_price_cents = NULL, sold_fees_cents = 0, sold_shipping_cents = 0, sold_at = NULL
     WHERE id = ?`,
  ).run(id);
  revalidateAll();
}

export async function deleteItem(formData: FormData) {
  const db = getDb();
  db.prepare("DELETE FROM items WHERE id = ?").run(Number(formData.get("id")));
  revalidateAll();
}

export async function addExpense(formData: FormData) {
  const db = getDb();
  const date = text(formData.get("date")) ?? todayISO();
  const description = text(formData.get("description")) ?? "Despesa";
  const category = text(formData.get("category"));
  const amount = parseMoney(formData.get("amount")) ?? 0;
  db.prepare(
    "INSERT INTO expenses (date, description, category, amount_cents) VALUES (?, ?, ?, ?)",
  ).run(date, description, category, amount);
  revalidateAll();
}

export async function deleteExpense(formData: FormData) {
  const db = getDb();
  db.prepare("DELETE FROM expenses WHERE id = ?").run(Number(formData.get("id")));
  revalidateAll();
}

export async function deletePurchase(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get("id"));
  db.transaction(() => {
    db.prepare("DELETE FROM items WHERE purchase_id = ?").run(id);
    db.prepare("DELETE FROM purchases WHERE id = ?").run(id);
  })();
  revalidateAll();
}
