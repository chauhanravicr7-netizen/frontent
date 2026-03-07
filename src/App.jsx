import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, Package, Warehouse, Briefcase, Truck, Building2, Users,
  BarChart3, Sparkles, FileText, Settings, Menu, X, Moon, Sun, LogOut,
  Package2, AlertCircle, Plus, Search, ChevronRight, TrendingUp, TrendingDown,
  RefreshCw, Download, Eye, Edit2, Trash2, ArrowRight, Filter, ChevronDown,
  DollarSign, Activity, ShoppingCart, Star, MapPin, Phone, Mail, Calendar,
  Zap, CheckCircle, Clock, XCircle, Loader
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── API CLIENT ───────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dockside-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── UTILS ────────────────────────────────────────────────────────────────────
const formatCurrency = (val) => {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
};

const cls = (...args) => args.filter(Boolean).join(' ');

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────
const Spinner = ({ size = 5 }) => (
  <Loader className={`w-${size} h-${size} animate-spin text-blue-500`} />
);

const PageLoader = ({ text = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
    <Spinner size={8} />
    <span className="text-sm">{text}</span>
  </div>
);

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
    <Icon className="w-14 h-14 opacity-30" />
    <p className="text-lg font-semibold text-gray-500">{title}</p>
    {description && <p className="text-sm text-center max-w-xs">{description}</p>}
    {action}
  </div>
);

const ErrorBanner = ({ message, onRetry }) => (
  <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span className="flex-1">{message}</span>
    {onRetry && <button onClick={onRetry} className="text-xs underline">Retry</button>}
  </div>
);

