import { getDb, Purchase } from "@/lib/db";
import { money, fmtDate, todayISO } from "@/lib/format";
import { deletePurchase } from "@/app/actions";
import { PurchaseForm } from "@/components/PurchaseForm";

export const dynamic = "force-dynamic";

interface PurchaseRow extends Purchase {
  item_count: number;
}

export default async function PurchasesPage() {
  const db = getDb();
  const purchases = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM items i WHERE i.purchase_id = p.id) AS item_count
       FROM purchases p ORDER BY p.date DESC, p.id DESC`,
    )
    .all() as PurchaseRow[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Compras</h1>

      <PurchaseForm today={todayISO()} />

      <div className="overflow-x-auto rounded-lg border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Data</th>
              <th className="px-4 py-2 font-medium">Descrição</th>
              <th className="px-4 py-2 font-medium">Origem</th>
              <th className="px-4 py-2 text-right font-medium">Artigos</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Portes</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink-3">
                  Sem compras registadas.
                </td>
              </tr>
            ) : null}
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-edge last:border-0">
                <td className="px-4 py-2 text-ink-2">{fmtDate(p.date)}</td>
                <td className="px-4 py-2">
                  {p.description}
                  {p.notes ? (
                    <div className="text-xs text-ink-3">{p.notes}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-ink-2">{p.source}</td>
                <td className="px-4 py-2 text-right">{p.item_count}</td>
                <td className="px-4 py-2 text-right">{money(p.total_cents)}</td>
                <td className="px-4 py-2 text-right text-ink-2">
                  {money(p.shipping_cents)}
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={deletePurchase}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-xs text-bad underline">
                      Apagar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
