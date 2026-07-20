import Link from "next/link";
import { getDb, Item, itemProfitCents } from "@/lib/db";
import { money, fmtDate, todayISO, STATUS_LABELS } from "@/lib/format";
import { markListed, markSold, undoSale, deleteItem, updateItem } from "@/app/actions";
import { ListingGenerator } from "@/components/ListingGenerator";
import { AttachListing } from "@/components/AttachListing";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "in_stock", label: "Em stock" },
  { key: "listed", label: "À venda" },
  { key: "sold", label: "Vendidos" },
  { key: "returned", label: "Devolvidos" },
];

const PILL: Record<string, string> = {
  in_stock: "pill pill-stock",
  listed: "pill pill-listed",
  sold: "pill pill-sold",
  returned: "pill pill-returned",
};

function getItems(
  status: string,
  q: string,
  page: number,
): { items: Item[]; total: number } {
  const db = getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(name LIKE ? OR brand LIKE ? OR category LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM items ${whereSql}`).get(...params) as {
      n: number;
    }
  ).n;
  const items = db
    .prepare(`SELECT * FROM items ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as Item[];
  return { items, total };
}

function hrefFor(status: string, q: string, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return "/artigos" + (s ? `?${s}` : "");
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Miniatura com legenda: foto do registo ou do anúncio. */
function Thumb({
  src,
  label,
  href,
}: {
  src: string | null;
  label: string;
  href?: string | null;
}) {
  const img = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      loading="lazy"
      className="h-14 w-14 rounded-lg border border-edge object-cover shadow-sm transition-transform hover:scale-[1.6] hover:shadow-lg"
    />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-edge text-[10px] text-ink-3">
      —
    </span>
  );
  return (
    <span className="flex shrink-0 flex-col items-center gap-0.5">
      {src && href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
      <span className="text-[9px] uppercase tracking-wide text-ink-3">{label}</span>
    </span>
  );
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status = "", q = "", page: pageRaw = "1" } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const { items, total } = getItems(status, q, page);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const pager =
    total > PAGE_SIZE ? (
      <div className="flex items-center gap-3 text-xs text-ink-3">
        <span>
          {from}–{to} de {total}
        </span>
        {page > 1 ? (
          <Link
            href={hrefFor(status, q, page - 1)}
            className="rounded-md border border-edge bg-surface px-2.5 py-1 font-medium text-ink-2 hover:text-ink"
          >
            ‹ Anterior
          </Link>
        ) : null}
        {page < lastPage ? (
          <Link
            href={hrefFor(status, q, page + 1)}
            className="rounded-md border border-edge bg-surface px-2.5 py-1 font-medium text-ink-2 hover:text-ink"
          >
            Seguinte ›
          </Link>
        ) : null}
      </div>
    ) : (
      <span className="text-xs text-ink-3">{total} artigos</span>
    );

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          {FILTERS.map((f) => {
            const active = status === f.key;
            return (
              <Link
                key={f.key}
                href={hrefFor(f.key, q, 1)}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  active
                    ? "border-accent bg-accent font-medium text-white"
                    : "border-edge bg-surface text-ink-2 hover:text-ink"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        {pager}
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Artigo</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 text-right font-medium">Custo</th>
              <th className="px-4 py-2.5 text-right font-medium">Preço</th>
              <th className="px-4 py-2.5 text-right font-medium">Lucro</th>
              <th className="px-4 py-2.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="rows" style={{ fontVariantNumeric: "tabular-nums" }}>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                  Sem artigos.{" "}
                  <Link href="/compras" className="text-accent underline">
                    Regista uma compra
                  </Link>{" "}
                  para começar.
                </td>
              </tr>
            ) : null}
            {items.map((i) => {
              const profit = i.status === "sold" ? itemProfitCents(i) : null;
              const estProfit =
                i.status !== "sold" && i.listed_price_cents !== null
                  ? i.listed_price_cents - i.cost_cents - i.extra_cents
                  : null;
              return (
                <tr key={i.id} className="border-b border-edge align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Thumb src={i.photo} label="registo" href={i.photo} />
                      <Thumb
                        src={i.listing_photo}
                        label="anúncio"
                        href={i.vinted_url ?? i.listing_photo}
                      />
                      <div className="min-w-40">
                        <div className="font-medium leading-snug">{i.name}</div>
                        <div className="mt-0.5 text-xs text-ink-3">
                          {[i.brand, i.size, i.condition].filter(Boolean).join(" · ") ||
                            "—"}
                        </div>
                        {i.notes ? (
                          <div className="mt-0.5 max-w-72 text-xs italic text-ink-3">
                            {i.notes}
                          </div>
                        ) : null}
                        {i.vinted_url ? (
                          <a
                            href={i.vinted_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-block text-xs text-accent hover:underline"
                          >
                            ver anúncio ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={PILL[i.status] ?? "pill"}>
                      {STATUS_LABELS[i.status] ?? i.status}
                    </span>
                    <div className="mt-1 text-xs text-ink-3">
                      {i.status === "sold"
                        ? fmtDate(i.sold_at)
                        : i.status === "listed" && i.listed_at
                          ? `desde ${fmtDate(i.listed_at)}`
                          : `há ${daysSince(i.created_at)} dias`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {money(i.cost_cents + i.extra_cents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {i.status === "sold"
                      ? money(i.sold_price_cents ?? 0)
                      : i.listed_price_cents !== null
                        ? money(i.listed_price_cents)
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {profit !== null ? (
                      <span
                        className={
                          profit >= 0 ? "font-medium text-good" : "font-medium text-bad"
                        }
                      >
                        {money(profit)}
                      </span>
                    ) : estProfit !== null ? (
                      <span
                        className="text-ink-3"
                        title="Lucro estimado se vender ao preço anunciado"
                      >
                        ≈ {money(estProfit)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {i.status !== "sold" ? (
                        <>
                          <AttachListing itemId={i.id} />
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-accent">
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
                        </>
                      ) : (
                        <form action={undoSale}>
                          <input type="hidden" name="id" value={i.id} />
                          <button type="submit" className="text-xs text-ink-3 underline">
                            Anular venda
                          </button>
                        </form>
                      )}
                      <details>
                        <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink-2">
                          Mais ▾
                        </summary>
                        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-edge p-2">
                          {i.status !== "sold" ? (
                            <>
                              <details>
                                <summary className="cursor-pointer text-xs text-accent">
                                  {i.status === "listed"
                                    ? "Atualizar anúncio…"
                                    : "Pôr à venda…"}
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
                                        ? centsToInput(i.listed_price_cents)
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
                              <ListingGenerator itemId={i.id} />
                            </>
                          ) : null}
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
                                <input
                                  name="condition"
                                  defaultValue={i.condition ?? ""}
                                />
                              </label>
                              <label className="flex flex-col gap-0.5 text-ink-3">
                                Custo €
                                <input
                                  name="cost"
                                  defaultValue={centsToInput(i.cost_cents)}
                                />
                              </label>
                              <label className="flex flex-col gap-0.5 text-ink-3">
                                Custos extra €
                                <input
                                  name="extra"
                                  defaultValue={centsToInput(i.extra_cents)}
                                />
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
                                      defaultValue={centsToInput(
                                        i.sold_price_cents ?? 0,
                                      )}
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
                                      defaultValue={centsToInput(
                                        i.sold_shipping_cents,
                                      )}
                                    />
                                  </label>
                                </>
                              ) : null}
                              <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                                Link do anúncio
                                <input
                                  name="vinted_url"
                                  defaultValue={i.vinted_url ?? ""}
                                />
                              </label>
                              <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                                Foto do registo (URL — apaga para remover)
                                <input name="photo" defaultValue={i.photo ?? ""} />
                              </label>
                              <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                                Foto do anúncio (URL)
                                <input
                                  name="listing_photo"
                                  defaultValue={i.listing_photo ?? ""}
                                />
                              </label>
                              <label className="col-span-2 flex flex-col gap-0.5 text-ink-3">
                                Substituir foto do registo (ficheiro)
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
                            <button
                              type="submit"
                              className="text-xs text-bad underline"
                            >
                              Apagar
                            </button>
                          </form>
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <div className="flex justify-end">{pager}</div>
      ) : null}
    </div>
  );
}
