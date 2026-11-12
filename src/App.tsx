import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Search, Wallet, TrendingUp, Sprout, Users, Download, X } from "lucide-react";

type Entry = { id: string; title: string; category: string; type: "income" | "expense"; amount: number; date: string; note?: string };
const KEY = "khataflow.entries.v1";
const seed: Entry[] = [
  { id: "1", title: "Wheat sale", category: "Farming", type: "income", amount: 82500, date: new Date().toISOString().slice(0,10), note: "Crop income" },
  { id: "2", title: "Diesel", category: "Farm expense", type: "expense", amount: 4200, date: new Date().toISOString().slice(0,10) },
  { id: "3", title: "Household groceries", category: "Household", type: "expense", amount: 3650, date: new Date().toISOString().slice(0,10) }
];
function load(): Entry[] { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) as Entry[] : seed; } catch { return seed; } }
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(load);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income"|"expense">("income");
  const [category, setCategory] = useState("Farming");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const totals = useMemo(() => entries.reduce((a,e) => { a[e.type] += e.amount; return a; }, { income: 0, expense: 0 }), [entries]);
  const filtered = entries.filter(e => [e.title,e.category,e.note ?? ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  function save(next: Entry[]) { setEntries(next); localStorage.setItem(KEY, JSON.stringify(next)); }
  function addEntry(e: React.FormEvent) { e.preventDefault(); const value = Number(amount); if (!title.trim() || !value || value < 0) return; save([{ id: crypto.randomUUID(), title: title.trim(), category, type, amount: value, date }, ...entries]); setTitle(""); setAmount(""); setShowForm(false); }
  function exportData() { const blob = new Blob([JSON.stringify({ app: "KhataFlow", version: 1, entries }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "khataflow-backup.json"; a.click(); URL.revokeObjectURL(url); }
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">K</span><span>khataflow<small>HOUSEHOLD ACCOUNTS</small></span></a><button className="icon-btn" onClick={exportData} aria-label="Export backup"><Download size={18}/></button></header>
    <section className="welcome"><div><p className="eyebrow">YOUR MONEY, IN FLOW</p><h1>Good day<span>.</span></h1><p className="muted">A clearer picture of your household finances.</p></div><div className="date-chip">{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div></section>
    <section className="summary-grid">
      <article className="balance-card"><div className="card-label"><Wallet size={17}/> TOTAL BALANCE</div><strong>{money(totals.income - totals.expense)}</strong><p>Income minus expenses</p><div className="balance-orb"/></article>
      <article className="stat-card"><span className="stat-icon income"><ArrowDownLeft size={18}/></span><p>TOTAL INCOME</p><strong>{money(totals.income)}</strong><small><TrendingUp size={13}/> Money received</small></article>
      <article className="stat-card"><span className="stat-icon expense"><ArrowUpRight size={18}/></span><p>TOTAL EXPENSES</p><strong>{money(totals.expense)}</strong><small>Money spent</small></article>
    </section>
    <section className="section-head"><div><p className="eyebrow">ACTIVITY</p><h2>Recent transactions</h2></div><button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={17}/> Add entry</button></section>
    <div className="toolbar"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transactions"/></label><button className="filter-btn" onClick={exportData}>Export</button></div>
    <section className="entries">{filtered.length ? filtered.map(e=><article className="entry" key={e.id}><span className={"entry-icon "+e.type}>{e.category === "Farming" ? <Sprout size={19}/> : e.type === "income" ? <ArrowDownLeft size={19}/> : <ArrowUpRight size={19}/>}</span><div className="entry-info"><strong>{e.title}</strong><small>{e.category} · {new Date(e.date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small></div><strong className={e.type === "income" ? "positive" : "negative"}>{e.type === "income" ? "+" : "−"}{money(e.amount)}</strong></article>) : <div className="empty">No matching transactions found.</div>}</section>
    <section className="coming"><div className="coming-icon"><Users size={20}/></div><div><strong>People & ledgers</strong><p>Track money lent, borrowed and shared expenses.</p></div><span>COMING NEXT</span></section>
    <footer>KHATAFLOW <span>·</span> Your accounts, organised.</footer>
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="modal" onSubmit={addEntry} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NEW RECORD</p><h2>Add transaction</h2></div><button type="button" className="icon-btn" onClick={()=>setShowForm(false)}><X size={18}/></button></div><div className="type-switch"><button type="button" className={type==="income"?"selected":""} onClick={()=>setType("income")}>Income</button><button type="button" className={type==="expense"?"selected":""} onClick={()=>setType("expense")}>Expense</button></div><label>Description<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Wheat sale"/></label><label>Amount (₹)<input required type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{["Farming","Household","Farm expense","Transport","Medical","Other"].map(c=><option key={c}>{c}</option>)}</select></label><label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary-btn submit-btn" type="submit">Save transaction</button><p className="privacy-note">Saved on this device. Export a backup regularly.</p></form></div>}
  </main>;
}