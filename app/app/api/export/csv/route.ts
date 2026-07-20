import { buildItemRows } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function toCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
        .join(";"),
    )
    .join("\r\n");
}

export async function GET() {
  // separador ";" e BOM para abrir bem no Excel/Sheets em locale PT
  const csv = "﻿" + toCsv(buildItemRows());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vinted-artigos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
