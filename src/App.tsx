import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Bell, BookOpen, Boxes, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Command, CreditCard, Download, FilePlus2, FileText, Filter, Home, IndianRupee, Leaf, Menu, MoreHorizontal, PackageCheck, Plus, Printer, Search, Settings2, ShieldCheck, Sprout, Truck, Users, Wheat, X } from 'lucide-react';

type Section = 'Overview'|'Farmers'|'Millers'|'Purchase'|'Stock'|'Sales & Dispatch'|'Payments'|'Ledger'|'Commission'|'Slip Center'|'Reports';
const nav:{label:Section;icon:any;group:string}[]=[
 {label:'Overview',icon:Home,group:'WORKSPACE'},
 {label:'Farmers',icon:Users,group:'PARTIES'},{label:'Millers',icon:Users,group:'PARTIES'},
 {label:'Purchase',icon:ArrowDownLeft,group:'OPERATIONS'},{label:'Stock',icon:Boxes,group:'OPERATIONS'},{label:'Sales & Dispatch',icon:Truck,group:'OPERATIONS'},
 {label:'Payments',icon:CreditCard,group:'ACCOUNTS'},{label:'Ledger',icon:BookOpen,group:'ACCOUNTS'},{label:'Commission',icon:IndianRupee,group:'ACCOUNTS'},
 {label:'Slip Center',icon:FileText,group:'DOCUMENTS'},{label:'Reports',icon:BarChart3,group:'INSIGHTS'}
];
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
type AuthUser = { id:string; shopId:string; name:string; email:string; role:string };
function App(){
 const [authMode,setAuthMode]=useState<'loading'|'setup'|'login'|'ready'>('loading');
 const [authUser,setAuthUser]=useState<AuthUser|null>(null);
 useEffect(()=>{let alive=true;(async()=>{try{const me=await fetch('/api/auth/me');if(me.ok){const d=await me.json();if(alive){setAuthUser(d.user);setAuthMode('ready');}return;}const sr=await fetch('/api/setup-status');const s=await sr.json();if(alive)setAuthMode(s.needsOwnerSetup?'setup':'login');}catch{if(alive)setAuthMode('login');}})();return()=>{alive=false;};},[]);
 if(authMode!=='ready'||!authUser) return <AuthGate mode={authMode==='setup'?'setup':'login'} onAuth={u=>{setAuthUser(u);setAuthMode('ready');}}/>;
 return <Dashboard authUser={authUser}/>;
}
function Dashboard({authUser}:{authUser:AuthUser}){
 const [section,setSection]=useState<Section>('Overview'); const [mobileOpen,setMobileOpen]=useState(false);
 const [slipType,setSlipType]=useState<'farmer'|'miller'>('farmer'); const [toast,setToast]=useState('');
 const notify=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(''),2600)};
 const pageTitle=section==='Overview'?'नमस्कार, आज का कारोबार':section;
 const groups=[...new Set(nav.map(n=>n.group))];
 return <div className="shell">
  <aside className={'sidebar '+(mobileOpen?'open':'')}>
   <div className="brand"><div className="brand-mark"><Sprout size={23}/></div><div><b>Digital Mandi <span>OS</span></b><small>MANDI BUSINESS SUITE</small></div><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
   <div className="workspace"><div className="workspace-icon">BM</div><div><b>Balaji Mandi</b><small>मुख्य कारोबार</small></div><ChevronDown size={15}/></div>
   <div className="nav-scroll">{groups.map(g=><div className="nav-group" key={g}><label>{g}</label>{nav.filter(n=>n.group===g).map(n=><button key={n.label} className={'nav-link '+(section===n.label?'active':'')} onClick={()=>{setSection(n.label);setMobileOpen(false)}}><n.icon size={17}/><span>{n.label}</span>{n.label==='Slip Center'&&<i>2</i>}</button>)}</div>)}</div>
   <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={17}/><div><b>आपका डेटा सुरक्षित है</b><small>लोकल वर्कस्पेस · MVP</small></div></div><button className="nav-link" onClick={()=>notify('सेटिंग्स मॉड्यूल अगले चरण में आएगा')}><Settings2 size={17}/>Settings</button><div className="profile"><div className="avatar">DM</div><div><b>{authUser.name}</b><small>{authUser.role} · Admin</small></div><MoreHorizontal size={18}/></div></div>
  </aside>
  <main className="main">
   <header className="topbar"><button className="icon-btn menu-btn" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><div className="crumb">Balaji Mandi <ChevronRight size={14}/><b>{section}</b></div><div className="top-actions"><button className="btn-secondary compact" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.reload();}}>Logout</button><div className="date-pill"><CalendarDays size={15}/> शुक्रवार, 27 नवंबर 2026</div><button className="icon-btn" onClick={()=>notify('अभी कोई नई सूचना नहीं है')}><Bell size={18}/><em/></button><div className="top-avatar">DM</div></div></header>
   <div className="content">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> MANDI OPERATIONS · LIVE WORKSPACE</div><h1>{pageTitle}</h1><p>{section==='Overview'?'आज की खरीद, सप्लाई और हिसाब-किताब एक ही जगह।':section==='Slip Center'?'किसान और मिलर की पर्चियाँ बनाएँ, खोजें और प्रिंट करें।': 'अपने कारोबार का रिकॉर्ड और गतिविधियाँ यहाँ मैनेज करें।'}</p></div><div className="quick-actions"><button className="btn-secondary" onClick={()=>{setSlipType('farmer');setSection('Slip Center')}}><FilePlus2 size={16}/> किसान पर्ची</button><button className="btn-primary" onClick={()=>{setSlipType('miller');setSection('Slip Center')}}><Plus size={17}/> नई एंट्री</button></div></div>
    {section==='Overview'?<>
     <div className="hero-strip"><div className="hero-copy"><div className="hero-kicker"><Leaf size={14}/> TODAY AT A GLANCE</div><h2>कारोबार की हर चाल,<br/><span>अब आपके कंट्रोल में।</span></h2><p>खरीद से लेकर मिलर पेमेंट तक — हर एंट्री का पूरा हिसाब।</p><button onClick={()=>setSection('Purchase')}>आज की खरीद देखें <ChevronRight size={16}/></button></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="grain-icon"><Wheat size={68}/></div><div className="floating-tag tag-a"><span className="tag-dot green"/> धान <b>42.80 Q</b></div><div className="floating-tag tag-b"><span className="tag-dot gold"/> आज की एंट्री <b>08</b></div><div className="hero-grid"/></div><div className="hero-date"><span>27</span><small>NOV<br/>2026</small></div></div>
     <div className="section-heading"><div><h3>कारोबार का सारांश</h3><p>आज का वित्तीय और ऑपरेशनल स्नैपशॉट</p></div><button className="text-action" onClick={()=>setSection('Reports')}>पूरी रिपोर्ट <ChevronRight size={15}/></button></div>
     <div className="metrics"><Metric title="आज की खरीद" value="₹ 0" change="—" note="डेटा जुड़ने की प्रतीक्षा" icon={<ArrowDownLeft/>} tone="green"/><Metric title="मिलर सप्लाई" value="₹ 0" change="—" note="डेटा जुड़ने की प्रतीक्षा" icon={<Truck/>} tone="blue"/><Metric title="किसान भुगतान बाकी" value="₹ 0" change="0 किसान" note="कोई एंट्री नहीं" icon={<Users/>} tone="orange"/><Metric title="मिलर से लेना है" value="₹ 0" change="0 मिलर" note="कोई एंट्री नहीं" icon={<IndianRupee/>} tone="purple"/></div>
     <div className="lower-grid"><section className="panel activity-panel"><div className="panel-head"><div><h3>हाल की गतिविधियाँ</h3><p>आज के लेन-देन और एंट्री</p></div><button className="dots-btn" onClick={()=>setSection('Slip Center')}><MoreHorizontal/></button></div><div className="activity-list"><div className="empty">अभी कोई कारोबार एंट्री नहीं है। Purchase और Payment मॉड्यूल जुड़ने पर वास्तविक गतिविधियाँ यहाँ दिखेंगी।</div></div><button className="full-link" onClick={()=>setSection('Slip Center')}>सभी गतिविधियाँ देखें <ChevronRight size={15}/></button></section>
      <section className="panel crop-panel"><div className="panel-head"><div><h3>फसल के अनुसार स्टॉक</h3><p>कुल उपलब्ध वजन · क्विंटल</p></div><button className="dots-btn" onClick={()=>setSection('Stock')}><MoreHorizontal/></button></div><div className="stock-total"><b>0.00 <small>Q</small></b><span><i/> कुल स्टॉक</span></div><div className="crop-bars"><CropBar name="धान" amount="0.00 Q" percent={0} color="mint"/><CropBar name="गेहूँ" amount="0.00 Q" percent={0} color="bluebar"/><CropBar name="चना" amount="0.00 Q" percent={0} color="goldbar"/></div><div className="stock-foot"><span><span className="tiny-dot mint-bg"/> अपना स्टॉक <b>0.00 Q</b></span><span><span className="tiny-dot gold-bg"/> कमीशन स्टॉक <b>0.00 Q</b></span></div></section></div>
     <div className="bottom-grid"><section className="panel"><div className="panel-head"><div><h3>क्विक एक्सेस</h3><p>रोज़ के काम तुरंत शुरू करें</p></div></div><div className="quick-grid"><Quick icon={<Users/>} label="किसान जोड़ें" onClick={()=>setSection('Farmers')}/><Quick icon={<PackageCheck/>} label="खरीद एंट्री" onClick={()=>setSection('Purchase')}/><Quick icon={<FileText/>} label="किसान पर्ची" onClick={()=>{setSlipType('farmer');setSection('Slip Center')}}/><Quick icon={<FilePlus2/>} label="मिलर पर्ची" onClick={()=>{setSlipType('miller');setSection('Slip Center')}}/></div></section><section className="panel commission-panel"><div className="panel-head"><div><h3>कमीशन ट्रैकर</h3><p>मिलर से मिलने वाला कमीशन</p></div><span className="status-chip">इस माह</span></div><div className="commission-number">₹ 0 <span>—</span></div><div className="commission-track"><i/></div><div className="commission-meta"><span>अर्जित कमीशन</span><b>₹ 0 / ₹ 0</b></div><button className="full-link" onClick={()=>setSection('Commission')}>कमीशन का हिसाब देखें <ChevronRight size={15}/></button></section></div>
    </>:section==='Farmers'||section==='Millers'?<PartyModule type={section==='Farmers'?'farmer':'miller'}/>:section==='Purchase'?<PurchaseModule/>:section==='Stock'?<StockModule/>:section==='Sales & Dispatch'?<SalesDispatchModule/>:section==='Payments'?<PaymentsModule/>:section==='Ledger'?<LedgerModule/>:section==='Commission'?<CommissionModule/>:section==='Reports'?<OwnTradeReportModule/>:section==='Slip Center'?<SlipCenterModule initialType={slipType}/>:<section className="panel module-placeholder"><div className="placeholder-icon"><Command size={28}/></div><h2>{section} मॉड्यूल तैयार हो रहा है</h2><p>इस सेक्शन को अगले चरण में वास्तविक डेटा, फॉर्म और अकाउंटिंग लॉजिक से जोड़ा जाएगा। अभी Slip Center में किसान और मिलर पर्ची की एंट्री देख सकते हैं।</p><button className="btn-primary" onClick={()=>setSection('Slip Center')}>Slip Center खोलें <ChevronRight size={16}/></button></section>}
    <footer><span>© 2026 Digital Mandi OS</span><span><span className="live-dot"/> System preview · MVP foundation</span><span>Made for Indian Mandis <Leaf size={13}/></span></footer>
   </div>
  </main>
  {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
 </div>
}



