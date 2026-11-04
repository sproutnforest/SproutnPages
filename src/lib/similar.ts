import { apiGet } from "./api";
import type { Book } from "./qdrant";

export const getSimilarBooks = (bookId: string) =>
  apiGet<{ books: Book[] }>(`/similar/${encodeURIComponent(bookId)}`).then((r) => r.books);