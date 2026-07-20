import Link from "next/link";
import {
  getDashboardStats,
  getMonthlyProfit,
  getRecentSales,
  getBrandStats,
  getCategoryStats,
  getStaleStock,
  GroupStats,
} from "@/lib/stats";
import { itemProfitCents } from "@/lib/db";
import { money, fmtDate } from "@/lib/format";
import { StatTile } from "@/components/StatTile";
import { MonthlyChart } from "@/components/MonthlyChart";
import { ExportButtons } from "@/components/ExportButtons";

export const dynamic = "force-dynamic";

function GroupTable({ title, rows }: { title: string; rows: GroupStats[] }) {
  return (
    <section className="rounded-lg border border-edge bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ink-2">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-3">
              <th className="py-1.5 pr-3 font-medium"></th>
              <th className="py-1.5 pr-3 text-right font-medium">Vendas</th>
              <th className="py-1.5 pr-3 text-right font-medium">Lucro</th>
              <th className="py-1.5 pr-3 text-right font-medium">Margem</th>
              <th className="py-1.5 text-right font-medium">Dias p/ vender</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-edge last:border-0">
                <td className="py-1.5 pr-3">{r.label}</td>
                <td className="py-1.5 pr-3 text-right text-ink-2">{r.soldCount}</td>
                <td
                  className={`py-1.5 pr-3 text-right font-medium ${
                    r.profitCents >= 0 ? "text-good" : "text-bad"
                  }`}
                >
                  {money(r.profitCents)}
                </td>
                <td className="py-1.5 pr-3 text-right text-ink-2">
                  {r.marginPct !== null ? `${r.marginPct.toFixed(0)}%` : "—"}
                </td>
                <td className="py-1.5 text-right text-ink-2">
                  {r.avgDays !== null ? Math.round(r.avgDays) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function Dashboard() {
  const stats = getDashboardStats();
  const monthly = getMonthlyProfit();
  const recent = getRecentSales();
  const brands = getBrandStats();
  const categories = getCategoryStats();
  const stale = getStaleStock();

  const empty = stats.stockCount === 0 && stats.soldCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <ExportButtons />
      </div>

      {empty ? (
        <div className="rounded-lg border border-edge bg-surface p-6 text-sm text-ink-2">
          Ainda não há dados. Começa por registar uma compra em{" "}
          <Link href="/compras" className="text-accent underline">
            Compras
          </Link>
          .
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Lucro líquido"
          value={money(stats.netProfitCents)}
          detail="vendas − custos − despesas"
          tone={stats.netProfitCents >= 0 ? "good" : "bad"}
        />
        <StatTile
          label="Receita"
          value={money(stats.revenueCents)}
          detail={`${stats.soldCount} vendas`}
        />
        <StatTile
          label="Investido"
          value={money(stats.investedCents)}
          detail="custo de todos os artigos"
        />
        <StatTile
          label="Em stock"
          value={String(stats.stockCount)}
          detail={`${money(stats.stockValueCents)} em custo`}
        />
        <StatTile
          label="ROI"
          value={stats.roiPct !== null ? `${stats.roiPct.toFixed(0)}%` : "—"}
          detail="sobre artigos vendidos"
        />
        <StatTile
          label="Tempo até venda"
          value={
            stats.avgDaysToSell !== null
              ? `${Math.round(stats.avgDaysToSell)} dias`
              : "—"
          }
          detail="média"
        />
      </section>

      <section className="rounded-lg border border-edge bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-2">
          Lucro por mês (últimos 12 meses)
        </h2>
        <MonthlyChart data={monthly} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <GroupTable title="Lucro por marca" rows={brands} />
        <GroupTable title="Lucro por categoria" rows={categories} />
      </div>

      {stale.length > 0 ? (
        <section className="rounded-lg border border-edge bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-2">
            Stock parado há mais tempo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs text-ink-3">
                  <th className="py-1.5 pr-3 font-medium">Artigo</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Custo</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Em stock há</th>
                  <th className="py-1.5 font-medium">Sugestão</th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {stale.map((i) => (
                  <tr key={i.id} className="border-b border-edge last:border-0">
                    <td className="py-1.5 pr-3">
                      {i.name}
                      {i.brand ? <span className="text-ink-3"> · {i.brand}</span> : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-ink-2">
                      {money(i.cost_cents + i.extra_cents)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 text-right font-medium ${
                        i.days > 180 ? "text-bad" : i.days > 90 ? "text-ink" : "text-ink-2"
                      }`}
                    >
                      {i.days} dias
                    </td>
                    <td className="py-1.5 text-xs text-ink-3">
                      {i.days > 180
                        ? "baixar preço ou considerar lote"
                        : i.days > 90
                          ? "rever preço / destacar"
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-right">
            <Link href="/artigos?status=in_stock" className="text-xs text-accent underline">
              ver todo o stock →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-edge bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-2">Últimas vendas</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-3">Sem vendas registadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs text-ink-3">
                  <th className="py-2 pr-4 font-medium">Artigo</th>
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 text-right font-medium">Venda</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo</th>
                  <th className="py-2 text-right font-medium">Lucro</th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {recent.map((i) => {
                  const profit = itemProfitCents(i);
                  return (
                    <tr key={i.id} className="border-b border-edge last:border-0">
                      <td className="py-2 pr-4">
                        {i.name}
                        {i.brand ? (
                          <span className="text-ink-3"> · {i.brand}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-ink-2">{fmtDate(i.sold_at)}</td>
                      <td className="py-2 pr-4 text-right">
                        {money(i.sold_price_cents ?? 0)}
                      </td>
                      <td className="py-2 pr-4 text-right text-ink-2">
                        {money(i.cost_cents + i.extra_cents)}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${
                          profit >= 0 ? "text-good" : "text-bad"
                        }`}
                      >
                        {money(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
