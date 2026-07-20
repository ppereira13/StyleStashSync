"use client";

import { useState } from "react";
import { exportSheets, exportSite } from "@/app/export-actions";

export function ExportButtons() {
  const [busy, setBusy] = useState<"sheets" | "site" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function run(kind: "sheets" | "site") {
    setBusy(kind);
    setMessage(null);
    const result = kind === "sheets" ? await exportSheets() : await exportSite();
    setError(!result.ok);
    setMessage(result.message);
    setBusy(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href="/api/export/csv"
        className="rounded-md border border-edge bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
      >
        Exportar CSV
      </a>
      <button
        type="button"
        onClick={() => run("sheets")}
        disabled={busy !== null}
        className="rounded-md border border-edge bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink disabled:opacity-50"
      >
        {busy === "sheets" ? "A exportar…" : "Exportar para Google Sheets"}
      </button>
      <button
        type="button"
        onClick={() => run("site")}
        disabled={busy !== null}
        className="rounded-md border border-edge bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink disabled:opacity-50"
      >
        {busy === "site" ? "A atualizar…" : "Atualizar site da loja"}
      </button>
      {message ? (
        <span className={`text-xs ${error ? "text-bad" : "text-good"}`}>{message}</span>
      ) : null}
    </div>
  );
}
