import { NextRequest, NextResponse } from "next/server";
import { fetchVintedListing } from "@/lib/vinted";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Falta o parâmetro url." }, { status: 400 });
  }
  try {
    const listing = await fetchVintedListing(url);
    return NextResponse.json(listing);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao obter o anúncio.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
