import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LayoutDashboard, Package, Warehouse, Handshake, Truck, Building2, Users, BarChart3, Sparkles, FileText, Settings, Menu, X, Moon, Sun, LogOut, Package2, AlertCircle } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// API Client
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dockside-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const formatCurrency = (val) => {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
};

// ============================================================================
// LOGIN PAGE
// ============================================================================
function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@dockside.com');
  const [password, setPassword] = useState('admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('dockside-token', response.data.token);
      localStorage.setItem('dockside-user', JSON.stringify(response.data.user));
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <Package2 className="w-8 h-8 text-blue-600" />
          <div className="ml-3">
            <h1 className="text-3xl font-bold text-gray-900">Dockside</h1>
            <p className="text-sm text-gray-600">Trade Operating System</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6 space-y-1">
          <div>Demo Credentials:</div>
          <div className="font-mono text-xs bg-gray-100 p-2 rounded">admin@dockside.com / admin@123</div>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SIDEBAR & LAYOUT
// ============================================================================
function Sidebar({ isOpen, onClose, darkMode }) {
  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/yards', icon: Warehouse, label: 'Yards' },
    { path: '/deals', icon: Handshake, label: 'Deals' },
    { path: '/transit', icon: Truck, label: 'Transit' },
    { path: '/suppliers', icon: Building2, label: 'Suppliers' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/financials', icon: BarChart3, label: 'Financials' },
    { path: '/ai-insights', icon: Sparkles, label: 'AI Insights' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300`}>
      <div className="p-6 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <Package2 className="w-8 h-8 text-blue-400" />
          <div>
            <div className="font-bold text-lg">Dockside</div>
            <div className="text-xs text-gray-400">Trade OS</div>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-white hover:bg-slate-800 p-1 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="space-y-1 px-3 py-6">
        {menuItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-gray-300 hover:text-white"
            onClick={onClose}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function Header({ onSidebarOpen, darkMode, onToggleDarkMode, onLogout }) {
  return (
    <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      <button onClick={onSidebarOpen} className="lg:hidden text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-lg">
        <Menu className="w-6 h-6" />
      </button>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-1 text-center lg:text-left">Dockside</h1>
      <div className="flex items-center space-x-4">
        <button onClick={onToggleDarkMode} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button onClick={onLogout} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD PAGE
// ============================================================================
function Dashboard() {
  const [stats, setStats] = useState({
    totalInventoryValue: 0,
    totalVolume: 0,
    activeShipments: 0,
    pendingDeliveries: 0,
    activeYards: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, inventoryRes] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/inventory'),
      ]);

      setStats(statsRes.data);

      const categoryData = inventoryRes.data.reduce((acc, item) => {
        const existing = acc.find(d => d.name === item.category);
        const value = (item.available_quantity || 0) * (item.cost_price || 0);
        if (existing) {
          existing.value += value;
        } else {
          acc.push({ name: item.category, value });
        }
        return acc;
      }, []);

      setChartData(categoryData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

  if (loading) return <div className="p-6 text-center">Loading dashboard...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome back to Dockside</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Inventory Value" value={formatCurrency(stats.totalInventoryValue)} icon={Package} bgColor="bg-blue-500" />
        <StatCard title="Total Volume" value={`${Math.round(stats.totalVolume)}` || 0} icon={Warehouse} bgColor="bg-green-500" />
        <StatCard title="Active Shipments" value={stats.activeShipments} icon={Truck} bgColor="bg-yellow-500" />
        <StatCard title="Pending Deliveries" value={stats.pendingDeliveries} icon={Handshake} bgColor="bg-orange-500" />
        <StatCard title="Active Yards" value={stats.activeYards} icon={Warehouse} bgColor="bg-purple-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory by Category</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No inventory data</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Value by Category</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No inventory data</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, bgColor }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
      <div className={`${bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

// ============================================================================
// INVENTORY PAGE
// ============================================================================
function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'Plywood',
    quality_grade: 'Premium',
    unit: 'Sheets',
    total_quantity: '',
    cost_price: '',
    market_value: '',
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await api.get('/api/inventory');
      setInventory(response.data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/inventory', {
        ...formData,
        total_quantity: parseFloat(formData.total_quantity),
        available_quantity: parseFloat(formData.total_quantity),
        cost_price: parseFloat(formData.cost_price),
        market_value: parseFloat(formData.market_value),
      });
      setFormData({
        product_name: '',
        category: 'Plywood',
        quality_grade: 'Premium',
        unit: 'Sheets',
        total_quantity: '',
        cost_price: '',
        market_value: '',
      });
      fetchInventory();
    } catch (err) {
      console.error('Error adding inventory:', err);
      alert('Error adding inventory item');
    }
  };

  if (loading) return <div className="p-6 text-center">Loading inventory...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your stock items</p>
      </div>

      {/* Add Stock Form */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Add Stock Item</h2>
        <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Product Name *"
            value={formData.product_name}
            onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            required
          />
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="Plywood">Plywood</option>
            <option value="Logs">Logs</option>
            <option value="Veneer">Veneer</option>
            <option value="Timber">Timber</option>
            <option value="MDF">MDF</option>
            <option value="Hardwood">Hardwood</option>
            <option value="Softwood">Softwood</option>
            <option value="Other">Other</option>
          </select>
          <select
            value={formData.quality_grade}
            onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="Premium">Premium</option>
            <option value="A Grade">A Grade</option>
            <option value="B Grade">B Grade</option>
            <option value="C Grade">C Grade</option>
            <option value="Standard">Standard</option>
            <option value="Export Quality">Export Quality</option>
          </select>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="Sheets">Sheets</option>
            <option value="CBM">CBM</option>
            <option value="Pieces">Pieces</option>
            <option value="MT">MT</option>
            <option value="SFT">SFT</option>
          </select>
          <input
            type="number"
            placeholder="Quantity *"
            value={formData.total_quantity}
            onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="number"
            placeholder="Cost Price (₹) *"
            value={formData.cost_price}
            onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="number"
            placeholder="Market Value (₹)"
            value={formData.market_value}
            onChange={(e) => setFormData({ ...formData, market_value: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="md:col-span-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Add Stock Item
          </button>
        </form>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 dark:bg-slate-700 border-b dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Product</th>
                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Category</th>
                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Grade</th>
                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Quantity</th>
                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Cost Price</th>
                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Market Value</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-3 text-gray-900 dark:text-white font-medium">{item.product_name}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{item.category}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{item.quality_grade}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{item.total_quantity} {item.unit}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(item.cost_price)}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(item.market_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inventory.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No inventory items yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PLACEHOLDER PAGES
// ============================================================================
const PagePlaceholder = ({ title, description }) => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
    <p className="mt-4 text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

function Yards() { return <PagePlaceholder title="Yards" description="Yard management coming soon..." />; }
function Deals() { return <PagePlaceholder title="Deals" description="Deal management coming soon..." />; }
function Transit() { return <PagePlaceholder title="Transit" description="Shipment tracking coming soon..." />; }
function Suppliers() { return <PagePlaceholder title="Suppliers" description="Supplier management coming soon..." />; }
function Customers() { return <PagePlaceholder title="Customers" description="Customer management coming soon..." />; }
function Financials() { return <PagePlaceholder title="Financials" description="Financial analytics coming soon..." />; }
function AIInsights() { return <PagePlaceholder title="AI Insights" description="AI-powered insights coming soon..." />; }
function Reports() { return <PagePlaceholder title="Reports" description="Report generation coming soon..." />; }
function Settings() { return <PagePlaceholder title="Settings" description="Settings coming soon..." />; }

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function AppWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('dockside-token');
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('dockside-dark') === 'true';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dockside-dark', darkMode);
    setLoading(false);
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const handleLogout = () => {
    localStorage.removeItem('dockside-token');
    localStorage.removeItem('dockside-user');
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} darkMode={darkMode} />
        <div className="flex-1 flex flex-col lg:ml-64">
          <Header
            onSidebarOpen={() => setSidebarOpen(true)}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onLogout={handleLogout}
          />
          <div className="flex-1 overflow-auto">
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
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
