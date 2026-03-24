import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";

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
      wide ? "w-[640px]" : "w-[500px]",
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
const Input = (p) => <input {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />;
const Select = ({ children, ...p }) => <select {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">{children}</select>;
const Textarea = (p) => <textarea {...p} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />;
const Btn = ({ children, onClick, disabled, variant = "primary", small }) => (
  <button onClick={onClick} disabled={disabled}
    className={cls(
      "rounded-lg font-semibold transition-all disabled:opacity-50 cursor-pointer",
      small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
      variant === "primary" && "bg-blue-600 hover:bg-blue-700 text-white",
      variant === "secondary" && "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200",
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
  return <span className={cls("px-2 py-0.5 rounded-full text-xs font-semibold", map[c] || map.gray)}>{text}</span>;
};

const ErrBanner = ({ msg }) => msg ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2">
    <span className="mt-0.5">⚠</span><span>{msg}</span>
  </div>
) : null;

const StatCard = ({ label, value, icon, color = "blue", sub }) => {
  const c = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", orange: "bg-orange-50 text-orange-600", purple: "bg-purple-50 text-purple-600", red: "bg-red-50 text-red-600", teal: "bg-teal-50 text-teal-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
      <div className={cls("w-12 h-12 rounded-xl flex items-center justify-center text-xl", c[color])}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const Spinner = () => <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

// ── STATUS PIPELINE ────────────────────────────────────────────────────────────
const DEAL_STAGES = ["Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];
const StatusPipeline = ({ current }) => {
  const idx = DEAL_STAGES.findIndex(s => s.toLowerCase() === (current || "").toLowerCase());
  const activeIdx = idx === -1 ? 0 : idx;
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1">
      {DEAL_STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <div className={cls(
            "flex flex-col items-center gap-1 min-w-fit",
            i <= activeIdx ? "opacity-100" : "opacity-30"
          )}>
            <div className={cls(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2",
              i < activeIdx ? "bg-green-500 border-green-500 text-white" :
              i === activeIdx ? "bg-blue-600 border-blue-600 text-white" :
              "bg-white border-gray-300 text-gray-400"
            )}>
              {i < activeIdx ? "✓" : i + 1}
            </div>
            <span className={cls("text-[9px] font-semibold whitespace-nowrap", i === activeIdx ? "text-blue-700" : "text-gray-400")}>{s}</span>
          </div>
          {i < DEAL_STAGES.length - 1 && (
            <div className={cls("h-0.5 w-8 mx-0.5 flex-shrink-0", i < activeIdx ? "bg-green-400" : "bg-gray-200")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── TOGGLE SWITCH ──────────────────────────────────────────────────────────────
const TypeToggle = ({ value, onChange, options, colors }) => (
  <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
    {options.map((opt, i) => (
      <button key={opt} onClick={() => onChange(opt)}
        className={cls(
          "px-5 py-2 rounded-lg text-sm font-bold transition-all",
          value === opt
            ? (colors?.[i] || "bg-blue-600 text-white shadow-sm")
            : "text-gray-500 hover:text-gray-700"
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
  const search = async (q) => {
    if (!q) { setSuggestions([]); return; }
    try {
      const { data } = await api.get(`${endpoint}?q=${encodeURIComponent(q)}`);
      setSuggestions(data || []); setOpen(true);
    } catch {}
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

// ── DOCKSIDE AI ────────────────────────────────────────────────────────────────
function DockAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your Dockside AI assistant. Ask me anything about your business — inventory, deals, customers, profits, or insights." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState({});
  const messagesEndRef = useRef();

  useEffect(() => {
    // Load business context for AI
    Promise.all([
      api.get("/api/inventory").catch(() => ({ data: [] })),
      api.get("/api/deals").catch(() => ({ data: [] })),
      api.get("/api/customers").catch(() => ({ data: [] })),
    ]).then(([inv, deals, customers]) => {
      const invData = inv.data || [];
      const dealsData = deals.data || [];
      const totalInvValue = invData.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
      setContext({
        inventoryCount: invData.length,
        totalInventoryValue: totalInvValue,
        totalDeals: dealsData.length,
        totalCustomers: (customers.data || []).length,
        topProducts: invData.sort((a, b) => (b.available_quantity || 0) - (a.available_quantity || 0)).slice(0, 3).map(i => i.product_name || i.name),
      });
    });
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const systemPrompt = `You are Dockside AI, an expert business assistant for timber and plywood trading companies.

Current Business Context:
- Inventory: ${context.inventoryCount || 0} products worth ${fmt(context.totalInventoryValue || 0)}
- Total Deals: ${context.totalDeals || 0}
- Total Customers: ${context.totalCustomers || 0}
- Top Products: ${(context.topProducts || []).join(", ") || "No data yet"}

You help with:
- Pricing advice for timber, plywood, MDF, hardwood
- Inventory management strategies
- Profit analysis and deal negotiations
- Logistics and transit optimization
- Business insights for Indian timber trade

Be concise, practical, and use Indian market context (₹, GST, etc). Keep responses under 150 words.`;

    try {
      if (!ANTHROPIC_KEY) {
        throw new Error("VITE_ANTHROPIC_KEY not set in Vercel environment variables. Add it at: Vercel Dashboard → Project → Settings → Environment Variables");
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-allow-browser": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system: systemPrompt,
          messages: messages
            .filter(m => m.role !== "assistant" || messages.indexOf(m) > 0)
            .concat([{ role: "user", content: userMsg }])
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const reply = data.content?.[0]?.text || "No response";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ ${e.message}`
      }]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    "What should I price teak?",
    "Which deals are pending payment?",
    "Analyze my inventory health",
    "Suggest reorder points",
  ];

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all hover:scale-110">
        {open ? "×" : "🤖"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: "520px" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">AI</div>
            <div>
              <p className="font-bold text-white text-sm">Dockside AI</p>
              <p className="text-blue-200 text-xs">Powered by Claude</p>
            </div>
            {!ANTHROPIC_KEY && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">No API Key</span>
            )}
          </div>

          {/* Setup notice if no key */}
          {!ANTHROPIC_KEY && (
            <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-800">
              <p className="font-bold">Setup required:</p>
              <p>Add <code className="bg-amber-100 px-1 rounded">VITE_ANTHROPIC_KEY</code> to Vercel environment variables to enable AI.</p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cls("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cls(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
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
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map(p => (
                <button key={p} onClick={() => { setInput(p); }}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100">
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask anything about your business..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={send} disabled={loading || !input.trim()}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center">
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}

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
  <div className="w-52 bg-gray-900 text-white flex flex-col min-h-screen fixed top-0 left-0">
    <div className="px-4 py-5 border-b border-gray-700">
      <div className="text-lg font-black tracking-tight text-white">⚓ Dockside</div>
      <div className="text-xs text-gray-400 mt-0.5">Timber Trade OS</div>
    </div>
    <nav className="flex-1 py-3 px-2 overflow-y-auto">
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
    } catch (e) { setErr(e.response?.data?.error || "Login failed"); }
    finally { setLoading(false); }
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
    api.get("/api/dashboard/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/api/inventory").then(r => setInv(r.data || [])).catch(() => {});
    api.get("/api/deals").then(r => setDeals(r.data || [])).catch(() => {});
  }, []);

  const catMap = {};
  inv.forEach(i => { const c = i.category || "Other"; catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const chartData = months.map((m, i) => ({
    month: m,
    revenue: Math.round((stats.monthlyRevenue || 0) * (0.7 + i * 0.06)),
    cost: Math.round((stats.totalInventoryValue || 0) * 0.1 * (0.8 + i * 0.04)),
  }));

  // Business flow stats
  const purchaseDeals = deals.filter(d => d.deal_type === "purchase" || !d.deal_type).length;
  const saleDeals = deals.filter(d => d.deal_type === "sale").length;
  const pendingPayment = deals.filter(d => (d.payment_status || "").toLowerCase() === "pending").length;
  const closedDeals = deals.filter(d => (d.status || "").toLowerCase() === "closed").length;

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Command Center</h1><p className="text-gray-400 text-sm">Live business overview</p></div>

      {/* Flow banner */}
      <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-xl p-4 text-white text-sm flex items-center gap-3 overflow-x-auto">
        <span className="whitespace-nowrap font-semibold text-blue-200">Business Flow:</span>
        {["Purchase Deal", "→", "Transit In", "→", "Stock Added", "→", "Sale Deal", "→", "Transit Out", "→", "Payment", "→", "Ledger Closed"].map((s, i) => (
          <span key={i} className={s === "→" ? "text-gray-500" : "bg-white/10 px-2 py-1 rounded-lg whitespace-nowrap text-xs font-semibold"}>
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
          <h3 className="font-bold text-gray-700 mb-4">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
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

// ── STOCK (Inventory) ──────────────────────────────────────────────────────────
function Stock() {
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Current");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    product_name: "", category: "Plywood", wood_type: "", grade: "A",
    yard_id: "", supplier_id: "", unit: "pcs", cost_price: "",
    market_value: "", available_quantity: "", date: today(), notes: ""
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      api.get("/api/inventory").catch(() => ({ data: [] })),
      api.get("/api/yards").catch(() => ({ data: [] })),
      api.get("/api/suppliers").catch(() => ({ data: [] }))
    ]);
    setItems(a.data || []); setYards(b.data || []); setSuppliers(c.data || []);
    setLoading(false);
  }, []);
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
      await api.post("/api/inventory", {
        ...form,
        cost_price: parseFloat(form.cost_price) || 0,
        market_value: parseFloat(form.market_value) || 0,
        available_quantity: parseFloat(form.available_quantity) || 0,
        stock_status: "available"
      });
      close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  // Split: current vs closed (booked out)
  const currentItems = items.filter(i => (i.stock_status || "available") !== "closed");
  const closedItems = items.filter(i => i.stock_status === "closed");

  const displayed = (tab === "Current" ? currentItems : closedItems)
    .filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));

  // Summary
  const totalValue = currentItems.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const reservedItems = currentItems.filter(i => i.stock_status === "reserved");
  const availableItems = currentItems.filter(i => (i.stock_status || "available") === "available");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Stock</h1>
          <p className="text-gray-400 text-sm">{currentItems.length} products · {fmt(totalValue)} total value</p>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg">✅</div>
          <div><p className="text-xs text-green-500 font-semibold uppercase">Available</p><p className="text-xl font-black text-green-700">{availableItems.length}</p></div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-lg">🔒</div>
          <div><p className="text-xs text-purple-500 font-semibold uppercase">Reserved</p><p className="text-xl font-black text-purple-700">{reservedItems.length}</p></div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg">💰</div>
          <div><p className="text-xs text-blue-500 font-semibold uppercase">Total Value</p><p className="text-xl font-black text-blue-700">{fmt(totalValue)}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <TypeToggle
          value={tab}
          onChange={setTab}
          options={["Current", "Booked Out"]}
          colors={["bg-blue-600 text-white shadow-sm", "bg-gray-700 text-white shadow-sm"]}
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {tab === "Current"
                  ? ["Product", "Category", "Grade", "Yard", "Available", "Reserved", "Cost Price", "Market Value", "Total Value", "Status"].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)
                  : ["Product", "Category", "Qty Sold", "Buy Price", "Sell Price", "Profit", "Customer", "Date"].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {displayed.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  {tab === "Current" ? (
                    <>
                      <td className="px-4 py-3 font-semibold text-gray-800">{i.product_name || i.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                      <td className="px-4 py-3"><Badge text={i.grade || "—"} /></td>
                      <td className="px-4 py-3 text-gray-500">{yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{i.available_quantity || 0}</td>
                      <td className="px-4 py-3 text-purple-600 font-semibold">{i.reserved_quantity || 0}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{fmt(i.cost_price)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(i.market_value)}</td>
                      <td className="px-4 py-3 font-bold text-blue-700">{fmt((i.cost_price || 0) * (i.available_quantity || 0))}</td>
                      <td className="px-4 py-3"><Badge text={i.stock_status || "available"} /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-semibold">{i.product_name || i.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                      <td className="px-4 py-3">{i.sold_quantity || i.available_quantity || 0}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(i.cost_price)}</td>
                      <td className="px-4 py-3 text-green-700 font-semibold">{fmt(i.sell_price || i.market_value)}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{fmt((i.sell_price || 0) - (i.cost_price || 0))}</td>
                      <td className="px-4 py-3 text-gray-500">{i.customer_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(i.sold_at || i.updated_at)}</td>
                    </>
                  )}
                </tr>
              ))}
              {displayed.length === 0 && <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-300">No stock found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Add Stock" open={showAdd} onClose={close}>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          💡 Stock added here goes to <strong>Current Inventory</strong>. It moves to <strong>Booked Out</strong> automatically when a sale deal is marked Paid.
        </div>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Plywood 18mm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              <option>Plywood</option><option>Hardwood</option><option>Softwood</option>
              <option>Veneer</option><option>MDF</option><option>Particle Board</option>
            </Select>
          </Field>
          <Field label="Wood Type"><Input value={form.wood_type} onChange={set("wood_type")} placeholder="Teak, Pine…" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Thickness (mm)"><Input value={form.thickness} onChange={set("thickness")} placeholder="18" /></Field>
          <Field label="Length (ft)"><Input value={form.length} onChange={set("length")} placeholder="8" /></Field>
          <Field label="Width (ft)"><Input value={form.width} onChange={set("width")} placeholder="4" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade">
            <Select value={form.grade} onChange={set("grade")}>
              <option>A</option><option>B</option><option>C</option><option>Premium</option>
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={set("unit")}>
              <option>pcs</option><option>sheets</option><option>m³</option><option>sqft</option><option>kg</option>
            </Select>
          </Field>
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
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add to Stock"}</Btn>
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
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", city: "", address: "", manager_name: "", manager_phone: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api.get("/api/yards").catch(() => ({ data: [] })), api.get("/api/inventory").catch(() => ({ data: [] }))]);
    setYards(a.data || []); setInv(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = { name: "", city: "", address: "", manager_name: "", manager_phone: "", notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Yard name required"); return; }
    setSaving(true); setErr("");
    try { await api.post("/api/yards", form); close(); fetchAll(); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
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
                  <div><h3 className="font-bold text-gray-800 text-lg">{y.name}</h3><p className="text-gray-400 text-sm">{y.city}</p></div>
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
      <SlidePanel title="Add Yard" open={showAdd} onClose={close}>
        <Field label="Yard Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Manager Name"><Input value={form.manager_name} onChange={set("manager_name")} /></Field>
        </div>
        <Field label="Full Address"><Textarea value={form.address} onChange={set("address")} /></Field>
        <Field label="Manager Phone"><Input value={form.manager_phone} onChange={set("manager_phone")} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Yard"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── TRADE ENGINE (Deals: Purchase + Sale) ─────────────────────────────────────
function TradeEngine() {
  const [deals, setDeals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dealType, setDealType] = useState("Sale"); // Purchase or Sale
  const [stageFilter, setStageFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [saving, setSaving] = useState(false);
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
      api.get("/api/customers").catch(() => ({ data: [] })),
      api.get("/api/suppliers").catch(() => ({ data: [] })),
      api.get("/api/inventory").catch(() => ({ data: [] }))
    ]);
    setDeals(a.data || []); setCustomers(b.data || []);
    setSuppliers(c.data || []); setInventory(d.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const STAGES = ["All", "Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];
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
    if (type === "Sale") { setDealType("Sale"); } else { setDealType("Purchase"); }
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
      await api.post("/api/deals", {
        deal_type: form.deal_type,
        customer_id: form.customer_id || undefined,
        customer_name: custName || undefined,
        supplier_id: form.supplier_id || undefined,
        supplier_name: supplierName || undefined,
        product_id: form.product_id || undefined,
        product_name: selProd?.product_name || selProd?.name || undefined,
        quantity: qty, unit_price: price,
        total_value: qty * price, total_amount: qty * price,
        status: "Created", stage: "Created",
        payment_status: form.payment_status,
        payment_terms: form.payment_terms,
        expected_delivery: form.expected_delivery || undefined,
        notes: form.notes || undefined,
      });
      close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const updateDealStatus = async (dealId, newStatus, extraFields = {}) => {
    try {
      await api.put(`/api/deals/${dealId}`, { status: newStatus, stage: newStatus, ...extraFields });
      fetchAll();
    } catch (e) { alert("Update failed: " + e.message); }
  };

  // Auto-trigger: When payment = Paid, mark as Closed
  const markPaid = async (deal) => {
    await updateDealStatus(deal.id, "Paid", { payment_status: "Paid" });
    // Auto close after a beat
    setTimeout(() => updateDealStatus(deal.id, "Closed", { payment_status: "Paid" }), 500);
  };

  const totalValue = typeDeals.reduce((s, d) => s + (d.total_value || d.total_amount || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Trade Engine</h1>
          <p className="text-gray-400 text-sm">{typeDeals.length} deals · {fmt(totalValue)}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => openAdd("Purchase")}>+ Purchase Deal</Btn>
          <Btn onClick={() => openAdd("Sale")}>+ Sale Deal</Btn>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <TypeToggle
          value={dealType}
          onChange={t => { setDealType(t); setStageFilter("All"); }}
          options={["Sale", "Purchase"]}
          colors={["bg-blue-600 text-white shadow-sm", "bg-orange-500 text-white shadow-sm"]}
        />
        <div className="text-xs text-gray-400">
          {dealType === "Sale" ? "📤 Outgoing — selling stock to customers" : "📥 Incoming — buying stock from suppliers"}
        </div>
      </div>

      {/* Stage filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {STAGES.map(s => (
          <button key={s} onClick={() => setStageFilter(s)}
            className={cls("px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
              stageFilter === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {s} ({s === "All" ? typeDeals.length : typeDeals.filter(d => (d.status || "").toLowerCase() === s.toLowerCase()).length})
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {filtered.map(d => {
            const cust = customers.find(c => c.id === d.customer_id);
            const supp = suppliers.find(s => s.id === d.supplier_id);
            const isPurchase = d.deal_type === "purchase";
            return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-blue-600">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</span>
                      <Badge text={isPurchase ? "Purchase" : "Sale"} color={isPurchase ? "orange" : "blue"} />
                      <Badge text={d.status || "Created"} />
                      <Badge text={d.payment_status || "Pending"} />
                    </div>
                    <p className="font-bold text-gray-800">
                      {isPurchase
                        ? (d.supplier_name || supp?.name || "Unknown Supplier")
                        : (d.customer_name || cust?.name || "Unknown Customer")}
                    </p>
                    <p className="text-sm text-gray-500">{d.product_name || "—"} · {d.quantity || 0} units @ {fmt(d.unit_price)}</p>
                    <div className="mt-2">
                      <StatusPipeline current={d.status || "Created"} />
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-xl font-black text-green-700">{fmt(d.total_value || d.total_amount)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(d.created_at)}</p>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {d.status === "Created" && (
                        <Btn small variant="secondary" onClick={() => updateDealStatus(d.id, "In Transit")}>Mark In Transit</Btn>
                      )}
                      {d.status === "In Transit" && (
                        <Btn small variant="secondary" onClick={() => updateDealStatus(d.id, "Delivered")}>Mark Delivered</Btn>
                      )}
                      {d.status === "Delivered" && (d.payment_status || "Pending") !== "Paid" && (
                        <Btn small variant="green" onClick={() => markPaid(d)}>Mark Paid → Close</Btn>
                      )}
                      {d.status === "Closed" && (
                        <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full">✅ Closed & in Ledger</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <p className="text-5xl mb-3">🤝</p>
              <p>No {dealType.toLowerCase()} deals found</p>
              <Btn variant="secondary" onClick={() => openAdd(dealType)} className="mt-3">Create First Deal</Btn>
            </div>
          )}
        </div>
      )}

      {/* Create Deal Panel */}
      <SlidePanel title={form.deal_type === "purchase" ? "📥 New Purchase Deal" : "📤 New Sale Deal"} open={showAdd} onClose={close} wide>
        {/* Type toggle inside panel */}
        <div className="flex gap-2 items-center">
          <TypeToggle
            value={form.deal_type === "sale" ? "Sale" : "Purchase"}
            onChange={t => setForm(p => ({ ...p, deal_type: t.toLowerCase() }))}
            options={["Sale", "Purchase"]}
            colors={["bg-blue-600 text-white shadow-sm", "bg-orange-500 text-white shadow-sm"]}
          />
          <p className="text-xs text-gray-400 ml-2">
            {form.deal_type === "purchase" ? "Buying from supplier" : "Selling to customer"}
          </p>
        </div>

        {form.deal_type === "sale" ? (
          <Field label="Customer" required>
            <AutocompleteInput
              endpoint="/api/autocomplete/customers"
              placeholder="Type customer name…"
              value={custName}
              onChange={v => setCustName(v)}
              onSelect={c => { setForm(p => ({ ...p, customer_id: c.id })); setCustName(c.name); }}
            />
          </Field>
        ) : (
          <Field label="Supplier" required>
            <AutocompleteInput
              endpoint="/api/autocomplete/suppliers"
              placeholder="Type supplier name…"
              value={supplierName}
              onChange={v => setSupplierName(v)}
              onSelect={s => { setForm(p => ({ ...p, supplier_id: s.id })); setSupplierName(s.name); }}
            />
          </Field>
        )}

        <Field label="Material / Product">
          <Select value={form.product_id} onChange={set("product_id")}>
            <option value="">— Select from stock —</option>
            {inventory.map(i => <option key={i.id} value={i.id}>{i.product_name || i.name} ({i.available_quantity} {i.unit || "pcs"} available)</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label={form.deal_type === "purchase" ? "Buy Rate (₹)" : "Sale Rate (₹)"}><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
        </div>

        {form.quantity && form.unit_price && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-green-700">Total {form.deal_type === "purchase" ? "Purchase" : "Sale"} Value</span>
            <span className="text-xl font-black text-green-700">{fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Terms">
            <Select value={form.payment_terms} onChange={set("payment_terms")}>
              <option>Immediate</option><option>7 days</option><option>15 days</option>
              <option>30 days</option><option>45 days</option><option>60 days</option><option>Against Delivery</option>
            </Select>
          </Field>
          <Field label="Expected Delivery"><Input type="date" value={form.expected_delivery} onChange={set("expected_delivery")} /></Field>
        </div>

        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Deal terms, special instructions…" /></Field>

        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Creating…" : form.deal_type === "purchase" ? "Create Purchase Deal" : "Create Sale Deal"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
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
  const [transitType, setTransitType] = useState("Outgoing");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    vehicle_number: "", driver_name: "", driver_phone: "",
    origin_yard_id: "", destination: "", dispatch_date: today(),
    expected_arrival: "", freight_cost: "", status: "Created",
    cargo_details: "", transit_type: "outgoing"
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      api.get("/api/shipments").catch(() => ({ data: [] })),
      api.get("/api/yards").catch(() => ({ data: [] }))
    ]);
    setShips(a.data || []); setYards(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const STATUSES = ["All", "Created", "Loaded", "In Transit", "Arrived", "Delivered"];

  // Filter by type
  const typeShips = ships.filter(s =>
    transitType === "Incoming"
      ? (s.transit_type === "incoming" || s.shipment_type === "incoming")
      : (s.transit_type === "outgoing" || s.shipment_type === "outgoing" || !s.transit_type)
  );
  const filtered = statusFilter === "All" ? typeShips : typeShips.filter(s => (s.status || "").toLowerCase() === statusFilter.toLowerCase());

  const DEFAULTS = {
    vehicle_number: "", driver_name: "", driver_phone: "",
    origin_yard_id: "", destination: "", dispatch_date: today(),
    expected_arrival: "", freight_cost: "", status: "Created",
    cargo_details: "", transit_type: "outgoing"
  };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };

  const openAdd = (type) => {
    setTransitType(type);
    setForm({ ...DEFAULTS, transit_type: type.toLowerCase() });
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.destination) { setErr("Destination required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/api/shipments", {
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name, driver_phone: form.driver_phone,
        origin_yard_id: form.origin_yard_id || null,
        destination: form.destination,
        dispatch_date: form.dispatch_date,
        expected_arrival: form.expected_arrival,
        freight_cost: parseFloat(form.freight_cost) || 0,
        status: form.status,
        cargo_details: form.cargo_details,
        transit_type: form.transit_type,
        shipment_type: form.transit_type,
      });
      close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/api/shipments/${id}`, { status });
      fetchAll();
    } catch (e) { alert("Failed: " + e.message); }
  };

  const incomingCount = ships.filter(s => s.transit_type === "incoming" || s.shipment_type === "incoming").length;
  const outgoingCount = ships.filter(s => s.transit_type !== "incoming" && s.shipment_type !== "incoming").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Transit</h1>
          <p className="text-gray-400 text-sm">{incomingCount} incoming · {outgoingCount} outgoing</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => openAdd("Incoming")}>+ Incoming</Btn>
          <Btn onClick={() => openAdd("Outgoing")}>+ Outgoing</Btn>
        </div>
      </div>

      {/* Type toggle */}
      <div className="flex items-center gap-4 mb-4">
        <TypeToggle
          value={transitType}
          onChange={t => { setTransitType(t); setStatusFilter("All"); }}
          options={["Outgoing", "Incoming"]}
          colors={["bg-blue-600 text-white shadow-sm", "bg-orange-500 text-white shadow-sm"]}
        />
        <div className="text-xs text-gray-400">
          {transitType === "Incoming" ? "📥 Purchase deliveries arriving at yard" : "📤 Sales dispatches going to customers"}
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cls("px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
              statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {s} ({s === "All" ? typeShips.length : typeShips.filter(x => (x.status || "").toLowerCase() === s.toLowerCase()).length})
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Shipment #", "Type", "Vehicle", "Driver", "From / To", "Dispatch", "ETA", "Status", "Freight", "Actions"].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.shipment_number || `#${s.id?.toString().slice(-6)}`}</td>
                  <td className="px-4 py-3"><Badge text={(s.transit_type || s.shipment_type) === "incoming" ? "Incoming" : "Outgoing"} color={(s.transit_type || s.shipment_type) === "incoming" ? "orange" : "blue"} /></td>
                  <td className="px-4 py-3 font-semibold">{s.vehicle_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {yards.find(y => y.id === s.origin_yard_id)?.name || "—"} → {s.destination || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.dispatch_date)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.expected_arrival)}</td>
                  <td className="px-4 py-3"><Badge text={s.status || "Created"} /></td>
                  <td className="px-4 py-3 font-semibold">{fmt(s.freight_cost)}</td>
                  <td className="px-4 py-3">
                    {s.status === "Created" && <Btn small variant="secondary" onClick={() => updateStatus(s.id, "In Transit")}>Dispatch</Btn>}
                    {s.status === "In Transit" && <Btn small variant="green" onClick={() => updateStatus(s.id, "Delivered")}>Delivered</Btn>}
                    {s.status === "Delivered" && <span className="text-xs text-green-600 font-semibold">✅ Done</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-300">No shipments found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title={form.transit_type === "incoming" ? "📥 Incoming Shipment" : "📤 Outgoing Shipment"} open={showAdd} onClose={close}>
        <div className={cls("rounded-lg p-3 text-xs font-medium",
          form.transit_type === "incoming" ? "bg-orange-50 border border-orange-200 text-orange-700" : "bg-blue-50 border border-blue-200 text-blue-700")}>
          {form.transit_type === "incoming"
            ? "📥 Incoming: Material arriving from supplier to your yard"
            : "📤 Outgoing: Material dispatched to customer from your yard"}
        </div>

        <TypeToggle
          value={form.transit_type === "incoming" ? "Incoming" : "Outgoing"}
          onChange={t => setForm(p => ({ ...p, transit_type: t.toLowerCase() }))}
          options={["Outgoing", "Incoming"]}
          colors={["bg-blue-600 text-white shadow-sm", "bg-orange-500 text-white shadow-sm"]}
        />

        <Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="MH-12-AB-1234" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Driver Name"><Input value={form.driver_name} onChange={set("driver_name")} /></Field>
          <Field label="Driver Phone"><Input value={form.driver_phone} onChange={set("driver_phone")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={form.transit_type === "incoming" ? "Arriving at Yard" : "Departing Yard"}>
            <Select value={form.origin_yard_id} onChange={set("origin_yard_id")}>
              <option value="">— Select yard —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label={form.transit_type === "incoming" ? "From (Supplier Location)" : "Destination"} required>
            <Input value={form.destination} onChange={set("destination")} placeholder="City / Address" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={set("dispatch_date")} /></Field>
          <Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={set("expected_arrival")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Freight Cost (₹)"><Input type="number" value={form.freight_cost} onChange={set("freight_cost")} placeholder="0" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {["Created", "Loaded", "In Transit", "Arrived", "Delivered"].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Cargo Details"><Textarea value={form.cargo_details} onChange={set("cargo_details")} placeholder="Material type, quantity, condition…" /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── SUPPLIERS ──────────────────────────────────────────────────────────────────
function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", city: "", country: "India", contact_person: "", phone: "", email: "", gst_number: "", pan_number: "", products_supplied: "", credit_terms: "30 days", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      api.get("/api/suppliers").catch(() => ({ data: [] })),
      api.get("/api/deals").catch(() => ({ data: [] })),
      api.get("/api/inventory").catch(() => ({ data: [] }))
    ]);
    setSuppliers(a.data || []); setDeals(b.data || []); setInv(c.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = { name: "", city: "", country: "India", contact_person: "", phone: "", email: "", gst_number: "", pan_number: "", products_supplied: "", credit_terms: "30 days", notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try { await api.post("/api/suppliers", form); close(); fetchAll(); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
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
              <tr>{["Supplier", "Location", "GST", "Contact", "Credit Terms", "Products", "Purchases", "Outstanding"].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {suppliers.map(s => {
                const sDeals = deals.filter(d => d.supplier_id === s.id && d.deal_type === "purchase");
                const outstanding = sDeals.filter(d => (d.payment_status || "").toLowerCase() === "pending").reduce((sum, d) => sum + (d.total_value || 0), 0);
                return (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-bold text-gray-800">{s.name}</p><p className="text-xs text-gray-400">{s.contact_person}</p></td>
                    <td className="px-4 py-3 text-gray-500">{[s.city, s.country].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.gst_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.phone || s.email || "—"}</td>
                    <td className="px-4 py-3"><Badge text={s.credit_terms || "30 days"} color="blue" /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.products_supplied || "—"}</td>
                    <td className="px-4 py-3 font-semibold">{sDeals.length}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{outstanding > 0 ? fmt(outstanding) : "—"}</td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No suppliers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Supplier" open={showAdd} onClose={close}>
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} className="uppercase" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} className="uppercase" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Products Supplied"><Input value={form.products_supplied} onChange={set("products_supplied")} placeholder="Teak, Plywood…" /></Field>
        <Field label="Credit Terms">
          <Select value={form.credit_terms} onChange={set("credit_terms")}>
            <option>Immediate</option><option>7 days</option><option>15 days</option><option>30 days</option><option>45 days</option><option>60 days</option>
          </Select>
        </Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Supplier"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
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
    const [a, b] = await Promise.all([
      api.get("/api/customers").catch(() => ({ data: [] })),
      api.get("/api/deals").catch(() => ({ data: [] }))
    ]);
    setCustomers(a.data || []); setDeals(b.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = { name: "", city: "", country: "India", phone: "", email: "", gst_number: "", pan_number: "", notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try { await api.post("/api/customers", form); close(); fetchAll(); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
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
              <tr>{["Customer", "Location", "GST", "Contact", "Total Deals", "Revenue", "Pending", "Last Deal"].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const cDeals = deals.filter(d => d.customer_id === c.id);
                const rev = cDeals.filter(d => (d.payment_status || "").toLowerCase() === "paid").reduce((s, d) => s + (d.total_value || 0), 0);
                const pending = cDeals.filter(d => (d.payment_status || "").toLowerCase() === "pending").reduce((s, d) => s + (d.total_value || 0), 0);
                const last = [...cDeals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{[c.city, c.country].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.gst_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || c.email || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{cDeals.length}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{rev > 0 ? fmt(rev) : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{pending > 0 ? fmt(pending) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(last?.created_at)}</td>
                  </tr>
                );
              })}
              {customers.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No customers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Customer" open={showAdd} onClose={close}>
        <Field label="Customer Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
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

// ── CLOSED LEDGER ──────────────────────────────────────────────────────────────
function ClosedLedger() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/deals").then(r => {
      const closed = (r.data || []).filter(d => (d.status || "").toLowerCase() === "closed");
      setDeals(closed);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalRevenue = deals.reduce((s, d) => s + (d.total_value || 0), 0);
  const totalProfit = deals.reduce((s, d) => s + ((d.unit_price || 0) - (d.buy_price || 0)) * (d.quantity || 0), 0);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-gray-800">Closed Ledger</h1>
        <p className="text-gray-400 text-sm">Paid & closed deals — permanent business record</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Closed Deals" value={deals.length} icon="📒" color="teal" />
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} icon="💰" color="green" />
        <StatCard label="Est. Profit" value={fmt(totalRevenue * 0.18)} icon="✨" color="purple" sub="~18% margin" />
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Deal #", "Type", "Party", "Material", "Qty", "Buy Rate", "Sale Rate", "Value", "Profit", "Date Closed"].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {deals.map(d => {
                const profit = ((d.unit_price || 0) - (d.buy_price || 0)) * (d.quantity || 0);
                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</td>
                    <td className="px-4 py-3"><Badge text={d.deal_type === "purchase" ? "Purchase" : "Sale"} color={d.deal_type === "purchase" ? "orange" : "blue"} /></td>
                    <td className="px-4 py-3 font-semibold">{d.customer_name || d.supplier_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                    <td className="px-4 py-3">{d.quantity || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(d.buy_price || d.cost_price)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(d.unit_price)}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value)}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: profit >= 0 ? "#16a34a" : "#dc2626" }}>{profit ? fmt(profit) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.updated_at)}</td>
                  </tr>
                );
              })}
              {deals.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-300">
                  <p className="text-4xl mb-2">📒</p>
                  <p>No closed deals yet</p>
                  <p className="text-xs mt-1">Deals move here automatically when marked Paid → Closed in Trade Engine</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── FINANCIALS ─────────────────────────────────────────────────────────────────
function Financials() {
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.get("/api/inventory").catch(() => ({ data: [] })), api.get("/api/deals").catch(() => ({ data: [] }))]).then(([a, b]) => {
      setInv(a.data || []); setDeals(b.data || []); setLoading(false);
    });
  }, []);

  const totalCost = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const marketVal = inv.reduce((s, i) => s + (i.market_value || i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = deals.filter(d => ["closed", "completed", "delivered"].includes((d.status || "").toLowerCase())).reduce((s, d) => s + (d.total_value || 0), 0);
  const pendingReceivables = deals.filter(d => d.deal_type !== "purchase" && (d.payment_status || "").toLowerCase() === "pending").reduce((s, d) => s + (d.total_value || 0), 0);
  const pendingPayables = deals.filter(d => d.deal_type === "purchase" && (d.payment_status || "").toLowerCase() === "pending").reduce((s, d) => s + (d.total_value || 0), 0);

  const catData = {};
  inv.forEach(i => { const c = i.category || "Other"; catData[c] = (catData[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0); });
  const barData = Object.entries(catData).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Financials</h1><p className="text-gray-400 text-sm">Business P&L overview</p></div>
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={fmt(revenue)} icon="💰" color="green" sub="Closed deals" />
            <StatCard label="Stock Value (Cost)" value={fmt(totalCost)} icon="📦" color="blue" />
            <StatCard label="Receivables" value={fmt(pendingReceivables)} icon="📥" color="orange" sub="Customers owe you" />
            <StatCard label="Payables" value={fmt(pendingPayables)} icon="📤" color="red" sub="You owe suppliers" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold mb-4">Stock by Category (₹)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h3 className="font-bold">P&L Summary</h3>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs text-green-500 uppercase tracking-wide">Revenue (Closed Deals)</p>
                <p className="text-2xl font-black text-green-700">{fmt(revenue)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-500 uppercase tracking-wide">Current Stock Value</p>
                <p className="text-2xl font-black text-blue-700">{fmt(totalCost)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="text-xs text-orange-500 uppercase">Receivables</p>
                  <p className="text-lg font-black text-orange-700">{fmt(pendingReceivables)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs text-red-500 uppercase">Payables</p>
                  <p className="text-lg font-black text-red-700">{fmt(pendingPayables)}</p>
                </div>
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
  useEffect(() => { api.get("/api/company").then(r => setCompany(r.data || {})).catch(() => {}); }, []);

  const REPORTS = [
    { key: "inventory", label: "Stock Report", icon: "📦", desc: "All current stock with valuation" },
    { key: "sales", label: "Sales Report", icon: "🤝", desc: "All sale deals and revenue" },
    { key: "shipments", label: "Shipment Report", icon: "🚛", desc: "Transit & logistics log" },
    { key: "suppliers", label: "Supplier Report", icon: "🏭", desc: "Supplier directory & purchases" },
    { key: "customers", label: "Customer Report", icon: "👥", desc: "Customer revenue analysis" },
  ];

  const downloadPDF = async (type, label) => {
    setLoading(p => ({ ...p, [type]: true }));
    try {
      const { data } = await api.get(`/api/reports/${type}`);
      const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const co = company;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${label}</title>
<style>* {margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a1a}.page{max-width:900px;margin:0 auto;padding:32px}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #1e3a5f;margin-bottom:20px}.company-name{font-size:22px;font-weight:900;color:#1e3a5f}.report-title-box{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:14px 20px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.report-title{font-size:16px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:#1e3a5f;color:white}th{padding:8px 10px;text-align:left;font-weight:600}tbody tr:nth-child(even){background:#f8fafc}td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155}.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body><div class="page">
<div class="header"><div><div class="company-name">${co.name || "Dockside Timber"}</div><div style="font-size:10px;color:#64748b">Timber Trade OS</div>${co.address ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${co.address}</div>` : ""}</div>
<div style="text-align:right;font-size:10px;color:#475569">${co.gst_number ? `<div>GST: ${co.gst_number}</div>` : ""}${co.pan_number ? `<div>PAN: ${co.pan_number}</div>` : ""}${co.owner_name ? `<div>Prop: ${co.owner_name}</div>` : ""}</div></div>
<div class="report-title-box"><div><div class="report-title">${label}</div><div style="font-size:11px;opacity:0.8;margin-top:2px">${data.length} records</div></div><div style="font-size:10px;opacity:0.85">Generated: ${now}</div></div>
<table><thead><tr>${Object.keys(data[0] || {}).slice(0, 8).map(k => `<th>${k}</th>`).join("")}</tr></thead>
<tbody>${data.map(row => `<tr>${Object.values(row).slice(0, 8).map(v => `<td>${v ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>
</div><div style="max-width:900px;margin:0 auto;padding:0 32px"><div class="footer"><span>${co.name || "Dockside"} · Confidential</span><span>Generated ${now}</span></div></div>
</body></html>`;
      const w = window.open("", "_blank");
      w.document.write(html); w.document.close();
      setTimeout(() => w.print(), 800);
    } catch (e) { alert("Failed: " + e.message); }
    setLoading(p => ({ ...p, [type]: false }));
  };

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Reports</h1><p className="text-gray-400 text-sm">PDF reports with company letterhead</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTS.map(r => (
          <div key={r.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl mb-3">{r.icon}</div>
            <h3 className="font-bold text-gray-800">{r.label}</h3>
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
  const [form, setForm] = useState({
    name: "", industry: "Timber Trade", city: "", country: "India", address: "",
    owner_name: "", phone: "", email: "", website: "",
    gst_number: "", pan_number: "", iec_number: "", cin_number: "",
    bank_name: "", bank_account: "", bank_ifsc: "", bank_branch: "", notes: ""
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const co = await api.get("/api/company");
      const coData = co.data || {};
      setCompany(coData);
      if (coData.id) setForm(coData);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      if (company?.id) { await api.put(`/api/company/${company.id}`, form); }
      else { await api.post("/api/company", form); }
      fetchAll(); alert("✅ Company profile saved!");
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const TABS = [
    { id: "profile", label: "Profile", icon: "🏢" },
    { id: "legal", label: "Legal & Tax", icon: "⚖️" },
    { id: "banking", label: "Banking", icon: "🏦" },
  ];

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Company Settings</h1><p className="text-gray-400 text-sm">GST, PAN, IEC, banking details</p></div>
      {company?.name && (
        <div className="bg-gradient-to-r from-gray-900 to-blue-900 text-white rounded-xl p-5 mb-6 flex items-start justify-between">
          <div><p className="text-2xl font-black">{company.name}</p><p className="text-blue-200 text-sm mt-1">{company.industry}</p><p className="text-gray-300 text-xs mt-2">{company.address}</p></div>
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
            className={cls("px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all",
              activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        {activeTab === "profile" && (<>
          <Field label="Company Name" required><Input value={form.name} onChange={set("name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry"><Select value={form.industry} onChange={set("industry")}><option>Timber Trade</option><option>Wood Products</option><option>Import/Export</option></Select></Field>
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
        </>)}
        {activeTab === "legal" && (<>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} className="uppercase font-mono" /></Field>
            <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} className="uppercase font-mono" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IEC Number"><Input value={form.iec_number} onChange={set("iec_number")} className="uppercase font-mono" /></Field>
            <Field label="CIN Number"><Input value={form.cin_number} onChange={set("cin_number")} className="uppercase font-mono" /></Field>
          </div>
        </>)}
        {activeTab === "banking" && (<>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name"><Input value={form.bank_name} onChange={set("bank_name")} /></Field>
            <Field label="Account Number"><Input value={form.bank_account} onChange={set("bank_account")} className="font-mono" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IFSC Code"><Input value={form.bank_ifsc} onChange={set("bank_ifsc")} className="uppercase font-mono" /></Field>
            <Field label="Branch Name"><Input value={form.bank_branch} onChange={set("bank_branch")} /></Field>
          </div>
        </>)}
        <ErrBanner msg={err} />
        <div className="pt-2"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save Profile"}</Btn></div>
      </div>
    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────────
function Settings() {
  const user = JSON.parse(localStorage.getItem("dockside-user") || "{}");
  const hasApiKey = !!ANTHROPIC_KEY;
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-700">Account</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
            {(user.full_name || user.email || "U")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-800">{user.full_name || "User"}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
            <Badge text={user.role || "user"} color="blue" />
          </div>
        </div>

        <div className={cls("border rounded-xl p-4", hasApiKey ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200")}>
          <p className={cls("font-bold text-sm mb-1", hasApiKey ? "text-green-800" : "text-amber-800")}>
            {hasApiKey ? "✅ Dockside AI is active" : "⚠️ Dockside AI needs setup"}
          </p>
          <p className={cls("text-xs", hasApiKey ? "text-green-600" : "text-amber-700")}>
            {hasApiKey
              ? "Claude AI is connected. Use the 🤖 button in the bottom-right corner."
              : "Add VITE_ANTHROPIC_KEY to your Vercel environment variables to enable AI insights."}
          </p>
          {!hasApiKey && (
            <ol className="text-xs text-amber-700 mt-2 space-y-1 list-decimal list-inside">
              <li>Go to Vercel Dashboard → Your Project → Settings</li>
              <li>Click Environment Variables</li>
              <li>Add: Name = <code className="bg-amber-100 px-1 rounded">VITE_ANTHROPIC_KEY</code></li>
              <li>Value = your Anthropic API key</li>
              <li>Redeploy the project</li>
            </ol>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          💡 Company details (GST, PAN, IEC) → <strong>Company</strong> in sidebar
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dockside-user")); } catch { return null; }
  });

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
      {/* AI floating button — always visible */}
      <DockAI />
    </BrowserRouter>
  );
}
