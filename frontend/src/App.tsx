/**
 * Main App — routing for all four roles.
 *
 * Routes:
 *   /           → LandingPage (public)
 *   /login      → LoginPage (auth flow)
 *   /admin/*    → Admin routes (ADMIN role) — AdminLayout
 *   /donor/*    → Donor routes (DONOR role) — DonorLayout
 *   /ngo/*      → NGO routes (NGO role)     — NGOLayout
 *   /driver     → Driver routes (DRIVER)    — DriverLayout
 *
 * Each role page imports its own layout. No shared AppLayout wrapper here.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Auth
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { useAuthStore } from './hooks/useAuthStore';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { NGOVerificationQueue } from './pages/admin/NGOVerificationQueue';
import { NGOList } from './pages/admin/NGOList';
import { AdminDonors } from './pages/admin/AdminDonors';
import { AdminDrivers } from './pages/admin/AdminDrivers';
import { AdminDeliveries } from './pages/admin/AdminDeliveries';
import { AdminNetwork } from './pages/admin/AdminNetwork';
import { AdminTraceability } from './pages/admin/AdminTraceability';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminSettings } from './pages/admin/AdminSettings';

// Donor
import { DonorDashboard } from './pages/donor/DonorDashboard';
import { CreateDonation } from './pages/donor/CreateDonation';
import { DonationDetails } from './pages/donor/DonationDetails';

// NGO
import { NGODashboard } from './pages/ngo/NGODashboard';
import { IncomingOffers } from './pages/ngo/IncomingOffers';
import { NGOSettings } from './pages/ngo/NGOSettings';

// Driver
import { DriverDashboard } from './pages/driver/DriverDashboard';
import { DriverDeliveries } from './pages/driver/DriverDeliveries';
import { DriverHistory } from './pages/driver/DriverHistory';
import { DriverProfile } from './pages/driver/DriverProfile';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10000,
    },
  },
});

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  DONOR: '/donor',
  NGO: '/ngo',
  DRIVER: '/driver',
};

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated && user) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
  }
  return <LandingPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin */}
          <Route
            path="/admin"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>}
          />
          <Route
            path="/admin/ngos/verify"
            element={<ProtectedRoute requiredRole="ADMIN"><NGOVerificationQueue /></ProtectedRoute>}
          />
          <Route
            path="/admin/ngos"
            element={<ProtectedRoute requiredRole="ADMIN"><NGOList /></ProtectedRoute>}
          />
          <Route
            path="/admin/donors"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminDonors /></ProtectedRoute>}
          />
          <Route
            path="/admin/drivers"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminDrivers /></ProtectedRoute>}
          />
          <Route
            path="/admin/deliveries"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminDeliveries /></ProtectedRoute>}
          />
          <Route
            path="/admin/network"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminNetwork /></ProtectedRoute>}
          />
          <Route
            path="/admin/traceability"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminTraceability /></ProtectedRoute>}
          />
          <Route
            path="/admin/reports"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminReports /></ProtectedRoute>}
          />
          <Route
            path="/admin/settings"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminSettings /></ProtectedRoute>}
          />

          {/* Donor */}
          <Route
            path="/donor"
            element={<ProtectedRoute requiredRole="DONOR"><DonorDashboard /></ProtectedRoute>}
          />
          <Route
            path="/donor/donate"
            element={<ProtectedRoute requiredRole="DONOR"><CreateDonation /></ProtectedRoute>}
          />
          <Route
            path="/donor/donation/:id"
            element={<ProtectedRoute requiredRole="DONOR"><DonationDetails /></ProtectedRoute>}
          />

          {/* NGO */}
          <Route
            path="/ngo"
            element={<ProtectedRoute requiredRole="NGO"><NGODashboard /></ProtectedRoute>}
          />
          <Route
            path="/ngo/incoming"
            element={<ProtectedRoute requiredRole="NGO"><IncomingOffers /></ProtectedRoute>}
          />
          <Route
            path="/ngo/settings"
            element={<ProtectedRoute requiredRole="NGO"><NGOSettings /></ProtectedRoute>}
          />

          {/* Driver */}
          <Route
            path="/driver"
            element={<ProtectedRoute requiredRole="DRIVER"><DriverDashboard /></ProtectedRoute>}
          />
          <Route
            path="/driver/deliveries"
            element={<ProtectedRoute requiredRole="DRIVER"><DriverDeliveries /></ProtectedRoute>}
          />
          <Route
            path="/driver/history"
            element={<ProtectedRoute requiredRole="DRIVER"><DriverHistory /></ProtectedRoute>}
          />
          <Route
            path="/driver/profile"
            element={<ProtectedRoute requiredRole="DRIVER"><DriverProfile /></ProtectedRoute>}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
