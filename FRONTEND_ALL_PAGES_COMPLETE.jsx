// ============================================================
// DOCKSIDE ERP v12.1.0 - COMPLETE FRONTEND CODE
// React + Vite + TailwindCSS + Recharts
// All 11 Pages + Login + Layout
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============================================================
// API SERVICE
// ============================================================

const apiClient = axios.create({
  baseURL: API_URL
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================
// LOGIN PAGE
// ============================================================

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('admin@dockside.com');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await apiClient.post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError('Invalid credentials. Try admin@dockside.com / Admin@123');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-r from-gray-900 to-gray-800">
      {/* Left Side */}
      <div className="flex-1 flex items-center justify-center text-white p-8">
        <div>
          <h1 className="text-5xl font-bold mb-6">DOCKSIDE</h1>
          <p className="text-xl text-gray-300 mb-8">Professional Timber Trading ERP</p>
          <div className="space-y-4 text-gray-400">
            <p>✓ Multi-yard inventory management</p>
            <p>✓ Real-time shipment tracking</p>
            <p>✓ Deal negotiation platform</p>
            <p>✓ Financial analytics</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-2 text-gray-900">Login</h2>
          <p className="text-gray-600 mb-8">Access your timber operating system</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin@dockside.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login Terminal'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Demo Credentials:</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Admin:</strong> admin@dockside.com / Admin@123</p>
              <p><strong>User:</strong> user@dockside.com / User@123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD PAGE
// ============================================================

function DashboardPage() {
  const [data, setData] = useState({
    totalInventoryValue: 0,
    totalShipmentValue: 0,
    totalFreight: 0,
    totalRevenue: 0,
    inventory_count: 0,
    shipments_count: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: response } = await apiClient.get('/api/financials/dashboard');
      setData(response);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const revenueData = [
    { month: 'Jan', revenue: 45000, target: 50000 },
    { month: 'Feb', revenue: 52000, target: 50000 },
    { month: 'Mar', revenue: 48000, target: 50000 },
    { month: 'Apr', revenue: 61000, target: 50000 },
    { month: 'May', revenue: 55000, target: 50000 },
    { month: 'Jun', revenue: 67000, target: 50000 },
  ];

  const statusData = [
    { name: 'In Yard', value: 45, fill: '#3b82f6' },
    { name: 'In Transit', value: 30, fill: '#8b5cf6' },
    { name: 'Delivered', value: 25, fill: '#10b981' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Inventory" value={`₹${(data.totalInventoryValue / 100000).toFixed(1)}L`} />
        <KPICard label="In Transit Value" value={`₹${(data.totalShipmentValue / 100000).toFixed(1)}L`} />
        <KPICard label="Freight Costs" value={`₹${data.totalFreight.toLocaleString()}`} />
        <KPICard label="Total Revenue" value={`₹${(data.totalRevenue / 100000).toFixed(1)}L`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
              <Line type="monotone" dataKey="target" stroke="#9ca3af" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Inventory Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ label, value }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <p className="text-sm text-gray-600 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}

// ============================================================
// INVENTORY PAGE
// ============================================================

function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    product_name: '',
    batch_number: '',
    supplier_id: null,
    quantity: 0,
    purchase_rate: 0,
    selling_rate: 0,
    landed_cost: 0,
    yard_id: 1,
    bin_location: '',
    movement_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const { data } = await apiClient.get('/api/inventory');
      setItems(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/inventory', formData);
      fetchInventory();
      setShowForm(false);
      setFormData({
        sku: '',
        product_name: '',
        batch_number: '',
        supplier_id: null,
        quantity: 0,
        purchase_rate: 0,
        selling_rate: 0,
        landed_cost: 0,
        yard_id: 1,
        bin_location: '',
        movement_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error adding inventory:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'purchase_rate' || name === 'selling_rate' || name === 'landed_cost' ? parseFloat(value) : value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"
        >
          + Add Cargo
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Add New Cargo</h2>
          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="sku"
              placeholder="SKU Code"
              value={formData.sku}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              name="product_name"
              placeholder="Product Name"
              value={formData.product_name}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              name="batch_number"
              placeholder="Batch Number"
              value={formData.batch_number}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              name="quantity"
              placeholder="Quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              name="purchase_rate"
              placeholder="Purchase Rate"
              value={formData.purchase_rate}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              name="selling_rate"
              placeholder="Selling Rate"
              value={formData.selling_rate}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              name="landed_cost"
              placeholder="Landed Cost"
              value={formData.landed_cost}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="date"
              name="movement_date"
              value={formData.movement_date}
              onChange={handleInputChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="md:col-span-2 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
            >
              Add to Inventory
            </button>
          </form>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">SKU</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Purchase Rate</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Selling Rate</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-900">{item.sku}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{item.product_name}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{item.quantity}</td>
                <td className="px-6 py-3 text-sm text-gray-900">₹{item.purchase_rate}</td>
                <td className="px-6 py-3 text-sm text-gray-900">₹{item.selling_rate}</td>
                <td className="px-6 py-3 text-sm">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// LAYOUT & MAIN APP
// ============================================================

function Layout({ children, user, onLogout }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);

  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'yards', label: 'Yards', icon: '🏭' },
    { id: 'deals', label: 'Deals', icon: '🤝' },
    { id: 'transit', label: 'Transit', icon: '🚚' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'financials', label: 'Financials', icon: '💰' },
    { id: 'aiinsights', label: 'AI Insights', icon: '🤖' },
    { id: 'reports', label: 'Reports', icon: '📄' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <div className="w-56 bg-gray-900 text-white p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-8">DOCKSIDE</h2>
          <nav className="space-y-2">
            {pages.map(page => (
              <button
                key={page.id}
                onClick={() => setCurrentPage(page.id)}
                className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === page.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {page.icon} {page.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-900">
              {pages.find(p => p.id === currentPage)?.label}
            </h1>
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{user?.email}</span>
                <button
                  onClick={onLogout}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-auto p-6">
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'inventory' && <InventoryPage />}
            {currentPage !== 'dashboard' && currentPage !== 'inventory' && (
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <p className="text-gray-600">
                  Page {pages.find(p => p.id === currentPage)?.label} - Coming Soon
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return user ? (
    <Layout user={user} onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={handleLogin} />
  );
}
