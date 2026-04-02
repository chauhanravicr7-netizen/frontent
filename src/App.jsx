import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { sb } from "./lib/supabase";
import { Spinner } from "./shared";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";

// LOGIN PAGE
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(to bottom right, #2563eb, #4f46e5)', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '2rem', width: '100%', maxWidth: '28rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>⚓</div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '900', color: '#1f2937' }}>Dockside</h1>
          <p style={{ color: '#4b5563', fontSize: '0.875rem', marginTop: '0.25rem' }}>Timber Trade OS</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem', color: '#b91c1c', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#2563eb', color: 'white', padding: '0.625rem 0', borderRadius: '0.5rem', fontWeight: '700', border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '1.5rem' }}>
          Demo: Use your Supabase credentials
        </p>
      </div>
    </div>
  );
}

// MAIN APP
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await sb.auth.getUser();
        if (authUser) {
          setUser(authUser);
        }
      } catch (err) {
        console.error("Auth check error:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: subscription } = sb.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (!user) {
    return <LoginPage />;
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            isMobile ? (
              <MobileApp onSignOut={() => setUser(null)} />
            ) : (
              <DesktopApp onSignOut={() => setUser(null)} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
