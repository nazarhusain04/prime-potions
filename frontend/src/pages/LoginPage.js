import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import logo from '../assets/logo.png';
import logoWhite from '../assets/logo-white.png';

export const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Minimalist Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0F5132] to-[#0B3D25]">
        <div className="absolute inset-0 noise-overlay" />
        <div
          className="absolute rounded-full border border-white/10"
          style={{ width: 560, height: 560, top: -180, right: -220 }}
        />
        <div
          className="absolute rounded-full bg-white/5"
          style={{ width: 240, height: 240, bottom: -80, left: -60 }}
        />

        {/* Minimalist potion-bottle illustration */}
        <svg
          className="absolute pointer-events-none"
          style={{ width: 440, height: 440, bottom: -30, right: -50 }}
          viewBox="0 0 400 400"
          fill="none"
        >
          {/* Traceability network connecting the bottles (drawn first, sits behind) */}
          <g stroke="white" strokeOpacity="0.16" strokeWidth="1.5">
            <line x1="100" y1="180" x2="215" y2="150" />
            <line x1="215" y1="150" x2="300" y2="230" />
          </g>
          <circle cx="100" cy="180" r="4" fill="white" fillOpacity="0.4" />
          <circle cx="215" cy="150" r="4" fill="white" fillOpacity="0.4" />
          <circle cx="300" cy="230" r="4" fill="white" fillOpacity="0.4" />

          {/* Bottle 1 - tall, back left */}
          <rect x="80" y="180" width="60" height="130" rx="16" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
          <rect x="98" y="150" width="24" height="34" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
          <rect x="93" y="136" width="34" height="16" rx="4" fill="white" fillOpacity="0.14" />
          <rect x="82" y="245" width="56" height="63" rx="14" fill="white" fillOpacity="0.05" />

          {/* Bottle 2 - center, tallest, accent liquid */}
          <rect x="188" y="150" width="66" height="160" rx="18" stroke="white" strokeOpacity="0.22" strokeWidth="2" />
          <rect x="207" y="112" width="28" height="40" stroke="white" strokeOpacity="0.22" strokeWidth="2" />
          <rect x="201" y="96" width="40" height="18" rx="4" fill="white" fillOpacity="0.18" />
          <rect x="190" y="228" width="62" height="80" rx="16" fill="#F59E0B" fillOpacity="0.12" />
          <rect x="199" y="176" width="12" height="12" rx="2" fill="white" fillOpacity="0.15" />

          {/* Bottle 3 - small, front right */}
          <rect x="278" y="222" width="48" height="88" rx="14" stroke="white" strokeOpacity="0.16" strokeWidth="2" />
          <rect x="292" y="198" width="20" height="26" stroke="white" strokeOpacity="0.16" strokeWidth="2" />
          <rect x="287" y="186" width="30" height="14" rx="4" fill="white" fillOpacity="0.13" />
          <rect x="280" y="264" width="44" height="44" rx="12" fill="white" fillOpacity="0.05" />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-12">
          <img src={logoWhite} alt="Prime Potions" className="h-16 w-auto object-contain" />
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={logo} alt="Prime Potions" className="h-10 w-auto object-contain" />
          </div>

          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Enter your credentials to access the ERP system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@primepotions.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-focus"
                    data-testid="login-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => toast.info('Contact your system administrator to reset your password.')}
                      className="text-xs text-slate-500 hover:text-[#0F5132] hover:underline"
                      data-testid="forgot-password-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-focus"
                    data-testid="login-password-input"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full btn-primary"
                  disabled={loading}
                  data-testid="login-submit-btn"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign in
                </Button>
              </form>
              <p className="text-center text-xs text-slate-400 mt-4">
                No account? Contact your administrator to get access.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
