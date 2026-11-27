import { json } from "../_lib/auth.js";
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: false }, 503);
  try {
    const names = ["shops","users","crops"];
    const output = {};
    for (const name of names) {
      const info = await env.DB.prepare("PRAGMA table_info(" + name + ")").all();
      const ddl = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
      output[name] = { columns: (info.results || []).map(x => ({ name:x.name, notnull:x.notnull, dflt_value:x.dflt_value, pk:x.pk })), ddl: ddl?.sql || null };
    }
    return json({ ok:true, schema:output });
  } catch {
    return json({ ok:false }, 503);
  }
}