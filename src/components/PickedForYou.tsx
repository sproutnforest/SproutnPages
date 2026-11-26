import { useEffect, useRef, useState } from "react";
import BookList from "./BookList";
import SkeletonGrid from "./SkeletonGrid";
import { genreLabel, useGenres } from "../lib/genres";
import { getRecommendations } from "../lib/recommend";
import type { RecommendResult } from "../lib/recommend";

export default function PickedForYou({ greeting }: { greeting: string }) {
  const [genre, setGenre] = useState<string | null>(null);
  const [data, setData] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { genres: genreList, loading: genresLoading } = useGenres();
  const cache = useRef(new Map<string, RecommendResult>());

  useEffect(() => {
    const key = genre ?? "all";
    const cached = cache.current.get(key);
    if (cached) {
      setData(cached);
      setError("");
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setData(null);
    setError("");
    setLoading(true);

    getRecommendations(genre, ctrl.signal)
      .then((result) => {
        if (ctrl.signal.aborted) return;
        cache.current.set(key, result);
        setData(result);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return; // cancelled on purpose, not an error
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    // a new choice (or leaving the page) cancels this request
    return () => ctrl.abort();
  }, [genre, attempt]);

  return (
    <section className="panel home-section">
      <div className="panel-head">
        <h3 className="panel-title">Picked for you</h3>
        <span className="panel-sep" aria-hidden="true">
          ~
        </span>
        <p className="panel-sub">{greeting}</p>
      </div>

      {/* shown right away; it does not wait for any books */}
      <div
        className="genre-filter"
        role="group"
        aria-label="Filter recommendations by genre"
      >
        {genreList.length > 0
          ? genreList.map(({ genre: g }) => {
              const active = genre === g;
              const dimmed = genre !== null && !active;
              return (
                <button
                  key={g}
                  type="button"
                  className={`genre-btn${active ? " is-active" : ""}${dimmed ? " is-dim" : ""}`}
                  aria-pressed={active}
                  onClick={() => setGenre(active ? null : g)}
                >
                  {genreLabel(g)}
                </button>
              );
            })
          : genresLoading &&
            Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="skeleton skeleton-chip"
                aria-hidden="true"
              />
            ))}
      </div>

      {loading && <SkeletonGrid count={10} label="Finding your next read" />}

      {error && (
        <div>
          <p className="auth-error">{error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && data.books.length === 0 && (
        <p className="panel-sub">
          {genre
            ? "We couldn't find books in this genre for you right now. Try another one."
            : "No recommendations right now. Check back soon."}
        </p>
      )}

      {data?.reason === "cold_start" && data.books.length > 0 && (
        <p className="panel-sub cold-note">
          Rate a few books you like (3 stars or more) and your picks will start
          matching your taste.
        </p>
      )}

      {data && data.books.length > 0 && (
        <BookList key={genre ?? "all"} books={data.books} />
      )}
    </section>
  );
}
