import { getSession, json } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);
  try {
    const result = await env.DB.prepare(`
      SELECT
        d.id AS deal_id, d.deal_no, d.deal_date,
        c.name AS crop_name, f.name AS farmer_name,
        p.net_weight, p.purchase_rate, p.total_amount,
        p.deduction_amount, p.payable_amount,
        COALESCE(s.sold_kg, 0) AS sold_kg,
        COALESCE(s.sales_amount, 0) AS sales_amount,
        COALESCE(st.available_kg, 0) AS available_kg,
        COALESCE(ex.expense_amount, 0) AS expense_amount
      FROM deals d
      JOIN purchases p ON p.deal_id = d.id AND p.shop_id = d.shop_id
      JOIN crops c ON c.id = d.crop_id AND c.shop_id = d.shop_id
      JOIN parties f ON f.id = d.farmer_id AND f.shop_id = d.shop_id
      LEFT JOIN (
        SELECT deal_id, SUM(quantity_kg) AS sold_kg, SUM(gross_amount) AS sales_amount
        FROM sales GROUP BY deal_id
      ) s ON s.deal_id = d.id
      LEFT JOIN (
        SELECT deal_id, SUM(available_kg) AS available_kg
        FROM stock_lots WHERE shop_id = ? GROUP BY deal_id
      ) st ON st.deal_id = d.id
      LEFT JOIN (
        SELECT deal_id, SUM(amount) AS expense_amount
        FROM expenses WHERE shop_id = ? AND deal_id IS NOT NULL GROUP BY deal_id
      ) ex ON ex.deal_id = d.id
      WHERE d.shop_id = ? AND d.deal_type = 'own_trade'
      ORDER BY d.deal_date DESC, d.created_at DESC
      LIMIT 500
    `).bind(user.shopId, user.shopId, user.shopId).all();

    const rows = (result.results || []).map((r) => {
      const purchasedKg = Math.max(0, Number(r.net_weight) || 0) * 100;
      const soldKg = Math.max(0, Number(r.sold_kg) || 0);
      const unitCost = purchasedKg > 0 ? (Number(r.payable_amount) || 0) / purchasedKg : 0;
      const allocatedKg = Math.min(soldKg, purchasedKg);
      const purchaseCost = allocatedKg * unitCost;
      const salesAmount = Number(r.sales_amount) || 0;
      const expenses = Number(r.expense_amount) || 0;
      const availableKg = Math.max(0, Number(r.available_kg) || 0);
      const inventoryValue = availableKg * unitCost;
      const grossProfit = salesAmount - purchaseCost;
      return {
        ...r,
        purchased_kg: purchasedKg,
        sold_kg: soldKg,
        available_kg: availableKg,
        purchase_cost_allocated: purchaseCost,
        inventory_value: inventoryValue,
        gross_profit: grossProfit,
        expense_amount: expenses,
        net_profit: grossProfit - expenses
      };
    });
    const totals = rows.reduce((a, r) => ({
      purchaseCost: a.purchaseCost + (Number(r.purchase_cost_allocated) || 0),
      sales: a.sales + (Number(r.sales_amount) || 0),
      expenses: a.expenses + (Number(r.expense_amount) || 0),
      grossProfit: a.grossProfit + (Number(r.gross_profit) || 0),
      netProfit: a.netProfit + (Number(r.net_profit) || 0),
      inventoryValue: a.inventoryValue + (Number(r.inventory_value) || 0)
    }), { purchaseCost: 0, sales: 0, expenses: 0, grossProfit: 0, netProfit: 0, inventoryValue: 0 });
    return json({ ok: true, rows, totals });
  } catch {
    return json({ ok: false, error: "अपना व्यापार रिपोर्ट लोड नहीं हुई। Live D1 schema की जाँच जरूरी है।" }, 503);
  }
}
