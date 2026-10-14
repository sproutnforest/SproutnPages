import React from 'react';
import { BookOpen, Sparkles, User, Search } from 'lucide-react';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ searchTerm, onSearchChange }) => {
  return (
    <header style={styles.header}>
      <div style={styles.navContainer}>
        {/* Logo Brand */}
        <div style={styles.brand}>
          <div style={styles.logoIcon}>
            <BookOpen size={22} color="#ffffff" />
          </div>
          <div>
            <span style={styles.brandTitle}>SproutnPages</span>
            <span style={styles.brandBadge}>AI Recommendations</span>
          </div>
        </div>

        {/* Search Bar */}
        <div style={styles.searchBox}>
          <Search size={18} color="#94a3b8" style={{ marginRight: '10px' }} />
          <input
            type="text"
            placeholder="Search books, authors, or genres..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* User Navigation */}
        <nav style={styles.navLinks}>
          <a href="#explore" style={styles.link}>
            <Sparkles size={16} style={{ marginRight: '6px' }} />
            Explore
          </a>
          <button style={styles.profileBtn}>
            <User size={16} style={{ marginRight: '6px' }} />
            My Library
          </button>
        </nav>
      </div>
    </header>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    padding: '0.85rem 2rem',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
  },
  navContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: '1.5rem',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoIcon: {
    backgroundColor: '#3b82f6',
    padding: '8px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#ffffff',
    display: 'block',
    lineHeight: 1.1,
  },
  brandBadge: {
    fontSize: '0.7rem',
    color: '#60a5fa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0.5rem 1rem',
    flex: 1,
    maxWidth: '500px',
  },
  searchInput: {
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    width: '100%',
    fontSize: '0.9rem',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  link: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
  },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};