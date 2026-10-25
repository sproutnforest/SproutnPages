import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  if (loading) return null; // or a spinner, so you don't flash the login page on refresh
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <Navigate to="/" replace /> : <Outlet />;
}