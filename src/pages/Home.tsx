import Header from "../components/Header";
import BookCard from "../components/Bookcard";
import type { Book } from "../components/BookCard";

// Placeholder data. Swap this for your real recommendations later.
const books: Book[] = [
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

const greetings = [
  { from: 4,  text: "Early light, a stretch and a yawn. Start a new chapter. Curated just for you." },
  { from: 7,  text: "Good morning. Pick a book to go with your coffee. Curated just for you." },
  { from: 11, text: "Midday break. Take a breather with a few pages. Curated just for you." },
  { from: 15, text: "A slow afternoon calls for a good story. Curated just for you." },
  { from: 18, text: "Quiet reads for the evening. Pick one and settle in. Curated just for you." },
  { from: 22, text: "Lights low, one more chapter. Curated just for you." },
];

function getGreeting(hour: number) {
  let current = greetings[greetings.length - 1]; 
  for (const g of greetings) {
    if (hour >= g.from) current = g;
  }
  return current.text;
}

export default function App() {
  const greeting = getGreeting(new Date().getHours());

  return (
    <>
      <main className="page">
        <section className="panel">
          <h5 className="panel-title">Picked for you</h5>
          <p className="panel-sub">{greeting}</p>

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