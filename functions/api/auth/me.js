import { getSession, json } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  return user ? json({ ok: true, user }) : json({ ok: false }, 401);
}
