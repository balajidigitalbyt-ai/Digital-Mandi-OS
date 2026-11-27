// Temporary read-only review of live D1 table definitions. Remove after inspection.
export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare("SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY type, name").all();
    return Response.json(rows.results ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false }, { status: 503 }); }
}
