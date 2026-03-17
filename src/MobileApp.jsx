import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signOut, db } from "./lib/supabase";
import {
  useAuth, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner
} from "./shared";

// ── MOBILE NAVIGATION ──────────────────────────────────────────────────────────
const MOBILE_NAV = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/inventory", label: "Stock", icon: "📦" },
  { to: "/deals", label: "Deals", icon: "🤝" },
  { to: "/transit", label: "Transit", icon: "🚛" },
  { to: "/ai-insights", label: "Insights", icon: "📊" },
];

const MobileNav = ({ onSignOut }) => {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [calcOpen, setCalcOpen]   = useState(false);
  const [calcType, setCalcType]   = useState("Sawn");
  const [cf, setCF] = useState({ thick:"", width:"", len:"", pcs:"", girth:"", logLen:"", logs:"" });
  const sc = k => e => setCF(p => ({...p, [k]: e.target.value}));

  const calcResult = calcType === "Sawn"
    ? TM.sawnCFT(+cf.thick, +cf.width, +cf.len, +cf.pcs || 1)
    : TM.hoppusCFT(+cf.girth, +cf.logLen, +cf.logs || 1);

  return (
    <>
      {/* TOP BAR */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 shadow-lg"
        style={{background:"linear-gradient(135deg,#0f172a,#1e3a5f)"}}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black text-white">⚓</div>
          <span className="font-black text-base text-white tracking-tight">Dockside</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setCalcOpen(p => !p); setMenuOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white text-base">
            🧮
          </button>
          <button onClick={() => { setMenuOpen(p => !p); setCalcOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white">
            ☰
          </button>
        </div>
      </div>

      {/* QUICK CALC DROPDOWN */}
      {calcOpen && (
        <div className="fixed top-14 left-0 right-0 z-50 bg-white shadow-2xl border-b-2 border-blue-100 px-4 py-4 animate-slideDown max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <p className="font-black text-gray-900">🧮 Quick Calculator</p>
            <button onClick={() => setCalcOpen(false)} className="text-gray-400 text-xl font-bold w-8 h-8 flex items-center justify-center">×</button>
          </div>
          <div className="flex gap-2 mb-3">
            {["Sawn","Log"].map(t => (
              <button key={t} onClick={() => setCalcType(t)}
                className={cls("flex-1 py-2 rounded-xl text-sm font-bold",
                  calcType === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600")}>
                {t === "Sawn" ? "📐 Sawn" : "🪵 Log"}
              </button>
            ))}
          </div>
          {calcType === "Sawn" ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Thick (mm)</p><Input type="number" value={cf.thick} onChange={sc("thick")} placeholder="25" /></div>
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Width (mm)</p><Input type="number" value={cf.width} onChange={sc("width")} placeholder="150" /></div>
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Len (ft)</p><Input type="number" value={cf.len} onChange={sc("len")} placeholder="8" /></div>
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Pcs</p><Input type="number" value={cf.pcs} onChange={sc("pcs")} placeholder="100" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Girth (in)</p><Input type="number" value={cf.girth} onChange={sc("girth")} placeholder="36" /></div>
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Len (ft)</p><Input type="number" value={cf.logLen} onChange={sc("logLen")} placeholder="12" /></div>
              <div><p className="text-[10px] text-gray-400 mb-1 uppercase">Logs</p><Input type="number" value={cf.logs} onChange={sc("logs")} placeholder="20" /></div>
            </div>
          )}
          {calcResult ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
                <p className="text-[10px] text-gray-400">Unit</p>
                <p className="font-black text-gray-800 text-sm">{calcResult.cftPer}</p>
              </div>
              <div className="bg-blue-600 rounded-xl p-2 text-center">
                <p className="text-[10px] text-blue-200">Total CFT</p>
                <p className="font-black text-white text-lg">{calcResult.totalCFT}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2 text-center border border-green-100">
                <p className="text-[10px] text-green-500">CBM</p>
                <p className="font-black text-green-700 text-sm">{calcResult.totalCBM}</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3 text-center text-gray-400 text-xs border border-gray-100">
              Enter dimensions...
            </div>
          )}
        </div>
      )}

      {/* MENU DRAWER */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-64 bg-gray-900 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <span className="text-white font-black">⚓ Dockside</span>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {MOBILE_NAV.map(n => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => cls(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold mb-1",
                    isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
                  )}>
                  <span>{n.icon}</span>{n.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-700">
              <button onClick={onSignOut} className="w-full flex items-center gap-2 text-gray-400 text-sm">
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* BOTTOM NAV BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg"
        style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div className="flex h-16">
          {MOBILE_NAV.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.to === "/"}
              className={({ isActive }) => cls(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold",
                isActive ? "text-blue-600" : "text-gray-400"
              )}>
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
};

// ── FIXED DEAL CARD ────────────────────────────────────────────────────────────
function SwipeDealCard({ deal: d, customers }) {
  const sendWhatsApp = () => {
    const name = d.customer_name || customers.find(c => c.id === d.customer_id)?.name || "Customer";
    const total = (d.total_value || d.negotiated_price || 0).toLocaleString("en-IN");
    const msg = `Namaste *${name}* 🙏\n\nDeal Confirmation:\n📦 Product: ${d.product_name || "—"}\n💰 Total: *₹${total}*\nDockside OS`;
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  const stageColor = s => {
    const m = { completed:"green", delivered:"green", dispatched:"blue", confirmed:"blue" };
    return m[(s||"").toLowerCase()] || "gray";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
      <div className="px-4 pt-4 pb-3">
        <div className="flex justify-between items-start gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <p className="font-black text-gray-900 text-sm truncate">
              {d.customer_name || customers.find(c => c.id === d.customer_id)?.name || "Customer"}
            </p>
            <p className="text-[10px] text-gray-400 font-mono">#{d.id?.toString().slice(-6)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-black text-green-700 text-base">{fmt(d.total_value || d.negotiated_price)}</p>
            <p className="text-[10px] text-gray-400">{fmtDate(d.created_at)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 truncate mb-2">
          {d.product_name || "—"} {d.quantity ? `· ${d.quantity} units` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge text={d.stage || d.status || "draft"} color={stageColor(d.stage || d.status)} />
          <Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} />
        </div>
      </div>
      <button onClick={sendWhatsApp}
        className="w-full bg-green-500 active:bg-green-600 flex items-center justify-center gap-2 py-2.5 transition-colors">
        <span className="text-white text-sm font-bold">💬 WhatsApp Share</span>
      </button>
    </div>
  );
}

// ── FIXED TRANSIT CARD ────────────────────────────────────────────────────────
function TransitCard({ s, yards, onSelect }) {
  const statusColor = s => { 
    const m = { "delivered":"green","dispatched":"blue","in transit":"blue","loaded":"orange","arrived":"purple" }; 
    return m[(s||"").toLowerCase()] || "gray"; 
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
      <div className="px-4 pt-4 pb-3" onClick={() => onSelect(s)}>
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-black text-gray-900 text-sm truncate">{s.vehicle_number || "No Vehicle"}</p>
            <p className="text-[10px] text-gray-400 font-mono truncate">{s.shipment_number}</p>
          </div>
          <Badge text={s.status || "—"} color={statusColor(s.status)} className="shrink-0" />
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
          <span className="text-gray-500 truncate max-w-[80px]">{yards.find(y => y.id === s.origin_yard_id)?.name || "Origin"}</span>
          <span className="text-blue-500 font-black">→</span>
          <span className="font-bold text-gray-800 truncate max-w-[100px]">{s.destination || "Target"}</span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 truncate pr-2">👤 {s.driver_name || "No Driver"}</span>
          <span className="font-black text-gray-900 shrink-0">{fmt(s.freight_cost)}</span>
        </div>
      </div>
      {s.driver_phone && (
        <a href={`tel:${s.driver_phone}`} className="flex items-center justify-center gap-2 bg-blue-50 py-2.5 border-t border-blue-100">
          <span className="text-blue-700 font-bold text-xs">📞 Call Driver</span>
        </a>
      )}
    </div>
  );
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const [data, setData] = useState({ inv: [], deals: [], ships: [], yards: [] });

  useEffect(() => {
    if (!companyId) return;
    const fetchData = async () => {
      const [i, d, s, y] = await Promise.all([
        sb.from("inventory").select("*").eq("company_id", companyId),
        sb.from("deals").select("*").eq("company_id", companyId),
        sb.from("shipments").select("*").eq("company_id", companyId),
        sb.from("yards").select("*").eq("company_id", companyId)
      ]);
      setData({ inv: i.data||[], deals: d.data||[], ships: s.data||[], yards: y.data||[] });
    };
    fetchData();
  }, [companyId]);

  const totalValue = data.inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);

  return (
    <div className="px-4 pb-20 pt-4 space-y-4">
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e40af] rounded-2xl p-5 text-white shadow-lg">
        <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Portfolio Value</p>
        <p className="text-3xl font-black">{fmt(totalValue)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-2xl mb-1">📦</p>
          <p className="text-xs text-gray-400 uppercase font-bold">Stock</p>
          <p className="text-lg font-black text-gray-900">{data.inv.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-2xl mb-1">🤝</p>
          <p className="text-xs text-gray-400 uppercase font-bold">Deals</p>
          <p className="text-lg font-black text-gray-900">{data.deals.length}</p>
        </div>
      </div>
    </div>
  );
}

function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("inventory").select("*").eq("company_id", companyId).then(r => { setItems(r.data||[]); setLoading(false); });
  }, [companyId]);

  return (
    <div className="px-4 pt-4 pb-20 space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-black">Stock</h2>
        <button className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">+ Add</button>
      </div>
      {items.map(i => (
        <div key={i.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate text-sm">{i.product_name}</p>
            <p className="text-[10px] text-gray-400">{i.available_quantity} {i.unit}</p>
          </div>
          <div className="text-right shrink-0 pl-2">
            <p className="font-black text-blue-700 text-sm">{fmt(i.cost_price * i.available_quantity)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Deals() {
  const { companyId } = useAuth();
  const [deals, setDeals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tab, setTab] = useState("All");

  useEffect(() => {
    Promise.all([
      sb.from("deals").select("*").eq("company_id", companyId),
      sb.from("customers").select("*").eq("company_id", companyId)
    ]).then(([d, c]) => { setDeals(d.data||[]); setCustomers(c.data||[]); });
  }, [companyId]);

  const TABS = ["All", "Draft", "Confirmed", "Completed"];

  return (
    <div className="pb-20">
      <div className="sticky top-14 bg-white/80 backdrop-blur-md z-30 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black">Deals</h2>
          <button className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">+ New</button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cls("px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0",
                tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {deals.filter(d => tab === "All" || (d.status||"").toLowerCase() === tab.toLowerCase()).map(d => (
          <SwipeDealCard key={d.id} deal={d} customers={customers} />
        ))}
      </div>
    </div>
  );
}

function Transit() {
  const { companyId } = useAuth();
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      sb.from("shipments").select("*").eq("company_id", companyId),
      sb.from("yards").select("*").eq("company_id", companyId)
    ]).then(([s, y]) => { setShips(s.data||[]); setYards(y.data||[]); });
  }, [companyId]);

  return (
    <div className="pb-20">
      <div className="sticky top-14 bg-white/80 backdrop-blur-md z-30 border-b border-gray-100 px-4 py-3 flex justify-between items-center">
        <h2 className="text-xl font-black">Transit</h2>
        <button className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">+ Add</button>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {ships.map(s => <TransitCard key={s.id} s={s} yards={yards} onSelect={setSelected} />)}
      </div>
      <SlidePanel title="Shipment Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <DetailRow label="Vehicle" value={selected.vehicle_number} />
            <DetailRow label="Driver" value={selected.driver_name} />
            <DetailRow label="Cost" value={fmt(selected.freight_cost)} />
            <DetailRow label="Destination" value={selected.destination} />
          </div>
        )}
      </SlidePanel>
    </div>
  );
}

function AIInsights() { return <div className="p-10 text-center text-gray-400">Insights feature coming soon...</div>; }

// ── MAIN APP SHELL ────────────────────────────────────────────────────────────
export default function MobileApp({ user, companyId, onSignOut }) {
  return (
    <AuthCtx.Provider value={{ user, companyId }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <MobileNav onSignOut={onSignOut} />
        <div className="flex-1 pt-14 pb-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/transit" element={<Transit />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}