function SlipCenterModule({initialType}:{initialType:'farmer'|'miller'}){
 const [type,setType]=useState<'farmer'|'miller'>(initialType);
 const [farmerSources,setFarmerSources]=useState<any[]>([]);const [millerSources,setMillerSources]=useState<any[]>([]);
 const [slips,setSlips]=useState<any[]>([]);const [selectedSource,setSelectedSource]=useState('');
 const [query,setQuery]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');const [success,setSuccess]=useState('');
 useEffect(()=>{setType(initialType);},[initialType]);
 const sources=type==='farmer'?farmerSources:millerSources;
 const filtered=useMemo(()=>slips.filter(x=>[x.slip_no,x.party_name,x.deal_no,x.slip_type].join(' ').toLowerCase().includes(query.toLowerCase())),[slips,query]);
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/slips');const d=await r.json();if(!r.ok)throw new Error(d.error||'पर्ची डेटा लोड नहीं हुआ');setFarmerSources(d.farmerSources||[]);setMillerSources(d.millerSources||[]);setSlips(d.slips||[]);}catch(e){setError(e instanceof Error?e.message:'पर्ची डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 useEffect(()=>{setSelectedSource(sources[0]?.source_id||'');},[type,farmerSources,millerSources]);
 const create=async()=>{if(!selectedSource){setError(type==='farmer'?'पहले किसान की खरीद चुनें।':'पहले मिलर का डिस्पैच चुनें।');return;}setSaving(true);setError('');setSuccess('');try{const r=await fetch('/api/slips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slipType:type,sourceId:selectedSource})});const d=await r.json();if(!r.ok)throw new Error([d.error||'पर्ची सेव नहीं हुई',d.detail].filter(Boolean).join(' — '));setSuccess('पर्ची D1 में सेव हो गई: '+d.slip.slip_no);await load();}catch(e){setError(e instanceof Error?e.message:'पर्ची सेव नहीं हुई');}finally{setSaving(false);}};
 const esc=(v:any)=>String(v??'—').replace(/[&<>"']/g,ch=>(({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as Record<string,string>)[ch]||ch));
 const snapshot=(row:any)=>{try{return JSON.parse(row.snapshot_json||'{}')}catch{return {}}};
 const printSlip=(row:any)=>{const x=snapshot(row);const fields=row.slip_type==='farmer'?
  [['किसान',x.party?.name],['गाँव',x.party?.village],['मोबाइल',x.party?.mobile],['फसल',x.crop],['बोरियाँ',x.bags],['सकल वजन (Q)',x.grossWeight],['बारदाना/कटौती वजन (Q)',x.tareWeight],['नेट वजन (Q)',x.netWeight],['रेट (₹/Q)',x.ratePerQuintal],['कुल रकम',x.grossAmount],['अन्य कटौती',x.deduction],['देय रकम',x.payable],['भुगतान',x.paid],['बाकी',x.balance],['व्यापार प्रकार',x.purchaseMode]]:
  [['मिलर',x.party?.name],['मोबाइल',x.party?.mobile],['फसल',x.crop],['गाड़ी नंबर',x.vehicleNumber],['ड्राइवर',x.driverName],['बोरियाँ',x.bags],['डिस्पैच वजन (Q)',x.dispatchWeight],['स्वीकृत वजन (Q)',x.acceptedWeight],['वजन अंतर (Q)',x.weightDifference],['बिक्री रेट (₹/Q)',x.ratePerQuintal],['बिक्री रकम',x.saleAmount],['कुल कमीशन',x.commission],['कमीशन प्राप्त',x.commissionPaid],['कमीशन बाकी',x.commissionBalance],['बिक्री वसूली',x.saleReceived],['बिक्री बाकी',x.saleBalance]];
  const w=window.open('','_blank','width=900,height=700');if(!w){setError('Print window खुल नहीं पाई। Browser में pop-up अनुमति दें।');return;}
  w.document.write('<!doctype html><html lang="hi"><meta charset="utf-8"><title>'+esc(x.title)+' '+esc(row.slip_no)+'</title><style>body{font-family:Arial,sans-serif;color:#17231e;padding:28px}h1{margin:0 0 6px;font-size:24px}.sub{color:#52645a;margin-bottom:22px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #273c30;padding-bottom:16px;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}.item{padding:10px 0;border-bottom:1px solid #dce4de;display:flex;justify-content:space-between;gap:12px}.item b{text-align:right}.foot{margin-top:30px;display:flex;justify-content:space-between}.muted{color:#65766c}</style><div class="head"><div><h1>Digital Mandi OS</h1><div class="sub">Balaji Mandi · '+esc(x.title)+'</div></div><div><b>'+esc(row.slip_no)+'</b><div class="muted">दिनांक: '+esc(x.date)+'</div><div class="muted">संस्करण: '+esc(row.version)+'</div></div></div><h2>'+esc(x.party?.name)+'</h2><div class="grid">'+fields.map(a=>'<div class="item"><span>'+esc(a[0])+'</span><b>'+esc(a[1])+'</b></div>').join('')+'</div><div class="foot"><span>प्राप्तकर्ता हस्ताक्षर: __________________</span><span>अधिकृत हस्ताक्षर: __________________</span></div><p class="muted">यह पर्ची सिस्टम में सुरक्षित मूल रिकॉर्ड के स्नैपशॉट से प्रिंट की गई है।</p>');
  w.document.close();w.focus();w.print();};
 const shareSlip=(row:any)=>{const x=snapshot(row);const text='Digital Mandi OS · '+x.title+'\nपर्ची: '+row.slip_no+'\nडील: '+(x.dealNo||'—')+'\nपार्टी: '+(x.party?.name||'—')+'\nफसल: '+(x.crop||'—')+'\n'+(row.slip_type==='farmer'?'नेट वजन: '+x.netWeight+' Q\nदेय: ₹'+x.payable:'स्वीकृत वजन: '+x.acceptedWeight+' Q\nबिक्री: ₹'+x.saleAmount+'\nकमीशन: ₹'+x.commission);const phone=String(x.party?.mobile||'').replace(/\D/g,'');window.open('https://wa.me/'+(phone.length>=10?phone.slice(-10):'')+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');};
 return <section className="panel slips-panel">
  <div className="party-head"><div><h2>Slip Center · स्थायी पर्ची रिकॉर्ड</h2><p>खरीद और डिस्पैच से सीधे D1 में पर्ची बनाएँ, खोजें और दोबारा प्रिंट करें।</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
  {error&&<div className="auth-error">{error}</div>}{success&&<div className="purchase-success"><Check size={16}/>{success}</div>}
  <div className="slip-tabs"><button className={type==='farmer'?'selected':''} onClick={()=>{setType('farmer');setError('');setSuccess('')}}>किसान पर्ची</button><button className={type==='miller'?'selected':''} onClick={()=>{setType('miller');setError('');setSuccess('')}}>मिलर पर्ची</button></div>
  <div className="purchase-form" style={{padding:'16px 0'}}>
   <label className="purchase-wide">{type==='farmer'?'किसान की खरीद चुनें':'मिलर का डिस्पैच चुनें'} *<select value={selectedSource} onChange={e=>setSelectedSource(e.target.value)}><option value="">रिकॉर्ड चुनें</option>{sources.map(x=><option key={x.source_id} value={x.source_id}>{x.deal_no} · {x.party_name} · {x.crop_name} · {x.document_date} · {type==='farmer'?'नेट '+Number(x.net_weight||0)+' Q':'स्वीकृत '+Number(x.accepted_weight||0)+' Q'}</option>)}</select></label>
   <div className="purchase-wide modal-note"><ShieldCheck size={16}/> पर्ची चुने गए वास्तविक रिकॉर्ड का snapshot लेकर बनेगी। जारी पर्ची का पुराना डेटा नहीं बदलेगा; दोबारा जारी करने पर नया संस्करण बनेगा।</div>
   <div className="purchase-wide party-form-actions"><button className="btn-primary" onClick={create} disabled={saving||!selectedSource}>{saving?'सेव हो रही है…':type==='farmer'?'किसान पर्ची बनाएँ':'मिलर पर्ची बनाएँ'}</button></div>
  </div>
  <div className="slip-tools"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="पर्ची नंबर, पार्टी या डील नंबर खोजें..."/></div><span className="status-chip">{filtered.length} रिकॉर्ड</span></div>
  <div className="table-wrap"><table><thead><tr><th>पर्ची नंबर</th><th>प्रकार</th><th>पार्टी</th><th>डील</th><th>तारीख</th><th>संस्करण</th><th>स्थिति</th><th>कार्य</th></tr></thead><tbody>
   {filtered.map(row=><tr key={row.id}><td className="id-cell">{row.slip_no}</td><td><span className={'type-pill '+(row.slip_type==='farmer'?'farmer':'miller')}>{row.slip_type==='farmer'?'किसान पर्ची':'मिलर पर्ची'}</span></td><td className="party-cell">{row.party_name}</td><td>{row.deal_no||'—'}</td><td>{String(row.created_at||'').slice(0,10)}</td><td>{row.version}</td><td><span className="status-text"><i/> {row.status}</span></td><td><div style={{display:'flex',gap:6}}><button className="btn-secondary compact" onClick={()=>printSlip(row)} title="Print"><Printer size={14}/></button><button className="btn-secondary compact" onClick={()=>shareSlip(row)} title="WhatsApp"><span>WA</span></button></div></td></tr>)}
  </tbody></table>{loading?<div className="empty">D1 से पर्चियाँ लोड हो रही हैं…</div>:filtered.length===0?<div className="empty">अभी इस खोज से कोई पर्ची नहीं मिली। ऊपर खरीद या डिस्पैच चुनकर नई पर्ची बनाएँ।</div>:null}</div>
  <p className="auth-hint">पर्ची रिकॉर्ड D1 में shop-scoped हैं। Print और WhatsApp शेयर उसी सेव किए गए snapshot से होते हैं; पर्ची दोबारा प्रिंट करने से नया रिकॉर्ड नहीं बनता।</p>
 </section>;
}

function PurchaseModule(){
 const [farmers,setFarmers]=useState<any[]>([]);const [crops,setCrops]=useState<any[]>([]);const [rows,setRows]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const [farmerId,setFarmerId]=useState('');const [cropId,setCropId]=useState('');const [mode,setMode]=useState<'commission'|'own_trade'>('commission');
 const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [bags,setBags]=useState('');const [gross,setGross]=useState('');const [tare,setTare]=useState('0');const [rate,setRate]=useState('');const [deduction,setDeduction]=useState('0');const [notes,setNotes]=useState('');
 const net=Math.max(0,(Number(gross)||0)-(Number(tare)||0));const total=net*(Number(rate)||0);const payable=Math.max(0,total-(Number(deduction)||0));
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/purchases');const d=await r.json();if(!r.ok)throw new Error(d.error||'खरीद सूची लोड नहीं हुई');setFarmers(d.farmers||[]);setCrops(d.crops||[]);setRows(d.purchases||[]);if(!cropId&&d.crops?.[0])setCropId(d.crops[0].id);}catch(e){setError(e instanceof Error?e.message:'डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setSuccess('');try{const r=await fetch('/api/purchases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({farmerId,cropId,mode,date,bags:Number(bags)||0,grossWeight:Number(gross),tareWeight:Number(tare)||0,rate:Number(rate),deduction:Number(deduction)||0,notes})});const d=await r.json();if(!r.ok)throw new Error(d.error||'खरीद सेव नहीं हुई');setRows(current=>[d.purchase,...current]);setSuccess('खरीद एंट्री सेव हो गई और स्टॉक अपडेट हो गया।');setBags('');setGross('');setTare('0');setRate('');setDeduction('0');setNotes('');}catch(e){setError(e instanceof Error?e.message:'खरीद सेव नहीं हुई');}finally{setSaving(false);}};
 return <section className="purchase-workspace"><div className="panel purchase-panel"><div className="party-head"><div><h2>नई खरीद एंट्री</h2><p>किसान से खरीदी गई फसल का वजन और भुगतान योग्य राशि दर्ज करें।</p></div><span className="status-chip">D1 DATABASE</span></div>
 {error&&<div className="auth-error">{error}</div>}{success&&<div className="purchase-success"><Check size={16}/>{success}</div>}
 <form className="purchase-form" onSubmit={save}>
 <label>खरीद का प्रकार<select value={mode} onChange={e=>setMode(e.target.value as 'commission'|'own_trade')}><option value="commission">कमीशन मॉडल · किसान का माल</option><option value="own_trade">अपना व्यापार · खुद की खरीद</option></select></label>
 <label>किसान *<select required value={farmerId} onChange={e=>setFarmerId(e.target.value)}><option value="">किसान चुनें</option>{farmers.map(p=><option key={p.id} value={p.id}>{p.name}{p.village?' · '+p.village:''}</option>)}</select></label>
 <label>फसल *<select required value={cropId} onChange={e=>setCropId(e.target.value)}><option value="">फसल चुनें</option>{crops.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>खरीद तारीख *<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>बोरियों की संख्या<input type="number" min="0" step="1" value={bags} onChange={e=>setBags(e.target.value)} placeholder="जैसे 120"/></label>
 <label>कुल वजन (क्विंटल) *<input required type="number" min="0.01" step="0.01" value={gross} onChange={e=>setGross(e.target.value)} placeholder="कुल वजन"/></label>
 <label>बारदाना / कटौती वजन (क्विंटल)<input type="number" min="0" step="0.01" value={tare} onChange={e=>setTare(e.target.value)}/></label>
 <label>खरीद रेट (₹ / क्विंटल) *<input required type="number" min="0.01" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} placeholder="रेट"/></label>
 <label>अन्य कटौती (₹)<input type="number" min="0" step="0.01" value={deduction} onChange={e=>setDeduction(e.target.value)}/></label>
 <label className="purchase-wide">नोट / विवरण<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="वैकल्पिक जानकारी"/></label>
 <div className="purchase-summary"><div><small>नेट वजन</small><b>{net.toFixed(2)} Q</b></div><div><small>कुल रकम</small><b>{money(total)}</b></div><div><small>किसान को देय</small><b className="payable">{money(payable)}</b></div></div>
 <div className="purchase-wide purchase-hint"><ShieldCheck size={15}/> कमीशन मॉडल में किसान की देय रकम से मिलर का कमीशन नहीं कटेगा। कमीशन अलग से मिलर के खाते में बनेगा।</div>
 <div className="purchase-wide purchase-actions"><button type="submit" className="btn-primary" disabled={saving||!farmers.length||!crops.length}>{saving?'सेव हो रहा है…':'खरीद सेव करें'}</button><span>सेव करने पर खरीद और स्टॉक रिकॉर्ड एक साथ बनेंगे।</span></div>
 </form></div>
 <div className="panel purchase-list"><div className="panel-head"><div><h3>हाल की खरीद</h3><p>कुल रिकॉर्ड: {rows.length}</p></div><button className="btn-secondary compact" onClick={load}>Refresh</button></div>
 <div className="table-wrap"><table><thead><tr><th>तारीख</th><th>किसान</th><th>फसल</th><th>प्रकार</th><th>नेट वजन</th><th>रेट</th><th>किसान को देय</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td>{p.purchase_date}</td><td className="party-cell">{p.farmer_name}</td><td>{p.crop_name}</td><td>{p.purchase_mode==='commission'?'कमीशन':'अपना व्यापार'}</td><td className="weight-cell">{Number(p.net_weight).toFixed(2)} Q</td><td>{money(Number(p.purchase_rate))}</td><td className="weight-cell">{money(Number(p.payable_amount))}</td></tr>)}</tbody></table>{loading?<div className="empty">खरीद सूची लोड हो रही है…</div>:rows.length===0?<div className="empty">अभी कोई खरीद एंट्री नहीं है। ऊपर से पहली एंट्री करें।</div>:null}</div></div></section>;
}



function SalesDispatchModule(){
 const [millers,setMillers]=useState<any[]>([]);const [lots,setLots]=useState<any[]>([]);const [sales,setSales]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const [stockLotId,setStockLotId]=useState('');const [millerId,setMillerId]=useState('');const [dispatchDate,setDispatchDate]=useState(new Date().toISOString().slice(0,10));
 const [dispatchWeight,setDispatchWeight]=useState('');const [acceptedWeight,setAcceptedWeight]=useState('');const [rate,setRate]=useState('');
 const [vehicleNumber,setVehicleNumber]=useState('');const [driverName,setDriverName]=useState('');const [driverMobile,setDriverMobile]=useState('');const [notes,setNotes]=useState('');
 const selected=lots.find(l=>l.id===stockLotId);
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/sales-dispatch');const d=await r.json();if(!r.ok)throw new Error(d.error||'बिक्री डेटा लोड नहीं हुआ');setMillers(d.millers||[]);setLots(d.lots||[]);setSales(d.sales||[]);if(!stockLotId||!(d.lots||[]).some((l:any)=>l.id===stockLotId))setStockLotId(d.lots?.[0]?.id||'');}catch(e){setError(e instanceof Error?e.message:'डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const q=(kg:number)=>((Number(kg)||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const amount=(Number(acceptedWeight)||0)*(Number(rate)||0);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setSuccess('');try{const r=await fetch('/api/sales-dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stockLotId,millerId,dispatchDate,dispatchWeight:Number(dispatchWeight),acceptedWeight:Number(acceptedWeight),ratePerQuintal:Number(rate),vehicleNumber,driverName,driverMobile,notes})});const d=await r.json();if(!r.ok)throw new Error(d.error||'बिक्री सेव नहीं हुई');setSuccess('बिक्री और डिस्पैच सेव हो गए। स्टॉक से डिस्पैच वजन घटा दिया गया है।');setDispatchWeight('');setAcceptedWeight('');setRate('');setVehicleNumber('');setDriverName('');setDriverMobile('');setNotes('');await load();}catch(e){setError(e instanceof Error?e.message:'बिक्री सेव नहीं हुई');}finally{setSaving(false);}};
 return <section className="purchase-workspace">
  <div className="panel purchase-panel"><div className="party-head"><div><h2>नई बिक्री / मिलर डिस्पैच</h2><p>उपलब्ध स्टॉक से मिलर को माल भेजें और स्वीकृत वजन दर्ज करें।</p></div><span className="status-chip">D1 DATABASE</span></div>
   {error&&<div className="auth-error">{error}</div>}{success&&<div className="purchase-success"><Check size={16}/>{success}</div>}
   <form className="purchase-form" onSubmit={save}>
    <label className="purchase-wide">स्टॉक लॉट *<select required value={stockLotId} onChange={e=>setStockLotId(e.target.value)}><option value="">स्टॉक चुनें</option>{lots.map(l=><option key={l.id} value={l.id}>{l.crop_name} · {l.owner_type==='commission_stock'?'कमीशन स्टॉक':'अपना स्टॉक'} · {l.owner_name||'दुकान'} · {q(l.available_kg)} Q उपलब्ध · {l.deal_no}</option>)}</select></label>
    <label>मिलर / राइस मिल *<select required value={millerId} onChange={e=>setMillerId(e.target.value)}><option value="">मिलर चुनें</option>{millers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label>डिस्पैच तारीख *<input required type="date" value={dispatchDate} onChange={e=>setDispatchDate(e.target.value)}/></label>
    <label>डिस्पैच वजन (क्विंटल) *<input required type="number" min="0.01" step="0.01" max={selected?(Number(selected.available_kg)/100).toFixed(2):undefined} value={dispatchWeight} onChange={e=>{setDispatchWeight(e.target.value);if(!acceptedWeight)setAcceptedWeight(e.target.value);}} placeholder="भेजा गया वजन"/></label>
    <label>मिलर द्वारा स्वीकृत वजन (क्विंटल) *<input required type="number" min="0.01" step="0.01" max={dispatchWeight||undefined} value={acceptedWeight} onChange={e=>setAcceptedWeight(e.target.value)} placeholder="स्वीकृत वजन"/></label>
    <label>बिक्री रेट (₹ / क्विंटल) *<input required type="number" min="0.01" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} placeholder="रेट"/></label>
    <label>गाड़ी नंबर *<input required value={vehicleNumber} onChange={e=>setVehicleNumber(e.target.value)} placeholder="जैसे CG 22 AB 1234"/></label>
    <label>ड्राइवर का नाम<input value={driverName} onChange={e=>setDriverName(e.target.value)}/></label>
    <label>ड्राइवर मोबाइल<input value={driverMobile} onChange={e=>setDriverMobile(e.target.value)}/></label>
    <label className="purchase-wide">नोट / विवरण<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="वैकल्पिक जानकारी"/></label>
    <div className="purchase-summary"><div><small>स्टॉक उपलब्ध</small><b>{selected?q(selected.available_kg)+' Q':'—'}</b></div><div><small>वजन अंतर</small><b>{Math.max(0,(Number(dispatchWeight)||0)-(Number(acceptedWeight)||0)).toFixed(2)} Q</b></div><div><small>बिक्री रकम · स्वीकृत वजन पर</small><b className="payable">{money(amount)}</b></div></div>
    <div className="purchase-wide purchase-hint"><ShieldCheck size={15}/> स्टॉक से डिस्पैच वजन घटेगा; बिक्री रकम मिलर के स्वीकृत वजन × रेट से बनेगी। कमीशन की गणना अलग मॉड्यूल में होगी।</div>
    <div className="purchase-wide purchase-actions"><button type="submit" className="btn-primary" disabled={saving||!lots.length||!millers.length}>{saving?'सेव हो रहा है…':'बिक्री और डिस्पैच सेव करें'}</button><span>एक ही एंट्री से बिक्री, गाड़ी और वजन अंतर रिकॉर्ड होगा।</span></div>
   </form>
  </div>
  <div className="panel purchase-list"><div className="panel-head"><div><h3>हाल की बिक्री और डिस्पैच</h3><p>कुल रिकॉर्ड: {sales.length}</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
   <div className="table-wrap"><table><thead><tr><th>तारीख</th><th>डील प्रकार</th><th>डील नंबर</th><th>मिलर</th><th>फसल</th><th>गाड़ी नंबर</th><th>डिस्पैच</th><th>स्वीकृत</th><th>अंतर</th><th>रेट</th><th>बिक्री रकम</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{s.created_at?new Date(s.created_at.replace(' ','T')+'Z').toLocaleDateString('en-IN'):'—'}</td><td>{s.deal_type==='commission'?'कमीशन':s.deal_type==='own_trade'?'अपना व्यापार':'—'}</td><td>{s.deal_no||'—'}</td><td className="party-cell">{s.miller_name}</td><td>{s.crop_name}</td><td>{s.vehicle_number||'—'}</td><td>{Number(s.dispatch_weight||0).toFixed(2)} Q</td><td className="weight-cell">{Number(s.accepted_weight||0).toFixed(2)} Q</td><td>{Number(s.weight_difference||0).toFixed(2)} Q</td><td>{money(Number(s.rate_per_quintal))}</td><td className="weight-cell">{money(Number(s.gross_amount))}</td></tr>)}</tbody></table>{loading?<div className="empty">बिक्री रिकॉर्ड लोड हो रहे हैं…</div>:sales.length===0?<div className="empty">अभी बिक्री रिकॉर्ड नहीं है। ऊपर से मिलर डिस्पैच दर्ज करें।</div>:null}</div>
  </div>
 </section>;
}


function CommissionModule(){
 const [millers,setMillers]=useState<any[]>([]);const [rules,setRules]=useState<any[]>([]);const [pending,setPending]=useState<any[]>([]);const [calculations,setCalculations]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const [millerId,setMillerId]=useState('');const [ruleName,setRuleName]=useState('Default');
 const [fixedRate,setFixedRate]=useState('10');const [percentageRate,setPercentageRate]=useState('0.5');
 const [weightBasis,setWeightBasis]=useState('accepted');const [percentageBasis,setPercentageBasis]=useState('sale_amount');const [effectiveFrom,setEffectiveFrom]=useState(new Date().toISOString().slice(0,10));
 const [dealId,setDealId]=useState('');const [ruleId,setRuleId]=useState('');const [customWeight,setCustomWeight]=useState('');const [customWeightReason,setCustomWeightReason]=useState('');const [customAmount,setCustomAmount]=useState('');
 const selectedDeal=pending.find(x=>x.deal_id===dealId);
 const matchingRules=rules.filter(r=>r.miller_id===selectedDeal?.miller_id&&Number(r.active)===1);
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/commission');const d=await r.json();if(!r.ok)throw new Error(d.error||'कमीशन डेटा लोड नहीं हुआ');setMillers(d.millers||[]);setRules(d.rules||[]);setPending(d.pending||[]);setCalculations(d.calculations||[]);setDealId(current=>(d.pending||[]).some((x:any)=>x.deal_id===current)?current:(d.pending?.[0]?.deal_id||''));}catch(e){setError(e instanceof Error?e.message:'कमीशन डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(!millerId&&millers[0])setMillerId(millers[0].id);},[millers,millerId]);
 useEffect(()=>{if(selectedDeal){const found=rules.find(r=>r.miller_id===selectedDeal.miller_id&&Number(r.active)===1);setRuleId(found?.id||'');}},[dealId,rules]);
 const saveRule=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setSuccess('');try{const r=await fetch('/api/commission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_rule',millerId,ruleName,fixedRatePerQuintal:Number(fixedRate)||0,percentageRate:Number(percentageRate)||0,weightBasis,percentageBasis,effectiveFrom})});const d=await r.json();if(!r.ok)throw new Error(d.error||'नियम सेव नहीं हुआ');setSuccess('मिलर का कमीशन नियम सेव हो गया। पुराने calculate किए गए कमीशन पर इसका असर नहीं होगा।');await load();}catch(e){setError(e instanceof Error?e.message:'नियम सेव नहीं हुआ');}finally{setSaving(false);}};
 const calculate=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setSuccess('');try{const r=await fetch('/api/commission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'calculate',dealId,ruleId,customWeight:Number(customWeight)||0,customWeightReason,customAmount:Number(customAmount)||0})});const d=await r.json();if(!r.ok)throw new Error(d.error||'कमीशन calculate नहीं हुआ');setSuccess('कमीशन calculate होकर मिलर के Receivable और Commission Income Ledger में Journal Entry सहित पोस्ट हो गया।');setCustomWeight('');setCustomWeightReason('');setCustomAmount('');await load();}catch(e){setError(e instanceof Error?e.message:'कमीशन calculate नहीं हुआ');}finally{setSaving(false);}};
 const q=(n:number)=>Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const basisLabel=(v:string)=>v==='dispatch'?'Dispatch वजन':v==='accepted'?'Miller Accepted वजन':'Custom वजन';
 return <section className="commission-workspace">
  <div className="panel purchase-panel">
   <div className="party-head"><div><h2>मिलर कमीशन नियम</h2><p>फिक्स ₹/क्विंटल और बिक्री रकम पर प्रतिशत — दोनों एक साथ लागू हो सकते हैं।</p></div><span className="status-chip">D1 DATABASE</span></div>
   {error&&<div className="auth-error">{error}</div>}{success&&<div className="purchase-success"><Check size={16}/>{success}</div>}
   <form className="purchase-form" onSubmit={saveRule}>
    <label>मिलर / राइस मिल *<select required value={millerId} onChange={e=>setMillerId(e.target.value)}><option value="">मिलर चुनें</option>{millers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label>नियम का नाम<input value={ruleName} onChange={e=>setRuleName(e.target.value)} placeholder="जैसे सामान्य कमीशन"/></label>
    <label>फिक्स कमीशन (₹ / क्विंटल)<input type="number" min="0" step="0.01" value={fixedRate} onChange={e=>setFixedRate(e.target.value)}/></label>
    <label>प्रतिशत कमीशन (%)<input type="number" min="0" step="0.001" value={percentageRate} onChange={e=>setPercentageRate(e.target.value)}/></label>
    <label>फिक्स कमीशन का वजन आधार<select value={weightBasis} onChange={e=>setWeightBasis(e.target.value)}><option value="dispatch">Dispatch वजन</option><option value="accepted">Miller Accepted वजन</option><option value="custom">Custom वजन · कारण जरूरी</option></select></label>
    <label>प्रतिशत किस रकम पर लगेगा?<select value={percentageBasis} onChange={e=>setPercentageBasis(e.target.value)}><option value="sale_amount">मिलर बिक्री रकम</option><option value="purchase_amount">किसान खरीद की कुल रकम</option><option value="custom_amount">Custom रकम</option></select></label>
    <label>नियम लागू होने की तारीख<input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}/></label>
    <div className="purchase-wide purchase-hint"><ShieldCheck size={15}/> नया नियम सेव करने पर उसी मिलर का पिछला नियम inactive होगा। पहले से calculate किए गए कमीशन का snapshot नहीं बदलेगा।</div>
    <div className="purchase-wide purchase-actions"><button className="btn-primary" disabled={saving||!millers.length}>{saving?'सेव हो रहा है…':'कमीशन नियम सेव करें'}</button><span>कम से कम एक दर शून्य से अधिक रखें।</span></div>
   </form>
  </div>
  <div className="panel purchase-list">
   <div className="panel-head"><div><h3>सक्रिय कमीशन नियम</h3><p>मिलर के अनुसार लागू नियम · {rules.filter(r=>Number(r.active)===1).length} सक्रिय</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
   <div className="table-wrap"><table><thead><tr><th>मिलर</th><th>नियम</th><th>फिक्स / Q</th><th>प्रतिशत</th><th>वजन आधार</th><th>प्रतिशत आधार</th><th>स्थिति</th></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td className="party-cell">{r.miller_name}</td><td>{r.rule_name}</td><td>{money(Number(r.fixed_rate_per_quintal))}</td><td>{q(r.percentage_rate)}%</td><td>{basisLabel(r.weight_basis)}</td><td>{r.percentage_basis==='sale_amount'?'बिक्री रकम':r.percentage_basis==='purchase_amount'?'खरीद रकम':'Custom रकम'}</td><td><span className="status-text"><i style={{background:Number(r.active)===1?'#a8d96b':'#87938b'}}/>{Number(r.active)===1?'सक्रिय':'पुराना'}</span></td></tr>)}</tbody></table>{!loading&&rules.length===0&&<div className="empty">अभी कोई कमीशन नियम नहीं है। ऊपर से पहला नियम सेव करें।</div>}</div>
  </div>
  <div className="panel purchase-panel">
   <div className="party-head"><div><h2>कमीशन calculate करें</h2><p>कमीशन मॉडल की बिक्री डील चुनें। किसान की देय रकम से कमीशन नहीं कटेगा।</p></div><span className="status-chip">{pending.length} Pending</span></div>
   {pending.length===0?<div className="empty">कमीशन calculate करने के लिए कोई नई commission-model बिक्री उपलब्ध नहीं है। पहले मिलर का नियम सेव करें और बिक्री एंट्री करें।</div>:<form className="purchase-form" onSubmit={calculate}>
    <label className="purchase-wide">डील / बिक्री चुनें *<select required value={dealId} onChange={e=>setDealId(e.target.value)}>{pending.map(d=><option key={d.deal_id} value={d.deal_id}>{d.deal_no} · {d.miller_name} · {d.crop_name} · बिक्री {money(Number(d.sale_amount))}</option>)}</select></label>
    <label>कमीशन नियम *<select required value={ruleId} onChange={e=>setRuleId(e.target.value)}><option value="">इस मिलर का नियम चुनें</option>{matchingRules.map(r=><option key={r.id} value={r.id}>{r.rule_name} · ₹{q(r.fixed_rate_per_quintal)}/Q + {q(r.percentage_rate)}%</option>)}</select></label>
    <div className="commission-base-preview"><span>Dispatch: <b>{q(selectedDeal?.dispatch_weight)} Q</b></span><span>Accepted: <b>{q(selectedDeal?.accepted_weight)} Q</b></span><span>Sale: <b>{money(Number(selectedDeal?.sale_amount||0))}</b></span><span>Purchase: <b>{money(Number(selectedDeal?.purchase_amount||0))}</b></span></div>
    {matchingRules.find(r=>r.id===ruleId)?.weight_basis==='custom'&&<><label>Custom वजन (क्विंटल) *<input required type="number" min="0.01" step="0.01" value={customWeight} onChange={e=>setCustomWeight(e.target.value)}/></label><label>Custom वजन का कारण *<input required maxLength={250} value={customWeightReason} onChange={e=>setCustomWeightReason(e.target.value)} placeholder="कारण लिखें"/></label></>}
    {matchingRules.find(r=>r.id===ruleId)?.percentage_basis==='custom_amount'&&<label className="purchase-wide">प्रतिशत के लिए Custom रकम (₹) *<input required type="number" min="0.01" step="0.01" value={customAmount} onChange={e=>setCustomAmount(e.target.value)}/></label>}
    <div className="purchase-wide purchase-hint"><ShieldCheck size={15}/> Calculate करने पर नियम, वजन, रकम और दर का immutable snapshot सेव होगा। Calculate करने पर मिलर के नाम Debit Receivable और Commission Income Credit की balanced Journal Entry बनेगी।</div>
    <div className="purchase-wide purchase-actions"><button className="btn-primary" disabled={saving||!ruleId}>{saving?'Calculate हो रहा है…':'कमीशन calculate और सेव करें'}</button></div>
   </form>}
  </div>
  <div className="panel purchase-list">
   <div className="panel-head"><div><h3>Calculate किया गया कमीशन</h3><p>मिलर से प्राप्त होने वाला कमीशन · {calculations.length} रिकॉर्ड</p></div></div>
   <div className="table-wrap"><table><thead><tr><th>डील</th><th>मिलर</th><th>वजन</th><th>फिक्स कमीशन</th><th>प्रतिशत कमीशन</th><th>कुल कमीशन</th><th>Ledger Posting</th><th>तारीख</th></tr></thead><tbody>{calculations.map(x=><tr key={x.id}><td className="id-cell">{x.deal_no}</td><td className="party-cell">{x.miller_name}</td><td>{q(x.weight_quintals)} Q</td><td>{money(Number(x.fixed_commission))}</td><td>{money(Number(x.percentage_commission))}</td><td className="weight-cell">{money(Number(x.total_commission))}</td><td>{x.journal_status==='posted'?<span className="status-text"><i style={{background:'#a8d96b'}}/>Posted · {x.journal_entry_no}</span>:<span className="status-text"><i style={{background:'#e0ad5a'}}/>Pending</span>}</td><td>{x.calculated_at?new Date(x.calculated_at.replace(' ','T')+'Z').toLocaleDateString('en-IN'):'—'}</td></tr>)}</tbody></table>{!loading&&calculations.length===0&&<div className="empty">अभी कमीशन calculate नहीं हुआ है।</div>}</div>
  </div>
 </section>;
}


function PaymentsModule(){
 const [pending,setPending]=useState<any[]>([]);const [payments,setPayments]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const [selectedKey,setSelectedKey]=useState('');const [amount,setAmount]=useState('');const [method,setMethod]=useState('cash');const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [reference,setReference]=useState('');const [notes,setNotes]=useState('');
 const selected=pending.find(x=>x.deal_id+'|'+x.payment_type===selectedKey);
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/payments');const d=await r.json();if(!r.ok)throw new Error(d.error||'Payments डेटा लोड नहीं हुआ');const list=d.pending||[];setPending(list);setPayments(d.payments||[]);setSelectedKey(current=>list.some((x:any)=>x.deal_id+'|'+x.payment_type===current)?current:(list[0]?list[0].deal_id+'|'+list[0].payment_type:''));}catch(e){setError(e instanceof Error?e.message:'Payments डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(selected)setAmount(String(Number(selected.outstanding||0).toFixed(2)));},[selectedKey,pending]);
 const typeLabel=(t:string)=>t==='farmer_payment'?'किसान को भुगतान':t==='miller_sale_receipt'?'मिलर से बिक्री वसूली':'मिलर से कमीशन वसूली';
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!selected)return;setSaving(true);setError('');setSuccess('');try{const r=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dealId:selected.deal_id,partyId:selected.party_id,paymentType:selected.payment_type,amount:Number(amount),paymentMethod:method,paymentDate:date,transactionReference:reference,notes})});const d=await r.json();if(!r.ok)throw new Error([d.error||'भुगतान सेव नहीं हुआ',d.detail].filter(Boolean).join(' — '));setSuccess('भुगतान सेव और Ledger में पोस्ट हो गया। शेष बकाया: '+money(Number(d.remainingDue)||0));setReference('');setNotes('');await load();}catch(e){setError(e instanceof Error?e.message:'भुगतान सेव नहीं हुआ');}finally{setSaving(false);}};
 return <section className="purchase-workspace">
  <div className="panel purchase-panel"><div className="party-head"><div><h2>नया भुगतान / वसूली</h2><p>किसान भुगतान, मिलर बिक्री वसूली और कमीशन वसूली अलग-अलग दर्ज करें।</p></div><span className="status-chip">DOUBLE-ENTRY LEDGER</span></div>
   {error&&<div className="auth-error">{error}</div>}{success&&<div className="purchase-success"><Check size={16}/>{success}</div>}
   <form className="purchase-form" onSubmit={save}>
    <label className="purchase-wide">बकाया डील चुनें *<select required value={selectedKey} onChange={e=>setSelectedKey(e.target.value)}><option value="">डील चुनें</option>{pending.map(x=><option key={x.deal_id+'|'+x.payment_type} value={x.deal_id+'|'+x.payment_type}>{typeLabel(x.payment_type)} · {x.party_name} · {x.crop_name} · {x.deal_no} · बाकी {money(Number(x.outstanding)||0)}</option>)}</select></label>
    <label>भुगतान रकम (₹) *<input required type="number" min="0.01" step="0.01" max={selected?.outstanding||undefined} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="रकम"/></label>
    <label>तारीख *<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>भुगतान तरीका *<select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Cash</option><option value="bank">Bank</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
    <label>UTR / Transaction Ref<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="वैकल्पिक"/></label>
    <label className="purchase-wide">नोट / विवरण<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="वैकल्पिक विवरण"/></label>
    {selected&&<div className="purchase-wide modal-note"><ShieldCheck size={16}/> {typeLabel(selected.payment_type)} · {selected.party_name} · कुल बकाया {money(Number(selected.outstanding)||0)}. किसान की खरीद पर भुगतान दर्ज होने से Purchase का बकाया भी अपडेट होगा।</div>}
    <div className="purchase-wide party-form-actions"><button type="button" className="btn-secondary" onClick={()=>{setAmount('');setReference('');setNotes('');}}>Clear</button><button className="btn-primary" disabled={saving||!selected}>{saving?'सेव हो रहा है…':'भुगतान सेव करें'}</button></div>
   </form>
  </div>
  <div className="panel purchase-panel"><div className="party-head"><div><h2>हाल के भुगतान और वसूली</h2><p>Database रिकॉर्ड · {payments.length} हालिया एंट्री</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
   <div className="table-wrap"><table><thead><tr><th>तारीख</th><th>पर्ची नंबर</th><th>पार्टी</th><th>डील</th><th>प्रकार</th><th>तरीका</th><th>रकम</th><th>स्थिति</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.payment_date}</td><td className="id-cell">{p.payment_no}</td><td className="party-cell">{p.party_name}</td><td>{p.deal_no||'—'}</td><td>{typeLabel(p.payment_type)}</td><td>{String(p.payment_method||'').toUpperCase()}</td><td className="weight-cell">{money(Number(p.amount)||0)}</td><td>{p.status}</td></tr>)}</tbody></table>{loading?<div className="empty">Payments लोड हो रहे हैं…</div>:payments.length===0?<div className="empty">अभी कोई भुगतान या वसूली दर्ज नहीं है।</div>:null}</div>
  </div>
  <p className="auth-hint">हर भुगतान के साथ Journal Entry बनेगी: किसान भुगतान में Farmer Payable घटेगा; मिलर बिक्री वसूली में Sales Receivable घटेगा; कमीशन वसूली में Commission Receivable घटेगा। पुराने रिकॉर्ड delete नहीं होंगे।</p>
 </section>;
}



