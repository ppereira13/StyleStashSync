// Aplica a coluna listing_photo à base ativa (o dev server mantém a ligação em cache).
import Database from "better-sqlite3";
const db = new Database("data/vinted.db");
const cols = db.prepare("PRAGMA table_info(items)").all().map((c) => c.name);
if (!cols.includes("listing_photo")) {
  db.exec("ALTER TABLE items ADD COLUMN listing_photo TEXT");
  console.log("coluna listing_photo adicionada");
} else {
  console.log("já existia");
}
