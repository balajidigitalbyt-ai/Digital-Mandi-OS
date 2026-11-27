// Public, non-sensitive bootstrap status. Does not return names, emails, or balances.
export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json({ ok: false, database: "not_bound" }, { status: 503 });
  }

  try {
    const [shops, users] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM shops").first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM users").first()
    ]);
    const shopCount = Number(shops?.total ?? 0);
    const userCount = Number(users?.total ?? 0);

    return Response.json({
      ok: true,
      configured: shopCount > 0 && userCount > 0,
      needsOwnerSetup: shopCount === 0 && userCount === 0
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return Response.json({ ok: false, database: "query_failed" }, { status: 503 });
  }
}
