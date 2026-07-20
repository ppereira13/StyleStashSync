"use client";

import { useState } from "react";
import type { MonthPoint } from "@/lib/stats";
import { money } from "@/lib/format";

const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

const MONTH_NAMES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function monthLabel(m: string): string {
  const [, mm] = m.split("-");
  return MONTH_NAMES[Number(mm) - 1] ?? m;
}

/** Arredonda o máximo do eixo para um número "limpo". */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * pow) return m * pow;
  }
  return 10 * pow;
}

export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d.profitCents / 100);
  const maxV = niceCeil(Math.max(0, ...values));
  const negMax = Math.max(0, ...values.map((v) => -v));
  const minV = negMax > 0 ? -niceCeil(negMax) : 0;
  const span = maxV - minV || 1;

  const y = (v: number) => PAD.top + ((maxV - v) / span) * plotH;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.55);

  // ticks: min, 0, max (e metades se houver espaço)
  const ticks = Array.from(
    new Set([minV, minV / 2, 0, maxV / 2, maxV].filter((t) => t >= minV && t <= maxV)),
  ).sort((a, b) => a - b);

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label="Lucro mensal dos últimos 12 meses"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--baseline)" : "var(--gridline)"}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="var(--text-muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.toLocaleString("pt-PT")}&nbsp;€
            </text>
          </g>
        ))}

        {data.map((d, idx) => {
          const v = d.profitCents / 100;
          const cx = PAD.left + band * idx + band / 2;
          const barH = Math.abs(y(v) - y(0));
          const top = v >= 0 ? y(v) : y(0);
          const r = Math.min(4, barH);
          // extremidade arredondada no lado dos dados, reta na linha de base
          const path =
            v >= 0
              ? `M ${cx - barW / 2} ${top + barH} V ${top + r} Q ${cx - barW / 2} ${top} ${cx - barW / 2 + r} ${top} H ${cx + barW / 2 - r} Q ${cx + barW / 2} ${top} ${cx + barW / 2} ${top + r} V ${top + barH} Z`
              : `M ${cx - barW / 2} ${top} V ${top + barH - r} Q ${cx - barW / 2} ${top + barH} ${cx - barW / 2 + r} ${top + barH} H ${cx + barW / 2 - r} Q ${cx + barW / 2} ${top + barH} ${cx + barW / 2} ${top + barH - r} V ${top} Z`;
          return (
            <g key={d.month}>
              {barH > 0 ? (
                <path
                  d={path}
                  fill={v >= 0 ? "var(--series-1)" : "var(--series-neg)"}
                  opacity={hover === null || hover === idx ? 1 : 0.45}
                />
              ) : null}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {monthLabel(d.month)}
              </text>
              {/* alvo de hover: a coluna inteira, não só a barra */}
              <rect
                x={PAD.left + band * idx}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(idx)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-edge bg-surface px-3 py-2 text-xs shadow-sm"
          style={{
            left: `${((PAD.left + band * hover! + band / 2) / W) * 100}%`,
            top: 0,
            transform: `translateX(${hover! > data.length / 2 ? "-110%" : "10%"})`,
          }}
        >
          <div className="font-medium text-ink">
            {monthLabel(hovered.month)} {hovered.month.slice(0, 4)}
          </div>
          <div className="mt-0.5 text-ink-2">
            Lucro: <span className="font-medium text-ink">{money(hovered.profitCents)}</span>
          </div>
          <div className="text-ink-2">Vendas: {hovered.salesCount}</div>
        </div>
      ) : null}
    </div>
  );
}
