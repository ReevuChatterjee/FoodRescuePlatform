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
        { id: user.user_id, name: user.name, email: user.email, role: user.role },
        access_token,
        refresh_token,
      );
      navigate(ROLE_ROUTES[user.role] || '/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed. Check your credentials.');
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
        { id: user.user_id, name: user.name, email: user.email, role: user.role },
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
    <div className="min-h-screen flex bg-black text-zinc-300">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative bg-zinc-950 border-r border-zinc-900">
        <div className="relative z-10 flex flex-col h-full px-16 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-sm flex items-center justify-center">
              <Leaf size={20} className="text-emerald-50" />
            </div>
            <span className="text-zinc-100 font-bold tracking-tight text-lg">RePlate</span>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6 text-zinc-100">
              Rescue food.<br />
              <span className="text-emerald-500">Feed communities.</span>
            </h1>
            <p className="text-lg leading-relaxed mb-12 text-zinc-400">
              The algorithmic micro-donation platform that connects surplus food
              with the NGOs that need it most — in real time.
            </p>


          </div>

          {/* Footer */}
          <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium">
            RePlate © 2026
          </p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16 bg-black">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-emerald-600 rounded-sm flex items-center justify-center">
              <Leaf size={18} className="text-emerald-50" />
            </div>
            <span className="font-bold tracking-tight text-zinc-100">RePlate</span>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-sm mb-8">
            {(['login', 'register'] as const).map((m) => {
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-2 rounded-sm text-sm font-semibold uppercase tracking-wide transition-colors ${
                    isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-sm text-sm font-medium bg-red-950/50 border border-red-900 text-red-500">
              {error}
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="form-label">Email address</label>
                <input {...loginForm.register('email')} type="email" className="input-base"
                  placeholder="you@example.com" autoComplete="email" />
                {loginForm.formState.errors.email && (
                  <p className="form-error">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input {...loginForm.register('password')} type={showPassword ? 'text' : 'password'}
                    className="input-base pr-12" placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="form-error">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={isLoginPending}>
                {isLoginPending ? <Loader2 size={18} className="animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
              </button>

              <p className="text-center text-sm text-zinc-500 mt-6">
                Demo admin:{' '}
                <button type="button" onClick={() => {
                  loginForm.setValue('email', 'admin@cpi.com');
                  loginForm.setValue('password', 'admin123');
                }} className="text-emerald-500 hover:text-emerald-400 font-medium">admin@cpi.com / admin123</button>
              </p>

            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Full name</label>
                  <input {...registerForm.register('name')} className="input-base" placeholder="Jane Doe" />
                  {registerForm.formState.errors.name && (
                    <p className="form-error">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input {...registerForm.register('email')} type="email" className="input-base" placeholder="you@example.com" />
                  {registerForm.formState.errors.email && (
                    <p className="form-error">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input {...registerForm.register('phone')} className="input-base tabular-nums" placeholder="9876543210" />
                  {registerForm.formState.errors.phone && (
                    <p className="form-error">{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input {...registerForm.register('password')} type={showPassword ? 'text' : 'password'}
                    className="input-base pr-12" placeholder="Min. 8 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="form-error">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="form-label">I am a</label>
                <select {...registerForm.register('role')} className="select-base">
                  <option value="DONOR">Food Donor (restaurant, caterer, hotel)</option>
                  <option value="NGO">NGO (food bank, charity)</option>
                  <option value="DRIVER">Volunteer Driver</option>
                </select>
              </div>

              {/* DONOR fields */}
              {watchedRole === 'DONOR' && (
                <>
                  <div>
                    <label className="form-label">Organisation name</label>
                    <input {...registerForm.register('organisation_name')} className="input-base" placeholder="e.g. Green Kitchen Restaurant" />
                  </div>
                  <div>
                    <label className="form-label">Address</label>
                    <input {...registerForm.register('address')} className="input-base" placeholder="Full pickup address" />
                  </div>
                </>
              )}

              {/* NGO fields */}
              {watchedRole === 'NGO' && (
                <>
                  <div>
                    <label className="form-label">Organisation name</label>
                    <input {...registerForm.register('organisation_name')} className="input-base" placeholder="e.g. City Food Bank" />
                  </div>
                  <div>
                    <label className="form-label">Address</label>
                    <input {...registerForm.register('address')} className="input-base" placeholder="Full address" />
                  </div>
                  <div>
                    <label className="form-label">Storage capacity (kg)</label>
                    <input {...registerForm.register('storage_capacity_kg')}
                      type="number" min="1" className="input-base tabular-nums" placeholder="e.g. 500" />
                    {registerForm.formState.errors.storage_capacity_kg && (
                      <p className="form-error">{registerForm.formState.errors.storage_capacity_kg.message}</p>
                    )}
                  </div>
                </>
              )}

              {/* DRIVER fields */}
              {watchedRole === 'DRIVER' && (
                <div>
                  <label className="form-label">Vehicle capacity (kg)</label>
                  <input {...registerForm.register('vehicle_capacity_kg')}
                    type="number" min="1" className="input-base tabular-nums" placeholder="e.g. 100" />
                  {registerForm.formState.errors.vehicle_capacity_kg && (
                    <p className="form-error">{registerForm.formState.errors.vehicle_capacity_kg.message}</p>
                  )}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3" disabled={isRegisterPending}>
                {isRegisterPending ? <Loader2 size={18} className="animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
