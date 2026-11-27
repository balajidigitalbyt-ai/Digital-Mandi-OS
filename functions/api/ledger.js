import { getSession, json } from "../_lib/auth.js";

export async function onRequestGet({request,env}){
 const user=await getSession(request,env);
 if(!user)return json({ok:false,error:"Login required."},401);
 try{
  const [accounts,parties,unbalanced,totals]=await Promise.all([
   env.DB.prepare(`SELECT a.id,a.account_code,a.account_name,a.account_type,a.opening_balance,a.balance_side,
    COALESCE(SUM(CASE WHEN je.status='posted' THEN jl.debit ELSE 0 END),0) AS debit,
    COALESCE(SUM(CASE WHEN je.status='posted' THEN jl.credit ELSE 0 END),0) AS credit,
    CASE WHEN a.account_type IN ('asset','expense')
      THEN COALESCE(a.opening_balance,0)+COALESCE(SUM(CASE WHEN je.status='posted' THEN jl.debit-jl.credit ELSE 0 END),0)
      ELSE COALESCE(a.opening_balance,0)+COALESCE(SUM(CASE WHEN je.status='posted' THEN jl.credit-jl.debit ELSE 0 END),0) END AS balance
    FROM ledger_accounts a
    LEFT JOIN journal_lines jl ON jl.account_id=a.id
    LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id AND je.shop_id=a.shop_id
    WHERE a.shop_id=? AND a.active=1
    GROUP BY a.id,a.account_code,a.account_name,a.account_type,a.opening_balance,a.balance_side
    ORDER BY a.account_code`).bind(user.shopId).all(),
   env.DB.prepare(`SELECT p.id AS party_id,p.name AS party_name,p.party_type,
    COALESCE(SUM(jl.debit),0) AS debit,COALESCE(SUM(jl.credit),0) AS credit,
    COALESCE(SUM(jl.debit)-SUM(jl.credit),0) AS balance
    FROM parties p JOIN journal_lines jl ON jl.party_id=p.id
    JOIN journal_entries je ON je.id=jl.journal_entry_id AND je.shop_id=p.shop_id AND je.status='posted'
    WHERE p.shop_id=? GROUP BY p.id,p.name,p.party_type ORDER BY p.name`).bind(user.shopId).all(),
   env.DB.prepare(`SELECT je.id,je.entry_no,je.entry_date,je.description,
    COALESCE(SUM(jl.debit),0) AS debit,COALESCE(SUM(jl.credit),0) AS credit,COUNT(jl.id) AS line_count
    FROM journal_entries je LEFT JOIN journal_lines jl ON jl.journal_entry_id=je.id
    WHERE je.shop_id=? AND je.status='posted'
    GROUP BY je.id,je.entry_no,je.entry_date,je.description
    ORDER BY je.entry_date DESC LIMIT 500`).bind(user.shopId).all(),
   env.DB.prepare(`SELECT COALESCE(SUM(jl.debit),0) AS debit,COALESCE(SUM(jl.credit),0) AS credit
    FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id
    WHERE je.shop_id=? AND je.status='posted'`).bind(user.shopId).first()
  ]);
  const unbalancedEntries=(unbalanced.results||[]).filter(entry=>Math.round(Math.abs(Number(entry.debit||0)-Number(entry.credit||0))*100)/100>0||Number(entry.line_count||0)<2);
  return json({ok:true,accounts:accounts.results||[],parties:parties.results||[],unbalanced:unbalancedEntries,totals:{debit:Number(totals?.debit||0),credit:Number(totals?.credit||0)}});
 }catch(e){console.error("Ledger GET failed:",e);return json({ok:false,error:"Ledger डेटा लोड नहीं हुआ।",detail:String(e?.message||e).slice(0,400)},503);}
}
