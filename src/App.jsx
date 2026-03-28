import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { sb, signOut } from "./lib/supabase";
import { useAuth, AuthCtx } from "./shared";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";

// ── SIMPLE AUTH CHECK ──────────────────────────────────────
function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async () => {
    if (!email) { setErr("Email required"); return; }
    setLoading(true);
    setErr("");
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password: email });
      if (error) throw error;
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-black text-gray-800 mb-2">⚓ Dockside</h1>
        <p className="text-gray-600 text-sm mb-6">Timber Trade OS</p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500"
        />
        {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await sb.auth.getUser();
      setUser(authUser);
      setLoading(false);
    };
    checkAuth();

    const { data: subscription } = sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const onSignOut = async () => {
    await signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // Detect mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <BrowserRouter>
      <Routes>
        {isMobile ? (
          <Route path="*" element={<MobileApp onSignOut={onSignOut} />} />
        ) : (
          <Route path="*" element={<DesktopApp onSignOut={onSignOut} />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
