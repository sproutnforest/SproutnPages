import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/Bookcard";
import SkeletonGrid from "../components/SkeletonGrid";
import { searchBooks } from "../lib/search";
import type { Book } from "../lib/qdrant";

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null); // the active genre, if any

  useEffect(() => {
    setSelected(null); // every new search starts unfiltered
    if (!q) {
      setBooks([]);
      return;
    }
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const result = await searchBooks(q);
        if (!cancelled) setBooks(result);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [q]);

  // every different genre across all the results, the most common first
  const genreList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) {
      for (const g of b.genres ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([g]) => g);
  }, [books]);

  const shown = selected
    ? books.filter((b) => b.genres?.includes(selected))
    : books;

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Search results</h3>
          {q && (
            <>
              <span className="panel-sep" aria-hidden="true">
                ~
              </span>
              <p className="panel-sub">“{q}”</p>
            </>
          )}
        </div>

        {!q && (
          <p className="panel-sub">
            Type a title or an author in the search box.
          </p>
        )}
        {loading && <SkeletonGrid count={10} label="Searching" />}
        {error && <p className="auth-error">{error}</p>}

        {q && !loading && !error && books.length === 0 && (
          <p className="panel-sub">
            No books found. Try fewer words or check the spelling.
          </p>
        )}

        {!loading && genreList.length > 0 && (
          <div
            className="genre-filter"
            role="group"
            aria-label="Filter by genre"
          >
            {genreList.map((g) => {
              const active = selected === g;
              const dimmed = selected !== null && !active;
              return (
                <button
                  key={g}
                  type="button"
                  className={`genre-btn${active ? " is-active" : ""}${dimmed ? " is-dim" : ""}`}
                  aria-pressed={active}
                  onClick={() => setSelected(active ? null : g)}
                >
                  {g.replace(/-/g, " ")}
                </button>
              );
            })}
          </div>
        )}

        {shown.length > 0 && (
          <div className="grid">
            {shown.map((book) => (
              <BookCard key={book.book_id} book={book} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
