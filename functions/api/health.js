// Read-only connectivity check for the Pages Functions D1 binding.
export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json(
      { ok: false, database: "not_bound", message: "D1 binding DB is not available." },
      { status: 503 }
    );
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return Response.json({
      ok: true,
      database: "connected",
      service: "Digital Mandi OS API"
    });
  } catch {
    return Response.json(
      { ok: false, database: "query_failed", message: "D1 connectivity check failed." },
      { status: 503 }
    );
  }
}
