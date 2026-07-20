import Link from "next/link";
import { getDb, Item, itemProfitCents } from "@/lib/db";
import { money, fmtDate, todayISO, STATUS_LABELS } from "@/lib/format";
import { markListed, markSold, undoSale, deleteItem, updateItem } from "@/app/actions";
import { ListingGenerator } from "@/components/ListingGenerator";
import { AttachListing } from "@/components/AttachListing";

export const dynamic = "force-dynamic";

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "in_stock", label: "Em stock" },
  { key: "listed", label: "À venda" },
  { key: "sold", label: "Vendidos" },
];

function getItems(status: string, q: string): Item[] {
  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(name LIKE ? OR brand LIKE ? OR category LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const sql = `SELECT * FROM items ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY id DESC`;
  return db.prepare(sql).all(...params) as Item[];
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "", q = "" } = await searchParams;
  const items = getItems(status, q);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Artigos</h1>
        <form className="flex items-center gap-2" action="/artigos" method="get">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Pesquisar nome, marca…"
            className="w-56"
          />
        </form>
      </div>

      <div className="flex gap-2 text-sm">
        {FILTERS.map((f) => {
          const href =
            "/artigos" +
            (f.key || q
              ? "?" +
                new URLSearchParams({
                  ...(f.key ? { status: f.key } : {}),
                  ...(q ? { q } : {}),
                }).toString()
              : "");
          const active = status === f.key;
          return (
            <Link
              key={f.key}
              href={href}
              className={`rounded-full border px-3 py-1 ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-edge bg-surface text-ink-2 hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Artigo</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 text-right font-medium">Custo</th>
              <th className="px-4 py-2 text-right font-medium">Preço</th>
              <th className="px-4 py-2 text-right font-medium">Lucro</th>
              <th className="px-4 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-3">
                  Sem artigos.{" "}
                  <Link href="/compras" className="text-accent underline">
                    Regista uma compra
                  </Link>{" "}
                  para começar.
                </td>
              </tr>
            ) : null}
            {items.map((i) => (
              <tr key={i.id} className="border-b border-edge align-top last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-start gap-3">
                    {i.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={i.photo}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-md border border-edge object-cover"
                      />
                    ) : null}
                    <div>
                      <div>{i.name}</div>
                      <div className="text-xs text-ink-3">
                        {[i.brand, i.size, i.condition].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {i.notes ? (
                        <div className="max-w-72 text-xs italic text-ink-3">{i.notes}</div>
                      ) : null}
                      {i.vinted_url ? (
                        <a
                          href={i.vinted_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent underline"
                        >
                          anúncio
                        </a>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className="text-ink-2">{STATUS_LABELS[i.status] ?? i.status}</span>
                  {i.status === "sold" ? (
                    <div className="text-xs text-ink-3">{fmtDate(i.sold_at)}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right">
                  {money(i.cost_cents + i.extra_cents)}
                </td>
                <td className="px-4 py-2 text-right">
                  {i.status === "sold"
                    ? money(i.sold_price_cents ?? 0)
                    : i.listed_price_cents !== null
                      ? money(i.listed_price_cents)
                      : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {i.status === "sold" ? (
                    <span
                      className={
                        itemProfitCents(i) >= 0
                          ? "font-medium text-good"
                          : "font-medium text-bad"
                      }
                    >
                      {money(itemProfitCents(i))}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-1">
                    {i.status !== "sold" ? (
                      <>
                        <AttachListing itemId={i.id} />
                        <details>
                          <summary className="cursor-pointer text-xs text-accent">
                            Vender…
                          </summary>
                          <form
                            action={markSold}
                            className="mt-2 flex flex-col gap-2 rounded-md border border-edge p-2"
                          >
                            <input type="hidden" name="id" value={i.id} />
                            <input
                              name="sold_price"
                              placeholder="Preço de venda €"
                              required
                              className="w-40"
                            />
                            <input
                              name="sold_fees"
                              placeholder="Taxas € (opcional)"
                              className="w-40"
                            />
                            <input
                              name="sold_shipping"
                              placeholder="Portes pagos por ti €"
                              className="w-40"
                            />
                            <input
                              type="date"
                              name="sold_at"
                              defaultValue={todayISO()}
                              className="w-40"
                            />
                            <button
                              type="submit"
                              className="w-40 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white"
                            >
                              Registar venda
                            </button>
                          </form>
                        </details>
                        <details>
                          <summary className="cursor-pointer text-xs text-accent">
                            {i.status === "listed" ? "Atualizar anúncio…" : "Pôr à venda…"}
                          </summary>
                          <form
                            action={markListed}
                            className="mt-2 flex flex-col gap-2 rounded-md border border-edge p-2"
                          >
                            <input type="hidden" name="id" value={i.id} />
                            <input
                              name="listed_price"
                              placeholder="Preço anunciado €"
                              defaultValue={
                                i.listed_price_cents !== null
                                  ? (i.listed_price_cents / 100).toString().replace(".", ",")
                                  : ""
                              }
                              className="w-40"
                            />
                            <input
                              name="vinted_url"
                              placeholder="Link do anúncio (opcional)"
                              defaultValue={i.vinted_url ?? ""}
                              className="w-40"
                            />
                            <button
                              type="submit"
                              className="w-40 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white"
                            >
                              Guardar
                            </button>
                          </form>
                        </details>
                      </>
                    ) : (
                      <form action={undoSale}>
                        <input type="hidden" name="id" value={i.id} />
                        <button type="submit" className="text-xs text-ink-3 underline">
                          Anular venda
                        </button>
                      </form>
                    )}
                    {i.status !== "sold" ? <ListingGenerator itemId={i.id} /> : null}
                    <details>
                      <summary className="cursor-pointer text-xs text-ink-2">
                        Editar…
                      </summary>
                      <form
                        action={updateItem}
                        className="mt-2 grid w-72 grid-cols-2 gap-2 rounded-md border border-edge p-2 text-xs"
                      >
                        <input type="hidden" name="id" value={i.id} />
                        <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                          Nome
                          <input name="name" defaultValue={i.name} required />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Marca
                          <input name="brand" defaultValue={i.brand ?? ""} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Categoria
                          <input name="category" defaultValue={i.category ?? ""} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Tamanho
                          <input name="size" defaultValue={i.size ?? ""} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Estado da peça
                          <input name="condition" defaultValue={i.condition ?? ""} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Custo €
                          <input name="cost" defaultValue={centsToInput(i.cost_cents)} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Custos extra €
                          <input name="extra" defaultValue={centsToInput(i.extra_cents)} />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Data de compra
                          <input
                            type="date"
                            name="purchase_date"
                            defaultValue={i.created_at.slice(0, 10)}
                          />
                        </label>
                        <label className="flex flex-col gap-0.5 text-ink-3">
                          Preço anunciado €
                          <input
                            name="listed_price"
                            defaultValue={
                              i.listed_price_cents !== null
                                ? centsToInput(i.listed_price_cents)
                                : ""
                            }
                          />
                        </label>
                        {i.status === "sold" ? (
                          <>
                            <label className="flex flex-col gap-0.5 text-ink-3">
                              Preço de venda €
                              <input
                                name="sold_price"
                                defaultValue={centsToInput(i.sold_price_cents ?? 0)}
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-ink-3">
                              Data de venda
                              <input
                                type="date"
                                name="sold_at"
                                defaultValue={i.sold_at ?? ""}
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-ink-3">
                              Taxas €
                              <input
                                name="sold_fees"
                                defaultValue={centsToInput(i.sold_fees_cents)}
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-ink-3">
                              Portes €
                              <input
                                name="sold_shipping"
                                defaultValue={centsToInput(i.sold_shipping_cents)}
                              />
                            </label>
                          </>
                        ) : null}
                        <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                          Link do anúncio
                          <input name="vinted_url" defaultValue={i.vinted_url ?? ""} />
                        </label>
                        <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                          Foto (URL — apaga para remover)
                          <input name="photo" defaultValue={i.photo ?? ""} />
                        </label>
                        <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                          Substituir foto (ficheiro)
                          <input type="file" name="photo_file" accept="image/*" />
                        </label>
                        <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                          Notas
                          <input name="notes" defaultValue={i.notes ?? ""} />
                        </label>
                        <button
                          type="submit"
                          className="col-span-2 rounded-md bg-accent px-2 py-1 font-medium text-white"
                        >
                          Guardar alterações
                        </button>
                      </form>
                    </details>
                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <button type="submit" className="text-xs text-bad underline">
                        Apagar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
