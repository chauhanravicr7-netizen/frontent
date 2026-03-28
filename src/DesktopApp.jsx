import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signOut } from "./lib/supabase";
import { useAuth, useRole, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum, SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner } from "./shared";

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

const Sidebar = ({ onSignOut, role = "admin" }) => (
  <div className="w-52 bg-gray-900 text-white flex-col min-h-screen fixed top-0 left-0 hidden md:flex">
    <div className="px-4 py-5 border-b border-gray-700/50">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-black text-white">⚓</div>
        <div><div className="text-sm font-black text-white">Dockside</div><div className="text-xs text-gray-500">Timber Trade OS</div></div>
      </div>
    </div>
    <nav className="flex-1 py-3 px-2">
      {NAV.filter(n => role === "worker" ? ["/inventory","/transit"].includes(n.to) : true).map(n => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => cls("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all", isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800")}>
          <span className="text-base">{n.icon}</span>{n.label}
        </NavLink>
      ))}
    </nav>
    <div className="p-3 border-t border-gray-700">
      <button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800">
        <span>🚪</span> Sign Out
      </button>
    </div>
  </div>
);

function Dashboard() {
  const { companyId } = useAuth();
  return <div className="p-6"><h1 className="text-3xl font-black text-gray-800">Dashboard</h1></div>;
}

function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("inventory").select("*").eq("company_id", companyId).then(r => { setItems(r.data || []); setLoading(false); });
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Inventory</h1>
      {loading ? <Spinner /> : <div className="text-gray-600">{items.length} products</div>}
    </div>
  );
}

function Transit() {
  return <div className="p-6"><h1 className="text-2xl font-black text-gray-800">Transit</h1></div>;
}

function Deals() {
  const { companyId } = useAuth();
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    sb.from("deals").select("*").eq("company_id", companyId).then(r => setDeals(r.data || []));
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800">Trade Engine</h1>
      <p className="text-gray-600 mt-2">{deals.length} deals</p>
    </div>
  );
}

function Yards() { return <div className="p-6"><h1 className="text-2xl font-black text-gray-800">Yards</h1></div>; }
function Suppliers() { return <div className="p-6"><h1 className="text-2xl font-black text-gray-800">Suppliers</h1></div>; }
function Customers() { return <div className="p-6"><h1 className="text-2xl font-black text-gray-800">Customers</h1></div>; }
function Financials() { return <div className="p-6"><h1 className="text-2xl font-black text-gray-800">Financials</h1></div>; }

function Reports() {
  const { companyId } = useAuth();
  const [zoom, setZoom] = useState(100);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-black text-gray-800">Reports</h1></div>
        <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2 rounded-lg">
          <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="px-2 py-1 hover:bg-gray-800">−</button>
          <span className="text-sm font-semibold min-w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="px-2 py-1 hover:bg-gray-800">+</button>
          <button onClick={() => setZoom(100)} className="px-3 py-1 text-xs hover:bg-gray-800 border border-gray-700 rounded">Reset</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {[{key: "stock", label: "Stock Report", icon: "📦"}, {key: "sales", label: "Sales Report", icon: "❤️"}, {key: "shipment", label: "Shipment Report", icon: "🚛"}].map(r => (
          <div key={r.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl mb-3">{r.icon}</div>
            <h3 className="font-bold text-gray-800">{r.label}</h3>
            <Btn className="mt-4">📥 Download PDF</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    sb.from("company").select("*").eq("id", companyId).single().then(r => setCompany(r.data || {}));
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Invoice Template</h2>
        <p className="text-sm text-gray-500 mb-4">Upload custom invoice template (PDF/HTML)</p>
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center hover:bg-blue-50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept=".pdf,.html" style={{ display: "none" }} />
          <p className="text-sm text-gray-600">Click to upload template</p>
        </div>
      </div>
    </div>
  );
}

function Company() { return <div className="p-6"><h1 className="text-2xl font-black text-gray-800">Company Settings</h1></div>; }

function AIChat({ onClose }) {
  return (
    <div className="fixed bottom-20 right-6 z-50 w-96 h-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold">AI Assistant</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-400">AI chat interface</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await sb.auth.getUser();
      if (authUser) {
        const { data: ud } = await sb.from("users").select("*").eq("id", authUser.id).single();
        setUser(ud || authUser);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;

  const onSignOut = async () => {
    await signOut();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, companyId: user.company_id, role: user.role }}>
      {showAI && <AIChat onClose={() => setShowAI(false)} />}
      {!showAI && (
        <button onClick={() => setShowAI(true)} className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-blue-700">
          <span className="text-lg">AI</span>
        </button>
      )}
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar onSignOut={onSignOut} role={user.role} />
        <div className="flex-1 ml-52 min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transit" element={<Transit />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/yards" element={<Yards />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/company" element={<Company />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}
