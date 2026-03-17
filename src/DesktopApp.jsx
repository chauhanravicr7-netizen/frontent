import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signOut, db } from "./lib/supabase";
import {
  useAuth, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner
} from "./shared";

// ── NAVIGATION ─────────────────────────────────────────────────────────────────
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

// ── PAGES ──────────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    sb.from("inventory").select("*").eq("company_id", companyId).then(r => setInv(r.data || []));
    sb.from("deals").select("*").eq("company_id", companyId).then(r => setDeals(r.data || []));
    sb.from("shipments").select("*").eq("company_id", companyId).then(r => setShips(r.data || []));
    sb.from("yards").select("*").eq("company_id", companyId).then(r => setYards(r.data || []));
  }, [companyId]);

  const totalValue = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const activeShips = ships.filter(s => s.status !== "Delivered").length;
  const pendingPay = deals.filter(d => d.payment_status === "Pending").length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Inventory Value" value={fmt(totalValue)} icon="📦" color="blue" />
        <StatCard label="Active Shipments" value={activeShips} icon="🚛" color="orange" />
        <StatCard label="Total Deals" value={deals.length} icon="🤝" color="green" />
        <StatCard label="Pending Payments" value={pendingPay} icon="⏳" color="purple" />
      </div>
    </div>
  );
}

function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ product_name: "", cost_price: "", available_quantity: "", yard_id: "" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      sb.from("inventory").select("*").eq("company_id", companyId),
      sb.from("yards").select("*").eq("company_id", companyId)
    ]);
    setItems(a.data || []); setYards(b.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    await sb.from("inventory").insert([{ ...form, company_id: companyId }]);
    setShowAdd(false); fetchAll();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-800">Inventory</h1>
        <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr><th className="text-left px-4 py-3">Product</th><th className="text-left px-4 py-3">Yard</th><th className="text-left px-4 py-3">Qty</th><th className="text-left px-4 py-3">Value</th></tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{i.product_name}</td>
                  <td className="px-4 py-3">{yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                  <td className="px-4 py-3">{i.available_quantity}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{fmt(i.cost_price * i.available_quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Stock" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Product Name"><Input value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} /></Field>
        <Field label="Yard">
          <Select value={form.yard_id} onChange={e => setForm({...form, yard_id: e.target.value})}>
            <option value="">Select Yard</option>
            {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty"><Input type="number" value={form.available_quantity} onChange={e => setForm({...form, available_quantity: e.target.value})} /></Field>
          <Field label="Cost"><Input type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} /></Field>
        </div>
        <Btn onClick={save} className="w-full mt-4">Save Product</Btn>
      </SlidePanel>
    </div>
  );
}

function Yards() {
  const { companyId } = useAuth();
  const [yards, setYards] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", city: "" });

  const fetchYards = async () => {
    const { data } = await sb.from("yards").select("*").eq("company_id", companyId);
    setYards(data || []);
  };
  useEffect(() => { fetchYards(); }, []);

  const save = async () => {
    await sb.from("yards").insert([{ ...form, company_id: companyId }]);
    setShowAdd(false); fetchYards();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-800">Yards</h1>
        <Btn onClick={() => setShowAdd(true)}>+ Add Yard</Btn>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {yards.map(y => (
          <div key={y.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-lg">{y.name}</h3>
            <p className="text-gray-400 text-sm">{y.city}</p>
          </div>
        ))}
      </div>
      <SlidePanel title="Add Yard" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Yard Name"><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
        <Field label="City"><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></Field>
        <Btn onClick={save} className="w-full mt-4">Create Yard</Btn>
      </SlidePanel>
    </div>
  );
}

function Deals() {
  const { companyId } = useAuth();
  const [deals, setDeals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const fetchDeals = async () => {
    const { data } = await sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setDeals(data || []);
  };
  useEffect(() => { fetchDeals(); }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-800">Deals</h1>
        <Btn onClick={() => setShowAdd(true)}>+ New Deal</Btn>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="text-left px-4 py-3">Customer</th><th className="text-left px-4 py-3">Product</th><th className="text-left px-4 py-3">Value</th><th className="text-left px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{d.customer_name}</td>
                <td className="px-4 py-3">{d.product_name}</td>
                <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value)}</td>
                <td className="px-4 py-3"><Badge text={d.payment_status} color={d.payment_status === "Paid" ? "green" : "orange"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Transit() {
  const { companyId } = useAuth();
  const [ships, setShips] = useState([]);

  useEffect(() => {
    sb.from("shipments").select("*").eq("company_id", companyId).then(r => setShips(r.data || []));
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Transit tracking</h1>
      <div className="grid grid-cols-2 gap-4">
        {ships.map(s => (
          <div key={s.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between">
            <div><p className="font-bold">{s.vehicle_number}</p><p className="text-xs text-gray-400">{s.destination}</p></div>
            <Badge text={s.status} color="blue" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PLACEHOLDERS FOR REMAINING ──
function Suppliers() { return <div className="p-10 text-gray-400">Suppliers loading...</div>; }
function Customers() { return <div className="p-10 text-gray-400">Customers loading...</div>; }
function Financials() { return <div className="p-10 text-gray-400">Financials loading...</div>; }
function Reports() { return <div className="p-10 text-gray-400">Reports loading...</div>; }
function Company() { return <div className="p-10 text-gray-400">Company settings loading...</div>; }
function Settings() { return <div className="p-10 text-gray-400">Account settings loading...</div>; }

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
