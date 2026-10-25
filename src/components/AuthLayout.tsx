import type { ReactNode } from "react";
import authImage from "../assets/tea_logo.png"; // your picture

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="page">
      <section className="auth-split">
        <div className="auth-image">
          <img src={authImage} alt="Books and reading" />
        </div>
        <div className="auth-box">{children}</div>
      </section>
    </main>
  );
}