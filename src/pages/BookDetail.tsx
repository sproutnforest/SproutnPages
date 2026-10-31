import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import AddToShelfModal from "../components/AddToShelfModal";
import ReviewCard from "../components/ReviewCard";
import { StarInput } from "../components/Stars";
import { useAuth } from "../context/AuthContext";
import { getBookById } from "../lib/qdrant";
import type { Book } from "../lib/qdrant";
import { deleteReview, getReviewsForBook, saveReview } from "../lib/ratings";
import type { BookReview } from "../lib/ratings";
import { errorMessage } from "../lib/shelves";
import BookCover from "../components/BookCover";
import { getCoverUrl } from "../lib/covers";
import TrashIcon from "../components/TrashIcon";

export default function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");

  const [showShelf, setShowShelf] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load the book from Qdrant
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    async function loadBook() {
      setLoading(true);
      setError("");
      try {
        const result = await getBookById(bookId!);
        if (!cancelled) setBook(result);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBook();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Load the reviews from Supabase
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    async function loadReviews() {
      setReviewsLoading(true);
      setReviewsError("");
      try {
        const list = await getReviewsForBook(bookId!);
        if (!cancelled) setReviews(list);
      } catch (err) {
        if (!cancelled) setReviewsError(errorMessage(err));
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    }

    loadReviews();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setCoverUrl(null);

    getCoverUrl(bookId).then((url) => {
      if (!cancelled) setCoverUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const myReview = reviews.find((r) => r.user_id === userId);

  function openReviewModal() {
    setRating(myReview?.rating ?? 0);
    setText(myReview?.review ?? "");
    setSaveError("");
    setConfirmDelete(false);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !bookId || rating === 0) return;

    setSaving(true);
    setSaveError("");
    try {
      const saved = await saveReview(
        userId,
        bookId,
        rating,
        text.trim() || null,
      );
      setReviews((prev) =>
        prev.some((r) => r.user_id === userId)
          ? prev.map((r) => (r.user_id === userId ? saved : r))
          : [saved, ...prev],
      );
      setShowModal(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!userId || !bookId) return;
    setDeleting(true);
    setSaveError("");
    try {
      await deleteReview(userId, bookId);
      setReviews((prev) => prev.filter((r) => r.user_id !== userId));
      setConfirmDelete(false);
      setShowModal(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <section className="panel">
          <p className="panel-sub">Loading...</p>
        </section>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="page">
        <section className="panel">
          <h3 className="panel-title">Book not found</h3>
          {error && <p className="auth-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="book-top">
          <div className="book-cover">
            <BookCover
              key={book.book_id}
              bookId={book.book_id}
              title={book.title}
              coverLink={coverUrl}
            />
          </div>

          <div className="book-info">
            <h1 className="book-title">{book.title}</h1>
            <h2 className="book-author">{book.author}</h2>
            <p className="book-desc">{book.description}</p>

            <div className="book-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setShowShelf(true)}
              >
                + Add to shelf
              </button>
            </div>
          </div>
        </div>

        <div className="reviews">
          <div className="reviews-head">
            <h3 className="reviews-title">Reviews</h3>
            <button className="btn" onClick={openReviewModal}>
              {myReview ? "Edit your review" : "Add review"}
            </button>
          </div>

          {reviewsLoading && <p className="panel-sub">Loading reviews...</p>}
          {reviewsError && <p className="auth-error">{reviewsError}</p>}
          {!reviewsLoading && !reviewsError && reviews.length === 0 && (
            <p className="panel-sub">
              No reviews yet. Be the first to add one.
            </p>
          )}

          {reviews.length > 0 && (
            <ul className="review-list">
              {reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  heading={r.reviewer?.username ?? "Unknown reader"}
                  createdAt={r.created_at}
                  rating={r.rating}
                  text={r.review}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="shelf-modal-head">
              <h3 className="modal-title">
                {myReview ? "Edit your review" : `Review ${book.title}`}
              </h3>
              {myReview && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Delete your review"
                  title="Delete your review"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting || saving}
                >
                  <TrashIcon size={20} />
                </button>
              )}
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Your rating
                <StarInput value={rating} onChange={setRating} />
              </label>
              <label>
                Your review (optional)
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What did you think?"
                />
              </label>
              {saveError && <p className="auth-error">{saveError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={saving || rating === 0}
                >
                  {saving ? "Saving..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showShelf && userId && bookId && (
        <AddToShelfModal
          userId={userId}
          bookId={bookId}
          bookTitle={book.title}
          onClose={() => setShowShelf(false)}
        />
      )}

      {confirmDelete && (
        <div className="confirm-box">
          <p>
            Delete your review of this book? Your rating will be removed too.
          </p>
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
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
