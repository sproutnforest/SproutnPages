import { apiGet } from "./api";
import type { Book } from "./qdrant";

export type RecommendedBook = Book & {
  predicted_rating?: number;
  expected_rating?: number;
  cosine?: number;
};

export type RecommendResult = { books: RecommendedBook[]; reason?: string };

export const getRecommendations = (
  genre?: string | null,
  signal?: AbortSignal,
) =>
  apiGet<RecommendResult>(
    `/recommend${genre ? `?genre=${encodeURIComponent(genre)}` : ""}`,
    signal,
  );
