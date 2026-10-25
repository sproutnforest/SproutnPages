import { useEffect, useState } from "react";
import BookCard from "../components/Bookcard";
import { getRecommendations } from "../lib/recommend";
import type { RecommendedBook } from "../lib/recommend";
import LoadingText from "../components/LoadingText";

const greetings = [
  {
    from: 4,
    text: "Early light, a stretch and a yawn. Start a new chapter. Curated just for you.",
  },
  {
    from: 7,
    text: "Good morning. Pick a book to go with your breakfast. Curated just for you.",
  },
  {
    from: 11,
    text: "Midday break. Take a breather with a few pages. Curated just for you.",
  },
  {
    from: 15,
    text: "A slow afternoon calls for a good story. Curated just for you.",
  },
  {
    from: 18,
    text: "Quiet reads for the evening. Pick one and settle in. Curated just for you.",
  },
  { from: 22, text: "Lights low, one more chapter. Curated just for you." },
];

function getGreeting(hour: number) {
  let current = greetings[greetings.length - 1];
  for (const g of greetings) {
    if (hour >= g.from) current = g;
  }
  return current.text;
}

export default function Home() {
  const greeting = getGreeting(new Date().getHours());

  const [books, setBooks] = useState<RecommendedBook[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // bump to retry

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getRecommendations();
        if (cancelled) return;
        setBooks(result.books);
        setReason(result.reason ?? null);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Picked for you</h3>
          <span className="panel-sep" aria-hidden="true">
            ~
          </span>
          <p className="panel-sub">{greeting}</p>
        </div>

        {loading && <LoadingText>Finding your next read </LoadingText>}

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

        {!loading && !error && books.length === 0 && (
          <p className="panel-sub">
            {reason
              ? "Rate a few books you liked (3 stars or more) and your picks will show up here."
              : "No recommendations right now. Check back soon."}
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
