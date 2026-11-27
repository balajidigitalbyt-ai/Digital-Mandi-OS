import { getSession, json } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);
  try {
    const [millers, lots, recent] = await Promise.all([
      env.DB.prepare("SELECT id,name FROM parties WHERE shop_id=? AND active=1 AND party_type IN ('miller','both') ORDER BY name LIMIT 500").bind(user.shopId).all(),
      env.DB.prepare(`SELECT sl.id,sl.deal_id,d.deal_no,sl.crop_id,c.name AS crop_name,sl.owner_type,sl.owner_party_id,COALESCE(p.name,'') AS owner_name,sl.available_kg
        FROM stock_lots sl JOIN deals d ON d.id=sl.deal_id AND d.shop_id=?
        JOIN crops c ON c.id=sl.crop_id AND c.shop_id=?
        LEFT JOIN parties p ON p.id=sl.owner_party_id AND p.shop_id=?
        WHERE sl.shop_id=? AND sl.status='available' AND sl.available_kg>0
        ORDER BY sl.created_at DESC LIMIT 500`).bind(user.shopId,user.shopId,user.shopId,user.shopId).all(),
      env.DB.prepare(`SELECT s.id,s.quantity_kg,s.rate_per_quintal,s.gross_amount,s.created_at,p.name AS miller_name,c.name AS crop_name,ds.vehicle_number,ds.dispatch_weight,ds.accepted_weight,ds.weight_difference
        FROM sales s JOIN deals d ON d.id=s.deal_id AND d.shop_id=?
        JOIN parties p ON p.id=s.miller_id AND p.shop_id=?
        JOIN crops c ON c.id=s.crop_id AND c.shop_id=?
        LEFT JOIN dispatches ds ON ds.sale_id=s.id AND ds.shop_id=?
        ORDER BY s.created_at DESC LIMIT 100`).bind(user.shopId,user.shopId,user.shopId,user.shopId).all()
    ]);
    return json({ok:true,millers:millers.results??[],lots:lots.results??[],sales:recent.results??[]});
  } catch {
    return json({ok:false,error:"बिक्री और डिस्पैच डेटा लोड नहीं हुआ। Database schema की जाँच जरूरी है।"},503);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok:false,error:"Login required." },401);
  let b; try { b=await request.json(); } catch { return json({ok:false,error:"Invalid request."},400); }
  const lotId=String(b.stockLotId??"").trim();
  const millerId=String(b.millerId??"").trim();
  const vehicle=String(b.vehicleNumber??"").trim().slice(0,30);
  const driver=String(b.driverName??"").trim().slice(0,80);
  const driverMobile=String(b.driverMobile??"").trim().slice(0,20);
  const dispatchQ=Number(b.dispatchWeight);
  const acceptedQ=Number(b.acceptedWeight);
  const rate=Number(b.ratePerQuintal);
  const date=String(b.dispatchDate??"").trim();
  const notes=String(b.notes??"").trim().slice(0,500)||null;
  if(!lotId||!millerId||!vehicle||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(dispatchQ)||dispatchQ<=0||!Number.isFinite(acceptedQ)||acceptedQ<=0||acceptedQ>dispatchQ||!Number.isFinite(rate)||rate<=0){
    return json({ok:false,error:"स्टॉक, मिलर, गाड़ी नंबर, तारीख, डिस्पैच/स्वीकृत वजन और रेट सही भरें। स्वीकृत वजन डिस्पैच वजन से अधिक नहीं हो सकता।"},400);
  }
  try {
    const lot=await env.DB.prepare(`SELECT sl.id,sl.shop_id,sl.deal_id,sl.crop_id,sl.owner_type,sl.owner_party_id,sl.available_kg,d.deal_no
      FROM stock_lots sl JOIN deals d ON d.id=sl.deal_id AND d.shop_id=?
      WHERE sl.id=? AND sl.shop_id=? AND sl.status='available'`).bind(user.shopId,lotId,user.shopId).first();
    const miller=await env.DB.prepare("SELECT id FROM parties WHERE id=? AND shop_id=? AND active=1 AND party_type IN ('miller','both')").bind(millerId,user.shopId).first();
    if(!lot||!miller)return json({ok:false,error:"चुना गया स्टॉक या मिलर उपलब्ध नहीं है।"},400);
    const dispatchKg=Number((dispatchQ*100).toFixed(2));
    const acceptedKg=Number((acceptedQ*100).toFixed(2));
    if(Number(lot.available_kg)<dispatchKg)return json({ok:false,error:"उपलब्ध स्टॉक से अधिक वजन डिस्पैच नहीं कर सकते।"},400);
    const saleId=crypto.randomUUID(),dispatchId=crypto.randomUUID();
    const amount=Number((acceptedQ*rate).toFixed(2));
    const difference=Number((dispatchQ-acceptedQ).toFixed(3));
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE stock_lots SET available_kg=available_kg-? WHERE id=? AND shop_id=? AND available_kg>=?").bind(dispatchKg,lotId,user.shopId,dispatchKg),
      env.DB.prepare("UPDATE deals SET miller_id=? WHERE id=? AND shop_id=?").bind(millerId,lot.deal_id,user.shopId),
      env.DB.prepare("INSERT INTO sales (id,deal_id,miller_id,crop_id,quantity_kg,rate_per_quintal,gross_amount) VALUES (?,?,?,?,?,?,?)").bind(saleId,lot.deal_id,millerId,lot.crop_id,acceptedKg,rate,amount),
      env.DB.prepare("INSERT INTO dispatches (id,shop_id,deal_id,sale_id,miller_id,crop_id,dispatch_date,vehicle_number,driver_name,driver_mobile,dispatch_weight,accepted_weight,weight_difference,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'accepted',?)").bind(dispatchId,user.shopId,lot.deal_id,saleId,millerId,lot.crop_id,date,vehicle,driver||null,driverMobile||null,dispatchQ,acceptedQ,difference,notes),
      env.DB.prepare("INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values) VALUES (?,?,?,'create','sale',?,NULL,?)").bind(crypto.randomUUID(),user.shopId,user.id,saleId,JSON.stringify({dealNo:lot.deal_no,lotId,millerId,dispatchQ,acceptedQ,rate,amount,vehicle}))
    ]);
    if(!results?.[0]?.meta?.changes)return json({ok:false,error:"स्टॉक अपडेट नहीं हुआ। संभव है किसी दूसरी एंट्री में यह स्टॉक पहले ही उपयोग हो चुका हो।"},409);
    return json({ok:true,sale:{id:saleId,quantity_kg:acceptedKg,rate_per_quintal:rate,gross_amount:amount,dispatch_weight:dispatchQ,accepted_weight:acceptedQ,weight_difference:difference}},201);
  } catch {
    return json({ok:false,error:"बिक्री सेव नहीं हुई। कोई रिकॉर्ड आधा सेव नहीं किया गया; Database schema की जाँच जरूरी है।"},503);
  }
}
