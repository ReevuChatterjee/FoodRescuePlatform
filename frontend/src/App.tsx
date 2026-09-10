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
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { NGOVerificationQueue } from './pages/admin/NGOVerificationQueue';
import { useAuthStore } from './hooks/useAuthStore';
import { NGODashboard } from './pages/ngo/NGODashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<div>Login Page (Person 1)</div>} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ngos/verify"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <NGOVerificationQueue />
              </ProtectedRoute>
            }
          />

          {/* Placeholder routes for other modules */}
          <Route path="/donor" element={<div>Donor Dashboard (Person 2)</div>} />
          <Route path="/ngo" element={<ProtectedRoute requiredRole="NGO"><NGODashboard /></ProtectedRoute>} />
          <Route path="/driver" element={<div>Driver Dashboard (Person 5)</div>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function HomePage() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    // Redirect to role-specific dashboard
    const roleRoutes = {
      ADMIN: '/admin',
      DONOR: '/donor',
      NGO: '/ngo',
      DRIVER: '/driver',
    };
    return <Navigate to={roleRoutes[user.role]} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">CPI Food Rescue Platform</h1>
        <p className="text-gray-600 mb-8">
          Algorithmic Micro-Donation & Food-Waste Routing Service
        </p>
        <a
          href="/login"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Login
        </a>
      </div>
    </div>
  );
}

export default App;
