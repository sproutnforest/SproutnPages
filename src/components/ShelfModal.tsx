import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TrashIcon from "./TrashIcon";
import {
  deleteShelf,
  errorMessage,
  getShelfBookIds,
  removeBookFromShelf,
} from "../lib/shelves";
import type { Shelf } from "../lib/shelves";
import { getBooksByIds } from "../lib/qdrant";
import type { Book } from "../lib/qdrant";

type Props = {
  shelf: Shelf;
  onClose: () => void;
  onDeleted: (shelfId: Shelf["id"]) => void;
};

export default function ShelfModal({ shelf, onClose, onDeleted }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionError, setActionError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ids = await getShelfBookIds(shelf.id);
        const found = await getBooksByIds(ids);
        if (!cancelled) setBooks(found);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shelf.id]);

  async function handleRemove(book: Book) {
    const id = String(book.book_id);
    setRemovingId(id);
    setActionError("");
    try {
      await removeBookFromShelf(shelf.id, id);
      setBooks((prev) => prev.filter((b) => String(b.book_id) !== id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDeleteShelf() {
    setDeleting(true);
    setActionError("");
    try {
      await deleteShelf(shelf.id);
      onDeleted(shelf.id); // parent removes it from the list and closes this popup
    } catch (err) {
      setActionError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="shelf-modal-head">
          <h3 className="modal-title">{shelf.name}</h3>
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete shelf"
            title="Delete shelf"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
          >
            <TrashIcon size={20} />
          </button>
        </div>

        {confirmDelete && (
          <div className="confirm-box">
            <p>Delete this shelf? The books stay in the library, but they'll be removed from it.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteShelf}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete shelf"}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="panel-sub">Loading books...</p>}
        {error && <p className="auth-error">{error}</p>}

        {!loading && !error && books.length === 0 && (
          <p className="panel-sub">This shelf is empty. Add books from a book's page.</p>
        )}

        {books.length > 0 && (
          <ul className="shelf-book-list">
            {books.map((book) => {
              const id = String(book.book_id);
              return (
                <li key={id} className="shelf-book-item">
                  <Link to={`/book/${id}`} className="shelf-book-link">
                    <span className="shelf-book-title">{book.title}</span>
                    <span className="shelf-book-author">{book.author}</span>
                  </Link>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${book.title} from shelf`}
                    title="Remove from shelf"
                    onClick={() => handleRemove(book)}
                    disabled={removingId === id}
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {actionError && <p className="auth-error">{actionError}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}