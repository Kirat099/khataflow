import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Search, Wallet, TrendingUp, Sprout, Users, Download, X, HandCoins, ReceiptText, LayoutDashboard, BookOpen, UserRound, ChevronRight } from "lucide-react";

type Person = { id: string; name: string; phone?: string; note?: string; createdAt: string };
type EntryType = "income" | "expense" | "lent" | "borrowed" | "repayment_in" | "repayment_out";
type Entry = { id: string; title: string; category: string; type: EntryType; amount: number; date: string; personId?: string; note?: string };
const PEOPLE_KEY = "khataflow.people.v1";
const ENTRIES_KEY = "khataflow.entries.v2";
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().slice(0, 10);
const load = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const labels: Record<EntryType,string> = { income:"Income", expense:"Expense", lent:"Money lent", borrowed:"Money borrowed", repayment_in:"Repayment received", repayment_out:"Repayment paid" };
const signed = (t: EntryType) => ["income","borrowed","repayment_in"].includes(t) ? 1 : -1;

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
  const [personName, setPersonName] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [personNote, setPersonNote] = useState("");

  function savePeople(next: Person[]) { setPeople(next); localStorage.setItem(PEOPLE_KEY, JSON.stringify(next)); }
  function saveEntries(next: Entry[]) { setEntries(next); localStorage.setItem(ENTRIES_KEY, JSON.stringify(next)); }
  const totals = useMemo(() => entries.reduce((a,e) => {
    if (e.type === "income") a.income += e.amount;
    if (e.type === "expense") a.expense += e.amount;
    if (e.type === "lent") a.lent += e.amount;
    if (e.type === "borrowed") a.borrowed += e.amount;
    if (e.type === "repayment_in") a.repaidIn += e.amount;
    if (e.type === "repayment_out") a.repaidOut += e.amount;
    a.cash += signed(e.type) * e.amount;
    return a;
  }, { income:0, expense:0, lent:0, borrowed:0, repaidIn:0, repaidOut:0, cash:0 }), [entries]);
  const lentOutstanding = totals.lent - totals.repaidIn;
  const borrowedOutstanding = totals.borrowed - totals.repaidOut;
  const needsPerson = ["lent","borrowed","repayment_in","repayment_out"].includes(type);
  const personBalance = (id: string) => entries.reduce((a,e) => {
    if (e.personId !== id) return a;
    if (e.type === "lent") a.lent += e.amount;
    if (e.type === "repayment_in") a.lent -= e.amount;
    if (e.type === "borrowed") a.borrowed += e.amount;
    if (e.type === "repayment_out") a.borrowed -= e.amount;
    return a;
  }, { lent:0, borrowed:0 });
  const filtered = entries.filter(e => {
    const person = people.find(p=>p.id===e.personId)?.name ?? "";
    return [e.title,e.category,e.note ?? "",person,labels[e.type]].join(" ").toLowerCase().includes(query.toLowerCase());
  }).sort((a,b)=>b.date.localeCompare(a.date));
  const personEntries = selectedPerson ? filtered.filter(e=>e.personId===selectedPerson) : [];
  function resetEntry() { setTitle(""); setAmount(""); setNote(""); setPersonId(""); setType("income"); setCategory("Farming"); setDate(today()); }
  function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!title.trim() || !Number.isFinite(value) || value <= 0) return;
    if (needsPerson && !personId) return;
    if (type === "repayment_in" && personBalance(personId).lent < value) { alert("Repayment is greater than this person's outstanding amount owed to you."); return; }
    if (type === "repayment_out" && personBalance(personId).borrowed < value) { alert("Repayment is greater than your outstanding amount owed to this person."); return; }
    const entry: Entry = { id: crypto.randomUUID(), title:title.trim(), category, type, amount:value, date, personId:needsPerson ? personId : undefined, note:note.trim() || undefined };
    saveEntries([entry,...entries]); resetEntry(); setShowEntry(false);
  }
  function addPerson(e: React.FormEvent) {
    e.preventDefault(); if (!personName.trim()) return;
    savePeople([{ id:crypto.randomUUID(), name:personName.trim(), phone:personPhone.trim() || undefined, note:personNote.trim() || undefined, createdAt:today() },...people]);
    setPersonName(""); setPersonPhone(""); setPersonNote(""); setShowPerson(false);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ app:"KhataFlow", version:2, exportedAt:new Date().toISOString(), people, entries },null,2)],{type:"application/json"});
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
        <article className="stat-card"><span className="stat-icon debt"><BookOpen size={18}/></span><p>YOU OWE</p><strong>{money(borrowedOutstanding)}</strong><small>Outstanding borrowed amount</small></article>
      </section>
      <section className="section-head"><div><p className="eyebrow">QUICK RECORD</p><h2>Keep your books updated</h2></div><button className="primary-btn" onClick={()=>setShowEntry(true)}><Plus size={17}/> Add entry</button></section>
      <div className="quick-grid"><button onClick={()=>{setType("income");setShowEntry(true)}}><span className="quick-icon income"><ArrowDownLeft size={18}/></span><b>Record income</b><small>Crop sale, rent, other</small></button><button onClick={()=>{setType("expense");setShowEntry(true)}}><span className="quick-icon expense"><ArrowUpRight size={18}/></span><b>Record expense</b><small>Household or farm costs</small></button><button onClick={()=>{setType("lent");setShowEntry(true)}}><span className="quick-icon loan"><HandCoins size={18}/></span><b>Money lent</b><small>Track what people owe</small></button></div>
      <section className="section-head compact"><div><p className="eyebrow">LATEST RECORDS</p><h2>Recent activity</h2></div><button className="text-btn" onClick={()=>setPage("activity")}>View all <ChevronRight size={15}/></button></section>
      <EntryList entries={entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5)} people={people}/>
      <section className="coming"><div className="coming-icon"><Users size={20}/></div><div><strong>People in your khata</strong><p>{people.length ? `${people.length} people added to your records` : "Add people to start tracking personal ledgers."}</p></div><button className="text-btn" onClick={()=>setPage("people")}>Open <ChevronRight size={15}/></button></section>
    </>}
    {page==="activity" && <><section className="page-title"><p className="eyebrow">YOUR RECORD BOOK</p><h1>All activity<span>.</span></h1><p className="muted">Income, expenses, loans and repayments in one place.</p></section><div className="toolbar"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records or people"/></label><button className="primary-btn" onClick={()=>setShowEntry(true)}><Plus size={16}/> Add</button></div><EntryList entries={filtered} people={people}/></>}
    {page==="people" && <><section className="page-title"><p className="eyebrow">PERSONAL LEDGERS</p><h1>People<span>.</span></h1><p className="muted">Keep track of who owes you and whom you owe.</p></section><div className="section-head"><div><h2>People list</h2><p className="muted">{people.length} contacts</p></div><button className="primary-btn" onClick={()=>setShowPerson(true)}><Plus size={17}/> Add person</button></div>{people.length ? <div className="people-list">{people.map(p=>{const b=personBalance(p.id);return <button className="person-card" key={p.id} onClick={()=>setSelectedPerson(p.id)}><span className="avatar"><UserRound size={19}/></span><span className="person-main"><b>{p.name}</b><small>{p.phone || p.note || "Personal ledger"}</small></span><span className="person-balances"><small>OWED TO YOU</small><b className="positive">{money(b.lent)}</b><small>YOU OWE</small><b className="negative">{money(b.borrowed)}</b></span><ChevronRight size={17}/></button>})}</div> : <div className="empty-panel"><Users size={28}/><b>No people added yet</b><p>Add a person to start their ledger and record loans or repayments.</p><button className="primary-btn" onClick={()=>setShowPerson(true)}><Plus size={16}/> Add first person</button></div>}</>}
    {selectedPerson && selected && <div className="modal-backdrop" onClick={()=>setSelectedPerson(null)}><section className="modal ledger-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">PERSONAL LEDGER</p><h2>{selected.name}</h2><p className="muted">{selected.phone || selected.note || "Account summary"}</p></div><button className="icon-btn" onClick={()=>setSelectedPerson(null)}><X size={18}/></button></div><div className="ledger-totals"><div><small>OWED TO YOU</small><b className="positive">{money(personBalance(selected.id).lent)}</b></div><div><small>YOU OWE</small><b className="negative">{money(personBalance(selected.id).borrowed)}</b></div></div><button className="primary-btn full-btn" onClick={()=>{setPersonId(selected.id);setType("lent");setTitle("");setAmount("");setSelectedPerson(null);setShowEntry(true)}}><Plus size={16}/> Record transaction with {selected.name}</button><h3>Ledger history</h3><EntryList entries={personEntries} people={people}/></section></div>}
    <footer>KHATAFLOW <span>·</span> Your accounts, organised.</footer>
    {showEntry && <div className="modal-backdrop" onClick={()=>setShowEntry(false)}><form className="modal" onSubmit={addEntry} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NEW RECORD</p><h2>Add transaction</h2></div><button type="button" className="icon-btn" onClick={()=>setShowEntry(false)}><X size={18}/></button></div><label>Transaction type<select value={type} onChange={e=>setType(e.target.value as EntryType)}>{Object.entries(labels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Description<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Wheat sale, diesel, cash lent"/></label><label>Amount (₹)<input required type="number" min="1" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></label>{needsPerson && <label>Person<select required value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Choose a person</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{people.length===0 && <small className="form-hint">Add a person first in the People tab.</small>}</label>}{(type==="income"||type==="expense") && <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{["Farming","Crop sale","Household","Farm expense","Transport","Medical","Utilities","Other"].map(c=><option key={c}>{c}</option>)}</select></label>}<label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Note (optional)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Extra details"/></label><button className="primary-btn submit-btn" type="submit" disabled={needsPerson && people.length===0}>Save transaction</button><p className="privacy-note">Saved on this device. Export a backup regularly.</p></form></div>}
    {showPerson && <div className="modal-backdrop" onClick={()=>setShowPerson(false)}><form className="modal" onSubmit={addPerson} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NEW CONTACT</p><h2>Add a person</h2></div><button type="button" className="icon-btn" onClick={()=>setShowPerson(false)}><X size={18}/></button></div><label>Full name<input required autoFocus value={personName} onChange={e=>setPersonName(e.target.value)} placeholder="Person's name"/></label><label>Phone (optional)<input value={personPhone} onChange={e=>setPersonPhone(e.target.value)} placeholder="Mobile number"/></label><label>Note (optional)<input value={personNote} onChange={e=>setPersonNote(e.target.value)} placeholder="e.g. Neighbour, supplier"/></label><button className="primary-btn submit-btn" type="submit">Save person</button></form></div>}
  </main>;
}

function EntryList({entries,people}:{entries:Entry[];people:Person[]}) {
  if (!entries.length) return <div className="empty-panel"><ReceiptText size={26}/><b>No transactions yet</b><p>Your records will appear here once you add your first entry.</p></div>;
  return <section className="entries">{entries.map(e=>{const person=people.find(p=>p.id===e.personId)?.name;const positive=["income","borrowed","repayment_in"].includes(e.type);return <article className="entry" key={e.id}><span className={"entry-icon "+(positive?"income":"expense")}>{e.category==="Farming"||e.category==="Crop sale"?<Sprout size={19}/>:positive?<ArrowDownLeft size={19}/>:<ArrowUpRight size={19}/>}</span><div className="entry-info"><strong>{e.title}</strong><small>{labels[e.type]}{person?" · "+person:""} · {new Date(e.date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</small></div><strong className={positive?"positive":"negative"}>{positive?"+":"−"}{money(e.amount)}</strong></article>})}</section>;
}
