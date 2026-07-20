"use client";

import { useState } from "react";
import { generateListingAction } from "@/app/ai-actions";

export function ListingGenerator({ itemId }: { itemId: number }) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"title" | "description" | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const result = await generateListingAction(itemId);
    if (result.ok && result.listing) {
      setTitle(result.listing.title);
      setDescription(result.listing.description);
    } else {
      setError(result.message ?? "Erro ao gerar o anúncio.");
    }
    setBusy(false);
  }

  async function copy(kind: "title" | "description", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs text-accent">Anúncio IA…</summary>
      <div className="mt-2 flex w-72 flex-col gap-2 rounded-md border border-edge p-2 text-xs">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="self-start rounded-md bg-accent px-2 py-1 font-medium text-white disabled:opacity-50"
        >
          {busy ? "A gerar…" : title ? "Gerar de novo" : "Gerar título e descrição"}
        </button>
        {error ? <p className="text-bad">{error}</p> : null}
        {title !== null ? (
          <label className="flex flex-col gap-0.5 text-ink-3">
            Título
            <div className="flex gap-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => copy("title", title)}
                className="rounded-md border border-edge px-2 text-ink-2"
              >
                {copied === "title" ? "✓" : "Copiar"}
              </button>
            </div>
          </label>
        ) : null}
        {description !== null ? (
          <label className="flex flex-col gap-0.5 text-ink-3">
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
            />
            <button
              type="button"
              onClick={() => copy("description", description)}
              className="mt-1 self-start rounded-md border border-edge px-2 py-0.5 text-ink-2"
            >
              {copied === "description" ? "✓ Copiado" : "Copiar descrição"}
            </button>
          </label>
        ) : null}
      </div>
    </details>
  );
}
