"use client";

import { useRef, useState } from "react";
import { addPurchase } from "@/app/actions";

interface Row {
  key: number;
  name: string;
  brand: string;
  category: string;
  size: string;
  condition: string;
  cost: string;
  url: string;
  notes: string;
  photoUrl: string;
}

const emptyRow = (key: number): Row => ({
  key,
  name: "",
  brand: "",
  category: "",
  size: "",
  condition: "",
  cost: "",
  url: "",
  notes: "",
  photoUrl: "",
});

export function PurchaseForm({ today }: { today: string }) {
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const nextKey = useRef(1);

  function setRow(key: number, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function importFromLink() {
    if (!link.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/vinted?url=${encodeURIComponent(link.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao obter o anúncio.");

      const price = data.price !== null ? String(data.price).replace(".", ",") : "";
      const newRow: Row = {
        key: nextKey.current++,
        name: [data.title, data.color].filter(Boolean).join(" "),
        brand: data.brand ?? "",
        category: "",
        size: data.size ?? "",
        condition: data.condition ?? "",
        cost: price,
        url: data.url,
        notes: "",
        photoUrl: data.image ?? "",
      };
      setRows((r) => {
        const onlyEmpty = r.length === 1 && !r[0].name && !r[0].cost;
        return onlyEmpty ? [newRow] : [...r, newRow];
      });
      if (!description) setDescription(data.title);
      setTotal((t) => {
        const prev = Number((t || "0").replace(",", ".")) || 0;
        const sum = prev + (data.price ?? 0);
        return sum ? String(Math.round(sum * 100) / 100).replace(".", ",") : t;
      });
      setLink("");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro ao obter o anúncio.");
    } finally {
      setImporting(false);
    }
  }

  async function submit(formData: FormData) {
    await addPurchase(formData);
    setRows([emptyRow(nextKey.current++)]);
    setDescription("");
    setTotal("");
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-4 rounded-lg border border-edge bg-surface p-4"
    >
      <h2 className="text-sm font-medium text-ink-2">Nova compra</h2>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge p-2">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Cola o link do anúncio Vinted (https://www.vinted.pt/items/…)"
          className="min-w-64 flex-1"
        />
        <button
          type="button"
          onClick={importFromLink}
          disabled={importing || !link.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {importing ? "A importar…" : "Importar do link"}
        </button>
        {importError ? <span className="w-full text-xs text-bad">{importError}</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Data
          <input type="date" name="date" defaultValue={today} required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Origem
          <select name="source" defaultValue="vinted">
            <option value="vinted">Vinted</option>
            <option value="olx">OLX</option>
            <option value="feira">Feira / 2ª mão</option>
            <option value="loja">Loja / outlet</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-3 md:col-span-1">
          Descrição
          <input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ex.: Lote 5 camisolas"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Total pago €
          <input
            name="total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0,00"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Portes €
          <input name="shipping" placeholder="0,00" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-ink-3">
          Artigos desta compra{" "}
          <span className="font-normal">
            (custo individual opcional — sem ele, o total é dividido igualmente)
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-col gap-2 rounded-md border border-edge p-2"
          >
            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              <input
                name="item_name"
                value={row.name}
                onChange={(e) => setRow(row.key, { name: e.target.value })}
                placeholder="Nome do artigo *"
                className="col-span-2"
              />
              <input
                name="item_brand"
                value={row.brand}
                onChange={(e) => setRow(row.key, { brand: e.target.value })}
                placeholder="Marca"
              />
              <input
                name="item_category"
                value={row.category}
                onChange={(e) => setRow(row.key, { category: e.target.value })}
                placeholder="Categoria"
              />
              <input
                name="item_size"
                value={row.size}
                onChange={(e) => setRow(row.key, { size: e.target.value })}
                placeholder="Tamanho"
              />
              <input
                name="item_condition"
                value={row.condition}
                onChange={(e) => setRow(row.key, { condition: e.target.value })}
                placeholder="Estado"
              />
              <div className="flex items-center gap-2">
                <input
                  name="item_cost"
                  value={row.cost}
                  onChange={(e) => setRow(row.key, { cost: e.target.value })}
                  placeholder="Custo €"
                  className="w-full"
                />
                {rows.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Remover artigo"
                    onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                    className="text-bad"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {row.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.photoUrl}
                  alt=""
                  className="h-12 w-12 rounded-md border border-edge object-cover"
                />
              ) : null}
              <label className="flex items-center gap-2 text-xs text-ink-3">
                Foto
                <input type="file" name="item_photo" accept="image/*" className="text-xs" />
              </label>
              <input
                name="item_notes"
                value={row.notes}
                onChange={(e) => setRow(row.key, { notes: e.target.value })}
                placeholder="Comentários (defeitos, medidas, onde está guardado…)"
                className="min-w-52 flex-1"
              />
            </div>
            <input type="hidden" name="item_url" value={row.url} />
            <input type="hidden" name="item_photo_url" value={row.photoUrl} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((r) => [...r, emptyRow(nextKey.current++)])}
          className="self-start text-xs text-accent underline"
        >
          + adicionar artigo
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-ink-3">
        Notas
        <input name="notes" placeholder="opcional" />
      </label>

      <button
        type="submit"
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        Registar compra
      </button>
    </form>
  );
}
