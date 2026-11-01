import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername) {
      setError("Please choose a username.");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Please enter a valid email address, like name@example.com.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);

    // 1. Is the username or email already taken? (precise answer for each)
    const { data, error: checkError } = await supabase.rpc("check_signup", {
      p_username: cleanUsername,
      p_email: cleanEmail,
    });

    if (checkError) {
      setSubmitting(false);
      setError("Couldn't check your details. Please try again.");
      return;
    }

    const taken = data as { username_taken: boolean; email_taken: boolean };
    if (taken.username_taken && taken.email_taken) {
      setSubmitting(false);
      setError(
        "That username is taken, and an account with that email already exists.",
      );
      return;
    }
    if (taken.username_taken) {
      setSubmitting(false);
      setError("That username is already taken. Please choose another.");
      return;
    }
    if (taken.email_taken) {
      setSubmitting(false);
      setError(
        "An account with that email already exists. Try logging in instead.",
      );
      return;
    }

    // 2. Create the account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername } },
      },
    );
    setSubmitting(false);

    if (signUpError) {
      // Two people can submit at the same moment, so the database still has the final say
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("already registered")) {
        setError(
          "An account with that email already exists. Try logging in instead.",
        );
      } else if (msg.includes("database error")) {
        setError("That username was just taken. Please choose another.");
      } else {
        setError(signUpError.message);
      }
      return;
    }

    // If email confirmation is on, there's no session yet
    if (!signUpData.session) {
      setInfo("Check your email to confirm your account, then log in.");
    }
  }

  return (
    <AuthLayout>
      <h3 className="auth-panel-title">Join SproutnPages</h3>
      <p className="panel-sub">Join us in our coziness of books and blanket.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
