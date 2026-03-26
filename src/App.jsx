import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";

// ── GLOBAL API CLIENT ──────────────────────────────────────────────────────────
const api = (() => {
  const getHeaders = () => {
    const h = { "Content-Type": "application/json" };
    const t = localStorage.getItem("dockside-token");
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  };
  const req = async (method, url, body) => {
    const res = await fetch(`${API}${url}`, {
      method, headers: getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error || data?.hint || `HTTP ${res.status}`;
      // 🔥 ARCHITECTURE UPGRADE: Dispatch global event for instant UI visibility
      window.dispatchEvent(new CustomEvent("dockside-error", { detail: errMsg }));
      const err = new Error(errMsg);
      err.response = { data, status: res.status };
      throw err;
    }
    return { data };
  };
  return {
    get:    (url)       => req("GET",    url),
    post:   (url, body) => req("POST",   url, body),
    put:    (url, body) => req("PUT",    url, body),
    delete: (url)       => req("DELETE", url),
  };
})();

const clean = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== "")
);

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
const ErrBanner = ({ msg }) => msg ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2 shadow-sm animate-fade-in">
    <span className="mt-0.5">⚠️</span><span className="font-medium">{msg}</span>
  </div>
) : null;

// 🔥 ARCHITECTURE UPGRADE: SlidePanel now accepts 'error' prop and pins it to the top
const SlidePanel = ({ title, open, onClose, children, wide, error }) => (
  <>
    {open && <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />}
    <div className={cls(
      "fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col",
      wide ? "w-[640px]" : "w-[500px]",
      open ? "translate-x-0" : "translate-x-full"
    )}>
      <div className="flex items-center justify-between p-5 border-b bg-gray-50">
        <h2 className="text-lg font-black text-gray-800">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-xl transition-colors">×</button>
      </div>
      {error && (
        <div className="px-5 pt-4 pb-1">
          <ErrBanner msg={error} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
    </div>
  </>
);

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
const Input = (p) => <input {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm" />;
const Select = ({ children, ...p }) => <select {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all shadow-sm">{children}</select>;
const Textarea = (p) => <textarea {...p} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />;
const Btn = ({ children, onClick, disabled, variant = "primary", small }) => (
  <button onClick={onClick} disabled={disabled}
    className={cls(
      "rounded-lg font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2",
      small ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm",
      variant === "primary" && "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-200",
      variant === "secondary" && "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200",
      variant === "danger" && "bg-red-600 hover:bg-red-700 text-white",
      variant === "green" && "bg-green-600 hover:bg-green-700 text-white",
      variant === "orange" && "bg-orange-500 hover:bg-orange-600 text-white",
    )}>{children}</button>
);

const Badge = ({ text, color }) => {
  const map = {
    green: "bg-green-100 text-green-700", blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700", red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700", gray: "bg-gray-100 text-gray-600",
    orange: "bg-orange-100 text-orange-700", teal: "bg-teal-100 text-teal-700",
  };
  const auto = {
    draft: "gray", confirmed: "blue", dispatched: "orange", delivered: "green", completed: "green",
    closed: "teal", created: "gray", loaded: "blue", "in transit": "purple",
    arrived: "yellow", paid: "green", pending: "yellow", partial: "orange",
    purchase: "blue", sale: "orange", incoming: "blue", outgoing: "orange",
    reserved: "purple", available: "green",
  };
  const c = color || auto[(text || "").toLowerCase()] || "gray";
  return <span className={cls("px-2.5 py-1 rounded-full text-xs font-bold border border-white/20", map[c] || map.gray)}>{text}</span>;
};

const StatCard = ({ label, value, icon, color = "blue", sub }) => {
  const c = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", orange: "bg-orange-50 text-orange-600", purple: "bg-purple-50 text-purple-600", red: "bg-red-50 text-red-600", teal: "bg-teal-50 text-teal-600" };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cls("w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-inner", c[color])}>{icon}</div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs font-semibold text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
};

const Spinner = () => <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" /></div>;

// ── STATUS PIPELINE ────────────────────────────────────────────────────────────
const DEAL_STAGES =["Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];
const StatusPipeline = ({ current }) => {
  const idx = DEAL_STAGES.findIndex(s => s.toLowerCase() === (current || "").toLowerCase());
  const activeIdx = idx === -1 ? 0 : idx;
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1 hide-scrollbar">
      {DEAL_STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <div className={cls("flex flex-col items-center gap-1.5 min-w-fit transition-opacity duration-300", i <= activeIdx ? "opacity-100" : "opacity-40")}>
            <div className={cls(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 transition-colors",
              i < activeIdx ? "bg-green-500 border-green-500 text-white" :
              i === activeIdx ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" :
              "bg-white border-gray-300 text-gray-400"
            )}>
              {i < activeIdx ? "✓" : i + 1}
            </div>
            <span className={cls("text-[10px] font-bold whitespace-nowrap", i === activeIdx ? "text-blue-700" : "text-gray-500")}>{s}</span>
          </div>
          {i < DEAL_STAGES.length - 1 && (
            <div className={cls("h-0.5 w-8 mx-1 flex-shrink-0 rounded-full transition-colors", i < activeIdx ? "bg-green-400" : "bg-gray-200")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── TOGGLE SWITCH ──────────────────────────────────────────────────────────────
const TypeToggle = ({ value, onChange, options, colors }) => (
  <div className="inline-flex bg-gray-100/80 rounded-xl p-1 gap-1 border border-gray-200/50">
    {options.map((opt, i) => (
      <button key={opt} onClick={() => onChange(opt)}
        className={cls(
          "px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200",
          value === opt
            ? (colors?.[i] || "bg-blue-600 text-white shadow-sm scale-[1.02]")
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50"
        )}>
        {opt}
      </button>
    ))}
  </div>
);

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
  const [localList, setLocalList] = useState([]);
  useEffect(() => {
    const base = endpoint.replace("/api/autocomplete/", "/api/");
    api.get(base).then(r => setLocalList(r.data || [])).catch(() => {});
  }, [endpoint]);

  const search = async (q) => {
    if (!q) { setSuggestions([]); setOpen(false); return; }
    try {
      const { data } = await api.get(`${endpoint}?q=${encodeURIComponent(q)}`);
      setSuggestions(data ||[]); setOpen(true);
    } catch {
      const filtered = localList.filter(item => (item.name || "").toLowerCase().includes(q.toLowerCase())).slice(0, 8);
      setSuggestions(filtered); setOpen(filtered.length > 0);
    }
  };
  return (
    <div className="relative" ref={ref}>
      <input value={value} onChange={e => { onChange(e.target.value); search(e.target.value); }} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto mt-2 py-1">
          {suggestions.map(s => (
            <button key={s.id} onClick={() => { onSelect(s); setOpen(false); onChange(s.name); }}
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 transition-colors">
              <p className="font-bold text-gray-800">{s.name}</p>
              <p className="text-xs font-medium text-gray-400 mt-0.5">{[s.city, s.gst_number].filter(Boolean).join(" · ")}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
const NAV =[
  { to: "/", label: "Dashboard", icon: "⬛" },
  { to: "/stock", label: "Stock", icon: "📦" },
  { to: "/yards", label: "Yards", icon: "🏗️" },
  { to: "/trade", label: "Trade Engine", icon: "🤝" },
  { to: "/transit", label: "Transit", icon: "🚛" },
  { to: "/suppliers", label: "Suppliers", icon: "🏭" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/ledger", label: "Closed Ledger", icon: "📒" },
  { to: "/financials", label: "Financials", icon: "📊" },
  { to: "/reports", label: "Reports", icon: "📄" },
  { to: "/company", label: "Company", icon: "🏢" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

const Sidebar = ({ onSignOut }) => (
  <div className="w-56 bg-gray-900 text-white flex flex-col min-h-screen fixed top-0 left-0 shadow-2xl z-30">
    <div className="px-5 py-6 border-b border-gray-800 bg-gray-950/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-blue-900/50">⚓</div>
        <div>
          <div className="text-lg font-black tracking-tight text-white leading-none">Dockside</div>
          <div className="text-[10px] font-bold text-blue-400 mt-1 uppercase tracking-widest">Trade OS</div>
        </div>
      </div>
    </div>
    <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1 custom-scrollbar">
      {NAV.map(n => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"}
          className={({ isActive }) => cls(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group",
            isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}>
          <span className={cls("text-lg transition-transform", "group-hover:scale-110")}>{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
    <div className="p-4 border-t border-gray-800 bg-gray-950/30">
      <button onClick={onSignOut} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-gray-800/50 hover:bg-red-500/20 hover:text-red-400 transition-all">
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
    if (!email || !password) { setErr("Email and password required"); return; }
    setLoading(true); setErr("");
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("dockside-token", data.token);
      localStorage.setItem("dockside-user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Login failed. Check your credentials.");
    }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" style={{ backgroundImage: "radial-gradient(circle at top right, #1e3a8a 0%, #111827 50%)" }}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-800/50">
        <div className="bg-gray-50 p-8 text-center border-b border-gray-100">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xl shadow-blue-900/30 mb-4">⚓</div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dockside</h1>
          <p className="text-blue-600 font-bold text-sm mt-1 uppercase tracking-widest">Trade OS</p>
        </div>
        <div className="p-8 space-y-5">
          <Field label="Work Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••••" /></Field>
          {err && <ErrBanner msg={err} />}
          <button onClick={submit} disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-200 active:scale-[0.98] mt-2">
            {loading ? "Authenticating…" : "Sign In to Workspace"}
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
  
  // 🔥 ARCHITECTURE UPGRADE: Multi-tenant safety check
  const user = JSON.parse(localStorage.getItem("dockside-user") || "{}");
  const isMissingCompany = !user.company_id || user.company_id === "null";

  useEffect(() => {
    if (isMissingCompany) return; // Don't fetch if company config is broken
    api.get("/api/dashboard/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/api/inventory").then(r => setInv(r.data ||[])).catch(() => {});
    api.get("/api/deals").then(r => setDeals(r.data || [])).catch(() => {});
  }, [isMissingCompany]);

  if (isMissingCompany) {
    return (
      <div className="p-8 max-w-3xl mx-auto mt-10">
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-5xl">🚨</span>
            <div>
              <h1 className="text-2xl font-black text-red-700">CRITICAL SETUP REQUIRED</h1>
              <p className="text-red-600 font-bold mt-1">Your user account is not linked to a company.</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-red-100 space-y-3 text-sm text-gray-700 font-medium">
            <p>Because your account lacks a <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded">company_id</code>, all database saves (Stock, Yards, Deals) are failing with UUID errors.</p>
            <p className="font-bold text-gray-900 mt-4">How to fix this instantly:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Open your <strong>Supabase Dashboard</strong>.</li>
              <li>Go to the <strong>Table Editor</strong> and open the <code className="bg-gray-100 px-1 rounded">users</code> table.</li>
              <li>Find your email row (<code className="text-blue-600">{user.email}</code>).</li>
              <li>Paste a valid UUID from your <code className="bg-gray-100 px-1 rounded">company</code> table into the <code className="bg-gray-100 px-1 rounded">company_id</code> column.</li>
              <li>Log out of Dockside and log back in.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const catMap = {};
  inv.forEach(i => { const c = i.category || "Other"; catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const COLORS =["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

  const months =["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const chartData = months.map((m, i) => ({
    month: m,
    revenue: Math.round((stats.monthlyRevenue || 0) * (0.7 + i * 0.06)),
    cost: Math.round((stats.totalInventoryValue || 0) * 0.1 * (0.8 + i * 0.04)),
  }));

  const purchaseDeals = deals.filter(d => d.deal_type === "purchase" || !d.deal_type).length;
  const saleDeals = deals.filter(d => d.deal_type === "sale").length;
  const pendingPayment = deals.filter(d => (d.payment_status || "").toLowerCase() === "pending").length;
  const closedDeals = deals.filter(d => (d.status || "").toLowerCase() === "closed").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div><h1 className="text-3xl font-black text-gray-900 tracking-tight">Command Center</h1><p className="text-gray-500 font-medium text-sm mt-1">Live business telemetry</p></div>
      </div>

      <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-2xl p-4 text-white text-sm flex items-center gap-3 overflow-x-auto shadow-lg shadow-blue-900/20">
        <span className="whitespace-nowrap font-black text-blue-300 uppercase tracking-widest text-xs">Business Flow:</span>
        {["Purchase Deal", "→", "Transit In", "→", "Stock Added", "→", "Sale Deal", "→", "Transit Out", "→", "Payment", "→", "Ledger Closed"].map((s, i) => (
          <span key={i} className={s === "→" ? "text-blue-500/50 font-black" : "bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-bold shadow-sm"}>
            {s}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Stock Value" value={fmt(stats.totalInventoryValue)} icon="📦" color="blue" sub={`${stats.totalProducts || 0} products`} />
        <StatCard label="Active Deals" value={(deals.filter(d => !["closed"].includes((d.status || "").toLowerCase())).length)} icon="🤝" color="orange" sub={`${purchaseDeals} buys · ${saleDeals} sales`} />
        <StatCard label="Pending Payments" value={pendingPayment} icon="⏳" color="red" sub="Awaiting collection" />
        <StatCard label="Closed This Month" value={closedDeals} icon="✅" color="green" sub="Ledger entries" />
        <StatCard label="Active Shipments" value={stats.activeShipments || 0} icon="🚛" color="purple" />
        <StatCard label="Total Volume" value={`${stats.totalVolume || 0} units`} icon="📊" color="teal" />
        <StatCard label="Active Yards" value={stats.activeYards || 0} icon="🏗️" color="blue" />
        <StatCard label="Total Customers" value={stats.totalCustomers || 0} icon="👥" color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-black text-gray-800 mb-6 uppercase tracking-wide text-sm">Revenue vs Cost (6M)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="#dbeafe" name="Revenue" />
              <Area type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={3} fill="#fef3c7" name="Cost" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-black text-gray-800 mb-6 uppercase tracking-wide text-sm">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── STOCK (Inventory) ──────────────────────────────────────────────────────────
function Stock() {
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Current");
  const[search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const[saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    product_name: "", category: "Plywood", wood_type: "", grade: "A",
    yard_id: "", supplier_id: "", unit: "pcs", cost_price: "",
    market_value: "", available_quantity: "", date: today(), notes: ""
  });
  const set = k => e => setForm(p => ({ ...p,[k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      api.get("/api/inventory").catch(() => ({ data: [] })),
      api.get("/api/yards").catch(() => ({ data: [] })),
      api.get("/api/suppliers").catch(() => ({ data:[] }))
    ]);
    setItems(a.data || []); setYards(b.data ||[]); setSuppliers(c.data || []);
    setLoading(false);
  },[]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = {
    product_name: "", category: "Plywood", wood_type: "", grade: "A",
    yard_id: "", supplier_id: "", unit: "pcs", cost_price: "",
    market_value: "", available_quantity: "", date: today(), notes: ""
  };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.product_name) { setErr("Product name required"); return; }
    setSaving(true); setErr("");
    try {
      const payload = clean({
        product_name: form.product_name, category: form.category, wood_type: form.wood_type,
        grade: form.grade, unit: form.unit, thickness: form.thickness, notes: form.notes,
        cost_price: parseFloat(form.cost_price) || 0, market_value: parseFloat(form.market_value) || 0,
        available_quantity: parseFloat(form.available_quantity) || 0, stock_status: "available",
      });
      if (form.yard_id) payload.yard_id = form.yard_id;
      if (form.supplier_id) payload.supplier_id = form.supplier_id;
      
      await api.post("/api/inventory", payload);
      close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
    setSaving(false);
  };

  const currentItems = items.filter(i => (i.stock_status || "available") !== "closed");
  const closedItems = items.filter(i => i.stock_status === "closed");
  const displayed = (tab === "Current" ? currentItems : closedItems).filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));
  const totalValue = currentItems.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Stock Management</h1><p className="text-gray-500 font-medium text-sm mt-1">{currentItems.length} products · {fmt(totalValue)} net value</p></div>
        <div className="flex gap-3">
          <Input placeholder="Search inventory…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <TypeToggle value={tab} onChange={setTab} options={["Current", "Booked Out"]} colors={["bg-blue-600 text-white", "bg-gray-800 text-white"]} />
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                {tab === "Current"
                  ?["Product", "Category", "Grade", "Yard", "Available", "Reserved", "Cost Price", "Market Value", "Total Value", "Status"].map(h =>
                    <th key={h} className="text-left px-5 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">{h}</th>)
                  :["Product", "Category", "Qty Sold", "Buy Price", "Sell Price", "Profit", "Customer", "Date"].map(h =>
                    <th key={h} className="text-left px-5 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">{h}</th>)
                }
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map(i => (
                <tr key={i.id} className="hover:bg-blue-50/30 transition-colors group">
                  {tab === "Current" ? (
                    <>
                      <td className="px-5 py-3.5 font-bold text-gray-900">{i.product_name || i.name || "—"}</td>
                      <td className="px-5 py-3.5 text-gray-600 font-medium">{i.category || "—"}</td>
                      <td className="px-5 py-3.5"><Badge text={i.grade || "—"} /></td>
                      <td className="px-5 py-3.5 text-gray-600 font-medium">{yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                      <td className="px-5 py-3.5 font-black text-green-600 text-base">{i.available_quantity || 0}</td>
                      <td className="px-5 py-3.5 font-bold text-purple-600">{i.reserved_quantity || 0}</td>
                      <td className="px-5 py-3.5 font-bold text-gray-700">{fmt(i.cost_price)}</td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(i.market_value)}</td>
                      <td className="px-5 py-3.5 font-black text-blue-600">{fmt((i.cost_price || 0) * (i.available_quantity || 0))}</td>
                      <td className="px-5 py-3.5"><Badge text={i.stock_status || "available"} /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3.5 font-bold text-gray-900">{i.product_name || i.name || "—"}</td>
                      <td className="px-5 py-3.5 text-gray-600">{i.category || "—"}</td>
                      <td className="px-5 py-3.5 font-black text-gray-700">{i.sold_quantity || i.available_quantity || 0}</td>
                      <td className="px-5 py-3.5 text-gray-500">{fmt(i.cost_price)}</td>
                      <td className="px-5 py-3.5 font-bold text-green-600">{fmt(i.sell_price || i.market_value)}</td>
                      <td className="px-5 py-3.5 font-black text-green-600">{fmt((i.sell_price || 0) - (i.cost_price || 0))}</td>
                      <td className="px-5 py-3.5 text-gray-600 font-medium">{i.customer_name || "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-medium">{fmtDate(i.sold_at || i.updated_at)}</td>
                    </>
                  )}
                </tr>
              ))}
              {displayed.length === 0 && <tr><td colSpan={10} className="px-5 py-20 text-center text-gray-400 font-medium">No stock records found matching your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* 🔥 ARCHITECTURE UPGRADE: error={err} is passed directly to SlidePanel */}
      <SlidePanel title="Add Stock" open={showAdd} onClose={close} error={err}>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-medium text-blue-800 shadow-inner">
          💡 Stock added here automatically enters <strong className="font-black">Current Inventory</strong>. It moves to <strong className="font-black">Booked Out</strong> seamlessly when a Sale Deal is marked Paid.
        </div>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Premium Teak Plywood 18mm" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category"><Select value={form.category} onChange={set("category")}><option>Plywood</option><option>Hardwood</option><option>Softwood</option><option>Veneer</option><option>MDF</option><option>Particle Board</option></Select></Field>
          <Field label="Wood Type"><Input value={form.wood_type} onChange={set("wood_type")} placeholder="Teak, Pine…" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Thickness (mm)"><Input value={form.thickness} onChange={set("thickness")} placeholder="18" /></Field>
          <Field label="Length (ft)"><Input value={form.length} onChange={set("length")} placeholder="8" /></Field>
          <Field label="Width (ft)"><Input value={form.width} onChange={set("width")} placeholder="4" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Grade"><Select value={form.grade} onChange={set("grade")}><option>A</option><option>B</option><option>C</option><option>Premium</option></Select></Field>
          <Field label="Unit"><Select value={form.unit} onChange={set("unit")}><option>pcs</option><option>sheets</option><option>m³</option><option>sqft</option><option>kg</option></Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Storage Yard"><Select value={form.yard_id} onChange={set("yard_id")}><option value="">— Select Yard —</option>{yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <Field label="Supplier"><Select value={form.supplier_id} onChange={set("supplier_id")}><option value="">— Select Supplier —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cost Price (₹)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00" /></Field>
          <Field label="Market Value (₹)"><Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0.00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Initial Quantity" required><Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0" /></Field>
          <Field label="Entry Date"><Input type="date" value={form.date} onChange={set("date")} /></Field>
        </div>
        <Field label="Internal Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Condition, batch details, etc." /></Field>
        <div className="pt-2 flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving to Database…" : "Save to Inventory"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
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
  const[err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", city: "", address: "", manager_name: "", manager_phone: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api.get("/api/yards").catch(() => ({ data: [] })), api.get("/api/inventory").catch(() => ({ data:[] }))]);
    setYards(a.data || []); setInv(b.data || []);
    setLoading(false);
  },[]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = { name: "", city: "", address: "", manager_name: "", manager_phone: "", notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Yard name required"); return; }
    setSaving(true); setErr("");
    try {
      const payload = clean({ name: form.name, city: form.city, address: form.address, manager_name: form.manager_name, manager_phone: form.manager_phone, notes: form.notes, is_active: true });
      await api.post("/api/yards", payload);
      close(); fetchAll();
    }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Yards & Warehouses</h1><p className="text-gray-500 font-medium text-sm mt-1">{yards.length} active locations</p></div>
        <Btn onClick={() => setShowAdd(true)}>+ Add New Yard</Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {yards.map(y => {
            const yInv = inv.filter(i => i.yard_id === y.id);
            const val = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
            const units = yInv.reduce((s, i) => s + (i.available_quantity || 0), 0);
            return (
              <div key={y.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div><h3 className="font-black text-gray-900 text-lg leading-tight">{y.name}</h3><p className="text-gray-500 font-medium text-sm mt-0.5">{y.city}</p></div>
                  <Badge text={y.is_active !== false ? "Active" : "Inactive"} color={y.is_active !== false ? "green" : "gray"} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 text-center"><p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Products</p><p className="font-black text-blue-700 text-lg">{yInv.length}</p></div>
                  <div className="bg-green-50/50 rounded-xl p-3 border border-green-100 text-center"><p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1">Units</p><p className="font-black text-green-700 text-lg">{units}</p></div>
                  <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100 text-center flex flex-col justify-center"><p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Net Value</p><p className="font-black text-purple-700 text-sm">{fmt(val)}</p></div>
                </div>
                {y.manager_name && <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><span className="text-gray-400">👤</span> {y.manager_name} {y.manager_phone && <span className="text-gray-400 font-normal ml-1">· {y.manager_phone}</span>}</p>}
                {y.address && <p className="text-xs font-medium text-gray-500 mt-2 flex items-start gap-1.5"><span className="text-gray-400 mt-0.5">📍</span> <span className="leading-snug">{y.address}</span></p>}
              </div>
            );
          })}
          {yards.length === 0 && <div className="col-span-3 text-center py-24 text-gray-400 font-medium bg-white rounded-2xl border border-dashed border-gray-200">No yards added yet. Click "+ Add New Yard" to build your logistics network.</div>}
        </div>
      )}
      <SlidePanel title="Register New Yard" open={showAdd} onClose={close} error={err}>
        <Field label="Yard Name" required><Input value={form.name} onChange={set("name")} placeholder="e.g. North Harbor Warehouse" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City"><Input value={form.city} onChange={set("city")} placeholder="e.g. Mumbai" /></Field>
          <Field label="Manager Name"><Input value={form.manager_name} onChange={set("manager_name")} placeholder="Yard overseer" /></Field>
        </div>
        <Field label="Full Street Address"><Textarea value={form.address} onChange={set("address")} placeholder="Plot no, street, landmark..." /></Field>
        <Field label="Manager Phone Number"><Input value={form.manager_phone} onChange={set("manager_phone")} placeholder="+91..." /></Field>
        <Field label="Operational Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Timings, accessibility constraints..." /></Field>
        <div className="pt-2 flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Committing…" : "Register Yard"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── TRADE ENGINE (Deals: Purchase + Sale) ─────────────────────────────────────
function TradeEngine() {
  const [deals, setDeals] = useState([]);
  const[customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const[inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dealType, setDealType] = useState("Sale");
  const [stageFilter, setStageFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const[saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [custName, setCustName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [form, setForm] = useState({
    deal_type: "sale", customer_id: "", supplier_id: "", product_id: "",
    quantity: "", unit_price: "", payment_terms: "30 days",
    status: "Created", payment_status: "Pending",
    expected_delivery: "", notes: ""
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c, d] = await Promise.all([
      api.get("/api/deals").catch(() => ({ data: [] })),
      api.get("/api/customers").catch(() => ({ data:[] })),
      api.get("/api/suppliers").catch(() => ({ data:[] })),
      api.get("/api/inventory").catch(() => ({ data: [] }))
    ]);
    setDeals(a.data ||[]); setCustomers(b.data || []);
    setSuppliers(c.data || []); setInventory(d.data ||[]);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const STAGES =["All", "Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];
  const typeDeals = deals.filter(d => dealType === "Sale" ? (d.deal_type === "sale" || !d.deal_type) : d.deal_type === "purchase");
  const filtered = stageFilter === "All" ? typeDeals : typeDeals.filter(d => (d.status || "").toLowerCase() === stageFilter.toLowerCase());

  const DEFAULTS = {
    deal_type: "sale", customer_id: "", supplier_id: "", product_id: "",
    quantity: "", unit_price: "", payment_terms: "30 days",
    status: "Created", payment_status: "Pending",
    expected_delivery: "", notes: ""
  };

  const openAdd = (type) => {
    setForm({ ...DEFAULTS, deal_type: type.toLowerCase() });
    setShowAdd(true);
    setDealType(type);
  };

  const close = () => { setShowAdd(false); setForm(DEFAULTS); setCustName(""); setSupplierName(""); setErr(""); };

  const save = async () => {
    const isPurchase = form.deal_type === "purchase";
    if (isPurchase && !form.supplier_id && !supplierName) { setErr("Supplier required"); return; }
    if (!isPurchase && !form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unit_price) || 0;
      const selProd = inventory.find(i => i.id === form.product_id);
      const payload = clean({
        deal_type: form.deal_type,
        customer_id: form.customer_id || null, customer_name: custName || null,
        supplier_id: form.supplier_id || null, supplier_name: supplierName || null,
        product_id: form.product_id || null, product_name: selProd?.product_name || selProd?.name || form.productText || null,
        quantity: qty || null, unit_price: price || null,
        total_value: qty * price || null, total_amount: qty * price || null,
        status: "Created", stage: "Created",
        payment_status: form.payment_status, payment_terms: form.payment_terms,
        expected_delivery: form.expected_delivery || null, notes: form.notes || null,
      });
      if (!payload.product_id) delete payload.product_id;
      if (!payload.customer_id) delete payload.customer_id;
      if (!payload.supplier_id) delete payload.supplier_id;
      await api.post("/api/deals", payload);
      close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); }
    setSaving(false);
  };

  const updateDealStatus = async (dealId, newStatus, extraFields = {}) => {
    try { await api.put(`/api/deals/${dealId}`, { status: newStatus, stage: newStatus, ...extraFields }); fetchAll(); }
    catch (e) { alert("Update failed: " + e.message); }
  };
  const markPaid = async (deal) => {
    await updateDealStatus(deal.id, "Paid", { payment_status: "Paid" });
    setTimeout(() => updateDealStatus(deal.id, "Closed", { payment_status: "Paid" }), 600);
  };

  const totalValue = typeDeals.reduce((s, d) => s + (d.total_value || d.total_amount || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Trade Engine</h1><p className="text-gray-500 font-medium text-sm mt-1">{typeDeals.length} active deals · {fmt(totalValue)} pipeline</p></div>
        <div className="flex gap-3">
          <Btn variant="secondary" onClick={() => openAdd("Purchase")}>+ Purchase Contract</Btn>
          <Btn onClick={() => openAdd("Sale")}>+ Sale Contract</Btn>
        </div>
      </div>

      <div className="flex items-center gap-5 mb-6">
        <TypeToggle value={dealType} onChange={t => { setDealType(t); setStageFilter("All"); }} options={["Sale", "Purchase"]} colors={["bg-blue-600 text-white shadow-md", "bg-orange-500 text-white shadow-md"]} />
        <div className="text-sm font-semibold text-gray-500 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm">
          {dealType === "Sale" ? "📤 Outgoing Revenue (Selling to customers)" : "📥 Incoming Cost (Buying from suppliers)"}
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {STAGES.map(s => (
          <button key={s} onClick={() => setStageFilter(s)}
            className={cls("px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap border",
              stageFilter === s ? "bg-gray-900 text-white border-gray-900 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300")}>
            {s} <span className={cls("ml-1.5 px-2 py-0.5 rounded-md", stageFilter === s ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>{s === "All" ? typeDeals.length : typeDeals.filter(d => (d.status || "").toLowerCase() === s.toLowerCase()).length}</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-4">
          {filtered.map(d => {
            const cust = customers.find(c => c.id === d.customer_id);
            const supp = suppliers.find(s => s.id === d.supplier_id);
            const isPurchase = d.deal_type === "purchase";
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-lg transition-all duration-300 hover:border-blue-300 group">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2.5">
                      <span className="font-mono text-sm font-black text-gray-400 group-hover:text-blue-600 transition-colors">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</span>
                      <Badge text={isPurchase ? "Purchase" : "Sale"} color={isPurchase ? "orange" : "blue"} />
                      <Badge text={d.status || "Created"} />
                      <Badge text={d.payment_status || "Pending"} />
                    </div>
                    <p className="text-xl font-black text-gray-900 tracking-tight mb-1">
                      {isPurchase ? (d.supplier_name || supp?.name || "Unknown Supplier") : (d.customer_name || cust?.name || "Unknown Customer")}
                    </p>
                    <p className="text-sm font-medium text-gray-600">{d.product_name || "—"} · <strong className="text-gray-900">{d.quantity || 0} units</strong> @ {fmt(d.unit_price)}/unit</p>
                    <div className="mt-4 bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                      <StatusPipeline current={d.status || "Created"} />
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-3 min-w-[200px]">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Deal Value</p>
                      <p className="text-2xl font-black text-gray-900">{fmt(d.total_value || d.total_amount)}</p>
                    </div>
                    <p className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{fmtDate(d.created_at)}</p>
                    <div className="flex flex-col gap-2 mt-auto pt-2 w-full">
                      {d.status === "Created" && <Btn small variant="secondary" onClick={() => updateDealStatus(d.id, "In Transit")} className="w-full">Mark In Transit</Btn>}
                      {d.status === "In Transit" && <Btn small variant="secondary" onClick={() => updateDealStatus(d.id, "Delivered")} className="w-full">Mark Delivered</Btn>}
                      {d.status === "Delivered" && (d.payment_status || "Pending") !== "Paid" && <Btn small variant="green" onClick={() => markPaid(d)} className="w-full shadow-green-200">Payment Received → Close</Btn>}
                      {d.status === "Closed" && <div className="text-center text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl">✅ Contract Fulfilled</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-gray-100 shadow-sm">🤝</div>
              <p className="text-lg font-bold text-gray-800">No {dealType.toLowerCase()} records match your filters</p>
              <p className="text-sm font-medium text-gray-500 mt-1">Adjust filters or create a new contract.</p>
              <Btn variant="secondary" onClick={() => openAdd(dealType)} className="mt-6">Initiate New Deal</Btn>
            </div>
          )}
        </div>
      )}

      <SlidePanel title={form.deal_type === "purchase" ? "📥 Draft Purchase Contract" : "📤 Draft Sale Contract"} open={showAdd} onClose={close} wide error={err}>
        <div className="flex gap-3 items-center mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
          <TypeToggle value={form.deal_type === "sale" ? "Sale" : "Purchase"} onChange={t => setForm(p => ({ ...p, deal_type: t.toLowerCase() }))} options={["Sale", "Purchase"]} colors={["bg-blue-600 text-white", "bg-orange-500 text-white"]} />
          <p className="text-xs font-medium text-gray-500 ml-2">{form.deal_type === "purchase" ? "Acquiring material from supplier" : "Liquidating stock to customer"}</p>
        </div>

        {form.deal_type === "sale" ? (
          <Field label="Customer Account" required>
            <AutocompleteInput endpoint="/api/autocomplete/customers" placeholder="Search customer database…" value={custName} onChange={v => setCustName(v)} onSelect={c => { setForm(p => ({ ...p, customer_id: c.id })); setCustName(c.name); }} />
          </Field>
        ) : (
          <Field label="Supplier Account" required>
            <AutocompleteInput endpoint="/api/autocomplete/suppliers" placeholder="Search supplier database…" value={supplierName} onChange={v => setSupplierName(v)} onSelect={s => { setForm(p => ({ ...p, supplier_id: s.id })); setSupplierName(s.name); }} />
          </Field>
        )}

        <div className="mt-4">
          <Field label="Trade Material / Product">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <Input value={form.productText || ""} onChange={e => setForm(p => ({ ...p, productText: e.target.value, product_id: "" }))} placeholder="Enter material description (e.g. Gurjan Core Plywood 18mm)" />
              {inventory.length > 0 && (
                <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Or link existing stock:</span>
                  <select value={form.product_id || ""} onChange={e => { const sel = inventory.find(i => i.id === e.target.value); setForm(p => ({ ...p, product_id: e.target.value, productText: sel ? (sel.product_name || sel.name) : p.productText })); }} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select from warehouse —</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.product_name || i.name} ({i.available_quantity} {i.unit || "units"})</option>)}
                  </select>
                </div>
              )}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Contract Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label={form.deal_type === "purchase" ? "Procurement Rate (₹)" : "Selling Rate (₹)"}><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0.00" /></Field>
        </div>

        {form.quantity && form.unit_price && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mt-4 flex items-center justify-between shadow-inner">
            <span className="text-sm font-bold text-green-800 uppercase tracking-wide">Gross {form.deal_type === "purchase" ? "Payable" : "Receivable"} Value</span>
            <span className="text-2xl font-black text-green-700 tracking-tight">{fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Payment Terms">
            <Select value={form.payment_terms} onChange={set("payment_terms")}>
              <option>Immediate / Cash</option><option>Advance 50%</option><option>7 Days Credit</option><option>15 Days Credit</option><option>30 Days Credit</option><option>Against Delivery (COD)</option>
            </Select>
          </Field>
          <Field label="Target Delivery Date"><Input type="date" value={form.expected_delivery} onChange={set("expected_delivery")} /></Field>
        </div>

        <div className="mt-4">
          <Field label="Contract Terms / Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Logistics responsibilities, quality tolerances, specific payment conditions…" /></Field>
        </div>

        <div className="pt-4 flex gap-3 border-t border-gray-100 mt-4">
          <Btn onClick={save} disabled={saving}>{saving ? "Processing…" : form.deal_type === "purchase" ? "Finalize Purchase Contract" : "Finalize Sale Contract"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── APP ROOT AND GLOBAL TOAST LAYER ────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dockside-user")); } catch { return null; }
  });
  const [toast, setToast] = useState(null);

  // 🔥 ARCHITECTURE UPGRADE: Global Toast Listener for bulletproof error visibility
  useEffect(() => {
    const handleError = (e) => {
      setToast(e.detail);
      setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener("dockside-error", handleError);
    return () => window.removeEventListener("dockside-error", handleError);
  },[]);

  const signOut = () => {
    localStorage.removeItem("dockside-token");
    localStorage.removeItem("dockside-user");
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      {/* Global Toast UI */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm bg-red-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-slide-in pointer-events-auto border border-red-500">
          <span className="text-xl leading-none mt-0.5">🚨</span>
          <div>
            <p className="font-black text-sm uppercase tracking-wider text-red-100 mb-0.5">System Error</p>
            <p className="text-sm font-medium leading-snug">{toast}</p>
          </div>
          <button onClick={() => setToast(null)} className="ml-auto text-red-200 hover:text-white transition-colors bg-red-700/50 hover:bg-red-700 rounded-full w-6 h-6 flex items-center justify-center">×</button>
        </div>
      )}

      <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-200 selection:text-blue-900">
        <Sidebar onSignOut={signOut} />
        <div className="flex-1 ml-56 min-h-screen relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/inventory" element={<Stock />} />
            <Route path="/yards" element={<Yards />} />
            <Route path="/trade" element={<TradeEngine />} />
            <Route path="/deals" element={<TradeEngine />} />
            {/* Keeping Transit, Suppliers, Customers mapped to dummy for space or you can keep your original code for them here */}
            {/* ... Your original Transit, Suppliers, Customers, ClosedLedger, Financials, Reports, Company, Settings ... */}
          </Routes>
        </div>
      </div>
      
      {/* Required CSS animations for the new architecture */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.5); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </BrowserRouter>
  );
}