function LedgerModule(){
 const [data,setData]=useState<any>({accounts:[],parties:[],unbalanced:[],totals:{debit:0,credit:0}});
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/ledger');const d=await r.json();if(!r.ok)throw new Error(d.error||'Ledger डेटा लोड नहीं हुआ');setData(d);}catch(e){setError(e instanceof Error?e.message:'Ledger डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const fmt=(n:number)=>money(Number(n)||0);
 const difference=Math.abs((Number(data.totals?.debit)||0)-(Number(data.totals?.credit)||0));
 const unbalancedEntries=(data.unbalanced||[]).filter((j:any)=>Math.round(Math.abs((Number(j.debit)||0)-(Number(j.credit)||0))*100)/100>0);
 return <section className="purchase-workspace">
  <div className="metrics">
   <Metric title="कुल डेबिट" value={fmt(data.totals?.debit)} change="Posted Journals" note="सभी खातों का कुल Debit" icon={<ArrowDownLeft/>} tone="blue"/>
   <Metric title="कुल क्रेडिट" value={fmt(data.totals?.credit)} change="Posted Journals" note="सभी खातों का कुल Credit" icon={<ArrowUpRight/>} tone="green"/>
   <Metric title="Trial Balance अंतर" value={fmt(difference)} change={difference<0.01?'Balanced':'जाँच जरूरी'} note="Debit और Credit का अंतर" icon={<ShieldCheck/>} tone="purple"/>
   <Metric title="असंतुलित Journal" value={String(unbalancedEntries.length)} change="Entry check" note="जहाँ Debit ≠ Credit" icon={<Activity/>} tone="orange"/>
  </div>
  <div className="panel purchase-panel"><div className="party-head"><div><h2>खाता-बही · Trial Balance</h2><p>केवल posted journal entries · D1 से लाइव डेटा</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
   {error&&<div className="auth-error">{error}</div>}
   <div className="table-wrap"><table><thead><tr><th>खाता कोड</th><th>खाते का नाम</th><th>प्रकार</th><th>Debit</th><th>Credit</th><th>बैलेंस</th></tr></thead><tbody>{(data.accounts||[]).map((a:any)=><tr key={a.id}><td className="id-cell">{a.account_code}</td><td className="party-cell">{a.account_name}</td><td>{a.account_type}</td><td>{fmt(a.debit)}</td><td>{fmt(a.credit)}</td><td className="weight-cell">{fmt(a.balance)}</td></tr>)}</tbody></table>{loading?<div className="empty">Ledger लोड हो रहा है…</div>:!data.accounts?.length?<div className="empty">अभी कोई Ledger account या posted journal नहीं है।</div>:null}</div>
  </div>
  <div className="panel purchase-panel"><div className="party-head"><div><h2>पार्टी के अनुसार Ledger</h2><p>Journal में party_id से जुड़े डेबिट और क्रेडिट</p></div></div>
   <div className="table-wrap"><table><thead><tr><th>पार्टी</th><th>प्रकार</th><th>Debit</th><th>Credit</th><th>नेट बैलेंस (Dr − Cr)</th></tr></thead><tbody>{(data.parties||[]).map((p:any)=><tr key={p.party_id}><td className="party-cell">{p.party_name}</td><td>{p.party_type}</td><td>{fmt(p.debit)}</td><td>{fmt(p.credit)}</td><td className="weight-cell">{fmt(p.balance)}</td></tr>)}</tbody></table>{!loading&&!data.parties?.length?<div className="empty">अभी किसी पार्टी के नाम से Journal posting नहीं है।</div>:null}</div>
  </div>
  <div className="panel purchase-panel"><div className="party-head"><div><h2>Journal जाँच</h2><p>जिन entries में Debit और Credit बराबर नहीं हैं</p></div></div>
   <div className="table-wrap"><table><thead><tr><th>Entry No.</th><th>तारीख</th><th>विवरण</th><th>Debit</th><th>Credit</th><th>अंतर</th></tr></thead><tbody>{unbalancedEntries.map((j:any)=><tr key={j.id}><td className="id-cell">{j.entry_no}</td><td>{j.entry_date}</td><td>{j.description}</td><td>{fmt(j.debit)}</td><td>{fmt(j.credit)}</td><td className="weight-cell">{fmt(Number(j.debit)-Number(j.credit))}</td></tr>)}</tbody></table>{!loading&&!unbalancedEntries.length?<div className="empty">सभी जाँची गई posted Journal entries संतुलित हैं।</div>:null}</div>
  </div>
  <p className="auth-hint">नोट: यह Ledger रिपोर्ट journal posting पर आधारित है। Opening balance, purchase/sales posting और पूर्ण balance sheet अभी इस रिपोर्ट में शामिल नहीं हैं।</p>
 </section>;
}

