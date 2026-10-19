import Header from "@/components/Header";
import BookCard from "@/components/BookCard";

// Placeholder data. Swap this for your real recommendations later.
const books = [
  {
    id: 1,
    title: "Piranesi",
    author: "Susanna Clarke",
    genre: "Fantasy",
    blurb: "A man lives in an endless house of statues and tides, and slowly learns what he has forgotten.",
    color: "#DE7A45",
  },
  {
    id: 2,
    title: "Circe",
    author: "Madeline Miller",
    genre: "Mythology",
    blurb: "The witch from the Odyssey tells her own story, from exile on a lonely island onward.",
    color: "#F8A63A",
  },
  {
    id: 3,
    title: "The Secret History",
    author: "Donna Tartt",
    genre: "Dark academia",
    blurb: "A circle of classics students at a small college, and the crime that unravels them.",
    color: "#DE7A45",
  },
  {
    id: 4,
    title: "Project Hail Mary",
    author: "Andy Weir",
    genre: "Sci-fi",
    blurb: "A lone astronaut wakes up with no memory and a very large problem to solve.",
    color: "#F8A63A",
  },
  {
    id: 5,
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    genre: "Literary fiction",
    blurb: "Two friends build video games together across thirty years of friendship and rivalry.",
    color: "#DE7A45",
  },
  {
    id: 6,
    title: "A Psalm for the Wild-Built",
    author: "Becky Chambers",
    genre: "Cozy sci-fi",
    blurb: "A tea monk and a curious robot take a quiet walk through a gentle world.",
    color: "#F8A63A",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="page">
        <section className="panel">
          <h1 className="panel-title">Picked for you</h1>
          <p className="panel-sub">Quiet reads for the evening. Pick one and settle in.</p>

          <div className="grid">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}