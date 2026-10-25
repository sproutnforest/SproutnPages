import { supabase } from "./supabase";

export type MyReview = {
  id: number | string;
  created_at: string;
  user_id: string;
  book_id: string;
  rating: number;
  review: string | null;
};

export type BookReview = MyReview & {
  reviewer: { username: string } | null;
};

const REVIEW_WITH_USER = "id, created_at, user_id, book_id, rating, review, reviewer:user ( username )";

// All reviews for one book, newest first, with the reviewer's username
export async function getReviewsForBook(bookId: string): Promise<BookReview[]> {
  const { data, error } = await supabase
    .from("rating")
    .select(REVIEW_WITH_USER)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BookReview[];
}

// All reviews written by one user, newest first
export async function getReviewsByUser(userId: string): Promise<MyReview[]> {
  const { data, error } = await supabase
    .from("rating")
    .select("id, created_at, user_id, book_id, rating, review")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyReview[];
}

// Creates the review, or updates it if this user already reviewed this book
export async function saveReview(
  userId: string,
  bookId: string,
  rating: number,
  review: string | null
): Promise<BookReview> {
  const { data, error } = await supabase
    .from("rating")
    .upsert({ user_id: userId, book_id: bookId, rating, review }, { onConflict: "user_id,book_id" })
    .select(REVIEW_WITH_USER)
    .single();
  if (error) throw error;
  return data as unknown as BookReview;
}