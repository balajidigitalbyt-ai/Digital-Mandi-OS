import { onRequestPost as setupOwner } from "./auth/setup.js";
import { onRequestPost as loginUser } from "./auth/login.js";
import { json } from "../_lib/auth.js";
export async function onRequest(context) {
  if (context.request.method === "GET") return json({ ok: true, route: "owner-setup" });
  if (context.request.method === "POST") {
    let body;
    try { body = await context.request.clone().json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    return body.action === "login" ? loginUser(context) : setupOwner(context);
  }
  return json({ ok: false, error: "Method not allowed." }, 405);
}
