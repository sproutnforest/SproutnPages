import { useState } from "react";
import type { ReactNode } from "react";
import BookCard from "./Bookcard";
import type { Book } from "../lib/qdrant";
import SkeletonGrid from "./SkeletonGrid";

type Props = {
  title: string;
  subtitle: ReactNode;
  books: Book[];
  loading: boolean;
  loadingText: string;
  error: string;
  onRetry?: () => void;
  emptyMessage: ReactNode;
  note?: ReactNode;
  previewCount?: number;
};

export default function BookSection({
  title,
  subtitle,
  books,
  loading,
  loadingText,
  error,
  onRetry,
  emptyMessage,
  note,
  previewCount = 10,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? books : books.slice(0, previewCount);
  const hasMore = books.length > previewCount;

  return (
    <section className="panel home-section">
      <div className="panel-head">
        <h3 className="panel-title">{title}</h3>
        <span className="panel-sep" aria-hidden="true">
          ~
        </span>
        <p className="panel-sub">{subtitle}</p>
      </div>

      {loading && <SkeletonGrid count={previewCount} label={loadingText} />}

      {error && (
        <div>
          <p className="auth-error">{error}</p>
          {onRetry && (
            <button type="button" className="btn" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}

      {!loading && !error && books.length === 0 && (
        <p className="panel-sub">{emptyMessage}</p>
      )}

      {books.length > 0 && note}

      {visible.length > 0 && (
        <div className="grid">
          {visible.map((book) => (
            <BookCard key={book.book_id} book={book} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="view-more-row">
          <button
            type="button"
            className="link-btn view-more"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded
              ? "Show less"
              : `View more (${books.length - previewCount} more)`}
          </button>
        </div>
      )}
    </section>
  );
}
