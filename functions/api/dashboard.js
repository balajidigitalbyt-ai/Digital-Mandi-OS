import { getSession, json } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);

  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Date().toISOString().slice(0, 10);

  try {
    const [todayPurchase, todaySales, farmerDue, millerDue, stock, commission, recent] = await Promise.all([
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) AS amount, COUNT(*) AS entries FROM purchases WHERE shop_id=? AND purchase_date=?").bind(user.shopId, date).first(),
      env.DB.prepare("SELECT COALESCE(SUM(gross_amount),0) AS amount, COUNT(*) AS entries FROM sales s JOIN deals d ON d.id=s.deal_id WHERE d.shop_id=? AND date(s.created_at)=?").bind(user.shopId, date).first(),
      env.DB.prepare("SELECT COALESCE(SUM(balance_amount),0) AS amount, COUNT(*) AS parties FROM purchases WHERE shop_id=? AND balance_amount>0").bind(user.shopId).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(jl.debit-jl.credit),0) AS amount
        FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_entry_id
        JOIN ledger_accounts a ON a.id=jl.account_id
        WHERE je.shop_id=? AND je.status='posted' AND a.account_code IN ('1101','1102')`).bind(user.shopId).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(available_kg),0) AS total_kg,
        COALESCE(SUM(CASE WHEN owner_type='own_stock' THEN available_kg ELSE 0 END),0) AS own_kg,
        COALESCE(SUM(CASE WHEN owner_type='commission_stock' THEN available_kg ELSE 0 END),0) AS commission_kg
        FROM stock_lots WHERE shop_id=? AND status='available'`).bind(user.shopId).first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_commission),0) AS amount FROM commission_calculations WHERE shop_id=? AND date(calculated_at)=?").bind(user.shopId, date).first(),
      env.DB.prepare(`SELECT 'purchase' AS kind, p.purchase_date AS entry_date, COALESCE(f.name,'किसान') AS party_name,
        p.total_amount AS amount, d.deal_no
        FROM purchases p JOIN deals d ON d.id=p.deal_id
        LEFT JOIN parties f ON f.id=p.farmer_id AND f.shop_id=p.shop_id
        WHERE p.shop_id=?
        UNION ALL
        SELECT 'sale' AS kind, date(s.created_at) AS entry_date, COALESCE(m.name,'मिलर') AS party_name,
        s.gross_amount AS amount, d.deal_no
        FROM sales s JOIN deals d ON d.id=s.deal_id
        LEFT JOIN parties m ON m.id=s.miller_id AND m.shop_id=d.shop_id
        WHERE d.shop_id=?
        ORDER BY entry_date DESC LIMIT 8`).bind(user.shopId, user.shopId).all()
    ]);

    return json({
      ok: true,
      date,
      summary: {
        todayPurchase: Number(todayPurchase?.amount || 0),
        purchaseEntries: Number(todayPurchase?.entries || 0),
        todaySales: Number(todaySales?.amount || 0),
        salesEntries: Number(todaySales?.entries || 0),
        farmerDue: Number(farmerDue?.amount || 0),
        farmerDueParties: Number(farmerDue?.parties || 0),
        millerReceivable: Number(millerDue?.amount || 0),
        stockKg: Number(stock?.total_kg || 0),
        ownStockKg: Number(stock?.own_kg || 0),
        commissionStockKg: Number(stock?.commission_kg || 0),
        todayCommission: Number(commission?.amount || 0)
      },
      recent: recent?.results || []
    });
  } catch (error) {
    return json({ ok: false, error: "Dashboard डेटा लोड नहीं हुआ। " + (error?.message || "") }, 500);
  }
}
