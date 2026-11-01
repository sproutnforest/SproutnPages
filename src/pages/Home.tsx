import { useEffect, useState } from "react";
import BookSection from "../components/BookSection";
import { getRecommendations } from "../lib/recommend";
import type { RecommendedBook } from "../lib/recommend";
import { getBestRated, getPopularBooks } from "../lib/sections";
import type { SectionBook } from "../lib/sections";

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

const emptyMessages: Record<string, string> = {
  no_history: "Rate a few books you liked (3 stars or more) and your picks will show up here.",
  no_vectors: "Rate a few books you liked (3 stars or more) and your picks will show up here.",
  cold_start: "We couldn't pick any books right now. Please try again in a moment.",
  no_candidates: "We've run out of new suggestions. Try rating more books.",
};

// loads a list once when the page opens and exposes loading, error and retry
function useBookList<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return { data, loading, error, retry: () => setAttempt((n) => n + 1) };
}

export default function Home() {
  const greeting = getGreeting(new Date().getHours());

  const recs = useBookList(getRecommendations);
  const popular = useBookList(getPopularBooks);
  const best = useBookList(getBestRated);

  const recBooks: RecommendedBook[] = recs.data?.books ?? [];
  const reason = recs.data?.reason ?? null;

  return (
    <main className="page">
      <BookSection
        title="Picked for you"
        subtitle={greeting}
        books={recBooks}
        loading={recs.loading}
        loadingText="Finding your next read"
        error={recs.error}
        onRetry={recs.retry}
        emptyMessage={(reason && emptyMessages[reason]) ?? "No recommendations right now. Check back soon."}
        note={
          reason === "cold_start" ? (
            <p className="panel-sub cold-note">
              Rate a few books you like (3 stars or more) and your picks will start matching your taste.
            </p>
          ) : null
        }
      />

      <BookSection
        title="Popular Books Lately"
        subtitle="Most rated by readers in the last 30 days."
        books={(popular.data ?? []) as SectionBook[]}
        loading={popular.loading}
        loadingText="Checking what's popular"
        error={popular.error}
        onRetry={popular.retry}
        emptyMessage="No ratings in the last 30 days yet. Rate a book to get this list started!"
      />

      <BookSection
        title="Best Rated Books"
        subtitle="Highest average rating from all readers."
        books={(best.data ?? []) as SectionBook[]}
        loading={best.loading}
        loadingText="Finding the best rated"
        error={best.error}
        onRetry={best.retry}
        emptyMessage="Nothing to show yet."
      />
    </main>
  );
}