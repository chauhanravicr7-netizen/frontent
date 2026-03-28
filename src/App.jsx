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
    <div className="flex items-center gap-
