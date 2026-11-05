import { apiGet } from "./api";
import type { Book } from "./qdrant";

export type ExploreResult = {
  books: Book[];
  keywords: string[];
  personalized?: boolean;
  reason?: string;
};

export const exploreBooks = (text: string) =>
  apiGet<ExploreResult>(`/explore?q=${encodeURIComponent(text)}`);