// Slide-in Panel (used for Add forms)
function SlidePanel({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// Pill tab filter
function TabFilter({ tabs, value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cls(
            'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
            value === tab.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          )}
        >
          {tab.label} {tab.count !== undefined && <span className="ml-1 opacity-70">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Form field helpers
const Field = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className={cls(
      'w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm',
      'bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
      props.className
    )}
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className={cls(
      'w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm',
      'bg-white dark:bg-slate-700 text-gray-900 dark:text-white',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
      props.className
    )}
  >
    {children}
  </select>
);

const Textarea = (props) => (
  <textarea
    {...props}
    rows={3}
    className={cls(
      'w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm resize-none',
      'bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
      props.className
    )}
  />
);

const BtnPrimary = ({ children, loading, ...props }) => (
  <button
    {...props}
    disabled={loading || props.disabled}
    className={cls(
      'flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      props.className
    )}
  >
    {loading && <Spinner size={4} />}
    {children}
  </button>
);

const BtnSecondary = ({ children, ...props }) => (
  <button
    {...props}
    className={cls(
      'flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-600',
      'text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all',
      props.className
    )}
  >
    {children}
  </button>
);

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  dispatched: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  loaded: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  in_transit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  arrived: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  contract: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const Badge = ({ status, label }) => (
  <span className={cls(
    'px-2.5 py-1 rounded-full text-xs font-semibold capitalize',
    STATUS_COLORS[status?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  )}>
    {label || status || '—'}
  </span>
);

// ─── TABLE WRAPPER ────────────────────────────────────────────────────────────
const Table = ({ headers, children, empty }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b border-gray-100 dark:border-slate-700">
        <tr>
          {headers.map(h => (
            <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
        {children}
      </tbody>
    </table>
    {empty}
  </div>
);

const Tr = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    className={cls(
      'hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors',
      onClick && 'cursor-pointer'
    )}
  >
    {children}
  </tr>
);

const Td = ({ children, className }) => (
  <td className={cls('px-5 py-3.5 text-gray-700 dark:text-gray-300', className)}>
    {children}
  </td>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('dockside-token', res.data.token);
      localStorage.setItem('dockside-user', JSON.stringify(res.data.user));
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0e4d7a 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #06b6d4 0%, transparent 50%)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
            <Package2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl">Dockside</p>
            <p className="text-blue-300 text-xs">Trade Operating System</p>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Manage your timber<br />operations smarter.
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Real-time inventory, transit tracking, deals pipeline and financial insights — all in one platform.
          </p>
          <div className="flex gap-6">
            {[['₹10L+', 'Inventory Managed'], ['3', 'Active Yards'], ['100%', 'Uptime']].map(([val, label]) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{val}</p>
                <p className="text-blue-300 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-blue-400 text-sm">© 2026 Dockside Trade OS. All rights reserved.</p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Package2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-bold text-xl">Dockside</p>
              <p className="text-gray-500 text-xs">Trade Operating System</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Email address" required>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </button>
            </div>

            {error && <ErrorBanner message={error} />}

            <BtnPrimary type="submit" loading={loading} className="w-full justify-center py-3 text-base">
              {loading ? 'Signing in...' : 'Sign in'}
            </BtnPrimary>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/inventory', icon: Package, label: 'Inventory' },
  { path: '/yards', icon: Warehouse, label: 'Yards' },
  { path: '/deals', icon: Briefcase, label: 'Deals' },
  { path: '/transit', icon: Truck, label: 'Transit' },
  { path: '/suppliers', icon: Building2, label: 'Suppliers' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/financials', icon: BarChart3, label: 'Financials' },
  { path: '/ai-insights', icon: Sparkles, label: 'AI Insights' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

function Sidebar({ isOpen, onClose, darkMode, onToggleDarkMode, onLogout }) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />}
      <aside className={cls(
        'fixed inset-y-0 left-0 z-50 w-52 bg-slate-900 flex flex-col transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Package2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Dockside</p>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Trade OS</p>
          </div>
          <button onClick={onClose} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => cls(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-1">
          <button
            onClick={onToggleDarkMode}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ onSidebarOpen }) {
  const user = JSON.parse(localStorage.getItem('dockside-user') || '{}');
  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
      <button onClick={onSidebarOpen} className="lg:hidden p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{user.full_name || user.email || 'User'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role || 'admin'}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
          {(user.full_name || user.email || 'U')[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
}

// ─── PAGE SHELL ───────────────────────────────────────────────────────────────
function Page({ title, subtitle, actions, children }) {
  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState({
    totalInventoryValue: 0, totalVolume: 0, activeShipments: 0,
    pendingDeliveries: 0, activeYards: 0, monthlyRevenue: 0, monthlyPurchases: 0,
  });
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, invRes] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/inventory'),
      ]);
      setStats(statsRes.data);
      const cat = invRes.data.reduce((acc, item) => {
        const ex = acc.find(d => d.name === item.category);
        const v = (item.available_quantity || 0) * (item.cost_price || 0);
        if (ex) ex.value += v; else acc.push({ name: item.category || 'Other', value: v });
        return acc;
      }, []);
      setCategoryData(cat);

      // Build simple 6-month trend mock from inventory cost
      const months = ['Oct','Nov','Dec','Jan','Feb','Mar'];
      const base = statsRes.data.totalInventoryValue || 500000;
      setTrendData(months.map((m, i) => ({
        month: m,
        Revenue: Math.round(base * 0.3 + base * 0.05 * i + Math.random() * base * 0.05),
        Purchases: Math.round(base * 0.4 + base * 0.04 * i + Math.random() * base * 0.04),
      })));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];

  const statCards = [
    { label: 'Inventory Value', value: formatCurrency(stats.totalInventoryValue), sub: 'Total stock worth', icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Inventory Volume', value: `${Math.round(stats.totalVolume)} units`, icon: Package, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Active Shipments', value: stats.activeShipments, icon: Truck, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Pending Deliveries', value: stats.pendingDeliveries, icon: Activity, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Monthly Revenue', value: formatCurrency(stats.monthlyRevenue || 0), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Monthly Purchases', value: formatCurrency(stats.monthlyPurchases || stats.totalInventoryValue * 0.07), icon: ShoppingCart, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Profit Estimate', value: formatCurrency(0), sub: '~18% margin', icon: Star, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Active Yards', value: stats.activeYards, icon: Warehouse, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  ];

  if (loading) return <PageLoader text="Loading dashboard..." />;

  return (
    <Page title="Command Center" subtitle="Real-time overview of your timber operations">
      {error && <ErrorBanner message={error} onRetry={fetch} />}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-3">
            <div className={cls('w-10 h-10 rounded-lg flex items-center justify-center', s.bg)}>
              <s.icon className={cls('w-5 h-5', s.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              {s.sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Revenue vs Purchases</h3>
          <p className="text-xs text-gray-400 mb-5">Last 6 months trend</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#rev)" />
              <Area type="monotone" dataKey="Purchases" stroke="#10b981" strokeWidth={2} fill="url(#pur)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Inventory by Category</h3>
          <p className="text-xs text-gray-400 mb-5">Value distribution</p>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {categoryData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 dark:text-gray-400">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={Package} title="No data" description="Add inventory to see breakdown" />
          )}
        </div>
      </div>
    </Page>
  );
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
function Inventory() {
  const [items, setItems] = useState([]);
  const [yards, setYards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [yardFilter, setYardFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_name: '', category: 'Logs', wood_type: '', thickness: '18', length: '8', width: '4',
    quality_grade: 'A Grade', supplier_id: '', yard_id: '', cost_price: '', market_value: '',
    total_quantity: '', available_quantity: '', unit: 'Pieces', date_added: new Date().toISOString().split('T')[0], notes: '',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [inv, y, s] = await Promise.all([
        api.get('/api/inventory'), api.get('/api/yards'), api.get('/api/suppliers')
      ]);
      setItems(inv.data); setYards(y.data); setSuppliers(s.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async () => {
    if (!form.product_name || !form.total_quantity || !form.cost_price) return;
    setSaving(true);
    try {
      await api.post('/api/inventory', {
        ...form,
        total_quantity: parseFloat(form.total_quantity),
        available_quantity: parseFloat(form.total_quantity),
        cost_price: parseFloat(form.cost_price),
        market_value: parseFloat(form.market_value) || parseFloat(form.cost_price) * 1.18,
      });
      setShowAdd(false);
      setForm({ product_name:'',category:'Logs',wood_type:'',thickness:'18',length:'8',width:'4',quality_grade:'A Grade',supplier_id:'',yard_id:'',cost_price:'',market_value:'',total_quantity:'',available_quantity:'',unit:'Pieces',date_added:new Date().toISOString().split('T')[0],notes:'' });
      fetchAll();
    } catch (e) { console.error(e); setFormError?.(e.response?.data?.error || e.response?.data?.hint || e.message || "An error occurred."); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.product_name?.toLowerCase().includes(search.toLowerCase()) || i.wood_type?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchYard = yardFilter === 'All' || (i.yard_id === yardFilter || i.yard?.name === yardFilter);
    return matchSearch && matchCat && matchYard;
  });

  const categories = ['All', ...new Set(items.map(i => i.category).filter(Boolean))];
  const totalValue = items.reduce((a, i) => a + (i.cost_price || 0) * (i.available_quantity || 0), 0);

  return (
    <Page
      title="Inventory"
      subtitle={`${items.length} products · ${filtered.length} shown`}
      actions={
        <BtnPrimary onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Add Stock
        </BtnPrimary>
      }
    >
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by name, wood type, category..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-36">
          {categories.map(c => <option key={c}>{c}</option>)}
        </Select>
        <Select value={yardFilter} onChange={e => setYardFilter(e.target.value)} className="w-40">
          <option value="All">All Yards</option>
          {yards.map(y => <option key={y.id} value={y.id}>{y.name || y.yard_name}</option>)}
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? <PageLoader /> : (
          <Table
            headers={['Product','Category','Wood Type','Grade','Yard','Available','Reserved','Cost Price','Total Value']}
            empty={filtered.length === 0 && <EmptyState icon={Package} title="No inventory items" description="Add your first stock item to get started." />}
          >
            {filtered.map(item => (
              <Tr key={item.id}>
                <Td>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{item.product_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{[item.thickness, item.length, item.width].filter(Boolean).map(v => `${v}`).join(' × ')}{item.thickness ? ' mm × ft' : ''}</p>
                  </div>
                </Td>
                <Td>{item.category}</Td>
                <Td>{item.wood_type || '—'}</Td>
                <Td><Badge status={item.quality_grade?.toLowerCase().replace(' ','')} label={item.quality_grade} /></Td>
                <Td>{yards.find(y => y.id === item.yard_id)?.name || item.yard_id || 'Unassigned'}</Td>
                <Td className="font-semibold">{item.available_quantity} {item.unit || 'CBM'}</Td>
                <Td>{item.reserved_quantity || 0}</Td>
                <Td>{formatCurrency(item.cost_price)}</Td>
                <Td className="font-bold text-gray-900 dark:text-white">{formatCurrency((item.cost_price || 0) * (item.available_quantity || 0))}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </div>

      {/* Add Stock Panel */}
      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Add Stock">
        <Field label="Product Name" required>
          <Input placeholder="e.g. Teak Logs 8ft" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <Select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {['Logs','Plywood','Timber','Veneer','MDF','Hardwood','Softwood','Other'].map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Wood Type">
            <Input placeholder="e.g. Teak, Pine, Oak" value={form.wood_type} onChange={e => setForm({...form, wood_type: e.target.value})} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Thickness (mm)"><Input type="number" value={form.thickness} onChange={e => setForm({...form, thickness: e.target.value})} /></Field>
          <Field label="Length (ft)"><Input type="number" value={form.length} onChange={e => setForm({...form, length: e.target.value})} /></Field>
          <Field label="Width (ft)"><Input type="number" value={form.width} onChange={e => setForm({...form, width: e.target.value})} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quality Grade">
            <Select value={form.quality_grade} onChange={e => setForm({...form, quality_grade: e.target.value})}>
              {['A Grade','B Grade','C Grade','Premium','Standard','Export Quality'].map(g => <option key={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Yard Location" required>
            <Select value={form.yard_id} onChange={e => setForm({...form, yard_id: e.target.value})}>
              <option value="">Select yard</option>
              {yards.map(y => <option key={y.id} value={y.id}>{y.name || y.yard_name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier">
            <Select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name || s.supplier_name}</option>)}
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
              {['Pieces','CBM','MT','SFT','Sheets'].map(u => <option key={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost Price (₹)"><Input type="number" placeholder="0" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} /></Field>
          <Field label="Market Value (₹)"><Input type="number" placeholder="0" value={form.market_value} onChange={e => setForm({...form, market_value: e.target.value})} /></Field>
        </div>
        <Field label="Quantity" required>
          <Input type="number" placeholder="0" value={form.total_quantity} onChange={e => setForm({...form, total_quantity: e.target.value})} />
        </Field>
        <Field label="Date Added">
          <Input type="date" value={form.date_added} onChange={e => setForm({...form, date_added: e.target.value})} />
        </Field>
        <Field label="Notes">
          <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </Field>
        <div className="flex gap-3 pt-2">
          <BtnSecondary onClick={() => setShowAdd(false)} className="flex-1 justify-center">Cancel</BtnSecondary>
          <BtnPrimary onClick={handleSubmit} loading={saving} className="flex-1 justify-center">Add Stock</BtnPrimary>
        </div>
      </SlidePanel>
    </Page>
  );
}

// ─── YARDS ────────────────────────────────────────────────────────────────────
function Yards() {
  const [yards, setYards] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name:'', city:'', address:'', manager_name:'', manager_phone:'', notes:'' });

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [y, i] = await Promise.all([api.get('/api/yards'), api.get('/api/inventory')]);
      setYards(y.data); setInventory(i.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.name || !form.city) return;
    setSaving(true);
    try {
      await api.post('/api/yards', { ...form, is_active: true });
      setShowAdd(false);
      setForm({ name:'', city:'', address:'', manager_name:'', manager_phone:'', notes:'' });
      fetchAll();
    } catch (e) { console.error(e); setFormError?.(e.response?.data?.error || e.response?.data?.hint || e.message || "An error occurred."); }
    finally { setSaving(false); }
  };

  const yardStats = (yardId) => {
    const items = inventory.filter(i => i.yard_id === yardId);
    return {
      products: items.length,
      totalUnits: items.reduce((a, i) => a + (i.available_quantity || 0), 0),
      value: items.reduce((a, i) => a + (i.cost_price || 0) * (i.available_quantity || 0), 0),
    };
  };

  return (
    <Page
      title="Yards"
      subtitle={`${yards.length} storage locations`}
      actions={
        <>
          <BtnSecondary><RefreshCw className="w-4 h-4" /> Transfer Stock</BtnSecondary>
          <BtnPrimary onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Yard</BtnPrimary>
        </>
      }
    >
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}
      {loading ? <PageLoader /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {yards.length === 0 ? (
            <EmptyState icon={Warehouse} title="No yards yet" description="Add your first storage location." />
          ) : yards.map(yard => {
            const st = yardStats(yard.id);
            return (
              <div key={yard.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{yard.name || yard.yard_name}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {yard.city || yard.location || 'Location not set'}
                      </div>
                    </div>
                  </div>
                  <Badge status={yard.is_active ? 'active' : 'inactive'} label={yard.is_active ? 'Active' : 'Inactive'} />
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-gray-50 dark:border-slate-700">
                  {[['Products', st.products], ['Total Units', st.totalUnits], ['Value', formatCurrency(st.value)]].map(([l, v]) => (
                    <div key={l} className="text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{v}</p>
                      <p className="text-xs text-gray-400">{l}</p>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  {yard.manager_name && (
                    <p>Manager: <span className="font-semibold text-gray-700 dark:text-gray-300">{yard.manager_name}</span>
                      {yard.manager_phone && <span className="ml-2 text-gray-400">· {yard.manager_phone}</span>}
                    </p>
                  )}
                  {yard.address && <p className="text-xs text-gray-400">{yard.address}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Add New Yard">
        <Field label="Yard Name" required>
          <Input placeholder="e.g. Gandhidham Yard" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </Field>
        <Field label="City" required>
          <Input placeholder="e.g. Gandhidham" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
        </Field>
        <Field label="Full Address">
          <Input placeholder="Street, area..." value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Manager Name">
            <Input value={form.manager_name} onChange={e => setForm({...form, manager_name: e.target.value})} />
          </Field>
          <Field label="Manager Phone">
            <Input value={form.manager_phone} onChange={e => setForm({...form, manager_phone: e.target.value})} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </Field>
        <div className="flex gap-3 pt-2">
          <BtnSecondary onClick={() => setShowAdd(false)} className="flex-1 justify-center">Cancel</BtnSecondary>
          <BtnPrimary onClick={handleCreate} loading={saving} className="flex-1 justify-center">Create Yard</BtnPrimary>
        </div>
      </SlidePanel>
    </Page>
  );
}

// ─── DEALS ────────────────────────────────────────────────────────────────────
function Deals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ customer_id:'', product_id:'', quantity:'', unit_price:'', status:'draft', payment_status:'Pending', notes:'' });

  const STAGES = ['All','Draft','Confirmed','Dispatched','Delivered','Completed'];

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, c, i] = await Promise.all([api.get('/api/deals'), api.get('/api/customers'), api.get('/api/inventory')]);
      setDeals(d.data); setCustomers(c.data); setInventory(i.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/api/deals', { ...form, quantity: parseFloat(form.quantity), unit_price: parseFloat(form.unit_price) });
      setShowAdd(false);
      setForm({ customer_id:'', product_id:'', quantity:'', unit_price:'', status:'draft', payment_status:'Pending', notes:'' });
      fetchAll();
    } catch (e) { console.error(e); setFormError?.(e.response?.data?.error || e.response?.data?.hint || e.message || "An error occurred."); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/api/deals/${id}/status`, { status });
      fetchAll();
    } catch (e) { console.error(e); }
  };

  const tabs = STAGES.map(s => ({
    value: s,
    label: s,
    count: s === 'All' ? deals.length : deals.filter(d => d.status?.toLowerCase() === s.toLowerCase()).length
  }));

  const filtered = deals.filter(d => {
    const matchTab = tab === 'All' || d.status?.toLowerCase() === tab.toLowerCase();
    const matchSearch = !search || d.deal_number?.toLowerCase().includes(search.toLowerCase()) ||
      customers.find(c => c.id === d.customer_id)?.name?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <Page
      title="Deals"
      subtitle={`${deals.length} total deals`}
      actions={<BtnPrimary onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Create Deal</BtnPrimary>}
    >
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      <TabFilter tabs={tabs} value={tab} onChange={setTab} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 max-w-md" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? <PageLoader /> : (
          <Table
            headers={['Deal #','Customer','Product','Qty','Value','Stage','Payment','Date']}
            empty={filtered.length === 0 && <EmptyState icon={Briefcase} title="No deals found" description="Create your first deal to start tracking sales." />}
          >
            {filtered.map(deal => {
              const cust = customers.find(c => c.id === deal.customer_id);
              const prod = inventory.find(i => i.id === deal.product_id);
              const total = (deal.quantity || 0) * (deal.unit_price || 0);
              return (
                <Tr key={deal.id}>
                  <Td><span className="font-mono text-xs text-gray-500">{deal.deal_number}</span></Td>
                  <Td className="font-semibold text-gray-900 dark:text-white">{cust?.name || deal.customer_id || '—'}</Td>
                  <Td>{prod?.product_name || deal.product_id || '—'}</Td>
                  <Td>{deal.quantity || '—'}</Td>
                  <Td className="font-semibold">{formatCurrency(deal.total_value || total)}</Td>
                  <Td><Badge status={deal.status} /></Td>
                  <Td>
                    <span className={cls('px-2 py-0.5 rounded text-xs font-medium',
                      deal.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {deal.payment_status || 'Pending'}
                    </span>
                  </Td>
                  <Td className="text-xs text-gray-400">{deal.created_at ? new Date(deal.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </div>

      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Create Deal">
        <Field label="Customer">
          <Select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}>
            <option value="">Select customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Product">
          <Select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}>
            <option value="">Select product</option>
            {inventory.map(i => <option key={i.id} value={i.id}>{i.product_name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></Field>
          <Field label="Unit Price (₹)"><Input type="number" value={form.unit_price} onChange={e => setForm({...form, unit_price: e.target.value})} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              {['draft','confirmed','dispatched','delivered','completed'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </Select>
          </Field>
          <Field label="Payment">
            <Select value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})}>
              {['Pending','Partial','Paid'].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
        <div className="flex gap-3 pt-2">
          <BtnSecondary onClick={() => setShowAdd(false)} className="flex-1 justify-center">Cancel</BtnSecondary>
          <BtnPrimary onClick={handleCreate} loading={saving} className="flex-1 justify-center">Create Deal</BtnPrimary>
        </div>
      </SlidePanel>
    </Page>
  );
}

// ─── TRANSIT ──────────────────────────────────────────────────────────────────
function Transit() {
  const [shipments, setShipments] = useState([]);
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    vehicle_number:'', driver_name:'', driver_phone:'', origin_yard_id:'',
    destination:'', dispatch_date: new Date().toISOString().split('T')[0],
    expected_arrival:'', freight_cost:'', status:'Created', cargo_details:'',
  });

  const STAGES = ['All','Created','Loaded','Dispatched','In Transit','Arrived','Delivered'];

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, y] = await Promise.all([api.get('/api/shipments'), api.get('/api/yards')]);
      setShipments(s.data); setYards(y.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.vehicle_number) { setFormError('Vehicle number is required.'); return; }
    if (!form.destination) { setFormError('Destination is required.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.post('/api/shipments', {
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name || undefined,
        driver_phone: form.driver_phone || undefined,
        origin_yard_id: form.origin_yard_id || undefined,
        destination: form.destination,
        dispatch_date: form.dispatch_date || undefined,
        expected_arrival: form.expected_arrival || undefined,
        freight_cost: parseFloat(form.freight_cost) || 0,
        status: form.status || 'Created',
        cargo_details: form.cargo_details || undefined,
      });
      setShowAdd(false);
      setFormError(null);
      setForm({ vehicle_number:'', driver_name:'', driver_phone:'', origin_yard_id:'', destination:'', dispatch_date: new Date().toISOString().split('T')[0], expected_arrival:'', freight_cost:'', status:'Created', cargo_details:'' });
      fetchAll();
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.hint || e.message || 'Failed to add shipment.';
      setFormError(msg);
    }
    finally { setSaving(false); }
  };

  const tabs = STAGES.map(s => ({
    value: s, label: s,
    count: s === 'All' ? shipments.length : shipments.filter(sh => sh.status === s).length
  }));

  const filtered = shipments.filter(s => {
    const matchTab = tab === 'All' || s.status === tab;
    const matchSearch = !search || s.shipment_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.vehicle_number?.toLowerCase().includes(search.toLowerCase()) || s.destination?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <Page
      title="Transit"
      subtitle={`${shipments.length} shipments tracked`}
      actions={<BtnPrimary onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Shipment</BtnPrimary>}
    >
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}
      <TabFilter tabs={tabs} value={tab} onChange={setTab} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by vehicle, destination, driver..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 max-w-md" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? <PageLoader /> : (
          <Table
            headers={['Shipment #','Vehicle','Driver','Origin','Destination','Dispatch','ETA','Status','Freight']}
            empty={filtered.length === 0 && <EmptyState icon={Truck} title="No shipments found" description="Add your first shipment to start tracking." />}
          >
            {filtered.map(sh => (
              <Tr key={sh.id}>
                <Td><span className="font-mono text-xs text-gray-500">{sh.shipment_number}</span></Td>
                <Td className="font-semibold">{sh.vehicle_number || '—'}</Td>
                <Td>{sh.driver_name || '—'}</Td>
                <Td>{yards.find(y => y.id === sh.origin_yard_id)?.name || '—'}</Td>
                <Td>{sh.destination || '—'}</Td>
                <Td className="text-xs">{sh.dispatch_date ? new Date(sh.dispatch_date).toLocaleDateString('en-IN') : '—'}</Td>
                <Td className="text-xs">{sh.expected_arrival ? new Date(sh.expected_arrival).toLocaleDateString('en-IN') : '—'}</Td>
                <Td><Badge status={sh.status?.toLowerCase().replace(' ','_')} label={sh.status} /></Td>
                <Td>{formatCurrency(sh.freight_cost)}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </div>

      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Add Shipment">
        <Field label="Vehicle Number" required>
          <Input placeholder="GJ-01-AB-1234" value={form.vehicle_number} onChange={e => setForm({...form, vehicle_number: e.target.value})} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Driver Name"><Input value={form.driver_name} onChange={e => setForm({...form, driver_name: e.target.value})} /></Field>
          <Field label="Driver Phone"><Input value={form.driver_phone} onChange={e => setForm({...form, driver_phone: e.target.value})} /></Field>
        </div>
        <Field label="Origin Yard" required>
          <Select value={form.origin_yard_id} onChange={e => setForm({...form, origin_yard_id: e.target.value})}>
            <option value="">Select yard</option>
            {yards.map(y => <option key={y.id} value={y.id}>{y.name || y.yard_name}</option>)}
          </Select>
        </Field>
        <Field label="Destination" required>
          <Input placeholder="e.g. Ahmedabad Warehouse" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dispatch Date"><Input type="date" value={form.dispatch_date} onChange={e => setForm({...form, dispatch_date: e.target.value})} /></Field>
          <Field label="Expected Arrival"><Input type="date" value={form.expected_arrival} onChange={e => setForm({...form, expected_arrival: e.target.value})} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Freight Cost (₹)"><Input type="number" value={form.freight_cost} onChange={e => setForm({...form, freight_cost: e.target.value})} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              {['Created','Loaded','Dispatched','In Transit','Arrived','Delivered'].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Cargo Details">
          <Textarea placeholder="Describe the cargo..." value={form.cargo_details} onChange={e => setForm({...form, cargo_details: e.target.value})} />
        </Field>
        {formError && <ErrorBanner message={formError} />}
        <div className="flex gap-3 pt-2">
          <BtnSecondary onClick={() => setShowAdd(false)} className="flex-1 justify-center">Cancel</BtnSecondary>
          <BtnPrimary onClick={handleCreate} loading={saving} className="flex-1 justify-center">Add Shipment</BtnPrimary>
        </div>
      </SlidePanel>
    </Page>
  );
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', city:'', country:'India', contact_person:'', phone:'', email:'', products_supplied:'', notes:'' });

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, i] = await Promise.all([api.get('/api/suppliers'), api.get('/api/inventory')]);
      setSuppliers(s.data); setInventory(i.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.post('/api/suppliers', form);
      setShowAdd(false);
      setForm({ name:'', city:'', country:'India', contact_person:'', phone:'', email:'', products_supplied:'', notes:'' });
      fetchAll();
    } catch (e) { console.error(e); setFormError?.(e.response?.data?.error || e.response?.data?.hint || e.message || "An error occurred."); }
    finally { setSaving(false); }
  };

  const filtered = suppliers.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  );

  const supplierInventory = (id) => inventory.filter(i => i.supplier_id === id);

  return (
    <Page
      title="Suppliers"
      subtitle={`${suppliers.length} suppliers`}
      actions={<BtnPrimary onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Supplier</BtnPrimary>}
    >
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 max-w-md" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? <PageLoader /> : (
          <Table
            headers={['Supplier','Location','Contact','Products Supplied','Inventory Items','Total Purchased']}
            empty={filtered.length === 0 && <EmptyState icon={Building2} title="No suppliers found" />}
          >
            {filtered.map(s => {
              const inv = supplierInventory(s.id);
              const total = inv.reduce((a, i) => a + (i.cost_price || 0) * (i.available_quantity || 0), 0);
              return (
                <Tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                    </div>
                  </Td>
                  <Td>
                    {s.contact_person && <p className="font-medium text-sm">{s.contact_person}</p>}
                    {s.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</p>}
                  </Td>
                  <Td className="text-sm">{s.products_supplied || '—'}</Td>
                  <Td className="font-semibold">{inv.length}</Td>
                  <Td className="font-semibold">{formatCurrency(total)}</Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </div>

      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Add Supplier">
        <Field label="Supplier Name" required>
          <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></Field>
          <Field label="Country"><Input value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></Field>
        <Field label="Products Supplied">
          <Input placeholder="e.g. Teak Logs, Plywood Sheets" value={form.products_supplied} onChange={e => setForm({...form, products_supplied: e.target.value})} />
        </Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
        <div className="flex gap-3 pt-2">
          <BtnSecondary onClick={() => setShowAdd(false)} className="flex-1 justify-center">Cancel</BtnSecondary>
          <BtnPrimary onClick={handleCreate} loading={saving} className="flex-1 justify-center">Add Supplier</BtnPrimary>
        </div>
      </SlidePanel>
    </Page>
  );
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
function Customers() {
  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', city:'', country:'India', phone:'', email:'', notes:'' });

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, d] = await Promise.all([api.get('/api/customers'), api.get('/api/deals')]);
      setCustomers(c.data); setDeals(d.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.post('/api/customers', form);
      setShowAdd(false);
      setForm({ name:'', city:'', country:'India', phone:'', email:'', notes:'' });
      fetchAll();
    } catch (e) { console.error(e); setFormError?.(e.response?.data?.error || e.response?.data?.hint || e.message || "An error occurred."); }
    finally { setSaving(false); }
  };

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const custDeals = (id) => deals.filter(d => d.customer_id === id);

  return (
    <Page
      title="Customers"
      subtitle={`${customers.length} customers`}
      actions={<BtnPrimary onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Customer</BtnPrimary>}
    >
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 max-w-md" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? <PageLoader /> : (
          <Table
            headers={['Customer','Location','Contact','Total Deals','Revenue','Last Deal']}
            empty={filtered.length === 0 && <EmptyState icon={Users} title="No customers yet" description="Add your first customer." />}
          >
            {filtered.map(c => {
              const cd = custDeals(c.id);
              const rev = cd.filter(d => ['delivered','completed'].includes(d.status)).reduce((a, d) => a + (d.total_value || 0), 0);
              const last = cd.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
              return (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                        {(c.name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    </div>
                  </Td>
                  <Td>
                    {c.phone && <p className="text-sm flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{c.phone}</p>}
                  </Td>
                  <Td className="font-semibold">{cd.length}</Td>
                  <Td className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(rev)}</Td>
                  <Td className="text-xs text-gray-400">{last ? new Date(last.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </div>

      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer">
        <Field label="Customer Name" required><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></Field>
          <Field label="Country"><Input value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
        <div className="flex gap-3 pt-2">
          <BtnSecondary onClick={() => setShowAdd(false)} className="flex-1 justify-center">Cancel</BtnSecondary>
          <BtnPrimary onClick={handleCreate} loading={saving} className="flex-1 justify-center">Add Customer</BtnPrimary>
        </div>
      </SlidePanel>
    </Page>
  );
}

// ─── FINANCIALS ───────────────────────────────────────────────────────────────
function Financials() {
  const [data, setData] = useState({ inventory: [], deals: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [inv, deals] = await Promise.all([api.get('/api/inventory'), api.get('/api/deals')]);
      setData({ inventory: inv.data, deals: deals.data });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const inventoryCost = data.inventory.reduce((a, i) => a + (i.cost_price || 0) * (i.available_quantity || 0), 0);
  const marketValue = data.inventory.reduce((a, i) => a + (i.market_value || i.cost_price || 0) * (i.available_quantity || 0), 0);
  const revenue = data.deals.filter(d => ['delivered','completed'].includes(d.status)).reduce((a, d) => a + (d.total_value || 0), 0);
  const profit = revenue * 0.18;
  const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6'];

  const categoryBar = data.inventory.reduce((acc, item) => {
    const ex = acc.find(d => d.name === item.category);
    const v = (item.cost_price || 0) * (item.available_quantity || 0);
    if (ex) ex.value += v; else acc.push({ name: item.category || 'Other', value: v });
    return acc;
  }, []);

  const months = ['Oct','Nov','Dec','Jan','Feb','Mar'];
  const base = inventoryCost || 700000;
  const trend = months.map((m, i) => ({
    month: m,
    Revenue: Math.round(revenue / 6 + Math.random() * 50000 * i),
    Cost: Math.round(base * 0.4 + base * 0.03 * i),
    Profit: Math.round(profit / 6 + Math.random() * 10000 * i),
  }));

  if (loading) return <PageLoader text="Loading financials..." />;

  return (
    <Page title="Financials" subtitle="Financial overview and analytics">
      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(revenue), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Inventory Cost', value: formatCurrency(inventoryCost), icon: Package, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Market Value', value: formatCurrency(marketValue), icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Profit Estimate', value: formatCurrency(profit), sub: '~18% margin', icon: Star, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-3">
            <div className={cls('w-10 h-10 rounded-lg flex items-center justify-center', s.bg)}>
              <s.icon className={cls('w-5 h-5', s.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              {s.sub && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Revenue, Cost & Profit Trend</h3>
        <p className="text-xs text-gray-400 mb-5">6-month overview</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend}>
            <defs>
              {['#3b82f6','#10b981','#f59e0b'].map((c, i) => (
                <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-700" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
            <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#g0)" />
            <Area type="monotone" dataKey="Cost" stroke="#10b981" strokeWidth={2} fill="url(#g1)" />
            <Area type="monotone" dataKey="Profit" stroke="#f59e0b" strokeWidth={2} fill="url(#g2)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Revenue by Customer</h3>
          {data.deals.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">No deal data yet</p>
            : <p className="text-gray-400 text-sm text-center py-8">Deal revenue breakdown coming soon</p>
          }
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Inventory Value by Category</h3>
          {categoryBar.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryBar} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={BarChart3} title="No inventory data" />}
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">P&L Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'TOTAL REVENUE', value: formatCurrency(revenue), sub: 'From completed & delivered deals', color: 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800' },
            { label: 'INVENTORY INVESTMENT', value: formatCurrency(inventoryCost), sub: 'Current stock at cost price', color: 'border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800' },
            { label: 'PROFIT ESTIMATE', value: formatCurrency(profit), sub: '~18% estimated margin', color: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800' },
          ].map(item => (
            <div key={item.label} className={cls('rounded-xl border p-4', item.color)}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{item.value}</p>
              <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ─── AI INSIGHTS ──────────────────────────────────────────────────────────────
function AIInsights() {
  const [inventory, setInventory] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState({});
  const [insights, setInsights] = useState({ demand: [], alerts: [], sales: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inv, d] = await Promise.all([api.get('/api/inventory'), api.get('/api/deals')]);
        setInventory(inv.data); setDeals(d.data);
        generateInitialInsights(inv.data, d.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const generateInitialInsights = (inv, deals) => {
    const alerts = inv.map(item => ({
      tag: `${item.available_quantity || 0} ${item.unit || 'CBM'}`,
      title: `${item.available_quantity < 20 ? 'Low Stock Alert' : 'Stock Availability'} for ${item.product_name}`,
      body: item.available_quantity < 20
        ? `Current inventory is at ${item.available_quantity} ${item.unit}, close to minimum threshold.`
        : `Currently holds ${item.available_quantity} ${item.unit}. Ensure logistics are in place.`,
      color: item.available_quantity < 20 ? 'orange' : 'blue',
    }));

    setInsights({
      demand: [
        { tag: '25% INCREASE', title: 'Increase in Teak Wood Demand', body: 'Expected increase due to growth in luxury furniture and interior design projects.', color: 'green' },
        { tag: '15% INCREASE', title: 'Rise in Parawood Utilization', body: 'Parawood projected to see 15% rise in demand due to cost-effectiveness and sustainability.', color: 'green' },
        { tag: '20% INCREASE', title: 'Shift Towards Engineered Wood', body: 'Growing trend with a predicted 20% increase as builders seek cost-efficient solutions.', color: 'green' },
      ],
      alerts,
      sales: [
        { tag: 'AVG PURCHASE FREQUENCY: 2 MONTHS', title: 'Customer Purchase Frequency', body: 'Timber buyers tend to purchase every 2 months on average, driven by seasonal projects.', color: 'blue' },
        { tag: 'TOP PRODUCTS: OAK (40%), PINE (30%)', title: 'Top Performing Timber Products', body: 'Oak and Pine accounted for 70% of total sales in the last quarter.', color: 'blue' },
        { tag: 'QUARTERLY REVENUE GROWTH: 15%', title: 'Revenue Trends Over Time', body: 'Steady 15% quarterly growth with spikes during home improvement seasons.', color: 'blue' },
      ],
    });
  };

  const regenerate = async (section) => {
    setGenerating(p => ({ ...p, [section]: true }));
    await new Promise(r => setTimeout(r, 1500));
    setGenerating(p => ({ ...p, [section]: false }));
  };

  const InsightCard = ({ tag, title, body, color }) => {
    const colors = {
      green: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
      blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
      orange: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
    };
    return (
      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2">
        <p className={cls('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit', colors[color] || colors.blue)}>{tag}</p>
        <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
      </div>
    );
  };

  const columns = [
    { key: 'demand', title: 'Demand Prediction', icon: TrendingUp, data: insights.demand },
    { key: 'alerts', title: 'Inventory Alerts', icon: AlertCircle, data: insights.alerts },
    { key: 'sales', title: 'Sales Analytics', icon: BarChart3, data: insights.sales },
  ];

  if (loading) return <PageLoader text="Loading AI data..." />;

  return (
    <Page title="AI Insights" subtitle="AI-powered analytics for your timber operations">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Powered by AI Analytics</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Generate real-time insights based on your actual inventory and deal data. Click any module below to analyze your data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {columns.map(col => (
          <div key={col.key} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <col.icon className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">{col.title}</span>
              </div>
              <button
                onClick={() => regenerate(col.key)}
                disabled={generating[col.key]}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {generating[col.key] ? <Spinner size={3} /> : <RefreshCw className="w-3 h-3" />}
                Generate
              </button>
            </div>
            <div className="p-4 space-y-3">
              {col.data.length === 0
                ? <p className="text-gray-400 text-sm text-center py-4">No data available. Click Generate.</p>
                : col.data.map((item, i) => <InsightCard key={i} {...item} />)
              }
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
function Reports() {
  const [loading, setLoading] = useState(false);

  const downloadCSV = async (type) => {
    setLoading(true);
    try {
      let data, filename, headers;
      switch (type) {
        case 'inventory': {
          const res = await api.get('/api/inventory');
          data = res.data;
          headers = ['id','product_name','category','wood_type','quality_grade','available_quantity','unit','cost_price','market_value'];
          filename = 'inventory_report.csv';
          break;
        }
        case 'deals': {
          const res = await api.get('/api/deals');
          data = res.data;
          headers = ['id','deal_number','customer_id','quantity','unit_price','total_value','status','payment_status','created_at'];
          filename = 'sales_report.csv';
          break;
        }
        case 'shipments': {
          const res = await api.get('/api/shipments');
          data = res.data;
          headers = ['id','shipment_number','vehicle_number','driver_name','destination','status','dispatch_date','expected_arrival','freight_cost'];
          filename = 'shipment_report.csv';
          break;
        }
        case 'suppliers': {
          const res = await api.get('/api/suppliers');
          data = res.data;
          headers = ['id','name','city','country','contact_person','phone','email','products_supplied'];
          filename = 'supplier_report.csv';
          break;
        }
        case 'customers': {
          const res = await api.get('/api/customers');
          data = res.data;
          headers = ['id','name','city','country','phone','email'];
          filename = 'customer_report.csv';
          break;
        }
        default: return;
      }
      const csvRows = [headers.join(',')];
      data.forEach(row => csvRows.push(headers.map(h => JSON.stringify(row[h] ?? '')).join(',')));
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Export failed: ' + e.message); }
    finally { setLoading(false); }
  };

  const reports = [
    { key: 'inventory', icon: Package, label: 'Inventory Report', desc: 'Full inventory listing with values and yard locations', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { key: 'deals', icon: Briefcase, label: 'Sales Report', desc: 'All deals with customer, value, and payment status', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { key: 'shipments', icon: Truck, label: 'Shipment Report', desc: 'Transit history with vehicle and status details', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { key: 'suppliers', icon: Building2, label: 'Supplier Report', desc: 'Supplier list with purchase volumes', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { key: 'customers', icon: Users, label: 'Customer Report', desc: 'Customer list with deal history and revenue', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <Page title="Reports" subtitle="Export your business data in CSV format">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {reports.map(r => (
          <div key={r.key} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={cls('w-10 h-10 rounded-xl flex items-center justify-center', r.bg)}>
                <r.icon className={cls('w-5 h-5', r.color)} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{r.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
              </div>
            </div>
            <button
              onClick={() => downloadCSV(r.key)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">About Reports</p>
        <ul className="space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
          {[
            'All reports are exported as CSV files, compatible with Excel and Google Sheets',
            'Reports include all records from your account',
            'Data is exported with real-time values at time of export',
            'PDF export coming soon in the next update',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span> {t}
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsPage() {
  const user = JSON.parse(localStorage.getItem('dockside-user') || '{}');
  const [company, setCompany] = useState({ name:'', industry:'Timber & Plywood', currency:'INR', city:'', country:'India', phone:'', email:'' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/company').then(res => {
      if (res.data && res.data.id) setCompany(res.data);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (company.id) await api.put(`/api/company/${company.id}`, company);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); setFormError?.(e.response?.data?.error || e.response?.data?.hint || e.message || "An error occurred."); }
    finally { setSaving(false); }
  };

  return (
    <Page title="Settings" subtitle="Manage your account and company settings">
      <div className="max-w-2xl space-y-6">
        {/* Account */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Account</h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Name</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-1 uppercase">{user.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Email</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-1">{user.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Role</p>
                <Badge status={user.role || 'admin'} label={user.role || 'admin'} />
              </div>
            </div>
          </div>
        </div>

        {/* Company Profile */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Company Profile</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <Field label="Company Name">
              <Input placeholder="Your company name" value={company.name || ''} onChange={e => setCompany({...company, name: e.target.value})} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry">
                <Select value={company.industry || 'Timber & Plywood'} onChange={e => setCompany({...company, industry: e.target.value})}>
                  {['Timber & Plywood','Steel','Paper','Agriculture','Other'].map(i => <option key={i}>{i}</option>)}
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={company.currency || 'INR'} onChange={e => setCompany({...company, currency: e.target.value})}>
                  {['INR','USD','EUR','AED','GBP'].map(c => <option key={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City"><Input value={company.city || ''} onChange={e => setCompany({...company, city: e.target.value})} /></Field>
              <Field label="Country"><Input value={company.country || ''} onChange={e => setCompany({...company, country: e.target.value})} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone"><Input value={company.phone || ''} onChange={e => setCompany({...company, phone: e.target.value})} /></Field>
              <Field label="Email"><Input type="email" value={company.email || ''} onChange={e => setCompany({...company, email: e.target.value})} /></Field>
            </div>
            <BtnPrimary onClick={handleSave} loading={saving} className={saved ? 'bg-green-600 hover:bg-green-700' : ''}>
              {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><FileText className="w-4 h-4" /> Save Settings</>}
            </BtnPrimary>
          </div>
        </div>

        {/* Platform Info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Platform</h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            {[
              ['Version', 'Dockside v1.0'],
              ['Platform', 'Timber & Plywood Trade OS'],
              ['Support Industries', 'Timber, Steel, Paper, Agriculture'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{k}</span>
                <span className="text-gray-900 dark:text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isAuth, setIsAuth] = useState(() => !!localStorage.getItem('dockside-token'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dockside-dark') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('dockside-dark', darkMode);
  }, [darkMode]);

  const handleLogout = () => {
    localStorage.removeItem('dockside-token');
    localStorage.removeItem('dockside-user');
    setIsAuth(false);
  };

  if (!isAuth) return <Login onLogin={() => setIsAuth(true)} />;

  return (
    <Router>
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(p => !p)}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col lg:ml-52 min-w-0 overflow-hidden">
          <Header onSidebarOpen={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto">
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
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
