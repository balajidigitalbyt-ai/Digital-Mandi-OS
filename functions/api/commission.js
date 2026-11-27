import { getSession, json } from "../_lib/auth.js";

const clean = (v, max = 120) => String(v ?? "").trim().slice(0, max);
const round2 = n => Number((Number(n) || 0).toFixed(2));

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "Login required." }, 401);
  try {
    const [millers, rules, pending, calculations] = await Promise.all([
      env.DB.prepare("SELECT id,name FROM parties WHERE shop_id=? AND active=1 AND party_type IN ('miller','both') ORDER BY name LIMIT 500").bind(user.shopId).all(),
      env.DB.prepare(`SELECT r.id,r.miller_id,p.name AS miller_name,r.rule_name,r.fixed_rate_per_quintal,
        r.percentage_rate,r.weight_basis,r.percentage_basis,r.active,r.effective_from,r.effective_to,r.created_at
        FROM commission_rules r JOIN parties p ON p.id=r.miller_id AND p.shop_id=r.shop_id
        WHERE r.shop_id=? ORDER BY r.active DESC,r.created_at DESC LIMIT 500`).bind(user.shopId).all(),
      env.DB.prepare(`SELECT d.id AS deal_id,d.deal_no,d.deal_date,d.miller_id,p.name AS miller_name,
        c.name AS crop_name,COALESCE(sa.sale_amount,0) AS sale_amount,
        COALESCE(ds.dispatch_weight,0) AS dispatch_weight,
        COALESCE(ds.accepted_weight,0) AS accepted_weight,
        COALESCE(pa.purchase_amount,0) AS purchase_amount
        FROM deals d
        JOIN parties p ON p.id=d.miller_id AND p.shop_id=d.shop_id
        JOIN crops c ON c.id=d.crop_id AND c.shop_id=d.shop_id
        JOIN (SELECT deal_id,SUM(gross_amount) AS sale_amount FROM sales GROUP BY deal_id) sa ON sa.deal_id=d.id
        LEFT JOIN (SELECT deal_id,SUM(dispatch_weight) AS dispatch_weight,SUM(accepted_weight) AS accepted_weight
          FROM dispatches WHERE shop_id=? GROUP BY deal_id) ds ON ds.deal_id=d.id
        LEFT JOIN (SELECT deal_id,SUM(total_amount) AS purchase_amount FROM purchases GROUP BY deal_id) pa ON pa.deal_id=d.id
        WHERE d.shop_id=? AND d.deal_type='commission'
          AND NOT EXISTS (SELECT 1 FROM commission_calculations cc WHERE cc.deal_id=d.id AND cc.shop_id=d.shop_id)
        ORDER BY d.deal_date DESC,d.created_at DESC LIMIT 200`).bind(user.shopId,user.shopId).all(),
      env.DB.prepare(`SELECT cc.id,cc.deal_id,d.deal_no,d.deal_date,p.name AS miller_name,c.name AS crop_name,
        cc.weight_quintals,cc.fixed_rate_per_quintal,cc.fixed_commission,cc.percentage_rate,
        cc.percentage_base_amount,cc.percentage_commission,cc.total_commission,
        cc.calculation_snapshot,cc.calculated_at,
        je.entry_no AS journal_entry_no,je.status AS journal_status
        FROM commission_calculations cc
        LEFT JOIN journal_entries je ON je.reference_type='commission_calculation' AND je.reference_id=cc.id AND je.shop_id=cc.shop_id
        JOIN deals d ON d.id=cc.deal_id AND d.shop_id=cc.shop_id
        JOIN parties p ON p.id=d.miller_id AND p.shop_id=d.shop_id
        JOIN crops c ON c.id=d.crop_id AND c.shop_id=d.shop_id
        WHERE cc.shop_id=? ORDER BY cc.calculated_at DESC LIMIT 200`).bind(user.shopId).all()
    ]);
    return json({ok:true,millers:millers.results??[],rules:rules.results??[],pending:pending.results??[],calculations:calculations.results??[]});
  } catch {
    return json({ok:false,error:"कमीशन डेटा लोड नहीं हुआ। लाइव D1 schema की जाँच जरूरी है।"},503);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ok:false,error:"Login required."},401);
  let body;
  try { body = await request.json(); } catch { return json({ok:false,error:"Invalid request."},400); }

  if (body.action === "save_rule") {
    const millerId=clean(body.millerId,80), ruleName=clean(body.ruleName,80)||"Default";
    const fixed=Number(body.fixedRatePerQuintal||0), percentage=Number(body.percentageRate||0);
    const weightBasis=clean(body.weightBasis,20), percentageBasis=clean(body.percentageBasis,30);
    const effectiveFrom=clean(body.effectiveFrom,10)||null;
    if(!millerId||!Number.isFinite(fixed)||fixed<0||!Number.isFinite(percentage)||percentage<0||
      fixed+percentage<=0||!["dispatch","accepted","custom"].includes(weightBasis)||
      !["sale_amount","purchase_amount","custom_amount"].includes(percentageBasis)||
      (effectiveFrom&&!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom))) {
      return json({ok:false,error:"मिलर, कमीशन दर और नियम सही भरें। कम से कम एक कमीशन दर शून्य से अधिक होनी चाहिए।"},400);
    }
    try {
      const miller=await env.DB.prepare("SELECT id FROM parties WHERE id=? AND shop_id=? AND active=1 AND party_type IN ('miller','both')").bind(millerId,user.shopId).first();
      if(!miller)return json({ok:false,error:"चुना गया मिलर उपलब्ध नहीं है।"},400);
      const id=crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("UPDATE commission_rules SET active=0,effective_to=COALESCE(effective_to,DATE('now')) WHERE shop_id=? AND miller_id=? AND active=1").bind(user.shopId,millerId),
        env.DB.prepare("INSERT INTO commission_rules (id,shop_id,miller_id,rule_name,fixed_rate_per_quintal,percentage_rate,weight_basis,percentage_basis,active,effective_from) VALUES (?,?,?,?,?,?,?,?,1,?)").bind(id,user.shopId,millerId,ruleName,fixed,percentage,weightBasis,percentageBasis,effectiveFrom),
        env.DB.prepare("INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values) VALUES (?,?,?,'create','commission_rule',?,NULL,?)").bind(crypto.randomUUID(),user.shopId,user.id,id,JSON.stringify({millerId,ruleName,fixed,percentage,weightBasis,percentageBasis,effectiveFrom}))
      ]);
      return json({ok:true,rule:{id,miller_id:millerId,rule_name:ruleName,fixed_rate_per_quintal:fixed,percentage_rate:percentage,weight_basis:weightBasis,percentage_basis:percentageBasis,active:1,effective_from:effectiveFrom}},201);
    } catch {
      return json({ok:false,error:"कमीशन नियम सेव नहीं हुआ। Database schema की जाँच जरूरी है।"},503);
    }
  }

  if (body.action === "calculate") {
    const dealId=clean(body.dealId,80), ruleId=clean(body.ruleId,80);
    const customWeight=Number(body.customWeight), customAmount=Number(body.customAmount);
    const customWeightReason=clean(body.customWeightReason,250);
    if(!dealId||!ruleId)return json({ok:false,error:"डील और कमीशन नियम चुनें।"},400);
    try {
      const [deal,rule,existing]=await Promise.all([
        env.DB.prepare(`SELECT d.id,d.deal_no,d.deal_type,d.miller_id,p.name AS miller_name,c.name AS crop_name
          FROM deals d JOIN parties p ON p.id=d.miller_id AND p.shop_id=d.shop_id
          JOIN crops c ON c.id=d.crop_id AND c.shop_id=d.shop_id
          WHERE d.id=? AND d.shop_id=?`).bind(dealId,user.shopId).first(),
        env.DB.prepare("SELECT * FROM commission_rules WHERE id=? AND shop_id=? AND active=1").bind(ruleId,user.shopId).first(),
        env.DB.prepare("SELECT id FROM commission_calculations WHERE deal_id=? AND shop_id=? LIMIT 1").bind(dealId,user.shopId).first()
      ]);
      if(!deal||deal.deal_type!=="commission")return json({ok:false,error:"यह कमीशन मॉडल की वैध डील नहीं है।"},400);
      if(!rule||rule.miller_id!==deal.miller_id)return json({ok:false,error:"इस मिलर के लिए सक्रिय कमीशन नियम चुनें।"},400);
      if(existing)return json({ok:false,error:"इस डील का कमीशन पहले ही calculate हो चुका है। पुराने रिकॉर्ड को बदलने के बजाय correction entry बनानी होगी।"},409);
      const [weights,sale,purchase]=await Promise.all([
        env.DB.prepare("SELECT COALESCE(SUM(dispatch_weight),0) AS dispatch_q,COALESCE(SUM(accepted_weight),0) AS accepted_q FROM dispatches WHERE shop_id=? AND deal_id=?").bind(user.shopId,dealId).first(),
        env.DB.prepare("SELECT COALESCE(SUM(gross_amount),0) AS amount FROM sales s JOIN deals d ON d.id=s.deal_id WHERE d.shop_id=? AND s.deal_id=?").bind(user.shopId,dealId).first(),
        env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) AS amount FROM purchases WHERE shop_id=? AND deal_id=?").bind(user.shopId,dealId).first()
      ]);
      let weightQ=rule.weight_basis==="dispatch"?Number(weights?.dispatch_q||0):rule.weight_basis==="accepted"?Number(weights?.accepted_q||0):customWeight;
      if(rule.weight_basis==="custom"&&(!Number.isFinite(weightQ)||weightQ<=0||!customWeightReason))return json({ok:false,error:"Custom वजन के लिए सही क्विंटल और कारण दर्ज करें।"},400);
      if(rule.weight_basis!=="custom"&&weightQ<=0)return json({ok:false,error:"इस डील का चुने गए आधार पर वजन उपलब्ध नहीं है।"},400);
      let base=rule.percentage_basis==="sale_amount"?Number(sale?.amount||0):rule.percentage_basis==="purchase_amount"?Number(purchase?.amount||0):customAmount;
      if(rule.percentage_rate>0&&rule.percentage_basis==="custom_amount"&&(!Number.isFinite(base)||base<=0))return json({ok:false,error:"Custom percentage base amount दर्ज करें।"},400);
      if(rule.percentage_rate>0&&base<=0)return json({ok:false,error:"प्रतिशत कमीशन के लिए आधार रकम उपलब्ध नहीं है।"},400);
      const fixed=round2(weightQ*Number(rule.fixed_rate_per_quintal||0));
      const percentage=round2(base*Number(rule.percentage_rate||0)/100);
      const total=round2(fixed+percentage);
      const id=crypto.randomUUID();
      const snapshot={dealNo:deal.deal_no,millerId:deal.miller_id,millerName:deal.miller_name,crop:deal.crop_name,
        ruleId:rule.id,ruleName:rule.rule_name,weightBasis:rule.weight_basis,weightQuintals:round2(weightQ),
        fixedRatePerQuintal:Number(rule.fixed_rate_per_quintal),fixedCommission:fixed,
        percentageBasis:rule.percentage_basis,percentageRate:Number(rule.percentage_rate),
        percentageBaseAmount:round2(base),percentageCommission:percentage,totalCommission:total,
        customWeightReason:rule.weight_basis==="custom"?customWeightReason:null,calculatedBy:user.id};
      // Ensure the shop-level control accounts exist before posting the commission journal.
      await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO ledger_accounts
          (id,shop_id,account_code,account_name,account_type,system_account,active)
          VALUES (?,?,?,'Miller Commission Receivable','asset',1,1)`).bind(crypto.randomUUID(),user.shopId,"1105"),
        env.DB.prepare(`INSERT OR IGNORE INTO ledger_accounts
          (id,shop_id,account_code,account_name,account_type,system_account,active)
          VALUES (?,?,?,'Commission Income','income',1,1)`).bind(crypto.randomUUID(),user.shopId,"4105")
      ]);
      const [receivableAccount,incomeAccount]=await Promise.all([
        env.DB.prepare("SELECT id,account_type FROM ledger_accounts WHERE shop_id=? AND account_code=? AND active=1").bind(user.shopId,"1105").first(),
        env.DB.prepare("SELECT id,account_type FROM ledger_accounts WHERE shop_id=? AND account_code=? AND active=1").bind(user.shopId,"4105").first()
      ]);
      if(!receivableAccount||receivableAccount.account_type!=="asset"||!incomeAccount||incomeAccount.account_type!=="income"){
        return json({ok:false,error:"कमीशन के Ledger Control Accounts सही उपलब्ध नहीं हैं। कोई कमीशन या Journal पोस्ट नहीं हुआ।"},503);
      }
      const journalId=crypto.randomUUID();
      const journalNo="CM-"+deal.deal_no+"-"+journalId.slice(0,6).toUpperCase();
      const narration="Miller commission receivable — "+deal.deal_no;
      const results = await env.DB.batch([
        env.DB.prepare(`INSERT INTO commission_calculations
          (id,shop_id,deal_id,commission_rule_id,weight_quintals,fixed_rate_per_quintal,fixed_commission,
           percentage_rate,percentage_base_amount,percentage_commission,total_commission,calculation_snapshot,calculated_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP
          WHERE NOT EXISTS (SELECT 1 FROM commission_calculations WHERE shop_id=? AND deal_id=?)`).bind(id,user.shopId,dealId,rule.id,round2(weightQ),
            Number(rule.fixed_rate_per_quintal),fixed,Number(rule.percentage_rate),round2(base),percentage,total,JSON.stringify(snapshot),user.shopId,dealId),
        env.DB.prepare(`INSERT INTO journal_entries
          (id,shop_id,entry_no,entry_date,reference_type,reference_id,description,status)
          SELECT ?,?,?,?,?,?,?,'posted'
          WHERE EXISTS (SELECT 1 FROM commission_calculations WHERE id=? AND shop_id=?)
            AND NOT EXISTS (SELECT 1 FROM journal_entries WHERE shop_id=? AND reference_type='commission_calculation' AND reference_id=?)`)
          .bind(journalId,user.shopId,journalNo,new Date().toISOString().slice(0,10),"commission_calculation",id,narration,id,user.shopId,user.shopId,id),
        env.DB.prepare(`INSERT INTO journal_lines (id,journal_entry_id,account_id,party_id,debit,credit)
          SELECT ?,?,?,?, ?,0 WHERE EXISTS (SELECT 1 FROM journal_entries WHERE id=? AND shop_id=? AND status='posted')`)
          .bind(crypto.randomUUID(),journalId,receivableAccount.id,deal.miller_id,total,journalId,user.shopId),
        env.DB.prepare(`INSERT INTO journal_lines (id,journal_entry_id,account_id,party_id,debit,credit)
          SELECT ?,?,?,NULL,0,? WHERE EXISTS (SELECT 1 FROM journal_entries WHERE id=? AND shop_id=? AND status='posted')`)
          .bind(crypto.randomUUID(),journalId,incomeAccount.id,total,journalId,user.shopId),
        env.DB.prepare(`INSERT INTO audit_logs (id,shop_id,user_id,action,entity_type,entity_id,old_values,new_values)
          VALUES (?,?,?,'create','commission_calculation',?,NULL,?)`)
          .bind(crypto.randomUUID(),user.shopId,user.id,id,JSON.stringify({...snapshot,journalEntryNo:journalNo,posting:"posted"}))
      ]);
      if(!results?.[0]?.meta?.changes)return json({ok:false,error:"इस डील का कमीशन पहले ही calculate हो चुका है। दोबारा सेव नहीं किया गया।"},409);
      if(!results?.[1]?.meta?.changes||!results?.[2]?.meta?.changes||!results?.[3]?.meta?.changes){
        return json({ok:false,error:"Commission calculation या balanced journal posting पूरी नहीं हुई। आगे कोई नई entry न करें; रिकॉर्ड की जाँच जरूरी है।"},503);
      }
      return json({ok:true,calculation:{id,deal_id:dealId,deal_no:deal.deal_no,miller_name:deal.miller_name,
        weight_quintals:round2(weightQ),fixed_rate_per_quintal:Number(rule.fixed_rate_per_quintal),
        fixed_commission:fixed,percentage_rate:Number(rule.percentage_rate),percentage_base_amount:round2(base),
        percentage_commission:percentage,total_commission:total,calculation_snapshot:JSON.stringify(snapshot),journal_entry_no:journalNo,journal_status:"posted"}},201);
    } catch {
      return json({ok:false,error:"कमीशन calculate नहीं हुआ। रिकॉर्ड सेव नहीं हुआ; live D1 schema की जाँच जरूरी है।"},503);
    }
  }
  return json({ok:false,error:"Unknown action."},400);
}
