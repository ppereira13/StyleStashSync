"use server";

import { getDb, Item } from "@/lib/db";
import { generateListing, GeneratedListing } from "@/lib/ai";

export interface ListingResult {
  ok: boolean;
  listing?: GeneratedListing;
  message?: string;
}

export async function generateListingAction(id: number): Promise<ListingResult> {
  try {
    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
      | Item
      | undefined;
    if (!item) return { ok: false, message: "Artigo não encontrado." };

    const listing = await generateListing(item);
    return { ok: true, listing };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Erro ao gerar o anúncio.",
    };
  }
}
