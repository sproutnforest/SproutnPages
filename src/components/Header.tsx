import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

export default function Header() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="header">
      <a href="/" className="logo">
        SproutnPages
      </a>

      <nav className="nav">
        {session ? (
          <>
            <Link to="/">Home</Link>
            <form className="nav-search" onSubmit={handleSearch} role="search">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or author"
                aria-label="Search books"
              />
            </form>
            <Link to="/library">My Library</Link>
            <button
              className="nav-link-btn"
              onClick={() => supabase.auth.signOut()}
            >
              Log out
            </button>
            <Link to="/profile" className="profile-icon" aria-label="Profile">
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="10" r="3.2" />
                <path d="M5.5 18.5c1.5-3 4-4 6.5-4s5 1 6.5 4" />
              </svg>
            </Link>
          </>
        ) : (
          <></>
        )}
      </nav>
    </header>
  );
}
