import { getSession, json } from "../_lib/auth.js";

const clean=(v,n=120)=>String(v??"").trim().slice(0,n);
const round2=n=>Number((Number(n)||0).toFixed(2));
const TYPES=new Set(["farmer_payment","miller_sale_receipt","commission_receipt"]);
const METHODS=new Set(["cash","bank","upi","cheque","other"]);

async function ensureAccount(env,shopId,code,name,type){
 await env.DB.prepare(`INSERT OR IGNORE INTO ledger_accounts
  (id,shop_id,account_code,account_name,account_type,opening_balance,balance_side,system_account,active)
  VALUES (?,?,?,?,?,0,?,1,1)`).bind(crypto.randomUUID(),shopId,code,name,type,type==="liability"?"credit":"debit").run();
 return env.DB.prepare("SELECT id,account_type FROM ledger_accounts WHERE shop_id=? AND account_code=? AND active=1").bind(shopId,code).first();
}

export async function onRequestGet({request,env}){
 const user=await getSession(request,env);if(!user)return json({ok:false,error:"Login required."},401);
 try{
  const [parties,pendingFarmer,pendingMiller,pendingCommission,recent]=await Promise.all([
   env.DB.prepare("SELECT id,name,party_type FROM parties WHERE shop_id=? AND active=1 ORDER BY name LIMIT 1000").bind(user.shopId).all(),
   env.DB.prepare(`SELECT d.id AS deal_id,d.deal_no,d.deal_date,p.farmer_id AS party_id,pa.name AS party_name,
    c.name AS crop_name,MAX(p.balance_amount) AS outstanding,'farmer_payment' AS payment_type
    FROM purchases p JOIN deals d ON d.id=p.deal_id AND d.shop_id=p.shop_id
    JOIN parties pa ON pa.id=p.farmer_id AND pa.shop_id=p.shop_id
    JOIN crops c ON c.id=p.crop_id AND c.shop_id=p.shop_id
    WHERE p.shop_id=? AND p.balance_amount>0 GROUP BY d.id,p.id,pa.name,c.name
    ORDER BY d.deal_date DESC LIMIT 300`).bind(user.shopId).all(),
   env.DB.prepare(`SELECT d.id AS deal_id,d.deal_no,d.deal_date,d.miller_id AS party_id,pa.name AS party_name,
    c.name AS crop_name,MAX(sa.sale_amount-COALESCE(pm.paid,0)) AS outstanding,'miller_sale_receipt' AS payment_type
    FROM deals d JOIN parties pa ON pa.id=d.miller_id AND pa.shop_id=d.shop_id
    JOIN crops c ON c.id=d.crop_id AND c.shop_id=d.shop_id
    JOIN (SELECT deal_id,SUM(gross_amount) AS sale_amount FROM sales GROUP BY deal_id) sa ON sa.deal_id=d.id
    LEFT JOIN (SELECT deal_id,SUM(amount) AS paid FROM payments WHERE shop_id=? AND payment_type='miller_sale_receipt' AND status='completed' GROUP BY deal_id) pm ON pm.deal_id=d.id
    WHERE d.shop_id=? AND sa.sale_amount>COALESCE(pm.paid,0)
    GROUP BY d.id,pa.name,c.name ORDER BY d.deal_date DESC LIMIT 300`).bind(user.shopId,user.shopId).all(),
   env.DB.prepare(`SELECT d.id AS deal_id,d.deal_no,d.deal_date,d.miller_id AS party_id,pa.name AS party_name,
    c.name AS crop_name,MAX(cc.total_commission-COALESCE(pm.paid,0)) AS outstanding,'commission_receipt' AS payment_type
    FROM commission_calculations cc JOIN deals d ON d.id=cc.deal_id AND d.shop_id=cc.shop_id
    JOIN parties pa ON pa.id=d.miller_id AND pa.shop_id=d.shop_id
    JOIN crops c ON c.id=d.crop_id AND c.shop_id=d.shop_id
    LEFT JOIN (SELECT deal_id,SUM(amount) AS paid FROM payments WHERE shop_id=? AND payment_type='commission_receipt' AND status='completed' GROUP BY deal_id) pm ON pm.deal_id=d.id
    WHERE cc.shop_id=? AND cc.total_commission>COALESCE(pm.paid,0)
    GROUP BY d.id,pa.name,c.name ORDER BY d.deal_date DESC LIMIT 300`).bind(user.shopId,user.shopId).all(),
   env.DB.prepare(`SELECT p.id,p.payment_no,p.payment_date,p.payment_type,p.amount,p.payment_method,p.transaction_reference,
    p.status,p.notes,pa.name AS party_name,d.deal_no
    FROM payments p JOIN parties pa ON pa.id=p.party_id AND pa.shop_id=p.shop_id
    LEFT JOIN deals d ON d.id=p.deal_id AND d.shop_id=p.shop_id
    WHERE p.shop_id=? ORDER BY p.payment_date DESC,p.created_at DESC LIMIT 100`).bind(user.shopId).all()
  ]);
  return json({ok:true,parties:parties.results||[],pending:[
   ...(pendingFarmer.results||[]),...(pendingMiller.results||[]),...(pendingCommission.results||[])
  ],payments:recent.results||[]});
 }catch(e){return json({ok:false,error:"Payments डेटा लोड नहीं हुआ। लाइव D1 schema की जाँच जरूरी है।"},503);}
}

