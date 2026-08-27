import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export const ProtectedRoute = ({ roles }) => {
  const { isAuthenticated, hasRole, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!hasRole(roles)) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center">
        <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">Access restricted</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Your role doesn't have permission to view this page. Contact an administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <Outlet />;
};
