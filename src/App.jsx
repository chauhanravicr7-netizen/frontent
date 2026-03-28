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
const DEAL_STAGES =["Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];
const StatusPipeline = ({ current }) => {
  const idx = DEAL_STAGES.findIndex(s => s.toLowerCase() === (current || "").toLowerCase());
  const activeIdx = idx === -1 ? 0 : idx;
  return (
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
};

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

const AutocompleteInput = ({ endpoint, value, onChange, onSelect, placeholder, localList = [] }) => {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
      const handleClickOutside = (event) => {
          if (ref.current && !ref.current.contains(event.target)) {
              setOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  },[]);

  const handleSearch = async (q) => {
      if (!q) { 
          setSuggestions([]); 
          setOpen(false); 
          return; 
      }
      try {
          const { data } = await api.get(`${endpoint}?q=${encodeURIComponent(q)}`);
          setSuggestions(data ||[]);
          setOpen(true);
      } catch {
          const filtered = localList
              .filter(item => (item.name || "").toLowerCase().includes(q.toLowerCase()))
              .slice(0, 8);
          setSuggestions(filtered);
          setOpen(filtered.length > 0);
      }
  };

  return (
      <div className="relative" ref={ref}>
          <input
              value={value}
              onChange={e => { 
                  onChange(e.target.value); 
                  handleSearch(e.target.value); 
              }}
              placeholder={placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          {open && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto mt-2 py-1">
                  {suggestions.map(s => (
                      <button
                          key={s.id}
                          onClick={() => { 
                              onSelect(s); 
                              setOpen(false); 
                              onChange(s.name); 
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 transition-colors"
                      >
                          <p className="font-bold text-gray-800">{s.name}</p>
                          <p className="text-xs font-medium text-gray-400 mt-0.5">
                              {[s.city, s.gst_number].filter(Boolean).join(" · ")}
                          </p>
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
    {/* FIX 1: Added min-h-0 and pb-24 so that at 100% zoom, the sidebar scrolls instead of hiding the bottom links */}
    <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1 custom-scrollbar min-h-0 pb-24">
      {NAV.map(n => (
        <NavLink 
          key={n.to} 
          to={n.to} 
          end={n.to === "/"} 
          className={({ isActive }) => cls(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group", 
            isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <span className={cls("text-lg transition-transform", "group-hover:scale-110")}>{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
    <div className="p-4 border-t border-gray-800 bg-gray-950/30">
      <button 
        onClick={onSignOut} 
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-gray-800/50 hover:bg-red-500/20 hover:text-red-400 transition-all"
      >
        <span>🚪</span> Sign Out
      </button>
    </div>
  </div>
);

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // For registration side
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submitLogin = async () => {
    if (!email || !password) { setErr("Email and password required"); return; }
    setLoading(true); setErr("");
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("dockside-token", data.token); 
      localStorage.setItem("dockside-user", JSON.stringify(data.user)); 
      onLogin(data.user);
    } catch (e) { 
      setErr(e.response?.data?.error || e.message || "Login failed. Check your credentials."); 
    } finally { 
      setLoading(false); 
    }
  };

  const submitRegister = async () => {
    alert(`Registration triggered for ${name}. Add backend endpoint!`);
  };

  return (
    <div className="min-h-screen bg-[#e9ecf3] flex items-center justify-center p-4 font-sans">
      <div className="relative w-[768px] max-w-full min-h-[480px] bg-white rounded-[30px] shadow-2xl overflow-hidden">
        
        {/* --- SIGN UP FORM --- */}
        <div className={`absolute top-0 h-full w-1/2 left-0 transition-all duration-700 ease-in-out px-10 flex flex-col justify-center ${
            isSignUp ? 'translate-x-full opacity-100 z-50' : 'opacity-0 z-10 pointer-events-none'
          }`}>
          <h1 className="text-3xl font-black text-gray-900 text-center mb-6 tracking-tight">Registration</h1>
          <div className="flex justify-center gap-4 mb-6">
            <button className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors">G</button>
            <button className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors">f</button>
            <button className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors">in</button>
          </div>
          <span className="text-xs text-gray-500 text-center mb-6">or register with email</span>
          <input type="text" placeholder="Username" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b59d3] mb-3 transition-all" />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b59d3] mb-3 transition-all" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b59d3] mb-6 transition-all" />
          <button onClick={submitRegister} className="w-full bg-[#6b59d3] hover:bg-[#5848b5] text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-purple-500/30">Register</button>
        </div>

        {/* --- SIGN IN FORM --- */}
        <div className={`absolute top-0 h-full w-1/2 left-0 transition-all duration-700 ease-in-out px-10 flex flex-col justify-center ${
            isSignUp ? 'translate-x-full opacity-0 z-10 pointer-events-none' : 'opacity-100 z-50'
          }`}>
          <h1 className="text-3xl font-black text-gray-900 text-center mb-6 tracking-tight">Login</h1>
          <div className="flex justify-center gap-4 mb-6">
            <button className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700">G</button>
            <button className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700">f</button>
            <button className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700">in</button>
          </div>
          <span className="text-xs text-gray-500 text-center mb-6">or login with email</span>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b59d3] mb-3 transition-all" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submitLogin()} className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b59d3] mb-2 transition-all" />
          <p className="text-xs font-bold text-[#6b59d3] hover:text-[#5848b5] cursor-pointer mb-6">Forgot Password?</p>
          {err && <div className="text-red-500 text-xs font-bold mb-3 text-center bg-red-50 p-2 rounded-lg">{err}</div>}
          <button onClick={submitLogin} disabled={loading} className="w-full bg-[#6b59d3] hover:bg-[#5848b5] text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50">
            {loading ? "Authenticating..." : "Login"}
          </button>
        </div>

        {/* --- OVERLAY CONTAINER --- */}
        <div className={`absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-[100] ${
            isSignUp ? '-translate-x-full' : 'translate-x-0'
          }`}>
          <div className={`bg-gradient-to-br from-[#8d7cff] to-[#6b59d3] relative -left-full h-full w-[200%] transform transition-transform duration-700 ease-in-out text-white ${
              isSignUp ? 'translate-x-1/2' : 'translate-x-0'
            }`}>
            
            {/* OVERLAY LEFT (Appears when Sign Up is active) */}
            <div className={`absolute w-1/2 h-full flex flex-col justify-center items-center px-12 text-center top-0 transition-transform duration-700 ease-in-out ${
                isSignUp ? 'translate-x-0' : '-translate-x-[20%]'
              }`}>
              <h2 className="text-3xl font-black mb-4 leading-tight">Welcome Back!</h2>
              <p className="text-sm font-medium mb-8 text-white/80">Already have an account? Log in to continue accessing your dashboard.</p>
              <button onClick={() => setIsSignUp(false)} className="px-10 py-2.5 border-2 border-white rounded-full font-bold hover:bg-white hover:text-[#6b59d3] transition-colors">
                Login
              </button>
            </div>

            {/* OVERLAY RIGHT (Appears when Sign In is active) */}
            <div className={`absolute right-0 w-1/2 h-full flex flex-col justify-center items-center px-12 text-center top-0 transition-transform duration-700 ease-in-out ${
                isSignUp ? 'translate-x-[20%]' : 'translate-x-0'
              }`}>
              <h2 className="text-3xl font-black mb-4 leading-tight">Hello, Welcome!</h2>
              <p className="text-sm font-medium mb-8 text-white/80">Don't have an account? Register now to start managing your logistics.</p>
              <button onClick={() => setIsSignUp(true)} className="px-10 py-2.5 border-2 border-white rounded-full font-bold hover:bg-white hover:text-[#6b59d3] transition-colors">
                Register
              </button>
            </div>
            
          </div>
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
  const user = JSON.parse(localStorage.getItem("dockside-user") || "{}");
  const isMissingCompany = !user.company_id || user.company_id === "null";

  useEffect(() => {
    if (isMissingCompany) return;
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
            <p>Because your account lacks a <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded">company_id</code>, all database saves are failing with UUID errors.</p>
            <p className="font-bold text-gray-900 mt-4">How to fix this instantly:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Open your <strong>Supabase Dashboard</strong>.</li>
              <li>Go to the <strong>Table Editor</strong> and open the <code className="bg-gray-100 px-1 rounded">users</code> table.</li>
              <li>Find your email row.</li>
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
  const chartData = months.map((m, i) => ({ month: m, revenue: Math.round((stats.monthlyRevenue || 0) * (0.7 + i * 0.06)), cost: Math.round((stats.totalInventoryValue || 0) * 0.1 * (0.8 + i * 0.04)) }));

  const purchaseDeals = deals.filter(d => d.deal_type === "purchase" || !d.deal_type).length;
  const saleDeals = deals.filter(d => d.deal_type === "sale").length;
  const pendingPayment = deals.filter(d => (d.payment_status || "").toLowerCase() === "pending").length;
  const closedDeals = deals.filter(d => (d.status || "").toLowerCase() === "closed").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Command Center</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Live business telemetry</p>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-2xl p-4 text-white text-sm flex items-center gap-3 overflow-x-auto shadow-lg shadow-blue-900/20">
        <span className="whitespace-nowrap font-black text-blue-300 uppercase tracking-widest text-xs">Business Flow:</span>
        {["Purchase Deal", "→", "Transit In", "→", "Stock Added", "→", "Sale Deal", "→", "Transit Out", "→", "Payment", "→", "Ledger Closed"].map((s, i) => (
          <span key={i} className={s === "→" ? "text-blue-500/50 font-black" : "bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-bold shadow-sm"}>{s}</span>
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
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="#dbeafe" />
              <Area type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={3} fill="#fef3c7" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-black text-gray-800 mb-6 uppercase tracking-wide text-sm">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
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
  const [items, setItems] = useState([]); const [yards, setYards] = useState([]); const [suppliers, setSuppliers] = useState([]); const [loading, setLoading] = useState(true); const [tab, setTab] = useState("Current"); const[search, setSearch] = useState(""); const [showAdd, setShowAdd] = useState(false); const[saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [form, setForm] = useState({ product_name: "", category: "Plywood", wood_type: "", grade: "A", yard_id: "", supplier_id: "", unit: "pcs", cost_price: "", market_value: "", available_quantity: "", date: today(), notes: "" });
  const set = k => e => setForm(p => ({ ...p,[k]: e.target.value }));
  
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      api.get("/api/inventory").catch(() => ({ data: [] })), 
      api.get("/api/yards").catch(() => ({ data: [] })), 
      api.get("/api/suppliers").catch(() => ({ data:[] }))
    ]);
    setItems(a.data || []); setYards(b.data ||[]); setSuppliers(c.data || []); setLoading(false);
  },[]);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  
  const DEFAULTS = { product_name: "", category: "Plywood", wood_type: "", grade: "A", yard_id: "", supplier_id: "", unit: "pcs", cost_price: "", market_value: "", available_quantity: "", date: today(), notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  
  const save = async () => {
    if (!form.product_name) { setErr("Product name required"); return; }
    setSaving(true); setErr("");
    try {
      const payload = clean({ 
        product_name: form.product_name, category: form.category, wood_type: form.wood_type, 
        grade: form.grade, unit: form.unit, thickness: form.thickness, notes: form.notes, 
        cost_price: parseFloat(form.cost_price) || 0, market_value: parseFloat(form.market_value) || 0, 
        available_quantity: parseFloat(form.available_quantity) || 0, stock_status: "available" 
      });
      if (form.yard_id) payload.yard_id = form.yard_id; 
      if (form.supplier_id) payload.supplier_id = form.supplier_id;
      await api.post("/api/inventory", payload); 
      close(); 
      fetchAll();
    } catch (e) { 
      setErr(e.response?.data?.error || e.response?.data?.hint || e.message); 
    }
    setSaving(false);
  };

  const currentItems = items.filter(i => (i.stock_status || "available") !== "closed");
  const closedItems = items.filter(i => i.stock_status === "closed");
  const displayed = (tab === "Current" ? currentItems : closedItems).filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));
  const totalValue = currentItems.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Stock Management</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">{currentItems.length} products · {fmt(totalValue)} net value</p>
        </div>
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
                  ? ["Product", "Category", "Grade", "Yard", "Available", "Cost Price", "Market Value", "Total Value", "Status"].map(h => <th key={h} className="text-left px-5 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">{h}</th>) 
                  : ["Product", "Category", "Qty Sold", "Buy Price", "Sell Price", "Profit", "Customer", "Date"].map(h => <th key={h} className="text-left px-5 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">{h}</th>)
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
      
      <SlidePanel title="Add Stock" open={showAdd} onClose={close} error={err}>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-medium text-blue-800 shadow-inner mb-4">
          💡 Stock added here automatically enters <strong className="font-black">Current Inventory</strong>.
        </div>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Premium Teak Plywood 18mm" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category"><Select value={form.category} onChange={set("category")}><option>Plywood</option><option>Hardwood</option><option>Softwood</option><option>Veneer</option><option>MDF</option><option>Particle Board</option></Select></Field>
          <Field label="Wood Type"><Input value={form.wood_type} onChange={set("wood_type")} placeholder="Teak, Pine…" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Yard"><Select value={form.yard_id} onChange={set("yard_id")}><option value="">— Select Yard —</option>{yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <Field label="Supplier"><Select value={form.supplier_id} onChange={set("supplier_id")}><option value="">— Select Supplier —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cost Price (₹)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00" /></Field>
          <Field label="Market Value (₹)"><Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0.00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Initial Quantity" required><Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0" /></Field>
          <Field label="Unit"><Select value={form.unit} onChange={set("unit")}><option>pcs</option><option>sheets</option><option>m³</option><option>sqft</option><option>kg</option></Select></Field>
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
  const [yards, setYards] = useState([]); const [inv, setInv] = useState([]); const [loading, setLoading] = useState(true); const [showAdd, setShowAdd] = useState(false); const [saving, setSaving] = useState(false); const[err, setErr] = useState("");
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
    if (!form.name) { setErr("Yard name required"); return; } setSaving(true); setErr("");
    try { 
      const payload = clean({ name: form.name, city: form.city, address: form.address, manager_name: form.manager_name, manager_phone: form.manager_phone, notes: form.notes, is_active: true }); 
      await api.post("/api/yards", payload); 
      close(); 
      fetchAll(); 
    } catch (e) { 
      setErr(e.response?.data?.error || e.response?.data?.hint || e.message); 
    } 
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
        <div className="grid grid-cols-2 gap-4"><Field label="City"><Input value={form.city} onChange={set("city")} placeholder="e.g. Mumbai" /></Field><Field label="Manager Name"><Input value={form.manager_name} onChange={set("manager_name")} placeholder="Yard overseer" /></Field></div>
        <Field label="Full Street Address"><Textarea value={form.address} onChange={set("address")} placeholder="Plot no, street, landmark..." /></Field>
        <Field label="Manager Phone Number"><Input value={form.manager_phone} onChange={set("manager_phone")} placeholder="+91..." /></Field>
        <Field label="Operational Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Timings, accessibility constraints..." /></Field>
        <div className="pt-2 flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Committing…" : "Register Yard"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── TRADE ENGINE ───────────────────────────────────────────────────────────────
function TradeEngine() {
  const [deals, setDeals] = useState([]); const[customers, setCustomers] = useState([]); const [suppliers, setSuppliers] = useState([]); const[inventory, setInventory] = useState([]); const [loading, setLoading] = useState(true); const [dealType, setDealType] = useState("Sale"); const [stageFilter, setStageFilter] = useState("All"); const [showAdd, setShowAdd] = useState(false); const[saving, setSaving] = useState(false); const [err, setErr] = useState(""); const [custName, setCustName] = useState(""); const [supplierName, setSupplierName] = useState("");
  const [form, setForm] = useState({ deal_type: "sale", customer_id: "", supplier_id: "", product_id: "", quantity: "", unit_price: "", payment_terms: "30 days", status: "Created", payment_status: "Pending", expected_delivery: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  
  const fetchAll = useCallback(async () => { 
    setLoading(true); 
    const [a, b, c, d] = await Promise.all([
      api.get("/api/deals").catch(() => ({ data: [] })), 
      api.get("/api/customers").catch(() => ({ data:[] })), 
      api.get("/api/suppliers").catch(() => ({ data:[] })), 
      api.get("/api/inventory").catch(() => ({ data: [] }))
    ]); 
    setDeals(a.data ||[]); setCustomers(b.data || []); setSuppliers(c.data || []); setInventory(d.data ||[]); setLoading(false); 
  }, []);
  
  useEffect(() => { fetchAll(); }, [fetchAll]);
  
  const STAGES =["All", "Created", "In Transit", "Delivered", "Payment Pending", "Paid", "Closed"];
  const typeDeals = deals.filter(d => dealType === "Sale" ? (d.deal_type === "sale" || !d.deal_type) : d.deal_type === "purchase");
  const filtered = stageFilter === "All" ? typeDeals : typeDeals.filter(d => (d.status || "").toLowerCase() === stageFilter.toLowerCase());
  
  const DEFAULTS = { deal_type: "sale", customer_id: "", supplier_id: "", product_id: "", quantity: "", unit_price: "", payment_terms: "30 days", status: "Created", payment_status: "Pending", expected_delivery: "", notes: "" };
  const openAdd = (type) => { setForm({ ...DEFAULTS, deal_type: type.toLowerCase() }); setShowAdd(true); setDealType(type); };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setCustName(""); setSupplierName(""); setErr(""); };
  
  const save = async () => {
    const isPurchase = form.deal_type === "purchase";
    if (isPurchase && !form.supplier_id && !supplierName) { setErr("Supplier required"); return; }
    if (!isPurchase && !form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0; const price = parseFloat(form.unit_price) || 0; const selProd = inventory.find(i => i.id === form.product_id);
      const payload = clean({ deal_type: form.deal_type, customer_id: form.customer_id || null, customer_name: custName || null, supplier_id: form.supplier_id || null, supplier_name: supplierName || null, product_id: form.product_id || null, product_name: selProd?.product_name || selProd?.name || form.productText || null, quantity: qty || null, unit_price: price || null, total_value: qty * price || null, total_amount: qty * price || null, status: "Created", stage: "Created", payment_status: form.payment_status, payment_terms: form.payment_terms, expected_delivery: form.expected_delivery || null, notes: form.notes || null, });
      if (!payload.product_id) delete payload.product_id; if (!payload.customer_id) delete payload.customer_id; if (!payload.supplier_id) delete payload.supplier_id;
      await api.post("/api/deals", payload); close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.hint || e.message); } setSaving(false);
  };
  
  // FIX 3: Auto-Transfer to Inventory on Purchase Closed
  const updateDealStatus = async (deal, newStatus, extraFields = {}) => { 
    try { 
      await api.put(`/api/deals/${deal.id}`, { status: newStatus, stage: newStatus, ...extraFields }); 
      
      if (newStatus === "Closed" && deal.deal_type === "purchase") {
         const invPayload = {
            product_name: deal.product_name || "Unknown Product",
            category: "Auto-Transfer",
            cost_price: deal.unit_price || 0,
            available_quantity: deal.quantity || 0,
            stock_status: "available",
            supplier_id: deal.supplier_id
         };
         await api.post("/api/inventory", invPayload);
         alert(`✅ ${deal.quantity} units of ${deal.product_name} auto-transferred to Inventory!`);
      }
      fetchAll(); 
    } catch (e) { 
      alert("Update failed: " + (e.response?.data?.error || e.message)); 
    } 
  };

  const markPaid = async (deal) => { 
    await updateDealStatus(deal, "Paid", { payment_status: "Paid" }); 
    setTimeout(() => updateDealStatus(deal, "Closed", { payment_status: "Paid" }), 600); 
  };

  // FIX 4: Download Custom Invoice
  const downloadInvoice = async (deal) => {
    try {
      const { data: comp } = await api.get("/api/company");
      let template = comp?.invoice_template;
      if (!template) {
         alert("No invoice template found! Please upload your HTML file in Settings first.");
         return;
      }

      const replacements = {
        "{{deal_id}}": deal.deal_number || deal.id,
        "{{date}}": new Date().toLocaleDateString(),
        "{{product_name}}": deal.product_name || "N/A",
        "{{quantity}}": deal.quantity || 0,
        "{{unit_price}}": deal.unit_price || 0,
        "{{total_amount}}": deal.total_value || deal.total_amount || 0,
        "{{customer_name}}": deal.customer_name || deal.supplier_name || "N/A",
        "{{company_name}}": comp.name || "Dockside Trade",
      };

      for (const [key, value] of Object.entries(replacements)) {
        template = template.replace(new RegExp(key, 'g'), value);
      }

      const printWin = window.open('', '_blank');
      printWin.document.write(template);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 500);
    } catch(e) {
      alert("Error generating invoice.");
    }
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
          <button 
            key={s} 
            onClick={() => setStageFilter(s)} 
            className={cls(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap border", 
              stageFilter === s ? "bg-gray-900 text-white border-gray-900 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
            )}
          >
            {s} 
            <span className={cls("ml-1.5 px-2 py-0.5 rounded-md", stageFilter === s ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
              {s === "All" ? typeDeals.length : typeDeals.filter(d => (d.status || "").toLowerCase() === s.toLowerCase()).length}
            </span>
          </button>
        ))}
      </div>
      
      {loading ? <Spinner /> : (
        <div className="space-y-4">
          {filtered.map(d => {
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
                    <p className="text-xl font-black text-gray-900 tracking-tight mb-1">{isPurchase ? (d.supplier_name || "Unknown Supplier") : (d.customer_name || "Unknown Customer")}</p>
                    <p className="text-sm font-medium text-gray-600">{d.product_name || "—"} · <strong className="text-gray-900">{d.quantity || 0} units</strong> @ {fmt(d.unit_price)}/unit</p>
                    <div className="mt-4 bg-gray-50/50 rounded-xl p-3 border border-gray-100"><StatusPipeline current={d.status || "Created"} /></div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-3 min-w-[200px]">
                    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Deal Value</p><p className="text-2xl font-black text-gray-900">{fmt(d.total_value || d.total_amount)}</p></div>
                    <p className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{fmtDate(d.created_at)}</p>
                    
                    {/* Buttons Updated for Auto-Transfer and Download Invoice */}
                    <div className="flex flex-col gap-2 mt-auto pt-2 w-full">
                      {d.status === "Created" && <Btn small variant="secondary" onClick={() => updateDealStatus(d, "In Transit")} className="w-full">Mark In Transit</Btn>}
                      {d.status === "In Transit" && <Btn small variant="secondary" onClick={() => updateDealStatus(d, "Delivered")} className="w-full">Mark Delivered</Btn>}
                      {d.status === "Delivered" && (d.payment_status || "Pending") !== "Paid" && <Btn small variant="green" onClick={() => markPaid(d)} className="w-full shadow-green-200">Payment Received → Close</Btn>}
                      
                      {d.status === "Closed" && (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="text-center text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl">
                            ✅ Contract Fulfilled
                          </div>
                          <Btn small variant="secondary" onClick={() => downloadInvoice(d)} className="w-full border-gray-300 text-gray-700 hover:bg-gray-100">
                            🖨️ Download Invoice
                          </Btn>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300"><div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-gray-100 shadow-sm">🤝</div><p className="text-lg font-bold text-gray-800">No {dealType.toLowerCase()} records match your filters</p><Btn variant="secondary" onClick={() => openAdd(dealType)} className="mt-6">Initiate New Deal</Btn></div>}
        </div>
      )}
      
      <SlidePanel title={form.deal_type === "purchase" ? "📥 Draft Purchase Contract" : "📤 Draft Sale Contract"} open={showAdd} onClose={close} wide error={err}>
        <div className="flex gap-3 items-center mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
          <TypeToggle value={form.deal_type === "sale" ? "Sale" : "Purchase"} onChange={t => setForm(p => ({ ...p, deal_type: t.toLowerCase() }))} options={["Sale", "Purchase"]} colors={["bg-blue-600 text-white", "bg-orange-500 text-white"]} />
          <p className="text-xs font-medium text-gray-500 ml-2">{form.deal_type === "purchase" ? "Acquiring material from supplier" : "Liquidating stock to customer"}</p>
        </div>
        
        {form.deal_type === "sale" ? (
          <Field label="Customer Account" required><AutocompleteInput endpoint="/api/autocomplete/customers" placeholder="Search customer database…" value={custName} onChange={v => setCustName(v)} onSelect={c => { setForm(p => ({ ...p, customer_id: c.id })); setCustName(c.name); }} /></Field>
        ) : (
          <Field label="Supplier Account" required><AutocompleteInput endpoint="/api/autocomplete/suppliers" placeholder="Search supplier database…" value={supplierName} onChange={v => setSupplierName(v)} onSelect={s => { setForm(p => ({ ...p, supplier_id: s.id })); setSupplierName(s.name); }} /></Field>
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
        
        <div className="grid grid-cols-2 gap-4 mt-4"><Field label="Contract Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field><Field label={form.deal_type === "purchase" ? "Procurement Rate (₹)" : "Selling Rate (₹)"}><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0.00" /></Field></div>
        
        {form.quantity && form.unit_price && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mt-4 flex items-center justify-between shadow-inner">
            <span className="text-sm font-bold text-green-800 uppercase tracking-wide">Gross {form.deal_type === "purchase" ? "Payable" : "Receivable"} Value</span>
            <span className="text-2xl font-black text-green-700 tracking-tight">{fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mt-4"><Field label="Payment Terms"><Select value={form.payment_terms} onChange={set("payment_terms")}><option>Immediate / Cash</option><option>Advance 50%</option><option>7 Days Credit</option><option>15 Days Credit</option><option>30 Days Credit</option><option>Against Delivery (COD)</option></Select></Field><Field label="Target Delivery Date"><Input type="date" value={form.expected_delivery} onChange={set("expected_delivery")} /></Field></div>
        <div className="mt-4"><Field label="Contract Terms / Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Logistics responsibilities, quality tolerances, specific payment conditions…" /></Field></div>
        <div className="pt-4 flex gap-3 border-t border-gray-100 mt-4"><Btn onClick={save} disabled={saving}>{saving ? "Processing…" : form.deal_type === "purchase" ? "Finalize Purchase Contract" : "Finalize Sale Contract"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ────────────────────────────────────────────────────────────────────
function Transit() {
  const [ships, setShips] = useState([]); const [yards, setYards] = useState([]); const [loading, setLoading] = useState(true); const [transitType, setTransitType] = useState("Outgoing"); const [statusFilter, setStatusFilter] = useState("All"); const [showAdd, setShowAdd] = useState(false); const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [form, setForm] = useState({ vehicle_number: "", driver_name: "", driver_phone: "", origin_yard_id: "", destination: "", dispatch_date: today(), expected_arrival: "", freight_cost: "", status: "Created", cargo_details: "", transit_type: "outgoing" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  
  const fetchAll = useCallback(async () => { 
    setLoading(true); 
    const [a, b] = await Promise.all([api.get("/api/shipments").catch(() => ({ data: [] })), api.get("/api/yards").catch(() => ({ data: [] }))]); 
    setShips(a.data || []); setYards(b.data || []); 
    setLoading(false); 
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  
  const STATUSES = ["All", "Created", "Loaded", "In Transit", "Arrived", "Delivered"];
  const typeShips = ships.filter(s => transitType === "Incoming" ? (s.transit_type === "incoming" || s.shipment_type === "incoming") : (s.transit_type === "outgoing" || s.shipment_type === "outgoing" || !s.transit_type));
  const filtered = statusFilter === "All" ? typeShips : typeShips.filter(s => (s.status || "").toLowerCase() === statusFilter.toLowerCase());
  
  const DEFAULTS = { vehicle_number: "", driver_name: "", driver_phone: "", origin_yard_id: "", destination: "", dispatch_date: today(), expected_arrival: "", freight_cost: "", status: "Created", cargo_details: "", transit_type: "outgoing" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const openAdd = (type) => { setTransitType(type); setForm({ ...DEFAULTS, transit_type: type.toLowerCase() }); setShowAdd(true); };
  
  const save = async () => {
    if (!form.destination) { setErr("Destination required"); return; } setSaving(true); setErr("");
    try {
      const payload = clean({ vehicle_number: form.vehicle_number, driver_name: form.driver_name, driver_phone: form.driver_phone, destination: form.destination, dispatch_date: form.dispatch_date, expected_arrival: form.expected_arrival, freight_cost: parseFloat(form.freight_cost) || 0, status: form.status, cargo_details: form.cargo_details, transit_type: form.transit_type });
      if (form.origin_yard_id) payload.origin_yard_id = form.origin_yard_id;
      await api.post("/api/shipments", payload); 
      close(); fetchAll();
    } catch (e) { setErr(e.response?.data?.error || e.message); } setSaving(false);
  };
  
  const updateStatus = async (id, status) => { try { await api.put(`/api/shipments/${id}`, { status }); fetchAll(); } catch (e) { alert("Failed: " + e.message); } };
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Transit Logs</h1><p className="text-gray-400 text-sm">{ships.length} total shipments tracked</p></div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => openAdd("Incoming")}>+ Incoming</Btn>
          <Btn onClick={() => openAdd("Outgoing")}>+ Outgoing</Btn>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mb-4">
        <TypeToggle value={transitType} onChange={t => { setTransitType(t); setStatusFilter("All"); }} options={["Outgoing", "Incoming"]} colors={["bg-blue-600 text-white shadow-sm", "bg-orange-500 text-white shadow-sm"]} />
      </div>
      
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {STATUSES.map(s => (
          <button 
            key={s} 
            onClick={() => setStatusFilter(s)} 
            className={cls("px-3 py-1.5 rounded-full text-xs font-semibold transition-all", statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          >
            {s}
          </button>
        ))}
      </div>
      
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Shipment #", "Type", "Vehicle", "Driver", "From / To", "Dispatch", "ETA", "Status", "Freight", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.shipment_number || `#${s.id?.toString().slice(-6)}`}</td>
                  <td className="px-4 py-3"><Badge text={(s.transit_type || s.shipment_type) === "incoming" ? "Incoming" : "Outgoing"} color={(s.transit_type || s.shipment_type) === "incoming" ? "orange" : "blue"} /></td>
                  <td className="px-4 py-3 font-semibold">{s.vehicle_number || "—"}</td><td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{yards.find(y => y.id === s.origin_yard_id)?.name || "—"} → {s.destination || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.dispatch_date)}</td><td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.expected_arrival)}</td>
                  <td className="px-4 py-3"><Badge text={s.status || "Created"} /></td><td className="px-4 py-3 font-semibold">{fmt(s.freight_cost)}</td>
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
      
      <SlidePanel title={form.transit_type === "incoming" ? "📥 Incoming Shipment" : "📤 Outgoing Shipment"} open={showAdd} onClose={close} error={err}>
        <TypeToggle value={form.transit_type === "incoming" ? "Incoming" : "Outgoing"} onChange={t => setForm(p => ({ ...p, transit_type: t.toLowerCase() }))} options={["Outgoing", "Incoming"]} colors={["bg-blue-600 text-white shadow-sm", "bg-orange-500 text-white shadow-sm"]} />
        <div className="mt-4"><Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="MH-12-AB-1234" /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="Driver Name"><Input value={form.driver_name} onChange={set("driver_name")} /></Field><Field label="Driver Phone"><Input value={form.driver_phone} onChange={set("driver_phone")} /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label={form.transit_type === "incoming" ? "Arriving at Yard" : "Departing Yard"}><Select value={form.origin_yard_id} onChange={set("origin_yard_id")}><option value="">— Select yard —</option>{yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field><Field label={form.transit_type === "incoming" ? "From (Supplier)" : "Destination"} required><Input value={form.destination} onChange={set("destination")} placeholder="City / Address" /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={set("dispatch_date")} /></Field><Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={set("expected_arrival")} /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="Freight Cost (₹)"><Input type="number" value={form.freight_cost} onChange={set("freight_cost")} placeholder="0" /></Field><Field label="Status"><Select value={form.status} onChange={set("status")}>{["Created", "Loaded", "In Transit", "Arrived", "Delivered"].map(s => <option key={s}>{s}</option>)}</Select></Field></div>
        <div className="mt-4"><Field label="Cargo Details"><Textarea value={form.cargo_details} onChange={set("cargo_details")} placeholder="Material type, quantity, condition…" /></Field></div>
        <div className="pt-4 flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── SUPPLIERS ──────────────────────────────────────────────────────────────────
function Suppliers() {
  const [suppliers, setSuppliers] = useState([]); const [loading, setLoading] = useState(true); const [showAdd, setShowAdd] = useState(false); const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", city: "", country: "India", contact_person: "", phone: "", email: "", gst_number: "", pan_number: "", products_supplied: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const fetchAll = useCallback(async () => { setLoading(true); try { const { data } = await api.get("/api/suppliers"); setSuppliers(data || []); } catch {} setLoading(false); }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  const DEFAULTS = { name: "", city: "", country: "India", contact_person: "", phone: "", email: "", gst_number: "", pan_number: "", products_supplied: "", notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; } setSaving(true); setErr("");
    try { const payload = clean(form); await api.post("/api/suppliers", payload); close(); fetchAll(); } catch (e) { setErr(e.response?.data?.error || e.message); } setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-black text-gray-800">Suppliers</h1></div><Btn onClick={() => setShowAdd(true)}>+ Add Supplier</Btn></div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Supplier", "Location", "GST", "Contact", "Products"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="px-4 py-3"><p className="font-bold text-gray-800">{s.name}</p></td><td className="px-4 py-3 text-gray-500">{s.city}</td><td className="px-4 py-3 font-mono text-xs">{s.gst_number || "—"}</td><td className="px-4 py-3 text-gray-500">{s.phone || s.email || "—"}</td><td className="px-4 py-3 text-gray-500 text-xs">{s.products_supplied || "—"}</td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-300">No suppliers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Supplier" open={showAdd} onClose={close} error={err}>
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="City"><Input value={form.city} onChange={set("city")} /></Field><Field label="Country"><Input value={form.country} onChange={set("country")} /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} className="uppercase" /></Field><Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} className="uppercase" /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field><Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field></div>
        <div className="mt-4"><Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field></div>
        <div className="mt-4"><Field label="Products Supplied"><Input value={form.products_supplied} onChange={set("products_supplied")} placeholder="Teak, Plywood…" /></Field></div>
        <div className="mt-4"><Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field></div>
        <div className="pt-4 flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Supplier"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────────
function Customers() {
  const [customers, setCustomers] = useState([]); const [loading, setLoading] = useState(true); const [showAdd, setShowAdd] = useState(false); const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", city: "", country: "India", phone: "", email: "", gst_number: "", pan_number: "", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const fetchAll = useCallback(async () => { setLoading(true); try { const { data } = await api.get("/api/customers"); setCustomers(data || []); } catch {} setLoading(false); }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  const DEFAULTS = { name: "", city: "", country: "India", phone: "", email: "", gst_number: "", pan_number: "", notes: "" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; } setSaving(true); setErr("");
    try { const payload = clean(form); await api.post("/api/customers", payload); close(); fetchAll(); } catch (e) { setErr(e.response?.data?.error || e.message); } setSaving(false);
  };
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-black text-gray-800">Customers</h1></div><Btn onClick={() => setShowAdd(true)}>+ Add Customer</Btn></div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Customer", "Location", "GST", "Phone", "Email"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-bold">{c.name}</td><td className="px-4 py-3 text-gray-500">{[c.city, c.country].filter(Boolean).join(", ")}</td><td className="px-4 py-3 font-mono text-xs text-gray-500">{c.gst_number || "—"}</td><td className="px-4 py-3 text-gray-500">{c.phone || "—"}</td><td className="px-4 py-3 text-gray-500">{c.email || "—"}</td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-300">No customers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Customer" open={showAdd} onClose={close} error={err}>
        <Field label="Customer Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="City"><Input value={form.city} onChange={set("city")} /></Field><Field label="Country"><Input value={form.country} onChange={set("country")} /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} /></Field><Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field></div>
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field></div>
        <div className="mt-4"><Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field></div>
        <div className="pt-4 flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Customer"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── CLOSED LEDGER ──────────────────────────────────────────────────────────────
function ClosedLedger() {
  const [deals, setDeals] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/api/deals").then(r => { setDeals((r.data || []).filter(d => (d.status || "").toLowerCase() === "closed")); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const totalRevenue = deals.reduce((s, d) => s + (d.total_value || 0), 0);
  return (
    <div className="p-6">
      <div className="mb-4"><h1 className="text-2xl font-black text-gray-800">Closed Ledger</h1><p className="text-gray-400 text-sm">Paid & closed deals</p></div>
      <div className="grid grid-cols-3 gap-4 mb-6"><StatCard label="Closed Deals" value={deals.length} icon="📒" color="teal" /><StatCard label="Total Revenue" value={fmt(totalRevenue)} icon="💰" color="green" /></div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Deal #", "Type", "Party", "Material", "Qty", "Value", "Date Closed"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {deals.map(d => (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number}</td><td className="px-4 py-3"><Badge text={d.deal_type === "purchase" ? "Purchase" : "Sale"} color={d.deal_type === "purchase" ? "orange" : "blue"} /></td>
                  <td className="px-4 py-3 font-semibold">{d.customer_name || d.supplier_name || "—"}</td><td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                  <td className="px-4 py-3">{d.quantity || "—"}</td><td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value)}</td><td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.updated_at)}</td>
                </tr>
              ))}
              {deals.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-300">No closed deals yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── FINANCIALS ─────────────────────────────────────────────────────────────────
function Financials() {
  const [inv, setInv] = useState([]); const [deals, setDeals] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api.get("/api/inventory").catch(() => ({ data: [] })), api.get("/api/deals").catch(() => ({ data: [] }))]).then(([a, b]) => { setInv(a.data || []); setDeals(b.data || []); setLoading(false); }); }, []);
  const totalCost = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = deals.filter(d => ["closed", "completed", "delivered"].includes((d.status || "").toLowerCase())).reduce((s, d) => s + (d.total_value || 0), 0);
  const pendingReceivables = deals.filter(d => d.deal_type !== "purchase" && (d.payment_status || "").toLowerCase() === "pending").reduce((s, d) => s + (d.total_value || 0), 0);
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Financials</h1></div>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={fmt(revenue)} icon="💰" color="green" sub="Closed deals" />
          <StatCard label="Stock Value (Cost)" value={fmt(totalCost)} icon="📦" color="blue" />
          <StatCard label="Receivables" value={fmt(pendingReceivables)} icon="📥" color="orange" sub="Customers owe you" />
        </div>
      )}
    </div>
  );
}

// ── REPORTS ────────────────────────────────────────────────────────────────────
function Reports() {
  const [company, setCompany] = useState({}); const [loading, setLoading] = useState({});
  useEffect(() => { api.get("/api/company").then(r => setCompany(r.data || {})).catch(() => {}); }, []);
  const REPORTS = [ { key: "inventory", label: "Stock Report", icon: "📦" }, { key: "sales", label: "Sales Report", icon: "🤝" }, { key: "shipments", label: "Shipment Report", icon: "🚛" } ];
  const downloadPDF = async (type, label) => {
    setLoading(p => ({ ...p, [type]: true }));
    try {
      const res = await api.get(`/api/${type === "sales" ? "deals" : type === "inventory" ? "inventory" : type}`);
      const data = (res.data || []); const now = new Date().toLocaleDateString("en-IN");
      const html = `<!DOCTYPE html><html><body><h2>${company.name||"Dockside"} - ${label}</h2><p>Generated: ${now}</p><p>Total Records: ${data.length}</p></body></html>`;
      const w = window.open("", "_blank"); if (!w) { alert("Popup blocked"); return; }
      w.document.write(html); w.document.close(); setTimeout(() => w.print(), 900);
    } catch (e) { alert("Report failed"); }
    setLoading(p => ({ ...p, [type]: false }));
  };
  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Reports</h1></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {REPORTS.map(r => (
          <div key={r.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl mb-3">{r.icon}</div><h3 className="font-bold text-gray-800 mb-4">{r.label}</h3><Btn onClick={() => downloadPDF(r.key, r.label)} disabled={loading[r.key]}>{loading[r.key] ? "Generating…" : "Download PDF"}</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COMPANY ────────────────────────────────────────────────────────────────────
function Company() {
  const [company, setCompany] = useState(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", industry: "Timber Trade", city: "", country: "India", address: "", owner_name: "", phone: "", email: "", gst_number: "", pan_number: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const fetchAll = useCallback(async () => { setLoading(true); try { const co = await api.get("/api/company"); setCompany(co.data || {}); if (co.data?.id) setForm(co.data); } catch {} setLoading(false); }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  const save = async () => { setSaving(true); setErr(""); try { if (company?.id) { await api.put(`/api/company/${company.id}`, form); } else { await api.post("/api/company", form); } fetchAll(); alert("✅ Saved!"); } catch (e) { setErr(e.response?.data?.error || e.message); } setSaving(false); };
  if (loading) return <div className="p-6"><Spinner /></div>;
  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Company Settings</h1></div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4 max-w-2xl">
        <Field label="Company Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} className="uppercase" /></Field><Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} className="uppercase" /></Field></div>
        <Field label="Address"><Textarea value={form.address} onChange={set("address")} /></Field>
        <ErrBanner msg={err} /><div className="pt-2"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save Profile"}</Btn></div>
      </div>
    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────────
// FIX 2: Admin HTML Template Upload
function Settings() {
  const [company, setCompany] = useState({});
  const fileInputRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("dockside-user") || "{}");

  useEffect(() => {
    api.get("/api/company").then(r => {
      if (r.data?.id) setCompany(r.data);
    }).catch(() => {});
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const htmlContent = event.target.result;
      try {
        if (company.id) {
          await api.put(`/api/company/${company.id}`, { ...company, invoice_template: htmlContent });
          setCompany({ ...company, invoice_template: htmlContent });
          alert("✅ Custom Invoice Template Uploaded and Saved!");
        } else {
          alert("Please save your Company Profile first in the Company tab.");
        }
      } catch (err) {
        alert("Failed to save template.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>
      
      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 mb-6">
        <h3 className="font-bold text-gray-700">Account</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
            {(user.full_name || user.email || "U")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-800">{user.full_name || "User"}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Invoice Template Upload */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">📄 Custom Invoice Template</h2>
        <p className="text-sm text-gray-500 mb-4">Upload your custom HTML invoice template. Use placeholders like {"{{product_name}}"} inside your HTML.</p>
        
        <div 
          className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-6 text-center hover:bg-blue-100 cursor-pointer transition-colors" 
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".html" style={{ display: "none" }} onChange={handleFileUpload} />
          
          <p className="text-sm font-bold text-blue-700">
            {company?.invoice_template ? "✅ Template Active! Click to replace." : "Click to upload HTML template"}
          </p>
        </div>
      </div>

    </div>
  );
}

// ── APP ROOT AND GLOBAL TOAST LAYER ────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("dockside-user")); } catch { return null; } });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleError = (e) => { setToast(e.detail); setTimeout(() => setToast(null), 6000); };
    window.addEventListener("dockside-error", handleError);
    return () => window.removeEventListener("dockside-error", handleError);
  },[]);

  const signOut = () => { localStorage.removeItem("dockside-token"); localStorage.removeItem("dockside-user"); setUser(null); };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm bg-red-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-slide-in pointer-events-auto border border-red-500">
          <span className="text-xl leading-none mt-0.5">🚨</span>
          <div><p className="font-black text-sm uppercase tracking-wider text-red-100 mb-0.5">System Error</p><p className="text-sm font-medium leading-snug">{toast}</p></div>
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
