import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/Bookcard";
import LoadingText from "../components/LoadingText";
import { searchBooks } from "../lib/search";
import type { Book } from "../lib/qdrant";

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
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
        {loading && <LoadingText>Searching </LoadingText>}
        {error && <p className="auth-error">{error}</p>}

        {q && !loading && !error && books.length === 0 && (
          <p className="panel-sub">
            No books found. Try fewer words or check the spelling.
          </p>
        )}

        {books.length > 0 && (
          <div className="grid">
            {books.map((book) => (
              <BookCard key={book.book_id} book={book} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
