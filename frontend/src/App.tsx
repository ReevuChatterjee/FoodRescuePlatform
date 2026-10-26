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

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

// Auth
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { useAuthStore } from './hooks/useAuthStore';

// Lazy-loaded Pages
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const NGOVerificationQueue = lazy(() => import('./pages/admin/NGOVerificationQueue').then(m => ({ default: m.NGOVerificationQueue })));
const NGOList = lazy(() => import('./pages/admin/NGOList').then(m => ({ default: m.NGOList })));
const AdminDonors = lazy(() => import('./pages/admin/AdminDonors').then(m => ({ default: m.AdminDonors })));
const AdminDrivers = lazy(() => import('./pages/admin/AdminDrivers').then(m => ({ default: m.AdminDrivers })));
const AdminDeliveries = lazy(() => import('./pages/admin/AdminDeliveries').then(m => ({ default: m.AdminDeliveries })));
const AdminNetwork = lazy(() => import('./pages/admin/AdminNetwork').then(m => ({ default: m.AdminNetwork })));
const AdminTraceability = lazy(() => import('./pages/admin/AdminTraceability').then(m => ({ default: m.AdminTraceability })));
const AdminReports = lazy(() => import('./pages/admin/AdminReports').then(m => ({ default: m.AdminReports })));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));

// Donor
const DonorDashboard = lazy(() => import('./pages/donor/DonorDashboard').then(m => ({ default: m.DonorDashboard })));
const CreateDonation = lazy(() => import('./pages/donor/CreateDonation').then(m => ({ default: m.CreateDonation })));
const DonationDetails = lazy(() => import('./pages/donor/DonationDetails').then(m => ({ default: m.DonationDetails })));

// NGO
const NGODashboard = lazy(() => import('./pages/ngo/NGODashboard').then(m => ({ default: m.NGODashboard })));
const IncomingOffers = lazy(() => import('./pages/ngo/IncomingOffers').then(m => ({ default: m.IncomingOffers })));
const NGOSettings = lazy(() => import('./pages/ngo/NGOSettings').then(m => ({ default: m.NGOSettings })));

// Driver
const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard').then(m => ({ default: m.DriverDashboard })));
const DriverDeliveries = lazy(() => import('./pages/driver/DriverDeliveries').then(m => ({ default: m.DriverDeliveries })));
const DriverHistory = lazy(() => import('./pages/driver/DriverHistory').then(m => ({ default: m.DriverHistory })));
const DriverProfile = lazy(() => import('./pages/driver/DriverProfile').then(m => ({ default: m.DriverProfile })));

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

function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base text-on-surface">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-primary" size={28} />
        <span className="text-[0.8125rem] font-mono-data text-on-surface-variant uppercase tracking-widest">
          Loading interface...
        </span>
      </div>
    </div>
  );
}

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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
