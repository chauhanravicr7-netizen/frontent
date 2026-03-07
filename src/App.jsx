import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = import.meta.env.VITE_API_URL || "https://dockside-backend-1.onrender.com";
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
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
    gray: "bg-gray-100 text-gray-600",
    orange: "bg-orange-100 text-orange-700",
  };
  const auto = {
    draft: "gray", confirmed: "blue", dispatched: "orange", delivered: "green", completed: "green",
    created: "gray", loaded: "blue", "in transit": "purple", arrived: "yellow", paid: "green", pending: "yellow", partial: "orange"
  };
  const c = color || auto[(text || "").toLowerCase()] || "gray";
  return <span className={cls("px-2 py-0.5 rounded-full text-xs font-semibold", map[c] || map.gray)}>{text}</span>;
};

const ErrBanner = ({ msg }) => msg ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2">
    <span className="mt-0.5">⚠</span><span>{msg}</span>
  </div>
) : null;

const StatCard = ({ label, value, icon, color = "blue" }) => {
  const c = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", orange: "bg-orange-50 text-orange-600", purple: "bg-purple-50 text-purple-600", red: "bg-red-50 text-red-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
      <div className={cls("w-12 h-12 rounded-xl flex items-center justify-center text-xl", c[color])}>{icon}</div>
      <div><p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p><p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p></div>
    </div>
  );
};

const Spinner = () => <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

// ── GST AUTOFILL COMPONENT ─────────────────────────────────────────────────────
const GstLookup = ({ onFound }) => {
  const [gst, setGst] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const lookup = async () => {
    if (!gst.trim()) return;
    setLoading(true); setMsg("");
    try {
      const { data } = await api.get(`/api/lookup/gst/${gst.trim()}`);
      if (data) { onFound(data); setMsg(`✅ Found: ${data.name}`); }
      else setMsg("❌ GST number not found in records");
    } catch { setMsg("❌ Lookup failed"); }
    finally { setLoading(false); }
  };
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-blue-700 mb-2">🔍 GST Auto-Fill</p>
      <div className="flex gap-2">
        <input value={gst} onChange={e => setGst(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && lookup()}
          placeholder="Type GST number & press Enter…"
          className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white uppercase" />
        <Btn onClick={lookup} disabled={loading} small>{loading ? "…" : "Fill"}</Btn>
      </div>
      {msg && <p className="text-xs mt-1.5 text-blue-700">{msg}</p>}
    </div>
  );
};

