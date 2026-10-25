import { supabase } from "./supabase";

export type Shelf = { id: number | string; name: string; created_at: string };

export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong.";
}

// 23505 = unique violation (book already on that shelf)
export function isDuplicate(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function getShelves(userId: string): Promise<Shelf[]> {
  const { data, error } = await supabase
    .from("shelf")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createShelf(userId: string, name: string): Promise<Shelf> {
  const { data, error } = await supabase
    .from("shelf")
    .insert({ name, user_id: userId })
    .select("id, name, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function addBookToShelf(shelfId: Shelf["id"], bookId: string): Promise<void> {
  const { error } = await supabase
    .from("shelf_book")
    .insert({ shelf_id: shelfId, book_id: bookId });
  if (error) throw error;
}

// Which of the given shelves already contain this book?
export async function getShelfIdsWithBook(
  bookId: string,
  shelfIds: Shelf["id"][]
): Promise<Set<string>> {
  if (shelfIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("shelf_book")
    .select("shelf_id")
    .eq("book_id", bookId)
    .in("shelf_id", shelfIds);
  if (error) throw error;
  return new Set(data.map((row) => String(row.shelf_id)));
}

// Book ids on a shelf, newest first
export async function getShelfBookIds(shelfId: Shelf["id"]): Promise<string[]> {
  const { data, error } = await supabase
    .from("shelf_book")
    .select("book_id")
    .eq("shelf_id", shelfId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => String(row.book_id));
}

export async function removeBookFromShelf(shelfId: Shelf["id"], bookId: string): Promise<void> {
  const { data, error } = await supabase
    .from("shelf_book")
    .delete()
    .eq("shelf_id", shelfId)
    .eq("book_id", bookId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Couldn't remove that book. Please try again.");
  }
}

export async function deleteShelf(shelfId: Shelf["id"]): Promise<void> {
  const { data, error } = await supabase
    .from("shelf")
    .delete()
    .eq("id", shelfId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete that shelf. Please try again.");
  }
}