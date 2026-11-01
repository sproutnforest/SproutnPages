import { apiGet } from "./api";
import type { Book } from "./qdrant";

export type SectionBook = Book & { rating_count?: number; avg_rating?: number };

export const getPopularBooks = () =>
  apiGet<{ books: SectionBook[] }>("/popular?limit=50&days=30").then((r) => r.books);

export const getBestRated = () =>
  apiGet<{ books: SectionBook[] }>("/best-rated?limit=50").then((r) => r.books);