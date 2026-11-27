import { onRequestPost as setupOwner } from "./auth/setup.js";
import { json } from "../_lib/auth.js";
export async function onRequest(context) {
  if (context.request.method === "GET") return json({ ok: true, route: "owner-setup" });
  if (context.request.method === "POST") return setupOwner(context);
  return json({ ok: false, error: "Method not allowed." }, 405);
}
