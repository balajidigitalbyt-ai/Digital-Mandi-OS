import { getSession, json } from "../_lib/auth.js";

const clean=(v,n=160)=>String(v??"").trim().slice(0,n);
const round2=n=>Number((Number(n)||0).toFixed(2));
const METHODS=new Set(["cash","bank","upi","cheque","other"]);
const CATEGORIES={
  labour:{code:"5001",name:"मजदूरी",account:"Labour Expense"},
  handling:{code:"5002",name:"हमाली",account:"Handling Expense"},
  transport:{code:"5003",name:"गाड़ी भाड़ा",account:"Transport Expense"},
  bags:{code:"5004",name:"बोरी / पैकिंग",account:"Packing Expense"},
  mandi:{code:"5005",name:"मंडी खर्च",account:"Mandi Charges"},
  other:{code:"5006",name:"अन्य खर्च",account:"Other Expense"}
};
async function ensureAccount(env,shopId,code,name,type){
  await env.DB.prepare(`INSERT OR IGNORE INTO ledger_accounts
    (id,shop_id,account_code,account_name,account_type,opening_balance,balance_side,system_account,active)
    VALUES (?,?,?,?,?,0,?,1,1)`).bind(crypto.randomUUID(),shopId,code,name,type,type==="liability"?"credit":"debit").run();
  return env.DB.prepare("SELECT id,account_type FROM ledger_accounts WHERE shop_id=? AND account_code=? AND active=1").bind(shopId,code).first();
}
export async function onRequestGet({request,env}){
  const user=await getSession(request,env);if(!user)return json({ok:false,error:"Login required."},401);
  try{
    const [expenses,deals]=await Promise.all([
      env.DB.prepare(`SELECT e.id,e.expense_no,e.expense_date,e.expense_category,e.description,e.amount,e.payment_method,e.paid_to,e.transaction_reference,e.deal_id,d.deal_no
        FROM expenses e LEFT JOIN deals d ON d.id=e.deal_id AND d.shop_id=e.shop_id
        WHERE e.shop_id=? ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 200`).bind(user.shopId).all(),
      env.DB.prepare(`SELECT id,deal_no,deal_type,deal_date FROM deals WHERE shop_id=? ORDER BY deal_date DESC,created_at DESC LIMIT 300`).bind(user.shopId).all()
    ]);
    return json({ok:true,expenses:expenses.results||[],deals:deals.results||[],categories:Object.entries(CATEGORIES).map(([key,v])=>({key,label:v.name}))});
  }catch(e){console.error("Expenses GET failed:",e);return json({ok:false,error:"खर्च डेटा लोड नहीं हुआ।",detail:String(e?.message||e).slice(0,350)},503);}
}
export async function onRequestPost({request,env}){
  const user=await getSession(request,env);if(!user)return json({ok:false,error:"Login required."},401);
  let b;try{b=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
  const category=clean(b.category,30),description=clean(b.description,240),dealId=clean(b.dealId,80),paidTo=clean(b.paidTo,120);
  const date=clean(b.expenseDate,10),method=clean(b.paymentMethod,20),reference=clean(b.transactionReference,100);
  const amount=round2(b.amount),cfg=CATEGORIES[category];
  if(!cfg||!description||!Number.isFinite(amount)||amount<=0||!METHODS.has(method)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))
    return json({ok:false,error:"खर्च का प्रकार, विवरण, सही रकम, तारीख और भुगतान तरीका भरें।"},400);
  try{
    if(dealId){
      const deal=await env.DB.prepare("SELECT id FROM deals WHERE id=? AND shop_id=?").bind(dealId,user.shopId).first();
      if(!deal)return json({ok:false,error:"चुनी गई डील उपलब्ध नहीं है।"},404);
    }
    const cashCode=method==="cash"?"1001":"1002";
    const [expenseAccount,cashAccount]=await Promise.all([
      ensureAccount(env,user.shopId,cfg.code,cfg.account,"expense"),
      ensureAccount(env,user.shopId,cashCode,cashCode==="1001"?"Cash":"Bank / UPI","asset")
    ]);
    if(!expenseAccount||expenseAccount.account_type!=="expense"||!cashAccount||cashAccount.account_type!=="asset")
      return json({ok:false,error:"खर्च या Cash/Bank Ledger account उपलब्ध नहीं है।"},503);
    const id=crypto.randomUUID(),journalId=crypto.randomUUID(),serial=id.slice(0,7).toUpperCase();
    const expenseNo="EXP-"+date.replaceAll("-","")+"-"+serial,entryNo="JV-EXP-"+date.replaceAll("-","")+"-"+serial;
    const statements=[
      env.DB.prepare(`INSERT INTO expenses
        (id,shop_id,expense_no,expense_date,account_id,deal_id,expense_category,description,amount,payment_method,paid_to,transaction_reference)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.shopId,expenseNo,date,expenseAccount.id,dealId||null,cfg.name,description,amount,method,paidTo||null,reference||null),
      env.DB.prepare(`INSERT INTO journal_entries
        (id,shop_id,entry_no,entry_date,reference_type,reference_id,description,status)
        SELECT ?,?,?,?,?,?,?,'posted' WHERE EXISTS(SELECT 1 FROM expenses WHERE id=? AND shop_id=?)`).bind(journalId,user.shopId,entryNo,date,"expense",id,cfg.name+" · "+description,id,user.shopId),
      env.DB.prepare(`INSERT INTO journal_lines (id,journal_entry_id,account_id,party_id,debit,credit)
        SELECT ?,?,?,NULL,?,0 WHERE EXISTS(SELECT 1 FROM journal_entries WHERE id=? AND shop_id=? AND status='posted')`).bind(crypto.randomUUID(),journalId,expenseAccount.id,amount,journalId,user.shopId),
      env.DB.prepare(`INSERT INTO journal_lines (id,journal_entry_id,account_id,party_id,debit,credit)
        SELECT ?,?,?,NULL,0,? WHERE EXISTS(SELECT 1 FROM journal_entries WHERE id=? AND shop_id=? AND status='posted')`).bind(crypto.randomUUID(),journalId,cashAccount.id,amount,journalId,user.shopId),
      env.DB.prepare(`INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values)
        SELECT ?,?,?, 'create','expense',?,NULL,? WHERE EXISTS(SELECT 1 FROM expenses WHERE id=? AND shop_id=?)`).bind(crypto.randomUUID(),user.shopId,user.id,id,JSON.stringify({expenseNo,date,category:cfg.name,description,amount,method,dealId:dealId||null,journalEntryNo:entryNo}),id,user.shopId)
    ];
    const result=await env.DB.batch(statements);
    if(!result?.[0]?.meta?.changes)return json({ok:false,error:"खर्च सेव नहीं हुआ। Refresh करके जाँचें।"},409);
    return json({ok:true,expense:{id,expense_no:expenseNo,amount,journal_entry_no:entryNo}},201);
  }catch(e){console.error("Expenses POST failed:",e);return json({ok:false,error:"खर्च सेव नहीं हुआ।",detail:String(e?.message||e).slice(0,450)},500);}
}
