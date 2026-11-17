import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Search, Wallet, Sprout, Users, Download, X, HandCoins, ReceiptText, LayoutDashboard, BookOpen, UserRound, ChevronRight } from "lucide-react";

type Person = { id: string; name: string; phone?: string; note?: string; createdAt: string };
type EntryType = "income" | "expense" | "shared_expense" | "lent" | "borrowed" | "repayment_in" | "repayment_out" | "shared_repayment_in";
type Share = { personId: string; amount: number };
type AttachmentMeta = { id: string; name: string; type: string; size: number };
type Entry = { id: string; title: string; category: string; type: EntryType; amount: number; date: string; personId?: string; note?: string; attachments?: AttachmentMeta[]; shares?: Share[] };
type StoredAttachment = AttachmentMeta & { blob: Blob };
const ATTACHMENT_DB = "khataflow.files.v1";
function attachmentStore(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<any> { return new Promise((resolve,reject) => { const req=indexedDB.open(ATTACHMENT_DB,1); req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files",{keyPath:"id"}); }; req.onerror=()=>reject(req.error); req.onsuccess=()=>{ const db=req.result; const tx=db.transaction("files",mode); const result=action(tx.objectStore("files")); result.onsuccess=()=>resolve(result.result); result.onerror=()=>reject(result.error); tx.oncomplete=()=>db.close(); }; }); }
const putAttachment = (file: File, id: string) => attachmentStore("readwrite",store=>store.put({id,name:file.name,type:file.type,size:file.size,blob:file}));
const getAttachment = (id: string): Promise<StoredAttachment|undefined> => attachmentStore("readonly",store=>store.get(id));
const blobDataUrl = (blob: Blob) => new Promise<string>((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(blob); });
const PEOPLE_KEY = "khataflow.people.v1";
const ENTRIES_KEY = "khataflow.entries.v2";
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().slice(0, 10);
const load = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const labels: Record<EntryType,string> = { income:"Income", expense:"Expense", shared_expense:"Shared expense (you paid)", lent:"Money lent", borrowed:"Money borrowed", repayment_in:"Repayment received", repayment_out:"Repayment paid", shared_repayment_in:"Shared expense recovery" };
const signed = (t: EntryType) => ["income","borrowed","repayment_in","shared_repayment_in"].includes(t) ? 1 : -1;

export default function App() {
  const [people, setPeople] = useState<Person[]>(() => load(PEOPLE_KEY, []));
  const [entries, setEntries] = useState<Entry[]>(() => load(ENTRIES_KEY, []));
  const [page, setPage] = useState<"home"|"activity"|"people">("home");
  const [query, setQuery] = useState("");
  const [showEntry, setShowEntry] = useState(false);
  const [showPerson, setShowPerson] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string|null>(null);
  const [type, setType] = useState<EntryType>("income");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Farming");
  const [date, setDate] = useState(today());
  const [personId, setPersonId] = useState("");
  const [note, setNote] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [personName, setPersonName] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [personNote, setPersonNote] = useState("");

  function savePeople(next: Person[]) { setPeople(next); localStorage.setItem(PEOPLE_KEY, JSON.stringify(next)); }
  function saveEntries(next: Entry[]) { setEntries(next); localStorage.setItem(ENTRIES_KEY, JSON.stringify(next)); }
  const totals = useMemo(() => entries.reduce((a,e) => {
    if (e.type === "income") a.income += e.amount;
    if (e.type === "expense" || e.type === "shared_expense") a.expense += e.amount;
    if (e.type === "lent") a.lent += e.amount;
    if (e.type === "borrowed") a.borrowed += e.amount;
    if (e.type === "repayment_in") a.repaidIn += e.amount;
    if (e.type === "repayment_out") a.repaidOut += e.amount;
    a.cash += signed(e.type) * e.amount;
    return a;
  }, { income:0, expense:0, lent:0, borrowed:0, repaidIn:0, repaidOut:0, cash:0 }), [entries]);
  const lentOutstanding = totals.lent - totals.repaidIn;
  const borrowedOutstanding = totals.borrowed - totals.repaidOut;
  const needsPerson = ["lent","borrowed","repayment_in","repayment_out","shared_repayment_in"].includes(type);
  const sharedOwed = (id: string) => entries.reduce((sum,e) => sum + (e.type === "shared_expense" ? (e.shares ?? []).filter(x=>x.personId===id).reduce((n,x)=>n+x.amount,0) : 0) - (e.type === "shared_repayment_in" && e.personId===id ? e.amount : 0),0);
  const totalSharedOwed = people.reduce((sum,p)=>sum+sharedOwed(p.id),0);
  const personBalance = (id: string) => ({ ...entries.reduce((a,e) => {
    if (e.personId !== id) return a;
    if (e.type === "lent") a.lent += e.amount;
    if (e.type === "repayment_in") a.lent -= e.amount;
    if (e.type === "borrowed") a.borrowed += e.amount;
    if (e.type === "repayment_out") a.borrowed -= e.amount;
    return a;
  }, { lent:0, borrowed:0 }), shared:sharedOwed(id) });
  const filtered = entries.filter(e => {
    const person = [people.find(p=>p.id===e.personId)?.name ?? "",...(e.shares ?? []).map(x=>people.find(p=>p.id===x.personId)?.name ?? "")].join(" ");
    return [e.title,e.category,e.note ?? "",person,labels[e.type]].join(" ").toLowerCase().includes(query.toLowerCase());
  }).sort((a,b)=>b.date.localeCompare(a.date));
  const personEntries = selectedPerson ? filtered.filter(e=>e.personId===selectedPerson || (e.shares ?? []).some(x=>x.personId===selectedPerson)) : [];
  function resetEntry() { setTitle(""); setAmount(""); setNote(""); setPersonId(""); setType("income"); setCategory("Farming"); setDate(today()); setAttachmentFiles([]); setShares([]); }
  async function addEntry(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!title.trim() || !Number.isFinite(value) || value <= 0) return;
    if (needsPerson && !personId) return;
    if (attachmentFiles.some(file=>file.size>10*1024*1024)) { alert("Each attachment must be 10 MB or smaller."); return; }
    if (type === "repayment_in" && personBalance(personId).lent < value) { alert("Repayment is greater than this person's outstanding amount owed to you."); return; }
    if (type === "repayment_out" && personBalance(personId).borrowed < value) { alert("Repayment is greater than your outstanding amount owed to this person."); return; }
    if (type === "shared_repayment_in" && sharedOwed(personId) < value) { alert("Recovery is greater than this person’s outstanding shared expenses."); return; }
    if (type === "shared_expense") { if (!shares.length || shares.some(x=>!x.personId || !Number.isFinite(x.amount) || x.amount<=0)) { alert("Add at least one person and a valid share amount."); return; } if (new Set(shares.map(x=>x.personId)).size !== shares.length) { alert("Each person can appear only once in a shared expense."); return; } if (shares.reduce((sum,x)=>sum+x.amount,0) > value + 0.001) { alert("The shared amounts cannot exceed the total expense."); return; } }
    const attachments: AttachmentMeta[] = attachmentFiles.map(file=>({id:crypto.randomUUID(),name:file.name,type:file.type || "application/octet-stream",size:file.size}));
    try { for(let i=0;i<attachmentFiles.length;i++) await putAttachment(attachmentFiles[i],attachments[i].id); }
    catch { alert("Could not save the attachment. Please try again."); return; }
    const entry: Entry = { id: crypto.randomUUID(), title:title.trim(), category, type, amount:value, date, personId:needsPerson ? personId : undefined, note:note.trim() || undefined, attachments:attachments.length ? attachments : undefined, shares:type==="shared_expense" ? shares : undefined };
    saveEntries([entry,...entries]); resetEntry(); setShowEntry(false);
  }
  function addPerson(e: React.FormEvent) {
    e.preventDefault(); if (!personName.trim()) return;
    savePeople([{ id:crypto.randomUUID(), name:personName.trim(), phone:personPhone.trim() || undefined, note:personNote.trim() || undefined, createdAt:today() },...people]);
    setPersonName(""); setPersonPhone(""); setPersonNote(""); setShowPerson(false);
  }
  async function exportData() {
    const attachments: {meta:AttachmentMeta; dataUrl:string}[] = [];
    try { for(const entry of entries) for(const meta of entry.attachments ?? []) { const stored=await getAttachment(meta.id); if(stored) attachments.push({meta,dataUrl:await blobDataUrl(stored.blob)}); } }
    catch { alert("Some receipt files could not be included. Please try again."); return; }
    const blob = new Blob([JSON.stringify({ app:"KhataFlow", version:3, exportedAt:new Date().toISOString(), people, entries, attachments },null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="khataflow-backup.json"; a.click(); URL.revokeObjectURL(url);
  }
  const selected = people.find(p=>p.id===selectedPerson);
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setPage("home");setSelectedPerson(null)}}><span className="brand-mark">K</span><span>khataflow<small>HOUSEHOLD ACCOUNTS</small></span></a><button className="icon-btn" onClick={exportData} aria-label="Export backup"><Download size={18}/></button></header>
    <nav className="nav-tabs">
      <button className={page==="home"?"active":""} onClick={()=>{setPage("home");setSelectedPerson(null)}}><LayoutDashboard size={16}/> Overview</button>
      <button className={page==="activity"?"active":""} onClick={()=>{setPage("activity");setSelectedPerson(null)}}><ReceiptText size={16}/> Activity</button>
      <button className={page==="people"?"active":""} onClick={()=>{setPage("people");setSelectedPerson(null)}}><Users size={16}/> People <span>{people.length}</span></button>
    </nav>
    {page==="home" && <>
      <section className="welcome"><div><p className="eyebrow">YOUR MONEY, IN FLOW</p><h1>Good day<span>.</span></h1><p className="muted">A clearer picture of your household finances.</p></div><div className="date-chip">{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div></section>
      <section className="summary-grid">
        <article className="balance-card"><div className="card-label"><Wallet size={17}/> CASH POSITION</div><strong>{money(totals.cash)}</strong><p>Cash movement across recorded entries</p><div className="balance-orb"/></article>
        <article className="stat-card"><span className="stat-icon income"><ArrowDownLeft size={18}/></span><p>TOTAL INCOME</p><strong>{money(totals.income)}</strong><small>Money received</small></article>
        <article className="stat-card"><span className="stat-icon expense"><ArrowUpRight size={18}/></span><p>TOTAL EXPENSES</p><strong>{money(totals.expense)}</strong><small>Money spent</small></article>
        <article className="stat-card"><span className="stat-icon loan"><HandCoins size={18}/></span><p>YOU ARE OWED</p><strong>{money(lentOutstanding)}</strong><small>Outstanding lent amount</small></article>
        <article className="stat-card"><span className="stat-icon debt"><BookOpen size={18}/></span><p>YOU OWE</p><strong>{money(borrowedOutstanding)}</strong><small>Outstanding borrowed amount</small></article><article className="stat-card"><span className="stat-icon loan"><Users size={18}/></span><p>SHARED EXPENSES OWED</p><strong>{money(totalSharedOwed)}</strong><small>Pending recoveries from people</small></article>
      </section>
      <section className="section-head"><div><p className="eyebrow">QUICK RECORD</p><h2>Keep your books updated</h2></div><button className="primary-btn" onClick={()=>setShowEntry(true)}><Plus size={17}/> Add entry</button></section>
      <div className="quick-grid"><button onClick={()=>{setType("income");setShowEntry(true)}}><span className="quick-icon income"><ArrowDownLeft size={18}/></span><b>Record income</b><small>Crop sale, rent, other</small></button><button onClick={()=>{setType("expense");setShowEntry(true)}}><span className="quick-icon expense"><ArrowUpRight size={18}/></span><b>Record expense</b><small>Household or farm costs</small></button><button onClick={()=>{setType("lent");setShowEntry(true)}}><span className="quick-icon loan"><HandCoins size={18}/></span><b>Money lent</b><small>Track what people owe</small></button><button onClick={()=>{setType("shared_expense");setShares([]);setShowEntry(true)}}><span className="quick-icon loan"><Users size={18}/></span><b>Shared expense</b><small>Pay now, recover later</small></button></div>
      <section className="section-head compact"><div><p className="eyebrow">LATEST RECORDS</p><h2>Recent activity</h2></div><button className="text-btn" onClick={()=>setPage("activity")}>View all <ChevronRight size={15}/></button></section>
      <EntryList entries={entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5)} people={people}/>
      <section className="coming"><div className="coming-icon"><Users size={20}/></div><div><strong>People in your khata</strong><p>{people.length ? `${people.length} people added to your records` : "Add people to start tracking personal ledgers."}</p></div><button className="text-btn" onClick={()=>setPage("people")}>Open <ChevronRight size={15}/></button></section>
    </>}
    {page==="activity" && <><section className="page-title"><p className="eyebrow">YOUR RECORD BOOK</p><h1>All activity<span>.</span></h1><p className="muted">Income, expenses, loans and repayments in one place.</p></section><div className="toolbar"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records or people"/></label><button className="primary-btn" onClick={()=>setShowEntry(true)}><Plus size={16}/> Add</button></div><EntryList entries={filtered} people={people}/></>}
    {page==="people" && <><section className="page-title"><p className="eyebrow">PERSONAL LEDGERS</p><h1>People<span>.</span></h1><p className="muted">Keep track of who owes you and whom you owe.</p></section><div className="section-head"><div><h2>People list</h2><p className="muted">{people.length} contacts</p></div><button className="primary-btn" onClick={()=>setShowPerson(true)}><Plus size={17}/> Add person</button></div>{people.length ? <div className="people-list">{people.map(p=>{const b=personBalance(p.id);return <button className="person-card" key={p.id} onClick={()=>setSelectedPerson(p.id)}><span className="avatar"><UserRound size={19}/></span><span className="person-main"><b>{p.name}</b><small>{p.phone || p.note || "Personal ledger"}</small></span><span className="person-balances"><small>OWED TO YOU</small><b className="positive">{money(b.lent)}</b><small>YOU OWE</small><b className="negative">{money(b.borrowed)}</b><small>SHARED EXPENSES</small><b className="positive">{money(b.shared)}</b></span><ChevronRight size={17}/></button>})}</div> : <div className="empty-panel"><Users size={28}/><b>No people added yet</b><p>Add a person to start their ledger and record loans or repayments.</p><button className="primary-btn" onClick={()=>setShowPerson(true)}><Plus size={16}/> Add first person</button></div>}</>}
    {selectedPerson && selected && <div className="modal-backdrop" onClick={()=>setSelectedPerson(null)}><section className="modal ledger-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">PERSONAL LEDGER</p><h2>{selected.name}</h2><p className="muted">{selected.phone || selected.note || "Account summary"}</p></div><button className="icon-btn" onClick={()=>setSelectedPerson(null)}><X size={18}/></button></div><div className="ledger-totals"><div><small>OWED TO YOU</small><b className="positive">{money(personBalance(selected.id).lent)}</b></div><div><small>YOU OWE</small><b className="negative">{money(personBalance(selected.id).borrowed)}</b></div><div><small>SHARED EXPENSES</small><b className="positive">{money(personBalance(selected.id).shared)}</b></div></div><div className="ledger-actions"><button className="primary-btn full-btn" onClick={()=>{setPersonId(selected.id);setType("lent");setTitle("");setAmount("");setSelectedPerson(null);setShowEntry(true)}}><Plus size={16}/> Record transaction with {selected.name}</button><button className="secondary-btn full-btn" disabled={personBalance(selected.id).shared<=0} onClick={()=>{setPersonId(selected.id);setType("shared_repayment_in");setTitle("Shared expense recovery");setAmount("");setSelectedPerson(null);setShowEntry(true)}}>Record shared expense recovery</button></div><h3>Ledger history</h3><EntryList entries={personEntries} people={people}/></section></div>}
    <footer>KHATAFLOW <span>·</span> Your accounts, organised.</footer>
    {showEntry && <div className="modal-backdrop" onClick={()=>setShowEntry(false)}><form className="modal" onSubmit={addEntry} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NEW RECORD</p><h2>Add transaction</h2></div><button type="button" className="icon-btn" onClick={()=>setShowEntry(false)}><X size={18}/></button></div><label>Transaction type<select value={type} onChange={e=>{setType(e.target.value as EntryType);setShares([]);setPersonId("");}}>{Object.entries(labels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Description<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Wheat sale, diesel, cash lent"/></label><label>Amount (₹)<input required type="number" min="1" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></label>{needsPerson && <label>Person<select required value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Choose a person</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{people.length===0 && <small className="form-hint">Add a person first in the People tab.</small>}</label>}{type==="shared_expense" && <section className="share-editor"><div className="share-editor-head"><b>Who owes a share?</b><small>Enter each person’s portion of this expense.</small></div>{shares.map((share,index)=><div className="share-row" key={index}><select aria-label="Person sharing expense" value={share.personId} onChange={e=>setShares(rows=>rows.map((x,i)=>i===index?{...x,personId:e.target.value}:x))}><option value="">Choose person</option>{people.filter(p=>!shares.some((x,i)=>i!==index && x.personId===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Share amount" type="number" min="0.01" step="0.01" placeholder="Share ₹" value={share.amount || ""} onChange={e=>setShares(rows=>rows.map((x,i)=>i===index?{...x,amount:Number(e.target.value)}:x))}/><button type="button" onClick={()=>setShares(rows=>rows.filter((_,i)=>i!==index))}>×</button></div>)}<button type="button" className="text-btn" onClick={()=>setShares(rows=>[...rows,{personId:"",amount:0}])}><Plus size={14}/> Add person’s share</button><p className="share-total">Allocated: {money(shares.reduce((sum,x)=>sum+x.amount,0))} · Your share: {money(Math.max(0,Number(amount||0)-shares.reduce((sum,x)=>sum+x.amount,0)))}</p>{people.length===0 && <small className="form-hint">Add people first in the People tab.</small>}</section>}{(type==="income"||type==="expense"||type==="shared_expense") && <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{["Farming","Crop sale","Household","Farm expense","Transport","Medical","Utilities","Other"].map(c=><option key={c}>{c}</option>)}</select></label>}<label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Note (optional)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Extra details"/></label><label>Bill / receipt attachments<input type="file" accept="image/*,application/pdf" multiple onChange={e=>setAttachmentFiles(Array.from(e.target.files ?? []))}/><small className="form-hint">Attach photos or PDFs. Up to 10 MB per file. Files stay on this device and are included in JSON backups.</small></label>{attachmentFiles.length>0 && <div className="selected-files">{attachmentFiles.map((file,i)=><span key={i}>{file.name} <button type="button" onClick={()=>setAttachmentFiles(files=>files.filter((_,n)=>n!==i))}>Remove</button></span>)}</div>}<button className="primary-btn submit-btn" type="submit" disabled={(needsPerson || type==="shared_expense") && people.length===0}>Save transaction</button><p className="privacy-note">Saved on this device. Export a backup regularly.</p></form></div>}
    {showPerson && <div className="modal-backdrop" onClick={()=>setShowPerson(false)}><form className="modal" onSubmit={addPerson} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NEW CONTACT</p><h2>Add a person</h2></div><button type="button" className="icon-btn" onClick={()=>setShowPerson(false)}><X size={18}/></button></div><label>Full name<input required autoFocus value={personName} onChange={e=>setPersonName(e.target.value)} placeholder="Person's name"/></label><label>Phone (optional)<input value={personPhone} onChange={e=>setPersonPhone(e.target.value)} placeholder="Mobile number"/></label><label>Note (optional)<input value={personNote} onChange={e=>setPersonNote(e.target.value)} placeholder="e.g. Neighbour, supplier"/></label><button className="primary-btn submit-btn" type="submit">Save person</button></form></div>}
  </main>;
}

function EntryList({entries,people}:{entries:Entry[];people:Person[]}) {
  if (!entries.length) return <div className="empty-panel"><ReceiptText size={26}/><b>No transactions yet</b><p>Your records will appear here once you add your first entry.</p></div>;
  return <section className="entries">{entries.map(e=>{const person=people.find(p=>p.id===e.personId)?.name;const positive=["income","borrowed","repayment_in","shared_repayment_in"].includes(e.type);return <article className="entry" key={e.id}><span className={"entry-icon "+(positive?"income":"expense")}>{e.category==="Farming"||e.category==="Crop sale"?<Sprout size={19}/>:positive?<ArrowDownLeft size={19}/>:<ArrowUpRight size={19}/>}</span><div className="entry-info"><strong>{e.title}</strong><small>{labels[e.type]}{person?" · "+person:""}{e.shares?.length ? " · "+e.shares.map(x=>`${people.find(p=>p.id===x.personId)?.name ?? "Person"} ${money(x.amount)}`).join(", ") : ""} · {new Date(e.date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</small>{e.note && <small>{e.note}</small>}{e.attachments?.length ? <AttachmentLinks attachments={e.attachments}/> : null}</div><strong className={positive?"positive":"negative"}>{positive?"+":"−"}{money(e.amount)}</strong></article>})}</section>;
}

function AttachmentLinks({attachments}:{attachments:AttachmentMeta[]}) { const [busy,setBusy]=useState(false); async function openFile(meta:AttachmentMeta) { setBusy(true); try { const stored=await getAttachment(meta.id); if(!stored) { alert("This attachment is not available on this device. It may be restored from a backup in a future update."); return; } const url=URL.createObjectURL(stored.blob); const a=document.createElement("a"); a.href=url; a.download=meta.name; a.target="_blank"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); } catch { alert("Could not open this attachment."); } finally { setBusy(false); } } return <div className="attachment-links">{attachments.map(meta=><button type="button" key={meta.id} disabled={busy} onClick={()=>openFile(meta)}><ReceiptText size={12}/>{meta.name}</button>)}</div>; }