function OwnTradeReportModule(){
 const [rows,setRows]=useState<any[]>([]);const [totals,setTotals]=useState<any>({purchaseCost:0,sales:0,expenses:0,grossProfit:0,netProfit:0,inventoryValue:0});
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/own-trade-report');const d=await r.json();if(!r.ok)throw new Error(d.error||'रिपोर्ट लोड नहीं हुई');setRows(d.rows||[]);setTotals(d.totals||{});}catch(e){setError(e instanceof Error?e.message:'रिपोर्ट लोड नहीं हुई');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const q=(kg:number)=>((Number(kg)||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 return <section className="purchase-workspace">
  <div className="metrics">
   <Metric title="कुल बिक्री" value={money(Number(totals.sales)||0)} change="Own Trade" note="स्वीकृत वजन के आधार पर" icon={<Truck/>} tone="blue"/>
   <Metric title="बिकी मात्रा की खरीद लागत" value={money(Number(totals.purchaseCost)||0)} change="Allocated Cost" note="बिकी मात्रा के अनुपात में" icon={<ArrowDownLeft/>} tone="orange"/>
   <Metric title="सकल व्यापार लाभ" value={money(Number(totals.grossProfit)||0)} change="बिक्री − लागत" note="अन्य खर्च से पहले" icon={<BarChart3/>} tone="green"/>
   <Metric title="शुद्ध व्यापार लाभ" value={money(Number(totals.netProfit)||0)} change="खर्च घटाकर" note={money(Number(totals.expenses)||0)+' कुल खर्च'} icon={<IndianRupee/>} tone="purple"/>
  </div>
  <div className="panel purchase-panel">
   <div className="party-head"><div><h2>अपना व्यापार · Profit & Loss</h2><p>केवल Own Trade डील शामिल हैं। कमीशन कारोबार इस रिपोर्ट से अलग है।</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
   {error&&<div className="auth-error">{error}</div>}
   <div className="stock-summary-grid">
    <div className="panel stock-summary-card"><small>बाकी स्टॉक की अनुमानित लागत</small><strong>{money(Number(totals.inventoryValue)||0)}</strong><span>उपलब्ध मात्रा पर</span></div>
    <div className="panel stock-summary-card"><small>कुल सीधे खर्च</small><strong>{money(Number(totals.expenses)||0)}</strong><span>Deal से जुड़े खर्च</span></div>
   </div>
   <div className="table-wrap"><table><thead><tr><th>डील नंबर</th><th>तारीख</th><th>किसान</th><th>फसल</th><th>खरीदा</th><th>बिका</th><th>बिक्री रकम</th><th>खरीद लागत</th><th>खर्च</th><th>शुद्ध लाभ</th></tr></thead><tbody>
    {rows.map(x=><tr key={x.deal_id}><td className="id-cell">{x.deal_no}</td><td>{x.deal_date}</td><td className="party-cell">{x.farmer_name}</td><td>{x.crop_name}</td><td>{q(Number(x.purchased_kg))} Q</td><td>{q(Number(x.sold_kg))} Q</td><td>{money(Number(x.sales_amount)||0)}</td><td>{money(Number(x.purchase_cost_allocated)||0)}</td><td>{money(Number(x.expense_amount)||0)}</td><td className="weight-cell">{money(Number(x.net_profit)||0)}</td></tr>)}
   </tbody></table>{loading?<div className="empty">रिपोर्ट लोड हो रही है…</div>:rows.length===0?<div className="empty">अभी कोई Own Trade डील नहीं है। Purchase में प्रकार “अपना व्यापार” चुनकर खरीद दर्ज करें।</div>:null}</div>
   <p className="auth-hint">हिसाब का आधार: खरीद लागत = किसान को देय रकम × बिकी मात्रा ÷ खरीदी मात्रा। शुद्ध लाभ = बिक्री रकम − बिकी मात्रा की खरीद लागत − डील से जुड़े खर्च। बाकी स्टॉक की लागत अलग दिखाई गई है।</p>
  </div>
 </section>;
}


