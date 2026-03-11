import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import AuthPage from '@/components/AuthPage';
import ForgeApp from '@/components/ForgeApp';

function Landing() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>CS</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Colin's Sketchpad</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">{user?.email}</span>
            <button onClick={signOut}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium">
              Sign Out
            </button>
          </div>
        </div>

        {/* Apps Grid */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-4">Apps</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* FORGE */}
            <Link to="/forge"
              className="card-elevated rounded-xl p-5 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center mb-3">
                <span className="text-white text-sm font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>F</span>
              </div>
              <h3 className="font-display text-lg font-bold tracking-tight group-hover:text-primary transition-colors">FORGE</h3>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">AI fitness coach, workout logger, nutrition tracker</p>
            </Link>

            {/* Coming soon placeholder */}
            <div className="card-inset rounded-xl p-5 opacity-50">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <span className="text-muted-foreground text-lg">+</span>
              </div>
              <h3 className="font-display text-lg font-bold tracking-tight text-muted-foreground">Coming Soon</h3>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">More apps on the way</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/" element={<ProtectedRoute><Landing /></ProtectedRoute>} />
        <Route path="/forge/*" element={<ProtectedRoute><ForgeApp /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
