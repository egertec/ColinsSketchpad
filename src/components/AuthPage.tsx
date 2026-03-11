import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);
    if (error) setError(error);
    else if (mode === 'signup') setSignupSuccess(true);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>CS</span>
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'hsl(30,10%,12%)' }}>Colin's Sketchpad</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        {signupSuccess ? (
          <div className="card-elevated rounded-xl p-6 text-center space-y-3">
            <p className="text-primary font-semibold">Check your email</p>
            <p className="text-sm text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
            <Button onClick={() => { setMode('signin'); setSignupSuccess(false); }} variant="outline" className="mt-4">
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 bg-card border-border rounded-xl text-sm"
                required
              />
              <Input
                type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-11 bg-card border-border rounded-xl text-sm"
                required minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading}
              className="w-full accent-gradient text-white font-semibold h-11 rounded-xl border-0">
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="text-primary font-semibold hover:underline">
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
