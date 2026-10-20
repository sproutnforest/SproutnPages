import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="header">
      <a href="/" className="logo">
        SproutnPages
      </a>

      <nav className="nav">
        <Link to="/">Home</Link>
        <Link to="/browse">Browse</Link>
        <Link to="/library">My Library</Link>
        <Link to="/login">Log in</Link>
        <Link to="/signup">Sign up</Link>
      </nav>
    </header>
  );
}