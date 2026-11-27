import { onRequestPost as loginUser } from "./auth/login.js";
import { json } from "../_lib/auth.js";
export async function onRequest(context) {
  if (context.request.method === "GET") return json({ ok: true, route: "login" });
  if (context.request.method === "POST") return loginUser(context);
  return json({ ok: false, error: "Method not allowed." }, 405);
}
