import { getSession, json } from "../_lib/auth.js";

const TABLES = {
  shops: ["id","name","owner_name","phone","address","created_at"],
  users: ["id","shop_id","name","email","password_hash","role","active","created_at"],
  parties: ["id","shop_id","party_type","name","village","mobile","address","opening_balance","balance_side","notes","active","created_at"],
  crops: ["id","shop_id","name","active"],
  deals: ["id","shop_id","deal_no","deal_type","crop_id","farmer_id","miller_id","variety","deal_date","status","notes","created_by","created_at"],
  weighments: ["id","shop_id","deal_id","party_id","crop_id","weighment_type","weight_quintals","vehicle_number","measured_at","notes","created_at"],
  purchases: ["id","shop_id","deal_id","farmer_id","crop_id","purchase_date","bags","gross_weight","tare_weight","net_weight","purchase_rate","total_amount","deduction_amount","payable_amount","paid_amount","balance_amount","purchase_mode","notes","created_at"],
  sales: ["id","deal_id","miller_id","crop_id","quantity_kg","rate_per_quintal","gross_amount","created_at"],
  commission_rules: ["id","shop_id","miller_id","rule_name","fixed_rate_per_quintal","percentage_rate","weight_basis","percentage_basis","active","effective_from","effective_to","created_at"],
  commission_calculations: ["id","shop_id","deal_id","commission_rule_id","weight_quintals","fixed_rate_per_quintal","fixed_commission","percentage_rate","percentage_base_amount","percentage_commission","total_commission","calculation_snapshot","calculated_at","created_at"],
  stock_lots: ["id","shop_id","deal_id","crop_id","owner_type","owner_party_id","quantity_kg","available_kg","location","status","created_at"],
  dispatches: ["id","shop_id","deal_id","sale_id","miller_id","crop_id","dispatch_date","vehicle_number","driver_name","driver_mobile","bags","dispatch_weight","accepted_weight","weight_difference","status","notes","created_at"],
  receipts: ["id","shop_id","deal_id","miller_id","receipt_no","receipt_date","amount","payment_method","transaction_reference","notes","created_at"],
  slips: ["id","shop_id","slip_no","slip_type","deal_id","party_id","snapshot_json","version","status","created_by","created_at"],
  payments: ["id","shop_id","party_id","deal_id","payment_no","payment_date","payment_type","amount","payment_method","transaction_reference","status","notes","created_at"],
  ledger_accounts: ["id","shop_id","account_code","account_name","account_type","parent_account_id","opening_balance","balance_side","system_account","active","created_at"],
  journal_entries: ["id","shop_id","entry_no","entry_date","reference_type","reference_id","description","status","reversed_entry_id","created_at"],
  journal_lines: ["journal_entry_id","account_id","party_id","debit","credit"],
  expenses: ["id","shop_id","expense_no","expense_date","account_id","deal_id","expense_category","description","amount","payment_method","paid_to","transaction_reference","created_at"],
  audit_logs: ["id","shop_id","user_id","action","entity_type","entity_id","old_values","new_values","ip_address","created_at"]
};
const ORDER = ["shops","users","parties","crops","ledger_accounts","deals","commission_rules","purchases","weighments","sales","commission_calculations","stock_lots","dispatches","receipts","slips","payments","journal_entries","expenses","journal_lines","audit_logs"];
const SHOP_TABLES = ORDER.filter(t => !["shops","sales","journal_lines"].includes(t));
async function collect(env, shopId) {
  const out = {};
  for (const table of ORDER) {
    let sql;
    if (table === "shops") sql = "SELECT * FROM shops WHERE id=?";
    else if (table === "sales") sql = "SELECT s.* FROM sales s JOIN deals d ON d.id=s.deal_id WHERE d.shop_id=?";
    else if (table === "journal_lines") sql = "SELECT jl.* FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_entry_id WHERE je.shop_id=?";
    else sql = `SELECT * FROM ${table} WHERE shop_id=?`;
    const result = await env.DB.prepare(sql).bind(shopId).all();
    out[table] = result.results || [];
  }
  return out;
}
export async function onRequestGet({request,env}) {
  const user=await getSession(request,env);
  if(!user)return json({ok:false,error:"Login required."},401);
  try {
    const tables=await collect(env,user.shopId);
    return json({ok:true,backup:{app:"Digital Mandi OS",formatVersion:1,createdAt:new Date().toISOString(),shopId:user.shopId,tables}});
  } catch(e) {
    console.error("Backup export failed:",e);
    return json({ok:false,error:"Backup तैयार नहीं हुआ।",detail:String(e?.message||e).slice(0,300)},503);
  }
}
export async function onRequestPost({request,env}) {
  const user=await getSession(request,env);
  if(!user)return json({ok:false,error:"Login required."},401);
  try {
    const raw=await request.text();
    if(raw.length>8*1024*1024)return json({ok:false,error:"Backup file 8 MB से बड़ी है।"},413);
    let payload;try{payload=JSON.parse(raw);}catch{return json({ok:false,error:"यह सही JSON backup file नहीं है।"},400);}
    const backup=payload?.backup||payload;
    if(backup?.app!=="Digital Mandi OS"||backup?.formatVersion!==1||backup?.shopId!==user.shopId||!backup?.tables||typeof backup.tables!=="object")
      return json({ok:false,error:"Backup format या दुकान ID मेल नहीं खाती। इसी दुकान का Digital Mandi OS backup चुनें।"},400);
    const rowsByTable=backup.tables;
    let totalRows=0;
    for(const table of ORDER){
      if(!Array.isArray(rowsByTable[table]))return json({ok:false,error:`Backup में ${table} डेटा नहीं मिला।`},400);
      totalRows+=rowsByTable[table].length;
      if(rowsByTable[table].length>10000)return json({ok:false,error:`${table} में बहुत अधिक रिकॉर्ड हैं।`},413);
      if(totalRows>5000)return json({ok:false,error:"Backup में 5,000 से अधिक रिकॉर्ड हैं। छोटे भागों में Restore की सुविधा अभी उपलब्ध नहीं है।"},413);
      for(const row of rowsByTable[table]){
        if(!row||typeof row!=="object"||Array.isArray(row))return json({ok:false,error:`${table} का रिकॉर्ड सही नहीं है।`},400);
        const allowed=new Set(TABLES[table]);
        if(Object.keys(row).some(k=>!allowed.has(k)))return json({ok:false,error:`${table} में अनजान कॉलम मिला।`},400);
        if(table==="journal_lines"){if(!row.journal_entry_id||!row.account_id||row.debit===undefined||row.credit===undefined)return json({ok:false,error:"journal_lines में जरूरी Ledger विवरण अधूरा है।"},400);}
        else if(!row.id)return json({ok:false,error:`${table} में ID वाला रिकॉर्ड नहीं है।`},400);
        if(table==="shops"&&row.id!==user.shopId)return json({ok:false,error:"दूसरी दुकान का Backup Restore नहीं किया जा सकता।"},403);
        if(SHOP_TABLES.includes(table)&&row.shop_id!==user.shopId)return json({ok:false,error:"दूसरी दुकान का डेटा इस खाते में Restore नहीं किया जा सकता।"},403);
      }
    }
    // Additive, idempotent restore: existing rows are never overwritten or deleted.
    const statements=[];
    for(const table of ORDER){
      const cols=TABLES[table];
      for(const row of rowsByTable[table]){
        const values=cols.map(c=>row[c]===undefined?null:row[c]);
        const placeholders=cols.map(()=>"?").join(",");
        if(table==="journal_lines"){
          statements.push(env.DB.prepare(`INSERT INTO journal_lines (${cols.join(",")}) SELECT ${placeholders} WHERE NOT EXISTS (SELECT 1 FROM journal_lines WHERE journal_entry_id=? AND account_id=? AND party_id IS ? AND debit=? AND credit=?)`).bind(...values,row.journal_entry_id,row.account_id,row.party_id??null,row.debit,row.credit));
        }else{
          statements.push(env.DB.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`).bind(...values));
        }
      }
    }
    let inserted=0;
    for(let i=0;i<statements.length;i+=50){
      const batchResult=await env.DB.batch(statements.slice(i,i+50));
      inserted+=batchResult.reduce((n,r)=>n+Number(r?.meta?.changes||0),0);
    }
    return json({ok:true,inserted,total:statements.length,message:"Restore merge पूरा हुआ। मौजूदा रिकॉर्ड बदले या डिलीट नहीं किए गए।"});
  } catch(e) {
    console.error("Backup restore failed:",e);
    return json({ok:false,error:"Restore पूरा नहीं हुआ।",detail:String(e?.message||e).slice(0,400)},500);
  }
}
