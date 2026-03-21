import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb } from "./lib/supabase";
import { deductStockForDeal, restoreStockForDeal, calculateDealProfit } from "./lib/supabase";
import { askGemini } from "./lib/gemini";
import { generateInvoicePDF } from "./components/InvoiceGenerator";
import PDFTemplateUpload from "./components/PDFTemplateUpload";
import QRScanner from "./components/QRScanner";
import {
  useAuth, useRole, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner, StatusDropdown
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

// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
function GlobalSearch({ inventory, deals, customers, onClose, onSelectInventory }) {
  const [q, setQ] = useState("");
  const inputRef  = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = q.trim().length < 2 ? [] : [
    ...inventory.filter(i => (i.product_name||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(i => ({ type:"stock", label: i.product_name, sub: (i.category||"") + " · " + (i.available_quantity||0) + " " + (i.unit||""), id: i.id, data: i })),
    ...deals.filter(d => (d.customer_name||"").toLowerCase().includes(q.toLowerCase()) || (d.deal_number||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(d => ({ type:"deal", label: d.customer_name || d.deal_number, sub: "Deal · " + fmt(d.total_value), id: d.id, data: d })),
    ...customers.filter(c => (c.name||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(c => ({ type:"customer", label: c.name, sub: c.city || "", id: c.id, data: c })),
  ];

  const typeIcon = t => t === "stock" ? "📦" : t === "deal" ? "🤝" : "👥";
  const typeBadge = t => t === "stock" ? "Inventory" : t === "deal" ? "Deal" : "Customer";

  const handleSelect = (item) => {
    if (item.type === "stock") {
      onSelectInventory(item.data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden" onClick={e => e.stopPropagation()}>
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
              <div key={i} onClick={() => handleSelect(r)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
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

// ── AI CHAT ASSISTANT (GEMINI) ────────────────────────────────────────────────
function AIChat({ companyId, onClose }) {
  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hi! I'm your Dockside AI assistant powered by Gemini. Ask me anything about your business — inventory, deals, customers, profits, or insights." }
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
      // Fetch live business data
      const [invR, dealsR, custsR, yardsR] = await Promise.all([
        sb.from("inventory").select("product_name,category,wood_type,available_quantity,unit,cost_price,market_value,deal_status,yard_id").eq("company_id", companyId).limit(100),
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

      const businessContext = {
        summary: {
          totalProducts: inv.length,
          inventoryValue: totalInvValue,
          totalRevenue: totalRevenue,
          pendingPayments: pendingPayment,
          activeDeals: activeDeals,
          totalCustomers: custs.length,
          totalYards: yards.length,
        },
        lowStockItems: lowStock.map(i => ({ product: i.product_name, qty: i.available_quantity, unit: i.unit })),
        topProducts: topProducts.map(i => ({ product: i.product_name, qty: i.available_quantity, unit: i.unit })),
        recentDeals: deals.slice(0, 10).map(d => ({
          customer: d.customer_name,
          product: d.product_name,
          qty: d.quantity,
          value: d.total_value,
          stage: d.stage,
          payment: d.payment_status,
        })),
        yards: yards.map(y => ({ name: y.name, city: y.city })),
      };

      const result = await askGemini(q, businessContext);
      
      setMessages(p => [...p, { 
        role: "assistant", 
        content: result.success ? result.message : result.message 
      }]);
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
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-900 to-blue-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black text-white">AI</div>
            <div>
              <p className="text-white font-bold text-sm">Dockside AI</p>
              <p className="text-blue-300 text-xs">Powered by Gemini</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>

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

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const role = useRole();
  const isAdmin = role !== "worker";
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);
  const DEAD_STOCK_DAYS = 45;

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

  const nowTs = Date.now();
  const deadStock = inv.filter(i => {
    const lastMove = i.last_movement_at || i.date || i.created_at;
    if (!lastMove) return false;
    const daysSince = (nowTs - new Date(lastMove).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > DEAD_STOCK_DAYS && (i.available_quantity || 0) > 0 && (i.deal_status || "Available") !== "Sold";
  });

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="hidden md:block"><h1 className="text-2xl font-black text-gray-800">Command Center</h1><p className="text-gray-400 text-sm">Live business overview</p></div>

        {isAdmin && deadStock.length > 0 && (
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
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Inventory Value" value={fmt(totalValue)} icon="📦" color="blue" />
          <StatCard label="Total Volume" value={`${Math.round(totalVolume)} units`} icon="📊" color="green" />
          <StatCard label="Active Shipments" value={activeShips} icon="🚛" color="orange" />
          <StatCard label="Active Yards" value={activeYards} icon="🏗️" color="purple" />
          <StatCard label="Total Deals" value={deals.length} icon="🤝" color="green" />
          <StatCard label="Total Products" value={inv.length} icon="🪵" color="orange" />
          <StatCard label="Pending Payments" value={pendingPay} icon="⏳" color="purple" />
          <StatCard label="Delivered" value={ships.filter(s => s.status === "Delivered").length} icon="✅" color="blue" />
        </div>

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

// ── INVENTORY WITH DETAIL PANEL ───────────────────────────────────────────────
function Inventory() {
  const { companyId, user } = useAuth();
  const role = useRole();
  const isAdmin = role !== "worker";
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [timberType, setTimberType] = useState("Sawn Timber");
  const [showScanner, setShowScanner] = useState(false);

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
  }, [timberType, form.thickness_mm, form.width_mm, form.length_ft, form.pieces, form.girth_in, form.log_length_ft, form.num_logs, form.sheet_thickness_mm, form.sheet_width_ft, form.sheet_length_ft, form.num_sheets]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        sb.from("inventory").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId).order("name"),
        sb.from("suppliers").select("*").eq("company_id", companyId).order("name"),
        sb.from("deals").select("*").eq("company_id", companyId),
      ]);
      setItems(a.data || []); 
      setYards(b.data || []); 
      setSuppliers(c.data || []);
      setDeals(d.data || []);
    } catch(e) { 
      console.error("Inventory fetch:", e); 
    }
    finally { 
      setLoading(false); 
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeInv = () => { 
    setShowAdd(false); 
    setForm(INV_DEFAULTS); 
    setErr(""); 
    setTimberType("Sawn Timber"); 
  };

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
        deal_status: "Available",
        last_movement_at: new Date().toISOString(),
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
      closeInv(); 
      fetchAll();
    } catch (e) { 
      setErr(e.message || JSON.stringify(e)); 
    }
    finally { 
      setSaving(false); 
    }
  };

  const handleQRScan = (data) => {
    setShowScanner(false);
    if (data.id) {
      const item = items.find(i => i.id === data.id);
      if (item) {
        setSelected(item);
      } else {
        alert("Item not found: " + data.id);
      }
    }
  };

  const downloadItemPDF = async (item) => {
    await generateInvoicePDF({ ...item, type: "inventory" }, companyId, "invoice");
  };

  const filtered = items.filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));
  const totalInvValue = filtered.reduce((s,i) => s + (i.cost_price||0)*(i.available_quantity||0), 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Inventory</h1>
          <p className="text-gray-400 text-sm">{items.length} products · {fmt(totalInvValue)} total value</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowScanner(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-4 py-2.5 rounded-xl border border-gray-200 transition-all flex items-center gap-2">
            📷 Scan QR
          </button>
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="hidden md:block px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Product","Type","Wood / Species","Grade","Yard","Volume","Unit","Deal Status",isAdmin && "Cost/Unit",isAdmin && "Total Value"].filter(Boolean).map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => {
                  const linkedDeal = deals.find(d => d.id === i.linked_deal_id);
                  return (
                    <tr key={i.id}
                      onClick={() => setSelected(i)}
                      className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{i.product_name || "—"}</div>
                        {linkedDeal && (
                          <span className="text-xs text-blue-600 font-mono">
                            → Deal: {linkedDeal.deal_number || linkedDeal.id?.toString().slice(-6)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{i.wood_type || "—"}</td>
                      <td className="px-4 py-3"><Badge text={i.quality_grade || i.grade || "—"} /></td>
                      <td className="px-4 py-3 text-gray-500">{yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{i.available_quantity || 0}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i.unit || "pcs"}</td>
                      <td className="px-4 py-3">
                        <Badge 
                          text={i.deal_status || "Available"} 
                          color={
                            i.deal_status === "Sold" ? "red" :
                            i.deal_status === "Reserved" ? "orange" : "green"
                          } 
                        />
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-4 py-3 font-semibold text-green-700">{fmt(i.cost_price)}</td>
                          <td className="px-4 py-3 font-bold text-blue-700">{fmt((i.cost_price||0)*(i.available_quantity||0))}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 8} className="px-4 py-16 text-center text-gray-300">
                      No inventory found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INVENTORY DETAIL PANEL - INVOICE STYLE */}
      <SlidePanel title="Stock Detail" open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (() => {
          const yardName = yards.find(y => y.id === selected.yard_id)?.name || "—";
          const supplierName = suppliers.find(s => s.id === selected.supplier_id)?.name || "—";
          const linkedDeal = deals.find(d => d.id === selected.linked_deal_id);
          const totalVal = (selected.cost_price||0)*(selected.available_quantity||0);
          const margin = selected.cost_price && selected.market_value
            ? (((selected.market_value - selected.cost_price) / selected.cost_price) * 100).toFixed(1)
            : null;

          return (
            <>
              {/* Header - Invoice Style */}
              <div className="bg-gradient-to-r from-gray-900 to-blue-900 -mx-4 -mt-4 px-4 py-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">⚓</span>
                      <span className="text-white font-black text-sm">DOCKSIDE TRADE OS</span>
                    </div>
                    <p className="text-blue-300 text-xs">Stock Detail Invoice</p>
                  </div>
                  <div className="text-right">
                    <Badge text={selected.deal_status || "Available"} 
                      color={
                        selected.deal_status === "Sold" ? "red" :
                        selected.deal_status === "Reserved" ? "orange" : "green"
                      } 
                    />
                    <p className="text-blue-300 text-xs mt-1">
                      {new Date(selected.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Details */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-black text-gray-900 text-xl mb-3">{selected.product_name}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Category</p>
                    <p className="font-semibold text-gray-800">{selected.category || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Wood Type</p>
                    <p className="font-semibold text-gray-800">{selected.wood_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Grade</p>
                    <p className="font-semibold text-gray-800">{selected.quality_grade || selected.grade || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Yard Location</p>
                    <p className="font-semibold text-gray-800">{yardName}</p>
                  </div>
                </div>
              </div>

              {/* Volume & Pricing */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-xs text-blue-400 mb-1">Volume</p>
                  <p className="font-black text-blue-700 text-xl">{selected.available_quantity || 0}</p>
                  <p className="text-xs text-blue-400">{selected.unit || "pcs"}</p>
                </div>
                {isAdmin && (
                  <>
                    <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                      <p className="text-xs text-green-400 mb-1">Cost/Unit</p>
                      <p className="font-black text-green-700 text-lg">{fmt(selected.cost_price)}</p>
                      <p className="text-xs text-green-400">per {selected.unit}</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                      <p className="text-xs text-purple-400 mb-1">Total Value</p>
                      <p className="font-black text-purple-700 text-lg">{fmt(totalVal)}</p>
                      <p className="text-xs text-purple-400">inventory</p>
                    </div>
                  </>
                )}
              </div>

              {/* Pricing - Admin Only */}
              {isAdmin && (
                <div className="bg-gray-900 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                    💰 Financials (Admin Only)
                  </p>
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
              )}

              {/* Linked Deal */}
              {linkedDeal && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🤝</span>
                    <p className="font-bold text-blue-900 text-sm">Linked Deal</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="text-blue-600 font-semibold">Deal #:</span> {linkedDeal.deal_number || linkedDeal.id?.toString().slice(-6)}</p>
                    <p className="text-sm"><span className="text-blue-600 font-semibold">Customer:</span> {linkedDeal.customer_name || "—"}</p>
                    <p className="text-sm"><span className="text-blue-600 font-semibold">Quantity:</span> {linkedDeal.quantity} {selected.unit}</p>
                    <p className="text-sm"><span className="text-blue-600 font-semibold">Value:</span> {fmt(linkedDeal.total_value)}</p>
                  </div>
                </div>
              )}

              {/* Movement Timeline */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                  📍 Movement Timeline
                </p>
                {[
                  { label: "Created", done: true, date: selected.date || selected.created_at },
                  { label: "In Yard", done: true, date: selected.date },
                  { label: "Reserved", done: selected.deal_status === "Reserved" || selected.deal_status === "Sold", date: selected.deal_status === "Reserved" ? selected.last_movement_at : null },
                  { label: "Dispatched", done: selected.deal_status === "Sold", date: selected.deal_status === "Sold" ? selected.last_movement_at : null },
                  { label: "Delivered", done: false, date: null },
                ].map((step, idx) => (
                  <div key={step.label} className="flex items-start gap-3 mb-2">
                    <div className={cls(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                      step.done ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                    )}>
                      {step.done && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className={cls(
                        "text-sm font-semibold",
                        step.done ? "text-gray-800" : "text-gray-300"
                      )}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-xs text-gray-400">{fmtDate(step.date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Additional Details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Details</p>
                <DetailRow label="Supplier" value={supplierName} />
                <DetailRow label="Added" value={fmtDate(selected.date || selected.created_at)} />
                <DetailRow label="Last Movement" value={fmtDate(selected.last_movement_at)} />
                {selected.thickness_mm && <DetailRow label="Thickness" value={selected.thickness_mm + " mm"} />}
                {selected.width_mm && <DetailRow label="Width" value={selected.width_mm + " mm"} />}
                {selected.length_ft && <DetailRow label="Length" value={selected.length_ft + " ft"} />}
                {selected.pieces && <DetailRow label="Pieces" value={selected.pieces} />}
                {selected.girth_in && <DetailRow label="Girth" value={selected.girth_in + " in"} />}
                {selected.notes && <DetailRow label="Notes" value={selected.notes} />}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Btn onClick={() => downloadItemPDF(selected)}>
                  📥 Download PDF
                </Btn>
                <Btn variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Btn>
              </div>
            </>
          );
        })()}
      </SlidePanel>

      {/* Add Stock Panel */}
      <SlidePanel title="Add Stock" open={showAdd} onClose={closeInv} wide>
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
          <div className="flex gap-2 flex-wrap">
            {["Sawn Timber","Round Log","Plywood","Other"].map(t => (
              <button key={t} onClick={() => setTimberType(t)} className={cls(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                timberType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              )}>{t}</button>
            ))}
          </div>
        </div>

        <Field label="Product Name" required>
          <Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Gurjan Sawn 18mm" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              {["Plywood","Sawn Timber","Round Log","MDF","Block Board","Veneer","Other"].map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Wood / Species">
            <Input value={form.wood_type} onChange={set("wood_type")} placeholder="e.g. Gurjan, Teak" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade">
            <Select value={form.grade} onChange={set("grade")}>
              {["A Grade","B Grade","C Grade","Premium","Economy"].map(g => <option key={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={form.date} onChange={set("date")} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yard">
            <Select value={form.yard_id} onChange={set("yard_id")}>
              <option value="">— Select Yard —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Supplier">
            <Select value={form.supplier_id} onChange={set("supplier_id")}>
              <option value="">— Select Supplier —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>

        {/* Dimension inputs by timber type */}
        {timberType === "Sawn Timber" && (
          <div className="bg-blue-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-blue-600 uppercase">Dimensions (auto-calculates CFT)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Thickness (mm)"><Input type="number" value={form.thickness_mm} onChange={set("thickness_mm")} placeholder="e.g. 25" /></Field>
              <Field label="Width (mm)"><Input type="number" value={form.width_mm} onChange={set("width_mm")} placeholder="e.g. 150" /></Field>
              <Field label="Length (ft)"><Input type="number" value={form.length_ft} onChange={set("length_ft")} placeholder="e.g. 10" /></Field>
              <Field label="No. of Pieces"><Input type="number" value={form.pieces} onChange={set("pieces")} placeholder="e.g. 100" /></Field>
            </div>
          </div>
        )}
        {timberType === "Round Log" && (
          <div className="bg-green-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-green-600 uppercase">Dimensions — Hoppus (auto-calculates CFT)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Girth (inches)"><Input type="number" value={form.girth_in} onChange={set("girth_in")} placeholder="e.g. 48" /></Field>
              <Field label="Length (ft)"><Input type="number" value={form.log_length_ft} onChange={set("log_length_ft")} placeholder="e.g. 12" /></Field>
              <Field label="No. of Logs"><Input type="number" value={form.num_logs} onChange={set("num_logs")} placeholder="e.g. 20" /></Field>
            </div>
          </div>
        )}
        {timberType === "Plywood" && (
          <div className="bg-purple-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-purple-600 uppercase">Dimensions (auto-calculates CBM)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Thickness (mm)"><Input type="number" value={form.sheet_thickness_mm} onChange={set("sheet_thickness_mm")} placeholder="e.g. 18" /></Field>
              <Field label="Width (ft)"><Input type="number" value={form.sheet_width_ft} onChange={set("sheet_width_ft")} placeholder="4" /></Field>
              <Field label="Length (ft)"><Input type="number" value={form.sheet_length_ft} onChange={set("sheet_length_ft")} placeholder="8" /></Field>
              <Field label="No. of Sheets"><Input type="number" value={form.num_sheets} onChange={set("num_sheets")} placeholder="e.g. 200" /></Field>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${form.unit})`}>
            <Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0" />
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={set("unit")}>
              {["CFT","CBM","CBT","Pcs","Sheets","Bundles","MT","KG"].map(u => <option key={u}>{u}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost Price / unit (₹)">
            <Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0" />
          </Field>
          <Field label="Market Value / unit (₹)">
            <Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0" />
          </Field>
        </div>

        {form.cost_price && form.available_quantity && (
          <div className="bg-gray-900 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-400">Total Stock Value</span>
            <span className="font-black text-white">{fmt(parseFloat(form.cost_price) * parseFloat(form.available_quantity))}</span>
          </div>
        )}

        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Any additional details…" /></Field>

        <ErrBanner msg={err} />
        <div className="flex gap-3 pt-2">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add to Inventory"}</Btn>
          <Btn variant="secondary" onClick={closeInv}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}
// ── DEALS WITH STATUS DROPDOWN & PROFIT ───────────────────────────────────────
function Deals() {
  const { companyId } = useAuth();
  const role = useRole();
  const isAdmin = role !== "worker";
  const [deals, setDeals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [custName, setCustName] = useState("");

  const DEAL_DEFAULTS = { customer_id:"", product_id:"", quantity:"", unit_price:"", status:"draft", payment_status:"Pending", notes:"" };
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
      setDeals(a.data || []); 
      setCustomers(b.data || []); 
      setInventory(c.data || []);
    } finally { 
      setLoading(false); 
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateDealStage = async (deal, newStage) => {
    try {
      const prevStage = (deal.stage || deal.status || "draft").toLowerCase();
      const next = newStage.toLowerCase();

      // Auto-deduct stock when moving to Dispatched
      if (next === "dispatched" && prevStage !== "dispatched" && prevStage !== "delivered" && prevStage !== "completed") {
        await deductStockForDeal(deal.id);
      }

      // Restore stock when rolling back from Dispatched
      if (prevStage === "dispatched" && next !== "dispatched" && next !== "delivered" && next !== "completed") {
        await restoreStockForDeal(deal.id);
      }

      // Mark as Reserved when confirmed
      if (next === "confirmed" && prevStage === "draft" && deal.inventory_id) {
        await sb.from("inventory").update({ 
          deal_status: "Reserved", 
          linked_deal_id: deal.id,
          last_movement_at: new Date().toISOString() 
        }).eq("id", deal.inventory_id);
      }

      await sb.from("deals").update({ stage: newStage }).eq("id", deal.id);
      fetchAll();
    } catch (e) { 
      alert("Stage update failed: " + e.message); 
    }
  };

  const updatePaymentStatus = async (deal, newStatus) => {
    try {
      await sb.from("deals").update({ payment_status: newStatus }).eq("id", deal.id);
      fetchAll();
    } catch (e) {
      alert("Payment status update failed: " + e.message);
    }
  };

  const TABS = ["All","Draft","Confirmed","Dispatched","Delivered","Completed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.status||d.stage||"").toLowerCase() === tab.toLowerCase());
  
  const closeDeal = () => { 
    setShowAdd(false); 
    setForm(DEAL_DEFAULTS); 
    setCustName(""); 
    setErr(""); 
  };

  const save = async () => {
    if (!form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unit_price) || 0;
      const selProd = inventory.find(i => i.id === form.product_id);
      const custObj = customers.find(c => c.id === form.customer_id);
      
      const { error } = await sb.from("deals").insert([{
        company_id: companyId, 
        deal_number: "DEAL-" + Date.now(),
        customer_id: form.customer_id || null,
        customer_name: custName || (custObj ? custObj.name : null),
        inventory_id: form.product_id || null,
        product_name: selProd ? selProd.product_name : null,
        quantity: qty, 
        negotiated_price: price, 
        total_value: qty * price,
        payment_status: form.payment_status, 
        stage: form.status, 
        notes: form.notes || null,
      }]);
      
      if (error) throw error;
      closeDeal(); 
      fetchAll();
    } catch (e) { 
      setErr(e.message || String(e)); 
    }
    finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Deals</h1>
          <p className="text-gray-400 text-sm">{deals.length} total</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Create Deal</Btn>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls(
            "px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", 
            tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}>
            {t} ({t === "All" ? deals.length : deals.filter(d=>(d.status||d.stage||"").toLowerCase()===t.toLowerCase()).length})
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Deal #","Customer","Product","Qty","Value","Stage","Payment","Date",isAdmin && "Profit"].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const profitData = isAdmin ? calculateDealProfit(d, inventory) : null;

                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">
                      {d.deal_number || "#" + (d.id||"").toString().slice(-6)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {d.customer_name || (customers.find(c=>c.id===d.customer_id)||{}).name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                    <td className="px-4 py-3">{d.quantity || "—"}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value || d.negotiated_price)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <StatusDropdown
                        currentStatus={d.stage || d.status || "draft"}
                        options={["Draft","Confirmed","Dispatched","Delivered","Completed"]}
                        onSelect={(newStage) => updateDealStage(d, newStage)}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <StatusDropdown
                        currentStatus={d.payment_status || "Pending"}
                        options={["Pending","Partial","Paid"]}
                        onSelect={(newStatus) => updatePaymentStatus(d, newStatus)}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.created_at)}</td>
                    {isAdmin && profitData && (
                      <td className="px-4 py-3">
                        <p className={cls(
                          "font-bold text-sm",
                          profitData.profit > 0 ? "text-green-600" : "text-red-500"
                        )}>
                          {fmt(profitData.profit)}
                        </p>
                        <p className="text-xs text-gray-400">{profitData.margin}%</p>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-16 text-center text-gray-300">
                    No deals found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Create Deal" open={showAdd} onClose={closeDeal}>
        <Field label="Customer Name"><Input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Or Select from Records">
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
          <Field label="Unit Price (Rs)"><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
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
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
          <Field label="Payment Status">
            <Select value={form.payment_status} onChange={set("payment_status")}>
              <option>Pending</option>
              <option>Partial</option>
              <option>Paid</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Creating..." : "Create Deal"}</Btn>
          <Btn variant="secondary" onClick={closeDeal}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT WITH STATUS DROPDOWN ──────────────────────────────────────────────
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
  
  const DEFAULTS = { 
    vehicle_number:"", driver_name:"", driver_phone:"", 
    origin_yard_id:"", destination:"", dispatch_date:today(), 
    expected_arrival:"", freight_cost:"", status:"Created", cargo_details:"" 
  };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        sb.from("shipments").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId),
      ]);
      setShips(a.data || []); 
      setYards(b.data || []);
    } finally { 
      setLoading(false); 
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateShipmentStatus = async (shipment, newStatus) => {
    try {
      await sb.from("shipments").update({ status: newStatus }).eq("id", shipment.id);
      fetchAll();
    } catch (e) {
      alert("Status update failed: " + e.message);
    }
  };

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
      closeTransit(); 
      fetchAll();
    } catch (e) { 
      setErr(e.message); 
    }
    finally { 
      setSaving(false); 
    }
  };

  const statusColor = (s) => { 
    const m = { "delivered":"green","dispatched":"blue","in transit":"blue","loaded":"orange","arrived":"purple" }; 
    return m[(s||"").toLowerCase()] || "gray"; 
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-4">
      <div className="hidden md:flex px-6 pt-6 pb-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Transit</h1>
          <p className="text-gray-400 text-sm">{ships.length} shipments</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl">
          + Add Shipment
        </button>
      </div>
      
      <div className="hidden md:flex gap-2 overflow-x-auto pb-1 px-6 mb-3">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls(
            "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap", 
            tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
          )}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto mx-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Shipment #","Vehicle","Driver","Origin → Dest","Dispatch","ETA","Status","Freight"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(s)}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">
                    {s.shipment_number || `#${s.id?.toString().slice(-6)}`}
                  </td>
                  <td className="px-4 py-3 font-semibold">{s.vehicle_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                  <td className="px-4 py-3">
                    {yards.find(y => y.id === s.origin_yard_id)?.name || "—"} → {s.destination || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">{fmtDate(s.dispatch_date)}</td>
                  <td className="px-4 py-3 text-xs">{fmtDate(s.expected_arrival)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <StatusDropdown
                      currentStatus={s.status || "Created"}
                      options={["Created","Loaded","Dispatched","In Transit","Arrived","Delivered"]}
                      onSelect={(newStatus) => updateShipmentStatus(s, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(s.freight_cost)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-gray-300">No shipments</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            <div className="bg-gray-50 rounded-xl p-4 mt-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Route & Timeline</p>
              <DetailRow label="Origin Yard" value={yards.find(y => y.id === selected.origin_yard_id)?.name} />
              <DetailRow label="Destination" value={selected.destination} />
              <DetailRow label="Dispatch Date" value={fmtDate(selected.dispatch_date)} />
              <DetailRow label="Expected Arrival" value={fmtDate(selected.expected_arrival)} />
            </div>
            {selected.cargo_details && (
              <div className="bg-gray-50 rounded-xl p-4 mt-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Cargo Details</p>
                <p className="text-sm text-gray-700">{selected.cargo_details}</p>
              </div>
            )}
          </>
        )}
      </SlidePanel>

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
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn>
          <Btn variant="secondary" onClick={closeTransit}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// Continue in next message with remaining components (Yards, Suppliers, Customers, Settings, etc.)...

// ── YARDS (Keep existing code - no changes needed) ────────────────────────────
function Yards() {
  const { companyId } = useAuth();
  const [yards, setYards] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const DEFAULTS = { name:"", city:"", address:"", manager_name:"", manager_phone:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        sb.from("yards").select("*").eq("company_id", companyId), 
        sb.from("inventory").select("*").eq("company_id", companyId)
      ]);
      setYards(a.data || []); 
      setInv(b.data || []);
    } finally { 
      setLoading(false); 
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeYard = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  
  const save = async () => {
    if (!form.name) { setErr("Yard name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("yards").insert([{ ...form, company_id: companyId }]);
      if (error) throw error;
      closeYard(); 
      fetchAll();
    } catch (e) { 
      setErr(e.message); 
    }
    finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Yards</h1>
          <p className="text-gray-400 text-sm">{yards.length} locations</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">
          + Add Yard
        </button>
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
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{y.name}</h3>
                    <p className="text-gray-400 text-sm">{y.city}</p>
                  </div>
                  <Badge text={y.is_active !== false ? "Active" : "Inactive"} color={y.is_active !== false ? "green" : "gray"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-blue-400">Products</p>
                    <p className="font-bold text-blue-700">{yInv.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-green-400">Units</p>
                    <p className="font-bold text-green-700">{Math.round(units)}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-purple-400">Value</p>
                    <p className="font-bold text-purple-700 text-xs">{fmt(val)}</p>
                  </div>
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

      <SlidePanel title={selected?.name || "Yard Details"} open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (() => {
          const yInv = inv.filter(i => i.yard_id === selected.id);
          const val = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-400">Products</p>
                  <p className="text-2xl font-black text-blue-700">{yInv.length}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-400">Total Value</p>
                  <p className="text-lg font-black text-green-700">{fmt(val)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-purple-400">Status</p>
                  <p className="text-sm font-black text-purple-700 mt-1">{selected.is_active !== false ? "Active" : "Inactive"}</p>
                </div>
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
                <div className="mt-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Inventory at this Yard</p>
                  <div className="space-y-2">
                    {yInv.map(i => (
                      <div key={i.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{i.product_name}</p>
                          <p className="text-xs text-gray-400">{i.category} · {i.wood_type || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-700 text-sm">{i.available_quantity} {i.unit}</p>
                          <p className="text-xs text-gray-400">{fmt(i.cost_price)}/unit</p>
                        </div>
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
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Yard"}</Btn>
          <Btn variant="secondary" onClick={closeYard}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────
function Suppliers() {
  const { companyId } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const DEFAULTS = { name:"", city:"", country:"India", contact_person:"", phone:"", email:"", gst_number:"", products_supplied:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sb.from("suppliers").select("*").eq("company_id", companyId).order("name");
      setSuppliers(data || []);
    } finally { setLoading(false); }
  }, [companyId]);
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

  const filtered = suppliers.filter(s => !search || (s.name||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Suppliers</h1>
          <p className="text-gray-400 text-sm">{suppliers.length} suppliers</p>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Supplier</Btn>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Name","Location","Contact","Phone","GST","Products"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(s)}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.contact_person || "—"}</td>
                    <td className="px-4 py-3">{s.phone ? <a href={"tel:"+s.phone} className="text-blue-600 hover:underline" onClick={e=>e.stopPropagation()}>{s.phone}</a> : "—"}</td>
                    <td className="px-4 py-3">{s.gst_number ? <Badge text="GST ✓" color="green" /> : <span className="text-gray-300 text-xs">—</span>}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{s.products_supplied || "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-300">No suppliers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <SlidePanel title="Supplier Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-xl font-black text-blue-600">{(selected.name||"S")[0].toUpperCase()}</div>
              <div>
                <p className="font-black text-gray-800 text-lg">{selected.name}</p>
                <p className="text-sm text-gray-400">{[selected.city, selected.country].filter(Boolean).join(", ")}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <DetailRow label="Contact Person" value={selected.contact_person} />
              <DetailRow label="Phone" value={selected.phone} />
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="GST No." value={selected.gst_number} />
              <DetailRow label="Products Supplied" value={selected.products_supplied} />
              <DetailRow label="Notes" value={selected.notes} />
            </div>
            {selected.phone && (
              <a href={"tel:"+selected.phone} className="mt-3 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">
                📞 Call Supplier
              </a>
            )}
          </>
        )}
      </SlidePanel>
      <SlidePanel title="Add Supplier" open={showAdd} onClose={close}>
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} placeholder="Company or trader name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} placeholder="e.g. Myanmar" /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="Products Supplied"><Textarea value={form.products_supplied} onChange={set("products_supplied")} placeholder="e.g. Teak logs, Gurjan sawn timber" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Add Supplier"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── CUSTOMERS ────────────────────────────────────────────────────────────────
function Customers() {
  const { companyId } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const DEFAULTS = { name:"", city:"", contact_person:"", phone:"", email:"", gst_number:"", credit_limit:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sb.from("customers").select("*").eq("company_id", companyId).order("name");
      setCustomers(data || []);
    } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("customers").insert([{
        ...form, company_id: companyId,
        credit_limit: parseNum(form.credit_limit) || 0,
      }]);
      if (error) throw error;
      close(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const sendWhatsApp = (c) => {
    const msg = "Namaste " + c.name + "\n\nHope you are doing well! Contact us for your timber requirements.\n\nDockside Trade OS";
    window.open("https://wa.me/" + (c.phone||"") + "?text=" + encodeURIComponent(msg), "_blank");
  };

  const filtered = customers.filter(c => !search || (c.name||"").toLowerCase().includes(search.toLowerCase()) || (c.city||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Customers</h1>
          <p className="text-gray-400 text-sm">{customers.length} customers</p>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Customer</Btn>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Customer","City","Contact","Phone","Credit Limit","GST","Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.city || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.contact_person || "—"}</td>
                    <td className="px-4 py-3">{c.phone ? <a href={"tel:"+c.phone} className="text-blue-600 hover:underline" onClick={e=>e.stopPropagation()}>{c.phone}</a> : "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.credit_limit > 0 ? fmt(c.credit_limit) : "—"}</td>
                    <td className="px-4 py-3">{c.gst_number ? <Badge text="GST ✓" color="green" /> : <span className="text-gray-300 text-xs">—</span>}</td>
                    <td className="px-4 py-3 flex gap-2" onClick={e=>e.stopPropagation()}>
                      {c.phone && (
                        <button onClick={() => sendWhatsApp(c)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg font-semibold hover:bg-green-100">WhatsApp</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-300">No customers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <SlidePanel title="Customer Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-black text-blue-700">{(selected.name||"C")[0].toUpperCase()}</div>
              <div>
                <p className="font-black text-gray-800 text-lg">{selected.name}</p>
                <p className="text-sm text-gray-400">{selected.city || ""}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <DetailRow label="Contact Person" value={selected.contact_person} />
              <DetailRow label="Phone" value={selected.phone} />
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="GST No." value={selected.gst_number} />
              <DetailRow label="Credit Limit" value={selected.credit_limit > 0 ? fmt(selected.credit_limit) : "Not set"} />
              <DetailRow label="Notes" value={selected.notes} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {selected.phone && (
                <a href={"tel:"+selected.phone} className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">📞 Call</a>
              )}
              <button onClick={() => sendWhatsApp(selected)} className="flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 rounded-xl text-sm">WhatsApp</button>
            </div>
          </>
        )}
      </SlidePanel>
      <SlidePanel title="Add Customer" open={showAdd} onClose={close}>
        <Field label="Customer Name" required><Input value={form.name} onChange={set("name")} placeholder="Company or person name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} placeholder="e.g. Ahmedabad" /></Field>
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} /></Field>
          <Field label="Credit Limit (Rs)"><Input type="number" value={form.credit_limit} onChange={set("credit_limit")} placeholder="0 = no limit" /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Add Customer"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── FINANCIALS ───────────────────────────────────────────────────────────────
function Financials() {
  const { companyId } = useAuth();
  const [deals, setDeals] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      sb.from("inventory").select("*").eq("company_id", companyId),
    ]).then(([a, b]) => {
      setDeals(a.data || []);
      setInventory(b.data || []);
      setLoading(false);
    });
  }, [companyId]);

  const totalRevenue = deals.filter(d => d.payment_status === "Paid").reduce((s, d) => s + (d.total_value || 0), 0);
  const pendingRevenue = deals.filter(d => d.payment_status === "Pending").reduce((s, d) => s + (d.total_value || 0), 0);
  const partialRevenue = deals.filter(d => d.payment_status === "Partial").reduce((s, d) => s + (d.total_value || 0), 0);
  const inventoryValue = inventory.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const totalDealValue = deals.reduce((s, d) => s + (d.total_value || 0), 0);

  const profitDeals = deals.map(d => {
    const p = calculateDealProfit(d, inventory);
    return { ...d, profit: p.profit, margin: p.margin };
  });
  const totalProfit = profitDeals.reduce((s, d) => s + (d.profit || 0), 0);

  const pendingDeals = deals.filter(d => d.payment_status === "Pending" || d.payment_status === "Partial");
  const paidDeals = deals.filter(d => d.payment_status === "Paid");

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-black text-gray-800">Financials</h1>
        <p className="text-gray-400 text-sm">Revenue, payments & profit overview</p>
      </div>

      <div className="px-6 mb-4 flex gap-2">
        {[["overview","Overview"],["pending","Pending Payments"],["history","Deal History"]].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} className={cls(
            "px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
            tab === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="px-6 space-y-4">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Revenue (Paid)" value={fmt(totalRevenue)} icon="✅" color="green" />
                <StatCard label="Pending Payments" value={fmt(pendingRevenue)} icon="⏳" color="orange" />
                <StatCard label="Inventory Value" value={fmt(inventoryValue)} icon="📦" color="blue" />
                <StatCard label="Gross Profit" value={fmt(totalProfit)} icon="💰" color="purple" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">Payment Breakdown</p>
                  {[
                    { label: "Paid", value: totalRevenue, count: paidDeals.length, color: "bg-green-500" },
                    { label: "Pending", value: pendingRevenue, count: pendingDeals.filter(d=>d.payment_status==="Pending").length, color: "bg-orange-400" },
                    { label: "Partial", value: partialRevenue, count: pendingDeals.filter(d=>d.payment_status==="Partial").length, color: "bg-yellow-400" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 mb-3">
                      <div className={cls("w-2.5 h-2.5 rounded-full", item.color)} />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                          <span className="text-sm font-bold text-gray-800">{fmt(item.value)}</span>
                        </div>
                        <p className="text-xs text-gray-400">{item.count} deals</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">Financial Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-500">Total Deal Value</span><span className="font-bold">{fmt(totalDealValue)}</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-500">Collected (Paid)</span><span className="font-bold text-green-700">{fmt(totalRevenue)}</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-500">Outstanding</span><span className="font-bold text-orange-600">{fmt(pendingRevenue + partialRevenue)}</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-500">Inventory at Cost</span><span className="font-bold text-blue-700">{fmt(inventoryValue)}</span></div>
                    <div className="flex justify-between py-2 pt-3"><span className="text-sm font-bold text-gray-700">Estimated Profit</span><span className={cls("font-black text-lg", totalProfit >= 0 ? "text-green-700" : "text-red-600")}>{fmt(totalProfit)}</span></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "pending" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Deal #","Customer","Product","Amount","Status","Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingDeals.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-green-400 font-semibold">🎉 All payments collected!</td></tr>
                  ) : pendingDeals.map(d => (
                    <tr key={d.id} className="border-b border-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || "#"+String(d.id).slice(-6)}</td>
                      <td className="px-4 py-3 font-semibold">{d.customer_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                      <td className="px-4 py-3 font-bold text-orange-600">{fmt(d.total_value)}</td>
                      <td className="px-4 py-3"><Badge text={d.payment_status} color={d.payment_status === "Partial" ? "orange" : "red"} /></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "history" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Deal #","Customer","Value","Profit","Margin","Payment","Stage","Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitDeals.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || "#"+String(d.id).slice(-6)}</td>
                      <td className="px-4 py-3 font-semibold">{d.customer_name || "—"}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value)}</td>
                      <td className="px-4 py-3"><span className={cls("font-bold", (d.profit||0) >= 0 ? "text-green-600" : "text-red-500")}>{fmt(d.profit)}</span></td>
                      <td className="px-4 py-3 text-gray-500">{d.margin}%</td>
                      <td className="px-4 py-3"><Badge text={d.payment_status || "Pending"} color={d.payment_status === "Paid" ? "green" : d.payment_status === "Partial" ? "orange" : "red"} /></td>
                      <td className="px-4 py-3"><Badge text={d.stage || d.status || "Draft"} color="blue" /></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                  {deals.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No deals yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI INSIGHTS ───────────────────────────────────────────────────────────────
function AIInsights() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-96 text-center">
      <div className="text-5xl mb-4">🤖</div>
      <h2 className="text-xl font-black text-gray-800 mb-2">AI Insights</h2>
      <p className="text-gray-400 text-sm mb-6">Use the floating AI button (bottom right) to ask Gemini anything about your business.</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {["Which stock is not moving?","Show pending payments","Top customers this month","What should I price teak?"].map(q => (
          <span key={q} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold">{q}</span>
        ))}
      </div>
    </div>
  );
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function Reports() {
  const { companyId } = useAuth();
  const [data, setData] = useState({ inventory:[], deals:[], customers:[], suppliers:[], shipments:[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      sb.from("inventory").select("*").eq("company_id", companyId),
      sb.from("deals").select("*").eq("company_id", companyId),
      sb.from("customers").select("*").eq("company_id", companyId),
      sb.from("suppliers").select("*").eq("company_id", companyId),
      sb.from("shipments").select("*").eq("company_id", companyId),
    ]).then(([a,b,c,d,e]) => {
      setData({ inventory:a.data||[], deals:b.data||[], customers:c.data||[], suppliers:d.data||[], shipments:e.data||[] });
      setLoading(false);
    });
  }, [companyId]);

  if (loading) return <Spinner />;

  const { inventory, deals, customers, suppliers, shipments } = data;

  const invValue = inventory.reduce((s,i) => s+(i.cost_price||0)*(i.available_quantity||0), 0);
  const dealRevenue = deals.filter(d=>d.payment_status==="Paid").reduce((s,d) => s+(d.total_value||0), 0);
  const pendingAmt = deals.filter(d=>d.payment_status!=="Paid").reduce((s,d) => s+(d.total_value||0), 0);
  const profitDeals = deals.map(d => ({ ...d, ...calculateDealProfit(d, inventory) }));
  const totalProfit = profitDeals.reduce((s,d) => s+(d.profit||0), 0);

  const catMap = {};
  inventory.forEach(i => {
    const c = i.category || "Other";
    catMap[c] = (catMap[c] || { count:0, value:0, qty:0 });
    catMap[c].count++;
    catMap[c].value += (i.cost_price||0)*(i.available_quantity||0);
    catMap[c].qty += (i.available_quantity||0);
  });

  const custDealMap = {};
  deals.forEach(d => {
    const name = d.customer_name || "Unknown";
    custDealMap[name] = (custDealMap[name]||0) + (d.total_value||0);
  });
  const topCustomers = Object.entries(custDealMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const exportCSV = (rows, headers, filename) => {
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h]||"")).join(","))].join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = filename; a.click();
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Reports</h1>
          <p className="text-gray-400 text-sm">Business intelligence & exports</p>
        </div>
      </div>
      <div className="px-6 space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Inventory Value" value={fmt(invValue)} icon="📦" color="blue" />
          <StatCard label="Revenue Collected" value={fmt(dealRevenue)} icon="✅" color="green" />
          <StatCard label="Pending Amount" value={fmt(pendingAmt)} icon="⏳" color="orange" />
          <StatCard label="Est. Profit" value={fmt(totalProfit)} icon="💰" color="purple" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory by Category */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Inventory by Category</h3>
              <button onClick={() => exportCSV(inventory, ["product_name","category","wood_type","available_quantity","unit","cost_price"], "inventory_report.csv")}
                className="text-xs text-blue-600 hover:underline font-semibold">Export CSV</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr>{["Category","Items","Qty","Value"].map(h=><th key={h} className="text-left py-2 text-xs font-bold text-gray-400 uppercase">{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(catMap).map(([cat, v]) => (
                  <tr key={cat} className="border-t border-gray-50">
                    <td className="py-2 font-semibold text-gray-700">{cat}</td>
                    <td className="py-2 text-gray-500">{v.count}</td>
                    <td className="py-2 text-gray-500">{Math.round(v.qty)}</td>
                    <td className="py-2 font-bold text-blue-700">{fmt(v.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Top Customers by Value</h3>
              <button onClick={() => exportCSV(customers, ["name","city","phone","email","gst_number"], "customers_report.csv")}
                className="text-xs text-blue-600 hover:underline font-semibold">Export CSV</button>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-center text-gray-300 py-8">No deals yet</p>
            ) : topCustomers.map(([name, val], i) => (
              <div key={name} className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600">{i+1}</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{name}</p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-1.5 bg-blue-500 rounded-full" style={{width: Math.round((val/topCustomers[0][1])*100)+"%"}} /></div>
                </div>
                <span className="font-bold text-gray-700 text-sm">{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deals Report */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Deals Report</h3>
            <button onClick={() => exportCSV(deals, ["deal_number","customer_name","product_name","quantity","total_value","stage","payment_status","created_at"], "deals_report.csv")}
              className="text-xs text-blue-600 hover:underline font-semibold">Export CSV</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[["Total Deals", deals.length, "gray"],["Draft", deals.filter(d=>(d.stage||d.status||"").toLowerCase()==="draft").length, "gray"],
              ["Active", deals.filter(d=>!["completed","delivered"].includes((d.stage||d.status||"").toLowerCase())).length, "blue"],
              ["Completed", deals.filter(d=>["completed","delivered"].includes((d.stage||d.status||"").toLowerCase())).length, "green"],
              ["Paid", deals.filter(d=>d.payment_status==="Paid").length, "green"]
            ].map(([label, count, color]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-gray-800">{count}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COMPANY ───────────────────────────────────────────────────────────────────
function Company() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState({
    name:"", industry:"Timber Trade", city:"", country:"India", address:"",
    owner_name:"", phone:"", email:"", website:"",
    gst_number:"", pan_number:"", iec_number:"",
    bank_name:"", bank_account:"", bank_ifsc:"", bank_branch:"", notes:""
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sb.from("company").select("*").limit(1).single();
      if (data) { setCompany(data); setForm(f => ({ ...f, ...data })); }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      let error;
      if (company?.id) {
        const r = await sb.from("company").update(form).eq("id", company.id);
        error = r.error;
      } else {
        const r = await sb.from("company").insert([form]);
        error = r.error;
      }
      if (error) throw error;
      alert("Company profile saved!");
      fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  const TABS = [["profile","🏢 Profile"],["legal","⚖️ Legal"],["bank","🏦 Bank"]];

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Company</h1>
          <p className="text-gray-400 text-sm">Business profile & compliance details</p>
        </div>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Btn>
      </div>
      <div className="px-6">
        <div className="flex gap-2 mb-5 border-b border-gray-200">
          {TABS.map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={cls(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-all",
              tab === v ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}>{l}</button>
          ))}
        </div>

        <div className="max-w-2xl">
          {tab === "profile" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <Field label="Company Name"><Input value={form.name} onChange={set("name")} placeholder="Your company name" /></Field>
              <Field label="Industry"><Input value={form.industry} onChange={set("industry")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City"><Input value={form.city} onChange={set("city")} placeholder="Gandhidham" /></Field>
                <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
              </div>
              <Field label="Address"><Textarea value={form.address} onChange={set("address")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner Name"><Input value={form.owner_name} onChange={set("owner_name")} /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
                <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
              </div>
            </div>
          )}
          {tab === "legal" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                These details are used in invoices and E-Way Bills
              </div>
              <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="22AAAAA0000A1Z5" /></Field>
              <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} placeholder="AAAAA0000A" /></Field>
              <Field label="IEC Number"><Input value={form.iec_number} onChange={set("iec_number")} placeholder="Import Export Code" /></Field>
            </div>
          )}
          {tab === "bank" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <Field label="Bank Name"><Input value={form.bank_name} onChange={set("bank_name")} placeholder="State Bank of India" /></Field>
              <Field label="Account Number"><Input value={form.bank_account} onChange={set("bank_account")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="IFSC Code"><Input value={form.bank_ifsc} onChange={set("bank_ifsc")} placeholder="SBIN0000001" /></Field>
                <Field label="Branch"><Input value={form.bank_branch} onChange={set("bank_branch")} /></Field>
              </div>
            </div>
          )}
          <ErrBanner msg={err} />
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS WITH PDF TEMPLATE UPLOAD ─────────────────────────────────────────
function Settings() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { id: "account", label: "Account", icon: "👤" },
          { id: "templates", label: "PDF Templates", icon: "📄" },
          { id: "preferences", label: "Preferences", icon: "⚙️" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cls(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-all",
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-700">Account Information</h3>
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
            💡 To update company details (GST, PAN, IEC), go to the <strong>Company</strong> section.
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <PDFTemplateUpload companyId={companyId} user={user} />
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-700 mb-4">System Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800 text-sm">Dead Stock Alert Threshold</p>
                <p className="text-xs text-gray-400">Alert when stock has no movement for X days</p>
              </div>
              <input
                type="number"
                defaultValue={45}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800 text-sm">Low Stock Alert</p>
                <p className="text-xs text-gray-400">Notify when quantity falls below</p>
              </div>
              <input
                type="number"
                defaultValue={10}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800 text-sm">Auto-deduct Stock on Dispatch</p>
                <p className="text-xs text-gray-400">Automatically reduce inventory when deal is dispatched</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Btn>Save Preferences</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DESKTOP APP SHELL ──────────────────────────────────────────────────────────
export default function DesktopApp({ user, companyId, role, onSignOut }) {
  const isAdmin = role !== "worker";
  const [showSearch, setShowSearch] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [searchData, setSearchData] = useState({ inventory:[], deals:[], customers:[] });
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
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
      {showAI && <AIChat companyId={companyId} onClose={() => setShowAI(false)} />}

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
          onSelectInventory={(item) => setSelectedInventoryItem(item)}
        />
      )}

      <div className="flex min-h-screen bg-gray-50">
        <Sidebar onSignOut={onSignOut} role={role} />
        <div className="flex-1 ml-52 min-h-screen">
          <Routes>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transit" element={<Transit />} />
            <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to="/inventory" />} />
            <Route path="/yards" element={isAdmin ? <Yards /> : <Navigate to="/inventory" />} />
            <Route path="/deals" element={isAdmin ? <Deals /> : <Navigate to="/inventory" />} />
            <Route path="/suppliers" element={isAdmin ? <Suppliers /> : <Navigate to="/inventory" />} />
            <Route path="/customers" element={isAdmin ? <Customers /> : <Navigate to="/inventory" />} />
            <Route path="/financials" element={isAdmin ? <Financials /> : <Navigate to="/inventory" />} />
            <Route path="/ai-insights" element={isAdmin ? <AIInsights /> : <Navigate to="/inventory" />} />
            <Route path="/reports" element={isAdmin ? <Reports /> : <Navigate to="/inventory" />} />
            <Route path="/company" element={isAdmin ? <Company /> : <Navigate to="/inventory" />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to={isAdmin ? "/" : "/inventory"} />} />
          </Routes>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}