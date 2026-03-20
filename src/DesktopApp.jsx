import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signOut, db } from "./lib/supabase";
import {
  useAuth, useRole, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner
} from "./shared";

// ── NAVIGATION ─────────────────────────────────────────────────────────────────
const NAV = [
  { to: "/", label: "Dashboard", icon: "⬛" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/yards", label: "Yards", icon: "🏗️" },
  { to: "/deals", label: "Deals", icon: "🤝" },
  { to: "/transit", label: "Transit", icon: "🚛" },
  { to: "/suppliers", label: "Suppliers", icon: "🏭" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/financials", label: "Financials", icon: "📊" },
  { to: "/reports", label: "Reports", icon: "📄" },
  { to: "/company", label: "Company", icon: "🏢" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

// ── SIDEBAR ────────────────────────────────────────────────────────────────────

const Sidebar = ({ onSignOut, role = "admin" }) => (
  <div className="w-52 bg-gray-900 text-white flex-col min-h-screen fixed top-0 left-0 hidden md:flex">
    <div className="px-4 py-5 border-b border-gray-700/50">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-blue-900/50">⚓</div>
        <div>
          <div className="text-sm font-black tracking-tight text-white">Dockside</div>
          <div className="text-xs text-gray-500">Timber Trade OS</div>
        </div>
      </div>
    </div>
    <nav className="flex-1 py-3 px-2">
      {NAV.filter(n => {
        if (role === "worker") return ["/inventory","/transit"].includes(n.to);
        return true;
      }).map(n => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"}
          className={({ isActive }) => cls(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all",
            isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
          )}>
          <span className="text-base">{n.icon}</span>{n.label}
        </NavLink>
      ))}
      {role === "worker" && (
        <div className="mt-3 px-3 py-2 bg-orange-900/30 rounded-lg">
          <p className="text-xs text-orange-400 font-semibold">Worker Account</p>
          <p className="text-xs text-gray-500">Limited access</p>
        </div>
      )}
    </nav>
    <div className="p-3 border-t border-gray-700 space-y-1">
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-gray-500">
        <span>Search</span><span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Ctrl+K</span>
      </div>
      <button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
        <span>🚪</span> Sign Out
      </button>
    </div>
  </div>
);

const BOTTOM_TABS = [
  { to: "/",           label: "Home",    icon: "🏠" },
  { to: "/inventory",  label: "Stock",   icon: "📦" },
  { to: "/deals",      label: "Deals",   icon: "🤝" },
  { to: "/transit",    label: "Transit", icon: "🚛" },
  { to: "/ai-insights",label: "Insights",icon: "📊" },
];


// ── PAGES ──────────────────────────────────────────────────────────────────────
// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
function GlobalSearch({ inventory, deals, customers, onClose }) {
  const [q, setQ] = useState("");
  const inputRef  = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = q.trim().length < 2 ? [] : [
    ...inventory.filter(i => (i.product_name||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(i => ({ type:"stock", label: i.product_name, sub: (i.category||"") + " · " + (i.available_quantity||0) + " " + (i.unit||""), id: i.id })),
    ...deals.filter(d => (d.customer_name||"").toLowerCase().includes(q.toLowerCase()) || (d.deal_number||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(d => ({ type:"deal", label: d.customer_name || d.deal_number, sub: "Deal · " + fmt(d.total_value), id: d.id })),
    ...customers.filter(c => (c.name||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(c => ({ type:"customer", label: c.name, sub: c.city || "", id: c.id })),
  ];

  const typeIcon = t => t === "stock" ? "📦" : t === "deal" ? "🤝" : "👥";
  const typeBadge = t => t === "stock" ? "Inventory" : t === "deal" ? "Deal" : "Customer";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <span className="text-gray-400 text-lg">🔍</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search inventory, deals, customers..."
            className="flex-1 text-base outline-none text-gray-800 placeholder-gray-300" />
          <button onClick={onClose} className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded font-mono">Esc</button>
        </div>
        {results.length > 0 ? (
          <div className="py-2 max-h-80 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                <span className="text-xl">{typeIcon(r.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{r.label}</p>
                  <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                </div>
                <span className="text-xs text-gray-300 bg-gray-100 px-2 py-0.5 rounded-full">{typeBadge(r.type)}</span>
              </div>
            ))}
          </div>
        ) : q.trim().length >= 2 ? (
          <div className="px-4 py-8 text-center text-gray-300 text-sm">No results for "{q}"</div>
        ) : (
          <div className="px-4 py-6 text-center text-gray-300 text-sm">Type at least 2 characters to search</div>
        )}
        <div className="px-4 py-2 border-t border-gray-50 flex gap-4 text-xs text-gray-300">
          <span>📦 Inventory</span><span>🤝 Deals</span><span>👥 Customers</span>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const role    = useRole();
  const isAdmin = role !== "worker";
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);
  const DEAD_STOCK_DAYS = 45; // configurable threshold

  useEffect(() => {
    if (!companyId) return;
    sb.from("inventory").select("*").eq("company_id", companyId).order("created_at",{ascending:false}).then(r => setInv(r.data || []));
    sb.from("deals").select("*").eq("company_id", companyId).order("created_at",{ascending:false}).then(r => setDeals(r.data || []));
    sb.from("shipments").select("*").eq("company_id", companyId).order("created_at",{ascending:false}).then(r => setShips(r.data || []));
    sb.from("yards").select("*").eq("company_id", companyId).then(r => setYards(r.data || []));
  }, [companyId]);

  const totalValue = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const totalVolume = inv.reduce((s, i) => s + (i.available_quantity || 0), 0);
  const activeShips = ships.filter(s => s.status !== "Delivered").length;
  const activeYards = yards.filter(y => y.is_active !== false).length;
  const catMap = {};
  inv.forEach(i => { const c = i.category || "Other"; catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];
  const months = ["Oct","Nov","Dec","Jan","Feb","Mar"];
  const chartData = months.map((m, i) => ({
    month: m,
    revenue: Math.round(totalValue * (0.05 + i * 0.01)),
    cost: Math.round(totalValue * (0.03 + i * 0.005)),
  }));

  const pendingPay = deals.filter(d => d.payment_status === "Pending").length;


  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      {/* ── Mobile Hero Banner ── */}
      <div className="md:hidden px-4 pt-4 pb-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)"}}>
        <p className="text-blue-300 text-xs mb-1">Total Inventory Value</p>
        <p className="text-3xl font-black text-white">{fmt(totalValue)}</p>
        <div className="flex gap-4 mt-3">
          <div><p className="text-blue-300 text-xs">Products</p><p className="text-white font-bold">{inv.length}</p></div>
          <div><p className="text-blue-300 text-xs">Active Yards</p><p className="text-white font-bold">{activeYards}</p></div>
          <div><p className="text-blue-300 text-xs">Shipments</p><p className="text-white font-bold">{activeShips}</p></div>
          <div><p className="text-blue-300 text-xs">Deals</p><p className="text-white font-bold">{deals.length}</p></div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Desktop heading */}
        <div className="hidden md:block"><h1 className="text-2xl font-black text-gray-800">Command Center</h1><p className="text-gray-400 text-sm">Live business overview</p></div>

        {/* ── Mobile Quick Actions ── */}
        <div className="md:hidden grid grid-cols-2 gap-3">
          {[
            { label:"Inventory Value", value: fmt(totalValue), sub: `${inv.length} products`, color:"bg-blue-600", icon:"📦" },
            { label:"Pending Payments", value: pendingPay, sub: `of ${deals.length} deals`, color:"bg-orange-500", icon:"⏳" },
            { label:"Active Shipments", value: activeShips, sub: "in transit", color:"bg-green-600", icon:"🚛" },
            { label:"Active Yards", value: activeYards, sub: "locations", color:"bg-purple-600", icon:"🏗️" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{c.icon}</span>
                <span className={cls("text-xs text-white font-bold px-2 py-0.5 rounded-full", c.color)}>{c.label}</span>
              </div>
              <p className="text-2xl font-black text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Dead stock alert - desktop */}
        {isAdmin && deadStock.length > 0 && (
          <div className="hidden md:block mb-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-black text-amber-800">Dead Stock Alert — {deadStock.length} items idle {DEAD_STOCK_DAYS}+ days</p>
                  <p className="text-xs text-amber-600">Total at-risk value: {fmt(deadStock.reduce((s,i)=>(s+(i.cost_price||0)*(i.available_quantity||0)),0))}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {deadStock.slice(0,3).map(i => (
                  <div key={i.id} className="bg-white rounded-xl p-3 border border-amber-100">
                    <p className="font-bold text-gray-800 text-sm truncate">{i.product_name}</p>
                    <p className="text-xs text-gray-400">{i.available_quantity} {i.unit} · {yards.find(y=>y.id===i.yard_id)?.name||"—"}</p>
                    <p className="text-xs text-amber-600 font-semibold mt-1">{Math.floor((nowTs-new Date(i.last_movement_at||i.date||i.created_at).getTime())/(1000*60*60*24))} days idle</p>
                    <p className="text-xs text-amber-500 mt-1">Tip: Discount or transfer to active yard</p>
                  </div>
                ))}
              </div>
              {deadStock.length > 3 && <p className="text-xs text-center text-amber-400 mt-2">+{deadStock.length-3} more — check Inventory page</p>}
            </div>
          </div>
        )}

        {/* Desktop stat grid */}
        <div className="hidden md:grid grid-cols-4 gap-4">
          <StatCard label="Inventory Value" value={fmt(totalValue)} icon="📦" color="blue" />
          <StatCard label="Total Volume" value={`${Math.round(totalVolume)} units`} icon="📊" color="green" />
          <StatCard label="Active Shipments" value={activeShips} icon="🚛" color="orange" />
          <StatCard label="Active Yards" value={activeYards} icon="🏗️" color="purple" />
          <StatCard label="Total Deals" value={deals.length} icon="🤝" color="green" />
          <StatCard label="Total Products" value={inv.length} icon="🪵" color="orange" />
          <StatCard label="Pending Payments" value={pendingPay} icon="⏳" color="purple" />
          <StatCard label="Delivered" value={ships.filter(s => s.status === "Delivered").length} icon="✅" color="blue" />
        </div>

        {/* ── Recent Activity (mobile) ── */}
        {inv.length > 0 && (
          <div className="md:hidden">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent Stock</p>
            <div className="space-y-2">
              {inv.slice(0,3).map(i => (
                <div key={i.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between shadow-sm border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{i.product_name}</p>
                    <p className="text-xs text-gray-400">{i.category} · {i.wood_type || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-blue-700">{fmt((i.cost_price||0)*(i.available_quantity||0))}</p>
                    <p className="text-xs text-gray-400">{i.available_quantity} {i.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">Revenue vs Cost (6M)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v} width={40} />
                <Tooltip formatter={v => fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#dbeafe" name="Revenue" />
                <Area type="monotone" dataKey="cost" stroke="#f59e0b" fill="#fef3c7" name="Cost" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">Inventory by Category</h3>
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No data yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── INVENTORY ──────────────────────────────────────────────────────────────────
function Inventory() {
  const { companyId } = useAuth();
  const role = useRole();
  const isAdmin = role !== "worker";
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd]     = useState(false);
  const [selected, setSelected]   = useState(null);  // row detail panel
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [timberType, setTimberType] = useState("Sawn Timber");
  const INV_DEFAULTS = {
    product_name:"", category:"Plywood", wood_type:"", grade:"A Grade",
    yard_id:"", supplier_id:"", unit:"CFT", cost_price:"", market_value:"",
    available_quantity:"", date: today(), notes:"",
    thickness_mm:"", width_mm:"", length_ft:"", pieces:"",
    girth_in:"", log_length_ft:"", num_logs:"",
    sheet_thickness_mm:"", sheet_width_ft:"4", sheet_length_ft:"8", num_sheets:"",
  };
  const [form, setForm] = useState(INV_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const calc = (() => {
    if (timberType === "Sawn Timber") return TM.sawnCFT(+form.thickness_mm, +form.width_mm, +form.length_ft, +form.pieces || 1);
    if (timberType === "Round Log") return TM.hoppusCFT(+form.girth_in, +form.log_length_ft, +form.num_logs || 1);
    if (timberType === "Plywood") return TM.plywoodCBM(+form.sheet_thickness_mm, +form.sheet_width_ft, +form.sheet_length_ft, +form.num_sheets || 1);
    return null;
  })();

  useEffect(() => {
    if (!calc) return;
    const vol = timberType === "Plywood" ? calc.totalCBM : calc.totalCFT;
    const unit = timberType === "Plywood" ? "CBM" : "CFT";
    setForm(p => ({...p, available_quantity: vol || "", unit}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timberType, form.thickness_mm, form.width_mm, form.length_ft, form.pieces, form.girth_in, form.log_length_ft, form.num_logs, form.sheet_thickness_mm, form.sheet_width_ft, form.sheet_length_ft, form.num_sheets]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        sb.from("inventory").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId).order("name"),
        sb.from("suppliers").select("*").eq("company_id", companyId).order("name"),
      ]);
      setItems(a.data || []); setYards(b.data || []); setSuppliers(c.data || []);
    } catch(e) { console.error("Inventory fetch:", e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeInv = () => { setShowAdd(false); setForm(INV_DEFAULTS); setErr(""); setTimberType("Sawn Timber"); };
  const save = async () => {
    if (!form.product_name.trim()) { setErr("Product name required"); return; }
    setSaving(true); setErr("");
    const yard = yards.find(y => y.id === form.yard_id);
    const sup = suppliers.find(s => s.id === form.supplier_id);
    try {
      const { error } = await sb.from("inventory").insert([{
        company_id: companyId,
        product_name: form.product_name.trim(),
        category: form.category || null,
        wood_type: form.wood_type || null,
        quality_grade: form.grade || form.quality_grade || null,
        yard_id: form.yard_id || null,
        yard_name: yard?.name || null,
        supplier_id: form.supplier_id || null,
        supplier_name: sup?.name || null,
        unit: form.unit || "pcs",
        cost_price: parseNum(form.cost_price) || 0,
        market_value: parseNum(form.market_value) || 0,
        available_quantity: parseNum(form.available_quantity) || 0,
        total_quantity: parseNum(form.available_quantity) || 0,
        reserved_quantity: 0,
        date: form.date || today(),
        notes: form.notes || null,
        thickness_mm: parseNum(form.thickness_mm),
        width_mm: parseNum(form.width_mm),
        length_ft: parseNum(form.length_ft),
        pieces: parseNum(form.pieces),
        girth_in: parseNum(form.girth_in),
        log_length_ft: parseNum(form.log_length_ft),
        num_logs: parseNum(form.num_logs),
        sheet_thickness_mm: parseNum(form.sheet_thickness_mm),
        sheet_width_ft: parseNum(form.sheet_width_ft),
        sheet_length_ft: parseNum(form.sheet_length_ft),
        num_sheets: parseNum(form.num_sheets),
      }]);
      if (error) throw error;
      closeInv(); fetchAll();
    } catch (e) { setErr(e.message || JSON.stringify(e)); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));

  const totalInvValue = filtered.reduce((s,i) => s + (i.cost_price||0)*(i.available_quantity||0), 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      {/* ── Mobile Header ── */}
      <div className="md:hidden sticky top-14 z-20 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-black text-gray-900">Inventory</h1>
            <p className="text-xs text-gray-400">{items.length} products · {fmt(totalInvValue)}</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm shadow-blue-200 active:scale-95 transition-all">
            + Add Stock
          </button>
        </div>
        <input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* ── Desktop Header ── */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Inventory</h1><p className="text-gray-400 text-sm">{items.length} products</p></div>
        <div className="flex gap-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── MOBILE: Card List ── */}
          <div className="md:hidden px-4 pb-4 space-y-3 mt-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <p className="text-4xl mb-3">📦</p>
                <p>No inventory yet. Tap + Add to get started.</p>
              </div>
            ) : filtered.map(i => (
              <div key={i.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 pr-2">
                    <p className="font-black text-gray-900 text-base leading-tight">{i.product_name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {i.category && <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{i.category}</span>}
                      {i.wood_type && <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">{i.wood_type}</span>}
                      {i.grade && <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">{i.grade}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-blue-700 text-lg">{fmt((i.cost_price||0)*(i.available_quantity||0))}</p>
                    <p className="text-xs text-gray-400">Total value</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Volume</p>
                    <p className="font-black text-gray-800">{i.available_quantity || 0}</p>
                    <p className="text-xs text-gray-400">{i.unit || "pcs"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Rate</p>
                    <p className="font-bold text-green-700 text-sm">{fmt(i.cost_price)}</p>
                    <p className="text-xs text-gray-400">per {i.unit || "unit"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Yard</p>
                    <p className="font-semibold text-gray-700 text-xs leading-tight">{yards.find(y => y.id === i.yard_id)?.name || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP: Table ── */}
          <div className="hidden md:block px-6 pb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{["Product","Type","Wood / Species","Grade","Yard","Volume","Unit","Cost/Unit","Total Value"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}
                      onClick={() => setSelected(i)}
                      className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{i.product_name || "—"}</div>
                        {i.stock_status && (
                          <span className={cls("text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block",
                            i.stock_status === "Available" ? "bg-green-100 text-green-700" :
                            i.stock_status === "Reserved"  ? "bg-orange-100 text-orange-700" :
                            "bg-gray-100 text-gray-500")}>
                            {i.stock_status || "Available"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{i.wood_type || "—"}</td>
                      <td className="px-4 py-3"><Badge text={i.quality_grade || i.grade || "—"} /></td>
                      <td className="px-4 py-3 text-gray-500">{yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{i.available_quantity || 0}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i.unit || "pcs"}</td>
                      {isAdmin ? (
                        <td className="px-4 py-3 font-semibold text-green-700">{fmt(i.cost_price)}</td>
                      ) : (
                        <td className="px-4 py-3 text-gray-300 text-xs">—</td>
                      )}
                      <td className="px-4 py-3 font-bold text-blue-700">{fmt((i.cost_price||0)*(i.available_quantity||0))}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No inventory found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {/* ── INVENTORY DETAIL PANEL ── */}
      <SlidePanel title="Stock Detail" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const yardName = yards.find(y => y.id === selected.yard_id)?.name || "—";
          const totalVal = (selected.cost_price||0)*(selected.available_quantity||0);
          const margin   = selected.cost_price && selected.market_value
            ? (((selected.market_value - selected.cost_price) / selected.cost_price) * 100).toFixed(1)
            : null;
          const statusColor = s => s === "Available" ? "green" : s === "Reserved" ? "orange" : "gray";
          return (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900 leading-tight">{selected.product_name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{selected.wood_type || "—"} · {selected.category || "—"}</p>
                </div>
                <Badge text={selected.stock_status || "Available"} color={statusColor(selected.stock_status)} />
              </div>

              {/* Volume + Yard */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-400 mb-1">Volume</p>
                  <p className="font-black text-blue-700 text-xl">{selected.available_quantity || 0}</p>
                  <p className="text-xs text-blue-400">{selected.unit || "pcs"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Grade</p>
                  <p className="font-bold text-gray-700">{selected.quality_grade || selected.grade || "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Yard</p>
                  <p className="font-bold text-gray-700 text-xs leading-tight">{yardName}</p>
                </div>
              </div>

              {/* Pricing — admin only */}
              {isAdmin ? (
                <div className="bg-gray-900 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Financials (Admin Only)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-400">Cost / unit</p>
                      <p className="font-black text-white">{fmt(selected.cost_price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Market / unit</p>
                      <p className="font-black text-green-400">{fmt(selected.market_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Margin</p>
                      <p className="font-black text-yellow-400">{margin ? margin + "%" : "—"}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 mt-3 pt-3 flex justify-between">
                    <span className="text-xs text-gray-400">Total Stock Value</span>
                    <span className="font-black text-white text-lg">{fmt(totalVal)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 text-center text-gray-400 text-sm">
                  Pricing details visible to admins only
                </div>
              )}

              {/* Movement Timeline */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Movement Timeline</p>
                {[
                  { label: "Created", done: true, date: selected.date || selected.created_at },
                  { label: "In Yard", done: true, date: null },
                  { label: "Reserved", done: selected.stock_status === "Reserved" || selected.stock_status === "Sold", date: null },
                  { label: "Dispatched", done: selected.stock_status === "Sold", date: null },
                  { label: "Delivered", done: false, date: null },
                ].map((step, idx) => (
                  <div key={step.label} className="flex items-start gap-3 mb-2">
                    <div className={cls("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                      step.done ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white")}>
                      {step.done && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className={cls("text-sm font-semibold", step.done ? "text-gray-800" : "text-gray-300")}>{step.label}</p>
                      {step.date && <p className="text-xs text-gray-400">{fmtDate(step.date)}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Details</p>
                <DetailRow label="Supplier" value={selected.supplier_name} />
                <DetailRow label="Added" value={fmtDate(selected.date || selected.created_at)} />
                {selected.thickness_mm && <DetailRow label="Thickness" value={selected.thickness_mm + " mm"} />}
                {selected.width_mm && <DetailRow label="Width" value={selected.width_mm + " mm"} />}
                {selected.length_ft && <DetailRow label="Length" value={selected.length_ft + " ft"} />}
                {selected.pieces && <DetailRow label="Pieces" value={selected.pieces} />}
                {selected.girth_in && <DetailRow label="Girth" value={selected.girth_in + " in"} />}
                {selected.notes && <DetailRow label="Notes" value={selected.notes} />}
              </div>
            </>
          );
        })()}
      </SlidePanel>

      <SlidePanel title="Add Stock" open={showAdd} onClose={closeInv} wide>
        {/* Live Math sticky header - shows volume as you type */}
        {calc && (
          <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-2 bg-gray-900 text-white flex items-center justify-between shadow-md">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Live Calculation</p>
              <p className="text-2xl font-black text-white">
                {timberType === "Plywood" ? `${calc.totalCBM} CBM` : `${calc.totalCFT} CFT`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{timberType === "Plywood" ? `${calc.totalCFT} CFT` : `${calc.totalCBM} m³`}</p>
              <p className="text-xs text-green-400 mt-0.5">Auto-calculated ✓</p>
            </div>
          </div>
        )}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Timber Type</p>
          <div className="flex gap-2">
            {["Sawn Timber","Round Log","Plywood","Other"].map(t => (
              <button key={t} onClick={() => setTimberType(t)} className={cls(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                timberType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              )}>{t}</button>
            ))}
          </div>
        </div>
        <Field label="Product Name" required>
          <Input value={form.product_name} onChange={set("product_name")} placeholder={
            timberType === "Sawn Timber" ? "e.g. Gurjan Sawn 18mm" :
            timberType === "Round Log" ? "e.g. Teak Round Log" :
            timberType === "Plywood" ? "e.g. BWR Plywood 18mm" : "Product name"
          } />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              <option>Plywood</option><option>Hardwood</option><option>Softwood</option>
              <option>Veneer</option><option>MDF</option><option>Particle Board</option><option>Round Log</option>
            </Select>
          </Field>
          <Field label="Wood / Species">
            <Select value={form.wood_type} onChange={set("wood_type")}>
              <option value="">— Select —</option>
              {["Teak (Sagwan)","Gurjan","Pine","Eucalyptus","Rubber Wood","Burma Teak","Hardwood (Mixed)","Softwood (Mixed)","Merbau","Oak","Sal","Shisham"].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Grade">
            <Select value={form.grade} onChange={set("grade")}>
              <option>A Grade</option><option>B Grade</option><option>C Grade</option>
              <option>FAS</option><option>Select</option><option>Common</option><option>Industrial</option>
            </Select>
          </Field>
          <Field label="Yard">
            <Select value={form.yard_id} onChange={set("yard_id")}>
              <option value="">— Select Yard —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
        </div>
        {timberType === "Sawn Timber" && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">📐 Auto-calculates CFT</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="Thickness (mm)">
                <Select value={form.thickness_mm} onChange={set("thickness_mm")}>
                  <option value="">— Select —</option>
                  {[3,4,6,9,12,15,18,19,25,32,38,50,75,100].map(t => <option key={t} value={t}>{t} mm</option>)}
                </Select>
              </Field>
              <Field label="Width (mm)"><Input type="number" value={form.width_mm} onChange={set("width_mm")} placeholder="e.g. 150" /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Length (ft)"><Input type="number" value={form.length_ft} onChange={set("length_ft")} placeholder="e.g. 8" /></Field>
              <Field label="No. of Pieces"><Input type="number" value={form.pieces} onChange={set("pieces")} placeholder="e.g. 100" /></Field>
            </div>
            {calc && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border border-blue-100"><p className="text-xs text-blue-400">Per Piece</p><p className="font-bold text-blue-700 text-sm">{calc.cftPer} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-blue-100"><p className="text-xs text-blue-400">Total CFT</p><p className="font-bold text-blue-700 text-sm">{calc.totalCFT} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-blue-100"><p className="text-xs text-blue-400">Total CBM</p><p className="font-bold text-blue-700 text-sm">{calc.totalCBM} m³</p></div>
              </div>
            )}
          </div>
        )}
        {timberType === "Round Log" && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">🪵 Hoppus CFT Calculator</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="Mid-point Girth (inches)"><Input type="number" value={form.girth_in} onChange={set("girth_in")} placeholder="e.g. 36" /></Field>
              <Field label="Log Length (ft)"><Input type="number" value={form.log_length_ft} onChange={set("log_length_ft")} placeholder="e.g. 12" /></Field>
            </div>
            <Field label="No. of Logs"><Input type="number" value={form.num_logs} onChange={set("num_logs")} placeholder="e.g. 20" /></Field>
            {calc && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border border-green-100"><p className="text-xs text-green-400">Per Log</p><p className="font-bold text-green-700 text-sm">{calc.cftPer} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-green-100"><p className="text-xs text-green-400">Total Hoppus</p><p className="font-bold text-green-700 text-sm">{calc.totalCFT} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-green-100"><p className="text-xs text-green-400">Total CBM</p><p className="font-bold text-green-700 text-sm">{calc.totalCBM} m³</p></div>
              </div>
            )}
          </div>
        )}
        {timberType === "Plywood" && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">📋 Plywood CBM Calculator</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Field label="Thickness (mm)">
                <Select value={form.sheet_thickness_mm} onChange={set("sheet_thickness_mm")}>
                  <option value="">— Select —</option>
                  {[3,4,6,9,12,15,18,19,25].map(t => <option key={t} value={t}>{t} mm</option>)}
                </Select>
              </Field>
              <Field label="Width (ft)"><Input type="number" value={form.sheet_width_ft} onChange={set("sheet_width_ft")} placeholder="4" /></Field>
              <Field label="Length (ft)"><Input type="number" value={form.sheet_length_ft} onChange={set("sheet_length_ft")} placeholder="8" /></Field>
            </div>
            <Field label="No. of Sheets"><Input type="number" value={form.num_sheets} onChange={set("num_sheets")} placeholder="e.g. 500" /></Field>
            {calc && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border border-amber-100"><p className="text-xs text-amber-400">Per Sheet</p><p className="font-bold text-amber-700 text-sm">{calc.cbmPer} m³</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-amber-100"><p className="text-xs text-amber-400">Total CBM</p><p className="font-bold text-amber-700 text-sm">{calc.totalCBM} m³</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-amber-100"><p className="text-xs text-amber-400">Total CFT</p><p className="font-bold text-amber-700 text-sm">{calc.totalCFT} CFT</p></div>
              </div>
            )}
          </div>
        )}
        <div className={cls("rounded-xl p-4 border-2", calc ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-100")}>
          <p className={cls("text-xs font-bold uppercase tracking-wide mb-2", calc ? "text-gray-400" : "text-gray-400")}>
            {calc ? "✅ Volume Auto-Calculated" : "Volume / Quantity"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Calculated Volume">
              <Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0"
                readOnly={timberType !== "Other" && !!calc} />
            </Field>
            <Field label="Unit">
              <Select value={form.unit} onChange={set("unit")}>
                <option>CFT</option><option>CBM</option><option>Pieces</option><option>Sheets</option><option>MT</option><option>Bundles</option>
              </Select>
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cost Price (₹ per unit)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0" /></Field>
          <Field label="Market Value (₹ per unit)"><Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0" /></Field>
        </div>
        {form.cost_price && form.available_quantity && (
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-green-700 font-medium">Total Stock Value</span>
            <span className="text-lg font-black text-green-700">{fmt(parseFloat(form.cost_price) * parseFloat(form.available_quantity))}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Supplier">
            <Select value={form.supplier_id} onChange={set("supplier_id")}>
              <option value="">— Select Supplier —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={set("date")} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3 pt-2">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add to Inventory"}</Btn>
          <Btn variant="secondary" onClick={closeInv}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── YARDS ──────────────────────────────────────────────────────────────────────
function Yards() {
  const { companyId } = useAuth();
  const [yards, setYards] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [selected, setSelected]   = useState(null);  // row detail panel
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const DEFAULTS = { name:"", city:"", address:"", manager_name:"", manager_phone:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([sb.from("yards").select("*").eq("company_id", companyId), sb.from("inventory").select("*").eq("company_id", companyId)]);
      setYards(a.data || []); setInv(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeYard = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Yard name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("yards").insert([{ ...form, company_id: companyId }]);
      if (error) throw error;
      closeYard(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Yards</h1><p className="text-gray-400 text-sm">{yards.length} locations</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Yard</button>
      </div>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {yards.map(y => {
            const yInv = inv.filter(i => i.yard_id === y.id);
            const val = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
            const units = yInv.reduce((s, i) => s + (i.available_quantity || 0), 0);
            return (
              <div key={y.id} onClick={() => setSelected(y)} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="font-bold text-gray-800 text-lg">{y.name}</h3><p className="text-gray-400 text-sm">{y.city}</p></div>
                  <Badge text={y.is_active !== false ? "Active" : "Inactive"} color={y.is_active !== false ? "green" : "gray"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-xs text-blue-400">Products</p><p className="font-bold text-blue-700">{yInv.length}</p></div>
                  <div className="bg-green-50 rounded-lg p-2 text-center"><p className="text-xs text-green-400">Units</p><p className="font-bold text-green-700">{units}</p></div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center"><p className="text-xs text-purple-400">Value</p><p className="font-bold text-purple-700 text-xs">{fmt(val)}</p></div>
                </div>
                {y.manager_name && <p className="text-xs text-gray-400">👤 {y.manager_name} {y.manager_phone && `· ${y.manager_phone}`}</p>}
                {y.address && <p className="text-xs text-gray-300 mt-1 truncate">📍 {y.address}</p>}
                <p className="text-xs text-blue-400 mt-2 font-medium">Click to view details →</p>
              </div>
            );
          })}
          {yards.length === 0 && <div className="col-span-3 text-center py-20 text-gray-300">No yards added yet</div>}
        </div>
      )}
      {/* Yard Detail Panel */}
      <SlidePanel title={selected?.name || "Yard Details"} open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (() => {
          const yInv = inv.filter(i => i.yard_id === selected.id);
          const val = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-400">Products</p><p className="text-2xl font-black text-blue-700">{yInv.length}</p></div>
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-400">Total Value</p><p className="text-lg font-black text-green-700">{fmt(val)}</p></div>
                <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-xs text-purple-400">Status</p><p className="text-sm font-black text-purple-700 mt-1">{selected.is_active !== false ? "Active" : "Inactive"}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Yard Information</p>
                <DetailRow label="Yard Name" value={selected.name} />
                <DetailRow label="City" value={selected.city} />
                <DetailRow label="Address" value={selected.address} />
                <DetailRow label="Manager" value={selected.manager_name} />
                <DetailRow label="Phone" value={selected.manager_phone} />
                <DetailRow label="Notes" value={selected.notes} />
              </div>
              {yInv.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Inventory at this Yard</p>
                  <div className="space-y-2">
                    {yInv.map(i => (
                      <div key={i.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div><p className="font-semibold text-gray-800 text-sm">{i.product_name}</p><p className="text-xs text-gray-400">{i.category} · {i.wood_type || "—"}</p></div>
                        <div className="text-right"><p className="font-bold text-blue-700 text-sm">{i.available_quantity} {i.unit}</p><p className="text-xs text-gray-400">{fmt(i.cost_price)}/unit</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </SlidePanel>

      <SlidePanel title="Add Yard" open={showAdd} onClose={closeYard}>
        <Field label="Yard Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Manager Name"><Input value={form.manager_name} onChange={set("manager_name")} /></Field>
        </div>
        <Field label="Full Address"><Textarea value={form.address} onChange={set("address")} /></Field>
        <Field label="Manager Phone"><Input value={form.manager_phone} onChange={set("manager_phone")} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Yard"}</Btn><Btn variant="secondary" onClick={closeYard}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}


// ── DEALS (DESKTOP) ────────────────────────────────────────────────────────────
function Deals() {
  const { companyId } = useAuth();
  const role    = useRole();
  const isAdmin = role !== "worker";
  const [deals, setDeals] = useState([]);
  const [stageMenu, setStageMenu] = useState(null); // {dealId, rect}
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd]     = useState(false);
  const [selected, setSelected]   = useState(null);  // row detail panel
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [custName, setCustName] = useState("");
  const DEAL_DEFAULTS = { customer_id:"", product_id:"", quantity:"", unit_price:"", status:"draft", payment_status:"Pending", notes:"" };

  // Auto stock deduction when deal moves to Dispatched; restore on rollback
  const updateDealStage = async (deal, newStage) => {
    setStageMenu(null);
    try {
      const prevStage = (deal.stage || deal.status || "draft").toLowerCase();
      const next      = newStage.toLowerCase();
      const invId     = deal.inventory_id;

      // Deduct stock when moving TO dispatched
      if (invId && next === "dispatched" && prevStage !== "dispatched" && prevStage !== "delivered" && prevStage !== "completed") {
        const qty = parseFloat(deal.quantity) || 0;
        const { data: inv } = await sb.from("inventory").select("available_quantity,stock_status").eq("id", invId).single();
        if (inv) {
          const newQty = Math.max(0, (inv.available_quantity || 0) - qty);
          await sb.from("inventory").update({ available_quantity: newQty, stock_status: "Sold", last_movement_at: new Date().toISOString() }).eq("id", invId);
        }
      }
      // Restore stock on rollback FROM dispatched
      if (invId && prevStage === "dispatched" && next !== "dispatched" && next !== "delivered" && next !== "completed") {
        const qty = parseFloat(deal.quantity) || 0;
        const { data: inv } = await sb.from("inventory").select("available_quantity").eq("id", invId).single();
        if (inv) {
          const restored = (inv.available_quantity || 0) + qty;
          await sb.from("inventory").update({ available_quantity: restored, stock_status: "Available", last_movement_at: new Date().toISOString() }).eq("id", invId);
        }
      }
      // Reserve on confirm
      if (invId && next === "confirmed" && prevStage === "draft") {
        await sb.from("inventory").update({ stock_status: "Reserved", last_movement_at: new Date().toISOString() }).eq("id", invId);
      }

      await sb.from("deals").update({ stage: newStage, status: newStage }).eq("id", deal.id);
      fetchAll();
    } catch (e) { alert("Stage update failed: " + e.message); }
  };
  const [form, setForm] = useState(DEAL_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        sb.from("deals").select("*").eq("company_id", companyId).order("created_at",{ascending:false}),
        sb.from("customers").select("*").eq("company_id", companyId),
        sb.from("inventory").select("*").eq("company_id", companyId),
      ]);
      setDeals(a.data || []); setCustomers(b.data || []); setInventory(c.data || []);
    } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Draft","Confirmed","Dispatched","Delivered","Completed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.status||d.stage||"").toLowerCase() === tab.toLowerCase());
  const closeDeal = () => { setShowAdd(false); setForm(DEAL_DEFAULTS); setCustName(""); setErr(""); };
  const save = async () => {
    if (!form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unit_price) || 0;
      const selProd = inventory.find(i => i.id === form.product_id);
      const { error } = await sb.from("deals").insert([{
        company_id: companyId, deal_number: `DEAL-${Date.now()}`,
        customer_id: form.customer_id || null, customer_name: custName || customers.find(c=>c.id===form.customer_id)?.name,
        inventory_id: form.product_id || null, product_name: selProd?.product_name,
        quantity: qty, negotiated_price: price, total_value: qty * price,
        payment_status: form.payment_status, stage: form.status, notes: form.notes || null,
      }]);
      if (error) throw error;
      closeDeal(); fetchAll();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Deals</h1><p className="text-gray-400 text-sm">{deals.length} total</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Create Deal</Btn>
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} ({t === "All" ? deals.length : deals.filter(d=>(d.status||d.stage||"").toLowerCase()===t.toLowerCase()).length})
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Deal #","Customer","Product","Qty","Value","Stage","Payment","Date"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-orange-400 uppercase">Profit</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</td>
                  <td className="px-4 py-3 font-semibold">{d.customer_name || customers.find(c=>c.id===d.customer_id)?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                  <td className="px-4 py-3">{d.quantity || "—"}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value || d.negotiated_price)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setStageMenu(stageMenu?.dealId === d.id ? null : { dealId: d.id, deal: d, rect });
                        }}
                        className={cls("px-3 py-1 rounded-full text-xs font-bold border transition-all",
                          (d.stage||d.status||"draft") === "completed" ? "bg-green-100 text-green-700 border-green-200" :
                          (d.stage||d.status||"draft") === "dispatched" ? "bg-blue-100 text-blue-700 border-blue-200" :
                          (d.stage||d.status||"draft") === "confirmed"  ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                          (d.stage||d.status||"draft") === "delivered"  ? "bg-purple-100 text-purple-700 border-purple-200" :
                          "bg-gray-100 text-gray-500 border-gray-200"
                        )}>
                        {d.stage || d.status || "draft"} ▾
                      </button>
                      {stageMenu?.dealId === d.id && (
                        <div className="absolute left-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-36">
                          {["Draft","Confirmed","Dispatched","Delivered","Completed"].map(s => (
                            <button key={s} onClick={() => updateDealStage(stageMenu.deal, s)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-gray-700">
                              {s}
                              {(stageMenu.deal.stage || stageMenu.deal.status || "draft").toLowerCase() === s.toLowerCase() && " ✓"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.created_at)}</td>
                  {isAdmin && (() => {
                    const selInv = inventory.find(i => i.id === d.inventory_id);
                    const cost   = (selInv?.cost_price || 0) * (d.quantity || 0);
                    const profit = (d.total_value || 0) - cost;
                    const margin = cost > 0 ? ((profit / cost) * 100).toFixed(1) : null;
                    return (
                      <td className="px-4 py-3">
                        <p className={cls("font-bold text-sm", profit > 0 ? "text-green-600" : "text-red-500")}>{fmt(profit)}</p>
                        {margin && <p className="text-xs text-gray-400">{margin}%</p>}
                      </td>
                    );
                  })()}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No deals found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Create Deal" open={showAdd} onClose={closeDeal}>
        <Field label="Customer Name"><Input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Customer (from records)">
          <Select value={form.customer_id} onChange={set("customer_id")}>
            <option value="">— Select Customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Product">
          <Select value={form.product_id} onChange={set("product_id")}>
            <option value="">— Select Product —</option>
            {inventory.map(i => <option key={i.id} value={i.id}>{i.product_name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label="Unit Price (₹)"><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
        </div>
        {form.quantity && form.unit_price && (
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex justify-between">
            <span className="text-sm text-green-700">Deal Value</span>
            <span className="font-black text-green-700">{fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select value={form.status} onChange={set("status")}>
              <option value="draft">Draft</option><option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option><option value="delivered">Delivered</option><option value="completed">Completed</option>
            </Select>
          </Field>
          <Field label="Payment Status">
            <Select value={form.payment_status} onChange={set("payment_status")}>
              <option>Pending</option><option>Partial</option><option>Paid</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Deal"}</Btn><Btn variant="secondary" onClick={closeDeal}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ────────────────────────────────────────────────────────────────────
function Transit() {
  const { companyId } = useAuth();
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const DEFAULTS = { vehicle_number:"", driver_name:"", driver_phone:"", origin_yard_id:"", destination:"", dispatch_date:today(), expected_arrival:"", freight_cost:"", status:"Created", cargo_details:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        sb.from("shipments").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId),
      ]);
      setShips(a.data || []); setYards(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Created","Loaded","Dispatched","In Transit","Arrived","Delivered"];
  const filtered = tab === "All" ? ships : ships.filter(s => (s.status||"").toLowerCase() === tab.toLowerCase());

  const closeTransit = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.destination) { setErr("Destination required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("shipments").insert([{
        company_id: companyId,
        shipment_number: `SHIP-${Date.now().toString().slice(-7)}`,
        vehicle_number: form.vehicle_number || null,
        driver_name: form.driver_name || null,
        driver_phone: form.driver_phone || null,
        origin_yard_id: form.origin_yard_id || null,
        destination: form.destination,
        dispatch_date: form.dispatch_date || null,
        expected_arrival: form.expected_arrival || null,
        freight_cost: parseNum(form.freight_cost) || 0,
        status: form.status,
        cargo_details: form.cargo_details || null,
      }]);
      if (error) throw error;
      closeTransit(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };
  const statusColor = (s) => { const m = { "delivered":"green","dispatched":"blue","in transit":"blue","loaded":"orange","arrived":"purple" }; return m[(s||"").toLowerCase()] || "gray"; };

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      {/* Sticky mobile header */}
      <div className="md:hidden sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-black text-gray-900">Transit</h1>
            <p className="text-xs text-gray-400">{ships.length} shipments tracked</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-blue-600 active:bg-blue-700 text-white font-black text-sm px-5 py-2.5 rounded-xl flex items-center gap-1">
            <span className="text-base">+</span> Add
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {["All","Created","Loaded","Dispatched","In Transit","Arrived","Delivered"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cls("px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap flex-shrink-0",
                tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* Desktop header */}
      <div className="hidden md:flex px-6 pt-6 pb-3 items-center justify-between">
        <div><h1 className="text-2xl font-black text-gray-800">Transit</h1><p className="text-gray-400 text-sm">{ships.length} shipments</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl">+ Add Shipment</button>
      </div>
      <div className="hidden md:flex gap-2 overflow-x-auto pb-1 px-6 mb-3">
        {["All","Created","Loaded","Dispatched","In Transit","Arrived","Delivered"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600")}>
            {t}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3 px-4 pb-4 mt-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <p className="text-5xl mb-3">🚛</p>
                <p className="font-semibold text-base">No shipments yet</p>
                <p className="text-sm mt-1">Tap + Add to track a shipment</p>
              </div>
            ) : filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 pt-4 pb-3" onClick={() => setSelected(s)}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-black text-gray-900 text-base">{s.vehicle_number || "No vehicle"}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.shipment_number}</p>
                    </div>
                    <Badge text={s.status || "—"} color={statusColor(s.status)} />
                  </div>
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-gray-500">{yards.find(y => y.id === s.origin_yard_id)?.name || "Origin"}</span>
                    <span className="text-blue-500 font-black text-base">→</span>
                    <span className="font-bold text-gray-800">{s.destination || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">👤 {s.driver_name || "No driver"}</span>
                    <span className="font-black text-gray-800">{fmt(s.freight_cost)}</span>
                  </div>
                  <p className="text-xs text-blue-500 mt-2 font-semibold">Tap for full details →</p>
                </div>
                {s.driver_phone && (
                  <a href={"tel:" + s.driver_phone}
                    className="flex items-center justify-center gap-2 bg-blue-50 active:bg-blue-100 py-3 border-t border-blue-100">
                    <span className="text-blue-600 text-xl">📞</span>
                    <span className="text-blue-700 font-bold text-sm">Call Driver — {s.driver_phone}</span>
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Shipment #","Vehicle","Driver","Origin → Dest","Dispatch","ETA","Status","Freight"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(s)}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.shipment_number || `#${s.id?.toString().slice(-6)}`}</td>
                    <td className="px-4 py-3 font-semibold">{s.vehicle_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                    <td className="px-4 py-3">{yards.find(y => y.id === s.origin_yard_id)?.name || "—"} → {s.destination || "—"}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(s.dispatch_date)}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(s.expected_arrival)}</td>
                    <td className="px-4 py-3"><Badge text={s.status || "—"} color={statusColor(s.status)} /></td>
                    <td className="px-4 py-3 font-semibold">{fmt(s.freight_cost)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No shipments</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Shipment Detail Panel */}
      <SlidePanel title="Shipment Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">🚛</div>
              <div>
                <p className="font-black text-gray-800 text-lg">{selected.shipment_number}</p>
                <Badge text={selected.status || "—"} color={statusColor(selected.status)} />
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Vehicle & Driver</p>
              <DetailRow label="Vehicle No." value={selected.vehicle_number} />
              <DetailRow label="Driver Name" value={selected.driver_name} />
              <DetailRow label="Driver Phone" value={selected.driver_phone} />
              <DetailRow label="Freight Cost" value={fmt(selected.freight_cost)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Route & Timeline</p>
              <DetailRow label="Origin Yard" value={yards.find(y => y.id === selected.origin_yard_id)?.name} />
              <DetailRow label="Destination" value={selected.destination} />
              <DetailRow label="Dispatch Date" value={fmtDate(selected.dispatch_date)} />
              <DetailRow label="Expected Arrival" value={fmtDate(selected.expected_arrival)} />
              <DetailRow label="Status" value={selected.status} />
            </div>
            {selected.cargo_details && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Cargo Details</p>
                <p className="text-sm text-gray-700">{selected.cargo_details}</p>
              </div>
            )}
          </>
        )}
      </SlidePanel>

      {/* Floating Add Button - Mobile */}
      <button onClick={() => setShowAdd(true)}
        className="md:hidden fixed bottom-20 right-4 z-20 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white text-2xl rounded-full shadow-lg shadow-blue-300 flex items-center justify-center active:scale-95 transition-all">
        +
      </button>

      <SlidePanel title="Add Shipment" open={showAdd} onClose={closeTransit}>
        <Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="MH-12-AB-1234" /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Driver Name"><Input value={form.driver_name} onChange={set("driver_name")} /></Field>
          <Field label="Driver Phone"><Input value={form.driver_phone} onChange={set("driver_phone")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Origin Yard">
            <Select value={form.origin_yard_id} onChange={set("origin_yard_id")}>
              <option value="">— Select —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Destination"><Input value={form.destination} onChange={set("destination")} placeholder="City / address" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={set("dispatch_date")} /></Field>
          <Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={set("expected_arrival")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Freight Cost (₹)"><Input type="number" value={form.freight_cost} onChange={set("freight_cost")} placeholder="0" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {["Created","Loaded","Dispatched","In Transit","Arrived","Delivered"].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Cargo Details"><Textarea value={form.cargo_details} onChange={set("cargo_details")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn><Btn variant="secondary" onClick={closeTransit}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── SUPPLIERS ──────────────────────────────────────────────────────────────────
function Suppliers() {
  const { companyId } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const DEFAULTS = { name:"", city:"", country:"India", contact_person:"", phone:"", email:"", gst_number:"", pan_number:"", products_supplied:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([sb.from("suppliers").select("*").eq("company_id", companyId), sb.from("inventory").select("*").eq("company_id", companyId)]);
      setSuppliers(a.data || []); setInv(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("suppliers").insert([{ ...form, company_id: companyId }]);
      if (error) throw error;
      close(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Suppliers</h1><p className="text-gray-400 text-sm">{suppliers.length} suppliers</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Supplier</button>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Supplier","Location","GST","Contact","Products Supplied","Inv. Items"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(s)}>
                  <td className="px-4 py-3"><p className="font-semibold text-gray-800">{s.name}</p><p className="text-xs text-gray-400">{s.contact_person}</p></td>
                  <td className="px-4 py-3 text-gray-500">{s.city}{s.country && s.country !== "India" ? `, ${s.country}` : ""}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.gst_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone || s.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.products_supplied || "—"}</td>
                  <td className="px-4 py-3"><Badge text={inv.filter(i => i.supplier_id === s.id).length} color="blue" /></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-300">No suppliers added</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {/* Supplier Detail Panel */}
      <SlidePanel title="Supplier Details" open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (() => {
          const sInv = inv.filter(i => i.supplier_id === selected.id);
          const val = sInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
          return (
            <>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-400">Items Supplied</p><p className="text-2xl font-black text-blue-700">{sInv.length}</p></div>
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-400">Stock Value</p><p className="text-lg font-black text-green-700">{fmt(val)}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Supplier Info</p>
                <DetailRow label="Company" value={selected.name} />
                <DetailRow label="City" value={selected.city} />
                <DetailRow label="Country" value={selected.country} />
                <DetailRow label="Contact" value={selected.contact_person} />
                <DetailRow label="Phone" value={selected.phone} />
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="GST" value={selected.gst_number} />
                <DetailRow label="PAN" value={selected.pan_number} />
                <DetailRow label="Products" value={selected.products_supplied} />
              </div>
              {sInv.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Inventory from Supplier</p>
                  <div className="space-y-2">
                    {sInv.map(i => (
                      <div key={i.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div><p className="font-semibold text-gray-800 text-sm">{i.product_name}</p><p className="text-xs text-gray-400">{i.category}</p></div>
                        <div className="text-right"><p className="font-bold text-blue-700 text-sm">{i.available_quantity} {i.unit}</p><p className="text-xs text-gray-400">{fmt(i.cost_price)}/unit</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><p className="text-xs font-bold text-amber-600 mb-1">Notes</p><p className="text-sm text-gray-700">{selected.notes}</p></div>}
            </>
          );
        })()}
      </SlidePanel>

      <SlidePanel title="Add Supplier" open={showAdd} onClose={close}>
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Products Supplied"><Input value={form.products_supplied} onChange={set("products_supplied")} placeholder="e.g. Plywood, Teak" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Supplier"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────────
function Customers() {
  const { companyId } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [selected, setSelected]   = useState(null);  // row detail panel
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [form, setForm] = useState({ name:"", city:"", state:"", country:"India", gst_number:"", pan_number:"", phone:"", email:"", notes:"" });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const [deals, setDeals] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([sb.from("customers").select("*").eq("company_id", companyId), sb.from("deals").select("*").eq("company_id", companyId)]);
      setCustomers(a.data || []); setDeals(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = { name:"", city:"", state:"", country:"India", gst_number:"", pan_number:"", phone:"", email:"", notes:"" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("customers").insert([{ ...form, company_id: companyId }]);
      if (error) throw error;
      close(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Customers</h1><p className="text-gray-400 text-sm">{customers.length} customers</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Customer</button>
      </div>
            {loading ? <Spinner /> : (
        <>
          <div className="md:hidden space-y-3 px-4 pb-4">
            {customers.length === 0 ? (
              <div className="text-center py-16 text-gray-300"><p className="text-4xl mb-2">👥</p><p>No customers yet.</p></div>
            ) : customers.map(c => (
              <div key={c.id} onClick={() => setSelected(c)} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-black text-gray-900">{c.name}</p>
                  <Badge text={`${deals.filter(d => d.customer_id === c.id).length} deals`} color="blue" />
                </div>
                <p className="text-sm text-gray-500">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</p>
                <p className="text-xs text-gray-400 mt-1">{c.phone || c.email || c.gst_number || "—"}</p>
              </div>
            ))}
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Customer","Location","GST","Phone","Email","Deals"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{[c.city,c.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.gst_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || "—"}</td>
                    <td className="px-4 py-3"><Badge text={deals.filter(d => d.customer_id === c.id).length} color="blue" /></td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-300">No customers</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Customer Detail Panel */}
      <SlidePanel title="Customer Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const cDeals = deals.filter(d => d.customer_id === selected.id);
          const revenue = cDeals.reduce((s, d) => s + (d.total_value || 0), 0);
          const paid = cDeals.filter(d => d.payment_status === "Paid").length;
          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-400">Total Deals</p><p className="text-2xl font-black text-blue-700">{cDeals.length}</p></div>
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-400">Revenue</p><p className="text-base font-black text-green-700">{fmt(revenue)}</p></div>
                <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-xs text-purple-400">Paid</p><p className="text-2xl font-black text-purple-700">{paid}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Customer Info</p>
                <DetailRow label="Name" value={selected.name} />
                <DetailRow label="City" value={selected.city} />
                <DetailRow label="State" value={selected.state} />
                <DetailRow label="Phone" value={selected.phone} />
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="GST Number" value={selected.gst_number} />
                <DetailRow label="PAN Number" value={selected.pan_number} />
              </div>
              {cDeals.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Transaction History</p>
                  <div className="space-y-2">
                    {cDeals.slice(0, 6).map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div><p className="font-semibold text-gray-800 text-sm">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</p><p className="text-xs text-gray-400">{d.product_name || "—"} · {fmtDate(d.created_at)}</p></div>
                        <div className="text-right"><p className="font-bold text-green-700 text-sm">{fmt(d.total_value)}</p><Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><p className="text-xs font-bold text-amber-600 mb-1">Notes</p><p className="text-sm text-gray-700">{selected.notes}</p></div>}
            </>
          );
        })()}
      </SlidePanel>

      <SlidePanel title="Add Customer" open={showAdd} onClose={close}>
        <Field label="Customer Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="State"><Input value={form.state} onChange={set("state")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Customer"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── FINANCIALS ─────────────────────────────────────────────────────────────────
function Financials() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([sb.from("inventory").select("*").eq("company_id", companyId), sb.from("deals").select("*").eq("company_id", companyId)]).then(([a, b]) => {
      setInv(a.data || []); setDeals(b.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalCost = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const marketVal = inv.reduce((s, i) => s + (i.market_value || i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = deals.filter(d => ["completed","delivered","closed"].includes((d.stage||d.status||"").toLowerCase()))
    .reduce((s, d) => s + (d.total_value || 0), 0);
  const profit = revenue - totalCost * 0.7;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Financials</h1><p className="text-gray-400 text-sm">P&L overview</p></div>
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Total Revenue" value={fmt(revenue)} icon="💰" color="green" />
            <StatCard label="Inventory Cost" value={fmt(totalCost)} icon="📦" color="blue" />
            <StatCard label="Market Value" value={fmt(marketVal)} icon="📈" color="purple" />
            <StatCard label="Est. Profit" value={fmt(profit)} icon={profit >= 0 ? "✅" : "⚠️"} color={profit >= 0 ? "green" : "red"} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-4">Inventory Cost Breakdown by Category</h3>
            <div className="space-y-3">
              {Object.entries(inv.reduce((m, i) => {
                const c = i.category || "Other";
                m[c] = (m[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0);
                return m;
              }, {})).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600 shrink-0">{cat}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (val / totalCost) * 100)}%` }} />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-gray-700">{fmt(val)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── BUSINESS INSIGHTS ─────────────────────────────────────────────────────────
function AIInsights() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sb.from("inventory").select("*").eq("company_id", companyId),
      sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      sb.from("shipments").select("*").eq("company_id", companyId),
    ]).then(([a, b, c]) => {
      setInv(a.data || []);
      setDeals(b.data || []);
      setShips(c.data || []);
      setLoading(false);
    });
  }, [companyId]);

  const totalValue = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const totalCBM = inv.reduce((s, i) => s + (i.unit === "CBM" ? (i.available_quantity || 0) : 0), 0);
  const totalCFT = inv.reduce((s, i) => s + (i.unit === "CFT" ? (i.available_quantity || 0) : 0), 0);
  const lowStock = inv.filter(i => (i.available_quantity || 0) < 10);
  const paidDeals = deals.filter(d => d.payment_status === "Paid");
  const pendingDeals = deals.filter(d => d.payment_status === "Pending");
  const revenue = paidDeals.reduce((s, d) => s + (d.total_value || 0), 0);
  const pending = pendingDeals.reduce((s, d) => s + (d.total_value || 0), 0);
  const activeShips = ships.filter(s => s.status !== "Delivered").length;

  // Category breakdown
  const catMap = {};
  inv.forEach(i => {
    const c = i.category || "Other";
    catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0);
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  // Recent deals
  const recentDeals = deals.slice(0, 5);

  if (loading) return <Spinner />;

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-gray-900">Insights</h1>
        <p className="text-gray-400 text-sm">Business overview & analytics</p>
      </div>

      <div className="px-4 space-y-4">
        {/* ── P&L Summary ── */}
        <div className="bg-gradient-to-br from-gray-900 to-blue-950 rounded-2xl p-5 text-white">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Inventory Value</p>
          <p className="text-3xl font-black mb-4">{fmt(totalValue)}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-xs mb-1">Revenue</p>
              <p className="font-black text-green-400 text-sm">{fmt(revenue)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-xs mb-1">Pending</p>
              <p className="font-black text-orange-400 text-sm">{fmt(pending)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-xs mb-1">Shipments</p>
              <p className="font-black text-white text-sm">{activeShips} active</p>
            </div>
          </div>
        </div>

        {/* ── Volume Summary ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Stock Volume</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400 mb-1">Total CFT</p>
              <p className="text-xl font-black text-blue-700">{Math.round(totalCFT)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-400 mb-1">Total CBM</p>
              <p className="text-xl font-black text-green-700">{totalCBM.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* ── Category Breakdown ── */}
        {topCats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Value by Category</p>
            <div className="space-y-3">
              {topCats.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-gray-700">{cat}</span>
                    <span className="text-sm font-black text-gray-900">{fmt(val)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: totalValue > 0 ? Math.min(100, (val / totalValue) * 100) + "%" : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Low Stock Alerts ── */}
        {lowStock.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-3">⚠ Low Stock Alerts</p>
            <div className="space-y-2">
              {lowStock.slice(0, 5).map(i => (
                <div key={i.id} className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{i.product_name}</p>
                    <p className="text-xs text-gray-400">{i.category}</p>
                  </div>
                  <Badge text={`${i.available_quantity} ${i.unit || "left"}`} color="red" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Deals Summary ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Deal Breakdown</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-500 mb-1">Paid</p>
              <p className="text-xl font-black text-green-700">{paidDeals.length}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-xs text-orange-500 mb-1">Pending</p>
              <p className="text-xl font-black text-orange-700">{pendingDeals.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500 mb-1">Total</p>
              <p className="text-xl font-black text-blue-700">{deals.length}</p>
            </div>
          </div>
          {recentDeals.length > 0 && (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent Deals</p>
              <div className="space-y-2">
                {recentDeals.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{d.customer_name || "—"}</p>
                      <p className="text-xs text-gray-400">{d.product_name || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">{fmt(d.total_value)}</p>
                      <Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-purple-600">{inv.length}</p>
            <p className="text-xs text-gray-400 mt-1">Products in Stock</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-blue-600">{ships.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Shipments</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REPORTS ────────────────────────────────────────────────────────────────────
function Reports() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    sb.from("company").select("*").limit(1).single()
      .then(r => setCompany(r.data || {})).catch(() => {});
  }, []);

  const REPORTS = [
    { key:"inventory", label:"Inventory Report", icon:"📦", desc:"All stock with valuation" },
    { key:"sales", label:"Sales Report", icon:"🤝", desc:"All deals and revenue" },
    { key:"shipments", label:"Shipment Report", icon:"🚛", desc:"Transit & logistics" },
    { key:"suppliers", label:"Supplier Report", icon:"🏭", desc:"Supplier directory" },
    { key:"customers", label:"Customer Report", icon:"👥", desc:"Customer revenue analysis" },
  ];

  const downloadPDF = async (type, label) => {
    setLoading(p => ({...p, [type]: true}));
    try {
      let data = [];
      if (type === "inventory") { const r = await sb.from("inventory").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "sales") { const r = await sb.from("deals").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "shipments") { const r = await sb.from("shipments").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "suppliers") { const r = await sb.from("suppliers").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "customers") { const r = await sb.from("customers").select("*").eq("company_id", companyId); data = r.data || []; }
      generatePDF(type, label, data, company);
    } catch (e) { alert("Failed: " + e.message); }
    setLoading(p => ({...p, [type]: false}));
  };

  const generatePDF = (type, label, data, co) => {
    const now = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${label}</title>
    <style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1e293b}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
    th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b}
    td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
    h1{font-size:20px;margin:0}h2{font-size:14px;color:#64748b;margin:4px 0 16px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0}
    </style></head><body>
    <div class="header">
      <div><div style="font-size:22px">⚓</div><h1>${co.name || "Dockside ERP"}</h1>
      ${co.gst_number ? `<div style="font-size:11px;color:#64748b">GST: ${co.gst_number}</div>` : ""}
      </div>
      <div style="text-align:right"><h2>${label}</h2><div style="font-size:11px;color:#94a3b8">Generated: ${now}</div><div style="font-size:11px;color:#94a3b8">${data.length} records</div></div>
    </div>
    ${buildRows(type, data)}
    </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const buildRows = (type, data) => {
    if (type === "inventory") return `<table><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Wood Type</th><th>Grade</th><th>Unit</th><th>Qty</th><th>Cost Price</th><th>Total Value</th></tr></thead><tbody>${data.map((i,idx) => `<tr><td>${idx+1}</td><td><b>${i.product_name||"—"}</b></td><td>${i.category||"—"}</td><td>${i.wood_type||"—"}</td><td>${i.grade||"—"}</td><td>${i.unit||"—"}</td><td>${i.available_quantity||0}</td><td>₹${(i.cost_price||0).toLocaleString("en-IN")}</td><td>₹${((i.cost_price||0)*(i.available_quantity||0)).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table>`;
    if (type === "sales") return `<table><thead><tr><th>#</th><th>Deal No.</th><th>Customer</th><th>Product</th><th>Qty</th><th>Value</th><th>Stage</th><th>Payment</th></tr></thead><tbody>${data.map((d,idx) => `<tr><td>${idx+1}</td><td>${d.deal_number||"—"}</td><td>${d.customer_name||"—"}</td><td>${d.product_name||"—"}</td><td>${d.quantity||"—"}</td><td>₹${(d.total_value||0).toLocaleString("en-IN")}</td><td>${d.stage||d.status||"—"}</td><td>${d.payment_status||"—"}</td></tr>`).join("")}</tbody></table>`;
    if (type === "shipments") return `<table><thead><tr><th>#</th><th>Shipment No.</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Dispatch</th><th>Status</th><th>Freight</th></tr></thead><tbody>${data.map((s,idx) => `<tr><td>${idx+1}</td><td>${s.shipment_number||"—"}</td><td>${s.vehicle_number||"—"}</td><td>${s.driver_name||"—"}</td><td>${s.destination||"—"}</td><td>${fmtDate(s.dispatch_date)}</td><td>${s.status||"—"}</td><td>₹${(s.freight_cost||0).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table>`;
    if (type === "suppliers") return `<table><thead><tr><th>#</th><th>Name</th><th>City</th><th>GST</th><th>Contact</th><th>Phone</th></tr></thead><tbody>${data.map((s,idx) => `<tr><td>${idx+1}</td><td><b>${s.name||"—"}</b></td><td>${s.city||"—"}</td><td>${s.gst_number||"—"}</td><td>${s.contact_person||"—"}</td><td>${s.phone||"—"}</td></tr>`).join("")}</tbody></table>`;
    if (type === "customers") return `<table><thead><tr><th>#</th><th>Name</th><th>City</th><th>GST</th><th>Phone</th><th>Email</th></tr></thead><tbody>${data.map((c,idx) => `<tr><td>${idx+1}</td><td><b>${c.name||"—"}</b></td><td>${c.city||"—"}</td><td>${c.gst_number||"—"}</td><td>${c.phone||"—"}</td><td>${c.email||"—"}</td></tr>`).join("")}</tbody></table>`;
    return "<p>No data</p>";
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Reports</h1><p className="text-gray-400 text-sm">Professional PDF reports with company letterhead</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {REPORTS.map(r => (
          <div key={r.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl mb-3">{r.icon}</div>
            <h3 className="font-bold text-gray-800 text-base">{r.label}</h3>
            <p className="text-gray-400 text-xs mt-1 mb-4">{r.desc}</p>
            <Btn onClick={() => downloadPDF(r.key, r.label)} disabled={loading[r.key]}>
              {loading[r.key] ? "Generating…" : "📥 Download PDF"}
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COMPANY ────────────────────────────────────────────────────────────────────
function Company() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    name:"", industry:"Timber Trade", city:"", country:"India", address:"",
    owner_name:"", phone:"", email:"", website:"",
    gst_number:"", pan_number:"", iec_number:"", cin_number:"",
    bank_name:"", bank_account:"", bank_ifsc:"", bank_branch:"", notes:""
  });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sb.from("company").select("*").limit(1).single();
      if (data) { setCompany(data); setForm(f => ({...f, ...data})); }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      let error;
      if (company?.id) {
        const r = await sb.from("company").update(form).eq("id", company.id).select().single();
        error = r.error;
      } else {
        const r = await sb.from("company").insert([form]).select().single();
        error = r.error;
      }
      if (error) throw error;
      alert("✅ Company profile saved!");
      fetchAll();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const TABS = ["profile","legal","banking"];

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Company</h1><p className="text-gray-400 text-sm">Your business profile</p></div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex gap-2 mb-6">
            {TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all", activeTab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{t}</button>
            ))}
          </div>
          {activeTab === "profile" && (
            <div className="space-y-4">
              <Field label="Company Name"><Input value={form.name} onChange={set("name")} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Owner Name"><Input value={form.owner_name} onChange={set("owner_name")} /></Field>
                <Field label="Industry"><Input value={form.industry} onChange={set("industry")} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
              </div>
              <Field label="Address"><Textarea value={form.address} onChange={set("address")} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
                <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
              </div>
            </div>
          )}
          {activeTab === "legal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
                <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="IEC Number"><Input value={form.iec_number} onChange={set("iec_number")} /></Field>
                <Field label="CIN Number"><Input value={form.cin_number} onChange={set("cin_number")} /></Field>
              </div>
            </div>
          )}
          {activeTab === "banking" && (
            <div className="space-y-4">
              <Field label="Bank Name"><Input value={form.bank_name} onChange={set("bank_name")} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Account Number"><Input value={form.bank_account} onChange={set("bank_account")} /></Field>
                <Field label="IFSC Code"><Input value={form.bank_ifsc} onChange={set("bank_ifsc")} /></Field>
              </div>
              <Field label="Branch"><Input value={form.bank_branch} onChange={set("bank_branch")} /></Field>
            </div>
          )}
          <ErrBanner msg={err} />
          <div className="mt-6 pt-4 border-t border-gray-100">
            <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save Company Profile"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────────
function Settings() {
  const { user } = useAuth();
  return (
    <div className="p-4 md:p-6 max-w-xl">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-700">Account</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
            {(user?.email || "U")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-800">{user?.user_metadata?.full_name || "User"}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <Badge text={user?.user_metadata?.role || "user"} color="blue" />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          💡 To update company details (GST, PAN, IEC), go to the <strong>Company</strong> section in the sidebar.
        </div>
      </div>
    </div>
  );
}


// ── DESKTOP APP SHELL ──────────────────────────────────────────────────────────
// ── AI CHAT ASSISTANT ────────────────────────────────────────────────────────
function AIChat({ companyId, onClose }) {
  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hi! I'm your Dockside AI assistant. Ask me anything about your business — inventory, deals, customers, profits, or insights." }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const userMsg = { role:"user", content: q };
    setMessages(p => [...p, userMsg]);
    setLoading(true);

    try {
      // Fetch live business data to give AI real context
      const [invR, dealsR, custsR, yardsR] = await Promise.all([
        sb.from("inventory").select("product_name,category,wood_type,available_quantity,unit,cost_price,market_value,stock_status,yard_id").eq("company_id", companyId).limit(100),
        sb.from("deals").select("customer_name,product_name,quantity,total_value,negotiated_price,stage,payment_status,created_at").eq("company_id", companyId).limit(100),
        sb.from("customers").select("name,city,phone").eq("company_id", companyId).limit(50),
        sb.from("yards").select("name,city").eq("company_id", companyId),
      ]);

      const inv   = invR.data   || [];
      const deals = dealsR.data || [];
      const custs = custsR.data || [];
      const yards = yardsR.data || [];

      const totalInvValue  = inv.reduce((s,i)=>(s+(i.cost_price||0)*(i.available_quantity||0)),0);
      const totalRevenue   = deals.filter(d=>d.payment_status==="Paid").reduce((s,d)=>(s+(d.total_value||0)),0);
      const pendingPayment = deals.filter(d=>d.payment_status==="Pending").reduce((s,d)=>(s+(d.total_value||0)),0);
      const activeDeals    = deals.filter(d=>!["completed","delivered"].includes((d.stage||"").toLowerCase())).length;
      const lowStock       = inv.filter(i=>(i.available_quantity||0)<10);
      const topProducts    = [...inv].sort((a,b)=>(b.available_quantity||0)-(a.available_quantity||0)).slice(0,5);

      const systemPrompt = `You are a smart business assistant for a timber trading company using Dockside ERP.
You have access to real-time business data. Be concise, use numbers, give actionable advice.

CURRENT BUSINESS SNAPSHOT:
- Inventory: ${inv.length} products, total value ₹${totalInvValue.toLocaleString("en-IN")}
- Low stock items (< 10 units): ${lowStock.map(i=>i.product_name).join(", ") || "none"}
- Top products by volume: ${topProducts.map(i=>i.product_name+" ("+i.available_quantity+" "+(i.unit||"")+" )").join(", ")}
- Yards: ${yards.map(y=>y.name).join(", ")}
- Deals: ${deals.length} total, ${activeDeals} active
- Revenue (paid): ₹${totalRevenue.toLocaleString("en-IN")}
- Pending payments: ₹${pendingPayment.toLocaleString("en-IN")}
- Customers: ${custs.length} total

RECENT DEALS (last 10):
${deals.slice(0,10).map(d=>(d.customer_name||"?")+"|"+(d.product_name||"?")+"|Qty:"+(d.quantity||0)+"|Rs"+(d.total_value||0)+"|"+(d.stage||"draft")).join("\n")}
")}

INVENTORY BREAKDOWN:
${inv.slice(0,20).map(i=>i.product_name+"|"+(i.available_quantity||0)+" "+(i.unit||"")+"|Rs"+(i.cost_price||0)+"|"+(i.stock_status||"Available")).join("\n")}
")}

Answer business questions clearly. Use ₹ for amounts. Give specific insights, not generic advice.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: systemPrompt,
          messages: [
            ...messages.filter(m=>m.role!=="assistant"||messages.indexOf(m)>0).map(m=>({ role:m.role, content:m.content })),
            { role:"user", content: q }
          ],
        }),
      });

      const data = await resp.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't get a response. Please try again.";
      setMessages(p => [...p, { role:"assistant", content: reply }]);
    } catch (e) {
      setMessages(p => [...p, { role:"assistant", content: "Error: " + e.message }]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    "Which stock is not moving?",
    "Show pending payments",
    "Top customers this month",
    "What should I price teak?",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-900 to-blue-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black text-white">AI</div>
            <div>
              <p className="text-white font-bold text-sm">Dockside AI</p>
              <p className="text-blue-300 text-xs">Powered by Claude</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cls("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cls("max-w-xs rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:"0ms"}} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:"150ms"}} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:"300ms"}} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {quickPrompts.map(p => (
              <button key={p} onClick={() => setInput(p)}
                className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold hover:bg-blue-100 transition-colors">
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask anything about your business..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all">
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DesktopApp({ user, companyId, role, onSignOut }) {
  const isAdmin = role !== "worker";
  const [showSearch, setShowSearch] = useState(false);
  const [showAI, setShowAI]         = useState(false);
  const [searchData, setSearchData] = useState({ inventory:[], deals:[], customers:[] });

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        // Load data for search
        Promise.all([
          sb.from("inventory").select("*").eq("company_id", companyId).limit(200),
          sb.from("deals").select("*").eq("company_id", companyId).limit(200),
          sb.from("customers").select("*").eq("company_id", companyId).limit(200),
        ]).then(([a, b, c]) => {
          setSearchData({ inventory: a.data||[], deals: b.data||[], customers: c.data||[] });
          setShowSearch(true);
        });
      }
      if (e.key === "Escape") setShowSearch(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [companyId]);

  return (
    <AuthCtx.Provider value={{ user, companyId, role }}>
      {/* AI Chat */}
      {showAI && <AIChat companyId={resolvedCompanyId || companyId} onClose={() => setShowAI(false)} />}

      {/* AI Floating Button */}
      {!showAI && (
        <button onClick={() => setShowAI(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl shadow-xl flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105">
          <span className="text-lg leading-none">AI</span>
          <span className="text-xs font-bold leading-none">Ask</span>
        </button>
      )}

      {showSearch && (
        <GlobalSearch
          inventory={searchData.inventory}
          deals={searchData.deals}
          customers={searchData.customers}
          onClose={() => setShowSearch(false)}
        />
      )}
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar onSignOut={onSignOut} role={role} />
        <div className="flex-1 ml-52 min-h-screen">
          <Routes>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transit"   element={<Transit />} />
            <Route path="/"          element={isAdmin ? <Dashboard />  : <Navigate to="/inventory" />} />
            <Route path="/yards"     element={isAdmin ? <Yards />      : <Navigate to="/inventory" />} />
            <Route path="/deals"     element={isAdmin ? <Deals />      : <Navigate to="/inventory" />} />
            <Route path="/suppliers" element={isAdmin ? <Suppliers />  : <Navigate to="/inventory" />} />
            <Route path="/customers" element={isAdmin ? <Customers />  : <Navigate to="/inventory" />} />
            <Route path="/financials"  element={isAdmin ? <Financials />  : <Navigate to="/inventory" />} />
            <Route path="/ai-insights" element={isAdmin ? <AIInsights />  : <Navigate to="/inventory" />} />
            <Route path="/reports"   element={isAdmin ? <Reports />    : <Navigate to="/inventory" />} />
            <Route path="/company"   element={isAdmin ? <Company />    : <Navigate to="/inventory" />} />
            <Route path="/settings"  element={isAdmin ? <Settings />   : <Navigate to="/inventory" />} />
            <Route path="*"          element={<Navigate to={isAdmin ? "/" : "/inventory"} />} />
          </Routes>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}
