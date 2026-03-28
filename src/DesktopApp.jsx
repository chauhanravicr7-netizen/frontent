import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signOut, db } from "./lib/supabase";
import {
  useAuth, useRole, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner
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

const BOTTOM_TABS = [
  { to: "/",           label: "Home",    icon: "🏠" },
  { to: "/inventory",  label: "Stock",   icon: "📦" },
  { to: "/deals",      label: "Deals",   icon: "🤝" },
  { to: "/transit",    label: "Transit", icon: "🚛" },
  { to: "/ai-insights",label: "Insights",icon: "📊" },
];


// ── PAGES ──────────────────────────────────────────────────────────────────────
// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
function GlobalSearch({ inventory, deals, customers, onClose }) {
  const [q, setQ] = useState("");
  const inputRef  = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = q.trim().length < 2 ? [] : [
    ...inventory.filter(i => (i.product_name||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(i => ({ type:"stock", label: i.product_name, sub: (i.category||"") + " · " + (i.available_quantity||0) + " " + (i.unit||""), id: i.id })),
    ...deals.filter(d => (d.customer_name||"").toLowerCase().includes(q.toLowerCase()) || (d.deal_number||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(d => ({ type:"deal", label: d.customer_name || d.deal_number, sub: "Deal · " + fmt(d.total_value), id: d.id })),
    ...customers.filter(c => (c.name||"").toLowerCase().includes(q.toLowerCase()))
      .slice(0,4).map(c => ({ type:"customer", label: c.name, sub: c.city || "", id: c.id })),
  ];

  const typeIcon = t => t === "stock" ? "📦" : t === "deal" ? "🤝" : "👥";
  const typeBadge = t => t === "stock" ? "Inventory" : t === "deal" ? "Deal" : "Customer";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}>
      <div className="w-full max-width-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-gray-200">
          <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} ref={inputRef}
            placeholder="Search inventory, deals, customers…" 
            className="w-full outline-none text-sm bg-transparent" />
        </div>
        {results.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {q.trim().length < 2 ? "Start typing to search…" : "No results found"}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {results.map(r => (
              <button key={r.type + r.id} onClick={onClose}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0">
                <span className="text-lg mt-0.5">{typeIcon(r.type)}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-800">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.sub}</p>
                  <Badge text={typeBadge(r.type)} color="blue" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── INVENTORY ──────────────────────────────────────────────────────────────────
function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ product_name:"", category:"", wood_type:"", grade:"", unit:"CFT", available_quantity:"", cost_price:"", notes:"" });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.from("inventory").select("*").eq("company_id", companyId).order("created_at",{ascending:false});
      if (error) throw error;
      setItems(data || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [companyId]);

  const save = async () => {
    setErr("");
    try {
      const { error } = await sb.from("inventory").insert([{
        company_id: companyId,
        product_name: form.product_name,
        category: form.category,
        wood_type: form.wood_type,
        grade: form.grade,
        unit: form.unit,
        available_quantity: parseFloat(form.available_quantity) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        stock_status: "Available",
        notes: form.notes || null,
      }]);
      if (error) throw error;
      setForm({ product_name:"", category:"", wood_type:"", grade:"", unit:"CFT", available_quantity:"", cost_price:"", notes:"" });
      setShowAdd(false);
      fetchAll();
    } catch (e) { setErr(e.message || String(e)); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Inventory</h1>
          <p className="text-gray-400 text-sm">{items.length} products in stock</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Product","Category","Wood Type","Grade","Unit","Available","Cost Price","Total Value","Status"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{i.product_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{i.category || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{i.wood_type || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{i.grade || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{i.unit || "—"}</td>
                  <td className="px-4 py-3 font-bold text-blue-600">{i.available_quantity || 0}</td>
                  <td className="px-4 py-3 text-gray-600">₹{(i.cost_price || 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-bold text-green-700">₹{((i.cost_price || 0) * (i.available_quantity || 0)).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3"><Badge text={i.stock_status || "Available"} color={i.stock_status === "Sold" ? "gray" : "green"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlidePanel title="Add Stock" open={showAdd} onClose={() => setShowAdd(false)}>
        <Field label="Product Name"><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. Burma Teak Logs" /></Field>
        <Field label="Category"><Select value={form.category} onChange={set("category")}><option>—</option><option>Logs</option><option>Planks</option><option>Plywood</option><option>Veneer</option></Select></Field>
        <Field label="Wood Type"><Input value={form.wood_type} onChange={set("wood_type")} placeholder="e.g. Teak, Sal" /></Field>
        <Field label="Grade"><Input value={form.grade} onChange={set("grade")} placeholder="e.g. A-Grade, Select" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit"><Select value={form.unit} onChange={set("unit")}><option>CFT</option><option>BFT</option><option>MT</option><option>Sheets</option></Select></Field>
          <Field label="Quantity"><Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0" /></Field>
        </div>
        <Field label="Cost Price (₹)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save}>Add to Stock</Btn><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ────────────────────────────────────────────────────────────────────
function Transit() {
  const { companyId } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.from("shipments").select("*").eq("company_id", companyId).order("created_at",{ascending:false});
      if (error) throw error;
      setShipments(data || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Transit & Logistics</h1>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Shipment #","Vehicle","Driver","Destination","Dispatch","Status","Freight"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-blue-600">{s.shipment_number || "#" + (s.id||"").toString().slice(-6)}</td>
                  <td className="px-4 py-3">{s.vehicle_number || "—"}</td>
                  <td className="px-4 py-3">{s.driver_name || "—"}</td>
                  <td className="px-4 py-3">{s.destination || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(s.dispatch_date)}</td>
                  <td className="px-4 py-3"><Badge text={s.status || "—"} color="blue" /></td>
                  <td className="px-4 py-3 font-bold">₹{(s.freight_cost || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── DEALS / TRADE ENGINE (UPDATED WITH AUTO-TRANSFER & INVOICE) ──────────────────
function Deals() {
  const { companyId } = useAuth();
  const role = useRole();
  const isAdmin = role !== "worker";
  const [deals, setDeals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [custName, setCustName] = useState("");
  const [stageMenu, setStageMenu] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  
  const DEAL_DEFAULTS = { customer_id:"", product_id:"", quantity:"", unit_price:"", status:"draft", payment_status:"Pending", notes:"" };
  const [form, setForm] = useState(DEAL_DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        sb.from("deals").select("*").eq("company_id", companyId).order("created_at",{ascending:false}),
        sb.from("customers").select("*").eq("company_id", companyId),
        sb.from("inventory").select("*").eq("company_id", companyId),
        sb.from("company").select("*").eq("id", companyId).single(),
      ]);
      setDeals(a.data || []);
      setCustomers(b.data || []);
      setInventory(c.data || []);
      setCompany(d.data || {});
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── GENERATE INVOICE PDF ────────────────────────────────────────────
  const generateInvoicePDF = (deal) => {
    setGeneratingInvoice(true);
    try {
      const inv = inventory.find(i => i.id === deal.inventory_id) || {};
      const now = new Date();
      const invoiceDate = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const invoiceNo = "DST-" + now.getFullYear() + "-" + String(Date.now()).slice(-6);
      
      const qty = parseFloat(deal.quantity) || 0;
      const rate = parseFloat(deal.negotiated_price) || 0;
      const subtotal = qty * rate;
      const cgst = subtotal * 0.09;
      const sgst = subtotal * 0.09;
      const grandTotal = subtotal + cgst + sgst;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
      background: white;
      color: #1e293b;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1e293b;
    }
    .company-section h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .company-section p { font-size: 12px; color: #64748b; margin: 3px 0; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .invoice-meta { font-size: 11px; color: #64748b; margin: 3px 0; }
    .bill-ship-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 30px;
      font-size: 12px;
    }
    .section-title { 
      font-size: 11px; 
      font-weight: 700; 
      text-transform: uppercase; 
      color: #475569;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    thead {
      background: #f1f5f9;
      border-top: 2px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
    }
    th {
      padding: 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .amount-section {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .amount-table { width: 350px; }
    .amount-table tr:last-child td {
      padding: 14px 12px;
      font-weight: 700;
      font-size: 13px;
      border-top: 2px solid #1e293b;
    }
    .amount-table .label {
      text-align: right;
      padding-right: 20px;
      width: 50%;
      color: #475569;
    }
    .amount-table .value {
      text-align: right;
      width: 50%;
      color: #1e293b;
    }
    .terms {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-section">
      <h1>⚓ ${company.name || "DOCKSIDE"}</h1>
      <p>${company.address || "Gandhidham sector 5"}</p>
      <p>Mobile: ${company.phone || "+91 XXXXXXXXXX"}</p>
      <p>GSTIN: ${company.gst_number || "N/A"}</p>
    </div>
    <div class="invoice-title">
      <h2>TAX INVOICE</h2>
      <div class="invoice-meta">Invoice No: <strong>${invoiceNo}</strong></div>
      <div class="invoice-meta">Date: <strong>${invoiceDate}</strong></div>
    </div>
  </div>

  <div class="bill-ship-section">
    <div>
      <div class="section-title">BILL TO:</div>
      <strong>${deal.customer_name || "Customer"}</strong>
      <p>Gandhidham, Gujarat</p>
    </div>
    <div>
      <div class="section-title">SHIP TO:</div>
      <strong>${deal.customer_name || "Customer"}</strong>
      <p>Same as Billing</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>HSN</th>
        <th>Qty</th>
        <th>Rate</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${deal.product_name || "Product"}</td>
        <td>4403</td>
        <td>${qty}</td>
        <td>₹${rate.toLocaleString("en-IN")}</td>
        <td style="text-align: right;">₹${subtotal.toLocaleString("en-IN")}</td>
      </tr>
    </tbody>
  </table>

  <div class="amount-section">
    <table class="amount-table">
      <tr>
        <td class="label">Sub-Total:</td>
        <td class="value">₹${subtotal.toLocaleString("en-IN")}</td>
      </tr>
      <tr>
        <td class="label">CGST (9%):</td>
        <td class="value">₹${cgst.toLocaleString("en-IN")}</td>
      </tr>
      <tr>
        <td class="label">SGST (9%):</td>
        <td class="value">₹${sgst.toLocaleString("en-IN")}</td>
      </tr>
      <tr>
        <td class="label">Grand Total:</td>
        <td class="value">₹${grandTotal.toLocaleString("en-IN")}</td>
      </tr>
    </table>
  </div>

  <div class="terms">
    <strong>Terms & Conditions:</strong>
    <p>1. Goods once sold will not be taken back.</p>
    <p>2. Interest @ 18% p.a. on overdue payments.</p>
  </div>

  <div style="margin-top: 40px; text-align: right; font-size: 11px;">
    <p style="margin-bottom: 40px;">For ${company.name || "DOCKSIDE"}</p>
    <p style="border-top: 1px solid #1e293b; padding-top: 4px; display: inline-block; min-width: 150px;">
      Authorized Signatory
    </p>
  </div>
</body>
</html>`;

      const w = window.open("", "_blank");
      w.document.write(html);
      w.document.close();
    } catch (e) {
      alert("Failed to generate invoice: " + e.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // ── UPDATE DEAL STAGE WITH AUTO-TRANSFER ────────────────────────────
  const updateDealStage = async (deal, newStage) => {
    setStageMenu(null);
    try {
      const prevStage = (deal.stage || deal.status || "draft").toLowerCase();
      const next = newStage.toLowerCase();
      const invId = deal.inventory_id;

      // When deal moves to "Closed" or "Completed", mark inventory as Sold
      if ((next === "closed" || next === "completed") && prevStage !== next) {
        if (invId) {
          const { data: inv } = await sb.from("inventory").select("*").eq("id", invId).single();
          if (inv) {
            await sb.from("inventory").update({
              stock_status: "Sold",
              last_sale_date: new Date().toISOString(),
              last_sale_value: deal.total_value || deal.negotiated_price,
              last_customer: deal.customer_name,
              deal_reference: deal.deal_number,
            }).eq("id", invId);
          }
        }
      }

      await sb.from("deals").update({ stage: newStage, status: newStage }).eq("id", deal.id);
      fetchAll();
      
      if (next === "closed" || next === "completed") {
        alert(`✅ Deal marked as ${newStage}. Stock updated in Inventory.`);
      }
    } catch (e) { 
      alert("Stage update failed: " + e.message); 
    }
  };

  const TABS = ["All","Draft","Confirmed","Dispatched","Delivered","Closed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.status||d.stage||"").toLowerCase() === tab.toLowerCase());
  const closeDeal = () => { setShowAdd(false); setForm(DEAL_DEFAULTS); setCustName(""); setErr(""); };

  const save = async () => {
    if (!form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unit_price) || 0;
      const selProd = inventory.find(i => i.id === form.product_id);
      const custObj = customers.find(c => c.id === form.customer_id);
      const { error } = await sb.from("deals").insert([{
        company_id: companyId, deal_number: "DEAL-" + Date.now(),
        customer_id: form.customer_id || null,
        customer_name: custName || (custObj ? custObj.name : null),
        inventory_id: form.product_id || null,
        product_name: selProd ? selProd.product_name : null,
        quantity: qty, negotiated_price: price, total_value: qty * price,
        payment_status: form.payment_status, stage: form.status, notes: form.notes || null,
      }]);
      if (error) throw error;
      closeDeal(); fetchAll();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Trade Engine</h1>
          <p className="text-gray-400 text-sm">{deals.length} total deals · {deals.filter(d => ["closed","completed"].includes((d.stage||d.status||"").toLowerCase())).length} closed</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Purchase Contract</Btn>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} ({t === "All" ? deals.length : deals.filter(d=>(d.status||d.stage||"").toLowerCase()===t.toLowerCase()).length})
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto" onClick={() => setStageMenu(null)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Deal #","Customer","Product","Qty","Value","Stage","Payment","Date","Action"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || "#" + (d.id||"").toString().slice(-6)}</td>
                  <td className="px-4 py-3 font-semibold">{d.customer_name || (customers.find(c=>c.id===d.customer_id)||{}).name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                  <td className="px-4 py-3">{d.quantity || "—"}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value || d.negotiated_price)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => setStageMenu(stageMenu?.dealId === d.id ? null : { dealId: d.id, deal: d })}
                        className={cls("px-3 py-1 rounded-full text-xs font-bold border",
                          (d.stage||d.status||"draft") === "closed" ? "bg-green-100 text-green-700 border-green-200" :
                          (d.stage||d.status||"draft") === "completed" ? "bg-green-100 text-green-700 border-green-200" :
                          (d.stage||d.status||"draft") === "dispatched" ? "bg-blue-100 text-blue-700 border-blue-200" :
                          (d.stage||d.status||"draft") === "confirmed" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                          "bg-gray-100 text-gray-500 border-gray-200"
                        )}>
                        {d.stage || d.status || "draft"} ▾
                      </button>
                      {stageMenu?.dealId === d.id && (
                        <div className="absolute left-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-36">
                          {["Draft","Confirmed","Dispatched","Delivered","Closed"].map(s => (
                            <button key={s} onClick={() => updateDealStage(stageMenu.deal, s)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-gray-700">
                              {s}{(stageMenu.deal.stage||stageMenu.deal.status||"draft").toLowerCase() === s.toLowerCase() ? " ✓" : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.created_at)}</td>
                  {/* NEW: Invoice button for closed deals */}
                  <td className="px-4 py-3">
                    {["closed","completed"].includes((d.stage||d.status||"").toLowerCase()) && (
                      <button
                        onClick={() => generateInvoicePDF(d)}
                        disabled={generatingInvoice}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
                      >
                        📄 Invoice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No deals found</td></tr>}
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
              <option value="draft">Draft</option><option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option><option value="closed">Closed</option>
            </Select>
          </Field>
          <Field label="Payment Status">
            <Select value={form.payment_status} onChange={set("payment_status")}>
              <option>Pending</option><option>Partial</option><option>Paid</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Creating..." : "Create Deal"}</Btn><Btn variant="secondary" onClick={closeDeal}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── OTHER PAGES (Minimal placeholders) ──────────────────────────────────────────

function Yards() {
  const { companyId } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("yards").select("*").eq("company_id", companyId)
      .then(r => setData(r.data || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Yards</h1>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.map(y => (
            <div key={y.id} className="bg-white rounded-lg border border-gray-100 p-4">
              <p className="font-bold text-gray-800">{y.name}</p>
              <p className="text-sm text-gray-500">{y.location}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Suppliers() {
  const { companyId } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("suppliers").select("*").eq("company_id", companyId)
      .then(r => setData(r.data || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Suppliers</h1>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name","City","Phone","GST"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.city}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{s.gst_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Customers() {
  const { companyId } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("customers").select("*").eq("company_id", companyId)
      .then(r => setData(r.data || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Customers</h1>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name","City","Phone","Email","GST"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email}</td>
                  <td className="px-4 py-3 text-gray-600">{c.gst_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Financials() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Financials</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Revenue" value="₹0" change="+0%" />
        <StatCard icon="💸" label="Expenses" value="₹0" change="+0%" />
        <StatCard icon="📈" label="Profit" value="₹0" change="+0%" />
        <StatCard icon="📊" label="Margin" value="0%" change="+0%" />
      </div>
    </div>
  );
}

function AIInsights() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">AI Insights</h1>
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-500">
        <p>AI analysis coming soon...</p>
      </div>
    </div>
  );
}

// ── REPORTS (UPDATED WITH ZOOM CONTROL) ────────────────────────────────────────
function Reports() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState({});
  const [zoom, setZoom] = useState(100); // NEW: Zoom control

  useEffect(() => {
    sb.from("company").select("*").eq("id", companyId).single()
      .then(r => setCompany(r.data || {})).catch(() => {});
  }, [companyId]);

  const REPORTS = [
    { key:"stock", label:"Stock Report", icon:"📦", desc:"All stock with valuation" },
    { key:"sales", label:"Sales Report", icon:"❤️", desc:"All deals and revenue" },
    { key:"shipment", label:"Shipment Report", icon:"🚛", desc:"Transit & logistics" },
  ];

  const downloadPDF = async (type, label) => {
    setLoading(p => ({...p, [type]: true}));
    try {
      let data = [];
      if (type === "stock") { 
        const r = await sb.from("inventory").select("*").eq("company_id", companyId); 
        data = r.data || []; 
      }
      else if (type === "sales") { 
        const r = await sb.from("deals").select("*").eq("company_id", companyId); 
        data = r.data || []; 
      }
      else if (type === "shipment") { 
        const r = await sb.from("shipments").select("*").eq("company_id", companyId); 
        data = r.data || []; 
      }
      generatePDF(type, label, data, company, zoom); // Pass zoom level
    } catch (e) { alert("Failed: " + e.message); }
    setLoading(p => ({...p, [type]: false}));
  };

  const generatePDF = (type, label, data, co, zoomLevel) => {
    const now = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    
    let tableRows = "";
    
    // Stock Report
    if (type === "stock") {
      tableRows = data.map((i,idx) => `<tr>
        <td>${idx+1}</td>
        <td><b>${i.product_name||"—"}</b></td>
        <td>${i.category||"—"}</td>
        <td>${i.wood_type||"—"}</td>
        <td>${i.grade||"—"}</td>
        <td>${i.unit||"—"}</td>
        <td>${i.available_quantity||0}</td>
        <td>₹${(i.cost_price||0).toLocaleString("en-IN")}</td>
        <td>₹${((i.cost_price||0)*(i.available_quantity||0)).toLocaleString("en-IN")}</td>
      </tr>`).join("");
    }
    // Sales Report
    else if (type === "sales") {
      tableRows = data.map((d,idx) => `<tr>
        <td>${idx+1}</td>
        <td>${d.deal_number||"—"}</td>
        <td>${d.customer_name||"—"}</td>
        <td>${d.product_name||"—"}</td>
        <td>${d.quantity||"—"}</td>
        <td>₹${(d.total_value||0).toLocaleString("en-IN")}</td>
        <td>${d.stage||d.status||"—"}</td>
      </tr>`).join("");
    }
    // Shipment Report
    else if (type === "shipment") {
      tableRows = data.map((s,idx) => `<tr>
        <td>${idx+1}</td>
        <td>${s.shipment_number||"—"}</td>
        <td>${s.vehicle_number||"—"}</td>
        <td>${s.driver_name||"—"}</td>
        <td>${s.destination||"—"}</td>
        <td>₹${(s.freight_cost||0).toLocaleString("en-IN")}</td>
      </tr>`).join("");
    }

    // HTML Template with proper formatting
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${label}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 40px;
      color: #1e293b;
      background: white;
      zoom: ${zoomLevel}%; /* Zoom control */
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
    }
    .company-info h1 {
      font-size: 22px;
      margin: 0 0 8px 0;
      font-weight: 700;
    }
    .company-info p {
      font-size: 11px;
      color: #64748b;
      margin: 2px 0;
    }
    .report-title h2 {
      font-size: 16px;
      margin: 0 0 8px 0;
      font-weight: 700;
    }
    .report-title p {
      font-size: 11px;
      color: #94a3b8;
      margin: 2px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 12px;
    }
    thead {
      background: #f1f5f9;
      border-bottom: 2px solid #cbd5e1;
    }
    th {
      padding: 10px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    tbody tr:hover {
      background: #f8fafc;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>⚓ ${co.name || "Dockside ERP"}</h1>
      ${co.gst_number ? `<p>GST: ${co.gst_number}</p>` : ""}
      <p>Generated: ${now}</p>
    </div>
    <div class="report-title" style="text-align: right;">
      <h2>${label}</h2>
      <p>${data.length} records</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        ${type === "stock" ? `<th>#</th><th>Product</th><th>Category</th><th>Wood Type</th><th>Grade</th><th>Unit</th><th>Qty</th><th>Cost Price</th><th>Total Value</th>` : ""}
        ${type === "sales" ? `<th>#</th><th>Deal No.</th><th>Customer</th><th>Product</th><th>Qty</th><th>Value</th><th>Stage</th>` : ""}
        ${type === "shipment" ? `<th>#</th><th>Shipment No.</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Freight</th>` : ""}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Reports</h1>
          <p className="text-gray-400 text-sm">Professional PDF reports with company letterhead</p>
        </div>
        {/* NEW: Zoom Control */}
        <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2 rounded-lg">
          <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="px-2 py-1 hover:bg-gray-800">−</button>
          <span className="text-sm font-semibold min-w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="px-2 py-1 hover:bg-gray-800">+</button>
          <button onClick={() => setZoom(100)} className="px-3 py-1 text-xs hover:bg-gray-800 border border-gray-700 rounded">Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
  const { companyId } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name:"", address:"", phone:"", email:"", gst_number:"", pan_number:"", bank_name:"", bank_account:"", bank_ifsc:""
  });

  useEffect(() => {
    sb.from("company").select("*").eq("id", companyId).single()
      .then(r => {
        setCompany(r.data);
        if (r.data) setForm({
          name: r.data.name || "",
          address: r.data.address || "",
          phone: r.data.phone || "",
          email: r.data.email || "",
          gst_number: r.data.gst_number || "",
          pan_number: r.data.pan_number || "",
          bank_name: r.data.bank_name || "",
          bank_account: r.data.bank_account || "",
          bank_ifsc: r.data.bank_ifsc || "",
        });
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await sb.from("company").update(form).eq("id", companyId);
      if (error) throw error;
      alert("✅ Company details saved!");
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Company Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Name">
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
          </Field>
        </div>
        <Field label="Address">
          <Textarea value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Phone">
            <Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
          </Field>
          <Field label="GST Number">
            <Input value={form.gst_number} onChange={e => setForm(p => ({...p, gst_number: e.target.value}))} />
          </Field>
          <Field label="PAN Number">
            <Input value={form.pan_number} onChange={e => setForm(p => ({...p, pan_number: e.target.value}))} />
          </Field>
        </div>
        <div className="border-t pt-4 space-y-4">
          <h3 className="font-bold text-gray-800">Bank Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Bank Name">
              <Input value={form.bank_name} onChange={e => setForm(p => ({...p, bank_name: e.target.value}))} />
            </Field>
            <Field label="Account Number">
              <Input value={form.bank_account} onChange={e => setForm(p => ({...p, bank_account: e.target.value}))} />
            </Field>
            <Field label="IFSC Code">
              <Input value={form.bank_ifsc} onChange={e => setForm(p => ({...p, bank_ifsc: e.target.value}))} />
            </Field>
          </div>
        </div>
        <ErrBanner msg={err} />
        <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Btn>
      </div>
    </div>
  );
}

// ── SETTINGS (UPDATED WITH INVOICE TEMPLATE UPLOAD) ────────────────────────────
function Settings() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    sb.from("company").select("*").eq("id", companyId).single()
      .then(r => setCompany(r.data || {}))
      .finally(() => setLoading(false));
  }, [companyId]);

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target.result;
      setUploadingTemplate(true);
      try {
        await sb.from("company").update({
          invoice_template: base64,
          invoice_template_name: file.name,
        }).eq("id", companyId);
        setCompany(p => ({...p, invoice_template: base64, invoice_template_name: file.name}));
        alert("✅ Invoice template uploaded successfully!");
      } catch (err) {
        alert("❌ Failed to upload template: " + err.message);
      } finally {
        setUploadingTemplate(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadTemplateExample = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice Template Example</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
    .header { border-bottom: 2px solid #1e293b; margin-bottom: 30px; padding-bottom: 20px; }
    h1 { font-size: 24px; margin: 0 0 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚓ [COMPANY_NAME]</h1>
    <p>[COMPANY_ADDRESS] | GST: [COMPANY_GST]</p>
    <p>Invoice: [INVOICE_NO] | Date: [INVOICE_DATE]</p>
  </div>
  <h3>BILL TO: [CUSTOMER_NAME]</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>[PRODUCT_NAME]</td>
        <td>[QUANTITY]</td>
        <td>₹[RATE]</td>
        <td>₹[TOTAL]</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
    For [COMPANY_NAME] | Authorized Signatory
  </p>
</body>
</html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-600">
              {company?.name?.charAt(0) || "D"}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{company?.name || "User"}</p>
              <p className="text-sm text-gray-500">{company?.email || "user@dockside.com"}</p>
            </div>
          </div>
        </div>

        {/* NEW: Invoice Template Upload */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Invoice Template</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload your custom invoice PDF/HTML template. Use placeholders like [COMPANY_NAME], [CUSTOMER_NAME], [INVOICE_NO], etc.
          </p>
          
          <div 
            className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center mb-4 hover:bg-blue-50 cursor-pointer transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.html"
              onChange={handleTemplateUpload}
              disabled={uploadingTemplate}
              style={{ display: "none" }}
            />
            <p className="text-sm text-gray-600">
              {uploadingTemplate 
                ? "Uploading..." 
                : company?.invoice_template_name 
                  ? `✅ ${company.invoice_template_name}. Click to replace`
                  : "Click to upload PDF or HTML template"
              }
            </p>
          </div>

          <button
            onClick={downloadTemplateExample}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition"
          >
            📥 Download Template Example
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("inventory").select("available_quantity,cost_price").eq("company_id", companyId)
      .then(r => {
        const inv = r.data || [];
        setStats({
          total_stock: inv.length,
          total_value: inv.reduce((s, i) => s + ((i.cost_price || 0) * (i.available_quantity || 0)), 0),
        });
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <Spinner />;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-black text-gray-800 mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📦" label="Total Stock" value={stats.total_stock || 0} change="+0%" />
        <StatCard icon="💰" label="Stock Value" value={"₹" + (stats.total_value || 0).toLocaleString("en-IN")} change="+0%" />
        <StatCard icon="🤝" label="Active Deals" value="0" change="+0%" />
        <StatCard icon="🚛" label="In Transit" value="0" change="+0%" />
      </div>
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────────
function ProfitCell({ deal, inventory }) {
  const inv = inventory.find(i => i.id === deal.inventory_id) || {};
  const cost = (inv.cost_price || 0) * (deal.quantity || 0);
  const revenue = deal.total_value || 0;
  const profit = revenue - cost;
  return <td className="px-4 py-3 font-bold text-orange-600">{fmt(profit)}</td>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchData, setSearchData] = useState({ inventory:[], deals:[], customers:[] });

  useEffect(() => {
    const chk = async () => {
      const { data: { user: authUser } } = await sb.auth.getUser();
      if (authUser) {
        const { data: ud } = await sb.from("users").select("*").eq("id", authUser.id).single();
        if (ud) {
          setUser(authUser);
          setCompanyId(ud.company_id);
          setRole(ud.role || "admin");
        } else {
          await sb.auth.signOut();
        }
      }
      setLoading(false);
    };
    chk();
  }, []);

  const onSignOut = async () => {
    await signOut();
    setUser(null);
    setCompanyId(null);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner /></div>;
  if (!user) return <Navigate to="/login" />;

  const isAdmin = role !== "worker";

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
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
        />
      )}
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar onSignOut={onSignOut} role={role} />
        <div className="flex-1 ml-52 min-h-screen">
          <Routes>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transit"   element={<Transit />} />
            <Route path="/"          element={isAdmin ? <Dashboard />  : <Navigate to="/inventory" />} />
            <Route path="/yards"     element={isAdmin ? <Yards />      : <Navigate to="/inventory" />} />
            <Route path="/deals"     element={isAdmin ? <Deals />      : <Navigate to="/inventory" />} />
            <Route path="/suppliers" element={isAdmin ? <Suppliers />  : <Navigate to="/inventory" />} />
            <Route path="/customers" element={isAdmin ? <Customers />  : <Navigate to="/inventory" />} />
            <Route path="/financials"  element={isAdmin ? <Financials />  : <Navigate to="/inventory" />} />
            <Route path="/ai-insights" element={isAdmin ? <AIInsights />  : <Navigate to="/inventory" />} />
            <Route path="/reports"   element={isAdmin ? <Reports />    : <Navigate to="/inventory" />} />
            <Route path="/company"   element={isAdmin ? <Company />    : <Navigate to="/inventory" />} />
            <Route path="/settings"  element={isAdmin ? <Settings />   : <Navigate to="/inventory" />} />
            <Route path="*"          element={<Navigate to={isAdmin ? "/" : "/inventory"} />} />
          </Routes>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}

// Placeholder for AIChat component (already exists in your code)
function AIChat({ companyId, onClose }) {
  return (
    <div className="fixed bottom-20 right-6 z-50 w-96 h-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold">AI Assistant</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>AI chat interface</p>
      </div>
    </div>
  );
}
