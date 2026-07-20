"use client";

import { useState } from "react";
import { attachListing } from "@/app/actions";

export function AttachListing({ itemId }: { itemId: number }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function run() {
    if (!url.trim()) return;
    setBusy(true);
    setMessage(null);
    const result = await attachListing(itemId, url.trim());
    setError(!result.ok);
    setMessage(result.message);
    if (result.ok) setUrl("");
    setBusy(false);
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs text-accent">
        Associar anúncio…
      </summary>
      <div className="mt-2 flex w-64 flex-col gap-2 rounded-md border border-edge p-2 text-xs">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder="https://www.vinted.pt/items/…"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !url.trim()}
          className="self-start rounded-md bg-accent px-2 py-1 font-medium text-white disabled:opacity-50"
        >
          {busy ? "A associar…" : "Associar"}
        </button>
        <p className="text-ink-3">
          Importa foto, preço, marca e tamanho do anúncio e marca o artigo como
          &quot;À venda&quot;.
        </p>
        {message ? (
          <p className={error ? "text-bad" : "text-good"}>{message}</p>
        ) : null}
      </div>
    </details>
  );
}
