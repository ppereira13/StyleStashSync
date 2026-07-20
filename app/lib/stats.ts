import { getDb, Item, itemProfitCents } from "./db";

export interface DashboardStats {
  investedCents: number;
  revenueCents: number;
  feesCents: number;
  expensesCents: number;
  netProfitCents: number;
  soldCount: number;
  stockCount: number;
  stockValueCents: number;
  roiPct: number | null;
  avgDaysToSell: number | null;
}

export interface MonthPoint {
  month: string; // "2026-07"
  profitCents: number;
  salesCount: number;
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();

  const items = db.prepare("SELECT * FROM items").all() as Item[];
  const expensesCents =
    (
      db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS s FROM expenses").get() as {
        s: number;
      }
    ).s ?? 0;

  const sold = items.filter((i) => i.status === "sold");
  const stock = items.filter((i) => i.status === "in_stock" || i.status === "listed");

  const investedCents = items.reduce((a, i) => a + i.cost_cents + i.extra_cents, 0);
  const revenueCents = sold.reduce((a, i) => a + (i.sold_price_cents ?? 0), 0);
  const feesCents = sold.reduce(
    (a, i) => a + i.sold_fees_cents + i.sold_shipping_cents,
    0,
  );
  const grossProfitCents = sold.reduce((a, i) => a + itemProfitCents(i), 0);
  const netProfitCents = grossProfitCents - expensesCents;

  const costOfSold = sold.reduce((a, i) => a + i.cost_cents + i.extra_cents, 0);
  const roiPct = costOfSold > 0 ? (grossProfitCents / costOfSold) * 100 : null;

  const daysToSell = sold
    .filter((i) => i.sold_at)
    .map((i) => {
      const start = new Date(i.created_at).getTime();
      const end = new Date(i.sold_at! + "T12:00:00").getTime();
      return Math.max(0, (end - start) / 86_400_000);
    });
  const avgDaysToSell =
    daysToSell.length > 0
      ? daysToSell.reduce((a, d) => a + d, 0) / daysToSell.length
      : null;

  return {
    investedCents,
    revenueCents,
    feesCents,
    expensesCents,
    netProfitCents,
    soldCount: sold.length,
    stockCount: stock.length,
    stockValueCents: stock.reduce((a, i) => a + i.cost_cents + i.extra_cents, 0),
    roiPct,
    avgDaysToSell,
  };
}

/** Lucro mensal (vendas − custos dos artigos vendidos − despesas do mês), últimos 12 meses. */
export function getMonthlyProfit(): MonthPoint[] {
  const db = getDb();
  const months: MonthPoint[] = [];
  const now = new Date();

  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month, profitCents: 0, salesCount: 0 });
  }
  const byMonth = new Map(months.map((m) => [m.month, m]));

  const sold = db
    .prepare("SELECT * FROM items WHERE status = 'sold' AND sold_at IS NOT NULL")
    .all() as Item[];
  for (const i of sold) {
    const m = byMonth.get(i.sold_at!.slice(0, 7));
    if (m) {
      m.profitCents += itemProfitCents(i);
      m.salesCount += 1;
    }
  }

  const expenses = db
    .prepare("SELECT substr(date,1,7) AS month, SUM(amount_cents) AS s FROM expenses GROUP BY 1")
    .all() as { month: string; s: number }[];
  for (const e of expenses) {
    const m = byMonth.get(e.month);
    if (m) m.profitCents -= e.s;
  }

  return months;
}

export interface GroupStats {
  label: string;
  soldCount: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number | null;
  avgDays: number | null;
}

function groupStats(field: "brand" | "category", limit: number): GroupStats[] {
  const db = getDb();
  const sold = db
    .prepare("SELECT * FROM items WHERE status = 'sold'")
    .all() as Item[];

  const groups = new Map<string, Item[]>();
  for (const i of sold) {
    const label = (i[field] ?? "").trim() || "Sem indicação";
    const list = groups.get(label) ?? [];
    list.push(i);
    groups.set(label, list);
  }

  const rows: GroupStats[] = [];
  for (const [label, items] of groups) {
    const revenueCents = items.reduce((a, i) => a + (i.sold_price_cents ?? 0), 0);
    const profitCents = items.reduce((a, i) => a + itemProfitCents(i), 0);
    const days = items
      .filter((i) => i.sold_at)
      .map((i) =>
        Math.max(
          0,
          (new Date(i.sold_at! + "T12:00:00").getTime() -
            new Date(i.created_at).getTime()) /
            86_400_000,
        ),
      );
    rows.push({
      label,
      soldCount: items.length,
      revenueCents,
      profitCents,
      marginPct: revenueCents > 0 ? (profitCents / revenueCents) * 100 : null,
      avgDays: days.length ? days.reduce((a, d) => a + d, 0) / days.length : null,
    });
  }
  return rows.sort((a, b) => b.profitCents - a.profitCents).slice(0, limit);
}

export function getBrandStats(limit = 8): GroupStats[] {
  return groupStats("brand", limit);
}

export function getCategoryStats(limit = 8): GroupStats[] {
  return groupStats("category", limit);
}

export interface StaleItem extends Item {
  days: number;
}

/** Artigos em stock ordenados do mais antigo para o mais recente. */
export function getStaleStock(limit = 10): StaleItem[] {
  const db = getDb();
  const stock = db
    .prepare(
      "SELECT * FROM items WHERE status IN ('in_stock','listed') ORDER BY created_at ASC LIMIT ?",
    )
    .all(limit) as Item[];
  const now = Date.now();
  return stock.map((i) => ({
    ...i,
    days: Math.floor((now - new Date(i.created_at).getTime()) / 86_400_000),
  }));
}

export function getRecentSales(limit = 8): Item[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM items WHERE status = 'sold' ORDER BY sold_at DESC, id DESC LIMIT ?",
    )
    .all(limit) as Item[];
}
