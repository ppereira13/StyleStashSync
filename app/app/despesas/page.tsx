import { getDb, Expense } from "@/lib/db";
import { money, fmtDate, todayISO } from "@/lib/format";
import { addExpense, deleteExpense } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const db = getDb();
  const expenses = db
    .prepare("SELECT * FROM expenses ORDER BY date DESC, id DESC")
    .all() as Expense[];
  const totalCents = expenses.reduce((a, e) => a + e.amount_cents, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Despesas</h1>

      <form
        action={addExpense}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-edge bg-surface p-4"
      >
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Data
          <input type="date" name="date" defaultValue={todayISO()} required />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-ink-3">
          Descrição
          <input name="description" placeholder="ex.: Envelopes de envio" required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Categoria
          <select name="category" defaultValue="material">
            <option value="material">Material de envio</option>
            <option value="limpeza">Limpeza / reparação</option>
            <option value="destaque">Destaques Vinted</option>
            <option value="transporte">Transporte</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Valor €
          <input name="amount" placeholder="0,00" required className="w-28" />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Adicionar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Data</th>
              <th className="px-4 py-2 font-medium">Descrição</th>
              <th className="px-4 py-2 font-medium">Categoria</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-3">
                  Sem despesas registadas.
                </td>
              </tr>
            ) : null}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-edge last:border-0">
                <td className="px-4 py-2 text-ink-2">{fmtDate(e.date)}</td>
                <td className="px-4 py-2">{e.description}</td>
                <td className="px-4 py-2 text-ink-2">{e.category ?? "—"}</td>
                <td className="px-4 py-2 text-right">{money(e.amount_cents)}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="text-xs text-bad underline">
                      Apagar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length > 0 ? (
          <div className="border-t border-edge px-4 py-2 text-right text-sm font-medium">
            Total: {money(totalCents)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
