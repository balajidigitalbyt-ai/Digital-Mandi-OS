import { getSession, json } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);

  try {
    const result = await env.DB.prepare(`
      SELECT
        sl.id,
        sl.deal_id,
        d.deal_no,
        sl.crop_id,
        c.name AS crop_name,
        sl.owner_type,
        sl.owner_party_id,
        COALESCE(p.name, '') AS owner_name,
        sl.quantity_kg,
        sl.available_kg,
        sl.location,
        sl.status,
        sl.created_at
      FROM stock_lots sl
      JOIN deals d ON d.id = sl.deal_id AND d.shop_id = ?
      JOIN crops c ON c.id = sl.crop_id AND c.shop_id = ?
      LEFT JOIN parties p ON p.id = sl.owner_party_id AND p.shop_id = ?
      WHERE sl.shop_id = ?
      ORDER BY sl.created_at DESC
      LIMIT 500
    `).bind(user.shopId, user.shopId, user.shopId, user.shopId).all();

    const lots = result.results ?? [];
    const summary = lots.reduce((acc, lot) => {
      const kg = Math.max(0, Number(lot.available_kg) || 0);
      acc.totalKg += kg;
      if (lot.owner_type === "commission_stock") acc.commissionKg += kg;
      else if (lot.owner_type === "own_stock") acc.ownKg += kg;
      else if (lot.owner_type === "in_transit") acc.transitKg += kg;
      const crop = acc.byCrop[lot.crop_name] ?? { kg: 0, commissionKg: 0, ownKg: 0 };
      crop.kg += kg;
      if (lot.owner_type === "commission_stock") crop.commissionKg += kg;
      if (lot.owner_type === "own_stock") crop.ownKg += kg;
      acc.byCrop[lot.crop_name] = crop;
      return acc;
    }, { totalKg: 0, commissionKg: 0, ownKg: 0, transitKg: 0, byCrop: {} });

    return json({ ok: true, lots, summary });
  } catch {
    return json({ ok: false, error: "स्टॉक डेटा लोड नहीं हुआ। Database schema की जाँच जरूरी है।" }, 503);
  }
}
