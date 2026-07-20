// Correções pontuais de datas impossíveis vindas da folha (documentadas em notas).
import Database from "better-sqlite3";

const db = new Database("data/vinted.db");

const fixes = [
  {
    id: 335,
    set: { sold_at: "2025-11-15" },
    note: "Data de venda corrigida para 15/11/2025 (folha dizia 15/1/2025, anterior à compra)",
  },
  {
    id: 402,
    set: { sold_at: "2026-05-29", created_at: "2026-05-29 12:00:00" },
    note: "Datas corrigidas para 29/5/2026 (folha dizia 29/9/2026, data futura)",
  },
];

for (const f of fixes) {
  const cols = Object.keys(f.set)
    .map((k) => `${k} = @${k}`)
    .join(", ");
  db.prepare(
    `UPDATE items SET ${cols},
     notes = CASE WHEN notes IS NULL OR notes = '' THEN @note ELSE notes || ' · ' || @note END
     WHERE id = @id`,
  ).run({ ...f.set, note: f.note, id: f.id });
  console.log(`item ${f.id} atualizado`);
}
