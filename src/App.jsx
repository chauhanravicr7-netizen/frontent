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

const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== ""));

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

const SlidePanel = ({ title, open, onClose, children, wide, error }) => (
  <>
    {open && <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />}
    <div className={cls("fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col", wide ? "w-[640px]" : "w-[500px]", open ? "translate-x-0" : "translate-x-full")}>
      <div className="flex items-center justify-between p-5 border-b bg-gray-50">
        <h2 className="text-lg font-black text-gray-800">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-xl transition-colors">×</button>
      </div>
      {error && <div className="px-5 pt-4 pb-1"><ErrBanner msg={error} /></div>}
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
  <button 
    onClick={onClick} 
    disabled={disabled} 
    className={cls(
      "rounded-lg font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2", 
      small ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm", 
      variant === "primary" && "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-200", 
      variant === "secondary" && "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200", 
      variant === "danger" && "bg-red-600 hover:bg-red-700 text-white", 
      variant === "green" && "bg-green-600 hover:bg-green-700 text-white", 
      variant === "orange" && "bg-orange-500 hover:bg-orange-600 text-white"
    )}
  >
    {children}
  </button>
);

const Badge = ({ text, color }) => {
  const map = { green: "bg-green-100 text-green-700", blue: "bg-blue-100 text-blue-700", yellow: "bg-yellow-100 text-yellow-700", red: "bg-red-100 text-red-700", purple: "bg-purple-100 text-purple-700", gray: "bg-gray-100 text-gray-600", orange: "bg-orange-100 text-orange-700", teal: "bg-teal-100 text-teal-700" };
  const auto = { draft: "gray", confirmed: "blue", dispatched: "orange", delivered: "green", completed: "green", closed: "teal", created: "gray", loaded: "blue", "in transit": "purple", arrived: "yellow", paid: "green", pending: "yellow", partial: "orange", purchase: "orange", sale: "blue", incoming: "orange", outgoing: "blue", reserved: "purple", available: "green" };
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

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

// ── STATUS PIPELINE ────────────────────────────────────────────────────────────
const DEAL_STAGES = ["Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];

const ProgressBar = ({ activeIdx }) => (
  <div className="flex items-center gap-0 overflow-x-auto py-1 hide-scrollbar">
    {DEAL_STAGES.map((s, i) => (
      <React.Fragment key={s}>
        <div className={cls("flex flex-col items-center gap-1.5 min-w-fit transition-opacity duration-300", i <= activeIdx ? "opacity-100" : "opacity-40")}>
          <div className={cls("w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 transition-colors", i < activeIdx ? "bg-green-500 border-green-500 text-white" : i === activeIdx ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-gray-300 text-gray-400")}>
            {i < activeIdx ? "✓" : i + 1}
          </div>
          <span className={cls("text-[10px] font-bold whitespace-nowrap", i === activeIdx ? "text-blue-700" : "text-gray-500")}>{s}</span>
        </div>
        {i < DEAL_STAGES.length - 1 && <div className={cls("h-0.5 w-8 mx-1 flex-shrink-0 rounded-full transition-colors", i < activeIdx ? "bg-green-400" : "bg-gray-200")} />}
      </React.Fragment>
    ))}
  </div>
);

const TypeToggle = ({ value, onChange, options, colors }) => (
  <div className="inline-flex bg-gray-100/80 rounded-xl p-1 gap-1 border border-gray-200/50">
    {options.map((opt, i) => (
      <button 
        key={opt} 
        onClick={() => onChange(opt)} 
        className={cls(
          "px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200", 
          value === opt ? (colors?.[i] || "bg-blue-600 text-white shadow-sm scale-[1.02]") : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50"
        )}
      >
        {opt}
      </button>
    ))}
  </div>
);

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
const NAV = [
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
    <div className="px-4 py-5 border-b border-gray-700/50">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-black text-white">⚓</div>
        <div>
          <div className="text-sm font-black text-white">Dockside</div>
          <div className="text-xs text-gray-500">Timber Trade OS</div>
        </div>
      </div>
    </div>
    <nav className="flex-1 py-3 px-2">
      {NAV.map(n => (
        <NavLink 
          key={n.to} 
          to={n.to} 
          end={n.to === "/"} 
          className={({ isActive }) => cls(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all", 
            isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
          )}
        >
          <span className="text-base">{n.icon}</span>{n.label}
        </NavLink>
      ))}
    </nav>
    <div className="p-3 border-t border-gray-700">
      <button 
        onClick={onSignOut} 
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition-colors"
      >
        <span>🚪</span> Sign Out
      </button>
    </div>
  </div>
);

// ── AUTH ────────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.post("/api/auth/login", form);
      if (data?.token) {
        localStorage.setItem("dockside-token", data.token);
        localStorage.setItem("dockside-user", JSON.stringify(data.user || { email: form.email }));
        onLogin(data.user || { email: form.email });
      }
    } catch (e) {
      setErr(e.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-lg font-black text-white">⚓</div>
          <h1 className="text-2xl font-black text-gray-900">Dockside</h1>
        </div>
        <p className="text-center text-gray-600 mb-6 font-medium">Timber Trade Operating System</p>
        
        {err && <ErrBanner msg={err} />}
        
        <div className="space-y-4 mt-6">
          <Field label="Email" required>
            <Input 
              type="email" 
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </Field>
          <Field label="Password" required>
            <Input 
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            />
          </Field>
          <Btn onClick={handleLogin} disabled={loading} className="w-full">
            {loading ? "Logging in…" : "🔓 Login"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ───────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState({ totalStock: 0, totalValue: 0, activeDeals: 0 });
  
  useEffect(() => {
    api.get("/api/dashboard").then(r => setStats(r.data || {})).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Real-time overview of your timber trade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Stock Items" value={stats.totalStock || 0} icon="📦" color="blue" />
        <StatCard label="Inventory Value" value={fmt(stats.totalValue)} icon="💰" color="green" />
        <StatCard label="Active Deals" value={stats.activeDeals || 0} icon="🤝" color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Stock Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={[{ name: "Jan", value: 100 }, { name: "Feb", value: 200 }]}>
              <Area type="monotone" dataKey="value" fill="#3b82f6" stroke="#1e40af" />
              <XAxis dataKey="name" />
              <Tooltip />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Deal Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={[{ name: "Active", value: 30 }, { name: "Closed", value: 70 }]} cx="50%" cy="50%" outerRadius={80} label dataKey="value">
                <Cell fill="#3b82f6" />
                <Cell fill="#10b981" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── STOCK ───────────────────────────────────────────────────────────────────────
function Stock() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    api.get("/api/inventory").then(r => { setItems(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const addItem = async () => {
    try {
      await api.post("/api/inventory", form);
      setForm({});
      setPanelOpen(false);
      const { data } = await api.get("/api/inventory");
      setItems(data || []);
    } catch (e) {
      alert("Failed to add item");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Stock Management</h1>
          <p className="text-gray-500 mt-1">{items.length} items in inventory</p>
        </div>
        <Btn onClick={() => setPanelOpen(true)}>📦 Add Item</Btn>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {items.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No items yet. Add one to get started.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{fmt(item.price)}</td>
                    <td className="px-6 py-4"><Badge text={item.status || "Available"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <SlidePanel title="Add Stock Item" open={panelOpen} onClose={() => setPanelOpen(false)}>
        <Field label="Item Name" required>
          <Input placeholder="e.g., Teak Wood Lumber" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Quantity" required>
          <Input type="number" placeholder="100" value={form.quantity || ""} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
        </Field>
        <Field label="Unit Price (₹)" required>
          <Input type="number" placeholder="1000" value={form.price || ""} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
        </Field>
        <Field label="Status">
          <Select value={form.status || "Available"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            <option>Available</option>
            <option>Reserved</option>
            <option>In Transit</option>
          </Select>
        </Field>
        <Btn onClick={addItem} className="w-full">📥 Add Item</Btn>
      </SlidePanel>
    </div>
  );
}

// ── YARDS ───────────────────────────────────────────────────────────────────────
function Yards() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Yards Management</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
        Coming soon: Yard location and capacity management
      </div>
    </div>
  );
}

// ── TRADE ENGINE ────────────────────────────────────────────────────────────────
function TradeEngine() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState({ stage: "Created" });

  useEffect(() => {
    api.get("/api/deals").then(r => { setDeals(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createDeal = async () => {
    try {
      await api.post("/api/deals", form);
      setForm({ stage: "Created" });
      setPanelOpen(false);
      const { data } = await api.get("/api/deals");
      setDeals(data || []);
    } catch (e) {
      alert("Failed to create deal");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Trade Engine</h1>
          <p className="text-gray-500 mt-1">{deals.length} active deals</p>
        </div>
        <Btn onClick={() => setPanelOpen(true)}>🤝 New Deal</Btn>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {deals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
              No deals yet. Create one to get started.
            </div>
          ) : (
            deals.map((deal, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{deal.customer_name || "Unknown"}</h3>
                    <p className="text-sm text-gray-500 mt-1">{deal.description}</p>
                  </div>
                  <Badge text={deal.stage || "Created"} />
                </div>
                <ProgressBar activeIdx={DEAL_STAGES.indexOf(deal.stage || "Created")} />
              </div>
            ))
          )}
        </div>
      )}

      <SlidePanel title="Create New Deal" open={panelOpen} onClose={() => setPanelOpen(false)}>
        <Field label="Customer Name" required>
          <Input placeholder="Enter customer name" value={form.customer_name || ""} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} />
        </Field>
        <Field label="Description">
          <Textarea placeholder="Deal details..." value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </Field>
        <Field label="Stage">
          <Select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
            {DEAL_STAGES.map(s => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Btn onClick={createDeal} className="w-full">✅ Create Deal</Btn>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ────────────────────────────────────────────────────────────────────
function Transit() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Transit Tracking</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
        Coming soon: Real-time shipment tracking and logistics
      </div>
    </div>
  );
}

// ── SUPPLIERS ───────────────────────────────────────────────────────────────────
function Suppliers() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Suppliers</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
        Coming soon: Supplier management and procurement
      </div>
    </div>
  );
}

// ── CUSTOMERS ───────────────────────────────────────────────────────────────────
function Customers() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Customers</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
        Coming soon: Customer relationship and order management
      </div>
    </div>
  );
}

// ── CLOSED LEDGER ───────────────────────────────────────────────────────────────
function ClosedLedger() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Closed Ledger</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
        Coming soon: Historical transaction records
      </div>
    </div>
  );
}

// ── FINANCIALS ──────────────────────────────────────────────────────────────────
function Financials() {
  const [stats, setStats] = useState({ totalRevenue: 0, totalCost: 0, pendingReceivables: 0 });

  useEffect(() => {
    api.get("/api/financials").then(r => setStats(r.data || {})).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Financials</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Revenue" value={fmt(stats.totalRevenue)} icon="💵" color="green" />
        <StatCard label="Stock Value (Cost)" value={fmt(stats.totalCost)} icon="📦" color="blue" />
        <StatCard label="Receivables" value={fmt(stats.pendingReceivables)} icon="📥" color="orange" sub="Customers owe you" />
      </div>
    </div>
  );
}

// ── REPORTS ────────────────────────────────────────────────────────────────────
function Reports() {
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    api.get("/api/company").then(r => setCompany(r.data || {})).catch(() => {});
  }, []);

  const REPORTS = [
    { key: "inventory", label: "Stock Report", icon: "📦" },
    { key: "sales", label: "Sales Report", icon: "🤝" },
    { key: "shipments", label: "Shipment Report", icon: "🚛" }
  ];

  const downloadPDF = async (type, label) => {
    setLoading(p => ({ ...p, [type]: true }));
    try {
      const res = await api.get(`/api/${type === "sales" ? "deals" : type === "inventory" ? "inventory" : type}`);
      const data = (res.data || []);
      const now = new Date().toLocaleDateString("en-IN");
      const html = `<!DOCTYPE html><html><body><h2>${company.name || "Dockside"} - ${label}</h2><p>Generated: ${now}</p><p>Total Records: ${data.length}</p></body></html>`;
      const w = window.open("", "_blank");
      if (!w) { alert("Popup blocked"); return; }
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 900);
    } catch (e) {
      alert("Report failed");
    }
    setLoading(p => ({ ...p, [type]: false }));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Reports</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {REPORTS.map(r => (
          <div key={r.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl mb-3">{r.icon}</div>
            <h3 className="font-bold text-gray-800 mb-4">{r.label}</h3>
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
  const [form, setForm] = useState({
    name: "",
    industry: "Timber Trade",
    city: "",
    country: "India",
    address: "",
    owner_name: "",
    phone: "",
    email: "",
    gst_number: "",
    pan_number: ""
  });

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const co = await api.get("/api/company");
      setCompany(co.data || {});
      if (co.data?.id) setForm(co.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      if (company?.id) {
        await api.put(`/api/company/${company.id}`, form);
      } else {
        await api.post("/api/company", form);
      }
      fetchAll();
      alert("✅ Saved!");
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Company Settings</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4 max-w-2xl">
        <Field label="Company Name" required>
          <Input value={form.name} onChange={set("name")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number">
            <Input value={form.gst_number} onChange={set("gst_number")} className="uppercase" />
          </Field>
          <Field label="PAN Number">
            <Input value={form.pan_number} onChange={set("pan_number")} className="uppercase" />
          </Field>
        </div>
        <Field label="Address">
          <Textarea value={form.address} onChange={set("address")} />
        </Field>
        <ErrBanner msg={err} />
        <div className="pt-2">
          <Btn onClick={save} disabled={saving}>
            {saving ? "Saving…" : "💾 Save Profile"}
          </Btn>
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
      <h1 className="text-2xl font-black text-gray-900 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-700">Account</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
            {(user.full_name || user.email || "U")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900">{user.full_name || "User"}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT AND GLOBAL TOAST LAYER ────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dockside-user"));
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleError = (e) => {
      setToast(e.detail);
      setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener("dockside-error", handleError);
    return () => window.removeEventListener("dockside-error", handleError);
  }, []);

  const signOut = () => {
    localStorage.removeItem("dockside-token");
    localStorage.removeItem("dockside-user");
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm bg-red-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-slide-in pointer-events-auto border border-red-500">
          <span className="text-xl leading-none mt-0.5">🚨</span>
          <div>
            <p className="font-black text-sm uppercase tracking-wider text-red-100 mb-0.5">System Error</p>
            <p className="text-sm font-medium leading-snug">{toast}</p>
          </div>
          <button 
            onClick={() => setToast(null)} 
            className="ml-auto text-red-200 hover:text-white transition-colors bg-red-700/50 hover:bg-red-700 rounded-full w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>
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
            <Route path="/transit" element={<Transit />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/ledger" element={<ClosedLedger />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/company" element={<Company />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.5); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      ` }} />
    </BrowserRouter>
  );
}    
