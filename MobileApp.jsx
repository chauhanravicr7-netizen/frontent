import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { sb, db } from "./lib/supabase";
import {
  useAuth, useRole, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum,
  SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner
} from "./shared";

// ── RBAC: ROLE-BASED TABS ─────────────────────────────────────────────────────
// Admin sees everything. Worker sees only Inventory + Transit.
const ADMIN_TABS = [
  { to: "/",            label: "Home",     icon: "🏠" },
  { to: "/inventory",   label: "Stock",    icon: "📦" },
  { to: "/deals",       label: "Deals",    icon: "🤝" },
  { to: "/transit",     label: "Transit",  icon: "🚛" },
  { to: "/ai-insights", label: "Insights", icon: "📊" },
];

const WORKER_TABS = [
  { to: "/inventory",   label: "Stock",    icon: "📦" },
  { to: "/transit",     label: "Transit",  icon: "🚛" },
];

const ADMIN_PAGES = [
  { to: "/",            label: "Dashboard",  icon: "🏠" },
  { to: "/inventory",   label: "Inventory",  icon: "📦" },
  { to: "/deals",       label: "Deals",      icon: "🤝" },
  { to: "/transit",     label: "Transit",    icon: "🚛" },
  { to: "/ai-insights", label: "Insights",   icon: "📊" },
  { to: "/yards",       label: "Yards",      icon: "🏗️" },
  { to: "/suppliers",   label: "Suppliers",  icon: "🏭" },
  { to: "/customers",   label: "Customers",  icon: "👥" },
  { to: "/company",     label: "Company",    icon: "🏢" },
  { to: "/settings",    label: "Settings",   icon: "⚙️" },
];

const WORKER_PAGES = [
  { to: "/inventory",   label: "Inventory",  icon: "📦" },
  { to: "/transit",     label: "Transit",    icon: "🚛" },
];

// ── QR CODE GENERATOR (inline SVG, no package needed) ─────────────────────────
// Generates a simple QR code using a URL-based approach
function QRCode({ value, size = 120 }) {
  // Use Google Charts API to generate QR as img (works offline after first load via cache)
  const url = "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size + "&data=" + encodeURIComponent(value);
  return (
    <img src={url} alt="QR Code" width={size} height={size}
      style={{ imageRendering: "pixelated" }}
      onError={e => { e.target.style.display = "none"; }} />
  );
}

function printQRLabel(item) {
  const value = JSON.stringify({ id: item.id, wood: item.wood_type || "-", vol: item.available_quantity, unit: item.unit || "CFT" });
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(value);
  const html = "<!DOCTYPE html><html><head><title>QR Label</title>"
    + "<style>@page{size:50mm 25mm;margin:1mm}body{font-family:monospace;margin:0;padding:2mm;display:flex;align-items:center;gap:2mm}"
    + "img{width:20mm;height:20mm}.info{font-size:6px;line-height:1.4}</style></head><body>"
    + "<img src='" + qrUrl + "' />"
    + "<div class='info'><b>" + (item.product_name || "-") + "</b><br>"
    + (item.wood_type || "-") + "<br>"
    + item.available_quantity + " " + (item.unit || "CFT") + "<br>"
    + "ID: " + item.id.slice(-8) + "</div>"
    + "</body></html>";
  const w = window.open("", "_blank", "width=400,height=300");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
}

// ── BLUETOOTH THERMAL PRINTER ─────────────────────────────────────────────────
// ESC/POS commands for 58mm/80mm Bluetooth thermal printers
async function printBluetooth(deal) {
  if (!navigator.bluetooth) {
    alert("Bluetooth not supported in this browser. Use Chrome on Android.");
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
    });
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
    const char    = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb");

    const ESC = 0x1B; const GS = 0x1D; const LF = 0x0A;
    const enc = new TextEncoder();

    // Build receipt bytes
    const lines = [
      [ESC, 0x40],                          // Initialize
      [ESC, 0x61, 0x01],                    // Center align
      [GS,  0x21, 0x11],                    // Double size
      ...enc.encode("DOCKSIDE OS\n"),
      [GS,  0x21, 0x00],                    // Normal size
      ...enc.encode("========================\n"),
      [ESC, 0x61, 0x00],                    // Left align
      ...enc.encode("Customer: " + (deal.customer_name || "-") + "\n"),
      ...enc.encode("Product:  " + (deal.product_name  || "-") + "\n"),
      ...enc.encode("Qty:      " + (deal.quantity || 0) + " units\n"),
      ...enc.encode("Rate:     Rs " + (deal.negotiated_price || 0).toLocaleString("en-IN") + "\n"),
      ...enc.encode("------------------------\n"),
      [GS, 0x21, 0x01],                     // Bold total
      ...enc.encode("TOTAL: Rs " + (deal.total_value || 0).toLocaleString("en-IN") + "\n"),
      [GS, 0x21, 0x00],
      ...enc.encode("========================\n"),
      [ESC, 0x61, 0x01],
      ...enc.encode("Dockside Trade OS\n"),
      ...enc.encode(new Date().toLocaleDateString("en-IN") + "\n\n\n"),
      [GS, 0x56, 0x42, 0x00],              // Cut paper
    ];

    const bytes = new Uint8Array(lines.flat());
    // Write in 20-byte chunks (BLE MTU limit)
    for (let i = 0; i < bytes.length; i += 20) {
      await char.writeValue(bytes.slice(i, i + 20));
    }
    alert("Printed successfully!");
  } catch (e) {
    if (e.name !== "NotFoundError") alert("Print failed: " + e.message);
  }
}