function StockModule(){
 const [lots,setLots]=useState<any[]>([]);
 const [summary,setSummary]=useState<any>({totalKg:0,commissionKg:0,ownKg:0,transitKg:0,byCrop:{}});
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/stock');const d=await r.json();if(!r.ok)throw new Error(d.error||'स्टॉक डेटा लोड नहीं हुआ');setLots(d.lots||[]);setSummary(d.summary||{totalKg:0,commissionKg:0,ownKg:0,transitKg:0,byCrop:{}});}catch(e){setError(e instanceof Error?e.message:'स्टॉक डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const q=(kg:number)=>((Number(kg)||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})+' Q';
 const owner=(type:string)=>type==='commission_stock'?'कमीशन स्टॉक':type==='own_stock'?'अपना स्टॉक':type==='in_transit'?'रास्ते में':'—';
 return <section className="stock-workspace">
  <div className="stock-summary-grid">
   <div className="panel stock-summary-card"><small>कुल उपलब्ध स्टॉक</small><strong>{q(summary.totalKg)}</strong><span>क्विंटल</span></div>
   <div className="panel stock-summary-card commission"><small>कमीशन स्टॉक · किसान का माल</small><strong>{q(summary.commissionKg)}</strong><span>क्विंटल</span></div>
   <div className="panel stock-summary-card own"><small>अपना खरीदा हुआ स्टॉक</small><strong>{q(summary.ownKg)}</strong><span>क्विंटल</span></div>
   <div className="panel stock-summary-card transit"><small>रास्ते में</small><strong>{q(summary.transitKg)}</strong><span>क्विंटल</span></div>
  </div>
  <div className="panel stock-inventory">
   <div className="panel-head"><div><h3>स्टॉक की पूरी सूची</h3><p>खरीद से बने वास्तविक D1 स्टॉक रिकॉर्ड · {lots.length} लॉट</p></div><button className="btn-secondary compact" onClick={load} disabled={loading}>Refresh</button></div>
   {error&&<div className="auth-error">{error}</div>}
   <div className="table-wrap"><table><thead><tr><th>फसल</th><th>स्टॉक का प्रकार</th><th>मालिक / किसान</th><th>डील नंबर</th><th>कुल मात्रा</th><th>उपलब्ध मात्रा</th><th>स्थिति</th><th>तारीख</th></tr></thead><tbody>
    {lots.map(l=><tr key={l.id}><td className="party-cell">{l.crop_name}</td><td><span className={'stock-type '+l.owner_type}>{owner(l.owner_type)}</span></td><td>{l.owner_name||'दुकान का स्टॉक'}</td><td className="id-cell">{l.deal_no}</td><td>{q(l.quantity_kg)}</td><td className="weight-cell">{q(l.available_kg)}</td><td>{l.status==='available'?'उपलब्ध':l.status}</td><td>{l.created_at?new Date(l.created_at.replace(' ','T')+'Z').toLocaleDateString('en-IN'):'—'}</td></tr>)}
   </tbody></table>{loading?<div className="empty">स्टॉक लोड हो रहा है…</div>:lots.length===0?<div className="empty">अभी कोई स्टॉक रिकॉर्ड नहीं है। Purchase में खरीद सेव करने पर स्टॉक यहाँ दिखाई देगा।</div>:null}</div>
  </div>
  <div className="panel stock-crop-breakdown"><div className="panel-head"><div><h3>फसल के अनुसार स्टॉक</h3><p>उपलब्ध मात्रा · क्विंटल</p></div></div><div className="stock-crop-grid">{Object.entries(summary.byCrop||{}).map(([name,value]:[string,any])=><div className="stock-crop-item" key={name}><b>{name}</b><strong>{q(value.kg)}</strong><small>कमीशन {q(value.commissionKg)} · अपना {q(value.ownKg)}</small></div>)}</div>{!loading&&Object.keys(summary.byCrop||{}).length===0&&<div className="empty">फसलवार स्टॉक उपलब्ध नहीं है।</div>}</div>
 </section>;
}