export async function onRequestPost({request,env}){
 const user=await getSession(request,env);if(!user)return json({ok:false,error:"Login required."},401);
 let b;try{b=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
 const dealId=clean(b.dealId,80),partyId=clean(b.partyId,80),type=clean(b.paymentType,40),method=clean(b.paymentMethod,20);
 const amount=round2(b.amount),date=clean(b.paymentDate,10),reference=clean(b.transactionReference,100),notes=clean(b.notes,500);
 if(!dealId||!partyId||!TYPES.has(type)||!METHODS.has(method)||!Number.isFinite(amount)||amount<=0||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return json({ok:false,error:"पार्टी, डील, भुगतान प्रकार, तारीख, तरीका और सही रकम भरें।"},400);
 try{
  const deal=await env.DB.prepare(`SELECT d.id,d.deal_no,d.deal_type,d.farmer_id,d.miller_id
    FROM deals d WHERE d.id=? AND d.shop_id=?`).bind(dealId,user.shopId).first();
  if(!deal)return json({ok:false,error:"चुनी गई डील उपलब्ध नहीं है।"},404);
  let due=0,partyAccountCode="",partyAccountName="",partyAccountType="",cashCode=method==="cash"?"1001":"1002";
  if(type==="farmer_payment"){
   if(deal.farmer_id!==partyId)return json({ok:false,error:"इस डील का किसान सही चुनें।"},400);
   const p=await env.DB.prepare("SELECT COALESCE(SUM(balance_amount),0) AS due FROM purchases WHERE shop_id=? AND deal_id=? AND farmer_id=?").bind(user.shopId,dealId,partyId).first();
   due=Number(p?.due||0);partyAccountCode="2101";partyAccountName="Farmer Payable";partyAccountType="liability";
  }else{
   if(!deal.miller_id||deal.miller_id!==partyId)return json({ok:false,error:"इस डील का मिलर सही चुनें।"},400);
   if(type==="miller_sale_receipt"){
    const [s,p]=await Promise.all([
     env.DB.prepare("SELECT COALESCE(SUM(gross_amount),0) AS total FROM sales s JOIN deals d ON d.id=s.deal_id WHERE d.shop_id=? AND s.deal_id=?").bind(user.shopId,dealId).first(),
     env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE shop_id=? AND deal_id=? AND payment_type='miller_sale_receipt' AND status='completed'").bind(user.shopId,dealId).first()
    ]);
    due=Number(s?.total||0)-Number(p?.total||0);partyAccountCode="1101";partyAccountName="Miller Sales Receivable";partyAccountType="asset";
   }else{
    const [s,p]=await Promise.all([
     env.DB.prepare("SELECT COALESCE(SUM(total_commission),0) AS total FROM commission_calculations WHERE shop_id=? AND deal_id=?").bind(user.shopId,dealId).first(),
     env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE shop_id=? AND deal_id=? AND payment_type='commission_receipt' AND status='completed'").bind(user.shopId,dealId).first()
    ]);
    due=Number(s?.total||0)-Number(p?.total||0);partyAccountCode="1105";partyAccountName="Miller Commission Receivable";partyAccountType="asset";
   }
  }
  due=round2(Math.max(0,due));
  if(amount>due+0.001)return json({ok:false,error:"रकम बकाया से अधिक है। उपलब्ध बकाया: ₹"+due.toLocaleString("en-IN")},400);
  const [party,cashAccount,partyAccount]=await Promise.all([
   env.DB.prepare("SELECT id FROM parties WHERE id=? AND shop_id=? AND active=1").bind(partyId,user.shopId).first(),
   ensureAccount(env,user.shopId,cashCode,cashCode==="1001"?"Cash":"Bank / UPI", "asset"),
   ensureAccount(env,user.shopId,partyAccountCode,partyAccountName,partyAccountType)
  ]);
  if(!party||!cashAccount||cashAccount.account_type!=="asset"||!partyAccount||partyAccount.account_type!==partyAccountType)return json({ok:false,error:"Ledger control account उपलब्ध नहीं है।"},503);
  const id=crypto.randomUUID(),journalId=crypto.randomUUID();
  const paymentNo="PAY-"+date.replaceAll("-","")+"-"+id.slice(0,6).toUpperCase();
  const entryNo="JV-"+date.replaceAll("-","")+"-"+id.slice(0,6).toUpperCase();
  const narration=type==="farmer_payment"?"Farmer payment":type==="miller_sale_receipt"?"Miller sale collection":"Miller commission collection";
  const firstDebit=type!=="farmer_payment";
  const paymentInsert=env.DB.prepare(`INSERT INTO payments
   (id,shop_id,party_id,deal_id,payment_no,payment_date,payment_type,amount,payment_method,transaction_reference,status,notes)
   SELECT ?,?,?,?,?,?,?,?, ?,?,'completed',?
   WHERE EXISTS (SELECT 1 FROM deals WHERE id=? AND shop_id=?)${type==="farmer_payment"?" AND changes()>0":""}`).bind(id,user.shopId,partyId,dealId,paymentNo,date,type,amount,method,reference||null,notes||null,dealId,user.shopId);
  const statements=[];
  if(type==="farmer_payment"){
   statements.push(env.DB.prepare(`UPDATE purchases SET paid_amount=paid_amount+?,balance_amount=MAX(0,balance_amount-?)
    WHERE shop_id=? AND deal_id=? AND farmer_id=? AND balance_amount>=?`).bind(amount,amount,user.shopId,dealId,partyId,amount));
  }
  statements.push(paymentInsert);
  statements.push(env.DB.prepare(`INSERT INTO journal_entries
   (id,shop_id,entry_no,entry_date,reference_type,reference_id,description,status)
   SELECT ?,?,?,?,?,?,?,'posted'
   WHERE EXISTS (SELECT 1 FROM payments WHERE id=? AND shop_id=?)`).bind(journalId,user.shopId,entryNo,date,"payment",id,narration+" · "+deal.deal_no,id,user.shopId));
  statements.push(env.DB.prepare(`INSERT INTO journal_lines (id,journal_entry_id,account_id,party_id,debit,credit)
   SELECT ?,?,?,?, ?,? WHERE EXISTS (SELECT 1 FROM journal_entries WHERE id=? AND shop_id=? AND status='posted')`)
   .bind(crypto.randomUUID(),journalId,firstDebit?cashAccount.id:partyAccount.id,partyId,amount,0,journalId,user.shopId));
  statements.push(env.DB.prepare(`INSERT INTO journal_lines (id,journal_entry_id,account_id,party_id,debit,credit)
   SELECT ?,?,?,?, ?,? WHERE EXISTS (SELECT 1 FROM journal_entries WHERE id=? AND shop_id=? AND status='posted')`)
   .bind(crypto.randomUUID(),journalId,firstDebit?partyAccount.id:cashAccount.id,partyId,0,amount,journalId,user.shopId));
  statements.push(env.DB.prepare(`INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values)
   SELECT ?,?,?, 'create','payment',?,NULL,? WHERE EXISTS (SELECT 1 FROM payments WHERE id=? AND shop_id=?)`).bind(crypto.randomUUID(),user.shopId,user.id,id,JSON.stringify({paymentNo,dealId,partyId,type,amount,method,date,journalEntryNo:entryNo}),id,user.shopId));
  const result=await env.DB.batch(statements);
  const paymentIndex=type==="farmer_payment"?1:0;
  if(!result?.[paymentIndex]?.meta?.changes)return json({ok:false,error:"भुगतान सेव नहीं हुआ। बकाया बदल चुका हो सकता है; Refresh करके दोबारा जाँचें।"},409);
  return json({ok:true,payment:{id,payment_no:paymentNo,amount,payment_type:type,payment_date:date,journal_entry_no:entryNo},remainingDue:round2(due-amount)},201);
 }catch(e){
  console.error("Payments POST failed:",e);
  return json({ok:false,error:"भुगतान सेव नहीं हुआ।",detail:String(e?.message||e||"Unknown database error").slice(0,500)},500);
 }
}
