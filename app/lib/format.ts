const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export function money(cents: number): string {
  return eur.format(cents / 100);
}

/** Aceita "12,50", "12.50" ou "12" e devolve cêntimos; null se vazio/inválido. */
export function parseMoney(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-PT");
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const STATUS_LABELS: Record<string, string> = {
  in_stock: "Em stock",
  listed: "À venda",
  sold: "Vendido",
  returned: "Devolvido",
};
