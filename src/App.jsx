import React, { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { sb, signOut } from "./lib/supabase";
import { GlobalStyles, Login, NewUserSetup } from "./shared";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";

// ── DEVICE DETECTION ───────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── APP ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined);
  const [companyId, setCompanyId] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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

  // Loading
  if (user === undefined || companyId === null) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">⚓</div>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-3" />
      </div>
    </div>
  );

  // Not logged in
  if (!user || companyId === "__resolved__") return <Login onLogin={setUser} />;

  // New user - no company yet
  if (companyId === "__none__") return (
    <NewUserSetup
      user={user}
      onDone={(cid) => setCompanyId(cid)}
      onSignOut={async () => { await signOut(); setUser(null); setCompanyId(null); }}
    />
  );

  const resolvedCompanyId = companyId;

  return (
    <BrowserRouter>
      <GlobalStyles />
      {isMobile
        ? <MobileApp user={user} companyId={resolvedCompanyId} onSignOut={handleSignOut} />
        : <DesktopApp user={user} companyId={resolvedCompanyId} onSignOut={handleSignOut} />
      }
    </BrowserRouter>
  );
}
