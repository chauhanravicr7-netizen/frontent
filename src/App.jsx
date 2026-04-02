import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { sb, signOut } from "./lib/supabase";
import { useAuth, AuthCtx, Spinner } from "./shared";
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
      if (data.user) {
        const { data: userData } = await sb
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .single();
        if (userData) {
          localStorage.setItem("dockside-user", JSON.stringify(userData));
          window.location.href = "/";
        }
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">⚓</div>
          <h1 className="text-3xl font-black text-gray-800">Dockside</h1>
          <p className="text-gray-600 text-sm mt-1">Timber Trade OS</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
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
          const { data: userData } = await sb
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single();
          if (userData) {
            setUser(userData);
          } else {
            setUser(authUser);
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: subscription } = sb.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: userData } = await sb
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single()
            .catch(() => ({ data: null }));
          setUser(userData || session.user);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
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
