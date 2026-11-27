import { getSession, json } from "../_lib/auth.js";
function cleanText(v,max){const s=String(v??"").trim();return s?s.slice(0,max):null;}
export async function onRequestGet({request,env}){
 const user=await getSession(request,env);if(!user)return json({ok:false,error:"Login required."},401);
 try{
  const [farmers,crops,purchases]=await Promise.all([
   env.DB.prepare("SELECT id,name,village FROM parties WHERE shop_id=? AND active=1 AND party_type IN ('farmer','both') ORDER BY name LIMIT 500").bind(user.shopId).all(),
   env.DB.prepare("SELECT id,name FROM crops WHERE shop_id=? AND active=1 ORDER BY name").bind(user.shopId).all(),
   env.DB.prepare("SELECT p.id,p.purchase_date,p.bags,p.net_weight,p.purchase_rate,p.payable_amount,p.purchase_mode,pa.name AS farmer_name,c.name AS crop_name FROM purchases p JOIN deals d ON d.id=p.deal_id AND d.shop_id=? JOIN parties pa ON pa.id=p.farmer_id AND pa.shop_id=? JOIN crops c ON c.id=p.crop_id AND c.shop_id=? ORDER BY p.purchase_date DESC,p.created_at DESC LIMIT 100").bind(user.shopId,user.shopId,user.shopId).all()
  ]);
  return json({ok:true,farmers:farmers.results??[],crops:crops.results??[],purchases:purchases.results??[]});
 }catch{return json({ok:false,error:"खरीद डेटा लोड नहीं हुआ। Database schema की जाँच जरूरी है।"},503);}
}
export async function onRequestPost({request,env}){
 const user=await getSession(request,env);if(!user)return json({ok:false,error:"Login required."},401);
 let b;try{b=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
 const farmerId=cleanText(b.farmerId,80),cropId=cleanText(b.cropId,80),mode=b.mode==="own_trade"?"own_trade":"commission",date=cleanText(b.date,10);
 const bags=Number(b.bags||0),gross=Number(b.grossWeight),tare=Number(b.tareWeight||0),rate=Number(b.rate),deduction=Number(b.deduction||0);
 if(!farmerId||!cropId||!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||!Number.isFinite(gross)||gross<=0||!Number.isFinite(tare)||tare<0||tare>=gross||!Number.isFinite(rate)||rate<=0||!Number.isFinite(deduction)||deduction<0||!Number.isInteger(bags)||bags<0||deduction>Math.max(0,(gross-tare)*rate))return json({ok:false,error:"किसान, फसल, तारीख, वजन, रेट और कटौती सही भरें।"},400);
 const net=Number((gross-tare).toFixed(3)),total=Number((net*rate).toFixed(2)),payable=Number((total-deduction).toFixed(2)),kg=Number((net*100).toFixed(2));
 const id=crypto.randomUUID(),dealId=crypto.randomUUID(),stockId=crypto.randomUUID(),weighId=crypto.randomUUID(),now=new Date().toISOString(),dealNo="DM-"+date.replaceAll("-","")+"-"+crypto.randomUUID().slice(0,6).toUpperCase();
 const note=cleanText(b.notes,500),ownerType=mode==="commission"?"commission_stock":"own_stock";
 try{
  const farmer=await env.DB.prepare("SELECT id FROM parties WHERE id=? AND shop_id=? AND active=1 AND party_type IN ('farmer','both')").bind(farmerId,user.shopId).first();
  const crop=await env.DB.prepare("SELECT id,name FROM crops WHERE id=? AND shop_id=? AND active=1").bind(cropId,user.shopId).first();
  if(!farmer||!crop)return json({ok:false,error:"चुना गया किसान या फसल उपलब्ध नहीं है।"},400);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO deals (id,shop_id,deal_no,deal_type,crop_id,farmer_id,deal_date,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(dealId,user.shopId,dealNo,mode,cropId,farmerId,date,note,user.id),
   env.DB.prepare("INSERT INTO purchases (id,shop_id,deal_id,farmer_id,crop_id,purchase_date,bags,gross_weight,tare_weight,net_weight,purchase_rate,total_amount,deduction_amount,payable_amount,paid_amount,balance_amount,purchase_mode,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)").bind(id,user.shopId,dealId,farmerId,cropId,date,bags,gross,tare,net,rate,total,deduction,payable,payable,mode,note),
   env.DB.prepare("INSERT INTO weighments (id,shop_id,deal_id,party_id,crop_id,weighment_type,weight_quintals,measured_at,notes) VALUES (?,?,?,?,?,'net',?,?,?)").bind(weighId,user.shopId,dealId,farmerId,cropId,net,now,note),
   env.DB.prepare("INSERT INTO stock_lots (id,shop_id,deal_id,crop_id,owner_type,owner_party_id,quantity_kg,available_kg,status) VALUES (?,?,?,?,?,?,?,?, 'available')").bind(stockId,user.shopId,dealId,cropId,ownerType,mode==="commission"?farmerId:null,kg,kg),
   env.DB.prepare("INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values) VALUES (?,?,?,'create','purchase',?,NULL,?)").bind(crypto.randomUUID(),user.shopId,user.id,id,JSON.stringify({dealNo,farmerId,cropId,mode,date,bags,gross,tare,net,rate,total,deduction,payable}))
  ]);
  return json({ok:true,purchase:{id,purchase_date:date,bags,net_weight:net,purchase_rate:rate,payable_amount:payable,purchase_mode:mode,farmer_name:(await env.DB.prepare("SELECT name FROM parties WHERE id=? AND shop_id=?").bind(farmerId,user.shopId).first())?.name??"",crop_name:crop.name}},201);
 }catch{return json({ok:false,error:"खरीद सेव नहीं हुई। कोई रिकॉर्ड आधा सेव नहीं किया गया; schema या enum की जाँच जरूरी है।"},503);}
}
