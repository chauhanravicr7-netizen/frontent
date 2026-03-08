import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE CLIENT (direct — no backend needed for CRUD) ──────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lnpvozxmfvhstlmvyngh.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucHZvenhtZnZoc3RsbXZ5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTkyMTYsImV4cCI6MjA4ODM3NTIxNn0.fvtq216KybppnfurMwbonEvOI4goBandB6tI1FAmcSY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep axios-based API for reports/dashboard/auth endpoints only
import axios from "axios";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const api = axios.create({ baseURL: API });
api.interceptors.request.use(c => {
  const t = localStorage.getItem("dockside-token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// ── UTILS ──────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n && n !== 0) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "—";
const cls = (...a) => a.filter(Boolean).join(" ");
const today = () => new Date().toISOString().split("T")[0];
const genId = (prefix) => `${prefix}-${Date.now()}`;

// ── SHARED UI ──────────────────────────────────────────────────────────────────
const SlidePanel = ({ title, open, onClose, children, wide }) => (
  <>
    {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
    <div className={cls(
      "fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col",
      wide ? "w-[600px]" : "w-[480px]",
      open ? "translate-x-0" : "translate-x-full"
    )}>
      <div className="flex items-center justify-between p-5 border-b bg-gray-50">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 text-xl">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
    </div>
  </>
);

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
const Input = ({ ...p }) => <input {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />;
const Select = ({ children, ...p }) => <select {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">{children}</select>;
const Textarea = ({ ...p }) => <textarea {...p} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />;
const Btn = ({ children, onClick, disabled, variant = "primary", small }) => (
  <button onClick={onClick} disabled={disabled}
    className={cls(
      "rounded-lg font-semibold transition-all disabled:opacity-50 cursor-pointer",
      small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
      variant === "primary" && "bg-blue-600 hover:bg-blue-700 text-white",
      variant === "secondary" && "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200",
      variant === "danger" && "bg-red-600 hover:bg-red-700 text-white",
      variant === "green" && "bg-green-600 hover:bg-green-700 text-white",
    )}>{children}</button>
);

const Badge = ({ text, color }) => {
  const map = {
    green: "bg-green-100 text-green-700", blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700", red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700", gray: "bg-gray-100 text-gray-600",
    orange: "bg-orange-100 text-orange-700",
  };
  const auto = { draft:"gray", confirmed:"blue", dispatched:"orange", delivered:"green", completed:"green",
    created:"gray", loaded:"blue", "in transit":"purple", arrived:"yellow", paid:"green", pending:"yellow", partial:"orange" };
  const c = color || auto[(text||"").toLowerCase()] || "gray";
  return <span className={cls("px-2 py-0.5 rounded-full text-xs font-semibold", map[c] || map.gray)}>{text}</span>;
};

const ErrBanner = ({ msg }) => msg ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2">
    <span className="mt-0.5">⚠</span><span>{msg}</span>
  </div>
) : null;

const StatCard = ({ label, value, icon, color = "blue" }) => {
  const c = { blue:"bg-blue-50 text-blue-600", green:"bg-green-50 text-green-600", orange:"bg-orange-50 text-orange-600", purple:"bg-purple-50 text-purple-600", red:"bg-red-50 text-red-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
      <div className={cls("w-12 h-12 rounded-xl flex items-center justify-center text-xl", c[color])}>{icon}</div>
      <div><p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p><p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p></div>
    </div>
  );
};

const Spinner = () => <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

// ── SUPABASE ERROR HELPER ──────────────────────────────────────────────────────
const sbErr = (error) => error?.message || error?.details || JSON.stringify(error);

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
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

const Sidebar = ({ onSignOut }) => (
  <div className="w-52 bg-gray-900 text-white flex flex-col min-h-screen fixed top-0 left-0">
    <div className="px-4 py-5 border-b border-gray-700">
      <div className="text-lg font-black tracking-tight text-white">⚓ Dockside</div>
      <div className="text-xs text-gray-400 mt-0.5">Timber Trade OS</div>
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

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!email || !password) { setErr("Email and password are required"); return; }
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErr(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
      setLoading(false); return;
    }
    const user = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || data.user.email.split("@")[0],
    };
    localStorage.setItem("dockside-user", JSON.stringify(user));
    onLogin(user);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚓</div>
          <h1 className="text-2xl font-black text-gray-800">Dockside ERP</h1>
          <p className="text-gray-400 text-sm mt-1">Timber Trade Operating System</p>
        </div>
        <div className="space-y-4">
          <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••••" /></Field>
          {err && <ErrBanner msg={err} />}
          <button onClick={submit} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard() {
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("inventory").select("*"),
      supabase.from("deals").select("*"),
      supabase.from("shipments").select("*"),
      supabase.from("yards").select("*"),
    ]).then(([a, b, c, d]) => {
      setInv(a.data || []); setDeals(b.data || []);
      setShips(c.data || []); setYards(d.data || []);
      setLoading(false);
    });
  }, []);

  const totalInvValue = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || i.total_quantity || 0), 0);
  const totalUnits = inv.reduce((s, i) => s + (i.available_quantity || i.total_quantity || 0), 0);
  const activeShips = ships.filter(s => !["delivered","arrived"].includes((s.status||"").toLowerCase())).length;
  const revenue = deals.filter(d => ["completed","delivered"].includes((d.status||d.stage||"").toLowerCase())).reduce((s, d) => s + (d.total_value || d.total_amount || 0), 0);

  const catMap = {};
  inv.forEach(i => { const c = i.category || "Other"; catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];

  const months = ["Oct","Nov","Dec","Jan","Feb","Mar"];
  const chartData = months.map((m, i) => ({
    month: m,
    revenue: Math.round(revenue * (0.7 + i * 0.06)),
    cost: Math.round(totalInvValue * 0.1 * (0.8 + i * 0.04)),
  }));

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Command Center</h1><p className="text-gray-400 text-sm">Live business overview</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Inventory Value" value={fmt(totalInvValue)} icon="📦" color="blue" />
        <StatCard label="Total Volume" value={`${totalUnits} units`} icon="📊" color="green" />
        <StatCard label="Active Shipments" value={activeShips} icon="🚛" color="orange" />
        <StatCard label="Active Yards" value={yards.filter(y => y.is_active !== false).length} icon="🏗️" color="purple" />
        <StatCard label="Total Revenue" value={fmt(revenue)} icon="💰" color="green" />
        <StatCard label="Total Products" value={inv.length} icon="🪵" color="blue" />
        <StatCard label="Total Deals" value={deals.length} icon="🤝" color="orange" />
        <StatCard label="Pending Deals" value={deals.filter(d => ["draft","confirmed"].includes((d.stage||d.status||"").toLowerCase())).length} icon="⏳" color="purple" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">Revenue vs Cost (6M)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v} />
              <Tooltip formatter={v => fmt(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#dbeafe" name="Revenue" />
              <Area type="monotone" dataKey="cost" stroke="#f59e0b" fill="#fef3c7" name="Cost" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── INVENTORY ──────────────────────────────────────────────────────────────────
function Inventory() {
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const INV_DEFAULTS = {
    product_name: "", category: "Plywood", wood_type: "", quality_grade: "A",
    yard_id: "", supplier_id: "", unit: "pcs",
    cost_price: "", market_value: "", available_quantity: "",
    date: today(), notes: "",
    thickness: "", length: "", width: "",
  };
  const [form, setForm] = useState(INV_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("inventory").select("*").order("created_at", { ascending: false }),
      supabase.from("yards").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
    ]);
    setItems(a.data || []); setYards(b.data || []); setSuppliers(c.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeInv = () => { setShowAdd(false); setForm(INV_DEFAULTS); setErr(""); };

  const save = async () => {
    if (!form.product_name.trim()) { setErr("Product name is required"); return; }
    setSaving(true); setErr("");

    const selectedYard = yards.find(y => y.id === form.yard_id);
    const selectedSupplier = suppliers.find(s => s.id === form.supplier_id);

    // Exact column names from your Supabase inventory table
    const payload = {
      product_name: form.product_name.trim(),
      category: form.category,
      wood_type: form.wood_type || null,
      quality_grade: form.quality_grade || null,
      yard_id: form.yard_id || null,
      yard_name: selectedYard?.name || null,
      supplier_id: form.supplier_id || null,
      supplier_name: selectedSupplier?.name || null,
      unit: form.unit,
      cost_price: parseFloat(form.cost_price) || 0,
      market_value: parseFloat(form.market_value) || 0,
      available_quantity: parseFloat(form.available_quantity) || 0,
      total_quantity: parseFloat(form.available_quantity) || 0,
      reserved_quantity: 0,
      date: form.date || today(),
      notes: form.notes || null,
      thickness: form.thickness ? parseFloat(form.thickness) : null,
      length: form.length ? parseFloat(form.length) : null,
      width: form.width ? parseFloat(form.width) : null,
    };

    const { error } = await supabase.from("inventory").insert(payload);
    if (error) { setErr(sbErr(error)); setSaving(false); return; }
    closeInv(); fetchAll();
    setSaving(false);
  };

  const filtered = items.filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Inventory</h1><p className="text-gray-400 text-sm">{items.length} products</p></div>
        <div className="flex gap-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Product","Category","Wood Type","Grade","Yard","Available","Cost Price","Market Value","Total Value"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{i.product_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{i.wood_type || "—"}</td>
                  <td className="px-4 py-3"><Badge text={i.quality_grade || "—"} /></td>
                  <td className="px-4 py-3 text-gray-500">{i.yard_name || yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{i.available_quantity ?? 0}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{fmt(i.cost_price)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(i.market_value)}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{fmt((i.cost_price || 0) * (i.available_quantity || 0))}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No inventory found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Add Stock" open={showAdd} onClose={closeInv}>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Plywood 18mm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              <option>Plywood</option><option>Hardwood</option><option>Softwood</option>
              <option>Veneer</option><option>MDF</option><option>Logs</option><option>Particle Board</option>
            </Select>
          </Field>
          <Field label="Wood Type"><Input value={form.wood_type} onChange={set("wood_type")} placeholder="Teak, Pine, Birch…" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Thickness (mm)"><Input type="number" value={form.thickness} onChange={set("thickness")} placeholder="18" /></Field>
          <Field label="Length (ft)"><Input type="number" value={form.length} onChange={set("length")} placeholder="8" /></Field>
          <Field label="Width (ft)"><Input type="number" value={form.width} onChange={set("width")} placeholder="4" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade">
            <Select value={form.quality_grade} onChange={set("quality_grade")}>
              <option value="A">A</option><option value="B">B</option>
              <option value="C">C</option><option value="Premium">Premium</option>
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={set("unit")}>
              <option>pcs</option><option>sheets</option><option>m³</option><option>sqft</option><option>kg</option><option>CBM</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yard">
            <Select value={form.yard_id} onChange={set("yard_id")}>
              <option value="">— Select —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Supplier">
            <Select value={form.supplier_id} onChange={set("supplier_id")}>
              <option value="">— Select —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost Price (₹)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0" /></Field>
          <Field label="Market Value (₹)"><Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required><Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0" /></Field>
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
  const [yards, setYards] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const YARD_DEFAULTS = { name: "", city: "", address: "", manager_name: "", manager_phone: "", notes: "" };
  const [form, setForm] = useState(YARD_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("yards").select("*").order("name"),
      supabase.from("inventory").select("*"),
    ]);
    setYards(a.data || []); setInv(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeYard = () => { setShowAdd(false); setForm(YARD_DEFAULTS); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("Yard name is required"); return; }
    setSaving(true); setErr("");

    // Exact columns from your Supabase yards table
    const payload = {
      name: form.name.trim(),
      city: form.city || null,
      address: form.address || null,
      manager_name: form.manager_name || null,
      manager_phone: form.manager_phone || null,
      notes: form.notes || null,
      is_active: true,
    };

    const { error } = await supabase.from("yards").insert(payload);
    if (error) { setErr(sbErr(error)); setSaving(false); return; }
    closeYard(); fetchAll();
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Yards</h1><p className="text-gray-400 text-sm">{yards.length} locations</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Yard</Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {yards.map(y => {
            const yInv = inv.filter(i => i.yard_id === y.id);
            const val = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
            const units = yInv.reduce((s, i) => s + (i.available_quantity || 0), 0);
            return (
              <div key={y.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{y.name}</h3>
                    <p className="text-gray-400 text-sm">{y.city}</p>
                  </div>
                  <Badge text={y.is_active !== false ? "Active" : "Inactive"} color={y.is_active !== false ? "green" : "gray"} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-xs text-blue-400">Products</p><p className="font-bold text-blue-700">{yInv.length}</p></div>
                  <div className="bg-green-50 rounded-lg p-2 text-center"><p className="text-xs text-green-400">Units</p><p className="font-bold text-green-700">{units}</p></div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center"><p className="text-xs text-purple-400">Value</p><p className="font-bold text-purple-700 text-xs">{fmt(val)}</p></div>
                </div>
                {y.manager_name && <p className="text-xs text-gray-400">👤 {y.manager_name}{y.manager_phone && ` · ${y.manager_phone}`}</p>}
                {y.address && <p className="text-xs text-gray-300 mt-1">📍 {y.address}</p>}
              </div>
            );
          })}
          {yards.length === 0 && <div className="col-span-3 text-center py-20 text-gray-300">No yards added yet</div>}
        </div>
      )}

      <SlidePanel title="Add Yard" open={showAdd} onClose={closeYard}>
        <Field label="Yard Name" required><Input value={form.name} onChange={set("name")} placeholder="e.g. Plot 10 - North" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} placeholder="e.g. Bangalore" /></Field>
          <Field label="Manager Name"><Input value={form.manager_name} onChange={set("manager_name")} /></Field>
        </div>
        <Field label="Full Address"><Textarea value={form.address} onChange={set("address")} placeholder="Complete address of the yard" /></Field>
        <Field label="Manager Phone"><Input value={form.manager_phone} onChange={set("manager_phone")} placeholder="+91-XXXXXXXXXX" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Yard"}</Btn>
          <Btn variant="secondary" onClick={closeYard}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── DEALS ──────────────────────────────────────────────────────────────────────
function Deals() {
  const [deals, setDeals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [custDropOpen, setCustDropOpen] = useState(false);

  const DEAL_DEFAULTS = {
    customer_id: "", customer_name: "",
    inventory_id: "", product_name: "",
    quantity: "", unit_price: "",
    stage: "draft", payment_status: "Pending",
    notes: "", delivery_location: "",
  };
  const [form, setForm] = useState(DEAL_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("name"),
      supabase.from("inventory").select("*").order("product_name"),
    ]);
    setDeals(a.data || []); setCustomers(b.data || []); setInventory(c.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Draft","Confirmed","Dispatched","Delivered","Completed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.stage||d.status||"").toLowerCase() === tab.toLowerCase());

  const closeDeal = () => { setShowAdd(false); setForm(DEAL_DEFAULTS); setCustSearch(""); setErr(""); };

  const save = async () => {
    if (!form.customer_name.trim()) { setErr("Customer name is required"); return; }
    if (!form.inventory_id) { setErr("Please select a product"); return; }
    setSaving(true); setErr("");

    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    const selProd = inventory.find(i => i.id === form.inventory_id);

    // Auto-generate deal number
    const dealNum = genId("DEAL");

    // Exact columns from your Supabase deals table
    const payload = {
      deal_number: dealNum,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name.trim(),
      inventory_id: form.inventory_id,
      product_id: form.inventory_id,           // both columns exist
      product_name: selProd?.product_name || form.product_name || "",
      quantity: qty,
      unit: selProd?.unit || "pcs",
      unit_price: price,
      negotiated_price: price,
      total_value: qty * price,
      total_amount: qty * price,
      stage: form.stage,
      payment_status: form.payment_status,
      delivery_location: form.delivery_location || null,
      notes: form.notes || null,
      deal_date: new Date().toISOString(),
    };

    const { error } = await supabase.from("deals").insert(payload);
    if (error) { setErr(sbErr(error)); setSaving(false); return; }
    closeDeal(); fetchAll();
    setSaving(false);
  };

  const filteredCustomers = customers.filter(c =>
    !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Deals</h1><p className="text-gray-400 text-sm">{deals.length} total deals</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Create Deal</Btn>
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} {t === "All" ? `(${deals.length})` : `(${deals.filter(d => (d.stage||d.status||"").toLowerCase() === t.toLowerCase()).length})`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Deal #","Customer","Product","Qty","Value","Stage","Payment","Date"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</td>
                  <td className="px-4 py-3 font-semibold">{d.customer_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                  <td className="px-4 py-3">{d.quantity || "—"} {d.unit || ""}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value || d.total_amount)}</td>
                  <td className="px-4 py-3"><Badge text={d.stage || d.status || "draft"} /></td>
                  <td className="px-4 py-3"><Badge text={d.payment_status || "—"} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(d.deal_date || d.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No deals found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Create Deal" open={showAdd} onClose={closeDeal}>
        {/* Customer search with live dropdown */}
        <Field label="Customer" required>
          <div className="relative">
            <Input
              value={custSearch || form.customer_name}
              onChange={e => {
                setCustSearch(e.target.value);
                setForm(p => ({...p, customer_name: e.target.value, customer_id: ""}));
                setCustDropOpen(true);
              }}
              placeholder="Type to search customers…"
            />
            {custDropOpen && filteredCustomers.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto mt-1">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => {
                    setForm(p => ({...p, customer_id: c.id, customer_name: c.name}));
                    setCustSearch(c.name); setCustDropOpen(false);
                  }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
                    <p className="font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.city}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Select existing or type a new customer name</p>
        </Field>

        <Field label="Product" required>
          <Select value={form.inventory_id} onChange={e => {
            const sel = inventory.find(i => i.id === e.target.value);
            setForm(p => ({...p, inventory_id: e.target.value, product_name: sel?.product_name || ""}));
          }}>
            <option value="">— Select product —</option>
            {inventory.map(i => (
              <option key={i.id} value={i.id}>
                {i.product_name} ({i.available_quantity ?? 0} {i.unit || "pcs"})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label="Unit Price (₹)"><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
        </div>

        {form.quantity && form.unit_price && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-semibold">
            Total Value: {fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select value={form.stage} onChange={set("stage")}>
              <option value="draft">Draft</option><option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option><option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
          <Field label="Payment">
            <Select value={form.payment_status} onChange={set("payment_status")}>
              <option>Pending</option><option>Partial</option><option>Paid</option>
            </Select>
          </Field>
        </div>

        <Field label="Delivery Location"><Input value={form.delivery_location} onChange={set("delivery_location")} placeholder="City / Address" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Deal"}</Btn>
          <Btn variant="secondary" onClick={closeDeal}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ────────────────────────────────────────────────────────────────────
function Transit() {
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const TRANSIT_DEFAULTS = {
    vehicle_number: "", driver_name: "", driver_phone: "",
    origin_yard_id: "", destination: "",
    dispatch_date: today(), expected_arrival: "",
    freight_cost: "", status: "Created", cargo_details: "",
  };
  const [form, setForm] = useState(TRANSIT_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("shipments").select("*").order("created_at", { ascending: false }),
      supabase.from("yards").select("*").order("name"),
    ]);
    setShips(a.data || []); setYards(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Created","Loaded","Dispatched","In Transit","Arrived","Delivered"];
  const filtered = tab === "All" ? ships : ships.filter(s => (s.status||"").toLowerCase() === tab.toLowerCase());

  const closeTransit = () => { setShowAdd(false); setForm(TRANSIT_DEFAULTS); setErr(""); };

  const save = async () => {
    if (!form.destination.trim()) { setErr("Destination is required"); return; }
    setSaving(true); setErr("");

    const selectedYard = yards.find(y => y.id === form.origin_yard_id);

    // Exact columns from your Supabase shipments table
    const payload = {
      shipment_number: genId("SHIP"),
      vehicle_number: form.vehicle_number || null,
      driver_name: form.driver_name || null,
      driver_phone: form.driver_phone || null,
      driver_contact: form.driver_phone || null,
      origin_yard_id: form.origin_yard_id || null,
      origin_yard_name: selectedYard?.name || null,
      destination: form.destination.trim(),
      destination_location: form.destination.trim(),   // both columns exist
      dispatch_date: form.dispatch_date || null,
      expected_arrival: form.expected_arrival || null,
      estimated_arrival: form.expected_arrival || null,
      freight_cost: parseFloat(form.freight_cost) || 0,
      status: form.status,
      cargo_details: form.cargo_details || null,
      notes: form.cargo_details || null,
    };

    const { error } = await supabase.from("shipments").insert(payload);
    if (error) { setErr(sbErr(error)); setSaving(false); return; }
    closeTransit(); fetchAll();
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Transit</h1><p className="text-gray-400 text-sm">{ships.length} shipments tracked</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Shipment</Btn>
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} {t !== "All" && `(${ships.filter(s => (s.status||"").toLowerCase() === t.toLowerCase()).length})`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Shipment #","Vehicle","Driver","Origin","Destination","Dispatch","ETA","Status","Freight"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.shipment_number || `#${s.id?.toString().slice(-6)}`}</td>
                  <td className="px-4 py-3 font-semibold">{s.vehicle_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.origin_yard_name || yards.find(y => y.id === s.origin_yard_id)?.name || "—"}</td>
                  <td className="px-4 py-3">{s.destination || s.destination_location || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.dispatch_date)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.expected_arrival || s.estimated_arrival)}</td>
                  <td className="px-4 py-3"><Badge text={s.status || "—"} /></td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{fmt(s.freight_cost)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No shipments found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Add Shipment" open={showAdd} onClose={closeTransit}>
        <Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="GJ-12-AB-1234" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Driver Name"><Input value={form.driver_name} onChange={set("driver_name")} /></Field>
          <Field label="Driver Phone"><Input value={form.driver_phone} onChange={set("driver_phone")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin Yard">
            <Select value={form.origin_yard_id} onChange={set("origin_yard_id")}>
              <option value="">— Select —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Destination" required><Input value={form.destination} onChange={set("destination")} placeholder="City / Address" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={set("dispatch_date")} /></Field>
          <Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={set("expected_arrival")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Freight Cost (₹)"><Input type="number" value={form.freight_cost} onChange={set("freight_cost")} placeholder="0" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {["Created","Loaded","Dispatched","In Transit","Arrived","Delivered"].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Cargo Details"><Textarea value={form.cargo_details} onChange={set("cargo_details")} placeholder="Describe the cargo…" /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn>
          <Btn variant="secondary" onClick={closeTransit}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── SUPPLIERS ──────────────────────────────────────────────────────────────────
function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const SUPPLIER_DEFAULTS = { name:"", city:"", country:"India", contact_person:"", phone:"", email:"", gst_number:"", pan_number:"", products_supplied:"", notes:"" };
  const [form, setForm] = useState(SUPPLIER_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("inventory").select("*"),
    ]);
    setSuppliers(a.data || []); setInv(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeSupplier = () => { setShowAdd(false); setForm(SUPPLIER_DEFAULTS); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("Supplier name is required"); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.from("suppliers").insert({
      name: form.name.trim(),
      city: form.city || null,
      country: form.country || null,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      gst_number: form.gst_number || null,
      pan_number: form.pan_number || null,
      products_supplied: form.products_supplied || null,
      notes: form.notes || null,
    });
    if (error) { setErr(sbErr(error)); setSaving(false); return; }
    closeSupplier(); fetchAll();
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Suppliers</h1><p className="text-gray-400 text-sm">{suppliers.length} suppliers</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Supplier</Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Supplier","Location","GST","Contact","Products Supplied","Inv. Items"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-bold text-gray-800">{s.name}</p><p className="text-xs text-gray-400">{s.contact_person}</p></td>
                  <td className="px-4 py-3 text-gray-500">{[s.city, s.country].filter(Boolean).join(", ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.gst_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone || s.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.products_supplied || "—"}</td>
                  <td className="px-4 py-3 font-semibold">{inv.filter(i => i.supplier_id === s.id).length}</td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-300">No suppliers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Add Supplier" open={showAdd} onClose={closeSupplier}>
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} placeholder="AAAAA0000A" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Products Supplied"><Input value={form.products_supplied} onChange={set("products_supplied")} placeholder="Teak, Plywood…" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Supplier"}</Btn>
          <Btn variant="secondary" onClick={closeSupplier}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────────
function Customers() {
  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const CUSTOMER_DEFAULTS = { name:"", city:"", country:"India", phone:"", email:"", gst_number:"", pan_number:"", notes:"" };
  const [form, setForm] = useState(CUSTOMER_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("deals").select("*"),
    ]);
    setCustomers(a.data || []); setDeals(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeCustomer = () => { setShowAdd(false); setForm(CUSTOMER_DEFAULTS); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("Customer name is required"); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.from("customers").insert({
      name: form.name.trim(),
      city: form.city || null,
      country: form.country || null,
      phone: form.phone || null,
      email: form.email || null,
      gst_number: form.gst_number || null,
      pan_number: form.pan_number || null,
      notes: form.notes || null,
    });
    if (error) { setErr(sbErr(error)); setSaving(false); return; }
    closeCustomer(); fetchAll();
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Customers</h1><p className="text-gray-400 text-sm">{customers.length} customers</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Customer</Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Customer","Location","GST","Contact","Total Deals","Revenue","Last Deal"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const cDeals = deals.filter(d => d.customer_id === c.id);
                const rev = cDeals.reduce((s, d) => s + (d.total_value || d.total_amount || 0), 0);
                const last = cDeals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-bold">{c.name}</p></td>
                    <td className="px-4 py-3 text-gray-500">{[c.city, c.country].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.gst_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || c.email || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{cDeals.length}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmt(rev)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(last?.deal_date || last?.created_at)}</td>
                  </tr>
                );
              })}
              {customers.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-300">No customers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Add Customer" open={showAdd} onClose={closeCustomer}>
        <Field label="Customer Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} placeholder="AAAAA0000A" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Customer"}</Btn>
          <Btn variant="secondary" onClick={closeCustomer}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── FINANCIALS ─────────────────────────────────────────────────────────────────
function Financials() {
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("inventory").select("*"),
      supabase.from("deals").select("*"),
    ]).then(([a, b]) => {
      setInv(a.data || []); setDeals(b.data || []);
      setLoading(false);
    });
  }, []);

  const totalCost = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const marketVal = inv.reduce((s, i) => s + (i.market_value || i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = deals.filter(d => ["completed","delivered"].includes((d.stage||d.status||"").toLowerCase())).reduce((s, d) => s + (d.total_value || d.total_amount || 0), 0);
  const profit = revenue - totalCost * 0.7;

  const catData = {};
  inv.forEach(i => { const c = i.category || "Other"; catData[c] = (catData[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const barData = Object.entries(catData).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Financials</h1><p className="text-gray-400 text-sm">P&L overview</p></div>
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={fmt(revenue)} icon="💰" color="green" />
            <StatCard label="Inventory Cost" value={fmt(totalCost)} icon="📦" color="blue" />
            <StatCard label="Market Value" value={fmt(marketVal)} icon="📈" color="purple" />
            <StatCard label="Est. Profit" value={fmt(profit)} icon="✨" color="orange" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold mb-4">Inventory by Category (₹)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h3 className="font-bold">P&L Summary</h3>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs text-green-500 uppercase tracking-wide">Total Revenue</p>
                <p className="text-2xl font-black text-green-700">{fmt(revenue)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-500 uppercase tracking-wide">Inventory Cost</p>
                <p className="text-2xl font-black text-blue-700">{fmt(totalCost)}</p>
              </div>
              <div className={`${profit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border rounded-xl p-4`}>
                <p className="text-xs uppercase tracking-wide text-gray-500">Estimated Profit</p>
                <p className={`text-2xl font-black ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(profit)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── REPORTS ────────────────────────────────────────────────────────────────────
function Reports() {
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    supabase.from("company").select("*").limit(1).then(({ data }) => { if (data?.[0]) setCompany(data[0]); });
  }, []);

  const REPORTS = [
    { key:"inventory", label:"Inventory Report", icon:"📦", desc:"All stock with valuation" },
    { key:"sales", label:"Sales Report", icon:"🤝", desc:"All deals and revenue" },
    { key:"shipments", label:"Shipment Report", icon:"🚛", desc:"Transit & logistics" },
    { key:"suppliers", label:"Supplier Report", icon:"🏭", desc:"Supplier directory" },
    { key:"customers", label:"Customer Report", icon:"👥", desc:"Customer revenue analysis" },
  ];

  const tableMap = { inventory:"inventory", sales:"deals", shipments:"shipments", suppliers:"suppliers", customers:"customers" };

  const downloadPDF = async (type, label) => {
    setLoading(p => ({...p, [type]: true}));
    try {
      const { data } = await supabase.from(tableMap[type]).select("*");
      generatePDF(type, label, data || [], company);
    } catch (e) { alert("Failed: " + e.message); }
    setLoading(p => ({...p, [type]: false}));
  };

  const fmt2 = (n) => { if (!n) return "—"; if (n >= 1e5) return `₹${(n/1e5).toFixed(2)}L`; return `₹${Number(n).toLocaleString("en-IN")}`; };

  const generatePDF = (type, label, data, co) => {
    const now = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${label}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a1a}.page{max-width:900px;margin:0 auto;padding:32px}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #1e3a5f;margin-bottom:20px}.company-name{font-size:22px;font-weight:900;color:#1e3a5f}.report-title-box{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:14px 20px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.report-title{font-size:16px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:#1e3a5f;color:white}th{padding:8px 10px;text-align:left;font-weight:600}tbody tr:nth-child(even){background:#f8fafc}td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155}.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="page">
  <div class="header"><div><div class="company-name">${co.name||"Dockside Timber"}</div><div style="font-size:10px;color:#64748b">Timber Trade Operating System</div>${co.address?`<div style="font-size:10px;color:#64748b;margin-top:4px">${co.address}</div>`:""}</div>
  <div style="text-align:right;font-size:10px;color:#475569">${co.gst_number?`<div>GST: <b>${co.gst_number}</b></div>`:""} ${co.pan_number?`<div>PAN: <b>${co.pan_number}</b></div>`:""}</div></div>
  <div class="report-title-box"><div><div class="report-title">📊 ${label}</div><div style="font-size:11px;opacity:0.8;margin-top:2px">${data.length} records</div></div><div style="font-size:10px;opacity:0.85;text-align:right"><div>Generated: ${now}</div><div>Dockside ERP</div></div></div>
  ${buildTableRows(type, data)}
</div>
<div style="max-width:900px;margin:0 auto;padding:0 32px"><div class="footer"><span>${co.name||"Dockside"} · Confidential</span><span>${now}</span></div></div>
</body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const buildTableRows = (type, data) => {
    if (type === "inventory") return `<table><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Wood Type</th><th>Grade</th><th>Unit</th><th>Qty</th><th>Cost Price</th><th>Total Value</th></tr></thead><tbody>${data.map((i,idx)=>`<tr><td>${idx+1}</td><td><b>${i.product_name||"—"}</b></td><td>${i.category||"—"}</td><td>${i.wood_type||"—"}</td><td>${i.quality_grade||"—"}</td><td>${i.unit||"—"}</td><td>${i.available_quantity||0}</td><td>₹${(i.cost_price||0).toLocaleString("en-IN")}</td><td>₹${((i.cost_price||0)*(i.available_quantity||0)).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table>`;
    if (type === "sales") return `<table><thead><tr><th>#</th><th>Deal No.</th><th>Customer</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total Value</th><th>Stage</th><th>Payment</th></tr></thead><tbody>${data.map((d,idx)=>`<tr><td>${idx+1}</td><td>${d.deal_number||"—"}</td><td>${d.customer_name||"—"}</td><td>${d.product_name||"—"}</td><td>${d.quantity||"—"}</td><td>₹${(d.unit_price||0).toLocaleString("en-IN")}</td><td>₹${(d.total_value||d.total_amount||0).toLocaleString("en-IN")}</td><td>${d.stage||d.status||"—"}</td><td>${d.payment_status||"—"}</td></tr>`).join("")}</tbody></table>`;
    if (type === "shipments") return `<table><thead><tr><th>#</th><th>Shipment No.</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Dispatch</th><th>ETA</th><th>Status</th><th>Freight</th></tr></thead><tbody>${data.map((s,idx)=>`<tr><td>${idx+1}</td><td>${s.shipment_number||"—"}</td><td>${s.vehicle_number||"—"}</td><td>${s.driver_name||"—"}</td><td>${s.destination||"—"}</td><td>${fmtDate(s.dispatch_date)}</td><td>${fmtDate(s.expected_arrival)}</td><td>${s.status||"—"}</td><td>₹${(s.freight_cost||0).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table>`;
    if (type === "suppliers") return `<table><thead><tr><th>#</th><th>Supplier</th><th>City</th><th>Country</th><th>GST No.</th><th>Contact</th><th>Phone</th><th>Products</th></tr></thead><tbody>${data.map((s,idx)=>`<tr><td>${idx+1}</td><td><b>${s.name||"—"}</b></td><td>${s.city||"—"}</td><td>${s.country||"—"}</td><td>${s.gst_number||"—"}</td><td>${s.contact_person||"—"}</td><td>${s.phone||"—"}</td><td>${s.products_supplied||"—"}</td></tr>`).join("")}</tbody></table>`;
    if (type === "customers") return `<table><thead><tr><th>#</th><th>Customer</th><th>City</th><th>Country</th><th>GST No.</th><th>Phone</th><th>Email</th></tr></thead><tbody>${data.map((c,idx)=>`<tr><td>${idx+1}</td><td><b>${c.name||"—"}</b></td><td>${c.city||"—"}</td><td>${c.country||"—"}</td><td>${c.gst_number||"—"}</td><td>${c.phone||"—"}</td><td>${c.email||"—"}</td></tr>`).join("")}</tbody></table>`;
    return "<p>No data</p>";
  };

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Reports</h1><p className="text-gray-400 text-sm">Professional PDF reports with company letterhead</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({ name:"", industry:"Timber Trade", city:"", country:"India", address:"", owner_name:"", phone:"", email:"", website:"", gst_number:"", pan_number:"", iec_number:"", cin_number:"", bank_name:"", bank_account:"", bank_ifsc:"", bank_branch:"", notes:"" });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  useEffect(() => {
    supabase.from("company").select("*").limit(1).then(({ data }) => {
      if (data?.[0]) {
        setCompany(data[0]);
        // Only copy editable fields into form — never copy id/timestamps
        const d = data[0];
        setForm({
          name: d.name || "", industry: d.industry || "Timber Trade",
          city: d.city || "", country: d.country || "India",
          address: d.address || "", owner_name: d.owner_name || "",
          phone: d.phone || "", email: d.email || "", website: d.website || "",
          gst_number: d.gst_number || "", pan_number: d.pan_number || "",
          iec_number: d.iec_number || "", cin_number: d.cin_number || "",
          bank_name: d.bank_name || "", bank_account: d.bank_account || "",
          bank_ifsc: d.bank_ifsc || "", bank_branch: d.bank_branch || "",
          notes: d.notes || "",
        });
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    if (!form.name.trim()) { setErr("Company name is required"); return; }
    setSaving(true); setErr("");
    // Only send writable columns — never send id, created_at, updated_at, logo_url, currency
    const payload = {
      name: form.name.trim(),
      industry: form.industry || null,
      city: form.city || null,
      country: form.country || null,
      address: form.address || null,
      owner_name: form.owner_name || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      gst_number: form.gst_number || null,
      pan_number: form.pan_number || null,
      iec_number: form.iec_number || null,
      cin_number: form.cin_number || null,
      bank_name: form.bank_name || null,
      bank_account: form.bank_account || null,
      bank_ifsc: form.bank_ifsc || null,
      bank_branch: form.bank_branch || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    try {
      if (company?.id) {
        const { error } = await supabase.from("company").update(payload).eq("id", company.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("company").insert(payload).select().single();
        if (error) throw error;
        setCompany(data);
      }
      alert("✅ Company profile saved!");
    } catch (e) { setErr(sbErr(e)); }
    setSaving(false);
  };

  const TABS = [
    { id:"profile", label:"Company Profile", icon:"🏢" },
    { id:"legal", label:"Legal & Tax", icon:"⚖️" },
    { id:"banking", label:"Banking", icon:"🏦" },
  ];

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Company Settings</h1><p className="text-gray-400 text-sm">Legal details, tax registration, banking</p></div>
      {company?.name && (
        <div className="bg-gradient-to-r from-gray-900 to-blue-900 text-white rounded-xl p-5 mb-6 flex items-start justify-between">
          <div>
            <p className="text-2xl font-black">{company.name}</p>
            <p className="text-blue-200 text-sm mt-1">{company.industry}</p>
            <p className="text-gray-300 text-xs mt-2">{company.address}</p>
          </div>
          <div className="text-right text-xs text-blue-200 space-y-1">
            {company.gst_number && <p>GST: <span className="text-white font-mono">{company.gst_number}</span></p>}
            {company.pan_number && <p>PAN: <span className="text-white font-mono">{company.pan_number}</span></p>}
            {company.owner_name && <p>👤 {company.owner_name}</p>}
          </div>
        </div>
      )}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cls("px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all", activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        {activeTab === "profile" && (
          <div className="space-y-4">
            <Field label="Company Name" required><Input value={form.name} onChange={set("name")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry"><Select value={form.industry} onChange={set("industry")}><option>Timber Trade</option><option>Wood Products</option><option>Construction Materials</option><option>Import/Export</option></Select></Field>
              <Field label="Owner Name"><Input value={form.owner_name} onChange={set("owner_name")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
              <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
            </div>
            <Field label="Address"><Textarea value={form.address} onChange={set("address")} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
            </div>
          </div>
        )}
        {activeTab === "legal" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27AABCS1429B1ZB" /></Field>
              <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} placeholder="AABCS1429B" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IEC Number"><Input value={form.iec_number} onChange={set("iec_number")} /></Field>
              <Field label="CIN Number"><Input value={form.cin_number} onChange={set("cin_number")} /></Field>
            </div>
          </div>
        )}
        {activeTab === "banking" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name"><Input value={form.bank_name} onChange={set("bank_name")} /></Field>
              <Field label="Account Number"><Input value={form.bank_account} onChange={set("bank_account")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IFSC Code"><Input value={form.bank_ifsc} onChange={set("bank_ifsc")} /></Field>
              <Field label="Branch Name"><Input value={form.bank_branch} onChange={set("bank_branch")} /></Field>
            </div>
          </div>
        )}
        <ErrBanner msg={err} />
        <div className="mt-6 pt-4 border-t border-gray-100">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save Company Profile"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────────
function Settings() {
  const user = JSON.parse(localStorage.getItem("dockside-user") || "{}");
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-700">Account</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">{(user.full_name || user.email || "U")[0].toUpperCase()}</div>
          <div>
            <p className="font-bold text-gray-800">{user.full_name || "User"}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
            <Badge text={user.role || "user"} color="blue" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("dockside-user")); } catch { return null; } });

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("dockside-token");
    localStorage.removeItem("dockside-user");
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar onSignOut={signOut} />
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
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
