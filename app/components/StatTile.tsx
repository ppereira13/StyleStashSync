export function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "bad";
}) {
  const valueColor =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink";
  return (
    <div className="rounded-lg border border-edge bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</div>
      {detail ? <div className="mt-0.5 text-xs text-ink-2">{detail}</div> : null}
    </div>
  );
}
