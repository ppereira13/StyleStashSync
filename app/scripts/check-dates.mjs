// Verificação de coerência de datas na base de dados.
import Database from "better-sqlite3";

const db = new Database("data/vinted.db");
const bad = db
  .prepare(
    `SELECT id, name, brand, substr(created_at,1,10) AS buy, sold_at, sold_price_cents
     FROM items
     WHERE sold_at IS NOT NULL AND (sold_at > date('now') OR sold_at < substr(created_at,1,10))`,
  )
  .all();
console.log(JSON.stringify(bad, null, 1));
