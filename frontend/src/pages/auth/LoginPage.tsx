/**
 * LoginPage — handles both login and registration in a single premium UI.
 * Calls POST /api/v1/auth/login and POST /api/v1/auth/register.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowRight, Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { apiClient } from '../../api/client';
import { LocationAutocomplete } from '../../components/common/LocationAutocomplete';
import { ThemeToggle } from '../../components/common/ThemeToggle';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const capacitySchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => (val === '' || val === undefined ? undefined : Number(val)))
  .refine((val) => val === undefined || (!isNaN(val) && val >= 1), {
    message: 'Must be a positive number',
  });

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['DONOR', 'NGO', 'DRIVER']),
  organisation_name: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  storage_capacity_kg: capacitySchema,
  vehicle_capacity_kg: capacitySchema,
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

// ─── Role → dashboard route ───────────────────────────────────────────────────

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  DONOR: '/donor',
  NGO: '/ngo',
  DRIVER: '/driver',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  // Login form
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  // Register form
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: { role: 'DONOR' },
  });

  const watchedRole = registerForm.watch('role');

  // ── Login submit ─────────────────────────────────────────────────────────────
  const handleLogin = loginForm.handleSubmit(async (data) => {
    setError(null);
    try {
      const res = await apiClient.post('/api/v1/auth/login', data);
      const { access_token, refresh_token, user } = res.data.data;
      setAuth(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        access_token,
        refresh_token,
      );
      navigate(ROLE_ROUTES[user.role] || '/');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail?.error?.message || err.response?.data?.error?.message || 'Login failed. Check your credentials.';
      setError(errorMsg);
    }
  });

  // ── Register submit ──────────────────────────────────────────────────────────
  const handleRegister = registerForm.handleSubmit(async (data) => {
    setError(null);
    try {
      await apiClient.post('/api/v1/auth/register', data);
      // Auto-login after registration
      const loginRes = await apiClient.post('/api/v1/auth/login', {
        email: data.email,
        password: data.password,
      });
      const { access_token, refresh_token, user } = loginRes.data.data;
      setAuth(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        access_token,
        refresh_token,
      );
      navigate(ROLE_ROUTES[user.role] || '/');
    } catch (err: any) {
      let msg = 'Registration failed. Please try again.';
      if (err.response?.data?.error?.message) {
        msg = err.response.data.error.message;
      } else if (Array.isArray(err.response?.data?.detail) && err.response.data.detail.length > 0) {
        msg = err.response.data.detail[0].msg;
      }
      setError(msg);
    }
  });

  const isLoginPending = loginForm.formState.isSubmitting;
  const isRegisterPending = registerForm.formState.isSubmitting;

  return (
    <div className="min-h-screen flex bg-surface text-on-surface">
      {/* Left branding panel - Deep Forest Green */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative bg-primary overflow-hidden">
        {/* Subtle background pattern/gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container opacity-50" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-container rounded-full blur-[100px] translate-x-1/2 -translate-y-1/4 opacity-30" />
        
        <div className="relative z-10 flex flex-col h-full px-16 py-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 w-fit hover:opacity-90 transition-opacity text-on-primary">
            <Leaf size={28} className="text-white" />
            <div className="flex flex-col">
              <span className="font-display text-[1.125rem] font-bold tracking-tight leading-none text-white">RePlate</span>
              <span className="font-ui text-[0.625rem] font-bold uppercase tracking-wider text-primary-fixed-dim leading-tight">Civic Logistics</span>
            </div>
          </Link>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="font-display text-[3.5rem] font-bold leading-tight mb-6 text-white tracking-tight">
              Civic Food <br />
              Logistics Terminal.
            </h1>
            <p className="font-ui text-[1.125rem] leading-relaxed mb-12 text-on-primary-container max-w-md">
              Secure access for authorized municipal hubs, commercial kitchens, and certified couriers. Coordinate surplus routing with zero guesswork.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Right auth panel - Warm Parchment */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16 bg-surface">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-3 mb-10 lg:hidden text-primary">
            <Leaf size={28} className="text-[var(--moss)]" />
            <div className="flex flex-col">
              <span className="font-display text-[1.125rem] font-bold tracking-tight leading-none">RePlate</span>
              <span className="font-ui text-[0.625rem] font-bold uppercase tracking-wider text-text-muted leading-tight">Civic Logistics</span>
            </div>
          </Link>

          <h2 className="font-display text-2xl font-bold text-on-surface mb-2 tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Register a Node'}
          </h2>
          <p className="text-sm text-on-surface-variant mb-8">
            {mode === 'login' ? 'Enter your credentials to access the terminal.' : 'Join the decentralized food logistics network.'}
          </p>

          {/* Tab switcher */}
          <div className="flex p-1 bg-surface-container-high border border-outline-variant rounded-lg mb-8">
            {(['login', 'register'] as const).map((m) => {
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-2.5 rounded-md text-[0.875rem] font-semibold tracking-wide transition-all duration-200 ${
                    isActive 
                      ? 'bg-surface text-primary shadow-sm' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium bg-error-container/30 border border-error/20 text-error flex items-start gap-2">
              <div className="mt-0.5">⚠</div>
              <div>{error}</div>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="form-label">System Email</label>
                <input {...loginForm.register('email')} type="email" className="input-base"
                  placeholder="operator@replate.local" autoComplete="email" />
                {loginForm.formState.errors.email && (
                  <p className="form-error">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="form-label">Passcode</label>
                <div className="relative">
                  <input {...loginForm.register('password')} type={showPassword ? 'text' : 'password'}
                    className="input-base pr-12 font-mono" placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="form-error">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button type="submit" className="btn-primary w-full py-3 mt-2 text-[0.9375rem] shadow-sm" disabled={isLoginPending}>
                {isLoginPending ? <Loader2 size={18} className="animate-spin" /> : <>Authorize Access <ArrowRight size={16} /></>}
              </button>

              <div className="mt-8 border border-outline-variant bg-surface-container-low p-4 rounded-lg relative overflow-hidden group hover:border-primary/30 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <p className="text-[0.6875rem] text-on-surface-variant font-bold mb-1 tracking-wider uppercase">Diagnostics Access</p>
                <button type="button" onClick={() => {
                  loginForm.setValue('email', 'admin@cpi.com');
                  loginForm.setValue('password', 'password123');
                }} className="text-[0.875rem] font-mono font-medium text-primary hover:text-primary-container-highest underline decoration-primary/30 underline-offset-2">admin@cpi.com</button>
              </div>

            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Operator Name</label>
                  <input {...registerForm.register('name')} className="input-base" placeholder="Jane Doe" />
                  {registerForm.formState.errors.name && (
                    <p className="form-error">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input {...registerForm.register('email')} type="email" className="input-base" placeholder="node@example.com" />
                  {registerForm.formState.errors.email && (
                    <p className="form-error">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input {...registerForm.register('phone')} className="input-base font-mono-data" placeholder="9876543210" />
                  {registerForm.formState.errors.phone && (
                    <p className="form-error">{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Secure Passcode</label>
                <div className="relative">
                  <input {...registerForm.register('password')} type={showPassword ? 'text' : 'password'}
                    className="input-base pr-12 font-mono" placeholder="Min. 8 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="form-error">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="pt-2 relative z-10">
                <label className="form-label">Node Designation</label>
                <select {...registerForm.register('role')} className="select-base bg-surface-container-lowest">
                  <option value="DONOR">Supplier (Commercial Kitchen)</option>
                  <option value="NGO">Distributor (Community Pantry)</option>
                  <option value="DRIVER">Logistics (Certified Fleet)</option>
                </select>
              </div>

              {/* Dynamic Fields Section */}
              <div className="pt-2 space-y-4">
                {/* DONOR fields */}
                {watchedRole === 'DONOR' && (
                  <div className="p-4 rounded-lg bg-surface-container border border-outline-variant space-y-4 relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <div>
                      <label className="form-label">Facility Name</label>
                      <input {...registerForm.register('organisation_name')} className="input-base bg-surface-container-lowest" placeholder="e.g. Green Kitchen Restaurant" />
                    </div>
                    <div>
                      <label className="form-label">Pickup Coordinates / Address</label>
                      <LocationAutocomplete
                        value={registerForm.watch('address') || ''}
                        onChange={(val) => registerForm.setValue('address', val)}
                        onSelect={(addr, lat, lng) => {
                          registerForm.setValue('address', addr);
                          registerForm.setValue('latitude', lat);
                          registerForm.setValue('longitude', lng);
                        }}
                        placeholder="Full pickup address"
                      />
                    </div>
                  </div>
                )}

                {/* NGO fields */}
                {watchedRole === 'NGO' && (
                  <div className="p-4 rounded-lg bg-surface-container border border-outline-variant space-y-4 relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
                    <div>
                      <label className="form-label">Organization Name</label>
                      <input {...registerForm.register('organisation_name')} className="input-base bg-surface-container-lowest" placeholder="e.g. City Food Bank" />
                    </div>
                    <div>
                      <label className="form-label">Delivery Location</label>
                      <LocationAutocomplete
                        value={registerForm.watch('address') || ''}
                        onChange={(val) => registerForm.setValue('address', val)}
                        onSelect={(addr, lat, lng) => {
                          registerForm.setValue('address', addr);
                          registerForm.setValue('latitude', lat);
                          registerForm.setValue('longitude', lng);
                        }}
                        placeholder="Full address"
                      />
                    </div>
                    <div>
                      <label className="form-label">Total Storage Capacity (kg)</label>
                      <input {...registerForm.register('storage_capacity_kg')}
                        type="number" min="1" className="input-base font-mono-data bg-surface-container-lowest" placeholder="e.g. 500" />
                      {registerForm.formState.errors.storage_capacity_kg && (
                        <p className="form-error">{registerForm.formState.errors.storage_capacity_kg.message}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* DRIVER fields */}
                {watchedRole === 'DRIVER' && (
                  <div className="p-4 rounded-lg bg-surface-container border border-outline-variant space-y-4 relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <div>
                      <label className="form-label">Transit Capacity (kg)</label>
                      <input {...registerForm.register('vehicle_capacity_kg')}
                        type="number" min="1" className="input-base font-mono-data bg-surface-container-lowest" placeholder="e.g. 100" />
                      {registerForm.formState.errors.vehicle_capacity_kg && (
                        <p className="form-error">{registerForm.formState.errors.vehicle_capacity_kg.message}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary w-full py-3 mt-4 text-[0.9375rem] shadow-sm" disabled={isRegisterPending}>
                {isRegisterPending ? <Loader2 size={18} className="animate-spin" /> : <>Register Node <ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

