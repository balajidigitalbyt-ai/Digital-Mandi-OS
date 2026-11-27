const ITERATIONS = 100000;
const COOKIE = "dmos_session";
const SESSION_SECONDS = 8 * 60 * 60;

function b64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function derive(password, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [scheme, rounds, salt, expected] = stored.split("$");
    if (scheme !== "pbkdf2-sha256") return false;
    const actual = await derive(password, unb64(salt), Number(rounds));
    return safeEqual(b64(actual), expected);
  } catch { return false; }
}
async function sign(payload, passwordHash) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(passwordHash), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}
function cookieValue(request) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === COOKIE) return value.join("=");
  }
  return "";
}
export async function setSessionCookie(user, passwordHash) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${user.id}.${expires}`;
  const token = `${b64(new TextEncoder().encode(payload))}.${await sign(payload, passwordHash)}`;
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}
export function clearSessionCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
export async function getSession(request, env) {
  try {
    const token = cookieValue(request);
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const payload = new TextDecoder().decode(unb64(encoded));
    const split = payload.lastIndexOf(".");
    const userId = payload.slice(0, split);
    const expires = Number(payload.slice(split + 1));
    if (!userId || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return null;
    const user = await env.DB.prepare(
      "SELECT id, shop_id, name, email, role, active, password_hash FROM users WHERE id = ? LIMIT 1"
    ).bind(userId).first();
    if (!user || Number(user.active) !== 1) return null;
    const expected = await sign(payload, user.password_hash);
    if (!safeEqual(signature, expected)) return null;
    return { id: user.id, shopId: user.shop_id, name: user.name, email: user.email, role: user.role };
  } catch { return null; }
}
export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
