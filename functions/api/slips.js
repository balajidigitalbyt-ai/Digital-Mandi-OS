import { getSession, json } from "../_lib/auth.js";

const clean=(v,n=120)=>String(v??"").trim().slice(0,n);
const num=v=>Number(v||0);
const round2=v=>Number(num(v).toFixed(2));

export async function onRequestGet({request,env}){
 const user=await getSession(request,env);
 if(!user)return json({ok:false,error:"Login required."},401);
 try{
  const [farmerSources,millerSources,slips]=await Promise.all([
   env.DB.prepare(`SELECT p.id AS source_id,p.id AS purchase_id,d.id AS deal_id,d.deal_no,p.purchase_date AS document_date,
    p.farmer_id AS party_id,pa.name AS party_name,pa.village,pa.mobile,c.name AS crop_name,
    p.bags,p.gross_weight,p.tare_weight,p.net_weight,p.purchase_rate,p.total_amount,p.deduction_amount,
    p.payable_amount,p.paid_amount,p.balance_amount,p.purchase_mode
    FROM purchases p JOIN deals d ON d.id=p.deal_id AND d.shop_id=p.shop_id
    JOIN parties pa ON pa.id=p.farmer_id AND pa.shop_id=p.shop_id
    JOIN crops c ON c.id=p.crop_id AND c.shop_id=p.shop_id
    WHERE p.shop_id=? ORDER BY p.purchase_date DESC,p.created_at DESC LIMIT 500`).bind(user.shopId).all(),
   env.DB.prepare(`SELECT ds.id AS source_id,ds.id AS dispatch_id,ds.deal_id,d.deal_no,ds.dispatch_date AS document_date,
    ds.miller_id AS party_id,pa.name AS party_name,pa.mobile,c.name AS crop_name,
    ds.vehicle_number,ds.driver_name,ds.driver_mobile,ds.bags,ds.dispatch_weight,ds.accepted_weight,ds.weight_difference,
    s.quantity_kg,s.rate_per_quintal,s.gross_amount,
    COALESCE((SELECT SUM(cc.total_commission) FROM commission_calculations cc WHERE cc.shop_id=ds.shop_id AND cc.deal_id=ds.deal_id),0) AS total_commission,
    COALESCE((SELECT SUM(pm.amount) FROM payments pm WHERE pm.shop_id=ds.shop_id AND pm.deal_id=ds.deal_id AND pm.payment_type='miller_payment' AND pm.notes LIKE '[commission_receipt]%' AND pm.status='completed'),0) AS commission_paid,
    COALESCE((SELECT SUM(pm.amount) FROM payments pm WHERE pm.shop_id=ds.shop_id AND pm.deal_id=ds.deal_id AND pm.payment_type='miller_payment' AND (pm.notes IS NULL OR pm.notes NOT LIKE '[commission_receipt]%') AND pm.status='completed'),0) AS sale_received
    FROM dispatches ds JOIN deals d ON d.id=ds.deal_id AND d.shop_id=ds.shop_id
    JOIN parties pa ON pa.id=ds.miller_id AND pa.shop_id=ds.shop_id
    JOIN crops c ON c.id=ds.crop_id AND c.shop_id=ds.shop_id
    LEFT JOIN sales s ON s.id=ds.sale_id
    WHERE ds.shop_id=? ORDER BY ds.dispatch_date DESC,ds.created_at DESC LIMIT 500`).bind(user.shopId).all(),
   env.DB.prepare(`SELECT s.id,s.slip_no,s.slip_type,s.deal_id,s.party_id,s.snapshot_json,s.version,s.status,s.created_at,
    p.name AS party_name,d.deal_no
    FROM slips s JOIN parties p ON p.id=s.party_id AND p.shop_id=s.shop_id
    LEFT JOIN deals d ON d.id=s.deal_id AND d.shop_id=s.shop_id
    WHERE s.shop_id=? ORDER BY s.created_at DESC LIMIT 500`).bind(user.shopId).all()
  ]);
  return json({ok:true,farmerSources:farmerSources.results||[],millerSources:millerSources.results||[],slips:slips.results||[]});
 }catch(e){
  console.error("Slips GET failed:",e);
  return json({ok:false,error:"पर्ची डेटा लोड नहीं हुआ। लाइव D1 schema की जाँच जरूरी है।"},503);
 }
}