// ── EWAYBILL JSON GENERATOR ───────────────────────────────────────────────────
function generateEWayBill(shipment, yards) {
  const yard = yards.find(y => y.id === shipment.origin_yard_id) || {};
  // Indian govt E-Way Bill portal JSON schema
  const ewb = {
    "supplyType": "O",                        // Outward supply
    "subSupplyType": "1",                     // Supply
    "docType": "INV",
    "docNo": shipment.shipment_number || "SHIP-" + Date.now(),
    "docDate": fmtDate(shipment.dispatch_date || new Date().toISOString()),
    "fromGstin": "FILL_YOUR_GSTIN_HERE",
    "fromTrdName": yard.name || "Dockside Yard",
    "fromAddr1": yard.address || yard.city || "Gandhidham",
    "fromPlace": yard.city || "Gandhidham",
    "fromPincode": "370201",
    "fromStateCode": "24",                   // Gujarat
    "toGstin": "URP",                        // Unregistered party (change if customer has GSTIN)
    "toTrdName": "Buyer",
    "toAddr1": shipment.destination || "",
    "toPlace": shipment.destination || "",
    "toPincode": "000000",
    "toStateCode": "24",
    "vehicleNo": shipment.vehicle_number || "",
    "vehicleType": "R",                      // Regular
    "transDocNo": "",
    "transDocDate": "",
    "transMode": "1",                        // Road
    "transDistance": "0",
    "itemList": [{
      "productName": shipment.cargo_details || "Timber",
      "hsnCode": "4407",                     // HSN for sawn timber
      "productDesc": shipment.cargo_details || "Timber products",
      "quantity": 0,
      "qtyUnit": "CBM",
      "cgstRate": 9,
      "sgstRate": 9,
      "igstRate": 0,
      "cessRate": 0,
      "taxableAmount": 0,
      "cessNonAdvolAmount": 0,
      "cessAdvolRate": 0,
    }],
    "totalValue": 0,
    "cgstValue": 0,
    "sgstValue": 0,
    "igstValue": 0,
    "cessValue": 0,
    "cessNonAdvolValue": 0,
    "otherValue": 0,
    "totInvValue": 0,
  };
  return ewb;
}

