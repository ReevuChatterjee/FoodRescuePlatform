import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col bg-base text-on-surface">
      
      {/* ── Top Header ── */}
      <header className="w-full flex items-center justify-between p-6 md:p-8">
        <Link to="/" className="flex items-center gap-3 shrink-0 text-primary hover:opacity-80 transition-opacity">
          <Leaf size={24} />
          <div className="flex flex-col">
            <span className="font-semibold text-[1.125rem] text-on-surface tracking-tight leading-none">
              RePlate
            </span>
            <span className="text-[0.625rem] font-bold uppercase tracking-widest text-on-surface-variant leading-tight mt-0.5">
              Civic Food Logistics
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex justify-center pb-20 px-4 md:px-8 pt-8 md:pt-16">
        <div className="w-full flex flex-col items-center">
          
          {/* Error Message */}
          {error && (
            <div className="w-full max-w-[480px] mb-6 px-4 py-3 rounded text-[0.875rem] font-medium bg-error/10 border border-error/20 text-error flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <div className="w-full max-w-[420px]">
              <div className="mb-10">
                <h2 className="text-[1.75rem] font-semibold text-on-surface tracking-tight mb-2">Welcome back</h2>
                <p className="text-[0.9375rem] text-on-surface-variant leading-relaxed">Access your logistics workspace.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">System email</label>
                  <input {...loginForm.register('email')} type="email" className="w-full h-10 px-3 rounded text-[0.875rem] bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="operator@replate.local" autoComplete="email" />
                  {loginForm.formState.errors.email && (
                    <p className="text-[0.75rem] text-error mt-1.5">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Passcode</label>
                  <div className="relative">
                    <input {...loginForm.register('password')} type={showPassword ? 'text' : 'password'} className="w-full h-10 px-3 pr-10 rounded text-[0.875rem] font-mono bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="••••••••" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-[0.75rem] text-error mt-1.5">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <button type="submit" className="w-full h-11 mt-2 rounded bg-primary text-on-primary text-[0.9375rem] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center" disabled={isLoginPending}>
                  {isLoginPending ? <Loader2 size={16} className="animate-spin" /> : <>Sign in</>}
                </button>
              </form>
              
              <div className="mt-10 pt-6 border-t border-outline-variant/30 text-center">
                <span className="text-[0.875rem] text-on-surface-variant">New to RePlate? </span>
                <button onClick={() => { setMode('register'); setError(null); }} className="text-[0.875rem] font-medium text-primary hover:underline">
                  Register a node →
                </button>
              </div>
            </div>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <div className="w-full max-w-[500px]">
              <div className="mb-10">
                <h2 className="text-[1.75rem] font-semibold text-on-surface tracking-tight mb-2">Register a node</h2>
                <p className="text-[0.9375rem] text-on-surface-variant leading-relaxed">Create an account for a new logistics participant.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-10">
                
                {/* Account Information */}
                <div>
                  <h3 className="text-[0.75rem] font-bold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/50">Account information</h3>
                  <div className="space-y-5">
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Operator name</label>
                      <input {...registerForm.register('name')} className="w-full h-10 px-3 rounded text-[0.875rem] bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="Jane Doe" />
                      {registerForm.formState.errors.name && (
                        <p className="text-[0.75rem] text-error mt-1.5">{registerForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Email</label>
                        <input {...registerForm.register('email')} type="email" className="w-full h-10 px-3 rounded text-[0.875rem] bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="node@example.com" />
                        {registerForm.formState.errors.email && (
                          <p className="text-[0.75rem] text-error mt-1.5">{registerForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Phone</label>
                        <input {...registerForm.register('phone')} className="w-full h-10 px-3 rounded text-[0.875rem] font-mono-data bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="9876543210" />
                        {registerForm.formState.errors.phone && (
                          <p className="text-[0.75rem] text-error mt-1.5">{registerForm.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Secure passcode</label>
                      <div className="relative">
                        <input {...registerForm.register('password')} type={showPassword ? 'text' : 'password'} className="w-full h-10 px-3 pr-10 rounded text-[0.875rem] font-mono bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="Min. 8 characters" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-[0.75rem] text-error mt-1.5">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Node Information */}
                <div>
                  <h3 className="text-[0.75rem] font-bold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/50">Node information</h3>
                  <div className="space-y-5">
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Node designation</label>
                      <select {...registerForm.register('role')} className="w-full h-10 px-3 rounded text-[0.875rem] bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                        <option value="DONOR">Commercial Kitchen (Donor)</option>
                        <option value="NGO">Food Program (Recipient)</option>
                        <option value="DRIVER">Transport Fleet (Driver)</option>
                      </select>
                    </div>

                    {/* Dynamic Fields */}
                    {watchedRole === 'DONOR' && (
                      <div className="space-y-5 pt-2">
                        <div>
                          <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Facility name</label>
                          <input {...registerForm.register('organisation_name')} className="w-full h-10 px-3 rounded text-[0.875rem] bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="e.g. Green Kitchen Restaurant" />
                        </div>
                        <div>
                          <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Pickup address</label>
                          <div className="bg-surface-container border border-outline-variant rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
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
                      </div>
                    )}

                    {watchedRole === 'NGO' && (
                      <div className="space-y-5 pt-2">
                        <div>
                          <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Facility name</label>
                          <input {...registerForm.register('organisation_name')} className="w-full h-10 px-3 rounded text-[0.875rem] bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="e.g. City Food Bank" />
                        </div>
                        <div>
                          <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Delivery address</label>
                          <div className="bg-surface-container border border-outline-variant rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                            <LocationAutocomplete
                              value={registerForm.watch('address') || ''}
                              onChange={(val) => registerForm.setValue('address', val)}
                              onSelect={(addr, lat, lng) => {
                                registerForm.setValue('address', addr);
                                registerForm.setValue('latitude', lat);
                                registerForm.setValue('longitude', lng);
                              }}
                              placeholder="Full delivery address"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Total storage capacity (kg)</label>
                          <input {...registerForm.register('storage_capacity_kg')} type="number" min="1" className="w-full h-10 px-3 rounded text-[0.875rem] font-mono-data bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="e.g. 500" />
                          {registerForm.formState.errors.storage_capacity_kg && (
                            <p className="text-[0.75rem] text-error mt-1.5">{registerForm.formState.errors.storage_capacity_kg.message}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {watchedRole === 'DRIVER' && (
                      <div className="space-y-5 pt-2">
                        <div>
                          <label className="text-[0.8125rem] font-semibold text-on-surface mb-2 block">Transit capacity (kg)</label>
                          <input {...registerForm.register('vehicle_capacity_kg')} type="number" min="1" className="w-full h-10 px-3 rounded text-[0.875rem] font-mono-data bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="e.g. 100" />
                          {registerForm.formState.errors.vehicle_capacity_kg && (
                            <p className="text-[0.75rem] text-error mt-1.5">{registerForm.formState.errors.vehicle_capacity_kg.message}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full h-11 mt-4 rounded bg-primary text-on-primary text-[0.9375rem] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center" disabled={isRegisterPending}>
                  {isRegisterPending ? <Loader2 size={16} className="animate-spin" /> : <>Register node</>}
                </button>
              </form>

              <div className="mt-10 pt-6 border-t border-outline-variant/30 text-center">
                <span className="text-[0.875rem] text-on-surface-variant">Already registered? </span>
                <button onClick={() => { setMode('login'); setError(null); }} className="text-[0.875rem] font-medium text-primary hover:underline">
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
