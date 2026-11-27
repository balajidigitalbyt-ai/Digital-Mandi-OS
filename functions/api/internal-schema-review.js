// Temporary read-only inspection; remove after reviewing live constraints.
export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('shops','users') ORDER BY name"
    ).all();
    return Response.json(rows.results ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
