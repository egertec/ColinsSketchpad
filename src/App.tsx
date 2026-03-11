import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import AuthPage from '@/components/AuthPage';
import ForgeApp from '@/components/ForgeApp';

interface ProfileInfo {
  is_approved: boolean;
  is_admin: boolean;
}

interface PendingUser {
  user_id: string;
  email: string;
  created_at: string;
}

function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_approved, is_admin')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (error || !data) {
      // Profile might not exist yet (trigger hasn't fired), wait and retry once
      await new Promise(r => setTimeout(r, 1000));
      const retry = await supabase
        .from('user_profiles')
        .select('is_approved, is_admin')
        .eq('user_id', user!.id)
        .maybeSingle();
      setProfile(retry.data || { is_approved: false, is_admin: false });
    } else {
      setProfile(data);
    }
    setLoading(false);
  }

  return { profile, loading, reload: loadProfile };
}

function AdminPanel() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, email, created_at')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    setPending(data || []);
    setLoading(false);
  }

  async function approve(userId: string) {
    await supabase.from('user_profiles').update({ is_approved: true }).eq('user_id', userId);
    setPending(prev => prev.filter(p => p.user_id !== userId));
  }

  async function deny(userId: string) {
    await supabase.from('user_profiles').delete().eq('user_id', userId);
    // Also delete the auth user via admin — this requires service role, so just remove profile for now
    setPending(prev => prev.filter(p => p.user_id !== userId));
  }

  if (loading) return null;

  return (
    <div className="mt-8">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-4">
        Access Requests {pending.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px]">{pending.length}</span>}
      </p>
      {pending.length === 0 ? (
        <div className="card-inset rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">No pending requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(u => (
            <div key={u.user_id} className="card-elevated rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{u.email || 'Unknown'}</p>
                <p className="text-[10px] text-muted-foreground mono">
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(u.user_id)}
                  className="accent-gradient text-white text-[11px] h-7 px-3 rounded-lg border-0">
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => deny(u.user_id)}
                  className="text-[11px] h-7 px-3 rounded-lg text-muted-foreground">
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingApproval() {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>CS</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Colin's Sketchpad</h1>
        </div>
        <div className="card-elevated rounded-xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
            <span className="text-amber-500 text-lg">⏳</span>
          </div>
          <h2 className="font-display text-xl font-bold">Pending Approval</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account ({user?.email}) is awaiting approval. You'll get access once an admin reviews your request.
          </p>
        </div>
        <button onClick={signOut} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium">
          Sign Out
        </button>
      </div>
    </div>
  );
}

function Landing() {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();

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

        {/* Admin Panel — only visible to admins */}
        {profile?.is_admin && <AdminPanel />}
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.is_approved) return <PendingApproval />;
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
