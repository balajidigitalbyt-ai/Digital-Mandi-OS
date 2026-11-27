import { getSession, json } from "../_lib/auth.js";

function clean(value, max) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}
export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "miller" ? "miller" : "farmer";
  try {
    const rows = await env.DB.prepare(
      "SELECT id, party_type, name, village, mobile, address, opening_balance, balance_side, notes, created_at FROM parties WHERE shop_id = ? AND active = 1 AND party_type IN (?, 'both') ORDER BY name LIMIT 500"
    ).bind(user.shopId, type).all();
    return json({ ok: true, parties: rows.results ?? [] });
  } catch {
    return json({ ok: false, error: "पार्टी सूची लोड नहीं हुई।" }, 503);
  }
}
export async function onRequestPost({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const type = body.type === "miller" ? "miller" : "farmer";
  const name = clean(body.name, 100);
  const village = clean(body.village, 100);
  const mobile = clean(body.mobile, 20);
  const address = clean(body.address, 250);
  const notes = clean(body.notes, 500);
  if (!name || name.length < 2) return json({ ok: false, error: "पार्टी का नाम जरूरी है।" }, 400);
  if (mobile && !/^[+0-9 ()-]{8,20}$/.test(mobile)) return json({ ok: false, error: "मोबाइल नंबर सही भरें।" }, 400);

  const id = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO parties (id, shop_id, party_type, name, village, mobile, address, opening_balance, active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)"
      ).bind(id, user.shopId, type, name, village, mobile, address, notes),
      env.DB.prepare(
        "INSERT INTO audit_logs (id, shop_id, user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, 'create', 'party', ?, NULL, ?)"
      ).bind(crypto.randomUUID(), user.shopId, user.id, id, JSON.stringify({ type, name, village, mobile, address }))
    ]);
    return json({ ok: true, party: { id, party_type: type, name, village, mobile, address, opening_balance: 0, balance_side: null, notes } }, 201);
  } catch {
    return json({ ok: false, error: "पार्टी सेव नहीं हुई। Database की जाँच जरूरी है।" }, 503);
  }
}
