import { Link } from "react-router-dom";
import BookCover from "./BookCover";
import type { Book } from "../lib/qdrant";

type Props = {
  book: Pick<Book, "book_id" | "title" | "author" | "cover_link">;
};

export default function BookCard({ book }: Props) {
  return (
    <Link to={`/book/${book.book_id}`} className="rec-card">
      <div className="rec-cover">
        <BookCover bookId={book.book_id} title={book.title} coverLink={book.cover_link} />
      </div>
      <div className="rec-info">
        <span className="rec-title">{book.title}</span>
        <span className="rec-author">{book.author}</span>
      </div>
    </Link>
  );
}