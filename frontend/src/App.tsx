/**
 * Main App component with routing.
 *
 * Routes:
 *   - / → landing (or redirect to role-specific dashboard if authenticated)
 *   - /login → auth flow (Person 1)
 *   - /admin/* → admin routes (Person 6), protected by ADMIN role
 *   - /donor/* → donor routes (Person 2)
 *   - /ngo/* → NGO routes (Person 3)
 *   - /driver/* → driver routes (Person 5)
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppShell } from './components/common/AppShell';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { NGOVerificationQueue } from './pages/admin/NGOVerificationQueue';
import { useAuthStore } from './hooks/useAuthStore';
import { DonorDashboard } from './pages/donor/DonorDashboard';
import { CreateDonation } from './pages/donor/CreateDonation';
import { DonationDetails } from './pages/donor/DonationDetails';
import { LoginPage } from './pages/auth/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AuthenticatedLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Routes wrapped in AppShell */}
          <Route element={<AuthenticatedLayout />}>
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/ngos/verify" element={<ProtectedRoute requiredRole="ADMIN"><NGOVerificationQueue /></ProtectedRoute>} />

            {/* Donor Routes */}
            <Route path="/donor" element={<ProtectedRoute requiredRole="DONOR"><DonorDashboard /></ProtectedRoute>} />
            <Route path="/donor/donate" element={<ProtectedRoute requiredRole="DONOR"><CreateDonation /></ProtectedRoute>} />
            <Route path="/donor/donation/:id" element={<ProtectedRoute requiredRole="DONOR"><DonationDetails /></ProtectedRoute>} />

            {/* Other Roles */}
            <Route path="/ngo" element={<ProtectedRoute requiredRole="NGO"><div>NGO Dashboard (Person 3)</div></ProtectedRoute>} />
            <Route path="/driver" element={<ProtectedRoute requiredRole="DRIVER"><div>Driver Dashboard (Person 5)</div></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function HomePage() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    const roleRoutes = {
      ADMIN: '/admin',
      DONOR: '/donor',
      NGO: '/ngo',
      DRIVER: '/driver',
    };
    return <Navigate to={roleRoutes[user.role]} replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white tracking-tight">
          CPI Logistics <span className="text-emerald-500">Platform</span>
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Algorithmic Micro-Donation & Food-Waste Routing Service. Coordinating surplus food redistribution securely and efficiently.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="bg-emerald-600 text-white px-8 py-3 rounded-md font-medium hover:bg-emerald-700 transition shadow-sm"
          >
            Access Portal
          </a>
        </div>
      </div>
      <footer className="absolute bottom-8 text-sm text-zinc-500">
        &copy; 2026 CPI Food Rescue Platform
      </footer>
    </div>
  );
}

export default App;
