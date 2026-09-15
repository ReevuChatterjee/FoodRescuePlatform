/**
 * LoginPage — email/password authentication for all user roles.
 *
 * On success: stores tokens + user via useAuthStore.setAuth,
 * then redirects to the role-specific dashboard per App.tsx routing.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../hooks/useAuthStore';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  DONOR: '/donor',
  NGO: '/ngo',
  DRIVER: '/driver',
};

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await apiClient.post('/api/v1/auth/login', data);
      const { access_token, refresh_token, user } = response.data.data;

      setAuth(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        access_token,
        refresh_token,
      );

      navigate(ROLE_ROUTES[user.role] ?? '/', { replace: true });
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message ?? 'Invalid email or password.';
      setError('root', { message });
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-50">
      {/* Left Pane - Branding & Graphic */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern-dark opacity-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-emerald-400 mb-8">
            <div className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <span className="font-bold text-sm">CPI</span>
            </div>
            <span className="font-semibold tracking-widest uppercase text-sm">Logistics Core</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-tight mt-12 mb-6">
            Algorithmic <br /> Micro-Donation <br /> Routing.
          </h1>
          <p className="text-emerald-100 max-w-md text-lg leading-relaxed">
            Optimizing the distribution of surplus food through real-time telemetry, automated driver dispatch, and dynamic NGO matching.
          </p>
        </div>
        
        <div className="relative z-10 font-mono text-xs text-emerald-400/60 uppercase tracking-widest">
          System v2.4.0 • Authorized Personnel Only
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-zinc-50/50 backdrop-blur-sm bg-grid-pattern">
        <div className="w-full max-w-md bg-white p-8 rounded-xl border border-zinc-200 shadow-xl shadow-zinc-200/50 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Access Portal</h2>
            <p className="text-sm text-zinc-500 mt-2">Enter your credentials to access the command center.</p>
          </div>

          {errors.root && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-md border border-red-100 flex items-start gap-3">
              <span className="font-semibold text-red-800">Error:</span> {errors.root.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
                Work Email
              </label>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                placeholder="admin@cpi.com"
                className="block w-full rounded-md border border-zinc-300 px-4 py-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-shadow bg-zinc-50 focus:bg-white placeholder:text-zinc-400"
              />
              {errors.email && (
                <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                placeholder="••••••••"
                className="block w-full rounded-md border border-zinc-300 px-4 py-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-shadow bg-zinc-50 focus:bg-white placeholder:text-zinc-400"
              />
              {errors.password && (
                <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-all shadow-md shadow-emerald-900/10 active:scale-[0.98]"
            >
              {isSubmitting ? 'Authenticating System…' : 'Initialize Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