function downloadEWayBill(shipment, yards) {
  const ewb = generateEWayBill(shipment, yards);
  const blob = new Blob([JSON.stringify(ewb, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = (shipment.shipment_number || "shipment") + "_ewb.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── MOBILE NAV ────────────────────────────────────────────────────────────────
function MobileNav({ onSignOut, role }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcType, setCalcType] = useState("Sawn");
  const [cf, setCF] = useState({ thick:"", width:"", len:"", pcs:"1", girth:"", logLen:"", logs:"1" });
  const sc = k => e => setCF(p => ({ ...p, [k]: e.target.value }));

  const isAdmin = role !== "worker";
  const tabs  = isAdmin ? ADMIN_TABS  : WORKER_TABS;
  const pages = isAdmin ? ADMIN_PAGES : WORKER_PAGES;

  const calcResult = (() => {
    try {
      if (calcType === "Sawn") return TM.sawnCFT(+cf.thick, +cf.width, +cf.len, +cf.pcs || 1);
      if (calcType === "Log")  return TM.hoppusCFT(+cf.girth, +cf.logLen, +cf.logs || 1);
      if (calcType === "Ply")  return TM.plywoodCBM(+cf.thick, +cf.width || 4, +cf.len || 8, +cf.pcs || 1);
      return null;
    } catch { return null; }
  })();

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 shadow-lg"
        style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black text-white">⚓</div>
          <span className="font-black text-base text-white">Dockside</span>
          {!isAdmin && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold ml-1">Worker</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setCalcOpen(p => !p); setMenuOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white text-lg">
            🧮
          </button>
          <button onClick={() => { setMenuOpen(p => !p); setCalcOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white text-xl">
            ☰
          </button>
        </div>
      </div>

      {/* Quick Calc Dropdown */}
      {calcOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-50 bg-white shadow-2xl border-b-2 border-blue-100 px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <p className="font-black text-gray-900">Quick Calculator</p>
            <button onClick={() => setCalcOpen(false)} className="text-gray-400 text-2xl font-bold">x</button>
          </div>
          <div className="flex gap-2 mb-3">
            {[["Sawn","Sawn Timber"],["Log","Round Log"],["Ply","Plywood"]].map(([v,l]) => (
              <button key={v} onClick={() => setCalcType(v)}
                className={cls("flex-1 py-2 rounded-xl text-xs font-bold", calcType === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600")}>
                {l}
              </button>
            ))}
          </div>
          {calcType === "Sawn" && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><p className="text-xs text-gray-400 mb-1">Thickness (mm)</p><Input type="number" value={cf.thick} onChange={sc("thick")} placeholder="25" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Width (mm)</p><Input type="number" value={cf.width} onChange={sc("width")} placeholder="150" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Length (ft)</p><Input type="number" value={cf.len} onChange={sc("len")} placeholder="8" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Pieces</p><Input type="number" value={cf.pcs} onChange={sc("pcs")} placeholder="1" /></div>
            </div>
          )}
          {calcType === "Log" && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div><p className="text-xs text-gray-400 mb-1">Girth (in)</p><Input type="number" value={cf.girth} onChange={sc("girth")} placeholder="36" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Length (ft)</p><Input type="number" value={cf.logLen} onChange={sc("logLen")} placeholder="12" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Logs</p><Input type="number" value={cf.logs} onChange={sc("logs")} placeholder="1" /></div>
            </div>
          )}
          {calcType === "Ply" && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div><p className="text-xs text-gray-400 mb-1">Thickness (mm)</p><Input type="number" value={cf.thick} onChange={sc("thick")} placeholder="18" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Width (ft)</p><Input type="number" value={cf.width} onChange={sc("width")} placeholder="4" /></div>
              <div><p className="text-xs text-gray-400 mb-1">Length (ft)</p><Input type="number" value={cf.len} onChange={sc("len")} placeholder="8" /></div>
            </div>
          )}
          {calcResult ? (
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="bg-blue-50 rounded-xl p-2 text-center">
                <p className="text-xs text-blue-400">Per piece</p>
                <p className="font-black text-blue-700 text-sm">{calcResult.cftPer || calcResult.cbmPer}</p>
                <p className="text-xs text-blue-400">{calcType === "Ply" ? "CBM" : "CFT"}</p>
              </div>
              <div className="bg-blue-600 rounded-xl p-2 text-center">
                <p className="text-xs text-blue-200">Total</p>
                <p className="font-black text-white text-lg">{calcResult.totalCFT || calcResult.totalCBM}</p>
                <p className="text-xs text-blue-200">{calcType === "Ply" ? "CBM" : "CFT"}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2 text-center">
                <p className="text-xs text-green-400">CBM</p>
                <p className="font-black text-green-700 text-sm">{calcResult.totalCBM || calcResult.totalCFT}</p>
                <p className="text-xs text-green-400">m3</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3 text-center text-gray-400 text-sm">Enter dimensions above</div>
          )}
        </div>
      )}

      {/* Full menu drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-72 bg-gray-900 z-50 md:hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div>
                <span className="text-white font-black text-lg">Dockside</span>
                <span className="ml-2 text-xs text-gray-400 capitalize">{role} account</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 text-2xl">x</button>
            </div>
            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {pages.map(n => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => cls(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold mb-1",
                    isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
                  )}>
                  <span className="text-lg">{n.icon}</span>{n.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-700">
              <button onClick={onSignOut}
                className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm text-gray-400 hover:bg-gray-800">
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex h-16">
          {tabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.to === "/"}
              className={({ isActive }) => cls(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors",
                isActive ? "text-blue-600" : "text-gray-400"
              )}>
              <span className="text-xl leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}

// ── THERMAL RECEIPT ────────────────────────────────────────────────────────────
function ThermalReceipt({ deal, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }, []);

  const printReceipt = () => {
    const html = "<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:monospace;width:80mm;margin:0 auto;padding:8px;font-size:12px}.c{text-align:center}.d{border-top:1px dashed #000;margin:6px 0}.b{font-weight:bold}</style></head><body>"
      + "<div class='c b' style='font-size:16px'>DOCKSIDE OS</div>"
      + "<div class='c'>Timber Trade Receipt</div>"
      + "<div class='d'></div>"
      + "<div>Customer: <b>" + deal.customer + "</b></div>"
      + "<div>Product: " + deal.product + "</div>"
      + "<div>Qty: " + deal.qty + " units @ Rs " + deal.price.toLocaleString("en-IN") + "</div>"
      + "<div class='d'></div>"
      + "<div class='b'>TOTAL: Rs " + deal.total.toLocaleString("en-IN") + "</div>"
      + "<div class='d'></div>"
      + "<div class='c'>Date: " + deal.date + "</div>"
      + "<div class='c'>Thank you!</div>"
      + "</body></html>";
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className={cls("absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}
        onClick={onClose} />
      <div className={cls("absolute left-1/2 -translate-x-1/2 w-72 pointer-events-auto transition-all duration-500", visible ? "top-4" : "-top-96")}>
        <svg viewBox="0 0 288 16" className="w-full" style={{ display:"block", marginBottom:"-1px" }}>
          <path d="M0,16 L0,8 L18,0 L36,8 L54,0 L72,8 L90,0 L108,8 L126,0 L144,8 L162,0 L180,8 L198,0 L216,8 L234,0 L252,8 L270,0 L288,8 L288,16 Z" fill="white"/>
        </svg>
        <div className="bg-white px-5 py-4">
          <div className="text-center mb-3">
            <p className="font-black text-gray-900 text-lg">Deal Created!</p>
            <p className="text-xs text-gray-400">Swipe deal card right to share via WhatsApp</p>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 font-mono text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-bold truncate max-w-36">{deal.customer}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Product</span><span className="font-bold truncate max-w-36">{deal.product}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Qty x Rate</span><span className="font-bold">{deal.qty} x Rs{deal.price.toLocaleString("en-IN")}</span></div>
            <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between">
              <span className="font-black">TOTAL</span>
              <span className="font-black text-green-700 text-lg">Rs{deal.total.toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={printReceipt} className="bg-gray-900 text-white font-bold text-xs py-2.5 rounded-xl">Print Receipt</button>
            <button onClick={onClose} className="bg-gray-100 text-gray-700 font-bold text-xs py-2.5 rounded-xl">Close</button>
          </div>
        </div>
        <svg viewBox="0 0 288 16" className="w-full" style={{ display:"block", marginTop:"-1px" }}>
          <path d="M0,0 L0,8 L18,16 L36,8 L54,16 L72,8 L90,16 L108,8 L126,16 L144,8 L162,16 L180,8 L198,16 L216,8 L234,16 L252,8 L270,16 L288,8 L288,0 Z" fill="white"/>
        </svg>
      </div>
    </div>
  );
}

// ── DEAL CARD WITH WHATSAPP ───────────────────────────────────────────────────
function DealCard({ deal: d, customers }) {
  const sendWhatsApp = () => {
    const name = d.customer_name || (customers.find(c => c.id === d.customer_id) || {}).name || "Customer";
    const total = (d.total_value || d.negotiated_price || 0).toLocaleString("en-IN");
    const ref = d.deal_number || d.id ? d.id.toString().slice(-6) : "";
    const msg = "Namaste " + name + "\n\n"
      + "Deal Confirmation:\n"
      + "Product: " + (d.product_name || "-") + "\n"
      + "Quantity: " + (d.quantity || "-") + " units\n"
      + "Total: Rs " + total + "\n"
      + "Status: " + (d.stage || d.status || "-") + "\n"
      + "Ref: " + ref + "\n\n"
      + "Dockside Trade OS";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  const stageColor = s => {
    const m = { completed:"green", delivered:"green", dispatched:"blue", confirmed:"blue" };
    return m[(s || "").toLowerCase()] || "gray";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 pr-2">
            <p className="font-black text-gray-900 text-base leading-tight">
              {d.customer_name || (customers.find(c => c.id === d.customer_id) || {}).name || "Customer"}
            </p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{d.deal_number || ""}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-green-700 text-xl leading-none">{fmt(d.total_value || d.negotiated_price)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(d.created_at)}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">{d.product_name || "-"}{d.quantity ? " - " + d.quantity + " units" : ""}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge text={d.stage || d.status || "draft"} color={stageColor(d.stage || d.status)} />
          <Badge text={d.payment_status || "-"} color={d.payment_status === "Paid" ? "green" : "orange"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-0">
        <button onClick={sendWhatsApp}
          className="bg-green-500 active:bg-green-600 flex items-center justify-center gap-2 py-2.5">
          <span className="text-white text-lg">W</span>
          <span className="text-white font-bold text-sm">WhatsApp</span>
        </button>
        <button onClick={() => printBluetooth(d)}
          className="bg-gray-800 active:bg-gray-900 flex items-center justify-center gap-2 py-2.5">
          <span className="text-white text-lg">🖨</span>
          <span className="text-white font-bold text-sm">BT Print</span>
        </button>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const [inv, setInv]     = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    sb.from("inventory").select("*").eq("company_id", companyId).order("created_at", { ascending:false }).then(r => setInv(r.data || []));
    sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending:false }).then(r => setDeals(r.data || []));
    sb.from("shipments").select("*").eq("company_id", companyId).then(r => setShips(r.data || []));
    sb.from("yards").select("*").eq("company_id", companyId).then(r => setYards(r.data || []));
  }, [companyId]);

  const totalValue   = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const activeShips  = ships.filter(s => s.status !== "Delivered").length;
  const activeYards  = yards.filter(y => y.is_active !== false).length;
  const pendingDeals = deals.filter(d => d.payment_status === "Pending");
  const pendingValue = pendingDeals.reduce((s, d) => s + (d.total_value || 0), 0);

  // FEATURE: Overdue payment alerts (> 30 days old, still pending)
  const now = Date.now();
  const overdueDeals = pendingDeals.filter(d => {
    if (!d.created_at) return false;
    const age = (now - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return age > 30;
  });

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Hero */}
      <div className="px-4 pt-4 pb-6" style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)" }}>
        <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Inventory Value</p>
        <p className="text-3xl font-black text-white">{fmt(totalValue)}</p>
        <div className="flex gap-5 mt-3">
          <div><p className="text-blue-300 text-xs">Products</p><p className="text-white font-bold text-lg">{inv.length}</p></div>
          <div><p className="text-blue-300 text-xs">Yards</p><p className="text-white font-bold text-lg">{activeYards}</p></div>
          <div><p className="text-blue-300 text-xs">Shipments</p><p className="text-white font-bold text-lg">{activeShips}</p></div>
          <div><p className="text-blue-300 text-xs">Deals</p><p className="text-white font-bold text-lg">{deals.length}</p></div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* FEATURE: Overdue payment alert */}
        {overdueDeals.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <p className="font-black text-red-700 text-base">Overdue Payments</p>
              <Badge text={overdueDeals.length + " deals"} color="red" />
            </div>
            <p className="text-red-600 text-sm mb-3">These payments are overdue by 30+ days</p>
            <div className="space-y-2">
              {overdueDeals.slice(0, 3).map(d => (
                <div key={d.id} className="bg-white rounded-xl px-3 py-2 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{d.customer_name || "Customer"}</p>
                    <p className="text-xs text-gray-400">{d.product_name || "-"}</p>
                  </div>
                  <p className="font-black text-red-600">{fmt(d.total_value)}</p>
                </div>
              ))}
            </div>
            {overdueDeals.length > 3 && (
              <p className="text-xs text-red-400 mt-2 text-center">+{overdueDeals.length - 3} more overdue</p>
            )}
          </div>
        )}

        {/* Pending summary */}
        {pendingDeals.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-orange-700">Pending Payments</p>
              <p className="text-xs text-orange-400">{pendingDeals.length} deals outstanding</p>
            </div>
            <p className="font-black text-orange-700 text-xl">{fmt(pendingValue)}</p>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label:"Inventory Value", value: fmt(totalValue), sub: inv.length + " products", icon:"📦", color:"bg-blue-600" },
            { label:"Active Shipments", value: activeShips, sub:"in transit", icon:"🚛", color:"bg-green-600" },
            { label:"Active Yards", value: activeYards, sub:"locations", icon:"🏗️", color:"bg-purple-600" },
            { label:"Total Deals", value: deals.length, sub:"transactions", icon:"🤝", color:"bg-indigo-600" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{c.icon}</span>
                <span className={cls("text-xs text-white font-bold px-2 py-0.5 rounded-full", c.color)}>{c.label}</span>
              </div>
              <p className="text-2xl font-black text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Recent stock */}
        {inv.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent Stock</p>
            <div className="space-y-2">
              {inv.slice(0, 4).map(i => (
                <div key={i.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between shadow-sm border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{i.product_name}</p>
                    <p className="text-xs text-gray-400">{i.category} - {i.wood_type || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-blue-700">{fmt((i.cost_price || 0) * (i.available_quantity || 0))}</p>
                    <p className="text-xs text-gray-400">{i.available_quantity} {i.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────
function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems]         = useState([]);
  const [yards, setYards]         = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [timberType, setTimberType] = useState("Sawn Timber");

  const INV_DEF = {
    product_name:"", category:"Plywood", wood_type:"", grade:"A Grade",
    yard_id:"", supplier_id:"", unit:"CFT", cost_price:"", market_value:"",
    available_quantity:"", date: today(), notes:"",
    thickness_mm:"", width_mm:"", length_ft:"", pieces:"",
    girth_in:"", log_length_ft:"", num_logs:"",
    sheet_thickness_mm:"", sheet_width_ft:"4", sheet_length_ft:"8", num_sheets:"",
  };
  const [form, setForm] = useState(INV_DEF);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const calc = (() => {
    try {
      if (timberType === "Sawn Timber") return TM.sawnCFT(+form.thickness_mm, +form.width_mm, +form.length_ft, +form.pieces || 1);
      if (timberType === "Round Log")   return TM.hoppusCFT(+form.girth_in, +form.log_length_ft, +form.num_logs || 1);
      if (timberType === "Plywood")     return TM.plywoodCBM(+form.sheet_thickness_mm, +form.sheet_width_ft, +form.sheet_length_ft, +form.num_sheets || 1);
    } catch { return null; }
    return null;
  })();

  useEffect(() => {
    if (!calc) return;
    const vol  = timberType === "Plywood" ? (calc.totalCBM || "") : (calc.totalCFT || "");
    const unit = timberType === "Plywood" ? "CBM" : "CFT";
    setForm(p => ({ ...p, available_quantity: vol, unit }));
  }, [timberType,
    form.thickness_mm, form.width_mm, form.length_ft, form.pieces,
    form.girth_in, form.log_length_ft, form.num_logs,
    form.sheet_thickness_mm, form.sheet_width_ft, form.sheet_length_ft, form.num_sheets]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        sb.from("inventory").select("*").eq("company_id", companyId).order("created_at", { ascending:false }),
        sb.from("yards").select("*").eq("company_id", companyId),
        sb.from("suppliers").select("*").eq("company_id", companyId),
        sb.from("customers").select("*").eq("company_id", companyId),
      ]);
      setItems(a.data || []); setYards(b.data || []);
      setSuppliers(c.data || []); setCustomers(d.data || []);
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeInv = () => { setShowAdd(false); setForm(INV_DEF); setErr(""); setTimberType("Sawn Timber"); };

  const save = async () => {
    if (!form.product_name.trim()) { setErr("Product name required"); return; }
    setSaving(true); setErr("");
    const yard = yards.find(y => y.id === form.yard_id);
    const sup  = suppliers.find(s => s.id === form.supplier_id);
    try {
      const { error } = await sb.from("inventory").insert([{
        company_id: companyId, product_name: form.product_name.trim(),
        category: form.category || null, wood_type: form.wood_type || null,
        quality_grade: form.grade || null, yard_id: form.yard_id || null,
        yard_name: yard ? yard.name : null, supplier_id: form.supplier_id || null,
        supplier_name: sup ? sup.name : null, unit: form.unit || "pcs",
        cost_price: parseNum(form.cost_price) || 0,
        market_value: parseNum(form.market_value) || 0,
        available_quantity: parseNum(form.available_quantity) || 0,
        total_quantity: parseNum(form.available_quantity) || 0,
        reserved_quantity: 0, date: form.date || today(), notes: form.notes || null,
        thickness_mm: parseNum(form.thickness_mm), width_mm: parseNum(form.width_mm),
        length_ft: parseNum(form.length_ft), pieces: parseNum(form.pieces),
        girth_in: parseNum(form.girth_in), log_length_ft: parseNum(form.log_length_ft),
        num_logs: parseNum(form.num_logs), sheet_thickness_mm: parseNum(form.sheet_thickness_mm),
        sheet_width_ft: parseNum(form.sheet_width_ft), sheet_length_ft: parseNum(form.sheet_length_ft),
        num_sheets: parseNum(form.num_sheets),
      }]);
      if (error) throw error;
      closeInv(); fetchAll();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setSaving(false); }
  };

  // FEATURE: WhatsApp Stock Broadcast
  const broadcastStock = () => {
    const lines = ["*Dockside - Stock Update*\n"];
    items.slice(0, 15).forEach(i => {
      lines.push("- " + i.product_name + ": " + i.available_quantity + " " + i.unit + " @ Rs" + (i.cost_price || 0).toLocaleString("en-IN"));
    });
    lines.push("\nContact us to place your order!");
    const msg = lines.join("\n");
    // Open WhatsApp for each customer
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  const filtered = items.filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));
  const totalInvValue = filtered.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Sticky header */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-black text-gray-900">Inventory</h1>
            <p className="text-xs text-gray-400">{items.length} products - {fmt(totalInvValue)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={broadcastStock}
              className="bg-green-500 active:bg-green-600 text-white font-bold text-xs px-3 py-2 rounded-xl">
              Broadcast
            </button>
            <button onClick={() => setShowAdd(true)}
              className="bg-blue-600 active:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl">
              + Add
            </button>
          </div>
        </div>
        <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {loading ? <Spinner /> : (
        <div className="px-4 pb-4 space-y-3 mt-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <p className="text-4xl mb-3">📦</p>
              <p className="font-semibold">No inventory yet</p>
              <p className="text-sm mt-1">Tap + Add to get started</p>
            </div>
          ) : filtered.map(i => (
            <div key={i.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-2">
                  <p className="font-black text-gray-900 text-base">{i.product_name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {i.category && <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{i.category}</span>}
                    {i.wood_type && <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">{i.wood_type}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-blue-700 text-lg">{fmt((i.cost_price || 0) * (i.available_quantity || 0))}</p>
                  <p className="text-xs text-gray-400">Total value</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                <div className="text-center"><p className="text-xs text-gray-400">Volume</p><p className="font-black text-gray-800">{i.available_quantity || 0}</p><p className="text-xs text-gray-400">{i.unit || "pcs"}</p></div>
                <div className="text-center"><p className="text-xs text-gray-400">Rate</p><p className="font-bold text-green-700 text-sm">{fmt(i.cost_price)}</p><p className="text-xs text-gray-400">per {i.unit}</p></div>
                <div className="text-center"><p className="text-xs text-gray-400">Yard</p><p className="font-semibold text-gray-700 text-xs">{(yards.find(y => y.id === i.yard_id) || {}).name || "-"}</p></div>
              </div>
              {(i.category === "Round Log" || (i.girth_in && i.girth_in > 0)) && (
                <button onClick={() => printQRLabel(i)}
                  className="mt-2 w-full bg-gray-800 active:bg-gray-900 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1">
                  Print QR Label (50x25mm)
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <SlidePanel title="Add Stock" open={showAdd} onClose={closeInv}>
        {calc && (
          <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-gray-900 text-white flex justify-between items-center mb-2">
            <div>
              <p className="text-xs text-gray-400 uppercase">Live Calculation</p>
              <p className="text-2xl font-black">{timberType === "Plywood" ? (calc.totalCBM + " CBM") : (calc.totalCFT + " CFT")}</p>
            </div>
            <p className="text-xs text-green-400">Auto-calculated</p>
          </div>
        )}
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Timber Type</p>
          <div className="grid grid-cols-2 gap-2">
            {["Sawn Timber","Round Log","Plywood","Other"].map(t => (
              <button key={t} onClick={() => setTimberType(t)}
                className={cls("px-3 py-2.5 rounded-xl text-sm font-semibold border",
                  timberType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <Field label="Product Name" required><Input value={form.product_name} onChange={set("product_name")} placeholder="e.g. BWR Plywood 18mm" /></Field>
        <Field label="Category">
          <Select value={form.category} onChange={set("category")}>
            <option>Plywood</option><option>Hardwood</option><option>Softwood</option>
            <option>Veneer</option><option>MDF</option><option>Particle Board</option><option>Round Log</option>
          </Select>
        </Field>
        <Field label="Wood / Species">
          <Select value={form.wood_type} onChange={set("wood_type")}>
            <option value="">- Select -</option>
            {["Teak (Sagwan)","Gurjan","Pine","Eucalyptus","Rubber Wood","Burma Teak","Hardwood (Mixed)","Softwood (Mixed)","Merbau","Oak"].map(s => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        {timberType === "Sawn Timber" && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-600 uppercase mb-3">Auto-calculates CFT</p>
            <Field label="Thickness (mm)"><Select value={form.thickness_mm} onChange={set("thickness_mm")}><option value="">- Select -</option>{[3,4,6,9,12,15,18,19,25,32,38,50,75,100].map(t => <option key={t} value={t}>{t} mm</option>)}</Select></Field>
            <Field label="Width (mm)"><Input type="number" value={form.width_mm} onChange={set("width_mm")} placeholder="150" /></Field>
            <Field label="Length (ft)"><Input type="number" value={form.length_ft} onChange={set("length_ft")} placeholder="8" /></Field>
            <Field label="Pieces"><Input type="number" value={form.pieces} onChange={set("pieces")} placeholder="100" /></Field>
            {calc && <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-blue-400">Per Piece</p><p className="font-bold text-blue-700">{calc.cftPer}</p></div>
              <div className="bg-blue-600 rounded-lg p-2 text-center"><p className="text-xs text-blue-200">Total CFT</p><p className="font-black text-white text-lg">{calc.totalCFT}</p></div>
              <div className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-blue-400">CBM</p><p className="font-bold text-blue-700">{calc.totalCBM}</p></div>
            </div>}
          </div>
        )}
        {timberType === "Round Log" && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-bold text-green-600 uppercase mb-3">Hoppus CFT</p>
            <Field label="Girth (inches)"><Input type="number" value={form.girth_in} onChange={set("girth_in")} placeholder="36" /></Field>
            <Field label="Length (ft)"><Input type="number" value={form.log_length_ft} onChange={set("log_length_ft")} placeholder="12" /></Field>
            <Field label="No. of Logs"><Input type="number" value={form.num_logs} onChange={set("num_logs")} placeholder="20" /></Field>
            {calc && <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-green-400">Per Log</p><p className="font-bold text-green-700">{calc.cftPer}</p></div>
              <div className="bg-green-600 rounded-lg p-2 text-center"><p className="text-xs text-green-200">Total CFT</p><p className="font-black text-white text-lg">{calc.totalCFT}</p></div>
              <div className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-green-400">CBM</p><p className="font-bold text-green-700">{calc.totalCBM}</p></div>
            </div>}
          </div>
        )}
        {timberType === "Plywood" && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-600 uppercase mb-3">Plywood CBM</p>
            <Field label="Thickness (mm)"><Select value={form.sheet_thickness_mm} onChange={set("sheet_thickness_mm")}><option value="">- Select -</option>{[3,4,6,9,12,15,18,19,25].map(t => <option key={t} value={t}>{t} mm</option>)}</Select></Field>
            <Field label="Width (ft)"><Input type="number" value={form.sheet_width_ft} onChange={set("sheet_width_ft")} placeholder="4" /></Field>
            <Field label="Length (ft)"><Input type="number" value={form.sheet_length_ft} onChange={set("sheet_length_ft")} placeholder="8" /></Field>
            <Field label="No. of Sheets"><Input type="number" value={form.num_sheets} onChange={set("num_sheets")} placeholder="500" /></Field>
            {calc && <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-amber-400">Per Sheet</p><p className="font-bold text-amber-700">{calc.cbmPer} m3</p></div>
              <div className="bg-amber-500 rounded-lg p-2 text-center"><p className="text-xs text-amber-100">Total CBM</p><p className="font-black text-white text-lg">{calc.totalCBM}</p></div>
              <div className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-amber-400">CFT</p><p className="font-bold text-amber-700">{calc.totalCFT}</p></div>
            </div>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost Price (Rs/unit)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0" /></Field>
          <Field label="Market Value"><Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade"><Select value={form.grade} onChange={set("grade")}><option>A Grade</option><option>B Grade</option><option>C Grade</option><option>FAS</option><option>Common</option></Select></Field>
          <Field label="Yard"><Select value={form.yard_id} onChange={set("yard_id")}><option value="">- Yard -</option>{yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
        </div>
        <Field label="Supplier"><Select value={form.supplier_id} onChange={set("supplier_id")}><option value="">- Supplier -</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={form.date} onChange={set("date")} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3 pt-2">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Add to Inventory"}</Btn>
          <Btn variant="secondary" onClick={closeInv}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── DEALS ─────────────────────────────────────────────────────────────────────
function Deals() {
  const { companyId } = useAuth();
  const [deals, setDeals]         = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("All");
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [custName, setCustName]   = useState("");
  const [receiptDeal, setReceiptDeal] = useState(null);
  const DEF = { customer_id:"", product_id:"", quantity:"", unit_price:"", status:"draft", payment_status:"Pending", notes:"" };
  const [form, setForm] = useState(DEF);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending:false }),
        sb.from("customers").select("*").eq("company_id", companyId),
        sb.from("inventory").select("*").eq("company_id", companyId),
      ]);
      setDeals(a.data || []); setCustomers(b.data || []); setInventory(c.data || []);
    } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Draft","Confirmed","Dispatched","Delivered","Completed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.status || d.stage || "").toLowerCase() === tab.toLowerCase());

  const closeDeal = () => { setShowAdd(false); setForm(DEF); setCustName(""); setErr(""); };
  const save = async () => {
    if (!form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty   = parseFloat(form.quantity) || 0;
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
      const productName = selProd ? selProd.product_name : "-";
      const customerName = custName || (custObj ? custObj.name : "Customer");
      setReceiptDeal({ customer: customerName, product: productName, qty, price, total: qty * price, date: new Date().toLocaleDateString("en-IN") });
      closeDeal(); fetchAll();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {receiptDeal && <ThermalReceipt deal={receiptDeal} onClose={() => setReceiptDeal(null)} />}

      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-black text-gray-900">Deals</h1>
            <p className="text-xs text-gray-400">{deals.length} total transactions</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-blue-600 active:bg-blue-700 text-white font-black text-sm px-5 py-2.5 rounded-xl">
            + New Deal
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cls("px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0",
                tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>
              {t} ({t === "All" ? deals.length : deals.filter(d => (d.status || d.stage || "").toLowerCase() === t.toLowerCase()).length})
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-3 px-4 pb-4 mt-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <p className="text-4xl mb-2">🤝</p>
              <p className="font-semibold">No deals yet</p>
            </div>
          ) : filtered.map(d => <DealCard key={d.id} deal={d} customers={customers} />)}
        </div>
      )}

      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 z-20 w-14 h-14 bg-blue-600 text-white text-3xl rounded-full shadow-lg flex items-center justify-center active:scale-95">
        +
      </button>

      <SlidePanel title="Create Deal" open={showAdd} onClose={closeDeal}>
        <Field label="Customer Name"><Input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Or Select from Records">
          <Select value={form.customer_id} onChange={set("customer_id")}>
            <option value="">- Select Customer -</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Product">
          <Select value={form.product_id} onChange={set("product_id")}>
            <option value="">- Select Product -</option>
            {inventory.map(i => <option key={i.id} value={i.id}>{i.product_name}</option>)}
          </Select>
        </Field>
        <Field label="Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
        <Field label="Unit Price (Rs)"><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
        {form.quantity && form.unit_price && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-green-700 font-semibold">Deal Value</span>
            <span className="font-black text-green-700 text-xl">{fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}
        <Field label="Stage">
          <Select value={form.status} onChange={set("status")}>
            <option value="draft">Draft</option><option value="confirmed">Confirmed</option>
            <option value="dispatched">Dispatched</option><option value="delivered">Delivered</option><option value="completed">Completed</option>
          </Select>
        </Field>
        <Field label="Payment Status">
          <Select value={form.payment_status} onChange={set("payment_status")}>
            <option>Pending</option><option>Partial</option><option>Paid</option>
          </Select>
        </Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <Btn onClick={save} disabled={saving}>{saving ? "Creating..." : "Create Deal"}</Btn>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ───────────────────────────────────────────────────────────────────
function Transit() {
  const { companyId } = useAuth();
  const [ships, setShips]   = useState([]);
  const [yards, setYards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState("All");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const DEF = { vehicle_number:"", driver_name:"", driver_phone:"", origin_yard_id:"", destination:"", dispatch_date:today(), expected_arrival:"", freight_cost:"", status:"Created", cargo_details:"" };
  const [form, setForm] = useState(DEF);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        sb.from("shipments").select("*").eq("company_id", companyId).order("created_at", { ascending:false }),
        sb.from("yards").select("*").eq("company_id", companyId),
      ]);
      setShips(a.data || []); setYards(b.data || []);
    } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Created","Loaded","Dispatched","In Transit","Arrived","Delivered"];
  const filtered = tab === "All" ? ships : ships.filter(s => (s.status || "").toLowerCase() === tab.toLowerCase());
  const statusColor = s => {
    const m = { delivered:"green", dispatched:"blue", "in transit":"blue", loaded:"orange", arrived:"purple" };
    return m[(s || "").toLowerCase()] || "gray";
  };

  const close = () => { setShowAdd(false); setForm(DEF); setErr(""); };
  const save = async () => {
    if (!form.destination) { setErr("Destination required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("shipments").insert([{
        company_id: companyId, shipment_number: "SHIP-" + Date.now().toString().slice(-7),
        vehicle_number: form.vehicle_number || null, driver_name: form.driver_name || null,
        driver_phone: form.driver_phone || null, origin_yard_id: form.origin_yard_id || null,
        destination: form.destination, dispatch_date: form.dispatch_date || null,
        expected_arrival: form.expected_arrival || null, freight_cost: parseNum(form.freight_cost) || 0,
        status: form.status, cargo_details: form.cargo_details || null,
      }]);
      if (error) throw error;
      close(); fetchAll();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-black text-gray-900">Transit</h1>
            <p className="text-xs text-gray-400">{ships.length} shipments</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-blue-600 active:bg-blue-700 text-white font-black text-sm px-5 py-2.5 rounded-xl">
            + Add
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cls("px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0",
                tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-3 px-4 pb-4 mt-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <p className="text-4xl mb-2">🚛</p>
              <p className="font-semibold">No shipments yet</p>
            </div>
          ) : filtered.map(s => (
            <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 pt-4 pb-3" onClick={() => setSelected(s)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-black text-gray-900 text-base">{s.vehicle_number || "No vehicle"}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.shipment_number}</p>
                  </div>
                  <Badge text={s.status || "-"} color={statusColor(s.status)} />
                </div>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <span className="text-gray-500">{(yards.find(y => y.id === s.origin_yard_id) || {}).name || "Origin"}</span>
                  <span className="text-blue-500 font-black">to</span>
                  <span className="font-bold text-gray-800">{s.destination || "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Driver: {s.driver_name || "None"}</span>
                  <span className="font-black text-gray-800">{fmt(s.freight_cost)}</span>
                </div>
                <p className="text-xs text-blue-500 mt-2 font-semibold">Tap for full details</p>
              </div>
              <button onClick={() => downloadEWayBill(s, yards)}
                className="flex items-center justify-center gap-2 bg-orange-50 active:bg-orange-100 py-2.5 border-t border-orange-100 w-full">
                <span className="text-orange-600 text-sm font-bold">E-Way Bill JSON</span>
                <span className="text-orange-500 text-xs">tap to download</span>
              </button>
              {s.driver_phone && (
                <a href={"tel:" + s.driver_phone}
                  className="flex items-center justify-center gap-2 bg-blue-50 active:bg-blue-100 py-3 border-t border-blue-100">
                  <span className="text-blue-700 font-bold text-sm">Call Driver: {s.driver_phone}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <SlidePanel title="Shipment Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">🚛</div>
              <div>
                <p className="font-black text-gray-800 text-lg">{selected.shipment_number}</p>
                <Badge text={selected.status || "-"} color={statusColor(selected.status)} />
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Vehicle and Driver</p>
              <DetailRow label="Vehicle No." value={selected.vehicle_number} />
              <DetailRow label="Driver Name" value={selected.driver_name} />
              <DetailRow label="Driver Phone" value={selected.driver_phone} />
              <DetailRow label="Freight Cost" value={fmt(selected.freight_cost)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Route</p>
              <DetailRow label="Origin Yard" value={(yards.find(y => y.id === selected.origin_yard_id) || {}).name} />
              <DetailRow label="Destination" value={selected.destination} />
              <DetailRow label="Dispatch" value={fmtDate(selected.dispatch_date)} />
              <DetailRow label="ETA" value={fmtDate(selected.expected_arrival)} />
            </div>
            {selected.driver_phone && (
              <a href={"tel:" + selected.driver_phone}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl">
                Call Driver
              </a>
            )}
          </>
        )}
      </SlidePanel>

      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 z-20 w-14 h-14 bg-blue-600 text-white text-3xl rounded-full shadow-lg flex items-center justify-center active:scale-95">
        +
      </button>

      <SlidePanel title="Add Shipment" open={showAdd} onClose={close}>
        <Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="GJ-12-AB-1234" /></Field>
        <Field label="Driver Name"><Input value={form.driver_name} onChange={set("driver_name")} /></Field>
        <Field label="Driver Phone"><Input value={form.driver_phone} onChange={set("driver_phone")} /></Field>
        <Field label="Origin Yard">
          <Select value={form.origin_yard_id} onChange={set("origin_yard_id")}>
            <option value="">- Select -</option>
            {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
        <Field label="Destination" required><Input value={form.destination} onChange={set("destination")} placeholder="City / address" /></Field>
        <Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={set("dispatch_date")} /></Field>
        <Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={set("expected_arrival")} /></Field>
        <Field label="Freight Cost"><Input type="number" value={form.freight_cost} onChange={set("freight_cost")} placeholder="0" /></Field>
        <Field label="Status">
          <Select value={form.status} onChange={set("status")}>
            {["Created","Loaded","Dispatched","In Transit","Arrived","Delivered"].map(s => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Cargo Details"><Textarea value={form.cargo_details} onChange={set("cargo_details")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3">
          <Btn onClick={save} disabled={saving}>{saving ? "Adding..." : "Add Shipment"}</Btn>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── INSIGHTS ──────────────────────────────────────────────────────────────────
function AIInsights() {
  const { companyId } = useAuth();
  const [inv, setInv]     = useState([]);
  const [deals, setDeals] = useState([]);
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sb.from("inventory").select("*").eq("company_id", companyId),
      sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending:false }),
      sb.from("yards").select("*").eq("company_id", companyId),
    ]).then(([a, b, c]) => {
      setInv(a.data || []); setDeals(b.data || []); setYards(c.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  const totalValue   = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const paidDeals    = deals.filter(d => d.payment_status === "Paid");
  const pendingDeals = deals.filter(d => d.payment_status === "Pending");
  const revenue      = paidDeals.reduce((s, d) => s + (d.total_value || 0), 0);
  const pending      = pendingDeals.reduce((s, d) => s + (d.total_value || 0), 0);
  const lowStock     = inv.filter(i => (i.available_quantity || 0) < 10);

  // FEATURE: Yard-wise valuation
  const yardValuations = yards.map(y => {
    const yInv = inv.filter(i => i.yard_id === y.id);
    const value = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
    const units = yInv.reduce((s, i) => s + (i.available_quantity || 0), 0);
    return { ...y, value, units, items: yInv.length };
  }).filter(y => y.items > 0).sort((a, b) => b.value - a.value);

  const catMap = {};
  inv.forEach(i => {
    const c = i.category || "Other";
    catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0);
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  if (loading) return <Spinner />;

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-gray-900">Insights</h1>
        <p className="text-gray-400 text-sm">Business analytics</p>
      </div>
      <div className="px-4 space-y-4">
        {/* P&L Hero */}
        <div className="bg-gradient-to-br from-gray-900 to-blue-950 rounded-2xl p-5 text-white">
          <p className="text-blue-300 text-xs mb-1">Total Inventory Value</p>
          <p className="text-3xl font-black">{fmt(totalValue)}</p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bg-white/10 rounded-xl p-3 text-center"><p className="text-blue-300 text-xs mb-1">Revenue</p><p className="font-black text-green-400 text-sm">{fmt(revenue)}</p></div>
            <div className="bg-white/10 rounded-xl p-3 text-center"><p className="text-blue-300 text-xs mb-1">Pending</p><p className="font-black text-orange-400 text-sm">{fmt(pending)}</p></div>
            <div className="bg-white/10 rounded-xl p-3 text-center"><p className="text-blue-300 text-xs mb-1">Products</p><p className="font-black text-white text-sm">{inv.length}</p></div>
          </div>
        </div>

        {/* FEATURE: Yard-wise valuation */}
        {yardValuations.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Yard-wise Valuation</p>
            <div className="space-y-3">
              {yardValuations.map(y => (
                <div key={y.id}>
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <span className="text-sm font-bold text-gray-800">{y.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{y.items} products - {Math.round(y.units)} units</span>
                    </div>
                    <span className="text-sm font-black text-blue-700">{fmt(y.value)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full"
                      style={{ width: totalValue > 0 ? Math.min(100, (y.value / totalValue) * 100) + "%" : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {topCats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Value by Category</p>
            <div className="space-y-3">
              {topCats.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">{cat}</span>
                    <span className="text-sm font-black text-gray-900">{fmt(val)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full"
                      style={{ width: totalValue > 0 ? Math.min(100, (val / totalValue) * 100) + "%" : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low stock alerts */}
        {lowStock.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-3">Low Stock Alerts</p>
            <div className="space-y-2">
              {lowStock.slice(0, 5).map(i => (
                <div key={i.id} className="flex justify-between items-center bg-red-50 rounded-xl px-3 py-2.5">
                  <div><p className="font-semibold text-gray-800 text-sm">{i.product_name}</p><p className="text-xs text-gray-400">{i.category}</p></div>
                  <Badge text={i.available_quantity + " " + (i.unit || "left")} color="red" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deal stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-black text-green-600">{paidDeals.length}</p>
            <p className="text-xs text-gray-400 mt-1">Paid</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-black text-orange-600">{pendingDeals.length}</p>
            <p className="text-xs text-gray-400 mt-1">Pending</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-black text-blue-600">{deals.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── MOBILE APP SHELL ──────────────────────────────────────────────────────────
export default function MobileApp({ user, companyId, role, onSignOut }) {
  const isAdmin = role !== "worker";

  return (
    <AuthCtx.Provider value={{ user, companyId, role }}>
      <MobileNav onSignOut={onSignOut} role={role} />
      <div className="min-h-screen pt-14 pb-16 bg-gray-50">
        <Routes>
          {/* Always accessible */}
          <Route path="/inventory"   element={<Inventory />} />
          <Route path="/transit"     element={<Transit />} />

          {/* Admin only - redirect workers to inventory */}
          <Route path="/"            element={isAdmin ? <Dashboard />   : <Navigate to="/inventory" />} />
          <Route path="/deals"       element={isAdmin ? <Deals />       : <Navigate to="/inventory" />} />
          <Route path="/ai-insights" element={isAdmin ? <AIInsights />  : <Navigate to="/inventory" />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to={isAdmin ? "/" : "/inventory"} />} />
        </Routes>
      </div>
    </AuthCtx.Provider>
  );
}
