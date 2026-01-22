import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { seedApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import { FlaskConical, Loader2 } from 'lucide-react';

export const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await seedApi.seed();
      toast.success('Demo data seeded! Use admin@primepotions.com / admin123');
      console.log('Seed result:', response.data);
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        toast.info('Demo data already exists');
      } else {
        toast.error('Failed to seed data');
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ 
          backgroundImage: `url('https://images.unsplash.com/photo-1580281845022-233f93de0671?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBwaGFybWFjZXV0aWNhbCUyMG1hbnVmYWN0dXJpbmclMjBsYWJvcmF0b3J5fGVufDB8fHx8MTc2OTA2Mjk0Nnww&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F5132]/90 to-[#0F5132]/70" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{company.company_name}</h1>
              <p className="text-white/80">Manufacturing ERP</p>
            </div>
          </div>
          <h2 className="text-4xl font-light mb-4 leading-tight">
            Precision Inventory.<br />
            Full Traceability.<br />
            Live Updates.
          </h2>
          <p className="text-white/70 text-lg">
            Track raw materials through batching to finished goods with complete lot-level traceability.
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: company.primary_color }}
            >
              <FlaskConical className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{company.company_name}</h1>
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
                  <Label htmlFor="password">Password</Label>
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

              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-500 text-center mb-4">
                  First time? Seed demo data to get started
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSeedData}
                  disabled={seeding}
                  data-testid="seed-data-btn"
                >
                  {seeding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Seed Demo Data
                </Button>
                <p className="text-xs text-slate-400 text-center mt-2">
                  Creates admin user: admin@primepotions.com / admin123
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
