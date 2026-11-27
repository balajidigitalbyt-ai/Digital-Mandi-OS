import { getSession, json } from "../_lib/auth.js";

const MARKER = "[WEIGHT_RECONCILED]";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);
  try {
    const rows = await env.DB.prepare(`
      SELECT ds.id, ds.dispatch_date, ds.vehicle_number, ds.dispatch_weight,
        ds.accepted_weight, ds.weight_difference, ds.status, ds.notes,
        d.deal_no, d.deal_type, c.name AS crop_name,
        m.name AS miller_name, f.name AS farmer_name
      FROM dispatches ds
      JOIN deals d ON d.id=ds.deal_id AND d.shop_id=?
      JOIN crops c ON c.id=ds.crop_id AND c.shop_id=?
      LEFT JOIN parties m ON m.id=ds.miller_id AND m.shop_id=?
      LEFT JOIN parties f ON f.id=d.farmer_id AND f.shop_id=?
      WHERE ds.shop_id=? AND ABS(COALESCE(ds.weight_difference,0))>0.001
      ORDER BY ds.dispatch_date DESC, ds.created_at DESC LIMIT 500
    `).bind(user.shopId,user.shopId,user.shopId,user.shopId,user.shopId).all();
    const all = rows.results || [];
    const pending = all.filter(x => !String(x.notes || "").includes(MARKER));
    const reconciled = all.filter(x => String(x.notes || "").includes(MARKER));
    const sum = pending.reduce((n,x)=>n+Math.abs(Number(x.weight_difference)||0),0);
    return json({ok:true,dispatches:all,pendingCount:pending.length,reconciledCount:reconciled.length,pendingDifferenceQ:Number(sum.toFixed(3))});
  } catch (error) {
    return json({ok:false,error:"वजन मिलान डेटा लोड नहीं हुआ। "+(error?.message||"")},503);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ok:false,error:"Login required."},401);
  if (!["owner","admin"].includes(String(user.role||"").toLowerCase())) {
    return json({ok:false,error:"वजन अंतर मिलान करने के लिए Owner/Admin अनुमति जरूरी है।"},403);
  }
  let body; try { body=await request.json(); } catch { return json({ok:false,error:"Invalid request."},400); }
  const dispatchId=String(body.dispatchId||"").trim();
  const reason=String(body.reason||"").trim().slice(0,500);
  const confirmed=body.confirmed===true;
  if(!dispatchId||reason.length<10||!confirmed) {
    return json({ok:false,error:"डिस्पैच चुनें, कम से कम 10 अक्षरों में कारण लिखें और मिलर की तौल जाँच की पुष्टि करें।"},400);
  }
  try {
    const row=await env.DB.prepare(`SELECT id,deal_id,dispatch_weight,accepted_weight,weight_difference,notes
      FROM dispatches WHERE id=? AND shop_id=?`).bind(dispatchId,user.shopId).first();
    if(!row)return json({ok:false,error:"यह डिस्पैच रिकॉर्ड नहीं मिला।"},404);
    if(Math.abs(Number(row.weight_difference)||0)<=0.001)return json({ok:false,error:"इस डिस्पैच में मिलान योग्य वजन अंतर नहीं है।"},409);
    if(String(row.notes||"").includes(MARKER))return json({ok:false,error:"इस वजन अंतर का मिलान पहले ही दर्ज हो चुका है।"},409);
    const auditId=crypto.randomUUID();
    const note=MARKER+" "+new Date().toISOString()+" · "+reason;
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE dispatches SET notes=CASE WHEN COALESCE(notes,'')='' THEN ? ELSE notes || char(10) || ? END WHERE id=? AND shop_id=? AND NOT (COALESCE(notes,'') LIKE ?)")
        .bind(note,note,dispatchId,user.shopId,"%"+MARKER+"%"),
      env.DB.prepare("INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values) SELECT ?,?,?, 'reconcile','dispatch_weight',?,?,? WHERE EXISTS (SELECT 1 FROM dispatches WHERE id=? AND shop_id=? AND notes LIKE ?)")
        .bind(auditId,user.shopId,user.id,dispatchId,JSON.stringify({dispatchWeight:row.dispatch_weight,acceptedWeight:row.accepted_weight,difference:row.weight_difference}),JSON.stringify({reason,confirmed:true}),dispatchId,user.shopId,"%"+MARKER+"%")
    ]);
    if(!results?.[0]?.meta?.changes)return json({ok:false,error:"वजन मिलान सेव नहीं हुआ। रिकॉर्ड पहले ही अपडेट हो सकता है।"},409);
    return json({ok:true,message:"वजन अंतर का कारण और Owner/Admin पुष्टि सेव हो गई। मूल वजन और हिसाब में कोई बदलाव नहीं किया गया।"});
  } catch(error) {
    return json({ok:false,error:"वजन मिलान सेव नहीं हुआ। "+(error?.message||"")},503);
  }
}
