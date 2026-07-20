import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { getDb, Item, Expense, itemProfitCents } from "./db";
import { STATUS_LABELS } from "./format";

// ID da folha do Pedro (pode ser substituído via variável de ambiente GOOGLE_SHEET_ID)
const DEFAULT_SHEET_ID = "118Px5U-V7eSUMMsya5Y7TaNI2tyRC2_JCxYSdXs9CtU";
const CREDENTIALS_PATH = path.join(process.cwd(), "data", "google-credentials.json");

function fmtPt(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function euros(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function buildItemRows(): string[][] {
  const db = getDb();
  const items = db.prepare("SELECT * FROM items ORDER BY created_at, id").all() as Item[];
  const header = [
    "Data de compra", "Data de venda", "Estado", "Marca", "Artigo", "Categoria",
    "Tamanho", "Condição", "Custo €", "Custos extra €", "Preço anunciado €",
    "Preço de venda €", "Taxas €", "Portes €", "Lucro €", "Link", "Notas",
  ];
  const rows = items.map((i) => [
    fmtPt(i.created_at),
    fmtPt(i.sold_at),
    STATUS_LABELS[i.status] ?? i.status,
    i.brand ?? "",
    i.name,
    i.category ?? "",
    i.size ?? "",
    i.condition ?? "",
    euros(i.cost_cents),
    euros(i.extra_cents),
    euros(i.listed_price_cents),
    euros(i.sold_price_cents),
    euros(i.sold_fees_cents),
    euros(i.sold_shipping_cents),
    i.status === "sold" ? euros(itemProfitCents(i)) : "",
    i.vinted_url ?? "",
    i.notes ?? "",
  ]);
  return [header, ...rows];
}

export function buildExpenseRows(): string[][] {
  const db = getDb();
  const expenses = db.prepare("SELECT * FROM expenses ORDER BY date, id").all() as Expense[];
  const header = ["Data", "Descrição", "Categoria", "Valor €"];
  const rows = expenses.map((e) => [
    fmtPt(e.date),
    e.description,
    e.category ?? "",
    euros(e.amount_cents),
  ]);
  return [header, ...rows];
}

export function credentialsAvailable(): boolean {
  return fs.existsSync(CREDENTIALS_PATH);
}

/** Escreve os dados da app em duas abas ("App Artigos" / "App Despesas") da folha. */
export async function exportToGoogleSheets(): Promise<{ items: number; expenses: number }> {
  if (!credentialsAvailable()) {
    throw new Error(
      "Faltam as credenciais: guarda o ficheiro JSON da service account em app/data/google-credentials.json e partilha a folha com o email dessa conta.",
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? DEFAULT_SHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(meta.data.sheets?.map((s) => s.properties?.title) ?? []);

  const wanted = ["App Artigos", "App Despesas"];
  const toCreate = wanted.filter((t) => !existing.has(t));
  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  const itemRows = buildItemRows();
  const expenseRows = buildExpenseRows();

  for (const [title, rows] of [
    ["App Artigos", itemRows],
    ["App Despesas", expenseRows],
  ] as const) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${title}'`,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }

  return { items: itemRows.length - 1, expenses: expenseRows.length - 1 };
}
