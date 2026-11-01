import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import EditProfileModal from "../components/EditProfileModal";
import ShelfModal from "../components/ShelfModal";
import type { Shelf } from "../lib/shelves";
import { Link } from "react-router-dom";
import ReviewCard from "../components/ReviewCard";
import { getBooksByIds } from "../lib/qdrant";
import type { Book } from "../lib/qdrant";
import { getReviewsByUser } from "../lib/ratings";
import type { MyReview } from "../lib/ratings";
import { errorMessage } from "../lib/shelves";
import LoadingText from "../components/LoadingText";
import ReviewSkeletonList from "../components/ReviewSkeletonList";

type UserRow = { username: string; email: string };

export default function Profile() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<UserRow | null>(null);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [openShelf, setOpenShelf] = useState<Shelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [shelfName, setShelfName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [booksById, setBooksById] = useState<Record<string, Book>>({});
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");

  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);
      const [userRes, shelfRes] = await Promise.all([
        supabase
          .from("user")
          .select("username, email")
          .eq("id", userId)
          .single(),
        supabase
          .from("shelf")
          .select("id, name, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      ]);

      if (userRes.error || shelfRes.error) {
        setLoadError((userRes.error || shelfRes.error)!.message);
      } else {
        setProfile(userRes.data);
        setShelves(shelfRes.data);
      }
      setLoading(false);
    }

    load();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadReviews() {
      try {
        const list = await getReviewsByUser(userId!);
        const ids = [...new Set(list.map((r) => String(r.book_id)))];
        const books = await getBooksByIds(ids); // titles live in Qdrant
        if (cancelled) return;
        setMyReviews(list);
        setBooksById(
          Object.fromEntries(books.map((b) => [String(b.book_id), b])),
        );
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
  }, [userId]);

  async function handleAddShelf(e: FormEvent) {
    e.preventDefault();
    const name = shelfName.trim();
    if (!name || !userId) return;

    setSaving(true);
    setSaveError("");

    const { data, error } = await supabase
      .from("shelf")
      .insert({ name, user_id: userId })
      .select("id, name, created_at")
      .single();

    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    setShelves((prev) => [...prev, data]);
    setShelfName("");
    setShowModal(false);
  }

  function closeModal() {
    setShowModal(false);
    setShelfName("");
    setSaveError("");
  }

  const username = profile?.username ?? "";

  return (
    <main className="page">
      <section className="panel">
        {loadError && <p className="auth-error">{loadError}</p>}

        {/* Top: avatar, name, edit button */}
        <div className="profile-top">
          <div className="avatar">{username.charAt(0).toUpperCase()}</div>
          <div className="profile-info">
            <h1 className="profile-username">
              {loading ? <LoadingText> </LoadingText> : username}
            </h1>
            <p className="profile-sub">{profile?.email}</p>
          </div>
          <button
            className="btn btn-ghost profile-edit"
            type="button"
            onClick={() => setShowEdit(true)}
          >
            ✎ Edit Profile
          </button>
        </div>

        {/* Shelves */}
        <h3 className="profile-heading">My Shelves</h3>
        {loading ? (
          <div
            className="shelf-grid"
            role="status"
            aria-label="Loading shelves"
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="skeleton skeleton-shelf"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <div className="shelf-grid">
            {shelves.map((shelf) => (
              <button
                key={shelf.id}
                type="button"
                className="shelf-btn"
                onClick={() => setOpenShelf(shelf)}
              >
                {shelf.name}
              </button>
            ))}
            <button
              type="button"
              className="shelf-btn shelf-add"
              onClick={() => setShowModal(true)}
            >
              + New shelf
            </button>
          </div>
        )}

        {/* Ratings (template for now) */}
        <h3 className="profile-heading">My Ratings</h3>

        {reviewsLoading && (
          <ReviewSkeletonList count={3} label="Loading your reviews" />
        )}
        {reviewsError && <p className="auth-error">{reviewsError}</p>}
        {!reviewsLoading && !reviewsError && myReviews.length === 0 && (
          <p className="panel-sub">You haven't reviewed any books yet.</p>
        )}

        {myReviews.length > 0 && (
          <ul className="review-list">
            {myReviews.map((r) => {
              const b = booksById[String(r.book_id)];
              return (
                <ReviewCard
                  key={r.id}
                  heading={
                    b ? (
                      <Link to={`/book/${b.book_id}`}>{b.title}</Link>
                    ) : (
                      "Unknown book"
                    )
                  }
                  createdAt={r.created_at}
                  rating={r.rating}
                  text={r.review}
                />
              );
            })}
          </ul>
        )}
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">New shelf</h3>
            <form className="auth-form" onSubmit={handleAddShelf}>
              <label>
                Shelf name
                <input
                  type="text"
                  value={shelfName}
                  onChange={(e) => setShelfName(e.target.value)}
                  placeholder="e.g. Want to read"
                  maxLength={40}
                  autoFocus
                  required
                />
              </label>
              {saveError && <p className="auth-error">{saveError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={saving || !shelfName.trim()}
                >
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEdit && profile && userId && (
        <EditProfileModal
          userId={userId}
          email={profile.email}
          username={profile.username}
          onClose={() => setShowEdit(false)}
          onUsernameSaved={(username) =>
            setProfile((p) => (p ? { ...p, username } : p))
          }
        />
      )}
      {openShelf && (
        <ShelfModal
          shelf={openShelf}
          onClose={() => setOpenShelf(null)}
          onDeleted={(id) => {
            setShelves((prev) =>
              prev.filter((s) => String(s.id) !== String(id)),
            );
            setOpenShelf(null);
          }}
        />
      )}
    </main>
  );
}
