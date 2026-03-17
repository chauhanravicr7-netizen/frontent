import React, { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { sb, signOut } from "./lib/supabase";
import { GlobalStyles, Login, NewUserSetup } from "./shared";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";

// ── DEVICE DETECTION ───────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth < 768; } catch { return false; }
  });
  useEffect(() => {
    const handler = () => {
      try { setIsMobile(window.innerWidth < 768); } catch {}
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── APP ROOT ───────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:20,fontFamily:"sans-serif",background:"#fff",minHeight:"100vh"}}>
          <div style={{textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:40,marginBottom:12}}>⚓</div>
            <div style={{fontWeight:"bold",fontSize:18,color:"#1e3a5f"}}>Dockside</div>
            <div style={{color:"#ef4444",marginTop:16,fontSize:14}}>
              App crashed. Please refresh the page.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{marginTop:20,padding:"10px 24px",background:"#2563eb",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:"bold",cursor:"pointer"}}>
              Refresh App
            </button>
            {process.env.NODE_ENV === "development" && (
              <pre style={{marginTop:16,fontSize:11,textAlign:"left",background:"#f1f5f9",padding:12,borderRadius:8,overflow:"auto",maxHeight:200}}>
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <BrowserRouter>
        <GlobalStyles />
        {isMobile
          ? <MobileApp user={user} companyId={resolvedCompanyId} onSignOut={handleSignOut} />
          : <DesktopApp user={user} companyId={resolvedCompanyId} onSignOut={handleSignOut} />
        }
      </BrowserRouter>
    </ErrorBoundary>
  );
}
