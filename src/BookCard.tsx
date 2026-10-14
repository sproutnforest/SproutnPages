import React from 'react';
import { Star, Bookmark, ArrowRight } from 'lucide-react';

export interface Book {
  id: number;
  title: string;
  author: string;
  predictedRating: number;
  genre: string;
  description: string;
  coverColor: string;
}

export const BookCard: React.FC<{ book: Book }> = ({ book }) => {
  return (
    <div style={styles.card}>
      {/* Decorative Book Cover Header */}
      <div style={{ ...styles.coverHeader, background: book.coverColor }}>
        <span style={styles.genreBadge}>{book.genre}</span>
        <button style={styles.bookmarkBtn} title="Save book">
          <Bookmark size={16} color="#ffffff" />
        </button>
      </div>

      {/* Card Content */}
      <div style={styles.body}>
        <div>
          <h3 style={styles.title}>{book.title}</h3>
          <p style={styles.author}>by {book.author}</p>
          <p style={styles.description}>{book.description}</p>
        </div>

        <div style={styles.footer}>
          <div style={styles.ratingBadge}>
            <Star size={15} fill="#f59e0b" color="#f59e0b" style={{ marginRight: '5px' }} />
            <span>{book.predictedRating.toFixed(2)} Match</span>
          </div>

          <button style={styles.detailBtn}>
            Details <ArrowRight size={14} style={{ marginLeft: '4px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  coverHeader: {
    height: '100px',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  genreBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: '#ffffff',
    backdropFilter: 'blur(4px)',
    padding: '0.25rem 0.6rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  bookmarkBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  body: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 1,
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 0.25rem 0',
  },
  author: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginBottom: '0.75rem',
  },
  description: {
    fontSize: '0.875rem',
    color: '#cbd5e1',
    lineHeight: '1.5',
    marginBottom: '1.25rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid #334155',
  },
  ratingBadge: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#312e81',
    color: '#c7d2fe',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  detailBtn: {
    backgroundColor: 'transparent',
    color: '#60a5fa',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
};