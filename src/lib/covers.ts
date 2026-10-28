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