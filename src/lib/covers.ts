import { supabase } from "./supabase";

export async function getCoverUrl(bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("book_cover")
    .select("cover_url")
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) return null; // a missing cover should never break the page
  return data?.cover_url ?? null;
}

export type BookExtras = { coverUrl: string | null; genres: string[] };

export async function getBookExtras(bookId: string): Promise<BookExtras> {
  const { data, error } = await supabase
    .from("book_cover")
    .select("cover_url, genres")
    .eq("book_id", bookId)
    .maybeSingle();

  if (error || !data) return { coverUrl: null, genres: [] }; // missing extras should never break the page
  return { coverUrl: data.cover_url ?? null, genres: data.genres ?? [] };
}