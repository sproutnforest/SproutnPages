import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;

  // No session means the link was invalid or expired
  if (!session) {
    return (
      <AuthLayout>
        <h5 className="auth-panel-title">Link expired</h5>
        <p className="panel-sub">This reset link is invalid or has expired.</p>
        <p className="auth-switch">
          <Link to="/forgot-password">Request a new one</Link>
        </p>
      </AuthLayout>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    navigate("/");
  }

  return (
    <AuthLayout>
      <h5 className="auth-panel-title">Set a new password</h5>
      <p className="panel-sub">Choose something you'll remember.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Saving..." : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}