// ── AUTOCOMPLETE INPUT ─────────────────────────────────────────────────────────
const AutocompleteInput = ({ endpoint, placeholder, onSelect, value, onChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = async (q) => {
    if (!q) { setSuggestions([]); return; }
    try {
      const { data } = await api.get(`${endpoint}?q=${encodeURIComponent(q)}`);
      setSuggestions(data || []);
      setOpen(true);
    } catch { }
  };

  return (
    <div className="relative" ref={ref}>
      <input value={value} onChange={e => { onChange(e.target.value); search(e.target.value); }}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto mt-1">
          {suggestions.map(s => (
            <button key={s.id} onClick={() => { onSelect(s); setOpen(false); onChange(s.name); }}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
              <p className="font-semibold text-gray-800">{s.name}</p>
              <p className="text-xs text-gray-400">{[s.city, s.gst_number].filter(Boolean).join(" · ")}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
    setLoading(true); setErr("");
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("dockside-token", data.token);
      localStorage.setItem("dockside-user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setErr(e.response?.data?.error || "Login failed");
    } finally { setLoading(false); }
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
  const [stats, setStats] = useState({});
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    api.get("/api/dashboard/stats").then(r => setStats(r.data)).catch(() => { });
    api.get("/api/inventory").then(r => setInv(r.data || [])).catch(() => { });
    api.get("/api/deals").then(r => setDeals(r.data || [])).catch(() => { });
  }, []);

  const catMap = {};
  inv.forEach(i => { const c = i.category || i.wood_type || "Other"; catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const chartData = months.map((m, i) => ({
    month: m,
    revenue: Math.round((stats.monthlyRevenue || 0) * (0.7 + i * 0.06)),
    cost: Math.round((stats.totalInventoryValue || 0) * 0.1 * (0.8 + i * 0.04)),
  }));

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Command Center</h1><p className="text-gray-400 text-sm">Live business overview</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Inventory Value" value={fmt(stats.totalInventoryValue)} icon="📦" color="blue" />
        <StatCard label="Total Volume" value={`${stats.totalVolume || 0} units`} icon="📊" color="green" />
        <StatCard label="Active Shipments" value={stats.activeShipments || 0} icon="🚛" color="orange" />
        <StatCard label="Pending Deliveries" value={stats.pendingDeliveries || 0} icon="⏳" color="purple" />
        <StatCard label="Monthly Revenue" value={fmt(stats.monthlyRevenue)} icon="💰" color="green" />
        <StatCard label="Active Yards" value={stats.activeYards || 0} icon="🏗️" color="blue" />
        <StatCard label="Total Products" value={stats.totalProducts || 0} icon="🪵" color="orange" />
        <StatCard label="Total Deals" value={deals.length} icon="🤝" color="purple" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">Revenue vs Cost (6M)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v} />
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
              <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
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
  const [form, setForm] = useState({ product_name: "", category: "Plywood", wood_type: "", grade: "A", yard_id: "", supplier_id: "", unit: "pcs", cost_price: "", market_value: "", available_quantity: "", date: today(), notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([api.get("/api/inventory"), api.get("/api/yards"), api.get("/api/suppliers")]).catch(() => [[], [], []]);
    setItems(a?.data || []); setYards(b?.data || []); setSuppliers(c?.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (!form.product_name) { setErr("Product name required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/api/inventory", { ...form, cost_price: parseFloat(form.cost_price) || 0, market_value: parseFloat(form.market_value) || 0, available_quantity: parseFloat(form.available_quantity) || 0 });
      setShowAdd(false); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
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
              <tr>{["Product", "Category", "Wood Type", "Grade", "Yard", "Available", "Reserved", "Cost Price", "Total Value"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{i.product_name || i.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{i.wood_type || "—"}</td>
                  <td className="px-4 py-3"><Badge text={i.grade || "—"} /></td>
                  <td className="px-4 py-3 text-gray-500">{yards.find(y => y.id === i.yard_id)?.name || i.yard_id || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{i.available_quantity || 0}</td>
                  <td className="px-4 py-3 text-gray-500">{i.reserved_quantity || 0}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{fmt(i.cost_price)}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{fmt((i.cost_price || 0) * (i.available_quantity || 0))}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No inventory found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Stock" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Plywood 18mm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select value={form.category} onChange={set("category")}><option>Plywood</option><option>Hardwood</option><option>Softwood</option><option>Veneer</option><option>MDF</option><option>Particle Board</option></Select></Field>
          <Field label="Wood Type"><Input value={form.wood_type} onChange={set("wood_type")} placeholder="Teak, Pine…" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Thickness (mm)"><Input value={form.thickness} onChange={set("thickness")} placeholder="18" /></Field>
          <Field label="Length (ft)"><Input value={form.length} onChange={set("length")} placeholder="8" /></Field>
          <Field label="Width (ft)"><Input value={form.width} onChange={set("width")} placeholder="4" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade"><Select value={form.grade} onChange={set("grade")}><option>A</option><option>B</option><option>C</option><option>Premium</option></Select></Field>
          <Field label="Unit"><Select value={form.unit} onChange={set("unit")}><option>pcs</option><option>sheets</option><option>m³</option><option>sqft</option><option>kg</option></Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yard"><Select value={form.yard_id} onChange={set("yard_id")}><option value="">— Select —</option>{yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <Field label="Supplier"><Select value={form.supplier_id} onChange={set("supplier_id")}><option value="">— Select —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
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
          <Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn>
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
  const [form, setForm] = useState({ name: "", city: "", address: "", manager_name: "", manager_phone: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api.get("/api/yards"), api.get("/api/inventory")]).catch(() => [[], []]);
    setYards(a?.data || []); setInv(b?.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (!form.name) { setErr("Yard name required"); return; }
    setSaving(true); setErr("");
    try { await api.post("/api/yards", form); setShowAdd(false); fetchAll(); }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
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
                {y.manager_name && <p className="text-xs text-gray-400">👤 {y.manager_name} {y.manager_phone && `· ${y.manager_phone}`}</p>}
                {y.address && <p className="text-xs text-gray-300 mt-1">📍 {y.address}</p>}
              </div>
            );
          })}
          {yards.length === 0 && <div className="col-span-3 text-center py-20 text-gray-300">No yards added yet</div>}
        </div>
      )}
      <SlidePanel title="Add Yard" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Yard Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Manager Name"><Input value={form.manager_name} onChange={set("manager_name")} /></Field>
        </div>
        <Field label="Full Address"><Textarea value={form.address} onChange={set("address")} /></Field>
        <Field label="Manager Phone"><Input value={form.manager_phone} onChange={set("manager_phone")} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Yard"}</Btn><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn></div>
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
  const [custName, setCustName] = useState("");
  const [form, setForm] = useState({ customer_id: "", product_id: "", quantity: "", unit_price: "", status: "draft", payment_status: "Pending", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([api.get("/api/deals"), api.get("/api/customers"), api.get("/api/inventory")]).catch(() => [[], [], []]);
    setDeals(a?.data || []); setCustomers(b?.data || []); setInventory(c?.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All", "Draft", "Confirmed", "Dispatched", "Delivered", "Completed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.status || "").toLowerCase() === tab.toLowerCase());

  const save = async () => {
    if (!form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unit_price) || 0;
      const selProd = inventory.find(i => i.id === form.product_id);
      await api.post("/api/deals", {
        customer_id: form.customer_id || undefined,
        customer_name: custName,
        product_id: form.product_id || undefined,
        product_name: selProd?.product_name || selProd?.name || undefined,
        quantity: qty,
        unit_price: price,
        total_value: qty * price,
        total_amount: qty * price,
        status: form.status,
        stage: form.status,
        payment_status: form.payment_status,
        notes: form.notes || undefined,
      });
      setShowAdd(false);
      setForm({ customer_id: "", product_id: "", quantity: "", unit_price: "", status: "draft", payment_status: "Pending", notes: "" });
      setCustName("");
      fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Deals</h1><p className="text-gray-400 text-sm">{deals.length} total deals</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Create Deal</Btn>
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} {t === "All" ? `(${deals.length})` : `(${deals.filter(d => (d.status || "").toLowerCase() === t.toLowerCase()).length})`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Deal #", "Customer", "Product", "Qty", "Value", "Stage", "Payment", "Date"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const cust = customers.find(c => c.id === d.customer_id);
                const prod = inventory.find(i => i.id === d.product_id);
                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</td>
                    <td className="px-4 py-3 font-semibold">{d.customer_name || cust?.name || d.customer_id || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{d.product_name || prod?.product_name || "—"}</td>
                    <td className="px-4 py-3">{d.quantity || "—"}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value || d.value || d.total_amount)}</td>
                    <td className="px-4 py-3"><Badge text={d.status || d.stage || "draft"} /></td>
                    <td className="px-4 py-3"><Badge text={d.payment_status || "—"} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(d.created_at)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No deals found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Create Deal" open={showAdd} onClose={() => setShowAdd(false)}>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          💡 Type customer name to search existing, or select from dropdown
        </div>
        <Field label="Customer" required>
          <AutocompleteInput
            endpoint="/api/autocomplete/customers"
            placeholder="Type customer name…"
            value={custName}
            onChange={v => setCustName(v)}
            onSelect={c => { setForm(p => ({ ...p, customer_id: c.id })); setCustName(c.name); }}
          />
        </Field>
        <Field label="Product">
          <Select value={form.product_id} onChange={set("product_id")}>
            <option value="">— Select product —</option>
            {inventory.map(i => <option key={i.id} value={i.id}>{i.product_name || i.name} ({i.available_quantity} {i.unit || "pcs"})</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label="Unit Price (₹)"><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
        </div>
        {form.quantity && form.unit_price && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-700 font-semibold">
            Total Value: {fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select value={form.status} onChange={set("status")}>
              <option value="draft">Draft</option><option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option><option value="delivered">Delivered</option><option value="completed">Completed</option>
            </Select>
          </Field>
          <Field label="Payment">
            <Select value={form.payment_status} onChange={set("payment_status")}>
              <option>Pending</option><option>Partial</option><option>Paid</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Deal"}</Btn><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn></div>
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
  const [form, setForm] = useState({ vehicle_number: "", driver_name: "", driver_phone: "", origin_yard_id: "", origin_yard_name: "", destination: "", dispatch_date: today(), expected_arrival: "", freight_cost: "", status: "Created", cargo_details: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api.get("/api/shipments"), api.get("/api/yards")]).catch(() => [[], []]);
    setShips(a?.data || []); setYards(b?.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All", "Created", "Loaded", "Dispatched", "In Transit", "Arrived", "Delivered"];
  const filtered = tab === "All" ? ships : ships.filter(s => (s.status || "").toLowerCase() === tab.toLowerCase());

  const save = async () => {
    if (!form.destination) { setErr("Destination required"); return; }
    setSaving(true); setErr("");
    try {
      // Send all possible column name aliases — server safeInsert keeps only valid ones
      console.log("origin_yard_name:", form.origin_yard_name, "yards:", yards);
      await api.post("/api/shipments", {
        vehicle_number: form.vehicle_number, vehicle_no: form.vehicle_number,
        driver_name: form.driver_name, driver_phone: form.driver_phone, driver_contact: form.driver_phone,
        origin_yard_id: form.origin_yard_id || null, from_yard_id: form.origin_yard_id || null,
        origin_yard_name: form.origin_yard_name || null, from_yard_name: form.origin_yard_name || null,
        destination: form.destination, to_location: form.destination,
        dispatch_date: form.dispatch_date, dispatched_at: form.dispatch_date, shipment_date: form.dispatch_date,
        expected_arrival: form.expected_arrival, eta: form.expected_arrival, estimated_arrival: form.expected_arrival,
        freight_cost: parseFloat(form.freight_cost) || 0, freight_charges: parseFloat(form.freight_cost) || 0,
        status: form.status, shipment_status: form.status,
        cargo_details: form.cargo_details, cargo_description: form.cargo_details, notes: form.cargo_details,
      });
      setShowAdd(false);
      setForm({ vehicle_number: "", driver_name: "", driver_phone: "", origin_yard_id: "", destination: "", dispatch_date: today(), expected_arrival: "", freight_cost: "", status: "Created", cargo_details: "" });
      fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
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
            {t} {t !== "All" && `(${ships.filter(s => (s.status || "").toLowerCase() === t.toLowerCase()).length})`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Shipment #", "Vehicle", "Driver", "Origin", "Destination", "Dispatch", "ETA", "Status", "Freight"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.shipment_number || `#${s.id?.toString().slice(-6)}`}</td>
                  <td className="px-4 py-3 font-semibold">{s.vehicle_number || s.vehicle_no || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{yards.find(y => y.id === s.origin_yard_id)?.name || "—"}</td>
                  <td className="px-4 py-3">{s.destination || s.to_location || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.dispatch_date || s.dispatched_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.expected_arrival || s.eta)}</td>
                  <td className="px-4 py-3"><Badge text={s.status || "—"} /></td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{fmt(s.freight_cost || s.freight_charges)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No shipments found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Shipment" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="MH-12-AB-1234" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Driver Name"><Input value={form.driver_name} onChange={set("driver_name")} /></Field>
          <Field label="Driver Phone"><Input value={form.driver_phone} onChange={set("driver_phone")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin Yard"><Select value={form.origin_yard_id} onChange={e => { const yard = yards.find(y => String(y.id) === String(e.target.value)); setForm(p => ({ ...p, origin_yard_id: e.target.value, origin_yard_name: yard?.name || "" })); }}><option value="">— Select —</option>{yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <Field label="Destination" required><Input value={form.destination} onChange={set("destination")} placeholder="City / Address" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={set("dispatch_date")} /></Field>
          <Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={set("expected_arrival")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Freight Cost (₹)"><Input type="number" value={form.freight_cost} onChange={set("freight_cost")} placeholder="0" /></Field>
          <Field label="Status"><Select value={form.status} onChange={set("status")}>
            {["Created", "Loaded", "Dispatched", "In Transit", "Arrived", "Delivered"].map(s => <option key={s}>{s}</option>)}
          </Select></Field>
        </div>
        <Field label="Cargo Details"><Textarea value={form.cargo_details} onChange={set("cargo_details")} placeholder="Describe the cargo…" /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn></div>
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
  const [form, setForm] = useState({ name: "", city: "", country: "India", contact_person: "", phone: "", email: "", gst_number: "", pan_number: "", products_supplied: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api.get("/api/suppliers"), api.get("/api/inventory")]).catch(() => [[], []]);
    setSuppliers(a?.data || []); setInv(b?.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try { await api.post("/api/suppliers", form); setShowAdd(false); fetchAll(); }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
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
              <tr>{["Supplier", "Location", "GST", "Contact", "Products Supplied", "Inv. Items", "Action"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
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
                  <td className="px-4 py-3"><Btn small variant="secondary" onClick={() => { }}>View</Btn></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-300">No suppliers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Supplier" open={showAdd} onClose={() => setShowAdd(false)}>
        <GstLookup onFound={d => { setForm(p => ({ ...p, name: d.name || p.name, city: d.city || p.city, contact_person: d.contact_person || p.contact_person, phone: d.phone || p.phone, email: d.email || p.email, gst_number: d.gst_number || p.gst_number, pan_number: d.pan_number || p.pan_number })); }} />
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" className="uppercase" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} placeholder="AAAAA0000A" className="uppercase" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Products Supplied"><Input value={form.products_supplied} onChange={set("products_supplied")} placeholder="Teak, Plywood…" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Supplier"}</Btn><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn></div>
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
  const [form, setForm] = useState({ name: "", city: "", country: "India", phone: "", email: "", gst_number: "", pan_number: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api.get("/api/customers"), api.get("/api/deals")]).catch(() => [[], []]);
    setCustomers(a?.data || []); setDeals(b?.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try { await api.post("/api/customers", form); setShowAdd(false); fetchAll(); }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
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
              <tr>{["Customer", "Location", "GST", "Contact", "Total Deals", "Revenue", "Last Deal"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const cDeals = deals.filter(d => d.customer_id === c.id);
                const rev = cDeals.reduce((s, d) => s + (d.total_value || d.value || 0), 0);
                const last = cDeals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-bold">{c.name}</p></td>
                    <td className="px-4 py-3 text-gray-500">{[c.city, c.country].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.gst_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || c.email || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{cDeals.length}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmt(rev)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(last?.created_at)}</td>
                  </tr>
                );
              })}
              {customers.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-300">No customers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Customer" open={showAdd} onClose={() => setShowAdd(false)}>
        <GstLookup onFound={d => { setForm(p => ({ ...p, name: d.name || p.name, city: d.city || p.city, phone: d.phone || p.phone, email: d.email || p.email, gst_number: d.gst_number || p.gst_number })); }} />
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
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Customer"}</Btn><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn></div>
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
    Promise.all([api.get("/api/inventory"), api.get("/api/deals")]).then(([a, b]) => {
      setInv(a.data || []); setDeals(b.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalCost = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const marketVal = inv.reduce((s, i) => s + (i.market_value || i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = deals.filter(d => ["completed", "delivered", "closed"].includes((d.status || "").toLowerCase())).reduce((s, d) => s + (d.total_value || d.value || 0), 0);
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
            <StatCard label="Est. Profit (18%)" value={fmt(profit)} icon="✨" color="orange" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold mb-4">Inventory by Category (₹)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v} />
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

// ── REPORTS (PDF download) ─────────────────────────────────────────────────────
function Reports() {
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState({});
  useEffect(() => { api.get("/api/company").then(r => setCompany(r.data || {})).catch(() => { }); }, []);

  const REPORTS = [
    { key: "inventory", label: "Inventory Report", icon: "📦", desc: "All stock with valuation" },
    { key: "sales", label: "Sales Report", icon: "🤝", desc: "All deals and revenue" },
    { key: "shipments", label: "Shipment Report", icon: "🚛", desc: "Transit & logistics" },
    { key: "suppliers", label: "Supplier Report", icon: "🏭", desc: "Supplier directory" },
    { key: "customers", label: "Customer Report", icon: "👥", desc: "Customer revenue analysis" },
  ];

  const downloadPDF = async (type, label) => {
    setLoading(p => ({ ...p, [type]: true }));
    try {
      const { data } = await api.get(`/api/reports/${type}`);
      generatePDF(type, label, data, company);
    } catch (e) { alert("Failed to fetch data: " + e.message); }
    setLoading(p => ({ ...p, [type]: false }));
  };

  const generatePDF = (type, label, data, co) => {
    const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const rows = buildTableRows(type, data);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${label}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 32px; }
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #1e3a5f; margin-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 900; color: #1e3a5f; letter-spacing: -0.5px; }
  .company-tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
  .company-legal { text-align: right; font-size: 10px; color: #475569; line-height: 1.6; }
  .company-legal strong { color: #1e3a5f; }
  /* Report title */
  .report-title-box { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 14px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .report-title { font-size: 16px; font-weight: 800; }
  .report-meta { font-size: 10px; opacity: 0.85; text-align: right; }
  /* Summary cards */
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .card-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
  .card-value { font-size: 18px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }
  /* Table */
  .section-title { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #1e3a5f; color: white; }
  th { padding: 8px 10px; text-align: left; font-weight: 600; letter-spacing: 0.3px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: #eff6ff; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .num { text-align: right; font-weight: 600; font-family: monospace; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-orange { background: #fed7aa; color: #9a3412; }
  .badge-gray { background: #f1f5f9; color: #475569; }
  /* Footer */
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="company-name">${co.name || "Dockside Timber"}</div>
      <div class="company-tagline">Timber Trade Operating System</div>
      ${co.address ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${co.address}</div>` : ""}
    </div>
    <div class="company-legal">
      ${co.gst_number ? `<div><strong>GST:</strong> ${co.gst_number}</div>` : ""}
      ${co.pan_number ? `<div><strong>PAN:</strong> ${co.pan_number}</div>` : ""}
      ${co.iec_number ? `<div><strong>IEC:</strong> ${co.iec_number}</div>` : ""}
      ${co.owner_name ? `<div><strong>Proprietor:</strong> ${co.owner_name}</div>` : ""}
      ${co.phone ? `<div><strong>Ph:</strong> ${co.phone}</div>` : ""}
      ${co.email ? `<div><strong>Email:</strong> ${co.email}</div>` : ""}
    </div>
  </div>
  <div class="report-title-box">
    <div>
      <div class="report-title">📊 ${label}</div>
      <div style="font-size:11px;opacity:0.8;margin-top:2px">${data.length} records</div>
    </div>
    <div class="report-meta">
      <div>Generated: ${now}</div>
      <div>Dockside ERP v2.0</div>
    </div>
  </div>
  ${buildSummary(type, data)}
  <div class="section-title">Detailed Records</div>
  ${rows}
</div>
<div style="max-width:900px;margin:0 auto;padding:0 32px">
  <div class="footer">
    <span>${co.name || "Dockside Timber"} · Confidential Business Report</span>
    <span>Generated on ${now} by Dockside ERP</span>
  </div>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const buildSummary = (type, data) => {
    if (type === "inventory") {
      const total = data.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
      const units = data.reduce((s, i) => s + (i.available_quantity || 0), 0);
      return `<div class="summary">
        <div class="card"><div class="card-label">Total Products</div><div class="card-value">${data.length}</div></div>
        <div class="card"><div class="card-label">Total Units</div><div class="card-value">${units}</div></div>
        <div class="card"><div class="card-label">Inventory Value</div><div class="card-value">${fmt(total)}</div></div>
        <div class="card"><div class="card-label">Avg Cost</div><div class="card-value">${fmt(total / (data.length || 1))}</div></div>
      </div>`;
    }
    if (type === "sales") {
      const rev = data.reduce((s, d) => s + (d.total_value || d.value || 0), 0);
      const completed = data.filter(d => ["completed", "delivered"].includes((d.status || "").toLowerCase())).length;
      return `<div class="summary">
        <div class="card"><div class="card-label">Total Deals</div><div class="card-value">${data.length}</div></div>
        <div class="card"><div class="card-label">Total Revenue</div><div class="card-value">${fmt(rev)}</div></div>
        <div class="card"><div class="card-label">Completed</div><div class="card-value">${completed}</div></div>
        <div class="card"><div class="card-label">Avg Deal Value</div><div class="card-value">${fmt(rev / (data.length || 1))}</div></div>
      </div>`;
    }
    if (type === "shipments") {
      const freight = data.reduce((s, d) => s + (d.freight_cost || d.freight_charges || 0), 0);
      const delivered = data.filter(d => (d.status || "").toLowerCase() === "delivered").length;
      return `<div class="summary">
        <div class="card"><div class="card-label">Total Shipments</div><div class="card-value">${data.length}</div></div>
        <div class="card"><div class="card-label">Delivered</div><div class="card-value">${delivered}</div></div>
        <div class="card"><div class="card-label">Total Freight</div><div class="card-value">${fmt(freight)}</div></div>
        <div class="card"><div class="card-label">In Transit</div><div class="card-value">${data.length - delivered}</div></div>
      </div>`;
    }
    return `<div class="summary"><div class="card"><div class="card-label">Total Records</div><div class="card-value">${data.length}</div></div></div>`;
  };

  const buildTableRows = (type, data) => {
    const badge = (text, color = "gray") => `<span class="badge badge-${color}">${text || "—"}</span>`;
    if (type === "inventory") {
      return `<table><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Wood Type</th><th>Grade</th><th>Unit</th><th class="num">Qty</th><th class="num">Cost Price</th><th class="num">Total Value</th></tr></thead><tbody>
        ${data.map((i, idx) => `<tr><td>${idx + 1}</td><td><strong>${i.product_name || i.name || "—"}</strong></td><td>${i.category || "—"}</td><td>${i.wood_type || "—"}</td><td>${i.grade || "—"}</td><td>${i.unit || "—"}</td><td class="num">${i.available_quantity || 0}</td><td class="num">₹${(i.cost_price || 0).toLocaleString("en-IN")}</td><td class="num">₹${((i.cost_price || 0) * (i.available_quantity || 0)).toLocaleString("en-IN")}</td></tr>`).join("")}
      </tbody></table>`;
    }
    if (type === "sales") {
      return `<table><thead><tr><th>#</th><th>Deal No.</th><th>Customer</th><th>Product</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total Value</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead><tbody>
        ${data.map((d, idx) => `<tr><td>${idx + 1}</td><td>${d.deal_number || "—"}</td><td>${d.customer_name || "—"}</td><td>${d.product_name || "—"}</td><td class="num">${d.quantity || "—"}</td><td class="num">₹${(d.unit_price || 0).toLocaleString("en-IN")}</td><td class="num">₹${(d.total_value || d.value || 0).toLocaleString("en-IN")}</td><td>${badge(d.status || "draft", "blue")}</td><td>${badge(d.payment_status || "—", "orange")}</td><td>${fmtDate(d.created_at)}</td></tr>`).join("")}
      </tbody></table>`;
    }
    if (type === "shipments") {
      return `<table><thead><tr><th>#</th><th>Shipment No.</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Dispatch Date</th><th>ETA</th><th>Status</th><th class="num">Freight</th></tr></thead><tbody>
        ${data.map((s, idx) => `<tr><td>${idx + 1}</td><td>${s.shipment_number || "—"}</td><td>${s.vehicle_number || s.vehicle_no || "—"}</td><td>${s.driver_name || "—"}</td><td>${s.destination || s.to_location || "—"}</td><td>${fmtDate(s.dispatch_date || s.dispatched_at)}</td><td>${fmtDate(s.expected_arrival || s.eta)}</td><td>${badge(s.status || "—", "blue")}</td><td class="num">₹${(s.freight_cost || s.freight_charges || 0).toLocaleString("en-IN")}</td></tr>`).join("")}
      </tbody></table>`;
    }
    if (type === "suppliers") {
      return `<table><thead><tr><th>#</th><th>Supplier Name</th><th>City</th><th>Country</th><th>GST No.</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Products</th></tr></thead><tbody>
        ${data.map((s, idx) => `<tr><td>${idx + 1}</td><td><strong>${s.name || "—"}</strong></td><td>${s.city || "—"}</td><td>${s.country || "—"}</td><td>${s.gst_number || "—"}</td><td>${s.contact_person || "—"}</td><td>${s.phone || "—"}</td><td>${s.email || "—"}</td><td>${s.products_supplied || "—"}</td></tr>`).join("")}
      </tbody></table>`;
    }
    if (type === "customers") {
      return `<table><thead><tr><th>#</th><th>Customer Name</th><th>City</th><th>Country</th><th>GST No.</th><th>Phone</th><th>Email</th><th>Notes</th></tr></thead><tbody>
        ${data.map((c, idx) => `<tr><td>${idx + 1}</td><td><strong>${c.name || "—"}</strong></td><td>${c.city || "—"}</td><td>${c.country || "—"}</td><td>${c.gst_number || "—"}</td><td>${c.phone || "—"}</td><td>${c.email || "—"}</td><td>${c.notes || "—"}</td></tr>`).join("")}
      </tbody></table>`;
    }
    return "<p>No data</p>";
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800">Reports</h1>
        <p className="text-gray-400 text-sm">Professional PDF reports with company letterhead</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div>
          <p className="font-semibold text-blue-800 text-sm">Reports include your company letterhead</p>
          <p className="text-blue-600 text-xs mt-0.5">Go to Company Settings to add GST, IEC, PAN, owner name and address — these will appear on all reports.</p>
        </div>
      </div>
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

// ── COMPANY MODULE ─────────────────────────────────────────────────────────────
function Company() {
  const [company, setCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [err, setErr] = useState("");
  const [branchErr, setBranchErr] = useState("");
  const [showBranch, setShowBranch] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    name: "", industry: "Timber Trade", city: "", country: "India", address: "",
    owner_name: "", phone: "", email: "", website: "",
    gst_number: "", pan_number: "", iec_number: "", cin_number: "",
    bank_name: "", bank_account: "", bank_ifsc: "", bank_branch: "",
    notes: ""
  });
  const [branchForm, setBranchForm] = useState({ name: "", city: "", address: "", manager_name: "", phone: "", gst_number: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setB = k => e => setBranchForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [co, br] = await Promise.all([api.get("/api/company"), api.get("/api/branches").catch(() => ({ data: [] }))]);
      const coData = co.data || {};
      setCompany(coData);
      if (coData.id) setForm(coData);
      setBranches(br.data || []);
    } catch { }
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      if (company?.id) { await api.put(`/api/company/${company.id}`, form); }
      else { await api.post("/api/company", form); }
      fetchAll();
      alert("✅ Company profile saved!");
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const saveBranch = async () => {
    if (!branchForm.name) { setBranchErr("Branch name required"); return; }
    setSavingBranch(true); setBranchErr("");
    try {
      await api.post("/api/branches", { ...branchForm, company_id: company?.id });
      setShowBranch(false); setBranchForm({ name: "", city: "", address: "", manager_name: "", phone: "", gst_number: "" });
      fetchAll();
    } catch (e) { setBranchErr(e.response?.data?.error || e.message); }
    setSavingBranch(false);
  };

  const TABS = [
    { id: "profile", label: "Company Profile", icon: "🏢" },
    { id: "legal", label: "Legal & Tax", icon: "⚖️" },
    { id: "banking", label: "Banking", icon: "🏦" },
    { id: "branches", label: "Branches", icon: "📍" },
  ];

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800">Company Settings</h1>
        <p className="text-gray-400 text-sm">Legal details, tax registration, banking & branches</p>
      </div>

      {/* Company card preview */}
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
            {company.iec_number && <p>IEC: <span className="text-white font-mono">{company.iec_number}</span></p>}
            {company.owner_name && <p>👤 {company.owner_name}</p>}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cls("px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all",
              activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        {activeTab === "profile" && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Company Profile</h3>
            <Field label="Company / Firm Name" required><Input value={form.name} onChange={set("name")} placeholder="Your company name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry"><Select value={form.industry} onChange={set("industry")}><option>Timber Trade</option><option>Wood Products</option><option>Construction Materials</option><option>Import/Export</option></Select></Field>
              <Field label="Owner / Proprietor Name"><Input value={form.owner_name} onChange={set("owner_name")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
              <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
            </div>
            <Field label="Registered Address"><Textarea value={form.address} onChange={set("address")} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
            </div>
          </div>
        )}

        {activeTab === "legal" && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Legal & Tax Registration</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27AABCS1429B1ZB" className="font-mono uppercase" /></Field>
              <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} placeholder="AABCS1429B" className="font-mono uppercase" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IEC Number (Import/Export Code)"><Input value={form.iec_number} onChange={set("iec_number")} placeholder="AABCS1429" className="font-mono uppercase" /></Field>
              <Field label="CIN Number (if Pvt Ltd)"><Input value={form.cin_number} onChange={set("cin_number")} className="font-mono uppercase" /></Field>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              ⚠️ These numbers appear on all PDF reports as company letterhead. Keep them accurate.
            </div>
          </div>
        )}

        {activeTab === "banking" && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Banking Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name"><Input value={form.bank_name} onChange={set("bank_name")} /></Field>
              <Field label="Account Number"><Input value={form.bank_account} onChange={set("bank_account")} className="font-mono" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IFSC Code"><Input value={form.bank_ifsc} onChange={set("bank_ifsc")} className="font-mono uppercase" /></Field>
              <Field label="Branch Name"><Input value={form.bank_branch} onChange={set("bank_branch")} /></Field>
            </div>
          </div>
        )}

        {activeTab === "branches" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700">Branch Offices</h3>
              <Btn small onClick={() => setShowBranch(true)}>+ Add Branch</Btn>
            </div>
            {branches.length === 0 ? (
              <div className="text-center py-10 text-gray-300"><p className="text-4xl mb-2">📍</p><p>No branches added</p></div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {branches.map(b => (
                  <div key={b.id} className="border border-gray-200 rounded-xl p-4">
                    <p className="font-bold text-gray-800">{b.name}</p>
                    <p className="text-sm text-gray-500">{b.city}</p>
                    <p className="text-xs text-gray-400 mt-1">{b.address}</p>
                    {b.manager_name && <p className="text-xs text-gray-400 mt-1">👤 {b.manager_name} · {b.phone}</p>}
                    {b.gst_number && <p className="text-xs font-mono text-gray-400">GST: {b.gst_number}</p>}
                  </div>
                ))}
              </div>
            )}
            {showBranch && (
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
                <h4 className="font-bold text-blue-800 text-sm">New Branch</h4>
                <Field label="Branch Name" required><Input value={branchForm.name} onChange={setB("name")} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City"><Input value={branchForm.city} onChange={setB("city")} /></Field>
                  <Field label="Manager"><Input value={branchForm.manager_name} onChange={setB("manager_name")} /></Field>
                </div>
                <Field label="Address"><Textarea value={branchForm.address} onChange={setB("address")} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone"><Input value={branchForm.phone} onChange={setB("phone")} /></Field>
                  <Field label="GST Number"><Input value={branchForm.gst_number} onChange={setB("gst_number")} className="font-mono" /></Field>
                </div>
                <ErrBanner msg={branchErr} />
                <div className="flex gap-2"><Btn small onClick={saveBranch} disabled={savingBranch}>{savingBranch ? "…" : "Save Branch"}</Btn><Btn small variant="secondary" onClick={() => setShowBranch(false)}>Cancel</Btn></div>
              </div>
            )}
          </div>
        )}

        <ErrBanner msg={err} />
        {activeTab !== "branches" && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save Company Profile"}</Btn>
          </div>
        )}
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          💡 To update company details (GST, PAN, IEC, branches), go to the <strong>Company</strong> section in the sidebar.
        </div>
      </div>
    </div>
  );
}

// ── AI INSIGHTS ────────────────────────────────────────────────────────────────
function AIInsights() {
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    api.get("/api/inventory").then(r => setInv(r.data || []));
    api.get("/api/deals").then(r => setDeals(r.data || []));
  }, []);

  const lowStock = inv.filter(i => (i.available_quantity || 0) < 10);
  const topProducts = Object.entries(inv.reduce((m, i) => { const k = i.category || "Other"; m[k] = (m[k] || 0) + (i.available_quantity || 0); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">AI Insights</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-2xl mb-2">🔮</div>
          <h3 className="font-bold text-gray-800 mb-3">Demand Prediction</h3>
          <div className="space-y-2 text-sm">
            {topProducts.map(([cat, qty]) => (
              <div key={cat} className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                <span className="text-gray-700">{cat}</span>
                <span className="font-bold text-blue-700">{qty} units</span>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">Based on current inventory levels</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-2xl mb-2">⚠️</div>
          <h3 className="font-bold text-gray-800 mb-3">Inventory Alerts</h3>
          <div className="space-y-2 text-sm">
            {lowStock.length === 0 ? <p className="text-green-600 text-sm">✅ All stock levels healthy</p> :
              lowStock.slice(0, 4).map(i => (
                <div key={i.id} className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-gray-700">{i.product_name || i.name}</span>
                  <Badge text={`${i.available_quantity} left`} color="red" />
                </div>
              ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-2xl mb-2">📈</div>
          <h3 className="font-bold text-gray-800 mb-3">Sales Analytics</h3>
          <div className="space-y-2 text-sm">
            <div className="p-2 bg-green-50 rounded-lg flex justify-between">
              <span className="text-gray-700">Total Deals</span>
              <span className="font-bold text-green-700">{deals.length}</span>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg flex justify-between">
              <span className="text-gray-700">Pending</span>
              <span className="font-bold text-orange-700">{deals.filter(d => d.status === "draft").length}</span>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg flex justify-between">
              <span className="text-gray-700">Completed</span>
              <span className="font-bold text-blue-700">{deals.filter(d => ["completed", "delivered"].includes(d.status)).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("dockside-user")); } catch { return null; } });

  const signOut = () => {
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
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/company" element={<Company />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
