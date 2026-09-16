/**
 * LoginPage — handles both login and registration in a single premium UI.
 * Calls POST /api/v1/auth/login and POST /api/v1/auth/register.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Leaf, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../hooks/useAuthStore';

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
    resolver: zodResolver(registerSchema),
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
    <div className="min-h-screen flex bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]">
        <div className="relative z-10 flex flex-col h-full px-16 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--brand)] rounded-sm flex items-center justify-center">
              <Leaf size={20} className="text-black" />
            </div>
            <span className="text-[var(--text-primary)] font-semibold tracking-tight text-lg">RePlate Ops</span>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="heading-major leading-tight mb-6 text-[var(--text-primary)]">
              Operations <br />
              Logistics Terminal.
            </h1>
            <p className="text-lg leading-relaxed mb-12 text-[var(--text-secondary)]">
              Authorized access only. Enter your credentials to manage incoming surplus, route drivers, and trace completed handoffs.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-[var(--text-muted)] font-mono-data">
            SYSTEM BUILD 2026.4
          </p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16 bg-[var(--bg-page)]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-[var(--brand)] rounded-sm flex items-center justify-center">
              <Leaf size={18} className="text-black" />
            </div>
            <span className="font-semibold tracking-tight text-[var(--text-primary)]">RePlate Ops</span>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-sm mb-8">
            {(['login', 'register'] as const).map((m) => {
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-2 rounded-sm text-sm font-semibold tracking-wide transition-colors ${
                    isActive ? 'bg-[var(--bg-panel-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-page)]'
                  }`}
                >
                  {m === 'login' ? 'Authentication' : 'Registration'}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-md text-sm font-medium bg-[var(--error)]/10 border border-[var(--error)]/20 text-[var(--error)]">
              {error}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="form-error">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={isLoginPending}>
                {isLoginPending ? <Loader2 size={18} className="animate-spin" /> : <>Authorize Access <ArrowRight size={16} /></>}
              </button>

              <div className="mt-6 border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 rounded-md">
                <p className="text-xs text-[var(--text-secondary)] font-medium mb-1 tracking-wide uppercase">Diagnostics Access</p>
                <button type="button" onClick={() => {
                  loginForm.setValue('email', 'admin@cpi.com');
                  loginForm.setValue('password', 'admin123');
                }} className="text-sm font-mono-data text-[var(--text-primary)] hover:text-[var(--brand)]">admin@cpi.com</button>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="form-error">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="form-label">Node Designation</label>
                <select {...registerForm.register('role')} className="select-base">
                  <option value="DONOR">Supplier (Donor)</option>
                  <option value="NGO">Distributor (NGO)</option>
                  <option value="DRIVER">Logistics (Driver)</option>
                </select>
              </div>

              {/* DONOR fields */}
              {watchedRole === 'DONOR' && (
                <>
                  <div>
                    <label className="form-label">Facility Name</label>
                    <input {...registerForm.register('organisation_name')} className="input-base" placeholder="e.g. Green Kitchen Restaurant" />
                  </div>
                  <div>
                    <label className="form-label">Pickup Coordinates / Address</label>
                    <input {...registerForm.register('address')} className="input-base" placeholder="Full pickup address" />
                  </div>
                </>
              )}

              {/* NGO fields */}
              {watchedRole === 'NGO' && (
                <>
                  <div>
                    <label className="form-label">Organization Name</label>
                    <input {...registerForm.register('organisation_name')} className="input-base" placeholder="e.g. City Food Bank" />
                  </div>
                  <div>
                    <label className="form-label">Delivery Location</label>
                    <input {...registerForm.register('address')} className="input-base" placeholder="Full address" />
                  </div>
                  <div>
                    <label className="form-label">Total Storage Capacity (kg)</label>
                    <input {...registerForm.register('storage_capacity_kg')}
                      type="number" min="1" className="input-base font-mono-data" placeholder="e.g. 500" />
                    {registerForm.formState.errors.storage_capacity_kg && (
                      <p className="form-error">{registerForm.formState.errors.storage_capacity_kg.message}</p>
                    )}
                  </div>
                </>
              )}

              {/* DRIVER fields */}
              {watchedRole === 'DRIVER' && (
                <div>
                  <label className="form-label">Transit Capacity (kg)</label>
                  <input {...registerForm.register('vehicle_capacity_kg')}
                    type="number" min="1" className="input-base font-mono-data" placeholder="e.g. 100" />
                  {registerForm.formState.errors.vehicle_capacity_kg && (
                    <p className="form-error">{registerForm.formState.errors.vehicle_capacity_kg.message}</p>
                  )}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3" disabled={isRegisterPending}>
                {isRegisterPending ? <Loader2 size={18} className="animate-spin" /> : <>Register Node <ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

