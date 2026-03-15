import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { sb, signIn, signOut, db } from "./lib/supabase";

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

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
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
const MOBILE_NAV = [
  { to: "/", label: "Home", icon: "⬛" },
  { to: "/inventory", label: "Stock", icon: "📦" },
  { to: "/deals", label: "Deals", icon: "🤝" },
  { to: "/transit", label: "Transit", icon: "🚛" },
  { to: "/ai-insights", label: "Insights", icon: "📊" },
];

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
    <nav className="flex-1 py-3 px-2">
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

const MobileNav = ({ onSignOut }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      {/* Top bar - mobile only */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 text-white flex items-center justify-between px-4 py-3 shadow-lg" style={{background:"linear-gradient(135deg,#0f172a,#1e3a5f)"}}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black shadow-sm">⚓</div>
          <span className="font-black text-base tracking-tight">Dockside</span>
        </div>
        <button onClick={() => setMenuOpen(p => !p)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white text-lg">☰</button>
      </div>

      {/* Full menu drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-72 bg-gray-900 z-50 md:hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <span className="text-white font-black text-lg">⚓ Dockside</span>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {NAV.map(n => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => cls(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold mb-1 transition-all",
                    isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}>
                  <span className="text-lg">{n.icon}</span>{n.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-700">
              <button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex shadow-lg">
        {MOBILE_NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}
            className={({ isActive }) => cls(
              "flex-1 flex flex-col items-center justify-center py-2.5 text-xs font-bold transition-all relative",
              isActive ? "text-blue-600" : "text-gray-400"
            )}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />}
                <span className={cls("text-xl mb-0.5 transition-transform", isActive ? "scale-110" : "")}>{n.icon}</span>
                <span>{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </>
  );
};

// ── AUTH (LOGIN + SIGNUP) ─────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "success"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);

  const switchMode = (m) => { setMode(m); setErr(""); setPassword(""); setConfirmPass(""); };

  const handleSignIn = async () => {
    if (!email || !password) { setErr("Please enter your email and password"); return; }
    setLoading(true); setErr("");
    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      onLogin(data.user);
    } catch (e) {
      setErr(e.message === "Invalid login credentials" ? "Incorrect email or password. Please try again." : e.message);
    } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!email || !password) { setErr("Email and password are required"); return; }
    if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (password !== confirmPass) { setErr("Passwords do not match"); return; }
    setLoading(true); setErr("");
    try {
      // signup disabled
      throw new Error("Self-registration is disabled. Contact your administrator.");

      // Supabase silently returns existing user when email already registered.
      // Detect this: identities array is empty on duplicate signup.
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      if (error) throw error;

      // New user created successfully
      if (data.user && data.session) {
        // Email confirmation OFF → straight into app
        onLogin(data.user);
      } else {
        // Email confirmation ON → show check email screen
        setMode("success");
      }
    } catch (e) {
      setErr(e.message || "Sign up failed. Please try again.");
    } finally { setLoading(false); }
  };

  const FEATURES = [
    { icon:"📦", label:"Inventory Tracking", desc:"CFT, CBM, Hoppus math" },
    { icon:"🤝", label:"GST Invoicing", desc:"Tax-ready bills" },
    { icon:"🚛", label:"Transit Tracking", desc:"Live shipment status" },
    { icon:"📊", label:"P&L Reports", desc:"Real-time financials" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}>
      {/* ── LEFT BRAND PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl font-black">⚓</div>
          <div>
            <div className="text-white font-black text-lg tracking-tight">Dockside</div>
            <div className="text-blue-400 text-xs">Trade Operating System</div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            {mode === "signup" ? "Join Dockside today." : "Run your timber business smarter."}
          </h1>
          <p className="text-blue-300 text-base leading-relaxed mb-8">
            Inventory, yards, deals, transit, and invoicing — all in one place. Built for Gandhidham's timber market.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-white text-sm font-semibold">{f.label}</div>
                <div className="text-blue-300 text-xs mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-blue-400 text-xs">© 2025 Dockside Trade OS · Built for timber traders</div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl">⚓</div>
            <div className="text-white font-black text-lg">Dockside ERP</div>
          </div>

          {/* ── SUCCESS STATE (email verification needed) ── */}
          {mode === "success" ? (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✉️</div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-6">
                We sent a confirmation link to<br />
                <span className="font-bold text-gray-700">{email}</span>
              </p>
              <p className="text-gray-400 text-xs mb-6">Click the link in the email to activate your account, then come back here to sign in.</p>
              <button onClick={() => switchMode("signin")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all text-sm">
                Back to Sign In
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              {/* ── TAB SWITCHER ── */}
              <div className="flex bg-gray-100 rounded-xl p-1 mb-7">
                <button onClick={() => switchMode("signin")}
                  className={cls("flex-1 py-2 text-sm font-bold rounded-lg transition-all", mode === "signin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600")}>
                  Sign In
                </button>
                <button onClick={() => switchMode("signup")}
                  className={cls("flex-1 py-2 text-sm font-bold rounded-lg transition-all", mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600")}>
                  Create Account
                </button>
              </div>

              {/* ── HEADING ── */}
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gray-900">
                  {mode === "signin" ? "Welcome back" : "Get started free"}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {mode === "signin" ? "Sign in to your workspace" : "Create your Dockside account"}
                </p>
              </div>

              {/* ── FORM FIELDS ── */}
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✉</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      onKeyDown={e => e.key === "Enter" && (mode === "signin" ? handleSignIn() : handleSignUp())}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔒</span>
                    <input type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && mode === "signin" && handleSignIn()}
                      placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-16 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <button onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-semibold">
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password (signup only) */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔒</span>
                      <input type={showPass ? "text" : "password"} value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSignUp()}
                        placeholder="Repeat your password"
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    {/* Password match indicator */}
                    {confirmPass && (
                      <p className={cls("text-xs mt-1.5 font-medium", password === confirmPass ? "text-green-600" : "text-red-500")}>
                        {password === confirmPass ? "✓ Passwords match" : "✗ Passwords do not match"}
                      </p>
                    )}
                  </div>
                )}

                {/* Error */}
                {err && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                    <span className="text-red-500 text-sm shrink-0">⚠</span>
                    <span className="text-red-600 text-sm">{err}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={mode === "signin" ? handleSignIn : handleSignUp}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 text-sm tracking-wide mt-1">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />{mode === "signin" ? "Signing in…" : "Creating account…"}</span>
                    : mode === "signin" ? "Sign In to Dockside" : "Create My Account"
                  }
                </button>

                {/* Terms (signup only) */}
                {mode === "signup" && (
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    By creating an account you agree to use this platform responsibly. Your data is stored securely.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-xs text-gray-400">Secured by Supabase · Data stored in India</span>
              </div>
            </div>
          )}
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

// ── APP ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined);
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Resolve companyId: try user_metadata first, then user_profiles table
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setCompanyId("__resolved__"); return; }
    const metaCid = user.user_metadata?.company_id;
    if (metaCid) { setCompanyId(metaCid); return; }
    sb.from("user_profiles").select("company_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCompanyId(data?.company_id || "__none__"))
      .catch(() => setCompanyId("__none__"));
  }, [user]);

  const handleSignOut = async () => { await signOut(); setUser(null); setCompanyId(null); };

  if (user === undefined || companyId === null) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">⚓</div>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-3" />
      </div>
    </div>
  );

  if (!user || companyId === "__resolved__") return <Login onLogin={setUser} />;

  // New user: signed up but has no company assigned yet
  if (companyId === "__none__") return <NewUserSetup user={user} onDone={(cid) => setCompanyId(cid)} onSignOut={async () => { await signOut(); setUser(null); setCompanyId(null); }} />;

  const resolvedCompanyId = companyId;

  return (
    <AuthCtx.Provider value={{ user, companyId: resolvedCompanyId }}>
      <BrowserRouter>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar onSignOut={handleSignOut} />
          <MobileNav onSignOut={handleSignOut} />
          <div className="flex-1 md:ml-52 min-h-screen pt-14 md:pt-0 pb-16 md:pb-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/yards" element={<Yards />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/transit" element={<Transit />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/financials" element={<Financials />} />
              <Route path="/ai-insights" element={<AIInsights />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/company" element={<Company />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}

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

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [yards, setYards] = useState([]);

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

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Mobile Hero Banner ── */}
      <div className="md:hidden px-4 pt-4 pb-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)"}}>
        <p className="text-blue-300 text-xs mb-1">Total Inventory Value</p>
        <p className="text-3xl font-black text-white">{fmt(totalValue)}</p>
        <div className="flex gap-4 mt-3">
          <div><p className="text-blue-300 text-xs">Products</p><p className="text-white font-bold">{inv.length}</p></div>
          <div><p className="text-blue-300 text-xs">Active Yards</p><p className="text-white font-bold">{activeYards}</p></div>
          <div><p className="text-blue-300 text-xs">Shipments</p><p className="text-white font-bold">{activeShips}</p></div>
          <div><p className="text-blue-300 text-xs">Deals</p><p className="text-white font-bold">{deals.length}</p></div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Desktop heading */}
        <div className="hidden md:block"><h1 className="text-2xl font-black text-gray-800">Command Center</h1><p className="text-gray-400 text-sm">Live business overview</p></div>

        {/* ── Mobile Quick Actions ── */}
        <div className="md:hidden grid grid-cols-2 gap-3">
          {[
            { label:"Inventory Value", value: fmt(totalValue), sub: `${inv.length} products`, color:"bg-blue-600", icon:"📦" },
            { label:"Pending Payments", value: pendingPay, sub: `of ${deals.length} deals`, color:"bg-orange-500", icon:"⏳" },
            { label:"Active Shipments", value: activeShips, sub: "in transit", color:"bg-green-600", icon:"🚛" },
            { label:"Active Yards", value: activeYards, sub: "locations", color:"bg-purple-600", icon:"🏗️" },
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

        {/* Desktop stat grid */}
        <div className="hidden md:grid grid-cols-4 gap-4">
          <StatCard label="Inventory Value" value={fmt(totalValue)} icon="📦" color="blue" />
          <StatCard label="Total Volume" value={`${Math.round(totalVolume)} units`} icon="📊" color="green" />
          <StatCard label="Active Shipments" value={activeShips} icon="🚛" color="orange" />
          <StatCard label="Active Yards" value={activeYards} icon="🏗️" color="purple" />
          <StatCard label="Total Deals" value={deals.length} icon="🤝" color="green" />
          <StatCard label="Total Products" value={inv.length} icon="🪵" color="orange" />
          <StatCard label="Pending Payments" value={pendingPay} icon="⏳" color="purple" />
          <StatCard label="Delivered" value={ships.filter(s => s.status === "Delivered").length} icon="✅" color="blue" />
        </div>

        {/* ── Recent Activity (mobile) ── */}
        {inv.length > 0 && (
          <div className="md:hidden">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent Stock</p>
            <div className="space-y-2">
              {inv.slice(0,3).map(i => (
                <div key={i.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between shadow-sm border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{i.product_name}</p>
                    <p className="text-xs text-gray-400">{i.category} · {i.wood_type || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-blue-700">{fmt((i.cost_price||0)*(i.available_quantity||0))}</p>
                    <p className="text-xs text-gray-400">{i.available_quantity} {i.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
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

// ── INVENTORY ──────────────────────────────────────────────────────────────────
function Inventory() {
  const { companyId } = useAuth();
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [timberType, setTimberType] = useState("Sawn Timber");
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
  }, [calc?.totalCFT, calc?.totalCBM, timberType]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        sb.from("inventory").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId).order("name"),
        sb.from("suppliers").select("*").eq("company_id", companyId).order("name"),
      ]);
      setItems(a.data || []); setYards(b.data || []); setSuppliers(c.data || []);
    } catch(e) { console.error("Inventory fetch:", e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeInv = () => { setShowAdd(false); setForm(INV_DEFAULTS); setErr(""); setTimberType("Sawn Timber"); };
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
      closeInv(); fetchAll();
    } catch (e) { setErr(e.message || JSON.stringify(e)); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(i => !search || (i.product_name || "").toLowerCase().includes(search.toLowerCase()));

  const totalInvValue = filtered.reduce((s,i) => s + (i.cost_price||0)*(i.available_quantity||0), 0);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Mobile Header ── */}
      <div className="md:hidden sticky top-14 z-20 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-black text-gray-900">Inventory</h1>
            <p className="text-xs text-gray-400">{items.length} products · {fmt(totalInvValue)}</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm shadow-blue-200 active:scale-95 transition-all">
            + Add Stock
          </button>
        </div>
        <input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* ── Desktop Header ── */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div><h1 className="text-2xl font-black text-gray-800">Inventory</h1><p className="text-gray-400 text-sm">{items.length} products</p></div>
        <div className="flex gap-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Btn onClick={() => setShowAdd(true)}>+ Add Stock</Btn>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── MOBILE: Card List ── */}
          <div className="md:hidden px-4 pb-4 space-y-3 mt-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <p className="text-4xl mb-3">📦</p>
                <p>No inventory yet. Tap + Add to get started.</p>
              </div>
            ) : filtered.map(i => (
              <div key={i.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 pr-2">
                    <p className="font-black text-gray-900 text-base leading-tight">{i.product_name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {i.category && <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{i.category}</span>}
                      {i.wood_type && <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">{i.wood_type}</span>}
                      {i.grade && <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">{i.grade}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-blue-700 text-lg">{fmt((i.cost_price||0)*(i.available_quantity||0))}</p>
                    <p className="text-xs text-gray-400">Total value</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Volume</p>
                    <p className="font-black text-gray-800">{i.available_quantity || 0}</p>
                    <p className="text-xs text-gray-400">{i.unit || "pcs"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Rate</p>
                    <p className="font-bold text-green-700 text-sm">{fmt(i.cost_price)}</p>
                    <p className="text-xs text-gray-400">per {i.unit || "unit"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Yard</p>
                    <p className="font-semibold text-gray-700 text-xs leading-tight">{yards.find(y => y.id === i.yard_id)?.name || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP: Table ── */}
          <div className="hidden md:block px-6 pb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{["Product","Type","Wood / Species","Grade","Yard","Volume","Unit","Cost/Unit","Total Value"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">{i.product_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{i.category || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{i.wood_type || "—"}</td>
                      <td className="px-4 py-3"><Badge text={i.grade || "—"} /></td>
                      <td className="px-4 py-3 text-gray-500">{yards.find(y => y.id === i.yard_id)?.name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{i.available_quantity || 0}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i.unit || "pcs"}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fmt(i.cost_price)}</td>
                      <td className="px-4 py-3 font-bold text-blue-700">{fmt((i.cost_price||0)*(i.available_quantity||0))}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-300">No inventory found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <SlidePanel title="Add Stock" open={showAdd} onClose={closeInv} wide>
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Timber Type</p>
          <div className="flex gap-2">
            {["Sawn Timber","Round Log","Plywood","Other"].map(t => (
              <button key={t} onClick={() => setTimberType(t)} className={cls(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                timberType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              )}>{t}</button>
            ))}
          </div>
        </div>
        <Field label="Product Name" required>
          <Input value={form.product_name} onChange={set("product_name")} placeholder={
            timberType === "Sawn Timber" ? "e.g. Gurjan Sawn 18mm" :
            timberType === "Round Log" ? "e.g. Teak Round Log" :
            timberType === "Plywood" ? "e.g. BWR Plywood 18mm" : "Product name"
          } />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              <option>Plywood</option><option>Hardwood</option><option>Softwood</option>
              <option>Veneer</option><option>MDF</option><option>Particle Board</option><option>Round Log</option>
            </Select>
          </Field>
          <Field label="Wood / Species">
            <Select value={form.wood_type} onChange={set("wood_type")}>
              <option value="">— Select —</option>
              {["Teak (Sagwan)","Gurjan","Pine","Eucalyptus","Rubber Wood","Burma Teak","Hardwood (Mixed)","Softwood (Mixed)","Merbau","Oak","Sal","Shisham"].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Grade">
            <Select value={form.grade} onChange={set("grade")}>
              <option>A Grade</option><option>B Grade</option><option>C Grade</option>
              <option>FAS</option><option>Select</option><option>Common</option><option>Industrial</option>
            </Select>
          </Field>
          <Field label="Yard">
            <Select value={form.yard_id} onChange={set("yard_id")}>
              <option value="">— Select Yard —</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
        </div>
        {timberType === "Sawn Timber" && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">📐 Auto-calculates CFT</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="Thickness (mm)">
                <Select value={form.thickness_mm} onChange={set("thickness_mm")}>
                  <option value="">— Select —</option>
                  {[3,4,6,9,12,15,18,19,25,32,38,50,75,100].map(t => <option key={t} value={t}>{t} mm</option>)}
                </Select>
              </Field>
              <Field label="Width (mm)"><Input type="number" value={form.width_mm} onChange={set("width_mm")} placeholder="e.g. 150" /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Length (ft)"><Input type="number" value={form.length_ft} onChange={set("length_ft")} placeholder="e.g. 8" /></Field>
              <Field label="No. of Pieces"><Input type="number" value={form.pieces} onChange={set("pieces")} placeholder="e.g. 100" /></Field>
            </div>
            {calc && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border border-blue-100"><p className="text-xs text-blue-400">Per Piece</p><p className="font-bold text-blue-700 text-sm">{calc.cftPer} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-blue-100"><p className="text-xs text-blue-400">Total CFT</p><p className="font-bold text-blue-700 text-sm">{calc.totalCFT} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-blue-100"><p className="text-xs text-blue-400">Total CBM</p><p className="font-bold text-blue-700 text-sm">{calc.totalCBM} m³</p></div>
              </div>
            )}
          </div>
        )}
        {timberType === "Round Log" && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">🪵 Hoppus CFT Calculator</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="Mid-point Girth (inches)"><Input type="number" value={form.girth_in} onChange={set("girth_in")} placeholder="e.g. 36" /></Field>
              <Field label="Log Length (ft)"><Input type="number" value={form.log_length_ft} onChange={set("log_length_ft")} placeholder="e.g. 12" /></Field>
            </div>
            <Field label="No. of Logs"><Input type="number" value={form.num_logs} onChange={set("num_logs")} placeholder="e.g. 20" /></Field>
            {calc && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border border-green-100"><p className="text-xs text-green-400">Per Log</p><p className="font-bold text-green-700 text-sm">{calc.cftPer} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-green-100"><p className="text-xs text-green-400">Total Hoppus</p><p className="font-bold text-green-700 text-sm">{calc.totalCFT} CFT</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-green-100"><p className="text-xs text-green-400">Total CBM</p><p className="font-bold text-green-700 text-sm">{calc.totalCBM} m³</p></div>
              </div>
            )}
          </div>
        )}
        {timberType === "Plywood" && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">📋 Plywood CBM Calculator</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Field label="Thickness (mm)">
                <Select value={form.sheet_thickness_mm} onChange={set("sheet_thickness_mm")}>
                  <option value="">— Select —</option>
                  {[3,4,6,9,12,15,18,19,25].map(t => <option key={t} value={t}>{t} mm</option>)}
                </Select>
              </Field>
              <Field label="Width (ft)"><Input type="number" value={form.sheet_width_ft} onChange={set("sheet_width_ft")} placeholder="4" /></Field>
              <Field label="Length (ft)"><Input type="number" value={form.sheet_length_ft} onChange={set("sheet_length_ft")} placeholder="8" /></Field>
            </div>
            <Field label="No. of Sheets"><Input type="number" value={form.num_sheets} onChange={set("num_sheets")} placeholder="e.g. 500" /></Field>
            {calc && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border border-amber-100"><p className="text-xs text-amber-400">Per Sheet</p><p className="font-bold text-amber-700 text-sm">{calc.cbmPer} m³</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-amber-100"><p className="text-xs text-amber-400">Total CBM</p><p className="font-bold text-amber-700 text-sm">{calc.totalCBM} m³</p></div>
                <div className="bg-white rounded-lg p-2 text-center border border-amber-100"><p className="text-xs text-amber-400">Total CFT</p><p className="font-bold text-amber-700 text-sm">{calc.totalCFT} CFT</p></div>
              </div>
            )}
          </div>
        )}
        <div className={cls("rounded-xl p-4 border-2", calc ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-100")}>
          <p className={cls("text-xs font-bold uppercase tracking-wide mb-2", calc ? "text-gray-400" : "text-gray-400")}>
            {calc ? "✅ Volume Auto-Calculated" : "Volume / Quantity"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Calculated Volume">
              <Input type="number" value={form.available_quantity} onChange={set("available_quantity")} placeholder="0"
                readOnly={timberType !== "Other" && !!calc} />
            </Field>
            <Field label="Unit">
              <Select value={form.unit} onChange={set("unit")}>
                <option>CFT</option><option>CBM</option><option>Pieces</option><option>Sheets</option><option>MT</option><option>Bundles</option>
              </Select>
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cost Price (₹ per unit)"><Input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0" /></Field>
          <Field label="Market Value (₹ per unit)"><Input type="number" value={form.market_value} onChange={set("market_value")} placeholder="0" /></Field>
        </div>
        {form.cost_price && form.available_quantity && (
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-green-700 font-medium">Total Stock Value</span>
            <span className="text-lg font-black text-green-700">{fmt(parseFloat(form.cost_price) * parseFloat(form.available_quantity))}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Supplier">
            <Select value={form.supplier_id} onChange={set("supplier_id")}>
              <option value="">— Select Supplier —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={set("date")} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3 pt-2">
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add to Inventory"}</Btn>
          <Btn variant="secondary" onClick={closeInv}>Cancel</Btn>
        </div>
      </SlidePanel>
    </div>
  );
}

// ── YARDS ──────────────────────────────────────────────────────────────────────
function Yards() {
  const { companyId } = useAuth();
  const [yards, setYards] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const DEFAULTS = { name:"", city:"", address:"", manager_name:"", manager_phone:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([sb.from("yards").select("*").eq("company_id", companyId), sb.from("inventory").select("*").eq("company_id", companyId)]);
      setYards(a.data || []); setInv(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeYard = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Yard name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("yards").insert([{ ...form, company_id: companyId }]);
      if (error) throw error;
      closeYard(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Yards</h1><p className="text-gray-400 text-sm">{yards.length} locations</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Yard</button>
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
                  <div><h3 className="font-bold text-gray-800 text-lg">{y.name}</h3><p className="text-gray-400 text-sm">{y.city}</p></div>
                  <Badge text={y.is_active !== false ? "Active" : "Inactive"} color={y.is_active !== false ? "green" : "gray"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-xs text-blue-400">Products</p><p className="font-bold text-blue-700">{yInv.length}</p></div>
                  <div className="bg-green-50 rounded-lg p-2 text-center"><p className="text-xs text-green-400">Units</p><p className="font-bold text-green-700">{units}</p></div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center"><p className="text-xs text-purple-400">Value</p><p className="font-bold text-purple-700 text-xs">{fmt(val)}</p></div>
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
      {/* Yard Detail Panel */}
      <SlidePanel title={selected?.name || "Yard Details"} open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (() => {
          const yInv = inv.filter(i => i.yard_id === selected.id);
          const val = yInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-400">Products</p><p className="text-2xl font-black text-blue-700">{yInv.length}</p></div>
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-400">Total Value</p><p className="text-lg font-black text-green-700">{fmt(val)}</p></div>
                <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-xs text-purple-400">Status</p><p className="text-sm font-black text-purple-700 mt-1">{selected.is_active !== false ? "Active" : "Inactive"}</p></div>
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
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Inventory at this Yard</p>
                  <div className="space-y-2">
                    {yInv.map(i => (
                      <div key={i.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div><p className="font-semibold text-gray-800 text-sm">{i.product_name}</p><p className="text-xs text-gray-400">{i.category} · {i.wood_type || "—"}</p></div>
                        <div className="text-right"><p className="font-bold text-blue-700 text-sm">{i.available_quantity} {i.unit}</p><p className="text-xs text-gray-400">{fmt(i.cost_price)}/unit</p></div>
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
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Yard"}</Btn><Btn variant="secondary" onClick={closeYard}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── DEALS ──────────────────────────────────────────────────────────────────────
function Deals() {
  const { companyId } = useAuth();
  const [deals, setDeals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [custName, setCustName] = useState("");
  const [form, setForm] = useState({ customer_id:"", product_id:"", quantity:"", unit_price:"", status:"draft", payment_status:"Pending", notes:"" });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        sb.from("deals").select("*").eq("company_id", companyId).order("created_at",{ascending:false}),
        sb.from("customers").select("*").eq("company_id", companyId),
        sb.from("inventory").select("*").eq("company_id", companyId).order("created_at",{ascending:false}),
      ]);
      setDeals(a.data || []); setCustomers(b.data || []); setInventory(c.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = ["All","Draft","Confirmed","Dispatched","Delivered","Completed"];
  const filtered = tab === "All" ? deals : deals.filter(d => (d.status||"").toLowerCase() === tab.toLowerCase());

  const DEAL_DEFAULTS = { customer_id:"", product_id:"", quantity:"", unit_price:"", status:"draft", payment_status:"Pending", notes:"" };
  const closeDeal = () => { setShowAdd(false); setForm(DEAL_DEFAULTS); setCustName(""); setErr(""); };
  const save = async () => {
    if (!form.customer_id && !custName) { setErr("Customer required"); return; }
    setSaving(true); setErr("");
    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unit_price) || 0;
      const selProd = inventory.find(i => i.id === form.product_id);
      const { error } = await db.deals.insert({
        company_id: companyId,
        deal_number: `DEAL-${Date.now()}`,
        customer_id: form.customer_id || undefined,
        customer_name: custName,
        inventory_id: form.product_id || undefined,
        product_name: selProd?.product_name || undefined,
        quantity: qty,
        negotiated_price: price,
        total_value: qty * price,
        payment_status: form.payment_status,
        stage: form.status,
        notes: form.notes || undefined,
      });
      if (error) throw error;
      closeDeal(); fetchAll();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black text-gray-800">Deals</h1><p className="text-gray-400 text-sm">{deals.length} total</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Create Deal</button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 px-4 mb-3">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} {t === "All" ? `(${deals.length})` : `(${deals.filter(d => (d.status||d.stage||"").toLowerCase() === t.toLowerCase()).length})`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3 px-4 pb-4">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-300"><p className="text-4xl mb-2">🤝</p><p>No deals yet.</p></div>
            ) : filtered.map(d => (
              <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 hover:border-green-200 transition-all">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-black text-gray-900 text-base">{d.customer_name || customers.find(c => c.id === d.customer_id)?.name || "Customer"}</p>
                  <p className="font-black text-green-700 text-lg">{fmt(d.total_value || d.negotiated_price)}</p>
                </div>
                <p className="text-sm text-gray-500 mb-3">{d.product_name || "—"}{d.quantity ? ` · ${d.quantity} units` : ""}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 flex-wrap">
                    <Badge text={d.stage || d.status || "draft"} />
                    <Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} />
                  </div>
                  <p className="text-xs text-gray-400">{fmtDate(d.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Deal #","Customer","Product","Qty","Value","Stage","Payment","Date"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</td>
                    <td className="px-4 py-3 font-semibold">{d.customer_name || customers.find(c => c.id === d.customer_id)?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{d.product_name || "—"}</td>
                    <td className="px-4 py-3">{d.quantity || "—"}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmt(d.total_value || d.negotiated_price)}</td>
                    <td className="px-4 py-3"><Badge text={d.stage || d.status || "draft"} /></td>
                    <td className="px-4 py-3"><Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No deals found</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      <SlidePanel title="Create Deal" open={showAdd} onClose={closeDeal}>
        <Field label="Customer Name"><Input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Customer (from records)">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label="Unit Price (₹)"><Input type="number" value={form.unit_price} onChange={set("unit_price")} placeholder="0" /></Field>
        </div>
        {form.quantity && form.unit_price && (
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex justify-between">
            <span className="text-sm text-green-700">Deal Value</span>
            <span className="font-black text-green-700">{fmt(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Deal"}</Btn><Btn variant="secondary" onClick={closeDeal}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── TRANSIT ────────────────────────────────────────────────────────────────────
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
  const DEFAULTS = { vehicle_number:"", driver_name:"", driver_phone:"", origin_yard_id:"", destination:"", dispatch_date:today(), expected_arrival:"", freight_cost:"", status:"Created", cargo_details:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        sb.from("shipments").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        sb.from("yards").select("*").eq("company_id", companyId),
      ]);
      setShips(a.data || []); setYards(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

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
      closeTransit(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };
  const statusColor = (s) => { const m = { "delivered":"green","dispatched":"blue","in transit":"blue","loaded":"orange","arrived":"purple" }; return m[(s||"").toLowerCase()] || "gray"; };

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black text-gray-800">Transit</h1><p className="text-gray-400 text-sm">{ships.length} shipments</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Shipment</button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 px-4 mb-3">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap", tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t} {t !== "All" && `(${ships.filter(s => (s.status||"").toLowerCase() === t.toLowerCase()).length})`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3 px-4 pb-4">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-300"><p className="text-4xl mb-2">🚛</p><p>No shipments yet.</p></div>
            ) : filtered.map(s => (
              <div key={s.id} onClick={() => setSelected(s)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 active:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-black text-gray-900">{s.vehicle_number || "No vehicle"}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.shipment_number}</p>
                  </div>
                  <Badge text={s.status || "—"} color={statusColor(s.status)} />
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  <span>{yards.find(y => y.id === s.origin_yard_id)?.name || "Origin"}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="font-semibold">{s.destination || "—"}</span>
                </p>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Driver: {s.driver_name || "—"}</span>
                  <span className="font-bold text-gray-700">{fmt(s.freight_cost)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Shipment #","Vehicle","Driver","Origin → Dest","Dispatch","ETA","Status","Freight"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(s)}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.shipment_number || `#${s.id?.toString().slice(-6)}`}</td>
                    <td className="px-4 py-3 font-semibold">{s.vehicle_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.driver_name || "—"}</td>
                    <td className="px-4 py-3">{yards.find(y => y.id === s.origin_yard_id)?.name || "—"} → {s.destination || "—"}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(s.dispatch_date)}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(s.expected_arrival)}</td>
                    <td className="px-4 py-3"><Badge text={s.status || "—"} color={statusColor(s.status)} /></td>
                    <td className="px-4 py-3 font-semibold">{fmt(s.freight_cost)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-300">No shipments</td></tr>}
              </tbody>
            </table>
          </div>
        </>
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
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Route & Timeline</p>
              <DetailRow label="Origin Yard" value={yards.find(y => y.id === selected.origin_yard_id)?.name} />
              <DetailRow label="Destination" value={selected.destination} />
              <DetailRow label="Dispatch Date" value={fmtDate(selected.dispatch_date)} />
              <DetailRow label="Expected Arrival" value={fmtDate(selected.expected_arrival)} />
              <DetailRow label="Status" value={selected.status} />
            </div>
            {selected.cargo_details && (
              <div className="bg-gray-50 rounded-xl p-4">
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
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Shipment"}</Btn><Btn variant="secondary" onClick={closeTransit}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── SUPPLIERS ──────────────────────────────────────────────────────────────────
function Suppliers() {
  const { companyId } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const DEFAULTS = { name:"", city:"", country:"India", contact_person:"", phone:"", email:"", gst_number:"", pan_number:"", products_supplied:"", notes:"" };
  const [form, setForm] = useState(DEFAULTS);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([sb.from("suppliers").select("*").eq("company_id", companyId), sb.from("inventory").select("*").eq("company_id", companyId)]);
      setSuppliers(a.data || []); setInv(b.data || []);
    } finally { setLoading(false); }
  }, []);
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

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Suppliers</h1><p className="text-gray-400 text-sm">{suppliers.length} suppliers</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Supplier</button>
      </div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Supplier","Location","GST","Contact","Products Supplied","Inv. Items"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(s)}>
                  <td className="px-4 py-3"><p className="font-semibold text-gray-800">{s.name}</p><p className="text-xs text-gray-400">{s.contact_person}</p></td>
                  <td className="px-4 py-3 text-gray-500">{s.city}{s.country && s.country !== "India" ? `, ${s.country}` : ""}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.gst_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone || s.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.products_supplied || "—"}</td>
                  <td className="px-4 py-3"><Badge text={inv.filter(i => i.supplier_id === s.id).length} color="blue" /></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-300">No suppliers added</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {/* Supplier Detail Panel */}
      <SlidePanel title="Supplier Details" open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (() => {
          const sInv = inv.filter(i => i.supplier_id === selected.id);
          const val = sInv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
          return (
            <>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-400">Items Supplied</p><p className="text-2xl font-black text-blue-700">{sInv.length}</p></div>
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-400">Stock Value</p><p className="text-lg font-black text-green-700">{fmt(val)}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Supplier Info</p>
                <DetailRow label="Company" value={selected.name} />
                <DetailRow label="City" value={selected.city} />
                <DetailRow label="Country" value={selected.country} />
                <DetailRow label="Contact" value={selected.contact_person} />
                <DetailRow label="Phone" value={selected.phone} />
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="GST" value={selected.gst_number} />
                <DetailRow label="PAN" value={selected.pan_number} />
                <DetailRow label="Products" value={selected.products_supplied} />
              </div>
              {sInv.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Inventory from Supplier</p>
                  <div className="space-y-2">
                    {sInv.map(i => (
                      <div key={i.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div><p className="font-semibold text-gray-800 text-sm">{i.product_name}</p><p className="text-xs text-gray-400">{i.category}</p></div>
                        <div className="text-right"><p className="font-bold text-blue-700 text-sm">{i.available_quantity} {i.unit}</p><p className="text-xs text-gray-400">{fmt(i.cost_price)}/unit</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><p className="text-xs font-bold text-amber-600 mb-1">Notes</p><p className="text-sm text-gray-700">{selected.notes}</p></div>}
            </>
          );
        })()}
      </SlidePanel>

      <SlidePanel title="Add Supplier" open={showAdd} onClose={close}>
        <Field label="Supplier Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Products Supplied"><Input value={form.products_supplied} onChange={set("products_supplied")} placeholder="e.g. Plywood, Teak" /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        <ErrBanner msg={err} />
        <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Supplier"}</Btn><Btn variant="secondary" onClick={close}>Cancel</Btn></div>
      </SlidePanel>
    </div>
  );
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────────
function Customers() {
  const { companyId } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name:"", city:"", state:"", country:"India", gst_number:"", pan_number:"", phone:"", email:"", notes:"" });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const [deals, setDeals] = useState([]);
  const [selected, setSelected] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([sb.from("customers").select("*").eq("company_id", companyId), sb.from("deals").select("*").eq("company_id", companyId)]);
      setCustomers(a.data || []); setDeals(b.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const DEFAULTS = { name:"", city:"", state:"", country:"India", gst_number:"", pan_number:"", phone:"", email:"", notes:"" };
  const close = () => { setShowAdd(false); setForm(DEFAULTS); setErr(""); };
  const save = async () => {
    if (!form.name) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await sb.from("customers").insert([{ ...form, company_id: companyId }]);
      if (error) throw error;
      close(); fetchAll();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
        <div><h1 className="text-2xl font-black text-gray-800">Customers</h1><p className="text-gray-400 text-sm">{customers.length} customers</p></div>
        <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all">+ Add Customer</button>
      </div>
            {loading ? <Spinner /> : (
        <>
          <div className="md:hidden space-y-3 px-4 pb-4">
            {customers.length === 0 ? (
              <div className="text-center py-16 text-gray-300"><p className="text-4xl mb-2">👥</p><p>No customers yet.</p></div>
            ) : customers.map(c => (
              <div key={c.id} onClick={() => setSelected(c)} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-black text-gray-900">{c.name}</p>
                  <Badge text={`${deals.filter(d => d.customer_id === c.id).length} deals`} color="blue" />
                </div>
                <p className="text-sm text-gray-500">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</p>
                <p className="text-xs text-gray-400 mt-1">{c.phone || c.email || c.gst_number || "—"}</p>
              </div>
            ))}
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Customer","Location","GST","Phone","Email","Deals"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{[c.city,c.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.gst_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || "—"}</td>
                    <td className="px-4 py-3"><Badge text={deals.filter(d => d.customer_id === c.id).length} color="blue" /></td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-300">No customers</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Customer Detail Panel */}
      <SlidePanel title="Customer Details" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const cDeals = deals.filter(d => d.customer_id === selected.id);
          const revenue = cDeals.reduce((s, d) => s + (d.total_value || 0), 0);
          const paid = cDeals.filter(d => d.payment_status === "Paid").length;
          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-400">Total Deals</p><p className="text-2xl font-black text-blue-700">{cDeals.length}</p></div>
                <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-400">Revenue</p><p className="text-base font-black text-green-700">{fmt(revenue)}</p></div>
                <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-xs text-purple-400">Paid</p><p className="text-2xl font-black text-purple-700">{paid}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Customer Info</p>
                <DetailRow label="Name" value={selected.name} />
                <DetailRow label="City" value={selected.city} />
                <DetailRow label="State" value={selected.state} />
                <DetailRow label="Phone" value={selected.phone} />
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="GST Number" value={selected.gst_number} />
                <DetailRow label="PAN Number" value={selected.pan_number} />
              </div>
              {cDeals.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Transaction History</p>
                  <div className="space-y-2">
                    {cDeals.slice(0, 6).map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                        <div><p className="font-semibold text-gray-800 text-sm">{d.deal_number || `#${d.id?.toString().slice(-6)}`}</p><p className="text-xs text-gray-400">{d.product_name || "—"} · {fmtDate(d.created_at)}</p></div>
                        <div className="text-right"><p className="font-bold text-green-700 text-sm">{fmt(d.total_value)}</p><Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><p className="text-xs font-bold text-amber-600 mb-1">Notes</p><p className="text-sm text-gray-700">{selected.notes}</p></div>}
            </>
          );
        })()}
      </SlidePanel>

      <SlidePanel title="Add Customer" open={showAdd} onClose={close}>
        <Field label="Customer Name" required><Input value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="State"><Input value={form.state} onChange={set("state")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
          <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

// ── FINANCIALS ─────────────────────────────────────────────────────────────────
function Financials() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([sb.from("inventory").select("*").eq("company_id", companyId), sb.from("deals").select("*").eq("company_id", companyId)]).then(([a, b]) => {
      setInv(a.data || []); setDeals(b.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalCost = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const marketVal = inv.reduce((s, i) => s + (i.market_value || i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = deals.filter(d => ["completed","delivered","closed"].includes((d.stage||d.status||"").toLowerCase()))
    .reduce((s, d) => s + (d.total_value || 0), 0);
  const profit = revenue - totalCost * 0.7;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div><h1 className="text-2xl font-black text-gray-800">Financials</h1><p className="text-gray-400 text-sm">P&L overview</p></div>
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Total Revenue" value={fmt(revenue)} icon="💰" color="green" />
            <StatCard label="Inventory Cost" value={fmt(totalCost)} icon="📦" color="blue" />
            <StatCard label="Market Value" value={fmt(marketVal)} icon="📈" color="purple" />
            <StatCard label="Est. Profit" value={fmt(profit)} icon={profit >= 0 ? "✅" : "⚠️"} color={profit >= 0 ? "green" : "red"} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-4">Inventory Cost Breakdown by Category</h3>
            <div className="space-y-3">
              {Object.entries(inv.reduce((m, i) => {
                const c = i.category || "Other";
                m[c] = (m[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0);
                return m;
              }, {})).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600 shrink-0">{cat}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (val / totalCost) * 100)}%` }} />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-gray-700">{fmt(val)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── BUSINESS INSIGHTS ─────────────────────────────────────────────────────────
function AIInsights() {
  const { companyId } = useAuth();
  const [inv, setInv] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sb.from("inventory").select("*").eq("company_id", companyId),
      sb.from("deals").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      sb.from("shipments").select("*").eq("company_id", companyId),
    ]).then(([a, b, c]) => {
      setInv(a.data || []);
      setDeals(b.data || []);
      setShips(c.data || []);
      setLoading(false);
    });
  }, [companyId]);

  const totalValue = inv.reduce((s, i) => s + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const totalCBM = inv.reduce((s, i) => s + (i.unit === "CBM" ? (i.available_quantity || 0) : 0), 0);
  const totalCFT = inv.reduce((s, i) => s + (i.unit === "CFT" ? (i.available_quantity || 0) : 0), 0);
  const lowStock = inv.filter(i => (i.available_quantity || 0) < 10);
  const paidDeals = deals.filter(d => d.payment_status === "Paid");
  const pendingDeals = deals.filter(d => d.payment_status === "Pending");
  const revenue = paidDeals.reduce((s, d) => s + (d.total_value || 0), 0);
  const pending = pendingDeals.reduce((s, d) => s + (d.total_value || 0), 0);
  const activeShips = ships.filter(s => s.status !== "Delivered").length;

  // Category breakdown
  const catMap = {};
  inv.forEach(i => {
    const c = i.category || "Other";
    catMap[c] = (catMap[c] || 0) + (i.cost_price || 0) * (i.available_quantity || 0);
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  // Recent deals
  const recentDeals = deals.slice(0, 5);

  if (loading) return <Spinner />;

  return (
    <div className="bg-gray-50 min-h-screen pb-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-gray-900">Insights</h1>
        <p className="text-gray-400 text-sm">Business overview & analytics</p>
      </div>

      <div className="px-4 space-y-4">
        {/* ── P&L Summary ── */}
        <div className="bg-gradient-to-br from-gray-900 to-blue-950 rounded-2xl p-5 text-white">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Inventory Value</p>
          <p className="text-3xl font-black mb-4">{fmt(totalValue)}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-xs mb-1">Revenue</p>
              <p className="font-black text-green-400 text-sm">{fmt(revenue)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-xs mb-1">Pending</p>
              <p className="font-black text-orange-400 text-sm">{fmt(pending)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-xs mb-1">Shipments</p>
              <p className="font-black text-white text-sm">{activeShips} active</p>
            </div>
          </div>
        </div>

        {/* ── Volume Summary ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Stock Volume</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400 mb-1">Total CFT</p>
              <p className="text-xl font-black text-blue-700">{Math.round(totalCFT)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-400 mb-1">Total CBM</p>
              <p className="text-xl font-black text-green-700">{totalCBM.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* ── Category Breakdown ── */}
        {topCats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Value by Category</p>
            <div className="space-y-3">
              {topCats.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-gray-700">{cat}</span>
                    <span className="text-sm font-black text-gray-900">{fmt(val)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: totalValue > 0 ? Math.min(100, (val / totalValue) * 100) + "%" : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Low Stock Alerts ── */}
        {lowStock.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-3">⚠ Low Stock Alerts</p>
            <div className="space-y-2">
              {lowStock.slice(0, 5).map(i => (
                <div key={i.id} className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{i.product_name}</p>
                    <p className="text-xs text-gray-400">{i.category}</p>
                  </div>
                  <Badge text={`${i.available_quantity} ${i.unit || "left"}`} color="red" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Deals Summary ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Deal Breakdown</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-500 mb-1">Paid</p>
              <p className="text-xl font-black text-green-700">{paidDeals.length}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-xs text-orange-500 mb-1">Pending</p>
              <p className="text-xl font-black text-orange-700">{pendingDeals.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500 mb-1">Total</p>
              <p className="text-xl font-black text-blue-700">{deals.length}</p>
            </div>
          </div>
          {recentDeals.length > 0 && (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent Deals</p>
              <div className="space-y-2">
                {recentDeals.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{d.customer_name || "—"}</p>
                      <p className="text-xs text-gray-400">{d.product_name || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">{fmt(d.total_value)}</p>
                      <Badge text={d.payment_status || "—"} color={d.payment_status === "Paid" ? "green" : "orange"} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-purple-600">{inv.length}</p>
            <p className="text-xs text-gray-400 mt-1">Products in Stock</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-blue-600">{ships.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Shipments</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REPORTS ────────────────────────────────────────────────────────────────────
function Reports() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    sb.from("company").select("*").limit(1).single()
      .then(r => setCompany(r.data || {})).catch(() => {});
  }, []);

  const REPORTS = [
    { key:"inventory", label:"Inventory Report", icon:"📦", desc:"All stock with valuation" },
    { key:"sales", label:"Sales Report", icon:"🤝", desc:"All deals and revenue" },
    { key:"shipments", label:"Shipment Report", icon:"🚛", desc:"Transit & logistics" },
    { key:"suppliers", label:"Supplier Report", icon:"🏭", desc:"Supplier directory" },
    { key:"customers", label:"Customer Report", icon:"👥", desc:"Customer revenue analysis" },
  ];

  const downloadPDF = async (type, label) => {
    setLoading(p => ({...p, [type]: true}));
    try {
      let data = [];
      if (type === "inventory") { const r = await sb.from("inventory").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "sales") { const r = await sb.from("deals").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "shipments") { const r = await sb.from("shipments").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "suppliers") { const r = await sb.from("suppliers").select("*").eq("company_id", companyId); data = r.data || []; }
      else if (type === "customers") { const r = await sb.from("customers").select("*").eq("company_id", companyId); data = r.data || []; }
      generatePDF(type, label, data, company);
    } catch (e) { alert("Failed: " + e.message); }
    setLoading(p => ({...p, [type]: false}));
  };

  const generatePDF = (type, label, data, co) => {
    const now = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${label}</title>
    <style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1e293b}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
    th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b}
    td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
    h1{font-size:20px;margin:0}h2{font-size:14px;color:#64748b;margin:4px 0 16px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0}
    </style></head><body>
    <div class="header">
      <div><div style="font-size:22px">⚓</div><h1>${co.name || "Dockside ERP"}</h1>
      ${co.gst_number ? `<div style="font-size:11px;color:#64748b">GST: ${co.gst_number}</div>` : ""}
      </div>
      <div style="text-align:right"><h2>${label}</h2><div style="font-size:11px;color:#94a3b8">Generated: ${now}</div><div style="font-size:11px;color:#94a3b8">${data.length} records</div></div>
    </div>
    ${buildRows(type, data)}
    </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const buildRows = (type, data) => {
    if (type === "inventory") return `<table><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Wood Type</th><th>Grade</th><th>Unit</th><th>Qty</th><th>Cost Price</th><th>Total Value</th></tr></thead><tbody>${data.map((i,idx) => `<tr><td>${idx+1}</td><td><b>${i.product_name||"—"}</b></td><td>${i.category||"—"}</td><td>${i.wood_type||"—"}</td><td>${i.grade||"—"}</td><td>${i.unit||"—"}</td><td>${i.available_quantity||0}</td><td>₹${(i.cost_price||0).toLocaleString("en-IN")}</td><td>₹${((i.cost_price||0)*(i.available_quantity||0)).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table>`;
    if (type === "sales") return `<table><thead><tr><th>#</th><th>Deal No.</th><th>Customer</th><th>Product</th><th>Qty</th><th>Value</th><th>Stage</th><th>Payment</th></tr></thead><tbody>${data.map((d,idx) => `<tr><td>${idx+1}</td><td>${d.deal_number||"—"}</td><td>${d.customer_name||"—"}</td><td>${d.product_name||"—"}</td><td>${d.quantity||"—"}</td><td>₹${(d.total_value||0).toLocaleString("en-IN")}</td><td>${d.stage||d.status||"—"}</td><td>${d.payment_status||"—"}</td></tr>`).join("")}</tbody></table>`;
    if (type === "shipments") return `<table><thead><tr><th>#</th><th>Shipment No.</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Dispatch</th><th>Status</th><th>Freight</th></tr></thead><tbody>${data.map((s,idx) => `<tr><td>${idx+1}</td><td>${s.shipment_number||"—"}</td><td>${s.vehicle_number||"—"}</td><td>${s.driver_name||"—"}</td><td>${s.destination||"—"}</td><td>${fmtDate(s.dispatch_date)}</td><td>${s.status||"—"}</td><td>₹${(s.freight_cost||0).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table>`;
    if (type === "suppliers") return `<table><thead><tr><th>#</th><th>Name</th><th>City</th><th>GST</th><th>Contact</th><th>Phone</th></tr></thead><tbody>${data.map((s,idx) => `<tr><td>${idx+1}</td><td><b>${s.name||"—"}</b></td><td>${s.city||"—"}</td><td>${s.gst_number||"—"}</td><td>${s.contact_person||"—"}</td><td>${s.phone||"—"}</td></tr>`).join("")}</tbody></table>`;
    if (type === "customers") return `<table><thead><tr><th>#</th><th>Name</th><th>City</th><th>GST</th><th>Phone</th><th>Email</th></tr></thead><tbody>${data.map((c,idx) => `<tr><td>${idx+1}</td><td><b>${c.name||"—"}</b></td><td>${c.city||"—"}</td><td>${c.gst_number||"—"}</td><td>${c.phone||"—"}</td><td>${c.email||"—"}</td></tr>`).join("")}</tbody></table>`;
    return "<p>No data</p>";
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Reports</h1><p className="text-gray-400 text-sm">Professional PDF reports with company letterhead</p></div>
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
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    name:"", industry:"Timber Trade", city:"", country:"India", address:"",
    owner_name:"", phone:"", email:"", website:"",
    gst_number:"", pan_number:"", iec_number:"", cin_number:"",
    bank_name:"", bank_account:"", bank_ifsc:"", bank_branch:"", notes:""
  });
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sb.from("company").select("*").limit(1).single();
      if (data) { setCompany(data); setForm(f => ({...f, ...data})); }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      let error;
      if (company?.id) {
        const r = await sb.from("company").update(form).eq("id", company.id).select().single();
        error = r.error;
      } else {
        const r = await sb.from("company").insert([form]).select().single();
        error = r.error;
      }
      if (error) throw error;
      alert("✅ Company profile saved!");
      fetchAll();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const TABS = ["profile","legal","banking"];

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6"><h1 className="text-2xl font-black text-gray-800">Company</h1><p className="text-gray-400 text-sm">Your business profile</p></div>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex gap-2 mb-6">
            {TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={cls("px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all", activeTab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{t}</button>
            ))}
          </div>
          {activeTab === "profile" && (
            <div className="space-y-4">
              <Field label="Company Name"><Input value={form.name} onChange={set("name")} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Owner Name"><Input value={form.owner_name} onChange={set("owner_name")} /></Field>
                <Field label="Industry"><Input value={form.industry} onChange={set("industry")} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
              </div>
              <Field label="Address"><Textarea value={form.address} onChange={set("address")} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
                <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
              </div>
            </div>
          )}
          {activeTab === "legal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="GST Number"><Input value={form.gst_number} onChange={set("gst_number")} placeholder="27XXXXX…" /></Field>
                <Field label="PAN Number"><Input value={form.pan_number} onChange={set("pan_number")} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="IEC Number"><Input value={form.iec_number} onChange={set("iec_number")} /></Field>
                <Field label="CIN Number"><Input value={form.cin_number} onChange={set("cin_number")} /></Field>
              </div>
            </div>
          )}
          {activeTab === "banking" && (
            <div className="space-y-4">
              <Field label="Bank Name"><Input value={form.bank_name} onChange={set("bank_name")} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Account Number"><Input value={form.bank_account} onChange={set("bank_account")} /></Field>
                <Field label="IFSC Code"><Input value={form.bank_ifsc} onChange={set("bank_ifsc")} /></Field>
              </div>
              <Field label="Branch"><Input value={form.bank_branch} onChange={set("bank_branch")} /></Field>
            </div>
          )}
          <ErrBanner msg={err} />
          <div className="mt-6 pt-4 border-t border-gray-100">
            <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save Company Profile"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────────
function Settings() {
  const { user } = useAuth();
  return (
    <div className="p-4 md:p-6 max-w-xl">
      <h1 className="text-2xl font-black text-gray-800 mb-6">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-700">Account</h3>
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
          💡 To update company details (GST, PAN, IEC), go to the <strong>Company</strong> section in the sidebar.
        </div>
      </div>
    </div>
  );
}
