import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signOut, db } from "./lib/supabase";
import {
  useAuth, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner
} from "./shared";

// ── NAVIGATION (Fixed: Duplicate NAV removed) ──────────────────────────────────
const NAV = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/yards", label: "Yards", icon: "🏗️" },
  { to: "/deals", label: "Deals", icon: "🤝" },
  { to: "/transit", label: "Transit", icon: "🚛" },
  { to: "/suppliers", label: "Suppliers", icon: "🏭" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/financials", label: "Financials", icon: "💰" },
  { to: "/reports", label: "Reports", icon: "📄" },
  { to: "/company", label: "Company", icon: "🏢" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
const Sidebar = ({ onSignOut }) => (
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
      {NAV.map(n => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"}
          className={({ isActive }) => cls(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all",
            isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
          )}>
          <span className="text-base">{n.icon}</span>{n.label}
        </NavLink>
      ))}
    </nav>
    <div className="p-3 border-t border-gray-700">
      <button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
        <span>🚪</span> Sign Out
      </button>
    </div>
  </div>
);

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);

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
  const pendingPay = deals.filter(d => d.payment_status === "Pending").length;

  const catMap = {};
  inv.forEach(i => { const c = i.category || "Other"; catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800">Command Center</h1>
        <p className="text-gray-400 text-sm">Live business overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Inventory Value" value={fmt(totalValue)} icon="📦" color="blue" />
        <StatCard label="Total Volume" value={`${Math.round(totalVolume)} units`} icon="📊" color="green" />
        <StatCard label="Active Shipments" value={activeShips} icon="🚛" color="orange" />
        <StatCard label="Active Yards" value={activeYards} icon="🏗️" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">Inventory by Category</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-300">No data available</div>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
           <h3 className="font-bold text-gray-700 mb-4">Recent Deals</h3>
           <div className="space-y-3">
              {deals.slice(0, 5).map(d => (
                <div key={d.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{d.customer_name || "Customer"}</p>
                    <p className="text-xs text-gray-400">{fmtDate(d.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-blue-700 text-sm">{fmt(d.total_value)}</p>
                    <Badge text={d.payment_status} color={d.payment_status === "Paid" ? "green" : "orange"} />
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}

// ── INVENTORY ──────────────────────────────────────────────────────────────────
function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
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
  }, [calc?.totalCFT, calc?.totalCBM, timberType]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        sb.from("inventory").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId).order("name"),
        sb.from("suppliers").select("*").eq("company_id", companyId).order("name"),
      ]);
      setItems(a.data || []); setYards(b.data || []); setSuppliers(c.data || []);
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
        quality_grade: form.grade || null,
        yard_id: form.yard_id || null,
        yard_name: yard?.name || null,
        supplier_id: form.supplier_id || null,
        supplier_name: sup?.name || null,
        unit: form.unit || "pcs",
        cost_price: parseNum(form.cost_price) || 0,
        available_quantity: parseNum(form.available_quantity) || 0,
        date: form.date || today(),
      }]);
      if (error) throw error;
      setShowAdd(false); setForm(INV_DEFAULTS); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Inventory</h1><p className="text-sm text-gray-400">{items.length} products total</p></div>
        <div className="flex gap-3">
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Yard</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold">{i.product_name}</td>
                <td className="px-4 py-3 text-gray-500">{i.yard_name || "—"}</td>
                <td className="px-4 py-3">{i.available_quantity} {i.unit}</td>
                <td className="px-4 py-3 text-green-700 font-bold">{fmt(i.cost_price)}</td>
                <td className="px-4 py-3 text-blue-700 font-black">{fmt(i.cost_price * i.available_quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SlidePanel title="Add Stock" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} /></Field>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Cost Price"><Input type="number" value={form.cost_price} onChange={set("cost_price")} /></Field>
          <Field label="Quantity"><Input type="number" value={form.available_quantity} onChange={set("available_quantity")} /></Field>
        </div>
        <ErrBanner msg={err} />
        <div className="mt-6 flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Product"}</Btn>
          <Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── PLACEHOLDERS FOR OTHER PAGES ───────────────────────────────────────────────
function Yards() { return <div className="p-10 text-gray-400">Yards Module coming soon...</div>; }
function Deals() { return <div className="p-10 text-gray-400">Deals Module coming soon...</div>; }
function Transit() { return <div className="p-10 text-gray-400">Transit Module coming soon...</div>; }
function Suppliers() { return <div className="p-10 text-gray-400">Suppliers Module coming soon...</div>; }
function Customers() { return <div className="p-10 text-gray-400">Customers Module coming soon...</div>; }
function Financials() { return <div className="p-10 text-gray-400">Financials Module coming soon...</div>; }
function Reports() { return <div className="p-10 text-gray-400">Reports Module coming soon...</div>; }
function Company() { return <div className="p-10 text-gray-400">Company Profile coming soon...</div>; }
function Settings() { return <div className="p-10 text-gray-400">Settings Module coming soon...</div>; }

// ── MAIN APP SHELL ────────────────────────────────────────────────────────────
export default function DesktopApp({ user, companyId, onSignOut }) {
  return (
    <AuthCtx.Provider value={{ user, companyId }}>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar onSignOut={onSignOut} />
        <div className="flex-1 ml-52 min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/yards" element={<Yards />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/transit" element={<Transit />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/company" element={<Company />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}
