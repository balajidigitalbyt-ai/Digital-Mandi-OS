import { hashPassword, json, setSessionCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "Database unavailable." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const shopName = String(body.shopName || "").trim();
  const ownerName = String(body.ownerName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  if (shopName.length < 2 || shopName.length > 100 || ownerName.length < 2 || ownerName.length > 80) {
    return json({ ok: false, error: "दुकान और मालिक का नाम सही भरें।" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return json({ ok: false, error: "सही ईमेल पता भरें।" }, 400);
  }
  if (password.length < 12 || password.length > 128) {
    return json({ ok: false, error: "पासवर्ड कम से कम 12 अक्षरों का रखें।" }, 400);
  }
  if (phone && !/^[+0-9 ()-]{8,20}$/.test(phone)) return json({ ok: false, error: "फोन नंबर सही भरें।" }, 400);

  const shopId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    const statements = [
      env.DB.prepare(
        "INSERT INTO shops (id, name, owner_name, phone) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM shops) AND NOT EXISTS (SELECT 1 FROM users)"
      ).bind(shopId, shopName, ownerName, phone || null),
      env.DB.prepare(
        "INSERT INTO users (id, shop_id, name, email, password_hash, role, active) SELECT ?, ?, ?, ?, ?, 'owner', 1 WHERE EXISTS (SELECT 1 FROM shops WHERE id = ?) AND NOT EXISTS (SELECT 1 FROM users)"
      ).bind(userId, shopId, ownerName, email, passwordHash, shopId),
      ...["धान", "गेहूँ", "चना"].map((name, index) =>
        env.DB.prepare("INSERT INTO crops (id, shop_id, name, active) SELECT ?, ?, ?, 1 WHERE EXISTS (SELECT 1 FROM shops WHERE id = ?) AND EXISTS (SELECT 1 FROM users WHERE id = ?)")
          .bind(crypto.randomUUID(), shopId, name, shopId, userId)
      )
    ];
    await env.DB.batch(statements);
    const user = await env.DB.prepare("SELECT id, shop_id, name, email, role, active, password_hash FROM users WHERE id = ?").bind(userId).first();
    if (!user) return json({ ok: false, error: "Owner setup पहले ही पूरा हो चुका है। Login करें।" }, 409);
    return json({ ok: true, user: { id: user.id, shopId: user.shop_id, name: user.name, email: user.email, role: user.role } }, 201, {
      "Set-Cookie": await setSessionCookie(user, passwordHash)
    });
  } catch {
    return json({ ok: false, error: "Setup सेव नहीं हुआ। ईमेल जाँचें या सहायता लें।" }, 409);
  }
}
