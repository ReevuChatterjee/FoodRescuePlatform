/**
 * ProtectedRoute: wraps admin routes with role-based access control.
 *
 * Per [orig §42]: frontend guard is UX-only; backend 403 is the real boundary.
 * If backend denies access, this won't catch it — that error is handled by
 * the API client's 401 interceptor (logout + redirect).
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../hooks/useAuthStore';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: 'ADMIN' | 'DONOR' | 'NGO' | 'DRIVER';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
