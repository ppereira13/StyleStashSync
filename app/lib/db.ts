import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type ItemStatus = "in_stock" | "listed" | "sold" | "returned";

export interface Purchase {
  id: number;
  date: string;
  source: string;
  description: string;
  total_cents: number;
  shipping_cents: number;
  notes: string | null;
  created_at: string;
}

export interface Item {
  id: number;
  purchase_id: number | null;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  condition: string | null;
  cost_cents: number;
  extra_cents: number;
  status: ItemStatus;
  listed_price_cents: number | null;
  listed_at: string | null;
  vinted_url: string | null;
  sold_price_cents: number | null;
  sold_fees_cents: number;
  sold_shipping_cents: number;
  sold_at: string | null;
  platform: string | null;
  notes: string | null;
  photo: string | null;
  listing_photo: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  date: string;
  description: string;
  category: string | null;
  amount_cents: number;
  created_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'vinted',
  description TEXT NOT NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  size TEXT,
  condition TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  extra_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_stock',
  listed_price_cents INTEGER,
  listed_at TEXT,
  vinted_url TEXT,
  sold_price_cents INTEGER,
  sold_fees_cents INTEGER NOT NULL DEFAULT 0,
  sold_shipping_cents INTEGER NOT NULL DEFAULT 0,
  sold_at TEXT,
  platform TEXT,
  notes TEXT,
  photo TEXT,
  listing_photo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_sold_at ON items(sold_at);
`;

declare global {
  var __vintedDb: Database.Database | undefined;
}

function open(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "vinted.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  // migrações: bases criadas antes de colunas novas
  const cols = db.prepare("PRAGMA table_info(items)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "photo")) {
    db.exec("ALTER TABLE items ADD COLUMN photo TEXT");
  }
  if (!cols.some((c) => c.name === "listing_photo")) {
    db.exec("ALTER TABLE items ADD COLUMN listing_photo TEXT");
  }
  return db;
}

export function getDb(): Database.Database {
  // Reuse the connection across Next.js dev-server hot reloads
  if (!globalThis.__vintedDb) globalThis.__vintedDb = open();
  return globalThis.__vintedDb;
}

/** Lucro de um artigo vendido (cêntimos). */
export function itemProfitCents(i: Item): number {
  return (
    (i.sold_price_cents ?? 0) -
    i.sold_fees_cents -
    i.sold_shipping_cents -
    i.cost_cents -
    i.extra_cents
  );
}
