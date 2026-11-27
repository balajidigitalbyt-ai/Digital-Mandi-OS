// Read-only schema inspection. Fixed allowlist only; no writes or migrations.
const TABLES = [
  "shops", "users", "parties", "crops", "deals",
  "weighments", "purchases", "sales", "commission_rules",
  "commission_calculations", "stock_lots", "dispatches",
  "receipts", "slips", "payments", "ledger_accounts",
  "journal_entries", "journal_lines", "expenses", "audit_logs"
];

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json(
      { ok: false, error: "D1 binding DB is not available." },
      { status: 503 }
    );
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    const existingNames = new Set((existing.results || []).map(row => row.name));
    const tables = [];

    for (const name of TABLES) {
      if (!existingNames.has(name)) {
        tables.push({ name, exists: false, columns: [] });
        continue;
      }
      const info = await env.DB.prepare(`PRAGMA table_info("${name}")`).all();
      tables.push({
        name,
        exists: true,
        columns: (info.results || []).map(column => ({
          name: column.name,
          type: column.type,
          notnull: Boolean(column.notnull),
          primaryKey: Boolean(column.pk)
        }))
      });
    }

    return Response.json({
      ok: true,
      database: "connected",
      expectedTableCount: TABLES.length,
      existingTableCount: TABLES.filter(name => existingNames.has(name)).length,
      tables
    });
  } catch {
    return Response.json(
      { ok: false, error: "Read-only schema inspection failed." },
      { status: 503 }
    );
  }
}
