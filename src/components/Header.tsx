export default function Header() {
  return (
    <header className="header">
      <a href="/" className="logo">
        SproutnPages
      </a>

      <nav className="nav">
        <a href="/">Home</a>
        <a href="/browse">Browse</a>
        <a href="/shelf">My Library</a>
      </nav>
    </header>
  );
}