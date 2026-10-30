import { supabase } from "./supabase";
import type { Book } from "./qdrant";

export type RecommendedBook = Book & {
  predicted_rating?: number;
  expected_rating?: number;
  cosine?: number;
};

export type RecommendResult = { books: RecommendedBook[]; reason?: string };

export async function getRecommendations(): Promise<RecommendResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be logged in.");

  const res = await fetch(`${import.meta.env.VITE_API_URL}/recommend`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Recommendation request failed (${res.status})`);

  return res.json();
}
