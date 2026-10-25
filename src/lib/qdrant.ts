const COLLECTION = import.meta.env.VITE_QDRANT_COLLECTION as string;

export type Book = {
  book_id: string;
  title: string;
  author: string;
  description: string;
  author_id: number;
  cover_link?: string | null;
};

export async function getBookById(bookId: string): Promise<Book | null> {
  const res = await fetch(`/qdrant/collections/${COLLECTION}/points/scroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { must: [{ key: "book_id", match: { value: bookId } }] },
      limit: 1,
      with_payload: true,
      with_vector: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Qdrant request failed (${res.status})`);
  }

  const json = await res.json();
  const point = json.result?.points?.[0];
  return point ? (point.payload as Book) : null;
}

export async function getBooksByIds(bookIds: string[]): Promise<Book[]> {
  if (bookIds.length === 0) return [];

  const res = await fetch(`/qdrant/collections/${COLLECTION}/points/scroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { must: [{ key: "book_id", match: { any: bookIds } }] },
      limit: bookIds.length,
      with_payload: true,
      with_vector: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Qdrant request failed (${res.status})`);
  }

  const json = await res.json();
  const found: Book[] = (json.result?.points ?? []).map((p: { payload: Book }) => p.payload);

  // Qdrant returns them in its own order, so restore the shelf's order
  const byId = new Map(found.map((b) => [String(b.book_id), b]));
  return bookIds.map((id) => byId.get(id)).filter((b): b is Book => Boolean(b));
}