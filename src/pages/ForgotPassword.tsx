import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthLayout>
      <h5 className="auth-panel-title">Forgot your password?</h5>
      <p className="panel-sub">Enter your email and we'll send you a reset link.</p>

      {sent ? (
        <p className="auth-info">
          If an account exists for {email}, a reset link is on its way. Check your spam folder too.
        </p>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <p className="auth-switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}