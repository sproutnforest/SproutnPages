import { useState } from "react";
import BookCard from "./Bookcard";
import type { Book } from "../lib/qdrant";

type Props = { books: Book[]; previewCount?: number };

export default function BookList({ books, previewCount = 10 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? books : books.slice(0, previewCount);
  const hasMore = books.length > previewCount;

  return (
    <>
      <div className="grid">
        {visible.map((book) => (
          <BookCard key={book.book_id} book={book} />
        ))}
      </div>

      {hasMore && (
        <div className="view-more-row">
          <button type="button" className="link-btn view-more" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Show less" : `View more (${books.length - previewCount} more)`}
          </button>
        </div>
      )}
    </>
  );
}