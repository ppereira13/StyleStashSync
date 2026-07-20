// Importa o CSV exportado do Google Sheets ("vintie_update") para data/vinted.db.
// Uso: node scripts/import-csv.mjs "C:\caminho\para\ficheiro.csv" [--wipe]
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const csvPath = process.argv[2];
const wipe = process.argv.includes("--wipe");
if (!csvPath) {
  console.error("Indica o caminho do CSV.");
  process.exit(1);
}

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- helpers ----------
const flags = [];
function flag(line, msg) {
  flags.push(`linha ${line}: ${msg}`);
}

function parseMoneyCents(s) {
  if (!s) return null;
  const t = s.trim().replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const MONTHS = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, março: 3, marco: 3,
  abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7,
  ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10,
  nov: 11, novembro: 11, dez: 12, dezembro: 12,
};

/** "out.-24" / "novembro-25" → "2024-10-01" */
function parseMonthMarker(s) {
  const m = s.trim().toLowerCase().match(/^([a-zç]+)\.?\s*-\s*(\d{2})$/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  if (!month) return null;
  return `20${m[2]}-${String(month).padStart(2, "0")}-01`;
}

/** Datas mistas M/D/YYYY e D/M/YYYY. Regras:
 *  - se 1º nº > 12 → D/M; se 2º nº > 12 → M/D;
 *  - ambíguo: M/D até 2025 (formato de exportação US antigo), D/M a partir de 2026. */
function parseDate(s, line) {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  let y = Number(m[3]);
  if (y === 202) {
    y = 2024;
    flag(line, `ano "202" corrigido para 2024 em "${s}"`);
  }
  if (y === 2035) {
    y = 2025;
    flag(line, `ano 2035 corrigido para 2025 em "${s}"`);
  }
  if (y < 100) y += 2000;
  let day, month;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else if (y >= 2026) {
    day = a;
    month = b;
  } else {
    month = a;
    day = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { iso: `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, ambiguous: a <= 12 && b <= 12 };
}

/** troca dia/mês de uma data ISO (só se ambas as partes ≤ 12) */
function flipDate(iso) {
  const [y, mo, d] = iso.split("-").map(Number);
  if (d > 12 || mo > 12) return null;
  return `${y}-${String(d).padStart(2, "0")}-${String(mo).padStart(2, "0")}`;
}

const RETURN_WORDS = /cancelad|devolvid|reembols/i;
const EXPENSE_WORDS = /bot|destaque|sacos|renova/i;

// ---------- ler e classificar ----------
const raw = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(raw);

const items = [];
const expenses = [];
const skipped = [];

rows.forEach((cols, idx) => {
  const line = idx + 1;
  const [c0, buyRaw, sellRaw, brand, type, model, color, size, buyPriceRaw, sellPriceRaw, , , note12] = cols.map((c) => (c ?? "").trim());
  const costCents = parseMoneyCents(buyPriceRaw);
  const soldCents = parseMoneyCents(sellPriceRaw);

  const hasBrand = brand && !/^bot$/i.test(brand);
  const isHeaderish = /marca|capital/i.test(brand + type) || line < 10;
  if (isHeaderish) return;

  // despesas disfarçadas de linhas (BOT, destaques, sacos…)
  if (!hasBrand && costCents !== null && !isHeaderish) {
    const desc = [type, sellRaw, size, c0].find((v) => v && EXPENSE_WORDS.test(v)) ??
      [type, sellRaw, size].find(Boolean) ?? "Despesa importada";
    const date =
      parseDate(buyRaw, line)?.iso ?? parseMonthMarker(buyRaw) ?? parseMonthMarker(sellRaw) ?? null;
    if (!date) flag(line, `despesa "${desc}" sem data válida — usada 2024-01-01`);
    expenses.push({
      date: date ?? "2024-01-01",
      description: desc,
      category: /destaque/i.test(desc) ? "destaque" : /bot/i.test(desc) ? "bot" : "outro",
      amount_cents: costCents,
      line,
    });
    return;
  }

  if (!hasBrand) {
    const content = cols.filter(Boolean).join(" | ");
    const noise = content.replace(/[#DIV/0!,.\s|-]/g, "");
    if (content && noise.length > 0)
      skipped.push(`linha ${line}: ${content.slice(0, 100)}`);
    return;
  }
  if (/inje/i.test(type)) {
    skipped.push(`linha ${line}: INJEÇÃO de capital (não é artigo nem despesa)`);
    return;
  }

  const buy = parseDate(buyRaw, line);
  const sell = parseDate(sellRaw, line);
  let soldAt = sell?.iso ?? null;
  let purchaseDate = buy?.iso ?? null;

  // se a venda ficou antes da compra, tenta trocar dia/mês na interpretação ambígua
  if (purchaseDate && soldAt && soldAt < purchaseDate) {
    const fixSell = sell?.ambiguous ? flipDate(soldAt) : null;
    const fixBuy = buy?.ambiguous ? flipDate(purchaseDate) : null;
    if (fixSell && fixSell >= purchaseDate) {
      flag(line, `data de venda ${soldAt} < compra ${purchaseDate}; interpretada como ${fixSell}`);
      soldAt = fixSell;
    } else if (fixBuy && soldAt >= fixBuy) {
      flag(line, `data de compra ${purchaseDate} > venda ${soldAt}; interpretada como ${fixBuy}`);
      purchaseDate = fixBuy;
    } else {
      flag(line, `datas incoerentes (compra ${purchaseDate}, venda ${soldAt}) — mantidas`);
    }
  }

  const returned = RETURN_WORDS.test(sellRaw);
  const notes = [c0, note12, returned || (!sell && sellRaw) ? `Folha: "${sellRaw}"` : null]
    .filter(Boolean)
    .join(" · ") || null;

  let status;
  if (soldCents !== null) {
    status = "sold";
    if (!soldAt) {
      soldAt = purchaseDate ?? "2024-01-01";
      flag(line, `vendido sem data de venda — usada ${soldAt}`);
    }
  } else if (returned) status = "returned";
  else status = "in_stock";

  if (status === "in_stock" && costCents === null)
    flag(line, `artigo "${type}" sem preço de compra — importado com custo 0`);

  const name = [type, model, color].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || "Artigo";

  items.push({
    name,
    brand: brand || null,
    category: type || null,
    size: size || null,
    cost_cents: costCents ?? 0,
    status,
    sold_price_cents: status === "sold" ? soldCents : null,
    sold_at: status === "sold" ? soldAt : null,
    platform: status === "sold" ? "vinted" : null,
    notes,
    created_at: (purchaseDate ?? soldAt ?? "2024-01-01") + " 12:00:00",
    line,
  });
});

// ---------- gravar ----------
const db = new Database(path.join(process.cwd(), "data", "vinted.db"));
db.pragma("journal_mode = WAL");

if (wipe) {
  db.exec("DELETE FROM items; DELETE FROM purchases; DELETE FROM expenses;");
  console.log("Base de dados limpa antes da importação.");
}

const insItem = db.prepare(
  `INSERT INTO items (name, brand, category, size, cost_cents, status, sold_price_cents, sold_at, platform, notes, created_at)
   VALUES (@name, @brand, @category, @size, @cost_cents, @status, @sold_price_cents, @sold_at, @platform, @notes, @created_at)`,
);
const insExp = db.prepare(
  `INSERT INTO expenses (date, description, category, amount_cents)
   VALUES (@date, @description, @category, @amount_cents)`,
);

db.transaction(() => {
  for (const i of items) insItem.run(i);
  for (const e of expenses) insExp.run(e);
})();

// ---------- resumo ----------
const byStatus = items.reduce((m, i) => ((m[i.status] = (m[i.status] ?? 0) + 1), m), {});
const profit = items
  .filter((i) => i.status === "sold")
  .reduce((a, i) => a + i.sold_price_cents - i.cost_cents, 0);
const expTotal = expenses.reduce((a, e) => a + e.amount_cents, 0);

console.log(`\nImportados ${items.length} artigos:`, byStatus);
console.log(`Importadas ${expenses.length} despesas (${(expTotal / 100).toFixed(2)} €)`);
console.log(`Lucro bruto das vendas importadas: ${(profit / 100).toFixed(2)} €`);
console.log(`Lucro líquido (menos despesas): ${((profit - expTotal) / 100).toFixed(2)} €`);

if (skipped.length) {
  console.log(`\nLinhas ignoradas (${skipped.length}):`);
  for (const s of skipped) console.log("  " + s);
}
if (flags.length) {
  console.log(`\nAvisos (${flags.length}):`);
  for (const f of flags) console.log("  " + f);
}
