import BookSection from "../components/BookSection";
import ExploreChat from "../components/ExploreChat";
import PickedForYou from "../components/PickedForYou";
import { getBestRated, getPopularBooks } from "../lib/sections";
import type { SectionBook } from "../lib/sections";
import { useBookList } from "../lib/BookList";

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
  const popular = useBookList(getPopularBooks);
  const best = useBookList(getBestRated);

  return (
    <main className="page">
      <PickedForYou greeting={greeting} />

      <ExploreChat />

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
