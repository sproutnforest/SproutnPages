import { supabase } from "./supabase";

export type Book = {
  book_id: string;
  title: string;
  author: string;
  description: string;
  author_id: number;
  cover_link?: string | null;
  b_cnt?: number;
  b_avg?: number;
  genres?: string[];
};

const API = import.meta.env.VITE_API_URL as string;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be logged in.");
  return { Authorization: `Bearer ${token}` };
}

export async function getBookById(bookId: string): Promise<Book | null> {
  const res = await fetch(`${API}/books/${encodeURIComponent(bookId)}`, {
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function getBooksByIds(bookIds: string[]): Promise<Book[]> {
  if (bookIds.length === 0) return [];
  const res = await fetch(
    `${API}/books?ids=${encodeURIComponent(bookIds.join(","))}`,
    {
      headers: await authHeaders(),
    },
  );
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()).books;
}