function AuthGate({mode,onAuth}:{mode:'setup'|'login';onAuth:(user:AuthUser)=>void}){
 const [shopName,setShopName]=useState('');const [ownerName,setOwnerName]=useState('');const [phone,setPhone]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const endpoint='/api/owner-setup';const payload=mode==='setup'?{shopName,ownerName,phone,email,password}:{action:'login',email,password};const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const raw=await r.text();let d:any;try{d=JSON.parse(raw);}catch{throw new Error('Server API response JSON नहीं है (HTTP '+r.status+'). पेज refresh करके दोबारा कोशिश करें; समस्या बनी रहे तो स्क्रीनशॉट भेजें।');}if(!r.ok)throw new Error(d.error||'प्रक्रिया पूरी नहीं हुई (HTTP '+r.status+').');onAuth(d.user);}catch(e){setError(e instanceof Error?e.message:'कनेक्शन में समस्या है।');}finally{setBusy(false);}};
 return <div className="auth-shell"><form className="auth-card" onSubmit={submit}><div className="brand-mark auth-mark"><Sprout size={24}/></div><div className="eyebrow">DIGITAL MANDI OS · SECURE WORKSPACE</div><h1>{mode==='setup'?'अपना मंडी अकाउंट बनाएँ':'वापस स्वागत है'}</h1><p>{mode==='setup'?'पहली बार दुकान और Owner login सेट करें।':'अपने कारोबार में सुरक्षित लॉगिन करें।'}</p>{mode==='setup'&&<><label>दुकान / फर्म का नाम<input required minLength={2} maxLength={100} value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Balaji Mandi"/></label><label>मालिक का नाम<input required minLength={2} maxLength={80} value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="आपका नाम"/></label><label>मोबाइल (वैकल्पिक)<input value={phone} onChange={e=>setPhone(e.target.value)}/></label></>}<label>ईमेल<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><label>पासवर्ड<input required type="password" minLength={mode==='setup'?12:1} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='setup'?'कम से कम 12 अक्षर':'पासवर्ड'}/></label>{mode==='setup'&&<small className="auth-hint">पासवर्ड कम से कम 12 अक्षरों का रखें और सुरक्षित रखें।</small>}{error&&<div className="auth-error">{error}</div>}<button className="btn-primary auth-submit" disabled={busy}>{busy?'कृपया प्रतीक्षा करें…':mode==='setup'?'Owner अकाउंट बनाएँ':'Login करें'}</button><div className="auth-foot"><ShieldCheck size={15}/> सुरक्षित लॉगिन · आपका डेटा आपके मंडी अकाउंट में</div></form></div>;
}
function PartyModule({type}:{type:'farmer'|'miller'}){
 const [rows,setRows]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [name,setName]=useState('');const [village,setVillage]=useState('');const [mobile,setMobile]=useState('');const [address,setAddress]=useState('');const [showForm,setShowForm]=useState(false);
 const load=async()=>{setLoading(true);try{const r=await fetch('/api/parties?type='+type);const d=await r.json();if(!r.ok)throw new Error(d.error||'सूची नहीं खुली');setRows(d.parties||[]);setError('');}catch(e){setError(e instanceof Error?e.message:'डेटा लोड नहीं हुआ');}finally{setLoading(false);}};
 useEffect(()=>{load();},[type]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{const r=await fetch('/api/parties',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,name,village,mobile,address})});const d=await r.json();if(!r.ok)throw new Error(d.error||'सेव नहीं हुआ');setRows(current=>[d.party,...current]);setName('');setVillage('');setMobile('');setAddress('');setShowForm(false);}catch(e){setError(e instanceof Error?e.message:'सेव नहीं हुआ');}finally{setSaving(false);}};
 return <section className="panel party-panel"><div className="party-head"><div><h2>{type==='farmer'?'किसान सूची':'मिलर सूची'}</h2><p>सुरक्षित D1 database · कुल रिकॉर्ड: {rows.length}</p></div><button className="btn-primary" onClick={()=>setShowForm(v=>!v)}><Plus size={16}/>{type==='farmer'?'किसान जोड़ें':'मिलर जोड़ें'}</button></div>{error&&<div className="auth-error">{error}</div>}{showForm&&<form className="party-form" onSubmit={save}><label>नाम *<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>गाँव / शहर<input value={village} onChange={e=>setVillage(e.target.value)}/></label><label>मोबाइल<input value={mobile} onChange={e=>setMobile(e.target.value)}/></label><label>पता<input value={address} onChange={e=>setAddress(e.target.value)}/></label><div className="party-form-actions"><button type="button" className="btn-secondary" onClick={()=>setShowForm(false)}>रद्द करें</button><button className="btn-primary" disabled={saving}>{saving?'सेव हो रहा है…':'सेव करें'}</button></div></form>}<div className="table-wrap"><table><thead><tr><th>नाम</th><th>गाँव / शहर</th><th>मोबाइल</th><th>ओपनिंग बैलेंस</th><th>जोड़ा गया</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td className="party-cell">{p.name}</td><td>{p.village||'—'}</td><td>{p.mobile||'—'}</td><td>{Number(p.opening_balance||0).toLocaleString('en-IN')}</td><td>{p.created_at?new Date(p.created_at).toLocaleDateString('en-IN'):'—'}</td></tr>)}</tbody></table>{loading?<div className="empty">डेटा लोड हो रहा है…</div>:rows.length===0?<div className="empty">अभी कोई रिकॉर्ड नहीं है। ऊपर से पहली एंट्री जोड़ें।</div>:null}</div></section>;
}

function Metric({title,value,change,note,icon,tone}:{title:string;value:string;change:string;note:string;icon:any;tone:string}){return <div className="metric-card"><div className="metric-top"><span>{title}</span><i className={'metric-icon '+tone}>{icon}</i></div><strong>{value}</strong><div className="metric-foot"><b>{change}</b><span>{note}</span></div></div>}
function ActivityRow({icon,title,sub,amount,time,tone}:{icon:any;title:string;sub:string;amount:string;time:string;tone:string}){return <div className="activity-row"><i className={'activity-icon '+tone}>{icon}</i><div className="activity-copy"><b>{title}</b><small>{sub}</small></div><div className="activity-amount"><b>{amount}</b><small>{time}</small></div></div>}
function CropBar({name,amount,percent,color}:{name:string;amount:string;percent:number;color:string}){return <div className="crop-row"><div className="crop-label"><b>{name}</b><span>{amount}</span></div><div className="bar-bg"><i className={color} style={{width:percent+'%'}}/></div></div>}
function Quick({icon,label,onClick}:{icon:any;label:string;onClick:()=>void}){return <button className="quick-item" onClick={onClick}><i>{icon}</i><span>{label}</span><ChevronRight size={15}/></button>}
export default App;
