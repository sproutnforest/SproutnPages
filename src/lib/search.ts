import { supabase } from "./supabase";
import type { Book } from "./qdrant";

export async function searchBooks(q: string): Promise<Book[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be logged in.");

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/search?q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);

  return (await res.json()).books;
}