import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { sb, signIn, signOut, db } from "./lib/supabase";

// ── GLOBAL STYLES ──────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 12px rgba(59,130,246,0.5); } 50% { box-shadow: 0 0 24px rgba(59,130,246,0.9); } }
    .animate-slideDown { animation: slideDown 0.25s ease-out; }
    .animate-slideUp { animation: slideUp 0.3s ease-out; }
    .glow-blue { animation: pulse-glow 2s infinite; }
  `}</style>
);

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

// ── AUTH CONTEXT ───────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

// ── SHARED UI ──────────────────────────────────────────────────────────────────
const SlidePanel = ({ title, open, onClose, children, wide }) => (
  <>
    {open && <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />}
    <div className={cls(
      "fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col",
      "w-full md:w-[480px]",
      wide && "md:w-[600px]",
      open ? "translate-x-0" : "translate-x-full"
    )}>
      <div className="flex items-center justify-between px-4 py-4 border-b bg-gradient-to-r from-gray-900 to-gray-800 shrink-0">
        <h2 className="text-base font-black text-white">{title}</h2>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl transition-all">×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">{children}</div>
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
const Input = ({ ...p }) => <input {...p} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />;
const Select = ({ children, ...p }) => <select {...p} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 bg-white transition-all">{children}</select>;
const Textarea = ({ ...p }) => <textarea {...p} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />;
const Btn = ({ children, onClick, disabled, variant = "primary", small }) => (
  <button onClick={onClick} disabled={disabled}
    className={cls(
      "rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95",
      small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
      variant === "primary"
        ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm shadow-blue-200"
        : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
    )}>
    {children}
  </button>
);
const Badge = ({ text, color = "gray" }) => {
  const c = { gray:"bg-gray-100 text-gray-600 border border-gray-200", blue:"bg-blue-50 text-blue-700 border border-blue-200", green:"bg-emerald-50 text-emerald-700 border border-emerald-200", orange:"bg-orange-50 text-orange-700 border border-orange-200", red:"bg-red-50 text-red-600 border border-red-200", purple:"bg-purple-50 text-purple-700 border border-purple-200" };
  return <span className={cls("px-2.5 py-0.5 rounded-full text-xs font-bold", c[color] || c.gray)}>{text}</span>;
};
const ErrBanner = ({ msg }) => msg ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2">
    <span className="mt-0.5">⚠</span><span>{msg}</span>
  </div>
) : null;
const StatCard = ({ label, value, icon, color = "blue" }) => {
  const bg = { blue:"from-blue-500 to-blue-600", green:"from-emerald-500 to-green-600", orange:"from-orange-400 to-orange-500", purple:"from-purple-500 to-purple-600", red:"from-red-500 to-red-600" };
  const light = { blue:"bg-blue-50 text-blue-600", green:"bg-emerald-50 text-emerald-600", orange:"bg-orange-50 text-orange-600", purple:"bg-purple-50 text-purple-600", red:"bg-red-50 text-red-600" };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={cls("w-11 h-11 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br text-white shadow-sm", bg[color])}>{icon}</div>
      <div><p className="text-xs text-gray-400 font-medium tracking-wide">{label}</p><p className="text-xl font-black text-gray-900 mt-0.5 leading-none">{value}</p></div>
    </div>
  );
};
const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);
const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-36 shrink-0">{label}</span>
    <span className="text-sm text-gray-800 font-medium text-right">{value || "—"}</span>
  </div>
);

// ── TIMBER MATH ────────────────────────────────────────────────────────────────
const TM = {
  sawnCFT(thickMM, widthMM, lengthFt, pieces = 1) {
    if (!thickMM || !widthMM || !lengthFt) return null;
    const cftPer = (thickMM * widthMM * lengthFt) / (144 * 25.4 * 25.4);
    return { cftPer: r4(cftPer), totalCFT: r4(cftPer * pieces), totalCBM: r4(cftPer * pieces / 35.3147) };
  },
  hoppusCFT(girthIn, lengthFt, logs = 1) {
    if (!girthIn || !lengthFt) return null;
    const cftPer = Math.pow(girthIn / 4, 2) * lengthFt / 144;
    return { cftPer: r4(cftPer), totalCFT: r4(cftPer * logs), totalCBM: r4(cftPer * logs / 35.3147) };
  },
  plywoodCBM(thickMM, widthFt = 4, lengthFt = 8, sheets = 1) {
    if (!thickMM) return null;
    const cbmPer = (thickMM / 1000) * (widthFt * 0.3048) * (lengthFt * 0.3048);
    return { cbmPer: r4(cbmPer), totalCBM: r4(cbmPer * sheets), totalCFT: r4(cbmPer * sheets * 35.3147) };
  },
};
function r4(n) { return Math.round((n || 0) * 10000) / 10000; }

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);

  const submit = async () => {
    if (!email || !password) { setErr("Enter your email and password"); return; }
    setLoading(true); setErr("");
    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      onLogin(data.user);
    } catch (e) {
      setErr("Incorrect email or password.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}>
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl font-black">⚓</div>
          <div><div className="text-white font-black text-lg">Dockside</div><div className="text-blue-400 text-xs">Trade Operating System</div></div>
        </div>
        <div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">Run your timber business smarter.</h1>
          <p className="text-blue-300 text-base leading-relaxed mb-8">Inventory, yards, deals, transit — all in one place. Built for Gandhidham timber market.</p>
          <div className="grid grid-cols-2 gap-4">
            {[{icon:"📦",label:"Inventory",desc:"CFT, CBM, Hoppus"},{icon:"🤝",label:"GST Invoicing",desc:"Tax-ready bills"},{icon:"🚛",label:"Transit",desc:"Live shipment status"},{icon:"📊",label:"Reports",desc:"Real-time financials"}].map(f => (
              <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-white text-sm font-semibold">{f.label}</div>
                <div className="text-blue-300 text-xs mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-blue-400 text-xs">© 2025 Dockside Trade OS</div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl">⚓</div>
            <div className="text-white font-black text-lg">Dockside ERP</div>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-black text-gray-900">Welcome back</h2>
              <p className="text-gray-400 text-sm mt-1">Sign in to your workspace</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()} placeholder="you@company.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
                    placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600">{showPass ? "Hide" : "Show"}</button>
                </div>
              </div>
              {err && <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm">{err}</div>}
              <button onClick={submit} disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 text-sm">
                {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Signing in…</span> : "Sign In to Dockside"}
              </button>
            </div>
            <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-xs text-gray-400">Secured by Supabase · Data stored in India</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NEW USER SETUP ────────────────────────────────────────────────────────────
// Shown to users who signed up but have no company yet.
// Creates a company record + user_profile row, then lets them into the app.
function NewUserSetup({ user, onDone, onSignOut }) {
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const setup = async () => {
    if (!companyName.trim()) { setErr("Company name is required"); return; }
    setSaving(true); setErr("");
    try {
      // 1. Create company record
      const { data: co, error: coErr } = await sb.from("company").insert([{
        name: companyName.trim(),
        owner_name: ownerName.trim() || null,
        city: city.trim() || null,
        industry: "Timber Trade",
      }]).select().single();
      if (coErr) throw coErr;

      // 2. Create user_profile linking this user to the new company
      const { error: upErr } = await sb.from("user_profiles").insert([{
        user_id: user.id,
        company_id: co.id,
        full_name: ownerName.trim() || user.email,
        role: "owner",
      }]);
      if (upErr) throw upErr;

      // 3. Done — pass companyId back to App root
      onDone(co.id);
    } catch (e) {
      setErr(e.message || "Setup failed. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl mx-auto mb-4">⚓</div>
          <h1 className="text-2xl font-black text-white">Welcome to Dockside</h1>
          <p className="text-blue-300 text-sm mt-1">Set up your company to get started</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div>
            <p className="text-xs text-gray-400 mb-4">
              Signed in as <span className="font-semibold text-gray-600">{user.email}</span>
            </p>
          </div>
          <Field label="Company / Business Name" required>
            <Input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && setup()}
              placeholder="e.g. Chauhan Timber Pvt Ltd"
              autoFocus
            />
          </Field>
          <Field label="Your Name">
            <Input
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="e.g. Ravi Chauhan"
            />
          </Field>
          <Field label="City">
            <Input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Gandhidham"
            />
          </Field>

          {err && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2">
              <span className="text-red-500 text-sm">⚠</span>
              <span className="text-red-600 text-sm">{err}</span>
            </div>
          )}

          <button onClick={setup} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 text-sm">
            {saving
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Creating your workspace…</span>
              : "Create My Workspace →"
            }
          </button>

          <button onClick={onSignOut} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}


export { GlobalStyles, useAuth, AuthCtx, TM, fmt, fmtDate, cls, today, parseNum };
export { SlidePanel, DetailRow, Field, Input, Select, Textarea, Btn, Badge, ErrBanner, StatCard, Spinner };
export { Login, NewUserSetup };
