import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: call your backend here
    console.log({ email, password });
    navigate("/");
  }

  return (
  <AuthLayout>
    <h5 className="auth-panel-title">Welcome back</h5>
    <p className="panel-sub">Let's start flipping pages.</p>

    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button type="submit" className="btn">Log in</button>
    </form>

    <p className="auth-switch">
      New here? <Link to="/signup">Create an account</Link>
    </p>
  </AuthLayout>
);
}