export async function onRequestPost({request,env}){
 const user=await getSession(request,env);
 if(!user)return json({ok:false,error:"Login required."},401);
 let b;try{b=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
 const type=clean(b.slipType,20),sourceId=clean(b.sourceId,80);
 if(!["farmer","miller"].includes(type)||!sourceId)return json({ok:false,error:"पर्ची का प्रकार और संबंधित रिकॉर्ड चुनें।"},400);
 try{
  let dealId,partyId,snapshot,documentDate;
  if(type==="farmer"){
   const row=await env.DB.prepare(`SELECT p.*,d.deal_no,d.deal_date,pa.name AS farmer_name,pa.village,pa.mobile,pa.address,c.name AS crop_name
    FROM purchases p JOIN deals d ON d.id=p.deal_id AND d.shop_id=p.shop_id
    JOIN parties pa ON pa.id=p.farmer_id AND pa.shop_id=p.shop_id
    JOIN crops c ON c.id=p.crop_id AND c.shop_id=p.shop_id
    WHERE p.id=? AND p.shop_id=?`).bind(sourceId,user.shopId).first();
   if(!row)return json({ok:false,error:"चुनी गई किसान खरीद उपलब्ध नहीं है।"},404);
   dealId=row.deal_id;partyId=row.farmer_id;documentDate=row.purchase_date;
   snapshot={schemaVersion:1,slipType:"farmer",title:"किसान पर्ची",dealNo:row.deal_no,date:row.purchase_date,
    party:{id:partyId,name:row.farmer_name,village:row.village||"",mobile:row.mobile||"",address:row.address||""},
    crop:row.crop_name,bags:num(row.bags),grossWeight:num(row.gross_weight),tareWeight:num(row.tare_weight),netWeight:num(row.net_weight),
    ratePerQuintal:num(row.purchase_rate),grossAmount:num(row.total_amount),deduction:num(row.deduction_amount),
    payable:num(row.payable_amount),paid:num(row.paid_amount),balance:num(row.balance_amount),
    purchaseMode:row.purchase_mode==="commission"?"कमीशन मॉडल":"अपना व्यापार",notes:row.notes||""};
  }else{
   const row=await env.DB.prepare(`SELECT ds.*,d.deal_no,d.deal_date,pa.name AS miller_name,pa.village,pa.mobile,pa.address,
    c.name AS crop_name,s.quantity_kg,s.rate_per_quintal,s.gross_amount
    FROM dispatches ds JOIN deals d ON d.id=ds.deal_id AND d.shop_id=ds.shop_id
    JOIN parties pa ON pa.id=ds.miller_id AND pa.shop_id=ds.shop_id
    JOIN crops c ON c.id=ds.crop_id AND c.shop_id=ds.shop_id
    LEFT JOIN sales s ON s.id=ds.sale_id
    WHERE ds.id=? AND ds.shop_id=?`).bind(sourceId,user.shopId).first();
   if(!row)return json({ok:false,error:"चुना गया मिलर डिस्पैच उपलब्ध नहीं है।"},404);
   const [commission,commissionPaid,saleReceived]=await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(total_commission),0) AS amount FROM commission_calculations WHERE shop_id=? AND deal_id=?").bind(user.shopId,row.deal_id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE shop_id=? AND deal_id=? AND payment_type='miller_payment' AND notes LIKE '[commission_receipt]%' AND status='completed'").bind(user.shopId,row.deal_id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE shop_id=? AND deal_id=? AND payment_type='miller_payment' AND (notes IS NULL OR notes NOT LIKE '[commission_receipt]%') AND status='completed'").bind(user.shopId,row.deal_id).first()
   ]);
   dealId=row.deal_id;partyId=row.miller_id;documentDate=row.dispatch_date;
   const acceptedQ=num(row.accepted_weight),dispatchQ=num(row.dispatch_weight);
   snapshot={schemaVersion:1,slipType:"miller",title:"मिलर पर्ची",dealNo:row.deal_no,date:row.dispatch_date,
    party:{id:partyId,name:row.miller_name,village:row.village||"",mobile:row.mobile||"",address:row.address||""},
    crop:row.crop_name,vehicleNumber:row.vehicle_number||"",driverName:row.driver_name||"",driverMobile:row.driver_mobile||"",
    bags:num(row.bags),dispatchWeight:dispatchQ,acceptedWeight:acceptedQ,weightDifference:num(row.weight_difference),
    ratePerQuintal:num(row.rate_per_quintal),saleAmount:num(row.gross_amount),commission:num(commission?.amount),
    commissionPaid:num(commissionPaid?.amount),commissionBalance:Math.max(0,num(commission?.amount)-num(commissionPaid?.amount)),
    saleReceived:num(saleReceived?.amount),saleBalance:Math.max(0,num(row.gross_amount)-num(saleReceived?.amount)),notes:row.notes||""};
  }
  const next=await env.DB.prepare("SELECT COALESCE(MAX(version),0)+1 AS version FROM slips WHERE shop_id=? AND slip_type=? AND deal_id=? AND party_id=?").bind(user.shopId,type,dealId,partyId).first();
  const version=num(next?.version)||1,id=crypto.randomUUID();
  const slipNo=(type==="farmer"?"KIS-":"MIL-")+String(documentDate||new Date().toISOString().slice(0,10)).replaceAll("-","")+"-"+id.slice(0,6).toUpperCase();
  snapshot.slipNo=slipNo;snapshot.version=version;snapshot.issuedAt=new Date().toISOString();
  const statements=[
   env.DB.prepare("INSERT INTO slips (id,shop_id,slip_no,slip_type,deal_id,party_id,snapshot_json,version,status,created_by) VALUES (?,?,?,?,?,?,?,?, 'issued',?)")
    .bind(id,user.shopId,slipNo,type,dealId,partyId,JSON.stringify(snapshot),version,user.id),
   env.DB.prepare("INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values) VALUES (?,?,?,'create','slip',?,NULL,?)")
    .bind(crypto.randomUUID(),user.shopId,user.id,id,JSON.stringify({slipNo,type,dealId,partyId,version,sourceId}))
  ];
  await env.DB.batch(statements);
  return json({ok:true,slip:{id,slip_no:slipNo,slip_type:type,deal_id:dealId,party_id:partyId,snapshot_json:JSON.stringify(snapshot),version,status:"issued",created_at:snapshot.issuedAt}},201);
 }catch(e){
  console.error("Slips POST failed:",e);
  return json({ok:false,error:"पर्ची सेव नहीं हुई।",detail:String(e?.message||e||"Database error").slice(0,350)},500);
 }
}
