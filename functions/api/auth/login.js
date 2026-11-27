import { json, setSessionCookie, verifyPassword } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password || email.length > 160 || password.length > 128) {
    return json({ ok: false, error: "ईमेल या पासवर्ड सही नहीं है।" }, 401);
  }
  try {
    const user = await env.DB.prepare(
      "SELECT id, shop_id, name, email, role, active, password_hash FROM users WHERE email = ? LIMIT 1"
    ).bind(email).first();
    if (!user || Number(user.active) !== 1 || !(await verifyPassword(password, user.password_hash))) {
      return json({ ok: false, error: "ईमेल या पासवर्ड सही नहीं है।" }, 401);
    }
    return json({ ok: true, user: { id: user.id, shopId: user.shop_id, name: user.name, email: user.email, role: user.role } }, 200, {
      "Set-Cookie": await setSessionCookie(user, user.password_hash)
    });
  } catch {
    return json({ ok: false, error: "Login सेवा अभी उपलब्ध नहीं है।" }, 503);
  }
}
